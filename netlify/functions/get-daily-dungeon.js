// Returns today's Daily Dungeon Dive seed. Reads from FaunaDB if configured,
// otherwise derives the same deterministic seed on the fly so the client's
// localStorage fallback (see src/utils/api.js) rarely has to kick in.
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

exports.handler = async () => {
  const dateKey = todayKey();

  if (!process.env.FAUNA_SECRET) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, offline: true, date: dateKey, seed: seedFromDate(dateKey) })
    };
  }

  const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

  try {
    const result = await client.query(q.Get(q.Match(q.Index('daily_dungeon_by_date'), dateKey)));
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result.data }) };
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, offline: true, date: dateKey, seed: seedFromDate(dateKey), note: 'No stored dungeon yet; using derived seed.' })
    };
  }
};
