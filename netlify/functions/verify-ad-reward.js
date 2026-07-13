// Server-side verification for rewarded-ad completions (used by the
// GameOverScene "Second Wind" revive). Expects an HMAC-signed token issued
// by the ad SDK's completion callback: `${playerId}.${timestamp}.${hmac}`.
// If AD_REWARD_SECRET isn't configured, trusts the client (dev/offline mode)
// so the feature keeps working during local testing.
//
// If you're using a network with native Server-Side Verification (e.g. AdMob
// SSV), swap this HMAC check for validating that network's signed callback
// query params against their published public key instead.
const crypto = require('crypto');

const MAX_TOKEN_AGE_MS = 5 * 60 * 1000;

function verifyHmacToken(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [playerId, timestamp, signature] = parts;

  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > MAX_TOKEN_AGE_MS) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${playerId}.${timestamp}`).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  if (!body.adToken) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing adToken' }) };
  }

  if (!process.env.AD_REWARD_SECRET) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, offline: true, message: 'AD_REWARD_SECRET not configured - trusting client in dev mode.' }) };
  }

  const valid = verifyHmacToken(body.adToken, process.env.AD_REWARD_SECRET);
  if (!valid) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Ad reward token invalid or expired.' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
