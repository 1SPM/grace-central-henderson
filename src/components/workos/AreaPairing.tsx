/**
 * The pairing: one ministry area, its accountable human, its supporting
 * agent, and where it sits on the campus.
 *
 * Rendered identically by the Campus room panel and the WorkOS Overview so
 * the two entry points cannot tell different stories. Read-only — every
 * reassignment goes through Settings → Ministry Areas.
 *
 * What it will not do: invent a name. An area nobody owns says so, and
 * names the role that should hold it.
 */
import { Bot, MapPin, User, AlertTriangle, CalendarClock } from 'lucide-react';
import type { AgentOption, AreaWithCounts } from '../../hooks/useMinistryAreas';

/** Human-readable names for the RBAC roles in migration 032. */
const ROLE_LABEL: Record<string, string> = {
  system_administrator: 'System Administrator',
  executive_leadership: 'Executive Leadership',
  senior_pastor: 'Senior Pastor',
  ministry_leader: 'Ministry Leader',
  pastoral_care: 'Pastoral Care',
  member_services: 'Member Services',
  communications: 'Communications',
  volunteer_coordinator: 'Volunteer Coordinator',
  finance: 'Finance',
  impact_card_operations: 'Impact Card Operations',
  analyst: 'Analyst',
  auditor: 'Auditor',
};

export const ROOM_LABEL: Record<string, string> = {
  canopy: 'Canopy', lobby: 'Lobby / Foyer', mur1: 'Communications Office',
  sanctuary: 'Sanctuary', nursery1: 'Nursery #1', music: 'Music Room',
  platform_back: 'Baptistry & Sound', storage: 'Platform Annex',
  conference: 'Conference Room', hallway: 'Hallway', nursery2: 'Nursery #2',
  nursery3: 'Nursery #3', mur_a: 'Volunteer Hub', mur_b: 'Data Room',
  fellowship: 'Fellowship Hall', admin_front: 'Front Office',
  admin_work: 'Admin Work Room', senior_pastor: "Pastor's Study",
  associate_pastor: 'Care Wing',
};

export function roleLabel(key: string): string {
  return ROLE_LABEL[key] ?? key;
}

/** "Today · 10:00 AM" / "Sun, Aug 30 · 2:00 PM" — never a bare ISO string. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}

/** A small colored dot — the area's own identity, independent of agent status. */
export function AreaAccentDot({ color, className = '' }: { color: string; className?: string }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`}
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

interface AreaPairingProps {
  area: AreaWithCounts;
  agents: AgentOption[];
  /** Show the campus row. Hidden on the campus itself — you're already there. */
  showRoom?: boolean;
  /** Click the room chip to walk there. */
  onOpenRoom?: (roomId: string) => void;
  compact?: boolean;
}

export function AreaPairing({ area, agents, showRoom = true, onOpenRoom, compact = false }: AreaPairingProps) {
  const agent = area.agent_key ? agents.find(a => a.key === area.agent_key) : null;
  const rowCls = 'flex items-start gap-2 min-w-0';
  const iconCls = 'shrink-0 mt-0.5 text-gray-400 dark:text-dark-500';
  const labelCls = 'text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500';

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'} data-testid={`area-pairing-${area.key}`}>
      {/* Accountable human — first, deliberately. */}
      <div className={rowCls}>
        <User size={13} className={iconCls} />
        <div className="min-w-0">
          {!compact && <p className={labelCls}>Accountable</p>}
          {area.owner ? (
            <p className="text-xs text-gray-800 dark:text-dark-100 truncate">
              <span className="font-medium">{area.owner.name}</span>
              {area.owner.title && <span className="text-gray-500 dark:text-dark-400"> · {area.owner.title}</span>}
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Nobody assigned — should be held by {roleLabel(area.default_role_key)}
            </p>
          )}
        </div>
      </div>

      {/* Supporting agent. */}
      <div className={rowCls}>
        <Bot size={13} className={iconCls} />
        <div className="min-w-0">
          {!compact && <p className={labelCls}>Supported by</p>}
          {agent ? (
            <p className="text-xs text-gray-800 dark:text-dark-100 truncate">
              {agent.name}
              {!agent.implemented && (
                <span className="text-gray-500 dark:text-dark-400"> · not yet built</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-dark-400">No agent — this area is human-only</p>
          )}
        </div>
      </div>

      {/* Campus location. */}
      {showRoom && (
        <div className={rowCls}>
          <MapPin size={13} className={iconCls} />
          <div className="min-w-0">
            {!compact && <p className={labelCls}>On campus</p>}
            {onOpenRoom ? (
              <button
                type="button"
                onClick={() => onOpenRoom(area.room_id)}
                className="text-xs text-brand-700 dark:text-brand-400 hover:underline truncate"
              >
                {ROOM_LABEL[area.room_id] ?? area.room_id}
              </button>
            ) : (
              <p className="text-xs text-gray-800 dark:text-dark-100 truncate">
                {ROOM_LABEL[area.room_id] ?? area.room_id}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Real work, counted live. Only shown when there is any. */}
      {area.open_work_orders > 0 && (
        <p className="text-[11px] text-gray-500 dark:text-dark-400 pl-5">
          {area.open_work_orders} open Work Order{area.open_work_orders === 1 ? '' : 's'}
          {area.unowned_work_orders > 0 && (
            <span className="text-amber-700 dark:text-amber-400 inline-flex items-center gap-1 ml-1">
              <AlertTriangle size={10} /> {area.unowned_work_orders} unowned
            </span>
          )}
        </p>
      )}

      {/* What's coming up here, from the church calendar. Only the soonest
          match within 14 days — never a stale or a guessed-category event. */}
      {area.next_event && (
        <div className={rowCls}>
          <CalendarClock size={13} className={iconCls} />
          <p className="text-[11px] text-gray-600 dark:text-dark-300 truncate">
            {area.next_event.title} — {formatWhen(area.next_event.start_date)}
          </p>
        </div>
      )}
    </div>
  );
}
