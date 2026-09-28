# Day 5: UPI pilot evaluation on a small synthetic held-out set

**This is a small synthetic pilot, not validated real-world UPI accuracy.** The 42 cases in
[`server/eval/upi-pilot-dataset.json`](../server/eval/upi-pilot-dataset.json) are hand-written to look like
common Indian UPI scam and benign messages in English, Hindi and Hinglish: OTP/PIN theft, fake refund and
KYC links, the "pay / enter PIN to receive money" trick, lookalike-bank domains, QR and prize scams, plus
benign payment confirmations, real OTP-delivery SMS, defensive bank warnings and quoted-awareness messages.
They act as a frozen regression and demo set. No real user messages are included.

## Method

`npm run eval:upi` (in `server/`) runs every frozen case through the real `classify()` pipeline - local
deterministic rules plus the UCI general-spam baseline, with the optional Gemini layer off - and scores the
**final verdict the user would see**. A case counts as *flagged* when the verdict is `scam` or `suspicious`;
`uncertain` counts as not flagged. The dataset and the scorer live in version control, so the run is
repeatable. Results are written to `server/eval/upi-pilot-results.json`.

## Results (current HEAD)

- Cases: 42 (28 scam-positive, 14 benign)
- Confusion matrix: **TP 28, FP 0, TN 14, FN 0**
- Precision: **100.00%** - Recall (flagged): **100.00%** - Accuracy: **100.00%**
- HIGH_RISK recall on the 28 scam cases: **85.71%** (the rest are flagged SUSPICIOUS, not missed)
- Uncertain coverage (share of all cases the tool abstains on): **33.33%** - all 14 benign cases plus zero scam cases
- False-positive examples: none on this set
- False-negative examples: none on this set

## Honest limits

- These numbers measure agreement with 42 hand-written examples. They **cannot** be read as real-world UPI
  scam accuracy; real messages are messier, and near-duplicates of the rules' own wording are over-represented.
- The benign set is small (14). A single new false positive moves precision visibly.
- Cases were written by the project author; an independent reviewer has not re-labeled them.
- The next step remains the same: consented, redacted real UPI messages, grouped so near-identical templates
  never share a split, frozen before any further rule tuning. Only then do precision/recall claims about real
  UPI fraud become defensible, including the false-positive cost Razorpay's Risk Manager track asks about.

## What also changed with this pilot

- New deterministic signals: lookalike bank/payment-brand domains, links coupled with refund/KYC urgency, and
  the explicit "enter UPI PIN to receive money" trick. Pasted URLs are never fetched server-side (SSRF/privacy).
- All links, domains and UPI IDs in API output are masked (`sb***.xyz`, `ra***@okaxis`); the API still never
  echoes the pasted message.
- Evidence bullets and recommended actions are now returned in both English and Hindi
  (`evidenceHi` / `recommendationsHi`).
- A two-path recovery action panel (money not sent / money sent) ships in the UI with official links
  (npci.org.in/fraud-awareness, cybercrime.gov.in, 1930) and a user-initiated link to the
  [NCRP suspect repository](https://cybercrime.gov.in/Webform/suspect_search_repository.aspx) - with the
  caveat that "not listed" never means safe. The app never files reports or promises reversal.
