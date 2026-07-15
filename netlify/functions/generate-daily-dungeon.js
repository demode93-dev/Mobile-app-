// Scheduled function (configure in Netlify UI/netlify.toml as a cron trigger,
// e.g. "@daily") that seeds today's Daily Dungeon Dive tournament run.
// Falls back to a graceful no-op JSON response when FaunaDB isn't configured
// so the rest of the game keeps working without a backend.
const faunadb = require('faunadb');

const q = faunadb.query;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Deterministic-ish seed derived from the date so every player gets the same
// board/spawn layout for the daily run.
function seedFromDate(dateKey) {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

exports.handler = async () => {
  const dateKey = todayKey();
  const seed = seedFromDate(dateKey);

  if (!process.env.FAUNA_SECRET) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, offline: true, date: dateKey, seed, message: 'FAUNA_SECRET not configured - dungeon computed but not persisted.' })
    };
  }

  const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

  try {
    await client.query(
      q.If(
        q.Exists(q.Match(q.Index('daily_dungeon_by_date'), dateKey)),
        q.Get(q.Match(q.Index('daily_dungeon_by_date'), dateKey)),
        q.Create(q.Collection('daily_dungeons'), {
          data: { date: dateKey, seed, createdAt: q.Now() }
        })
      )
    );
    return { statusCode: 200, body: JSON.stringify({ ok: true, date: dateKey, seed }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
