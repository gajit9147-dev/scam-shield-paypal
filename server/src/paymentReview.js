// Reads a payment request (invoice text, seller message, "please pay" note),
// pulls out who/what/how much, and decides whether a PayPal sandbox checkout
// may be opened. A scam verdict blocks checkout on the server, so the
// PayPal step cannot be reached without passing the AI + rules review.

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { callModel, extractJson, MODEL_FALLBACKS } from './ai.js';

const SUPPORTED = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const FALLBACK_INR_PER_USD = Number(process.env.DEMO_INR_PER_USD) || 85;
// Live INR rate from a free public API, refreshed every 6 hours. If it cannot be fetched, the fixed demo rate is used and the screen says so.
const rate = { value: FALLBACK_INR_PER_USD, live: false, at: null };
export function currentInrRate() { return { ...rate }; }
export async function refreshInrRate(fetchImpl = fetch) {
  try {
    const res = await fetchImpl('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    const v = Number(data?.rates?.INR);
    if (res.ok && data?.result === 'success' && v > 40 && v < 200) {
      rate.value = v; rate.live = true; rate.at = new Date().toISOString();
      return true;
    }
  } catch { /* keep the previous rate */ }
  return false;
}
export function startInrRateRefresh() {
  refreshInrRate();
  setInterval(refreshInrRate, 6 * 60 * 60 * 1000).unref();
}

const SECRET = process.env.REVIEW_TOKEN_SECRET || randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_USD = 500; // sandbox demo cap

const SYMBOLS = [
  [/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i, 'INR'],
  [/([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rs\b|inr)/i, 'INR'],
  [/(?:\$|usd)\s*([\d,]+(?:\.\d{1,2})?)/i, 'USD'],
  [/([\d,]+(?:\.\d{1,2})?)\s*usd/i, 'USD'],
  [/([\d,]+(?:\.\d{1,2})?)\s*(?:eur|euros?)\b/i, 'EUR'],
  [/(?:€|eur)\s*([\d,]+(?:\.\d{1,2})?)/i, 'EUR'],
  [/([\d,]+(?:\.\d{1,2})?)\s*(?:gbp|pounds?)\b/i, 'GBP'],
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

export async function aiExtract(text) {
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
    if (res?.isQuotaError) continue;
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
  if (cur === 'INR') {
    value = amount / rate.value;
    cur = 'USD';
    note = rate.live
      ? `INR is converted at ${rate.value.toFixed(2)} INR = 1 USD (live rate from open.er-api.com, fetched ${rate.at.slice(0, 16).replace('T', ' ')} UTC). The PayPal sandbox charges in USD.`
      : `INR is converted at a fixed demo rate of ${rate.value} INR = 1 USD because the live rate could not be fetched. The PayPal sandbox charges in USD.`;
  }
  value = Math.max(0.01, Math.round(value * 100) / 100);
  if (cur === 'USD' && value > MAX_USD) return { ok: false, reason: `Sandbox demo is capped at ${MAX_USD} USD.` };
  return { ok: true, amount: value.toFixed(2), currency: cur, note };
}

// Payment-specific red flags the AI may call only "uncertain". Each one alone is enough to stop checkout.
const BRANDS = ['paypal', 'amazon', 'netflix', 'microsoft', 'apple', 'google', 'dhl', 'fedex', 'usps', 'irs', 'sbi', 'hdfc', 'icici', 'paytm'];
const RED_FLAGS = [
  ['outside_platform', /\b(skip|avoid|without)\b[^.]{0,40}\b(platform|marketplace|site)\b[^.]{0,20}\bfees?\b|\bpay\b[^.]{0,40}\bdirectly\b[^.]{0,40}\b(personal|my)\b|\bdo not tell\b|\bkeep (it|this) (a )?secret\b/i, 'Asks you to pay outside the platform or keep it secret'],
  ['gift_card', /\bgift cards?\b[^.]{0,80}\b(pay|buy|send|need)|\b(pay|paid|payable|buy|send|need)\b[^.]{0,80}\bgift cards?\b/i, 'Asks for payment in gift cards'],
  ['crypto_returns', /\b(guaranteed|assured)\b[^.]{0,40}\b(returns?|profit)\b|\b\d+x\b[^.]{0,20}\breturns?\b|\bdouble your (money|investment)\b/i, 'Promises guaranteed investment returns'],
  ['stranger_emergency', /\b(stuck|stranded)\b[^.]{0,60}\b(need|send)\b[^.]{0,40}\$?\d|\bmy love\b[^.]{0,120}\b(send|need)\b/i, 'A stranger or online contact asks for emergency money'],
  ['cheque_overpay', /\b(deposit|cheque|check)\b[^.]{0,80}\b(then|and)\b[^.]{0,30}\bpay\b|\bsent you\b[^.]{0,40}\bby mistake\b[^.]{0,60}\b(pay|send|return)\b/i, 'Cheque or overpayment trick'],
  ['remote_access', /\bremote access\b|\b(virus|malware)\b[^.]{0,60}\bpay\b|\bpay\b[^.]{0,60}\b(virus|malware)\b/i, 'Tech-support scam: remote access or virus removal fee'],
  ['wire_deposit', /\bwire\b[^.]{0,40}\bdeposit\b|\bdeposit\b[^.]{0,40}\bwire\b/i, 'Asks for a wire deposit before you see anything'],
  ['cashback_pin', /\b(cashback|reward)\b[^.]{0,80}\bpin\b|\bpin\b[^.]{0,40}\b(accept|claim|receive)\b/i, 'Says a PIN is needed to receive cashback or a reward, but a PIN only sends money'],
  ['advance_fee', /\b(deposit|pay|send)\b[^.]{0,30}\d[\d,]*[^.]{0,60}\b(first|to (confirm|start|join|activate|unlock)|task account|registration|joining)\b/i, 'Asks for money first before a job, task or payout'],
  ['utility_threat', /\b(electricity|power|gas|sim|card)\b[^.]{0,50}\b(cut|disconnect\w*|block\w*|frozen|freeze|deactivat\w*)\b[^.]{0,60}\b(tonight|today|immediately|within|hours?|minutes?|\d{1,2}:\d{2})/i, 'Threatens to cut a service within hours to force a payment or call'],
  ['mistaken_transfer', /\b(sent|transferred)\b[^.]{0,30}\b(by mistake|accidentally|wrong(ly)?)\b[^.]{0,80}\b(return|send back|refund|wapas)\b|\b(by mistake|accidentally|wrongly)\b[^.]{0,30}\b(sent|transferred)\b[\s\S]{0,100}\b(return|send back|refund|wapas)\b/i, 'Says money was sent by mistake and asks for it back'],
  ['guaranteed_payout', /\b(invest|deposit)\b[^.]{0,60}\b(get|earn|receive)\b[^.]{0,30}\d[\d,]*[^.]{0,30}\b(in|within)\s+\d+\s+(days?|hours?|weeks?)\b/i, 'Promises a fixed big payout in days for an investment'],
  ['identity_documents', /\b(photo|picture|copy|image|scan)\b[^.]{0,25}\b(aadhaar|pan|card|passport)\b|\b(share|send|give|provide)\b[^.]{0,30}\b(card number|cvv|expiry|aadhaar number)\b/i, 'Asks for ID documents or card details by message'],
  ['urgent_money_ask', /\b(urgent|emergency|hospital|accident)\b[\s\S]{0,120}\b(send|bhej|transfer|scan)\b[^.]{0,80}\b(qr|upi|rs\.?|\u20b9|\d{3,})/i, 'Urgent request to send money, often with a QR code'],
  ['outside_app', /\b(pay|transfer|send)\b[^.]{0,30}\boutside\b[^.]{0,15}\b(app|platform|site)\b/i, 'Asks to pay outside the app or platform'],
];
export function paymentRedFlags(text) {
  const flags = RED_FLAGS.filter(([, re]) => re.test(text)).map(([type, , evidence]) => ({ type, evidence }));
  // Look-alike sender: a known brand mixed with digits, a hyphenated add-on, or a swapped letter in the domain.
  const hosts = [...text.matchAll(/(?:@|https?:\/\/)([a-z0-9.-]+\.[a-z]{2,})/gi)].map((m) => m[1].toLowerCase());
  for (const host of hosts) {
    const name = host.split('.').slice(-2, -1)[0] || '';
    const fold = (x) => x.replace(/[1il]/g, 'l').replace(/0/g, 'o').replace(/\$/g, 's').replace(/rn/g, 'm');
    const squashed = fold(name);
    for (const b of BRANDS) {
      const official = name === b;
      const lookalike = !official && (squashed.includes(fold(b)) || name.includes(b + '-') || name.includes('-' + b));
      if (lookalike) { flags.push({ type: 'lookalike_sender', evidence: `Sender or link "${host}" imitates "${b}"` }); break; }
    }
  }
  const fakeCompany = /\b(paypal|amazon|netflix|microsoft|apple|irs)\b[^.]{0,80}\b(support|security|billing)\b|\b(support|security|billing)\b[^.]{0,20}\b(paypal|amazon|netflix|microsoft|apple)\b/i.test(text);
  if (fakeCompany && /@(gmail|yahoo|outlook|hotmail)\.com/i.test(text)) flags.push({ type: 'brand_free_mail', evidence: 'Claims to be a company but asks you to pay a free-mail address' });
  return flags;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

// A signed order ticket lets the server remember which PayPal order it created without keeping state, so a restart does not lose it.
export function signOrderTicket({ orderId, amount, currency }) {
  return sign({ kind: 'order', orderId, amount, currency, exp: Date.now() + 60 * 60 * 1000 });
}
export function verifyOrderTicket(ticket, orderId) {
  const c = verifyToken(ticket);
  if (!c || c.kind !== 'order' || c.orderId !== orderId) return null;
  return c;
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
export async function reviewPaymentRequest(text, verdict, aiPromise, reviewAiAnswered = true) {
  const rx = regexExtract(text);
  const ai = await (aiPromise || aiExtract(text));
  const merged = {
    amount: ai?.amount ?? rx.amount,
    currency: ai?.currency ?? rx.currency,
    payee: ai?.payee ?? rx.payee,
    purpose: ai?.purpose ?? null
  };
  const checkout = toCheckout(merged);
  // Without the AI review the request has only had the rules. Do not unlock checkout on rules alone.
  const degraded = !reviewAiAnswered;
  if (checkout.ok && merged.payee) {
    const demoNote = `Demo only: the sandbox payment goes to the ScamShield demo merchant, not to "${merged.payee}". The payee in the request is not verified.`;
    checkout.note = checkout.note ? `${checkout.note} ${demoNote}` : demoNote;
  }
  const blocked = verdict.riskLevel === 'HIGH_RISK' || verdict.riskLevel === 'SUSPICIOUS';
  const pressure = ai?.pressure || [];
  const missing = ai?.missing || [];
  let canPay = checkout.ok && !blocked && !degraded;
  let token = null;
  if (canPay) {
    token = sign({
      amount: checkout.amount,
      currency: checkout.currency,
      payee: merged.payee || '',
      purpose: merged.purpose || '',
      risk: verdict.riskLevel,
      jti: randomBytes(12).toString('hex'),
      exp: Date.now() + TOKEN_TTL_MS
    });
  }
  return {
    request: merged,
    checkout: checkout.ok ? { amount: checkout.amount, currency: checkout.currency, note: checkout.note } : null,
    checkoutProblem: checkout.ok ? (degraded && !blocked ? 'AI review did not answer, so checkout stays locked. Try the check again in a minute.' : null) : checkout.reason,
    degraded,
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

// One review token opens one PayPal order. Kept in memory, which is enough for a single demo server.
const usedTokens = new Map();
export function useTokenOnce(claim) {
  const now = Date.now();
  for (const [id, exp] of usedTokens) if (exp < now) usedTokens.delete(id);
  if (!claim?.jti || usedTokens.has(claim.jti)) return false;
  usedTokens.set(claim.jti, claim.exp);
  return true;
}

export function releaseToken(claim) {
  if (claim?.jti) usedTokens.delete(claim.jti);
}

// Small per-address limit so the AI and checkout endpoints cannot be hammered.
const hits = new Map();
export function rateLimit(max = 30, windowMs = 60000) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip || 'unknown'}:${req.path}`;
    const list = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' });
    list.push(now);
    hits.set(key, list);
    return next();
  };
}

// Runs four real attacks against the real checks, without calling PayPal.
// orderKnown(id) tells whether an order id came from a reviewed request.
export function runAttackDemo(orderKnown = () => false) {
  const make = (extra = {}) => sign({ amount: 12.5, currency: 'USD', payee: 'Demo Cafe', purpose: 'attack demo', risk: 'UNCERTAIN', jti: randomBytes(12).toString('hex'), exp: Date.now() + 60000, ...extra });
  const results = [];

  const good = make();
  const [body, mac] = good.split('.');
  const edited = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  edited.amount = 125;
  const forged = `${Buffer.from(JSON.stringify(edited)).toString('base64url')}.${mac}`;
  results.push({ attack: 'Change the amount after review: 12.50 to 125.00', blocked: verifyToken(forged) === null, why: 'The review token is signed. Any edit breaks the signature.' });

  results.push({ attack: 'Use an old review token', blocked: verifyToken(make({ exp: Date.now() - 1000 })) === null, why: 'Review tokens expire after 15 minutes.' });

  const once = verifyToken(make());
  const first = useTokenOnce(once);
  const second = useTokenOnce(once);
  releaseToken(once);
  results.push({ attack: 'Reuse one review token for a second payment', blocked: first === true && second === false, why: 'One review opens one PayPal order.' });

  results.push({ attack: 'Capture an order that was never reviewed', blocked: verifyOrderTicket(undefined, 'FAKE-ORDER-123456') === null && verifyOrderTicket(signOrderTicket({ orderId: 'REAL-ORDER-111111', amount: '12.50', currency: 'USD' }), 'FAKE-ORDER-123456') === null && !orderKnown('FAKE-ORDER-123456'), why: 'The server only captures orders it created from a reviewed request.' });
  return results;
}
