// Evidence-Fusion System for UPI & Financial Scam Detection.
// Combines signals from deterministic rules, Gemini semantic analysis,
// UCI general SMS-spam baseline, and OCR/visual analysis.

const CATEGORY_PRIORITY = [
  'otp_pin_theft',
  'credential_theft',
  'qr_payment_scam',
  'refund_scam',
  'kyc_phishing',
  'account_block_scam',
  'upi_payment_scam',
  'tax_refund_scam',
  'delivery_scam',
  'job_fee_scam',
  'investment_scam',
  'prize_lottery_scam',
  'cashback_scam',
  'fake_support',
  'malicious_link',
  'impersonation',
  'unknown_suspicious'
];

const CATEGORY_LABELS = {
  otp_pin_theft: 'OTP / PIN Theft',
  credential_theft: 'Credential Theft',
  upi_payment_scam: 'UPI Payment Scam',
  refund_scam: 'Refund Fee Scam',
  qr_payment_scam: 'QR Code Payment Scam',
  kyc_phishing: 'KYC Phishing Scam',
  account_block_scam: 'Account Block Threat',
  tax_refund_scam: 'Tax Refund / Challan Scam',
  delivery_scam: 'Package Delivery Scam',
  job_fee_scam: 'Job / Task Scam',
  investment_scam: 'Investment / Crypto Scam',
  prize_lottery_scam: 'Prize / Lottery Scam',
  cashback_scam: 'Cashback Scam',
  fake_support: 'Fake Customer Support',
  malicious_link: 'Suspicious / Malicious Link',
  impersonation: 'Identity Impersonation',
  unknown_suspicious: 'Suspicious Payment Request'
};

const CATEGORY_RECOMMENDATIONS = {
  otp_pin_theft: [
    'Do not share your OTP, UPI PIN, or MPIN with anyone.',
    'Remember: Banks, telecom operators, and payment apps never ask for your PIN or OTP to credit money.',
    'If you shared your PIN or OTP, immediately freeze your account via your banking app or call 1930.'
  ],
  credential_theft: [
    'Never share your ATM PIN, CVV, or netbanking passwords on any phone call, SMS, or link.',
    'Immediately block your debit/credit card via your official bank app if details were exposed.'
  ],
  upi_payment_scam: [
    'Never pay money or enter your UPI PIN to receive payment.',
    'UPI does not require a PIN, fee, or QR scan to receive incoming funds.'
  ],
  refund_scam: [
    'Never pay a "processing fee" or "deposit" to receive a legitimate refund.',
    'Refunds are credited directly to your bank account without any upfront payment.'
  ],
  qr_payment_scam: [
    'Do NOT scan the QR code to receive money.',
    'Scanning a QR code or entering your PIN always deducts money from your account, never deposits it.'
  ],
  kyc_phishing: [
    'Do not click the link or call numbers in unverified KYC messages.',
    'Complete KYC verification only inside your official bank app or at the physical bank branch.'
  ],
  account_block_scam: [
    'Do not panic. Banks do not block accounts via unverified SMS links or random 10-digit mobile numbers.',
    'Verify your account status by logging into your official banking app independently.'
  ],
  tax_refund_scam: [
    'Check official portals directly (e.g., incometax.gov.in or echallan.parivahan.gov.in).',
    'Do not pay fines or claims through links sent over SMS.'
  ],
  delivery_scam: [
    'Check package tracking directly on the official courier website using your original tracking number.',
    'Never pay small "address update" or "redelivery" fees via unknown links.'
  ],
  job_fee_scam: [
    'Never pay registration fees, security deposits, or recharge fees for any job offer.',
    'Legitimate companies never offer daily income for simple YouTube likes or Telegram tasks.'
  ],
  investment_scam: [
    'Do not transfer money to private UPI IDs or crypto wallets promising guaranteed returns.',
    'No legitimate investment can guarantee 100% risk-free daily returns.'
  ],
  prize_lottery_scam: [
    'You cannot win a lottery or prize you did not participate in.',
    'Do not pay advance processing charges or taxes to claim winnings.'
  ],
  cashback_scam: [
    'Cashback in UPI is credited directly without needing you to enter your PIN or click external links.',
    'Avoid visiting third-party reward claim websites.'
  ],
  fake_support: [
    'Do not call 10-digit mobile numbers listed as "customer support" on SMS or internet searches.',
    'Find genuine customer care numbers solely inside the verified app or official website.'
  ],
  malicious_link: [
    'Do not click shortened or suspicious links.',
    'Open your bank or payment app directly from your phone screen.'
  ],
  impersonation: [
    'Official organizations do not communicate urgent legal threats or payment requests via SMS.',
    'Contact the organization through their official verified helpline to cross-check.'
  ],
  unknown_suspicious: [
    'Do not follow instructions in unsolicited messages.',
    'Verify any claims independently through official channels.'
  ]
};


