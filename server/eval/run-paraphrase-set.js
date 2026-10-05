// Runs the paraphrase set through the local rules only (no AI, no network) and prints misses and false alarms.
// This set was written separately from the rule list. Usage: node eval/run-paraphrase-set.js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify } from '../src/classify.js';
import { paymentRedFlags } from '../src/paymentReview.js';

const cases = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'paraphrase-set.json'), 'utf8'));
const rows = cases.map((c) => {
  const v = classify(c.text);
  const flagged = v.riskLevel === 'HIGH_RISK' || v.riskLevel === 'SUSPICIOUS' || (paymentRedFlags(c.text) || []).length > 0;
  return { id: c.id, expect: c.expect, flagged, risk: v.riskLevel };
});
const misses = rows.filter((r) => r.expect === 'scam' && !r.flagged);
const falseAlarms = rows.filter((r) => r.expect === 'safe' && r.flagged);
console.log(JSON.stringify({ total: rows.length, scams: rows.filter((r) => r.expect === 'scam').length, safe: rows.filter((r) => r.expect === 'safe').length, misses: misses.map((r) => r.id), falseAlarms: falseAlarms.map((r) => `${r.id} ${r.risk}`) }));
