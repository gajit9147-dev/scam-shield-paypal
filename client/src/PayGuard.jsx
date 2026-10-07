import { useEffect, useRef, useState } from 'react';

import { whyRisky } from './whyRisky.js';
import AgentPanel from './AgentPanel.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import { getDictionary, translateCategory, translateEvidence, translateRecommendation } from './locales/index.js';

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

function WhyBlocked({ verdict, language }) {
  const lang = language === 'en' ? 'en' : 'hi';
  const signals = (Array.isArray(verdict.signals) ? verdict.signals : []).filter(x => x.evidence).slice(0, 6);
  return (
    <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-200">Why this was blocked</p>
      {verdict.categoryLabel && <p className="mb-2 text-sm font-medium">{translateCategory(verdict.category, language, verdict.categoryLabel)}</p>}
      <div className="mb-3 rounded-xl bg-black/20 p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/60">In simple words</span>

        </div>
        <p className="text-sm text-white/90">{language === 'hi' ? translateRecommendation(verdict.safeAction, verdict.category, language).join(' ') : whyRisky(verdict.category, lang)}</p>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-rose-100/90">
        {signals.map((x, i) => (<li key={i}>{translateEvidence(x.evidence, language)} <span className="text-white/40">({x.source === 'gemini' ? 'AI' : 'rule'})</span></li>))}
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
  { who: 'Gemini review (model not recorded)', score: '8/10', text: 'Highly impressive technical foundation, security architecture, and testing, but the AI integration currently creates false positives and it lacks crucial payee-level verification.' },
  { who: 'Gemini review (model not recorded)', score: '8/10', text: 'Architecture: The pre-creation gatekeeper model using signed 15-minute, single-use tokens is a secure, well-engineered approach to payment friction.' },
  { who: 'ChatGPT, third review after more fixes', score: '8.0/10', text: 'Technically thoughtful and well-demonstrated, but the evidence for real-world scam-detection effectiveness is still too limited for a top-tier security product.' },
  { who: 'ChatGPT, third review after more fixes', score: '8.0/10', text: 'Rules-only testing shows substantial misses: 41-48% recall on the public dataset.' },
  { who: 'Gemini review (Flash-Lite model)', score: '7.5/10', text: 'Outstanding engineering depth and honesty, but held back by merchant payout flow limitations.' },
  { who: 'Gemini review (Flash-Lite model)', score: '7.5/10', text: 'Payee verification is rudimentary and fails to reliably verify unknown merchants from text.' }
];

function AiFeedbackMarquee() {
  const items = [...AI_FEEDBACK, ...AI_FEEDBACK];
  return (
    <section aria-label="AI-generated feedback on this project" className="pg-reviews">
      <h2>Project <span className="pg-serif">reviews</span></h2>
      <p className="pg-review-intro">AI-generated opinions, not user testimonials or security certifications. Scores describe the project, not scam-detection accuracy.</p>
      <div className="pg-review-grid">
        <article className="pg-review-card">
          <div className="pg-review-top"><div><h3>Antigravity</h3><span>Architecture &amp; code quality · October 7, 2026</span></div><b>9.3<small>/10</small></b></div>
          <blockquote>"Strict tool guardrails preventing LLM prompt injections from invoking money-transfer tools. Signed review tokens, single-use nonce tracking, and rate limiting."</blockquote>
          <p>Review supplied by the project owner. It reports 83 passing tests and praises the layered checks and Hindi/Hinglish support.</p>
          <p className="pg-review-next"><strong>Suggested next steps:</strong> dependency audit fixes and TypeScript definitions for API contracts.</p>
          <details><summary>Test context and limits</summary><p>Rechecked locally: 83/83 mocked server tests; 42 synthetic cases at 100% accuracy; 129 public-source cases at 98.45% accuracy. These narrow sets do not establish real-world effectiveness. Untuned public rules-only samples had 41-48% recall. A configured Gemini key is not proof that an AI call succeeded; current live AI checks have hit quota limits. Checkout stays locked when AI review is unavailable.</p></details>
        </article>
        <article className="pg-review-card">
          <div className="pg-review-top"><div><h3>ChatGPT</h3><span>First project review · October 5, 2026</span></div><b>8.3<small>/10</small></b></div>
          <blockquote>"Technically impressive and demoable with unusually strong security controls, but limited by detection generalization, payee verification, and sandbox-only realism."</blockquote>
          <p>Historical review of an earlier version, selected by the project owner. Not a new rating of the current deployment.</p>
          <p className="pg-review-next"><strong>Review strengths:</strong> server-side blocking, signed tokens, amount binding, capture checks and webhook verification.</p>
          <details><summary>Original review limits</summary><p>"The reported 98.55% precision/recall is from a small, potentially non-representative dataset; it should not be presented as real-world accuracy."</p><p>"Payee verification is absent, despite being central to payment safety."</p><p>"The PayPal “payment” does not actually pay the extracted seller, reducing real-world fidelity."</p></details>
        </article>
      </div>
      <details className="pg-review-archive"><summary>Earlier AI reviews (historical scores)</summary>
        <p>Previous versions received ChatGPT 8.3, 8.4 and 8.0, and Gemini 8.0 and 7.5. Verbatim excerpts follow; scores are not directly comparable across prompts or models.</p>
        <div className="ai-marquee flex gap-4 whitespace-nowrap">{items.map((f, i) => <figure key={i} className="inline-block shrink-0 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/80"><blockquote>"{f.text}"</blockquote><figcaption className="mt-1 text-xs text-white/50">AI-generated: {f.who}, score {f.score}</figcaption></figure>)}</div>
      </details>
    </section>
  );
}

export default function PayGuard() {
  const [language, setLanguage] = useState('en');
  const [theme, setTheme] = useState(() => localStorage.getItem('ss_theme_v2') || 'light');
  const [view, setView] = useState('checker');
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('upi_shield_history') || '[]'); } catch { return []; } });
  const t = getDictionary(language);
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); localStorage.setItem('ss_theme_v2', theme); }, [theme]);
  function showView(next) { setView(next); }
  function remember(out, sourceText, type) {
    const item = { id: Date.now(), timestamp: new Date().toLocaleString(), type, sourceText, result: { verdict: out.verdict, review: { blocked: out.review.blocked, canPay: out.review.canPay, riskScore: out.review.riskScore } } };
    setHistory(prev => { const next = [item, ...prev].slice(0, 20); try { localStorage.setItem('upi_shield_history', JSON.stringify(next)); } catch {} return next; });
  }
  function restore(item) {
    setView('checker'); setMode('Message'); setPaid(null); setError('');
    setText(item.sourceText || ''); setCheckedText(item.sourceText || ''); setShot(null);
    // Stored results never restore a checkout authorization. Recheck for a fresh token.
    setResult(null);
    if (item.type === 'image' && !item.sourceText) setError('Upload the screenshot again for a fresh check.');
  }
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
      const out = await postJson('/api/payments/review', { text });
      setResult(out); remember(out, text, 'text');
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
      setResult(out); remember(out, out.transcript || '', 'image');
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

  const [mode, setMode] = useState('Message');
  const MODES = {
    Message: 'Paste the message you received here...',
    Link: 'Paste the link you were sent...',
    Email: 'Paste the email text or the payment request in it...',
    Phone: 'Type what the caller or the SMS asked you to pay...',
    Screenshot: '',
    Agent: '',
    UPI: 'Paste the UPI ID, collect request or payment message...'
  };

  return (
    <div className={`pg ${theme === 'dark' ? 'pg-night' : ''}`}>
      <nav className="pg-nav">
        <a href="#top" className="pg-logo"><span className="pg-mark" />SCAMSHIELD</a>
        <div className="pg-nav-tools">
          <button className={`pg-nav-link ${view === 'checker' ? 'active' : ''}`} onClick={() => showView('checker')}>{t.navCheckMessage}</button>
          <button className={`pg-nav-link ${view === 'history' ? 'active' : ''}`} onClick={() => showView('history')}>{t.navHistory}</button>
          <button className={`pg-nav-link ${view === 'examples' ? 'active' : ''}`} onClick={() => showView('examples')}>{t.navScamExamples}</button>
          <button className={`pg-nav-link ${view === 'tips' ? 'active' : ''}`} onClick={() => showView('tips')}>{t.navSafetyTips}</button>
          <select aria-label="Language" value={language} onChange={e => setLanguage(e.target.value)}><option value="en">English</option><option value="hi">हिंदी</option><option value="hinglish">Hinglish</option></select>
          <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
        </div>
      </nav>
      {view === 'checker' && <header id="top" className="pg-hero">
        <div className="pg-prism" aria-hidden />
        <div className="pg-eyebrow">AI scam check for payments</div>
        <h1>Check before<span className="pg-serif">you pay.</span></h1>
        <p className="pg-sub">Paste a message, link or invoice. ScamShield scores the risk in seconds and only opens PayPal checkout when the request looks safe.</p>
        <a href="#checker" className="pg-btn">Check a request &rarr;</a>
        <div className="pg-stats">
          <div><b>0 / 20</b><span>scams passed in our test set</span></div>
          <div><b>1.3s</b><span>median check time</span></div>
          <div><b>40</b><span>labeled test requests</span></div>
        </div>
      </header>}
      <div className="pg-wrap">
        {view !== 'checker' && <section className="pg-sec pg-library">
          <h2>{view === 'history' ? t.navHistory : view === 'examples' ? t.navScamExamples : t.navSafetyTips}</h2>
          {view === 'history' && <>
            <p className="pg-lead">Recent checks stay on this browser only. Up to 20 are kept. Screenshots and checkout tokens are not saved.</p>
            {history.length ? <><button className="pg-btn-o" onClick={() => { if (window.confirm('Clear all history on this browser?')) { setHistory([]); localStorage.removeItem('upi_shield_history'); } }}>Clear history</button>
            <div className="pg-library-grid">{history.map(item => <article className="pg-card" key={item.id}><small>{item.timestamp}</small><p>{item.sourceText || 'Screenshot check'}</p><p className="pg-hint">{item.result?.review?.blocked ? 'Blocked' : item.result?.review?.canPay ? 'Cleared at the time of the check' : item.verdict?.riskLevel || 'Past check'} | Risk {item.result?.review?.riskScore ?? item.verdict?.riskScore ?? 'not recorded'}</p><button className="pg-btn-o" onClick={() => restore(item)}>Recheck request</button></article>)}</div></> : <p className="pg-hint">No checks saved on this browser yet.</p>}
          </>}
          {view === 'examples' && <><p className="pg-lead">Fictional requests to try. Selecting one fills the checker; it does not run a check or payment.</p><div className="pg-library-grid">{[[t.exampleKyc,t.exampleTextKyc],[t.exampleRefund,t.exampleTextRefund],[t.exampleLottery,t.exampleTextLottery],[t.exampleBankAlert,t.exampleTextBankAlert],[t.exampleSuspiciousLink,t.exampleTextSuspiciousLink],...SAMPLES].map(([label, sample],i) => <article className="pg-card" key={i}><h3>{label}</h3><p>{sample}</p><button className="pg-btn-o" onClick={() => { setMode('Message'); setText(sample); setResult(null); setView('checker'); }}>Use example</button></article>)}</div></>}
          {view === 'tips' && <><div className="pg-library-grid">{[1,2,3,4].map(i => <article className="pg-card" key={i}><h3>{t[`tip${i}Title`]}</h3><p>{t[`tip${i}Desc`]}</p></article>)}</div><p className="pg-lead">Already lost money? Contact your bank immediately. In India, report at <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a> or call 1930.</p></>}
        </section>}
        <div hidden={view !== 'checker'}>
        <section id="checker" className="pg-sec">
          <h2>Live <span className="pg-serif">checker</span></h2>
          <p className="pg-lead">Pick what you received, paste it, get a verdict. No real money moves: checkout is a PayPal sandbox.</p>
          <div className="pg-panel">
            <div className="pg-tabs" role="tablist">
              {Object.keys(MODES).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`pg-tab ${mode === m ? 'on' : ''}`}>{m}</button>
              ))}
            </div>
            {mode === 'Agent' ? <AgentPanel /> : mode !== 'Screenshot' ? (
              <>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={1000}
                  rows={5}
                  placeholder={language === 'en' ? MODES[mode] : t.inputPlaceholder}
                  className="pg-box"
                />
                <div className="pg-chips">
                  {SAMPLES.map(([label, s], i) => (
                    <button key={i} onClick={() => setText(s)} className="pg-chip">{label}</button>
                  ))}
                </div>
                <div className="pg-row">
                  <span className="pg-hint">{!text.trim() && !busy ? 'Paste text or pick a fictional example above. ' : ''}Recent checks are saved on this browser. Clear them in History. Results are guidance, not a guarantee.</span>
                  <button onClick={review} disabled={busy || !text.trim()} className="pg-btn">{busy && !shot ? t.analyzingButton : `${t.analyzeButton} →`}</button>
                </div>
              </>
            ) : (
              <div className="pg-box pg-shot">
                <p>Upload a screenshot of the payment request. AI reads it and runs the same check.</p>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickFile} className="hidden" />
                {shot && <img src={shot.url} alt="Selected screenshot" className="pg-shot-img" />}
                <div className="pg-row" style={{ justifyContent: 'flex-start' }}>
                  <button onClick={() => fileRef.current?.click()} className="pg-btn-o">{shot ? 'Choose another' : 'Upload screenshot'}</button>
                  {shot && <button onClick={reviewShot} disabled={busy} className="pg-btn">{busy ? 'Reading...' : 'Check screenshot \u2192'}</button>}
                </div>
              </div>
            )}
            {busy && <p className="pg-hint" style={{ marginTop: 14 }}>{SCAN_STEPS[scanIdx]} After idle time the free server may need up to 30 seconds to wake up.</p>}
            {error && <div className="pg-error">{error}</div>}
          </div>

          <div className="pg-dark">
            {!result && (
              <div className="pg-example">
                <div>
                  <div className="pg-msg"><small>EXAMPLE &middot; SMS</small>Dear customer, your <mark>SBI account will be blocked today</mark>. Complete <mark>KYC update</mark> now: <mark>http://sbi-kyc-verify.co/login</mark> and enter your <mark>OTP</mark> to avoid suspension.</div>
                  <div className="pg-todo"><b>What to do:</b> do not click or share the OTP. Report at 1930 or cybercrime.gov.in and call your bank on the number printed on your card.</div>
                </div>
                <div>
                  <div className="pg-score"><div className="pg-ring"><i>87<s>/100</s></i></div><div><span className="pg-pill">BLOCKED</span><p>Checkout stays locked.</p></div></div>
                  <ul className="pg-ev"><li>Urgent threat: "account will be blocked today"</li><li>Lookalike link: sbi-kyc-verify.co is not an SBI domain</li><li>Asks for an OTP, which banks never request by SMS</li><li>Matches the known fake KYC scam pattern</li></ul>
                </div>
              </div>
            )}
            <div className="pg-result">
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
            <p className="text-sm">{language === 'en' ? (verdict.summary || verdict.reason) : translateCategory(verdict.category, language, verdict.categoryLabel)}</p>
            {language !== 'en' && <p className="text-sm">{translateRecommendation(verdict.safeAction, verdict.category, language).join(' ')}</p>}
            <p className="text-xs text-white/60">{confidenceLine(review_, verdict)}</p>
            {(result.transcript || checkedText) && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                <p className="text-xs uppercase tracking-wide text-white/50">Highlighted risky words</p>
                <Highlighted text={result.transcript || checkedText} />
              </div>
            )}
            <AiPanel verdict={verdict} review={review_} />
            {review_.blocked && <WhyBlocked verdict={verdict} language={language} />}
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
        <div id="attack" className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/70">Think you can cheat it? Try to bypass ScamShield.</p>
            <button type="button" onClick={runAttacks} className="shrink-0 whitespace-nowrap rounded-full border border-white/25 px-4 py-1.5 text-xs text-white/90 hover:bg-white/10">Attack the shield</button>
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
          </div>
        <p className="text-sm text-[#6b7080] mt-5">Why this matters in India: banks reported 2,93,239 digital payment frauds worth Rs 2,060.75 crore in FY 2023-24 (RBI data given to Lok Sabha, Aug 2026). <a href="https://sansad.in/getFile/lsapps/loksabhaquestions/annex/188/AU3487_CUPVNR.pdf" target="_blank" rel="noreferrer" className="underline" >Source</a>. Only frauds banks reported, so the real number is higher.</p>
          <div className="pg-global">
            <p className="pg-hint" style={{ margin: '0 0 10px' }}>The same problem worldwide. Figures are as reported by each source, and reports undercount real losses.</p>
            <div className="pg-gstats">
              <a href="https://gasa.org/knowledge-base/reports/global-state-of-scams-2025" target="_blank" rel="noreferrer"><b>7 in 10</b><span>adults met a scam in the last 12 months (46,000 adults, 42 markets, GASA 2025)</span></a>
              <a href="https://www.ftc.gov/system/files/ftc_gov/pdf/ftc-testimony-jec-hearing-on-the-rising-scam-economy.pdf" target="_blank" rel="noreferrer"><b>$15.9B</b><span>fraud losses reported to the US FTC in 2025, up from over $12B in 2024</span></a>
              <a href="https://www.fbi.gov/news/press-releases/cryptocurrency-and-ai-scams-bilk-americans-of-billions" target="_blank" rel="noreferrer"><b>~$21B</b><span>cyber-enabled crime losses reported to the FBI in 2025</span></a>
            </div>
          </div>
        </section>
        </div>
        <section id="how" className="pg-sec">
          <h2>How it <span className="pg-serif">works</span></h2>
          <p className="pg-lead">Rules plus AI review, then a payment guard.</p>
          <div className="pg-steps">
            <div className="pg-card"><div className="n">01</div><h3>Paste</h3><p>Message, link, invoice or screenshot.</p></div>
            <div className="pg-card"><div className="n">02</div><h3>Score</h3><p>Rules and Gemini give a 0-100 risk and show why.</p></div>
            <div className="pg-card"><div className="n">03</div><h3>Pay safely</h3><p>PayPal sandbox checkout opens only if the request is cleared.</p></div>
          </div>
        </section>
      </div>
      <footer id="evidence" className="pg-footer">
        <div className="pg-big">Check before <span className="pg-serif">you pay.</span></div>
        <div className="pg-foot-marquee"><AiFeedbackMarquee /></div>
        <p>Rules plus Gemini, with a PayPal sandbox payment guard.</p>
        <span className="pg-badge">Built for PayPal AI Hackathon</span>
        <p><a href="/" style={{ textDecoration: 'underline' }}>Open the full ScamShield app</a></p>
      </footer>
    </div>
  );
}
