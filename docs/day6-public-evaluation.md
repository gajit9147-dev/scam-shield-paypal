# Day 6: public-source evaluation on downloaded Indian scam datasets

This evaluation runs **downloaded, publicly available** Indian scam/spam message datasets through the real
`classify()` pipeline. It is separate from the [Day 5 synthetic pilot](day5-upi-pilot-evaluation.md), which is
hand-written and stays labeled as such.

## Sources

- [`anmolshrivastav/scam-hum-india`](https://huggingface.co/datasets/anmolshrivastav/scam-hum-india) (Hugging Face,
  2,272 rows, ham/spam) - Indian scam patterns: KYC/Aadhaar phishing, UPI/bank fraud, lottery, OTP theft, fake jobs.
- [`bolewara/hinglish-scam-text-dataset`](https://huggingface.co/datasets/bolewara/hinglish-scam-text-dataset)
  (Hugging Face, 3,787 rows, binary) - English + Hinglish financial scam/fraud texts.

Both datasets carry keyword-based labels from their authors, not hand-verified labels.

## Method

- Sampled with a strict fraud-pattern filter (OTP/PIN theft, KYC/Aadhaar threats, account blocking, prize/lottery,
  pay-a-fee-to-receive, suspicious-activity verification phishing). Pure promotional spam (telecom offers, credit
  card ads) was **excluded** - it is spam but not fraud, and judging it is not this tool's job.
- Deduped, length-capped at 400 characters, frozen into
  [`server/eval/public-upi-dataset.json`](../server/eval/public-upi-dataset.json) with per-case source attribution.
- Hand-reviewed for source-label noise. One defensive bank message ("Never share your OTP...") mislabeled as scam
  by the source was removed; the removal is documented here.
- Run with `npm run eval:public` (in `server/`). A *flagged* verdict (`scam` or `suspicious`) counts as positive.
  Results: `server/eval/public-eval-results.json`.

## Results (current HEAD)

- Cases: **129** (69 scam-positive, 60 benign)
- Confusion matrix: **TP 68, FP 1, TN 59, FN 1**
- In plain counts: **68 of 69 scam cases flagged, 59 of 60 benign cases not flagged.** Not real-world fraud accuracy (keyword-labelled public data).
- Precision: **98.55%** - Recall: **98.55%** - Accuracy: **98.45%**
- False positive (kept, documented): `It says account is blocked` - a two-clause benign chat fragment the cautious
  rules flag as SUSPICIOUS. This is the false-positive cost of a cautious posture: a benign fragment about an
  account block gets a warning. The tool never says "safe", so the user cost is an extra verification step, not
  a missed scam.
- False negative (kept, documented): a UK "lucky day" spam (`IMPORTANT INFORMATION 4 ORANGE USER...`) with no
  Indian payment-fraud pattern - international promo-spam outside the tool's target patterns.

## Honest limits

- Source labels are keyword-based; despite review, some noise remains. These numbers are still **not** validated
  real-world UPI accuracy - the positive set is filtered toward the fraud patterns the rules target.
- The benign set (60) includes payment-flavoured ham (bank mentions, paid/notices), which is the realistic
  false-positive risk area, but real inboxes carry more variety.
- The next step is unchanged: consented, redacted real UPI messages with independent labels, frozen before any
  further rule tuning.
