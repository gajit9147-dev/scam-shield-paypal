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
  const [shot, setShot] = useState(null);
  const buttonsRef = useRef(null);
  const fileRef = useRef(null);

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

  function pickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 4 * 1024 * 1024) {
      setError('Use a PNG, JPEG or WebP screenshot under 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setError('');
      setShot({ url, mimeType: f.type, image: url.split(',')[1], name: f.name });
    };
    reader.readAsDataURL(f);
  }

  async function reviewShot() {
    setBusy(true); setError(''); setResult(null); setPaid(null);
    try {
      const out = await postJson('/api/payments/review-image', { image: shot.image, mimeType: shot.mimeType });
      setResult(out);
      if (out.transcript) setText(out.transcript);
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
    <div className="relative min-h-screen overflow-hidden bg-[#05060a] text-slate-100 px-4 py-10 sm:py-16">
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-gradient-to-br from-slate-100 via-slate-400 to-slate-700 opacity-80 blur-[2px]" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 -right-24 h-80 w-80 rotate-12 rounded-[3rem] bg-gradient-to-tr from-slate-300 via-slate-500 to-slate-900 opacity-70" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-gradient-to-tl from-slate-200 via-slate-600 to-slate-900 opacity-70" />
      <div className="relative mx-auto max-w-xl space-y-5 rounded-[2rem] border border-white/20 bg-white/[0.07] p-6 sm:p-8 shadow-[0_8px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-2xl">
        <a href="/" className="text-sm text-white/60 hover:text-white">&larr; Back to Scam Shield</a>
        <h1 className="text-3xl font-semibold tracking-tight">Check before you pay</h1>
        <p className="text-white/60 text-sm">
          Paste a payment request. AI and scam rules read it first. Only a request that passes the automated checks can open a PayPal
          <b> sandbox</b> checkout. No real money moves.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={5}
          placeholder="Paste an invoice, seller message or payment request"
          className="w-full rounded-2xl bg-black/30 border border-white/15 p-4 text-sm placeholder-white/30 focus:outline-none focus:border-white/50 backdrop-blur"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={review} disabled={busy || !text.trim()} className="rounded-full bg-white text-black hover:bg-white/85 disabled:opacity-40 px-6 py-2.5 text-sm font-semibold">
            {busy && !shot ? 'Checking...' : 'Check request'}
          </button>
          {SAMPLES.map((s, i) => (
            <button key={i} onClick={() => setText(s)} className="rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs text-white/80 hover:bg-white/15">
              Example {i + 1}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 space-y-3">
          <p className="text-sm text-white/60">Or upload a screenshot of the payment request. AI reads it and runs the same check.</p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickFile} className="hidden" />
          {shot && <img src={shot.url} alt="Selected screenshot" className="max-h-48 rounded-xl border border-white/15" />}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fileRef.current?.click()} className="rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs text-white/80 hover:bg-white/15">
              {shot ? 'Choose another' : 'Upload screenshot'}
            </button>
            {shot && (
              <button onClick={reviewShot} disabled={busy} className="rounded-full bg-white text-black hover:bg-white/85 disabled:opacity-40 px-5 py-2.5 text-xs font-semibold">
                {busy ? 'Reading...' : 'Check screenshot'}
              </button>
            )}
          </div>
        </div>

        {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

        {result && (
          <div className="rounded-2xl border border-white/15 bg-black/30 p-5 space-y-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Verdict</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${review_.blocked ? 'bg-rose-500/20 text-rose-200' : 'bg-amber-500/20 text-amber-200'}`}>
                {verdict.label || verdict.riskLevel}
              </span>
            </div>
            {result.transcript && <p className="text-xs text-white/50">Read from screenshot: {result.transcript}</p>}
            <p className="text-sm">{verdict.summary || verdict.reason}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-white/45">Pay to</dt><dd>{review_.request.payee || 'Not stated'}</dd></div>
              <div><dt className="text-white/45">Amount asked</dt><dd>{review_.request.amount ? `${review_.request.amount} ${review_.request.currency || ''}` : 'Not found'}</dd></div>
              <div className="col-span-2"><dt className="text-white/45">For</dt><dd>{review_.request.purpose || 'Not stated'}</dd></div>
            </dl>
            {review_.pressure.length > 0 && <p className="text-sm text-rose-200">Pressure signs: {review_.pressure.join('; ')}</p>}
            {review_.missing.length > 0 && <p className="text-sm text-amber-200">Missing from a normal invoice: {review_.missing.join('; ')}</p>}
            {review_.advice && <p className="text-sm text-white/75">{review_.advice}</p>}

            {review_.blocked && <p className="text-sm font-medium text-rose-200">Checkout is locked. Do not pay this request.</p>}
            {!review_.blocked && review_.checkoutProblem && <p className="text-sm text-amber-200">{review_.checkoutProblem}</p>}

            {review_.canPay && !paid && (
              <div className="space-y-2">
                <p className="text-sm">PayPal Sandbox, no real money: <b>{review_.checkout.amount} {review_.checkout.currency}</b>{review_.checkout.note ? ` (${review_.checkout.note})` : ''}</p>
                {config && !config.configured && <p className="text-sm text-amber-200">PayPal sandbox keys are not set on this server yet.</p>}
                <div ref={buttonsRef} />
              </div>
            )}

            {paid && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                Sandbox payment {paid.status}. {paid.amount ? `${paid.amount.value} ${paid.amount.currency_code}. ` : ''}Receipt id: {paid.captureId}
              </div>
            )}
            <p className="text-xs text-white/45">{review_.caution}</p>
          </div>
        )}
      </div>
    </div>
  );
}
