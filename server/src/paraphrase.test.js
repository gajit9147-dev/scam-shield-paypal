import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classify } from './classify.js';
import { paymentRedFlags } from './paymentReview.js';

const cases = JSON.parse(readFileSync(new URL('../eval/paraphrase-set.json', import.meta.url), 'utf8'));
const flagged = (t) => { const v = classify(t); return v.riskLevel === 'HIGH_RISK' || v.riskLevel === 'SUSPICIOUS' || paymentRedFlags(t).length > 0; };

test('the local rules alone flag every scam in the paraphrase set and none of the safe ones', () => {
  for (const c of cases) assert.equal(flagged(c.text), c.expect === 'scam', `${c.id}: ${c.text}`);
});
