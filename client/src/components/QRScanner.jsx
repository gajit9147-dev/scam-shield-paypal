import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';

const SAMPLE_QRS = [
  {
    label: 'Scam: "Scan QR to Receive Refund"',
    type: 'upi_scam',
    raw: 'upi://pay?pa=refund-claim@fakebank&pn=Fast%20Refund%20Helpdesk&am=4999&tn=Scan%20this%20QR%20and%20enter%20UPI%20PIN%20to%20receive%20Rs%204999%20cashback',
    desc: 'Classic pay-to-receive trick: claims scanning or entering PIN will deposit money.'
  },
  {
    label: 'Scam: Lookalike Phishing Link QR',
    type: 'phishing_link',
    raw: 'https://paypa1-account-verify.co/login?ref=qr_support_alert',
    desc: 'QR pointing to an unofficial PayPal lookalike phishing domain.'
  },
  {
    label: 'Clean: Genuine Cafe Invoice QR',
    type: 'clean_merchant',
    raw: 'upi://pay?pa=bluecafe@okhdfcbank&pn=Blue%20Cafe%20Vadodara&am=12.50&cu=USD&tn=Catering%20order%2088',
    desc: 'Legitimate merchant payment QR request.'
  }
];

function parseUpiUri(uri) {
  if (!uri || typeof uri !== 'string' || !uri.toLowerCase().startsWith('upi://pay')) {
    return null;
  }
  try {
    const query = uri.split('?')[1] || '';
    const params = new URLSearchParams(query);
    return {
      isUpi: true,
      pa: params.get('pa') || '',
      pn: params.get('pn') || '',
      am: params.get('am') || '',
      cu: params.get('cu') || 'INR',
      tn: params.get('tn') || '',
      tr: params.get('tr') || ''
    };
  } catch {
    return null;
  }
}

