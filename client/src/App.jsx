import { useEffect, useRef, useState } from 'react';

const copy = {
  en: {
    language: 'Language', eyebrow: 'Cautious payment-message check', title: 'UPI Scam Shield',
    intro: 'Paste a redacted payment message. High-risk requests may be flagged, but the English general-spam model is not a UPI scam test. This tool cannot certify a message as safe.',
    message: 'Message to check', placeholder: 'Paste a sample message here (no private details)',
    characters: 'characters', checking: 'Checking...', check: 'Check message', verdict: 'Verdict',
    upload: 'Upload screenshot', reading: 'Reading text from the screenshot...',
    readingImage: 'Reading the screenshot...', uploadedImage: 'Uploaded screenshot',
    checkingImage: 'Checking this image for scam warning signs...', viewImage: 'View Full Image', closePreview: 'Close',
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
    send: 'Send', composer: 'Ask anything or paste a message to check...', reviewImage: 'Screenshot text is ready. Correct any OCR mistakes, then send it.',
    ask: 'What do you need help with?', next: 'You can choose the other option for this same message, or send another.',
    noSafe: 'I cannot certify a message as safe. This is not a verified banking clearance. Check your bank or payment app yourself.',
    privateNote: 'Remove private details, OTPs and personal identifiers before sending.',
    unknown: 'Send a message or screenshot first, then choose how I can help.',
    clarification: 'Tell me what you need in your own words: ask whether the message is fraud, or say you sent money to the wrong person. No buttons needed.',
    askAfterText: 'Got your message. Ask me in chat what you want to know about it, for example whether it looks like fraud or what to do about a wrong payment.',
    resultIntro: 'Here is a cautious check of the text you sent:',
    recoveryIntroChat: 'If you sent money to the wrong person, act quickly. Recovery is not guaranteed.',
    answer: 'Short answer', why: 'Why this answer', signals: 'What I noticed', explanation: 'What it means', nextSteps: 'What to do now', limits: 'Limits of this check',
    whyFlagged: 'Why we flagged it:',
    whatToDo: 'What to do:',
    sourcesUsed: 'Detection sources',
    uncertainNotice: 'No strong scam pattern was detected.\nHowever, this does not prove that the message is legitimate.',
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
    needsText: 'Please paste the payment message with private details removed, or upload a screenshot and review the extracted text. I need the wording to explain its warning signs; do not send an OTP or UPI PIN.',
    recoveryPanelTitle: 'If this involves your money',
    pathNotSent: 'Money not sent yet',
    pathSent: 'Money already sent',
    notSentSteps: [
      'Stop. Do not reply, pay, scan a QR code, or enter your UPI PIN - receiving money never needs a PIN.',
      'Open your bank or UPI app from your home screen and verify the claim there. Never use links or numbers from the message.',
      'You can check the sender\'s number, UPI ID or link on the official NCRP suspect repository before acting.'
    ],
    sentSteps: [
      'Contact your bank and the payment app\'s support immediately with the 12-digit UPI reference (UTR).',
      'Call 1930 (National Cybercrime Helpline) and file a report at cybercrime.gov.in without delay.',
      'Preserve evidence: screenshots, the UTR, the sender\'s number or UPI ID, and the message itself.'
    ],
    ncrpLinkText: 'Check on NCRP suspect repository',
    ncrpNote: 'Not listed never means safe. New scam numbers and IDs appear every day.',
    officialLinks: 'Official links',
    recoveryNoPromise: 'Reporting quickly improves the chances, but no one can promise a reversal. This app explains the process; it cannot recover money or file a report for you.'
  },
  hi: {
    language: 'भाषा', eyebrow: 'भुगतान संदेश की सावधानी से जाँच', title: 'UPI स्कैम शील्ड',
    intro: 'निजी जानकारी हटाकर भुगतान का संदेश यहाँ डालें। जोखिम वाले अनुरोधों पर चेतावनी मिल सकती है, लेकिन अंग्रेज़ी सामान्य स्पैम मॉडल की जाँच UPI धोखाधड़ी पर नहीं हुई है। यह टूल किसी संदेश को सुरक्षित घोषित नहीं कर सकता।',
    message: 'जाँचने के लिए संदेश', placeholder: 'नमूना संदेश यहाँ डालें (निजी जानकारी न डालें)',
    characters: 'अक्षर', checking: 'जाँच जारी है...', check: 'संदेश जाँचें', verdict: 'नतीजा',
    upload: 'स्क्रीनशॉट अपलोड करें', reading: 'स्क्रीनशॉट से टेक्स्ट पढ़ा जा रहा है...',
    readingImage: 'स्क्रीनशॉट पढ़ा जा रहा है...', uploadedImage: 'अपलोड किया गया स्क्रीनशॉट',
    checkingImage: 'स्क्रीनशॉट में धोखाधड़ी के संकेतों की जाँच हो रही है...', viewImage: 'बड़ा देखें', closePreview: 'बंद करें',
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
    send: 'भेजें', composer: 'कुछ भी पूछें या जाँचने के लिए संदेश डालें...', reviewImage: 'स्क्रीनशॉट का टेक्स्ट तैयार है। पढ़ने की गलती सुधारकर इसे भेजें।',
    ask: 'आपको किस बारे में मदद चाहिए?', next: 'इसी संदेश के लिए दूसरा विकल्प चुनें या नया संदेश भेजें।',
    noSafe: 'मैं किसी संदेश को सुरक्षित नहीं कह सकता। यह बैंक प्रमाणन नहीं है। खुद बैंक या पेमेंट ऐप में जाँचें।',
    privateNote: 'भेजने से पहले निजी जानकारी, OTP और भुगतान पहचान हटाएँ।',
    unknown: 'पहले संदेश या स्क्रीनशॉट भेजें, फिर सहायता चुनें।',
    clarification: 'अपने शब्दों में बताएं: क्या संदेश धोखाधड़ी है, या गलत व्यक्ति को पैसे चले गए? कोई बटन नहीं चाहिए।',
    askAfterText: 'आपका संदेश मिल गया। चैट में पूछें कि यह धोखाधड़ी है या गलत भुगतान के बाद क्या करें।',
    resultIntro: 'आपके भेजे टेक्स्ट की सावधानी से जाँच:',
    recoveryIntroChat: 'अगर गलत व्यक्ति को पैसे भेजे हैं तो जल्दी करें। पैसे वापसी की गारंटी नहीं है।',
    answer: 'सीधा जवाब', why: 'क्यों', signals: 'कौन से संकेत मिले', explanation: 'इसका मतलब', nextSteps: 'अब क्या करें', limits: 'जाँच की सीमा',
    whyFlagged: 'चेतावनी के कारण:',
    whatToDo: 'क्या करें:',
    sourcesUsed: 'जाँच के स्रोत',
    uncertainNotice: 'धोखाधड़ी का कोई स्पष्ट पैटर्न नहीं मिला।\nहालांकि, सिर्फ संदेश के आधार पर इसे सुरक्षित या असली प्रमाणित नहीं किया जा सकता।',
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
    needsText: 'भुगतान संदेश से निजी जानकारी हटाकर भेजें या स्क्रीनशॉट डालकर निकला टेक्स्ट जाँचें। बिना संदेश के उसके जोखिम नहीं समझा सकता। OTP या UPI PIN न भेजें।',
    recoveryPanelTitle: 'अगर इसमें आपके पैसे जुड़े हैं',
    pathNotSent: 'अभी पैसे नहीं भेजे',
    pathSent: 'पैसे भेज दिए',
    notSentSteps: [
      'रुक जाएँ। जवाब न दें, पैसे न भेजें, QR कोड स्कैन न करें और UPI PIN न डालें - पैसे पाने के लिए PIN कभी नहीं चाहिए।',
      'अपने फोन की होम स्क्रीन से बैंक या UPI ऐप खोलकर दावे की पुष्टि करें। संदेश के लिंक या नंबर का इस्तेमाल न करें।',
      'कार्रवाई से पहले भेजने वाले का नंबर, UPI ID या लिंक आधिकारिक NCRP संदिग्ध सूची में जाँच सकते हैं।'
    ],
    sentSteps: [
      '12 अंकों के UPI रेफरेंस (UTR) के साथ तुरंत अपने बैंक और पेमेंट ऐप के सपोर्ट से संपर्क करें।',
      '1930 (राष्ट्रीय साइबरक्राइम हेल्पलाइन) पर कॉल करें और cybercrime.gov.in पर बिना देरी शिकायत दर्ज करें।',
      'सबूत संभालें: स्क्रीनशॉट, UTR, भेजने वाले का नंबर या UPI ID, और संदेश।'
    ],
    ncrpLinkText: 'NCRP संदिग्ध सूची में जाँचें',
    ncrpNote: 'सूची में न होने का मतलब सुरक्षित कभी नहीं होता। रोज़ नए धोखाधड़ी नंबर और ID बनते हैं।',
    officialLinks: 'आधिकारिक लिंक',
    recoveryNoPromise: 'जल्दी रिपोर्ट करने से संभावना बढ़ती है, लेकिन पैसे वापसी की गारंटी कोई नहीं दे सकता। यह ऐप प्रक्रिया बताता है; पैसे वापस नहीं दिला सकता और शिकायत भी आपकी ओर से दर्ज नहीं करता।'
  }
};

