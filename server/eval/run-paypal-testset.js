// Runs the small labeled PayPal test set against a running server and reports
// false blocks, misses and latency. Usage: node eval/run-paypal-testset.js http://localhost:8787 [out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || 'http://localhost:8787';
const out = process.argv[3];
const cases = JSON.parse(readFileSync(join(here, 'paypal-testset.json'), 'utf8'));
const gap = Number(process.env.GAP_MS || 0);

const rows = [];
for (const c of cases) {
  const t0 = Date.now();
  const res = await fetch(`${base}/api/payments/review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: c.text }) });
  const data = await res.json();
  const ms = Date.now() - t0;
  const r = data.review || {};
  rows.push({ id: c.id, tag: c.tag, expect: c.expect, canPay: Boolean(r.canPay), blocked: Boolean(r.blocked), risk: data.verdict?.riskLevel, aiUsed: Boolean(r.aiUsed), problem: r.checkoutProblem || null, ms });
  if (gap) await new Promise((ok) => setTimeout(ok, gap));
}
const ok = (r) => (r.expect === 'block' ? !r.canPay : r.canPay);
const misses = rows.filter((r) => r.expect === 'block' && r.canPay);
const falseBlocks = rows.filter((r) => r.expect === 'allow' && !r.canPay);
const lat = rows.map((r) => r.ms).sort((a, b) => a - b);
const summary = {
  total: rows.length, correct: rows.filter(ok).length,
  scams: rows.filter((r) => r.expect === 'block').length, safe: rows.filter((r) => r.expect === 'allow').length,
  misses: misses.map((r) => `${r.id} ${r.tag}`), falseBlocks: falseBlocks.map((r) => `${r.id} ${r.tag} (${r.risk}${r.problem ? ', ' + r.problem : ''})`),
  aiUsedCount: rows.filter((r) => r.aiUsed).length,
  latencyMs: { median: lat[Math.floor(lat.length / 2)], p95: lat[Math.floor(lat.length * 0.95)], max: lat[lat.length - 1] }
};
console.log(JSON.stringify(summary, null, 1));
if (out) writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
