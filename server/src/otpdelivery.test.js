import test from 'node:test';
import assert from 'node:assert/strict';
import { isOtpDelivery, detectLocalSignals } from './rules.js';
import { combineEvidence } from './fusion.js';

// Digits are placeholders. Real OTPs never go into the repo.
const delivery = [
  'Your OTP is 123456 for test drive verification. Do not share it with anyone! Brand India',
  'Dear Customer, 123456 is your one time password (OTP). Please enter the OTP to proceed. Thank you, Team Telco',
  '123456 is your verification code. Do not share it with anyone.'
];
const theft = [
  'Your OTP is 123456. Share it with our executive to get your refund',
  'Dear customer, share OTP to verify your account',
  'Your OTP is 123456. Click http://bit.ly/x1 to confirm and tell us the code',
  'Enter your OTP to claim Rs 5000 cashback now',
  'Your OTP is 123456. Send it to 9876543210 to avoid account block',
  'Please enter the OTP to proceed'
];

test('plain OTP delivery messages are recognised', () => { for (const t of delivery) assert.equal(isOtpDelivery(t), true, t); });
test('OTP theft messages are not treated as delivery', () => { for (const t of theft) assert.equal(isOtpDelivery(t), false, t); });

function verdictWithAi(text) {
  const local = detectLocalSignals(text);
  return combineEvidence({
    rawText: text, localResult: local,
    geminiResult: { label: 'scam', category: 'otp_pin_theft', signals: [{ evidence: 'Requests OTP', severity: 'high' }, { evidence: 'Pretends to be a known company', severity: 'high' }] },
    spamScore: 0.1, isSpamFlagged: false, isImage: false
  });
}
test('a delivery message stays UNCERTAIN even when the AI over-reacts, and is never called safe', () => {
  for (const t of delivery) { const v = verdictWithAi(t); assert.equal(v.riskLevel, 'UNCERTAIN', t); assert.notEqual(v.label, 'safe'); }
});
test('OTP theft stays HIGH_RISK', () => {
  for (const t of theft) assert.equal(verdictWithAi(t).riskLevel, 'HIGH_RISK', t);
});
