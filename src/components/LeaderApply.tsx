import { useState } from 'react';
import { Sparkles, CheckCircle, Heart, Users, Coins } from 'lucide-react';

type Status = 'idle' | 'submitting' | 'done';

const ROLES = [
  { value: 'pastor', label: 'Pastor' },
  { value: 'counselor', label: 'Counselor / therapist' },
  { value: 'spiritual_director', label: 'Spiritual director / mentor' },
  { value: 'influencer', label: 'Ministry creator / influencer' },
  { value: 'author', label: 'Author / teacher' },
  { value: 'other', label: 'Something else' },
];

export function LeaderApply() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    role: '',
    audienceUrl: '',
    audienceSize: '',
    expertiseAreas: '',
    bio: '',
    motivation: '',
  });

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('submitting');
    try {
      const res = await fetch('/api/leader-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setStatus('idle');
    }
  };

  if (status === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Application received</h2>
          <p className="text-slate-600">
            We read every one. If your ministry is a fit, you'll hear from us at{' '}
            <span className="font-medium text-slate-900">{form.email}</span> within a few days.
          </p>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Offer */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3 tracking-tight">
            Your ministry, multiplied.
          </h1>
          <p className="text-lg text-slate-600">
            Become a verified leader on Grace. An AI companion trained on your voice and
            teaching — caring for members between Sundays, and booking them in with the
            real you when it matters.
          </p>
        </div>

        {/* Proof points */}
        <div className="grid gap-3 mb-8">
          <div className="flex gap-3 bg-white rounded-xl p-4 shadow-sm">
            <Heart className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">It's you, at 2am.</span> Your clone
              prays with a grieving member when you can't — in your words, from your teaching.
            </p>
          </div>
          <div className="flex gap-3 bg-white rounded-xl p-4 shadow-sm">
            <Users className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">The congregations are already here.</span>{' '}
              Churches on Grace are looking for leaders like you. No audience to build first.
            </p>
          </div>
          <div className="flex gap-3 bg-white rounded-xl p-4 shadow-sm">
            <Coins className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">You earn from it.</span> Revenue share
              every time your clone counsels someone or a member books a real session.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Apply to lead</h2>

          <div>
            <label className={labelClass}>Name <span className="text-amber-600">*</span></label>
            <input className={inputClass} value={form.displayName} onChange={set('displayName')}
              required placeholder="Pastor Dana Whitfield" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email <span className="text-amber-600">*</span></label>
              <input className={inputClass} type="email" value={form.email} onChange={set('email')}
                required placeholder="you@church.org" />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input className={inputClass} value={form.phone} onChange={set('phone')}
                placeholder="Optional" />
            </div>
          </div>

          <div>
            <label className={labelClass}>What do you do?</label>
            <select className={inputClass} value={form.role} onChange={set('role')}>
              <option value="">Choose one…</option>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Where can people find you?</label>
              <input className={inputClass} value={form.audienceUrl} onChange={set('audienceUrl')}
                placeholder="Podcast, YouTube, socials…" />
            </div>
            <div>
              <label className={labelClass}>Audience size</label>
              <input className={inputClass} value={form.audienceSize} onChange={set('audienceSize')}
                placeholder="Rough number is fine" />
            </div>
          </div>

          <div>
            <label className={labelClass}>What do you care most about?</label>
            <input className={inputClass} value={form.expertiseAreas} onChange={set('expertiseAreas')}
              placeholder="Grief, marriage, addiction recovery, discipleship…" />
            <p className="text-xs text-slate-400 mt-1">Comma-separated.</p>
          </div>

          <div>
            <label className={labelClass}>Tell us about your ministry</label>
            <textarea className={inputClass} value={form.bio} onChange={set('bio')}
              rows={3} placeholder="Who you serve, how you teach, what people come to you for." />
          </div>

          <div>
            <label className={labelClass}>Why do you want to do this?</label>
            <textarea className={inputClass} value={form.motivation} onChange={set('motivation')}
              rows={2} placeholder="The honest version." />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={status === 'submitting'}
            className="w-full py-2.5 bg-amber-600 text-white font-medium rounded-lg
              hover:bg-amber-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {status === 'submitting' ? 'Sending…' : 'Send application'}
          </button>
          <p className="text-xs text-slate-400 text-center">
            We read every application. No bots.
          </p>
        </form>
      </div>
    </div>
  );
}
