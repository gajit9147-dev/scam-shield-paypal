import express from 'express';
import cors from 'cors';
import { classify } from './classify.js';
import { aiReview, loadEnvFile } from './ai.js';

loadEnvFile();

const app = express();
const port = Number(process.env.PORT) || 3001;
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '8kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.post('/api/check', async (req, res) => {
  const text = req.body?.text;
  if (typeof text !== 'string' || !text.trim() || text.length > 1000) {
    return res.status(400).json({ error: 'Enter a message of 1 to 1000 characters.' });
  }
  // Do not log or store message bodies.
  const local = classify(text.trim());
  const ai = await aiReview(text.trim());
  if (!ai) return res.json(local);
  // Conservative merge: a scam warning from either side wins; the local
  // baseline stays the source of the general-spam signal. The AI never
  // downgrades a local scam warning and never produces a "safe" label.
  return res.json({
    ...local,
    label: local.label === 'scam' || ai.label === 'scam' ? 'scam' : 'uncertain',
    reason: ai.reason,
    safeAction: ai.safeAction,
    evidence: [...new Set([...local.evidence, ...ai.evidence])],
    method: local.method + ' + Gemini AI review'
  });
});

app.listen(port, () => console.log(`API ready at http://localhost:${port}`));
