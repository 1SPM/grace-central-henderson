import { Building2, Heart, Plane, Plus, Sun } from 'lucide-react';
import type { Campaign, Pledge } from '../../types';
import type { GivingHubTab } from './GivingHub';
import { demoCampaigns, type CampaignKind, type HubCampaign } from './demoGivingHub';

const KIND_STYLE: Record<CampaignKind, { pill: string; bar: string; label: string }> = {
  admin: { pill: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', bar: 'bg-amber-500', label: 'Admin campaign' },
  seasonal: { pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', bar: 'bg-emerald-600', label: 'Seasonal' },
  member: { pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300', bar: 'bg-violet-600', label: 'Member cause' },
};

const ICONS = {
  building: Building2,
  plane: Plane,
  sun: Sun,
  heart: Heart,
} as const;

interface CampaignsTabProps {
  campaigns: Campaign[];
  pledges: Pledge[];
  onGoToTab: (tab: GivingHubTab) => void;
}

function CampaignCard({ campaign }: { campaign: HubCampaign }) {
  const style = KIND_STYLE[campaign.kind];
  const Icon = ICONS[campaign.icon];
  const pct = Math.min(Math.round((campaign.raised / campaign.goal) * 100), 100);

  return (
    <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-dark-850 border border-gray-200 dark:border-dark-700 flex items-center justify-center text-gray-600 dark:text-dark-300">
          <Icon size={18} />
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.pill}`}>{style.label}</span>
      </div>
      <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">{campaign.name}</h3>
      {campaign.submittedBy && (
        <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-0.5">Submitted by {campaign.submittedBy}</p>
      )}
      <p className="text-xs text-gray-500 dark:text-dark-400 mt-1.5 flex-1">{campaign.description}</p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-gray-900 dark:text-dark-100">
            ${campaign.raised.toLocaleString()}
          </span>
          <span className="text-gray-400 dark:text-dark-500">of ${campaign.goal.toLocaleString()}</span>
          <span className="font-semibold text-gray-700 dark:text-dark-300">{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500 dark:text-dark-400">
          <span>{campaign.donors} donors</span>
          <span>{campaign.daysLeft} days left</span>
          <span>→ {campaign.routesTo}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-dark-700">
        <button className="flex-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-dark-300 border border-gray-200 dark:border-dark-600 rounded-md hover:bg-gray-50 dark:hover:bg-dark-850 transition-colors">
          Edit
        </button>
        <button className="flex-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-dark-300 border border-gray-200 dark:border-dark-600 rounded-md hover:bg-gray-50 dark:hover:bg-dark-850 transition-colors">
          Stats
        </button>
        <button className="flex-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}

export function CampaignsTab({ campaigns, pledges, onGoToTab }: CampaignsTabProps) {
  // Real campaigns from the existing pledge system render alongside the
  // demo stream-typed campaigns, mapped to the admin type.
  const realCards: HubCampaign[] = campaigns
    .filter(c => c.isActive)
    .map(c => {
      const totalGiven = pledges
        .filter(p => p.campaignId === c.id)
        .reduce((sum, p) => sum + (p.totalGiven || 0), 0);
      const daysLeft = c.endDate
        ? Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000))
        : 0;
      return {
        id: c.id,
        name: c.name,
        description: c.description || `Routes to the ${c.fund} fund.`,
        kind: 'admin' as const,
        accent: 'gold' as const,
        icon: 'building' as const,
        raised: totalGiven,
        goal: c.goalAmount || 0,
        donors: pledges.filter(p => p.campaignId === c.id).length,
        daysLeft,
        routesTo: `${c.fund} fund`,
      };
    })
    .filter(c => c.goal > 0);

  const all = [...realCards, ...demoCampaigns];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-dark-400">
          {all.length} active campaigns across admin, seasonal, and member-led streams
        </p>
        <button
          onClick={() => onGoToTab('maker')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-950 text-white text-sm font-medium rounded-md transition-colors"
        >
          <Plus size={14} /> Create campaign
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {all.map(c => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>
    </div>
  );
}
