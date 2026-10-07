import { useState, useMemo } from 'react';

export default function CybercrimeDraft({ result, sourceText, language = 'en' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const verdict = result?.verdict || {};
  const review = result?.review || {};
  const payee = review?.request?.payee || review?.payee || '';
  const amount = review?.request?.amount || review?.amount || '';
  const currency = review?.request?.currency || review?.currency || 'INR';

  // Extract any URL from text
  const link = useMemo(() => {
    const text = String(sourceText || '');
    const m = text.match(/https?:\/\/[^\s]+/i);
    return m ? m[0] : '';
  }, [sourceText]);

  // Extract phone number from text
  const phone = useMemo(() => {
    const text = String(sourceText || '');
    const m = text.match(/(?:\+91[\-\s]?)?[6789]\d{9}\b/);
    return m ? m[0] : '';
  }, [sourceText]);

  const draftText = useMemo(() => {
    const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const category = verdict.categoryLabel || verdict.category || 'Digital Financial Fraud / Online Scam';
    const signals = Array.isArray(verdict.signals)
      ? verdict.signals.map(s => `- ${s.evidence || s.type}`).join('\n')
      : '- Suspicious payment / credential harvesting pattern detected';

    return `=======================================================
INCIDENT REPORT - NATIONAL CYBER CRIME REPORTING PORTAL
Helpline: 1930 | Portal: https://cybercrime.gov.in
=======================================================
1. Incident Timestamp: ${time} IST
2. Fraud Classification: ${category}
3. Suspect Identifiers:
   - Suspect UPI / Payee: ${payee || 'Not specified in message'}
   - Suspect Contact Number: ${phone || 'Not specified'}
   - Phishing URL / Domain: ${link || 'None'}
   - Financial Demand: ${amount ? `${amount} ${currency}` : 'Direct credential / OTP theft'}

4. Exact Message / Communication Received:
"${(sourceText || '').trim()}"

5. Automated Forensic Evidence (ScamShield Analysis):
   - Risk Evaluation: ${verdict.label || verdict.riskLevel || 'HIGH_RISK'} (Risk Score: ${review.riskScore ?? 85}/100)
   - Specific Flags:
${signals}

6. Action Taken by Payer:
   - Transaction aborted on ScamShield Zero-Trust Gateway.
   - Reporting to 1930 helpline & cybercrime.gov.in for domain takedown / suspect VPA freezing.
=======================================================`;
  }, [verdict, review, payee, phone, link, amount, currency, sourceText]);

  const copyDraft = () => {
    navigator.clipboard?.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#fca5a5',
          borderRadius: 999,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <span>📝</span>
        <span>{language === 'hi' ? '1930 साइबर अपराध रिपोर्ट तैयार करें' : 'Generate 1930 Cybercrime Draft'}</span>
        <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 12,
            background: '#070b14',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 18,
            padding: 20,
            color: '#fff',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: '#fca5a5' }}>
                National Cyber Crime Portal (1930) Complaint Draft
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
                Official format for reporting online financial fraud to Indian authorities.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={copyDraft}
                style={{
                  background: copied ? '#10b981' : '#e11d48',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
              >
                {copied ? '✓ Draft Copied!' : '📋 Copy Complaint Draft'}
              </button>
            </div>
          </div>

          {/* Formatted Draft Box */}
          <textarea
            readOnly
            value={draftText}
            rows={10}
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 12,
              padding: 14,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 12,
              color: '#e2e8f0',
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none'
            }}
          />

          {/* Quick Action Links */}
          <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
            <a
              href="https://cybercrime.gov.in"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: '#60a5fa',
                textDecoration: 'underline',
                fontWeight: 600
              }}
            >
              <span>🌐 Open cybercrime.gov.in Portal &rarr;</span>
            </a>

            <a
              href="tel:1930"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: '#34d399',
                textDecoration: 'none',
                fontWeight: 700,
                background: 'rgba(52, 211, 153, 0.12)',
                padding: '4px 12px',
                borderRadius: 999,
                border: '1px solid rgba(52, 211, 153, 0.3)'
              }}
            >
              <span>📞 Helpline: 1930 (Free Call)</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
