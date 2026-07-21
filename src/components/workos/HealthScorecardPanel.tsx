/**
 * Congregational Health scorecard — church-level north stars with real
 * trend sparklines (weekly points from health_snapshots), an honest
 * "needs more data" state for anything not_yet_computed, and an
 * at-risk member drill-down. Sits directly under the Decision Queue in
 * the WorkOS Overview.
 */
import { useState } from 'react';
import { HeartPulse, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useCongregationalHealth } from '../../hooks/useCongregationalHealth';
import type { CurrentHealthMetrics, HealthSnapshotRow } from '../../hooks/useCongregationalHealth';

/** ISO 8601 week key (e.g. "2026-W29") — used to reduce daily snapshots to one point per week. */
function isoWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weeklyPoints(snapshots: HealthSnapshotRow[], key: keyof CurrentHealthMetrics): number[] {
  const byWeek = new Map<string, { date: string; value: number }>();
  for (const row of snapshots) {
    const metric = row.metrics[key];
    if (!metric || metric.value === null) continue;
    const weekKey = isoWeekKey(row.snapshot_date);
    const existing = byWeek.get(weekKey);
    if (!existing || row.snapshot_date > existing.date) {
      byWeek.set(weekKey, { date: row.snapshot_date, value: metric.value });
    }
  }
  return Array.from(byWeek.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(p => p.value);
}

function Sparkline({ points }: { points: number[] }) {
  const w = 100;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = points.length > 1 ? w / (points.length - 1) : 0;
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX},${h - ((p - min) / range) * h}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7 text-indigo-500 dark:text-indigo-400">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function formatHours(hours: number): string {
  if (hours < 1) return '<1h';
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

const TILES: {
  key: keyof CurrentHealthMetrics;
  label: string;
  format: (value: number) => string;
}[] = [
  { key: 'visitor_conversion_90d', label: 'Visitor → Member (90d)', format: v => `${v}%` },
  { key: 'recurring_coverage', label: 'Recurring Giving Coverage', format: v => `${v}%` },
  { key: 'group_participation', label: 'Group Participation', format: v => `${v}%` },
  { key: 'portal_adoption', label: 'Portal Adoption', format: v => `${v}%` },
  { key: 'care_responsiveness', label: 'Open Care Request Age', format: formatHours },
  { key: 'engagement', label: 'Engagement Score', format: v => `${v}` },
];

function formatAge(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function HealthScorecardPanel() {
  const { current, snapshots, atRisk, isLoading, error, forbidden } = useCongregationalHealth();
  const [showAtRisk, setShowAtRisk] = useState(false);

  if (forbidden) return null;
  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6 mb-4">
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-1.5">
          <HeartPulse size={15} className="text-rose-500" /> Congregational Health
        </h2>
        {!isLoading && current && (
          <button
            onClick={() => setShowAtRisk(v => !v)}
            className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-lg"
          >
            <AlertTriangle size={12} />
            {current.engagement.at_risk_count} at risk
            {showAtRisk ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-dark-500 mb-3">
        Engagement measures platform activity, never spiritual standing.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-100 dark:bg-dark-800 animate-pulse" />
          ))}
        </div>
      ) : current ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TILES.map(tile => {
            const metric = current[tile.key];
            const points = weeklyPoints(snapshots, tile.key);
            return (
              <div
                key={tile.key}
                data-testid={`health-tile-${tile.key}`}
                className="rounded-xl border border-gray-200 dark:border-dark-700 p-4"
              >
                <p className="text-xs font-medium text-gray-500 dark:text-dark-400">{tile.label}</p>
                {metric.source === 'not_yet_computed' ? (
                  <p className="text-sm text-gray-400 dark:text-dark-500 mt-1 italic">Needs more data</p>
                ) : (
                  <>
                    <p className="stat-number text-2xl text-gray-900 dark:text-dark-100 mt-1">
                      {tile.format(metric.value as number)}
                    </p>
                    {points.length >= 2 ? (
                      <Sparkline points={points} />
                    ) : (
                      <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-2">
                        Trends appear after two weeks of snapshots
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {showAtRisk && (
        <div className="mt-4 border-t border-gray-100 dark:border-dark-800 pt-3">
          {atRisk.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-dark-400">No members currently at risk of disengaging.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-dark-800">
              {atRisk.map(person => (
                <a
                  key={person.id}
                  href={`#/person/${person.id}`}
                  className="flex items-center justify-between py-2 hover:bg-gray-50 dark:hover:bg-dark-800 rounded-lg px-2 -mx-2"
                >
                  <span className="text-sm text-gray-900 dark:text-dark-100">{person.name}</span>
                  <span className="text-xs text-gray-400 dark:text-dark-500">
                    Last active {formatAge(person.last_activity_at)}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
