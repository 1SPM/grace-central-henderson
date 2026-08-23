import { describe, it, expect } from 'vitest';
import {
  MINISTRY_AREAS, AREA_KEYS, getArea, areaForMinistry, areaForQueueKind, areaForRoom, areasForRoom, primarySurface,
} from './ministryAreas';
import { AGENT_REGISTRY } from '../../api/_lib/agentRegistry';
import { ROOMS } from '../components/workos/campus/campusMap';
import { DEPARTMENTS } from '../components/workos/campus/campusBindings';

/**
 * These are the invariants that stop the Campus and the WorkOS from telling
 * different stories. Each one fails loudly the moment somebody edits one
 * side of the map without the other.
 */
describe('ministry areas (the shared operational map)', () => {
  it('area keys are unique and safe to persist as ministry_assignments.area_key', () => {
    expect(new Set(AREA_KEYS).size).toBe(AREA_KEYS.length);
    for (const key of AREA_KEYS) expect(key, `${key} must match /^[a-z_]+$/`).toMatch(/^[a-z_]+$/);
  });

  it('every area names a real campus room', () => {
    const roomIds = new Set(ROOMS.map(r => r.id));
    for (const area of MINISTRY_AREAS) {
      expect(roomIds.has(area.defaultRoom), `${area.key} → room ${area.defaultRoom}`).toBe(true);
    }
  });

  it('every supporting agent is a real registry key (no invented agents)', () => {
    const keys = new Set(AGENT_REGISTRY.map(a => a.key));
    for (const area of MINISTRY_AREAS) {
      if (area.defaultAgentKey === null) continue;
      expect(keys.has(area.defaultAgentKey), `${area.key} → agent ${area.defaultAgentKey}`).toBe(true);
    }
  });

  it('no agent is the default support for two areas at once', () => {
    const seen = new Map<string, string>();
    for (const area of MINISTRY_AREAS) {
      if (!area.defaultAgentKey) continue;
      const prev = seen.get(area.defaultAgentKey);
      expect(prev, `${area.defaultAgentKey} supports both ${prev} and ${area.key}`).toBeUndefined();
      seen.set(area.defaultAgentKey, area.key);
    }
  });

  it('ministry strings are unique, so a Work Order maps to exactly one area', () => {
    const ministries = MINISTRY_AREAS.map(a => a.ministry.toLowerCase());
    expect(new Set(ministries).size).toBe(ministries.length);
    // and the lookup actually resolves, case- and space-insensitively
    expect(areaForMinistry('Finance')?.key).toBe('giving');
    expect(areaForMinistry('  finance ')?.key).toBe('giving');
    expect(areaForMinistry(null)).toBeUndefined();
    expect(areaForMinistry('Not A Ministry')).toBeUndefined();
  });

  it('every Decision Queue kind lands on exactly one area', () => {
    const KINDS = [
      'approval', 'related_party_review', 'crisis', 'care_triage',
      'kyc_review', 'failed_transfer', 'invitation_stalled', 'agent_finding',
    ];
    const claimed = MINISTRY_AREAS.flatMap(a => a.queueKinds);
    expect(new Set(claimed).size, 'a kind is claimed by two areas').toBe(claimed.length);
    for (const kind of KINDS) {
      expect(areaForQueueKind(kind), `no area owns queue kind ${kind}`).toBeDefined();
    }
    for (const kind of claimed) {
      expect(KINDS, `${kind} is not a real Decision Queue kind`).toContain(kind);
    }
  });

  it('every area names exactly one room, and a shared room lists all of its areas', () => {
    // One area → one room is what makes "where does this belong?" answerable.
    // One room → many areas is allowed, because a small church office really
    // does run more than one function out of the same work room. What must
    // never happen is an area being silently hidden because another area
    // shares its room — so the campus reads areasForRoom(), not areaForRoom().
    for (const area of MINISTRY_AREAS) {
      expect(areasForRoom(area.defaultRoom).map(a => a.key)).toContain(area.key);
    }
    expect(areaForRoom('senior_pastor')?.key).toBe('oversight');
    expect(areaForRoom('not-a-room')).toBeUndefined();
    expect(areasForRoom('not-a-room')).toEqual([]);
    // the known shared room
    expect(areasForRoom('admin_work').map(a => a.key)).toEqual(['giving', 'impact_card']);
  });

  it('every area has surfaces, exactly one primary, and only real-looking hashes', () => {
    for (const area of MINISTRY_AREAS) {
      expect(area.surfaces.length, `${area.key} has no surfaces`).toBeGreaterThan(0);
      const primaries = area.surfaces.filter(s => s.primary);
      expect(primaries.length, `${area.key} must have exactly one primary surface`).toBe(1);
      expect(primarySurface(area)).toBe(primaries[0]);
      for (const s of area.surfaces) {
        expect(s.hash.startsWith('#/'), `${area.key} → ${s.hash}`).toBe(true);
        expect(s.view.length).toBeGreaterThan(0);
      }
    }
  });

  it('the confidential area is the care area, and it stays confidential', () => {
    const confidential = MINISTRY_AREAS.filter(a => a.confidential);
    expect(confidential.map(a => a.key)).toEqual(['member_care']);
  });

  it('every campus room that a department binds is still reachable through some area or department', () => {
    // The area map is the north star, but no room should become orphaned:
    // a room is fine if an area sits in it, or its department is a real one.
    for (const room of ROOMS) {
      const byArea = areaForRoom(room.id);
      const byDept = DEPARTMENTS[room.department];
      expect(byArea || byDept, `room ${room.id} has neither an area nor a department`).toBeTruthy();
    }
  });

  it('getArea round-trips every key', () => {
    for (const key of AREA_KEYS) expect(getArea(key)?.key).toBe(key);
    expect(getArea('nope')).toBeUndefined();
  });
});
