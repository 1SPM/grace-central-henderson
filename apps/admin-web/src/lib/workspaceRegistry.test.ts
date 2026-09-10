import { describe, it, expect } from 'vitest';
import { WORKSPACES, findWorkspace, normalizeWorkspaceName } from './workspaceRegistry';
import { resolveWorkspaceNavigation } from './grace-chat/navigation';

describe('workspaceRegistry — one list, two doors', () => {
  it('every entry has a unique id and a unique label', () => {
    const ids = WORKSPACES.map(w => w.id);
    const labels = WORKSPACES.map(w => w.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('no alias collides with another entry', () => {
    const seen = new Map<string, string>();
    for (const w of WORKSPACES) {
      for (const key of [w.label, ...w.aliases].map(normalizeWorkspaceName)) {
        expect(seen.has(key), `"${key}" claimed by both ${seen.get(key)} and ${w.id}`).toBe(false);
        seen.set(key, w.id);
      }
    }
  });

  it('every visible palette label is reachable by voice — the drift this registry exists to stop', () => {
    for (const w of WORKSPACES) {
      expect(findWorkspace(w.label)?.id, `label "${w.label}" unreachable`).toBe(w.id);
      expect(resolveWorkspaceNavigation(`Open ${w.label}`)?.view, `"Open ${w.label}" failed`).toBe(w.view);
    }
  });

  it('normalizes the ampersand the sidebar actually uses', () => {
    expect(findWorkspace('Growth & Engagement')?.id).toBe('growth');
    expect(findWorkspace('growth and engagement')?.id).toBe('growth');
  });
});

describe('resolveWorkspaceNavigation', () => {
  it('accepts every imperative form, including jump to', () => {
    for (const verb of ['Open', 'Show', 'Go to', 'Take me to', 'Navigate to', 'Jump to']) {
      expect(resolveWorkspaceNavigation(`${verb} Impact Card Accounts`)?.view).toBe('wallets');
    }
  });

  it('never treats a question about a workspace as navigation', () => {
    expect(resolveWorkspaceNavigation('What is Impact Card Accounts?')).toBeNull();
    expect(resolveWorkspaceNavigation('How many people are in Congregation?')).toBeNull();
  });

  it('never fuzzy-matches — a wrong workspace is worse than none', () => {
    expect(resolveWorkspaceNavigation('Open the impact thing')).toBeNull();
    expect(resolveWorkspaceNavigation('Open Impact')).toBeNull();
  });

  it('refuses a target the route guard denies, rather than moving the user anyway', () => {
    const denySettings = (v: string) => v !== 'settings';
    expect(resolveWorkspaceNavigation('Open Settings', denySettings as never)).toBeNull();
    expect(resolveWorkspaceNavigation('Open Congregation', denySettings as never)?.view).toBe('people');
  });
});
