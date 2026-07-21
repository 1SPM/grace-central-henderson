import { useMemo } from 'react';
import {
  AlertCircle,
  MapPin,
  QrCode,
  RefreshCw,
  TrendingUp,
  Users,
  Award,
} from 'lucide-react';
import type { Person, DiscipleshipMilestone, MilestoneType, SmallGroup } from '../../types';
import { HubPageHeader } from '../ui/HubPageHeader';
import { getViewHeaderMeta } from '../../lib/viewHeaderMeta';
import { usePortalActivity } from '../../hooks/usePortalActivity';
import {
  buildStepRequestsByPerson,
  computeDiscipleshipMetrics,
  getStepRequestFollowUps,
} from '../../lib/discipleshipMetrics';
import { MilestonePathwayMatrix } from './MilestonePathwayMatrix';
import { PortalActivityPanel } from './PortalActivityPanel';

interface DiscipleshipEngagementHubProps {
  people: Person[];
  milestones: DiscipleshipMilestone[];
  churchId?: string;
  groups?: SmallGroup[];
  onAddMilestone: (data: { personId: string; milestoneType: MilestoneType; completedAt?: string }) => void;
  onRemoveMilestone: (id: string) => void;
  onViewPerson?: (id: string) => void;
}

export function DiscipleshipEngagementHub({
  people,
  milestones,
  churchId = '',
  groups = [],
  onAddMilestone,
  onRemoveMilestone,
  onViewPerson,
}: DiscipleshipEngagementHubProps) {
  const { events, summary, memberRollup, isLoading, isDemo, reload } = usePortalActivity(churchId);

  const metrics = useMemo(
    () => computeDiscipleshipMetrics(people, milestones),
    [people, milestones],
  );

  const stepRequestsByPerson = useMemo(
    () => buildStepRequestsByPerson(events),
    [events],
  );

  const needsNextStepIds = useMemo(
    () => new Set(metrics.needsNextStep.map(p => p.id)),
    [metrics.needsNextStep],
  );

  const stepRequestFollowUps = useMemo(
    () => getStepRequestFollowUps(people, stepRequestsByPerson, needsNextStepIds),
    [people, stepRequestsByPerson, needsNextStepIds],
  );

  const followUpPeople = useMemo(() => {
    const seen = new Set<string>();
    const combined: Person[] = [];
    for (const p of [...metrics.needsNextStep, ...stepRequestFollowUps]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        combined.push(p);
      }
    }
    return combined;
  }, [metrics.needsNextStep, stepRequestFollowUps]);

  const headerMeta = getViewHeaderMeta('discipleship-engagement');

  const spiritualKpis = [
    { label: 'Step 3+', value: metrics.atStep3Plus, sub: 'Baptized or beyond' },
    { label: 'Avg steps', value: metrics.avgMilestones, sub: 'Per active member' },
    { label: 'Need follow-up', value: followUpPeople.length, sub: 'Growth opportunities', highlight: followUpPeople.length > 0 },
  ];

  const portalKpis = [
    { label: 'Active (7d)', value: summary.activeMembers7d, icon: Users },
    { label: 'Journey views', value: summary.journeyViews7d, icon: MapPin },
    { label: 'Step requests', value: summary.stepRequests7d, icon: Award },
    { label: 'Journal entries', value: summary.journalEntries7d, icon: TrendingUp },
    { label: 'Check-ins', value: summary.checkins7d, icon: QrCode },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <HubPageHeader
        icon={headerMeta.icon}
        title={headerMeta.title}
        subtitle="Monitor spiritual growth and member engagement across your congregation"
        iconBoxClassName={headerMeta.iconBoxClassName}
        iconClassName={headerMeta.iconClassName}
        className="mb-6"
        trailing={
          <button
            onClick={reload}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-4">
        {spiritualKpis.map(({ label, value, sub, highlight }) => (
          <div
            key={label}
            className="bg-stone-100 dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-5"
          >
            <p className={`stat-number text-3xl ${highlight ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-dark-100'}`}>
              {value}
            </p>
            <p className="text-sm font-medium text-gray-700 dark:text-dark-300 mt-1">{label}</p>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {portalKpis.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-stone-100 dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Icon size={14} className="text-indigo-500" />
              <p className="text-xs text-gray-500 dark:text-dark-400">{label}</p>
            </div>
            <p className="stat-number text-2xl text-gray-900 dark:text-dark-100">{value}</p>
            <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-0.5">Last 7 days</p>
          </div>
        ))}
      </div>

      {isDemo && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-sm text-amber-800 dark:text-amber-300">
          Demo mode — portal activity tracking starts once Supabase is connected and members
          sign in to the portal at <span className="font-mono">/portal</span>.
        </div>
      )}

      {followUpPeople.length > 0 && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {followUpPeople.length} member{followUpPeople.length === 1 ? '' : 's'} need a next-step conversation
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {metrics.needsNextStep.length > 0 && stepRequestFollowUps.length > 0
                  ? 'Some haven\'t progressed past First Visit; others expressed interest in a milestone via My Journey.'
                  : metrics.needsNextStep.length > 0
                  ? 'These members haven\'t progressed past First Visit. Consider a pastoral check-in or small-group invitation.'
                  : 'Members expressed interest in a next milestone via My Journey.'}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {followUpPeople.slice(0, 8).map(p => (
                  <button
                    key={p.id}
                    onClick={() => onViewPerson?.(p.id)}
                    className="text-[11px] font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
                  >
                    {p.firstName} {p.lastName}
                    {stepRequestsByPerson.has(p.id) && !needsNextStepIds.has(p.id) ? ' ★' : ''}
                  </button>
                ))}
                {followUpPeople.length > 8 && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 px-2 py-0.5">
                    +{followUpPeople.length - 8} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">Pathway Matrix</h2>
        <MilestonePathwayMatrix
          people={people}
          milestones={milestones}
          memberRollup={memberRollup}
          portalEvents={events}
          onAddMilestone={onAddMilestone}
          onRemoveMilestone={onRemoveMilestone}
          onViewPerson={onViewPerson}
        />
      </div>

      <PortalActivityPanel
        events={events}
        summary={summary}
        memberRollup={memberRollup}
        isLoading={isLoading}
        people={people}
        groups={groups}
        onViewPerson={onViewPerson}
      />
    </div>
  );
}
