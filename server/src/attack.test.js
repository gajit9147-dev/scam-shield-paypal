import test from 'node:test';
import assert from 'node:assert/strict';
import { runAttackDemo } from './paymentReview.js';

test('all four bypass attacks are rejected', () => {
  const results = runAttackDemo(() => false);
  assert.equal(results.length, 4);
  for (const r of results) assert.equal(r.blocked, true, r.attack);
});

test('a known order is not reported as blocked', () => {
  const results = runAttackDemo(() => true);
  assert.equal(results[3].blocked, false);
});

test('two parallel uses of one review token: only one passes', async () => {
  const { useTokenOnce } = await import('./paymentReview.js');
  const claim = { jti: 'parallel-test-' + Math.random(), exp: Date.now() + 60000 };
  const results = await Promise.all([1, 2, 3, 4].map(async () => useTokenOnce(claim)));
  assert.equal(results.filter(Boolean).length, 1);
});
