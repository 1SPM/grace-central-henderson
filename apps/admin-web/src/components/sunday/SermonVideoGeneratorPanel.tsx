import { useEffect, useMemo, useRef, useState } from 'react';
import { Film, Loader2, Play, RefreshCw, Wand2 } from 'lucide-react';
import {
  listSermonVideoJobs,
  pollSermonVideoJob,
  startSermonVideoJob,
  type SermonVideoAspectRatio,
  type SermonVideoDuration,
  type SermonVideoJob,
  type SermonVideoResolution,
} from '../../lib/services/sermonVideo';

interface SermonVideoGeneratorPanelProps {
  sermonTitle: string;
  sections: Array<{ type: string; title: string; content: string }>;
}

const promptChips = [
  {
    label: 'Archive intro',
    prompt:
      'Create a cinematic sermon archive intro for Central Henderson Church. Warm light, welcoming sanctuary, tasteful motion graphics, hopeful tone, no on-screen text.',
  },
  {
    label: 'Scripture visual',
    prompt:
      'Create a reverent scripture visual for a Sunday sermon. Open Bible, soft morning light, subtle camera movement, peaceful worship atmosphere, no readable text.',
  },
  {
    label: 'Sermon recap',
    prompt:
      'Create a short sermon recap video for social media. Modern church archive style, congregation moments, warm transitions, hopeful and pastoral tone.',
  },
  {
    label: 'Invitation / altar call',
    prompt:
      'Create a gentle invitation moment for a church service video. Soft stage light, prayerful atmosphere, people responding with hope, cinematic but authentic.',
  },
];

