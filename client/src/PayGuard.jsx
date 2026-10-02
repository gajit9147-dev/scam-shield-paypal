import { useEffect, useRef, useState } from 'react';

const SAMPLES = [
  'Invoice 88 from Blue Cafe Vadodara: please pay $12.50 for catering order 88. Thanks!',
  'URGENT! Pay Rs 2,000 to refund.desk@okaxis in 10 minutes to release your cashback or account will be blocked'
];

function loadPayPal(clientId) {
  if (window.paypal) return Promise.resolve(window.paypal);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    s.onload = () => resolve(window.paypal);
    s.onerror = () => reject(new Error('Could not load PayPal.'));
    document.head.appendChild(s);
  });
}

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export default function PayGuard() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [config, setConfig] = useState(null);
  const [paid, setPaid] = useState(null);
  const buttonsRef = useRef(null);

  useEffect(() => {
    fetch('/api/paypal/config').then(r => r.json()).then(setConfig).catch(() => setConfig({ configured: false }));
  }, []);

  async function review() {
    setBusy(true); setError(''); setResult(null); setPaid(null);
    try {
      setResult(await postJson('/api/payments/review', { text }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const token = result?.review?.token;
    if (!token || !config?.configured || !buttonsRef.current) return undefined;
    let buttons;
    let cancelled = false;
    loadPayPal(config.clientId).then((paypal) => {
      if (cancelled || !buttonsRef.current) return;
      buttons = paypal.Buttons({
        style: { layout: 'vertical', shape: 'rect' },
        createOrder: async () => (await postJson('/api/paypal/create-order', { token })).id,
        onApprove: async (data) => setPaid(await postJson('/api/paypal/capture-order', { orderId: data.orderID })),
        onError: () => setError('PayPal could not finish this sandbox payment.')
      });
      buttons.render(buttonsRef.current);
    }).catch((e) => setError(e.message));
    return () => { cancelled = true; try { buttons?.close(); } catch { /* ignore */ } };
  }, [result, config]);

  const review_ = result?.review;
  const verdict = result?.verdict;

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <a href="/" className="text-sm text-slate-400 hover:text-slate-200">&larr; Back to Scam Shield</a>
        <h1 className="text-2xl font-semibold">Check before you pay</h1>
        <p className="text-slate-400 text-sm">
          Paste a payment request. AI and scam rules read it first. Only a request that is not flagged can open a PayPal
          <b> sandbox</b> checkout. No real money moves.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={5}
          placeholder="Paste an invoice, seller message or payment request"
          className="w-full rounded-xl bg-slate-900/70 border border-slate-700 p-3 text-sm focus:outline-none focus:border-sky-500"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={review} disabled={busy || !text.trim()} className="rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-4 py-2 text-sm font-medium">
            {busy ? 'Checking...' : 'Check request'}
          </button>
          {SAMPLES.map((s, i) => (
            <button key={i} onClick={() => setText(s)} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">
              Example {i + 1}
            </button>
          ))}
        </div>

        {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

        {result && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Verdict</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${review_.blocked ? 'bg-rose-500/20 text-rose-200' : 'bg-amber-500/20 text-amber-200'}`}>
                {verdict.label || verdict.riskLevel}
              </span>
            </div>
            <p className="text-sm">{verdict.summary || verdict.reason}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-slate-500">Pay to</dt><dd>{review_.request.payee || 'Not stated'}</dd></div>
              <div><dt className="text-slate-500">Amount asked</dt><dd>{review_.request.amount ? `${review_.request.amount} ${review_.request.currency || ''}` : 'Not found'}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">For</dt><dd>{review_.request.purpose || 'Not stated'}</dd></div>
            </dl>
            {review_.pressure.length > 0 && <p className="text-sm text-rose-200">Pressure signs: {review_.pressure.join('; ')}</p>}
            {review_.missing.length > 0 && <p className="text-sm text-amber-200">Missing from a normal invoice: {review_.missing.join('; ')}</p>}
            {review_.advice && <p className="text-sm text-slate-300">{review_.advice}</p>}

            {review_.blocked && <p className="text-sm font-medium text-rose-200">Checkout is locked. Do not pay this request.</p>}
            {!review_.blocked && review_.checkoutProblem && <p className="text-sm text-amber-200">{review_.checkoutProblem}</p>}

            {review_.canPay && !paid && (
              <div className="space-y-2">
                <p className="text-sm">Sandbox checkout: <b>{review_.checkout.amount} {review_.checkout.currency}</b>{review_.checkout.note ? ` (${review_.checkout.note})` : ''}</p>
                {config && !config.configured && <p className="text-sm text-amber-200">PayPal sandbox keys are not set on this server yet.</p>}
                <div ref={buttonsRef} />
              </div>
            )}

            {paid && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                Sandbox payment {paid.status}. {paid.amount ? `${paid.amount.value} ${paid.amount.currency_code}. ` : ''}Receipt id: {paid.captureId}
              </div>
            )}
            <p className="text-xs text-slate-500">{review_.caution}</p>
          </div>
        )}
      </div>
    </div>
  );
}
