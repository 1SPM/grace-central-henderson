import { Play } from 'lucide-react';
import type { WatchSermon } from '../../lib/services/liveService';
import { formatDuration, formatViewCount } from '../../lib/services/liveService';

interface PastSermonsGridProps {
  sermons: WatchSermon[];
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PastSermonsGrid({ sermons }: PastSermonsGridProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-dark-100">Past sermons</h2>
        <button type="button" className="text-sm font-semibold text-red-600 hover:text-red-700">
          View all
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sermons.map(sermon => (
          <div
            key={sermon.id}
            className="group bg-white dark:bg-dark-850 rounded-xl overflow-hidden border border-gray-100 dark:border-dark-700 hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-video bg-gray-200 dark:bg-dark-700">
              {sermon.thumbnailUrl ? (
                <img
                  src={sermon.thumbnailUrl}
                  alt={sermon.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <Play size={24} className="text-white/60" />
                </div>
              )}
              {sermon.durationSeconds && (
                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
                  {formatDuration(sermon.durationSeconds)}
                </span>
              )}
            </div>
            <div className="p-3">
              {sermon.seriesTitle && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">
                  {sermon.seriesTitle}
                </p>
              )}
              <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100 line-clamp-2">
                {sermon.title}
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-dark-400 mt-1.5">
                {formatViewCount(sermon.viewCount)}
                {sermon.preachedAt ? ` · ${formatDate(sermon.preachedAt)}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
