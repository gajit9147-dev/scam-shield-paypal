// Public-source evaluation: runs downloaded, publicly available Indian scam/spam
// datasets through the real classify() pipeline and reports metrics SEPARATELY
// from the hand-written synthetic pilot.
//
// Sources (both public, Hugging Face, keyword-labeled by their authors):
//   - anmolshrivastav/scam-hum-india (2,272 rows, ham/spam)
//   - bolewara/hinglish-scam-text-dataset (3,787 rows, 0/1)
// Cases were sampled with a strict fraud-pattern filter, deduped, frozen into
// eval/public-upi-dataset.json, and hand-reviewed for source-label noise
// (defensive "never share OTP" texts mislabeled as scam were removed).
//
// Usage: node eval/run-public-eval.js

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify } from '../src/classify.js';

const here = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(here, 'public-upi-dataset.json'), 'utf8'));

const rows = cases.map(c => {
  const result = classify(c.text);
  const flagged = result.label === 'scam' || result.label === 'suspicious';
  const positive = c.expect === 'scam';
  return {
    id: c.id, source: c.source, expect: c.expect, label: result.label,
    riskLevel: result.riskLevel, predictedCategory: result.category,
    outcome: positive ? (flagged ? 'TP' : 'FN') : (flagged ? 'FP' : 'TN')
  };
});

const count = name => rows.filter(r => r.outcome === name).length;
const tp = count('TP'), fp = count('FP'), tn = count('TN'), fn = count('FN');
const pct = v => v === null ? 'n/a' : `${(v * 100).toFixed(2)}%`;
const precision = tp + fp === 0 ? null : tp / (tp + fp);
const recall = tp + fn === 0 ? null : tp / (tp + fn);

const report = {
  datasetSize: rows.length,
  positives: rows.filter(r => r.expect === 'scam').length,
  negatives: rows.filter(r => r.expect === 'uncertain').length,
  confusion: { tp, fp, tn, fn },
  precision: pct(precision),
  recall: pct(recall),
  accuracy: pct((tp + tn) / rows.length),
  falsePositives: rows.filter(r => r.outcome === 'FP').map(r => r.id),
  falseNegatives: rows.filter(r => r.outcome === 'FN').map(r => r.id)
};

console.log('Public-source evaluation (downloaded Indian scam datasets, Gemini off)');
console.log(`cases: ${rows.length} (${report.positives} scam, ${report.negatives} benign)`);
console.log(`TP ${tp}  FP ${fp}  TN ${tn}  FN ${fn}`);
console.log(`precision: ${pct(precision)}   recall: ${pct(recall)}   accuracy: ${pct((tp + tn) / rows.length)}`);
console.log('\nFalse positives:');
for (const r of rows.filter(r => r.outcome === 'FP')) {
  console.log(`  - ${r.id} [${r.riskLevel}/${r.predictedCategory}]: ${cases.find(c => c.id === r.id).text.slice(0, 110)}`);
}
console.log('\nFalse negatives:');
for (const r of rows.filter(r => r.outcome === 'FN')) {
  console.log(`  - ${r.id}: ${cases.find(c => c.id === r.id).text.slice(0, 110)}`);
}
writeFileSync(join(here, 'public-eval-results.json'), JSON.stringify({ ...report, rows }, null, 2));
console.log('\nWrote eval/public-eval-results.json');
