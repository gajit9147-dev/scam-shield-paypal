import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, spamScore } from './classify.js';

test('sensitive-code request is flagged without echoing it', () => {
  const text = 'Send your OTP to receive the refund';
  const result = classify(text);
  assert.equal(result.label, 'scam');
  assert.ok(!JSON.stringify(result).includes(text));
  assert.equal(result.confidence, null);
});
test('threat plus payment destination is flagged', () => {
  assert.equal(classify('Your UPI will be blocked. Pay fee to account to unlock it').label, 'scam');
});
test('warnings and ordinary messages are not pronounced safe', () => {
  assert.equal(classify('Never share your OTP with anyone.').label, 'uncertain');
  assert.equal(classify('Your payment of 120 was received.').label, 'uncertain');
});
test('UCI baseline is a finite general-spam signal', () => {
  assert.ok(spamScore('WIN FREE CASH NOW! Reply to claim your prize') > spamScore('Are we meeting for lunch tomorrow?'));
});
