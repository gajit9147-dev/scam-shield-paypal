import { useEffect, useRef, useState } from 'react';

import { whyRisky } from './whyRisky.js';

const SAMPLES = [
  ['Normal invoice', 'Invoice 88 from Blue Cafe Vadodara: please pay $12.50 for catering order 88. Thanks!'],
  ['Refund scam', 'URGENT! Pay $25 to refund.desk@paypa1-help.com in 10 minutes to release your refund or your account will be blocked'],
  ['OTP theft', 'Your bank account is locked. Share the OTP 483920 sent to your phone with our agent to unlock it today'],
  ['Fake prize', 'Congratulations! You won a $500 gift card. Pay a $15 delivery fee at https://claim-prize.example.invalid to get it'],
  ['Friend payback', 'Hey, here are the tickets from last night. Please send me $20 for your share, thanks!'],
  ['India: fake KYC', 'Dear customer, your KYC is expired and your account will be blocked today. Update KYC now at http://sbi-kyc-update.example.invalid or call 9876543210'],
  ['India: QR refund', 'Hi, I will refund your Rs 4,999 order. Scan this QR code and enter your UPI PIN to receive the money'],
  ['India: job fee', 'Work from home job offer, earn Rs 5000 daily. Pay a Rs 999 registration fee to confirm your joining today'],
  ['India: UPI collect', 'You have a UPI collect request of Rs 9,999 from Cashback Rewards. Approve it to receive your cashback now'],
  ['Fake support', 'PayPal support: your account is limited. Pay a $30 verification fee now to support-help@gmail.com or lose access']
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


const FLAG_WORDS = /(\bwon\b|\bwinner\b|prize|lottery|gift card|claim|urgent|immediately|within \d+ (?:minutes|hours)|last chance|otp|pin\b|cvv|password|kyc|refund|cashback|fee|processing charge|verify|blocked|suspended|click|https?:\/\/\S+|bit\.ly\/\S+|gift\s?cards?|wire|crypto|bitcoin)/gi;

function Highlighted({ text }) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(FLAG_WORDS)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<mark key={m.index} className="rounded bg-rose-400/30 px-0.5 text-rose-100">{m[0]}</mark>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p className="text-sm text-white/80 break-words">{parts}</p>;
}

function confidenceLine(review, verdict) {
  const n = (verdict?.evidence || []).length;
  const agree = review.aiUsed ? 'AI and rules both ran' : 'rules only, AI did not answer';
  const level = review.riskScore >= 70 || review.riskScore <= 10 ? 'High' : 'Medium';
  return `Signal strength: ${level}. ${n} signal${n === 1 ? '' : 's'} found, ${agree}. This is a risk check, not proof.`;
}

function downloadReport(result, shownText) {
  const r = result.review; const v = result.verdict;
  const body = [
    'ScamShield evidence report',
    `Time: ${new Date().toISOString()}`,
    `Decision: ${r.blocked ? 'BLOCKED' : r.canPay ? 'CLEARED for PayPal sandbox' : 'NOT PAYABLE'}`,
    `Risk signals: ${r.riskScore}/100 (not a probability)`,
    `Category: ${v.categoryLabel || v.category || 'n/a'}`,
    `Amount: ${r.request?.amount ?? 'not found'} ${r.request?.currency || ''}`,
    `Payee: ${r.request?.payee || 'not stated'}`,
    '',
    'Request text:',
    shownText || '(not available)',
    '',
    'Evidence:',
    ...(v.evidence || []).map((e) => `- ${e}`),
    '',
    `Summary: ${v.summary || v.reason || ''}`,
    r.caution || ''
  ].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
  a.download = 'scamshield-evidence-report.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

const SCAN_STEPS = ['Reading the request...', 'Checking pressure tactics...', 'Running the scam rules...', 'Asking the AI for a second opinion...'];

function Steps({ review }) {
  const blocked = review.blocked;
  const steps = [
    ['1', 'AI + rules read it', 'done'],
    ['2', 'Review verdict', blocked ? 'stop' : 'done'],
    ['3', '15 min authorization', blocked ? 'off' : review.canPay ? 'done' : 'off'],
    ['4', 'PayPal Sandbox', blocked ? 'off' : review.canPay ? 'next' : 'off']
  ];
  const tone = { done: 'bg-emerald-400/20 text-emerald-100 border-emerald-300/30', stop: 'bg-rose-500/25 text-rose-100 border-rose-300/40', next: 'bg-sky-400/20 text-sky-100 border-sky-300/30', off: 'bg-white/5 text-white/35 border-white/10' };
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map(([n, label, st]) => (
        <li key={n} className={`rounded-xl border px-3 py-2 text-xs ${tone[st]}`}>
          <span className="font-semibold">{n}</span> {label}
          {st === 'stop' && <div className="mt-0.5 font-semibold">Stopped here</div>}
        </li>
      ))}
    </ol>
  );
}

