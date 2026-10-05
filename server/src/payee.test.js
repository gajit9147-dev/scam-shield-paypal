import test from 'node:test';
import assert from 'node:assert/strict';
import { payeeCheck, reviewPaymentRequest } from './paymentReview.js';

test('payee check never calls a payee verified', () => {
  assert.equal(payeeCheck(null).status, 'none');
  assert.equal(payeeCheck('shop@okicici').status, 'format_ok_unverified');
  assert.equal(payeeCheck('billing@acme.com').status, 'format_ok_unverified');
  assert.equal(payeeCheck('not a payee').status, 'unclear');
});

test('a payee that imitates a brand is flagged', () => {
  assert.equal(payeeCheck('support@paypa1-secure.com').status, 'suspicious');
});

test('a look-alike payee blocks checkout even when the verdict is clean', async () => {
  const r = await reviewPaymentRequest('Please pay $20 to support@paypa1-secure.com for your order', { riskLevel: 'LOW_RISK' }, Promise.resolve(null), true);
  assert.equal(r.blocked, true);
  assert.equal(r.canPay, false);
  assert.equal(r.payeeCheck.status, 'suspicious');
});

test('the review token carries the payee status', async () => {
  const r = await reviewPaymentRequest('Invoice from Acme: $20, pay billing@acme.com', { riskLevel: 'LOW_RISK' }, Promise.resolve(null), true);
  assert.equal(r.canPay, true);
  assert.equal(r.payeeCheck.status, 'format_ok_unverified');
  const body = JSON.parse(Buffer.from(r.token.split('.')[0], 'base64url').toString());
  assert.equal(body.payeeStatus, 'format_ok_unverified');
});
