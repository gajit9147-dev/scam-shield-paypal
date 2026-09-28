import { useRef, useState } from 'react';

const labelStyles = {
  scam: 'bg-red-100/90 text-red-800 ring-1 ring-red-300/70',
  uncertain: 'bg-amber-100/90 text-amber-900 ring-1 ring-amber-300/70'
};

const glassCard = 'rounded-3xl border border-white/60 bg-white/55 shadow-xl shadow-indigo-900/5 backdrop-blur-xl';

const copy = {
  en: {
    language: 'Language', eyebrow: 'Cautious payment-message check', title: 'UPI Scam Shield',
    intro: 'Paste a redacted payment message. High-risk requests may be flagged, but the English general-spam model is not a UPI scam test. This tool cannot certify a message as safe.',
    message: 'Message to check', placeholder: 'Paste a sample message here (no private details)',
    characters: 'characters', checking: 'Checking...', check: 'Check message', verdict: 'Verdict',
    upload: 'Upload screenshot', reading: 'Reading text from the screenshot...',
    ocrDone: 'Text extracted. Review or edit it, then choose what you need below.',
    chooseAction: 'What would you like to do?', fraudChoice: 'Check if this message is fraud', recoveryChoice: 'Wrong payment - how to get money back',
    recoveryChosenIntro: 'If you sent money to the wrong person, act fast. Follow these steps; getting it back is not guaranteed.',
    ocrError: 'Could not read text from that image. Try a clearer screenshot or paste the message instead.',
    recoveryTitle: 'Sent money to the wrong person?',
    recoveryIntro: 'This message looks like a completed payment. If the money went to the wrong person, act fast. These are the real steps; recovery is not guaranteed.',
    recoverySteps: [
      'Note the 12-digit UPI reference number (UTR) from the SMS or your payment app.',
      'Open that transaction in your UPI app and raise a complaint; choose "Incorrectly transferred to another account".',
      "Call your bank with the UTR and ask it to request a reversal from the receiver's bank.",
      'If it stays unresolved, escalate in this order: the UPI app, its partner bank, your bank, then NPCI at npci.org.in.',
      'If the receiver refuses to return the money or it was fraud, call 1930 and file a complaint at cybercrime.gov.in.'
    ],
    recoveryNote: "Getting money back usually needs the receiver's consent or a bank/NPCI decision. This app only explains the process; it cannot recover money.",
    reason: 'Reason', action: 'Safe action', method: 'Method', signal: 'General spam signal',
    confidence: 'Confidence in a UPI scam verdict: not established.', evidence: 'Evidence',
    footer: 'A safe verdict is deliberately withheld until genuine, consented payment-message data can be evaluated. No sender, link, payment or identity is verified here. Do not paste real private SMS into a public demo.',
    error: 'Could not check the message. Is the server running?'
  },
  hi: {
    language: 'भाषा', eyebrow: 'भुगतान संदेश की सावधानी से जाँच', title: 'UPI स्कैम शील्ड',
    intro: 'निजी जानकारी हटाकर भुगतान का संदेश यहाँ डालें। जोखिम वाले अनुरोधों पर चेतावनी मिल सकती है, लेकिन अंग्रेज़ी सामान्य स्पैम मॉडल की जाँच UPI धोखाधड़ी पर नहीं हुई है। यह टूल किसी संदेश को सुरक्षित घोषित नहीं कर सकता।',
    message: 'जाँचने के लिए संदेश', placeholder: 'नमूना संदेश यहाँ डालें (निजी जानकारी न डालें)',
    characters: 'अक्षर', checking: 'जाँच जारी है...', check: 'संदेश जाँचें', verdict: 'नतीजा',
    upload: 'स्क्रीनशॉट अपलोड करें', reading: 'स्क्रीनशॉट से टेक्स्ट पढ़ा जा रहा है...',
    ocrDone: 'स्क्रीनशॉट से टेक्स्ट मिल गया। इसे देखें या सुधारें, फिर नीचे अपना विकल्प चुनें।',
    chooseAction: 'आप क्या करना चाहते हैं?', fraudChoice: 'क्या यह संदेश धोखाधड़ी है, जाँचें', recoveryChoice: 'गलत भुगतान - पैसे वापस कैसे पाएं',
    recoveryChosenIntro: 'अगर आपने गलत व्यक्ति को पैसे भेजे हैं तो जल्दी करें। ये कदम अपनाएँ; पैसे वापसी की गारंटी नहीं है।',
    ocrError: 'उस तस्वीर से टेक्स्ट नहीं पढ़ा जा सका। साफ़ स्क्रीनशॉट डालें या संदेश चिपकाएँ।',
    recoveryTitle: 'गलत व्यक्ति को पैसे चले गए?',
    recoveryIntro: 'यह संदेश पूरा हुआ भुगतान लगता है। अगर पैसे गलत व्यक्ति को चले गए हैं तो जल्दी करें। असली तरीका यह है; पैसे वापस मिलने की गारंटी नहीं है।',
    recoverySteps: [
      'SMS या अपने पेमेंट ऐप से 12 अंकों का UPI रेफरेंस नंबर (UTR) नोट करें।',
      'अपने UPI ऐप में उसी लेन-देन को खोलकर शिकायत दर्ज करें; "Incorrectly transferred to another account" चुनें।',
      'UTR लेकर अपने बैंक को कॉल करें और प्राप्तकर्ता के बैंक से रिवर्सल का अनुरोध करवाएँ।',
      'हल न हो तो इस क्रम में आगे बढ़ें: UPI ऐप, उसका साझेदार बैंक, आपका बैंक, फिर npci.org.in पर NPCI।',
      'सामने वाला पैसे लौटाने से मना कर दे या धोखाधड़ी हो, तो 1930 पर कॉल करें और cybercrime.gov.in पर शिकायत दर्ज करें।'
    ],
    recoveryNote: 'पैसे वापसी अक्सर प्राप्तकर्ता की सहमति या बैंक/NPCI के फैसले पर निर्भर करती है। यह ऐप सिर्फ प्रक्रिया बताता है; पैसे वापस नहीं दिला सकता।',
    reason: 'वजह', action: 'सुरक्षित कदम', method: 'तरीका', signal: 'सामान्य स्पैम संकेत',
    confidence: 'UPI धोखाधड़ी के नतीजे की विश्वसनीयता तय नहीं हुई है।', evidence: 'मिले संकेत',
    footer: 'जब तक सहमति से मिले असली भुगतान संदेशों पर जाँच नहीं होती, यह टूल किसी संदेश को सुरक्षित नहीं बताता। यहाँ भेजने वाले, लिंक, भुगतान या पहचान की पुष्टि नहीं होती। सार्वजनिक डेमो में असली निजी SMS न डालें।',
    error: 'संदेश की जाँच नहीं हो सकी। क्या सर्वर चालू है?'
  }
};

