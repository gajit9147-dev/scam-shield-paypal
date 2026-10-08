import { useEffect, useState, useRef } from 'react';

import { loadPayPal } from './paypalClient.js';

const TASKS = [
  ['Pay a clean request', 'Pay this request: Invoice 88 from Blue Cafe Vadodara: please pay $12.50 for catering order 88. Thanks!'],
  ['Pay a scam', 'Pay this right now: URGENT! Pay $25 to refund.desk@paypa1-help.com in 10 minutes to release your refund or your account will be blocked']
];

async function call(url, body, timeoutMs = 0) {
  const ctl = timeoutMs ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  let res;
  try {
    res = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl?.signal } : undefined);
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The agent took too long and was stopped. No payment was made. Try again.');
    throw e;
  } finally { if (timer) clearTimeout(timer); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

const STEP_TEXT = {
  order_created: (e) => `Created sandbox order ${e.orderId}. The buyer must approve it.`,
  blocked: (e) => e.reason || 'Blocked by the ScamShield check. No order was made.',
  refused: (e) => e.reason || 'Refused.',
  ran: (e) => 'Looked it up in PayPal.',
  error: () => 'PayPal returned an error.'
};

function AgentOrder({ order }) {
  const host = useRef(null);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  useEffect(() => {
    let cancelled = false;
    let buttons;
    (async () => {
      try {
        const config = await call('/api/paypal/config');
        if (!config.configured || !config.clientId) throw new Error('PayPal sandbox is not configured.');
        const paypal = await loadPayPal(config.clientId);
        if (cancelled || !host.current) return;
        buttons = paypal.Buttons({
          style: { layout: 'vertical' },
          createOrder: async () => order.id,
          onApprove: async data => {
            try { const r = await call('/api/paypal/capture-order', { orderId: data.orderID, orderTicket: order.orderTicket }); if (!cancelled) setReceipt(r); }
            catch (e) { if (!cancelled) setError(e.message); }
          },
          onError: e => { if (!cancelled) setError(e.message || 'PayPal could not finish.'); }
        });
        await buttons.render(host.current);
      } catch (e) { if (!cancelled) setError(e.message); }
    })();
    return () => { cancelled = true; try { Promise.resolve(buttons?.close?.()).catch(() => {}); } catch { /* ignore SDK cleanup error */ } };
  }, [order.id, order.orderTicket]);
  return <div className="pg-ag-card"><p>Sandbox order {order.id}: {order.amount} {order.currency}. Payment goes to the demo merchant, not a verified seller. Approve only inside PayPal.</p>{receipt ? <p role="status">Sandbox payment captured: {receipt.amount?.value} {receipt.amount?.currency_code}. Order {receipt.orderId}.</p> : <div ref={host} />}{error && <p role="alert">{error}</p>}</div>;
}

export default function AgentPanel() {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState('');
  const [hooks, setHooks] = useState(null);

  const loadHooks = () => call('/api/paypal/webhook-events').then(setHooks).catch(() => setHooks({ registered: false, events: [] }));
  useEffect(() => { loadHooks(); }, []);

  async function run() {
    setBusy(true); setErr(''); setOut(null);
    try { setOut(await call('/api/agent/run', { prompt }, 75000)); } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div className="pg-agent">
      <p className="pg-lead" style={{ marginTop: 0 }}>Give the agent a task. It uses PayPal's Agent Toolkit to prepare a sandbox order after the scam check. Merchant records stay private. It cannot pay: the buyer approves in PayPal.</p>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={1200} rows={3} className="pg-box" placeholder="Ask the agent to check a payment request" />
      <div className="pg-chips">
        {TASKS.map(([label, t]) => <button key={label} className="pg-chip" onClick={() => setPrompt(t)}>{label}</button>)}
      </div>
      <div className="pg-row">
        <span className="pg-hint">PayPal sandbox only. The AI can take up to a minute on the free server.</span>
        <button className="pg-btn" onClick={run} disabled={busy || prompt.trim().length < 3}>{busy ? 'Working...' : 'Run agent \u2192'}</button>
      </div>
      {err && <div className="pg-error">{err}</div>}
      {out && (
        <div className="pg-ag-out">
          {out.steps?.length > 0 && (
            <ul className="pg-ag-steps">
              {out.steps.map((s, i) => (
                <li key={i} className={s.outcome}><b>{s.tool.replace(/_/g, ' ')}</b><span>{(STEP_TEXT[s.outcome] || STEP_TEXT.ran)(s)}</span></li>
              ))}
            </ul>
          )}
          <p className="pg-ag-answer">{out.answer}</p>
          {out.orders?.map(o => <AgentOrder key={o.id} order={o} />)}
        </div>
      )}

      <div className="pg-ag-grid">
        <div className="pg-ag-card">
          <h3>Merchant records are private</h3>
          <p className="pg-hint">This public demo cannot list or look up merchant invoices, orders or transactions. Use the message checker to review pasted invoice text without accessing merchant records.</p>
        </div>
        <div className="pg-ag-card">
          <h3>PayPal webhook log</h3>
          <p className="pg-hint">{hooks?.registered ? 'Webhook is registered with PayPal.' : 'Webhook not registered on this server.'} Latest events PayPal sent:</p>
          {hooks?.events?.length ? (
            <ul className="pg-ag-hooks">{hooks.events.slice(0, 6).map((e, i) => <li key={i}><b>{e.type || e.event_type}</b><span>{e.at || e.time || ''}</span></li>)}</ul>
          ) : <p className="pg-hint">No events yet. They show up after a sandbox payment.</p>}
          <button className="pg-btn-o" onClick={loadHooks}>Refresh</button>
        </div>
      </div>
    </div>
  );
}
