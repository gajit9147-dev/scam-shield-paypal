// Sends the paraphrase set to a running server (rules + AI) and reports misses and false blocks.
// Usage: GAP_MS=4000 node eval/run-paraphrase-live.js https://scam-shield-paypal.onrender.com
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const base = process.argv[2] || 'http://localhost:8787';
const gap = Number(process.env.GAP_MS || 0);
const cases = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'paraphrase-set.json'), 'utf8'));
const rows = [];
for (const c of cases) {
  const res = await fetch(`${base}/api/payments/review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: c.text }) });
  const d = await res.json();
  const r = d.review || {};
  rows.push({ id: c.id, expect: c.expect, canPay: Boolean(r.canPay), blocked: Boolean(r.blocked), aiUsed: Boolean(r.aiUsed), status: res.status });
  if (gap) await new Promise((ok) => setTimeout(ok, gap));
}
const misses = rows.filter((r) => r.expect === 'scam' && r.canPay);
const falseBlocks = rows.filter((r) => r.expect === 'safe' && !r.canPay);
console.log(JSON.stringify({ total: rows.length, aiAnswered: rows.filter((r) => r.aiUsed).length, scamsBlocked: rows.filter((r) => r.expect === 'scam' && !r.canPay).length, scams: rows.filter((r) => r.expect === 'scam').length, safeCleared: rows.filter((r) => r.expect === 'safe' && r.canPay).length, safe: rows.filter((r) => r.expect === 'safe').length, misses: misses.map((r) => r.id), falseBlocks: falseBlocks.map((r) => r.id), httpErrors: rows.filter((r) => r.status !== 200).length }));
