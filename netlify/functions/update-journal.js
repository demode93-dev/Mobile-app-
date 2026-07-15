// Persists a player's Expedition Journal (Insight balance + unlocked skill
// tree nodes) to FaunaDB, keyed by playerId. The client already writes to
// localStorage synchronously (see src/utils/api.js) so this is a best-effort
// sync layer, not a hard dependency for offline play.
const faunadb = require('faunadb');

const q = faunadb.query;

function isValidBody(body) {
  if (!body || typeof body !== 'object') return false;
  if (typeof body.insight !== 'number' || body.insight < 0) return false;
  if (!Array.isArray(body.unlocked)) return false;
  return body.unlocked.every(id => typeof id === 'string');
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

  if (!isValidBody(body)) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid journal payload' }) };
  }

  if (!process.env.FAUNA_SECRET) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, offline: true, message: 'FAUNA_SECRET not configured - journal kept client-side only.' }) };
  }

  const playerId = event.headers['x-player-id'] || body.playerId || 'anonymous';
  const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

  try {
    await client.query(
      q.If(
        q.Exists(q.Match(q.Index('journal_by_player'), playerId)),
        q.Update(q.Select('ref', q.Get(q.Match(q.Index('journal_by_player'), playerId))), {
          data: { insight: body.insight, unlocked: body.unlocked, updatedAt: q.Now() }
        }),
        q.Create(q.Collection('journals'), {
          data: { playerId, insight: body.insight, unlocked: body.unlocked, updatedAt: q.Now() }
        })
      )
    );
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
