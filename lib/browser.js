// playwright-extra is a drop-in replacement for playwright that adds extra features
const { chromium } = require('playwright-extra');
// stealth plugin provides tricks to hide playwright usage
const stealth = require('puppeteer-extra-plugin-stealth')();

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
    '--disable-dev-shm-usage',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--disable-login-animations',
  ];

  const video = options.frozen ? 'color' : 'video';
  const mocksPath = require.main.path.split('/').slice(0, -1).concat('mocks').join('/');
  args.push(`--use-file-for-fake-video-capture=${mocksPath}/${video}.mjpeg`);
  if (!options.silent) args.push(`--use-file-for-fake-audio-capture=${mocksPath}/audio.wav`);

  chromium.use(stealth);

  return await chromium.launch({
    args,
    headless: !options.showWindow,
    ignoreHTTPSErrors: true,
  });
}

async function waitForLoadState(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
}

async function getNewContext(browser, options, storageState) {
  const args = {};
  if (storageState) args['storageState'] = storageState;
  if (options.recordSession) args['recordVideo'] = { dir: './recordings' };
  return await browser.newContext(args);
}
