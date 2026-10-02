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
