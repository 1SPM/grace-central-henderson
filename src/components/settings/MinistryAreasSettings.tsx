/**
 * Settings → Ministry Areas.
 *
 * Where a pastor decides the three things the Campus and the WorkOS both
 * display: who is accountable for an area, which agent supports them, and
 * where the area sits on the campus.
 *
 * What this screen will not do:
 *   - invent a person. The staff picker lists real `users` rows for this
 *     church; if there are none it says so rather than offering placeholders.
 *   - pretend a default is a decision. Links nobody has set are labelled
 *     "default" until someone chooses.
 *   - hide the consequence. Reassigning an agent moves it on the 2D campus,
 *     and the copy says so.
 *
 * Every save is permission-checked (`admin.manage_settings`) and audited
 * server-side; this screen only hides controls the caller cannot use.
 */
import { useState } from 'react';
import { Compass, Lock, MapPin, RotateCcw } from 'lucide-react';
import { useMinistryAreas } from '../../hooks/useMinistryAreas';
import { ROOM_LABEL, roleLabel } from '../workos/AreaPairing';

export function MinistryAreasSettings() {
  const { areas, staff, agents, rooms, canManage, isLoading, error, forbidden, savingKey, reassign } = useMinistryAreas();
  const [justSaved, setJustSaved] = useState<string | null>(null);

  async function save(areaKey: string, patch: Parameters<typeof reassign>[1]) {
    const ok = await reassign(areaKey, patch);
    if (ok) {
      setJustSaved(areaKey);
      window.setTimeout(() => setJustSaved(k => (k === areaKey ? null : k)), 2000);
    }
  }

  if (forbidden) {
    return (
      <div className="p-6 text-sm text-gray-600 dark:text-dark-300">
        Your role doesn&apos;t include access to the ministry map. Contact a System Administrator if you believe this is wrong.
      </div>
    );
  }
  if (isLoading) return <div className="p-6 text-sm text-gray-500 dark:text-dark-400">Loading the ministry map…</div>;

  const selectCls =
    'text-xs rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-850 text-gray-800 dark:text-dark-100 px-2 py-1.5 w-full disabled:opacity-50';
  const labelCls = 'block text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 mb-1';

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-1.5">
          <Compass size={16} className="text-gray-400 dark:text-dark-500" /> Ministry areas
        </h2>
        <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
          Each area of church operations has one accountable person, an optional supporting agent, and a place on the campus.
          These choices drive both the Campus map and the WorkOS — change them here and both update.
        </p>
      </div>

      {error && <p className="text-xs text-brand-600 dark:text-brand-400 mb-3">{error}</p>}

      {!canManage && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
          You can see the map, but changing it needs the Manage Settings permission.
        </p>
      )}

      {staff.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
          No active staff accounts in this church yet, so there is nobody to make accountable.
          Invite staff under Settings → General → Team first.
        </p>
      )}

      <ul className="space-y-3">
        {areas.map(area => {
          const busy = savingKey === area.key;
          return (
            <li
              key={area.key}
              className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4"
              data-testid={`area-settings-${area.key}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-1.5">
                    {area.name}
                    {area.confidential && <Lock size={11} className="text-violet-600 dark:text-violet-400" aria-label="Confidential-tier" />}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">{area.purpose}</p>
                  <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-1">
                    Work Orders tagged “{area.ministry}”
                    {area.open_work_orders > 0 && ` · ${area.open_work_orders} open`}
                    {area.unowned_work_orders > 0 && ` · ${area.unowned_work_orders} unowned`}
                  </p>
                </div>
                {justSaved === area.key && <span className="text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0">Saved</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {/* Accountable human */}
                <div>
                  <label className={labelCls} htmlFor={`owner-${area.key}`}>
                    Accountable {area.source.owner === 'default' && <span className="normal-case text-gray-400">· unset</span>}
                  </label>
                  <select
                    id={`owner-${area.key}`}
                    className={selectCls}
                    disabled={!canManage || busy || staff.length === 0}
                    value={area.owner?.user_id ?? ''}
                    onChange={e => void save(area.key, { owner_user_id: e.target.value || null })}
                  >
                    <option value="">Nobody yet — should be {roleLabel(area.default_role_key)}</option>
                    {staff.map(s => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.name}{s.title ? ` · ${s.title}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Supporting agent */}
                <div>
                  <label className={labelCls} htmlFor={`agent-${area.key}`}>
                    Supported by {area.source.agent === 'default' && <span className="normal-case text-gray-400">· default</span>}
                  </label>
                  <select
                    id={`agent-${area.key}`}
                    className={selectCls}
                    disabled={!canManage || busy}
                    value={area.agent_key ?? ''}
                    onChange={e => void save(area.key, { agent_key: e.target.value || null })}
                  >
                    <option value="">No agent — human only</option>
                    {agents.map(a => (
                      <option key={a.key} value={a.key}>
                        {a.name}{a.implemented ? '' : ' (not yet built)'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Campus location */}
                <div>
                  <label className={labelCls} htmlFor={`room-${area.key}`}>
                    On campus {area.source.room === 'default' && <span className="normal-case text-gray-400">· default</span>}
                  </label>
                  <select
                    id={`room-${area.key}`}
                    className={selectCls}
                    disabled={!canManage || busy}
                    value={area.room_id}
                    onChange={e => void save(area.key, { campus_room: e.target.value })}
                  >
                    {rooms.map(r => (
                      <option key={r} value={r}>{ROOM_LABEL[r] ?? r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 mt-2">
                <p className="text-[11px] text-gray-400 dark:text-dark-500 inline-flex items-center gap-1">
                  <MapPin size={10} /> The supporting agent stands in this room on the Campus map.
                </p>
                {canManage && (area.source.agent === 'assigned' || area.source.room === 'assigned') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(area.key, { agent_key: null, campus_room: null })}
                    className="text-[11px] text-gray-500 dark:text-dark-400 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <RotateCcw size={10} /> Reset agent &amp; room to default
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
