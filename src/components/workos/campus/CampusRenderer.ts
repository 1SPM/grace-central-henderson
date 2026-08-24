/**
 * CampusRenderer — a small Canvas 2D engine for the GRACE Virtual Campus.
 *
 * Responsibilities (and nothing else):
 *   - paint the floor plan (floors, walls, doors) from campusMap.ts once
 *   - each frame: y-sorted furniture + characters, status rings, labels,
 *     hover/selection highlights
 *   - camera (pan/zoom), hit-testing (room under cursor, agent under cursor)
 *   - agents idling/wandering inside their rooms; the visitor walking with
 *     the arrow keys and bumping into walls and furniture
 *
 * It knows nothing about the CRM. The React wrapper (CampusView.tsx) feeds
 * it agent statuses and listens for selection events.
 */
import atlasData from './atlas.json';
import {
  ROOMS, FURNITURE, FLOOR_PATCHES, buildGrid, TILE, GRID_W, GRID_H, Cell, idx, inBounds,
  spriteFootprint, type CampusGrid, type CampusRoom,
} from './campusMap';
import { AGENT_SEATS, OVERFLOW_SEAT, PLAYER_START, type AgentSeat } from './campusAssignments';

type SpriteRect = { x: number; y: number; w: number; h: number };
interface AtlasJson {
  image: string; tile: number; width: number; height: number;
  sprites: Record<string, SpriteRect>;
  characters: Record<string, { idle: string; walk: string; frameW: number; frameH: number; framesPerDir: number; dirs: string[] }>;
}
const ATLAS = atlasData as AtlasJson;

export type AgentStatusKind = 'live' | 'idle' | 'off' | 'running' | 'failed';
export interface CampusAgent {
  key: string;
  name: string;
  role: string;
  status: AgentStatusKind;
  /**
   * Room this agent currently works in, from the ministry-area assignment
   * (Settings → Ministry Areas). Overrides the default seat in
   * campusAssignments.ts, so reassigning an area on the WorkOS side actually
   * moves the character on the map.
   */
  room?: string;
}

export type Facing = 'up' | 'down' | 'left' | 'right';
const DIR_INDEX: Record<Facing, number> = { right: 0, up: 1, left: 2, down: 3 };

export interface RendererEvents {
  onSelectRoom?: (roomId: string | null) => void;
  onSelectAgent?: (agentKey: string | null) => void;
  onHover?: (hover: { roomId: string | null; agentKey: string | null }) => void;
  onPlayerRoomChange?: (roomId: string | null) => void;
}

interface Actor {
  key: string;
  name: string;
  seat: AgentSeat;
  x: number; y: number;          // world px, feet anchor (tile top-left)
  tx: number; ty: number;        // target world px
  facing: Facing;
  moving: boolean;
  nextDecisionAt: number;
  animT: number;
  status: AgentStatusKind;
  isOrb: boolean;
}

const WALK_SPEED = TILE * 2.2;   // px per second (agents)
const PLAYER_SPEED = TILE * 4.5; // px per second (visitor)
const BOUNCE_DURATION = 0.7;     // seconds — the "a finding just landed" pulse

/**
 * The eased lift+scale for a bounce that started `elapsed` seconds ago.
 * Pure and exported so the animation curve is unit-testable without a
 * canvas: a full sine arc (0 -> 1 -> 0) over BOUNCE_DURATION, peaking at a
 * 10px lift and 18% scale-up halfway through. Returns null once finished.
 */
export function computeBounce(elapsed: number, duration = BOUNCE_DURATION): { lift: number; scale: number } | null {
  if (elapsed < 0 || elapsed >= duration) return null;
  const wave = Math.sin((elapsed / duration) * Math.PI);
  return { lift: -wave * 10, scale: 1 + wave * 0.18 };
}

