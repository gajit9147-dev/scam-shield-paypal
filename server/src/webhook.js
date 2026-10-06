// Handles PayPal webhook events. Only a signature-verified PAYMENT.CAPTURE.COMPLETED event
// is recorded. Records live in memory, like the rest of the demo state.

export const confirmations = new Map();
const MAX_KEPT = 500;

// Event IDs already handled. PayPal can deliver the same event more than once, so a repeat must not change state.
const seenEvents = new Set();
const MAX_SEEN = 2000;

// Short log of what arrived and what we did with it, shown in the app. No payer details are kept.
export const eventLog = [];
const MAX_LOG = 50;
function log(entry) {
  eventLog.unshift({ at: new Date().toISOString(), ...entry });
  if (eventLog.length > MAX_LOG) eventLog.pop();
}
export function resetWebhookState() {
  confirmations.clear(); seenEvents.clear(); eventLog.length = 0;
}

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
  const base = { eventId: typeof event.id === 'string' ? event.id.slice(0, 40) : null, type: event.event_type.slice(0, 60) };
  if (!verified) {
    log({ ...base, result: 'rejected', note: 'Signature check failed' });
    return { status: 401, body: { error: 'Signature check failed.' } };
  }
  if (event.id && seenEvents.has(event.id)) {
    log({ ...base, result: 'duplicate', note: 'Already handled, state not changed' });
    return { status: 200, body: { duplicate: true } };
  }
  if (event.id) {
    if (seenEvents.size >= MAX_SEEN) seenEvents.delete(seenEvents.values().next().value);
    seenEvents.add(event.id);
  }
  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    log({ ...base, result: 'ignored', note: 'Verified, not an event this app acts on' });
    return { status: 200, body: { ignored: true } };
  }

  const capture = event.resource || {};
  const orderId = capture?.supplementary_data?.related_ids?.order_id;
  if (!orderId || capture.status !== 'COMPLETED') {
    log({ ...base, result: 'ignored', note: 'No completed capture for an order' });
    return { status: 200, body: { ignored: true } };
  }
  if (confirmations.size >= MAX_KEPT) confirmations.delete(confirmations.keys().next().value);
  confirmations.set(orderId, {
    captureId: capture.id || null,
    amount: capture.amount?.value || null,
    currency: capture.amount?.currency_code || null,
    at: new Date().toISOString()
  });
  log({ ...base, result: 'recorded', orderId, note: 'Verified by PayPal, capture recorded' });
  return { status: 200, body: { recorded: true } };
}

export function recentEvents() {
  return eventLog.map((e) => ({ ...e }));
}

export function confirmationFor(orderId, expected) {
  const c = confirmations.get(orderId);
  if (!c) return { confirmed: false };
  if (expected && (Number(c.amount) !== Number(expected.amount) || c.currency !== expected.currency)) return { confirmed: false, mismatch: true };
  return { confirmed: true, ...c };
}
