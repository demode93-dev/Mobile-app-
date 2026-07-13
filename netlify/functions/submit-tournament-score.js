// Accepts a completed Daily Dungeon Dive run and stores its score.
// Performs lightweight structural/anti-cheat validation against the day's
// seed. Full deterministic replay validation (re-simulating BoardManager /
// CombatManager server-side against moveHistory) is the natural next step -
// this endpoint is structured to slot that in without changing its contract.
const faunadb = require('faunadb');

const q = faunadb.query;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function seedFromDate(dateKey) {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function isValidPayload(body) {
  if (!body || typeof body !== 'object') return false;
  if (typeof body.playerName !== 'string' || body.playerName.trim().length === 0 || body.playerName.length > 24) return false;
  if (typeof body.seed !== 'number') return false;
  if (typeof body.depthReached !== 'number' || body.depthReached < 0 || body.depthReached > 200) return false;
  if (typeof body.score !== 'number' || body.score < 0) return false;
  if (!Array.isArray(body.moveHistory)) return false;
  // Anti-cheat heuristic: a legitimate run needs at least a few moves per depth cleared.
  if (body.moveHistory.length < body.depthReached) return false;
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

  const dateKey = todayKey();
  if (body.seed !== seedFromDate(dateKey)) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Score does not match today\'s dungeon seed' }) };
  }

  if (!process.env.FAUNA_SECRET) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, offline: true, message: 'Score accepted but not persisted (FAUNA_SECRET not configured).' }) };
  }

  const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

  try {
    await client.query(
      q.Create(q.Collection('scores'), {
        data: {
          date: dateKey,
          playerName: body.playerName.trim(),
          depthReached: body.depthReached,
          score: body.score,
          submittedAt: q.Now()
        }
      })
    );
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
