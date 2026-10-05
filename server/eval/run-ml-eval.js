// Compares rules only, ML only, and rules+ML on a message set. Default: the held-out split of the Indian dataset (never used for training).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify } from '../src/classify.js';
import { paymentRedFlags } from '../src/paymentReview.js';
import { mlFlag } from '../src/mlscore.js';
const cases = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), process.env.SET || 'india-heldout-split.json'), 'utf8'));
const mk = () => ({ tp: 0, fn: 0, fp: 0, tn: 0 });
const m = { rules: mk(), ml: mk(), both: mk() };
const put = (s, scam, f) => { if (scam) f ? s.tp++ : s.fn++; else f ? s.fp++ : s.tn++; };
for (const c of cases) {
  const v = classify(c.text);
  const r = v.riskLevel === 'HIGH_RISK' || v.riskLevel === 'SUSPICIOUS' || paymentRedFlags(c.text).length > 0;
  const l = mlFlag(c.text), scam = c.expect === 'scam';
  put(m.rules, scam, r); put(m.ml, scam, l); put(m.both, scam, r || l);
}
for (const k in m) { const s = m[k]; s.precision = +(s.tp / (s.tp + s.fp || 1)).toFixed(3); s.recall = +(s.tp / (s.tp + s.fn || 1)).toFixed(3); }
console.log(cases.length, 'messages'); console.log(JSON.stringify(m));
