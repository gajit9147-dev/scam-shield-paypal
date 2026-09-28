// Optional AI enhancement. When GEMINI_API_KEY is set, a Gemini model reviews
// the message (useful for Hindi/Hinglish texts the English rules cannot read).
// Any problem - no key, network error, bad reply - returns null and the caller
// falls back to the local rules + UCI baseline. The AI may only return the
// existing honest labels: "scam" or "uncertain". Never "safe".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Minimal .env loader so a copied server/.env works without extra packages.
// Existing environment variables always win; nothing is overridden.
export function loadEnvFile() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const lines = readFileSync(join(here, '..', '.env'), 'utf8');
    for (const line of lines.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // No .env file is normal; the app runs fine without it.
  }
}

const TIMEOUT_MS = 8000;

function extractJson(raw) {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Models retire fast; try the configured/default model, then known fallbacks.
const MODEL_FALLBACKS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-lite-latest'];

async function callModel(model, key, prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: 'application/json' }
      })
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function aiReview(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const models = [...new Set([process.env.GEMINI_MODEL, ...MODEL_FALLBACKS].filter(Boolean))];
  const prompt = [
    'You are checking an Indian UPI/payment SMS for scam risk. The text may be English, Hindi or Hinglish.',
    'Respond with a JSON object only. Do not translate the message. Schema: {"label":"scam"|"uncertain","reason":"...","safeAction":"...","evidence":["..."]}.',
    'Rules: "scam" only when the text shows a real fraud pattern (requests OTP/PIN, demands payment to receive money, threatens account closure to force action, fake refund/KYC). Everything else is "uncertain". Never claim a message is safe.',
    'Keep reason and safeAction under 160 characters each, in English. Evidence: short English phrases, at most 3.',
    'Message to check:',
    text
  ].join('\n');
  let raw = null;
  for (const model of models) {
    raw = await callModel(model, key, prompt);
    if (raw) break;
  }
  if (!raw) return null;
    const parsed = extractJson(raw);
    if (!parsed) return null;
    if (parsed.label !== 'scam' && parsed.label !== 'uncertain') return null;
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '';
    const safeAction = typeof parsed.safeAction === 'string' ? parsed.safeAction.slice(0, 300) : '';
    if (!reason || !safeAction) return null;
    const evidence = Array.isArray(parsed.evidence)
      ? parsed.evidence.filter(item => typeof item === 'string').slice(0, 3).map(item => item.slice(0, 120))
      : [];
  return { label: parsed.label, reason, safeAction, evidence };
}
