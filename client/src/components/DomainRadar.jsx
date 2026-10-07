import { useMemo } from 'react';

const BRAND_DOMAINS = [
  { stem: 'paypal', official: 'paypal.com', name: 'PayPal' },
  { stem: 'sbi', official: 'onlinesbi.sbi', name: 'State Bank of India' },
  { stem: 'hdfc', official: 'hdfcbank.com', name: 'HDFC Bank' },
  { stem: 'icici', official: 'icicibank.com', name: 'ICICI Bank' },
  { stem: 'paytm', official: 'paytm.com', name: 'Paytm' },
  { stem: 'phonepe', official: 'phonepe.com', name: 'PhonePe' },
  { stem: 'google', official: 'pay.google.com', name: 'Google Pay' }
];

const RISKY_TLDS = ['.xyz', '.top', '.online', '.site', '.vip', '.icu', '.tk', '.ml', '.cf', '.gq', '.live', '.info', '.co'];

export default function DomainRadar({ text }) {
  const analysis = useMemo(() => {
    if (!text || typeof text !== 'string') return null;

    // Extract links or domain candidates
    const urlMatches = text.match(/(?:https?:\/\/)?([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/gi) || [];
    if (!urlMatches.length) return null;

    const domainRaw = urlMatches[0].replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
    if (!domainRaw || domainRaw.length < 4 || !domainRaw.includes('.')) return null;

    // Check risky TLD
    const hasRiskyTld = RISKY_TLDS.some(tld => domainRaw.endsWith(tld));
    const matchedTld = RISKY_TLDS.find(tld => domainRaw.endsWith(tld)) || '';

    // Check brand lookalike
    let matchedBrand = null;
    let isTyposquat = false;
    let substitutedChar = null;

    for (const b of BRAND_DOMAINS) {
      if (domainRaw.includes(b.stem) && domainRaw !== b.official && !domainRaw.endsWith(`.${b.official}`)) {
        matchedBrand = b;
        isTyposquat = true;
        break;
      }
      // Check character substitution e.g. paypa1 -> paypal
      if (b.stem === 'paypal' && (domainRaw.includes('paypa1') || domainRaw.includes('pay-pal') || domainRaw.includes('paypai'))) {
        matchedBrand = b;
        isTyposquat = true;
        substitutedChar = domainRaw.includes('paypa1') ? '1 for l' : domainRaw.includes('paypai') ? 'i for l' : 'hyphen injection';
        break;
      }
      if (b.stem === 'sbi' && (domainRaw.includes('sbi-') || domainRaw.includes('sbi_') || domainRaw.includes('sbikyc'))) {
        matchedBrand = b;
        isTyposquat = true;
        substitutedChar = 'prefix spoofing';
        break;
      }
    }

    if (!matchedBrand && !hasRiskyTld) return null;

    return {
      domain: domainRaw,
      hasRiskyTld,
      matchedTld,
      matchedBrand,
      isTyposquat,
      substitutedChar
    };
  }, [text]);

  if (!analysis) return null;

  return (
    <div
      style={{
        marginTop: 14,
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(15, 23, 42, 0.6))',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        borderRadius: 18,
        padding: '18px 20px',
        color: '#fff'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🌐</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Domain Typosquatting & Look-Alike Radar
          </span>
        </div>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: 999,
            background: 'rgba(239, 68, 68, 0.25)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            color: '#f87171',
            fontSize: 11,
            fontWeight: 800
          }}
        >
          LOOKALIKE DETECTED
        </span>
      </div>

      {/* Side by side comparison */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 14
        }}
      >
        {/* Genuine Brand */}
        {analysis.matchedBrand && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 14,
              padding: 14
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ color: '#34d399', fontSize: 12 }}>✓</span>
              <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#86efac', fontWeight: 700 }}>
                Official {analysis.matchedBrand.name} Domain
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>
              https://{analysis.matchedBrand.official}
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', marginTop: 4, display: 'block' }}>
              Authentic TLS encrypted corporate portal
            </span>
          </div>
        )}

        {/* Suspicious Impersonator */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 14,
            padding: 14
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ color: '#f87171', fontSize: 12 }}>✕</span>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#fca5a5', fontWeight: 700 }}>
              Suspicious Link in Message
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f87171', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {analysis.domain}
          </div>
          <span style={{ fontSize: 11, color: '#fca5a5', marginTop: 4, display: 'block' }}>
            {analysis.substitutedChar ? `Typosquatting trick: substituted ${analysis.substitutedChar}` : 'Lookalike domain registered to deceive users'}
          </span>
        </div>
      </div>

      {analysis.hasRiskyTld && (
        <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fbbf24' }}>⚠️</span>
          <span>
            <b>Risky TLD Indicator:</b> The domain uses <code style={{ color: '#fbbf24', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4 }}>{analysis.matchedTld}</code> which has a disproportionately high incidence of phishing and abuse.
          </span>
        </div>
      )}
    </div>
  );
}
