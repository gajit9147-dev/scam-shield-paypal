import express from 'express';
import cors from 'cors';
import { classify } from './classify.js';

const app = express();
const port = Number(process.env.PORT) || 3001;
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '8kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.post('/api/check', (req, res) => {
  const text = req.body?.text;
  if (typeof text !== 'string' || !text.trim() || text.length > 1000) {
    return res.status(400).json({ error: 'Enter a message of 1 to 1000 characters.' });
  }
  // Do not log or store message bodies.
  return res.json(classify(text.trim()));
});

app.listen(port, () => console.log(`API ready at http://localhost:${port}`));
