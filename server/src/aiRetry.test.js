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

test('latency budget allows slow free-tier responses without retry multiplication', async () => {
  const { TIMEOUT_MS, QUEUE_BUDGET_MS, remainingCallTimeout } = await import('./ai.js');
  assert.equal(TIMEOUT_MS, 30000);
  assert.equal(QUEUE_BUDGET_MS, 65000);
  assert.equal(remainingCallTimeout(65000, 0, TIMEOUT_MS), 30000);
  assert.equal(remainingCallTimeout(65000, 60000, TIMEOUT_MS), 5000);
  assert.equal(remainingCallTimeout(65000, 66000, TIMEOUT_MS), 0);
});

test('503 produces one request and only safe operational diagnostics', async () => {
  const { aiReview, aiStatus, diagnosticAttempts } = await import('./ai.js?unavailable-test');
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fictional-secret-key';
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: 'private upstream text' } }), { status: 503 });
  };
  try {
    assert.equal(await aiReview('private request text'), null);
    assert.equal(calls, 1);
    assert.equal(aiStatus.lastStatus, 503);
    assert.equal(diagnosticAttempts()[0].outcome, 'provider_unavailable');
    assert.deepEqual(Object.keys(diagnosticAttempts()[0]).sort(), ['at', 'durationMs', 'model', 'outcome', 'status']);
    assert.doesNotMatch(JSON.stringify(diagnosticAttempts()), /fictional-secret-key|private upstream|private request/);
    assert.equal('attempts' in aiStatus, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('aborted provider call fails closed without retry and does not leave stale HTTP status', async () => {
  const { callModel, aiStatus, diagnosticAttempts } = await import('./ai.js?timeout-test');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('secret message', 'AbortError')), { once: true });
  });
  try {
    const out = await callModel('test-model', 'fake-key', [{ text: 'fictional invoice' }], 5);
    assert.equal(out.noRetry, true);
    assert.equal(out.text, null);
    assert.equal(aiStatus.lastStatus, null);
    assert.equal(diagnosticAttempts().length, 1);
    assert.equal(diagnosticAttempts()[0].outcome, 'timeout');
    assert.doesNotMatch(JSON.stringify(aiStatus), /secret message|fake-key|fictional invoice/);
  } finally { globalThis.fetch = originalFetch; }
});
