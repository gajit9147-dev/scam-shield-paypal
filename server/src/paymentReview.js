// Reads a payment request (invoice text, seller message, "please pay" note),
// pulls out who/what/how much, and decides whether a PayPal sandbox checkout
// may be opened. A scam verdict blocks checkout on the server, so the
// PayPal step cannot be reached without passing the AI + rules review.

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { callModel, extractJson, MODEL_FALLBACKS } from './ai.js';

const SUPPORTED = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const INR_PER_USD = Number(process.env.DEMO_INR_PER_USD) || 85;
const SECRET = process.env.REVIEW_TOKEN_SECRET || randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_USD = 500; // sandbox demo cap

const SYMBOLS = [
  [/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i, 'INR'],
  [/([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rs\b|inr)/i, 'INR'],
  [/(?:\$|usd)\s*([\d,]+(?:\.\d{1,2})?)/i, 'USD'],
  [/([\d,]+(?:\.\d{1,2})?)\s*usd/i, 'USD'],
  [/(?:€|eur)\s*([\d,]+(?:\.\d{1,2})?)/i, 'EUR'],
  [/(?:£|gbp)\s*([\d,]+(?:\.\d{1,2})?)/i, 'GBP']
];

export function regexExtract(text) {
  let amount = null;
  let currency = null;
  for (const [re, cur] of SYMBOLS) {
    const m = text.match(re);
    if (m) {
      amount = Number(m[1].replace(/,/g, ''));
      currency = cur;
      break;
    }
  }
  const upi = text.match(/[a-z0-9._-]{2,}@[a-z]{2,}/i);
  const email = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const link = text.match(/https?:\/\/[^\s]+/i);
  return {
    amount: Number.isFinite(amount) ? amount : null,
    currency,
    payee: (email?.[0] || upi?.[0] || null),
    link: link?.[0] || null,
    purpose: null
  };
}

async function aiExtract(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const prompt = [
    'You read a payment request someone received (invoice, seller chat, "please pay" note). It may be English, Hindi or Hinglish.',
    'Return JSON only. Schema: {"amount":number|null,"currency":"INR"|"USD"|"EUR"|"GBP"|"CAD"|"AUD"|null,"payee":string|null,"purpose":string|null,"pressure":["..."],"missing":["..."],"advice":"..."}',
    'pressure: urgency, threats, too-good offers, advance fees, requests to pay outside the platform. missing: things a real invoice normally has but this lacks (business name, invoice number, order id, return policy). advice: one or two plain sentences for the payer, under 220 characters. Never say the request is safe.',
    'Request text:',
    text
  ].join('\n');
  for (const model of [...new Set([process.env.GEMINI_MODEL, ...MODEL_FALLBACKS].filter(Boolean))]) {
    const res = await callModel(model, key, [{ text: prompt }]);
    if (res?.isQuotaError) return null;
    if (res?.text) {
      const p = extractJson(res.text);
      if (!p) return null;
      const list = (v) => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 4).map(x => x.slice(0, 120)) : []);
      return {
        amount: typeof p.amount === 'number' && p.amount > 0 ? p.amount : null,
        currency: typeof p.currency === 'string' ? p.currency.toUpperCase() : null,
        payee: typeof p.payee === 'string' ? p.payee.slice(0, 120) : null,
        purpose: typeof p.purpose === 'string' ? p.purpose.slice(0, 120) : null,
        pressure: list(p.pressure),
        missing: list(p.missing),
        advice: typeof p.advice === 'string' ? p.advice.slice(0, 260) : ''
      };
    }
  }
  return null;
}

// Turn the request into a sandbox charge: supported currency, 2 decimals, demo cap.
export function toCheckout({ amount, currency }) {
  if (!amount || amount <= 0) return { ok: false, reason: 'No amount found in the request.' };
  let cur = currency && (SUPPORTED.includes(currency) || currency === 'INR') ? currency : null;
  if (!cur) return { ok: false, reason: 'No supported currency found. Use $, EUR, GBP or INR.' };
  let value = amount;
  let note = null;
  if (cur !== 'INR') {
    // The sandbox India merchant takes INR only, so other currencies are shown in rupees.
    const perUsd = { USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.73, AUD: 0.66 }[cur] || 1;
    value = amount * perUsd * INR_PER_USD;
    note = `Sandbox demo converts ${cur} to INR at ${INR_PER_USD} per USD.`;
    cur = 'INR';
  }
  value = Math.max(1, Math.round(value * 100) / 100);
  if (value > MAX_USD * INR_PER_USD) return { ok: false, reason: `Sandbox demo is capped at ${MAX_USD * INR_PER_USD} INR.` };
  return { ok: true, amount: value.toFixed(2), currency: cur, note };
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// verdict: result of combineEvidence. Returns the review shown to the payer.
export async function reviewPaymentRequest(text, verdict) {
  const rx = regexExtract(text);
  const ai = await aiExtract(text);
  const merged = {
    amount: ai?.amount ?? rx.amount,
    currency: ai?.currency ?? rx.currency,
    payee: ai?.payee ?? rx.payee,
    purpose: ai?.purpose ?? null
  };
  const checkout = toCheckout(merged);
  const blocked = verdict.riskLevel === 'HIGH_RISK' || verdict.riskLevel === 'SUSPICIOUS';
  const pressure = ai?.pressure || [];
  const missing = ai?.missing || [];
  let canPay = checkout.ok && !blocked;
  let token = null;
  if (canPay) {
    token = sign({
      amount: checkout.amount,
      currency: checkout.currency,
      payee: merged.payee || '',
      purpose: merged.purpose || '',
      risk: verdict.riskLevel,
      exp: Date.now() + TOKEN_TTL_MS
    });
  }
  return {
    request: merged,
    checkout: checkout.ok ? { amount: checkout.amount, currency: checkout.currency, note: checkout.note } : null,
    checkoutProblem: checkout.ok ? null : checkout.reason,
    blocked,
    canPay,
    token,
    pressure,
    missing,
    advice: ai?.advice || '',
    aiUsed: Boolean(ai),
    // Honest wording: passing this review never means the seller is trustworthy.
    caution: 'This review cannot prove the seller is genuine. Pay only people you know, and only through the sandbox here.'
  };
}
