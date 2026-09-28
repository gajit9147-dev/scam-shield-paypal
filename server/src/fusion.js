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

  // 8. Generate Summary & Reason
  let summary = '';
  let reason = '';
  if (riskLevel === 'HIGH_RISK') {
    const categoryName = CATEGORY_LABELS[primaryCategory] || 'Financial Scam';
    summary = `High risk detected: Likely ${categoryName}. Multiple strong fraud signals found.`;
    reason = geminiResult?.reason || `Strong indicators of financial fraud detected (${categoryName}). Immediate caution required.`;
  } else if (riskLevel === 'SUSPICIOUS') {
    const categoryName = CATEGORY_LABELS[primaryCategory] || 'Suspicious Activity';
    summary = `Suspicious warning: Contains potential ${categoryName} warning signs.`;
    reason = geminiResult?.reason || `Warning signs detected. Do not click links or share credentials without verification.`;
  } else {
    summary = 'Uncertain: No strong scam pattern detected. However, this does not certify the message is safe.';
    reason = isSpamFlagged
      ? 'The general SMS spam model flagged this text, but general spam does not prove a financial fraud scam.'
      : 'No strong scam pattern detected. Text alone cannot establish that a payment message is legitimate.';
  }

  // 9. Recommendations
  const recommendations = (riskLevel !== 'UNCERTAIN' && CATEGORY_RECOMMENDATIONS[primaryCategory])
    ? CATEGORY_RECOMMENDATIONS[primaryCategory]
    : [
        'Do not share OTPs, UPI PINs, or passwords with anyone.',
        'Open your official banking or UPI app independently to check transactions.',
        'Never click on message links or call phone numbers sent in unsolicited messages.'
      ];

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
    confidence: null, // As requested: never claim uncalibrated statistical probability
    summary,
    reason,
    evidence: uniqueEvidence,
    signals: structuredSignals,
    recommendations,
    safeAction: verifyAction,
    method,
    generalSpamSignal: isSpamFlagged ? 'flagged' : 'not flagged',
    sources
  };
}
