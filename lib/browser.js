const { chromium } = require('playwright');

class VideoBuddyBrowser {
  constructor(options) {
    this.browser = {};
    this.options = options;
  }

  async getChromium() {
    this.browser = await getBrowser(this.options);
    return this.browser;
  }

  async getNewContext(storageState = null) {
    return await getNewContext(this.browser, this.options, storageState);
  }

  async waitForLoadState(page) {
    await waitForLoadState(page);
  }
}

module.exports = { VideoBuddyBrowser };

async function getBrowser(options) {
  const args = [
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--disable-login-animations',
  ];

  const mocksPath = require.main.path.split('/').slice(0, -1).concat('mocks').join('/');
  args.push(`--use-file-for-fake-video-capture=${mocksPath}/video.y4m`);
  if (!options.silent) {
    args.push(`--use-file-for-fake-audio-capture=${mocksPath}/audio.wav`);
  }

  return await chromium.launch({
    args,
    headless: !options.showWindow,
    ignoreHTTPSErrors: true,
  });
}

async function waitForLoadState(page) {
  try {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
  } catch (error) {
    console.error('An error occurred during `waitForLoadState`. Trying to proceed...');
  }
}

async function getNewContext(browser, options, storageState) {
  const args = {};
  if (storageState) args['storageState'] = storageState;
  if (options.recordSession) args['recordVideo'] = { dir: './recordings' };
  return await browser.newContext(args);
}
