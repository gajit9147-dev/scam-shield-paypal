import express from 'express';
import cors from 'cors';
import model from '../model/uci-spam-nb.json' with { type: 'json' };
import { spamScore } from './classify.js';
import { detectLocalSignals } from './rules.js';
import { combineEvidence } from './fusion.js';
import { aiReview, aiReviewImage, aiChat, loadEnvFile } from './ai.js';

loadEnvFile();

const app = express();
const port = Number(process.env.PORT) || 3001;

// Allow CORS from localhost, configured origin, or local network devices (e.g. mobile testing on LAN)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?$/.test(origin)
      || origin === process.env.CLIENT_ORIGIN) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin denied'));
  },
  credentials: true
}));

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Screenshots arrive base64 inside JSON
app.post('/api/check-image', express.json({ limit: '6mb' }), async (req, res) => {
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

app.use(express.json({ limit: '128kb' }));

app.get('/', (_req, res) => res.redirect(process.env.CLIENT_ORIGIN || 'http://localhost:5173'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/check', async (req, res) => {
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

app.post('/api/chat', async (req, res) => {
  const message = req.body?.message;
  const context = req.body?.context;
  const language = req.body?.language;
  const detectionResult = req.body?.detectionResult;

  if (typeof message !== 'string' || !message.trim() || message.length > 500
    || (language !== undefined && language !== 'en' && language !== 'hi')) {
    return res.status(400).json({ error: 'Send a question of 1 to 500 characters.' });
  }

  const safeContext = typeof context === 'string' ? context.slice(0, 2000).trim() : '';

  // Do not log or store chat content.
  const reply = await aiChat({
    message: message.trim(),
    context: safeContext,
    language: language === 'hi' ? 'hi' : 'en',
    detectionResult
  });

  if (!reply) return res.status(503).json({ error: 'Chat reply is not available right now.' });
  return res.json({ reply });
});

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

app.listen(port, () => console.log(`API ready at http://localhost:${port}`));
