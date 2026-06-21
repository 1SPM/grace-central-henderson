import { ExternalLink, Film } from 'lucide-react';

const VIDEO_SRC = '/media/sermon-maker/archive-web-vid-comp.mp4';

export function SermonVideoReferenceCard() {
  return (
    <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden no-print">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
        <div className="lg:col-span-2 p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold mb-3">
              <Film size={12} />
              Video reference
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-dark-100">
              Archive Web Video Reference
            </h3>
            <p className="text-sm text-gray-600 dark:text-dark-300 mt-2 leading-relaxed">
              Preview the archive web video while building Sunday sermon content. Use it as a visual
              reference for message flow, archive presentation, and future sermon media ideas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
            <span className="px-2 py-1 rounded-md bg-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700">
              MP4
            </span>
            <a
              href={VIDEO_SRC}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              Open media <ExternalLink size={12} />
            </a>
          </div>
        </div>

        <div className="lg:col-span-3 bg-slate-950">
          <video
            className="w-full h-full min-h-[220px] max-h-[420px] object-cover"
            src={VIDEO_SRC}
            controls
            playsInline
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </div>
  );
}
