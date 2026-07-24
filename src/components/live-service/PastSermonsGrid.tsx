import { useState } from 'react';
import { Play, X } from 'lucide-react';
import type { WatchSermon } from '../../lib/services/liveService';
import { formatDuration, formatViewCount } from '../../lib/services/liveService';
import { useToast } from '../Toast';

interface PastSermonsGridProps {
  sermons: WatchSermon[];
  hideViewAll?: boolean;
  onViewAll?: () => void;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SermonThumbnail({ sermon }: { sermon: WatchSermon }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(sermon.thumbnailUrl) && !failed;

  if (showImage) {
    return (
      <img
        src={sermon.thumbnailUrl!}
        alt={sermon.title}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
      <Play size={24} className="text-white/60" />
    </div>
  );
}

export function PastSermonsGrid({ sermons, hideViewAll = false, onViewAll }: PastSermonsGridProps) {
  const toast = useToast();
  const [playing, setPlaying] = useState<WatchSermon | null>(null);

  const handleSermonClick = (sermon: WatchSermon) => {
    if (sermon.videoUrl) {
      setPlaying(sermon);
      return;
    }
    toast.info('Recording not linked yet — opening sermon archive.');
    onViewAll?.();
  };

  return (
    <div>
      {!hideViewAll && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-dark-100">Past sermons</h2>
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-40"
            disabled={!onViewAll}
          >
            View all
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sermons.map(sermon => (
          <button
            key={sermon.id}
            type="button"
            onClick={() => handleSermonClick(sermon)}
            className="group text-left bg-white dark:bg-dark-850 rounded-xl overflow-hidden border border-gray-100 dark:border-dark-700 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="relative aspect-video bg-gray-200 dark:bg-dark-700">
              <SermonThumbnail sermon={sermon} />
              {sermon.videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                    <Play size={18} className="text-gray-900 ml-0.5" fill="currentColor" />
                  </div>
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
          </button>
        ))}
      </div>

      {playing?.videoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPlaying(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Playing ${playing.title}`}
        >
          <div
            className="relative w-full max-w-4xl bg-black rounded-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPlaying(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Close video"
            >
              <X size={18} />
            </button>
            <video
              src={playing.videoUrl}
              controls
              autoPlay
              className="w-full aspect-video"
            />
            <div className="px-4 py-3 bg-gray-900">
              <p className="text-white font-semibold text-sm">{playing.title}</p>
              {playing.speaker && (
                <p className="text-white/60 text-xs mt-0.5">{playing.speaker}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
