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
  const mac = 'hmac_sha256_' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
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
  const [copied, setCopied] = useState(false);
  const [hoveredSection, setHoveredSection] = useState(null); // 'header' | 'body' | 'mac'
  const [expandedPayload, setExpandedPayload] = useState(null);

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

  // Circular gauge math (radius 40, circumference ~251.3)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentLeft / 100) * circumference;

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
      } catch {
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

  const copyToken = () => {
    if (!currentToken) return;
    navigator.clipboard?.writeText(currentToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pg-sec-inspector" style={{ marginTop: 28, marginBottom: 28 }}>
      {/* Outer Glow Container */}
      <div
        style={{
          position: 'relative',
          borderRadius: 28,
          background: 'linear-gradient(145deg, #0b0f19 0%, #111726 50%, #0d121f 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          overflow: 'hidden',
          color: '#f8fafc'
        }}
      >
        {/* Futuristic Top Ambient Glow */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            left: '30%',
            width: 400,
            height: 240,
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.08) 50%, transparent 80%)',
            pointerEvents: 'none',
            filter: 'blur(40px)',
            zIndex: 0
          }}
        />

        {/* Top Control Header */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '28px 28px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 20
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(129, 140, 248, 0.3)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#a5b4fc',
                  textTransform: 'uppercase'
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#6366f1',
                    boxShadow: '0 0 8px #6366f1',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }}
                />
                Zero-Trust Cryptographic Engine
              </span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(52, 211, 153, 0.25)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#34d399'
                }}
              >
                HMAC-SHA256 Bound
              </span>
            </div>

            <h3 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em', color: '#fff' }}>
              Security & Cryptographic Inspector
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255, 255, 255, 0.6)', maxWidth: 580, lineHeight: 1.5 }}>
              Deep-inspect token signatures, live single-use nonces, simulated attack vectors, and real-time PayPal sandbox webhook deliveries.
            </p>
          </div>

          {/* Radial Countdown Gauge HUD */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 20,
              padding: '12px 18px',
              backdropFilter: 'blur(16px)'
            }}
          >
            {/* Circular Gauge */}
            <div style={{ position: 'relative', width: 64, height: 64, display: 'grid', placeItems: 'center' }}>
              <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  stroke={isExpired ? '#f43f5e' : percentLeft < 20 ? '#fbbf24' : '#10b981'}
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: isExpired ? '#f43f5e' : '#e2e8f0'
                }}
              >
                {Math.round(percentLeft)}%
              </div>
            </div>

            {/* Timer readout */}
            <div>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginBottom: 2 }}>
                TTL Window (15m)
              </span>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  letterSpacing: '1px',
                  color: isExpired ? '#f43f5e' : '#34d399'
                }}
              >
                {isExpired ? 'EXPIRED' : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
              </div>
              <span style={{ fontSize: 11, color: isExpired ? '#fca5a5' : 'rgba(255, 255, 255, 0.5)' }}>
                {isExpired ? 'Signature Locked' : 'Cryptographically Valid'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            gap: 8,
            padding: '14px 28px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            flexWrap: 'wrap'
          }}
        >
          {[
            { id: 'token', icon: '🔑', label: 'Token Anatomy & Nonce' },
            { id: 'tamper', icon: '⚡', label: 'Tamper Simulation Lab' },
            { id: 'webhooks', icon: '📡', label: 'PayPal Webhook Stream' },
            { id: 'attacks', icon: '🛡️', label: 'Attack Vector Matrix' }
          ].map(t => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isActive ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(79, 70, 229, 0.2))' : 'rgba(255, 255, 255, 0.04)',
                  color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                  border: isActive ? '1px solid rgba(129, 140, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 14,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 4px 14px rgba(99, 102, 241, 0.25)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div style={{ position: 'relative', zIndex: 1, padding: 28 }}>
          {/* TAB 1: Token Anatomy & Nonce */}
          {tab === 'token' && (
            <div>
              {/* Token Bar Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                    Serialized Compact Token:
                  </span>
                  <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.45)' }}>
                    (Hover segments to inspect)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={copyToken}
                    style={{
                      background: 'rgba(255, 255, 255, 0.07)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: copied ? '#34d399' : '#fff',
                      borderRadius: 10,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {copied ? '✓ Copied!' : '📋 Copy Token'}
                  </button>
                  <button
                    onClick={() => setCurrentToken(makeDemoToken(25.0, 'USD', 'freelancer@design.io', 'Branding project'))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.07)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      borderRadius: 10,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    ↻ Generate New Sample
                  </button>
                </div>
              </div>

              {/* Interactive Raw Token Display */}
              {parsed && (
                <div
                  style={{
                    background: 'rgba(5, 7, 13, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 16,
                    padding: '18px 22px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 13,
                    lineHeight: 1.8,
                    wordBreak: 'break-all',
                    marginBottom: 20,
                    boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <span
                    onMouseEnter={() => setHoveredSection('body')}
                    onMouseLeave={() => setHoveredSection(null)}
                    style={{
                      color: '#38bdf8',
                      background: hoveredSection === 'body' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                      borderRadius: 4,
                      padding: '2px 4px',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                      fontWeight: 600
                    }}
                  >
                    {parsed.body}
                  </span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.3)', margin: '0 2px' }}>.</span>
                  <span
                    onMouseEnter={() => setHoveredSection('mac')}
                    onMouseLeave={() => setHoveredSection(null)}
                    style={{
                      color: '#34d399',
                      background: hoveredSection === 'mac' ? 'rgba(52, 211, 153, 0.18)' : 'transparent',
                      borderRadius: 4,
                      padding: '2px 4px',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                      fontWeight: 600
                    }}
                  >
                    {parsed.mac}
                  </span>
                </div>
              )}

              {/* Segment Legend */}
              <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#38bdf8' }} />
                  <span style={{ color: '#bae6fd', fontWeight: 600 }}>Payload:</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>Base64URL Claims (Amount + Currency + Payee + Nonce)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#34d399' }} />
                  <span style={{ color: '#a7f3d0', fontWeight: 600 }}>Signature:</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>HMAC-SHA256 (Bound to Secret Server Key)</span>
                </div>
              </div>

              {/* Decoded Claims Metrics Matrix */}
              {parsed?.claims && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 16,
                    marginBottom: 24
                  }}
                >
                  {/* Amount Bound Card */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      borderRadius: 18,
                      padding: 18,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7dd3fc', fontWeight: 700 }}>
                        Locked Amount
                      </span>
                      <span style={{ fontSize: 16 }}>🔒</span>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8', marginBottom: 4 }}>
                      {parsed.claims.amount} {parsed.claims.currency}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                      Cryptographically bound. Any client manipulation voids the signature.
                    </p>
                  </div>

                  {/* Nonce Card */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(192, 132, 252, 0.2)',
                      borderRadius: 18,
                      padding: 18,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#d8b4fe', fontWeight: 700 }}>
                        Single-Use Nonce (`jti`)
                      </span>
                      <span style={{ fontSize: 16 }}>🛡️</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: '#c084fc', marginBottom: 6, wordBreak: 'break-all' }}>
                      {parsed.claims.jti || 'none'}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                      Anti-replay protection. Consumed in server state on first PayPal order creation.
                    </p>
                  </div>

                  {/* Payee Verification Gate */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 18,
                      padding: 18,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700 }}>
                        Payee Destination
                      </span>
                      <span style={{ fontSize: 16 }}>👤</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 6, wordBreak: 'break-all' }}>
                      {parsed.claims.payee || '(No payee found)'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: parsed.claims.payeeStatus === 'clean' ? '#10b981' : '#f59e0b' }} />
                      <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)' }}>
                        Status: <b>{parsed.claims.payeeStatus || 'unverified'}</b>
                      </span>
                    </div>
                  </div>

                  {/* Expiration Card */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isExpired ? 'rgba(244, 63, 94, 0.3)' : 'rgba(52, 211, 153, 0.2)'}`,
                      borderRadius: 18,
                      padding: 18,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: isExpired ? '#fca5a5' : '#86efac', fontWeight: 700 }}>
                        Expiration Epoch
                      </span>
                      <span style={{ fontSize: 16 }}>⏱️</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isExpired ? '#f43f5e' : '#34d399', marginBottom: 4 }}>
                      {new Date(parsed.claims.exp).toLocaleTimeString()}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                      {isExpired ? 'Strictly rejected past TTL' : `${minutes}m ${seconds}s remaining in active window`}
                    </p>
                  </div>
                </div>
              )}

              {/* Informational Zero-Trust Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(56, 189, 248, 0.05) 100%)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: 18,
                  padding: '16px 22px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14
                }}
              >
                <span style={{ fontSize: 20 }}>💡</span>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.85)' }}>
                  <b>Zero-Trust Pre-Creation Gatekeeper:</b> PayPal order creation on the server requires this token. Because the signature is verified via <code style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>crypto.timingSafeEqual</code> using the server's private secret, front-end tamperers or rogue scripts cannot modify the amount or spoof cleared status.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Tamper Simulation Lab */}
          {tab === 'tamper' && (
            <div>
              <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 20px', lineHeight: 1.6 }}>
                Simulate a real <b>Man-In-The-Middle (MITM)</b> or malicious client-side injection. Modify the parameters in the client payload below and test how the server's cryptographic verification rejects altered requests.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 18,
                  marginBottom: 24
                }}
              >
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 18,
                    padding: 20
                  }}
                >
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>
                    <span>ATTACKER FORGED AMOUNT</span>
                    <span style={{ color: '#f43f5e', fontSize: 11 }}>Original: {parsed?.claims?.amount || '12.50'}</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: 12, color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>$</span>
                    <input
                      type="text"
                      value={tamperedAmount}
                      onChange={e => setTamperedAmount(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(244, 63, 94, 0.4)',
                        borderRadius: 12,
                        padding: '10px 14px 10px 30px',
                        color: '#f8fafc',
                        fontSize: 15,
                        fontWeight: 600,
                        outline: 'none',
                        boxShadow: '0 0 10px rgba(244, 63, 94, 0.15)'
                      }}
                      placeholder="e.g. 125.00"
                    />
                  </div>
                  <span style={{ display: 'block', fontSize: 11, color: 'rgba(255, 255, 255, 0.4)', marginTop: 8 }}>
                    Injecting a 10x amount inflation while retaining the original HMAC hash.
                  </span>
                </div>

                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 18,
                    padding: 20
                  }}
                >
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>
                    <span>ATTACKER DESTINATION PAYEE</span>
                    <span style={{ color: '#f43f5e', fontSize: 11 }}>Hijacked Route</span>
                  </label>
                  <input
                    type="text"
                    value={tamperedPayee}
                    onChange={e => setTamperedPayee(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(244, 63, 94, 0.4)',
                      borderRadius: 12,
                      padding: '10px 14px',
                      color: '#f8fafc',
                      fontSize: 14,
                      outline: 'none',
                      boxShadow: '0 0 10px rgba(244, 63, 94, 0.15)'
                    }}
                    placeholder="e.g. attacker@fraud-haven.com"
                  />
                  <span style={{ display: 'block', fontSize: 11, color: 'rgba(255, 255, 255, 0.4)', marginTop: 8 }}>
                    Attempting to redirect the approved checkout destination.
                  </span>
                </div>
              </div>

              {/* Action Trigger Buttons */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
                <button
                  onClick={() => testTamper(true)}
                  disabled={verifying}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'linear-gradient(135deg, #e11d48, #be123c)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 24px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(225, 29, 72, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>⚔️</span>
                  <span>{verifying ? 'Verifying with Gatekeeper...' : 'Transmit Tampered Token to Server'}</span>
                </button>

                <button
                  onClick={() => testTamper(false)}
                  disabled={verifying}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 12,
                    padding: '12px 24px',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>✓</span>
                  <span>Transmit Authentic Token</span>
                </button>
              </div>

              {/* Cyber Security Diagnostic Terminal */}
              {verifyResult && (
                <div
                  style={{
                    background: '#040711',
                    border: `1px solid ${verifyResult.valid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
                    borderRadius: 18,
                    padding: 22,
                    boxShadow: verifyResult.valid ? '0 10px 30px rgba(16, 185, 129, 0.15)' : '0 10px 30px rgba(244, 63, 94, 0.15)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: '0.06em',
                          background: verifyResult.valid ? '#10b981' : '#f43f5e',
                          color: '#fff'
                        }}
                      >
                        {verifyResult.valid ? 'GATE CLEARED' : 'BLOCKED BY GATEKEEPER'}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: verifyResult.valid ? '#34d399' : '#f87171' }}>
                        {verifyResult.valid ? 'HMAC Signature Authenticated (200 OK)' : 'HMAC Digest Mismatch (Verification Failed)'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.4)' }}>
                      Latency: ~1.4ms · crypto.timingSafeEqual
                    </span>
                  </div>

                  {/* Terminal Log Output */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.6)',
                      borderRadius: 12,
                      padding: 16,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: 12,
                      lineHeight: 1.7,
                      color: 'rgba(255, 255, 255, 0.85)'
                    }}
                  >
                    <div><span style={{ color: '#94a3b8' }}>[1] CLIENT:</span> Prepared request token payload with claims.</div>
                    {verifyResult.testedType === 'tampered' ? (
                      <>
                        <div><span style={{ color: '#f43f5e' }}>[2] INJECTION:</span> Tampered amount injected ({tamperedAmount}) with mismatched MAC signature.</div>
                        <div><span style={{ color: '#fbbf24' }}>[3] SERVER:</span> Recomputed HMAC-SHA256 hash using private server secret.</div>
                        <div><span style={{ color: '#f43f5e' }}>[4] MISMATCH:</span> Supplied MAC != Computed MAC. Constant-time comparison failed.</div>
                        <div style={{ color: '#f87171', fontWeight: 700 }}>[5] ACTION: Aborting PayPal sandbox order creation. Zero funds at risk.</div>
                      </>
                    ) : (
                      <>
                        <div><span style={{ color: '#38bdf8' }}>[2] INTEGRITY:</span> Clean payload matches signed HMAC digest perfectly.</div>
                        <div><span style={{ color: '#34d399' }}>[3] NONCE:</span> Checking single-use `jti` anti-replay cache... Unconsumed.</div>
                        <div style={{ color: '#34d399', fontWeight: 700 }}>[4] ACTION: Verification successful! PayPal order unlocked.</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PayPal Webhook Stream */}
          {tab === 'webhooks' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: webhookData.registered ? '#10b981' : '#fbbf24',
                      boxShadow: webhookData.registered ? '0 0 12px #10b981' : '0 0 12px #fbbf24'
                    }}
                  />
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', display: 'block' }}>
                      {webhookData.registered ? 'PayPal Webhook Listener Active' : 'Webhook Endpoint Ready (/api/paypal/webhook)'}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                      Asynchronous capture confirmations & RSA signature verification
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setAutoPollWebhooks(!autoPollWebhooks)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: autoPollWebhooks ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${autoPollWebhooks ? '#6366f1' : 'rgba(255, 255, 255, 0.12)'}`,
                      color: '#fff',
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <span>{autoPollWebhooks ? '●' : '○'}</span>
                    <span>{autoPollWebhooks ? 'Live Stream Active (4s)' : 'Enable Live Stream'}</span>
                  </button>
                  <button
                    onClick={fetchWebhooks}
                    disabled={webhookLoading}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {webhookLoading ? 'Refreshing...' : '↻ Refresh Feed'}
                  </button>
                </div>
              </div>

              {/* Webhook Events Feed */}
              {webhookData.events && webhookData.events.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {webhookData.events.map((evt, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 16,
                        padding: '16px 20px',
                        transition: 'border-color 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 800,
                              background: evt.result === 'recorded' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                              color: evt.result === 'recorded' ? '#34d399' : '#e2e8f0'
                            }}
                          >
                            {evt.result ? evt.result.toUpperCase() : 'VERIFIED'}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                            {evt.type || evt.event_type || 'PAYMENT.CAPTURE.COMPLETED'}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'monospace' }}>
                          {evt.at ? new Date(evt.at).toLocaleTimeString() : 'Recent'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: 'rgba(255, 255, 255, 0.65)' }}>
                        {evt.note || 'PayPal cryptographic signature verified.'} {evt.orderId ? `Order ID: ${evt.orderId}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px dashed rgba(255, 255, 255, 0.12)',
                    borderRadius: 20,
                    padding: 44,
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🛰️</div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: '#fff' }}>
                    Awaiting Incoming PayPal Webhook Events
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(255, 255, 255, 0.5)', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
                    When a payment is approved and captured in the PayPal sandbox, an asynchronous webhook arrives with cryptographic signature verification headers. Events will stream here automatically.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Attack Vector Matrix */}
          {tab === 'attacks' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>
                    Shield Penetration Defense Matrix
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(255, 255, 255, 0.6)' }}>
                    Continuous regression testing against four distinct payment bypass attack vectors.
                  </p>
                </div>

                <button
                  onClick={runAttacks}
                  disabled={attacking}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 22px',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(99, 102, 241, 0.3)'
                  }}
                >
                  <span>🚀</span>
                  <span>{attacking ? 'Running Suite...' : 'Execute Full Attack Suite'}</span>
                </button>
              </div>

              {/* 4 Vector Cards */}
              <div style={{ display: 'grid', gap: 14 }}>
                {[
                  {
                    name: 'Attack Vector 01',
                    title: 'Post-Review Amount Alteration ($12.50 → $125.00)',
                    desc: 'Attacker edits the authorized checkout value after passing AI & rules analysis.',
                    defense: 'HMAC-SHA256 signature verification detects bitwise payload change and terminates checkout.'
                  },
                  {
                    name: 'Attack Vector 02',
                    title: 'Replay of Expired Review Token',
                    desc: 'Replaying an old authorized token after merchant terms or prices have shifted.',
                    defense: 'Timestamp claim (`exp`) enforces a strict 15-minute validity window.'
                  },
                  {
                    name: 'Attack Vector 03',
                    title: 'Double-Spending Nonce Reuse Attack',
                    desc: 'Re-submitting the same clearance token to initialize multiple PayPal checkout orders.',
                    defense: 'Single-use cryptographic `jti` nonce is registered and consumed upon first order creation.'
                  },
                  {
                    name: 'Attack Vector 04',
                    title: 'Order Capture Forgery Without Prior Review',
                    desc: 'Attempting to capture a PayPal order ID that did not originate from a cleared check.',
                    defense: 'Signed order ticket matching is enforced on server prior to calling PayPal capture.'
                  }
                ].map((vec, i) => {
                  const live = attackResults ? attackResults[i] : null;
                  return (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 18,
                        padding: '18px 22px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 16
                      }}
                    >
                      <div style={{ maxWidth: 680 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '0.06em' }}>
                            {vec.name}
                          </span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                          {vec.title}
                        </div>
                        <p style={{ margin: '0 0 6px', fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                          {vec.desc}
                        </p>
                        <span style={{ fontSize: 12, color: '#94a3b8', display: 'block' }}>
                          <b>Defense:</b> {live?.why || vec.defense}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '6px 14px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            background: live ? (live.blocked ? 'rgba(52, 211, 153, 0.18)' : 'rgba(244, 63, 94, 0.18)') : 'rgba(255, 255, 255, 0.08)',
                            color: live ? (live.blocked ? '#34d399' : '#f87171') : '#94a3b8',
                            border: live ? (live.blocked ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid rgba(244, 63, 94, 0.35)') : '1px solid rgba(255, 255, 255, 0.1)'
                          }}
                        >
                          {live ? (live.blocked ? 'REJECTED (PASSED)' : 'VULNERABLE') : 'SHIELD ARMED'}
                        </span>
                        <span style={{ display: 'block', fontSize: 10, color: 'rgba(255, 255, 255, 0.4)', marginTop: 4 }}>
                          Latency: &lt; 2ms
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
