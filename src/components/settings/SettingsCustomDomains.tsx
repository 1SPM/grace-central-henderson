import { useEffect, useState } from 'react';
import { Globe, X, Plus, Loader2 } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';
import { workosFetch, WorkOsApiError } from '../../lib/services/workos';

export function SettingsCustomDomains() {
  const { getAuthToken } = useAuthContext();
  const { has, isLoading: permissionsLoading } = useWorkOsPermissions();
  const canManage = has('portal.provision_member');

  const [hosts, setHosts] = useState<string[]>([]);
  const [newHost, setNewHost] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (permissionsLoading || !canManage) { setIsLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await workosFetch<{ hosts: string[] }>('/api/tenant/hosts', getAuthToken);
        if (!cancelled) setHosts(data.hosts ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof WorkOsApiError ? err.message : 'Failed to load custom domains');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getAuthToken, canManage, permissionsLoading]);

  async function saveHosts(next: string[]) {
    setIsSaving(true);
    setError(null);
    try {
      const data = await workosFetch<{ hosts: string[] }>('/api/tenant/hosts', getAuthToken, {
        method: 'PUT',
        body: JSON.stringify({ hosts: next }),
      });
      setHosts(data.hosts ?? next);
    } catch (err) {
      setError(err instanceof WorkOsApiError ? err.message : 'Failed to save custom domains');
    } finally {
      setIsSaving(false);
    }
  }

  function handleAdd() {
    const trimmed = newHost.trim().toLowerCase();
    if (!trimmed || hosts.includes(trimmed)) { setNewHost(''); return; }
    setNewHost('');
    void saveHosts([...hosts, trimmed]);
  }

  function handleRemove(host: string) {
    void saveHosts(hosts.filter(h => h !== host));
  }

  if (permissionsLoading || !canManage) return null;

  return (
    <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Globe size={18} className="text-indigo-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Custom domains</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
        Domains listed here get this church's branding (name, color, logo) when the app loads on them.
      </p>

      <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs px-3 py-2 mb-4">
        Adding a domain here only enables branding lookups — it must also be attached to the Vercel
        project (Vercel dashboard → Domains) before it will actually serve this app. This does not
        change which church's data any session can see.
      </div>

      {error && <p className="text-sm text-brand-600 dark:text-brand-400 mb-3">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-gray-400 dark:text-dark-500">Loading…</p>
      ) : (
        <>
          {hosts.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-dark-500 mb-3">No custom domains configured.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {hosts.map(host => (
                <li key={host} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-dark-800">
                  <span className="text-sm text-gray-700 dark:text-dark-200">{host}</span>
                  <button
                    onClick={() => handleRemove(host)}
                    disabled={isSaving}
                    className="text-gray-400 hover:text-brand-500 disabled:opacity-50"
                    aria-label={`Remove ${host}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={newHost}
              onChange={e => setNewHost(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="church.example.org"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-dark-100"
            />
            <button
              onClick={handleAdd}
              disabled={isSaving || !newHost.trim()}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}
