const JsSHA = require('jssha');
const { VideoBuddyBrowser } = require('./browser');

class VideoBuddyAuth {
  constructor(options) {
    ensureEnvVars();
    this.options = options;
  }

  async init() {
    await googleAuth(this.options);
  }
}

module.exports = { VideoBuddyAuth };

async function googleAuth(options) {
  console.log(`⏳ Going through Google OAuth`);
  const browser = new VideoBuddyBrowser(options);
  const chromium = await browser.getChromium();
  const context = await browser.getNewContext(chromium);
  const page = await context.newPage();
  const locators = getLocators();

  await page.goto(process.env.STREAM_SDK_TEST_APP);
  await browser.waitForLoadState(page);
  await page.waitForSelector(locators.streamSignInBtn, { visible: true });
  await page.click(locators.streamSignInBtn);
  await page.waitForSelector(locators.email, { visible: true });
  await page.type(locators.email, process.env.STREAM_SDK_TEST_ACCOUNT_EMAIL);
  await page.click(locators.emailNextBtn);
  await page.waitForSelector(locators.password, { visible: true });
  await page.type(locators.password, process.env.STREAM_SDK_TEST_ACCOUNT_PASSWORD);
  await page.click(locators.passwordNextBtn);
  await page.waitForSelector(locators.totp, { visible: true });

  const retryCount = 10;
  for (let i = 1; i <= retryCount; i++) {
    try {
      await page.locator(locators.totp).clear();
      await page.type(locators.totp, getTotp());
      await page.click(locators.totpNextBtn);
      await page.waitForSelector(locators.createMeetingBtn, { timeout: 10_000, visible: true });
      break;
    } catch (e) {
      if (retryCount === i) throw e;
      console.error(`❌ Google OAuth has declined OTP. Trying again...`);
    }
  }

  await context.storageState({ path: options.storageStatePath });
  await chromium.close();
  console.log(`✅ Google OAuth has passed`);
}

function ensureEnvVars() {
  const appUrl = process.env.STREAM_SDK_TEST_APP;
  const email = process.env.STREAM_SDK_TEST_ACCOUNT_EMAIL;
  const password = process.env.STREAM_SDK_TEST_ACCOUNT_PASSWORD;
  const otpSecret = process.env.STREAM_SDK_TEST_ACCOUNT_OTP_SECRET;
  const missingEnvVars = [appUrl, email, password, otpSecret].some((envVar)=> !envVar);

  if (missingEnvVars) {
    throw new Error('App url, email, password and OTP secret should be provided.');
  }
}

function getLocators() {
  return {
    createMeetingBtn: '[data-testid=create-and-join-meeting-button]',
    email: "input[type='email']",
    emailNextBtn: '#identifierNext',
    password: "input[type='password']",
    passwordNextBtn: '#passwordNext',
    streamSignInBtn: '[data-testid=sign-in-button]',
    totp: "input[type='tel']",
    totpNextBtn: '#totpNext',
  };
}

function getTotp() {
  const algorithm = 'SHA-1';
  const digits = 6;
  const period = 30;
  const timestamp = Date.now();
  const key = base32tohex(process.env.STREAM_SDK_TEST_ACCOUNT_OTP_SECRET);
  const epoch = Math.floor(timestamp / 1000.0);
  const time = leftpad(dec2hex(Math.floor(epoch / period)), 16, '0');
  const shaObj = new JsSHA(algorithm, 'HEX');
  shaObj.setHMACKey(key, 'HEX');
  shaObj.update(time);
  const hmac = shaObj.getHMAC('HEX');
  const offset = hex2dec(hmac.substring(hmac.length - 1));
  let otp = (hex2dec(hmac.substr(offset * 2, 8)) & hex2dec('7fffffff')) + '';
  otp = otp.substr(Math.max(otp.length - digits, 0), digits);
  return otp;
}

function hex2dec(s) {
  return parseInt(s, 16);
}

function dec2hex(s) {
  return (s < 15.5 ? '0' : '') + Math.round(s).toString(16);
}

function base32tohex(base32) {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  base32 = base32.replace(/=+$/, '');

  let bits = '';
  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    if (val === -1) throw new Error('Invalid base32 character in key');
    bits += leftpad(val.toString(2), 5, '0');
  }

  let hex = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    const chunk = bits.substr(i, 8);
    hex = hex + leftpad(parseInt(chunk, 2).toString(16), 2, '0');
  }
  return hex;
}

function leftpad(str, len, pad) {
  if (len + 1 >= str.length) {
    str = Array(len + 1 - str.length).join(pad) + str;
  }
  return str;
}
