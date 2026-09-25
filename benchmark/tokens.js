const { StreamClient } = require('@stream-io/node-sdk');

// Two ways to get a token per participant. Minting needs the API secret, which
// stays in the environment and is never logged.
function createTokenSource(options) {
  if (options.tokenUrl) {
    return async (userId) => {
      const url = new URL(options.tokenUrl);
      url.searchParams.set('user_id', userId);
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`Token endpoint returned ${response.status} for "${userId}"`);
      }
      const body = await response.json();
      const token = body.token || body.jwt;
      if (!token) throw new Error(`Token endpoint response for "${userId}" had no "token" field`);
      return token;
    };
  }

  const secret = options.apiSecret || process.env.STREAM_API_SECRET;
  if (!secret) {
    throw new Error(
      'No token source. Pass --token-url, or set STREAM_API_SECRET (or --api-secret) to mint tokens.',
    );
  }

  const client = new StreamClient(options.apiKey, secret);
  return (userId) => Promise.resolve(client.generateUserToken({ user_id: userId }));
}

module.exports = { createTokenSource };