const apiCopy = {
  'scam': 'धोखाधड़ी का संकेत',
  'uncertain': 'पक्का नहीं',
  'suspicious': 'संदिग्ध',
  'HIGH_RISK': 'उच्च जोखिम',
  'SUSPICIOUS': 'संदिग्ध',
  'UNCERTAIN': 'पक्का नहीं',
  'OTP / PIN Theft': 'OTP / PIN चोरी',
  'Credential Theft': 'गोपनीय क्रेडेंशियल चोरी',
  'UPI Payment Scam': 'UPI भुगतान धोखाधड़ी',
  'Refund Fee Scam': 'रिफंड शुल्क धोखाधड़ी',
  'QR Code Payment Scam': 'QR कोड भुगतान धोखाधड़ी',
  'KYC Phishing Scam': 'KYC फ़िशिंग धोखाधड़ी',
  'Account Block Threat': 'खाता बंद होने की धमकी',
  'Tax Refund / Challan Scam': 'टैक्स रिफंड / चालान धोखाधड़ी',
  'Package Delivery Scam': 'पार्सल डिलीवरी धोखाधड़ी',
  'Job / Task Scam': 'नौकरी / टास्क धोखाधड़ी',
  'Investment / Crypto Scam': 'निवेश / क्रिप्टो धोखाधड़ी',
  'Prize / Lottery Scam': 'इनाम / लॉटरी धोखाधड़ी',
  'Cashback Scam': 'कैशबैक धोखाधड़ी',
  'Fake Customer Support': 'नकली कस्टमर केयर',
  'Suspicious / Malicious Link': 'संदिग्ध लिंक',
  'Identity Impersonation': 'पहचान धोखाधड़ी',
  'Suspicious Payment Request': 'संदिग्ध भुगतान अनुरोध',
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

const actualDebitPattern = /\b(?:debited\s+(?:by|from)|credited\s+(?:to|with)|paid\s+successfully\s+to|payment\s+(?:of\s+.*?\s+)?(?:was\s+)?received\s+successfully|txn\s+id\b|utr\s*:?\s*\d{12})\b/i;
const amountPattern = /(?:rs\.?|inr|\u20B9)\s*[\d,]+/i;

function looksLikeCompletedPayment(text, isFraud = false) {
  if (isFraud) return false;
  if (typeof text !== 'string' || !text) return false;
  return actualDebitPattern.test(text) && amountPattern.test(text);
}

function display(value, language) {
  return language === 'hi' ? (apiCopy[value] || value) : value;
}

let nextId = 0;
const makeMessage = (role, kind, content = {}) => ({ id: ++nextId, role, kind, type: kind, ...content });
const greetingIntent = /^(?:hi+|hello+|hey+|heya+|namaste+|pranam+|hola|good\s*(?:morning|afternoon|evening))\b[!?.\s]*$/i;
const paymentIssueIntent = /\b(wrong|mistak(?:e|en)|galat|galt|galti|issue|problem|failed|dispute|reverse|reversal|stuck|atak|fas|refund)\b.{0,70}\b(payment|paid|transfer|upi|paisa|paise|money|bhej|send|sent)\b|\b(payment|paid|transfer|paisa|paise|money|bhej|sent)\b.{0,70}\b(wrong|mistak(?:e|en)|galat|galt|galti|issue|problem|failed|dispute|reverse|reversal|stuck|atak|fas|refund)\b|गलत.{0,50}(भुगतान|पैसे|भेज)|(?:भुगतान|पैसे).{0,50}(गलत|समस्या|अटक|रिफंड)/i;
const fraudIntent = /\b(fraud|frauds|froud|fruad|fraaud|frod|scam|scams|scame|scamm|scem|skam|fake|faek|genuine|safe|saef|real|suspicious|dhokha|dhoka|dhokadhadi)\b|धोखाधड़ी|फ़्रॉड|फ्रॉड|स्कैम|नकली|सुरक्षित/i;
const learningIntent = /\b(how (?:can|do|to)|what (?:are|is)|ways to|tips|explain|understand|spot|identify|recogniz(?:e|ing))\b.{0,100}\b(upi|fraud|scam|payment)\b|\b(upi|fraud|scam|payment)\b.{0,100}\b(how|spot|identify|tips|work|happens)\b|(?:कैसे|क्या|समझा).{0,60}(?:धोखाधड़ी|स्कैम|UPI)|(?:धोखाधड़ी|स्कैम|UPI).{0,60}(?:कैसे|पहचान|बचाव)|\b(?:kaise|pehchan|bachne)\b.{0,60}\b(?:fraud|scam|upi)\b/i;
const inquiry = /[?？]|\b(is|check|tell|help|how|kya|kaise|hai|hoga|please|can|what)\b|क्या|कैसे|मदद/i;
const directVerdictQuery = /\b(?:is\s+(?:it|this)\s+(?:a\s+)?(?:fraud|froud|fruad|scam|real|fake)|(?:fraud|froud|fruad|scam)\s+or\s+(?:not|real)|(?:real|fake)\s+or\s+(?:fake|real|scam)|kya\s+ye\s+(?:fraud|scam|sahi)\s+hai|scam\s+hai\s+kya)\b/i;
const ocrQuery = /\b(?:what\s+(?:text|words?)\s+(?:did\s+you\s+read|was\s+read|extracted|is\s+in\s+(?:the\s+)?image)|show\s+(?:the\s+)?(?:ocr|text|transcript)|text\s+(?:in|from)\s+(?:the\s+)?image|kya\s+likha\s+hai|kya\s+text\s+padha)\b/i;

function intentOf(text) {
  if (typeof text !== 'string' || !text) return '';
  if (fraudIntent.test(text) && (inquiry.test(text) || text.trim().split(/\s+/).length <= 5)) return 'fraud';
  if (paymentIssueIntent.test(text)) return 'recovery';
  return '';
}

// Scale a screenshot down and re-encode it as JPEG so the upload stays small.
function prepareImage(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ dataUrl, base64: dataUrl.split(',')[1] || '', mimeType: 'image/jpeg' });
    };
    image.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    image.src = url;
  });
}