const CATEGORY_RECOMMENDATIONS_HI = {
  otp_pin_theft: [
    'OTP, UPI PIN या MPIN किसी के साथ साझा न करें।',
    'याद रखें: बैंक, टेलीकॉम कंपनी या पेमेंट ऐप पैसे भेजने के लिए कभी PIN या OTP नहीं माँगते।',
    'अगर PIN या OTP बता दिया है, तो तुरंत अपने बैंकिंग ऐप से खाता फ्रीज़ करें या 1930 पर कॉल करें।'
  ],
  credential_theft: [
    'ATM पिन, CVV या नेटबैंकिंग पासवर्ड किसी कॉल, SMS या लिंक पर कभी न बताएँ।',
    'जानकारी बता दी है तो तुरंत अपने आधिकारिक बैंक ऐप से डेबिट/क्रेडिट कार्ड ब्लॉक करें।'
  ],
  upi_payment_scam: [
    'पैसे पाने के लिए कभी भुगतान न करें और UPI PIN न डालें।',
    'UPI पर पैसे पाने के लिए न PIN चाहिए, न फीस, न QR स्कैन।'
  ],
  refund_scam: [
    'असली रिफंड पाने के लिए कभी "प्रोसेसिंग फीस" या "डिपॉज़िट" न दें।',
    'रिफंड सीधे आपके बैंक खाते में आता है, बिना किसी अग्रिम भुगतान के।'
  ],
  qr_payment_scam: [
    'पैसे पाने के लिए QR कोड स्कैन न करें।',
    'QR कोड स्कैन करने या PIN डालने से हमेशा आपके खाते से पैसे कटते हैं, कभी जमा नहीं होते।'
  ],
  kyc_phishing: [
    'अज्ञात KYC संदेशों के लिंक पर क्लिक न करें और दिए नंबर पर कॉल न करें।',
    'KYC सिर्फ अपने आधिकारिक बैंक ऐप में या बैंक शाखा जाकर पूरा करें।'
  ],
  account_block_scam: [
    'घबराएँ नहीं। बैंक अज्ञात SMS लिंक या 10 अंकों के मोबाइल नंबर से खाता ब्लॉक नहीं करते।',
    'अपने आधिकारिक बैंकिंग ऐप में खुद लॉगिन करके खाते की स्थिति जाँचें।'
  ],
  tax_refund_scam: [
    'सीधे आधिकारिक पोर्टल खोलें (जैसे incometax.gov.in या echallan.parivahan.gov.in)।',
    'SMS से आए लिंक पर जुर्माना या रिफंड का भुगतान न करें।'
  ],
  delivery_scam: [
    'अपने असली ट्रैकिंग नंबर से सीधे कूरियर की आधिकारिक वेबसाइट पर स्थिति देखें।',
    'अनजान लिंक पर "पता अपडेट" या "रीडिलीवरी" की छोटी फीस कभी न दें।'
  ],
  job_fee_scam: [
    'किसी भी नौकरी के लिए रजिस्ट्रेशन फीस, सिक्योरिटी डिपॉज़िट या रीचार्ज फीस कभी न दें।',
    'कोई भी असली कंपनी YouTube लाइक या Telegram टास्क के लिए रोज़ की कमाई नहीं देती।'
  ],
  investment_scam: [
    'गारंटीड रिटर्न का वादा करने वाले निजी UPI ID या क्रिप्टो वॉलेट पर पैसे न भेजें।',
    'कोई भी असली निवेश 100% जोखिम-मुक्त रोज़ रिटर्न की गारंटी नहीं दे सकता।'
  ],
  prize_lottery_scam: [
    'जिस लॉटरी या इनाम में आपने भाग नहीं लिया, वह आप नहीं जीत सकते।',
    'इनाम पाने के लिए एडवांस प्रोसेसिंग चार्ज या टैक्स न दें।'
  ],
  cashback_scam: [
    'UPI कैशबैक सीधे खाते में आता है; PIN डालने या बाहरी लिंक खोलने की ज़रूरत नहीं होती।',
    'तीसरी पार्टी की रिवॉर्ड क्लेम वेबसाइटों से बचें।'
  ],
  fake_support: [
    'SMS या इंटरनेट सर्च में मिले 10 अंकों के मोबाइल नंबर को "कस्टमर केयर" मानकर कॉल न करें।',
    'असली कस्टमर केयर नंबर सिर्फ आधिकारिक ऐप या वेबसाइट में देखें।'
  ],
  malicious_link: [
    'छोटे किए हुए या संदिग्ध लिंक पर क्लिक न करें।',
    'बैंक या पेमेंट ऐप सीधे अपने फोन के होम स्क्रीन से खोलें।'
  ],
  impersonation: [
    'आधिकारिक संस्थाएँ SMS पर कानूनी धमकी या भुगतान की माँग नहीं करतीं।',
    'संस्था की आधिकारिक हेल्पलाइन पर कॉल करके खुद पुष्टि करें।'
  ],
  unknown_suspicious: [
    'अचानक आए संदेश में लिखे निर्देशों का पालन न करें।',
    'किसी भी दावे की पुष्टि आधिकारिक माध्यम से खुद करें।'
  ]
};


