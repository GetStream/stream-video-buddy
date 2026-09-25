#! /usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { chromium } = require('playwright');
const { program } = require('commander');
const { createTokenSource } = require('./tokens');
const { formatTable, summarize } = require('./stats');

const HARNESS_DIR = __dirname;
const VENDOR_BUNDLE = path.join(HARNESS_DIR, 'vendor', 'sdk.js');
const CLIENT_ENTRY = path.join(HARNESS_DIR, 'sdk-entry.js');

// The published browser builds still have bare imports, so they need bundling
// once before a <script type="module"> can load them.
function ensureVendorBundle() {
  if (fs.existsSync(VENDOR_BUNDLE)) return;
  console.log('- Bundling the Stream SDKs (one-time setup)...');
  fs.mkdirSync(path.dirname(VENDOR_BUNDLE), { recursive: true });
  execFileSync(
    'npx',
    [
      '--yes',
      'esbuild@0.23.1',
      CLIENT_ENTRY,
      '--bundle',
      '--format=esm',
      '--platform=browser',
      `--outfile=${VENDOR_BUNDLE}`,
      '--log-level=warning',
    ],
    { stdio: 'inherit' },
  );
}

function serveHarness() {
  const app = express();
  app.use(express.static(HARNESS_DIR));
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/join-page.html` });
    });
  });
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function run(options) {
  const total = Number(options.participants);
  const tabs = Math.max(1, Math.min(Number(options.tabs), total));
  const rampMs = Number(options.ramp);

  ensureVendorBundle();

  let participants;
  if (options.guest) {
    participants = Array.from({ length: total }, (_, i) => ({
      userId: `${options.userPrefix}${i}`,
    }));
  } else {
    const mintToken = createTokenSource(options);
    console.log(`- Minting ${total} tokens...`);
    participants = await Promise.all(
      Array.from({ length: total }, async (_, i) => {
        const userId = `${options.userPrefix}${i}`;
        return { token: await mintToken(userId), userId };
      }),
    );
  }

  const { server, url } = await serveHarness();
  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--use-fake-ui-for-media-stream',
      // No --use-file-for-fake-video-capture: viewers never open a camera, and
      // pointing Chrome at a large y4m would dominate the measurement.
      '--use-fake-device-for-media-stream',
    ],
    headless: !options.showWindow,
  });

  const groups = chunk(participants, Math.ceil(total / tabs));
  console.log(
    `- Joining "${options.callType}:${options.callId}" with ${total} ${
      options.guest ? 'guest' : 'authenticated'
    } viewer(s) across ${groups.length} tab(s)...`,
  );
  console.log(
    options.chatChannelId
      ? `  chat: ${options.messageCount} message(s) to ${options.chatChannelType}:${options.chatChannelId} after joining`
      : '  chat: off (pass --chat-channel-id to enable)',
  );

  const context = await browser.newContext();
  const started = Date.now();
  const pages = [];

  const results = (
    await Promise.all(
      groups.map(async (group) => {
        const page = await context.newPage();
        pages.push(page);
        page.on('pageerror', (error) => console.error(`  ! page error: ${error.message}`));
        await page.goto(url);
        await page.waitForFunction(() => window.buddyHarnessReady === true);
        return page.evaluate((config) => window.buddyHarness.join(config), {
          apiKey: options.apiKey,
          callId: options.callId,
          callType: options.callType,
          chat: options.chatChannelId
            ? {
                channelId: options.chatChannelId,
                channelType: options.chatChannelType,
                message: options.message,
                messageCount: Number(options.messageCount),
              }
            : null,
          create: Boolean(options.create),
          guest: Boolean(options.guest),
          participants: group,
          rampMs,
        });
      }),
    )
  ).flat();

  const wallMs = Date.now() - started;
  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log(`\n- ${ok.length}/${total} joined in ${wallMs}ms wall clock`);

  if (ok.length) {
    const joinStats = summarize(ok.map((r) => r.joinMs));
    const totalStats = summarize(ok.map((r) => r.totalMs));
    /* eslint-disable sort-keys -- ascending percentiles read better than alphabetical */
    const row = (label, s) => ({
      metric: label,
      min: Math.round(s.min),
      p50: Math.round(s.p50),
      p90: Math.round(s.p90),
      p95: Math.round(s.p95),
      p99: Math.round(s.p99),
      max: Math.round(s.max),
      mean: Math.round(s.mean),
    });
    /* eslint-enable sort-keys */
    const rows = [row('call.join() ms', joinStats)];
    if (ok[0].chatConnectMs !== undefined) {
      rows.push(row('chat connect ms', summarize(ok.map((r) => r.chatConnectMs))));
      rows.push(row('chat send ms', summarize(ok.map((r) => r.chatSendMs))));
    }
    rows.push(row('end to end ms', totalStats));
    console.log(`\n${formatTable(rows)}`);
    console.log(`\n  throughput: ${(ok.length / (wallMs / 1000)).toFixed(1)} joins/sec`);
  }

  if (failed.length) {
    console.log(`\n- ${failed.length} failure(s):`);
    const seen = new Map();
    failed.forEach((f) => seen.set(f.error, (seen.get(f.error) || 0) + 1));
    [...seen.entries()].forEach(([error, count]) => console.log(`  ${count}x ${error}`));
  }

  if (options.json) {
    fs.writeFileSync(
      options.json,
      JSON.stringify({ results, tabs: groups.length, total, wallMs }, null, 2),
    );
    console.log(`\n- Wrote ${options.json}`);
  }

  if (Number(options.hold) > 0) {
    console.log(`- Holding the call for ${options.hold}s...`);
    await new Promise((r) => setTimeout(r, Number(options.hold) * 1000));
  }

  await Promise.all(pages.map((page) => page.evaluate(() => window.buddyHarness.leaveAll())));
  await browser.close();
  server.close();

  if (failed.length) process.exitCode = 1;
}

program
  .name('stream-video-buddy-benchmark')
  .description('Measure how fast viewers can join a Stream call, without an app in the way')
  .requiredOption('-i, --call-id <string>', 'Call to join.')
  .requiredOption('--api-key <string>', 'Stream API key.')
  .option('--call-type <string>', 'Call type.', 'livestream')
  .option('-c, --participants <number>', 'How many viewers should join?', 10)
  .option('--tabs <number>', 'Spread viewers across this many browser tabs.', 1)
  .option('--ramp <ms>', 'Stagger joins inside a tab by this many ms.', 0)
  .option('--hold <seconds>', 'Stay on the call after joining.', 0)
  .option('--create', 'Create the call if it does not exist.', false)
  .option('--guest', 'Join as guest users. Needs no token and no API secret.', false)
  .option('--chat-channel-id <string>', 'Also send a chat message to this channel after joining.')
  .option('--chat-channel-type <string>', 'Chat channel type.', 'messaging')
  .option(
    '-m, --message <string>',
    'Message text. `{userID}` is replaced with the sender id.',
    'Hi from {userID}',
  )
  .option('--message-count <number>', 'How many messages per participant?', 1)
  .option(
    '--api-secret <string>',
    'Mint tokens with this secret. Prefer the STREAM_API_SECRET env var.',
  )
  .option('--token-url <url>', 'Endpoint returning {token} for ?user_id=<id>, instead of minting.')
  .option('--user-prefix <string>', 'User id prefix.', 'loadtest_')
  .option('--json <path>', 'Write raw per-participant results here.')
  .option('--show-window', 'Run headed.', false)
  .action((options) => {
    run(options).catch((error) => {
      console.error(error.message || error);
      process.exit(1);
    });
  });

program.parse();
