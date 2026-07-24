/**
 * Care Requests Queue — staff view of member-submitted care requests
 * from the Members Portal (api/portal/_care.ts). Separate from the
 * existing Anchor-based Crisis Dispatch (avatar conversations); this is
 * the structured intake queue built in this phase — see
 * SHARED_BACKEND.md / this phase's completion notes.
 *
 * Confidential: only rendered for staff who hold care.view (the parent
 * CareHub route is already staff-gated; this component's own data fetch
 * is additionally gated server-side by requirePermission('care.view') in
 * api/care-requests, so even a direct API call from an unauthorized
 * session returns 403 regardless of what this component renders).
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../../lib/services/workos';

interface CareRequestRow {
  id: string;
  person_id: string;
  category: string;
  priority: string;
  status: string;
  visibility: string;
  crisis_flagged: boolean;
  sentinel_review_status: string;
  preferred_contact_method: string | null;
  requests_human_followup: boolean;
  summary: string;
  created_at: string;
  care_assignments: { id: string; assigned_to_user_id: string; status: string }[];
}

const STATUS_OPTIONS = ['submitted', 'triaged', 'assigned', 'in_progress', 'resolved', 'closed'];

export function CareRequestsQueue() {
  const { getAuthToken } = useAuthContext();
  const [requests, setRequests] = useState<CareRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await workosFetch<{ requests: CareRequestRow[] }>('/api/care-requests', getAuthToken);
      setRequests(data.requests);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Failed to load care requests');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function updateStatus(id: string, status: string) {
    try {
      await workosFetch(`/api/care-requests?id=${encodeURIComponent(id)}`, getAuthToken, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (err) {
      if (err instanceof WorkOsApiError) setError(err.message);
    }
  }

  async function clearSentinelReview(id: string) {
    await workosFetch(`/api/care-requests?id=${encodeURIComponent(id)}`, getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify({ sentinel_review_status: 'cleared' }),
    });
    await refresh();
  }

  async function addNote(id: string) {
    const note = noteDrafts[id]?.trim();
    if (!note) return;
    await workosFetch('/api/care-requests/notes', getAuthToken, {
      method: 'POST',
      body: JSON.stringify({ care_request_id: id, note }),
    });
    setNoteDrafts(prev => ({ ...prev, [id]: '' }));
  }

  if (forbidden) {
    return <div className="p-6 text-sm text-gray-500 dark:text-dark-400">Your role doesn't include care request access.</div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-brand-600 dark:text-brand-400">{error}</div>;
  }
  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500 dark:text-dark-400">Loading care requests…</div>;
  }
  if (requests.length === 0) {
    return <div className="p-6 text-sm text-gray-500 dark:text-dark-400">No care requests submitted yet.</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-3">
      {requests.map(r => (
        <div key={r.id} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4" data-testid="care-request-row">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-dark-100 capitalize">{r.category.replace(/-/g, ' ')}</p>
              <p className="text-sm text-gray-600 dark:text-dark-300 mt-1">{r.summary}</p>
              <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">
                {new Date(r.created_at).toLocaleString()} · Contact: {r.preferred_contact_method ?? 'no preference'} · {r.requests_human_followup ? 'wants follow-up' : 'no follow-up requested'} · {r.visibility === 'specific_care_team' ? 'Specific care team' : 'Private to Pastoral Care'}
              </p>
            </div>
            {r.crisis_flagged && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-100 dark:bg-brand-500/20 dark:text-brand-300 px-2 py-1 rounded-full shrink-0">
                <AlertTriangle size={12} /> Crisis flagged
              </span>
            )}
          </div>

          {r.sentinel_review_status === 'pending' && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
              <span className="text-xs text-amber-800 dark:text-amber-300">Requires human privacy/safety review before this can be closed.</span>
              <button onClick={() => void clearSentinelReview(r.id)} className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                <ShieldCheck size={12} /> Mark reviewed
              </button>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <label htmlFor={`status-${r.id}`} className="text-xs font-medium text-gray-500 dark:text-dark-400">Status:</label>
            <select
              id={`status-${r.id}`}
              value={r.status}
              onChange={e => void updateStatus(r.id, e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1 text-xs text-gray-700 dark:text-dark-200"
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <div className="mt-2 flex gap-2">
            <input
              value={noteDrafts[r.id] ?? ''}
              onChange={e => setNoteDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
              placeholder="Add an internal note (staff only)…"
              className="flex-1 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1 text-xs text-gray-700 dark:text-dark-200"
            />
            <button onClick={() => void addNote(r.id)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Add note</button>
          </div>
        </div>
      ))}
    </div>
  );
}
