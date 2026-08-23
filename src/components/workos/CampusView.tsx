/**
 * Campus — the GRACE Virtual Campus tab.
 *
 * A 2D top-down model of the church (transcribed from the building's floor
 * plan) drawn on a canvas, with every room bound to the CRM surfaces that
 * department uses and every registered agent seated at a desk. Nothing on
 * the campus has a power the WorkOS does not already have: clicking a room
 * deep-links into existing hubs; "Run now" is the same call the Agent
 * Command Centre makes; statuses are the real `agent_runs` statuses.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Crosshair, Minus, Plus, Maximize2, ExternalLink, Lock, Moon, ArrowUpRight } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { useAgentCommandCentre, type AgentRegistryEntry } from '../../hooks/useAgentCommandCentre';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';
import { useDecisionQueue } from '../../hooks/useDecisionQueue';
import { useMinistryAreas } from '../../hooks/useMinistryAreas';
import { AreaPairing } from './AreaPairing';
import type { AreaSurface } from '../../lib/ministryAreas';
import { StatusBadge } from '../ui/StatusBadge';
import type { View } from '../../types';
import { CampusRenderer, type AgentStatusKind, type CampusAgent } from './campus/CampusRenderer';
import { ROOMS, roomById, type CampusRoom } from './campus/campusMap';
import { DEPARTMENTS, type CampusRoute } from './campus/campusBindings';
import { AGENT_SEATS, OVERFLOW_SEAT } from './campus/campusAssignments';

const STATUS_LABEL: Record<string, string> = {
  not_implemented: 'Not yet implemented',
  not_yet_run: 'Not yet run',
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Ran successfully',
  failed: 'Last run failed',
  cancelled: 'Cancelled',
};
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'urgent' | 'low' | 'default'> = {
  not_implemented: 'low', not_yet_run: 'default', queued: 'info', running: 'info', succeeded: 'success', failed: 'urgent', cancelled: 'low',
};

function statusKind(a: AgentRegistryEntry): AgentStatusKind {
  if (!a.implemented) return 'off';
  if (a.status === 'running' || a.status === 'queued') return 'running';
  if (a.status === 'succeeded') return 'live';
  if (a.status === 'failed') return 'failed';
  return 'idle';
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface CampusViewProps {
  setView: (v: View) => void;
  /** Room to open on mount, from #/workos?tab=campus&room=… */
  defaultRoom?: string | null;
  /**
   * Floating-window mode (the unified GRACE window): the canvas fills its
   * container, the room panel becomes an overlay on the map, and the
   * caption/legend chrome is dropped. Same component, same behaviour —
   * only the frame changes.
   */
  embedded?: boolean;
  /** Called after a surface link navigates the app (the window closes itself). */
  onNavigated?: () => void;
}

