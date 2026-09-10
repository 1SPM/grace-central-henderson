import { useState } from 'react';
import {
  CalendarRange,
  Flag,
  LayoutDashboard,
  HeartHandshake,
  Split,
  Star,
  Wand2,
} from 'lucide-react';
import type { Giving, Person, Campaign, Pledge, View } from '../../types';
import { GivingOverview } from './GivingOverview';
import { RevenueStreams } from './RevenueStreams';
import { PointsRewards } from './PointsRewards';
import { CampaignsTab } from './CampaignsTab';
import { CampaignMaker } from './CampaignMaker';
import { SeasonalGiving } from './SeasonalGiving';
import { MemberCauses } from './MemberCauses';
import { demoCauseStats } from './demoGivingHub';
import { HubPageHeader } from '../ui/HubPageHeader';
import { getViewHeaderMeta } from '../../lib/viewHeaderMeta';

export type GivingHubTab =
  | 'overview'
  | 'streams'
  | 'points'
  | 'campaigns'
  | 'maker'
  | 'seasonal'
  | 'causes';

export interface GivingNavTarget {
  view:
    | 'online-giving'
    | 'batch-entry'
    | 'pledges'
    | 'statements'
    | 'charity-baskets'
    | 'donation-tracker'
    | 'member-stats';
}

interface GivingHubProps {
  giving: Giving[];
  people: Person[];
  campaigns?: Campaign[];
  pledges?: Pledge[];
  onNavigate: (view: GivingNavTarget['view']) => void;
  onNavigateToWallets?: (view: View) => void;
}

const TABS: { id: GivingHubTab; label: string; icon: typeof Flag; badge?: number }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'streams', label: 'Revenue streams', icon: Split },
  { id: 'points', label: 'Points & rewards', icon: Star },
  { id: 'campaigns', label: 'Campaigns', icon: Flag },
  { id: 'maker', label: 'Campaign maker', icon: Wand2 },
  { id: 'seasonal', label: 'Seasonal', icon: CalendarRange },
  { id: 'causes', label: 'Member causes', icon: HeartHandshake, badge: demoCauseStats.awaitingReview },
];

export function GivingHub({ giving, people, campaigns = [], pledges = [], onNavigate, onNavigateToWallets }: GivingHubProps) {
  const [tab, setTab] = useState<GivingHubTab>('overview');
  const headerMeta = getViewHeaderMeta('giving');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <HubPageHeader
        icon={headerMeta.icon}
        title={headerMeta.title}
        subtitle="Every revenue stream — direct gifts, card rewards, campaigns, and member causes"
        iconBoxClassName={headerMeta.iconBoxClassName}
        iconClassName={headerMeta.iconClassName}
        className="mb-4"
        trailing={
          <button
            onClick={() => setTab('maker')}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-950 text-white text-sm font-medium rounded-lg transition-colors"
          >
            New campaign
          </button>
        }
      />

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-dark-700 mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'border-slate-900 dark:border-dark-100 text-slate-900 dark:text-dark-100 font-medium'
                : 'border-transparent text-gray-500 dark:text-dark-400 hover:text-gray-800 dark:hover:text-dark-200'
            }`}
          >
            <Icon size={14} />
            {label}
            {badge ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <GivingOverview
          giving={giving}
          people={people}
          pledges={pledges}
          onNavigate={onNavigate}
          onGoToTab={setTab}
          onNavigateToWallets={onNavigateToWallets}
        />
      )}
      {tab === 'streams' && <RevenueStreams onNavigateToWallets={onNavigateToWallets} />}
      {tab === 'points' && <PointsRewards />}
      {tab === 'campaigns' && <CampaignsTab campaigns={campaigns} pledges={pledges} onGoToTab={setTab} />}
      {tab === 'maker' && <CampaignMaker />}
      {tab === 'seasonal' && <SeasonalGiving />}
      {tab === 'causes' && <MemberCauses />}
    </div>
  );
}