const CATEGORY_LABELS_HI = {
  otp_pin_theft: 'OTP / PIN चोरी',
  credential_theft: 'गोपनीय क्रेडेंशियल चोरी',
  upi_payment_scam: 'UPI भुगतान धोखाधड़ी',
  refund_scam: 'रिफंड शुल्क धोखाधड़ी',
  qr_payment_scam: 'QR कोड भुगतान धोखाधड़ी',
  kyc_phishing: 'KYC फ़िशिंग धोखाधड़ी',
  account_block_scam: 'खाता बंद होने की धमकी',
  tax_refund_scam: 'टैक्स रिफंड / चालान धोखाधड़ी',
  delivery_scam: 'पार्सल डिलीवरी धोखाधड़ी',
  job_fee_scam: 'नौकरी / टास्क धोखाधड़ी',
  investment_scam: 'निवेश / क्रिप्टो धोखाधड़ी',
  prize_lottery_scam: 'इनाम / लॉटरी धोखाधड़ी',
  cashback_scam: 'कैशबैक धोखाधड़ी',
  fake_support: 'नकली कस्टमर केयर',
  malicious_link: 'संदिग्ध / हानिकारक लिंक',
  impersonation: 'पहचान धोखाधड़ी',
  unknown_suspicious: 'संदिग्ध भुगतान अनुरोध'
};

