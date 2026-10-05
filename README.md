# ScamShield

ScamShield checks a payment request with AI **before** you pay. Only a request that passes the automated checks can open a PayPal sandbox checkout. A flagged request is blocked on the server, so the PayPal order is never created.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).
Live demo: https://scam-shield-paypal.onrender.com/pay (free server, the first load can take up to a minute).
Demo video (2 min 24 s): https://youtu.be/piMQvRnr5xI
Devpost entry (PayPal AI Hackathon): https://devpost.com/software/scamshield-kuvz8o

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/blocked.png" alt="Blocked: a risky payment request" width="260"><br><sub>Blocked, PayPal never opens</sub></td>
    <td align="center"><img src="docs/screenshots/cleared.png" alt="Cleared: PayPal sandbox unlocked" width="260"><br><sub>Cleared, sandbox checkout unlocks</sub></td>
    <td align="center"><img src="docs/screenshots/mobile.png" alt="Mobile view" width="140"><br><sub>Mobile</sub></td>
  </tr>
</table>

## How it works

1. Paste a payment request (invoice, seller message, "please pay" note) or upload a screenshot of it.
2. Gemini (text and vision) pulls out who is asking, how much, what pressure it sees and what the invoice is missing. Local scam rules read the same text. The stricter result counts.
3. The verdict comes first: **BLOCKED** or **CLEARED**, with the amount and a risk score (0-100, risk signals, not a probability). The steps, the highlighted risky words and the reasons are below it.
4. Blocked: the server will not issue a review token, so PayPal cannot open.
5. Cleared: the server signs a short-lived review token. The PayPal sandbox button (Orders API v2, create and capture) uses that token for the reviewed amount only.
6. After the payment, the server checks that the capture is COMPLETED and that the amount matches, then shows a receipt.

An **Attack the shield** button runs 4 bypass attempts on the server and shows that each one is rejected: an edited amount, an expired token, a reused token and a fake payment id.
There is also a downloadable evidence report for every check.

## What the server enforces

- The review token is HMAC-signed and holds the reviewed amount, currency, payee, purpose, risk level, a random id and an expiry (15 minutes). Any edit breaks the signature.
- A token can be used once. A parallel second use is rejected.
- Capture only works for an order the server created from a valid token, and the captured amount must match.
- PayPal also confirms the capture on its own: the server registers a sandbox webhook (`PAYMENT.CAPTURE.COMPLETED`) at startup and only records an event after PayPal verifies its signature. The receipt shows when that confirmation arrived.
- Screenshots are limited to PNG, JPEG or WebP and 6 MB. The check endpoints are rate limited per route.
- Text and screenshots are sent to the AI as untrusted data. Instructions written inside them are ignored. The AI can only add risk signals. It cannot clear a request that the rules block.

## Honest limits