export default function QRScanner({ onScan, onAnalyzeText }) {
  const [method, setMethod] = useState('camera'); // 'camera' | 'upload'
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  const [decoding, setDecoding] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const fileInputRef = useRef(null);
  const mobileCameraInputRef = useRef(null);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Frame scanning loop for live video
  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        handleQrFound(code.data);
        stopCamera();
        return;
      }
    }
    animFrameRef.current = requestAnimationFrame(tick);
  }, [stopCamera]);

  // Start live viewfinder stream
  const startCamera = async () => {
    setCameraError('');
    setScannedResult(null);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Live video streaming requires HTTPS or localhost in mobile browsers. Use "📸 Take QR Photo" below to capture directly with your phone camera.');
      return;
    }

    try {
      stopCamera();
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        animFrameRef.current = requestAnimationFrame(tick);
      }
    } catch (err) {
      console.error('Camera stream access failed:', err);
      setCameraError('Camera access was blocked or not allowed. Use "📸 Take QR Photo" below to launch your phone camera directly.');
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // QR Found Handler
  const handleQrFound = (data) => {
    const upi = parseUpiUri(data);
    let readableText = data;
    if (upi) {
      readableText = `UPI QR Payment Request: Payee: ${upi.pn || upi.pa}${upi.am ? `, Amount: ${upi.am} ${upi.cu}` : ''}${upi.tn ? `, Note: "${upi.tn}"` : ''} (VPA: ${upi.pa})`;
    }

    const res = {
      raw: data,
      upi,
      readableText,
      scannedAt: new Date().toLocaleTimeString()
    };
    setScannedResult(res);
    if (onScan) onScan(res);
  };

  // High-performance multi-scale decoder for high-resolution mobile camera captures (12MP-48MP photos)
  const decodeFromImage = (img) => {
    const scales = [1000, 600, 1600, img.width];
    const canvas = canvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    for (const maxDim of scales) {
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
      if (code && code.data) {
        return code.data;
      }
    }
    return null;
  };

  // Decode uploaded or camera-captured image
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError('');
    setScannedResult(null);
    setDecoding(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target.result;
      setUploadedImage(url);
      const img = new Image();
      img.onload = () => {
        const foundData = decodeFromImage(img);
        setDecoding(false);
        if (foundData) {
          handleQrFound(foundData);
        } else {
          setCameraError('No QR code detected in this photo. Please retake closer to the QR code, ensure good lighting, or paste the text directly.');
        }
      };
      img.onerror = () => {
        setDecoding(false);
        setCameraError('Could not process this image file.');
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const loadSample = (sample) => {
    stopCamera();
    handleQrFound(sample.raw);
  };

  return (
    <div className="pg-qr-scanner" style={{ marginTop: 12, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* Scanner Mode Toggle */}
      <div className="pg-tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => {
            setMethod('camera');
            setCameraError('');
          }}
          className={`pg-tab ${method === 'camera' ? 'on' : ''}`}
        >
          📷 Live Camera Scan
        </button>

        <button
          type="button"
          onClick={() => {
            stopCamera();
            setMethod('upload');
            setCameraError('');
          }}
          className={`pg-tab ${method === 'upload' ? 'on' : ''}`}
        >
          🖼️ Upload QR Image
        </button>
      </div>

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Hidden Native Mobile Camera Input: works 100% on all Android and iOS devices */}
      <input
        id="qr-mobile-camera-capture"
        ref={mobileCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
      />

      {/* Camera View Area */}
      {method === 'camera' && (
        <div
          style={{
            background: '#090d16',
            borderRadius: 20,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: 'clamp(14px, 3.5vw, 24px)',
            textAlign: 'center',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* Active Viewfinder Stream (Kept mounted in DOM so videoRef is always valid) */}
          <div
            style={{
              display: cameraActive ? 'block' : 'none',
              position: 'relative',
              width: '100%',
              maxWidth: '100%',
              aspectRatio: '4 / 3',
              maxHeight: 320,
              margin: '0 auto',
              borderRadius: 16,
              overflow: 'hidden',
              background: '#000',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)'
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {/* Laser Scanning Animation Overlay */}
            <div
              style={{
                position: 'absolute',
                top: '20%',
                left: '15%',
                right: '15%',
                bottom: '20%',
                border: '2px solid rgba(99, 102, 241, 0.8)',
                borderRadius: 14,
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.4), inset 0 0 20px rgba(99, 102, 241, 0.2)',
                pointerEvents: 'none'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'linear-gradient(90deg, transparent, #38bdf8, #818cf8, transparent)',
                  boxShadow: '0 0 8px #38bdf8',
                  animation: 'scanLaser 2s linear infinite'
                }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 0,
                right: 0,
                fontSize: 12,
                color: 'rgba(255, 255, 255, 0.8)',
                textShadow: '0 2px 4px rgba(0,0,0,0.8)'
              }}
            >
              Align QR code inside the frame
            </div>
          </div>

          {cameraActive && (
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={stopCamera}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '8px 20px',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Stop Camera Stream
              </button>
            </div>
          )}

          {/* Idle / Launch Mode */}
          {!cameraActive && (
            <div style={{ padding: '16px 8px' }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.18)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px',
                  fontSize: 26
                }}
              >
                📸
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: '#fff' }}>
                Scan Any UPI or Payment QR Code
              </h3>
              <p style={{ margin: '0 auto 18px', fontSize: 13, color: 'rgba(255, 255, 255, 0.65)', maxWidth: 440, lineHeight: 1.5 }}>
                Point your camera at a merchant QR, UPI collect sticker, or payment invoice to inspect who receives the money and verify for scams before paying.
              </p>

              {/* Primary Mobile Shutter & Live Stream Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {/* 100% Reliable Native Mobile Camera Shutter via label */}
                <label
                  htmlFor="qr-mobile-camera-capture"
                  className="pg-btn"
                  style={{
                    padding: '12px 22px',
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    textAlign: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <span>📸</span>
                  <span>Take QR Photo (Phone Camera)</span>
                </label>

                {/* WebRTC Live Stream */}
                <button
                  type="button"
                  onClick={startCamera}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#fff',
                    borderRadius: 999,
                    padding: '12px 18px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <span>🎥</span>
                  <span>Live Video Viewfinder</span>
                </button>
              </div>

              {decoding && (
                <div style={{ marginTop: 14, fontSize: 13, color: '#38bdf8' }}>
                  ⏳ Analyzing camera photo for QR code...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload QR Image Area */}
      {method === 'upload' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 20,
            border: '2px dashed var(--line)',
            padding: 'clamp(20px, 4vw, 32px)',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px', color: 'var(--ink)' }}>
            {decoding ? 'Analyzing QR image...' : 'Drop or Tap to Choose QR Image'}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--mut)' }}>
            Upload a screenshot or photo of any UPI, PayPal, or payment QR code.
          </p>

          {uploadedImage && (
            <div style={{ marginTop: 16 }}>
              <img
                src={uploadedImage}
                alt="Uploaded QR code"
                style={{
                  maxHeight: 160,
                  maxWidth: '100%',
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  margin: '0 auto',
                  display: 'block'
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Fallback & Helper Notice */}
      {cameraError && (
        <div
          style={{
            marginTop: 14,
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(15, 23, 42, 0.6))',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 16,
            padding: '14px 18px',
            color: '#fff',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>💡</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#fca5a5' }}>
              Notice & Solution
            </span>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.5 }}>
            {cameraError}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label
              htmlFor="qr-mobile-camera-capture"
              className="pg-btn"
              style={{ padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}
            >
              📸 Tap to Open Phone Camera &rarr;
            </label>
            <button
              type="button"
              onClick={() => loadSample(SAMPLE_QRS[0])}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#fff',
                borderRadius: 999,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ⚡ Test Sample Scam QR
            </button>
          </div>
        </div>
      )}

      {/* Scanned Result Diagnostic Card */}
      {scannedResult && (
        <div
          style={{
            marginTop: 16,
            background: '#0b0f19',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 18,
            padding: 'clamp(14px, 3.5vw, 20px)',
            color: '#fff',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: scannedResult.upi ? 'rgba(56, 189, 248, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                  color: scannedResult.upi ? '#38bdf8' : '#a5b4fc',
                  fontSize: 11,
                  fontWeight: 700
                }}
              >
                {scannedResult.upi ? 'UPI QR DETECTED' : 'QR PAYLOAD READ'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', wordBreak: 'break-all' }}>
                {scannedResult.upi?.pn || 'Payment Destination'}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'monospace' }}>
              Scanned at {scannedResult.scannedAt}
            </span>
          </div>

          {/* Loud Red Alert for UPI QR Scams */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.25), rgba(159, 18, 57, 0.3))',
              border: '2px solid #f43f5e',
              borderRadius: 14,
              padding: '12px 16px',
              marginBottom: 14,
              boxShadow: '0 0 20px rgba(244, 63, 94, 0.25)',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fecdd3', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>🚨</span>
              <span>DANGER: YE QR CODE PAISA AANE KA NAHI, PAISA KATNE KA HAI!</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#fff', lineHeight: 1.5 }}>
              QR code scan karne ya UPI PIN daalne se <b>kabhi paise aate nahi hain</b>, sirf aapke bank account se paise katte hain. Agar kisi ne cashback ya refund pane ke liye ye scan karne ko bola hai to <b>turant cancel karein!</b>
            </p>
          </div>

          {/* Extracted UPI Fields */}
          {scannedResult.upi ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
                gap: 10,
                marginBottom: 14
              }}
            >
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: 10, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)', display: 'block' }}>Payee VPA Handle</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', wordBreak: 'break-all' }}>{scannedResult.upi.pa}</span>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: 10, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)', display: 'block' }}>Requested Amount</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#34d399' }}>
                  {scannedResult.upi.am ? `${scannedResult.upi.am} ${scannedResult.upi.cu}` : 'Open (Any Amount)'}
                </span>
              </div>
              {scannedResult.upi.tn && (
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: 10, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)', display: 'block' }}>Transaction Note</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#f8fafc', wordBreak: 'break-word' }}>"{scannedResult.upi.tn}"</span>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '10px 14px',
                borderRadius: 12,
                fontFamily: 'monospace',
                fontSize: 12,
                wordBreak: 'break-all',
                color: '#38bdf8',
                marginBottom: 14
              }}
            >
              {scannedResult.raw}
            </div>
          )}

          {/* Direct Trigger Button */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (onAnalyzeText) {
                  onAnalyzeText(scannedResult.readableText);
                }
              }}
              className="pg-btn"
              style={{ padding: '10px 20px', fontSize: 13 }}
            >
              Scan with ScamShield AI &rarr;
            </button>
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)' }}>
              Runs payee safety check, QR collect scam detector, and PayPal sandbox guard.
            </span>
          </div>
        </div>
      )}

      {/* Preset Example QRs */}
      <div style={{ marginTop: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mut)', display: 'block', marginBottom: 8 }}>
          Or try a simulated QR payment sample:
        </span>
        <div className="pg-chips" style={{ marginTop: 0 }}>
          {SAMPLE_QRS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => loadSample(s)}
              className="pg-chip"
              style={{ fontSize: 12 }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
