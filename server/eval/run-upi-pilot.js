// UPI pilot evaluation: runs the frozen synthetic dataset through the real
// classify() pipeline (local rules + UCI baseline, Gemini off) and reports
// TP/FP/TN/FN, precision, recall, coverage and false-positive examples.
//
// This is a SMALL SYNTHETIC PILOT. The cases are hand-written to look like
// common Indian UPI scam and benign messages. They are regression and demo
// material, NOT validated real-world UPI accuracy.
//
// Usage: node eval/run-upi-pilot.js [--json]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify } from '../src/classify.js';

const here = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(here, 'upi-pilot-dataset.json'), 'utf8'));

const rows = cases.map(c => {
  const result = classify(c.text);
  const flagged = result.label === 'scam' || result.label === 'suspicious';
  const positive = c.expect === 'scam';
  return {
    id: c.id,
    language: c.language,
    category: c.category,
    expect: c.expect,
    label: result.label,
    riskLevel: result.riskLevel,
    predictedCategory: result.category,
    flagged,
    correct: flagged === positive,
    outcome: positive ? (flagged ? 'TP' : 'FN') : (flagged ? 'FP' : 'TN')
  };
});

const count = name => rows.filter(r => r.outcome === name).length;
const tp = count('TP'), fp = count('FP'), tn = count('TN'), fn = count('FN');
const precision = tp + fp === 0 ? null : tp / (tp + fp);
const recall = tp + fn === 0 ? null : tp / (tp + fn);
const scamRows = rows.filter(r => r.expect === 'scam');
const highRiskRecall = scamRows.length === 0 ? null : scamRows.filter(r => r.riskLevel === 'HIGH_RISK').length / scamRows.length;
const uncertainCoverage = rows.filter(r => r.riskLevel === 'UNCERTAIN').length / rows.length;
const accuracy = (tp + tn) / rows.length;

const pct = value => value === null ? 'n/a' : `${(value * 100).toFixed(2)}%`;

const report = {
  datasetSize: rows.length,
  positives: scamRows.length,
  negatives: rows.length - scamRows.length,
  confusion: { tp, fp, tn, fn },
  precision: pct(precision),
  recall: pct(recall),
  highRiskRecall: pct(highRiskRecall),
  accuracy: pct(accuracy),
  uncertainCoverage: pct(uncertainCoverage),
  falsePositives: rows.filter(r => r.outcome === 'FP').map(r => ({ id: r.id, text: cases.find(c => c.id === r.id).text, riskLevel: r.riskLevel, category: r.predictedCategory })),
  falseNegatives: rows.filter(r => r.outcome === 'FN').map(r => ({ id: r.id, text: cases.find(c => c.id === r.id).text, category: r.category }))
};

console.log('UPI pilot evaluation (synthetic, Gemini off)');
console.log(`cases: ${rows.length} (${scamRows.length} scam, ${rows.length - scamRows.length} benign)`);
console.log(`TP ${tp}  FP ${fp}  TN ${tn}  FN ${fn}`);
console.log(`precision: ${pct(precision)}   recall: ${pct(recall)}   accuracy: ${pct(accuracy)}`);
console.log(`HIGH_RISK recall on scam cases: ${pct(highRiskRecall)}`);
console.log(`uncertain coverage (share of all cases abstained): ${pct(uncertainCoverage)}`);
if (report.falsePositives.length) {
  console.log('\nFalse positives (benign cases wrongly flagged):');
  for (const f of report.falsePositives) console.log(`  - ${f.id} [${f.riskLevel}/${f.category}]: ${f.text}`);
} else {
  console.log('\nFalse positives: none');
}
if (report.falseNegatives.length) {
  console.log('\nFalse negatives (scam cases missed):');
  for (const f of report.falseNegatives) console.log(`  - ${f.id} [${f.category}]: ${f.text}`);
} else {
  console.log('False negatives: none');
}

writeFileSync(join(here, 'upi-pilot-results.json'), JSON.stringify({ ...report, rows }, null, 2));
console.log('\nWrote eval/upi-pilot-results.json');
