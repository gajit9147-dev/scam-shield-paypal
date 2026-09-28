# UPI Scam Shield

A defensive student prototype for merchant-support triage of suspicious UPI/payment messages, built for the Razorpay AI Buildathon. **Day 1 is a working UI-to-API skeleton, not a detector.** Every check currently returns `uncertain`; never use it to decide that a real message is safe.

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
  "reason": "The classifier is not built yet. No risk assessment was performed.",
  "confidence": null,
  "evidence": [],
  "safeAction": "Do not act on this verdict. Verify in the official payment or bank app, and ask a person if unsure.",
  "method": "placeholder"
}
```

Planned labels are `scam`, `safe`, `uncertain`. Confidence will only be populated once a real method can justify it. The API never echoes the pasted text or logs it by default.

## Repo map

- `client/` - React + Vite + Tailwind paste-message form and result card
- `server/` - Express API and classifier placeholder
- `data/` - dataset sourcing and safety instructions (no raw messages committed)
- `scripts/fetch_uci.py` - optional local UCI dataset download
- `docs/architecture.md` - workflow, label rules, privacy, evaluation plan
- `.env.example` - example local configuration; `.gitignore` excludes secrets and downloaded data

## Build plan and limitations

Day 2: source and redact data. Day 3: transparent baseline rules. Day 4: server-side LLM with strict structured output. Day 5: held-out evaluation, false alarms and abstentions. Day 6: finish UI and docs. Day 7: demo video and application review. The detailed 7-day plan is private to the project owner.

UCI's [SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms%2Bspam%2Bcollection) is English general spam, not an Indian UPI benchmark. It will be used to learn the pipeline, with separate results. No accuracy, precision, recall or loss-prevention claim exists yet. The app does not verify senders, links or payments; it does not automatically block anything. Never upload personal messages, OTPs or payment identifiers into this public repository.
