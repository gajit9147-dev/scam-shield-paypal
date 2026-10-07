// Ablation on the 30-case paraphrase set: rules only vs Gemini only vs fusion.
// rules only  = detectLocalSignals + combineEvidence with no Gemini result (offline, deterministic)
// Gemini only = the live /api/check response has a Gemini signal with severity "high"
// fusion      = the live /api/check verdict (label scam or suspicious)
// Needs a running server with a Gemini key. Usage: GAP_MS=3000 node eval/run-ablation.js https://scam-shield-paypal.onrender.com
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { detectLocalSignals } from '../src/rules.js';
import { combineEvidence } from '../src/fusion.js';
import { spamScore } from '../src/classify.js';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || 'http://localhost:8787';
const gap = Number(process.env.GAP_MS || 3000);
const cases = JSON.parse(readFileSync(join(here, 'paraphrase-set.json'), 'utf8'));
const flagged = (label) => label === 'scam' || label === 'suspicious';
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

const rows = [];
for (const c of cases) {
  const local = detectLocalSignals(c.text);
  const rules = combineEvidence({ rawText: c.text, localResult: local, geminiResult: null, spamScore: spamScore(c.text), isSpamFlagged: false });
  let live = null;
  for (let n = 0; n < 4 && !live; n++) {
    try {
      const r = await fetch(`${base}/api/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: c.text }) });
      if (r.status === 200) live = await r.json(); else await sleep(8000);
    } catch { await sleep(5000); }
  }
  const gem = live ? (live.signals || []).filter((s) => s.source === 'gemini') : [];
  rows.push({
    id: c.id, expect: c.expect, answered: Boolean(live),
    rulesFlag: flagged(rules.label),
    geminiAnswered: gem.length > 0 || (live && /gemini/i.test(JSON.stringify(live.sources || ''))),
    geminiFlag: gem.some((s) => s.severity === 'high'),
    fusionFlag: live ? flagged(live.label) : null
  });
  await sleep(gap);
}
const isScam = (r) => r.expect === 'scam';
function tally(key) {
  const scams = rows.filter(isScam), safes = rows.filter((r) => !isScam(r));
  return { scamsFlagged: `${scams.filter((r) => r[key]).length}/${scams.length}`, safeNotFlagged: `${safes.filter((r) => !r[key]).length}/${safes.length}` };
}
const out = { cases: rows.length, answeredByLiveServer: rows.filter((r) => r.answered).length, rulesOnly: tally('rulesFlag'), geminiOnly: tally('geminiFlag'), fusion: tally('fusionFlag'), rows };
writeFileSync(join(here, 'ablation-results.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, rows: undefined }, null, 2));
