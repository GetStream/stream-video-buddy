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
  const locators = getLocators(headless);
  await page.goto(process.env.STREAM_SDK_TEST_APP);
  await page.waitForSelector(locators.streamSignInBtn);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  await page.click(locators.streamSignInBtn);
  await page.waitForSelector(locators.email);
  await page.type(locators.email, process.env.STREAM_SDK_TEST_ACCOUNT_EMAIL);
  await page.click(locators.nextBtn);
  await page.waitForSelector(locators.password, { visible: true });
  await page.type(locators.password, process.env.STREAM_SDK_TEST_ACCOUNT_PASSWORD);
  await page.click(locators.goggleSignInBtn);
}

function getLocators(headless) {
  return {
    email: "input[type='email']",
    goggleSignInBtn: headless ? "input[id='submit']" : '#passwordNext',
    nextBtn: headless ? "input[id='next']" : '#identifierNext',
    password: "input[type='password']",
    streamSignInBtn: "button:text('Sign in with your Google Stream account')",
  };
}
