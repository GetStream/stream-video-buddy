class OAuth {
  constructor(options, page) {
    this.options = options;
    this.page = page;
  }

  async init() {
    await googleAuth(this.options, this.page);
  }
}

module.exports = { OAuth };

async function googleAuth(options, page) {
  const locators = getLocators(options.showWindow);
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

function getLocators(showWindow) {
  return {
    email: "input[type='email']",
    goggleSignInBtn: showWindow ? '#passwordNext' : "input[id='submit']",
    nextBtn: showWindow ? '#identifierNext' : "input[id='next']",
    password: "input[type='password']",
    streamSignInBtn: "button:text('Sign in with your Google Stream account')",
  };
}
