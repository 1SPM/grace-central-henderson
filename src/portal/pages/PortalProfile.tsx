import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { usePortalProfile } from '../hooks/usePortalProfile';
import { usePortalConsents } from '../hooks/usePortalConsents';
import { usePortalAuth } from '../PortalAuthContext';
import type { ConsentType } from '../../types/shared-platform';

const PREFERENCE_TOGGLES: { type: ConsentType; label: string; description: string }[] = [
  { type: 'email', label: 'Email updates', description: 'Church news and event reminders by email.' },
  { type: 'sms', label: 'Text messages', description: 'Time-sensitive updates by text.' },
  { type: 'push_notification', label: 'Push notifications', description: 'Alerts in this app.' },
  { type: 'directory_visibility', label: 'Directory visibility', description: 'Show my name in the member directory.' },
  { type: 'photograph', label: 'Photo permission', description: 'Allow my photo in church media and the directory.' },
  { type: 'volunteer_communications', label: 'Volunteer communications', description: 'Updates about volunteer opportunities.' },
  { type: 'impact_card_communications', label: 'Impact Card communications', description: 'Updates about your Impact Card.' },
];

function ToggleRow({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-800">{label}</p>
        <p className="text-xs text-stone-500">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-rose-600' : 'bg-stone-300'} disabled:opacity-50`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

export function PortalProfile() {
  const { profile, isLoading, isSaving, update } = usePortalProfile();
  const { statusFor, setConsent, savingType } = usePortalConsents();
  const { isDemo } = usePortalAuth();

  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', address: '', city: '', state: '', zip: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        zip: profile.zip ?? '',
      });
    }
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await update(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (isLoading || !profile) {
    return (
      <div className="p-4 sm:p-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-stone-100 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">My Profile &amp; Privacy</h1>
        <p className="text-sm text-stone-500 mt-1">Only you can see and change this information.</p>
      </div>

      <section aria-labelledby="portal-profile-fields" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-profile-fields" className="text-sm font-semibold text-stone-900 mb-3">Profile</h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pf-first" className="text-xs font-medium text-stone-600">First name</label>
              <input id="pf-first" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label htmlFor="pf-last" className="text-xs font-medium text-stone-600">Last name</label>
              <input id="pf-last" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <div>
            <label htmlFor="pf-phone" className="text-xs font-medium text-stone-600">Phone</label>
            <input id="pf-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label htmlFor="pf-address" className="text-xs font-medium text-stone-600">Address</label>
            <input id="pf-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mt-1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input aria-label="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            <input aria-label="State" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="State" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            <input aria-label="ZIP" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} placeholder="ZIP" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50">
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span className="text-sm text-emerald-600">Saved</span>}
          </div>
        </form>
      </section>

      <section aria-labelledby="portal-profile-preferences" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-profile-preferences" className="text-sm font-semibold text-stone-900 mb-1">Communication &amp; privacy preferences</h2>
        <p className="text-xs text-stone-500 mb-2">You control every one of these — nothing is on by default.</p>
        <div className="divide-y divide-stone-100">
          {PREFERENCE_TOGGLES.map(t => (
            <ToggleRow
              key={t.type}
              label={t.label}
              description={t.description}
              checked={statusFor(t.type) === 'granted'}
              disabled={savingType === t.type}
              onChange={(v) => void setConsent(t.type, v ? 'granted' : 'withdrawn')}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="portal-profile-security" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-profile-security" className="text-sm font-semibold text-stone-900 mb-2 flex items-center gap-1.5"><ShieldCheck size={16} /> Account security</h2>
        <p className="text-sm text-stone-600">
          {isDemo ? 'Preview mode — no real account is signed in.' : `Signed in as ${profile.email ?? 'your account'}.`}
        </p>
        <p className="text-xs text-stone-400 mt-1">Your portal access was enabled by your church. Contact the church office to change your sign-in email.</p>
      </section>
    </div>
  );
}
