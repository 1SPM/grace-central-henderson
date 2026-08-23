/**
 * FloatingWindow — a non-modal, draggable, resizable window.
 *
 * Built for the unified GRACE window (campus + chat) but generic: it knows
 * nothing about its content.
 *
 * Behaviour:
 *   - drag by the header (pointer capture, so fast drags don't drop)
 *   - resize by the bottom-right handle
 *   - fullscreen toggle; double-clicking the header does the same
 *   - Esc closes
 *   - geometry (position, size, fullscreen) persists per storageKey
 *   - clamped so the header can never leave the viewport
 *   - below the `sm` breakpoint it is always fullscreen — a floating window
 *     on a phone is just a worse sheet
 *
 * Deliberately NON-modal: no backdrop, no focus trap. The point of a window
 * you can move is that the app behind it stays alive; a dimmed, inert page
 * would make dragging pointless.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';

export interface FloatingWindowSize {
  width: number;
  height: number;
  fullscreen: boolean;
}

interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
  full: boolean;
}

interface FloatingWindowProps {
  open: boolean;
  onClose: () => void;
  /** Left side of the header — also the drag handle. */
  title: ReactNode;
  /** Node, or a function of the current inner size (for responsive layouts). */
  children: ReactNode | ((size: FloatingWindowSize) => ReactNode);
  /** localStorage key for geometry. Omit to start fresh every time. */
  storageKey?: string;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  'aria-label'?: string;
}

const HEADER_H = 44;           // px — kept on-screen by the clamp
const EDGE_KEEP = 96;          // px of the window that must stay reachable

function clampGeometry(g: Geometry, minW: number, minH: number): Geometry {
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(Math.max(g.w, minW), vw);
  const h = Math.min(Math.max(g.h, minH), vh);
  const x = Math.min(Math.max(g.x, EDGE_KEEP - w), vw - EDGE_KEEP);
  const y = Math.min(Math.max(g.y, 0), vh - HEADER_H);
  return { ...g, x, y, w, h };
}

function loadGeometry(key: string | undefined, fallback: Geometry, minW: number, minH: number): Geometry {
  if (!key || typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Geometry>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number' || typeof parsed.w !== 'number' || typeof parsed.h !== 'number') {
      return fallback;
    }
    return clampGeometry({ ...fallback, ...parsed } as Geometry, minW, minH);
  } catch {
    return fallback;
  }
}

export function FloatingWindow({
  open,
  onClose,
  title,
  children,
  storageKey,
  initialWidth = 1160,
  initialHeight = 700,
  minWidth = 680,
  minHeight = 440,
  'aria-label': ariaLabel,
}: FloatingWindowProps) {
  const defaults = useCallback((): Geometry => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const w = Math.min(initialWidth, vw - 32);
    const h = Math.min(initialHeight, vh - 48);
    return { x: Math.max(16, (vw - w) / 2), y: Math.max(16, (vh - h) / 2), w, h, full: false };
  }, [initialWidth, initialHeight]);

  const [geo, setGeo] = useState<Geometry>(() => loadGeometry(storageKey, defaults(), minWidth, minHeight));
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const geoRef = useRef(geo);
  // Synced in an effect (not during render, per react-hooks/refs). A drag
  // always starts long after the last commit, so the ref is current when
  // beginDrag reads it for its base geometry.
  useEffect(() => { geoRef.current = geo; }, [geo]);
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; base: Geometry } | null>(null);

  const persist = useCallback((g: Geometry) => {
    if (!storageKey) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(g)); } catch { /* storage full/blocked — geometry just won't persist */ }
  }, [storageKey]);

  // Keep the window reachable when the browser window changes size.
  useEffect(() => {
    const onResize = () => {
      setIsNarrowViewport(window.innerWidth < 640);
      setGeo(g => clampGeometry(g, minWidth, minHeight));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [minWidth, minHeight]);

  // Esc closes — window-level, so it works no matter what has focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const beginDrag = useCallback((mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (geoRef.current.full || isNarrowViewport) return;
    // Window buttons live inside the header; don't let them start a drag.
    if (mode === 'move' && (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    // jsdom has no pointer capture; in browsers it keeps fast drags attached.
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, base: geoRef.current };
  }, [isNarrowViewport]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    const next = d.mode === 'move'
      ? { ...d.base, x: d.base.x + dx, y: d.base.y + dy }
      : { ...d.base, w: d.base.w + dx, h: d.base.h + dy };
    setGeo(clampGeometry(next, minWidth, minHeight));
  }, [minWidth, minHeight]);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    // Functional read: the definitive latest geometry, even if the final
    // pointermove's state update has not been committed to the ref yet.
    setGeo(g => { persist(g); return g; });
  }, [persist]);

  const toggleFullscreen = useCallback(() => {
    setGeo(g => {
      const next = { ...g, full: !g.full };
      persist(next);
      return next;
    });
  }, [persist]);

  if (!open) return null;

  const fullscreen = geo.full || isNarrowViewport;
  const size: FloatingWindowSize = fullscreen
    ? { width: typeof window !== 'undefined' ? window.innerWidth : geo.w, height: typeof window !== 'undefined' ? window.innerHeight : geo.h, fullscreen: true }
    : { width: geo.w, height: geo.h, fullscreen: false };

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={ariaLabel}
      data-testid="floating-window"
      className={`fixed z-50 flex flex-col overflow-hidden bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900 shadow-2xl border border-stone-300/70 dark:border-white/10 ${fullscreen ? 'inset-0 rounded-none' : 'rounded-2xl'}`}
      style={fullscreen ? { paddingBottom: 'env(safe-area-inset-bottom)' } : { left: geo.x, top: geo.y, width: geo.w, height: geo.h }}
    >
      {/* Header — the drag handle */}
      <header
        data-testid="floating-window-header"
        onPointerDown={beginDrag('move')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => { if (!isNarrowViewport) toggleFullscreen(); }}
        className={`flex items-center gap-2 h-11 px-3 shrink-0 select-none border-b border-stone-300/60 dark:border-white/10 bg-white/60 dark:bg-dark-850/80 backdrop-blur ${fullscreen || isNarrowViewport ? '' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ touchAction: 'none' }}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">{title}</div>
        {!isNarrowViewport && (
          <button
            type="button"
            onClick={toggleFullscreen}
            title={fullscreen ? 'Restore window' : 'Fullscreen'}
            aria-label={fullscreen ? 'Restore window' : 'Fullscreen'}
            className="p-1.5 rounded-lg text-gray-500 dark:text-dark-300 hover:bg-black/5 dark:hover:bg-white/10"
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="p-1.5 rounded-lg text-gray-500 dark:text-dark-300 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X size={15} />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {typeof children === 'function' ? children(size) : children}
      </div>

      {/* Resize handle */}
      {!fullscreen && !isNarrowViewport && (
        <div
          data-testid="floating-window-resize"
          onPointerDown={beginDrag('resize')}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="presentation"
          aria-hidden="true"
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize"
          style={{ touchAction: 'none' }}
        >
          <svg viewBox="0 0 20 20" className="w-full h-full text-gray-400 dark:text-dark-500" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 9v8M9 17h8M17 13v4M13 17h4" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </section>
  );
}