const THEME = {
  light: { grass: '#cfe3c3', grassDot: '#bcd4ad', path: '#d9dde8', outside: '#e5e9f2', label: '#1c2434', labelBg: 'rgba(255,255,255,0.82)', wallCap: '#f6f3ea', wallShade: 'rgba(20,24,40,0.18)', select: '#3B53BB', hover: 'rgba(59,83,187,0.18)', confidential: 'rgba(124,58,237,0.10)' },
  dark:  { grass: '#1f2a26', grassDot: '#27352f', path: '#2a3142', outside: '#151a26', label: '#f1f4fa', labelBg: 'rgba(18,24,39,0.86)', wallCap: '#3a4258', wallShade: 'rgba(0,0,0,0.35)', select: '#8FA3F2', hover: 'rgba(143,163,242,0.18)', confidential: 'rgba(182,156,247,0.12)' },
};
const STATUS_COLOR: Record<AgentStatusKind, string> = { live: '#1F8A5B', idle: '#B7791F', off: '#8B94A8', running: '#4E9BE8', failed: '#C2413F' };

export class CampusRenderer {
  private ctx: CanvasRenderingContext2D;
  private atlas: HTMLImageElement | null = null;
  private grid: CampusGrid;
  private staticLayer: HTMLCanvasElement | null = null;
  private actors: Actor[] = [];
  private player: { x: number; y: number; facing: Facing; moving: boolean; animT: number; character: number; roomId: string | null };
  private keys = new Set<string>();
  private cam = { x: 0, y: 0, zoom: 0.6 };
  private dpr = 1;
  private raf = 0;
  private last = 0;
  private hoverRoom: string | null = null;
  private hoverAgent: string | null = null;
  private selectedRoom: string | null = null;
  private selectedAgent: string | null = null;
  private dragging = false;
  private dragStart = { x: 0, y: 0, cx: 0, cy: 0 };
  private dragMoved = false;
  private theme: 'light' | 'dark' = 'light';
  private destroyed = false;
  private ready = false;
  private roomMeta = new Map<string, { colors: string[]; hasEvent: boolean }>();
  private bounceEndAt = new Map<string, number>();
  private furnitureSorted = FURNITURE.filter(f => !f.decor).slice().sort((a, b) => (a.y + spriteFootprint(a.sprite).h) - (b.y + spriteFootprint(b.sprite).h));

  constructor(private canvas: HTMLCanvasElement, private events: RendererEvents = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    this.grid = buildGrid();
    this.player = { x: PLAYER_START.tile.x * TILE, y: PLAYER_START.tile.y * TILE, facing: PLAYER_START.facing, moving: false, animT: 0, character: PLAYER_START.character, roomId: PLAYER_START.room };
    this.bindInput();
  }

