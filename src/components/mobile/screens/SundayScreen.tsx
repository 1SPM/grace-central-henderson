import { useMemo } from 'react';
import { BookOpen, CalendarDays, ListTodo } from 'lucide-react';
import type { CalendarEvent, View } from '../../../types';
import { listSermonDrafts } from '../../../lib/sermonDraftArchive';
import type { SundayReadiness } from '../../../lib/mobileAttention';
import { muted, surface } from '../ui/mobileTheme';
import { EmptyCard } from '../ui/MobileCard';
import { SectionLabel } from '../ui/SectionLabel';
import { IconChip } from '../ui/IconChip';
import { ProgressRing } from '../ui/ProgressRing';
import { ProgressBar } from '../ui/ProgressBar';
import { StatusDot, type StatusDotTone } from '../ui/StatusDot';
import { agoLabel, eventDateLabel } from '../ui/mobileFormat';

interface SundayScreenProps {
  readiness: SundayReadiness;
  mergedEvents: CalendarEvent[];
  churchId?: string;
  onNavigate: (view: View) => void;
}

interface ChecklistRow {
  key: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  dot: StatusDotTone;
  onClick?: () => void;
}

const DAY_MS = 86_400_000;

export function SundayScreen({ readiness, mergedEvents, churchId, onNavigate }: SundayScreenProps) {
  const now = useMemo(() => new Date(), []);

  const latestDraft = useMemo(() => {
    if (!churchId) return null;
    try {
      return listSermonDrafts(churchId)[0] ?? null;
    } catch {
      return null;
    }
  }, [churchId]);

  const weekEventCount = useMemo(() => {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const weekEnd = new Date(startOfToday.getTime() + 7 * DAY_MS);
    return mergedEvents.filter((e) => {
      const start = new Date(e.startDate);
      return (
        !Number.isNaN(start.getTime()) &&
        start.getTime() >= startOfToday.getTime() &&
        start.getTime() < weekEnd.getTime() &&
        e.id !== readiness.service?.id
      );
    }).length;
  }, [mergedEvents, now, readiness.service?.id]);

  const draftAgeDays = latestDraft
    ? Math.max(0, Math.floor((now.getTime() - new Date(latestDraft.updatedAt).getTime()) / DAY_MS))
    : null;
  const draftFresh = draftAgeDays !== null && draftAgeDays <= 14;

  // Every row states its real source — no volunteer confirmation counts
  // until volunteer assignments are actually persisted somewhere.
  const rows: ChecklistRow[] = [
    {
      key: 'sermon',
      icon: (
        <IconChip tone="violet">
          <BookOpen size={17} />
        </IconChip>
      ),
      title: 'Sermon & run of show',
      detail: draftFresh
        ? `Draft "${latestDraft!.title}" saved ${agoLabel(draftAgeDays!)}`
        : latestDraft
          ? `Last draft saved ${agoLabel(draftAgeDays!)}`
          : 'No sermon draft started yet',
      dot: draftFresh ? 'ok' : latestDraft ? 'attention' : 'none',
    },
    {
      key: 'tasks',
      icon: (
        <IconChip tone="indigo">
          <ListTodo size={17} />
        </IconChip>
      ),
      title: 'Tasks before Sunday',
      detail:
        readiness.totalCount > 0
          ? `${readiness.openCount} open · ${readiness.doneCount} done`
          : 'No prep tasks tracked yet',
      dot: readiness.totalCount === 0 ? 'none' : readiness.openCount > 0 ? 'attention' : 'ok',
      onClick: () => onNavigate('tasks'),
    },
    {
      key: 'events',
      icon: (
        <IconChip tone="sky">
          <CalendarDays size={17} />
        </IconChip>
      ),
      title: 'This week on the calendar',
      detail: weekEventCount > 0 ? `${weekEventCount} other ${weekEventCount === 1 ? 'event' : 'events'} this week` : 'A quiet week so far',
      dot: 'none',
    },
  ];

  return (
    <div className="px-4 pt-5 pb-6 space-y-4 min-h-full bg-[radial-gradient(circle_at_90%_4%,rgba(31,103,213,.18),transparent_25%),#070b14]">
      {/* Hero */}
      {readiness.service ? (
        <div className={`${surface} p-4 bg-gradient-to-br from-violet-500/15 to-indigo-500/10`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100 truncate">{readiness.service.title}</p>
              <p className={`text-xs mt-1 ${muted}`}>
                {eventDateLabel(readiness.service.startDate, readiness.service.allDay)}
              </p>
            </div>
            {readiness.kind === 'quantitative' && readiness.pct != null && (
              <ProgressRing value={readiness.pct} size={48} />
            )}
          </div>
          {readiness.kind === 'quantitative' && readiness.pct != null ? (
            <>
              <div className="mt-4">
                <ProgressBar value={readiness.pct} />
              </div>
              <p className={`text-xs mt-2 ${muted}`}>
                Preparation {readiness.pct >= 70 ? 'on track' : 'in progress'} — from{' '}
                {readiness.totalCount} tracked {readiness.totalCount === 1 ? 'task' : 'tasks'}
              </p>
            </>
          ) : (
            <p className={`text-xs mt-3 ${muted}`}>
              {readiness.totalCount > 0
                ? `${readiness.openCount} prep ${readiness.openCount === 1 ? 'item' : 'items'} open before Sunday`
                : 'No prep items tracked yet — add tasks due before Sunday to see readiness here.'}
            </p>
          )}
        </div>
      ) : (
        <EmptyCard>No upcoming Sunday service found on the calendar.</EmptyCard>
      )}

      {/* Checklist */}
      <div className="space-y-2">
        <SectionLabel>Preparation</SectionLabel>
        {rows.map((row) => {
          const body = (
            <>
              {row.icon}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-100">{row.title}</span>
                <span className={`block text-xs mt-0.5 ${muted}`}>{row.detail}</span>
              </span>
              <StatusDot tone={row.dot} />
            </>
          );
          return row.onClick ? (
            <button
              key={row.key}
              type="button"
              onClick={row.onClick}
              className={`${surface} w-full p-3.5 flex items-center gap-3 text-left`}
            >
              {body}
            </button>
          ) : (
            <div key={row.key} className={`${surface} p-3.5 flex items-center gap-3`}>
              {body}
            </div>
          );
        })}
      </div>

      <p className={`text-xs leading-relaxed ${muted}`}>
        Volunteer confirmations (worship, tech, kids) will appear here once team scheduling is
        tracked in GRACE.
      </p>
    </div>
  );
}
