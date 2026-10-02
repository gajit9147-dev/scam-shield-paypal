import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import model from '../model/uci-spam-nb.json' with { type: 'json' };
import { spamScore } from './classify.js';
import { detectLocalSignals } from './rules.js';
import { combineEvidence } from './fusion.js';
import { aiReview, aiReviewImage, aiChat, loadEnvFile } from './ai.js';
import { paypalConfigured, createOrder, captureOrder, ensureWebhook, verifyWebhookSignature } from './paypal.js';
import { processWebhook, confirmationFor } from './webhook.js';
import { aiStatus } from './ai.js';
import { aiExtract, paymentRedFlags, reviewPaymentRequest, verifyToken, useTokenOnce, releaseToken, rateLimit, runAttackDemo } from './paymentReview.js';
import { randomUUID } from 'node:crypto';

loadEnvFile();

const app = express();
app.set('trust proxy', 1);
const port = Number(process.env.PORT) || 3001;

// Allow CORS from localhost, configured origin, local network devices (e.g. mobile
// testing on LAN), or the same origin the server itself is hosted on (Render).
// Created per-request so the origin can be compared to the request's own Host.
const corsOptions = (req) => ({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?$/.test(origin)
      || origin === process.env.CLIENT_ORIGIN
      || origin === process.env.RENDER_EXTERNAL_URL) {
      return callback(null, true);
    }
    try {
      if (new URL(origin).host === req.get('host')) return callback(null, true);
    } catch { /* fall through to deny */ }
    return callback(new Error('CORS origin denied'));
  },
  credentials: true
});
app.use((req, res, next) => cors(corsOptions(req))(req, res, next));

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Screenshots arrive base64 inside JSON
app.post('/api/check-image', rateLimit(15), express.json({ limit: '6mb' }), async (req, res) => {
  const image = req.body?.image;
  const mimeType = req.body?.mimeType;
  const clientOcrText = typeof req.body?.ocrText === 'string' ? req.body.ocrText.trim() : '';

  const cleanImage = typeof image === 'string' ? image.replace(/[\r\n\s]+/g, '') : '';

  if (!cleanImage || typeof mimeType !== 'string' || !IMAGE_TYPES.includes(mimeType)
    || cleanImage.length < 100 || cleanImage.length > 5600000 || !/^[A-Za-z0-9+/=]+$/.test(cleanImage)) {
    return res.status(400).json({ error: 'Send a JPEG, PNG or WebP screenshot.' });
  }

  // Do not log or store images.
  let ai = null;
  try {
    ai = await aiReviewImage({ data: image, mimeType });
  } catch {
    ai = null;
  }

  const transcript = (ai?.transcript || clientOcrText || '').trim();

  if (!ai && !transcript) {
    return res.status(503).json({ error: 'Image check is not available right now.' });
  }

  const localResult = transcript ? detectLocalSignals(transcript) : null;
  const score = transcript ? spamScore(transcript) : 0;
  const isSpamFlagged = score >= model.spamThreshold;

  const result = combineEvidence({
    rawText: transcript,
    localResult,
    geminiResult: ai,
    spamScore: score,
    isSpamFlagged,
    isImage: true,
    ocrTranscript: transcript
  });

  result.transcript = transcript;

  return res.json({
    inputType: 'image',
    image: {
      url: `data:${mimeType};base64,${image}`,
      mimeType
    },
    ocr: {
      text: transcript,
      available: Boolean(transcript)
    },
    analysis: {
      riskLevel: result.riskLevel,
      label: result.label,
      category: result.category,
      categoryLabel: result.categoryLabel,
      categoryLabelHi: result.categoryLabelHi,
      summary: result.summary,
      summaryHi: result.summaryHi,
      reason: result.reason,
      evidence: result.evidence,
      evidenceHi: result.evidenceHi,
      signals: result.signals,
      recommendations: result.recommendations,
      recommendationsHi: result.recommendationsHi,
      safeAction: result.safeAction,
      recoveryFocus: result.recoveryFocus,
      confidence: result.confidence,
      method: result.method,
      sources: result.sources
    },
    ...result
  });
});

