const fs = require('fs');
const { ChatFleet } = require('./chat');
const { sleep, ViewerFleet } = require('./viewers');
const { botUserIds, createToken, dartDefines } = require('./tokens');
const { startViewerServer } = require('./server');

/**
 * Loads a livestream call with receive-only viewers that also chat, so a real
 * client - the Flutter sample on a phone - can be profiled under that load.
 *
 * The numbers that matter come off the phone (adb / DevTools). This runner's
 * own output answers only one question: was the load actually applied, and did
 * it stay applied for the whole run?
 */
class LivestreamBench {
  constructor(options) {
    this.options = options;
    this.runId = options.runId || Date.now().toString(36);
    this.startedAt = new Date();
    this.failures = [];
  }

  async init() {
    const count = Number(this.options.userCount);
    const bots = botUserIds(this.options.userIdPrefix, this.runId, count).map((id, index) => ({
      id,
      index,
      token: createToken(this.options.apiSecret, id),
    }));

    if (this.options.emitDartDefines) {
      const defines = dartDefines({
        apiKey: this.options.apiKey,
        apiSecret: this.options.apiSecret,
        callId: this.options.callId,
      });
      fs.writeFileSync(this.options.emitDartDefines, JSON.stringify(defines, null, 2));
      console.log(`Wrote dart-defines for the Flutter app to ${this.options.emitDartDefines}`);
    }

    const server = await startViewerServer(Number(this.options.benchPort) || 0);
    this.viewers = new ViewerFleet(this.options, server.url);
    this.chat = this.options.channelId ? new ChatFleet(this.options) : null;

    // Teardown on Ctrl-C must still write results - a benchmark you interrupt
    // at minute 4 of 5 should not lose its data.
    let closing = false;
    const shutdown = async () => {
      if (closing) return;
      closing = true;
      await this.finish(server);
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    const browserCount = await this.viewers.launch();
    console.log(
      `Run ${this.runId}: ${count} bots over ${browserCount} chromium process(es), ` +
        `call ${this.options.callType}:${this.options.callId}`,
    );

    try {
      if (this.chat) {
        console.log(`Creating ${count} chat users...`);
        await this.chat.upsertUsers(bots);
      }

      await this.ramp(bots);
      await this.hold();
      await this.finish(server);
    } catch (error) {
      // Anything that escapes the per-bot handling - bad credentials, a
      // missing call - still has to release the browsers it already launched.
      console.error(`\nRun failed: ${error && error.message ? error.message : error}`);
      await this.viewers.close();
      if (this.chat) await this.chat.close();
      await server.close();
      process.exitCode = 1;
    }
  }

  /**
   * Brings bots up in chunks with a pause between them.
   *
   * `Promise.allSettled`, never `Promise.all`: one bot failing to join must not
   * abort the other 49. Each failure is recorded against its own bot and the
   * ramp keeps going.
   */
  async ramp(bots) {
    const chunkSize = Number(this.options.rampChunk);
    const delay = Number(this.options.rampDelay);
    const retries = Number(this.options.joinRetries);

    for (let i = 0; i < bots.length; i += chunkSize) {
      const chunk = bots.slice(i, i + chunkSize);

      const results = await Promise.allSettled(
        chunk.map(async (bot) => {
          await this.withRetry(`viewer ${bot.id}`, retries, () => this.viewers.startBot(bot));
          if (this.chat) {
            await this.withRetry(`chat ${bot.id}`, retries, () => this.chat.startBot(bot));
          }
        }),
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      console.log(
        `ramp ${Math.min(i + chunkSize, bots.length)}/${bots.length} · ` +
          `viewers up ${this.viewers.bots.size}` +
          (this.chat ? ` · chat up ${this.chat.bots.size}` : '') +
          (failed ? ` · ${failed} failed this chunk` : ''),
      );

      if (i + chunkSize < bots.length) await sleep(delay);
    }
  }

  /**
   * Retries with full jitter, so a chunk that failed together does not then
   * retry together and fail together again.
   */
  async withRetry(label, attempts, fn) {
    let lastError;
    for (let attempt = 0; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === attempts) break;
        await sleep(Math.random() * Math.min(30_000, 500 * 2 ** attempt));
      }
    }
    this.failures.push({ label, message: lastError && lastError.message });
    throw lastError;
  }

