const crypto = require('crypto');

/**
 * Mints Stream user tokens locally from the app's API secret.
 *
 * A Stream user token is a plain HS256 JWT whose only required claim is
 * `user_id`, so `node:crypto` covers it and the tool needs no JWT dependency.
 * The secret never leaves this process - it is used to sign, and nothing else.
 */

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createToken(apiSecret, userId) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ user_id: userId }));
  const body = `${header}.${payload}`;

  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(body)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${body}.${signature}`;
}

/** The bot user ids for a run, stable for a given run id. */
function botUserIds(prefix, runId, count) {
  return Array.from({ length: count }, (_, i) => `${prefix}-${runId}-${i}`);
}

/**
 * The six sign-in users baked into the `chat_rooms_with_livestream` sample.
 *
 * Their ids are hardcoded in the app, so pointing it at a private Stream app
 * only means minting tokens for these same ids.
 */
const SAMPLE_USER_IDS = [
  'alice_johnson',
  'bob_smith',
  'carol_davis',
  'david_lee',
  'eva_martinez',
  'frank_wilson',
];

/**
 * The `--dart-define-from-file` payload for the Flutter sample: the API key,
 * the pinned call id, and a token per sample user.
 */
function dartDefines({ apiKey, apiSecret, callId }) {
  const defines = {
    STREAM_API_KEY: apiKey,
    STREAM_BENCH_CALL_ID: callId,
  };

  SAMPLE_USER_IDS.forEach((userId, i) => {
    defines[`STREAM_TOKEN_0${i}`] = createToken(apiSecret, userId);
  });

  return defines;
}

module.exports = { botUserIds, createToken, dartDefines, SAMPLE_USER_IDS };
