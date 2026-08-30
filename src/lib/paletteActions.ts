/**
 * The command palette's view of the action catalog.
 *
 * GRACE already had a palette — src/components/GlobalSearch.tsx, opened with
 * `/`, searching views, people, tasks and prayers. What it did not do was
 * offer to *do* anything, so the quick-capture shortcuts (n/t/p/m/d/e) stayed
 * invisible unless someone told you they existed. That is the gap Omarchy's
 * `Super + K` closes: one key that shows you what the system can do, rather
 * than a set of bindings you have to already know.
 *
 * This module is the palette's half of that. The catalog decides WHICH
 * actions exist and who may run them; this decides how each is presented and
 * which existing capture modal it opens. Keeping the two apart matters: a
 * keyboard shortcut is a property of this interface, not of the action, and
 * baking it into the catalog would make the chat door and the agent door
 * carry UI trivia they have no use for.
 *
 * Only actions with somewhere to land appear here. `add_event` is in the
 * catalog and on the chat surface but has no quick-capture modal, so it is
 * deliberately absent rather than wired to a dead end — and
 * paletteActions.test.ts fails if the two lists disagree, so "deliberately
 * absent" cannot quietly become "forgotten".
 */
import { actionsForSurface, type ActionDefinition } from '../../api/_lib/actionCatalog';

/** The single-key shortcut App.tsx already binds for this action, if any. */
export interface PaletteActionUi {
  /** Matches the existing binding in App.tsx's keydown handler. */
  shortcut?: string;
  /** What the palette says will happen. Imperative, not a noun. */
  hint: string;
}

export const PALETTE_ACTION_UI: Record<string, PaletteActionUi> = {
  add_person: { shortcut: 'N', hint: 'Open the new person form' },
  add_task: { shortcut: 'T', hint: 'Quick-add a task' },
  add_prayer: { shortcut: 'P', hint: 'Log a prayer request' },
  add_note: { shortcut: 'M', hint: 'Log a note or interaction' },
};

/** Every catalog action the palette knows how to dispatch. */
export function paletteActions(): ActionDefinition[] {
  return actionsForSurface('palette').filter(a => PALETTE_ACTION_UI[a.type]);
}

/**
 * Narrow `paletteActions()` to what this user may do.
 *
 * IMPORTANT — this is discoverability, not enforcement. These actions run
 * through the chat handlers against the RLS-scoped browser client, with no
 * server-side permission check (TD-061). Hiding a row here does not stop
 * anyone; it stops the palette from advertising work someone cannot do.
 *
 * When the permission set is empty — the endpoint failed, or is still
 * loading — every action is shown rather than none. Failing closed would be
 * security theatre that costs real usability: the same actions remain one
 * keystroke away on n/t/p/m regardless of what this returns, so a blank
 * palette would only mislead. Once TD-061 lands and the server enforces,
 * this filter starts describing something real.
 */
export function visiblePaletteActions(permissions: ReadonlySet<string>): ActionDefinition[] {
  const all = paletteActions();
  if (permissions.size === 0) return all;
  return all.filter(a => !a.permission || permissions.has(a.permission));
}
