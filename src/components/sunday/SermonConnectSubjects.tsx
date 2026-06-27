import { Loader2, RefreshCw } from 'lucide-react';
import {
  browseAllLabels,
  connectColumnTitles,
  type ConnectSubjectKind,
} from '../../config/sermonConnectSubjects';
import { useSermonConnectSubjects } from '../../hooks/useSermonConnectSubjects';

interface SermonConnectSubjectsProps {
  churchId: string;
  onSelectTopic: (title: string) => void;
  onSelectScripture: (ref: string) => void;
  onSelectIllustration: (topic: string) => void;
  onBrowseAll: (kind: ConnectSubjectKind) => void;
}

function ConnectColumn({
  title,
  items,
  browseLabel,
  loading,
  onSelect,
  onBrowseAll,
}: {
  title: string;
  items: readonly string[];
  browseLabel: string;
  loading: boolean;
  onSelect: (item: string) => void;
  onBrowseAll: () => void;
}) {
  return (
    <div className="flex flex-col min-h-full">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-dark-100 mb-3">{title}</h3>
      <ul className="space-y-2 flex-1">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <li key={index} className="h-4 rounded bg-gray-100 dark:bg-dark-700 animate-pulse" />
          ))
        ) : (
          items.slice(0, 10).map(item => (
            <li key={item}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-left"
              >
                {item}
              </button>
            </li>
          ))
        )}
      </ul>
      <button
        type="button"
        onClick={onBrowseAll}
        className="mt-4 text-sm text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline text-left"
      >
        {browseLabel}
      </button>
    </div>
  );
}

export function SermonConnectSubjects({
  churchId,
  onSelectTopic,
  onSelectScripture,
  onSelectIllustration,
  onBrowseAll,
}: SermonConnectSubjectsProps) {
  const { subjects, loading, error } = useSermonConnectSubjects(churchId);

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 no-print">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-xs text-gray-500 dark:text-dark-400">
          Click a subject to add it to your sermon — topics, scripture, and illustrations in one place.
        </p>
        <div className="inline-flex items-center gap-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-full px-2.5 py-1">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Live · Week of {subjects.weekLabel}
        </div>
      </div>

      {error && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 md:divide-x md:divide-gray-200 dark:md:divide-dark-600">
        <div className="md:pr-6">
          <ConnectColumn
            title={connectColumnTitles.topics}
            items={subjects.topics}
            browseLabel={browseAllLabels.topics}
            loading={loading}
            onSelect={onSelectTopic}
            onBrowseAll={() => onBrowseAll('topics')}
          />
        </div>
        <div className="md:px-6">
          <ConnectColumn
            title={connectColumnTitles.scripture}
            items={subjects.scripture}
            browseLabel={browseAllLabels.scripture}
            loading={loading}
            onSelect={onSelectScripture}
            onBrowseAll={() => onBrowseAll('scripture')}
          />
        </div>
        <div className="md:pl-6">
          <ConnectColumn
            title={connectColumnTitles.illustrations}
            items={subjects.illustrations}
            browseLabel={browseAllLabels.illustrations}
            loading={loading}
            onSelect={onSelectIllustration}
            onBrowseAll={() => onBrowseAll('illustrations')}
          />
        </div>
      </div>
    </div>
  );
}
