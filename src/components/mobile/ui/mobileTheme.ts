/**
 * GRACE Mobile design tokens. The mobile shell is deliberately dark-only
 * (it does not participate in the admin `dark:` class system) — these
 * constants are the single place its palette lives.
 */

/** Near-black navy canvas behind every mobile screen. */
export const MOBILE_BG = '#070b14';

/** Elevated sheet/surface color (More sheet, modals). */
export const MOBILE_SHEET_BG = '#101622';

/** Glassy card treatment shared by every mobile card. */
export const surface = 'rounded-2xl border border-white/[0.08] bg-white/[0.045]';

/** Muted secondary text. */
export const muted = 'text-slate-400';

/** Icon-chip tone variants (background + text pairings from the mockup). */
export const chipTones = {
  violet: 'bg-violet-500/15 text-violet-300',
  indigo: 'bg-indigo-500/15 text-indigo-300',
  emerald: 'bg-emerald-500/15 text-emerald-300',
  orange: 'bg-orange-500/15 text-orange-300',
  sky: 'bg-sky-500/15 text-sky-300',
  rose: 'bg-rose-500/15 text-rose-300',
} as const;

export type ChipTone = keyof typeof chipTones;
