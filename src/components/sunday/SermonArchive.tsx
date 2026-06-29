import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { PastSermonsGrid } from '../live-service/PastSermonsGrid';
import { fetchWatchSermons, type WatchSermon } from '../../lib/services/liveService';
import type { ConnectSubjectKind } from '../../config/sermonConnectSubjects';
import { browseAllLabels } from '../../config/sermonConnectSubjects';

interface SermonArchiveProps {
  churchId: string;
  initialKind?: ConnectSubjectKind;
  initialFilter?: string;
  onClearFilter?: () => void;
}

export function SermonArchive({
  churchId,
  initialKind,
  initialFilter = '',
  onClearFilter,
}: SermonArchiveProps) {
  const [sermons, setSermons] = useState<WatchSermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialFilter);

  useEffect(() => {
    setSearch(initialFilter);
  }, [initialFilter, initialKind]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWatchSermons(churchId)
      .then(rows => {
        if (!cancelled) setSermons(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [churchId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sermons;
    return sermons.filter(s => {
      const haystack = [s.title, s.seriesTitle, s.speaker, s.partLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sermons, search]);

  const kindLabel = initialKind ? browseAllLabels[initialKind] : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Sermon archive</h2>
        <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
          Past messages from Central Henderson — search by title, series, or speaker.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sermons…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-850 text-sm text-gray-900 dark:text-dark-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        {(initialKind || search) && onClearFilter && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              onClearFilter();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-600 text-sm text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-850"
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      {kindLabel && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg px-3 py-2">
          Browsing: {kindLabel}
          {initialFilter ? ` · “${initialFilter}”` : ''}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          Loading archive…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-dark-400">
          <p className="text-sm">No sermons match your search.</p>
        </div>
      ) : (
        <PastSermonsGrid sermons={filtered} hideViewAll />
      )}
    </div>
  );
}
