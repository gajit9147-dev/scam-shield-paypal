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

async function paypalFetch(path, body, requestId) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
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
