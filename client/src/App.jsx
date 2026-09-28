import { useEffect, useRef, useState } from 'react';

const labelStyles = { scam: 'bg-rose-100 text-rose-800 ring-1 ring-rose-300', uncertain: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' };

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
    error: 'Could not check the message. Is the server running?',
    greeting: 'Hi! Send a payment message or upload a screenshot. I can check warning signs or guide you after a wrong payment.',
    send: 'Send', composer: 'Type or paste a payment message...', reviewImage: 'Screenshot text is ready. Correct any OCR mistakes, then send it.',
    ask: 'What do you need help with?', next: 'You can choose the other option for this same message, or send another.',
    noSafe: 'I cannot say a message is safe. This is not a verified UPI fraud test. Check your bank or payment app yourself.',
    privateNote: 'Remove private details, OTPs and payment identifiers before sending.',
    unknown: 'Send a message or screenshot first, then choose how I can help.',
    clarification: 'Tell me what you need in your own words: ask whether the message is fraud, or say you sent money to the wrong person. No buttons needed.',
    askAfterText: 'Got your message. Ask me in chat what you want to know about it, for example whether it looks like fraud or what to do about a wrong payment.',
    resultIntro: 'Here is a cautious check of the text you sent:',
    recoveryIntroChat: 'If you sent money to the wrong person, act quickly. Recovery is not guaranteed.',
    answer: 'Short answer', why: 'Why this answer', signals: 'What I noticed', explanation: 'What it means', nextSteps: 'What to do now', limits: 'Limits of this check',
    scamAnswer: 'This message has scam warning signs. Do not follow its instructions.',
    uncertainAnswer: 'I cannot confirm this message is genuine or safe from its text alone.',
    noPattern: 'I did not find a strong fraud-request pattern in this text. That is not evidence that the sender or payment is real.',
    spamCaution: 'A general English spam model flagged the wording, but spam and UPI fraud are different things.',
    secretWhy: 'It asks you to give a private code or credential. OTPs and UPI PINs authorize access or payments; a sender asking for them is a serious warning sign.',
    demandWhy: 'It ties a payment demand to a promised credit or a threat to your account. You do not need to pay someone to receive a UPI payment.',
    genericRisk: 'The wording needs independent verification. A text message can copy a familiar bank name or make an urgent claim without proving who sent it.',
    scamInstruction: 'Do not reply, share an OTP or PIN, open the message link, or send money. Open your bank or UPI app yourself using its saved icon and check there. If you already paid, contact the bank immediately and report suspected fraud to 1930.',
    uncertainInstruction: 'Do not treat the lack of a warning as clearance. Open the bank or payment app yourself to check the transaction; avoid message links and never give anyone your OTP or UPI PIN.',
    noSafeReason: 'This is a warning-sign check, not identity, link, account or payment verification. The general spam model was not validated as a UPI scam detector.',
    aiDetail: 'Additional model note (English)',
    learningAnswer: 'To spot a possible UPI scam, look for requests for OTPs or PINs, pressure to pay to receive money, and urgent account-blocking claims.',
    learningWhy: 'These are warning signs because codes can approve access or transactions, while an incoming UPI payment does not require you to send money first.',
    learningSteps: ['Do not use links or phone numbers in an unexpected message.', 'Open your payment or bank app yourself and check the transaction or request there.', 'If money was lost, contact your bank and report suspected fraud to 1930. Keep the transaction reference.'],
    learningLimit: 'A message can look ordinary and still be forged; only the bank or payment app can confirm a transaction.',
    needsText: 'Please paste the payment message with private details removed, or upload a screenshot and review the extracted text. I need the wording to explain its warning signs; do not send an OTP or UPI PIN.'
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
    error: 'संदेश की जाँच नहीं हो सकी। क्या सर्वर चालू है?',
    greeting: 'नमस्ते! भुगतान का संदेश भेजें या स्क्रीनशॉट अपलोड करें। मैं जोखिम के संकेत जाँच सकता हूँ या गलत भुगतान के बाद के कदम बता सकता हूँ।',
    send: 'भेजें', composer: 'भुगतान का संदेश लिखें या चिपकाएँ...', reviewImage: 'स्क्रीनशॉट का टेक्स्ट तैयार है। पढ़ने की गलती सुधारकर इसे भेजें।',
    ask: 'आपको किस बारे में मदद चाहिए?', next: 'इसी संदेश के लिए दूसरा विकल्प चुनें या नया संदेश भेजें।',
    noSafe: 'मैं किसी संदेश को सुरक्षित नहीं कह सकता। यह प्रमाणित UPI धोखाधड़ी जाँच नहीं है। खुद बैंक या पेमेंट ऐप में जाँचें।',
    privateNote: 'भेजने से पहले निजी जानकारी, OTP और भुगतान पहचान हटाएँ।',
    unknown: 'पहले संदेश या स्क्रीनशॉट भेजें, फिर सहायता चुनें।',
    clarification: 'अपने शब्दों में बताएं: क्या संदेश धोखाधड़ी है, या गलत व्यक्ति को पैसे चले गए? कोई बटन नहीं चाहिए।',
    askAfterText: 'आपका संदेश मिल गया। चैट में पूछें कि यह धोखाधड़ी है या गलत भुगतान के बाद क्या करें।',
    resultIntro: 'आपके भेजे टेक्स्ट की सावधानी से जाँच:',
    recoveryIntroChat: 'अगर गलत व्यक्ति को पैसे भेजे हैं तो जल्दी करें। पैसे वापसी की गारंटी नहीं है।',
    answer: 'सीधा जवाब', why: 'क्यों', signals: 'कौन से संकेत मिले', explanation: 'इसका मतलब', nextSteps: 'अब क्या करें', limits: 'जाँच की सीमा',
    scamAnswer: 'इस संदेश में धोखाधड़ी के चेतावनी संकेत हैं। इसकी बात मानकर कोई कदम न उठाएँ।',
    uncertainAnswer: 'सिर्फ इस संदेश के आधार पर इसे असली या सुरक्षित नहीं कह सकता।',
    noPattern: 'इस टेक्स्ट में धोखाधड़ी का स्पष्ट अनुरोध नहीं मिला। इसका मतलब यह नहीं कि भेजने वाला या भुगतान असली है।',
    spamCaution: 'अंग्रेज़ी सामान्य स्पैम मॉडल ने टेक्स्ट पर चेतावनी दी है, लेकिन स्पैम और UPI धोखाधड़ी अलग बातें हैं।',
    secretWhy: 'संदेश निजी कोड या पहचान की जानकारी माँगता है। OTP और UPI PIN से खाते या भुगतान पर असर पड़ सकता है; इन्हें माँगना गंभीर चेतावनी है।',
    demandWhy: 'संदेश पैसे मिलने का वादा या खाते की धमकी देकर पहले भुगतान माँगता है। UPI पर पैसे पाने के लिए किसी को पैसे भेजने की ज़रूरत नहीं होती।',
    genericRisk: 'दावे की स्वतंत्र पुष्टि ज़रूरी है। संदेश में बैंक का नाम या जल्दी करने का दबाव हो सकता है, लेकिन इससे भेजने वाले की पहचान साबित नहीं होती।',
    scamInstruction: 'जवाब न दें, OTP या PIN न बताएँ, संदेश का लिंक न खोलें और पैसे न भेजें। खुद बैंक या UPI ऐप खोलकर जाँचें। पहले ही पैसे भेज दिए हैं तो तुरंत बैंक से संपर्क करें और संदिग्ध धोखाधड़ी 1930 पर रिपोर्ट करें।',
    uncertainInstruction: 'चेतावनी न मिलने को सुरक्षित होने का प्रमाण न मानें। खुद बैंक या पेमेंट ऐप में लेन-देन देखें; संदेश के लिंक से बचें और OTP या UPI PIN किसी को न दें।',
    noSafeReason: 'यह केवल जोखिम के संकेत जाँचता है; पहचान, लिंक, खाता या भुगतान की पुष्टि नहीं करता। सामान्य स्पैम मॉडल की UPI धोखाधड़ी जाँच के लिए पुष्टि नहीं हुई है।',
    aiDetail: 'मॉडल की अतिरिक्त टिप्पणी (अंग्रेज़ी)',
    learningAnswer: 'UPI धोखाधड़ी के संकेत हैं: OTP या PIN माँगना, पैसे पाने के लिए पहले भुगतान का दबाव, और खाता बंद होने की तत्काल धमकी।',
    learningWhy: 'ये चेतावनी हैं क्योंकि कोड से पहुँच या भुगतान मंजूर हो सकता है, जबकि UPI में पैसे पाने के लिए पहले पैसे भेजने की ज़रूरत नहीं होती।',
    learningSteps: ['अचानक आए संदेश के लिंक या फोन नंबर का इस्तेमाल न करें।', 'खुद बैंक या पेमेंट ऐप खोलें और वहाँ लेन-देन या अनुरोध देखें।', 'पैसे चले गए हों तो बैंक से संपर्क करें और संदिग्ध धोखाधड़ी 1930 पर रिपोर्ट करें। लेन-देन का रेफरेंस संभालें।'],
    learningLimit: 'साधारण दिखने वाला संदेश भी नकली हो सकता है; भुगतान की पुष्टि बैंक या पेमेंट ऐप में करें।',
    needsText: 'भुगतान संदेश से निजी जानकारी हटाकर भेजें या स्क्रीनशॉट डालकर निकला टेक्स्ट जाँचें। बिना संदेश के उसके जोखिम नहीं समझा सकता। OTP या UPI PIN न भेजें।'
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


let nextId = 0;
const makeMessage = (role, kind, content = {}) => ({ id: ++nextId, role, kind, ...content });
const wrongPaymentIntent = /\b(wrong|mistak(?:e|en)|galat|galt|galti)\b.{0,70}\b(payment|paid|transfer|upi|paisa|paise|money|bhej|send|sent)\b|\b(payment|paid|transfer|paisa|paise|money|bhej|sent)\b.{0,70}\b(wrong|mistak(?:e|en)|galat|galt|galti)\b|गलत.{0,50}(भुगतान|पैसे|भेज)|(?:भुगतान|पैसे).{0,50}गलत/i;
const fraudIntent = /\b(fraud|scam|fake|genuine|safe|real|suspicious|dhokha|dhokadhadi)\b|धोखाधड़ी|फ़्रॉड|स्कैम|नकली|सुरक्षित/i;
const learningIntent = /\b(how (?:can|do|to)|what (?:are|is)|ways to|tips|explain|understand|spot|identify|recogniz(?:e|ing))\b.{0,100}\b(upi|fraud|scam|payment)\b|\b(upi|fraud|scam|payment)\b.{0,100}\b(how|spot|identify|tips|work|happens)\b|(?:कैसे|क्या|समझा).{0,60}(?:धोखाधड़ी|स्कैम|UPI)|(?:धोखाधड़ी|स्कैम|UPI).{0,60}(?:कैसे|पहचान|बचाव)|\b(?:kaise|pehchan|bachne)\b.{0,60}\b(?:fraud|scam|upi)\b/i;
const inquiry = /[?？]|\b(is|check|tell|help|how|kya|kaise|hai|hoga|please|can|what)\b|क्या|कैसे|मदद/i;
function intentOf(text) {
  if (wrongPaymentIntent.test(text)) return 'recovery';
  if (fraudIntent.test(text) && (inquiry.test(text) || text.trim().split(/\s+/).length <= 5)) return 'fraud';
  return '';
}

export default function App() {
  const [language, setLanguage] = useState('en');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeText, setActiveText] = useState('');
  const [busy, setBusy] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrState, setOcrState] = useState('');
  const fileInput = useRef(null);
  const bottomRef = useRef(null);
  const requestId = useRef(0);
  const t = copy[language];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy, ocrLoading, ocrState, language]);

  async function readScreenshot(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setOcrLoading(true);
    setOcrState('');
    try {
      const tesseract = (await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js')).default;
      const { data } = await tesseract.recognize(file, 'eng');
      const extracted = (data?.text || '').replace(/[ \t]+\n/g, '\n').trim().slice(0, 1000);
      if ((extracted.match(/[\p{L}\p{N}]/gu) || []).length < 3) throw new Error('No text');
      setDraft(extracted);
      setOcrState('done');
    } catch {
      setOcrState('error');
    } finally {
      setOcrLoading(false);
    }
  }

  function sendMessage(event) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy || ocrLoading) return;
    setDraft('');
    setOcrState('');
    const action = intentOf(text);
    const learning = !looksLikeCompletedPayment(text) && learningIntent.test(text) && !/(otp|pin|https?:|\u20b9|inr|rs\.?|account.*(?:pay|send))/i.test(text);
    const user = makeMessage('user', 'text', { text });
    // A short question after a shared message refers to the earlier text.
    const refersToEarlier = !!activeText && action && text.length < 130 && inquiry.test(text) && !looksLikeCompletedPayment(text) && !/(otp|pin|https?:|\u20b9|inr|rs\.?|account|refund)/i.test(text);
    const sourceText = refersToEarlier ? activeText : text;
    if (!refersToEarlier && !learning && (!action || looksLikeCompletedPayment(text))) setActiveText(text);
    setMessages(previous => [...previous, user]);
    if (learning) {
      setMessages(previous => [...previous, makeMessage('assistant', 'learning')]);
    } else if (action === 'fraud' && !refersToEarlier && text.length < 80 && !/(otp|pin|https?:|\u20b9|inr|rs\.?|account|refund)/i.test(text)) {
      setMessages(previous => [...previous, makeMessage('assistant', 'question', { text: 'needsText' })]);
    } else if (action === 'recovery') {
      setMessages(previous => [...previous, makeMessage('assistant', 'recovery', { sourceText })]);
    } else if (action === 'fraud') {
      checkText(sourceText);
    } else {
      setMessages(previous => [...previous, makeMessage('assistant', 'question', { text: activeText && text.length < 70 && inquiry.test(text) ? 'clarification' : 'askAfterText' })]);
    }
  }

  async function checkText(selectedText) {
    if (!selectedText) return;
    setBusy(true);
    const call = ++requestId.current;
    try {
      const response = await fetch('/api/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check the message.');
      if (call !== requestId.current) return;
      setMessages(previous => [...previous, makeMessage('assistant', 'verdict', { result: data, sourceText: selectedText })]);
    } catch (err) {
      if (call === requestId.current) setMessages(previous => [...previous, makeMessage('assistant', 'error', { error: err.message })]);
    } finally {
      if (call === requestId.current) setBusy(false);
    }
  }

  function assistantContent(message) {
    if (message.kind === 'question') return <p>{t[message.text] || t.clarification}</p>;
    if (message.kind === 'error') return <p role="alert" className="text-rose-800">{language === 'hi' ? (apiCopy[message.error] || t.error) : (message.error || t.error)}</p>;
    if (message.kind === 'recovery') return <>
      <h2 className="font-semibold text-slate-900">{t.recoveryTitle}</h2>
      <p className="mt-2">{t.recoveryIntroChat}</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">{t.recoverySteps.map((step, index) => <li key={index}>{step}</li>)}</ol>
      <p className="mt-3 text-sm text-slate-700">{t.recoveryNote}</p>
    </>;
    if (message.kind === 'learning') return <div className="space-y-3">
      <section><h2 className="font-semibold text-indigo-900">{t.answer}</h2><p>{t.learningAnswer}</p></section>
      <section><h3 className="font-semibold text-slate-900">{t.why}</h3><p>{t.learningWhy}</p></section>
      <section><h3 className="font-semibold text-slate-900">{t.nextSteps}</h3><ol className="list-decimal space-y-1 pl-5">{t.learningSteps.map((step, i) => <li key={i}>{step}</li>)}</ol></section>
      <section className="border-t border-slate-300/70 pt-2 text-sm text-slate-700"><h3 className="font-semibold">{t.limits}</h3><p>{t.learningLimit}</p></section>
    </div>;
    if (message.kind === 'verdict') {
      const r = message.result;
      const clues = [
        ...(r.evidence || []).filter(item => item === 'Message asks for a sensitive code or credential').map(() => t.secretWhy),
        ...(r.evidence || []).filter(item => item === 'Message links a payment demand to a promised credit or account threat').map(() => t.demandWhy),
        ...(r.generalSpamSignal === 'flagged' ? [t.spamCaution] : [])
      ];
      if (!clues.length) clues.push(t.noPattern);
      const knownReason = Object.prototype.hasOwnProperty.call(apiCopy, r.reason);
      return <div className="space-y-3">
        <section><h2 className="font-semibold text-indigo-900">{t.answer}</h2><div className="mt-1 flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${labelStyles[r.label] || labelStyles.uncertain}`}>{display(r.label, language)}</span><strong>{r.label === 'scam' ? t.scamAnswer : t.uncertainAnswer}</strong></div></section>
        <section><h3 className="font-semibold text-slate-900">{t.why}</h3><p>{knownReason ? display(r.reason, language) : t.genericRisk}</p></section>
        <section><h3 className="font-semibold text-slate-900">{t.signals}</h3><ul className="list-disc space-y-1 pl-5">{clues.map((clue, i) => <li key={i}>{clue}</li>)}</ul></section>
        <section><h3 className="font-semibold text-slate-900">{t.explanation}</h3><p>{r.label === 'scam' ? t.genericRisk : t.noPattern}</p></section>
        <section><h3 className="font-semibold text-slate-900">{t.nextSteps}</h3><p>{r.label === 'scam' ? t.scamInstruction : t.uncertainInstruction}</p></section>
        {looksLikeCompletedPayment(message.sourceText) && <p className="text-sm text-slate-700">{t.recoveryIntro}</p>}
        {!knownReason && r.reason && <section className="text-sm text-slate-700"><h3 className="font-semibold">{t.aiDetail}</h3><p>{r.reason}</p></section>}
        <section className="border-t border-slate-300/70 pt-2 text-sm text-slate-700"><h3 className="font-semibold">{t.limits}</h3><p>{t.noSafeReason}</p></section>
      </div>;
    }
    return null;
  }

  return <main lang={language} className="relative flex h-[100dvh] min-h-[480px] flex-col overflow-hidden bg-gradient-to-br from-[#e8f5ff] via-[#f3f1ff] to-[#fff3e9] text-slate-900">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -left-24 -top-20 h-80 w-80 rounded-full bg-sky-300/55 blur-3xl"/><div className="absolute -right-28 top-1/3 h-96 w-96 rounded-full bg-indigo-300/50 blur-3xl"/><div className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-rose-300/45 blur-3xl"/></div>
    <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col border-x border-white/60 bg-white/25 shadow-2xl shadow-slate-600/15 backdrop-blur-md">
      <header className="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-white/75 bg-white/55 px-4 py-3 backdrop-blur-2xl sm:px-6">
        <div className="min-w-0"><h1 className="truncate bg-gradient-to-r from-slate-900 to-indigo-700 bg-clip-text text-lg font-bold text-transparent sm:text-xl">🛡️ {t.title}</h1><p className="text-xs text-slate-600">{t.eyebrow}</p></div>
        <label className="shrink-0 text-xs text-slate-600">{t.language}<select aria-label={t.language} value={language} onChange={e => setLanguage(e.target.value)} className="ml-2 rounded-xl border border-white/80 bg-white/70 px-2 py-2 text-sm text-slate-900 shadow-sm focus:outline-indigo-600"><option value="en">English</option><option value="hi">हिंदी</option></select></label>
      </header>
      <div role="log" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-5 sm:px-8 sm:py-7">
        <div className="flex items-start gap-2"><Avatar/><div className="max-w-[88%] rounded-[1.6rem] rounded-tl-md border border-white/85 bg-white/65 p-4 text-sm leading-relaxed text-slate-900 shadow-lg shadow-slate-500/10 backdrop-blur-2xl sm:max-w-[78%] sm:text-base"><p>{t.greeting}</p><p className="mt-2 text-xs text-slate-600">{t.noSafe}</p></div></div>
        {messages.map(message => <div key={message.id} className={`flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
          {message.role === 'assistant' && <Avatar/>}
          <div className={`min-w-0 max-w-[88%] break-words rounded-[1.6rem] p-4 text-sm leading-relaxed shadow-lg backdrop-blur-2xl sm:max-w-[78%] sm:text-base ${message.role === 'user' ? 'rounded-tr-md border border-white/70 bg-[#596478]/90 text-white shadow-slate-500/20' : 'rounded-tl-md border border-white/85 bg-white/65 text-slate-900 shadow-slate-500/10'}`}>
            {message.role === 'user' ? <p className="whitespace-pre-wrap">{message.text}</p> : assistantContent(message)}
          </div>
        </div>)}
        {busy && <div className="flex items-center gap-2"><Avatar/><div role="status" className="rounded-[1.6rem] rounded-tl-md border border-white/85 bg-white/70 px-4 py-3 text-sm text-sky-900 backdrop-blur-2xl">{t.checking} <span aria-hidden="true" className="inline-block animate-pulse">● ● ●</span></div></div>}
        <div ref={bottomRef}/>
      </div>
      <div className="z-10 shrink-0 border-t border-white/75 bg-white/55 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-xl sm:px-6">
        <form onSubmit={sendMessage} className="flex items-end gap-2 rounded-[2rem] border border-white/90 bg-white/75 p-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_12px_35px_rgba(78,90,130,0.16)] backdrop-blur-2xl">
          <input ref={fileInput} type="file" accept="image/*" onChange={readScreenshot} className="hidden" aria-hidden="true" tabIndex={-1}/>
          <button type="button" aria-label={t.upload} title={t.upload} disabled={busy || ocrLoading} onClick={() => fileInput.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-slate-800 hover:bg-slate-200/70 disabled:opacity-50">＋</button>
          <textarea aria-label={t.message} rows={1} maxLength={1000} value={draft} onChange={e => { setDraft(e.target.value); setOcrState(''); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder={t.composer} className="max-h-32 min-h-10 w-full flex-1 resize-none bg-transparent px-1 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 sm:text-base" />
          <button type="submit" disabled={busy || ocrLoading || !draft.trim()} className="shrink-0 rounded-full border border-slate-600/20 bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40">{t.send}</button>
        </form>
        {ocrLoading && <p role="status" className="mt-1 text-xs text-sky-900">{t.reading}</p>}
        {ocrState === 'done' && <p role="status" className="mt-1 text-xs text-emerald-800">{t.reviewImage}</p>}
        {ocrState === 'error' && <p role="alert" className="mt-1 text-xs text-rose-800">{t.ocrError}</p>}
        <p className="mt-1 text-center text-[11px] text-slate-600">{t.privateNote}</p>
      </div>
    </div>
  </main>;
}

function Avatar() {
  return <div aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/85 bg-white/75 text-sm text-indigo-700 shadow-sm backdrop-blur-xl">✦</div>;
}
