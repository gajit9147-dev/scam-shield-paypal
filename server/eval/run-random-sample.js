// Untuned check: 200 random messages (100 spam, 100 ham) from a public Indian dataset, none used for tuning. Rules only, no AI.
// The source label is "spam", which includes ordinary marketing, so a payment-scam checker is not expected to flag all of it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify } from '../src/classify.js';
import { paymentRedFlags } from '../src/paymentReview.js';
const cases = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), process.env.SAMPLE || 'random-public-sample.json'), 'utf8'));
let tp = 0, fp = 0, tn = 0, fn = 0; const fps = [];
for (const c of cases) {
  const v = classify(c.text);
  const flagged = v.riskLevel === 'HIGH_RISK' || v.riskLevel === 'SUSPICIOUS' || paymentRedFlags(c.text).length > 0;
  if (c.expect === 'scam') flagged ? tp++ : fn++; else if (flagged) { fp++; fps.push(c.id); } else tn++;
}
console.log(JSON.stringify({ total: cases.length, tp, fn, fp, tn, precision: +(tp / (tp + fp)).toFixed(3), recall: +(tp / (tp + fn)).toFixed(3), falsePositiveIds: fps }));