async function checkImage(prepared, clientOcrText = '') {
  try {
    const payload = {
      image: prepared.base64,
      mimeType: prepared.mimeType
    };
    if (clientOcrText) {
      payload.ocrText = clientOcrText;
    }
    const response = await fetch('/api/check-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

const MIN_THINK_MS = 900;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));


const NCRP_URL = 'https://cybercrime.gov.in/Webform/suspect_search_repository.aspx';
const NPCI_FRAUD_URL = 'https://www.npci.org.in/fraud-awareness';
const CYBERCRIME_URL = 'https://cybercrime.gov.in';

function RecoveryPanel({ t, focus }) {
  return <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-4">
    <h3 className="font-semibold text-white text-sm flex items-center gap-2">
      <span className="text-sky-400">⛑</span>
      <span>{t.recoveryPanelTitle}</span>
    </h3>
    <div className={`rounded-xl border p-3 ${focus === 'money_not_sent' ? 'border-sky-500/40 bg-sky-500/[0.06]' : 'border-white/[0.06]'}`}>
      <h4 className="text-sm font-semibold text-sky-300">{t.pathNotSent}</h4>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-[#e3e3e3]">
        {t.notSentSteps.map((step, i) => <li key={i}>{step}</li>)}
      </ol>
      <div className="mt-2.5">
        <a href={NCRP_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#8ab4f8] underline underline-offset-2 hover:text-white transition">{t.ncrpLinkText} ↗</a>
        <p className="mt-1 text-xs text-[#9aa0a6]">{t.ncrpNote}</p>
      </div>
    </div>
    <div className={`rounded-xl border p-3 ${focus === 'money_sent' ? 'border-rose-500/40 bg-rose-500/[0.06]' : 'border-white/[0.06]'}`}>
      <h4 className="text-sm font-semibold text-rose-300">{t.pathSent}</h4>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-[#e3e3e3]">
        {t.sentSteps.map((step, i) => <li key={i}>{step}</li>)}
      </ol>
    </div>
    <div className="border-t border-white/[0.08] pt-2.5 text-xs text-[#9aa0a6] space-y-1">
      <p className="font-medium text-[#c4c7c5]">{t.officialLinks}:</p>
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        <a href={NPCI_FRAUD_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white transition">npci.org.in/fraud-awareness ↗</a>
        <a href={CYBERCRIME_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white transition">cybercrime.gov.in ↗</a>
        <a href="tel:1930" className="underline underline-offset-2 hover:text-white transition">1930 (helpline)</a>
      </p>
      <p className="pt-1">{t.recoveryNoPromise}</p>
    </div>
  </section>;
}

export default function App() {
  const [language, setLanguage] = useState('en');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeText, setActiveText] = useState('');
  const [latestVerdict, setLatestVerdict] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrState, setOcrState] = useState('');
  const [readingImage, setReadingImage] = useState(false);
  const [previewModalUrl, setPreviewModalUrl] = useState(null);
  const fileInput = useRef(null);
  const bottomRef = useRef(null);
  const requestId = useRef(0);
  const t = copy[language];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy, ocrLoading, ocrState, language]);

  async function readScreenshot(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setReadingImage(true);
    setOcrLoading(true);
    setOcrState('');
    const started = Date.now();

    try {
      const prepared = await prepareImage(file);
      if (!prepared) throw new Error('Image could not be processed');

      // 1. Immediately show preview in user's chat message using uploaded image
      const imageMsg = makeMessage('user', 'image', {
        type: 'image',
        image: prepared.dataUrl,
        imageUrl: prepared.dataUrl,
        mimeType: prepared.mimeType,
        name: file.name
      });
      setMessages(previous => [...previous, imageMsg]);

      // 2. Send image to backend for analysis (Gemini vision + fusion)
      let result = await checkImage(prepared);

      // 3. Fallback: If backend vision is unavailable, run OCR INTERNALLY
      // OCR text is used strictly internally for local detection rules, NEVER displayed as user's bubble
      if (!result) {
        try {
          const tesseract = (await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js')).default;
          const ocrLang = language === 'hi' ? 'hin+eng' : 'eng+hin';
          const { data } = await tesseract.recognize(prepared.dataUrl, ocrLang);
          const extracted = (data?.text || '').replace(/[ \t]+\n/g, '\n').trim().slice(0, 1000);
          if (extracted && (extracted.match(/[\p{L}\p{N}]/gu) || []).length >= 3) {
            setActiveText(extracted);
            // Retry /api/check-image with internally extracted OCR text
            result = await checkImage(prepared, extracted);
            if (!result) {
              const textRes = await fetch('/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: extracted })
              });
              if (textRes.ok) {
                result = await textRes.json();
              }
            }
          }
        } catch (ocrErr) {
          console.warn('Internal OCR execution error:', ocrErr);
        }
      }

      await pause(Math.max(0, MIN_THINK_MS - (Date.now() - started)));

      if (result) {
        const finalAnalysis = result.analysis || result;
        const transcript = result.ocr?.text || result.transcript || activeText || '';
        if (transcript) setActiveText(transcript);
        finalAnalysis.isImage = true;
        setLatestVerdict(finalAnalysis);
        setMessages(previous => [...previous, makeMessage('assistant', 'verdict', {
          result: finalAnalysis,
          sourceText: transcript,
          isImage: true
        })]);
      } else {
        setMessages(previous => [...previous, makeMessage('assistant', 'chat', {
          text: language === 'hi'
            ? 'स्क्रीनशॉट की जाँच नहीं हो सकी। क्या बैकएंड सर्वर (पोर्ट 3001) चल रहा है? आप चाहें तो संदेश का टेक्स्ट सीधे टाइप करके भी जाँच सकते हैं।'
            : 'Could not check the screenshot right now. Please verify that the backend server is running, or paste the message text directly.'
        })]);
      }
    } catch {
      setMessages(previous => [...previous, makeMessage('assistant', 'error', {
        error: language === 'hi'
          ? 'स्क्रीनशॉट से चेतावनी संकेत नहीं पढ़े जा सके।'
          : 'Could not read text or warning signs from that image.'
      })]);
    } finally {
      setReadingImage(false);
      setOcrLoading(false);
      setBusy(false);
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
    const user = makeMessage('user', 'text', { text, type: 'text' });
    setMessages(previous => [...previous, user]);
    const wordCount = text.trim().split(/\s+/).length;
    const paymentish = looksLikeCompletedPayment(text) || /(otp|pin|https?:|bit\.ly|\u20b9|inr\b|rs\.?\s*\d|account|a\/c|refund|debited|credited|blocked|kyc|verify|won|winner|lottery|cashback|payment|paid|upi|bank)/i.test(text) || wordCount > 8;
    const shortQuery = text.length < 130 && inquiry.test(text) && !paymentish;
    const isDirectVerdictQuery = latestVerdict && directVerdictQuery.test(text);
    const isOcrQuery = ocrQuery.test(text);

    if (greetingIntent.test(text)) {
      setMessages(previous => [...previous, makeMessage('assistant', 'chat', {
        text: language === 'hi'
          ? 'नमस्ते! भुगतान का कोई संदेश, SMS या स्क्रीनशॉट यहाँ भेजें। मैं उसमें धोखाधड़ी के जोखिम की जाँच करूँगा। ध्यान रखें: कभी भी अपना OTP या UPI PIN किसी के साथ साझा न करें।'
          : 'Hello! Paste any payment message, SMS, or upload a screenshot here, and I will analyze it for scam risks. Remember: never share your OTP or UPI PIN with anyone.'
      })]);
    } else if (learning) {
      setMessages(previous => [...previous, makeMessage('assistant', 'learning')]);
    } else if (action === 'recovery') {
      setActiveText(text);
      setMessages(previous => [...previous, makeMessage('assistant', 'recovery', { sourceText: text })]);
    } else if (isDirectVerdictQuery || isOcrQuery) {
      // Use existing detection result directly without re-running detection
      chatReply(text, latestVerdict);
    } else if (action === 'fraud') {
      if (paymentish) {
        setActiveText(text);
        checkText(text);
      } else if (latestVerdict) {
        chatReply(text, latestVerdict);
      } else if (activeText) {
        checkText(activeText);
      } else {
        setMessages(previous => [...previous, makeMessage('assistant', 'question', { text: 'needsText' })]);
      }
    } else if (shortQuery) {
      if (activeText) chatReply(text, latestVerdict);
      else setMessages(previous => [...previous, makeMessage('assistant', 'question', { text: 'clarification' })]);
    } else {
      setActiveText(text);
      checkText(text);
    }
  }

  async function chatReply(question, existingVerdict = null) {
    setBusy(true);
    const call = ++requestId.current;
    const started = Date.now();
    const verdictToUse = existingVerdict || latestVerdict;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          context: (activeText || '').slice(0, 1000),
          language,
          detectionResult: verdictToUse
        })
      });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      await pause(Math.max(0, MIN_THINK_MS - (Date.now() - started)));
      if (call !== requestId.current) return;
      setMessages(previous => [...previous, makeMessage('assistant', 'chat', { text: data.reply })]);
    } catch {
      if (call !== requestId.current) return;
      if (ocrQuery.test(question)) {
        const textToShow = activeText || verdictToUse?.ocr?.text || verdictToUse?.transcript || '';
        const isHi = language === 'hi';
        const replyText = textToShow
          ? (isHi
              ? `स्क्रीनशॉट से निकाला गया टेक्स्ट:\n\n"${textToShow}"\n\n⚠ गोपनीयता सूचना: OCR में त्रुटियाँ हो सकती हैं। हम आपकी छवियों या निजी जानकारी को कभी स्टोर नहीं करते हैं।`
              : `Here is the text extracted from the screenshot:\n\n"${textToShow}"\n\n⚠ Privacy note: Optical character recognition may contain reading errors. We do not permanently store your screenshots or extracted data.`)
          : (isHi ? 'स्क्रीनशॉट से कोई टेक्स्ट नहीं पढ़ा जा सका।' : 'No clear text could be extracted from the screenshot.');
        setMessages(previous => [...previous, makeMessage('assistant', 'chat', { text: replyText })]);
        return;
      }
      if (verdictToUse) {
        const isHi = language === 'hi';
        const isImg = verdictToUse.inputType === 'image' || verdictToUse.isImage;
        const targetDescEn = isImg ? 'in the screenshot' : 'in the message';
        const targetDescHi = isImg ? 'स्क्रीनशॉट में' : 'संदेश में';
        const evidenceList = (verdictToUse.evidence || []).slice(0, 4).map(e => `• ${display(e, language)}`).join('\n');
        let replyText = '';
        if (verdictToUse.riskLevel === 'HIGH_RISK') {
          replyText = isHi
            ? `मिले चेतावनी संकेतों के आधार पर, यह ${targetDescHi} उच्च जोखिम (High Risk) वाला है और धोखाधड़ी होने की पूरी संभावना है।\n\nपहचाने गए मुख्य कारण:\n${evidenceList || '• संदिग्ध धोखाधड़ी पैटर्न पाया गया'}\n\nक्या करें: कोई OTP या PIN साझा न करें, किसी लिंक पर क्लिक न करें, और बैंक ऐप में खुद जाँचें।`
            : `Based on the warning signs detected ${targetDescEn}, this message is high risk and appears consistent with a scam.\n\nDetected reasons:\n${evidenceList || '• Fraudulent request pattern detected'}\n\nWhat to do: Do not share OTP or PIN, do not click message links, and verify directly through your official banking app.`;
        } else if (verdictToUse.riskLevel === 'SUSPICIOUS') {
          replyText = isHi
            ? `${targetDescHi} संदिग्ध चेतावनी संकेत मिले हैं।\n\nपहचाने गए संकेत:\n${evidenceList || '• संदिग्ध गतिविधि'}\n\nक्या करें: जब तक खुद आधिकारिक बैंक से पुष्टि न कर लें, कोई कदम न उठाएँ।`
            : `Based on the warning signs detected ${targetDescEn}, this message is suspicious.\n\nDetected warning signs:\n${evidenceList || '• Suspicious activity'}\n\nWhat to do: Do not proceed until you verify independently through the official bank app.`;
        } else {
          replyText = isHi
            ? `${targetDescHi} धोखाधड़ी का कोई स्पष्ट पैटर्न नहीं मिला। हालांकि, सिर्फ टेक्स्ट के आधार पर इसे सुरक्षित नहीं माना जा सकता। बैंक ऐप में खुद पुष्टि करें।`
            : `No strong scam pattern was detected ${targetDescEn}. However, this does not prove that the message is legitimate. Always verify independently through your official banking app.`;
        }
        setMessages(previous => [...previous, makeMessage('assistant', 'chat', { text: replyText })]);
      } else if (learningIntent.test(question) || /prevent|avoid|protect|bachne|bachao|बच|सुरक्षित रह/.test(question)) {
        setMessages(previous => [...previous, makeMessage('assistant', 'learning')]);
      } else {
        setMessages(previous => [...previous, makeMessage('assistant', 'question', { text: 'clarification' })]);
      }
    } finally {
      if (call === requestId.current) setBusy(false);
    }
  }

  async function checkText(selectedText) {
    if (!selectedText) return;
    setBusy(true);
    const call = ++requestId.current;
    const started = Date.now();
    try {
      const response = await fetch('/api/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check the message.');
      await pause(Math.max(0, MIN_THINK_MS - (Date.now() - started)));
      if (call !== requestId.current) return;
      setLatestVerdict(data);
      setMessages(previous => [...previous, makeMessage('assistant', 'verdict', { result: data, sourceText: selectedText })]);
    } catch (err) {
      if (call === requestId.current) setMessages(previous => [...previous, makeMessage('assistant', 'error', { error: err.message })]);
    } finally {
      if (call === requestId.current) setBusy(false);
    }
  }

  function assistantContent(message) {
    if (message.kind === 'question') return <p>{t[message.text] || t.clarification}</p>;
    if (message.kind === 'chat') return <p className="whitespace-pre-wrap leading-relaxed text-[#e3e3e3]">{message.text}</p>;
    if (message.kind === 'error') return <p role="alert" className="text-rose-400 font-medium">{language === 'hi' ? (apiCopy[message.error] || t.error) : (message.error || t.error)}</p>;
    if (message.kind === 'recovery') return <div className="space-y-3">
      <h2 className="font-semibold text-lg text-white">{t.recoveryTitle}</h2>
      <p className="text-[#c4c7c5]">{t.recoveryIntroChat}</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-[#e3e3e3]">{t.recoverySteps.map((step, index) => <li key={index}>{step}</li>)}</ol>
      <p className="text-xs text-[#9aa0a6] border-t border-white/[0.08] pt-2">{t.recoveryNote}</p>
      <RecoveryPanel t={t} focus="money_sent" />
    </div>;
    if (message.kind === 'learning') return <div className="space-y-4">
      <section><h2 className="font-semibold text-[#8ab4f8] text-base">{t.answer}</h2><p className="mt-1 text-sm text-[#e3e3e3]">{t.learningAnswer}</p></section>
      <section><h3 className="font-semibold text-white text-sm">{t.why}</h3><p className="mt-1 text-sm text-[#c4c7c5]">{t.learningWhy}</p></section>
      <section><h3 className="font-semibold text-white text-sm">{t.nextSteps}</h3><ol className="mt-1 list-decimal space-y-1.5 pl-5 text-sm text-[#c4c7c5]">{t.learningSteps.map((step, i) => <li key={i}>{step}</li>)}</ol></section>
      <section className="border-t border-white/[0.08] pt-2 text-xs text-[#9aa0a6]"><h3 className="font-medium text-white">{t.limits}</h3><p className="mt-0.5">{t.learningLimit}</p></section>
    </div>;
    if (message.kind === 'verdict') {
      const r = message.result;
      const risk = r.riskLevel || (r.label === 'scam' ? 'HIGH_RISK' : 'UNCERTAIN');
      const isFraud = risk === 'HIGH_RISK' || risk === 'SUSPICIOUS' || r.label === 'scam';
      const isPaymentIssue = !isFraud && (r.recoveryFocus === 'money_sent' || r.category === 'Legitimate Transaction' || looksLikeCompletedPayment(message.sourceText, false));
      const categoryName = (language === 'hi' && r.categoryLabelHi) ? r.categoryLabelHi : (r.categoryLabel || r.category || '');
      const englishEvidence = Array.isArray(r.evidence) && r.evidence.length > 0
        ? r.evidence
        : (Array.isArray(r.signals) ? r.signals.map(s => s.evidence || s.type) : []);
      const evidenceItems = (language === 'hi' && Array.isArray(r.evidenceHi) && r.evidenceHi.length > 0)
        ? r.evidenceHi
        : englishEvidence;
      const recommendations = (language === 'hi' && Array.isArray(r.recommendationsHi) && r.recommendationsHi.length > 0)
        ? r.recommendationsHi
        : (Array.isArray(r.recommendations) && r.recommendations.length > 0
          ? r.recommendations
          : [r.safeAction || t.scamInstruction]);

      const badgeStyle = isFraud
        ? (risk === 'HIGH_RISK'
          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/35 shadow-sm shadow-rose-500/10'
          : 'bg-amber-500/15 text-amber-300 border border-amber-500/35 shadow-sm shadow-amber-500/10')
        : (isPaymentIssue
          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shadow-sm shadow-emerald-500/10'
          : 'bg-sky-500/15 text-sky-300 border border-sky-500/35 shadow-sm shadow-sky-500/10');

      const badgeText = isFraud
        ? (risk === 'HIGH_RISK'
          ? (language === 'hi' ? '🔴 उच्च जोखिम (HIGH RISK)' : '🔴 HIGH RISK')
          : (language === 'hi' ? '🟠 संदिग्ध (SUSPICIOUS)' : '🟠 SUSPICIOUS'))
        : (isPaymentIssue
          ? (language === 'hi' ? '💳 पूर्ण भुगतान (PAYMENT RECEIPT)' : '💳 COMPLETED PAYMENT')
          : (language === 'hi' ? '🟡 पक्का नहीं (UNCERTAIN)' : '🟡 UNCERTAIN'));

      return <div className="space-y-4">
        {/* Risk Level / Status and Category */}
        <section>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`rounded-full px-3.5 py-1 text-xs font-semibold tracking-wide ${badgeStyle}`}>
              {badgeText}
            </span>
            {categoryName && (
              <span className="font-semibold text-white text-[15px]">
                {language === 'hi' && r.categoryLabelHi ? categoryName : display(categoryName, language)}
              </span>
            )}
          </div>
          <p className="mt-2.5 text-sm text-[#c4c7c5] leading-relaxed">
            {language === 'hi' && r.summaryHi
              ? r.summaryHi
              : (r.summary
                ? display(r.summary, language)
                : (isFraud
                  ? t.scamAnswer
                  : (isPaymentIssue
                    ? (language === 'hi' ? 'यह संदेश एक पूरा हुआ भुगतान या बैंक डेबिट लगता है। इसमें धोखाधड़ी के संकेत नहीं मिले हैं।' : 'This message looks like a completed payment receipt or bank debit. No fraud patterns were detected.')
                    : t.uncertainAnswer)))}
          </p>
        </section>

        {/* Why we flagged it / Warning Signs (For fraud or suspicious messages) */}
        {isFraud ? (
          <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <span className="text-amber-400">⚠</span>
              <span>{t.whyFlagged || t.signals}</span>
            </h3>
            {evidenceItems.length > 0 ? (
              <ul className="mt-2.5 space-y-1.5 pl-2 text-sm text-[#e3e3e3]">
                {evidenceItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#8ab4f8] mt-1 shrink-0 text-xs">◆</span>
                    <span>{language === 'hi' && Array.isArray(r.evidenceHi) && r.evidenceHi.length > 0 ? item : display(item, language)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#c4c7c5]">{display(r.reason, language)}</p>
            )}
          </section>
        ) : (!isPaymentIssue && (
          <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
            <h3 className="font-semibold text-white text-sm">{t.explanation}</h3>
            <p className="mt-1.5 whitespace-pre-line text-sm text-[#c4c7c5] leading-relaxed">{t.uncertainNotice || t.noPattern}</p>
          </section>
        ))}

        {/* Recommended action / What to do */}
        <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <span className="text-emerald-400">🛡</span>
            <span>{t.whatToDo || t.nextSteps}</span>
          </h3>
          <ul className="mt-2.5 space-y-1.5 pl-2 text-sm text-[#e3e3e3]">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1 shrink-0 text-xs">✓</span>
                <span>{language === 'hi' && Array.isArray(r.recommendationsHi) && r.recommendationsHi.length > 0 ? rec : display(rec, language)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 🚨 FRAUD SCENARIO: Emergency Cybercrime Reporting */}
        {isFraud && (
          <section className="bg-rose-500/[0.06] border border-rose-500/25 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🚨</span>
              <h3 className="font-semibold text-rose-300 text-sm">
                {language === 'hi' ? 'धोखाधड़ी में पैसे चले गए या जानकारी दी है?' : 'Defrauded or sent money to this scam?'}
              </h3>
            </div>
            <p className="text-xs text-[#c4c7c5] leading-relaxed">
              {language === 'hi'
                ? 'यदि आपने इस धोखाधड़ी के झांसे में आकर पैसे ट्रांसफर कर दिए हैं या UPI PIN दर्ज कर दिया है, तो बिना देरी किए राष्ट्रीय हेल्पलाइन 1930 पर कॉल करें और बैंक को सूचित करें।'
                : 'If you already sent money or entered your UPI PIN for this fraudulent message, act immediately to freeze transactions before money leaves the banking network.'}
            </p>
            <div className="rounded-xl bg-black/30 border border-white/[0.06] p-3 space-y-2 text-xs text-[#e3e3e3]">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-medium text-rose-300">📞 {language === 'hi' ? 'राष्ट्रीय साइबर हेल्पलाइन' : 'National Cyber Helpline'}:</span>
                <a href="tel:1930" className="font-bold text-rose-400 text-sm hover:underline">1930</a>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-medium text-[#c4c7c5]">🌐 {language === 'hi' ? 'साइबर अपराध रिपोर्ट पोर्टल' : 'Official Portal'}:</span>
                <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="text-[#8ab4f8] underline hover:text-white transition">cybercrime.gov.in ↗</a>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-medium text-[#c4c7c5]">🔍 {language === 'hi' ? 'संदिग्ध नंबर/UPI रिपॉजिटरी' : 'NCRP Suspect Checker'}:</span>
                <a href={NCRP_URL} target="_blank" rel="noopener noreferrer" className="text-[#8ab4f8] underline hover:text-white transition">{t.ncrpLinkText} ↗</a>
              </div>
            </div>
          </section>
        )}

        {/* 💳 PAYMENT SCENARIO: Wrong payment / Completed payment recovery */}
        {isPaymentIssue && (
          <div className="space-y-3">
            <section className="bg-sky-500/[0.06] border border-sky-500/25 rounded-2xl p-4 space-y-2">
              <h3 className="font-semibold text-sky-300 text-sm flex items-center gap-2">
                <span>💸</span>
                <span>{language === 'hi' ? 'गलत खाते में भुगतान हुआ है?' : 'Wrong Transfer or Payment Issue?'}</span>
              </h3>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                {t.recoveryIntro}
              </p>
            </section>
            <RecoveryPanel t={t} focus="money_sent" />
          </div>
        )}

        {/* Ambiguous non-fraud, non-payment: standard cautious panel */}
        {!isFraud && !isPaymentIssue && (
          <RecoveryPanel t={t} focus="money_not_sent" />
        )}

        {/* Detection sources */}
        {r.sources && (
          <section className="border-t border-white/[0.08] pt-2.5 text-xs text-[#9aa0a6] flex items-center justify-between flex-wrap gap-2">
            <span className="font-medium">{t.sourcesUsed || 'Detection sources'}:</span>
            <span className="text-[#c4c7c5]">
              {[
                r.sources.localRules && (language === 'hi' ? 'स्थानीय नियम' : 'Deterministic rules'),
                r.sources.gemini && (language === 'hi' ? 'Gemini AI' : 'Gemini AI'),
                r.sources.spamModel && (language === 'hi' ? 'UCI स्पैम सिग्नल' : 'UCI Spam signal'),
                r.sources.ocr && (language === 'hi' ? 'OCR' : 'OCR Vision')
              ].filter(Boolean).join(' • ') || r.method || 'Standard checks'}
            </span>
          </section>
        )}
      </div>;
    }
    return null;
  }

  return (
    <main lang={language} className="relative flex h-[100dvh] min-h-[480px] flex-col overflow-hidden liquid-grey-canvas text-[#e3e3e3]">
      {/* Subtle Liquid Dark ambient lighting */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-slate-500/5 blur-[140px]"/>
        <div className="absolute -right-32 top-1/4 h-[450px] w-[450px] rounded-full bg-zinc-500/5 blur-[160px]"/>
        <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-slate-400/5 blur-[130px]"/>
      </div>

      <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col border-x border-white/[0.08] bg-[#0c0d11]/75 backdrop-blur-2xl">
        {/* Header */}
        <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-[#101216]/80 px-4 py-3.5 backdrop-blur-2xl sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.08] border border-white/15 text-sm shadow-inner">
              <span className="text-zinc-200">🛡️</span>
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-1.5">
                <span>{t.title}</span>
              </h1>
              <p className="text-xs text-zinc-400 truncate">{t.eyebrow}</p>
            </div>
          </div>
          <label className="shrink-0 flex items-center gap-2 text-xs text-zinc-400">
            <span>{t.language}</span>
            <select
              aria-label={t.language}
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="rounded-full border border-white/10 bg-[#16181d] px-3 py-1.5 text-xs font-medium text-white shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </label>
        </header>

        {/* Message Log */}
        <div role="log" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6 sm:py-7">
          {/* Welcome Card */}
          <div className="flex items-start">
            <div className="liquid-grey-card w-full max-w-[95%] sm:max-w-[85%] p-5 text-sm sm:text-[15px] leading-relaxed text-[#e3e3e3]">
              <div className="flex items-center gap-2 mb-2 font-medium text-zinc-200">
                <span className="text-base">🛡️</span>
                <span>{t.title}</span>
              </div>
              <p className="text-zinc-300">{t.greeting}</p>
              <p className="mt-2 text-xs text-zinc-400">{t.noSafe}</p>
            </div>
          </div>

          {/* Messages */}
          {messages.map(message => (
            <div key={message.id} className={`flex items-start ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'user' ? (
                (message.kind === 'image' || message.type === 'image') ? (
                  <div
                    className="group relative inline-block cursor-pointer overflow-hidden rounded-2xl border border-white/20 bg-black/40 shadow-xl transition hover:border-white/40"
                    onClick={() => setPreviewModalUrl(message.imageUrl || message.image)}
                    title={language === 'hi' ? 'बड़ा देखने के लिए क्लिक करें' : 'Click to expand preview'}
                  >
                    <img
                      src={message.imageUrl || message.image}
                      alt={t.uploadedImage}
                      className="max-h-72 w-auto max-w-full rounded-2xl object-contain sm:max-h-80"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                      <span className="rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                        🔍 {t.viewImage || (language === 'hi' ? 'बड़ा देखें' : 'View Full Image')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="liquid-grey-pill max-w-[92%] sm:max-w-[82%] px-6 py-4 text-white text-[15px] sm:text-[16px] leading-relaxed break-words">
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                )
              ) : (
                <div className="liquid-grey-card min-w-0 max-w-[95%] sm:max-w-[85%] p-5 sm:p-6 text-sm sm:text-[15px] leading-relaxed text-[#e3e3e3] break-words">
                  {assistantContent(message)}
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div className="flex items-center">
              <div role="status" className="liquid-grey-card px-4 py-3 text-sm text-zinc-300 flex items-center gap-2.5">
                <span className="animate-spin text-base inline-block">⚙️</span>
                <span>
                  {readingImage
                    ? (t.checkingImage || (language === 'hi' ? 'स्क्रीनशॉट में धोखाधड़ी के संकेतों की जाँच हो रही है...' : 'Checking this image for scam warning signs...'))
                    : t.checking}
                </span>
                <span aria-hidden="true" className="inline-block animate-pulse text-zinc-400">● ● ●</span>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Floating Liquid Grey Input Composer */}
        <div className="z-10 shrink-0 border-t border-white/[0.08] bg-[#0c0d11]/85 px-3 pb-[max(env(safe-area-inset-bottom),14px)] pt-3 backdrop-blur-2xl sm:px-6">
          <form onSubmit={sendMessage} className="liquid-grey-input flex items-end gap-2 p-2">
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/*" onChange={readScreenshot} className="hidden" aria-hidden="true" tabIndex={-1}/>
            <button
              type="button"
              aria-label={t.upload}
              title={t.upload}
              disabled={busy || ocrLoading}
              onClick={() => fileInput.current?.click()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 transition cursor-pointer"
            >
              ＋
            </button>
            <textarea
              aria-label={t.message}
              rows={1}
              maxLength={1000}
              value={draft}
              onChange={e => { setDraft(e.target.value); setOcrState(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={t.composer}
              className="max-h-32 min-h-10 w-full flex-1 resize-none bg-transparent px-3 py-2 text-sm sm:text-base text-white placeholder:text-zinc-500 outline-none"
            />
            <button
              type="submit"
              disabled={busy || ocrLoading || !draft.trim()}
              className="shrink-0 rounded-full bg-white/[0.14] hover:bg-white/[0.22] border border-white/25 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:hover:scale-100 cursor-pointer disabled:cursor-not-allowed"
            >
              {t.send}
            </button>
          </form>
          {ocrLoading && <p role="status" className="mt-1.5 text-center text-xs text-zinc-400">{readingImage ? (t.checkingImage || t.readingImage) : t.reading}</p>}
          {ocrState === 'error' && <p role="alert" className="mt-1.5 text-center text-xs text-rose-400">{t.ocrError}</p>}
          <p className="mt-1.5 text-center text-[11px] text-zinc-500">{t.privateNote}</p>
        </div>
      </div>

      {/* Lightbox / Modal for Image Preview */}
      {previewModalUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setPreviewModalUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-white/20 bg-[#121418] p-2 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label={t.closePreview || 'Close'}
              onClick={() => setPreviewModalUrl(null)}
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/75 text-sm font-bold text-white hover:bg-black transition cursor-pointer"
            >
              ✕
            </button>
            <img
              src={previewModalUrl}
              alt={t.uploadedImage}
              className="max-h-[82vh] w-auto max-w-[85vw] rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </main>
  );
}
