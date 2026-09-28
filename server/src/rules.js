// Deterministic scam detection rules for Indian financial & payment messages.
// Covers English, Hindi (Devanagari), and Hinglish transliterations.

import { normalizeMessage, extractEntities, maskUrl, maskUpiId, extractHost } from './normalizer.js';

// Legitimate caution / defensive phrases that advise the user NOT to share codes
const DEFENSIVE_ADVICE = /\b(?:never|do not|don'?t|should not|kabhi bhi|kisi ko|kisi se)\s+(?:share|disclose|give|tell|send|reveal|bata(?:o|en|ye)|bhej(?:o|en|ye)|enter)\b|\b(?:never\s+share\s+(?:your\s+)?otp|bank\s+never\s+asks?)\b|कभी\s*भी\s*(?:ओटीपी|पिन)\s*(?:शेयर|साझा|बताएं|न\s*दें)/i;

// Legitimate transaction notification patterns
const LEGIT_RECEIPT_INDICATORS = [
  /\b(?:debited\s+by|debited\s+from|credited\s+to|credited\s+with|deposited\s+to)\b/i,
  /\b(?:avail(?:able)?\s+bal(?:ance)?|avl\s+bal|a\/c\s+bal)\b/i,
  /\b(?:txn\s*id|transaction\s*id|upi\s*ref(?:\s*no)?|utr(?:\s*no)?)\s*[:#]?\s*[a-zA-Z0-9]{8,}/i,
  /\b(?:payment\s+of\s+(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d{1,2})?\s+(?:was\s+)?received\s+successfully|paid\s+successfully\s+to)\b/i
];

// Bank / payment brands that scammers imitate inside lookalike domains
const BRAND_TOKENS = ['sbi', 'hdfc', 'icici', 'axis', 'pnb', 'kotak', 'paytm', 'phonepe', 'bhim', 'npci', 'rbi', 'yesbank', 'bob'];
const LEGIT_TLDS = ['com', 'in', 'co.in', 'net', 'org', 'bank'];

function registrableParts(host) {
  const labels = host.split('.').filter(Boolean);
  if (labels.length >= 3 && labels.slice(-2).join('.') === 'co.in') {
    return { base: labels[labels.length - 3], tld: 'co.in', sub: labels.slice(0, -3).join('.') };
  }
  if (labels.length >= 2) {
    return { base: labels[labels.length - 2], tld: labels[labels.length - 1], sub: labels.slice(0, -2).join('.') };
  }
  return { base: host, tld: '', sub: '' };
}

function isOfficialBrandHost(base, tld, brand) {
  if (!LEGIT_TLDS.includes(tld)) return false;
  return base === brand
    || base === `${brand}bank`
    || base === `online${brand}`
    || base === `${brand}online`;
}

// Returns { host, brand } when a URL host imitates a known bank/payment brand
export function findLookalikeDomain(urls) {
  for (const url of urls || []) {
    const host = extractHost(url);
    if (!host) continue;
    const { base, tld } = registrableParts(host);
    for (const brand of BRAND_TOKENS) {
      if (!host.includes(brand)) continue;
      if (!isOfficialBrandHost(base, tld, brand)) {
        return { host, brand };
      }
    }
  }
  return null;
}

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
  const otpRequestPattern = /\b(?:otp|one[ -]?time\s+(?:password|pin|code)|ओटीपी)\s*(?:bta\s*do|batao|bata\s*do|bataiye|bhej\s*do|bhejo|bhejiye|share|send|de\s*do|dedo|mang|karo|करो|भेजो|बताओ|दीजिये|दीजिए|शेयर|भेजें|बताएं|दर्ज\s*करें)\b|\b(?:send|share|reply|provide|enter|submit|tell|give|forward|type|verify|batao|bataiye|bata\s*do|bta\s*do|bhejo|bhejiye|bhej\s*do|de\s*do|dedo|mang|भेजो|बताओ|दीजिये|दीजिए|शेयर|भेजें|बताएं)\s+(?:me\s+|your\s+|the\s+|this\s+|with\s+(?:the\s+)?|turant\s+|abhi\s+|apna\s+)?(?:otp|one[ -]?time\s+(?:password|pin|code)|ओटीपी)\b/i;

  if (otpRequestPattern.test(textToMatch) && !isDefensive) {
    signals.push({
      type: 'otp_request',
      severity: 'high',
      category: 'otp_pin_theft',
      evidence: 'Requests the recipient to share or provide a one-time password (OTP)',
      evidenceHi: 'OTP (वन-टाइम पासवर्ड) भेजने या बताने को कहा गया है'
    });
  }

  // 2. UPI PIN Requests (English, Hindi Devanagari, and Hinglish transliterations)
  const upiPinPattern = /\b(?:upi\s*pin|mpin|secret\s*pin|pin|यूपीआई\s*पिन|पिन)\s*(?:bta\s*do|bata\s*do|batao|bataiye|bhej\s*do|bhejo|bhejiye|de\s*do|dedo|dalo|send|enter|type|share|बताओ|भेजो|डालो|दर्ज|दीजिये|शेयर)\b|\b(?:enter|share|send|provide|give|type|submit|tell|batao|bataiye|bata\s*do|bta\s*do|bhejo|bhejiye|bhej\s*do|de\s*do|dedo|dalo|बताओ|भेजो|डालो|दर्ज)\s+(?:your\s+|apna\s+|mera\s+)?(?:upi\s*pin|mpin|secret\s*pin|pin|यूपीआई\s*पिन|पिन)\b|\b(?:enter|type|dalo)\s+(?:upi\s*)?pin\s+to\s+(?:receive|claim|get)\b/i;

  if (upiPinPattern.test(textToMatch) && !isDefensive) {
    signals.push({
      type: 'upi_pin_request',
      severity: 'high',
      category: 'otp_pin_theft',
      evidence: 'Asks the user to enter or reveal their UPI PIN or MPIN',
      evidenceHi: 'UPI PIN या MPIN डालने या बताने को कहा गया है'
    });
  }

  // 3. Card Details / ATM PIN / CVV / Password theft
  const credentialPattern = /\b(?:cvv|atm\s*pin|card\s*number|debit\s*card\s*pin|credit\s*card\s*number|netbanking\s*password|login\s*password|credentials?)\s*(?:batao|bhejo|share|send|enter|provide|submit|update)\b|\b(?:share|enter|send|provide|give)\s+(?:your\s+|the\s+)?(?:cvv|atm\s*pin|16\s*digit|card\s*(?:number|details)|netbanking\s*password|password|bank\s+details|login\s+(?:details|credentials|id))\b|सीवीवी|एटीएम\s*पिन|पासवर्ड\s*(?:बताओ|भेजो)/i;

  if (credentialPattern.test(textToMatch) && !isDefensive) {
    signals.push({
      type: 'credential_theft',
      severity: 'high',
      category: 'credential_theft',
      evidence: 'Requests sensitive banking credentials such as CVV, ATM PIN, or card password',
      evidenceHi: 'CVV, ATM पिन या कार्ड पासवर्ड जैसी गोपनीय बैंकिंग जानकारी माँगी गई है'
    });
  }

  // 4. Payment-to-receive scams / pay to unlock
  const payToReceivePattern = /\b(?:pay|transfer|send|deposit)\s+(?:(?:rs\.?|inr|₹)?\s*[\d,]+|\w+\s+)?.*?\b(?:to\s+(?:receive|get|claim|collect|release|unlock|activate)|for\s+receiving|before\s+(?:we|you)\s+(?:release|credit|unblock))\b|\b(?:pay|transfer|deposit|send)\s+(?:fee|charge|penalty|money|rs\.?|inr|₹|amount)?\s*(?:to\s+(?:account|upi|vpa|link|qr|wallet))\s*.*?\b(?:to\s+(?:unlock|activate|unblock)|avoid)\b|\b(?:refund|paise|rupaye|paisa|amount|money|reward|cashback)\s+(?:receive|pane|lene|claim)\b[\s\S]{0,60}?\b(?:pay|bhejo|transfer|jama|kare|karo)\b|\b(?:paise|rupaye|paisa|amount)\s+(?:receive|pane|lene)\s+ke\s+liye\s+(?:pay|bhejo|transfer|jama)\b|\b(?:receive|pane|lene)\s+ke\s+liye\s+(?:pay|paise\s+bhejo)\b|पैसे\s*(?:पाने|प्राप्त\s*करने)\s*के\s*लिए\s*(?:भुगतान|पे)/i;

  if (payToReceivePattern.test(textToMatch)) {
    signals.push({
      type: 'payment_to_receive',
      severity: 'high',
      category: 'upi_payment_scam',
      evidence: 'Demands payment, fee, or funds transfer in order to receive money or unlock an account',
      evidenceHi: 'पैसे पाने या खाता चालू करने के लिए पहले भुगतान या फीस माँगी गई है'
    });
  }

  // 5. Refund fee scams
  const refundFeePattern = /\b(?:pay|deposit|transfer|send)\s+.*?\b(?:processing\s*fee|charge|fee|amount)\b.*?\b(?:refund|cashback)\b|\b(?:refund\s+(?:lene|pane)\s+ke\s+liye\s+(?:fee|charge|pay|paise))\b|\brefund\s+fee\b|रिफंड\s*(?:पाने|लेने)\s*के\s*लिए\s*(?:शुल्क|फीस|भुगतान)/i;

  if (refundFeePattern.test(textToMatch)) {
    signals.push({
      type: 'refund_fee_scam',
      severity: 'high',
      category: 'refund_scam',
      evidence: 'Demands a processing fee or charge to release an alleged refund',
      evidenceHi: 'रिफंड देने के बहाने प्रोसेसिंग फीस या चार्ज माँगा गया है'
    });
  }

  // 6. KYC / PAN / Aadhaar threats & phishing
  const kycPattern = /\b(?:kyc\s*(?:is\s+)?(?:update|verify|verification|expire|expired|suspend|suspended|deactivat|incomplete)|pan\s*(?:card\s*)?(?:link|update|blocked)|aadhaar\s*(?:link|update))\b.*\b(?:immediately|today|link|click|within|call|otherwise|nahi\s+to|turant|karo)\b|\b(?:update|verify)\s+your\s+kyc\b|\bkyc\s+(?:is\s+)?(?:expired?|suspended)\b.*\b(?:update|verify|link|click|now|http|call)\b|\bkyc\s+(?:karo|update|verify)\b|केवाईसी\s*(?:अपडेट|वेरिफाई|ब्लॉक|बंद)/i;

  if (kycPattern.test(textToMatch)) {
    signals.push({
      type: 'kyc_phishing',
      severity: 'high',
      category: 'kyc_phishing',
      evidence: 'Uses KYC / PAN suspension threats to pressure the recipient into urgent action or clicking links',
      evidenceHi: 'KYC / PAN बंद होने की धमकी देकर जल्दी कार्रवाई या लिंक पर क्लिक करने का दबाव बनाया गया है'
    });
  }

  // 7. Account suspension / block threats
  const accountThreatPattern = /\b(?:account|a\/c|upi|sim|electricity|power|bijli)\s*(?:will\s+be\s+|is\s+|has\s+been\s+)?(?:temporarily\s+|permanently\s+)?(?:blocked|suspended|deactivated|stopped|disconnected|terminated|freeze)\b|\b(?:account|khata|bijli|line|sim)\s*(?:band\s+ho\s+jayega|block\s+ho\s+jayega|kat\s+jayegi|rok\s+di\s+jayegi)\b|खाता\s*(?:बंद|ब्लॉक)|अकाउंट\s*(?:बंद|ब्लॉक)|बिजली\s*(?:कट|बंद)/i;

  if (accountThreatPattern.test(textToMatch)) {
    signals.push({
      type: 'account_threat',
      severity: 'high',
      category: 'account_block_scam',
      evidence: 'Threatens immediate block, suspension, or disconnection of bank account, UPI, or essential services',
      evidenceHi: 'बैंक खाता, UPI या ज़रूरी सेवा तुरंत बंद या ब्लॉक होने की धमकी दी गई है'
    });
  }

  // 7b. "Suspicious activity, verify your identity" phishing
  const suspiciousActivityPattern = /\b(?:suspicious|unusual|unauthorized|unauthorised)\s+(?:activity|login|sign[ -]?in|transaction|attempt)\b|\bverify\s+your\s+(?:identity|account)\b/i;

  if (suspiciousActivityPattern.test(textToMatch) && !isDefensive && !isLegitimateReceipt(rawText)) {
    signals.push({
      type: 'suspicious_activity_phish',
      severity: 'high',
      category: 'account_block_scam',
      evidence: 'Claims suspicious account activity and pushes identity verification - a common phishing pretext',
      evidenceHi: 'खाते में संदिग्ध गतिविधि का दावा करके पहचान सत्यापन कराया जा रहा है - फ़िशिंग का आम बहाना'
    });
  }

  // 8. Prize, lottery, and reward scams
  const prizeLotteryPattern = /\b(?:congratulations|congrats|lucky\s*draw|winner|won|win|awarded)\b.*\b(?:lottery|prizes?|reward|kbc|cash\s*prize|car|gift|jackpot|winnings?|vouchers?|draw)\b|\b(?:won|winner\s+of|win)\s+(?:rs\.?|inr|₹|£)?\s*[\d,]+\s*(?:rupees|lakh|crore|pounds?)?\b|\b(?:won|win)\b.*\b(?:\d+\s*(?:lakh|crore))\b|\b(?:lottery\s+lagi|inaam\s+jeeta)\b|\bprize\b[\s\S]{0,30}\b(?:mila|jeeta|claim)\b|लॉटरी\s*(?:जीत|मिली)|इनाम\s*(?:जीता|मिला)|लकी\s*ड्रा\s*विजेता/i;

  if (prizeLotteryPattern.test(textToMatch)) {
    signals.push({
      type: 'lottery_prize',
      severity: 'high',
      category: 'prize_lottery_scam',
      evidence: 'Unsolicited announcement of lottery, lucky draw, or major prize winnings',
      evidenceHi: 'बिना भाग लिए लॉटरी, लकी ड्रा या बड़े इनाम जीतने का दावा किया गया है'
    });
  }

  // 9. Cashback scams
  const cashbackPattern = /\b(?:cashback\s+(?:of\s+)?(?:rs\.?|inr|₹)?\s*[\d,]*\s*(?:credited|approved|ready|reward|pending|claim|received))\b.*\b(?:click|link|claim|receive|upi|expires?)\b|\b(?:received?\s+(?:rs\.?|inr|₹)\s*[\d,]+\s+cashback)\b.*\b(?:click|link|claim|expires?)\b|\b(?:cashback\s+(?:pane|lene|claim)\s+ke\s+liye)\b|कैशबैक\s*(?:मिला|क्लेम|प्राप्त)/i;

  if (cashbackPattern.test(textToMatch)) {
    signals.push({
      type: 'cashback_scam',
      severity: 'medium',
      category: 'cashback_scam',
      evidence: 'Promises incoming cashback requiring user action or link navigation',
      evidenceHi: 'कैशबैक मिलने का वादा करके क्लिक या लिंक खोलने को कहा गया है'
    });
  }

  // 10. QR code payment scams
  const qrPattern = /\b(?:scan\s+(?:this\s+)?qr(?:\s*code)?\s+(?:to\s+receive|to\s+get|for\s+receiving|paise\s+lene\s+ke\s+liye)|qr\s*(?:code\s*)?scan\s+karo\s+(?:paise|payment))\b|क्यूआर\s*कोड\s*स्कैन\s*कर(?:ें|ो)/i;

  if (qrPattern.test(textToMatch)) {
    signals.push({
      type: 'qr_payment_scam',
      severity: 'high',
      category: 'qr_payment_scam',
      evidence: 'Directs the user to scan a QR code to receive money (scanning a QR code or entering a PIN only sends money)',
      evidenceHi: 'पैसे पाने के लिए QR कोड स्कैन करने को कहा गया है (QR स्कैन या PIN डालने से पैसे जाते हैं, आते नहीं)'
    });
  }

  // 11. Remote-access software requests
  const remoteAccessPattern = /\b(?:anydesk|teamviewer|rustdesk|quicksupport|screen\s*share|airdroid|zoho\s*assist)\b/i;

  if (remoteAccessPattern.test(textToMatch)) {
    signals.push({
      type: 'remote_access',
      severity: 'high',
      category: 'credential_theft',
      evidence: 'Instructs the recipient to install remote access or screen-sharing tools',
      evidenceHi: 'रिमोट एक्सेस या स्क्रीन-शेयरिंग ऐप इंस्टॉल करने को कहा गया है'
    });
  }

  // 12. Fake customer support / callback mobile numbers
  const fakeSupportPattern = /\b(?:call|contact|helpline|support|customer\s*care|executive|officer|manager)\b.*\b(?:[6-9]\d{9}|\+91[\s-]?[6-9]\d{9})\b|\b(?:toll[ -]?free|helpline\s*no|customer\s*care)\s*[:#]?\s*(?:[6-9]\d{9})/i;

  if (fakeSupportPattern.test(textToMatch)) {
    signals.push({
      type: 'fake_support',
      severity: 'medium',
      category: 'fake_support',
      evidence: 'Provides an unofficial personal mobile number masquerading as official customer support or helpline',
      evidenceHi: 'अनौपचारिक मोबाइल नंबर को कस्टमर केयर या हेल्पलाइन बताया गया है'
    });
  }

  // 13. Shortened URLs (masked so the reply never echoes the full link)
  if (entities.shortenedUrls.length > 0) {
    const masked = entities.maskedShortenedUrls[0] || maskUrl(entities.shortenedUrls[0]);
    signals.push({
      type: 'shortened_url',
      severity: 'medium',
      category: 'malicious_link',
      evidence: `Contains a shortened URL (${masked}) which hides the real destination website`,
      evidenceHi: `संदेश में छोटा किया हुआ लिंक (${masked}) है जो असली वेबसाइट छिपाता है`
    });
  }

  // 14. Suspicious links (raw IP address or untrusted TLDs)
  const suspiciousIpOrTld = /\bhttps?:\/\/(?:\d{1,3}\.){3}\d{1,3}|\bhttps?:\/\/[a-zA-Z0-9.\-_]+\.(?:xyz|top|work|club|buzz|guru|live|download|tk|ml|ga|cf|gq|apk)\b/i;
  if (suspiciousIpOrTld.test(textToMatch)) {
    const badUrl = entities.urls.find(u => suspiciousIpOrTld.test(u)) || entities.urls[0] || '';
    signals.push({
      type: 'suspicious_link',
      severity: 'high',
      category: 'malicious_link',
      evidence: `Contains a link (${maskUrl(badUrl)}) pointing to an IP address or a high-risk domain`,
      evidenceHi: `संदेश में IP पते या जोखिम वाले डोमेन (${maskUrl(badUrl)}) का लिंक है`
    });
  }

  // 15. Lookalike bank / payment-brand domains
  const lookalike = findLookalikeDomain(entities.urls);
  if (lookalike) {
    signals.push({
      type: 'lookalike_domain',
      severity: 'high',
      category: 'malicious_link',
      evidence: `Link domain (${maskUrl('https://' + lookalike.host)}) imitates the "${lookalike.brand.toUpperCase()}" brand but is not its official website`,
      evidenceHi: `लिंक का डोमेन (${maskUrl('https://' + lookalike.host)}) "${lookalike.brand.toUpperCase()}" जैसा दिखता है, लेकिन आधिकारिक वेबसाइट नहीं है`
    });
  }

  // 16. Link coupled with refund / KYC / urgency pressure
  const hasAnyUrl = entities.urls.length > 0 || entities.shortenedUrls.length > 0;
  const linkPressurePattern = /\b(?:refund|kyc|cashback|verify|verification|update|blocked|suspended|claim|immediately|urgent|expire|within\s*(?:24|12|2|1)\s*hours?)\b|\b(?:refund|verify|update|block)\s+(?:karo|karein|kar\s*lo)\b|रिफंड|केवाईसी|अपडेट\s*करें|ब्लॉक|तुरंत/i;
  if (hasAnyUrl && linkPressurePattern.test(textToMatch)) {
    const masked = entities.maskedUrls[0] || entities.maskedShortenedUrls[0] || '***';
    signals.push({
      type: 'link_with_pressure',
      severity: 'high',
      category: 'malicious_link',
      evidence: `Couples a link (${masked}) with a refund, KYC, or urgent-verification demand - a classic phishing combination`,
      evidenceHi: `लिंक (${masked}) के साथ रिफंड, KYC या तुरंत सत्यापन का दबाव दिया गया है - फ़िशिंग का आम तरीका`
    });
  }

  // 17. Pay / enter PIN to receive money trick (explicit wording)
  const pinToReceivePattern = /\b(?:enter|type|dalo|डालो|दर्ज)\s+(?:your\s+|apna\s+|अपना\s+)?(?:upi\s*pin|mpin|pin|पिन)\s+(?:to|taaki|ke\s*liye)\s+(?:receive|claim|get|collect|credit)\b|\bpin\s+(?:dalo|daalo|enter\s+karo)\s+(?:paise|money)\s+(?:pane|receive|lene)\s+ke\s+liye\b/i;
  if (pinToReceivePattern.test(textToMatch) && !isDefensive) {
    signals.push({
      type: 'pin_to_receive',
      severity: 'high',
      category: 'upi_payment_scam',
      evidence: 'Says to enter a UPI PIN to receive money - a PIN is only ever needed to SEND money',
      evidenceHi: 'पैसे पाने के लिए UPI PIN डालने को कहा गया है - PIN सिर्फ पैसे भेजने के लिए चाहिए होता है'
    });
  }

  // 18. Fake government / Tax refund / E-challan scams
  const govtScamPattern = /\b(?:income\s*tax\s*refund|tax\s*refund|e-?challan\s*pending|parivahan\s*challan|pm\s*yojana|modi\s*yojana)\b.*\b(?:claim|pay|click|link|rs\.?|inr|₹|immediately)\b/i;

  if (govtScamPattern.test(textToMatch)) {
    signals.push({
      type: 'tax_refund_scam',
      severity: 'high',
      category: 'tax_refund_scam',
      evidence: 'Impersonates government tax authorities, traffic e-challan systems, or subsidy schemes',
      evidenceHi: 'सरकारी टैक्स विभाग, ई-चालान या सब्सिडी योजना का नाम देकर धोखा दिया गया है'
    });
  }

  // 19. Courier / Delivery failure scams
  const deliveryScamPattern = /\b(?:package|parcel|courier|shipment|india\s*post|delivery)\b.*\b(?:cannot\s+be\s+delivered|address\s+(?:incomplete|missing|wrong)|pending\s+fee|update\s+address|held\s+at\s+customs)\b.*\b(?:link|click|update|http|bit\.ly)/i;

  if (deliveryScamPattern.test(textToMatch)) {
    signals.push({
      type: 'delivery_scam',
      severity: 'high',
      category: 'delivery_scam',
      evidence: 'Claims postal package delivery failure to induce clicking an address-update phishing link',
      evidenceHi: 'पार्सल डिलीवरी न होने का दावा करके पता अपडेट करने के लिंक पर क्लिक कराया जा रहा है'
    });
  }

  // 20. Job / Work-from-home / Registration fee scams
  const jobScamPattern = /\b(?:part[ -]?time\s*job|work\s*from\s*home|daily\s*(?:earning|income)|like\s+and\s+subscribe|youtube\s*task|earn\s*(?:rs\.?|inr|₹)\s*\d{3,5}\s*(?:daily|per\s*day))\b.*\b(?:telegram|whatsapp|fee|register|deposit|task)\b/i;

  if (jobScamPattern.test(textToMatch)) {
    signals.push({
      type: 'job_fee_scam',
      severity: 'high',
      category: 'job_fee_scam',
      evidence: 'Promises unrealistic daily work-from-home earnings or demands job registration fees',
      evidenceHi: 'घर बैठे रोज़ कमाई का अवास्तविक वादा या नौकरी के लिए रजिस्ट्रेशन फीस माँगी गई है'
    });
  }

  // 21. Investment & crypto scams
  const investmentScamPattern = /\b(?:guaranteed\s*returns?|double\s*your\s*money|crypto\s*trading\s*bot|100%\s*(?:profit|guarantee)|trading\s*signal|invest\s+(?:rs\.?|inr|₹)\s*[\d,]+\s*(?:earn|get))\b/i;

  if (investmentScamPattern.test(textToMatch)) {
    signals.push({
      type: 'investment_scam',
      severity: 'high',
      category: 'investment_scam',
      evidence: 'Promotes fraudulent high-return investment schemes or cryptocurrency guarantees',
      evidenceHi: 'गारंटीड रिटर्न या क्रिप्टो निवेश के धोखाधड़ी वाले वादे किए गए हैं'
    });
  }

  // 22. Urgency & Pressure Tactics
  const urgencyPattern = /\b(?:immediately|urgent|urgently|within\s*(?:24|12|2|1)\s*hours?|before\s*(?:midnight|today)|turant|abhi|jaldi|turant\s*payment|abhi\s*verify)\b|तुरंत|जल्दी|24\s*घंटे/i;

  if (urgencyPattern.test(textToMatch)) {
    signals.push({
      type: 'urgency_pressure',
      severity: 'low',
      category: 'unknown_suspicious',
      evidence: 'Applies psychological urgency or strict deadline pressure to rush user decisions',
      evidenceHi: 'जल्दी फैसला करवाने के लिए तुरंत कार्रवाई का मनोवैज्ञानिक दबाव बनाया गया है'
    });
  }

  // 23. Institutional Impersonation
  const impersonationPattern = /\b(?:dear\s+customer|valued\s+customer)\b.*\b(?:sbi|hdfc|icici|axis|pnb|paytm|phonepe|gpay|google\s*pay|cbi|police|rbi|trai)\b|\b(?:police|customs\s*officer|cbi\s*department)\b/i;

  if (impersonationPattern.test(textToMatch)) {
    signals.push({
      type: 'impersonation',
      severity: 'low',
      category: 'impersonation',
      evidence: 'Impersonates banks, payment providers, law enforcement, or regulatory institutions',
      evidenceHi: 'बैंक, पेमेंट कंपनी, पुलिस या नियामक संस्था का नाम देकर पहचान का दुरुपयोग किया गया है'
    });
  }

  // 24. Family / Relative emergency impersonation scam
  const familyEmergencyPattern = /\b(?:beta|dad|mom|papa|mummy|son|daughter|bhai|sister|friend)\b[\s\S]{0,90}?\b(?:urgently|urgent|hospital|emergency|medical|accident|broken\s*phone|crisis|ill)\b[\s\S]{0,90}?\b(?:send|transfer|pay|upi|friend99|vpa)\b/i;

  if (familyEmergencyPattern.test(textToMatch)) {
    signals.push({
      type: 'family_impersonation',
      severity: 'high',
      category: 'impersonation',
      evidence: 'Impersonates a family member or friend claiming an urgent emergency or medical crisis to request money',
      evidenceHi: 'परिवार के सदस्य या रिश्तेदार बनकर अस्पताल या आपात स्थिति का झांसा देकर पैसे माँगे गए हैं'
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
