/**
 * The palette is the catalog's third caller, so the two must not drift —
 * the same reason agentRegistryBinding.test.ts and actionCatalogBinding.test.ts
 * exist. An action on the palette surface with no UI entry would be invisible;
 * a UI entry with no catalog action would be a button wired to nothing.
 */
import { describe, it, expect } from 'vitest';
import { actionsForSurface, findAction } from '../../api/_lib/actionCatalog';
import { PALETTE_ACTION_UI, paletteActions, visiblePaletteActions } from './paletteActions';

const sorted = (xs: string[]) => [...xs].sort();

describe('palette <-> catalog', () => {
  it('has a UI entry for every action on the palette surface', () => {
    const missing = actionsForSurface('palette')
      .filter(a => !PALETTE_ACTION_UI[a.type]).map(a => a.type);
    expect(missing, 'palette-surface action with no way to present or dispatch it').toEqual([]);
  });

  it('has a catalog action for every UI entry', () => {
    const orphans = Object.keys(PALETTE_ACTION_UI).filter(t => !findAction(t));
    expect(orphans, 'palette row wired to an action that does not exist').toEqual([]);
  });

  it('only presents actions the catalog marks as palette-reachable', () => {
    const notOnSurface = Object.keys(PALETTE_ACTION_UI)
      .filter(t => !findAction(t)?.surfaces.includes('palette'));
    expect(notOnSurface).toEqual([]);
  });
});

describe('permission filtering', () => {
  it('hides actions the user lacks the permission for', () => {
    const visible = visiblePaletteActions(new Set(['tasks.manage']));
    expect(sorted(visible.map(a => a.type))).toEqual(['add_task']);
  });

  it('shows everything when the permission set is empty', () => {
    // Failing closed here would be theatre — n/t/p/m still work — and would
    // blank the palette for anyone whose permission fetch failed. See the
    // note on visiblePaletteActions.
    const visible = visiblePaletteActions(new Set());
    expect(sorted(visible.map(a => a.type))).toEqual(sorted(paletteActions().map(a => a.type)));
    expect(visible.length).toBeGreaterThan(0);
  });

  it('shows every palette action to a fully-permissioned user', () => {
    const all = new Set(paletteActions().map(a => a.permission!).filter(Boolean));
    expect(sorted(visiblePaletteActions(all).map(a => a.type)))
      .toEqual(sorted(paletteActions().map(a => a.type)));
  });
});
