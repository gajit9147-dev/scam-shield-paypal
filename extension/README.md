# ScamShield browser extension (prototype)

A Chrome (Manifest V3) extension that runs the ScamShield payment review on the page you are looking at.

What it does
- You select a payment request on any page (or select nothing and it reads the first 1000 characters of the page text).
- You start the check yourself: right-click "Check with ScamShield", or the toolbar button.
- Only then the text is sent to the ScamShield server (`/api/payments/review`). Nothing is sent before you ask.
- The result shows on the page: BLOCKED, or CHECKOUT ENABLED, with the Risk Signal Score (a warning signal, not a probability) and a reason.

What it does not do
- It does not run by itself on every checkout page. It is user-triggered.
- It never says a request is safe, and it does not verify the seller. "CHECKOUT ENABLED" means no strong scam signal was found.
- It does not pay anything. "Open in ScamShield" opens the app, where the sandbox checkout is.
- It is not published on the Chrome Web Store. Install it unpacked.

Install (unpacked)
1. Open `chrome://extensions`, turn on Developer mode.
2. Load unpacked, choose this `extension` folder.
3. Open `https://scam-shield-paypal.onrender.com/demo-store.html`, select one of the two requests, right-click and choose "Check with ScamShield".

The first call can take up to a minute while the free Render server wakes up.
