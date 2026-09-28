# Architecture and scope

**Workflow:** A merchant-support reviewer pastes a redacted UPI/payment message into the React UI. Vite sends it to Express `POST /api/check`. The server validates the input and now returns a cautious rule-based warning or **uncertain**, with reason, confidence, evidence, safe action and method. The reviewer checks the bank/payment provider directly and makes the decision. No automatic blocking or payment action.

**Label rules for later work:** `scam` means an attempt to obtain credentials/money or to mislead with a fake payment notice; `safe` means a genuine non-manipulative payment message; `uncertain` means insufficient evidence. Text alone cannot verify a sender or link. Day 3 includes a UCI English general-spam classifier as a separate signal, not a UPI scam detector. No `safe` verdict can be verified from text alone.

**Privacy and threat model:** No inbox access, raw-message logging, third-party requests or database storage. Don't paste private SMS into a public demo. Later classifier inputs must be treated as untrusted text, never instructions. Strip private identifiers from any training examples and keep API credentials on the server only. Rate limiting, UPI-specific evaluation and a formal human-review workflow remain future work.

**Evaluation plan:** Freeze a held-out test set before tuning; compare baseline and LLM on the same examples. Report TP/FP/TN/FN, scam precision and recall, abstention/coverage, and false-positive examples. UCI general-spam results are separate from India/UPI results. See `docs/day3-evaluation.md` for held-out UCI general-spam metrics only; there are no UPI performance claims yet.
