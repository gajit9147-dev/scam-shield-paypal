# UPI Scam Shield

A defensive student prototype for merchant-support triage of suspicious UPI/payment messages, built for the Razorpay AI Buildathon. **The prototype uses a measured English general-spam model and cautious payment-warning rules, not a validated UPI scam detector.** No output proves a payment message is safe.

## Run locally

Install Node.js 20.19+ or 22.12+ and npm. Clone this repo and open two terminal windows in its root folder:

```bash
git clone https://github.com/gajit9147-dev/upi-scam-shield.git
cd upi-scam-shield
cd server
npm ci
npm run dev
```

In the second terminal, from `upi-scam-shield`:

```bash
cd client
npm ci
npm run dev
```

Open the URL printed by Vite (usually http://localhost:5173). Paste a **made-up, non-private** payment message and press **Check message**, or press **Upload screenshot** and pick a screenshot of a message: the app reads its text on-device (tesseract.js OCR, loaded from a CDN at runtime) into the editable box so you can fix mistakes. After extraction, choose **Check if this message is fraud** for a cautious verdict or **Wrong payment - how to get money back** for direct recovery guidance. You can switch choices without uploading again. Extraction quality depends on the screenshot; Hindi UI is available from the language selector. The frontend calls the local Express API through Vite's `/api` proxy. No API key or database is needed. Stop either process with Ctrl+C.

Quick API test in another terminal:

```bash
curl -X POST http://localhost:3001/api/check -H 'Content-Type: application/json' -d '{"text":"Synthetic payment reminder"}'
```

If `curl` isn't available on Windows, use the browser UI. If the frontend says it cannot reach the API, check that the server terminal still shows `API ready`.

## Local checks

Run these in separate terminals after `npm ci` in each folder:

```bash
cd server && npm test
cd client && npm run build
```

For a local UI check, leave the server and Vite running, then try **made-up** messages: `Share OTP 123456 to claim your refund` and `Pay a fee via https://example.invalid to receive your cashback` should show a `scam` warning. `Your payment of INR 300 was completed` should show `uncertain`, not `safe`. Submitting an empty form is blocked by browser validation; the API separately rejects blank input with HTTP 400. A standalone link without a matching suspicious request may be `uncertain`: the tool does not check whether links are safe. These are synthetic integration cases, not UPI performance measurements.

## Wrong-payment recovery guidance

When a pasted and checked message looks like a completed payment (amount plus debit/reference words), the app also shows the real steps for a mistaken UPI payment. For an uploaded screenshot, you can choose the recovery steps directly even if OCR misses debit words: note the 12-digit UPI reference (UTR), raise an "Incorrectly transferred to another account" complaint on the transaction in the UPI app, ask your bank to request a reversal, escalate app > partner bank > your bank > NPCI (npci.org.in), and call 1930 / file at cybercrime.gov.in if the receiver refuses or fraud is involved. The app only explains the process; it never promises recovery.

## Optional AI review (Gemini)

With no key the app runs fully on its own: local payment rules + the UCI baseline. To add AI review (better Hindi/Hinglish understanding and clearer reasons), get a free Gemini key at https://aistudio.google.com/apikey, copy `.env.example` to `server/.env`, and set `GEMINI_API_KEY` (optionally `GEMINI_MODEL`, default `gemini-3.8-flash` with automatic fallbacks). The AI may only return the existing `scam`/`uncertain` labels; a local `scam` warning is never downgraded, and any AI error or timeout silently falls back to the local result. Keys must never be committed: `.gitignore` excludes `.env` files.

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

- `client/` - React + Vite + Tailwind form with screenshot OCR upload, result card and recovery guidance
- `server/` - Express API with cautious rules, exported UCI spam baseline and optional Gemini review
- `data/` - dataset sourcing and safety instructions (no raw messages committed)
- `scripts/fetch_uci.py` - optional local UCI dataset download
- `docs/architecture.md` - workflow, label rules, privacy, evaluation plan
- `.env.example` - example local configuration; `.gitignore` excludes secrets and downloaded data

## Build plan and limitations

Day 2: UCI data preparation (done). Day 3: measured English general-spam baseline and cautious payment-warning rules (done). Day 4: fresh-clone installation, server tests, client build and local end-to-end UI checks (done). Next: consented, redacted UPI examples and a held-out UPI evaluation; only then consider model changes, demo and application. The detailed 7-day plan is private to the project owner.

UCI's [SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms%2Bspam%2Bcollection) is English general spam, not an Indian UPI benchmark. It will be used to learn the pipeline, with separate results. The UCI general-spam results are reported in [Day 3 evaluation](docs/day3-evaluation.md), with no UPI accuracy, precision, recall or loss-prevention claim. The app does not verify senders, links or payments; it does not automatically block anything. Never upload personal messages, OTPs or payment identifiers into this public repository.
