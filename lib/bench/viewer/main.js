import { StreamVideoClient } from '@stream-io/video-client';

/**
 * One benchmark bot: a receive-only viewer of a livestream call.
 *
 * This deliberately does not reuse the hosted demo app the `join` command
 * drives. That app's lobby flow and its host-only controls do not exist for a
 * livestream viewer, so a viewer bot would simply hang there.
 *
 * The bot never publishes. `call.join()` sends no media unless the camera or
 * microphone is explicitly enabled, and on the `livestream` call type only the
 * `host` role may publish anyway - receive-only by default and by permission.
 *
 * There is deliberately no <video> element. The SFU forwards a track because
 * something is *subscribed* to it, not because a sink is attached, so binding
 * one would make this machine decode 50 streams to no benefit - and the thing
 * being measured is the phone, not this machine. `setPreferredIncomingVideoResolution`
 * is what controls which simulcast layer the server sends.
 */

const state = {
  error: null,
  joinMs: null,
  participantCount: 0,
  status: 'idle',
  // Every calling-state change, so the runner can tell "joined and stayed" from
  // "joined, dropped, and quietly came back".
  transitions: [],
};

// Playwright polls this out of the page; keep it plain and serialisable.
window.streamBench = state;

async function start(config) {
  const { apiKey, callId, callType, incomingHeight, incomingWidth, token, userId, video } = config;

  try {
    state.status = 'connecting';
    const startedAt = performance.now();

    const client = new StreamVideoClient({
      apiKey,
      token,
      user: { id: userId, name: userId, type: 'authenticated' },
    });
    const call = client.call(callType, callId);

    // `create: false` on purpose. The host creates the call; a bot allowed to
    // create it would mask a wrong call id by silently making a new, empty
    // call and then reporting a perfectly healthy join.
    await call.join({ create: false, maxJoinRetries: 1 });

    // Set *after* join: joining rebuilds the subscription set, so a preference
    // expressed beforehand does not survive the handshake.
    if (video) {
      call.setPreferredIncomingVideoResolution({
        height: incomingHeight,
        width: incomingWidth,
      });
    } else {
      call.setIncomingVideoEnabled(false);
    }

    state.joinMs = Math.round(performance.now() - startedAt);
    state.status = 'live';

    call.state.callingState$.subscribe((callingState) => {
      state.transitions.push({ atMs: Date.now(), state: callingState });
    });

    call.state.participantCount$.subscribe((count) => {
      state.participantCount = count;
    });

    window.streamBenchCall = call;
    window.streamBenchClient = client;
  } catch (error) {
    state.status = 'failed';
    state.error = error && error.message ? error.message : String(error);
    throw error;
  }
}

async function stop() {
  try {
    if (window.streamBenchCall) await window.streamBenchCall.leave();
    if (window.streamBenchClient) await window.streamBenchClient.disconnectUser(2000);
  } catch (error) {
    // Teardown is best effort - a bot that cannot say goodbye still gets
    // cleaned up when its page closes, and the run's results matter more.
  }
}

window.streamBenchStart = start;
window.streamBenchStop = stop;