- A CLEARED result means the request did not match our blocking rules. It does not prove the seller is genuine, and no output proves a payment is safe.
- The sandbox order pays the app's own PayPal sandbox merchant, not the seller named in the request. The payee in the text is read but not verified, and the checkout line says so. It shows the gate, not a real seller payout.
- Webhook confirmations are also kept in memory, and the server needs a public URL to register the webhook (Render sets it automatically).
- Review tokens and expected orders live in server memory. That fits this single-instance sandbox demo. If the free server restarts, the user sees "Review expired or missing. Check the request again before paying". A real product would keep this state in a shared database.
- INR amounts are converted to USD at the live rate from open.er-api.com (refreshed every 6 hours). If it cannot be fetched, a fixed demo rate of 85 INR = 1 USD is used (`DEMO_INR_PER_USD`) and the screen says so. The PayPal sandbox charges in USD.
- If the AI review does not answer, the screen says "NOT CLEARED: AI review unavailable" and checkout stays locked. Rules alone never unlock checkout.
- "Signal strength" is a simple read of the risk score and the number of signals. It is not a calibrated probability.
- The 30-message paraphrase set (`server/eval/paraphrase-set.json`) is a development set: I tuned the rules after seeing it, so its results are not a fair test. Rules alone: 15/15 scams flagged, 0/15 safe flagged. Live with the AI review (Gemini free tier), one earlier run: 15/15 scams blocked, 4/15 safe messages held, mostly because some AI calls did not answer (25 of 30 answered) and the screen then stays NOT CLEARED. After adding one retry for busy AI calls, a later single run answered 30/30 with 15/15 scams blocked and 0/15 safe held. AI answers vary between runs and the free tier can still reject bursts. The 129-message public evaluation remains the main measured result.
- Review tokens and order tickets are signed with `REVIEW_TOKEN_SECRET`, or, if that is not set, a key derived from the private PayPal client secret, so they stay valid across restarts. Used review tokens are also written to a small file, which blocks reuse after a plain restart; a redeploy on a host with a temporary disk can clear that file, and several server instances would not share it.
- Held-out set (`server/eval/heldout-set.json`, 60 messages written before the new rules): first run with rules only flagged 20/30 scams and 0/30 safe. I then added rules for the misses, so the later result (29/30 scams, 0/30 safe) is not a fair test. Live with the AI on the earlier deploy: 30/30 scams blocked and 27/30 safe cleared; the other 3 had no payment request, so no checkout was built.
- Payee: the request's payee is checked only for format and brand imitation (`payeeCheck`). A look-alike payee blocks checkout. A well-formed payee is shown as "not verified", its name is added to the PayPal order description, and its status is signed into the review token. Nobody can verify who owns a payee from text, and the sandbox payment goes to the app's own merchant.
- Untuned public check: two random 200-message samples (100 spam, 100 ham each) from the public Indian dataset, rules only, no AI. Sample 1: 0 false positives, recall 48% before and 54% after I added rules for the scam types I saw in it, so sample 1 is a dev set. Sample 2, never inspected before testing: 0 false positives, recall 41% before and 43% after. The dataset's "spam" label includes ordinary marketing (data packs, store offers), which this checker does not call scams, so recall here understates scam recall but also shows real misses.
- Learned model experiment (not used in the checker): I trained a logistic regression on the public Indian scam/ham SMS set plus the UCI SMS spam set (5,902 training messages, held-out 1,528 never used for training or threshold choice, script: [`eval/train-india-model.py`](server/eval/train-india-model.py), scorer: [`src/mlscore.js`](server/src/mlscore.js), comparison: `node eval/run-ml-eval.js`). On the held-out split of those datasets it looked strong: recall 95.5% at 97.7% precision, against 41.2% recall for the rules (98.6% precision). But on my own hand-written payment-request sets it failed to generalise: AUC 0.64 on the 60-message held-out set and 0.45 on the paraphrase set, and at the chosen threshold it flagged 22 of 30 safe messages (bills, order receipts, club fees) because the datasets label marketing and transaction texts as "spam". So the model learned the datasets' style, not scam intent. Wiring it in would have raised recall on those datasets and wrecked precision on real payment requests, so the live checker still uses the rules plus AI. The result is kept here because it is the honest answer to "does a bigger trained classifier fix recall": not with these public labels.
- Rough calibration (`server/eval/run-calibration.js`, rules only, 619 labelled messages across all sets, "uncertain" in the 129-set counted as not scam): HIGH_RISK 111 of 111 were scams, SUSPICIOUS 60 of 61, payment red flags 38 of 38, not flagged 105 of 409 were scams. The 0-100 risk score is a heuristic, not a calibrated probability.
- The older chat page (`/`) has an optional OCR fallback that loads Tesseract from a CDN. The `/pay` flow does not use it.
- No real money moves. Only the free PayPal sandbox is used.

## Run locally

Install Node.js 20.19+ or 22.12+. Then:

```bash
git clone https://github.com/gajit9147-dev/scam-shield-paypal.git
cd scam-shield-paypal/server && npm ci && npm run dev
```

In a second terminal:

```bash
cd scam-shield-paypal/client && npm ci && npm run dev
```

Open the URL Vite prints (usually http://localhost:5173) and go to `/pay`.

Set keys in `server/.env` (never commit it) or in your host's environment settings:

```
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-secret
GEMINI_API_KEY=optional
```

Get sandbox keys at https://developer.paypal.com (Apps and Credentials, Sandbox). Test payments use a sandbox buyer account from the same dashboard. Without a Gemini key the rules still run and block scams, but checkout never unlocks, and the screen says that the AI did not answer.

Checks:

```bash
cd server && npm test      # 61 tests, PayPal calls are mocked
node eval/run-paypal-testset.js http://localhost:3001   # 40 labeled payment requests (20 scams, 20 safe)
cd client && npm run build
```

## Test it

On `/pay`, tap the fictional examples, for instance **Normal invoice** (cleared) and **Fake prize** (blocked). Click **Attack the shield**. Use the sandbox buyer account from the Devpost testing instructions to pay.

## Repo map

- `client/` - React, Vite and Tailwind. `src/PayGuard.jsx` is the payment check page.
- `server/` - Express API. `src/paymentReview.js` (review, token, attack demo), `src/paypal.js` (Orders API), `src/ai.js` (Gemini), `src/rules.js` (scam rules).
- `docs/screenshots/` - screenshots of the live app.
- `render.yaml` - one free Render web service that builds the client and serves it from the server.

## Background

ScamShield started as a UPI scam checker for a university project. The scam rules and the Hindi, Hinglish and English evaluation work from that project are still here: [architecture](docs/architecture.md), [synthetic pilot](docs/day5-upi-pilot-evaluation.md), [public datasets](docs/day6-public-evaluation.md). The PayPal payment gate, the screenshot review, the Attack panel and the verdict-first interface are the work for this hackathon.

## License

MIT
