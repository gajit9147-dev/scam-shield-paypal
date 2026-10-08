import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

// Starts the real server on a spare port and checks which origins the CORS rules accept.
async function withServer(port, fn) {
  const child = spawn(process.execPath, ['src/index.js'], { env: { ...process.env, PORT: String(port), GEMINI_API_KEY: '' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://localhost:${port}/api/health`); if (r.ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 150)); }
    await fn(`http://localhost:${port}`);
  } finally { child.kill(); }
}
const post = (base, path, origin) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ text: 'Invoice 88 from Blue Cafe: pay $12.50' }) });

test('extension origin is allowed on the review route only; other origins stay denied', async () => {
  const ext = 'chrome-extension://' + 'a'.repeat(32);
  await withServer(8766, async (base) => {
    assert.equal((await post(base, '/api/payments/review', ext)).status, 200);
    assert.equal((await post(base, '/api/paypal/create-order', ext)).status, 403);
    assert.equal((await post(base, '/api/payments/review', 'https://evil.example')).status, 403);
    assert.equal((await post(base, '/api/payments/review', 'chrome-extension://short')).status, 403);
  });
});
