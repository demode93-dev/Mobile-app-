// Returns today's top 100 Daily Dungeon Dive scores, ranked, with the top
// 10% flagged as reward-eligible. Rewards are virtual currency only (Insight
// + Gems) - no cash value, no payout processing.
const faunadb = require('faunadb');

const q = faunadb.query;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function assignPrizes(entries) {
  const prizeCount = Math.max(1, Math.ceil(entries.length * 0.1));
  return entries.map((entry, i) => ({
    ...entry,
    reward: i < prizeCount ? rewardForRank(i) : null
  }));
}

function rewardForRank(index) {
  if (index === 0) return { insight: 100, gems: 50 };
  if (index < 3) return { insight: 50, gems: 25 };
  if (index < 10) return { insight: 25, gems: 10 };
  return { insight: 10, gems: 5 };
}

exports.handler = async () => {
  if (!process.env.FAUNA_SECRET) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, offline: true, entries: [] }) };
  }

  const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });
  const dateKey = todayKey();

  try {
    const result = await client.query(
      q.Map(
        q.Paginate(q.Match(q.Index('scores_by_date_sorted'), dateKey), { size: 100 }),
        q.Lambda('ref', q.Get(q.Var('ref')))
      )
    );

    const entries = result.data
      .map(doc => doc.data)
      .sort((a, b) => b.score - a.score)
      .map((entry, i) => ({ rank: i + 1, name: entry.playerName, depth: entry.depthReached, score: entry.score }));

    return { statusCode: 200, body: JSON.stringify({ ok: true, entries: assignPrizes(entries) }) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, offline: true, entries: [], note: err.message }) };
  }
};
