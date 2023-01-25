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

  await page.goto(getEndpoint(options.callId));

  await new Authentication(page, options).init();

  if (options.camera) await enableCamera(page);

  if (options.mic) await enableMicrophone(page);

  if (options.usersCount > 1) await addUsers(options, context);

  if (options.duration == null) return;

  await sleep(options.duration);

  await browser.close();
}

async function addUsers(options, context) {
  for (let i = 1; i < options.usersCount; i++) {
    const newPage = await context.newPage();
    const randomId = `buddy_${Math.floor(Math.random() * 10_000)}`;
    await newPage.goto(`${getEndpoint(options.callId)}?user_id=${randomId}`);
  }
}

async function getBrowser(options) {
  const mocksPath = require.main.path.split('/').slice(0, -1).concat('mocks').join('/');

  const args = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--disable-login-animations',
  ];

  const video = options.frozen ? 'color' : 'video';
  args.push(`--use-file-for-fake-video-capture=${mocksPath}/${video}.mjpeg`);
  if (!options.silent) args.push(`--use-file-for-fake-audio-capture=${mocksPath}/audio.wav`);

  return await chromium.launch({
    args,
    headless: !options.showWindow,
    ignoreHTTPSErrors: true,
  });
}

async function sleep(ms) {
  return await new Promise((resolve) => setTimeout(resolve, ms * 1000));
}

async function enableCamera(page) {
  await page.click('.str-video__call-controls__button--icon-camera-off');
}

async function enableMicrophone(page) {
  await page.click('.str-video__call-controls__button--icon-mic-off');
}

function ensureEnvVars() {
  const appUrl = process.env.STREAM_SDK_TEST_APP ?? '';
  const email = process.env.STREAM_SDK_TEST_ACCOUNT_EMAIL ?? '';
  const password = process.env.STREAM_SDK_TEST_ACCOUNT_PASSWORD ?? '';

  if (appUrl == null || email == null || password == null) {
    throw new Error('App url, email and password should be provided.');
  }
}

function getEndpoint(callId) {
  return `${process.env.STREAM_SDK_TEST_APP}/join/${callId}`;
}
