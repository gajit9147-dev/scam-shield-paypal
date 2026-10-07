let sdkPromise;
export function loadPayPal(clientId) {
  if (sdkPromise) return sdkPromise;
  if (window.paypal) return Promise.resolve(window.paypal);
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    s.onload = () => resolve(window.paypal);
    s.onerror = () => { sdkPromise = null; s.remove(); reject(new Error('Could not load PayPal.')); };
    document.head.appendChild(s);
  });
  return sdkPromise;
}
