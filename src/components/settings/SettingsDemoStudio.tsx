import { useState } from 'react';
import { Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';
import { workosFetch, WorkOsApiError } from '../../lib/services/workos';
import { isDemoModeActive } from '../../config/tenant';

interface SeedResult {
  person_id: string;
  email: string;
  giving_tier_note: string | null;
  group_membership_skipped: boolean;
  event_rsvp_skipped: boolean;
}

export function SettingsDemoStudio() {
  const { getAuthToken } = useAuthContext();
  const { has, isLoading: permissionsLoading } = useWorkOsPermissions();
  const canManage = has('portal.provision_member');
  const isDemoTenant = isDemoModeActive();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeedResult | null>(null);

  if (permissionsLoading || !canManage) return null;

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    try {
      const data = await workosFetch<SeedResult>('/api/people/seed-demo-persona', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          ...(isDemoTenant ? {} : { confirm: confirmName }),
        }),
      });
      setResult(data);
      setFirstName('');
      setLastName('');
      setConfirmName('');
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 409) {
        setError((err.body as { message?: string })?.message ?? 'Confirmation required.');
      } else {
        setError(err instanceof WorkOsApiError ? err.message : 'Could not generate the demo persona.');
      }
    } finally {
      setIsGenerating(false);
    }
  }

  const canSubmit = firstName.trim() && lastName.trim() && (isDemoTenant || confirmName.trim());

  return (
    <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-indigo-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Demo Studio</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
        Generate a synthetic member with a coherent journey — milestones, a group, a recurring gift,
        a funded Impact Card, and more — for demos and testing. See also the Custom domains card above.
      </p>

      {!isDemoTenant && (
        <div className="rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-800 dark:text-brand-300 text-xs px-3 py-2 mb-4 flex gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            This is a real tenant, not a demo tenant. Every row this creates will carry a demo tag, but it
            still writes real data here. Type your church's exact name below to confirm.
          </span>
        </div>
      )}

      {error && <p className="text-sm text-brand-600 dark:text-brand-400 mb-3">{error}</p>}

      {result && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-sm px-3 py-2 mb-4 space-y-1">
          <p>Created demo persona — <strong>{result.email}</strong></p>
          {result.giving_tier_note && <p className="text-xs">{result.giving_tier_note}</p>}
          {result.group_membership_skipped && <p className="text-xs">No active group existed yet — group membership skipped.</p>}
          {result.event_rsvp_skipped && <p className="text-xs">No upcoming event existed yet — RSVP skipped.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input
          type="text"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          placeholder="First name"
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-dark-100"
        />
        <input
          type="text"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          placeholder="Last name"
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-dark-100"
        />
      </div>

      {!isDemoTenant && (
        <input
          type="text"
          value={confirmName}
          onChange={e => setConfirmName(e.target.value)}
          placeholder="Type your church's exact name to confirm"
          className="w-full mb-3 px-3 py-2 text-sm rounded-lg border border-brand-300 dark:border-brand-700 bg-white dark:bg-dark-900 text-gray-900 dark:text-dark-100"
        />
      )}

      <button
        onClick={() => void handleGenerate()}
        disabled={isGenerating || !canSubmit}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white disabled:opacity-50"
      >
        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        Generate persona
      </button>
    </div>
  );
}
