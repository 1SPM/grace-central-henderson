/**
 * /give/<slug>/manage — donor enters their email to request a magic
 * link. The link arrives in their inbox; clicking it redirects them
 * to Stripe Customer Portal where they can pause / cancel / change
 * card on file for any active recurring gifts.
 *
 * Always shows "Check your inbox" after submit, regardless of whether
 * the email matched any donor records. This prevents email-enumeration
 * probing (an attacker can't tell if a given email has given to a
 * given church).
 */

import { useState } from 'react';

interface DonorPortalRequestPageProps {
  churchSlug: string;
}

export function DonorPortalRequestPage({ churchSlug }: DonorPortalRequestPageProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/giving/request-donor-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          church_slug: churchSlug,
          email: email.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.detail || body.error || `HTTP ${res.status}`);
        return;
      }
      // Always show "sent" — privacy-preserving (never confirm whether
      // an email is in the system).
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-10 px-4">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-light text-gray-900 mb-2" style={{ fontFamily: 'Fraunces, serif' }}>
            Manage your giving
          </h1>
          <p className="text-sm text-gray-600">
            Pause, cancel, or change the card on file for your recurring gifts.
          </p>
        </header>

        {!sent && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-xs text-gray-500 mt-2">
                We'll send a single-use link that expires in 30 minutes.
              </p>
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Sending link…' : 'Send manage link'}
            </button>
          </form>
        )}

        {sent && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9 6 9-6M3 8v10a2 2 0 002 2h14a2 2 0 002-2V8M3 8l9 6 9-6" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">Check your inbox</h2>
            <p className="text-sm text-gray-600">
              If <strong>{email}</strong> has any active giving records, a link is on its way.
              It will arrive within a minute and expire in 30 minutes.
            </p>
            <p className="text-xs text-gray-500 mt-4">
              Didn't receive an email? Check your spam folder, or contact the church directly.
            </p>
            <div className="mt-6">
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="text-sm text-amber-700 hover:text-amber-900 underline"
              >
                Try a different email
              </button>
            </div>
          </div>
        )}

        <div className="text-center mt-6">
          <a href={`/give/${churchSlug}`} className="text-sm text-gray-600 hover:text-gray-900">
            ← Back to giving page
          </a>
        </div>
      </div>
    </div>
  );
}
