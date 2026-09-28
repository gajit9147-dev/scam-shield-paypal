import model from '../model/uci-spam-nb.json' with { type: 'json' };

// A fixed, train-only UCI ham/spam baseline. This probability is NOT a
// calibrated probability that a payment message is a scam.
export function spamScore(text) {
  const words = (text.toLowerCase().match(/[a-z0-9]+/g) || []).map(word => /[0-9]/.test(word) ? 'num' : word);
  // Keep exactly the same feature selection as scikit-learn's CountVectorizer: binary document frequency >= 2.
  // All exported features already passed that threshold.
  const tokens = words.concat(words.slice(1).map((word, i) => `${words[i]} ${word}`));
  const counts = new Map();
  for (const token of tokens) if (model.features[token]) counts.set(token, (counts.get(token) || 0) + 1);
  const scores = [...model.classLogPrior];
  for (const [token, count] of counts) {
    scores[0] += count * model.features[token][0];
    scores[1] += count * model.features[token][1];
  }
  const difference = scores[0] - scores[1];
  return difference > 700 ? 0 : difference < -700 ? 1 : 1 / (1 + Math.exp(difference));
}

const request = /\b(?:send|share|reply|provide|enter|submit|tell|give|type|forward)\b/i;
const secret = /\b(?:otp|one[ -]?time (?:password|code)|upi pin|mpin|cvv|password)\b/i;
const money = /\b(?:pay|transfer|send|deposit|fee|charge)\b/i;
const pressure = /\b(?:to (?:receive|release|claim|unlock)|before (?:you|we) (?:release|credit)|(?:payment|refund|prize|cashback) (?:is|will be) (?:released|credited)|(?:account|upi) (?:will be|is) (?:blocked|suspended))\b/i;
const destination = /\b(?:link|https?:\/\/|bit\.ly|tinyurl|qr|scan|account|upi id|vpa)\b/i;
const verifyAction = 'Do not share OTPs or PINs, open message links, or pay to receive money. Check the official bank or payment app independently.';

export function classify(text) {
  // Look for an actual request, not merely a warning mentioning secrets.
  const evidence = [];
  if (request.test(text) && secret.test(text) && !/\b(?:never|do not|don'?t)\s+(?:send|share|reply|provide|enter|submit|tell|give|type|forward)\b/i.test(text)) {
    evidence.push('Message asks for a sensitive code or credential');
  }
  if (money.test(text) && pressure.test(text) && destination.test(text)) {
    evidence.push('Message links a payment demand to a promised credit or account threat');
  }
  const score = spamScore(text);
  const highSpam = score >= model.spamThreshold;
  if (evidence.length) {
    return {
      label: 'scam', reason: 'High-risk request pattern found in the text. This is a warning, not proof about the sender or payment.',
      confidence: null, evidence, safeAction: verifyAction,
      method: 'payment warning rules + UCI general-spam baseline',
      generalSpamSignal: highSpam ? 'flagged' : 'not flagged'
    };
  }
  return {
    label: 'uncertain',
    reason: highSpam ? 'The English general-spam model flagged this text, but spam does not establish a UPI scam.' : 'No strong fraud request pattern was found. Text alone cannot establish that a payment message is safe.',
    confidence: null, evidence: highSpam ? ['English general-spam signal'] : [],
    safeAction: verifyAction,
    method: 'payment warning rules + UCI general-spam baseline',
    generalSpamSignal: highSpam ? 'flagged' : 'not flagged'
  };
}
