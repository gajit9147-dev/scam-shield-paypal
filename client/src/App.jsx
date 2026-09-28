import { useState } from 'react';

const labelStyles = {
  scam: 'bg-red-100 text-red-800',
  uncertain: 'bg-amber-100 text-amber-900'
};

const copy = {
  en: {
    language: 'Language', eyebrow: 'Cautious payment-message check', title: 'UPI Scam Shield',
    intro: 'Paste a redacted payment message. High-risk requests may be flagged, but the English general-spam model is not a UPI scam test. This tool cannot certify a message as safe.',
    message: 'Message to check', placeholder: 'Paste a sample message here (no private details)',
    characters: 'characters', checking: 'Checking...', check: 'Check message', verdict: 'Verdict',
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

function display(value, language) {
  return language === 'hi' ? (apiCopy[value] || value) : value;
}

export default function App() {
  const [language, setLanguage] = useState('en');
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const t = copy[language];

  async function check(event) {
    event.preventDefault();
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
    } catch (err) {
      setError(err.message || 'Could not check the message.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900" lang={language}>
      <div className="mx-auto max-w-2xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">{t.eyebrow}</p>
            <h1 className="mt-2 text-4xl font-bold">{t.title}</h1>
          </div>
          <div className="shrink-0">
            <label htmlFor="language" className="block text-sm font-medium text-slate-700">{t.language}</label>
            <select id="language" value={language} onChange={e => setLanguage(e.target.value)} className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none">
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </div>
        </header>
        <p className="mt-3 text-slate-600">{t.intro}</p>
        <form onSubmit={check} className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <label htmlFor="message" className="block font-semibold">{t.message}</label>
          <textarea id="message" maxLength={1000} required rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={t.placeholder} className="mt-3 w-full rounded-lg border border-slate-300 p-3 focus:border-indigo-600 focus:outline-none" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-500">{text.length}/1000 {t.characters}</span>
            <button disabled={loading} className="rounded-lg bg-indigo-700 px-5 py-2.5 font-medium text-white hover:bg-indigo-800 disabled:opacity-60">{loading ? t.checking : t.check}</button>
          </div>
        </form>
        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{display(error, language) === error && language === 'hi' ? t.error : display(error, language)}</p>}
        {result && <section aria-live="polite" className="mt-6 min-w-0 break-words rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{t.verdict}</h2><span className={`rounded-full px-3 py-1 text-sm font-semibold ${labelStyles[result.label] || labelStyles.uncertain}`}>{display(result.label, language)}</span></div>
          <p className="mt-4"><strong>{t.reason}:</strong> {display(result.reason, language)}</p>
          <p className="mt-3"><strong>{t.action}:</strong> {display(result.safeAction, language)}</p>
          <p className="mt-3 text-sm text-slate-600">{t.method}: {display(result.method, language)}. {t.signal}: {display(result.generalSpamSignal, language)}. {t.confidence}</p>
          {result.evidence?.length > 0 && <p className="mt-3 text-sm"><strong>{t.evidence}:</strong> {result.evidence.map(item => display(item, language)).join(', ')}</p>}
        </section>}
        <p className="mt-8 text-sm text-slate-500">{t.footer}</p>
      </div>
    </main>
  );
}