export function combineEvidence({
  rawText = '',
  localResult = null,
  geminiResult = null,
  spamScore = 0,
  isSpamFlagged = false,
  isImage = false,
  ocrTranscript = ''
}) {
  const structuredSignals = [];
  const textEvidenceList = [];
  const textEvidenceListHi = [];
  const sources = {
    localRules: false,
    gemini: false,
    spamModel: false,
    ocr: isImage
  };

  // 1. Process Local Deterministic Rules
  if (localResult && Array.isArray(localResult.signals)) {
    sources.localRules = true;
    for (const sig of localResult.signals) {
      structuredSignals.push({
        source: 'local_rules',
        type: sig.type,
        severity: sig.severity,
        evidence: sig.evidence,
        category: sig.category
      });
      textEvidenceList.push(sig.evidence);
      if (sig.evidenceHi) textEvidenceListHi.push(sig.evidenceHi);
    }
  }

  // 2. Process Gemini Semantic Analysis
  if (geminiResult) {
    sources.gemini = true;
    if (Array.isArray(geminiResult.signals)) {
      for (const sig of geminiResult.signals) {
        const evidenceText = typeof sig === 'string' ? sig : sig.evidence || sig.type;
        if (evidenceText) {
          structuredSignals.push({
            source: 'gemini',
            type: (typeof sig === 'object' && sig.type) ? sig.type : 'ai_detected_signal',
            severity: (typeof sig === 'object' && sig.severity) ? sig.severity : (geminiResult.label === 'scam' ? 'high' : 'low'),
            evidence: evidenceText,
            category: geminiResult.category || 'unknown_suspicious'
          });
          textEvidenceList.push(evidenceText);
        }
      }
    }
  }

  // 3. Process UCI SMS Spam Model (Strictly Secondary)
  if (isSpamFlagged) {
    sources.spamModel = true;
    structuredSignals.push({
      source: 'spam_model',
      type: 'general_sms_spam',
      severity: 'low',
      evidence: 'General SMS spam patterns detected by UCI text baseline (secondary signal)',
      category: 'unknown_suspicious'
    });
    textEvidenceList.push('General SMS spam patterns detected (secondary indicator)');
    textEvidenceListHi.push('सामान्य SMS स्पैम पैटर्न मिले (द्वितीयक संकेत)');
  }

  // 4. Process OCR if image
  if (isImage && ocrTranscript) {
    structuredSignals.push({
      source: 'ocr',
      type: 'image_text_extracted',
      severity: 'low',
      evidence: 'Text successfully extracted and analyzed from screenshot',
      category: 'unknown_suspicious'
    });
  }

  // 5. Evaluate Risk Level
  // Calculate transparent scoring without claiming calibrated mathematical probability
  const highSeverityCount = structuredSignals.filter(s => s.severity === 'high').length;
  const mediumSeverityCount = structuredSignals.filter(s => s.severity === 'medium').length;
  const isDefensive = localResult?.isDefensiveAdvice;
  const isLegitReceipt = localResult?.isLegitReceipt;

  let riskLevel = 'UNCERTAIN';
  let label = 'uncertain';

  // Explicit safety protection: if message is legitimate defensive advice ("Never share your OTP")
  // or a legitimate transaction receipt with no fraudulent requests, it must remain UNCERTAIN.
  if ((isDefensive || isLegitReceipt) && highSeverityCount === 0) {
    riskLevel = 'UNCERTAIN';
    label = 'uncertain';
  } else if (
    highSeverityCount >= 2 ||
    (highSeverityCount >= 1 && (mediumSeverityCount >= 1 || isSpamFlagged || geminiResult?.label === 'scam')) ||
    // Immediate high risk for dangerous critical credentials, payment-to-receive, KYC phishing, or lottery
    structuredSignals.some(s => ['otp_request', 'upi_pin_request', 'credential_theft', 'payment_to_receive', 'refund_fee_scam', 'qr_payment_scam', 'kyc_phishing', 'lottery_prize'].includes(s.type))
  ) {
    riskLevel = 'HIGH_RISK';
    label = 'scam';
  } else if (highSeverityCount === 1 || mediumSeverityCount >= 1 || geminiResult?.label === 'scam') {
    riskLevel = 'SUSPICIOUS';
    label = 'suspicious';
  } else {
    riskLevel = 'UNCERTAIN';
    label = 'uncertain';
  }

  // 6. Select Primary Category
  let primaryCategory = 'unknown_suspicious';
  if (riskLevel !== 'UNCERTAIN') {
    // Find highest priority category present in signals
    const presentCategories = new Set(
      structuredSignals.map(s => s.category).filter(Boolean)
    );
    if (geminiResult?.category && CATEGORY_PRIORITY.includes(geminiResult.category)) {
      presentCategories.add(geminiResult.category);
    }

    for (const cat of CATEGORY_PRIORITY) {
      if (presentCategories.has(cat)) {
        primaryCategory = cat;
        break;
      }
    }
  } else {
    primaryCategory = 'unknown_suspicious';
  }

  // 7. Deduplicate text evidence
  const uniqueEvidence = Array.from(new Set(textEvidenceList));
  const uniqueEvidenceHi = Array.from(new Set(textEvidenceListHi));

  // 8. Generate Summary & Reason
  let summary = '';
  let summaryHi = '';
  let reason = '';
  if (riskLevel === 'HIGH_RISK') {
    const categoryName = CATEGORY_LABELS[primaryCategory] || 'Financial Scam';
    summary = `High risk detected: Likely ${categoryName}. Multiple strong fraud signals found.`;
    summaryHi = `उच्च जोखिम: संभवतः ${CATEGORY_LABELS_HI[primaryCategory] || 'वित्तीय धोखाधड़ी'}। कई मजबूत धोखाधड़ी संकेत मिले।`;
    reason = geminiResult?.reason || `Strong indicators of financial fraud detected (${categoryName}). Immediate caution required.`;
  } else if (riskLevel === 'SUSPICIOUS') {
    const categoryName = CATEGORY_LABELS[primaryCategory] || 'Suspicious Activity';
    summary = `Suspicious warning: Contains potential ${categoryName} warning signs.`;
    summaryHi = `संदिग्ध चेतावनी: ${CATEGORY_LABELS_HI[primaryCategory] || 'संदिग्ध गतिविधि'} के संकेत मिले।`;
    reason = geminiResult?.reason || `Warning signs detected. Do not click links or share credentials without verification.`;
  } else {
    summary = 'Uncertain: No strong scam pattern detected. However, this does not certify the message is safe.';
    summaryHi = 'पक्का नहीं: धोखाधड़ी का कोई स्पष्ट पैटर्न नहीं मिला। हालांकि, इससे संदेश सुरक्षित साबित नहीं होता।';
    reason = isSpamFlagged
      ? 'The general SMS spam model flagged this text, but general spam does not prove a financial fraud scam.'
      : 'No strong scam pattern detected. Text alone cannot establish that a payment message is legitimate.';
  }

  // 9. Recommendations
  const defaultRecommendations = [
    'Do not share OTPs, UPI PINs, or passwords with anyone.',
    'Open your official banking or UPI app independently to check transactions.',
    'Never click on message links or call phone numbers sent in unsolicited messages.'
  ];
  const defaultRecommendationsHi = [
    'OTP, UPI PIN या पासवर्ड किसी के साथ साझा न करें।',
    'लेन-देन जाँचने के लिए अपना आधिकारिक बैंकिंग या UPI ऐप खुद खोलें।',
    'अचानक आए संदेशों के लिंक पर क्लिक या दिए नंबर पर कॉल न करें।'
  ];
  const recommendations = (riskLevel !== 'UNCERTAIN' && CATEGORY_RECOMMENDATIONS[primaryCategory])
    ? CATEGORY_RECOMMENDATIONS[primaryCategory]
    : defaultRecommendations;
  const recommendationsHi = (riskLevel !== 'UNCERTAIN' && CATEGORY_RECOMMENDATIONS_HI[primaryCategory])
    ? CATEGORY_RECOMMENDATIONS_HI[primaryCategory]
    : defaultRecommendationsHi;

  // Recovery guidance focus: a completed-payment notice points to the
  // "money already sent" path, everything else to the "money not sent" path.
  const looksLikeDebit = /\b(?:debited|deducted|payment\s+successful|paid\s+successfully|money\s+sent|transferred)\b/i.test(rawText);
  const recoveryFocus = (isLegitReceipt || looksLikeDebit) ? 'money_sent' : 'money_not_sent';

  // Masked identifiers only: the API never echoes full links or UPI IDs.
  const maskedEntities = localResult?.entities ? {
    urls: localResult.entities.maskedUrls || [],
    upiIds: localResult.entities.maskedUpiIds || [],
    amounts: localResult.entities.amounts || []
  } : { urls: [], upiIds: [], amounts: [] };

  const verifyAction = recommendations[0] || 'Do not share OTPs or PINs. Check the official bank or payment app independently.';

  // Build method description
  const usedSources = [];
  if (sources.localRules) usedSources.push('deterministic payment rules');
  if (sources.gemini) usedSources.push('Gemini semantic analysis');
  if (sources.spamModel) usedSources.push('UCI general-spam baseline');
  if (sources.ocr) usedSources.push('OCR screenshot analysis');
  const method = usedSources.join(' + ') || 'heuristic analysis';

  return {
    label,
    riskLevel,
    category: primaryCategory,
    categoryLabel: CATEGORY_LABELS[primaryCategory] || 'Suspicious Message',
    categoryLabelHi: CATEGORY_LABELS_HI[primaryCategory] || 'संदिग्ध संदेश',
    summaryHi,
    confidence: null, // As requested: never claim uncalibrated statistical probability
    summary,
    reason,
    evidence: uniqueEvidence,
    evidenceHi: uniqueEvidenceHi,
    signals: structuredSignals,
    recommendations,
    recommendationsHi,
    recoveryFocus,
    maskedEntities,
    safeAction: verifyAction,
    method,
    generalSpamSignal: isSpamFlagged ? 'flagged' : 'not flagged',
    sources
  };
}
