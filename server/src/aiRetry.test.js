import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelayMs } from './ai.js';

test('provider Retry-After accepts seconds and HTTP dates', () => {
  assert.equal(retryDelayMs(new Headers({ 'retry-after': '60' }), 0), 60000);
  assert.equal(retryDelayMs(new Headers({ 'retry-after': 'Thu, 01 Jan 1970 00:01:00 GMT' }), 1000), 59000);
  assert.equal(retryDelayMs(new Headers({ 'retry-after': 'bad' }), 0), null);
  assert.equal(retryDelayMs(new Headers(), 0), null);
});

test('429 stops retries and all subsequent model fallback requests during cooldown', async () => {
  const { callModel } = await import('./ai.js?quota-test');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('{}', { status: 429, headers: { 'retry-after': '120' } });
  };
  try {
    const first = await callModel('test-model', 'fake-key', [{ text: 'fictional invoice' }]);
    const second = await callModel('fallback-model', 'fake-key', [{ text: 'fictional invoice' }]);
    assert.equal(first.isQuotaError, true);
    assert.equal(second.isQuotaError, true);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
