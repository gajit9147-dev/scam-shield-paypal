// Two-line plain explanations per scam category, English and Hinglish.
// Static text, so it never invents facts about a specific message.
export const WHY_RISKY = {
  otp_pin_theft: {
    en: 'Only a scammer asks for your OTP or PIN. Banks never do. With it, they can empty your account in seconds.',
    hi: 'OTP ya PIN sirf scammer maangta hai. Bank kabhi nahi maangta. Iske saath wo seconds me account khaali kar sakta hai.'
  },
  credential_theft: {
    en: 'It asks for a password or login. Real companies do not ask for this over a message.',
    hi: 'Ye password ya login maang raha hai. Asli company message pe ye nahi maangti.'
  },
  upi_payment_scam: {
    en: 'Approving a UPI request sends money out of your account. You never need to pay to receive money.',
    hi: 'UPI request approve karne se paisa tere account se jaata hai. Paisa lene ke liye kabhi pay nahi karna padta.'
  },
  refund_scam: {
    en: 'A real refund never needs a fee or a payment from you first.',
    hi: 'Asli refund ke liye pehle koi fee ya payment nahi deni padti.'
  },
  qr_payment_scam: {
    en: 'Scanning a QR code or entering a PIN pays money out. It cannot receive a refund or prize.',
    hi: 'QR scan karna ya PIN daalna paisa bhejta hai. Isse refund ya prize nahi aata.'
  },
  kyc_phishing: {
    en: 'Fake KYC messages push you to a link or a number to steal your details. Update KYC only in the official bank app.',
    hi: 'Fake KYC message link ya number pe bhej ke tera data churata hai. KYC sirf bank ki official app me update kar.'
  },
  account_block_scam: {
    en: 'Threatening to block your account creates panic so you act fast. Check with your bank directly.',
    hi: 'Account block hone ka darr panic banata hai taaki tu jaldi kare. Seedha bank se confirm kar.'
  },
  tax_refund_scam: {
    en: 'Tax departments do not ask for fees or card details by message. Use the official portal.',
    hi: 'Tax department message pe fee ya card details nahi maangta. Official portal use kar.'
  },
  delivery_scam: {
    en: 'A small "delivery fee" link is a common trick to get your card or UPI details.',
    hi: 'Chhoti "delivery fee" wala link card ya UPI details churane ki common trick hai.'
  },
  job_fee_scam: {
    en: 'A real employer does not take money to give you a job or task. Asking for a fee first is the scam.',
    hi: 'Asli employer job ya task dene ke liye paisa nahi leta. Pehle fee maangna hi scam hai.'
  },
  investment_scam: {
    en: 'Guaranteed or very high returns do not exist. Early small payouts are bait for a bigger payment.',
    hi: 'Guaranteed ya bahut zyada returns nahi hote. Shuru ke chhote payout bade paise ka chara hain.'
  },
  prize_lottery_scam: {
    en: 'You cannot win a contest you never entered, and a real prize never needs a fee.',
    hi: 'Jis contest me hissa nahi liya usme jeet nahi sakte, aur asli prize ke liye fee nahi lagti.'
  },
  cashback_scam: {
    en: 'Cashback is added to your account. You never need to enter a PIN or approve a request to get it.',
    hi: 'Cashback account me khud aata hai. Uske liye PIN ya request approve nahi karni padti.'
  },
  fake_support: {
    en: 'Support numbers or emails in a message are often fake. Find the number on the official website.',
    hi: 'Message me diya support number ya email aksar fake hota hai. Number official website se le.'
  },
  malicious_link: {
    en: 'The link looks unsafe or copies a known brand. Do not open it or enter details.',
    hi: 'Ye link unsafe lagta hai ya kisi brand ki nakal hai. Mat khol, details mat daal.'
  },
  impersonation: {
    en: 'The sender pretends to be someone you trust. Confirm by calling them on a number you already have.',
    hi: 'Bhejne wala kisi jaane-pehchaane ka naam le raha hai. Apne paas ke number pe call karke confirm kar.'
  },
  unknown_suspicious: {
    en: 'Several warning signs together: pressure, a fee or a link. Stop and verify before paying.',
    hi: 'Kai warning signs ek saath: pressure, fee ya link. Rukk, verify kar, phir pay kar.'
  }
};

export function whyRisky(category, lang = 'en') {
  const item = WHY_RISKY[category] || WHY_RISKY.unknown_suspicious;
  return item[lang === 'hi' ? 'hi' : 'en'];
}
