class Authentication {
  constructor(page, options) {
    this.page = page;
    this.headless = !options.showWindow;
  }

  async init() {
    await googleAuth(this.page, this.headless);
  }
}

module.exports = { Authentication }

async function googleAuth(page, headless) {
  const navigationPromise = page.waitForNavigation({ waitUntil: "domcontentloaded" })
  await page.goto(process.env.STREAM_SDK_TEST_APP);
  await navigationPromise;
  await page.click("button:text('Sign in with your Google Stream account')");
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', process.env.STREAM_SDK_TEST_ACCOUNT_EMAIL);

  const nextBtn = headless ? "input[id='next']" : "#identifierNext"
  await page.click(nextBtn);
  await page.waitForSelector('input[type="password"]', { visible: true });
  await page.type('input[type="password"]', process.env.STREAM_SDK_TEST_ACCOUNT_PASSWORD);

  const signInBtn = headless ? "input[id='submit']" : "#passwordNext"
  await page.click(signInBtn);
  await navigationPromise;
}

