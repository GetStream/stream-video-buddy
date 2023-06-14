const { VideoBuddyClient } = require('../lib/client');
const randomCallId = (Math.random() + 1).toString(36).substring(5);
const storageStatePath = 'video-buddy-session.json';

describe('stream video buddy', () => {
  it('verifies that one participant can join', async () => {
    await new VideoBuddyClient({
      callId: randomCallId,
      duration: 1,
      storageStatePath,
      userCount: 1,
    }).init();
  });

  it('verifies that multiple participants can join', async () => {
    await new VideoBuddyClient({
      callId: randomCallId,
      duration: 1,
      storageStatePath,
      userCount: 5,
    }).init();
  });

  it('verifies that multiple participants can join [headfull]', async () => {
    await new VideoBuddyClient({
      callId: randomCallId,
      duration: 1,
      showWindow: true,
      storageStatePath,
      userCount: 5,
    }).init();
  });

  it('verifies that participant can share the screen', async () => {
    await new VideoBuddyClient({
      callId: randomCallId,
      duration: 1,
      screenShare: true,
      screenSharingDuration: 1,
      storageStatePath,
      userCount: 1,
    }).init();
  });

  it('verifies that participant can record the call', async () => {
    await new VideoBuddyClient({
      callId: randomCallId,
      duration: 1,
      record: true,
      recordingDuration: 1,
      storageStatePath,
      userCount: 1,
    }).init();
  });
});
