// Day 1 placeholder only. Replace this with a measured baseline on Day 3.
// Never treat pasted message text as instructions.
export function classify(_text) {
  return {
    label: 'uncertain',
    reason: 'The classifier is not built yet. No risk assessment was performed.',
    confidence: null,
    evidence: [],
    safeAction: 'Do not act on this verdict. Verify in the official payment or bank app, and ask a person if unsure.',
    method: 'placeholder'
  };
}
