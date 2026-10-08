// ScamShield payment check (prototype). Runs only when the user asks: context menu or popup button.
// Sends the chosen text (or the first 1000 characters of the page text) to the ScamShield API, then draws the result on the page.
const DEFAULT_API = 'https://scam-shield-paypal.onrender.com';
const MENU_ID = 'scamshield-check';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: 'Check with ScamShield', contexts: ['selection', 'page'] });
});

async function apiBase() {
  const { apiBase } = await chrome.storage.local.get('apiBase');
  return (apiBase || DEFAULT_API).replace(/\/+$/, '');
}

function readFromPage() {
  const sel = String(window.getSelection ? window.getSelection() : '').trim();
  if (sel) return { text: sel.slice(0, 1000), source: 'selection' };
  const page = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
  return { text: page.slice(0, 1000), source: 'page' };
}

// Drawn inside the page. Kept self-contained because it is injected as a function.
function drawOverlay(state) {
  const old = document.getElementById('scamshield-overlay-host');
  if (old) old.remove();
  const host = document.createElement('div');
  host.id = 'scamshield-overlay-host';
  host.style.cssText = 'all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  const color = state.kind === 'blocked' ? '#b91c1c' : state.kind === 'enabled' ? '#15803d' : '#92400e';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  root.innerHTML = `
    <style>
      .box{font:14px/1.45 system-ui,sans-serif;width:340px;background:#fff;color:#111;border:2px solid ${color};border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.28);padding:14px}
      .tag{display:inline-block;background:${color};color:#fff;font-weight:700;border-radius:6px;padding:2px 8px;font-size:12px;letter-spacing:.04em}
      h1{font-size:15px;margin:8px 0 4px}
      p{margin:6px 0}
      .muted{color:#555;font-size:12px}
      button,a.btn{font:inherit;font-size:13px;border:1px solid #999;background:#f5f5f5;border-radius:8px;padding:5px 10px;cursor:pointer;text-decoration:none;color:#111;display:inline-block}
      .row{display:flex;gap:8px;margin-top:10px;align-items:center}
      .x{margin-left:auto}
    </style>
    <div class="box" role="dialog" aria-label="ScamShield result">
      <span class="tag">${esc(state.label)}</span>
      <h1>${esc(state.title)}</h1>
      ${state.score != null ? `<p><b>Risk Signal Score: ${esc(state.score)}/100</b> <span class="muted">(a warning signal, not a probability)</span></p>` : ''}
      ${state.reason ? `<p>${esc(state.reason)}</p>` : ''}
      ${state.advice ? `<p>${esc(state.advice)}</p>` : ''}
      <p class="muted">${esc(state.note)}</p>
      ${state.source ? `<p class="muted">Checked: ${esc(state.source)}. ${esc(state.excerpt)}</p>` : ''}
      <div class="row">
        ${state.openUrl ? `<a class="btn" href="${esc(state.openUrl)}" target="_blank" rel="noopener">Open in ScamShield</a>` : ''}
        <button class="x" id="close">Close</button>
      </div>
    </div>`;
  root.getElementById('close').addEventListener('click', () => host.remove());
  document.documentElement.appendChild(host);
}

async function show(tabId, state) {
  await chrome.scripting.executeScript({ target: { tabId }, func: drawOverlay, args: [state] });
}

async function runCheck(tabId) {
  await show(tabId, { kind: 'pending', label: 'CHECKING', title: 'ScamShield is reading the request...', note: 'Only the text you chose (or the first 1000 characters of this page) is sent to the ScamShield server.', source: '', excerpt: '' });
  let picked;
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: readFromPage });
    picked = result;
  } catch (e) {
    return show(tabId, { kind: 'error', label: 'NOT CHECKED', title: 'This page cannot be read by the extension.', note: 'Browser pages and the Web Store block extensions. Select the text on a normal page and try again.', source: '', excerpt: '' });
  }
  if (!picked?.text || picked.text.length < 5) {
    return show(tabId, { kind: 'error', label: 'NOT CHECKED', title: 'No payment text found.', note: 'Select the payment request text on the page, then run the check again.', source: picked?.source || '', excerpt: '' });
  }
  const base = await apiBase();
  const excerpt = picked.text.length > 90 ? picked.text.slice(0, 90) + '...' : picked.text;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45000);
    const res = await fetch(`${base}/api/payments/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: picked.text }), signal: ctl.signal });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.review) throw new Error(data.error || `Server answered ${res.status}`);
    const r = data.review;
    const blocked = Boolean(r.blocked);
    const enabled = !blocked && Boolean(r.canPay);
    await show(tabId, {
      kind: blocked ? 'blocked' : enabled ? 'enabled' : 'unclear',
      label: blocked ? 'BLOCKED' : enabled ? 'CHECKOUT ENABLED' : 'NOT CLEARED',
      title: blocked ? 'Strong scam signals. Do not pay.' : enabled ? 'No strong scam signal found.' : (r.checkoutProblem || 'ScamShield could not clear this request.'),
      score: r.riskScore,
      reason: data.verdict?.reason || '',
      advice: blocked ? r.advice : '',
      note: 'Seller identity is NOT verified. This check cannot prove a request is genuine or fake. If money is involved, confirm with the sender by another channel.',
      source: picked.source === 'selection' ? 'your selected text' : 'the first 1000 characters of the page',
      excerpt,
      openUrl: base + '/pay'
    });
  } catch (e) {
    await show(tabId, { kind: 'error', label: 'NOT CHECKED', title: 'ScamShield could not be reached.', note: String(e.name === 'AbortError' ? 'The server took too long (it may be waking up). Try again in a minute.' : e.message || e).slice(0, 200), source: '', excerpt: '' });
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => { if (info.menuItemId === MENU_ID && tab?.id != null) runCheck(tab.id); });
chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg?.type === 'check' && typeof msg.tabId === 'number') { runCheck(msg.tabId).then(() => send({ ok: true })); return true; }
});
