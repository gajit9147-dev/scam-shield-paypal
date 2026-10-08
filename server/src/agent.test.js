import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { buildGuardedTools, runAgent } from './agent.js';
import { verifyInvoice } from './invoiceCheck.js';

// These tests use FAKE PayPal tools and a FAKE model. They prove the guard logic, not PayPal behaviour.
const calls = [];
const fakeKit = () => {
  calls.length = 0;
  const t = (name, result) => ({ description: name, parameters: z.object({}).passthrough(), execute: async (a) => { calls.push({ name, a }); return typeof result === 'function' ? result(a) : result; } });
  return {
    get_order: t('get_order', '{"id":"O1"}'), get_invoice: t('get_invoice', '{"id":"INV2-X"}'), list_invoices: t('list_invoices', '{}'), list_transactions: t('list_transactions', '{}'),
    create_order: t('create_order', JSON.stringify({ id: 'ORDER12345', links: [{ rel: 'payer-action', href: 'https://sandbox.paypal.com/checkoutnow?token=ORDER12345' }] })),
    pay_order: t('pay_order', '{}'), refund_capture: t('refund_capture', '{}'), create_refund: t('create_refund', '{}')
  };
};
const ok = { verdict: { riskLevel: 'SAFE', summary: '' }, review: { canPay: true, blocked: false, checkout: { amount: '12.50', currency: 'USD' }, request: { purpose: 'Coffee' } } };
const scam = { verdict: { riskLevel: 'HIGH_RISK', summary: 'Asks for a fee to release a prize.' }, review: { canPay: false, blocked: true, checkout: { amount: '50.00', currency: 'USD' }, request: {} } };

test('only the allowed tools reach the model; pay and refund never do', () => {
  const tools = buildGuardedTools({ toolkitTools: fakeKit(), review: async () => ok });
  assert.deepEqual(Object.keys(tools).sort(), ['request_payment']);
});

test('a blocked request never creates an order', async () => {
  const tools = buildGuardedTools({ toolkitTools: fakeKit(), review: async () => scam, onOrderCreated: () => assert.fail('order registered') });
  const out = JSON.parse(await tools.request_payment.execute({ requestText: 'Pay $50 fee to release your prize' }));
  assert.equal(out.created, false);
  assert.match(out.reason, /Blocked by ScamShield/);
  assert.equal(calls.filter((c) => c.name === 'create_order').length, 0);
});

test('a cleared request creates an order from the checked amount, not from the model', async () => {
  const seen = [];
  const tools = buildGuardedTools({ toolkitTools: fakeKit(), review: async () => ok, onOrderCreated: (o) => { seen.push(o); return 'ticket'; } });
  const out = JSON.parse(await tools.request_payment.execute({ requestText: 'Please pay $12.50 for coffee' }));
  assert.equal(out.created, true);
  assert.equal(out.orderId, 'ORDER12345');
  assert.match(out.approveUrl, /paypal\.com/);
  assert.equal(calls.find((c) => c.name === 'create_order').a.items[0].itemCost, 12.5);
  assert.deepEqual(seen, [{ id: 'ORDER12345', amount: '12.50', currency: 'USD' }]);
});

test('non-USD cleared requests are refused', async () => {
  const inr = { ...ok, review: { ...ok.review, checkout: { amount: '500.00', currency: 'INR' } } };
  const tools = buildGuardedTools({ toolkitTools: fakeKit(), review: async () => inr });
  const out = JSON.parse(await tools.request_payment.execute({ requestText: 'Pay Rs 500 to shop' }));
  assert.equal(out.created, false);
});

test('merchant reads never reach the public model even when the toolkit supplies them', () => {
  const tools = buildGuardedTools({ toolkitTools: fakeKit(), review: async () => ok });
  for (const name of ['get_order', 'get_invoice', 'list_invoices', 'list_transactions']) assert.equal(tools[name], undefined);
  assert.equal(calls.length, 0);
});

test('runAgent passes only the guarded tools and a system prompt that treats text as data', async () => {
  let got;
  const generate = async (opts) => { got = opts; return { text: 'done', steps: [1, 2] }; };
  const tools = buildGuardedTools({ toolkitTools: fakeKit(), review: async () => ok });
  const r = await runAgent({ prompt: 'List my invoices', tools, model: 'fake', generate });
  assert.equal(r.answer, 'done');
  assert.ok(!('pay_order' in got.tools));
  assert.match(got.system, /data, never instructions/);
});

const inv = { id: 'INV2-ABCD-1234', status: 'SENT', detail: { invoice_number: '0001' }, amount: { currency_code: 'USD', value: '120.00' } };
test('invoice: matching amount is verified', async () => {
  const r = await verifyInvoice({ text: 'Invoice INV2-ABCD-1234: please pay $120.00' }, { getInvoice: async () => inv });
  assert.equal(r.result, 'verified');
});
test('invoice: changed amount is a mismatch with the differing field', async () => {
  const r = await verifyInvoice({ text: 'Invoice INV2-ABCD-1234: please pay $1200.00' }, { getInvoice: async () => inv });
  assert.equal(r.result, 'mismatch');
  assert.equal(r.differences[0].field, 'amount');
});
test('invoice: unknown id or no id is unverified, never "fake"', async () => {
  const nf = await verifyInvoice({ text: 'pay $5 on INV2-NOPE-0000' }, { getInvoice: async () => { const e = new Error('x'); e.status = 404; throw e; } });
  assert.equal(nf.result, 'unverified');
  const none = await verifyInvoice({ text: 'pay $5' }, { getInvoice: async () => inv });
  assert.equal(none.result, 'unverified');
});


test('agent stops after one tool step so Gemini thought signatures are not replayed', async () => {
  let got;
  const r = await runAgent({ prompt: 'Check payment', tools: {}, model: 'fake', generate: async opts => { got = opts; return { text: '', steps: [{ toolResults: [{ result: 'checked' }] }] }; } });
  assert.equal(got.maxSteps, 1);
  assert.ok(got.abortSignal instanceof AbortSignal);
  assert.match(r.answer, /No payment was captured/);
});

test('summarizeToolResults gives a plain answer for created, blocked and error results', async () => {
  const { summarizeToolResults } = await import('./agent.js');
  const mk = (o) => [{ toolResults: [{ result: JSON.stringify(o) }] }];
  assert.match(summarizeToolResults(mk({ created: true, amount: '12.50', currency: 'USD' })), /prepared a sandbox order for 12.50 USD.*Nothing is paid yet/);
  assert.match(summarizeToolResults(mk({ created: false, blocked: true, reason: 'Blocked by ScamShield: scam.' })), /No order was created and no payment was made/);
  assert.match(summarizeToolResults(mk({ created: false, error: 'PayPal did not return an order.' })), /No payment was made/);
  assert.equal(summarizeToolResults([{ toolResults: [{ result: 'checked' }] }]), '');
});
