import { Users, DollarSign, Heart, Smartphone, AlertTriangle } from 'lucide-react';
import { StatCard } from '../ui/StatCard';
import type { DashboardMetrics } from '../../lib/dashboardSummary';

interface DashboardPulseProps {
  metrics: DashboardMetrics;
  peopleCount: number;
  visitorsCount: number;
  peopleSparkline: number[];
  portalActive7d: number | null;
  portalLogins7d: number | null;
  onViewPeople?: () => void;
  onViewGiving?: () => void;
  onViewPastoralCare?: () => void;
  onViewPortalActivity?: () => void;
}

export function DashboardPulse({
  metrics,
  peopleCount,
  visitorsCount,
  peopleSparkline,
  portalActive7d,
  portalLogins7d,
  onViewPeople,
  onViewGiving,
  onViewPastoralCare,
  onViewPortalActivity,
}: DashboardPulseProps) {
  const { givingMtd, goalPct, openCare, crisisCount } = metrics;

  return (
    <div className="mb-6">
      {crisisCount > 0 && (
        <div
          data-tutorial="dashboard-care-alert"
          className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30"
        >
          <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
          <p className="text-sm text-rose-900 dark:text-rose-200">
            <span className="font-semibold">{crisisCount} crisis dispatch{crisisCount === 1 ? '' : 'es'}</span>
            {' '}need immediate attention.
          </p>
          {onViewPastoralCare && (
            <button
              type="button"
              onClick={onViewPastoralCare}
              className="ml-auto text-xs font-medium text-rose-700 dark:text-rose-300 hover:underline shrink-0"
            >
              Open dispatch
            </button>
          )}
        </div>
      )}

      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-dark-500 mb-2 px-0.5">
        Pulse
      </p>
      <div data-tutorial="dashboard-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Members"
          value={peopleCount}
          icon={<Users size={20} />}
          change={visitorsCount > 0 ? Math.min(visitorsCount * 5, 20) : 0}
          changeLabel={`${visitorsCount} visitors in pipeline`}
          sparklineData={peopleSparkline}
          accentColor="blue"
          onClick={onViewPeople}
        />
        <StatCard
          label="Impact MTD"
          value={`$${Math.round(givingMtd).toLocaleString()}`}
          icon={<DollarSign size={20} />}
          change={goalPct}
          changeLabel="of monthly goal"
          accentColor="emerald"
          onClick={onViewGiving}
        />
        <StatCard
          label="Open dispatch"
          value={openCare.length}
          icon={<Heart size={20} />}
          change={crisisCount}
          changeLabel={openCare.length > 0 ? `${crisisCount} crisis` : 'all clear'}
          invertTrend
          accentColor="rose"
          onClick={onViewPastoralCare}
        />
        <StatCard
          label="Portal (7d)"
          value={portalActive7d ?? '—'}
          icon={<Smartphone size={20} />}
          change={portalLogins7d ?? 0}
          changeLabel={portalLogins7d != null ? 'logins this week' : 'connect portal'}
          accentColor="violet"
          onClick={onViewPortalActivity}
        />
      </div>
    </div>
  );
}
