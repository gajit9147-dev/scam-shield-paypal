// Compares a pasted invoice with the real invoice PayPal holds. Never says "fake":
// only verified (matches PayPal), mismatch (differs from PayPal), or unverified (could not check).
import { regexExtract } from './paymentReview.js';

const ID_RE = /\bINV2?-[A-Z0-9-]{6,40}\b/i;

export function invoiceFacts(invoice) {
  const total = invoice?.amount || invoice?.due_amount || null;
  return {
    id: invoice?.id || null,
    number: invoice?.detail?.invoice_number || null,
    status: invoice?.status || null,
    amount: total?.value != null ? Number(total.value) : null,
    currency: total?.currency_code || null
  };
}

export async function verifyInvoice({ text, invoiceId }, { getInvoice }) {
  const pasted = regexExtract(String(text || ''));
  const wantedId = (invoiceId || String(text || '').match(ID_RE)?.[0] || '').trim();
  const unverified = (reason) => ({ result: 'unverified', reason, pasted: { amount: pasted.amount, currency: pasted.currency, invoiceId: wantedId || null } });
  if (!wantedId) return unverified('No PayPal invoice ID found. Add the invoice ID to check it against PayPal.');
  if (!/^[A-Za-z0-9-]{6,60}$/.test(wantedId)) return unverified('That does not look like a PayPal invoice ID.');
  let invoice;
  try {
    invoice = await getInvoice(wantedId);
  } catch (err) {
    return unverified(err.status === 404 ? 'PayPal has no invoice with that ID in this sandbox.' : 'Could not reach PayPal to check the invoice.');
  }
  const real = invoiceFacts(invoice);
  if (pasted.amount == null || !pasted.currency) {
    return { result: 'unverified', reason: 'The pasted text has no clear amount and currency to compare.', paypal: real, pasted: { amount: pasted.amount, currency: pasted.currency, invoiceId: wantedId } };
  }
  const diffs = [];
  if (real.amount == null || Math.abs(real.amount - pasted.amount) > 0.005) diffs.push({ field: 'amount', pasted: pasted.amount, paypal: real.amount });
  if (real.currency !== pasted.currency) diffs.push({ field: 'currency', pasted: pasted.currency, paypal: real.currency });
  return {
    result: diffs.length ? 'mismatch' : 'verified',
    differences: diffs,
    paypal: real,
    pasted: { amount: pasted.amount, currency: pasted.currency, invoiceId: wantedId },
    note: 'This compares the amount and currency with the PayPal sandbox invoice. It does not prove the sender is who they claim to be.'
  };
}