// The API remains in English. Translate only its known, fixed display strings;
// never translate or alter the submitted message or the detector's decision.
const apiCopy = {
  'scam': 'धोखाधड़ी का संकेत',
  'uncertain': 'पक्का नहीं',
  'High-risk request pattern found in the text. This is a warning, not proof about the sender or payment.': 'संदेश में जोखिम वाला अनुरोध मिला। यह चेतावनी है, भेजने वाले या भुगतान के बारे में पक्का सबूत नहीं।',
  'The English general-spam model flagged this text, but spam does not establish a UPI scam.': 'अंग्रेज़ी सामान्य स्पैम मॉडल ने इस संदेश पर चेतावनी दी है, लेकिन स्पैम होने से UPI धोखाधड़ी साबित नहीं होती।',
  'No strong fraud request pattern was found. Text alone cannot establish that a payment message is safe.': 'धोखाधड़ी का कोई स्पष्ट अनुरोध नहीं मिला। सिर्फ संदेश के आधार पर इसे सुरक्षित नहीं माना जा सकता।',
  'Do not share OTPs or PINs, open message links, or pay to receive money. Check the official bank or payment app independently.': 'OTP या PIN साझा न करें, संदेश के लिंक न खोलें और पैसे पाने के लिए भुगतान न करें। बैंक या भुगतान ऐप में खुद जाकर जाँचें।',
  'payment warning rules + UCI general-spam baseline': 'भुगतान चेतावनी नियम + UCI का सामान्य स्पैम मॉडल',
  'flagged': 'चेतावनी मिली',
  'not flagged': 'चेतावनी नहीं मिली',
  'Message asks for a sensitive code or credential': 'संदेश में OTP, PIN या पासवर्ड माँगा गया है',
  'Message links a payment demand to a promised credit or account threat': 'पैसे मिलने के वादे या खाते को बंद करने की धमकी के साथ भुगतान माँगा गया है',
  'English general-spam signal': 'अंग्रेज़ी सामान्य स्पैम मॉडल का संकेत',
  'Enter a message of 1 to 1000 characters.': '1 से 1000 अक्षरों का संदेश डालें।',
  'Could not check the message.': 'संदेश की जाँच नहीं हो सकी।'
};

