// Accepts a completed push-your-luck run's banked Gold score.
const faunadb = require('faunadb');

const q = faunadb.query;

function isValidPayload(body) {
  if (!body || typeof body !== 'object') return false;
  if (typeof body.playerName !== 'string' || body.playerName.trim().length === 0 || body.playerName.length > 24) return false;
  if (typeof body.gold !== 'number' || body.gold < 0) return false;
  return true;
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

  if (!isValidPayload(body)) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid score payload' }) };
  }

  if (!process.env.FAUNA_SECRET) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, offline: true, message: 'Score accepted but not persisted (FAUNA_SECRET not configured).' }) };
  }

  const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

  try {
    await client.query(
      q.Create(q.Collection('gold_run_scores'), {
        data: {
          playerName: body.playerName.trim(),
          score: body.gold,
          submittedAt: q.Now()
        }
      })
    );
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
