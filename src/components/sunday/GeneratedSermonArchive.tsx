import { useEffect, useState } from 'react';
import { BookOpen, Loader2, Sparkles, Trash2 } from 'lucide-react';
import {
  deleteSermonDraft,
  formatDraftDate,
  listSermonDrafts,
  type ArchivedSermonDraft,
  type ArchivedSermonSection,
} from '../../lib/sermonDraftArchive';

interface GeneratedSermonArchiveProps {
  churchId: string;
  refreshKey: number;
  activeDraftId?: string | null;
  onLoad: (draft: { id: string; title: string; sections: ArchivedSermonSection[] }) => void;
}

export function GeneratedSermonArchive({
  churchId,
  refreshKey,
  activeDraftId,
  onLoad,
}: GeneratedSermonArchiveProps) {
  const [drafts, setDrafts] = useState<ArchivedSermonDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setDrafts(listSermonDrafts(churchId));
    setLoading(false);
  }, [churchId, refreshKey]);

  const handleDelete = (draftId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!confirm('Remove this sermon from your archive?')) return;
    deleteSermonDraft(churchId, draftId);
    setDrafts(listSermonDrafts(churchId));
  };

  return (
    <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
      <div className="bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800/30 p-3">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
            Generated Sermons
          </span>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-1">
          AI-generated drafts saved automatically — click to reload into the builder.
        </p>
      </div>

      <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-dark-500">
            <Loader2 size={22} className="animate-spin mb-2" />
            <p className="text-xs">Loading archive…</p>
          </div>
        ) : drafts.length === 0 ? (
          <div className="py-8 px-3 text-center text-gray-400 dark:text-dark-500">
            <Sparkles size={24} className="mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-gray-600 dark:text-dark-300">No generated sermons yet</p>
            <p className="text-xs mt-1">
              Use Generate Full Sermon with AI and your drafts will appear here.
            </p>
          </div>
        ) : (
          drafts.map(draft => {
            const isActive = draft.id === activeDraftId;
            return (
              <div
                key={draft.id}
                className={`relative rounded-lg border transition-all group ${
                  isActive
                    ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40'
                    : 'bg-white dark:bg-dark-850 border-gray-200 dark:border-dark-700 hover:border-violet-200 dark:hover:border-violet-800/40 hover:shadow-sm'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onLoad(draft)}
                  className="w-full text-left p-3"
                >
                  <div className="flex items-start gap-2 pr-6">
                    <Sparkles
                      size={15}
                      className={`mt-0.5 flex-shrink-0 ${
                        isActive ? 'text-violet-600 dark:text-violet-400' : 'text-violet-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100 line-clamp-2">
                        {draft.title}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-1">
                        {draft.sections.length} section{draft.sections.length === 1 ? '' : 's'} · {formatDraftDate(draft.updatedAt)}
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={event => handleDelete(draft.id, event)}
                  className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Delete ${draft.title}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
