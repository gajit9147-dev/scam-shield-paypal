# UPI Scam Shield

A defensive student prototype for merchant-support triage of suspicious UPI/payment messages, built for the Razorpay AI Buildathon. **Day 3 adds a measured English general-spam model and cautious payment-warning rules, not a validated UPI scam detector.** No output proves a payment message is safe.

## Run locally

Install Node.js 20.19+ or 22.12+ and npm. Clone this repo and open two terminal windows in its root folder:

```bash
git clone https://github.com/gajit9147-dev/upi-scam-shield.git
cd upi-scam-shield
cd server
npm install
npm run dev
```

In the second terminal, from `upi-scam-shield`:

```bash
cd client
npm install
npm run dev
```

Open the URL printed by Vite (usually http://localhost:5173). Paste a **made-up, non-private** payment message and press **Check message**. The frontend calls the local Express API through Vite's `/api` proxy. No API key or database is needed. Stop either process with Ctrl+C.

Quick API test in another terminal:

```bash
curl -X POST http://localhost:3001/api/check -H 'Content-Type: application/json' -d '{"text":"Synthetic payment reminder"}'
```

If `curl` isn't available on Windows, use the browser UI. If the frontend says it cannot reach the API, check that the server terminal still shows `API ready`.

## Current response contract

`POST /api/check` accepts `{ "text": "..." }`, with 1-1000 characters; empty/long input returns HTTP 400. It responds with:

```json
{
  "label": "uncertain",
  "reason": "No strong fraud request pattern was found. Text alone cannot establish that a payment message is safe.",
  "confidence": null,
  "evidence": [],
  "safeAction": "Do not act on this verdict. Verify in the official payment or bank app, and ask a person if unsure.",
  "method": "payment warning rules + UCI general-spam baseline",
  "generalSpamSignal": "not flagged"
}
```

Labels are `scam` (suspicious request pattern) and `uncertain` (including apparently ordinary messages). `safe` is deliberately not emitted. Confidence is null until a real UPI evaluation can justify it. The UCI ham/spam score is only a separate general-spam signal, never a payment-safety score. The API never echoes the pasted text or logs it by default.

## Repo map

- `client/` - React + Vite + Tailwind paste-message form and result card
- `server/` - Express API and cautious rules and exported UCI spam baseline
- `data/` - dataset sourcing and safety instructions (no raw messages committed)
- `scripts/fetch_uci.py` - optional local UCI dataset download
- `docs/architecture.md` - workflow, label rules, privacy, evaluation plan
- `.env.example` - example local configuration; `.gitignore` excludes secrets and downloaded data

## Build plan and limitations

Day 2: UCI data preparation (done). Day 3: measured English general-spam baseline and cautious payment-warning rules (done). Next: consented, redacted UPI examples and a held-out UPI evaluation; only then consider model changes, demo and application. The detailed 7-day plan is private to the project owner.

UCI's [SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms%2Bspam%2Bcollection) is English general spam, not an Indian UPI benchmark. It will be used to learn the pipeline, with separate results. The UCI general-spam results are reported in [Day 3 evaluation](docs/day3-evaluation.md), with no UPI accuracy, precision, recall or loss-prevention claim. The app does not verify senders, links or payments; it does not automatically block anything. Never upload personal messages, OTPs or payment identifiers into this public repository.
