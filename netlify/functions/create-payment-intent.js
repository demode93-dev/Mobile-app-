// Creates a Stripe PaymentIntent for the $0.99 Daily Dungeon Dive tournament
// entry fee (or any custom amount the client requests, clamped to a sane range).
const Stripe = require('stripe');

const DEFAULT_ENTRY_CENTS = 99;
const MIN_CENTS = 50;
const MAX_CENTS = 10000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, offline: true, message: 'Payments unavailable: STRIPE_SECRET_KEY not configured.' }) };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    // fall through to default amount
  }

  const amountCents = Math.min(MAX_CENTS, Math.max(MIN_CENTS, Number(body.amountCents) || DEFAULT_ENTRY_CENTS));
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: 'Dungeon Sweeper - Daily Dungeon Dive entry'
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true, clientSecret: intent.client_secret }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
