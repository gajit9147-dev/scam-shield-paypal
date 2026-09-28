import { useState } from 'react';

const labelStyles = {
  scam: 'bg-red-100 text-red-800',
  safe: 'bg-green-100 text-green-800',
  uncertain: 'bg-amber-100 text-amber-900'
};

export default function App() {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function check(event) {
    event.preventDefault();
    setResult(null);
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check the message.');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Could not reach the API. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">Day 1 prototype</p>
        <h1 className="mt-2 text-4xl font-bold">UPI Scam Shield</h1>
        <p className="mt-3 text-slate-600">Paste a payment message to see the API's structured response. The classifier is not built yet, so this is not a real safety verdict.</p>
        <form onSubmit={check} className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <label htmlFor="message" className="block font-semibold">Message to check</label>
          <textarea id="message" maxLength={1000} required rows={6} value={text} onChange={e => setText(e.target.value)} placeholder="Paste a sample message here (no private details)" className="mt-3 w-full rounded-lg border border-slate-300 p-3 focus:border-indigo-600 focus:outline-none" />
          <div className="mt-3 flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">{text.length}/1000 characters</span>
            <button disabled={loading} className="rounded-lg bg-indigo-700 px-5 py-2.5 font-medium text-white hover:bg-indigo-800 disabled:opacity-60">{loading ? 'Checking...' : 'Check message'}</button>
          </div>
        </form>
        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
        {result && <section aria-live="polite" className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">Verdict</h2><span className={`rounded-full px-3 py-1 text-sm font-semibold ${labelStyles[result.label] || labelStyles.uncertain}`}>{result.label}</span></div>
          <p className="mt-4"><strong>Reason:</strong> {result.reason}</p>
          <p className="mt-3"><strong>Safe action:</strong> {result.safeAction}</p>
          <p className="mt-3 text-sm text-slate-600">Confidence: {result.confidence == null ? 'Not available' : result.confidence} · Method: {result.method}</p>
          {result.evidence?.length > 0 && <p className="mt-3 text-sm">Evidence: {result.evidence.join(', ')}</p>}
        </section>}
        <p className="mt-8 text-sm text-slate-500">No sender, link, payment or identity is verified here. Do not paste real private SMS into a public demo.</p>
      </div>
    </main>
  );
}
