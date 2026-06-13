import { Radio, DollarSign } from 'lucide-react';
import type { GiftTickerItem } from '../../lib/services/liveService';
import type { ChurchProfile } from '../../hooks/useChurchSettings';
import type { ActiveServiceSlot } from '../../lib/services/liveService';

interface LiveStreamMonitorProps {
  churchProfile?: ChurchProfile;
  churchName: string;
  watchingNow: number;
  activeSlot: ActiveServiceSlot | null;
  isLive: boolean;
  giftTicker: GiftTickerItem[];
  onViewPerson?: (id: string) => void;
}

export function LiveStreamMonitor({
  churchProfile,
  churchName,
  watchingNow,
  activeSlot,
  isLive,
  giftTicker,
  onViewPerson,
}: LiveStreamMonitorProps) {
  const series = churchProfile?.currentSeries;
  const streamUrl = churchProfile?.liveStreamUrl;
  const latestGift = giftTicker[0];

  const overlayTitle = series?.title ?? 'Live Service';
  const overlaySubtitle = [
    series?.part,
    series?.speaker,
    churchName,
    activeSlot ? `${activeSlot.day} ${activeSlot.time}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video min-h-[280px]">
      {streamUrl ? (
        <iframe
          src={streamUrl}
          title="Live stream"
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=675&fit=crop)' }}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />

      {/* Top badges */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 z-10">
        {isLive && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase">
            <Radio size={10} className="animate-pulse" />
            Live{activeSlot ? ` · ${activeSlot.time}` : ''}
          </span>
        )}
        <span className="px-2.5 py-1 rounded-full bg-black/60 text-white text-[10px] font-medium backdrop-blur">
          {watchingNow.toLocaleString()} watching
        </span>
        {series?.part && (
          <span className="px-2.5 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-semibold">
            {series.part} — {series.title}
          </span>
        )}
      </div>

      {/* Gift notification */}
      {latestGift && (
        <div className="absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={() => latestGift.personId && onViewPerson?.(latestGift.personId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur text-white text-[10px] hover:bg-black/90 transition-colors"
          >
            <DollarSign size={10} className="text-emerald-400" />
            {latestGift.personName} gave ${latestGift.amount.toFixed(0)} — {latestGift.fund}
          </button>
        </div>
      )}

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
        <h3 className="text-white font-bold text-lg leading-tight">{overlayTitle}</h3>
        <p className="text-white/70 text-xs mt-0.5">{overlaySubtitle}</p>
      </div>
    </div>
  );
}
