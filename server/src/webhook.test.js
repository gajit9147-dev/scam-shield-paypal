import test from 'node:test';
import assert from 'node:assert/strict';
import { processWebhook, confirmationFor, confirmations } from './webhook.js';

const event = (over = {}) => ({
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  resource: {
    id: 'CAP123456', status: 'COMPLETED',
    amount: { value: '12.50', currency_code: 'USD' },
    supplementary_data: { related_ids: { order_id: 'ORDER-WEBHOOK-1' } }
  },
  ...over
});

test('a verified capture event is recorded', async () => {
  confirmations.clear();
  const r = await processWebhook({ headers: {}, event: event() }, async () => true);
  assert.equal(r.status, 200);
  const c = confirmationFor('ORDER-WEBHOOK-1', { amount: 12.5, currency: 'USD' });
  assert.equal(c.confirmed, true);
  assert.equal(c.captureId, 'CAP123456');
});

test('an event with a bad signature is rejected and not recorded', async () => {
  confirmations.clear();
  const r = await processWebhook({ headers: {}, event: event() }, async () => false);
  assert.equal(r.status, 401);
  assert.equal(confirmationFor('ORDER-WEBHOOK-1').confirmed, false);
});

test('a failing signature check counts as rejected', async () => {
  confirmations.clear();
  const r = await processWebhook({ headers: {}, event: event() }, async () => { throw new Error('network'); });
  assert.equal(r.status, 401);
});

test('other event types are ignored', async () => {
  confirmations.clear();
  const r = await processWebhook({ headers: {}, event: event({ event_type: 'PAYMENT.CAPTURE.DENIED' }) }, async () => true);
  assert.equal(r.status, 200);
  assert.equal(confirmations.size, 0);
});

test('a confirmed amount that differs from the reviewed amount is not accepted', async () => {
  confirmations.clear();
  await processWebhook({ headers: {}, event: event() }, async () => true);
  const c = confirmationFor('ORDER-WEBHOOK-1', { amount: 99, currency: 'USD' });
  assert.equal(c.confirmed, false);
});

test('junk bodies are rejected', async () => {
  const r = await processWebhook({ headers: {}, event: 'nope' }, async () => true);
  assert.equal(r.status, 400);
});