function AiPanel({ verdict, review }) {
  const signals = Array.isArray(verdict.signals) ? verdict.signals : [];
  const ruleHits = signals.filter(x => x.source === 'local_rules').length;
  const aiHits = signals.filter(x => x.source === 'gemini').length;
  const agree = review.aiUsed ? (ruleHits > 0 && aiHits > 0 ? 'AI and rules both found warning signs' : ruleHits === 0 && aiHits === 0 ? 'AI and rules found no strong signs' : 'AI and rules differ, so the stricter one counts') : 'AI did not answer this time, rules only';
  const rows = [
    ['Amount', review.request.amount ? `${review.request.amount} ${review.request.currency || ''}` : 'Not found'],
    ['Pay to', review.request.payee || 'Not stated'],
    ['For', review.request.purpose || 'Not stated'],
    ['Pressure signs', review.pressure.length ? review.pressure.join('; ') : 'None found'],
    ['Missing from invoice', review.missing.length ? review.missing.join('; ') : 'Nothing obvious'],
    ['AI vs rules', agree]
  ];
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">What AI detected</p>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([k, v]) => (<div key={k} className="flex justify-between gap-4"><dt className="text-white/45">{k}</dt><dd className="text-right">{v}</dd></div>))}
      </dl>
    </div>
  );
}

function WhyBlocked({ verdict }) {
  const [lang, setLang] = useState('en');
  const signals = (Array.isArray(verdict.signals) ? verdict.signals : []).filter(x => x.evidence).slice(0, 6);
  return (
    <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-200">Why this was blocked</p>
      {verdict.categoryLabel && <p className="mb-2 text-sm font-medium">{verdict.categoryLabel}</p>}
      <div className="mb-3 rounded-xl bg-black/20 p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/60">In simple words</span>
          <button type="button" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className="rounded-full border border-white/25 px-2.5 py-0.5 text-xs text-white/80 hover:bg-white/10">{lang === 'en' ? 'Hinglish' : 'English'}</button>
        </div>
        <p className="text-sm text-white/90">{whyRisky(verdict.category, lang)}</p>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-rose-100/90">
        {signals.map((x, i) => (<li key={i}>{x.evidence} <span className="text-white/40">({x.source === 'gemini' ? 'AI' : 'rule'})</span></li>))}
      </ul>
      {verdict.safeAction && <p className="mt-2 text-sm text-white/75">{verdict.safeAction}</p>}
    </div>
  );
}


