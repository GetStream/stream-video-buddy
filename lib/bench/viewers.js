const { chromium } = require('playwright');

/**
 * The browser side of the benchmark: receive-only livestream viewers.
 *
 * Two things here are deliberate departures from `lib/client.js`:
 *
 * 1. Bots are sharded across several chromium *processes* and several
 *    BrowserContexts. Chromium coalesces same-origin pages in one context into
 *    a single renderer, and dozens of peer connections in one renderer is the
 *    configuration that produces the "it breaks past 50" failures usually
 *    blamed on the server. Separate contexts are separate profiles, so they get
 *    separate renderers, and separate browsers cap the blast radius of a crash.
 * 2. Nothing uses `Promise.all`. One bot failing to join must never end the run.
 */

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-dev-shm-usage',
  // Without these three, Chromium throttles timers in backgrounded/offscreen
  // tabs, so headless bots drift out of their message cadence and their
  // telemetry goes ragged. They matter more than they look.
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ViewerFleet {
  constructor(options, pageUrl) {
    this.options = options;
    this.pageUrl = pageUrl;
    this.browsers = [];
    this.contexts = new Map();
    this.bots = new Map();
    // Kept so a churning bot can rejoin with the same identity it started with.
    this.tokens = new Map();
  }

  async launch() {
    const count = Number(this.options.userCount);
    const perBrowser = Number(this.options.pagesPerBrowser);
    const browserCount = Math.max(1, Math.ceil(count / perBrowser));

    for (let i = 0; i < browserCount; i++) {
      const launchOptions = {
        args: LAUNCH_ARGS,
        headless: !this.options.showWindow,
        ignoreHTTPSErrors: true,
      };
      if (this.options.browserChannel) launchOptions.channel = this.options.browserChannel;
      this.browsers.push(await chromium.launch(launchOptions));
    }

    return browserCount;
  }

  /** Opens one bot's page and joins the call. Throws so the caller can retry. */
  async startBot(bot) {
    const perContext = Number(this.options.pagesPerContext);
    const perBrowser = Number(this.options.pagesPerBrowser);

    const browserIndex = Math.floor(bot.index / perBrowser) % this.browsers.length;
    const browser = this.browsers[browserIndex];

    // A fresh context per group of pages, so Chromium spreads them over
    // separate renderer processes instead of one overloaded one.
    const contextKey = `${browserIndex}:${Math.floor(bot.index / perContext)}`;
    if (!this.contexts.has(contextKey)) {
      this.contexts.set(contextKey, await browser.newContext());
    }
    const context = this.contexts.get(contextKey);

    const page = await context.newPage();
    if (this.options.verbose) {
      page.on('console', (msg) => console.log(`[${bot.id}] ${msg.text()}`));
    }

    await page.goto(this.pageUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.streamBenchStart === 'function', {
      timeout: 30_000,
    });

    this.tokens.set(bot.id, bot.token);
    await page.evaluate((config) => window.streamBenchStart(config), this.configFor(bot));

    const record = {
      browserIndex,
      contextKey,
      id: bot.id,
      index: bot.index,
      page,
      rejoins: 0,
    };
    this.bots.set(bot.id, record);
    return record;
  }

  configFor(bot) {
    return {
      apiKey: this.options.apiKey,
      callId: this.options.callId,
      callType: this.options.callType,
      incomingHeight: Number(this.options.videoHeight),
      incomingWidth: Number(this.options.videoWidth),
      token: bot.token,
      userId: bot.id,
      video: this.options.video !== false,
    };
  }

  /**
   * Makes some bots leave and rejoin.
   *
   * Steady-state viewers produce one participant event each and then go quiet,
   * which is a memory test but not an event-handling test. Churn is what
   * actually exercises the app's participant join/leave handling.
   */
  async churn(fraction) {
    const records = [...this.bots.values()];
    const howMany = Math.max(1, Math.round(records.length * fraction));
    const picked = records.sort(() => Math.random() - 0.5).slice(0, howMany);

    const results = await Promise.allSettled(
      picked.map(async (record) => {
        if (record.page.isClosed()) return;
        const bot = { id: record.id, index: record.index, token: this.tokens.get(record.id) };
        await record.page.evaluate(() => window.streamBenchStop());
        await sleep(500);
        await record.page.evaluate(
          (config) => window.streamBenchStart(config),
          this.configFor(bot),
        );
        record.rejoins += 1;
      }),
    );

    return results.filter((r) => r.status === 'fulfilled').length;
  }

  /** Reads every bot's in-page state. Never throws - a dead page is a result. */
  async collect() {
    const out = [];
    for (const record of this.bots.values()) {
      let state = null;
      try {
        state = record.page.isClosed()
          ? null
          : await record.page.evaluate(() => window.streamBench);
      } catch (error) {
        state = { error: error.message, status: 'unreachable' };
      }
      out.push({
        browserIndex: record.browserIndex,
        contextKey: record.contextKey,
        id: record.id,
        rejoins: record.rejoins,
        state,
      });
    }
    return out;
  }

  async close() {
    for (const record of this.bots.values()) {
      try {
        if (!record.page.isClosed()) {
          await record.page.evaluate(() => window.streamBenchStop());
        }
      } catch (error) {
        // Best effort.
      }
    }
    for (const browser of this.browsers) {
      try {
        await browser.close();
      } catch (error) {
        // Best effort.
      }
    }
  }
}

module.exports = { sleep, ViewerFleet };
