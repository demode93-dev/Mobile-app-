// Converts a player's in-game gem balance to a real payout via a Stripe
// transfer to their connected account. 100 gems = $1.00 (adjust CENTS_PER_GEM
// to change the exchange rate).
const Stripe = require('stripe');

const CENTS_PER_GEM = 1; // 100 gems -> 100 cents -> $1.00
const MIN_GEMS = 500; // minimum cash-out threshold

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, offline: true, message: 'Cash-out unavailable: STRIPE_SECRET_KEY not configured.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const gemAmount = Number(body.gemAmount);
  if (!Number.isFinite(gemAmount) || gemAmount < MIN_GEMS) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: `Minimum cash-out is ${MIN_GEMS} gems.` }) };
  }
  if (!body.stripeAccountId || typeof body.stripeAccountId !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing connected Stripe account id.' }) };
  }

  const amountCents = Math.floor(gemAmount * CENTS_PER_GEM);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: 'usd',
      destination: body.stripeAccountId,
      description: 'Dungeon Sweeper gem cash-out'
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true, transferId: transfer.id, amountCents }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
