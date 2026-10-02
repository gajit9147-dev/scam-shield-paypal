import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewPaymentRequest, verifyToken, toCheckout, regexExtract } from './paymentReview.js';

delete process.env.GEMINI_API_KEY;

test('reads rupee amount and payee', () => {
  const r = regexExtract('Please pay Rs 1,500 to shop@okaxis for order 22');
  assert.equal(r.amount, 1500);
  assert.equal(r.currency, 'INR');
  assert.equal(r.payee, 'shop@okaxis');
});

test('INR stays in rupees and dollars are converted to rupees', () => {
  const a = toCheckout({ amount: 850, currency: 'INR' });
  assert.equal(a.currency, 'INR');
  assert.equal(a.amount, '850.00');
  const b = toCheckout({ amount: 10, currency: 'USD' });
  assert.equal(b.currency, 'INR');
  assert.equal(b.amount, '850.00');
});

test('missing amount or currency cannot be paid', () => {
  assert.equal(toCheckout({ amount: null, currency: 'USD' }).ok, false);
  assert.equal(toCheckout({ amount: 10, currency: null }).ok, false);
});

test('demo cap stops large sandbox charges', () => {
  assert.equal(toCheckout({ amount: 5000, currency: 'USD' }).ok, false);
});

test('scam verdict never gets a payment token', async () => {
  const r = await reviewPaymentRequest('Pay $20 to refund@fake.com to claim cashback', { riskLevel: 'HIGH_RISK' });
  assert.equal(r.canPay, false);
  assert.equal(r.token, null);
  assert.equal(r.blocked, true);
});

test('suspicious verdict is blocked too', async () => {
  const r = await reviewPaymentRequest('Pay $20 now', { riskLevel: 'SUSPICIOUS' });
  assert.equal(r.canPay, false);
});

test('uncertain verdict with a clear amount gets a signed token', async () => {
  const r = await reviewPaymentRequest('Invoice 88 from Blue Cafe: $12.50', { riskLevel: 'UNCERTAIN' });
  assert.equal(r.canPay, true);
  const claim = verifyToken(r.token);
  assert.equal(claim.amount, '1062.50');
  assert.equal(claim.currency, 'INR');
});

test('tampered or garbage tokens are rejected', async () => {
  const r = await reviewPaymentRequest('Invoice: $12.50', { riskLevel: 'UNCERTAIN' });
  const [body, mac] = r.token.split('.');
  const forged = Buffer.from(JSON.stringify({ amount: '1.00', currency: 'USD', exp: Date.now() + 99999 })).toString('base64url');
  assert.equal(verifyToken(`${forged}.${mac}`), null);
  assert.equal(verifyToken('abc'), null);
  assert.equal(verifyToken(undefined), null);
  assert.ok(body);
});

test('PayPal order uses mocked sandbox API with the reviewed amount', async () => {
  process.env.PAYPAL_CLIENT_ID = 'id';
  process.env.PAYPAL_CLIENT_SECRET = 'secret';
  const { createOrder, captureOrder } = await import('./paypal.js');
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: opts?.body });
    if (String(url).includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: 't', expires_in: 300 }), { status: 200 });
    if (String(url).endsWith('/capture')) return new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 201 });
    return new Response(JSON.stringify({ id: 'ORDER123456' }), { status: 201 });
  };
  try {
    const o = await createOrder({ amount: '1062.50', currency: 'USD', description: 'x', requestId: 'r1' });
    assert.equal(o.id, 'ORDER123456');
    const sent = JSON.parse(calls.find(c => c.url.endsWith('/v2/checkout/orders')).body);
    assert.equal(sent.purchase_units[0].amount.value, '1062.50');
    assert.ok(calls[0].url.startsWith('https://api-m.sandbox.paypal.com'));
    const c = await captureOrder('ORDER123456');
    assert.equal(c.status, 'COMPLETED');
  } finally {
    globalThis.fetch = realFetch;
  }
});
