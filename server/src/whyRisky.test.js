import test from 'node:test';
import assert from 'node:assert/strict';
import { WHY_RISKY, whyRisky } from '../../client/src/whyRisky.js';
import { classify } from './classify.js';

test('every scam category has an English and a Hinglish explanation', () => {
  for (const [key, v] of Object.entries(WHY_RISKY)) {
    assert.ok(v.en && v.en.length > 20, key);
    assert.ok(v.hi && v.hi.length > 20, key);
    assert.ok(!/[—]/.test(v.en + v.hi), key);
  }
  assert.equal(whyRisky('nope', 'hi'), WHY_RISKY.unknown_suspicious.hi);
});

test('the India example messages are flagged by the local rules', () => {
  const samples = [
    'Dear customer, your KYC is expired and your account will be blocked today. Update KYC now at http://sbi-kyc-update.example.invalid or call 9876543210',
    'Hi, I will refund your Rs 4,999 order. Scan this QR code and enter your UPI PIN to receive the money',
    'Work from home job offer, earn Rs 5000 daily. Pay a Rs 999 registration fee to confirm your joining today',
    'You have a UPI collect request of Rs 9,999 from Cashback Rewards. Approve it to receive your cashback now'
  ];
  for (const s of samples) {
    const r = classify(s);
    assert.notEqual(r.riskLevel, 'LOW_RISK', s);
    assert.notEqual(r.label, 'safe', s);
  }
});