  /** Holds the load for `--duration`, churning and reporting as it goes. */
  async hold() {
    const duration = Number(this.options.duration) * 1000;
    const churnInterval = Number(this.options.churnInterval) * 1000;
    const churnFraction = Number(this.options.churnFraction);
    const endsAt = Date.now() + duration;

    let nextChurn = churnInterval > 0 ? Date.now() + churnInterval : Infinity;
    let nextBeat = Date.now() + 15_000;

    while (Date.now() < endsAt) {
      await sleep(1000);

      if (Date.now() >= nextChurn) {
        const cycled = await this.viewers.churn(churnFraction);
        console.log(`churn · ${cycled} viewers left and rejoined`);
        nextChurn = Date.now() + churnInterval;
      }

      if (Date.now() >= nextBeat) {
        const elapsed = Math.round((duration - (endsAt - Date.now())) / 1000);
        const messages = this.chat ? this.totalMessages() : null;
        console.log(
          `t+${elapsed}s · viewers ${this.viewers.bots.size}` +
            (messages ? ` · msgs ${messages.sent} sent / ${messages.failed} failed` : ''),
        );
        nextBeat = Date.now() + 15_000;
      }
    }
  }

  totalMessages() {
    let sent = 0;
    let failed = 0;
    for (const record of this.chat.bots.values()) {
      sent += record.messagesSent;
      failed += record.messagesFailed;
    }
    return { failed, sent };
  }

  async finish(server) {
    console.log('\nCollecting results...');
    const viewerStates = await this.viewers.collect();

    const results = this.buildResults(viewerStates);
    fs.writeFileSync(this.options.out, JSON.stringify(results, null, 2));

    this.printSummary(results);
    console.log(`\nFull results: ${this.options.out}`);

    if (this.chat) await this.chat.close();
    await this.viewers.close();
    await server.close();
  }

  buildResults(viewerStates) {
    const joinTimes = viewerStates
      .map((v) => v.state && v.state.joinMs)
      .filter((ms) => typeof ms === 'number');

    // "Still live at the end" is the headline number, and it is the one that
    // actually answers whether anything falls over past 50 connections.
    const stillLive = viewerStates.filter((v) => v.state && v.state.status === 'live').length;

    const chatRecords = this.chat ? [...this.chat.bots.values()] : [];
    const sendTimings = chatRecords.flatMap((r) => r.sendTimings);

    return {
      config: { ...this.options, apiSecret: '[redacted]' },
      endedAt: new Date().toISOString(),
      failures: this.failures,
      runId: this.runId,
      startedAt: this.startedAt.toISOString(),
      summary: {
        chat: this.chat
          ? {
              connected: chatRecords.length,
              disconnects: chatRecords.reduce((sum, r) => sum + r.disconnects, 0),
              received: chatRecords.reduce((sum, r) => sum + r.messagesReceived, 0),
              sendMs: percentiles(sendTimings),
              ...this.totalMessages(),
            }
          : null,
        viewers: {
          failed: viewerStates.length - stillLive,
          joinMs: percentiles(joinTimes),
          rejoins: viewerStates.reduce((sum, v) => sum + v.rejoins, 0),
          requested: Number(this.options.userCount),
          started: viewerStates.length,
          stillLive,
        },
      },
      viewers: viewerStates,
    };
  }

  printSummary(results) {
    const { chat, viewers } = results.summary;
    console.log('\n--- summary ---');
    console.log(
      `viewers   requested ${viewers.requested} · started ${viewers.started} · ` +
        `still live at end ${viewers.stillLive} · rejoins ${viewers.rejoins}`,
    );
    console.log(
      `join ms   p50 ${viewers.joinMs.p50} · p95 ${viewers.joinMs.p95} · max ${viewers.joinMs.max}`,
    );
    if (chat) {
      console.log(
        `chat      connected ${chat.connected} · sent ${chat.sent} · failed ${chat.failed} · ` +
          `received ${chat.received} · disconnects ${chat.disconnects}`,
      );
      console.log(
        `send ms   p50 ${chat.sendMs.p50} · p95 ${chat.sendMs.p95} · max ${chat.sendMs.max}`,
      );
    }
    if (results.failures.length) {
      console.log(`failures  ${results.failures.length} (see results file)`);
    }
  }
}

function percentiles(values) {
  if (!values.length) return { max: null, p50: null, p95: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  return { max: sorted[sorted.length - 1], p50: at(0.5), p95: at(0.95) };
}

module.exports = { LivestreamBench };
