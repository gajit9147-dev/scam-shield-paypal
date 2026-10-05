// Rules-only calibration check: for each verdict level, how many messages in every labelled set were really scams.
// "Scam" is the set author's label. Sets differ in difficulty, so the table is a rough guide, not a probability.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify } from '../src/classify.js';
import { paymentRedFlags } from '../src/paymentReview.js';
const here = dirname(fileURLToPath(import.meta.url));
const files = ['public-upi-dataset.json', 'heldout-set.json', 'paraphrase-set.json', 'random-public-sample.json', 'random-public-sample-2.json'];
const bins = {};
for (const f of files) {
  for (const c of JSON.parse(readFileSync(join(here, f), 'utf8'))) {
    const v = classify(c.text);
    const level = v.riskLevel === 'HIGH_RISK' ? 'HIGH_RISK' : v.riskLevel === 'SUSPICIOUS' ? 'SUSPICIOUS' : paymentRedFlags(c.text).length ? 'PAYMENT_RED_FLAG' : 'NOT_FLAGGED';
    bins[level] ||= { total: 0, scam: 0 };
    bins[level].total++;
    if (c.expect === 'scam') bins[level].scam++;
  }
}
console.log(JSON.stringify(bins));
