// Small logistic-regression text model trained on the public Indian scam/ham SMS dataset.
// Trained offline by eval/train-india-model.py; this file only scores. It is one signal next to the rules, not a verdict.
import model from '../model/india-lr.json' with { type: 'json' };

function words(text) {
  let t = String(text || '').toLowerCase();
  t = t.replace(/https?:\/\/\S+|www\.\S+|\b[a-z0-9-]+\.(?:in|com|co|me|ly|net|org)\/\S*/g, ' urltok ');
  t = t.replace(/\d+/g, '0');
  return t.match(/[a-z0-9_]+/g) || [];
}

export function mlScore(text) {
  const w = words(text);
  const grams = w.concat(w.slice(1).map((b, i) => w[i] + ' ' + b));
  const counts = new Map();
  for (const g of grams) if (Object.prototype.hasOwnProperty.call(model.features, g)) counts.set(g, (counts.get(g) || 0) + 1);
  let norm = 0;
  for (const [g, c] of counts) { const x = c * model.features[g][0]; norm += x * x; }
  norm = Math.sqrt(norm);
  let z = model.intercept;
  if (norm > 0) for (const [g, c] of counts) z += (c * model.features[g][0] / norm) * model.features[g][1];
  return 1 / (1 + Math.exp(-z));
}

export const ML_THRESHOLD = model.threshold;
export const mlFlag = (text) => mlScore(text) >= ML_THRESHOLD;