const debitPattern = /(debited|deducted|payment successful|paid successfully|txn\.?\s?id|upi ref(erence)?|utr)/i;
const amountPattern = /(rs\.?|inr|\u20B9)\s*[\d,]+/i;

function looksLikeCompletedPayment(text) {
  return debitPattern.test(text) && amountPattern.test(text);
}

function display(value, language) {
  return language === 'hi' ? (apiCopy[value] || value) : value;
}

export default function App() {
  const [language, setLanguage] = useState('en');
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrState, setOcrState] = useState('');
  const [checkedText, setCheckedText] = useState('');
  const [screenshotReady, setScreenshotReady] = useState(false);
  const [selectedAction, setSelectedAction] = useState('');
  const fileInput = useRef(null);
  const t = copy[language];

  async function readScreenshot(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    setOcrLoading(true);
    setOcrState('');
    setScreenshotReady(false);
    setSelectedAction('');
    setResult(null);
    setError('');
    try {
      const tesseract = (await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js')).default;
      const { recognize } = tesseract;
      const { data } = await recognize(file, 'eng');
      const extracted = (data && data.text ? data.text : '').replace(/[ \t]+\n/g, '\n').trim().slice(0, 1000);
      const meaningful = (extracted.match(/[\p{L}\p{N}]/gu) || []).length;
      if (meaningful < 3) throw new Error('no text found');
      setText(extracted);
      setScreenshotReady(true);
      setOcrState('done');
    } catch (err) {
      setOcrState('error');
    } finally {
      setOcrLoading(false);
    }
  }

  async function check(event) {
    event?.preventDefault();
    if (!text.trim()) return;
    if (screenshotReady) setSelectedAction('fraud');
    setResult(null);
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check the message.');
      setResult(data);
      setCheckedText(text);
    } catch (err) {
      setError(err.message || 'Could not check the message.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-100 via-sky-50 to-rose-100 px-4 py-12 text-slate-900" lang={language}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-indigo-300/50 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-sky-300/50 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-rose-300/50 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-2xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">{t.eyebrow}</p>
            <h1 className="mt-2 bg-gradient-to-r from-indigo-700 to-sky-600 bg-clip-text text-4xl font-bold text-transparent">{t.title}</h1>
          </div>
          <div className="shrink-0">
            <label htmlFor="language" className="block text-sm font-medium text-slate-700">{t.language}</label>
            <select id="language" value={language} onChange={e => setLanguage(e.target.value)} className="mt-1 rounded-xl border border-white/60 bg-white/60 px-3 py-2 text-sm text-slate-900 shadow-sm backdrop-blur-md focus:border-indigo-500 focus:outline-none">
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </div>
        </header>
        <p className="mt-3 text-slate-600">{t.intro}</p>
        <form onSubmit={check} className={`mt-8 p-6 ${glassCard}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="message" className="block font-semibold">{t.message}</label>
            <input ref={fileInput} type="file" accept="image/*" onChange={readScreenshot} className="hidden" aria-hidden="true" tabIndex={-1} />
            <button type="button" disabled={ocrLoading || loading} onClick={() => fileInput.current && fileInput.current.click()} className="rounded-xl border border-white/60 bg-white/60 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm backdrop-blur-md transition hover:bg-white/80 disabled:opacity-60">{t.upload}</button>
          </div>
          <textarea id="message" maxLength={1000} required rows={6} value={text} onChange={e => { setText(e.target.value); setResult(null); setError(''); setCheckedText(''); }} placeholder={t.placeholder} className="mt-3 w-full rounded-xl border border-slate-300/80 bg-white/70 p-3 backdrop-blur-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          {ocrLoading && <p className="mt-3 text-sm text-indigo-700" role="status">{t.reading}</p>}
          {ocrState === 'done' && <p className="mt-3 text-sm text-emerald-700" role="status">{t.ocrDone}</p>}
          {ocrState === 'error' && <p className="mt-3 text-sm text-red-700" role="alert">{t.ocrError}</p>}
          {screenshotReady && <fieldset className="mt-5 rounded-2xl border border-indigo-200/70 bg-indigo-50/70 p-4">
            <legend className="px-1 text-base font-semibold text-indigo-950">{t.chooseAction}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="submit" aria-pressed={selectedAction === 'fraud'} disabled={loading || !text.trim()} className={`min-h-16 rounded-xl border px-4 py-3 text-left font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-60 ${selectedAction === 'fraud' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-indigo-200 bg-white/80 text-indigo-900 hover:bg-white'}`}>{loading ? t.checking : t.fraudChoice}</button>
              <button type="button" aria-pressed={selectedAction === 'recovery'} disabled={loading || !text.trim()} onClick={() => { setSelectedAction('recovery'); setResult(null); setError(''); }} className={`min-h-16 rounded-xl border px-4 py-3 text-left font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-60 ${selectedAction === 'recovery' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-indigo-200 bg-white/80 text-indigo-900 hover:bg-white'}`}>{t.recoveryChoice}</button>
            </div>
          </fieldset>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-500">{text.length}/1000 {t.characters}</span>
            {!screenshotReady && <button disabled={loading || ocrLoading} className="rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 px-5 py-2.5 font-medium text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-700 hover:to-sky-700 disabled:opacity-60">{loading ? t.checking : t.check}</button>}
          </div>
        </form>
        {error && <p role="alert" className="mt-5 rounded-2xl border border-red-200/70 bg-red-50/80 p-4 text-red-800 backdrop-blur-md">{display(error, language) === error && language === 'hi' ? t.error : display(error, language)}</p>}
        {result && (!screenshotReady || selectedAction === 'fraud') && <section aria-live="polite" className={`mt-6 min-w-0 break-words p-6 ${glassCard}`}>
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{t.verdict}</h2><span className={`rounded-full px-3 py-1 text-sm font-semibold ${labelStyles[result.label] || labelStyles.uncertain}`}>{display(result.label, language)}</span></div>
          <p className="mt-4"><strong>{t.reason}:</strong> {display(result.reason, language)}</p>
          <p className="mt-3"><strong>{t.action}:</strong> {display(result.safeAction, language)}</p>
          <p className="mt-3 text-sm text-slate-600">{t.method}: {display(result.method, language)}. {t.signal}: {display(result.generalSpamSignal, language)}. {t.confidence}</p>
          {result.evidence?.length > 0 && <p className="mt-3 text-sm"><strong>{t.evidence}:</strong> {result.evidence.map(item => display(item, language)).join(', ')}</p>}
        </section>}
        {((screenshotReady && selectedAction === 'recovery') || (!screenshotReady && result && looksLikeCompletedPayment(checkedText))) && <section className={`mt-6 p-6 ${glassCard}`}>
          <h2 className="text-xl font-semibold">{t.recoveryTitle}</h2>
          <p className="mt-2 text-slate-600">{screenshotReady ? t.recoveryChosenIntro : t.recoveryIntro}</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5">
            {t.recoverySteps.map(step => <li key={step}>{step}</li>)}
          </ol>
          <p className="mt-4 text-sm text-slate-600">{t.recoveryNote}</p>
        </section>}
        <p className="mt-8 rounded-2xl border border-white/50 bg-white/40 p-4 text-sm text-slate-600 backdrop-blur-md">{t.footer}</p>
      </div>
    </main>
  );
}
