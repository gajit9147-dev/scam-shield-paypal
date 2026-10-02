// Handles PayPal webhook events. Only a signature-verified PAYMENT.CAPTURE.COMPLETED event
// is recorded. Records live in memory, like the rest of the demo state.

export const confirmations = new Map();
const MAX_KEPT = 500;

export async function processWebhook({ headers, event }, verify) {
  if (!event || typeof event !== 'object' || typeof event.event_type !== 'string') {
    return { status: 400, body: { error: 'Not a PayPal event.' } };
  }
  let verified = false;
  try {
    verified = await verify(headers, event);
  } catch {
    verified = false;
  }
  if (!verified) return { status: 401, body: { error: 'Signature check failed.' } };
  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return { status: 200, body: { ignored: true } };

  const capture = event.resource || {};
  const orderId = capture?.supplementary_data?.related_ids?.order_id;
  if (!orderId || capture.status !== 'COMPLETED') return { status: 200, body: { ignored: true } };
  if (confirmations.size >= MAX_KEPT) confirmations.delete(confirmations.keys().next().value);
  confirmations.set(orderId, {
    captureId: capture.id || null,
    amount: capture.amount?.value || null,
    currency: capture.amount?.currency_code || null,
    at: new Date().toISOString()
  });
  return { status: 200, body: { recorded: true } };
}

export function confirmationFor(orderId, expected) {
  const c = confirmations.get(orderId);
  if (!c) return { confirmed: false };
  if (expected && (Number(c.amount) !== Number(expected.amount) || c.currency !== expected.currency)) return { confirmed: false, mismatch: true };
  return { confirmed: true, ...c };
}
