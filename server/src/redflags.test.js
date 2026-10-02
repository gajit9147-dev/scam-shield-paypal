import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentRedFlags, regexExtract, reviewPaymentRequest, toCheckout } from './paymentReview.js';

test('look-alike sender is flagged, official one is not', () => {
  assert.ok(paymentRedFlags('Send $200 to security-payments@paypa1-help.com').some((f) => f.type === 'lookalike_sender'));
  assert.ok(paymentRedFlags('Pay $15.99 to billing@netfIix-payments.com').some((f) => f.type === 'lookalike_sender'));
  assert.equal(paymentRedFlags('Questions? Write to billing@paypal.com').length, 0);
});

test('outside-platform, gift card and remote access patterns are flagged', () => {
  assert.ok(paymentRedFlags('Pay me $150 directly to my personal account and do not tell support.').length > 0);
  assert.ok(paymentRedFlags('Buy 5 gift cards of $100 and send them now').length > 0);
  assert.ok(paymentRedFlags('Your PC has a virus. Pay $149 and give us remote access.').length > 0);
});

test('normal invoices and group payments raise no flags', () => {
  assert.equal(paymentRedFlags('Invoice 88 from Blue Cafe: please pay $12.50 for catering.').length, 0);
  assert.equal(paymentRedFlags('We are collecting $15 each for Sam\'s birthday gift.').length, 0);
  assert.equal(paymentRedFlags('Happy to sell the bike for $120 through the marketplace checkout.').length, 0);
});

test('amount with the currency after it is read', () => {
  assert.deepEqual([regexExtract('catering, 45 EUR').amount, regexExtract('catering, 45 EUR').currency], [45, 'EUR']);
  assert.deepEqual([regexExtract('fee is 30 pounds').amount, regexExtract('fee is 30 pounds').currency], [30, 'GBP']);
});

test('INR conversion note says the rate is fixed and not live', () => {
  const c = toCheckout({ amount: 850, currency: 'INR' });
  assert.equal(c.amount, '10.00');
  assert.match(c.note, /fixed demo rate/);
});

test('when the AI review did not answer, checkout stays locked', async () => {
  const verdict = { riskLevel: 'UNCERTAIN', signals: [] };
  const r = await reviewPaymentRequest('Invoice 88 from Blue Cafe: please pay $12.50.', verdict, Promise.resolve({ amount: 12.5, currency: 'USD', payee: 'Blue Cafe', pressure: [], missing: [] }), false);
  assert.equal(r.degraded, true);
  assert.equal(r.canPay, false);
  assert.equal(r.token, null);
  assert.match(r.checkoutProblem, /AI review did not answer/);
});

test('the checkout note says the payee is not verified', async () => {
  const r = await reviewPaymentRequest('Invoice 88 from Blue Cafe: please pay $12.50.', { riskLevel: 'UNCERTAIN', signals: [] }, Promise.resolve({ amount: 12.5, currency: 'USD', payee: 'Blue Cafe', pressure: [], missing: [] }), true);
  assert.equal(r.canPay, true);
  assert.match(r.checkout.note, /not verified/);
});
