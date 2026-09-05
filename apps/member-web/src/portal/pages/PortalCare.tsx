import { useState } from 'react';
import { HeartHandshake, Heart, ShieldAlert } from 'lucide-react';
import { usePortalCare } from '../hooks/usePortalCare';
import { usePortalPrayerWall, type PrayerVisibility } from '../hooks/usePortalPrayer';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'grief', label: 'Grief' },
  { value: 'marriage', label: 'Marriage' },
  { value: 'anxiety-depression', label: 'Anxiety or depression' },
  { value: 'parenting', label: 'Parenting' },
  { value: 'faith-questions', label: 'Faith questions' },
  { value: 'financial', label: 'Financial' },
  { value: 'addiction', label: 'Addiction' },
  { value: 'crisis', label: 'Urgent / crisis' },
];

const PRAYER_VISIBILITY: { value: PrayerVisibility; label: string; description: string }[] = [
  { value: 'private_pastoral_care', label: 'Private to Pastoral Care', description: 'Only our pastoral care team sees this.' },
  { value: 'specific_care_team', label: 'Specific care team', description: 'Only staff assigned to your case.' },
  { value: 'church_prayer_wall', label: 'Church prayer wall', description: 'Visible to all members, with your name.' },
  { value: 'anonymous_prayer_wall', label: 'Anonymous prayer wall', description: 'Visible to all members — your name is never shown.' },
];

const CRISIS_NOTICE = 'If you are in immediate danger, please call or text 988 (Suicide & Crisis Lifeline) or call 911.';

export function PortalCare() {
  const { requests, isSubmitting: careSubmitting, submit: submitCare } = usePortalCare();
  const { entries, isLoading: wallLoading, isSubmitting: prayerSubmitting, lastResult, submit: submitPrayer } = usePortalPrayerWall();

  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [contactMethod, setContactMethod] = useState<'email' | 'sms' | 'phone' | 'either'>('either');
  const [wantsFollowup, setWantsFollowup] = useState(true);
  const [careVisibility, setCareVisibility] = useState<'private_pastoral_care' | 'specific_care_team'>('private_pastoral_care');
  const [careSent, setCareSent] = useState(false);

  const [prayerContent, setPrayerContent] = useState('');
  const [prayerVisibility, setPrayerVisibility] = useState<PrayerVisibility>('private_pastoral_care');
  const [prayerSent, setPrayerSent] = useState(false);

  async function handleCareSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    await submitCare({
      category,
      message: message.trim(),
      preferred_contact_method: contactMethod,
      requests_human_followup: wantsFollowup,
      visibility: careVisibility,
    });
    setMessage('');
    setCareSent(true);
    setTimeout(() => setCareSent(false), 4000);
  }

  async function handlePrayerSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prayerContent.trim()) return;
    await submitPrayer(prayerContent.trim(), prayerVisibility);
    setPrayerContent('');
    setPrayerSent(true);
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Care &amp; Prayer</h1>
        <p className="text-sm text-stone-500 mt-1">Reach out privately, or share a prayer with your church family.</p>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-2.5 text-xs text-amber-800 flex items-start gap-1.5">
        <ShieldAlert size={14} className="mt-0.5 shrink-0" /> {CRISIS_NOTICE}
      </div>

      <section aria-labelledby="portal-care-request" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-care-request" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5"><HeartHandshake size={16} /> Request care</h2>
        {careSent ? (
          <p className="text-sm text-emerald-600">Your request has been received by our pastoral care team.</p>
        ) : (
          <form onSubmit={handleCareSubmit} className="space-y-3">
            <div>
              <label htmlFor="care-category" className="text-xs font-medium text-stone-600">Category</label>
              <select id="care-category" value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mt-1">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="care-message" className="text-xs font-medium text-stone-600">What's going on?</label>
              <textarea id="care-message" value={message} onChange={e => setMessage(e.target.value)} rows={3} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mt-1" placeholder="Share as much or as little as you'd like." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="care-contact" className="text-xs font-medium text-stone-600">Preferred contact</label>
                <select id="care-contact" value={contactMethod} onChange={e => setContactMethod(e.target.value as typeof contactMethod)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mt-1">
                  <option value="either">No preference</option>
                  <option value="email">Email</option>
                  <option value="sms">Text</option>
                  <option value="phone">Phone call</option>
                </select>
              </div>
              <div>
                <label htmlFor="care-visibility" className="text-xs font-medium text-stone-600">Who can see this request</label>
                <select id="care-visibility" value={careVisibility} onChange={e => setCareVisibility(e.target.value as typeof careVisibility)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mt-1">
                  <option value="private_pastoral_care">Private to Pastoral Care</option>
                  <option value="specific_care_team">Specific authorized care team</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={wantsFollowup} onChange={e => setWantsFollowup(e.target.checked)} className="rounded" />
              A real person should follow up with me
            </label>
            <button type="submit" disabled={careSubmitting || !message.trim()} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50">
              {careSubmitting ? 'Sending…' : 'Submit request'}
            </button>
          </form>
        )}

        {requests.length > 0 && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <p className="text-xs font-medium text-stone-500 mb-2">Your requests</p>
            <ul className="space-y-1.5" data-testid="care-request-status-list">
              {requests.map(r => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-stone-700 capitalize">{r.category.replace(/-/g, ' ')}</span>
                  <span className="text-xs font-medium text-stone-500">{r.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="portal-prayer-submit" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-prayer-submit" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5"><Heart size={16} /> Share a prayer request</h2>
        {prayerSent && lastResult ? (
          <div className="text-sm text-emerald-600 space-y-1">
            <p>Your prayer request has been shared.</p>
            {lastResult.visibility_overridden && lastResult.crisis_resource_message && (
              <p className="text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs">{lastResult.crisis_resource_message}</p>
            )}
          </div>
        ) : (
          <form onSubmit={handlePrayerSubmit} className="space-y-3">
            <div>
              <label htmlFor="prayer-content" className="sr-only">Prayer request</label>
              <textarea id="prayer-content" value={prayerContent} onChange={e => setPrayerContent(e.target.value)} rows={3} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" placeholder="What's on your heart today?" />
            </div>
            <div>
              <label htmlFor="prayer-visibility" className="text-xs font-medium text-stone-600">Who can see this prayer</label>
              <select id="prayer-visibility" value={prayerVisibility} onChange={e => setPrayerVisibility(e.target.value as PrayerVisibility)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mt-1">
                {PRAYER_VISIBILITY.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
              <p className="text-xs text-stone-400 mt-1">{PRAYER_VISIBILITY.find(v => v.value === prayerVisibility)?.description}</p>
            </div>
            <button type="submit" disabled={prayerSubmitting || !prayerContent.trim()} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50">
              {prayerSubmitting ? 'Sharing…' : 'Share prayer request'}
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="portal-prayer-wall" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-prayer-wall" className="text-sm font-semibold text-stone-900 mb-3">Church prayer wall</h2>
        {wallLoading ? (
          <div className="h-16 rounded-xl bg-stone-100 animate-pulse" />
        ) : entries.length === 0 ? (
          <p className="text-sm text-stone-400">No prayer requests on the wall yet.</p>
        ) : (
          <ul className="space-y-3" data-testid="prayer-wall-list">
            {entries.map(entry => (
              <li key={entry.id} className="text-sm">
                <p className="text-stone-700">{entry.content}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {entry.is_anonymous ? 'Anonymous' : entry.author_name} · {new Date(entry.created_at).toLocaleDateString()}
                  {entry.is_answered && <span className="text-emerald-600"> · Answered</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
