# Day 1 architecture and scope

**Workflow:** A merchant-support reviewer pastes a redacted UPI/payment message into the React UI. Vite sends it to Express `POST /api/check`. The server validates the input and currently returns only an **uncertain placeholder**, with reason, confidence, evidence, safe action and method. The reviewer checks the bank/payment provider directly and makes the decision. No automatic blocking or payment action.

**Label rules for later work:** `scam` means an attempt to obtain credentials/money or to mislead with a fake payment notice; `safe` means a genuine non-manipulative payment message; `uncertain` means insufficient evidence. Text alone cannot verify a sender or link. A real classifier is not implemented on Day 1.

**Privacy and threat model:** No inbox access, raw-message logging, third-party requests or database storage. Don't paste private SMS into a public demo. Later classifier inputs must be treated as untrusted text, never instructions. Strip private identifiers from any training examples and keep API credentials on the server only. Rate limiting, timeout, model fallback, evaluation and human-review workflow remain future work.

**Evaluation plan:** Freeze a held-out test set before tuning; compare baseline and LLM on the same examples. Report TP/FP/TN/FN, scam precision and recall, abstention/coverage, and false-positive examples. UCI general-spam results are separate from India/UPI results. There are no performance claims yet.