// Verbatim excerpts from AI reviews of this project. They are AI output, not feedback from human users, and are labeled that way.
const AI_FEEDBACK = [
  { who: 'ChatGPT, first review', score: '8.3/10', text: 'Technically impressive and demoable with unusually strong security controls, but limited by detection generalization, payee verification, and sandbox-only realism.' },
  { who: 'ChatGPT, first review', score: '8.3/10', text: 'Strong security architecture for a hackathon: server-side blocking, signed short-lived single-use tokens, amount binding, capture checks, and PayPal webhook verification.' },
  { who: 'ChatGPT, first review', score: '8.3/10', text: 'Payee verification is absent, despite being central to payment safety.' },
  { who: 'ChatGPT, second review after fixes', score: '8.4/10', text: 'Technically serious and unusually well-engineered for a hackathon, but validation/generalization and the limited real-world payment-verification scope prevent it from reaching top-tier scores.' },
  { who: 'ChatGPT, second review after fixes', score: '8.4/10', text: 'Excellent transparency: you openly disclose sandbox/payee-verification limitations and the 30-message development-set contamination.' },
  { who: 'ChatGPT, second review after fixes', score: '8.4/10', text: 'The PayPal integration is ultimately a sandbox gate, not verification that money is going to the extracted seller.' },
  { who: 'Gemini Pro review', score: '8/10', text: 'Highly impressive technical foundation, security architecture, and testing, but the AI integration currently creates false positives and it lacks crucial payee-level verification.' },
  { who: 'Gemini Pro review', score: '8/10', text: 'Architecture: The pre-creation gatekeeper model using signed 15-minute, single-use tokens is a secure, well-engineered approach to payment friction.' },
  { who: 'ChatGPT, third review after more fixes', score: '8.0/10', text: 'Technically thoughtful and well-demonstrated, but the evidence for real-world scam-detection effectiveness is still too limited for a top-tier security product.' },
  { who: 'ChatGPT, third review after more fixes', score: '8.0/10', text: 'Rules-only testing shows substantial misses: 41-48% recall on the public dataset.' },
  { who: 'Gemini review (Flash-Lite model)', score: '7.5/10', text: 'Outstanding engineering depth and honesty, but held back by merchant payout flow limitations.' },
  { who: 'Gemini review (Flash-Lite model)', score: '7.5/10', text: 'Payee verification is rudimentary and fails to reliably verify unknown merchants from text.' }
];

