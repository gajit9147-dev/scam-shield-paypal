# What does the AI add? Rules only vs Gemini only vs fusion

Set: `server/eval/paraphrase-set.json`, 30 hand-written payment messages (15 scam paraphrases, 15 benign). Run: `node eval/run-ablation.js <server-url>` (needs a server with a Gemini key). Raw rows: `server/eval/ablation-results.json`.

| Mode | Scam cases flagged | Benign cases not flagged |
|---|---|---|
| Rules only (offline, no Gemini) | 6 / 15 | 15 / 15 |
| Gemini only (high-severity Gemini signal in the live response) | 15 / 15 | 15 / 15 |
| Fusion (rules + Gemini, the shipped verdict) | 15 / 15 | 15 / 15 |

Reading it honestly:
- The rules alone miss 9 of 15 reworded scams. Gemini is what catches reworded fraud, so the AI is doing real work here, not decoration.
- Fusion keeps the rules as a deterministic floor and as the explanation layer; on this set it matched Gemini alone. We do not claim fusion beats Gemini on accuracy here.
- 30 cases written by the project team is a small sample, not a real-world benchmark. Some rules were tuned while building this set, so rules-only may look better or worse on unseen text.
- Fail-closed: if Gemini does not answer, the payment review keeps checkout locked instead of clearing on rules alone.
