import { useState, useEffect, useRef } from 'react';
import {
  getDictionary,
  translateCategory,
  translateEvidence,
  translateRecommendation
} from './locales/index.js';

const NCRP_URL = 'https://cybercrime.gov.in/Webform/suspect_search_repository.aspx';
const NPCI_FRAUD_URL = 'https://www.npci.org.in/fraud-awareness';
const CYBERCRIME_URL = 'https://cybercrime.gov.in';

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

export default function App() {
  // Localization & Theme (persisted)
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('upi_shield_lang') || 'en';
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('upi_shield_theme') || 'light';
  });

  // Navigation
  const [currentNav, setCurrentNav] = useState('check');
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'image'

  // Input states
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewModalUrl, setPreviewModalUrl] = useState(null);

  // Analysis result states
  const [latestVerdict, setLatestVerdict] = useState(null);
  const [activeSourceText, setActiveSourceText] = useState('');
  const [analyzedTimestamp, setAnalyzedTimestamp] = useState('');
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

  // Save language changes
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    localStorage.setItem('upi_shield_lang', newLang);
  };

  // Toggle theme
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('upi_shield_theme', nextTheme);
  };

  // Save history changes
  useEffect(() => {
    try {
      localStorage.setItem('upi_shield_history', JSON.stringify(scanHistory));
    } catch (err) {
      console.warn('History storage limit:', err);
    }
  }, [scanHistory]);

  // Scroll follow-up chat to bottom on updates
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatBusy]);

  // Formatted current time helper
  const getCurrentFormattedTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 1. Text Analysis Pipeline
  const runTextAnalysis = async (textToAnalyze) => {
    const text = (textToAnalyze || inputText).trim();
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

      // Minimum smooth animation delay
      const elapsed = Date.now() - startMs;
      if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed));

      data.isImage = false;
      setLatestVerdict(data);
      setActiveSourceText(text);
      setAnalyzedTimestamp(getCurrentFormattedTime());
      setChatMessages([]);

      // Append to history
      const historyItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        type: 'text',
        sourceText: text.slice(0, 140),
        verdict: data
      };
      setScanHistory((prev) => [historyItem, ...prev.slice(0, 19)]);

      // Scroll smoothly to result card
      setTimeout(() => {
        resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
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

      // Step A: Send original image to backend for analysis (Gemini vision + OCR + fusion)
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

      // Step B: Internal OCR fallback if vision API failed or was rate limited
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
            // Retry backend with internal OCR text
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
      if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed));

      if (result) {
        const finalAnalysis = result.analysis || result;
        finalAnalysis.isImage = true;
        setLatestVerdict(finalAnalysis);
        setActiveSourceText(extractedText);
        setAnalyzedTimestamp(getCurrentFormattedTime());
        setChatMessages([]);

        // Add to history
        const historyItem = {
          id: Date.now(),
          timestamp: new Date().toLocaleString(),
          type: 'image',
          imageUrl: prepared.dataUrl,
          sourceText: extractedText || 'Screenshot scan',
          verdict: finalAnalysis
        };
        setScanHistory((prev) => [historyItem, ...prev.slice(0, 19)]);

        setTimeout(() => {
          resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
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
      // Fallback response using existing detection context
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

  // Helper: Trigger Example Analysis
  const runExample = (exampleText) => {
    setActiveTab('text');
    setInputText(exampleText);
    setSelectedImage(null);
    setCurrentNav('check');
    runTextAnalysis(exampleText);
  };

  // Helper: Restore a prior scan from History
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
    setTimeout(() => {
      resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
  };

  // Derived evaluation values for Right Panel & Result Card
  const risk = latestVerdict?.riskLevel || (latestVerdict?.label === 'scam' ? 'HIGH_RISK' : 'UNCERTAIN');
  const isHighRisk = risk === 'HIGH_RISK';
  const isSuspicious = risk === 'SUSPICIOUS';
  const isFraud = isHighRisk || isSuspicious;
  const isPaymentReceipt =
    !isFraud &&
    (latestVerdict?.recoveryFocus === 'money_sent' ||
      latestVerdict?.category === 'legit_receipt' ||
      latestVerdict?.category === 'Legitimate Transaction');

  // Gauge calculation
  const gaugePercent = isHighRisk ? 95 : isSuspicious ? 68 : isPaymentReceipt ? 12 : 25;
  const gaugeStrokeColor = isHighRisk
    ? '#ef4444'
    : isSuspicious
    ? '#f97316'
    : isPaymentReceipt
    ? '#10b981'
    : '#3b82f6';
  const circumference = 2 * Math.PI * 45; // r=45
  const strokeDashoffset = circumference - (gaugePercent / 100) * circumference;

  // Real signal percentages based on evaluation indicators
  const kycIndicatorVal = isHighRisk && /kyc/i.test(latestVerdict?.category || '') ? 95 : isFraud ? 65 : 15;
  const urlIndicatorVal = latestVerdict?.maskedEntities?.urls?.length > 0 ? 90 : isFraud ? 60 : 10;
  const threatIndicatorVal = /block|suspend|threat/i.test(latestVerdict?.category || '') ? 85 : isFraud ? 55 : 10;
  const urgencyIndicatorVal = isHighRisk ? 80 : isSuspicious ? 65 : 20;

  // Translated category & evidence
  const displayCategory = latestVerdict
    ? language === 'hi' && latestVerdict.categoryLabelHi
      ? latestVerdict.categoryLabelHi
      : translateCategory(latestVerdict.category, language, latestVerdict.categoryLabel)
    : '';

  const rawEvidence = latestVerdict
    ? language === 'hi' && Array.isArray(latestVerdict.evidenceHi) && latestVerdict.evidenceHi.length > 0
      ? latestVerdict.evidenceHi
      : Array.isArray(latestVerdict.evidence) && latestVerdict.evidence.length > 0
      ? latestVerdict.evidence
      : latestVerdict.signals?.map((s) => s.evidence || s.type) || []
    : [];

  const displayEvidence = rawEvidence.map((ev) =>
    language === 'hi' ? ev : translateEvidence(ev, language)
  );

  const displayRecommendations = latestVerdict
    ? language === 'hi' && Array.isArray(latestVerdict.recommendationsHi) && latestVerdict.recommendationsHi.length > 0
      ? latestVerdict.recommendationsHi
      : Array.isArray(latestVerdict.recommendations) && latestVerdict.recommendations.length > 0
      ? latestVerdict.recommendations
      : translateRecommendation(latestVerdict.safeAction, latestVerdict.category, language)
    : [];

  return (
    <div
      lang={language}
      className={`min-h-screen w-full relative overflow-x-hidden transition-colors duration-300 font-sans ${
        theme === 'dark' ? 'dark-theme bg-[#0a0d14] text-slate-100' : 'glass-canvas text-slate-800'
      }`}
    >
      {/* Ambient 3D Glass Orbs (Matching reference mockup) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full glass-bubble orb-float-1 opacity-75 blur-[1px]" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full glass-bubble orb-float-2 opacity-60 blur-[2px]" />
        <div className="absolute -bottom-20 right-1/4 w-96 h-96 rounded-full glass-bubble orb-float-1 opacity-50 blur-[3px]" />
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="relative z-10 max-w-[1580px] mx-auto p-3 sm:p-5 lg:p-7 min-h-screen flex flex-col">
        {/* Top Header Row */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6">
          {/* Mobile Brand Title (visible on small screens) */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 text-lg">
              🛡️
            </span>
            <div>
              <h1 className="font-heading font-bold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">
                {t.brandName}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {t.brandTagline}
              </p>
            </div>
          </div>

          {/* AI Banner Pill (Matches top-center in mockup) */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-full glass-panel text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
            <span className="text-base text-indigo-500 animate-pulse">✨</span>
            <span className="font-semibold text-slate-900 dark:text-white">{t.headerBadge}:</span>
            <span className="text-slate-500 dark:text-slate-400">{t.headerBadgeSub}</span>
          </div>

          {/* Controls: Language Selector, Theme Toggle, User Avatar */}
          <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
            {/* Language Selector Dropdown */}
            <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel border border-white/80 dark:border-white/10 shadow-sm text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="text-base">🌐</span>
              <select
                aria-label={t.language}
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-transparent font-medium text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-1"
              >
                <option value="en" className="text-slate-900 bg-white">English</option>
                <option value="hi" className="text-slate-900 bg-white">हिंदी</option>
                <option value="hinglish" className="text-slate-900 bg-white">Hinglish</option>
              </select>
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={t.theme}
              title={t.theme}
              className="grid h-9 w-9 place-items-center rounded-full glass-panel hover:scale-105 active:scale-95 transition cursor-pointer text-amber-500 dark:text-amber-300 text-base shadow-sm"
            >
              {theme === 'light' ? '☀️' : '🌙'}
            </button>

            {/* Profile Avatar (Matches reference image) */}
            <div
              title={t.profile}
              className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm shadow-md shadow-indigo-500/20 cursor-default"
            >
              A
            </div>
          </div>
        </header>

        {/* 3-Column Desktop Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 flex-1 items-start">
          {/* ========================================================
              LEFT COLUMN: Navigation & Mission (lg:col-span-3 xl:col-span-2)
             ======================================================== */}
          <aside className="lg:col-span-3 xl:col-span-2 flex flex-col gap-4">
            {/* Desktop Brand Card */}
            <div className="hidden lg:flex items-center gap-3 p-4 rounded-3xl glass-panel">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 text-xl">
                🛡️
              </span>
              <div className="min-w-0">
                <h1 className="font-heading font-bold text-base tracking-tight text-slate-900 dark:text-white truncate">
                  {t.brandName}
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                  {t.brandTagline}
                </p>
              </div>
            </div>

            {/* Main Navigation Pill Menu */}
            <nav
              aria-label="Main Navigation"
              className="p-2 sm:p-2.5 rounded-3xl glass-panel flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible"
            >
              <button
                type="button"
                onClick={() => setCurrentNav('check')}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition shrink-0 lg:w-full cursor-pointer ${
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
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition shrink-0 lg:w-full cursor-pointer ${
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
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition shrink-0 lg:w-full cursor-pointer ${
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
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition shrink-0 lg:w-full cursor-pointer ${
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
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition shrink-0 lg:w-full cursor-pointer ${
                  currentNav === 'settings'
                    ? 'glass-nav-active'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <span className="text-base">⚙️</span>
                <span>{t.navSettings}</span>
              </button>
            </nav>

            {/* Bottom Mission Card (Exact match with reference image) */}
            <div className="hidden lg:flex flex-col gap-2 p-5 rounded-3xl glass-panel relative overflow-hidden">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20 text-lg mb-1">
                ✓
              </div>
              <h2 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                {t.brandMissionTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.brandMissionDesc}
              </p>
              <div className="mt-2 h-1 w-12 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            </div>
          </aside>

          {/* ========================================================
              CENTER COLUMN: Main Workspace (lg:col-span-9 xl:col-span-7)
             ======================================================== */}
          <main className="lg:col-span-9 xl:col-span-7 flex flex-col gap-5">
            {/* VIEW 1: Main Scam Detection Workspace */}
            {currentNav === 'check' && (
              <>
                {/* Hero Heading */}
                <div className="px-1 pt-1">
                  <h2 className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl tracking-tight text-slate-900 dark:text-white">
                    {t.heroTitlePrefix}{' '}
                    <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      {t.heroTitleMessage}
                    </span>{' '}
                    {t.heroTitleOr}{' '}
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {t.heroTitleScreenshot}
                    </span>
                  </h2>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                    {t.heroSubtitle}
                  </p>
                </div>

                {/* Input Card Container */}
                <div className="p-4 sm:p-5 rounded-3xl glass-panel-elevated flex flex-col gap-3 relative">
                  {/* Tabs Switcher: Paste Text / Upload Screenshot */}
                  <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 w-fit">
                    <button
                      type="button"
                      onClick={() => setActiveTab('text')}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                        activeTab === 'text'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <span>💬</span>
                      <span>{t.tabPasteText}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('image')}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                        activeTab === 'image'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <span>🖼️</span>
                      <span>{t.tabUploadScreenshot}</span>
                    </button>
                  </div>

                  {/* TAB A: Text Input Area */}
                  {activeTab === 'text' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-2 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 shadow-inner">
                      <div className="flex items-center gap-2 flex-1 px-2">
                        <span className="text-slate-400 text-base">📎</span>
                        <input
                          type="text"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') runTextAnalysis();
                          }}
                          placeholder={t.inputPlaceholder}
                          disabled={isAnalyzing}
                          className="w-full bg-transparent text-sm sm:text-base text-slate-800 dark:text-white placeholder:text-slate-400 outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => runTextAnalysis()}
                        disabled={isAnalyzing || !inputText.trim()}
                        className="btn-vibrant-gradient px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                            className="h-16 w-16 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:opacity-90"
                            title="Click to view full screenshot"
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

                  {/* Loading / Processing Indicator */}
                  {isAnalyzing && (
                    <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 text-xs sm:text-sm font-medium text-indigo-700 dark:text-indigo-300">
                      <span className="animate-spin">⚙️</span>
                      <span>{loadingStatusText || t.analyzingButton}</span>
                      <span className="animate-pulse">● ● ●</span>
                    </div>
                  )}

                  {/* Error Notification */}
                  {errorMessage && (
                    <div
                      role="alert"
                      className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm font-medium text-rose-700 dark:text-rose-300"
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

                  {/* Try an Example Chips Row (Exact match with reference image) */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      {t.tryExample}
                    </span>
                    <button
                      type="button"
                      onClick={() => runExample(t.exampleTextKyc)}
                      className="px-3 py-1 rounded-full font-medium bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 hover:scale-105 active:scale-95 transition cursor-pointer"
                    >
                      {t.exampleKyc}
                    </button>
                    <button
                      type="button"
                      onClick={() => runExample(t.exampleTextRefund)}
                      className="px-3 py-1 rounded-full font-medium bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:scale-105 active:scale-95 transition cursor-pointer"
                    >
                      {t.exampleRefund}
                    </button>
                    <button
                      type="button"
                      onClick={() => runExample(t.exampleTextLottery)}
                      className="px-3 py-1 rounded-full font-medium bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 hover:scale-105 active:scale-95 transition cursor-pointer"
                    >
                      {t.exampleLottery}
                    </button>
                    <button
                      type="button"
                      onClick={() => runExample(t.exampleTextBankAlert)}
                      className="px-3 py-1 rounded-full font-medium bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:scale-105 active:scale-95 transition cursor-pointer"
                    >
                      {t.exampleBankAlert}
                    </button>
                    <button
                      type="button"
                      onClick={() => runExample(t.exampleTextSuspiciousLink)}
                      className="px-3 py-1 rounded-full font-medium bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 hover:scale-105 active:scale-95 transition cursor-pointer"
                    >
                      {t.exampleSuspiciousLink}
                    </button>
                  </div>
                </div>

                {/* ========================================================
                    RESULT CARD (Shown when verdict is ready)
                   ======================================================== */}
                {latestVerdict && (
                  <div
                    ref={resultCardRef}
                    className="p-5 sm:p-6 rounded-3xl glass-panel-elevated flex flex-col gap-5 border border-white/90 shadow-xl transition-all"
                  >
                    {/* Result Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        {/* 3D Shield Badge with Glow */}
                        <div
                          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl text-white font-extrabold shadow-lg ${
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
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span
                              className={`px-3 py-0.5 rounded-full text-xs font-extrabold tracking-wide uppercase ${
                                isHighRisk
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200'
                                  : isSuspicious
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200'
                                  : isPaymentReceipt
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200'
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
                          <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white">
                            {displayCategory}
                          </h3>
                        </div>
                      </div>

                      {/* Header Context Action Menu */}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(activeSourceText);
                          alert(
                            language === 'hi'
                              ? 'संदेश कॉपी किया गया'
                              : language === 'hinglish'
                              ? 'Message copy ho gaya'
                              : 'Message copied to clipboard'
                          );
                        }}
                        title="Copy message text"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-white/50 cursor-pointer"
                      >
                        ⋮
                      </button>
                    </div>

                    {/* Subtitle / Evaluation Summary */}
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                      {language === 'hi' && latestVerdict.summaryHi
                        ? latestVerdict.summaryHi
                        : latestVerdict.summary || latestVerdict.reason}
                    </p>

                    {/* Original Screenshot Preview (if uploaded) */}
                    {selectedImage && (
                      <div className="p-3 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={selectedImage.dataUrl}
                            alt="Analyzed Screenshot"
                            onClick={() => setPreviewModalUrl(selectedImage.dataUrl)}
                            className="h-14 w-14 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:opacity-90"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                              Original Screenshot Visible
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Analyzed through OCR and Evidence-Fusion
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewModalUrl(selectedImage.dataUrl)}
                          className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                        >
                          🔍 View
                        </button>
                      </div>
                    )}

                    {/* Signal Pills Row (Matching reference mockup tags) */}
                    {displayEvidence.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {displayEvidence.slice(0, 5).map((signal, idx) => (
                          <span
                            key={idx}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                              isHighRisk
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300'
                                : isSuspicious
                                ? 'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300'
                            }`}
                          >
                            <span>{isHighRisk ? '✓' : '•'}</span>
                            <span>{signal}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Two-Column Split: Why Flagged (Left) | What to do (Right) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {/* Column 1: Why we flagged it */}
                      <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2 font-heading font-bold text-sm text-slate-900 dark:text-white">
                          <span className="text-rose-500">⚠️</span>
                          <h4>{t.whyFlagged}</h4>
                        </div>
                        <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
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
                        <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
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

                    {/* Fraud Scenario: Immediate Emergency Box (1930 / cybercrime.gov.in) */}
                    {isHighRisk && (
                      <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2 font-heading font-bold text-sm text-rose-800 dark:text-rose-300">
                          <span>🚨</span>
                          <h4>{t.emergencyTitle}</h4>
                        </div>
                        <p className="text-xs text-rose-700 dark:text-rose-200 leading-relaxed">
                          {t.emergencyDesc}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-semibold">
                          <a
                            href="tel:1930"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 text-white shadow-sm hover:bg-rose-700 transition"
                          >
                            <span>📞 {t.cyberHelplineLabel}: 1930</span>
                          </a>
                          <a
                            href={CYBERCRIME_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition"
                          >
                            <span>🌐 {t.officialPortalLabel} ↗</span>
                          </a>
                          <a
                            href={NCRP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition"
                          >
                            <span>🔍 {t.ncrpCheckerLabel} ↗</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Completed Payment Scenario: Wrong Transfer Recovery Guidance */}
                    {isPaymentReceipt && (
                      <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2 font-heading font-bold text-sm text-emerald-800 dark:text-emerald-300">
                          <span>💸</span>
                          <h4>{t.recoveryTitle}</h4>
                        </div>
                        <p className="text-xs text-emerald-700 dark:text-emerald-200 leading-relaxed">
                          {t.recoveryIntro}
                        </p>
                        <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/50 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                          <p>
                            1. Note the 12-digit UPI reference number (UTR) from your payment app or SMS.
                          </p>
                          <p>
                            2. Open transaction in UPI app and raise complaint: "Incorrectly transferred
                            to another account".
                          </p>
                          <p>
                            3. Contact your bank immediately with the UTR to request a reversal from the
                            receiver's bank.
                          </p>
                        </div>
                      </div>
                    )}

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

                    {/* Follow-up Q&A Interactive Thread */}
                    <div className="pt-3 border-t border-slate-200/80 dark:border-white/10 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-heading font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                          {t.followUpHeading}
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          Connected to Evaluated Context
                        </span>
                      </div>

                      {/* Quick Follow-up Question Chips */}
                      <div className="flex flex-wrap gap-2 text-xs">
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
                        {selectedImage && (
                          <button
                            type="button"
                            onClick={() => sendChatMessage(t.quickQuestionOcr)}
                            className="px-3 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-medium transition cursor-pointer"
                          >
                            📝 {t.quickQuestionOcr}
                          </button>
                        )}
                      </div>

                      {/* Conversation History List */}
                      {chatMessages.length > 0 && (
                        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                          {chatMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex ${
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
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
                              <div className="px-3 py-2 rounded-2xl bg-white/80 dark:bg-slate-800 text-xs text-slate-400 flex items-center gap-2">
                                <span className="animate-spin text-xs">⚙️</span>
                                <span>Thinking...</span>
                              </div>
                            </div>
                          )}
                          <div ref={chatScrollRef} />
                        </div>
                      )}

                      {/* Chat Input Form */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          sendChatMessage();
                        }}
                        className="flex items-center gap-2 p-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 shadow-inner"
                      >
                        <input
                          type="text"
                          value={chatDraft}
                          onChange={(e) => setChatDraft(e.target.value)}
                          placeholder={t.followUpPlaceholder}
                          disabled={chatBusy}
                          className="flex-1 px-3 text-xs sm:text-sm bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                        />
                        <button
                          type="submit"
                          disabled={chatBusy || !chatDraft.trim()}
                          className="btn-vibrant-gradient px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-50"
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
              <div className="p-5 sm:p-6 rounded-3xl glass-panel-elevated flex flex-col gap-4">
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
              <div className="p-5 sm:p-6 rounded-3xl glass-panel-elevated flex flex-col gap-4">
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
                    },
                    {
                      label: 'Legitimate Bank Alert',
                      desc: 'Genuine bank transaction warning with standard defensive advice.',
                      text: 'Your SBI A/c credited with Rs 5,000 via UPI on 28-Sep. Never share your OTP or PIN with anyone.',
                      tag: 'GENUINE'
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
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              ex.tag === 'HIGH RISK'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
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
              <div className="p-5 sm:p-6 rounded-3xl glass-panel-elevated flex flex-col gap-4">
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
              <div className="p-5 sm:p-6 rounded-3xl glass-panel-elevated flex flex-col gap-5">
                <h2 className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                  {t.settingsTitle}
                </h2>

                <div className="space-y-4">
                  {/* Language Setting */}
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

                  {/* Theme Setting */}
                  <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                        {t.settingsThemeLabel}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Light glassmorphic aesthetic or dark cyber theme
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="btn-vibrant-gradient px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                    >
                      {theme === 'light' ? t.settingsThemeLight : t.settingsThemeDark}
                    </button>
                  </div>

                  {/* Backend Status Indicator */}
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

                  {/* Safety & Privacy Notice */}
                  <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {t.settingsDisclaimerTitle}
                    </p>
                    <p>{t.settingsDisclaimerText}</p>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* ========================================================
              RIGHT COLUMN: Risk Overview & Insights (lg:col-span-12 xl:col-span-3)
             ======================================================== */}
          <aside className="lg:col-span-12 xl:col-span-3 flex flex-col gap-4">
            {/* Card 1: Risk Overview (Circular Ring Gauge & Indicator Bars) */}
            <div className="p-5 rounded-3xl glass-panel flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-500">📊</span>
                  <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                    {t.riskOverviewTitle}
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  {t.riskIndicatorsLabel}
                </span>
              </div>

              {/* Circular Gauge */}
              <div className="flex flex-col items-center justify-center py-2">
                <div className="relative w-32 h-32 flex items-center justify-center">
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
                      className={`text-[11px] font-bold mt-1 uppercase ${
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
              </div>

              {/* Indicator Bars */}
              <div className="space-y-2.5 pt-1 text-xs">
                <div>
                  <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                  <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                  <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                  <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
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

            {/* Card 2: Message Details */}
            <div className="p-5 rounded-3xl glass-panel flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-indigo-500">📄</span>
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                  {t.messageDetailsTitle}
                </h3>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">{t.detailCategory}</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded-full text-[11px] truncate max-w-[140px] ${
                      isHighRisk
                        ? 'bg-rose-100 text-rose-700'
                        : isSuspicious
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {displayCategory || 'General Check'}
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">{t.detailLanguage}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'hi'
                      ? 'हिंदी (Hindi)'
                      : language === 'hinglish'
                      ? 'Hinglish'
                      : 'English'}
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t.detailContainsLink}
                  </span>
                  <span
                    className={`font-semibold ${
                      latestVerdict?.maskedEntities?.urls?.length > 0
                        ? 'text-rose-600'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {latestVerdict?.maskedEntities?.urls?.length > 0 ? t.yes : t.no}
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">{t.detailUrgency}</span>
                  <span
                    className={`font-semibold ${
                      isHighRisk ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isHighRisk ? t.yes : t.no}
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t.detailAccountThreat}
                  </span>
                  <span
                    className={`font-semibold ${
                      isHighRisk && /block|threat/i.test(latestVerdict?.category || '')
                        ? 'text-rose-600'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isHighRisk && /block|threat/i.test(latestVerdict?.category || '')
                      ? t.yes
                      : t.no}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Quick Safety Tips List */}
            <div className="p-5 rounded-3xl glass-panel flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-500">💡</span>
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                  {t.safetyTipsTitle}
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  { icon: '🚫', text: t.tip1Title },
                  { icon: '🔗', text: t.tip2Title },
                  { icon: '✓', text: t.tip3Title },
                  { icon: '🚩', text: t.tip4Title }
                ].map((item, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentNav('tips')}
                    className="w-full p-2.5 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2 text-left hover:bg-white transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0">{item.icon}</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
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
    </div>
  );
}
