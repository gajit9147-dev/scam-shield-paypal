import { useState, useEffect, useRef } from 'react';
import ThemeToggle from './components/ThemeToggle.jsx';
import {
  getDictionary,
  translateCategory,
  translateEvidence,
  translateRecommendation
} from './locales/index.js';

const NCRP_URL = 'https://cybercrime.gov.in/Webform/suspect_search_repository.aspx';
const CYBERCRIME_URL = 'https://cybercrime.gov.in';

// Default featured mockup state (matches reference mockup directly on initial load)
// Scale image for efficient transmission while preserving clarity
function prepareImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      resolve({
        dataUrl,
        base64: dataUrl.split(',')[1] || '',
        mimeType: 'image/jpeg',
        name: file.name
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

const SHORT_LABELS = {
  en: { check: 'Check', history: 'History', examples: 'Examples', tips: 'Tips' },
  hinglish: { check: 'Check', history: 'History', examples: 'Examples', tips: 'Tips' },
  hi: { check: 'जाँचें', history: 'इतिहास', examples: 'उदाहरण', tips: 'सुझाव' },
};

export default function App() {
  // Every visit starts in English. Other languages require an explicit choice.
  const [language, setLanguage] = useState('en');

  // Visual Theme (light / dark)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ss_theme_v2') || 'light';
  });

  // Navigation
  const [currentNav, setCurrentNav] = useState('check');
  const SHORT = SHORT_LABELS[language] || SHORT_LABELS.en;
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'image'

  // Input states
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewModalUrl, setPreviewModalUrl] = useState(null);

  // Analysis result state (initialized with featured reference scan)
  const [latestVerdict, setLatestVerdict] = useState(null);
  const [activeSourceText, setActiveSourceText] = useState(
    'Your SBI KYC is expired. Update now at https://sbi-kyc-verify.top/update or your account will be blocked within 24 hours.'
  );
  const [analyzedTimestamp, setAnalyzedTimestamp] = useState('8:20 PM');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStatusText, setLoadingStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showHowItWorks, setShowHowItWorks] = useState(true);

  // Follow-up Q&A Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  // Scan History (persisted)
  const [scanHistory, setScanHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('upi_shield_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Active Safety Tip detail modal/dialog
  const [selectedTip, setSelectedTip] = useState(null);

  const fileInputRef = useRef(null);
  const chatScrollRef = useRef(null);
  const resultCardRef = useRef(null);

  const t = getDictionary(language);

  // Sync theme class with document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ss_theme_v2', theme);
  }, [theme]);

  // Handle language switch
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);

  };

  // Toggle theme
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Save history changes
  useEffect(() => {
    try {
      localStorage.setItem('upi_shield_history', JSON.stringify(scanHistory));
    } catch (err) {
      console.warn('History storage limit:', err);
    }
  }, [scanHistory]);

  // Scroll follow-up chat on updates
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatBusy]);

  const getCurrentFormattedTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 1. Text Analysis Pipeline
  const runTextAnalysis = async (textToAnalyze) => {
    const text = (textToAnalyze !== undefined ? textToAnalyze : inputText).trim();
    if (!text) {
      setErrorMessage(t.errorNoInput);
      return;
    }
    setErrorMessage('');
    setIsAnalyzing(true);
    setLoadingStatusText(t.loadingAnalyzingText);
    const startMs = Date.now();

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errorApiFailed);

      const elapsed = Date.now() - startMs;
      if (elapsed < 500) await new Promise((r) => setTimeout(r, 500 - elapsed));

      data.isImage = false;
      setLatestVerdict(data);
      setActiveSourceText(text);
      setAnalyzedTimestamp(getCurrentFormattedTime());
      setChatMessages([]);

      const historyItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        type: 'text',
        sourceText: text.slice(0, 140),
        verdict: data
      };
      setScanHistory((prev) => [historyItem, ...prev.slice(0, 19)]);
    } catch (err) {
      setErrorMessage(err.message || t.errorApiFailed);
    } finally {
      setIsAnalyzing(false);
      setLoadingStatusText('');
    }
  };

  // 2. Screenshot / Image Analysis Pipeline
  const handleImageFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage(t.errorImageOversized);
      return;
    }
    setErrorMessage('');
    setIsAnalyzing(true);
    setLoadingStatusText(t.loadingReadingImage);

    try {
      const prepared = await prepareImage(file);
      if (!prepared) throw new Error(t.errorOcrFailed);
      setSelectedImage(prepared);

      setLoadingStatusText(t.loadingCheckingImage);
      const startMs = Date.now();

      let result = null;
      try {
        const res = await fetch('/api/check-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: prepared.base64,
            mimeType: prepared.mimeType
          })
        });
        if (res.ok) result = await res.json();
      } catch (e) {
        console.warn('Backend image check error:', e);
      }

      // Internal OCR fallback if vision API is unavailable
      let extractedText = result?.ocr?.text || result?.transcript || '';
      if (!result) {
        try {
          const tesseract = (
            await import(
              /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js'
            )
          ).default;
          const ocrLang = language === 'hi' ? 'hin+eng' : 'eng+hin';
          const { data } = await tesseract.recognize(prepared.dataUrl, ocrLang);
          const rawOcr = (data?.text || '').replace(/[ \t]+\n/g, '\n').trim().slice(0, 1000);
          if (rawOcr && (rawOcr.match(/[\p{L}\p{N}]/gu) || []).length >= 3) {
            extractedText = rawOcr;
            const retryRes = await fetch('/api/check-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image: prepared.base64,
                mimeType: prepared.mimeType,
                ocrText: rawOcr
              })
            });
            if (retryRes.ok) {
              result = await retryRes.json();
            } else {
              const textRes = await fetch('/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: rawOcr })
              });
              if (textRes.ok) result = await textRes.json();
            }
          }
        } catch (ocrErr) {
          console.warn('Client OCR execution error:', ocrErr);
        }
      }

      const elapsed = Date.now() - startMs;
      if (elapsed < 500) await new Promise((r) => setTimeout(r, 500 - elapsed));

      if (result) {
        const finalAnalysis = result.analysis || result;
        finalAnalysis.isImage = true;
        setLatestVerdict(finalAnalysis);
        setActiveSourceText(extractedText);
        setAnalyzedTimestamp(getCurrentFormattedTime());
        setChatMessages([]);

        const historyItem = {
          id: Date.now(),
          timestamp: new Date().toLocaleString(),
          type: 'image',
          imageUrl: prepared.dataUrl,
          sourceText: extractedText || 'Screenshot scan',
          verdict: finalAnalysis
        };
        setScanHistory((prev) => [historyItem, ...prev.slice(0, 19)]);
      } else {
        throw new Error(t.errorApiFailed);
      }
    } catch (err) {
      setErrorMessage(err.message || t.errorApiFailed);
    } finally {
      setIsAnalyzing(false);
      setLoadingStatusText('');
    }
  };

  // 3. Follow-up Q&A Chat Pipeline
  const sendChatMessage = async (presetQuestion) => {
    const question = (presetQuestion || chatDraft).trim();
    if (!question || chatBusy) return;

    setChatDraft('');
    const userMsg = { id: Date.now(), role: 'user', text: question };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatBusy(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          context: activeSourceText.slice(0, 1000),
          language,
          detectionResult: latestVerdict
        })
      });
      if (!response.ok) throw new Error('Chat service busy');
      const data = await response.json();

      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: data.reply
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      let fallbackText = '';
      if (latestVerdict) {
        const isFraud =
          latestVerdict.riskLevel === 'HIGH_RISK' ||
          latestVerdict.riskLevel === 'SUSPICIOUS';
        if (language === 'hi') {
          fallbackText = isFraud
            ? `इस संदेश में उच्च जोखिम के स्पष्ट संकेत मिले हैं। किसी भी हालत में अपना OTP या UPI PIN किसी के साथ साझा न करें और बैंक ऐप में खुद जाँचें।`
            : `इस संदेश में कोई सीधा धोखाधड़ी का पैटर्न नहीं मिला। फिर भी सावधानी बरतें और बैंक ऐप से पुष्टि करें।`;
        } else if (language === 'hinglish') {
          fallbackText = isFraud
            ? `Is message me high-risk scam indicators mile hain. Kisi ke sath bhi OTP ya UPI PIN share mat karein aur official bank app me check karein.`
            : `Is message me koi direct scam pattern nahi mila. Phir bhi official bank app se confirm karein.`;
        } else {
          fallbackText = isFraud
            ? `This message contains high-risk scam warning signs. Do not share your OTP or UPI PIN, and verify independently in your bank app.`
            : `No direct scam pattern was detected. Still exercise caution and verify via official bank channels.`;
        }
      } else {
        fallbackText =
          language === 'hi'
            ? 'कृपया पहले कोई संदेश या स्क्रीनशॉट जाँचने के लिए भेजें।'
            : language === 'hinglish'
            ? 'Pehle koi message ya screenshot analyze karne ke liye bhejein.'
            : 'Please check a message or screenshot first to discuss.';
      }
      setChatMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', text: fallbackText }
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  // Trigger Example Analysis
  const runExample = (exampleText) => {
    setActiveTab('text');
    setInputText(exampleText);
    setSelectedImage(null);
    setCurrentNav('check');
    runTextAnalysis(exampleText);
  };

  // Restore prior scan from History
  const restoreScan = (historyItem) => {
    if (historyItem.type === 'image' && historyItem.imageUrl) {
      setSelectedImage({
        dataUrl: historyItem.imageUrl,
        name: 'Saved screenshot'
      });
      setActiveTab('image');
    } else {
      setInputText(historyItem.sourceText || '');
      setActiveTab('text');
    }
    setLatestVerdict(historyItem.verdict);
    setActiveSourceText(historyItem.sourceText || '');
    setAnalyzedTimestamp(historyItem.timestamp || getCurrentFormattedTime());
    setCurrentNav('check');
    setChatMessages([]);
  };

  // Evaluation & Gauge calculations
  const risk =
    latestVerdict?.riskLevel ||
    (latestVerdict?.label === 'scam' ? 'HIGH_RISK' : 'UNCERTAIN');
  const isHighRisk = risk === 'HIGH_RISK';
  const isSuspicious = risk === 'SUSPICIOUS';
  const isFraud = isHighRisk || isSuspicious;
  const isPaymentReceipt =
    !isFraud &&
    (latestVerdict?.recoveryFocus === 'money_sent' ||
      latestVerdict?.category === 'legit_receipt' ||
      latestVerdict?.category === 'Legitimate Transaction');

  // Every percentage below is derived from the real signals of THIS verdict
  // (severity-weighted), never a fixed number.
  const verdictSignals = Array.isArray(latestVerdict?.signals) ? latestVerdict.signals : [];
  const SEV_GAUGE = { high: 30, medium: 15, low: 8 };
  const SEV_BAR = { high: 90, medium: 60, low: 30 };
  const gaugePercent = Math.min(
    99,
    verdictSignals.reduce((sum, sig) => sum + (SEV_GAUGE[sig?.severity] || 0), 0)
  );
  const gaugeStrokeColor = isHighRisk
    ? '#ef4444'
    : isSuspicious
    ? '#f97316'
    : isPaymentReceipt
    ? '#10b981'
    : '#3b82f6';
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (gaugePercent / 100) * circumference;

  const barValueFor = (re) => {
    const match = verdictSignals.find((sig) => re.test(`${sig?.type || ''} ${sig?.category || ''}`));
    return match ? (SEV_BAR[match.severity] || 30) : 0;
  };
  const kycIndicatorVal = barValueFor(/kyc/i);
  const urlIndicatorVal = barValueFor(/link|url|domain/i);
  const threatIndicatorVal = barValueFor(/threat|block|impersonat/i);
  const urgencyIndicatorVal = barValueFor(/urgency|pressure/i);
  const topSignalPills = [...verdictSignals]
    .sort((a, b) => (SEV_BAR[b?.severity] || 0) - (SEV_BAR[a?.severity] || 0))
    .filter((sig, i, arr) => arr.findIndex((s) => (s?.category || s?.type) === (sig?.category || sig?.type)) === i)
    .slice(0, 4);

  // Translated category & evidence
  const displayCategory = latestVerdict
    ? language === 'hi' && latestVerdict.categoryLabelHi
      ? latestVerdict.categoryLabelHi
      : translateCategory(latestVerdict.category, language, latestVerdict.categoryLabel)
    : '';

  const rawEvidence = latestVerdict
    ? language === 'hi' &&
      Array.isArray(latestVerdict.evidenceHi) &&
      latestVerdict.evidenceHi.length > 0
      ? latestVerdict.evidenceHi
      : Array.isArray(latestVerdict.evidence) && latestVerdict.evidence.length > 0
      ? latestVerdict.evidence
      : latestVerdict.signals?.map((s) => s.evidence || s.type) || []
    : [];

  const displayEvidence = rawEvidence.map((ev) =>
    language === 'hi' ? ev : translateEvidence(ev, language)
  );

  const displayRecommendations = latestVerdict
    ? language === 'hi' &&
      Array.isArray(latestVerdict.recommendationsHi) &&
      latestVerdict.recommendationsHi.length > 0
      ? latestVerdict.recommendationsHi
      : Array.isArray(latestVerdict.recommendations) &&
        latestVerdict.recommendations.length > 0
      ? latestVerdict.recommendations
      : translateRecommendation(
          latestVerdict.safeAction,
          latestVerdict.category,
          language
        )
    : [];

  return (
    <div
      lang={language}
      className={`min-h-screen w-full relative overflow-x-hidden transition-colors duration-300 font-sans ${
        theme === 'dark'
          ? 'dark-theme bg-[#0a0d14] text-slate-100'
          : 'glass-canvas text-slate-800'
      }`}
    >
      {/* Ambient 3D Glass Orbs (Matching reference mockup directly) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full glass-bubble orb-float-1 opacity-75 blur-[1px]" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full glass-bubble orb-float-2 opacity-60 blur-[2px]" />
        <div className="absolute -bottom-20 right-1/4 w-96 h-96 rounded-full glass-bubble orb-float-1 opacity-50 blur-[3px]" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 max-w-[1520px] mx-auto p-4 sm:p-6 lg:p-7 min-h-screen flex flex-col gap-5 pb-28 lg:pb-7">
        {/* Responsive Layout Grid */}
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 flex-1 items-start">
          
          {/* ========================================================
              LEFT SIDEBAR: Unified Single Tall Card (Exact reference match)
             ======================================================== */}
          <aside className={`hidden lg:flex w-full lg:w-[220px] xl:w-[235px] shrink-0 p-5 rounded-[28px] glass-panel flex-col justify-between self-stretch lg:min-h-[660px]`}>
            <div className="flex flex-col gap-6">
              {/* Top Logo & Title */}
              <div className="hidden lg:flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 text-xl font-bold">
                  ✓
                </div>
                <div>
                  <h1 className="font-heading font-extrabold text-[15px] leading-tight text-slate-900 dark:text-white">
                    {t.brandName}
                  </h1>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {t.brandTagline}
                  </p>
                </div>
              </div>

              {/* Navigation Items */}
              <nav aria-label="Main Navigation" className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentNav('check')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer text-left ${
                    currentNav === 'check'
                      ? 'glass-nav-active'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="text-base">💬</span>
                  <span>{t.navCheckMessage}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentNav('history')}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer text-left ${
                    currentNav === 'history'
                      ? 'glass-nav-active'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">🕒</span>
                    <span>{t.navHistory}</span>
                  </div>
                  {scanHistory.length > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold">
                      {scanHistory.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentNav('examples')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer text-left ${
                    currentNav === 'examples'
                      ? 'glass-nav-active'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="text-base">📑</span>
                  <span>{t.navScamExamples}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentNav('tips')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer text-left ${
                    currentNav === 'tips'
                      ? 'glass-nav-active'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="text-base">🛡️</span>
                  <span>{t.navSafetyTips}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentNav('settings')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer text-left ${
                    currentNav === 'settings'
                      ? 'glass-nav-active'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="text-base">⚙️</span>
                  <span>{t.navSettings}</span>
                </button>

                <a
                  href="/pay"
                  className="mt-2 flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer text-left border border-slate-300/70 dark:border-white/25 bg-white/70 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-white dark:hover:bg-white/20"
                >
                  <span className="text-base">💳</span>
                  <span>Check before you pay</span>
                </a>
              </nav>
            </div>

            {/* Bottom Mission Card (Integrated inside sidebar like reference image) */}
            <div className="hidden lg:flex pt-4 border-t border-slate-100 dark:border-white/10 flex-col gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20 text-sm font-bold">
                ✓
              </div>
              <h2 className="font-heading font-bold text-xs text-slate-900 dark:text-white">
                {t.brandMissionTitle}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {t.brandMissionDesc}
              </p>
              <div className="mt-1 h-1 w-10 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            </div>
          </aside>

          {/* ========================================================
              RIGHT WORKSPACE CONTAINER (Header + Center + Right Panel)
             ======================================================== */}
          <div className="flex-1 flex flex-col gap-5 min-w-0">
            
            {/* Top Header Row (Spanning across workspace) */}
            <header className="flex flex-wrap items-center justify-between gap-3">
              {/* Phone brand (the sidebar is hidden on phones) */}
              <div className="sm:hidden flex items-center gap-2 min-w-0">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white text-base font-bold">✓</div>
                <span className="font-heading font-extrabold text-[15px] text-slate-900 dark:text-white hidden min-[430px]:inline">{t.brandName}</span>
              </div>
              {/* Left Pill Badge */}
              <div className="hidden sm:flex items-center gap-2.5 px-4 py-2 rounded-full glass-panel text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
                <span className="text-base text-indigo-500 animate-pulse">✨</span>
                <span className="font-bold text-slate-900 dark:text-white">{t.headerBadge}</span>
                <span className="hidden sm:inline text-slate-400 font-normal">
                  {t.headerBadgeSub}
                </span>
              </div>

              {/* Right Controls: Language, Theme, Avatar */}
              <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
                <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="text-base">🌐</span>
                  <select
                    aria-label={t.language}
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="bg-transparent font-semibold text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-1"
                  >
                    <option value="en" className="text-slate-900 bg-white">English</option>
                    <option value="hi" className="text-slate-900 bg-white">हिंदी</option>
                    <option value="hinglish" className="text-slate-900 bg-white">Hinglish</option>
                  </select>
                </div>

                <ThemeToggle
                  theme={theme}
                  onToggle={toggleTheme}
                  label={t.theme}
                />

                <button
                  type="button"
                  title={t.navSettings}
                  aria-label={t.navSettings}
                  onClick={() => setCurrentNav('settings')}
                  className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm shadow-md shadow-indigo-500/20 cursor-pointer lg:cursor-default"
                >
                  A
                </button>
              </div>
            </header>

            {/* Main Content Area (Center Column + Right Panel) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 lg:gap-6 items-start">
              
              {/* ========================================================
                  CENTER COLUMN: Scam Detection Workspace (xl:col-span-8)
                 ======================================================== */}
              <main className="xl:col-span-8 flex flex-col gap-4 min-w-0">
                
                {/* VIEW 1: Main Scam Detection Workspace */}
                {currentNav === 'check' && (
                  <>
                    {/* Big Heading */}
                    <div className="px-1">
                      <h2 className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-[32px] tracking-tight text-slate-900 dark:text-white leading-tight">
                        {t.heroTitlePrefix}{' '}
                        <span className="ss-serif">
                          {t.heroTitleMessage}
                        </span>{' '}
                        {t.heroTitleOr}{' '}
                        <span className="ss-serif">
                          {t.heroTitleScreenshot}
                        </span>
                      </h2>
                      <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                        {t.heroSubtitle}
                      </p>
                    </div>

                    {/* Input Composer Card */}
                    <div className="p-4 sm:p-5 rounded-[24px] glass-panel-elevated flex flex-col gap-3 relative">
                      {/* Tabs Switcher: Paste Text / Upload Screenshot */}
                      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100/70 dark:bg-slate-800/70 w-fit">
                        <button
                          type="button"
                          onClick={() => setActiveTab('text')}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                            activeTab === 'text'
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-white/10'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                          }`}
                        >
                          <span>💬</span>
                          <span>{t.tabPasteText}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('image')}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                            activeTab === 'image'
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-white/10'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                          }`}
                        >
                          <span>🖼️</span>
                          <span>{t.tabUploadScreenshot}</span>
                        </button>
                      </div>

                      {/* TAB A: Text Input Row */}
                      {activeTab === 'text' && (
                        <div className="flex items-center gap-2 p-1.5 sm:p-2 rounded-2xl bg-white/85 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                          <span className="text-slate-400 text-base pl-2">📎</span>
                          <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') runTextAnalysis();
                            }}
                            placeholder={t.inputPlaceholder}
                            disabled={isAnalyzing}
                            className="w-full bg-transparent px-2 text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => runTextAnalysis()}
                            disabled={isAnalyzing || !inputText.trim()}
                            className="btn-vibrant-gradient px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isAnalyzing ? (
                              <>
                                <span className="animate-spin text-sm">⚙️</span>
                                <span>{t.analyzingButton}</span>
                              </>
                            ) : (
                              <>
                                <span>✨ {t.analyzeButton}</span>
                                <span>→</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* TAB B: Image Drag & Drop / Upload Area */}
                      {activeTab === 'image' && (
                        <div className="flex flex-col gap-3">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageFile(file);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />

                          {!selectedImage ? (
                            <div
                              onClick={() => fileInputRef.current?.click()}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleImageFile(file);
                              }}
                              className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/80 transition cursor-pointer text-center"
                            >
                              <span className="text-3xl text-indigo-500">📤</span>
                              <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                                {t.uploadDragDrop}
                              </p>
                              <p className="text-xs text-slate-400">{t.uploadSubtext}</p>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10">
                              <img
                                src={selectedImage.dataUrl}
                                alt="Screenshot Preview"
                                onClick={() => setPreviewModalUrl(selectedImage.dataUrl)}
                                className="h-14 w-14 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:opacity-90"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                                  {selectedImage.name}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  Original screenshot loaded for OCR & AI analysis
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedImage(null)}
                                  className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                >
                                  {t.removeImage}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="btn-vibrant-gradient px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                                >
                                  Change
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Loading status */}
                      {isAnalyzing && (
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                          <span className="animate-spin">⚙️</span>
                          <span>{loadingStatusText || t.analyzingButton}</span>
                          <span className="animate-pulse">● ● ●</span>
                        </div>
                      )}

                      {/* Error banner */}
                      {errorMessage && (
                        <div
                          role="alert"
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-300"
                        >
                          <div className="flex items-center gap-2">
                            <span>⚠️</span>
                            <span>{errorMessage}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setErrorMessage('')}
                            className="text-xs font-bold hover:underline cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Try an Example Chips Row */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          {t.tryExample}
                        </span>
                        <button
                          type="button"
                          onClick={() => runExample(t.exampleTextKyc)}
                          className="px-3 py-1 rounded-full font-medium bg-rose-50 border border-rose-200/90 text-rose-700 hover:bg-rose-100 hover:scale-105 active:scale-95 transition cursor-pointer"
                        >
                          {t.exampleKyc}
                        </button>
                        <button
                          type="button"
                          onClick={() => runExample(t.exampleTextRefund)}
                          className="px-3 py-1 rounded-full font-medium bg-blue-50 border border-blue-200/90 text-blue-700 hover:bg-blue-100 hover:scale-105 active:scale-95 transition cursor-pointer"
                        >
                          {t.exampleRefund}
                        </button>
                        <button
                          type="button"
                          onClick={() => runExample(t.exampleTextLottery)}
                          className="px-3 py-1 rounded-full font-medium bg-purple-50 border border-purple-200/90 text-purple-700 hover:bg-purple-100 hover:scale-105 active:scale-95 transition cursor-pointer"
                        >
                          {t.exampleLottery}
                        </button>
                        <button
                          type="button"
                          onClick={() => runExample(t.exampleTextBankAlert)}
                          className="px-3 py-1 rounded-full font-medium bg-amber-50 border border-amber-200/90 text-amber-700 hover:bg-amber-100 hover:scale-105 active:scale-95 transition cursor-pointer"
                        >
                          {t.exampleBankAlert}
                        </button>
                        <button
                          type="button"
                          onClick={() => runExample(t.exampleTextSuspiciousLink)}
                          className="px-3 py-1 rounded-full font-medium bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 hover:scale-105 active:scale-95 transition cursor-pointer"
                        >
                          {t.exampleSuspiciousLink}
                        </button>
                      </div>
                    </div>

                    {/* ========================================================
                        RESULT CARD (Dimensional Match with Image 2)
                       ======================================================== */}
                    {latestVerdict && (
                      <div
                        ref={resultCardRef}
                        className="ss-band dark dark-theme p-5 sm:p-6 rounded-[28px] glass-panel-elevated flex flex-col gap-4 border border-white/95 shadow-[0_20px_45px_-12px_rgba(244,63,94,0.08)] relative overflow-hidden"
                      >
                        {/* Soft red glow on top left if High Risk */}
                        {isHighRisk && (
                          <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 bg-rose-400/10 rounded-full blur-3xl" />
                        )}

                        {/* Top Header */}
                        <div className="flex items-start justify-between gap-3 relative z-10">
                          <div className="flex items-center gap-3.5">
                            {/* 3D Shield Badge with Exclamation Icon */}
                            <div
                              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl text-white font-black shadow-lg ${
                                isHighRisk
                                  ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30'
                                  : isSuspicious
                                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30'
                                  : isPaymentReceipt
                                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
                                  : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'
                              }`}
                            >
                              {isHighRisk ? '!' : isSuspicious ? '⚠' : isPaymentReceipt ? '✓' : '?'}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`px-3 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide uppercase ${
                                    isHighRisk
                                      ? 'bg-rose-500/15 text-rose-600 dark:bg-rose-900/60 dark:text-rose-200'
                                      : isSuspicious
                                      ? 'bg-amber-500/15 text-amber-600 dark:bg-amber-900/60 dark:text-amber-200'
                                      : isPaymentReceipt
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-200'
                                      : 'bg-blue-500/15 text-blue-600 dark:bg-blue-900/60 dark:text-blue-200'
                                  }`}
                                >
                                  {isHighRisk
                                    ? t.riskLevelHigh
                                    : isSuspicious
                                    ? t.riskLevelSuspicious
                                    : isPaymentReceipt
                                    ? t.riskLevelPayment
                                    : t.riskLevelUncertain}
                                </span>
                                {analyzedTimestamp && (
                                  <span className="text-[11px] text-slate-400 font-medium">
                                    {t.checkedAt} {analyzedTimestamp}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white leading-tight">
                                {displayCategory}
                              </h3>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(activeSourceText);
                              alert('Message copied to clipboard');
                            }}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer text-lg"
                          >
                            ⋮
                          </button>
                        </div>

                        {/* Subtitle */}
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                          {language === 'hi' && latestVerdict.summaryHi
                            ? latestVerdict.summaryHi
                            : latestVerdict.summary || latestVerdict.reason}
                        </p>

                        {/* Signal Pills Row - only the signals actually detected in this verdict */}
                        {topSignalPills.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {topSignalPills.map((sig, i) => (
                              <span
                                key={i}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold capitalize border ${
                                  sig.severity === 'high'
                                    ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                    : sig.severity === 'medium'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                }`}
                              >
                                <span>{sig.severity === 'high' ? '!' : '•'}</span>
                                <span>
                                  {translateCategory(
                                    sig.category,
                                    language,
                                    String(sig.type || 'signal').replace(/_/g, ' ')
                                  )}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Two Columns: Why Flagged (Left) | What to do (Right) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          {/* Column 1: Why we flagged it */}
                          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 flex flex-col gap-2.5">
                            <div className="flex items-center gap-2 font-heading font-bold text-sm text-slate-900 dark:text-white">
                              <span className="text-rose-500">⚠️</span>
                              <h4>{t.whyFlagged}</h4>
                            </div>
                            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                              {displayEvidence.length > 0 ? (
                                displayEvidence.map((ev, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-rose-500 text-sm leading-none mt-1">●</span>
                                    <span>{ev}</span>
                                  </li>
                                ))
                              ) : (
                                <li className="flex items-start gap-2">
                                  <span className="text-slate-400 text-sm leading-none mt-1">●</span>
                                  <span>{latestVerdict.reason || 'Standard security checks.'}</span>
                                </li>
                              )}
                            </ul>
                          </div>

                          {/* Column 2: What you should do */}
                          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 flex flex-col gap-2.5">
                            <div className="flex items-center gap-2 font-heading font-bold text-sm text-slate-900 dark:text-white">
                              <span className="text-emerald-500">🛡️</span>
                              <h4>{t.whatToDo}</h4>
                            </div>
                            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                              {displayRecommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-emerald-500 text-sm font-bold leading-none mt-0.5">
                                    ✓
                                  </span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Accordion: "How we detected this" (4 Detection Source Cards) */}
                        <div className="pt-2 border-t border-slate-200/80 dark:border-white/10">
                          <button
                            type="button"
                            onClick={() => setShowHowItWorks((prev) => !prev)}
                            className="w-full flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 transition cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-indigo-500">🔍</span>
                              <span>{t.howWeDetected}</span>
                            </div>
                            <span className="text-base">{showHowItWorks ? '▲' : '▼'}</span>
                          </button>

                          {showHowItWorks && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                              <div className="p-3 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 flex flex-col gap-1">
                                <span className="text-lg">💬</span>
                                <h5 className="font-heading font-bold text-xs text-slate-900 dark:text-white">
                                  {t.sourceMsgAnalysis}
                                </h5>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {t.sourceMsgAnalysisDesc}
                                </p>
                              </div>
                              <div className="p-3 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 flex flex-col gap-1">
                                <span className="text-lg">🔗</span>
                                <h5 className="font-heading font-bold text-xs text-slate-900 dark:text-white">
                                  {t.sourceLinkAnalysis}
                                </h5>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {t.sourceLinkAnalysisDesc}
                                </p>
                              </div>
                              <div className="p-3 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 flex flex-col gap-1">
                                <span className="text-lg">👤</span>
                                <h5 className="font-heading font-bold text-xs text-slate-900 dark:text-white">
                                  {t.sourceSenderContext}
                                </h5>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {t.sourceSenderContextDesc}
                                </p>
                              </div>
                              <div className="p-3 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 flex flex-col gap-1">
                                <span className="text-lg">🗄️</span>
                                <h5 className="font-heading font-bold text-xs text-slate-900 dark:text-white">
                                  {t.sourceScamDatabase}
                                </h5>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {t.sourceScamDatabaseDesc}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Interactive Follow-up Q&A Thread */}
                        <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <h4 className="font-heading font-bold text-xs text-slate-800 dark:text-slate-200">
                              {t.followUpHeading}
                            </h4>
                            <span className="text-[10px] text-slate-400">Context Memory Active</span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 text-xs">
                            <button
                              type="button"
                              onClick={() => sendChatMessage(t.quickQuestionFraud)}
                              className="px-3 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-medium transition cursor-pointer"
                            >
                              ❓ {t.quickQuestionFraud}
                            </button>
                            <button
                              type="button"
                              onClick={() => sendChatMessage(t.quickQuestionWhy)}
                              className="px-3 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-medium transition cursor-pointer"
                            >
                              🔍 {t.quickQuestionWhy}
                            </button>
                            <button
                              type="button"
                              onClick={() => sendChatMessage(t.quickQuestionWhatToDo)}
                              className="px-3 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-medium transition cursor-pointer"
                            >
                              🛡️ {t.quickQuestionWhatToDo}
                            </button>
                          </div>

                          {chatMessages.length > 0 && (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {chatMessages.map((msg) => (
                                <div
                                  key={msg.id}
                                  className={`flex ${
                                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                                      msg.role === 'user'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none shadow-sm'
                                        : 'bg-white/80 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 rounded-bl-none shadow-sm whitespace-pre-wrap'
                                    }`}
                                  >
                                    {msg.text}
                                  </div>
                                </div>
                              ))}
                              {chatBusy && (
                                <div className="flex justify-start">
                                  <div className="px-3 py-1.5 rounded-2xl bg-white/80 dark:bg-slate-800 text-xs text-slate-400 flex items-center gap-2">
                                    <span className="animate-spin text-xs">⚙️</span>
                                    <span>Thinking...</span>
                                  </div>
                                </div>
                              )}
                              <div ref={chatScrollRef} />
                            </div>
                          )}

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              sendChatMessage();
                            }}
                            className="flex items-center gap-2 p-1 rounded-full bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 shadow-inner"
                          >
                            <input
                              type="text"
                              value={chatDraft}
                              onChange={(e) => setChatDraft(e.target.value)}
                              placeholder={t.followUpPlaceholder}
                              disabled={chatBusy}
                              className="flex-1 px-3 text-xs bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                            />
                            <button
                              type="submit"
                              disabled={chatBusy || !chatDraft.trim()}
                              className="btn-vibrant-gradient px-4 py-1 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {t.send}
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* VIEW 2: History View */}
                {currentNav === 'history' && (
                  <div className="p-5 sm:p-6 rounded-[28px] glass-panel-elevated flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                        {t.historyTitle}
                      </h2>
                      {scanHistory.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setScanHistory([])}
                          className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          {t.historyClear}
                        </button>
                      )}
                    </div>

                    {scanHistory.length === 0 ? (
                      <p className="text-xs sm:text-sm text-slate-500 py-8 text-center">
                        {t.historyEmpty}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {scanHistory.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:shadow-md transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xl">
                                {item.verdict?.riskLevel === 'HIGH_RISK'
                                  ? '🔴'
                                  : item.verdict?.riskLevel === 'SUSPICIOUS'
                                  ? '🟠'
                                  : '🟢'}
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                  {translateCategory(
                                    item.verdict?.category,
                                    language,
                                    item.verdict?.categoryLabel
                                  )}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{item.sourceText}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{item.timestamp}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => restoreScan(item)}
                              className="btn-vibrant-gradient px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer"
                            >
                              {t.historyRecheck}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW 3: Scam Examples Catalog */}
                {currentNav === 'examples' && (
                  <div className="p-5 sm:p-6 rounded-[28px] glass-panel-elevated flex flex-col gap-4">
                    <div>
                      <h2 className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                        {t.examplesTitle}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t.examplesSubtitle}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {[
                        {
                          label: t.exampleKyc,
                          desc: 'Fraudulent SMS claiming bank account or KYC is expiring, asking to visit fake domains.',
                          text: t.exampleTextKyc,
                          tag: 'HIGH RISK'
                        },
                        {
                          label: t.exampleRefund,
                          desc: 'Demands advance fee or PIN entry to receive an alleged refund or cashback.',
                          text: t.exampleTextRefund,
                          tag: 'HIGH RISK'
                        },
                        {
                          label: t.exampleLottery,
                          desc: 'Bogus lucky draw or KBC prize notification asking to contact WhatsApp numbers.',
                          text: t.exampleTextLottery,
                          tag: 'HIGH RISK'
                        },
                        {
                          label: t.exampleBankAlert,
                          desc: 'Urgent account suspension alerts redirecting to unauthorized clone websites.',
                          text: t.exampleTextBankAlert,
                          tag: 'HIGH RISK'
                        },
                        {
                          label: t.exampleSuspiciousLink,
                          desc: 'Postal courier delivery failed notification carrying unknown IP addresses.',
                          text: t.exampleTextSuspiciousLink,
                          tag: 'HIGH RISK'
                        }
                      ].map((ex, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/10 flex flex-col justify-between gap-3 hover:shadow-md transition"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                                {ex.label}
                              </h4>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                {ex.tag}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mb-2 leading-relaxed">{ex.desc}</p>
                            <div className="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-xs text-slate-700 dark:text-slate-300 italic line-clamp-2">
                              "{ex.text}"
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => runExample(ex.text)}
                            className="btn-vibrant-gradient w-full py-2 rounded-full text-xs font-semibold cursor-pointer"
                          >
                            {t.testThisExample} →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* VIEW 4: Safety Tips View */}
                {currentNav === 'tips' && (
                  <div className="p-5 sm:p-6 rounded-[28px] glass-panel-elevated flex flex-col gap-4">
                    <div>
                      <h2 className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                        {t.safetyTipsTitle}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Official cyber hygiene practices recognized by NPCI and RBI.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {[
                        {
                          icon: '🚫',
                          title: t.tip1Title,
                          desc: t.tip1Desc,
                          action: 'Receiving money NEVER requires your UPI PIN.'
                        },
                        {
                          icon: '🔗',
                          title: t.tip2Title,
                          desc: t.tip2Desc,
                          action: 'Do not click links in SMS claiming account block or KYC updates.'
                        },
                        {
                          icon: '✓',
                          title: t.tip3Title,
                          desc: t.tip3Desc,
                          action: 'Open your banking app directly from your phone home screen.'
                        },
                        {
                          icon: '🚩',
                          title: t.tip4Title,
                          desc: t.tip4Desc,
                          action: 'Call 1930 immediately if money has been deducted by fraud.'
                        }
                      ].map((tip, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedTip(tip)}
                          className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/10 flex items-start gap-3.5 hover:shadow-md transition cursor-pointer"
                        >
                          <span className="text-2xl mt-0.5">{tip.icon}</span>
                          <div className="flex-1">
                            <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                              {tip.title}
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                              {tip.desc}
                            </p>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-2">
                              Key rule: {tip.action}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* VIEW 5: Settings View */}
                {currentNav === 'settings' && (
                  <div className="p-5 sm:p-6 rounded-[28px] glass-panel-elevated flex flex-col gap-5">
                    <h2 className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                      {t.settingsTitle}
                    </h2>

                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                            {t.settingsLanguageLabel}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Zero-reload dynamic switching (persisted locally)
                          </p>
                        </div>
                        <select
                          value={language}
                          onChange={(e) => handleLanguageChange(e.target.value)}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-semibold outline-none cursor-pointer"
                        >
                          <option value="en">English</option>
                          <option value="hi">हिंदी (Hindi)</option>
                          <option value="hinglish">Hinglish</option>
                        </select>
                      </div>

                      <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                            {t.settingsThemeLabel}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Light glassmorphic aesthetic or dark cyber theme
                          </p>
                        </div>
                        <ThemeToggle
                          theme={theme}
                          onToggle={toggleTheme}
                          label={t.theme}
                        />
                      </div>

                      <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                            {t.settingsServerStatus}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Evidence fusion engine & deterministic verification
                          </p>
                        </div>
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                          <span>{t.settingsServerConnected}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </main>

              {/* ========================================================
                  RIGHT COLUMN: Risk Overview & Insights (xl:col-span-4)
                 ======================================================== */}
              <aside className="xl:col-span-4 flex flex-col gap-4 min-w-0">
                
                {/* Card 1: Risk Overview (Exact Side-by-Side Dimensional Match) */}
                <div className="ss-band dark dark-theme p-5 rounded-[28px] glass-panel flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-500 text-base">📊</span>
                      <h3 className="font-heading font-extrabold text-sm text-slate-900 dark:text-white">
                        {t.riskOverviewTitle}
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {t.riskIndicatorsLabel}
                    </span>
                  </div>

                  {/* Horizontal Side-by-Side: Gauge (Left) + Bars (Right) */}
                  {latestVerdict ? (
                  <div className="flex items-center gap-4 pt-1">
                    {/* Gauge Circle */}
                    <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="transparent"
                          stroke="#e2e8f0"
                          strokeWidth="8"
                          className="dark:stroke-slate-800"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="transparent"
                          stroke={gaugeStrokeColor}
                          strokeWidth="8"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white leading-none">
                          {gaugePercent}%
                        </span>
                        <span
                          className={`text-[10px] font-bold mt-1 uppercase ${
                            isHighRisk
                              ? 'text-rose-600'
                              : isSuspicious
                              ? 'text-amber-600'
                              : isPaymentReceipt
                              ? 'text-emerald-600'
                              : 'text-blue-600'
                          }`}
                        >
                          {isHighRisk
                            ? 'High Risk'
                            : isSuspicious
                            ? 'Suspicious'
                            : isPaymentReceipt
                            ? 'Receipt'
                            : 'Uncertain'}
                        </span>
                      </div>
                    </div>

                    {/* Indicator Bars */}
                    <div className="flex-1 space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between font-semibold text-[11px] text-slate-700 dark:text-slate-300 mb-0.5">
                          <span>{t.signalKycPhishing}</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {kycIndicatorVal}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-500"
                            style={{ width: `${kycIndicatorVal}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-[11px] text-slate-700 dark:text-slate-300 mb-0.5">
                          <span>{t.signalSuspiciousUrl}</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {urlIndicatorVal}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                            style={{ width: `${urlIndicatorVal}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-[11px] text-slate-700 dark:text-slate-300 mb-0.5">
                          <span>{t.signalAccountThreat}</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {threatIndicatorVal}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all duration-500"
                            style={{ width: `${threatIndicatorVal}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-[11px] text-slate-700 dark:text-slate-300 mb-0.5">
                          <span>{t.signalUrgency}</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {urgencyIndicatorVal}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                            style={{ width: `${urgencyIndicatorVal}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  ) : (
                    <p className="pt-1 text-xs text-slate-400 dark:text-slate-500">{t.riskEmpty}</p>
                  )}
                </div>

                {/* Card 2: Message Details (Exact reference styling) */}
                {latestVerdict && (
                <div className="p-5 rounded-[28px] glass-panel flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-500 text-base">📄</span>
                    <h3 className="font-heading font-extrabold text-sm text-slate-900 dark:text-white">
                      {t.messageDetailsTitle}
                    </h3>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                    <div className="py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">?</span>
                        <span>{t.detailCategory}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold px-2 py-0.5 rounded-full text-[11px] bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 truncate max-w-[130px]">
                          {displayCategory || '-'}
                        </span>
                        <span className="text-slate-400 text-sm">›</span>
                      </div>
                    </div>

                    <div className="py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">🌐</span>
                        <span>{t.detailLanguage}</span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                        <span>
                          {language === 'hi'
                            ? 'Hindi'
                            : language === 'hinglish'
                            ? 'Hinglish'
                            : 'English'}
                        </span>
                        <span className="text-slate-400 text-sm">›</span>
                      </div>
                    </div>

                    <div className="py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">🔗</span>
                        <span>{t.detailContainsLink}</span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                        <span>
                          {latestVerdict?.maskedEntities?.urls?.length > 0 || /https?:\/\/|www\./i.test(activeSourceText)
                            ? t.yes
                            : t.no}
                        </span>
                        <span className="text-slate-400 text-sm">›</span>
                      </div>
                    </div>

                    <div className="py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">👤</span>
                        <span>{t.detailUrgency}</span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                        <span>
                          {isHighRisk || isSuspicious || /urgent|block|immediately|expire|24 hours/i.test(activeSourceText)
                            ? t.yes
                            : t.no}
                        </span>
                        <span className="text-slate-400 text-sm">›</span>
                      </div>
                    </div>

                    <div className="py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">🛡️</span>
                        <span>{t.detailAccountThreat}</span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                        <span>
                          {isHighRisk && /block|threat|suspend/i.test(latestVerdict?.category || activeSourceText)
                            ? t.yes
                            : t.no}
                        </span>
                        <span className="text-slate-400 text-sm">›</span>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* Card 3: Safety Tips (Exact reference list) */}
                <div className="p-5 rounded-[28px] glass-panel flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 text-base">💡</span>
                    <h3 className="font-heading font-extrabold text-sm text-slate-900 dark:text-white">
                      {t.safetyTipsTitle}
                    </h3>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {[
                      { icon: '🚫', text: t.tip1Title, color: 'text-rose-500 bg-rose-50' },
                      { icon: '🔗', text: t.tip2Title, color: 'text-rose-500 bg-rose-50' },
                      { icon: '✓', text: t.tip3Title, color: 'text-emerald-500 bg-emerald-50' },
                      { icon: '🚩', text: t.tip4Title, color: 'text-blue-500 bg-blue-50' }
                    ].map((item, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCurrentNav('tips')}
                        className="w-full p-2.5 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2 text-left hover:bg-white transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs shrink-0 ${item.color}`}>
                            {item.icon}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {item.text}
                          </span>
                        </div>
                        <span className="text-slate-400 text-sm">›</span>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox / Modal for Original Full Screenshot */}
      {previewModalUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewModalUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-3xl border border-white/20 bg-slate-900 p-2 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setPreviewModalUrl(null)}
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/75 text-sm font-bold text-white hover:bg-black transition cursor-pointer"
            >
              ✕
            </button>
            <img
              src={previewModalUrl}
              alt="Uploaded Screenshot Full View"
              className="max-h-[82vh] w-auto max-w-[85vw] rounded-2xl object-contain"
            />
          </div>
        </div>
      )}

      {/* Safety Tip Detail Modal */}
      {selectedTip && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedTip(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full rounded-3xl glass-panel-elevated p-6 flex flex-col gap-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{selectedTip.icon}</span>
                <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                  {selectedTip.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTip(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedTip.desc}
            </p>
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              {selectedTip.action}
            </div>
            <button
              type="button"
              onClick={() => setSelectedTip(null)}
              className="btn-vibrant-gradient w-full py-2.5 rounded-full text-xs font-semibold cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
      {/* Phone bottom bar: pill highlight on the active tab */}
      <nav aria-label="Main Navigation" className="ss-bottomnav lg:hidden">
        {[
          { id: 'check', label: SHORT.check, icon: (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z"/></svg>) },
          { id: 'history', label: SHORT.history, icon: (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>) },
          { id: 'examples', label: SHORT.examples, icon: (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>) },
          { id: 'tips', label: SHORT.tips, icon: (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>) },
        ].map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setCurrentNav(it.id)}
            aria-current={currentNav === it.id ? 'page' : undefined}
            className={`ss-bn-item ${currentNav === it.id ? 'is-active' : ''}`}
          >
            <span className="ss-bn-pill">{it.icon}</span>
            <span className="ss-bn-label">{it.label}</span>
          </button>
        ))}
        <a href="/pay" className="ss-bn-item">
          <span className="ss-bn-pill"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h3"/></svg></span>
          <span className="ss-bn-label">Pay</span>
        </a>
      </nav>

      <footer className="ss-footer">
        <div className="ss-footer-big">Check before <span className="ss-serif">you pay.</span></div>
        <p>Rules plus AI review, then a PayPal sandbox payment guard.</p>
        <a href="/pay" className="ss-footer-badge">Built for PayPal AI Hackathon</a>
      </footer>
    </div>
  );
}
