import { useMemo } from 'react';
import { ArrowRight, ClipboardList } from 'lucide-react';
import type { Person, PrayerRequest, Task, View } from '../../../types';
import { useDecisionQueue } from '../../../hooks/useDecisionQueue';
import { parseDateFlexible } from '../../../utils/validation';
import { deriveFollowUps, type SundayReadiness } from '../../../lib/mobileAttention';
import { muted, surface } from '../ui/mobileTheme';
import { MobileCard, EmptyCard } from '../ui/MobileCard';
import { SectionLabel } from '../ui/SectionLabel';
import { CountCircle, type CountCircleTone } from '../ui/CountCircle';
import { ProgressBar } from '../ui/ProgressBar';
import { MobileSkeleton } from '../ui/MobileSkeleton';
import { eventDateLabel } from '../ui/mobileFormat';

interface BriefScreenProps {
  people: Person[];
  tasks: Task[];
  prayers: PrayerRequest[];
  readiness: SundayReadiness;
  onNavigate: (view: View) => void;
}

interface BriefCard {
  key: string;
  value: number;
  title: string;
  subtitle: string;
  tone: CountCircleTone;
  view: View;
}

export function BriefScreen({ people, tasks, prayers, readiness, onNavigate }: BriefScreenProps) {
  const queue = useDecisionQueue();
  const now = useMemo(() => new Date(), []);

  const followUps = useMemo(() => deriveFollowUps(people, tasks, prayers, now), [people, tasks, prayers, now]);
  const overdueCount = useMemo(() => {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    return tasks.filter((t) => {
      if (t.completed || !t.dueDate) return false;
      const due = parseDateFlexible(t.dueDate);
      return !Number.isNaN(due.getTime()) && due.getTime() < startOfToday.getTime();
    }).length;
  }, [tasks, now]);

  const queueHigh = useMemo(
    () => queue.items.filter((item) => item.severity === 'critical' || item.severity === 'high').length,
    [queue.items],
  );
  const approvalsCount = queue.counts.by_kind.approval ?? 0;
  const attentionCount = queueHigh + overdueCount;

  const cards: BriefCard[] = [];
  if (attentionCount > 0) {
    cards.push({
      key: 'attention',
      value: attentionCount,
      title: `Thing${attentionCount === 1 ? '' : 's'} need your attention`,
      subtitle: 'High priority',
      tone: 'violet',
      view: 'tasks',
    });
  }
  if (followUps.length > 0) {
    cards.push({
      key: 'follow-up',
      value: followUps.length,
      title: `${followUps.length === 1 ? 'Person needs' : 'People need'} follow-up`,
      subtitle: 'Personal touch',
      tone: 'sky',
      view: 'people',
    });
  }
  if (readiness.service) {
    cards.push({
      key: 'sunday',
      value: readiness.openCount,
      title:
        readiness.kind === 'quantitative' && (readiness.pct ?? 0) >= 70
          ? 'Sunday is on track'
          : 'Sunday preparation',
      subtitle:
        readiness.kind === 'quantitative'
          ? `Preparation ${readiness.pct}%`
          : readiness.totalCount > 0
            ? `${readiness.openCount} ${readiness.openCount === 1 ? 'item' : 'items'} open`
            : 'No prep items tracked yet',
      tone: 'emerald',
      view: 'sunday-prep',
    });
  }
  if (approvalsCount > 0) {
    cards.push({
      key: 'approvals',
      value: approvalsCount,
      title: `Approval${approvalsCount === 1 ? '' : 's'} needed`,
      subtitle: 'Awaiting your decision',
      tone: 'orange',
      view: 'tasks',
    });
  }

  return (
    <div className="px-4 pt-5 pb-6 space-y-5 min-h-full bg-[radial-gradient(circle_at_50%_0%,rgba(126,75,230,.2),transparent_24%),#070b14]">
      {/* Hero */}
      <div className="text-center pt-2">
        <span className="w-12 h-12 rounded-2xl bg-violet-500/15 text-violet-300 grid place-items-center mx-auto">
          <ClipboardList size={23} />
        </span>
        <h1 className="text-xl font-semibold mt-3 text-slate-100">Here's your snapshot for today.</h1>
      </div>

      {/* Count cards */}
      {queue.isLoading ? (
        <MobileSkeleton rows={4} />
      ) : cards.length > 0 ? (
        <div className="space-y-2">
          {cards.map((card) => (
            <MobileCard key={card.key} onClick={() => onNavigate(card.view)} className="p-3.5 flex items-center gap-3">
              <CountCircle value={card.value} tone={card.tone} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-100">{card.title}</span>
                <span className={`block text-xs mt-0.5 ${muted}`}>{card.subtitle}</span>
              </span>
              <ArrowRight size={16} className="text-slate-600 shrink-0" />
            </MobileCard>
          ))}
        </div>
      ) : (
        <EmptyCard>Nothing is waiting on you — enjoy the quiet.</EmptyCard>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={() => onNavigate('tasks')}
        className="w-full h-11 rounded-2xl bg-violet-600 hover:bg-violet-500 transition-colors text-sm font-medium text-white flex items-center justify-center gap-2"
      >
        View all in Work Queue
        <ArrowRight size={16} />
      </button>

      {/* Up next */}
      {readiness.service && (
        <div className="space-y-2">
          <SectionLabel>Up next</SectionLabel>
          <div className={`${surface} p-3.5 space-y-3`}>
            <div>
              <p className="text-sm font-medium text-slate-100">{readiness.service.title}</p>
              <p className={`text-xs mt-0.5 ${muted}`}>
                {eventDateLabel(readiness.service.startDate, readiness.service.allDay)}
                {readiness.openCount > 0 &&
                  ` · ${readiness.openCount} ${readiness.openCount === 1 ? 'task' : 'tasks'} remaining`}
              </p>
            </div>
            {readiness.kind === 'quantitative' && readiness.pct != null && <ProgressBar value={readiness.pct} />}
          </div>
        </div>
      )}
    </div>
  );
}
