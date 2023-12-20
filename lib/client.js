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
    console.log(`- Opening ${options.callId} as a ${i + 1} participant...`);
    page = await context.newPage();

    page.on('console', (msg) => {
      if (options.verbose) {
        fs.appendFileSync('video-buddy-console.log', msg.text() + '\n');
      }
    });

    await openLobbyPage(browser, page, options);

    if (i === 0) {
      await waitForServerSettingsToLoad(page);
    }

    if (options.mic) {
      await enableMicrophoneInPreview(page);
    } else {
      await disableMicrophoneInPreview(page);
    }

    if (options.camera) {
      await enableCameraInPreview(page);
    } else {
      await disableCameraInPreview(page);
    }

    await clickOnJoinCallButton(page);
  }
  return page;
}

async function openLobbyPage(browser, page, options) {
  if (options.useMainPage) {
    await page.goto(process.env.STREAM_SDK_TEST_APP);
    await page.type('[data-testid=join-call-input]', options.callId);
    await page.click('[data-testid=join-call-button]');
  } else {
    await page.goto(getCallUrl(options));
  }
  await waitForLobbyPage(browser, page);
  await page.context().grantPermissions(['camera', 'microphone']);
}

function getCallUrl(options) {
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
    count: 2,
    locator: '.str-video__composite-button',
  });
}

// Required only for the first user
async function waitForServerSettingsToLoad(page) {
  console.log(`- Waiting for the server settings to load...`);
  await waitForElementsCount(page, {
    count: 1,
    locator: '[data-testid=preview-video-mute-button]',
  });
}

async function openChat(page) {
  console.log('- Opening chat...');
  await page.click('.str-video__icon--chat');
}

async function sendMessage(page, message) {
  console.log(`- Sending message: ${message}...`);
  await page.type('[data-testid=message-input]', message);
  await page.click('[data-testid=send]');
}

async function clickOnJoinCallButton(page) {
  console.log('- Clicking on the join call button...');
  await page.click('[data-testid=join-call-button]');
}

async function enableCameraInPreview(page) {
  console.log('- Unmuting camera in preview...');
  await clickIfVisible(page, '[data-testid=preview-video-unmute-button]');
}

async function disableCameraInPreview(page) {
  console.log('- Muting camera in preview...');
  await clickIfVisible(page, '[data-testid=preview-video-mute-button]');
}

async function enableMicrophoneInPreview(page) {
  console.log('- Unmuting microphone in preview...');
  await clickIfVisible(page, '[data-testid=preview-audio-unmute-button]');
}

async function disableMicrophoneInPreview(page) {
  console.log('- Muting microphone in preview...');
  await clickIfVisible(page, '[data-testid=preview-audio-mute-button]');
}

async function enableCameraOnCall(page) {
  console.log('- Unmuting camera on call...');
  await clickIfVisible(page, '[data-testid=video-unmute-button]');
}

async function disableCameraOnCall(page) {
  console.log('- Muting camera on call...');
  await clickIfVisible(page, '[data-testid=video-mute-button]');
}

async function enableMicrophoneOnCall(page) {
  console.log('- Unmuting microphone on call...');
  await clickIfVisible(page, '[data-testid=audio-unmute-button]');
}

async function disableMicrophoneOnCall(page) {
  console.log('- Muting microphone on call...');
  await clickIfVisible(page, '[data-testid=audio-mute-button]');
}

async function clickIfVisible(page, locator) {
  if (await page.isVisible(locator)) {
    await page.click(locator);
  }
}

async function startSharingScreen(page) {
  console.log('- Starting sharing screen...');
  await page.click('[data-testid=screen-share-start-button]');
}

async function stopSharingScreen(page) {
  console.log('- Stopping sharing screen...');
  await page.click('[data-testid=screen-share-stop-button]');
}

async function startRecording(page) {
  console.log('- Starting recording...');
  await page.click('[data-testid=recording-start-button]');
}

async function stopRecording(page) {
  console.log('- Stopping recording...');
  await page.click('[data-testid=recording-stop-button]');
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
      (cookie) =>
        cookie.name === '__Secure-next-auth.session-token' ||
        cookie.name === 'next-auth.session-token',
    ).expires;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (expiryTimestamp - currentTimestamp > 10_000) return;
  }

  throw new Error('Stream Video Buddy is not authorized. Use `auth` command first.');
}

async function sleep(sec) {
  console.log(`- Sleeping for ${sec} seconds...`);
  return await new Promise((resolve) => setTimeout(resolve, sec * 1000));
}
