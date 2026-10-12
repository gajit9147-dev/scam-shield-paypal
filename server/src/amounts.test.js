import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEntities } from './normalizer.js';

test('amounts are picked up in rupees and in dollars', () => {
  assert.deepEqual(extractEntities('Pay Rs. 1,200 now').amounts, ['Rs. 1,200']);
  assert.deepEqual(extractEntities('Pay $50.25 or USD 20 today').amounts, ['$50.25', 'USD 20']);
  assert.deepEqual(extractEntities('hello there').amounts, []);
});
