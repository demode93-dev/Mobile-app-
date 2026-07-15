// Returns the all-time top 100 banked-Gold runs, ranked. No daily reset, no
// seed validation (each run is a fresh Math.random-generated grid, not a
// shared seeded dungeon), no reward tiers - just a straight high-score board.
const faunadb = require('faunadb');

const q = faunadb.query;

exports.handler = async () => {
  if (!process.env.FAUNA_SECRET) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, offline: true, entries: [] }) };
  }

  const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

  try {
    const result = await client.query(
      q.Map(
        q.Paginate(q.Match(q.Index('gold_run_scores_by_score_sorted')), { size: 100 }),
        q.Lambda('ref', q.Get(q.Var('ref')))
      )
    );

    const entries = result.data
      .map(doc => doc.data)
      .sort((a, b) => b.score - a.score)
      .map((entry, i) => ({ rank: i + 1, name: entry.playerName, score: entry.score }));

    return { statusCode: 200, body: JSON.stringify({ ok: true, entries }) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, offline: true, entries: [], note: err.message }) };
  }
};
