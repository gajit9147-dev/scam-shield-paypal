import model from '../model/uci-spam-nb.json' with { type: 'json' };
import { detectLocalSignals } from './rules.js';
import { combineEvidence } from './fusion.js';

// A fixed, train-only UCI ham/spam baseline. This probability is NOT a
// calibrated probability that a payment message is a scam.
export function spamScore(text) {
  if (typeof text !== 'string' || !text.trim()) return 0;
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

export function classify(text) {
  const localResult = detectLocalSignals(text);
  const score = spamScore(text);
  const isSpamFlagged = score >= model.spamThreshold;

  return combineEvidence({
    rawText: text,
    localResult,
    geminiResult: null,
    spamScore: score,
    isSpamFlagged,
    isImage: false
  });
}
