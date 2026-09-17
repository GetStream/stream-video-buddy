const { StreamChat } = require('stream-chat');

/**
 * The chat side of the benchmark.
 *
 * These run in Node rather than inside the viewer pages. From the server's
 * point of view a chat WebSocket is the same workload wherever the socket was
 * opened, and the fanout that reaches the measured phone is computed
 * server-side either way - so putting them in the browser would buy nothing,
 * while keeping them here means a crashed renderer cannot take the chat load
 * down with it, and send latency is measured in the process that writes the
 * results.
 *
 * No `addMembers` anywhere: the sample's rooms use Stream's open `livestream`
 * channel type, where the `user` role may watch and post without being a
 * member. That sidesteps the 100-members-per-call API limit entirely, and
 * keeps the bots from permanently joining a real room.
 */

const CHATTER = [
  'lets go',
  'this looks great',
  'can you show that again?',
  'audio is crystal clear here',
  'joining from Amsterdam',
  'what setup are you running?',
  'first time catching one of these live',
  'that transition was smooth',
  'how long are you streaming for today?',
  'quality is holding up really well',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ChatFleet {
  constructor(options) {
    this.options = options;
    this.bots = new Map();
    this.timers = [];
    this.stopped = false;
  }

  /**
   * Creates the bot users up front.
   *
   * Chunked at 100 because that is the per-call cap on Stream's user-upsert
   * API - the same cap that, applied to `addMembers`, is where the "you need
   * loops of 100 connections" folklore actually comes from.
   */
  async upsertUsers(bots) {
    const server = new StreamChat(this.options.apiKey, this.options.apiSecret);
    for (let i = 0; i < bots.length; i += 100) {
      const chunk = bots.slice(i, i + 100);
      await server.upsertUsers(chunk.map((bot) => ({ id: bot.id, name: bot.id })));
    }
  }

  /** Connects one chat bot and starts it talking. Throws so callers can retry. */
  async startBot(bot) {
    // No secret on this instance - it connects as an ordinary client would.
    // `allowServerSideConnect` only silences the SDK's warning about calling
    // connectUser from Node, which it decides from the environment rather than
    // from whether a secret is present. These connections are the whole point
    // of the benchmark, and they do count towards MAU like any real user.
    //
    // `new StreamChat` rather than `getInstance` is required: `getInstance`
    // would hand every bot the same shared connection.
    const client = new StreamChat(this.options.apiKey, { allowServerSideConnect: true });
    const connectedAt = Date.now();

    await client.connectUser({ id: bot.id, name: bot.id }, bot.token);

    const channel = client.channel(this.options.channelType, this.options.channelId);
    await channel.watch();

    const record = {
      channel,
      client,
      connectMs: Date.now() - connectedAt,
      disconnects: 0,
      id: bot.id,
      index: bot.index,
      messagesFailed: 0,
      messagesReceived: 0,
      messagesSent: 0,
      // Counted per reason. "1000 sends failed" is not actionable on its own -
      // a rate limit, a permission problem and a dropped socket all need
      // different responses, and the reason is the whole diagnosis.
      sendErrors: {},
      sendTimings: [],
    };

    channel.on('message.new', () => {
      record.messagesReceived += 1;
    });

    client.on('connection.changed', (event) => {
      if (event && event.online === false) record.disconnects += 1;
    });

    this.bots.set(bot.id, record);
    this.scheduleSend(record);
    return record;
  }

  /**
   * Self-rescheduling, never `setInterval`, so a slow send cannot let sends
   * pile up on top of each other.
   *
   * The first send is offset by the bot's position in the fleet, so in steady
   * state the bots spread evenly across the interval instead of all firing on
   * the same tick - jitter alone leaves a visible thundering pattern for the
   * first few minutes.
   */
  scheduleSend(record) {
    const interval = Number(this.options.messageInterval) * 1000;
    const count = Math.max(1, Number(this.options.userCount));
    const phase = (record.index % count) * (interval / count);

    const next = (delay) => {
      const timer = setTimeout(async () => {
        if (this.stopped) return;
        await this.send(record);
        next(this.jittered(interval));
      }, delay);
      this.timers.push(timer);
    };

    next(phase);
  }

  jittered(interval) {
    const jitter = Number(this.options.messageIntervalJitter);
    return interval * (1 + (Math.random() * 2 - 1) * jitter);
  }

  async send(record) {
    const startedAt = Date.now();
    try {
      await record.channel.sendMessage({ text: this.nextMessage(record) });
      record.messagesSent += 1;
      record.sendTimings.push(Date.now() - startedAt);
    } catch (error) {
      record.messagesFailed += 1;
      const reason =
        (error && error.code ? `code ${error.code}: ` : '') +
        String((error && error.message) || error).slice(0, 160);
      record.sendErrors[reason] = (record.sendErrors[reason] || 0) + 1;
    }
  }

  /**
   * Varied, non-identical text on purpose: 50 bots repeating one string would
   * risk spam heuristics and would make the phone's message list unrealistically
   * cheap to lay out.
   */
  nextMessage(record) {
    if (this.options.messageText) return this.options.messageText;
    const phrase = CHATTER[(record.index + record.messagesSent) % CHATTER.length];
    return `${phrase} (#${record.messagesSent + 1})`;
  }

  async close() {
    this.stopped = true;
    this.timers.forEach(clearTimeout);

    // In parallel, not one at a time. Serially awaiting a 2s disconnect per bot
    // means teardown alone takes bots x 2s - over ten minutes at 400 bots, with
    // the run long finished and nothing to show for the wait.
    await Promise.allSettled(
      [...this.bots.values()].map((record) => record.client.disconnectUser(2000)),
    );
  }
}

module.exports = { ChatFleet, sleep };