function buildSuggestedPrompt(sermonTitle: string, sections: SermonVideoGeneratorPanelProps['sections']): string {
  const title = sermonTitle.trim() || 'this Sunday sermon';
  const sectionSummary = sections
    .slice(0, 4)
    .map(section => `${section.type}: ${section.title}`)
    .join('; ');
  return [
    `Create an 8-second cinematic sermon archive video for "${title}".`,
    'Style: modern church web archive, warm light, subtle camera movement, polished but authentic.',
    'Avoid readable text overlays, distorted faces, logos, or distracting effects.',
    sectionSummary ? `Sermon context: ${sectionSummary}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function statusLabel(status: SermonVideoJob['status']): string {
  if (status === 'running' || status === 'queued') return 'Generating with Gemini Veo...';
  if (status === 'completed') return 'Video ready';
  return 'Generation failed';
}

export function SermonVideoGeneratorPanel({ sermonTitle, sections }: SermonVideoGeneratorPanelProps) {
  const suggestedPrompt = useMemo(() => buildSuggestedPrompt(sermonTitle, sections), [sermonTitle, sections]);
  const [prompt, setPrompt] = useState(suggestedPrompt);
  const [negativePrompt, setNegativePrompt] = useState('readable text, distorted faces, low quality, flicker');
  const [aspectRatio, setAspectRatio] = useState<SermonVideoAspectRatio>('16:9');
  const [durationSeconds, setDurationSeconds] = useState<SermonVideoDuration>(8);
  const [resolution, setResolution] = useState<SermonVideoResolution>('720p');
  const [activeJob, setActiveJob] = useState<SermonVideoJob | null>(null);
  const [jobs, setJobs] = useState<SermonVideoJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    listSermonVideoJobs().then(result => {
      if (result.success && result.jobs) setJobs(result.jobs);
    });
  }, []);

  useEffect(() => {
    if (sections.length > 0 || sermonTitle.trim()) {
      setPrompt(prev => (prev.trim() ? prev : suggestedPrompt));
    }
  }, [sections.length, sermonTitle, suggestedPrompt]);

  useEffect(() => {
    if (!activeJob || (activeJob.status !== 'running' && activeJob.status !== 'queued')) return;
    pollTimer.current = window.setInterval(async () => {
      const result = await pollSermonVideoJob(activeJob.id);
      if (!result.success) {
        setError(result.error || 'Video status check failed.');
        if (result.job) setActiveJob(result.job);
        return;
      }
      if (!result.job) return;
      setActiveJob(result.job);
      setJobs(prev => [result.job!, ...prev.filter(job => job.id !== result.job!.id)]);
      if (result.job.status === 'completed' || result.job.status === 'failed') {
        if (pollTimer.current) window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    }, 15_000);

    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [activeJob]);

  const startJob = async () => {
    setError(null);
    setIsStarting(true);
    const result = await startSermonVideoJob({
      prompt,
      negativePrompt,
      aspectRatio,
      durationSeconds,
      resolution,
    });
    setIsStarting(false);
    if (!result.success || !result.job) {
      setError(result.error || 'Unable to start sermon video generation.');
      return;
    }
    setActiveJob(result.job);
    setJobs(prev => [result.job!, ...prev.filter(job => job.id !== result.job!.id)]);
  };

  const refreshJobs = async () => {
    const result = await listSermonVideoJobs();
    if (result.success && result.jobs) setJobs(result.jobs);
  };

  const canGenerate = prompt.trim().length >= 12 && !isStarting && activeJob?.status !== 'running';
  const latestCompleted = activeJob?.status === 'completed'
    ? activeJob
    : jobs.find(job => job.status === 'completed' && job.videoUrl);

  return (
    <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 no-print">
      <div className="flex flex-col lg:flex-row lg:items-start gap-5">
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-[11px] font-semibold mb-3">
                <Wand2 size={12} />
                AI Video Studio
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-dark-100">
                Generate sermon archive video
              </h3>
              <p className="text-sm text-gray-600 dark:text-dark-300 mt-1">
                Create short Gemini Veo clips for sermon archive intros, scripture visuals, and social recap moments.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshJobs}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-dark-200 hover:bg-white dark:hover:bg-dark-850"
              aria-label="Refresh video jobs"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {promptChips.map(chip => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setPrompt(chip.prompt)}
                className="px-2.5 py-1 rounded-full bg-white dark:bg-dark-850 border border-gray-200 dark:border-dark-600 text-xs text-gray-600 dark:text-dark-300 hover:border-violet-300"
              >
                {chip.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPrompt(suggestedPrompt)}
              className="px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/40 text-xs text-violet-700 dark:text-violet-300"
            >
              Use sermon context
            </button>
          </div>

          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-850 px-3 py-2 text-sm text-gray-900 dark:text-dark-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            placeholder="Describe the sermon video you want to generate..."
          />

          <input
            value={negativePrompt}
            onChange={event => setNegativePrompt(event.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-850 px-3 py-2 text-sm text-gray-900 dark:text-dark-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            placeholder="Negative prompt (optional)"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-medium text-gray-600 dark:text-dark-300">
              Aspect ratio
              <select
                value={aspectRatio}
                onChange={event => setAspectRatio(event.target.value as SermonVideoAspectRatio)}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-850 px-3 py-2 text-sm"
              >
                <option value="16:9">16:9 landscape</option>
                <option value="9:16">9:16 vertical</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600 dark:text-dark-300">
              Duration
              <select
                value={durationSeconds}
                onChange={event => setDurationSeconds(Number(event.target.value) as SermonVideoDuration)}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-850 px-3 py-2 text-sm"
              >
                <option value={4}>4 seconds</option>
                <option value={6}>6 seconds</option>
                <option value={8}>8 seconds</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600 dark:text-dark-300">
              Resolution
              <select
                value={resolution}
                onChange={event => setResolution(event.target.value as SermonVideoResolution)}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-850 px-3 py-2 text-sm"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </label>
          </div>

          {error && (
            <p className="text-xs text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={startJob}
            disabled={!canGenerate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {isStarting ? <Loader2 size={15} className="animate-spin" /> : <Film size={15} />}
            Generate video
          </button>

          {activeJob && (
            <p className="text-xs text-gray-500 dark:text-dark-400">
              {statusLabel(activeJob.status)}
              {activeJob.status === 'running' || activeJob.status === 'queued'
                ? ' This can take a few minutes; the panel will keep checking.'
                : ''}
            </p>
          )}
        </div>

        <div className="lg:w-[360px] space-y-3">
          <div className="rounded-xl overflow-hidden bg-slate-950 border border-gray-200 dark:border-dark-700 aspect-video flex items-center justify-center">
            {latestCompleted?.videoUrl ? (
              <video src={latestCompleted.videoUrl} controls playsInline className="w-full h-full object-cover" />
            ) : activeJob?.status === 'running' || activeJob?.status === 'queued' ? (
              <div className="text-center text-white/70 text-sm px-6">
                <Loader2 size={24} className="animate-spin mx-auto mb-3" />
                Generating with Gemini Veo...
              </div>
            ) : (
              <div className="text-center text-white/60 text-sm px-6">
                <Play size={26} className="mx-auto mb-3" />
                Generated video preview will appear here.
              </div>
            )}
          </div>

          {jobs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-dark-500">
                Recent jobs
              </p>
              {jobs.slice(0, 3).map(job => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setActiveJob(job)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 hover:border-violet-200"
                >
                  <p className="text-xs font-medium text-gray-800 dark:text-dark-100 line-clamp-1">
                    {job.prompt}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-0.5">
                    {statusLabel(job.status)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
