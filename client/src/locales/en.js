export const en = {
  // Brand
  brandName: 'ScamShield',
  brandTagline: 'Detect • Verify • Stay Safe',
  brandMissionTitle: 'Safer Payments Stronger India',
  brandMissionDesc: 'Detect suspicious UPI, banking and payment messages with AI.',

  // Header
  headerBadge: 'AI Powered Scam Detection',
  headerBadgeSub: 'Check any message or screenshot for potential scams',
  language: 'Language',
  theme: 'Theme',
  profile: 'Profile',

  // Navigation
  navCheckMessage: 'Check Message',
  navHistory: 'History',
  navScamExamples: 'Scam Examples',
  navSafetyTips: 'Safety Tips',
  navSecurityInspector: 'Security Inspector',
  navSettings: 'Settings',

  // Center Main Heading
  heroTitlePrefix: 'Check Your',
  heroTitleMessage: 'Message',
  heroTitleOr: 'or',
  heroTitleScreenshot: 'Screenshot',
  heroSubtitle: 'Detect UPI, banking and payment scams instantly.',

  // Input & Tabs
  tabPasteText: 'Paste Text',
  tabUploadScreenshot: 'Upload Screenshot',
  inputPlaceholder: 'Paste a message here to check for scams...',
  uploadDragDrop: 'Click or drop screenshot here to analyze',
  uploadSubtext: 'Supports JPG, PNG, WEBP screenshots of SMS, WhatsApp, or UPI apps',
  analyzeButton: 'Analyze',
  analyzingButton: 'Analyzing...',
  clear: 'Clear',
  removeImage: 'Remove screenshot',
  tryExample: 'Try an example:',

  // Example Chip Labels
  exampleKyc: 'KYC Scam',
  exampleRefund: 'UPI Refund',
  exampleLottery: 'Lottery',
  exampleBankAlert: 'Bank Alert',
  exampleSuspiciousLink: 'Suspicious Link',

  // Real scam texts for example chips
  exampleTextKyc: 'Your Sample Bank KYC is expired. Update now at https://samplebank-kyc-verify.top/update or your account will be blocked within 24 hours.',
  exampleTextRefund: 'Dear customer, your UPI refund of Rs 4,999 is pending. Pay processing fee of Rs 99 at upi-refund.xyz to credit into your account.',
  exampleTextLottery: 'Congratulations! You won Rs 25,00,000 in KBC Lucky Draw. Contact manager on WhatsApp +91 9876543210 and pay registration fee Rs 1,500.',
  exampleTextBankAlert: 'ALERT: Your HDFC Bank account is temporarily suspended due to security issue. Click https://hdfc-verify.xyz immediately to unblock.',
  exampleTextSuspiciousLink: 'India Post: Your parcel cannot be delivered due to invalid address. Update address immediately at http://192.168.1.55/parcel to avoid return.',

  // Result Card Header
  checkedAt: 'Checked at',
  riskLevelHigh: 'HIGH RISK',
  riskLevelSuspicious: 'SUSPICIOUS',
  riskLevelUncertain: 'UNCERTAIN',
  riskLevelPayment: 'COMPLETED PAYMENT',

  // Result Card Content
  whyFlagged: 'Why we flagged it',
  whatToDo: 'What you should do',
  howWeDetected: 'How we detected this',

  // 4 Detection Sources
  sourceMsgAnalysis: 'Message Analysis',
  sourceMsgAnalysisDesc: 'Check text patterns using AI',
  sourceLinkAnalysis: 'Link Analysis',
  sourceLinkAnalysisDesc: 'Detect suspicious and fake links',
  sourceSenderContext: 'Sender & Context',
  sourceSenderContextDesc: 'Analyze intent and urgency',
  sourceScamDatabase: 'Scam Database',
  sourceScamDatabaseDesc: 'Compare with known scam patterns',

  // Right Panel - Risk Overview
  riskOverviewTitle: 'Risk Overview',
  riskIndicatorsLabel: 'Risk indicators',
  signalKycPhishing: 'KYC / Phishing',
  signalSuspiciousUrl: 'Suspicious URL',
  signalAccountThreat: 'Account Threat',
  signalUrgency: 'Urgency',

  // Right Panel - Message Details
  messageDetailsTitle: 'Message Details',
  detailCategory: 'Category',
  detailLanguage: 'Language',
  detailContainsLink: 'Contains Link',
  detailUrgency: 'Urgency',
  detailAccountThreat: 'Account Threat',
  yes: 'Yes',
  no: 'No',
  riskEmpty: 'Run a check to see the risk overview.',

  // Right Panel - Safety Tips
  safetyTipsTitle: 'Safety Tips',
  tip1Title: 'Never share your OTP or UPI PIN',
  tip1Desc: 'UPI PIN is strictly meant for sending money or checking balance, never for receiving funds.',
  tip2Title: 'Do not click on unknown links',
  tip2Desc: 'Phishing websites mimic bank portals to steal your credentials and card information.',
  tip3Title: 'Verify through official bank app',
  tip3Desc: 'Always open your banking app directly from your home screen, never via links in SMS.',
  tip4Title: 'Report suspicious messages',
  tip4Desc: 'Dial National Cybercrime Helpline 1930 or submit details on cybercrime.gov.in.',

  // Emergency Box
  emergencyTitle: 'Defrauded or sent money to this scam?',
  emergencyDesc: 'If you already sent money or entered your UPI PIN for this fraudulent message, act immediately to freeze transactions before money leaves the banking network.',
  cyberHelplineLabel: 'National Cyber Helpline',
  officialPortalLabel: 'Official Portal',
  ncrpCheckerLabel: 'NCRP Suspect Checker',
  ncrpLinkText: 'Check on NCRP suspect repository',
  ncrpNote: 'Not listed never means safe. New scam numbers and IDs appear every day.',

  // Payment Recovery Panel
  recoveryTitle: 'Sent money to the wrong person?',
  recoveryIntro: 'This message looks like a completed payment. If the money went to the wrong person, act fast. These are the real steps; recovery is not guaranteed.',
  pathNotSent: 'Money not sent yet',
  pathSent: 'Money already sent',
  officialLinks: 'Official links',
  recoveryNoPromise: 'Reporting quickly improves the chances, but no one can promise a reversal. This app explains the process; it cannot recover money.',

  // Follow-up Chat
  followUpHeading: 'Ask Follow-up Questions',
  followUpPlaceholder: 'Ask a question about this message (e.g., "Is it fraud?", "Why?")...',
  quickQuestionFraud: 'Is it fraud?',
  quickQuestionWhy: 'Why was it flagged?',
  quickQuestionWhatToDo: 'What should I do?',
  quickQuestionOcr: 'What text did you read?',
  send: 'Send',

  // Loading & Error States
  loadingReadingImage: 'Reading screenshot...',
  loadingCheckingImage: 'Checking screenshot for scam signals...',
  loadingAnalyzingText: 'Analyzing message...',
  errorNoInput: 'Please enter a message or upload a screenshot to analyze.',
  errorOcrFailed: 'Could not read text from this screenshot. Please try a clearer image or paste text directly.',
  errorApiFailed: 'Unable to analyze this message right now. Please check if the server is running and try again.',
  errorImageOversized: 'Image file is too large. Please select an image under 10MB.',

  // History Page
  historyTitle: 'Scan History',
  historyEmpty: 'No scans in this session yet. Check a message or screenshot to see it here.',
  historyClear: 'Clear History',
  historyRecheck: 'Check Again',

  // Examples Page
  examplesTitle: 'Scam Examples Catalog',
  examplesSubtitle: 'Explore real-world UPI and banking scams reported across India.',
  testThisExample: 'Test this example',

  // Settings Page
  settingsTitle: 'Settings & Preferences',
  settingsLanguageLabel: 'Application Language',
  settingsThemeLabel: 'Visual Theme',
  settingsThemeLight: 'Light Glassmorphic (Default)',
  settingsThemeDark: 'Dark Mode',
  settingsServerStatus: 'Backend Server Status',
  settingsServerConnected: 'Connected (Port 3001)',
  settingsServerOffline: 'Offline / Reconnecting',
  settingsDisclaimerTitle: 'Privacy & Safety Notice',
  settingsDisclaimerText: 'This tool is a scam warning detection aid. It does not certify messages as safe or store private credentials. Never paste real OTPs or UPI PINs.',

  // Categories Dictionary
  categories: {
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
    unknown_suspicious: 'Suspicious Payment Request',
    legit_receipt: 'Completed Payment Receipt',
    legit_notification: 'Legitimate Bank Notification'
  },

  // Evidence Dictionary
  evidence: {
    'Requests OTP': 'Requests OTP or secret verification code',
    'Requests UPI PIN': 'Requests UPI PIN or MPIN',
    'Asks to pay to receive money': 'Claims you must pay or enter PIN to receive funds',
    'Demands fee for refund': 'Demands advance processing fee to credit refund',
    'Urgent account block threat': 'Threatens account suspension, block or fine',
    'Asks to click link for KYC': 'Asks to update KYC through an unverified external link',
    'Suspicious shortened URL': 'Contains suspicious shortened or masking link',
    'Lookalike bank domain': 'Contains lookalike fake banking domain',
    'Unsolicited lottery or prize': 'Promises lottery prize or gift reward',
    'Fake customer care number': 'Prompts call to unverified personal mobile number',
    'QR code payment scam': 'Asks to scan QR code to receive incoming money',
    'Urgency and fear tactics': 'Creates artificial urgency and fear to rush action',
    'English general-spam signal': 'Flagged by SMS general-spam pattern baseline'
  },

  // Recommendations Dictionary
  recommendations: {
    otp_pin_theft: [
      'Do not share your OTP, UPI PIN, or MPIN with anyone.',
      'Remember: Banks and payment apps never ask for PIN or OTP to credit money.',
      'If you shared your PIN or OTP, immediately freeze your account via your banking app or call 1930.'
    ],
    kyc_phishing: [
      'Do not click the link or call numbers in unverified KYC messages.',
      'Complete KYC verification only inside your official bank app or at the physical bank branch.',
      'Report phishing links to cybercrime.gov.in.'
    ],
    upi_payment_scam: [
      'Never pay money or enter your UPI PIN to receive payment.',
      'UPI does not require a PIN, fee, or QR scan to receive incoming funds.',
      'Verify any payment directly inside your UPI app.'
    ],
    account_block_scam: [
      'Do not panic. Banks do not block accounts via unverified SMS links.',
      'Verify your account status by logging into your official banking app independently.',
      'Never call mobile numbers provided in warning SMS.'
    ],
    general_scam: [
      'Do not click unknown links or download unexpected attachments.',
      'Never share your OTP, UPI PIN, CVV, or passwords.',
      'Verify directly through official bank channels.'
    ]
  }
};
