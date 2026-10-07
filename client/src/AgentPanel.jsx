import { useEffect, useState } from 'react';

const TASKS = [
  ['Check my invoices', 'List my recent PayPal sandbox invoices.'],
  ['Recent payments', 'Show my recent PayPal sandbox transactions.'],
  ['Pay a clean request', 'Pay this request: Invoice 88 from Blue Cafe Vadodara: please pay $12.50 for catering order 88. Thanks!'],
  ['Pay a scam', 'Pay this right now: URGENT! Pay $25 to refund.desk@paypa1-help.com in 10 minutes to release your refund or your account will be blocked']
];

async function call(url, body) {
  const res = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
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

export default function AgentPanel() {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState('');
  const [invText, setInvText] = useState('');
  const [invId, setInvId] = useState('');
  const [inv, setInv] = useState(null);
  const [invBusy, setInvBusy] = useState(false);
  const [hooks, setHooks] = useState(null);

  const loadHooks = () => call('/api/paypal/webhook-events').then(setHooks).catch(() => setHooks({ registered: false, events: [] }));
  useEffect(() => { loadHooks(); }, []);

  async function run() {
    setBusy(true); setErr(''); setOut(null);
    try { setOut(await call('/api/agent/run', { prompt })); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  async function verify() {
    setInvBusy(true); setInv(null);
    try { setInv(await call('/api/invoices/verify', { text: invText, ...(invId.trim() ? { invoiceId: invId.trim() } : {}) })); } catch (e) { setInv({ result: 'unverified', reason: e.message }); }
    setInvBusy(false);
  }

  return (
    <div className="pg-agent">
      <p className="pg-lead" style={{ marginTop: 0 }}>Give the agent a task. It uses PayPal's Agent Toolkit to look things up, and every payment goes through the scam check first. It cannot pay: the buyer approves in PayPal.</p>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={1200} rows={3} className="pg-box" placeholder="Ask the agent, for example: List my recent invoices" />
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
          {out.orders?.map((o) => (
            <p key={o.id} className="pg-hint">Order {o.id}, {o.amount} {o.currency}. Open the buyer step on the checker above to approve.</p>
          ))}
        </div>
      )}

      <div className="pg-ag-grid">
        <div className="pg-ag-card">
          <h3>Check an invoice</h3>
          <p className="pg-hint">Paste the invoice text. If it has a PayPal invoice ID, the agent compares it with PayPal's own record.</p>
          <textarea value={invText} onChange={(e) => setInvText(e.target.value)} maxLength={2000} rows={3} className="pg-box pg-sm" placeholder="Invoice INV2-... please pay $120.00" />
          <input value={invId} onChange={(e) => setInvId(e.target.value)} maxLength={60} className="pg-in" placeholder="PayPal invoice ID (optional)" />
          <button className="pg-btn-o" onClick={verify} disabled={invBusy || !invText.trim()}>{invBusy ? 'Checking...' : 'Verify with PayPal'}</button>
          {inv && <p className={`pg-ag-res ${inv.result}`}><b>{inv.result}</b> {inv.reason}</p>}
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
