import test from 'node:test';
import assert from 'node:assert/strict';
import { processWebhook, confirmationFor, confirmations, recentEvents, resetWebhookState } from './webhook.js';

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

test('a repeated event id is not applied twice', async () => {
  resetWebhookState();
  const ev = event(); ev.id = 'WH-DUP-1';
  const first = await processWebhook({ headers: {}, event: ev }, async () => true);
  assert.equal(first.body.recorded, true);
  const again = await processWebhook({ headers: {}, event: ev }, async () => true);
  assert.equal(again.body.duplicate, true);
  assert.deepEqual(recentEvents().map((e) => e.result), ['duplicate', 'recorded']);
});

test('a rejected event is logged and never recorded', async () => {
  resetWebhookState();
  const ev = event(); ev.id = 'WH-BAD-1';
  const r = await processWebhook({ headers: {}, event: ev }, async () => false);
  assert.equal(r.status, 401);
  assert.equal(recentEvents()[0].result, 'rejected');
  assert.equal(confirmationFor('ORDER-WEBHOOK-1').confirmed, false);
  // a bad signature must not use up the event id: the real delivery still counts
  const ok = await processWebhook({ headers: {}, event: ev }, async () => true);
  assert.equal(ok.body.recorded, true);
});
