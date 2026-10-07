import { useState, useEffect, useMemo, useRef } from 'react';

// Sample pre-signed demo tokens for instant exploration if user hasn't run a scan yet
function makeDemoToken(amount = 12.5, currency = 'USD', payee = 'seller.demo@example.com', purpose = 'Website design fee') {
  const exp = Date.now() + 15 * 60 * 1000;
  const payload = {
    amount,
    currency,
    payee,
    payeeStatus: 'clean',
    purpose,
    risk: 'LOW_RISK',
    jti: Math.random().toString(16).slice(2, 14) + Math.random().toString(16).slice(2, 14),
    exp
  };
  const bodyBase64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // Simulated demo HMAC MAC for display
  const mac = 'hmac_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${bodyBase64}.${mac}`;
}

function parseToken(raw) {
  if (!raw || typeof raw !== 'string' || !raw.includes('.')) return null;
  const parts = raw.split('.');
  if (parts.length < 2) return null;
  const body = parts[0];
  const mac = parts[1];
  try {
    const pad = body.length % 4 === 0 ? '' : '='.repeat(4 - (body.length % 4));
    const b64 = (body + pad).replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(b64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const claims = JSON.parse(jsonStr);
    return {
      raw,
      header: { alg: 'HS256', typ: 'JWT' },
      body,
      mac,
      claims
    };
  } catch {
    return null;
  }
}

export default function SecurityInspector({ token: activeToken, review, paid, language = 'en' }) {
  const [tab, setTab] = useState('token'); // 'token' | 'tamper' | 'webhooks' | 'attacks'
  const [currentToken, setCurrentToken] = useState(() => activeToken || makeDemoToken());
  const [tamperedAmount, setTamperedAmount] = useState('125.00');
  const [tamperedPayee, setTamperedPayee] = useState('attacker@scam-destination.com');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  // Webhook Stream State
  const [webhookData, setWebhookData] = useState({ registered: false, events: [], error: '' });
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [autoPollWebhooks, setAutoPollWebhooks] = useState(false);

  // Attack Demo State
  const [attackResults, setAttackResults] = useState(null);
  const [attacking, setAttacking] = useState(false);

  // Sync when activeToken changes from parent scan
  useEffect(() => {
    if (activeToken) {
      setCurrentToken(activeToken);
    }
  }, [activeToken]);

  const parsed = useMemo(() => parseToken(currentToken), [currentToken]);

  // Live 15-Minute Countdown Timer
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!parsed?.claims?.exp) return 900;
    return Math.max(0, Math.floor((parsed.claims.exp - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!parsed?.claims?.exp) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((parsed.claims.exp - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [parsed?.claims?.exp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isExpired = timeLeft <= 0;
  const percentLeft = Math.min(100, Math.max(0, (timeLeft / (15 * 60)) * 100));

  // Webhook polling
  const fetchWebhooks = async () => {
    setWebhookLoading(true);
    try {
      const res = await fetch('/api/paypal/webhook-events');
      if (res.ok) {
        const data = await res.json();
        setWebhookData(data);
      }
    } catch {
      // fallback
    } finally {
      setWebhookLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'webhooks') {
      fetchWebhooks();
    }
  }, [tab]);

  useEffect(() => {
    if (!autoPollWebhooks || tab !== 'webhooks') return;
    const interval = setInterval(fetchWebhooks, 4000);
    return () => clearInterval(interval);
  }, [autoPollWebhooks, tab]);

  // Tamper Test Function
  const testTamper = async (isTampered = true) => {
    if (!parsed) return;
    setVerifying(true);
    setVerifyResult(null);

    let tokenToTest = currentToken;
    if (isTampered) {
      try {
        const edited = { ...parsed.claims };
        if (tamperedAmount) edited.amount = Number(tamperedAmount);
        if (tamperedPayee) edited.payee = tamperedPayee;
        const editedBody = btoa(JSON.stringify(edited)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        tokenToTest = `${editedBody}.${parsed.mac}`;
      } catch (e) {
        setVerifyResult({ valid: false, error: 'Could not construct tampered token payload' });
        setVerifying(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/payments/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToTest })
      });
      const data = await res.json();
      setVerifyResult({
        ...data,
        testedToken: tokenToTest,
        testedType: isTampered ? 'tampered' : 'authentic'
      });
    } catch (err) {
      setVerifyResult({ valid: false, error: err.message || 'Verification call failed' });
    } finally {
      setVerifying(false);
    }
  };

  // Run Penetration Tests
  const runAttacks = async () => {
    setAttacking(true);
    try {
      const res = await fetch('/api/payments/attack-demo');
      const data = await res.json();
      setAttackResults(data.results || []);
    } catch {
      setAttackResults([]);
    } finally {
      setAttacking(false);
    }
  };

  return (
    <div className="pg-sec-inspector" style={{ marginTop: 24, marginBottom: 24 }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.95), rgba(13, 16, 28, 0.98))',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 24,
          padding: '28px 24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
          color: '#fff'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'rgba(99, 102, 241, 0.18)', border: '1px solid rgba(129, 140, 248, 0.35)', borderRadius: 999, fontSize: 12, fontWeight: 600, color: '#a5b4fc', marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', display: 'inline-block', boxShadow: '0 0 10px #6366f1' }} />
              ZERO-TRUST CRYPTOGRAPHIC ENGINE
            </div>
            <h3 style={{ fontSize: 26, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              Security & Webhook Inspector
            </h3>
            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)', fontSize: 14, maxWidth: 640, lineHeight: 1.5 }}>
              Explore the HMAC-SHA256 token anatomy, single-use anti-replay nonce, live 15-minute countdown expiration, and real-time PayPal sandbox webhook captures.
            </p>
          </div>

          {/* 15-min countdown widget */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${isExpired ? 'rgba(244, 63, 94, 0.4)' : 'rgba(52, 211, 153, 0.35)'}`,
              borderRadius: 18,
              padding: '12px 20px',
              minWidth: 180,
              textAlign: 'center',
              backdropFilter: 'blur(10px)'
            }}
          >
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.55)', display: 'block', marginBottom: 4 }}>
              15-Min TTL Timer
            </span>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: isExpired ? '#f43f5e' : '#34d399', letterSpacing: '1px' }}>
              {isExpired ? 'EXPIRED' : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
            </div>
            <div style={{ width: '100%', height: 4, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${percentLeft}%`,
                  height: '100%',
                  background: isExpired ? '#f43f5e' : percentLeft < 20 ? '#fbbf24' : '#34d399',
                  transition: 'width 1s linear'
                }}
              />
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: 8, marginTop: 24, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 14, flexWrap: 'wrap' }}>
          {[
            { id: 'token', label: 'Token Anatomy & Nonce' },
            { id: 'tamper', label: 'Tamper Simulation Lab' },
            { id: 'webhooks', label: 'PayPal Webhook Stream' },
            { id: 'attacks', label: 'Attack Vector Benchmarks' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                color: tab === t.id ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                border: tab === t.id ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
                borderRadius: 999,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: Token Anatomy & Nonce */}
        {tab === 'token' && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)' }}>
                Raw Cryptographic Review Token Structure:
              </span>
              <button
                onClick={() => setCurrentToken(makeDemoToken(25.0, 'USD', 'freelancer@design.io', 'Logo sprint'))}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: 99,
                  padding: '4px 12px',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                ↻ Generate Fresh Demo Token
              </button>
            </div>

            {/* Colored Raw Token Breakup */}
            {parsed && (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 14,
                  padding: '14px 18px',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 1.7,
                  wordBreak: 'break-all',
                  marginBottom: 20
                }}
              >
                <span style={{ color: '#f43f5e', fontWeight: 600 }}>{parsed.body}</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>.</span>
                <span style={{ color: '#34d399', fontWeight: 600 }}>{parsed.mac}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f43f5e' }} />
                <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Base64URL Payload (Claims + Nonce + Amount)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#34d399' }} />
                <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>HMAC-SHA256 Signature (Server-Secret Bound)</span>
              </div>
            </div>

            {/* Claims Grid */}
            {parsed?.claims && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                  marginBottom: 20
                }}
              >
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: 14, padding: 14, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginBottom: 4 }}>Bound Amount & Currency</span>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa' }}>
                    {parsed.claims.amount} {parsed.claims.currency}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.4)' }}>Locked to prevents amount inflation</span>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: 14, padding: 14, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginBottom: 4 }}>Single-Use Nonce (`jti`)</span>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: '#c084fc', wordBreak: 'break-all' }}>
                    {parsed.claims.jti || 'none'}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.4)' }}>Consumed on order creation (anti-replay)</span>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: 14, padding: 14, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginBottom: 4 }}>Payee Named in Request</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f3f4f6' }}>
                    {parsed.claims.payee || '(None specified)'}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.4)' }}>Status: {parsed.claims.payeeStatus || 'unverified'}</span>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: 14, padding: 14, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginBottom: 4 }}>Expiration Timestamp</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isExpired ? '#f43f5e' : '#34d399' }}>
                    {new Date(parsed.claims.exp).toLocaleTimeString()}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.4)' }}>{isExpired ? 'Token Expired' : `${minutes}m ${seconds}s remaining`}</span>
                </div>
              </div>
            )}

            <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 14, padding: '14px 18px', fontSize: 13, color: 'rgba(255, 255, 255, 0.8)' }}>
              <b>How this protects the buyer:</b> Without this signed token, PayPal checkout cannot open on the server. If an attacker tampers with even a single bit of the amount or payee in the browser or network, the cryptographic HMAC signature will fail verification and checkout is immediately aborted.
            </div>
          </div>
        )}

        {/* TAB 2: Tamper Simulation Lab */}
        {tab === 'tamper' && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Try acting as an attacker! Modify the payment parameters in the client payload below and see how the cryptographic gatekeeper server reacts when validating the HMAC signature.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 6 }}>
                  Tampered Amount (Original: {parsed?.claims?.amount || '12.50'})
                </label>
                <input
                  type="text"
                  value={tamperedAmount}
                  onChange={e => setTamperedAmount(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: 14
                  }}
                  placeholder="e.g. 125.00"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 6 }}>
                  Tampered Payee Destination
                </label>
                <input
                  type="text"
                  value={tamperedPayee}
                  onChange={e => setTamperedPayee(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: 14
                  }}
                  placeholder="e.g. attacker@scam.com"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <button
                onClick={() => testTamper(true)}
                disabled={verifying}
                style={{
                  background: '#f43f5e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 99,
                  padding: '10px 22px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                {verifying ? 'Simulating Tamper...' : '⚔️ Test Tampered Token Against Server'}
              </button>
              <button
                onClick={() => testTamper(false)}
                disabled={verifying}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: 99,
                  padding: '10px 22px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                ✓ Test Authentic Untampered Token
              </button>
            </div>

            {/* Test Results Banner */}
            {verifyResult && (
              <div
                style={{
                  background: verifyResult.valid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  border: `1px solid ${verifyResult.valid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
                  borderRadius: 16,
                  padding: 18,
                  marginBottom: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 700,
                      background: verifyResult.valid ? '#10b981' : '#f43f5e',
                      color: '#fff'
                    }}
                  >
                    {verifyResult.valid ? 'GATE CLEARED' : 'BLOCKED BY HMAC'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: verifyResult.valid ? '#34d399' : '#fca5a5' }}>
                    {verifyResult.valid ? 'Cryptographic Signature Verified Successfully' : 'HMAC Signature Mismatch Rejected'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.5 }}>
                  {verifyResult.valid
                    ? 'The server verified the HMAC-SHA256 digest using its private server secret. The payload claims are 100% genuine and uncorrupted.'
                    : 'The server detected that the payload was edited after the AI + rules review. The expected HMAC digest differed from the received token. Checkout opening is strictly refused.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PayPal Webhook Stream */}
        {tab === 'webhooks' && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: webhookData.registered ? '#10b981' : '#fbbf24',
                    display: 'inline-block'
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {webhookData.registered ? 'PayPal Sandbox Webhook Active & Verified' : 'Webhook Listening (/api/paypal/webhook)'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setAutoPollWebhooks(!autoPollWebhooks)}
                  style={{
                    background: autoPollWebhooks ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1px solid ${autoPollWebhooks ? '#6366f1' : 'rgba(255, 255, 255, 0.15)'}`,
                    color: '#fff',
                    borderRadius: 99,
                    padding: '6px 14px',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  {autoPollWebhooks ? '● Auto-polling (4s)' : '○ Enable Auto-poll'}
                </button>
                <button
                  onClick={fetchWebhooks}
                  disabled={webhookLoading}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    borderRadius: 99,
                    padding: '6px 14px',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  {webhookLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            {webhookData.events && webhookData.events.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {webhookData.events.map((evt, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 14,
                      padding: '14px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: evt.result === 'recorded' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                            color: evt.result === 'recorded' ? '#34d399' : '#e2e8f0'
                          }}
                        >
                          {evt.result || 'event'}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                          {evt.type || evt.event_type || 'PAYMENT.CAPTURE.COMPLETED'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.55)' }}>
                        {evt.note || 'Verified by PayPal signature check.'} {evt.orderId ? `Order: ${evt.orderId}` : ''}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'monospace' }}>
                      {evt.at ? new Date(evt.at).toLocaleTimeString() : 'Recent'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: 16,
                  padding: 32,
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.6)'
                }}
              >
                <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: '#fff' }}>
                  No Incoming Webhooks Received Yet
                </p>
                <p style={{ margin: 0, fontSize: 13, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
                  When you complete a checkout on the PayPal sandbox button, PayPal dispatches an asynchronous `PAYMENT.CAPTURE.COMPLETED` webhook with cryptographic headers here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Attack Vector Benchmarks */}
        {tab === 'attacks' && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
                Live test suite running 4 real bypass attempts against the ScamShield security gate.
              </p>
              <button
                onClick={runAttacks}
                disabled={attacking}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 99,
                  padding: '8px 20px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                {attacking ? 'Running Attack Suite...' : '🚀 Execute All 4 Penetration Tests'}
              </button>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {[
                {
                  title: 'Vector 1: Change Amount Post-Review ($12.50 -> $125.00)',
                  why: 'The review token is HMAC-signed. Any client-side edit breaks the signature hash.'
                },
                {
                  title: 'Vector 2: Replay Old Expired Review Token',
                  why: 'Tokens strictly expire after 15 minutes (`exp` claim verified by server time).'
                },
                {
                  title: 'Vector 3: Double-Spend / Reuse Nonce for Second Payment',
                  why: 'Single-use nonce `jti` is tracked and consumed in server memory & disk persistence.'
                },
                {
                  title: 'Vector 4: Capture PayPal Order Never Reviewed by AI',
                  why: 'The server verifies signed order tickets and expected order cache before capture.'
                }
              ].map((item, i) => {
                const liveRes = attackResults ? attackResults[i] : null;
                return (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 14,
                      padding: 16
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                        {item.title}
                      </span>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 700,
                          background: liveRes ? (liveRes.blocked ? 'rgba(52, 211, 153, 0.2)' : 'rgba(244, 63, 94, 0.2)') : 'rgba(255, 255, 255, 0.1)',
                          color: liveRes ? (liveRes.blocked ? '#34d399' : '#f43f5e') : 'rgba(255, 255, 255, 0.6)'
                        }}
                      >
                        {liveRes ? (liveRes.blocked ? 'REJECTED (PASSED)' : 'VULNERABLE') : 'SHIELD ARMED'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.55)' }}>
                      {liveRes?.why || item.why}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
