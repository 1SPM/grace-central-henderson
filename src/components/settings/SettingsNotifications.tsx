import { useState, useEffect } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { useNotificationPrefs, type NotificationCategory, type NotificationChannel, type NotificationPrefRow } from '../../hooks/useNotificationPrefs';

const CATEGORIES: { key: NotificationCategory; label: string; description: string }[] = [
  { key: 'crisis', label: 'Crisis alerts', description: 'A care request flagged crisis-priority' },
  { key: 'approvals', label: 'Approvals', description: 'Decisions and related-party flags' },
  { key: 'finance', label: 'Finance', description: 'Expenses and gift-in-kind records' },
  { key: 'agents', label: 'Agent findings', description: 'Triage, dismiss, resolve, convert' },
  { key: 'digest', label: 'Everything else', description: 'Catch-all for uncategorized activity' },
];

const CHANNELS: { key: NotificationChannel; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
];

export function SettingsNotifications() {
  const { phone, isLoading, isSaving, error, isEnabled, save } = useNotificationPrefs();
  const [draft, setDraft] = useState<Map<string, boolean>>(new Map());
  const [phoneDraft, setPhoneDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isLoading) setPhoneDraft(phone ?? '');
  }, [isLoading, phone]);

  function key(category: NotificationCategory, channel: NotificationChannel) {
    return `${category}:${channel}`;
  }

  function checked(category: NotificationCategory, channel: NotificationChannel): boolean {
    const k = key(category, channel);
    return draft.has(k) ? draft.get(k)! : isEnabled(category, channel);
  }

  function toggle(category: NotificationCategory, channel: NotificationChannel) {
    setDraft(prev => new Map(prev).set(key(category, channel), !checked(category, channel)));
    setSaved(false);
  }

  async function handleSave() {
    const rows: NotificationPrefRow[] = [];
    for (const c of CATEGORIES) {
      for (const ch of CHANNELS) {
        rows.push({ category: c.key, channel: ch.key, enabled: checked(c.key, ch.key) });
      }
    }
    const trimmedPhone = phoneDraft.trim();
    const ok = await save(rows, trimmedPhone || undefined);
    if (ok) {
      setDraft(new Map());
      setSaved(true);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
        <p className="text-sm text-gray-400 dark:text-dark-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Bell size={18} className="text-indigo-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Notifications</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
        Choose how you're alerted about activity. Crisis alerts are sent the moment they happen; everything else arrives in a periodic digest.
      </p>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{error}</p>}

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-dark-400">
              <th className="pb-2 font-medium">Category</th>
              {CHANNELS.map(ch => (
                <th key={ch.key} className="pb-2 font-medium text-center px-3">{ch.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map(c => (
              <tr key={c.key} className="border-t border-gray-100 dark:border-dark-800">
                <td className="py-2 pr-4">
                  <span className="text-gray-900 dark:text-dark-100 font-medium">{c.label}</span>
                  <span className="block text-xs text-gray-500 dark:text-dark-400">{c.description}</span>
                </td>
                {CHANNELS.map(ch => (
                  <td key={ch.key} className="text-center px-3">
                    <input
                      type="checkbox"
                      checked={checked(c.key, ch.key)}
                      onChange={() => toggle(c.key, ch.key)}
                      className="h-4 w-4 rounded border-gray-300 dark:border-dark-600 text-indigo-600"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-700 dark:text-dark-200 mb-1">Phone number (for SMS alerts)</label>
        <input
          type="tel"
          value={phoneDraft}
          onChange={e => { setPhoneDraft(e.target.value); setSaved(false); }}
          placeholder="(555) 123-4567"
          className="w-full max-w-xs px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-dark-100"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
          Save preferences
        </button>
        {saved && !isSaving && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>}
      </div>
    </div>
  );
}