export function CampusView({ setView, defaultRoom, embedded = false, onNavigated }: CampusViewProps) {
  const { theme } = useTheme();
  const { agents, isLoading, error, forbidden, runningKey, runAgent } = useAgentCommandCentre();
  const { has } = useWorkOsPermissions();
  const { counts } = useDecisionQueue();
  const { areas, agents: agentOptions } = useMinistryAreas();
  const canManage = has('agents.manage');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CampusRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(defaultRoom ?? null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [hover, setHover] = useState<{ roomId: string | null; agentKey: string | null }>({ roomId: null, agentKey: null });
  const [visitorRoom, setVisitorRoom] = useState<string | null>('canopy');

  // Renderer lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let r: CampusRenderer;
    try {
      r = new CampusRenderer(canvas, {
      onSelectRoom: id => { setSelectedRoom(id); setSelectedAgent(null); },
      onSelectAgent: key => { setSelectedAgent(key); setSelectedRoom((AGENT_SEATS[key ?? ''] ?? OVERFLOW_SEAT).room); },
      onHover: setHover,
      onPlayerRoomChange: id => { setVisitorRoom(id); if (id) { setSelectedRoom(id); setSelectedAgent(null); } },
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'This browser cannot draw the campus.');
      return;
    }
    rendererRef.current = r;
    r.resize();
    const ro = new ResizeObserver(() => r.resize());
    ro.observe(canvas);
    r.load().then(() => setReady(true)).catch(err => setLoadError(err instanceof Error ? err.message : 'Could not load the campus atlas'));
    return () => { ro.disconnect(); r.destroy(); rendererRef.current = null; };
  }, []);

  useEffect(() => { rendererRef.current?.setTheme(theme); }, [theme]);

  // Where each agent currently works, from the ministry-area assignment —
  // so reassigning an area in Settings actually moves the character.
  const roomByAgentKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of areas) if (a.agent_key) m.set(a.agent_key, a.room_id);
    return m;
  }, [areas]);

  const campusAgents = useMemo<CampusAgent[]>(
    () => agents.map(a => ({ key: a.key, name: a.name, role: a.role, status: statusKind(a), room: roomByAgentKey.get(a.key) })),
    [agents, roomByAgentKey],
  );
  useEffect(() => { rendererRef.current?.setAgents(campusAgents); }, [campusAgents, ready]);
  useEffect(() => { rendererRef.current?.setSelection(selectedRoom, selectedAgent); }, [selectedRoom, selectedAgent]);

  const room: CampusRoom | null = selectedRoom ? roomById(selectedRoom) ?? null : null;
  // The ministry area assigned to this room is the north star. The static
  // department binding is only a fallback for rooms no area occupies.
  // A room may host more than one area (Giving and Impact Card share the
  // work room). Render all of them rather than silently showing the first.
  const areasInRoom = useMemo(() => areas.filter(a => a.room_id === room?.id), [areas, room?.id]);
  const area = areasInRoom[0] ?? null;
  const dept = room ? DEPARTMENTS[room.department] : null;
  const agentsInRoom = useMemo(
    () => agents.filter(a => (roomByAgentKey.get(a.key) ?? AGENT_SEATS[a.key]?.room ?? OVERFLOW_SEAT.room) === room?.id),
    [agents, roomByAgentKey, room?.id],
  );
  const agent = selectedAgent ? agents.find(a => a.key === selectedAgent) ?? null : null;
  const deskCount = areasInRoom.reduce(
    (total, a) => total + a.queueKinds.reduce((n, k) => n + (counts.by_kind[k as keyof typeof counts.by_kind] ?? 0), 0),
    0,
  );
  const surfaces: (CampusRoute | AreaSurface)[] = areasInRoom.length
    ? areasInRoom.flatMap(a => a.surfaces)
    : (dept?.routes ?? []);

  const go = useCallback((route: CampusRoute | AreaSurface) => {
    setView(route.view as View);
    window.history.replaceState(null, '', route.hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    // In the floating GRACE window the campus is a launcher at this moment:
    // the destination is behind the window, so the host closes it.
    onNavigated?.();
  }, [setView, onNavigated]);

  const focus = useCallback((roomId: string) => {
    setSelectedRoom(roomId); setSelectedAgent(null);
    rendererRef.current?.focusRoom(roomId, Math.max(rendererRef.current.zoom, 0.9));
  }, []);

  if (forbidden) {
    return (
      <div className="p-6 text-sm text-gray-600 dark:text-dark-300">
        Your role doesn't include Agent Command Centre access, which the campus is built on. Contact a System Administrator if you believe this is wrong.
      </div>
    );
  }

  const hoverRoom = hover.roomId ? roomById(hover.roomId) : null;

  return (
    <div className={embedded ? 'h-full' : 'p-4 sm:p-6'}>
      <div className={embedded ? 'h-full relative' : 'flex flex-col lg:flex-row gap-4'}>
        {/* Map */}
        <div className={embedded ? 'h-full' : 'flex-1 min-w-0'}>
          <div
            className={`relative overflow-hidden bg-slate-100 dark:bg-dark-900 ${embedded ? 'h-full' : 'rounded-xl border border-gray-200 dark:border-dark-700'}`}
            style={embedded ? undefined : { height: 'min(72vh, 760px)' }}
          >
            <canvas ref={canvasRef} className="w-full h-full block" aria-label="Map of the church campus. Use the arrow keys to walk, drag to pan, scroll to zoom, click a room or an agent for details." tabIndex={0} />
            {!ready && !loadError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 dark:text-dark-400">Loading the campus…</div>
            )}
            {loadError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-brand-600 dark:text-brand-400 px-6 text-center">{loadError}</div>
            )}
            {/* controls */}
            <div className="absolute top-3 right-3 flex flex-col gap-1">
              <button type="button" title="Zoom in" onClick={() => rendererRef.current?.zoomBy(1.25)} className="w-8 h-8 rounded-lg bg-white/90 dark:bg-dark-850/90 border border-gray-200 dark:border-dark-700 flex items-center justify-center text-gray-700 dark:text-dark-200"><Plus size={14} /></button>
              <button type="button" title="Zoom out" onClick={() => rendererRef.current?.zoomBy(0.8)} className="w-8 h-8 rounded-lg bg-white/90 dark:bg-dark-850/90 border border-gray-200 dark:border-dark-700 flex items-center justify-center text-gray-700 dark:text-dark-200"><Minus size={14} /></button>
              <button type="button" title="Fit the whole campus" onClick={() => rendererRef.current?.fitAll()} className="w-8 h-8 rounded-lg bg-white/90 dark:bg-dark-850/90 border border-gray-200 dark:border-dark-700 flex items-center justify-center text-gray-700 dark:text-dark-200"><Maximize2 size={14} /></button>
              <button type="button" title="Find me" onClick={() => visitorRoom && rendererRef.current?.focusRoom(visitorRoom, 1)} className="w-8 h-8 rounded-lg bg-white/90 dark:bg-dark-850/90 border border-gray-200 dark:border-dark-700 flex items-center justify-center text-gray-700 dark:text-dark-200"><Crosshair size={14} /></button>
            </div>
            {/* hover hint */}
            <div className="absolute left-3 bottom-3 text-[11px] px-2 py-1 rounded-md bg-white/85 dark:bg-dark-850/85 border border-gray-200 dark:border-dark-700 text-gray-600 dark:text-dark-300 pointer-events-none">
              {hover.agentKey ? `Agent: ${agents.find(a => a.key === hover.agentKey)?.name ?? hover.agentKey}` : hoverRoom ? (hoverRoom.name || 'Hallway') : 'Arrow keys to walk · drag to pan · scroll to zoom'}
            </div>
          </div>
          {!embedded && <p className="mt-2 text-xs text-gray-500 dark:text-dark-400">
            Drawn from the church's floor plan at 1 tile = 2.5 ft. Rooms are bound to the CRM surfaces their department uses; pips are the real registry statuses
            (green ran, amber built but never run, grey not built). The Care Wing is tinted and dashed because it is confidential-tier.
          </p>}
          {error && <p className={embedded ? 'absolute top-3 left-3 z-10 text-xs text-brand-600 dark:text-brand-400 bg-white/90 dark:bg-dark-850/90 rounded-md px-2 py-1' : 'mt-1 text-xs text-brand-600 dark:text-brand-400'}>{error}</p>}
          {/* Legend */}
          {!embedded && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600 dark:text-dark-300">
            <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#1F8A5B' }} /> ran successfully</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#B7791F' }} /> built, never run</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#8B94A8' }} /> registered, not built</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#4E9BE8' }} /> running</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#C2413F' }} /> last run failed</span>
          </div>}
        </div>

        {/* Side panel — an overlay card on the map when embedded */}
        <aside className={embedded
          ? `absolute top-3 left-3 z-10 w-[300px] max-w-[calc(100%-96px)] max-h-[calc(100%-24px)] overflow-y-auto space-y-3 ${room ? '' : 'hidden'}`
          : 'w-full lg:w-[340px] shrink-0 space-y-3'}>
          {!embedded && !room && !agent && (
            <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">Walk the campus</p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                You start under the canopy. Walk in with the arrow keys or click any room. Every building is a department of the church office; the panel shows what that department runs in GRACE and who sits there.
              </p>
              <ul className="mt-3 space-y-1 max-h-[46vh] overflow-y-auto pr-1">
                {ROOMS.filter(r => r.name).map(r => {
                  const d = DEPARTMENTS[r.department];
                  const n = agents.filter(a => (AGENT_SEATS[a.key] ?? OVERFLOW_SEAT).room === r.id).length;
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => focus(r.id)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-800 flex items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-gray-800 dark:text-dark-100 truncate">{r.name}</span>
                          <span className="block text-[11px] text-gray-500 dark:text-dark-400 truncate">{d?.name}</span>
                        </span>
                        {n > 0 && <span className="text-[11px] text-gray-500 dark:text-dark-400 inline-flex items-center gap-1 shrink-0"><Bot size={11} />{n}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {room && dept && (
            <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4" data-testid="campus-room-panel">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-1.5">
                    {room.name || 'Hallway'}
                    {(area?.confidential ?? dept.confidential) && <Lock size={12} className="text-violet-600 dark:text-violet-400" aria-label="Confidential-tier" />}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-dark-400">
                    {areasInRoom.length ? areasInRoom.map(a => a.name).join(' · ') : dept.name}
                    {room.planName ? ` · plan: ${room.planName}` : ''}
                  </p>
                </div>
                {deskCount > 0 && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 shrink-0" title="Items on this desk in the Decision Queue">{deskCount} waiting</span>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-dark-300 mt-2">{area?.purpose ?? dept.blurb}</p>

              {/* The pairing — identical markup to the WorkOS Overview. */}
              {areasInRoom.map((a, i) => (
                <div key={a.key} className="mt-3 pt-3 border-t border-gray-100 dark:border-dark-800">
                  {areasInRoom.length > 1 && (
                    <p className="text-xs font-medium text-gray-800 dark:text-dark-100 mb-1.5">{a.name}</p>
                  )}
                  {i > 0 && <p className="text-xs text-gray-600 dark:text-dark-300 mb-2">{a.purpose}</p>}
                  <AreaPairing area={a} agents={agentOptions} showRoom={false} />
                </div>
              ))}

              {surfaces.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 mb-1">In GRACE</p>
                  <ul className="space-y-1">
                    {surfaces.map(rt => (
                      <li key={rt.hash}>
                        <button type="button" onClick={() => go(rt)} className="w-full text-left text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-dark-700 hover:bg-slate-50 dark:hover:bg-dark-800 flex items-center justify-between gap-2 text-gray-800 dark:text-dark-100">
                          <span className="truncate">{rt.label}</span>
                          <span className="inline-flex items-center gap-1 shrink-0 text-gray-400 dark:text-dark-500">
                            {rt.permission && <span className="text-[10px] font-mono hidden sm:inline">{rt.permission}</span>}
                            <ArrowUpRight size={12} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 mb-1">Who sits here</p>
                {isLoading && <p className="text-xs text-gray-500 dark:text-dark-400">Loading agent registry…</p>}
                {!isLoading && agentsInRoom.length === 0 && !dept.nightCrew && (
                  <p className="text-xs text-gray-400 dark:text-dark-500">No agent is seated here. That is the honest state, not a placeholder.</p>
                )}
                <ul className="space-y-1.5">
                  {agentsInRoom.map(a => (
                    <li key={a.key}>
                      <button type="button" onClick={() => setSelectedAgent(a.key)} className={`w-full text-left px-2 py-1.5 rounded-lg border flex items-center justify-between gap-2 ${selectedAgent === a.key ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-dark-700 hover:bg-slate-50 dark:hover:bg-dark-800'}`}>
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-gray-800 dark:text-dark-100 truncate">{a.name}</span>
                          <span className="block text-[11px] text-gray-500 dark:text-dark-400 truncate">{a.role}</span>
                        </span>
                        <StatusBadge size="sm" variant={STATUS_VARIANT[a.status] ?? 'default'}>{STATUS_LABEL[a.status] ?? a.status}</StatusBadge>
                      </button>
                    </li>
                  ))}
                </ul>
                {dept.nightCrew && (
                  <div className="mt-2 text-[11px] text-gray-500 dark:text-dark-400">
                    <p className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-dark-200"><Moon size={11} /> The Night Crew · nightly 07:00 UTC</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {dept.nightCrew.map(k => <span key={k} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-800 font-mono">{k}</span>)}
                    </div>
                    <p className="mt-1">Cron agents outside the registry. They leave tasks and findings; their precision cards are on the Agents tab.</p>
                  </div>
                )}
              </div>

              {agent && (
                <div className="mt-3 rounded-lg border border-gray-200 dark:border-dark-700 p-3 bg-slate-50 dark:bg-dark-800" data-testid="campus-agent-panel">
                  <p className="text-xs font-semibold text-gray-900 dark:text-dark-100">{agent.name} <span className="font-normal text-gray-500 dark:text-dark-400">· {agent.role}</span></p>
                  <p className="text-xs text-gray-600 dark:text-dark-300 mt-1">{agent.description}</p>
                  {agent.latest_run ? (
                    <div className="mt-2 text-[11px] text-gray-500 dark:text-dark-400 space-y-0.5">
                      <p>Last run: {formatTime(agent.latest_run.finished_at ?? agent.latest_run.started_at)}</p>
                      {agent.latest_run.output?.summary && <p className="text-gray-700 dark:text-dark-200">{agent.latest_run.output.summary}</p>}
                      {agent.latest_run.error && <p className="text-brand-600 dark:text-brand-400">{agent.latest_run.error}</p>}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-gray-400 dark:text-dark-500">{agent.implemented ? 'No executions recorded yet.' : 'This agent workflow has not been built yet.'}</p>
                  )}
                  {canManage && agent.implemented && (
                    <button type="button" onClick={() => void runAgent(agent.key)} disabled={runningKey === agent.key} className="mt-2 w-full px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-dark-200 disabled:opacity-50 bg-white dark:bg-dark-850">
                      {runningKey === agent.key ? 'Running…' : 'Run now'}
                    </button>
                  )}
                  <button type="button" onClick={() => go({ label: 'Agents', view: 'workos', hash: '#/workos?tab=agents' })} className="mt-2 w-full text-[11px] text-gray-500 dark:text-dark-400 inline-flex items-center justify-center gap-1 hover:underline">
                    Open in Agent Command Centre <ExternalLink size={11} />
                  </button>
                </div>
              )}

              <button type="button" onClick={() => { setSelectedRoom(null); setSelectedAgent(null); }} className="mt-3 text-[11px] text-gray-500 dark:text-dark-400 hover:underline">← All rooms</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
