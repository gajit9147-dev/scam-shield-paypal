// Capture a PayPal order at most once and never trust a timeout.
// If the same order is captured twice, the stored result is returned and PayPal is not called again.
// If the capture call fails, the order is read back from PayPal first: a payment that did go through is reported as it is,
// and an order that did not is reported as not paid. Nothing is retried blindly.
export function readCapture(data, expected) {
  const unit = data?.purchase_units?.[0]?.payments?.captures?.[0];
  const ok = data?.status === 'COMPLETED' && unit?.amount
    && Number(unit.amount.value) === Number(expected.amount) && unit.amount.currency_code === expected.currency;
  return { ok: Boolean(ok), unit };
}

export async function captureOnce({ orderId, expected, capture, getOrder, done }) {
  const earlier = done.get(orderId);
  if (earlier) return { kind: 'already_paid', result: earlier.result };
  let data;
  let captureError = null;
  try {
    data = await capture(orderId);
  } catch (err) {
    captureError = err;
    try { data = await getOrder(orderId); } catch { return { kind: 'unknown', error: captureError }; }
  }
  const { ok, unit } = readCapture(data, expected);
  if (!ok) return { kind: captureError ? 'not_paid' : 'mismatch', status: data?.status || null, error: captureError };
  const result = { status: data.status, orderId, captureId: unit?.id || null, captureStatus: unit?.status || null, amount: unit.amount, payerName: data?.payer?.name?.given_name || null };
  // amount and currency stay at the top level because the webhook confirmation compares against them.
  done.set(orderId, { amount: unit.amount.value, currency: unit.amount.currency_code, result });
  if (done.size > 500) done.delete(done.keys().next().value);
  return { kind: captureError ? 'reconciled' : 'captured', result };
}
