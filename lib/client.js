const { Authentication } = require('./auth');
const { chromium } = require('playwright');

class VideoBuddyClient {
  constructor(options) {
    ensureEnvVars();
    this.options = options;
  }

  async init() {
    await joinCall(this.options);
  }
}

module.exports = { VideoBuddyClient };

async function joinCall(options) {
  const browser = await getBrowser(options);
  const context = await browser.newContext();
  const page = await context.newPage();

  await new Authentication(page, options).init();
  await page.waitForSelector("input[type='text']", { visible: true });
  await page.type("input[type='text']", options.callId);
  await page.click("button:text('Join')");

  if (options.usersCount > 1) await addUsers(options, context);

  if (options.duration == null) return;

  await sleep(options.duration);
  await browser.close();
}

async function addUsers(options, context) {
  for (let i = 1; i < options.usersCount; i++) {
    const newPage = await context.newPage();
    const randomId = `buddy_${Math.floor(Math.random() * 10_000)}`;
    await newPage.goto(
      `${process.env.STREAM_SDK_TEST_APP}/join/${options.callId}?user_id=${randomId}`,
    );
  }
}

async function getBrowser(options) {
  return await chromium.launch({
    args: ['--disable-dev-shm-usage', '--no-sandbox'], // This makes Chrome more stable on CI
    headless: !options.showWindow,
    ignoreHTTPSErrors: true,
    locale: 'en-US',
  });
}

async function sleep(ms) {
  return await new Promise((resolve) => setTimeout(resolve, ms * 1000));
}

function ensureEnvVars() {
  const appUrl = process.env.STREAM_SDK_TEST_APP ?? '';
  const email = process.env.STREAM_SDK_TEST_ACCOUNT_EMAIL ?? '';
  const password = process.env.STREAM_SDK_TEST_ACCOUNT_PASSWORD ?? '';

  if (appUrl == null || email == null || password == null) {
    throw new Error('App url, email and password should be provided.');
  }
}
