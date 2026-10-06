// PayPal sandbox helper (Orders v2). Sandbox only: this app never touches real money.
// Keys come from PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the environment.

const BASE = 'https://api-m.sandbox.paypal.com';

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let cached = { token: null, expiresAt: 0 };

async function getAccessToken() {
  if (cached.token && Date.now() < cached.expiresAt - 30000) return cached.token;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) throw new Error(`PayPal sign-in failed (${res.status})`);
  const data = await res.json();
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 300) * 1000 };
  return cached.token;
}

async function paypalFetch(path, body, requestId, method = 'POST') {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || `PayPal request failed (${res.status})`);
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}

export function createOrder({ amount, currency, description, requestId }) {
  return paypalFetch('/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{
      description: String(description || 'Reviewed payment').slice(0, 120),
      amount: { currency_code: currency, value: amount }
    }]
  }, requestId);
}

export function captureOrder(orderId) {
  return paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, null);
}

// Webhook support: PayPal tells the server about a finished capture on its own,
// so the receipt does not rest only on what the browser says.
let webhookId = process.env.PAYPAL_WEBHOOK_ID || null;

export function getWebhookId() {
  return webhookId;
}

export async function ensureWebhook(publicUrl) {
  if (webhookId || !paypalConfigured() || !publicUrl) return webhookId;
  const url = `${publicUrl.replace(/\/$/, '')}/api/paypal/webhook`;
  const list = await paypalFetch('/v1/notifications/webhooks', null, undefined, 'GET');
  const found = (list.webhooks || []).find((w) => w.url === url);
  if (found) { webhookId = found.id; return webhookId; }
  const made = await paypalFetch('/v1/notifications/webhooks', {
    url,
    event_types: [{ name: 'PAYMENT.CAPTURE.COMPLETED' }]
  });
  webhookId = made.id;
  return webhookId;
}

export async function verifyWebhookSignature(headers, event) {
  if (!webhookId) return false;
  const data = await paypalFetch('/v1/notifications/verify-webhook-signature', {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: event
  });
  return data.verification_status === 'SUCCESS';
}

// Read one invoice from the PayPal sandbox Invoicing API (used to check a pasted invoice).
export function getInvoice(invoiceId) {
  return paypalFetch(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`, null, undefined, 'GET');
}
