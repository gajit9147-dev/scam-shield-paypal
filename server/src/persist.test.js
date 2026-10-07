import test from 'node:test';
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
