import { useState } from 'react';
import { History, Search } from 'lucide-react';
import { useAuditTimeline } from '../../hooks/useAuditTimeline';
import { EmptyState } from '../ui/EmptyState';

const KIND_LABEL: Record<string, string> = { audit: 'Audit', event: 'Event' };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
}

export function AuditTimeline() {
  const { entries, isLoading, error, forbidden, search } = useAuditTimeline();
  const [q, setQ] = useState('');

  if (forbidden) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-dark-400">
        Your role doesn't include audit-trail access. Contact a System Administrator if you believe this is wrong.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <form
        className="flex items-center gap-2 mb-4"
        onSubmit={e => { e.preventDefault(); void search({ q: q || undefined }); }}
      >
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by entity, action, or event type…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-200"
          />
        </div>
        <button type="submit" className="px-3 py-2 text-sm font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-dark-200">
          Search
        </button>
      </form>

      {error && <p className="text-sm text-brand-600 dark:text-brand-400 mb-3">{error}</p>}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-dark-800 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon={<History size={22} />} title="Nothing recorded yet" description="Actions across Work Orders, approvals, agents, and member data will appear here." />
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-dark-700 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850">
          {entries.map(entry => (
            <div key={`${entry.kind}-${entry.id}`} className="px-4 py-2.5 flex items-start justify-between gap-3" data-testid="audit-entry">
              <div className="min-w-0">
                <p className="text-sm text-gray-900 dark:text-dark-100">{entry.label}</p>
                <p className="text-xs text-gray-400 dark:text-dark-500">
                  {KIND_LABEL[entry.kind]} · {entry.entity_type ?? 'unknown entity'} · {entry.source_app ?? 'unknown source'}
                </p>
              </div>
              <span className="text-xs text-gray-400 dark:text-dark-500 shrink-0">{formatTime(entry.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
