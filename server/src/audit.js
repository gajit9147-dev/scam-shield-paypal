// A short redacted record of what the payment gate decided. It keeps decisions and reasons only:
// never the request text, tokens, secrets or names. It lives in memory, so it is cleared when the server restarts.
const MAX = 100;
const events = [];
const SAFE_KEYS = ['stage', 'decision', 'risk', 'reasons', 'amount', 'currency', 'orderId', 'outcome'];

export function record(entry) {
  const clean = { at: new Date().toISOString() };
  for (const k of SAFE_KEYS) {
    if (entry[k] === undefined || entry[k] === null) continue;
    clean[k] = Array.isArray(entry[k]) ? entry[k].map((x) => String(x).slice(0, 80)).slice(0, 8) : String(entry[k]).slice(0, 80);
  }
  events.push(clean);
  if (events.length > MAX) events.shift();
  return clean;
}
export function recent(n = 30) { return events.slice(-n).reverse(); }
export function clearAudit() { events.length = 0; }
