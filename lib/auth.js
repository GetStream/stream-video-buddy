class Authentication {
  constructor(page, options) {
    this.page = page;
    this.headless = !options.showWindow;
  }

  async init() {
    await googleAuth(this.page, this.headless);
  }
}

module.exports = { Authentication };

async function googleAuth(page, headless) {
  const locators = await getLocators(headless);
  const navigationPromise = page.waitForNavigation({ waitUntil: "domcontentloaded" });
  await page.goto(process.env.STREAM_SDK_TEST_APP);
  await navigationPromise;
  await page.waitForSelector(locators.streamSignInBtn);

  const currentTime = Date.now();
  let emailInputIsVisible = false;
  while (!emailInputIsVisible && Date.now() < currentTime + 5000) {
    if (await page.isVisible(locators.streamSignInBtn)) {
      await page.click(locators.streamSignInBtn);
    }
    await page.waitForSelector(locators.email);
    emailInputIsVisible = await page.isVisible(locators.email);
  }

  await page.type(locators.email, process.env.STREAM_SDK_TEST_ACCOUNT_EMAIL);
  await page.click(locators.nextBtn);
  await page.waitForSelector(locators.password, { visible: true });
  await page.type(locators.password, process.env.STREAM_SDK_TEST_ACCOUNT_PASSWORD);

  await page.click(locators.goggleSignInBtn);
  await navigationPromise;
}

async function getLocators(headless) {
  return {
    streamSignInBtn: "button:text('Sign in with your Google Stream account')",
    email: "input[type='email']",
    password: "input[type='password']",
    nextBtn: headless ? "input[id='next']" : "#identifierNext",
    goggleSignInBtn: headless ? "input[id='submit']" : "#passwordNext"
  };
}
