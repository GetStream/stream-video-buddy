const { VideoBuddyBrowser } = require('./browser');
const fs = require('fs');

class VideoBuddyClient {
  constructor(options) {
    ensureStorageState(options);
    this.options = options;
  }

  async init() {
    await joinCall(this.options);
  }
}

module.exports = { VideoBuddyClient };

async function joinCall(options) {
  const browser = new VideoBuddyBrowser(options);
  const chromium = await browser.getChromium();

  const page = await connectUsers(options, browser);
  await uniqueActions(options, page);

  if (options.duration == null) return;

  await sleep(options.duration);
  await chromium.close();
}

async function uniqueActions(options, page) {
  if (options.record) {
    await startRecording(page);
    if (options.recordingDuration) {
      await sleep(options.recordingDuration);
      await stopRecording(page);
    }
  }

  if (options.screenShare) {
    await startSharingScreen(page);
    if (options.screenSharingDuration) {
      await sleep(options.screenSharingDuration);
      await stopSharingScreen(page);
    }
  }

  if (options.message) {
    await openChat(page);
    for (let i = 0; i < options.messageCount; i++) {
      await sendMessage(page, options.message);
    }
  }
}

async function connectUsers(options, browser) {
  const context = await browser.getNewContext(options.storageStatePath);
  let page = {};
  for (let i = 0; i < options.userCount; i++) {
    page = await context.newPage();
    const url = getPageUrl(options);
    await page.goto(url);

    await waitForLobbyPage(browser, page);

    if (i === 0) {
      await waitForServerSettingsToLoad(page);
    }

    if (options.mic) {
      await enableMicrophone(page);
    } else {
      await disableMicrophone(page);
    }

    if (options.camera) {
      await enableCamera(page);
    } else {
      await disableCamera(page);
    }

    clickOnJoinCallButton(page);

    console.log(`${i} users joined the call ${options.callId}`);
    page.on('console', (msg) => {
      if (msg.text().includes('Track stats')) {
        console.log(msg.text());
      }
    });
  }
  return page;
}

function getPageUrl(options) {
  const randomId = `buddy_${Math.floor(Math.random() * 10_000)}`;

  const sfu = options.sfu === undefined ? '' : `sfu_id=${options.sfu}`;

  let cascading;
  if (options.cascading === '0') {
    cascading = 'cascading=false';
  } else if (options.cascading === '1') {
    cascading = 'cascading=true';
  } else {
    cascading = '';
  }

  const query_params = ['debug=true', 'no-trace=true', `user_id=${randomId}`, cascading, sfu];

  const endpoint = `join/${options.callId}?${query_params.filter((p) => p).join('&')}`;

  return `${process.env.STREAM_SDK_TEST_APP}/${endpoint}`;
}

async function waitForLobbyPage(browser, page) {
  await browser.waitForLoadState(page);
  await waitForElementsCount(page, {
    count: 3,
    locator: '.str-video__composite-button',
  });
}

// Required only for the first user
async function waitForServerSettingsToLoad(page) {
  await waitForElementsCount(page, {
    count: 1,
    locator: '.str-video__icon--camera',
  });
}

async function openChat(page) {
  await page.click('.str-video__icon--chat');
}

async function sendMessage(page, message) {
  await page.type('[data-testid=message-input]', message);
  await page.click('[data-testid=send]');
}

async function clickOnJoinCallButton(page) {
  await page.click('[data-testid=join-call-button]');
}

async function enableCamera(page) {
  await clickIfVisible(page, '.str-video--icon-camera-off');
}

async function disableCamera(page) {
  await clickIfVisible(page, '.str-video__icon--camera');
}

async function enableMicrophone(page) {
  await clickIfVisible(page, '.str-video--icon-mic-off');
}

async function disableMicrophone(page) {
  await clickIfVisible(page, '.str-video__icon--mic');
}

async function clickIfVisible(page, locator) {
  if (await page.isVisible(locator)) {
    await page.click(locator);
  }
}

async function startSharingScreen(page) {
  await page.click('.str-video__icon--screen-share-off');
}

async function stopSharingScreen(page) {
  await page.click('.str-video__icon--screen-share-on');
}

async function startRecording(page) {
  await page.click('.str-video__icon--recording-off');
}

async function stopRecording(page) {
  await page.click('.str-video__icon--recording-on');
}

async function waitForElementsCount(page, args) {
  const timeout = args.timeout || 10;
  const count = args.count || 1;
  let actualCount = 0;
  const futureTimestamp = Math.floor(Date.now() / 1000) + timeout;
  while (actualCount < count && Math.floor(Date.now() / 1000) < futureTimestamp) {
    if (args.locator) {
      actualCount = await page.locator(args.locator).count();
    }
  }
}

function ensureStorageState(options) {
  if (fs.existsSync(options.storageStatePath)) {
    const storageState = fs.readFileSync(options.storageStatePath, { encoding: 'utf-8' });
    const expiryTimestamp = JSON.parse(storageState).cookies.find(
      (cookie) => cookie.name === '__Secure-next-auth.session-token',
    ).expires;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (expiryTimestamp - currentTimestamp > 10_000) return;
  }

  throw new Error('Stream Video Buddy is not authorized. Use `auth` command first.');
}

async function sleep(sec) {
  return await new Promise((resolve) => setTimeout(resolve, sec * 1000));
}
