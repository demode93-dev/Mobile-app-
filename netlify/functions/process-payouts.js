// Scheduled function (run once daily, shortly after the Daily Dungeon Dive
// resets) that reads yesterday's leaderboard and distributes prizes to the
// top 10% of entrants via Stripe transfers to their connected accounts.
const faunadb = require('faunadb');
const Stripe = require('stripe');

const q = faunadb.query;

function yesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function prizeCentsForRank(index) {
  if (index === 0) return 5000; // $50
  if (index < 3) return 2000; // $20
  if (index < 10) return 500; // $5
  return 100; // $1
}

exports.handler = async () => {
  if (!process.env.FAUNA_SECRET) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, offline: true, message: 'FAUNA_SECRET not configured - no payouts processed.' }) };
  }

  const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });
  const dateKey = yesterdayKey();

  let entries;
  try {
    const result = await client.query(
      q.Map(
        q.Paginate(q.Match(q.Index('scores_by_date_sorted'), dateKey), { size: 100 }),
        q.Lambda('ref', q.Get(q.Var('ref')))
      )
    );
    entries = result.data.map(doc => doc.data).sort((a, b) => b.score - a.score);
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, message: 'No scores found for payout window.', error: err.message }) };
  }

  const prizeCount = Math.max(1, Math.ceil(entries.length * 0.1));
  const winners = entries.slice(0, prizeCount);

  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, offline: true, message: 'STRIPE_SECRET_KEY not configured - winners computed but not paid.', winners: winners.length }) };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const results = [];

  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i];
    const amount = prizeCentsForRank(i);
    if (!winner.stripeAccountId) {
      results.push({ playerName: winner.playerName, status: 'skipped', reason: 'no connected Stripe account' });
      continue;
    }
    try {
      const transfer = await stripe.transfers.create({
        amount,
        currency: 'usd',
        destination: winner.stripeAccountId,
        description: `Dungeon Sweeper Daily Dive payout - ${dateKey}`
      });
      results.push({ playerName: winner.playerName, status: 'paid', transferId: transfer.id, amount });
    } catch (err) {
      results.push({ playerName: winner.playerName, status: 'failed', error: err.message });
    }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, date: dateKey, results }) };
};
