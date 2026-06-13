import { Radio, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useLiveServiceOps } from '../../hooks/useLiveServiceOps';
import type { ChurchProfile } from '../../hooks/useChurchSettings';
import type { Person } from '../../types';
import { CENTRAL_HENDERSON_TIMEZONE } from '../../config/centralHenderson';
import { LiveServiceStatsBar } from './LiveServiceStatsBar';
import { LiveStreamMonitor } from './LiveStreamMonitor';
import { LiveChatModerationPanel } from './LiveChatModerationPanel';
import { PastSermonsGrid } from './PastSermonsGrid';
import { OnlineSchedulePanel } from './OnlineSchedulePanel';
import { LiveServiceCTAPanel } from './LiveServiceCTAPanel';

interface LiveServiceDashboardProps {
  churchId: string;
  churchName: string;
  churchProfile?: ChurchProfile;
  timezone?: string;
  people: Person[];
  onViewPerson?: (id: string) => void;
  /** When true, hide page title (used inside Sunday tab). */
  embedded?: boolean;
}

export function LiveServiceDashboard({
  churchId,
  churchName,
  churchProfile,
  timezone = CENTRAL_HENDERSON_TIMEZONE,
  people,
  onViewPerson,
  embedded = false,
}: LiveServiceDashboardProps) {
  const {
    stats,
    chat,
    sermons,
    giftTicker,
    ctaCounts,
    activeSlot,
    isLive,
    isConnected,
    isDemo,
    isLoading,
    hideMessage,
    reload,
  } = useLiveServiceOps({ churchId, churchProfile, timezone, people });

  return (
    <div className={`max-w-7xl mx-auto space-y-6 ${embedded ? 'px-4 sm:px-6 pt-4 pb-6' : 'p-4 sm:p-6'}`}>
      <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 ${embedded ? 'mb-2' : ''}`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {!embedded && (
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Live Service</h1>
            )}
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase">
                <Radio size={10} className="animate-pulse" />
                Service live
              </span>
            )}
            {isDemo ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold uppercase">
                <WifiOff size={10} />
                Demo
              </span>
            ) : isConnected ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold uppercase">
                <Wifi size={10} />
                Realtime
              </span>
            ) : null}
          </div>
          {!embedded && (
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
              Growth, resources, and community engagement at {churchName}.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={isLoading}
          className="self-start flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-600 text-sm text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <LiveServiceStatsBar stats={stats} />

      {/* Stream + Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <LiveStreamMonitor
            churchProfile={churchProfile}
            churchName={churchName}
            watchingNow={stats.watchingNow}
            activeSlot={activeSlot}
            isLive={isLive}
            giftTicker={giftTicker}
            onViewPerson={onViewPerson}
          />
        </div>
        <div className="lg:col-span-1 min-h-[320px]">
          <LiveChatModerationPanel
            chat={chat}
            watchingNow={stats.watchingNow}
            onHideMessage={id => void hideMessage(id)}
            onViewPerson={onViewPerson}
          />
        </div>
      </div>

      {/* Past sermons */}
      <PastSermonsGrid sermons={sermons} />

      {/* Schedule */}
      <OnlineSchedulePanel
        serviceTimes={churchProfile?.serviceTimes ?? []}
        activeSlot={activeSlot}
        churchName={churchName}
      />

      {/* CTAs */}
      <LiveServiceCTAPanel ctaCounts={ctaCounts} />
    </div>
  );
}
