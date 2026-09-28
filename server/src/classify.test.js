import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, spamScore } from './classify.js';
import { combineEvidence } from './fusion.js';
import { aiChat } from './ai.js';

test('1. OTP scam is flagged as HIGH_RISK and scam', () => {
  const text = 'Dear customer, share OTP to verify your account';
  const result = classify(text);
  assert.equal(result.label, 'scam');
  assert.equal(result.riskLevel, 'HIGH_RISK');
  assert.equal(result.category, 'otp_pin_theft');
  assert.ok(!JSON.stringify(result).includes(text));
  assert.equal(result.confidence, null);
});

test('2. UPI PIN scam is flagged as HIGH_RISK and scam', () => {
  const text = 'Enter your UPI PIN to claim Rs 2000 cashback';
  const result = classify(text);
  assert.equal(result.label, 'scam');
  assert.equal(result.riskLevel, 'HIGH_RISK');
  assert.equal(result.category, 'otp_pin_theft');
});

test('3. Refund fee scam is flagged even without a URL', () => {
  const text = 'Pay ₹500 processing fee to receive your refund';
  const result = classify(text);
  assert.equal(result.label, 'scam');
  assert.equal(result.riskLevel, 'HIGH_RISK');
  assert.equal(result.category, 'refund_scam');
});

test('4. KYC phishing threat is flagged as HIGH_RISK', () => {
  const text = 'Your KYC is expired. Update immediately at http://bit.ly/kyc-update or account will be blocked';
  const result = classify(text);
  assert.equal(result.label, 'scam');
  assert.equal(result.riskLevel, 'HIGH_RISK');
  assert.ok(['kyc_phishing', 'account_block_scam'].includes(result.category));
});

test('5. Account block threat with callback number is flagged as HIGH_RISK', () => {
  const text = 'Your bank account will be blocked within 24 hours. Call 9876543210 immediately';
  const result = classify(text);
  assert.equal(result.label, 'scam');
  assert.equal(result.riskLevel, 'HIGH_RISK');
  assert.ok(['account_block_scam', 'fake_support'].includes(result.category));
});

test('6. Lottery / prize scam is flagged as HIGH_RISK', () => {
  const text = 'Congratulations! You won Rs 25,00,000 in KBC lottery. Contact manager to claim';
  const result = classify(text);
  assert.equal(result.label, 'scam');
  assert.equal(result.riskLevel, 'HIGH_RISK');
  assert.equal(result.category, 'prize_lottery_scam');
});

test('7. Suspicious IP / courier URL scam is flagged as HIGH_RISK', () => {
  const text = 'Your package cannot be delivered. Update address: http://192.168.1.1/track';
  const result = classify(text);
  assert.equal(result.label, 'scam');
  assert.equal(result.riskLevel, 'HIGH_RISK');
});

test('8. QR payment scam is flagged as HIGH_RISK', () => {
  const text = 'Scan this QR code to receive Rs 5000 in your Google Pay account';
  const result = classify(text);
  assert.equal(result.label, 'scam');
  assert.equal(result.riskLevel, 'HIGH_RISK');
  assert.equal(result.category, 'qr_payment_scam');
});

test('9. Fake customer support mobile number is flagged', () => {
  const text = 'For PhonePe refund issue call customer care executive at 9876543210';
  const result = classify(text);
  assert.ok(result.riskLevel === 'HIGH_RISK' || result.riskLevel === 'SUSPICIOUS');
  assert.equal(result.category, 'fake_support');
});

test('10. Hindi OTP scam is flagged as HIGH_RISK', () => {
  const text = 'प्रिय ग्राहक, अपना खाता चालू रखने के लिए तुरंत OTP भेजो';
  const result = classify(text);
  assert.equal(result.label, 'scam');
  assert.equal(result.riskLevel, 'HIGH_RISK');
  assert.equal(result.category, 'otp_pin_theft');
});

test('11. Hinglish OTP scam is flagged as HIGH_RISK', () => {
  const text = 'Aapka account band ho jayega, turant OTP batao';
  const result = classify(text);
  assert.equal(result.label, 'scam');
  assert.equal(result.riskLevel, 'HIGH_RISK');
  assert.equal(result.category, 'otp_pin_theft');
});

test('12. Legitimate bank notification with defensive advice remains UNCERTAIN', () => {
  const text = 'Dear customer, Rs 1,500 debited from your A/c ending 4321 on 28-Sep-26. UPI Ref 626578912345. If not you, SMS BLOCK to 56767. Never share your OTP.';
  const result = classify(text);
  assert.equal(result.riskLevel, 'UNCERTAIN');
  assert.equal(result.label, 'uncertain');
});

test('13. Legitimate payment receipt remains UNCERTAIN', () => {
  const text = 'Your payment of ₹120 to Chai Point was received successfully. UPI Ref 123456789012.';
  const result = classify(text);
  assert.equal(result.riskLevel, 'UNCERTAIN');
  assert.equal(result.label, 'uncertain');
});

test('14. Normal personal message remains UNCERTAIN', () => {
  const text = 'Hey, are we still meeting for lunch at 1 PM today?';
  const result = classify(text);
  assert.equal(result.riskLevel, 'UNCERTAIN');
  assert.equal(result.label, 'uncertain');
});

test('15. Ambiguous message with normal link remains UNCERTAIN', () => {
  const text = 'Please check this document when you are free: https://docs.google.com/document/d/xyz';
  const result = classify(text);
  assert.equal(result.riskLevel, 'UNCERTAIN');
  assert.equal(result.label, 'uncertain');
});

test('16. Follow-up "is it fraud?" uses existing detection result', async () => {
  const detectionResult = {
    riskLevel: 'HIGH_RISK',
    category: 'otp_pin_theft',
    categoryLabel: 'OTP / PIN Theft',
    evidence: ['Requests the recipient to share or provide a one-time password (OTP)']
  };
  const reply = await aiChat({
    message: 'is it fraud?',
    context: 'Your account will be blocked. Send OTP immediately.',
    language: 'en',
    detectionResult
  });
  assert.ok(reply.includes('high risk') && reply.includes('scam'));
});

test('17. Follow-up "is it froud or not?" handles typo and uses existing result', async () => {
  const detectionResult = {
    riskLevel: 'HIGH_RISK',
    category: 'otp_pin_theft',
    categoryLabel: 'OTP / PIN Theft',
    evidence: ['Requests the recipient to share or provide a one-time password (OTP)']
  };
  const reply = await aiChat({
    message: 'is it froud or not?',
    context: 'Your account will be blocked. Send OTP immediately.',
    language: 'en',
    detectionResult
  });
  assert.ok(reply.includes('high risk') && reply.includes('scam'));
});

test('18. Screenshot / OCR evidence fusion incorporates OCR source', () => {
  const transcript = 'Scan this QR code to receive Rs 5000 in your Google Pay';
  const localResult = classify(transcript);
  const result = combineEvidence({
    rawText: transcript,
    localResult,
    geminiResult: null,
    spamScore: 0.1,
    isSpamFlagged: false,
    isImage: true,
    ocrTranscript: transcript
  });
  assert.equal(result.riskLevel, 'HIGH_RISK');
  assert.equal(result.sources.ocr, true);
});

test('threat plus payment destination legacy test passes', () => {
  assert.equal(classify('Your UPI will be blocked. Pay fee to account to unlock it').label, 'scam');
});

test('UCI baseline is a finite general-spam signal', () => {
  assert.ok(spamScore('WIN FREE CASH NOW! Reply to claim your prize') > spamScore('Are we meeting for lunch tomorrow?'));
});
