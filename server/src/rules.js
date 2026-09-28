// Deterministic scam detection rules for Indian financial & payment messages.
// Covers English, Hindi (Devanagari), and Hinglish transliterations.

import { normalizeMessage, extractEntities } from './normalizer.js';

// Legitimate caution / defensive phrases that advise the user NOT to share codes
const DEFENSIVE_ADVICE = /\b(?:never|do not|don'?t|should not|kabhi bhi|kisi ko|kisi se)\s+(?:share|disclose|give|tell|send|reveal|bata(?:o|en|ye)|bhej(?:o|en|ye)|enter)\b|\b(?:never\s+share\s+(?:your\s+)?otp|bank\s+never\s+asks?)\b|कभी\s*भी\s*(?:ओटीपी|पिन)\s*(?:शेयर|साझा|बताएं|न\s*दें)/i;

// Legitimate transaction notification patterns
const LEGIT_RECEIPT_INDICATORS = [
  /\b(?:debited\s+by|debited\s+from|credited\s+to|credited\s+with|deposited\s+to)\b/i,
  /\b(?:avail(?:able)?\s+bal(?:ance)?|avl\s+bal|a\/c\s+bal)\b/i,
  /\b(?:txn\s*id|transaction\s*id|upi\s*ref(?:\s*no)?|utr(?:\s*no)?)\s*[:#]?\s*[a-zA-Z0-9]{8,}/i,
  /\b(?:payment\s+of\s+(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d{1,2})?\s+(?:was\s+)?received\s+successfully|paid\s+successfully\s+to)\b/i
];

export function isLegitimateReceipt(text) {
  const norm = text.toLowerCase();
  let hits = 0;
  for (const pattern of LEGIT_RECEIPT_INDICATORS) {
    if (pattern.test(norm)) hits++;
  }
  return hits >= 1 || /\b(?:payment\s+(?:of\s+.*?\s+)?(?:was\s+)?received\s+successfully|credited\s+to\s+your\s+account|debited\s+from\s+your\s+a\/c)\b/i.test(norm);
}

export function detectLocalSignals(rawText) {
  const { normalized, expanded } = normalizeMessage(rawText);
  const entities = extractEntities(rawText);
  const signals = [];

  const textToMatch = `${normalized} ${expanded}`;
  const isDefensive = DEFENSIVE_ADVICE.test(textToMatch);

  // 1. OTP Requests (English, Hindi Devanagari, and Hinglish transliterations)
  const otpRequestPattern = /\b(?:otp|one[ -]?time\s+(?:password|pin|code)|ओटीपी)\s*(?:bhejo|batao|share|send|de do|mang|karo|भेजो|बताओ|दीजिये|दीजिए|शेयर|भेजें|बताएं|दर्ज\s*करें)\b|\b(?:send|share|reply|provide|enter|submit|tell|give|forward|type|verify|batao|bataiye|bata do|bhejo|bhejiye|bhej do|de do|mang|भेजो|बताओ|दीजिये|दीजिए|शेयर|भेजें|बताएं)\s+(?:me\s+|your\s+|the\s+|turant\s+|abhi\s+|apna\s+)?(?:otp|one[ -]?time\s+(?:password|pin|code)|ओटीपी)\b/i;

  if (otpRequestPattern.test(textToMatch) && !isDefensive) {
    signals.push({
      type: 'otp_request',
      severity: 'high',
      category: 'otp_pin_theft',
      evidence: 'Requests the recipient to share or provide a one-time password (OTP)'
    });
  }

  // 2. UPI PIN Requests (English, Hindi Devanagari, and Hinglish transliterations)
  const upiPinPattern = /\b(?:upi\s*pin|mpin|secret\s*pin|pin|यूपीआई\s*पिन|पिन)\s*(?:batao|bataiye|bhejo|bhejiye|dalo|enter|type|share|बताओ|भेजो|डालो|दर्ज|दीजिये|शेयर)\b|\b(?:enter|share|send|provide|give|type|submit|tell|batao|bataiye|bhejo|bhejiye|dalo|बताओ|भेजो|डालो|दर्ज)\s+(?:your\s+|apna\s+)?(?:upi\s*pin|mpin|secret\s*pin|pin|यूपीआई\s*पिन|पिन)\b|\b(?:enter|type|dalo)\s+(?:upi\s*)?pin\s+to\s+(?:receive|claim|get)\b/i;

  if (upiPinPattern.test(textToMatch) && !isDefensive) {
    signals.push({
      type: 'upi_pin_request',
      severity: 'high',
      category: 'otp_pin_theft',
      evidence: 'Asks the user to enter or reveal their UPI PIN or MPIN'
    });
  }

  // 3. Card Details / ATM PIN / CVV / Password theft
  const credentialPattern = /\b(?:cvv|atm\s*pin|card\s*number|debit\s*card\s*pin|credit\s*card\s*number|netbanking\s*password|login\s*password|credentials?)\s*(?:batao|bhejo|share|send|enter|provide|submit|update)\b|\b(?:share|enter|send|provide)\s+(?:your\s+)?(?:cvv|atm\s*pin|16\s*digit|card\s*details|netbanking\s*password|password)\b|सीवीवी|एटीएम\s*पिन|पासवर्ड\s*(?:बताओ|भेजो)/i;

  if (credentialPattern.test(textToMatch) && !isDefensive) {
    signals.push({
      type: 'credential_theft',
      severity: 'high',
      category: 'credential_theft',
      evidence: 'Requests sensitive banking credentials such as CVV, ATM PIN, or card password'
    });
  }

  // 4. Payment-to-receive scams / pay to unlock
  const payToReceivePattern = /\b(?:pay|transfer|send|deposit)\s+(?:(?:rs\.?|inr|₹)?\s*[\d,]+|\w+\s+)?.*?\b(?:to\s+(?:receive|get|claim|collect|release|unlock|activate)|for\s+receiving|before\s+(?:we|you)\s+(?:release|credit|unblock))\b|\b(?:pay|transfer|deposit|send)\s+(?:fee|charge|penalty|money|rs\.?|inr|₹|amount)?\s*(?:to\s+(?:account|upi|vpa|link|qr|wallet))\s*.*?\b(?:to\s+(?:unlock|activate|unblock)|avoid)\b|\b(?:paise|rupaye|paisa|amount)\s+(?:receive|pane|lene)\s+ke\s+liye\s+(?:pay|bhejo|transfer|jama)\b|\b(?:receive|pane|lene)\s+ke\s+liye\s+(?:pay|paise\s+bhejo)\b|पैसे\s*(?:पाने|प्राप्त\s*करने)\s*के\s*लिए\s*(?:भुगतान|पे)/i;

  if (payToReceivePattern.test(textToMatch)) {
    signals.push({
      type: 'payment_to_receive',
      severity: 'high',
      category: 'upi_payment_scam',
      evidence: 'Demands payment, fee, or funds transfer in order to receive money or unlock an account'
    });
  }

  // 5. Refund fee scams
  const refundFeePattern = /\b(?:pay|deposit|transfer|send)\s+.*?\b(?:processing\s*fee|charge|fee|amount)\b.*?\b(?:refund|cashback)\b|\b(?:refund\s+(?:lene|pane)\s+ke\s+liye\s+(?:fee|charge|pay|paise))\b|\brefund\s+fee\b|रिफंड\s*(?:पाने|लेने)\s*के\s*लिए\s*(?:शुल्क|फीस|भुगतान)/i;

  if (refundFeePattern.test(textToMatch)) {
    signals.push({
      type: 'refund_fee_scam',
      severity: 'high',
      category: 'refund_scam',
      evidence: 'Demands a processing fee or charge to release an alleged refund'
    });
  }

  // 6. KYC / PAN / Aadhaar threats & phishing
  const kycPattern = /\b(?:kyc\s*(?:is\s+)?(?:update|verify|verification|expire|expired|suspend|suspended|deactivat|incomplete)|pan\s*(?:card\s*)?(?:link|update|blocked)|aadhaar\s*(?:link|update))\b.*\b(?:immediately|today|link|click|within|call|otherwise|nahi\s+to|turant|karo)\b|\b(?:update|verify)\s+your\s+kyc\b|\bkyc\s+(?:karo|update|verify)\b|केवाईसी\s*(?:अपडेट|वेरिफाई|ब्लॉक|बंद)/i;

  if (kycPattern.test(textToMatch)) {
    signals.push({
      type: 'kyc_phishing',
      severity: 'high',
      category: 'kyc_phishing',
      evidence: 'Uses KYC / PAN suspension threats to pressure the recipient into urgent action or clicking links'
    });
  }

  // 7. Account suspension / block threats
  const accountThreatPattern = /\b(?:account|a\/c|upi|sim|electricity|power|bijli)\s*(?:will\s+be\s+|is\s+|has\s+been\s+)?(?:blocked|suspended|deactivated|stopped|disconnected|terminated|freeze)\b|\b(?:account|khata|bijli|line|sim)\s*(?:band\s+ho\s+jayega|block\s+ho\s+jayega|kat\s+jayegi|rok\s+di\s+jayegi)\b|खाता\s*(?:बंद|ब्लॉक)|अकाउंट\s*(?:बंद|ब्लॉक)|बिजली\s*(?:कट|बंद)/i;

  if (accountThreatPattern.test(textToMatch)) {
    signals.push({
      type: 'account_threat',
      severity: 'high',
      category: 'account_block_scam',
      evidence: 'Threatens immediate block, suspension, or disconnection of bank account, UPI, or essential services'
    });
  }

  // 8. Prize, lottery, and reward scams
  const prizeLotteryPattern = /\b(?:congratulations|congrats|lucky\s*draw|winner|won)\b.*\b(?:lottery|prize|reward|kbc|cash\s*prize|car|gift)\b|\b(?:won|winner\s+of)\s+(?:rs\.?|inr|₹)\s*[\d,]+\b|\b(?:lottery\s+lagi|inaam\s+jeeta|prize\s+mila)\b|लॉटरी\s*(?:जीत|मिली)|इनाम\s*(?:जीता|मिला)|लकी\s*ड्रा\s*विजेता/i;

  if (prizeLotteryPattern.test(textToMatch)) {
    signals.push({
      type: 'lottery_prize',
      severity: 'high',
      category: 'prize_lottery_scam',
      evidence: 'Unsolicited announcement of lottery, lucky draw, or major prize winnings'
    });
  }

  // 9. Cashback scams
  const cashbackPattern = /\b(?:cashback\s+(?:of\s+)?(?:rs\.?|inr|₹)?\s*[\d,]*\s*(?:credited|approved|ready|reward|pending|claim))\b.*\b(?:click|link|claim|receive|upi)\b|\b(?:cashback\s+(?:pane|lene|claim)\s+ke\s+liye)\b|कैशबैक\s*(?:मिला|क्लेम|प्राप्त)/i;

  if (cashbackPattern.test(textToMatch)) {
    signals.push({
      type: 'cashback_scam',
      severity: 'medium',
      category: 'cashback_scam',
      evidence: 'Promises incoming cashback requiring user action or link navigation'
    });
  }

  // 10. QR code payment scams
  const qrPattern = /\b(?:scan\s+(?:this\s+)?qr(?:\s*code)?\s+(?:to\s+receive|to\s+get|for\s+receiving|paise\s+lene\s+ke\s+liye)|qr\s*(?:code\s*)?scan\s+karo\s+(?:paise|payment))\b|क्यूआर\s*कोड\s*स्कैन\s*कर(?:ें|ो)/i;

  if (qrPattern.test(textToMatch)) {
    signals.push({
      type: 'qr_payment_scam',
      severity: 'high',
      category: 'qr_payment_scam',
      evidence: 'Directs the user to scan a QR code to receive money (scanning a QR code or entering a PIN only sends money)'
    });
  }

  // 11. Remote-access software requests
  const remoteAccessPattern = /\b(?:anydesk|teamviewer|rustdesk|quicksupport|screen\s*share|airdroid|zoho\s*assist)\b/i;

  if (remoteAccessPattern.test(textToMatch)) {
    signals.push({
      type: 'remote_access',
      severity: 'high',
      category: 'credential_theft',
      evidence: 'Instructs the recipient to install remote access or screen-sharing tools'
    });
  }

  // 12. Fake customer support / callback mobile numbers
  const fakeSupportPattern = /\b(?:call|contact|helpline|support|customer\s*care|executive|officer|manager)\b.*\b(?:[6-9]\d{9}|\+91[\s-]?[6-9]\d{9})\b|\b(?:toll[ -]?free|helpline\s*no|customer\s*care)\s*[:#]?\s*(?:[6-9]\d{9})/i;

  if (fakeSupportPattern.test(textToMatch)) {
    signals.push({
      type: 'fake_support',
      severity: 'medium',
      category: 'fake_support',
      evidence: 'Provides an unofficial personal mobile number masquerading as official customer support or helpline'
    });
  }

  // 13. Shortened URLs
  if (entities.shortenedUrls.length > 0) {
    signals.push({
      type: 'shortened_url',
      severity: 'medium',
      category: 'malicious_link',
      evidence: `Contains shortened URL (${entities.shortenedUrls[0]}) which obscures the true destination website`
    });
  }

  // 14. Suspicious links (raw IP address or untrusted TLDs)
  const suspiciousIpOrTld = /\bhttps?:\/\/(?:\d{1,3}\.){3}\d{1,3}|\bhttps?:\/\/[a-zA-Z0-9.\-_]+\.(?:xyz|top|work|club|buzz|guru|live|download|tk|ml|ga|cf|gq|apk)\b/i;
  if (suspiciousIpOrTld.test(textToMatch)) {
    signals.push({
      type: 'suspicious_link',
      severity: 'high',
      category: 'malicious_link',
      evidence: 'Contains link pointing to an IP address or suspicious high-risk domain'
    });
  }

  // 15. Fake government / Tax refund / E-challan scams
  const govtScamPattern = /\b(?:income\s*tax\s*refund|tax\s*refund|e-?challan\s*pending|parivahan\s*challan|pm\s*yojana|modi\s*yojana)\b.*\b(?:claim|pay|click|link|rs\.?|inr|₹|immediately)\b/i;

  if (govtScamPattern.test(textToMatch)) {
    signals.push({
      type: 'tax_refund_scam',
      severity: 'high',
      category: 'tax_refund_scam',
      evidence: 'Impersonates government tax authorities, traffic e-challan systems, or subsidy schemes'
    });
  }

  // 16. Courier / Delivery failure scams
  const deliveryScamPattern = /\b(?:package|parcel|courier|shipment|india\s*post|delivery)\b.*\b(?:cannot\s+be\s+delivered|address\s+(?:incomplete|missing|wrong)|pending\s+fee|update\s+address|held\s+at\s+customs)\b.*\b(?:link|click|update|http|bit\.ly)/i;

  if (deliveryScamPattern.test(textToMatch)) {
    signals.push({
      type: 'delivery_scam',
      severity: 'high',
      category: 'delivery_scam',
      evidence: 'Claims postal package delivery failure to induce clicking an address-update phishing link'
    });
  }

  // 17. Job / Work-from-home / Registration fee scams
  const jobScamPattern = /\b(?:part[ -]?time\s*job|work\s*from\s*home|daily\s*(?:earning|income)|like\s+and\s+subscribe|youtube\s*task|earn\s*(?:rs\.?|inr|₹)\s*\d{3,5}\s*(?:daily|per\s*day))\b.*\b(?:telegram|whatsapp|fee|register|deposit|task)\b/i;

  if (jobScamPattern.test(textToMatch)) {
    signals.push({
      type: 'job_fee_scam',
      severity: 'high',
      category: 'job_fee_scam',
      evidence: 'Promises unrealistic daily work-from-home earnings or demands job registration fees'
    });
  }

  // 18. Investment & crypto scams
  const investmentScamPattern = /\b(?:guaranteed\s*returns?|double\s*your\s*money|crypto\s*trading\s*bot|100%\s*(?:profit|guarantee)|trading\s*signal|invest\s+(?:rs\.?|inr|₹)\s*[\d,]+\s*(?:earn|get))\b/i;

  if (investmentScamPattern.test(textToMatch)) {
    signals.push({
      type: 'investment_scam',
      severity: 'high',
      category: 'investment_scam',
      evidence: 'Promotes fraudulent high-return investment schemes or cryptocurrency guarantees'
    });
  }

  // 19. Urgency & Pressure Tactics
  const urgencyPattern = /\b(?:immediately|urgent|urgently|within\s*(?:24|12|2|1)\s*hours?|before\s*(?:midnight|today)|turant|abhi|jaldi|turant\s*payment|abhi\s*verify)\b|तुरंत|जल्दी|24\s*घंटे/i;

  if (urgencyPattern.test(textToMatch)) {
    signals.push({
      type: 'urgency_pressure',
      severity: 'low',
      category: 'unknown_suspicious',
      evidence: 'Applies psychological urgency or strict deadline pressure to rush user decisions'
    });
  }

  // 20. Institutional Impersonation
  const impersonationPattern = /\b(?:dear\s+customer|valued\s+customer)\b.*\b(?:sbi|hdfc|icici|axis|pnb|paytm|phonepe|gpay|google\s*pay|cbi|police|rbi|trai)\b|\b(?:police|customs\s*officer|cbi\s*department)\b/i;

  if (impersonationPattern.test(textToMatch)) {
    signals.push({
      type: 'impersonation',
      severity: 'low',
      category: 'impersonation',
      evidence: 'Impersonates banks, payment providers, law enforcement, or regulatory institutions'
    });
  }

  return {
    source: 'local_rules',
    signals,
    entities,
    isDefensiveAdvice: isDefensive,
    isLegitReceipt: isLegitimateReceipt(rawText)
  };
}
