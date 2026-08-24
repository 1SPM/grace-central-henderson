/**
 * Ministry Areas — the operational map, on the WorkOS side.
 *
 * The same pairing the Campus shows when you walk into a room, listed for
 * the whole church: area → accountable human → supporting agent → campus
 * location. One hook, one component (`AreaPairing`), so the two entry
 * points cannot disagree.
 *
 * Read-only. Reassignment lives in Settings → Ministry Areas, because
 * changing who is accountable is a settings decision, not a dashboard click.
 */
import { Compass, ArrowUpRight, Lock, SlidersHorizontal } from 'lucide-react';
import { useMinistryAreas } from '../../hooks/useMinistryAreas';
import { AreaPairing, AreaAccentDot } from './AreaPairing';
import { campusHash } from '../../lib/workosNav';
import { settingsHash } from '../../lib/settingsNav';
import type { View } from '../../types';
import { primarySurface } from '../../lib/ministryAreas';

interface MinistryAreasPanelProps {
  setView: (v: View) => void;
}

export function MinistryAreasPanel({ setView }: MinistryAreasPanelProps) {
  const { areas, agents, isLoading, error, forbidden } = useMinistryAreas();

  function navigate(view: View, hash: string) {
    setView(view);
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }

  if (forbidden) return null;

  const unowned = areas.filter(a => !a.owner).length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4" data-testid="ministry-areas-panel">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-1.5">
            <Compass size={14} className="text-gray-400 dark:text-dark-500" /> Ministry areas
          </h3>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
            Who is accountable for each part of the church, which agent supports them, and where it sits on the campus.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('settings', settingsHash('ministry-areas'))}
          className="text-[11px] inline-flex items-center gap-1 text-gray-500 dark:text-dark-400 hover:underline shrink-0"
        >
          <SlidersHorizontal size={11} /> Reassign
        </button>
      </div>

      {unowned > 0 && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">
          {unowned} area{unowned === 1 ? '' : 's'} without an accountable person.
        </p>
      )}
      {isLoading && <p className="text-xs text-gray-500 dark:text-dark-400">Loading the ministry map…</p>}
      {error && <p className="text-xs text-brand-600 dark:text-brand-400">{error}</p>}

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
        {areas.map(area => {
          const primary = primarySurface(area);
          return (
            <li
              key={area.key}
              className="rounded-lg border border-gray-200 dark:border-dark-700 p-3 border-l-[3px]"
              style={{ borderLeftColor: area.accent_color }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-1.5">
                    <AreaAccentDot color={area.accent_color} />
                    {area.name}
                    {area.confidential && <Lock size={10} className="text-violet-600 dark:text-violet-400" aria-label="Confidential-tier" />}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-dark-400 truncate">Work Orders tagged “{area.ministry}”</p>
                </div>
                {primary && (
                  <button
                    type="button"
                    onClick={() => navigate(primary.view as View, primary.hash)}
                    title={`Open ${primary.label}`}
                    className="text-gray-400 dark:text-dark-500 hover:text-gray-700 dark:hover:text-dark-200 shrink-0"
                  >
                    <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
              <AreaPairing
                area={area}
                agents={agents}
                compact
                onOpenRoom={roomId => navigate('workos', campusHash(roomId))}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
