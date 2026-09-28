// Normalization and entity extraction for Indian payment SMS/chat messages.
// Handles English, Hindi (Devanagari), and Hinglish transliterations.

// Common scam wording variations and common spelling mistakes
const SPELLING_REPLACEMENTS = [
  [/\b(?:froud|fruad|fraaud|frod|scamm|scame|skam|scem)\b/gi, 'scam'],
  [/\b(?:acount|accnt|acnt|acc)\b/gi, 'account'],
  [/\b(?:a\/c|a\\c)\b/gi, 'account'],
  [/\b(?:verfy|varify|verifaction|verifcation)\b/gi, 'verify'],
  [/\b(?:clik|clck|clikk)\b/gi, 'click'],
  [/\b(?:urgnt|urgntly)\b/gi, 'urgent'],
  [/\b(?:passwrd|pwd|pswd)\b/gi, 'password'],
  [/\b(?:upipin|upi-pin)\b/gi, 'upi pin'],
  [/\b(?:mpin|m-pin)\b/gi, 'mpin'],
  [/\b(?:mobilenumber|mobileno|phno|ph-no)\b/gi, 'mobile number'],
  [/\b(?:custmer|custmr|costomer)\b/gi, 'customer'],
  [/\b(?:helplne|help-line)\b/gi, 'helpline'],
  [/\b(?:blockd|bloked)\b/gi, 'blocked'],
  [/\b(?:suspnd|suspnded)\b/gi, 'suspended'],
  [/\b(?:deactivat|deactivatd)\b/gi, 'deactivated'],
  [/\b(?:immediatly|immediatley|imediatly)\b/gi, 'immediately'],
  [/\b(?:gpay|g-pay|googlepay)\b/gi, 'google pay'],
  [/\b(?:phonepe|phone-pe)\b/gi, 'phonepe'],
  [/\b(?:paytm|pay-tm)\b/gi, 'paytm']
];

// Devanagari to normalized phonetic token equivalents for common keywords
const HINDI_MAP = [
  [/ओटीपी|वन\s*टाइम\s*पासवर्ड/gu, 'otp'],
  [/यूपीआई\s*पिन|पिन/gu, 'pin'],
  [/पासवर्ड/gu, 'password'],
  [/सीवीवी/gu, 'cvv'],
  [/अकाउंट|खाता/gu, 'account'],
  [/ब्लॉक|बंद/gu, 'blocked'],
  [/सस्पेंड/gu, 'suspended'],
  [/केवाईसी/gu, 'kyc'],
  [/पैन\s*कार्ड/gu, 'pan card'],
  [/आधार/gu, 'aadhaar'],
  [/भेजो|भेजें|बताओ|बताएं|दर्ज\s*करें|दीजिये|दीजिए|डालो|डालें/gu, 'send'],
  [/तुरंत|जल्द|जल्दी/gu, 'immediately'],
  [/पैसे|रुपये|रुपए|रकम/gu, 'money'],
  [/रिफंड/gu, 'refund'],
  [/कैशबैक/gu, 'cashback'],
  [/लॉटरी|इनाम|पुरस्कार/gu, 'lottery prize'],
  [/लिंक/gu, 'link'],
  [/स्कैन/gu, 'scan'],
  [/कॉल|संपर्क/gu, 'call contact'],
  [/हेल्पलाइन|कस्टमर\s*केयर/gu, 'customer care helpline']
];


// Mask identifiers before they appear in any output, so a reply never
// echoes a full scam link, phone number or UPI ID back to the user.
export function maskDomain(host) {
  if (!host) return '';
  const labels = host.split('.');
  if (labels.length < 2) return host.slice(0, 2) + '***';
  const tld = labels[labels.length - 1];
  const name = labels[labels.length - 2];
  return `${name.slice(0, 2)}***.${tld}`;
}

export function maskUrl(url) {
  const match = String(url).match(/^(https?:\/\/)?([^/\s]+)([^\s]*)$/i);
  if (!match) return '***';
  const [, scheme = '', host = '', rest = ''] = match;
  const maskedHost = host.split(':').map((part, i) => i === 0 && /[a-zA-Z]/.test(part) ? maskDomain(part) : part.replace(/\d/g, '*')).join(':');
  return `${scheme}${maskedHost}${rest ? '/...' : ''}`;
}

export function maskUpiId(upiId) {
  const [name = '', handle = ''] = String(upiId).split('@');
  if (!handle) return name.slice(0, 2) + '***';
  return `${name.slice(0, 2)}***@${handle}`;
}

export function extractHost(url) {
  const match = String(url).match(/^https?:\/\/([^/\s]+)/i);
  return match ? match[1].toLowerCase() : '';
}

export function normalizeMessage(text) {
  if (typeof text !== 'string') return '';

  // 1. Unicode NFKC normalization
  let normalized = text.normalize('NFKC');

  // 2. Normalize whitespace (collapse multiple spaces, tabs, newlines)
  normalized = normalized.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // 3. Lowercase
  let lower = normalized.toLowerCase();

  // 4. Standardize spelling mistakes
  for (const [pattern, replacement] of SPELLING_REPLACEMENTS) {
    lower = lower.replace(pattern, replacement);
  }

  // 5. Expand Devanagari keywords for uniform rule matching
  let devanagariExpanded = lower;
  for (const [pattern, token] of HINDI_MAP) {
    devanagariExpanded = devanagariExpanded.replace(pattern, ` ${token} `);
  }
  devanagariExpanded = devanagariExpanded.replace(/\s{2,}/g, ' ').trim();

  return {
    raw: text,
    normalized: lower,
    expanded: devanagariExpanded
  };
}

export function extractEntities(text) {
  const urls = [];
  const shortenedUrls = [];
  const phoneNumbers = [];
  const upiIds = [];
  const amounts = [];

  // Shortened URL patterns
  const shortenerRegex = /\b(?:https?:\/\/)?(?:bit\.ly|tinyurl\.com|t\.co|is\.gd|buff\.ly|cutt\.ly|rb\.gy|shorturl\.at|ow\.ly|goo\.gl|tiny\.cc)\/[a-zA-Z0-9_-]+/gi;
  let match;
  while ((match = shortenerRegex.exec(text)) !== null) {
    shortenedUrls.push(match[0]);
  }

  // General URL patterns including IP-based URLs
  const urlRegex = /\b(?:https?:\/\/)(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?|\bhttps?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/[^\s]*)?/gi;
  while ((match = urlRegex.exec(text)) !== null) {
    urls.push(match[0]);
  }

  // Indian phone numbers: 10 digits starting with 6-9, or with +91 / 091 prefix
  const phoneRegex = /(?:\+91[\s-]?)?[6-9]\d{9}\b/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    phoneNumbers.push(match[0]);
  }

  // UPI IDs / VPAs
  const upiRegex = /[a-zA-Z0-9.\-_]{2,49}@[a-zA-Z]{2,}/g;
  while ((match = upiRegex.exec(text)) !== null) {
    upiIds.push(match[0]);
  }

  // Monetary amounts (Rs., INR, ₹)
  const amountRegex = /(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d{1,2})?/gi;
  while ((match = amountRegex.exec(text)) !== null) {
    amounts.push(match[0]);
  }

  return {
    urls,
    shortenedUrls,
    phoneNumbers,
    upiIds,
    amounts,
    maskedUrls: urls.map(maskUrl),
    maskedShortenedUrls: shortenedUrls.map(maskUrl),
    maskedUpiIds: upiIds.map(maskUpiId)
  };
}