function AiFeedbackMarquee() {
  const items = [...AI_FEEDBACK, ...AI_FEEDBACK];
  return (
    <section aria-label="AI-generated feedback on this project" className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-white/60">Feedback and suggestions taken from AI (ChatGPT and Gemini), not from human users. Real scores, copied word for word.</p>
      <div className="ai-marquee flex gap-4 whitespace-nowrap">
        {items.map((f, i) => (
          <figure key={i} className="inline-block shrink-0 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/80">
            <blockquote>&ldquo;{f.text}&rdquo;</blockquote>
            <figcaption className="mt-1 text-xs text-white/50">AI-generated: {f.who}, score {f.score}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default function PayGuard() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [config, setConfig] = useState(null);
  const [paid, setPaid] = useState(null);
  const [shot, setShot] = useState(null);
  const [attacks, setAttacks] = useState(null);
  const [scanIdx, setScanIdx] = useState(0);
  const [hook, setHook] = useState('');
  useEffect(() => {
    if (!paid?.orderId) { setHook(''); return undefined; }
    let stop = false;
    setHook('waiting');
    (async () => {
      for (let i = 0; i < 8 && !stop; i += 1) {
        await new Promise((r) => setTimeout(r, 2500));
        try {
          const r = await fetch(`/api/paypal/confirmation?orderId=${encodeURIComponent(paid.orderId)}`);
          if ((await r.json()).confirmed) { if (!stop) setHook('confirmed'); return; }
        } catch { /* try again */ }
      }
      if (!stop) setHook('none');
    })();
    return () => { stop = true; };
  }, [paid]);
  const [checkedText, setCheckedText] = useState('');
  useEffect(() => {
    if (!busy) { setScanIdx(0); return undefined; }
    const t = setInterval(() => setScanIdx((i) => (i + 1) % SCAN_STEPS.length), 1200);
    return () => clearInterval(t);
  }, [busy]);
  async function runAttacks() {
    try {
      const r = await fetch('/api/payments/attack-demo');
      setAttacks((await r.json()).results || []);
    } catch { setAttacks([]); }
  }
  const buttonsRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch('/api/paypal/config').then(r => r.json()).then(setConfig).catch(() => setConfig({ configured: false }));
  }, []);

  async function review() {
    setBusy(true); setError(''); setResult(null); setPaid(null);
    try {
      setCheckedText(text);
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
    setBusy(true); setError(''); setResult(null); setPaid(null); setCheckedText('');
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
      let orderTicket = null;
      buttons = paypal.Buttons({
        style: { layout: 'vertical', shape: 'rect' },
        createOrder: async () => { const o = await postJson('/api/paypal/create-order', { token }); orderTicket = o.orderTicket; return o.id; },
        onApprove: async (data) => setPaid(await postJson('/api/paypal/capture-order', { orderId: data.orderID, orderTicket })),
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
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-gradient-to-br from-slate-100 via-slate-400 to-slate-700 opacity-25 blur-[2px]" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 -right-24 h-80 w-80 rotate-12 rounded-[3rem] bg-gradient-to-tr from-slate-300 via-slate-500 to-slate-900 opacity-20" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-gradient-to-tl from-slate-200 via-slate-600 to-slate-900 opacity-20" />
      <div className="relative mx-auto max-w-xl space-y-5 tracking-[0.01em] rounded-[2rem] border border-white/20 bg-white/[0.07] p-6 sm:p-8 shadow-[0_8px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-2xl">
        <a href="/" className="text-sm text-white/60 hover:text-white">&larr; Back to ScamShield</a>
        <h1 className="text-3xl font-semibold tracking-tight">Check before you pay</h1>
        <p className="text-white/60 text-sm">
          Paste a payment request. AI and scam rules read it first. Only a request that passes the automated checks can open a PayPal
          <b> sandbox</b> checkout. No real money moves.
        </p>

        <p className="text-xs text-white/70">1 Check &rarr; 2 Verdict &rarr; 3 PayPal sandbox. Powered by Gemini and the PayPal sandbox. <a href="#attack" className="underline">Try to bypass it</a></p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={5}
          placeholder="Paste an invoice, seller message or payment request"
          className="w-full rounded-2xl bg-black/30 border border-white/15 p-4 text-sm placeholder-white/55 focus:outline-none focus:border-white/50 backdrop-blur"
        />
        <p className="text-xs text-white/65">Demo examples below are fictional.</p>
        <button onClick={review} disabled={busy || !text.trim()} className="w-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:brightness-110 disabled:opacity-50 disabled:shadow-none px-6 py-3 text-sm font-semibold">
          {busy && !shot ? 'Checking...' : 'Check request'}
        </button>
        {!text.trim() && !busy && <p className="text-xs text-white/65">Paste text or pick an example below.</p>}
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map(([label, s], i) => (
            <button key={i} onClick={() => setText(s)} className="rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs text-white/80 hover:bg-white/15">
              {label}
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


        {busy && <p className="text-xs text-white/60">{SCAN_STEPS[scanIdx]} After idle time the free server may need up to 30 seconds to wake up.</p>}

        <p className="text-xs text-white/60">Why this matters in India: banks reported 2,93,239 digital payment frauds worth Rs 2,060.75 crore in FY 2023-24 (RBI data given to Lok Sabha, Aug 2026). <a href="https://sansad.in/getFile/lsapps/loksabhaquestions/annex/188/AU3487_CUPVNR.pdf" target="_blank" rel="noreferrer" className="underline">Source</a>. Only frauds banks reported, so the real number is higher.</p>

        <div id="attack" className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/70">Think you can cheat it? Try to bypass ScamShield.</p>
            <button type="button" onClick={runAttacks} className="rounded-full border border-white/25 px-4 py-1.5 text-xs text-white/90 hover:bg-white/10">Attack the shield</button>
          </div>
          {attacks && attacks.length > 0 && (
            <ul className="space-y-2 text-sm">
              {attacks.map((a) => (
                <li key={a.attack} className="rounded-xl bg-white/5 p-2">
                  <span className={a.blocked ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>{a.blocked ? 'REJECTED' : 'GOT THROUGH'}</span> {a.attack}
                  <span className="block text-xs text-white/50">{a.why}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

        {result && (
          <div className="rounded-2xl border border-white/15 bg-black/30 p-5 space-y-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            <div className={`rounded-2xl border px-4 py-3 ${review_.blocked ? 'border-rose-300/40 bg-rose-500/15' : review_.degraded ? 'border-amber-300/50 bg-amber-400/15' : 'border-emerald-300/30 bg-emerald-400/10'}`}>
              <p className={`text-2xl font-semibold tracking-tight ${review_.blocked ? 'text-rose-100' : review_.degraded ? 'text-amber-100' : 'text-emerald-100'}`}>
                {review_.blocked ? 'BLOCKED: suspicious payment request' : review_.canPay ? 'CLEARED: PayPal Sandbox unlocked' : review_.degraded ? 'NOT CLEARED: AI review unavailable' : 'NOT PAYABLE: checkout could not be prepared'}
              </p>
              <p className="text-xs text-white/60">{review_.blocked ? 'The server will not open checkout for this request.' : review_.degraded ? 'Only the rules ran. Checkout stays locked until the AI review answers. Check again in a minute.' : 'It passed the automated checks. That does not prove the seller is genuine.'}</p>
              <p className="mt-1 text-sm text-white/85">
                {review_.request?.amount ? `${review_.request.amount} ${review_.request.currency || ''}` : 'Amount not found'}
                {review_.request?.payee ? ` to ${review_.request.payee}` : ''}
                {` | risk ${review_.riskScore}/100`}
              </p>
            </div>
            <details className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <summary className="cursor-pointer text-white/70">How it was checked (steps and risk bar)</summary>
              <div className="mt-3 space-y-3">
            <Steps review={review_} />
            <div>
              <div className="flex justify-between text-xs text-white/60"><span>Risk signals (not a probability)</span><span>{review_.riskScore}/100</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${review_.riskScore >= 55 ? 'bg-rose-400' : review_.riskScore >= 25 ? 'bg-amber-300' : 'bg-emerald-300'}`} style={{ width: `${review_.riskScore}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Verdict</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${review_.blocked ? 'bg-rose-500/20 text-rose-200' : 'bg-amber-500/20 text-amber-200'}`}>
                {verdict.label || verdict.riskLevel}
              </span>
            </div>
              </div>
            </details>
            {result.transcript && <p className="text-xs text-white/50 break-words">Read from screenshot: {result.transcript.length > 220 ? `${result.transcript.slice(0, 220)}...` : result.transcript}</p>}
            <p className="text-sm">{verdict.summary || verdict.reason}</p>
            <p className="text-xs text-white/60">{confidenceLine(review_, verdict)}</p>
            {(result.transcript || checkedText) && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                <p className="text-xs uppercase tracking-wide text-white/50">Highlighted risky words</p>
                <Highlighted text={result.transcript || checkedText} />
              </div>
            )}
            <AiPanel verdict={verdict} review={review_} />
            {review_.blocked && <WhyBlocked verdict={verdict} />}
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
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100 space-y-1">
                <p className="font-semibold">Sandbox payment {paid.status}. {paid.amount ? `${paid.amount.value} ${paid.amount.currency_code}. ` : ''}Receipt id: {paid.captureId}</p>
                <p className="text-xs text-emerald-100/80">Payment completed and the amount matched the review. Risk score {review_.riskScore}/100, {verdict.label || verdict.riskLevel}. Order {paid.orderId}. {paid.paidAt ? new Date(paid.paidAt).toLocaleString() : ''}. No real money moved.</p>
                <p className="text-xs text-emerald-100/80">{hook === 'confirmed' ? 'PayPal webhook confirmed this capture (signature verified by PayPal).' : hook === 'waiting' ? 'Waiting for PayPal webhook confirmation...' : hook === 'none' ? 'PayPal webhook confirmation not received yet.' : ''}</p>
              </div>
            )}
            <button type="button" onClick={() => downloadReport(result, result.transcript || checkedText)} className="rounded-full border border-white/25 px-4 py-1.5 text-xs text-white/90 hover:bg-white/10">Download evidence report</button>
            <p className="text-xs text-white/45">{review_.caution}</p>
          </div>
        )}
      </div>
      <AiFeedbackMarquee />
    </div>
  );
}
