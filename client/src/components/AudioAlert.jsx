import { useState, useEffect, useRef } from 'react';

export default function AudioAlert({ verdict, review, language = 'en' }) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const synthRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    } else {
      setSupported(false);
    }

    return () => {
      if (synthRef.current && synthRef.current.speaking) {
        synthRef.current.cancel();
      }
    };
  }, []);

  if (!supported) return null;

  const isBlocked = review?.blocked || verdict?.riskLevel === 'HIGH_RISK';
  const isSuspicious = verdict?.riskLevel === 'SUSPICIOUS';

  const getAlertText = () => {
    const lang = language === 'hi' ? 'hi' : language === 'hinglish' ? 'hinglish' : 'en';

    if (isBlocked) {
      if (lang === 'hi') {
        return 'सावधान! यह संदेश एक फ्रॉड है। बैंक या यूपीआई कभी भी एसएमएस पर ओटीपी या पिन नहीं माँगता। इस अनुरोध पर कोई भुगतान न करें!';
      }
      if (lang === 'hinglish') {
        return 'Saavdhan! Yeh payment request ek fraud hai. Bank ya UPI kabhi bhi SMS par OTP ya PIN nahi maangta. Is request par koi payment na karein!';
      }
      return 'Warning! This payment request is identified as a high risk scam. Banks and UPI never ask for your secret PIN or OTP to receive money. Do not pay!';
    }

    if (isSuspicious) {
      if (lang === 'hi') {
        return 'चेतावनी! इस अनुरोध में संदिग्ध संकेत मिले हैं। किसी अज्ञात व्यक्ति को भुगतान करने से पहले सावधानी बरतें।';
      }
      if (lang === 'hinglish') {
        return 'Warning! Is payment me suspicious signals mile hain. Kisi anjaan vyakti ko pay karne se pehle achhe se verify karein.';
      }
      return 'Caution! Suspicious indicators were detected in this payment request. Proceed with extreme caution and verify the payee.';
    }

    // Low risk or uncertain
    if (lang === 'hi') {
      return 'यह अनुरोध सामान्य प्रतीत होता है, लेकिन किसी भी व्यक्ति को पैसे भेजने से पहले हमेशा प्राप्तकर्ता की पहचान सुनिश्चित करें।';
    }
    if (lang === 'hinglish') {
      return 'Yeh request normal lag rahi hai, lekin paise bhejne se pehle payee ko double check zaroor karein.';
    }
    return 'This request passed automated checks. Remember that passing automated checks does not prove the seller is genuine.';
  };

  const toggleSpeech = () => {
    if (!synthRef.current) return;

    if (speaking) {
      synthRef.current.cancel();
      setSpeaking(false);
      return;
    }

    const textToSpeak = getAlertText();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Pick best voice
    const voices = synthRef.current.getVoices();
    if (language === 'hi' || language === 'hinglish') {
      const hiVoice = voices.find(v => v.lang.startsWith('hi') || v.lang.includes('Hindi'));
      if (hiVoice) utterance.voice = hiVoice;
      utterance.lang = 'hi-IN';
      utterance.rate = 0.95;
    } else {
      const enVoice = voices.find(v => v.lang.startsWith('en-IN') || v.lang.startsWith('en-US') || v.lang.startsWith('en'));
      if (enVoice) utterance.voice = enVoice;
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
    }

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    synthRef.current.cancel();
    synthRef.current.speak(utterance);
    setSpeaking(true);
  };

  const labelText = speaking
    ? (language === 'hi' ? 'आवाज़ बंद करें' : 'Stop Audio Alert')
    : (language === 'hi' ? '🔊 बोलकर सुनें (Voice Alert)' : '🔊 Listen Safety Alert');

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={toggleSpeech}
        aria-label={labelText}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: speaking
            ? 'linear-gradient(135deg, #e11d48, #be123c)'
            : 'rgba(255, 255, 255, 0.08)',
          border: speaking
            ? '1px solid rgba(244, 63, 94, 0.6)'
            : '1px solid rgba(255, 255, 255, 0.2)',
          color: '#fff',
          borderRadius: 999,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: speaking ? '0 0 14px rgba(225, 29, 72, 0.4)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        {speaking ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 3, height: 12, background: '#fff', borderRadius: 2, animation: 'pulse 0.8s infinite' }} />
            <span style={{ width: 3, height: 16, background: '#fff', borderRadius: 2, animation: 'pulse 0.6s infinite 0.2s' }} />
            <span style={{ width: 3, height: 10, background: '#fff', borderRadius: 2, animation: 'pulse 0.7s infinite 0.4s' }} />
          </span>
        ) : (
          <span>🔊</span>
        )}
        <span>{labelText}</span>
      </button>
    </div>
  );
}
