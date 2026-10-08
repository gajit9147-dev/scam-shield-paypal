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

test('extension.zip is a valid zip with the manifest inside', async () => {
  const { execFileSync } = await import('node:child_process');
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  await withServer(8767, async (base) => {
    const r = await fetch(base + '/extension.zip');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/zip');
    const f = join(mkdtempSync(join(tmpdir(), 'ext-')), 'e.zip');
    writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    const list = execFileSync('unzip', ['-l', f]).toString();
    assert.match(list, /scamshield-extension\/manifest\.json/);
    assert.match(list, /scamshield-extension\/background\.js/);
    execFileSync('unzip', ['-tq', f]);
  });
});
