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
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Screenshots arrive base64 inside JSON
app.post('/api/check-image', express.json({ limit: '6mb' }), async (req, res) => {
  const image = req.body?.image;
  const mimeType = req.body?.mimeType;
  if (typeof image !== 'string' || typeof mimeType !== 'string' || !IMAGE_TYPES.includes(mimeType)
    || image.length < 100 || image.length > 5600000 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return res.status(400).json({ error: 'Send a JPEG, PNG or WebP screenshot.' });
  }

  // Do not log or store images.
  const ai = await aiReviewImage({ data: image, mimeType });
  if (!ai) return res.status(503).json({ error: 'Image check is not available right now.' });

  const transcript = (ai.transcript || '').trim();
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
  return res.json(result);
});

app.use(express.json({ limit: '8kb' }));

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
    || (context !== undefined && (typeof context !== 'string' || context.length > 1000))
    || (language !== undefined && language !== 'en' && language !== 'hi')) {
    return res.status(400).json({ error: 'Send a question of 1 to 500 characters.' });
  }

  // Do not log or store chat content.
  const reply = await aiChat({
    message: message.trim(),
    context: typeof context === 'string' ? context.trim() : '',
    language: language === 'hi' ? 'hi' : 'en',
    detectionResult
  });

  if (!reply) return res.status(503).json({ error: 'Chat reply is not available right now.' });
  return res.json({ reply });
});

app.listen(port, () => console.log(`API ready at http://localhost:${port}`));
