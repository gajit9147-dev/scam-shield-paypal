// Optional AI enhancement. When GEMINI_API_KEY is set, a Gemini model reviews
// the message (useful for Hindi/Hinglish texts the English rules cannot read).
// Any problem - no key, network error, bad reply - returns null and the caller
// falls back to the local rules + UCI baseline. The AI may only return the
// existing honest labels: "scam" or "uncertain". Never "safe".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Minimal .env loader so a copied server/.env works without extra packages.
// Existing environment variables always win; nothing is overridden.
export function loadEnvFile() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const lines = readFileSync(join(here, '..', '.env'), 'utf8');
    for (const line of lines.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch {
    // No .env file is normal; the app runs fine without it.
  }
}

const TIMEOUT_MS = 8000;
// Reading an image takes longer than reading text.
const IMAGE_TIMEOUT_MS = 15000;

export function extractJson(raw) {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Models retire fast; try the configured/default model, then known fallbacks.
export const MODEL_FALLBACKS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest'];

export const aiStatus = { lastStatus: null, lastModel: null, lastAt: null };

export async function callModel(model, key, parts, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: 'application/json' }
      })
    });
    aiStatus.lastStatus = response.status; aiStatus.lastModel = model; aiStatus.lastAt = new Date().toISOString();
    if (!response.ok) {
      if (response.status === 429) {
        return { isQuotaError: true };
      }
      return null;
    }
    const payload = await response.json();
    return { text: payload?.candidates?.[0]?.content?.parts?.[0]?.text || null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function aiReview(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const models = [...new Set([process.env.GEMINI_MODEL, ...MODEL_FALLBACKS].filter(Boolean))];
  const prompt = [
    'You are checking an Indian UPI/payment message for scam risk. The text may be in English, Hindi, or Hinglish.',
    'Respond with a JSON object only. Do not translate the original message.',
    'Schema: {"label":"scam"|"uncertain","confidence":0.85,"category":"otp_pin_theft"|"upi_payment_scam"|"refund_scam"|"kyc_phishing"|"account_block_scam"|"prize_lottery_scam"|"cashback_scam"|"fake_support"|"malicious_link"|"qr_payment_scam"|"job_fee_scam"|"investment_scam"|"delivery_scam"|"tax_refund_scam"|"unknown_suspicious","signals":["..."],"reason":"...","safeAction":"..."}',
    'Rules: "scam" only when the text shows a real fraud pattern (requests OTP/PIN/CVV, demands payment/fee to receive money, threatens account closure, fake refund/KYC, prize/lottery lure). Everything else is "uncertain". Never claim a message is safe.',
    'Keep reason and safeAction under 200 characters each in English. Signals: list of 1 to 4 short specific warning signs observed.',
    'Message to check:',
    text
  ].join('\n');

  let raw = null;
  for (const model of models) {
    const res = await callModel(model, key, [{ text: prompt }]);
    if (res?.isQuotaError) continue;
    if (res?.text) {
      raw = res.text;
      break;
    }
  }
  if (!raw) return null;
  const parsed = extractJson(raw);
  if (!parsed) return null;
  if (parsed.label !== 'scam' && parsed.label !== 'uncertain') return null;

  const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '';
  const safeAction = typeof parsed.safeAction === 'string' ? parsed.safeAction.slice(0, 300) : '';
  const category = typeof parsed.category === 'string' ? parsed.category.slice(0, 50) : 'unknown_suspicious';
  const confidence = typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1 ? parsed.confidence : null;

  const signals = Array.isArray(parsed.signals)
    ? parsed.signals.filter(item => typeof item === 'string').slice(0, 4).map(item => item.slice(0, 120))
    : (Array.isArray(parsed.evidence)
      ? parsed.evidence.filter(item => typeof item === 'string').slice(0, 4).map(item => item.slice(0, 120))
      : []);

  return {
    label: parsed.label,
    confidence,
    category,
    signals,
    evidence: signals,
    reason: reason || 'Analysis completed by AI reviewer.',
    safeAction: safeAction || 'Verify independently with official bank sources.'
  };
}

// Image review: the screenshot itself goes to Gemini as vision input
export async function aiReviewImage({ data, mimeType }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const models = [...new Set([process.env.GEMINI_MODEL, ...MODEL_FALLBACKS].filter(Boolean))];
  const prompt = [
    'You are checking a screenshot of an Indian UPI/payment message (SMS, chat, or payment-app screen) for scam risk. Text in the image may be in English, Hindi, or Hinglish.',
    'Respond with a JSON object only. Do not translate the message.',
    'Schema: {"transcript":"...","label":"scam"|"uncertain","confidence":0.85,"category":"otp_pin_theft"|"upi_payment_scam"|"refund_scam"|"kyc_phishing"|"account_block_scam"|"prize_lottery_scam"|"cashback_scam"|"fake_support"|"malicious_link"|"qr_payment_scam"|"job_fee_scam"|"investment_scam"|"delivery_scam"|"tax_refund_scam"|"unknown_suspicious","signals":["..."],"reason":"...","safeAction":"..."}',
    'transcript: the complete visible text in the image, in original language, under 800 characters; empty string if unreadable.',
    'Rules: "scam" only when the image shows a real fraud pattern (requests OTP/PIN/password, asks payment to receive money, threatens account closure, fake refund/KYC). Everything else is "uncertain". Never claim a message is safe.',
    'Keep reason and safeAction under 200 characters each in English. Signals: 1 to 4 short warning signs.'
  ].join('\n');

  const parts = [{ text: prompt }, { inlineData: { mimeType, data } }];
  let raw = null;
  for (const model of models) {
    const res = await callModel(model, key, parts, IMAGE_TIMEOUT_MS);
    if (res?.isQuotaError) continue;
    if (res?.text) {
      raw = res.text;
      break;
    }
  }
  if (!raw) return null;
  const parsed = extractJson(raw);
  if (!parsed) return null;
  if (parsed.label !== 'scam' && parsed.label !== 'uncertain') return null;

  const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '';
  const safeAction = typeof parsed.safeAction === 'string' ? parsed.safeAction.slice(0, 300) : '';
  const category = typeof parsed.category === 'string' ? parsed.category.slice(0, 50) : 'unknown_suspicious';
  const confidence = typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1 ? parsed.confidence : null;
  const transcript = typeof parsed.transcript === 'string' ? parsed.transcript.slice(0, 1000) : '';

  const signals = Array.isArray(parsed.signals)
    ? parsed.signals.filter(item => typeof item === 'string').slice(0, 4).map(item => item.slice(0, 120))
    : (Array.isArray(parsed.evidence)
      ? parsed.evidence.filter(item => typeof item === 'string').slice(0, 4).map(item => item.slice(0, 120))
      : []);

  return {
    label: parsed.label,
    confidence,
    category,
    signals,
    evidence: signals,
    transcript,
    reason: reason || 'Screenshot inspected by visual AI reviewer.',
    safeAction: safeAction || 'Verify independently through your official payment app.'
  };
}


const DIRECT_VERDICT_QUERY = /\b(?:is\s+(?:it|this)\s+(?:a\s+)?(?:fraud|froud|fruad|scam|real|fake)|(?:fraud|froud|fruad|scam)\s+or\s+(?:not|real)|(?:real|fake)\s+or\s+(?:fake|real|scam)|kya\s+ye\s+(?:fraud|scam|sahi)\s+hai|scam\s+hai\s+kya|ye\s+fraud\s+hai\s+kya|fraud\s+hai\s+ya\s+nahi|real\s+hai\s+ya\s+fake|sach\s+hai\s+kya|kya\s+ye\s+asli\s+hai)\b/i;
const OCR_TRANSCRIPT_QUERY = /\b(?:what\s+(?:text|words?)\s+(?:did\s+you\s+read|was\s+read|extracted|is\s+in\s+(?:the\s+)?image)|show\s+(?:the\s+)?(?:ocr|text|transcript)|text\s+(?:in|from)\s+(?:the\s+)?image|kya\s+likha\s+hai|kya\s+text\s+padha|kya\s+padha)\b/i;

// Conversational Q&A follow-up that preserves the evaluated context.
export async function aiChat({ message, context, language = 'en', detectionResult = null }) {
  if (typeof message !== 'string' || !message.trim()) {
    return language === 'hi'
      ? 'कृपया अपना प्रश्न लिखें।'
      : (language === 'hinglish' ? 'Please apna sawal likhein.' : 'Please enter your question.');
  }

  // If the user is specifically asking what text was read from the screenshot,
  // return the actual OCR transcript along with a prominent privacy disclaimer.
  if (OCR_TRANSCRIPT_QUERY.test(message)) {
    const textToShow = detectionResult?.ocr?.text || detectionResult?.transcript || context || '';
    if (language === 'hi') {
      return textToShow
        ? `स्क्रीनशॉट से निकाला गया टेक्स्ट:\n\n"${textToShow}"\n\n⚠ गोपनीयता सूचना: OCR में त्रुटियाँ हो सकती हैं। हम आपकी छवियों या निजी जानकारी को कभी स्टोर नहीं करते हैं।`
        : 'स्क्रीनशॉट से कोई टेक्स्ट नहीं पढ़ा जा सका।';
    }
    if (language === 'hinglish') {
      return textToShow
        ? `Screenshot se extract kiya gaya text:\n\n"${textToShow}"\n\n⚠ Privacy note: OCR me reading mistakes ho sakti hain. Hum aapki images ya personal data ko kabhi store nahi karte.`
        : 'Screenshot se koi clear text read nahi ho paya.';
    }
    return textToShow
      ? `Here is the text extracted from the screenshot:\n\n"${textToShow}"\n\n⚠ Privacy note: Optical character recognition may contain transcription errors. We do not store your screenshots or extracted data.`
      : 'No clear text could be extracted from the screenshot.';
  }

  // If the user is asking a direct verification follow-up ("is it fraud?", "is this fraud?", "real or fake?"),
  // use the EXISTING detection result directly without running an unrelated new decision.
  if (detectionResult && DIRECT_VERDICT_QUERY.test(message)) {
    const isHi = language === 'hi';
    const isHinglish = language === 'hinglish';
    const evidenceText = (detectionResult.evidence || []).slice(0, 4).map(e => `• ${e}`).join('\n');
    const isImg = detectionResult.inputType === 'image' || detectionResult.isImage;
    const targetDescEn = isImg ? 'in the screenshot' : 'in the message';
    const targetDescHi = isImg ? 'स्क्रीनशॉट में' : 'संदेश में';
    const targetDescHinglish = isImg ? 'screenshot me' : 'message me';

    if (detectionResult.riskLevel === 'HIGH_RISK') {
      if (isHi) {
        return `मिले चेतावनी संकेतों के आधार पर, यह ${targetDescHi} उच्च जोखिम (High Risk) वाला है और धोखाधड़ी होने की पूरी संभावना है।\n\nपहचाने गए मुख्य कारण:\n${evidenceText || '• संदिग्ध धोखाधड़ी पैटर्न पाया गया'}\n\nक्या करें: कोई OTP या PIN साझा न करें, किसी लिंक पर क्लिक न करें, और बैंक ऐप में खुद जाँचें।`;
      }
      if (isHinglish) {
        return `Warning signs ke mutabik, ye ${targetDescHinglish} HIGH RISK hai aur scam hone ke strong chances hain.\n\nFlag karne ke reasons:\n${evidenceText || '• Fraudulent request pattern mila'}\n\nKya karein: Koi bhi OTP ya UPI PIN share mat karein, unknown links na kholein, aur official bank app me check karein.`;
      }
      return `Based on the warning signs detected ${targetDescEn}, this message is high risk and appears consistent with a scam.\n\nDetected reasons:\n${evidenceText || '• Fraudulent request pattern detected'}\n\nWhat to do: Do not share OTP or PIN, do not click message links, and verify directly through your official banking app.`;
    }
    if (detectionResult.riskLevel === 'SUSPICIOUS') {
      if (isHi) {
        return `${targetDescHi} संदिग्ध चेतावनी संकेत मिले हैं।\n\nपहचाने गए संकेत:\n${evidenceText || '• संदिग्ध गतिविधि'}\n\nक्या करें: जब तक खुद आधिकारिक बैंक से पुष्टि न कर लें, तब तक कोई कदम न उठाएँ।`;
      }
      if (isHinglish) {
        return `${targetDescHinglish} suspicious warning signs mile hain.\n\nNoticed signs:\n${evidenceText || '• Suspicious activity'}\n\nKya karein: Jab tak official bank app se confirm na kar lein, tab tak aage na badhein.`;
      }
      return `Based on the warning signs detected ${targetDescEn}, this message is suspicious.\n\nDetected warning signs:\n${evidenceText || '• Suspicious activity'}\n\nWhat to do: Do not proceed until you verify independently through the official bank app.`;
    }
    if (isHi) {
      return `${targetDescHi} धोखाधड़ी का कोई स्पष्ट पैटर्न नहीं मिला। हालांकि, सिर्फ टेक्स्ट के आधार पर इसे सुरक्षित या असली प्रमाणित नहीं किया जा सकता। किसी भी लेन-देन की पुष्टि अपने बैंक ऐप में करें।`;
    }
    if (isHinglish) {
      return `${targetDescHinglish} scam ka koi strong pattern nahi mila. Lekin sirf text dekhkar ise safe declare nahi kiya ja sakta. Official banking app me khud verify karein.`;
    }
    return `No strong scam pattern was detected ${targetDescEn}. However, this does not prove that the message is genuine or safe. Always check your transaction independently in the official banking app.`;
  }

  function fallbackReply() {
    if (detectionResult?.riskLevel === 'HIGH_RISK') {
      if (language === 'hi') return 'संदेश में गंभीर जोखिम के संकेत हैं। OTP या PIN किसी को न दें और कोई लिंक न खोलें। सहायता के लिए 1930 पर कॉल करें।';
      if (language === 'hinglish') return 'Message me severe scam warning signs hain. Apna OTP ya UPI PIN kabhi kisi ko mat dein aur link na kholein. Cyber helpline 1930 par call karein.';
      return 'This message has high-risk scam indicators. Never share OTPs or PINs and do not open links. Call 1930 for cyber helpline.';
    }
    if (detectionResult?.riskLevel === 'SUSPICIOUS') {
      if (language === 'hi') return 'इस संदेश में संदिग्ध संकेत मिले हैं। किसी भी भुगतान या लिंक पर आगे बढ़ने से पहले बैंक से स्वतंत्र रूप से पुष्टि करें।';
      if (language === 'hinglish') return 'Is message me suspicious warning signs hain. Kisi bhi action ya payment se pehle official bank app me verify karein.';
      return 'This message has suspicious warning signs. Verify independently with your bank before taking any action or clicking links.';
    }
    if (language === 'hi') return 'भुगतान सुरक्षा के लिए हमेशा आधिकारिक बैंक ऐप का उपयोग करें और कभी किसी के साथ OTP या UPI PIN साझा न करें।';
    if (language === 'hinglish') return 'Payment safety ke liye hamesha official bank app use karein aur kisi ke sath OTP ya UPI PIN share na karein.';
    return 'Always check payments in your official bank app and never share your OTP or UPI PIN with anyone.';
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return fallbackReply();
  }

  const models = [...new Set([process.env.GEMINI_MODEL, ...MODEL_FALLBACKS].filter(Boolean))];
  const quoted = '"""';
  const targetLanguageStr = language === 'hi'
    ? 'Hindi (Devanagari script)'
    : (language === 'hinglish' ? 'natural conversational Hinglish (Hindi in Latin script)' : 'simple English');

  const prompt = [
    'You are UPI Scam Shield, an expert assistant that helps people in India identify UPI/payment scam messages and stay safe.',
    context ? `The payment message under discussion: ${quoted}${context}${quoted}` : 'No payment message has been shared yet.',
    detectionResult ? `Prior detection assessment: Risk Level: ${detectionResult.riskLevel}, Category: ${detectionResult.categoryLabel || detectionResult.category}, Evidence: ${(detectionResult.evidence || []).join(', ')}` : '',
    `User's question: ${quoted}${message}${quoted}`,
    `Answer in ${targetLanguageStr}. Keep it under 120 words, plain sentences, clear bullet points if helpful, no markdown headers.`,
    'Be practical and specific to the message under discussion. If asked whether it is fraud, align strictly with the prior detection assessment.',
    'Explain why warning signs like OTP requests, links, or threats are dangerous.',
    'Never declare a message safe or genuine. Never ask for an OTP, PIN, or any private detail.',
    'Respond with a JSON object only. Schema: {"reply":"..."}.'
  ].filter(Boolean).join('\n');

  let raw = null;
  for (const model of models) {
    const res = await callModel(model, key, [{ text: prompt }]);
    if (res?.isQuotaError) continue;
    if (res?.text) {
      raw = res.text;
      break;
    }
  }
  if (!raw) return fallbackReply();
  const parsed = extractJson(raw);
  const reply = parsed && typeof parsed.reply === 'string' ? parsed.reply.trim().slice(0, 1200) : '';
  return reply || fallbackReply();
}
