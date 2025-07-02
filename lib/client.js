const { VideoBuddyBrowser } = require('./browser');
const fs = require('fs');

class VideoBuddyClient {
  constructor(command, options) {
    this.command = command;
    this.options = options;
  }

  async init() {
    if (this.options.testName) {
      console.log(this.options.testName);
    }

    const page = await (this.command === 'join' ? joinCall(this.options) : ringUser(this.options));

    if (this.options.recordSession && this.options.testName) {
      const currentPath = await page.video().path();
      const newPath = `./recordings/${this.options.testName}-${Date.now()}.webm`;
      fs.renameSync(currentPath, newPath);
    }
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
  return page;
}

async function ringUser(options) {
  const browser = new VideoBuddyBrowser(options);
  const chromium = await browser.getChromium();
  const context = await browser.getNewContext();

  console.log(`- Ringing ${options.userId}...`);
  const page = await context.newPage();
  await openRingPage(browser, page, options);

  const startTime = Date.now();
  process.stdout.write('  - Filling user details');
  await page.type('[data-testid=callee-user-id-0-input]', options.userId);
  await page.click('[data-testid=ring-button]');
  console.log(` (${Date.now() - startTime}ms)`);

  if (options.duration == null) return;

  await sleep(options.duration);

  if (await page.isVisible('[data-testid=cancel-call-button]')) {
    process.stdout.write('  - Cancelling call');
    await page.click('[data-testid=cancel-call-button]');
    console.log(` (${Date.now() - startTime}ms)`);
    await sleep(1, false); // wait for the call to be cancelled
  }

  await chromium.close();
  return page;
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
  const context = await browser.getNewContext();
  let page = {};
  for (let i = 0; i < options.userCount; i++) {
    console.log(`- Joining ${options.callId} with ${i + 1} participant...`);
    page = await context.newPage();

    await openLobbyPage(browser, page, options);
    await grantPermissions(page);

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
    await waitForCallScreen(page);

    // hard-toggles to ensure there is no collision on server sync
    if (options.mic) {
      await enableMicrophoneOnCall(page);
    } else {
      await disableMicrophoneOnCall(page);
    }

    // hard-toggles to ensure there is no collision on server sync
    if (options.camera) {
      await enableCameraOnCall(page);
    } else {
      await disableCameraOnCall(page);
    }
  }

  return page;
}

async function openLobbyPage(browser, page, options) {
  process.stdout.write('  - Opening lobby page');
  const startTime = Date.now();
  await openApp('join', options, page, browser);
  await waitForLobbyPage(browser, page);
  console.log(` (${Date.now() - startTime}ms)`);
}

async function openRingPage(browser, page, options) {
  process.stdout.write('  - Opening ring page');
  const startTime = Date.now();
  await openApp('ring', options, page, browser);
  console.log(` (${Date.now() - startTime}ms)`);
}

async function grantPermissions(page) {
  process.stdout.write('  - Granting camera and microphone permissions');
  const startTime = Date.now();
  await page.context().grantPermissions(['camera', 'microphone']);
  console.log(` (${Date.now() - startTime}ms)`);
}

async function openApp(command, options, page, browser) {
  page.on('console', (msg) => {
    if (options.verbose) {
      fs.appendFileSync('video-buddy-console.log', msg.text() + '\n');
    }
  });

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

  const query_params = ['debug=true', 'no-trace=true', `user_id=${randomId}`, cascading, sfu]
    .filter((p) => p)
    .join('&');

  const callType = options.audioCall ? 'type=audio_call&' : '';
  const endpoint = command === 'join' ? `join/${options.callId}` : 'ring';
  const url = `${process.env.STREAM_SDK_TEST_APP}/${endpoint}?${callType}${query_params}`;
  console.log(url);

  await page.goto(url);
  const continueButton = '[data-testid=guest-sign-in-button]';
  if ((await page.locator(continueButton).count()) > 0) {
    await browser.waitForLoadState(page);
    await page.click(continueButton);
    await page.waitForNavigation();
  }
}

async function waitForLobbyPage(browser, page) {
  await browser.waitForLoadState(page);
  await waitForElementsCount(page, {
    count: 2,
    locator: '.str-video__composite-button',
  });
}

async function openChat(page) {
  process.stdout.write('- Opening chat...');
  const startTime = Date.now();
  await page.click('.str-video__icon--chat');
  console.log(` (${Date.now() - startTime}ms)`);
}

async function sendMessage(page, message) {
  process.stdout.write(`  - Sending message: ${message}`);
  const startTime = Date.now();
  await page.type('[data-testid=message-input]', message);
  await page.click('[data-testid=send]');
  console.log(` (${Date.now() - startTime}ms)`);
}

async function clickOnJoinCallButton(page) {
  process.stdout.write('  - Clicking on the join call button');
  const startTime = Date.now();
  await page.click('[data-testid=join-call-button]');
  console.log(` (${Date.now() - startTime}ms)`);
}

async function enableCameraInPreview(page) {
  process.stdout.write('  - Unmuting camera in preview');
  await clickIfVisible(page, '[data-testid=preview-video-unmute-button]');
}

async function disableCameraInPreview(page) {
  process.stdout.write('  - Muting camera in preview');
  await clickIfVisible(page, '[data-testid=preview-video-mute-button]');
}

async function enableMicrophoneInPreview(page) {
  process.stdout.write('  - Unmuting microphone in preview');
  await clickIfVisible(page, '[data-testid=preview-audio-unmute-button]');
}

async function disableMicrophoneInPreview(page) {
  process.stdout.write('  - Muting microphone in preview');
  await clickIfVisible(page, '[data-testid=preview-audio-mute-button]');
}

async function enableCameraOnCall(page) {
  process.stdout.write('- Unmuting camera on call');
  await clickIfVisible(page, '[data-testid=video-unmute-button]');
}

async function disableCameraOnCall(page) {
  process.stdout.write('- Muting camera on call');
  await clickIfVisible(page, '[data-testid=video-mute-button]');
}

async function enableMicrophoneOnCall(page) {
  process.stdout.write('- Unmuting microphone on call');
  await clickIfVisible(page, '[data-testid=audio-unmute-button]');
}

async function disableMicrophoneOnCall(page) {
  process.stdout.write('- Muting microphone on call');
  await clickIfVisible(page, '[data-testid=audio-mute-button]');
}

async function clickIfVisible(page, locator) {
  const startTime = Date.now();
  if (await page.isVisible(locator)) {
    try {
      await page.click(locator, { timeout: 3000 });
    } catch (e) {
      process.stdout.write('- Unsuccessful action. Continuing...');
    }
  }
  console.log(` (${Date.now() - startTime}ms)`);
}

async function startSharingScreen(page) {
  process.stdout.write('- Starting sharing screen');
  const startTime = Date.now();
  await page.click('[data-testid=screen-share-start-button]');
  console.log(` (${Date.now() - startTime}ms)`);
}

async function stopSharingScreen(page) {
  process.stdout.write('- Stopping sharing screen');
  const startTime = Date.now();
  await page.click('[data-testid=screen-share-stop-button]');
  console.log(` (${Date.now() - startTime}ms)`);
}

async function startRecording(page) {
  process.stdout.write('- Starting recording');
  const startTime = Date.now();
  await page.click('[data-testid=recording-start-button]');
  console.log(` (${Date.now() - startTime}ms)`);
}

async function stopRecording(page) {
  process.stdout.write('- Stopping recording');
  const startTime = Date.now();
  await page.click('[data-testid=recording-stop-button]');
  await page.click('button:text("End recording")');
  console.log(` (${Date.now() - startTime}ms)`);
}

async function waitForCallScreen(page) {
  process.stdout.write('  - Waiting for Call Screen');
  const startTime = Date.now();
  await waitForElementsCount(page, {
    count: 1,
    locator: '[data-testid=screen-share-start-button]',
    timeout: 30,
  });
  console.log(` (${Date.now() - startTime}ms)`);
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

async function sleep(sec, log = true) {
  if (log) {
    console.log(`- Sleeping for ${sec} seconds...`);
  }
  return await new Promise((resolve) => setTimeout(resolve, sec * 1000));
}

async function screenshot(page, title) {
  await page.screenshot({ path: `recordings/${title}_${Math.floor(Math.random() * 10_000)}.png` });
}
