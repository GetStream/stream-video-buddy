const { VideoBuddyClient } = require('../lib/client');
const randomCallId = (Math.random() + 1).toString(36).substring(5);

describe('stream video buddy', () => {
  it('verifies that one participant can join', async () => {
    await new VideoBuddyClient({
      callId: randomCallId,
      duration: 1,
    }).init();
  });

  it('verifies that multiple participants can join', async () => {
    await new VideoBuddyClient({
      callId: randomCallId,
      duration: 1,
      usersCount: 5,
    }).init();
  });

  it('verifies that multiple participants can join [headfull]', async () => {
    await new VideoBuddyClient({
      callId: randomCallId,
      duration: 1,
      showWindow: true,
      usersCount: 5,
    }).init();
  });

  it('verifies static mode', async () => {
    await new VideoBuddyClient({
      callId: randomCallId,
      duration: 1,
      frozen: true,
      silent: true,
    }).init();
  });

  it('verifies that participant can share the screen', async () => {
    await new VideoBuddyClient({
      callId: randomCallId,
      duration: 1,
      screenShare: true,
      screenSharingDuration: 1,
    }).init();
  });

  it('verifies that participant can record the call', async () => {
    await new VideoBuddyClient({
      callId: randomCallId,
      duration: 1,
      record: true,
      recordingDuration: 1,
    }).init();
  });
});
