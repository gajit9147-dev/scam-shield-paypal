import test from 'node:test';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSecret } from './paymentReview.js';

test('the signing secret is stable across restarts when a PayPal secret or review secret is set', () => {
  assert.equal(deriveSecret({ PAYPAL_CLIENT_SECRET: 'abc' }), deriveSecret({ PAYPAL_CLIENT_SECRET: 'abc' }));
  assert.notEqual(deriveSecret({ PAYPAL_CLIENT_SECRET: 'abc' }), deriveSecret({ PAYPAL_CLIENT_SECRET: 'abd' }));
  assert.equal(deriveSecret({ REVIEW_TOKEN_SECRET: 'fixed' }), 'fixed');
  assert.notEqual(deriveSecret({}), deriveSecret({}));
});

test('a used review token stays used after the process restarts', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'ss-')), 'used.log');
  const script = "import('./src/paymentReview.js').then(m => console.log(m.useTokenOnce({ jti: 'abc123', exp: Date.now() + 600000 })))";
  const projectDir = fileURLToPath(new URL('..', import.meta.url));
  const run = () => execFileSync(process.execPath, ['-e', script], { env: { ...process.env, USED_TOKENS_FILE: file }, cwd: projectDir }).toString().trim();
  assert.equal(run(), 'true');
  assert.equal(run(), 'false');
});

test('a local env file signing secret is loaded before token signing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ss-env-'));
  // Run an isolated copy so the real project's env is never changed.
  const root = fileURLToPath(new URL('..', import.meta.url));
  const script = `import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
    const dir = ${JSON.stringify(dir)};
    mkdirSync(dir + '/src');
    for (const file of ['paymentReview.js', 'ai.js']) copyFileSync(${JSON.stringify(root)} + '/src/' + file, dir + '/src/' + file);
    writeFileSync(dir + '/package.json', '{"type":"module"}');
    writeFileSync(dir + '/.env', 'REVIEW_TOKEN_SECRET=local-env-test-secret');
    const m = await import('file://' + dir + '/src/paymentReview.js');
    console.log(m.signOrderTicket({orderId:'ORDER123',amount:'1.00',currency:'USD'}));`;
  const env = { ...process.env }; delete env.REVIEW_TOKEN_SECRET; delete env.PAYPAL_CLIENT_SECRET;
  const token = execFileSync(process.execPath, ['--input-type=module', '-e', script], { env }).toString().trim();
  const [body, mac] = token.split('.');
  assert.equal(mac, createHmac('sha256', 'local-env-test-secret').update(body).digest('base64url'));
});