// Screenshot of a payment request: vision AI reads the text, then the same review runs on it.
app.post('/api/payments/review-image', rateLimit(15), express.json({ limit: '6mb' }), async (req, res) => {
  const mimeType = req.body?.mimeType;
  const data = typeof req.body?.image === 'string' ? req.body.image.replace(/[\r\n\s]+/g, '') : '';
  if (!data || typeof mimeType !== 'string' || !IMAGE_TYPES.includes(mimeType)
    || data.length < 100 || data.length > 5600000 || !/^[A-Za-z0-9+/=]+$/.test(data)) {
    return res.status(400).json({ error: 'Send a JPEG, PNG or WebP screenshot.' });
  }
  let seen = null;
  try {
    seen = await aiReviewImage({ data, mimeType });
  } catch {
    seen = null;
  }
  const transcript = (seen?.transcript || '').trim().slice(0, 1000);
  if (!transcript) {
    return res.status(422).json({ error: 'Could not read a payment request in that screenshot. Try a clearer one or paste the text.' });
  }
  const out = await reviewRequestText(transcript);
  return res.json({ ...out, transcript });
});

app.use(express.json({ limit: '128kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/check', rateLimit(30), async (req, res) => {
  const text = req.body?.text;
  if (typeof text !== 'string' || !text.trim() || text.length > 1000) {
    return res.status(400).json({ error: 'Enter a message of 1 to 1000 characters.' });
  }

  const cleanText = text.trim();
  // 1. Local deterministic rules
  const localResult = detectLocalSignals(cleanText);

  // 2. UCI general-spam secondary signal
  const score = spamScore(cleanText);
  const isSpamFlagged = score >= model.spamThreshold;

  // 3. Gemini semantic review
  const ai = await aiReview(cleanText);

  // 4. Evidence fusion layer
  const result = combineEvidence({
    rawText: cleanText,
    localResult,
    geminiResult: ai,
    spamScore: score,
    isSpamFlagged,
    isImage: false
  });

  return res.json(result);
});


// ---- PayPal sandbox: review a payment request first, then pay (sandbox only) ----
app.get('/api/ai-status', (_req, res) => res.json({ geminiKeySet: Boolean(process.env.GEMINI_API_KEY), ...aiStatus }));

app.get('/api/paypal/config', (_req, res) => {
  res.json({ configured: paypalConfigured(), clientId: paypalConfigured() ? process.env.PAYPAL_CLIENT_ID : null, mode: 'sandbox' });
});

// 0 to 100 score from the evidence found. Rules and AI both count; the verdict level sets a floor.
function riskScore(verdict, review) {
  const weight = { high: 35, medium: 18, low: 7 };
  const signals = Array.isArray(verdict.signals) ? verdict.signals : [];
  let score = signals.reduce((sum, x) => sum + (weight[x.severity] || 5), 0);
  score += Math.min(15, (review.pressure?.length || 0) * 5) + Math.min(10, (review.missing?.length || 0) * 3);
  const floor = verdict.riskLevel === 'HIGH_RISK' ? 80 : verdict.riskLevel === 'SUSPICIOUS' ? 55 : 0;
  return Math.max(floor, Math.min(100, score));
}

// Payment-specific rule: asking for a fee before giving you something is the classic advance-fee scam.
const ADVANCE_FEE = /\b(verification|delivery|processing|release|unlock|claim|customs|clearance|handling)\s+(fee|charge)\b|\bpay\b[^.]{0,60}\bto\s+(get|claim|receive|release|unlock|collect)\b/i;

async function reviewRequestText(cleanText) {
  const localResult = detectLocalSignals(cleanText);
  const score = spamScore(cleanText);
  const extracting = aiExtract(cleanText).catch(() => null);
  const ai = await aiReview(cleanText);
  const verdict = combineEvidence({
    rawText: cleanText, localResult, geminiResult: ai, spamScore: score,
    isSpamFlagged: score >= model.spamThreshold, isImage: false
  });
  if (ADVANCE_FEE.test(cleanText) && verdict.riskLevel !== 'HIGH_RISK' && verdict.riskLevel !== 'SUSPICIOUS') {
    verdict.riskLevel = 'SUSPICIOUS';
    verdict.label = 'scam';
    verdict.categoryLabel = verdict.categoryLabel || 'Advance fee scam';
    verdict.summary = 'Suspicious: it asks you to pay a fee before you get anything. Real prizes, refunds and accounts do not work that way.';
    verdict.signals = [...(Array.isArray(verdict.signals) ? verdict.signals : []), { source: 'local_rules', type: 'advance_fee', severity: 'high', evidence: 'Asks for a fee before giving you a prize, refund or access' }];
  }
  const flags = paymentRedFlags(cleanText);
  if (flags.length && verdict.riskLevel !== 'HIGH_RISK' && verdict.riskLevel !== 'SUSPICIOUS') {
    verdict.riskLevel = 'SUSPICIOUS';
    verdict.label = 'scam';
    verdict.categoryLabel = verdict.categoryLabel || 'Payment scam pattern';
    verdict.summary = `Suspicious: ${flags[0].evidence.charAt(0).toLowerCase()}${flags[0].evidence.slice(1)}.`;
  }
  if (flags.length) {
    verdict.signals = [...(Array.isArray(verdict.signals) ? verdict.signals : []), ...flags.map((f) => ({ source: 'local_rules', type: f.type, severity: 'high', evidence: f.evidence }))];
  }
  const review = await reviewPaymentRequest(cleanText, verdict, extracting, Boolean(ai));
  review.riskScore = riskScore(verdict, review);
  return { verdict, review };
}

app.post('/api/payments/review', rateLimit(30), async (req, res) => {
  const text = req.body?.text;
  if (typeof text !== 'string' || !text.trim() || text.length > 1000) {
    return res.status(400).json({ error: 'Paste a payment request of 1 to 1000 characters.' });
  }
  return res.json(await reviewRequestText(text.trim()));
});

const expectedOrders = new Map();
const paidOrders = new Map();
const webhookState = { registered: false, error: '' };
const ORDER_TTL_MS = 60 * 60 * 1000;
function cleanOldOrders() {
  const now = Date.now();
  for (const [id, o] of expectedOrders) if (now - o.at > ORDER_TTL_MS) expectedOrders.delete(id);
}

app.post('/api/paypal/create-order', rateLimit(20), async (req, res) => {
  if (!paypalConfigured()) return res.status(503).json({ error: 'PayPal sandbox is not set up on this server.' });
  const claim = verifyToken(req.body?.token);
  if (!claim) return res.status(403).json({ error: 'Review expired or missing. Check the request again before paying.' });
  if (!useTokenOnce(claim)) return res.status(409).json({ error: 'This review was already used. Check the request again to pay.' });
  try {
    const order = await createOrder({
      amount: claim.amount,
      currency: claim.currency,
      description: claim.purpose ? `Reviewed payment: ${claim.purpose}` : 'Reviewed payment',
      requestId: randomUUID()
    });
    cleanOldOrders();
    expectedOrders.set(order.id, { amount: claim.amount, currency: claim.currency, at: Date.now() });
    return res.json({ id: order.id });
  } catch (err) {
    releaseToken(claim);
    return res.status(502).json({ error: err.message || 'Could not create the PayPal order.' });
  }
});

app.get('/api/payments/attack-demo', rateLimit(20), (req, res) => {
  res.json({ results: runAttackDemo((id) => expectedOrders.has(id)) });
});

app.post('/api/paypal/capture-order', rateLimit(20), async (req, res) => {
  if (!paypalConfigured()) return res.status(503).json({ error: 'PayPal sandbox is not set up on this server.' });
  const orderId = req.body?.orderId;
  if (typeof orderId !== 'string' || !/^[A-Za-z0-9-]{8,40}$/.test(orderId)) {
    return res.status(400).json({ error: 'Missing order id.' });
  }
  const expected = expectedOrders.get(orderId);
  if (!expected) return res.status(403).json({ error: 'This order was not created by a reviewed request.' });
  try {
    const data = await captureOrder(orderId);
    const unit = data?.purchase_units?.[0]?.payments?.captures?.[0];
    const paidOk = unit?.amount && Number(unit.amount.value) === Number(expected.amount) && unit.amount.currency_code === expected.currency;
    if (data.status !== 'COMPLETED' || !paidOk) {
      return res.status(409).json({ error: 'The payment could not be verified against the reviewed request.' });
    }
    expectedOrders.delete(orderId);
    paidOrders.set(orderId, { amount: expected.amount, currency: expected.currency });
    if (paidOrders.size > 500) paidOrders.delete(paidOrders.keys().next().value);
    return res.json({
      status: data.status,
      orderId,
      paidAt: new Date().toISOString(),
      captureId: unit?.id || null,
      amount: unit?.amount || null,
      payerName: data?.payer?.name?.given_name || null
    });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Could not capture the PayPal payment.' });
  }
});

// PayPal calls this on its own when a capture finishes. The signature is checked with PayPal before anything is recorded.
app.post('/api/paypal/webhook', rateLimit(120), async (req, res) => {
  const out = await processWebhook({ headers: req.headers, event: req.body }, verifyWebhookSignature);
  res.status(out.status).json(out.body);
});

// The page asks whether PayPal's own webhook confirmed a payment this server captured.
app.get('/api/paypal/webhook-status', (req, res) => res.json({ registered: webhookState.registered, error: webhookState.error }));

app.get('/api/paypal/confirmation', rateLimit(60), (req, res) => {
  const orderId = String(req.query.orderId || '');
  const paid = paidOrders.get(orderId);
  if (!paid) return res.json({ confirmed: false });
  const c = confirmationFor(orderId, paid);
  res.json({ confirmed: c.confirmed, captureId: c.captureId || null });
});

app.post('/api/chat', rateLimit(30), async (req, res) => {
  const message = req.body?.message;
  const context = req.body?.context;
  const language = req.body?.language;
  const detectionResult = req.body?.detectionResult;

  if (typeof message !== 'string' || !message.trim() || message.length > 500
    || (language !== undefined && language !== 'en' && language !== 'hi' && language !== 'hinglish')) {
    return res.status(400).json({ error: 'Send a question of 1 to 500 characters.' });
  }

  const safeContext = typeof context === 'string' ? context.slice(0, 2000).trim() : '';

  // Do not log or store chat content.
  const reply = await aiChat({
    message: message.trim(),
    context: safeContext,
    language: language === 'hi' ? 'hi' : language === 'hinglish' ? 'hinglish' : 'en',
    detectionResult
  });

  if (!reply) return res.status(503).json({ error: 'Chat reply is not available right now.' });
  return res.json({ reply });
});

// In production (e.g. Render) the built client sits in client/dist and the same
// server serves it, so the app and the API share one origin. In local dev there
// is no build, so / redirects to the vite dev server as before.
const clientDist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => res.redirect(process.env.CLIENT_ORIGIN || 'http://localhost:5173'));
}

app.use((err, _req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'Payload too large. Message or screenshot exceeds allowed size.' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload.' });
  }
  if (err && err.message === 'CORS origin denied') {
    return res.status(403).json({ error: 'Origin not allowed by CORS policy.' });
  }
  next(err);
});

app.listen(port, () => {
  console.log(`API ready at http://localhost:${port}`);
  const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (publicUrl) ensureWebhook(publicUrl).then((id) => { webhookState.registered = Boolean(id); if (id) console.log('PayPal webhook ready'); }).catch((e) => { webhookState.error = String(e.message || e).slice(0, 200); console.log(`PayPal webhook not set up: ${webhookState.error}`); });
});