  // ---------------------------------------------------------------- lifecycle
  async load(): Promise<void> {
    const img = new Image();
    img.decoding = 'async';
    img.src = ATLAS.image;
    await img.decode().catch(() => new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('atlas failed to load')); }));
    this.atlas = img;
    this.buildStaticLayer();
    this.ready = true;
    this.fitToWidth();
    this.start();
  }

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (t: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.update(dt);
      this.draw(t / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.unbindInput();
  }

  setTheme(theme: 'light' | 'dark'): void {
    if (this.theme === theme) return;
    this.theme = theme;
    if (this.ready) this.buildStaticLayer();
  }

  /** Resize backing store to the canvas's CSS size. */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.clampCamera();
  }

  // ----------------------------------------------------------------- agents
  setAgents(agents: CampusAgent[]): void {
    const byKey = new Map(this.actors.map(a => [a.key, a]));
    const next: Actor[] = [];
    const taken = new Set<number>();
    let overflow = 0;

    for (const a of agents) {
      const base = AGENT_SEATS[a.key] ?? {
        ...OVERFLOW_SEAT,
        tile: { x: OVERFLOW_SEAT.tile.x + (overflow++ % 3), y: OVERFLOW_SEAT.tile.y + Math.floor(overflow / 3) },
      };
      // The assigned room wins over the default seat; the character and
      // facing stay with the agent so it stays recognisable when it moves.
      const seat: AgentSeat = a.room && a.room !== base.room
        ? { ...base, room: a.room, tile: this.seatInRoom(a.room, taken) ?? base.tile }
        : base;
      taken.add(idx(seat.tile.x, seat.tile.y));

      const existing = byKey.get(a.key);
      if (existing) {
        existing.status = a.status;
        existing.name = a.name;
        if (existing.seat.room !== seat.room) {
          // Reassigned while the map was open — walk them to the new desk.
          existing.seat = seat;
          existing.tx = seat.tile.x * TILE;
          existing.ty = seat.tile.y * TILE;
          existing.x = existing.tx;
          existing.y = existing.ty;
          existing.moving = false;
        }
        next.push(existing);
        continue;
      }

      const x = seat.tile.x * TILE, y = seat.tile.y * TILE;
      next.push({
        key: a.key, name: a.name, seat, x, y, tx: x, ty: y,
        facing: seat.facing ?? 'down', moving: false,
        nextDecisionAt: 1 + Math.random() * 3, animT: Math.random() * 10,
        status: a.status, isOrb: a.key === 'grace',
      });
    }
    this.actors = next;
  }

  /**
   * A free standing tile inside a room, scanned in a stable order so the
   * same assignment always produces the same desk. Returns null when the
   * room has no walkable tile left (caller keeps the default seat).
   */
  private seatInRoom(roomId: string, taken: Set<number>): { x: number; y: number } | null {
    const room = ROOMS.find(r => r.id === roomId);
    if (!room) return null;
    const ri = ROOMS.indexOf(room);
    for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
      for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
        const k = idx(x, y);
        if (this.grid.solid[k] || this.grid.roomAt[k] !== ri || taken.has(k)) continue;
        return { x, y };
      }
    }
    return null;
  }

  setSelection(roomId: string | null, agentKey: string | null): void {
    this.selectedRoom = roomId;
    this.selectedAgent = agentKey;
  }

  /**
   * Per-room ministry-area identity: an accent color strip under the room
   * label (never on a status pip — that channel stays semantic-only) and
   * whether something from the church calendar is coming up here soon.
   * Rooms shared by more than one area (e.g. Giving + Impact Card) get one
   * strip segment per area rather than picking a winner.
   */
  setRoomMeta(entries: { roomId: string; color: string; hasEvent: boolean }[]): void {
    const next = new Map<string, { colors: string[]; hasEvent: boolean }>();
    for (const e of entries) {
      const cur = next.get(e.roomId) ?? { colors: [], hasEvent: false };
      cur.colors.push(e.color);
      cur.hasEvent = cur.hasEvent || e.hasEvent;
      next.set(e.roomId, cur);
    }
    this.roomMeta = next;
  }

  /** A brief lift-and-scale pulse — the agent equivalent of Gather's "wave",
   *  used to draw the eye to a finding without a modal. Safe to call for an
   *  agent not currently on screen; it is simply a no-op. */
  bounce(agentKey: string): void {
    if (!this.actors.some(x => x.key === agentKey)) return;
    this.bounceEndAt.set(agentKey, performance.now() / 1000 + BOUNCE_DURATION);
  }

  /** Pan the camera so a room is centred. */
  focusRoom(roomId: string, zoom?: number): void {
    const room = ROOMS.find(r => r.id === roomId);
    if (!room) return;
    if (zoom) this.cam.zoom = zoom;
    const cx = (room.rect.x + room.rect.w / 2) * TILE;
    const cy = (room.rect.y + room.rect.h / 2) * TILE;
    this.cam.x = cx - this.viewW() / 2 / this.cam.zoom;
    this.cam.y = cy - this.viewH() / 2 / this.cam.zoom;
    this.clampCamera();
  }

  fitToWidth(): void {
    const z = Math.max(0.25, this.viewW() / (GRID_W * TILE));
    this.cam.zoom = Math.min(1.2, z);
    this.cam.x = 0;
    this.cam.y = 0;
    this.clampCamera();
  }

  fitAll(): void {
    const z = Math.min(this.viewW() / (GRID_W * TILE), this.viewH() / (GRID_H * TILE));
    this.cam.zoom = Math.max(0.2, z);
    this.cam.x = (GRID_W * TILE) / 2 - this.viewW() / 2 / this.cam.zoom;
    this.cam.y = (GRID_H * TILE) / 2 - this.viewH() / 2 / this.cam.zoom;
    this.clampCamera();
  }

  zoomBy(factor: number): void {
    this.zoomAt(factor, this.viewW() / 2, this.viewH() / 2);
  }

  get zoom(): number { return this.cam.zoom; }

  // ----------------------------------------------------------------- input
  private onMouseDown = (e: MouseEvent) => {
    this.dragging = true; this.dragMoved = false;
    this.dragStart = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y };
  };
  private onMouseMove = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (this.dragging) {
      const dx = e.clientX - this.dragStart.x, dy = e.clientY - this.dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.dragMoved = true;
      this.cam.x = this.dragStart.cx - dx / this.cam.zoom;
      this.cam.y = this.dragStart.cy - dy / this.cam.zoom;
      this.clampCamera();
      return;
    }
    const hit = this.hitTest(sx, sy);
    if (hit.roomId !== this.hoverRoom || hit.agentKey !== this.hoverAgent) {
      this.hoverRoom = hit.roomId; this.hoverAgent = hit.agentKey;
      this.canvas.style.cursor = hit.agentKey || hit.roomId ? 'pointer' : 'grab';
      this.events.onHover?.(hit);
    }
  };
  private onMouseUp = (e: MouseEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.dragMoved) return;
    const r = this.canvas.getBoundingClientRect();
    const hit = this.hitTest(e.clientX - r.left, e.clientY - r.top);
    if (hit.agentKey) { this.selectedAgent = hit.agentKey; this.selectedRoom = hit.roomId; this.events.onSelectAgent?.(hit.agentKey); }
    else { this.selectedAgent = null; this.selectedRoom = hit.roomId; this.events.onSelectRoom?.(hit.roomId); }
  };
  private onMouseLeave = () => { this.dragging = false; this.hoverRoom = null; this.hoverAgent = null; this.events.onHover?.({ roomId: null, agentKey: null }); };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * 0.0015);
    this.zoomAt(factor, e.clientX - r.left, e.clientY - r.top);
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.isWalkKey(e.key)) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    e.preventDefault();
    this.keys.add(e.key.toLowerCase());
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };
  private isWalkKey(k: string): boolean { return ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k.toLowerCase()); }

  private bindInput(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('mouseleave', this.onMouseLeave);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }
  private unbindInput(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  // ---------------------------------------------------------------- camera
  private viewW(): number { return this.canvas.width / this.dpr; }
  private viewH(): number { return this.canvas.height / this.dpr; }
  private clampCamera(): void {
    const worldW = GRID_W * TILE, worldH = GRID_H * TILE;
    const vw = this.viewW() / this.cam.zoom, vh = this.viewH() / this.cam.zoom;
    const pad = TILE * 2;
    if (vw >= worldW + pad * 2) this.cam.x = (worldW - vw) / 2;
    else this.cam.x = Math.min(Math.max(this.cam.x, -pad), worldW + pad - vw);
    if (vh >= worldH + pad * 2) this.cam.y = (worldH - vh) / 2;
    else this.cam.y = Math.min(Math.max(this.cam.y, -pad), worldH + pad - vh);
  }
  private zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.cam.zoom = Math.min(2.5, Math.max(0.2, this.cam.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.clampCamera();
  }
  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx / this.cam.zoom + this.cam.x, y: sy / this.cam.zoom + this.cam.y };
  }
  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: (wx - this.cam.x) * this.cam.zoom, y: (wy - this.cam.y) * this.cam.zoom };
  }

  private hitTest(sx: number, sy: number): { roomId: string | null; agentKey: string | null } {
    const w = this.screenToWorld(sx, sy);
    // agents first (sprite box: 32 wide, 64 tall above feet tile)
    let agentKey: string | null = null;
    for (const a of this.actors) {
      if (w.x >= a.x - 4 && w.x <= a.x + TILE + 4 && w.y >= a.y - TILE && w.y <= a.y + TILE) { agentKey = a.key; }
    }
    const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
    let roomId: string | null = null;
    if (inBounds(tx, ty)) {
      const ri = this.grid.roomAt[idx(tx, ty)];
      if (ri >= 0) roomId = ROOMS[ri].id;
    }
    if (agentKey) {
      const a = this.actors.find(x => x.key === agentKey)!;
      roomId = a.seat.room;
    }
    return { roomId, agentKey };
  }

  // ---------------------------------------------------------------- update
  private update(dt: number): void {
    // visitor
    let dx = 0, dy = 0;
    if (this.keys.has('arrowup') || this.keys.has('w')) dy -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) dy += 1;
    if (this.keys.has('arrowleft') || this.keys.has('a')) dx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) dx += 1;
    const p = this.player;
    p.moving = dx !== 0 || dy !== 0;
    if (p.moving) {
      const len = Math.hypot(dx, dy);
      const step = PLAYER_SPEED * dt;
      const nx = p.x + (dx / len) * step, ny = p.y + (dy / len) * step;
      if (this.walkable(nx, p.y)) p.x = nx;
      if (this.walkable(p.x, ny)) p.y = ny;
      p.facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      p.animT += dt;
      const room = this.roomAtWorld(p.x + TILE / 2, p.y + TILE / 2);
      if (room !== p.roomId) { p.roomId = room; this.events.onPlayerRoomChange?.(room); }
      this.followPlayer();
    } else {
      p.animT += dt;
    }

    // agents
    for (const a of this.actors) {
      a.animT += dt;
      if (a.moving) {
        const ddx = a.tx - a.x, ddy = a.ty - a.y;
        const dist = Math.hypot(ddx, ddy);
        const step = WALK_SPEED * dt;
        if (dist <= step) { a.x = a.tx; a.y = a.ty; a.moving = false; a.nextDecisionAt = 2 + Math.random() * 5; a.facing = a.seat.facing ?? a.facing; }
        else { a.x += (ddx / dist) * step; a.y += (ddy / dist) * step; a.facing = Math.abs(ddx) >= Math.abs(ddy) ? (ddx < 0 ? 'left' : 'right') : (ddy < 0 ? 'up' : 'down'); }
      } else {
        a.nextDecisionAt -= dt;
        if (a.nextDecisionAt <= 0) {
          const r = a.seat.wander ?? 0;
          if (r > 0 && a.status !== 'off') {
            const t = this.pickWanderTile(a);
            if (t) { a.tx = t.x * TILE; a.ty = t.y * TILE; a.moving = true; }
            else a.nextDecisionAt = 2;
          } else a.nextDecisionAt = 3 + Math.random() * 4;
        }
      }
    }
  }

  private pickWanderTile(a: Actor): { x: number; y: number } | null {
    const r = a.seat.wander ?? 0;
    const roomIndex = ROOMS.findIndex(rm => rm.id === a.seat.room);
    for (let i = 0; i < 8; i++) {
      const x = a.seat.tile.x + Math.round((Math.random() * 2 - 1) * r);
      const y = a.seat.tile.y + Math.round((Math.random() * 2 - 1) * r);
      if (!inBounds(x, y)) continue;
      const k = idx(x, y);
      if (this.grid.solid[k]) continue;
      if (this.grid.roomAt[k] !== roomIndex) continue;
      // straight-line check so agents do not clip through furniture
      if (!this.lineClear(a.x / TILE, a.y / TILE, x, y)) continue;
      return { x, y };
    }
    return null;
  }

  private lineClear(x0: number, y0: number, x1: number, y1: number): boolean {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) + 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.floor(x0 + (x1 - x0) * t + 0.5), y = Math.floor(y0 + (y1 - y0) * t + 0.5);
      if (!inBounds(x, y) || this.grid.solid[idx(x, y)]) return false;
    }
    return true;
  }

  private walkable(px: number, py: number): boolean {
    // feet box: inset so the visitor can slip through 1-tile doors
    const pts = [[px + 6, py + 10], [px + TILE - 7, py + 10], [px + 6, py + TILE - 2], [px + TILE - 7, py + TILE - 2]];
    for (const [x, y] of pts) {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (!inBounds(tx, ty) || this.grid.solid[idx(tx, ty)]) return false;
    }
    return true;
  }

  private roomAtWorld(wx: number, wy: number): string | null {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (!inBounds(tx, ty)) return null;
    const ri = this.grid.roomAt[idx(tx, ty)];
    return ri >= 0 ? ROOMS[ri].id : null;
  }

  private followPlayer(): void {
    const s = this.worldToScreen(this.player.x, this.player.y);
    const m = 120;
    if (s.x < m) this.cam.x -= (m - s.x) / this.cam.zoom;
    if (s.x > this.viewW() - m) this.cam.x += (s.x - (this.viewW() - m)) / this.cam.zoom;
    if (s.y < m) this.cam.y -= (m - s.y) / this.cam.zoom;
    if (s.y > this.viewH() - m) this.cam.y += (s.y - (this.viewH() - m)) / this.cam.zoom;
    this.clampCamera();
  }

  // ---------------------------------------------------------------- drawing
  private sprite(name: string): SpriteRect | undefined { return ATLAS.sprites[name]; }

  private drawSprite(ctx: CanvasRenderingContext2D, name: string, px: number, py: number, flipY = false): void {
    const s = this.sprite(name);
    if (!s || !this.atlas) return;
    if (flipY) {
      ctx.save();
      ctx.translate(px, py + s.h);
      ctx.scale(1, -1);
      ctx.drawImage(this.atlas, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
      ctx.restore();
    } else {
      ctx.drawImage(this.atlas, s.x, s.y, s.w, s.h, px, py, s.w, s.h);
    }
  }

  private buildStaticLayer(): void {
    const W = GRID_W * TILE, H = GRID_H * TILE;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const th = THEME[this.theme];

    // exterior ground
    ctx.fillStyle = th.grass;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = th.grassDot;
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
      if (((x * 7 + y * 13) % 5) === 0) ctx.fillRect(x * TILE + ((x * 3) % 20) + 4, y * TILE + ((y * 5) % 18) + 6, 3, 3);
    }

    // floors
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
      const k = idx(x, y);
      if (this.grid.cells[k] !== Cell.Floor) continue;
      const ri = this.grid.roomAt[k];
      const room = ri >= 0 ? ROOMS[ri] : null;
      this.drawSprite(ctx, room?.floor ?? 'floor_tile_light', x * TILE, y * TILE);
    }
    for (const p of FLOOR_PATCHES) {
      for (let y = p.rect.y; y < p.rect.y + p.rect.h; y++) for (let x = p.rect.x; x < p.rect.x + p.rect.w; x++) {
        if (inBounds(x, y) && this.grid.cells[idx(x, y)] === Cell.Floor) this.drawSprite(ctx, p.sprite, x * TILE, y * TILE);
      }
    }
    // confidential tint
    for (const room of ROOMS) {
      if (!room.confidential) continue;
      ctx.fillStyle = th.confidential;
      ctx.fillRect(room.rect.x * TILE, room.rect.y * TILE, room.rect.w * TILE, room.rect.h * TILE);
    }

    // walls: face texture with a pale cap and a drop shadow below onto floor
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
      if (this.grid.cells[idx(x, y)] !== Cell.Wall) continue;
      const px = x * TILE, py = y * TILE;
      this.drawSprite(ctx, 'wall_white', px, py);
      ctx.fillStyle = th.wallCap;
      ctx.fillRect(px, py, TILE, 7);
      ctx.fillStyle = th.wallShade;
      ctx.fillRect(px, py + TILE - 3, TILE, 3);
      // shadow cast onto the tile below if it is floor
      if (inBounds(x, y + 1) && this.grid.cells[idx(x, y + 1)] === Cell.Floor) {
        ctx.fillStyle = th.wallShade;
        ctx.fillRect(px, py + TILE, TILE, 5);
      }
    }

    // canopy posts + roof hint
    ctx.fillStyle = th.wallCap;
    ctx.fillRect(24 * TILE + 6, 0, 6, 4 * TILE);
    ctx.fillRect(32 * TILE - 12, 0, 6, 4 * TILE);
    ctx.fillStyle = th.wallShade;
    ctx.fillRect(24 * TILE, 0, 8 * TILE, 4);

    // decor furniture (rugs, mats, stage floor) under everything else
    for (const f of FURNITURE) {
      if (!f.decor) continue;
      this.drawSprite(ctx, f.sprite, f.x * TILE, f.y * TILE, f.flipY);
    }

    this.staticLayer = c;
  }

  private draw(t: number): void {
    const ctx = this.ctx;
    const th = THEME[this.theme];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = th.outside;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.ready || !this.staticLayer || !this.atlas) return;

    ctx.setTransform(this.dpr * this.cam.zoom, 0, 0, this.dpr * this.cam.zoom, -this.cam.x * this.dpr * this.cam.zoom, -this.cam.y * this.dpr * this.cam.zoom);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.staticLayer, 0, 0);

    // hover / selection fills (under furniture so they read as floor light)
    const paintRoom = (id: string | null, fill: string | null, stroke: string | null, dashed = false) => {
      if (!id) return;
      const room = ROOMS.find(r => r.id === id);
      if (!room) return;
      const { x, y, w, h } = room.rect;
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(x * TILE, y * TILE, w * TILE, h * TILE); }
      if (stroke) {
        ctx.save();
        ctx.strokeStyle = stroke; ctx.lineWidth = 3 / this.cam.zoom;
        if (dashed) ctx.setLineDash([8 / this.cam.zoom, 6 / this.cam.zoom]);
        ctx.strokeRect(x * TILE - TILE / 2, y * TILE - TILE / 2, w * TILE + TILE, h * TILE + TILE);
        ctx.restore();
      }
    };
    if (this.hoverRoom && this.hoverRoom !== this.selectedRoom) paintRoom(this.hoverRoom, th.hover, null);
    if (this.selectedRoom) paintRoom(this.selectedRoom, th.hover, th.select, ROOMS.find(r => r.id === this.selectedRoom)?.confidential);

    // status rings under agents
    for (const a of this.actors) this.drawStatusRing(ctx, a, t);

    // y-sorted furniture + characters
    type Drawable = { y: number; draw: () => void };
    const items: Drawable[] = [];
    for (const f of this.furnitureSorted) {
      const fp = spriteFootprint(f.sprite);
      items.push({ y: (f.y + fp.h) * TILE, draw: () => this.drawSprite(ctx, f.sprite, f.x * TILE, f.y * TILE, f.flipY) });
    }
    for (const a of this.actors) items.push({ y: a.y + TILE, draw: () => this.drawActor(ctx, a, t) });
    items.push({ y: this.player.y + TILE + 0.1, draw: () => this.drawCharacter(ctx, this.player.character, this.player.x, this.player.y, this.player.facing, this.player.moving, this.player.animT) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.draw();

    // visitor marker (so the pastor is findable at low zoom)
    this.drawVisitorMarker(ctx, t);

    // labels in screen space
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawLabels(ctx);
    this.drawAgentNames(ctx);
  }

  private drawStatusRing(ctx: CanvasRenderingContext2D, a: Actor, t: number): void {
    const color = STATUS_COLOR[a.status];
    const pulse = a.status === 'running' ? 0.6 + 0.4 * Math.sin(t * 6) : 1;
    ctx.save();
    ctx.globalAlpha = (a.status === 'off' ? 0.35 : 0.75) * pulse;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(a.x + TILE / 2, a.y + TILE - 4, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (a.key === this.selectedAgent) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = THEME[this.theme].select; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(a.x + TILE / 2, a.y + TILE - 4, 16, 8, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  private drawActor(ctx: CanvasRenderingContext2D, a: Actor, t: number): void {
    const bounce = this.bounceOffset(a.key, t);
    ctx.save();
    if (bounce) {
      const cx = a.x + TILE / 2, cy = a.y + TILE / 2;
      ctx.translate(cx, cy + bounce.lift);
      ctx.scale(bounce.scale, bounce.scale);
      ctx.translate(-cx, -cy);
    }
    if (a.isOrb) { this.drawOrb(ctx, a.x + TILE / 2, a.y + TILE / 2 - 10, t); ctx.restore(); return; }
    if (a.status === 'off') ctx.globalAlpha = 0.55;
    this.drawCharacter(ctx, a.seat.character, a.x, a.y, a.facing, a.moving, a.animT);
    ctx.restore();
  }

  /** Eased lift+scale for the current instant of an active bounce, or null. */
  private bounceOffset(agentKey: string, t: number): { lift: number; scale: number } | null {
    const end = this.bounceEndAt.get(agentKey);
    if (end === undefined) return null;
    const elapsed = BOUNCE_DURATION - (end - t);
    const result = computeBounce(elapsed);
    if (result === null) this.bounceEndAt.delete(agentKey);
    return result;
  }

  private drawCharacter(ctx: CanvasRenderingContext2D, character: number, x: number, y: number, facing: Facing, moving: boolean, animT: number): void {
    const key = `char_${String(character).padStart(2, '0')}`;
    const def = ATLAS.characters[key];
    if (!def || !this.atlas) return;
    const strip = this.sprite(moving ? def.walk : def.idle);
    if (!strip) return;
    const fps = moving ? 10 : 6;
    const frame = Math.floor(animT * fps) % def.framesPerDir;
    const sx = strip.x + (DIR_INDEX[facing] * def.framesPerDir + frame) * def.frameW;
    ctx.drawImage(this.atlas, sx, strip.y, def.frameW, def.frameH, x, y - (def.frameH - TILE), def.frameW, def.frameH);
  }

  private drawOrb(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
    const r = 13 + Math.sin(t * 2) * 1.5;
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 2.2);
    glow.addColorStop(0, 'rgba(143,163,242,0.55)');
    glow.addColorStop(1, 'rgba(143,163,242,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 1, cx, cy, r);
    g.addColorStop(0, '#fff7e6');
    g.addColorStop(0.35, '#a7b7f5');
    g.addColorStop(0.7, '#4C68CD');
    g.addColorStop(1, '#253374');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }

  private drawVisitorMarker(ctx: CanvasRenderingContext2D, t: number): void {
    if (this.cam.zoom > 0.9) return;
    const p = this.player;
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 4);
    ctx.strokeStyle = THEME[this.theme].select; ctx.lineWidth = 3 / this.cam.zoom;
    ctx.beginPath(); ctx.arc(p.x + TILE / 2, p.y + TILE / 2 - 8, 22 / Math.max(0.5, this.cam.zoom), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  private drawLabels(ctx: CanvasRenderingContext2D): void {
    const th = THEME[this.theme];
    const z = this.cam.zoom;
    ctx.font = '600 12px Poppins, Figtree, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const room of ROOMS) {
      if (!room.name) continue;
      const area = room.rect.w * room.rect.h;
      if (z < 0.45 && area < 60) continue;
      if (z < 0.3 && area < 200) continue;
      const cx = (room.rect.x + room.rect.w / 2) * TILE;
      const cy = (room.rect.y + (room.id === 'sanctuary' ? 0.12 : room.rect.h > 6 ? 0.16 : 0.5)) * TILE + (room.rect.h > 6 && room.id !== 'sanctuary' ? 0 : 0);
      const s = this.worldToScreen(cx, room.id === 'sanctuary' ? cy + TILE : cy);
      if (s.x < -100 || s.y < -30 || s.x > this.viewW() + 100 || s.y > this.viewH() + 30) continue;
      const text = room.name;
      const tw = ctx.measureText(text).width;
      const pillX = s.x - tw / 2 - 7, pillW = tw + 14;
      ctx.fillStyle = th.labelBg;
      this.roundRect(ctx, pillX, s.y - 10, pillW, 20, 6);
      ctx.fill();

      const meta = this.roomMeta.get(room.id);
      if (meta && meta.colors.length) {
        // One thin segment per area sharing this room — the room's own
        // identity, independent of (and drawn separate from) agent status.
        const segW = pillW / meta.colors.length;
        for (let i = 0; i < meta.colors.length; i++) {
          ctx.fillStyle = meta.colors[i];
          this.roundRect(ctx, pillX + i * segW, s.y + 8, segW, 2.5, i === 0 || i === meta.colors.length - 1 ? 1.5 : 0);
          ctx.fill();
        }
      }

      ctx.fillStyle = th.label;
      ctx.fillText(text, s.x, s.y + 0.5);

      if (meta?.hasEvent) {
        ctx.fillStyle = th.select;
        ctx.beginPath();
        ctx.arc(pillX + pillW + 6, s.y - 10, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawAgentNames(ctx: CanvasRenderingContext2D): void {
    if (this.cam.zoom < 0.55) return;
    const th = THEME[this.theme];
    ctx.font = '500 11px Figtree, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const a of this.actors) {
      const s = this.worldToScreen(a.x + TILE / 2, a.y - (a.isOrb ? 22 : 30));
      const tw = ctx.measureText(a.name).width;
      ctx.fillStyle = th.labelBg;
      this.roundRect(ctx, s.x - tw / 2 - 5, s.y - 15, tw + 10, 16, 5);
      ctx.fill();
      ctx.fillStyle = STATUS_COLOR[a.status];
      ctx.beginPath(); ctx.arc(s.x - tw / 2 - 1, s.y - 7, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = th.label;
      ctx.fillText(a.name, s.x + 3, s.y - 1);
    }
    // visitor
    const p = this.worldToScreen(this.player.x + TILE / 2, this.player.y - 30);
    const label = 'You';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = th.select;
    this.roundRect(ctx, p.x - tw / 2 - 5, p.y - 15, tw + 10, 16, 5);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, p.x, p.y - 1);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

export function roomForAgent(agentKey: string): CampusRoom | undefined {
  const seat = AGENT_SEATS[agentKey] ?? OVERFLOW_SEAT;
  return ROOMS.find(r => r.id === seat.room);
}
