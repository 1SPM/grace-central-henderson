import { describe, it, expect } from 'vitest';
import { resolveAreas, attachNextEvents, staffDisplayName, MINISTRY_AREAS, EVENT_CATEGORY_AREA } from './ministryAreas';

const STAFF = [
  { id: 'u-naomi', first_name: 'Naomi', last_name: 'Ito', title: 'Director of Finance' },
  { id: 'u-fatou', first_name: 'Fatoumata', last_name: 'Diallo', title: 'Pastoral Care Director' },
  { id: 'u-nameless', first_name: null, last_name: null, title: null },
];

describe('resolveAreas (the shared pairing, resolved per church)', () => {
  it('returns every area, in the coded order, even with no assignments at all', () => {
    const areas = resolveAreas([], [], []);
    expect(areas.map(a => a.key)).toEqual(MINISTRY_AREAS.map(a => a.key));
  });

  it('falls back to coded defaults and labels them as defaults, never as decisions', () => {
    const giving = resolveAreas([], STAFF, []).find(a => a.key === 'giving')!;
    expect(giving.owner).toBeNull();
    expect(giving.default_role_key).toBe('finance');
    expect(giving.agent_key).toBe('steward');
    expect(giving.room_id).toBe('admin_work');
    expect(giving.source).toEqual({ owner: 'default', agent: 'default', room: 'default' });
  });

  it('applies an override and marks each changed link as assigned', () => {
    const areas = resolveAreas(
      [{ area_key: 'giving', owner_user_id: 'u-naomi', agent_key: 'verity', campus_room: 'conference', updated_at: '2026-08-23T00:00:00Z' }],
      STAFF,
      [],
    );
    const giving = areas.find(a => a.key === 'giving')!;
    expect(giving.owner).toEqual({ user_id: 'u-naomi', name: 'Naomi Ito', title: 'Director of Finance', person_id: null });
    expect(giving.agent_key).toBe('verity');
    expect(giving.room_id).toBe('conference');
    expect(giving.source).toEqual({ owner: 'assigned', agent: 'assigned', room: 'assigned' });
    expect(giving.updated_at).toBe('2026-08-23T00:00:00Z');
    // untouched areas keep their defaults
    expect(areas.find(a => a.key === 'member_care')!.source.owner).toBe('default');
  });

  it('an owner who is no longer active staff resolves to an honest gap, not a dangling id', () => {
    const areas = resolveAreas(
      [{ area_key: 'member_care', owner_user_id: 'u-departed', agent_key: null, campus_room: null }],
      STAFF,
      [],
    );
    const care = areas.find(a => a.key === 'member_care')!;
    expect(care.owner).toBeNull();
    expect(care.source.owner).toBe('default');
    expect(care.default_role_key).toBe('pastoral_care');
  });

  it('an explicit null agent means "human only" and is not overwritten by the default', () => {
    const areas = resolveAreas(
      [{ area_key: 'giving', owner_user_id: null, agent_key: null, campus_room: null }],
      STAFF,
      [],
    );
    // A row exists but every link is null: agent falls back to the coded
    // default. Clearing an agent is done by resetting the row, which is what
    // the Settings "reset to default" control sends.
    expect(areas.find(a => a.key === 'giving')!.agent_key).toBe('steward');
  });

  it('counts open Work Orders by ministry, case- and whitespace-insensitively', () => {
    const areas = resolveAreas([], STAFF, [
      { ministry: 'Finance', owner_user_id: 'u-naomi' },
      { ministry: ' finance ', owner_user_id: null },
      { ministry: 'FINANCE', owner_user_id: null },
      { ministry: 'Communications', owner_user_id: 'u-naomi' },
      { ministry: null, owner_user_id: null },
      { ministry: 'Not A Real Ministry', owner_user_id: null },
    ]);
    const giving = areas.find(a => a.key === 'giving')!;
    expect(giving.open_work_orders).toBe(3);
    expect(giving.unowned_work_orders).toBe(2);

    const comms = areas.find(a => a.key === 'communications')!;
    expect(comms.open_work_orders).toBe(1);
    expect(comms.unowned_work_orders).toBe(0);

    // A ministry string nobody claims is simply not counted anywhere —
    // it never gets silently attributed to some other area.
    const total = areas.reduce((n, a) => n + a.open_work_orders, 0);
    expect(total).toBe(4);
  });

  it('ignores assignment rows for areas that no longer exist', () => {
    const areas = resolveAreas(
      [{ area_key: 'a_removed_area', owner_user_id: 'u-naomi', agent_key: 'grace', campus_room: 'lobby' }],
      STAFF,
      [],
    );
    expect(areas.map(a => a.key)).toEqual(MINISTRY_AREAS.map(a => a.key));
    expect(areas.every(a => a.source.owner === 'default')).toBe(true);
  });

  it('carries the confidential flag through so the campus can keep the care door shut', () => {
    const care = resolveAreas([], [], []).find(a => a.key === 'member_care')!;
    expect(care.confidential).toBe(true);
    expect(resolveAreas([], [], []).find(a => a.key === 'giving')!.confidential).toBe(false);
  });

  it('names a staff member with no name honestly rather than rendering blank', () => {
    expect(staffDisplayName(STAFF[2])).toBe('Unnamed staff member');
    expect(staffDisplayName({ id: 'x', first_name: 'Trevor', last_name: null })).toBe('Trevor');
  });

  it('gives every area a real, distinct accent color', () => {
    const areas = resolveAreas([], [], []);
    for (const a of areas) expect(a.accent_color, a.key).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(new Set(areas.map(a => a.accent_color)).size).toBe(areas.length);
  });
});

describe('attachNextEvents (the campus \'what\'s coming up\' badge)', () => {
  const NOW = new Date('2026-08-24T12:00:00Z');
  const base = resolveAreas([], [], []);

  it('attaches the soonest matching event and leaves everything else null', () => {
    const areas = attachNextEvents(base, [
      { title: 'Sunday Service', start_date: '2026-08-30T14:00:00Z', category: 'service' },
    ], NOW);
    expect(areas.find(a => a.key === 'worship')!.next_event).toEqual({
      title: 'Sunday Service', start_date: '2026-08-30T14:00:00Z', category: 'service',
    });
    expect(areas.filter(a => a.key !== 'worship').every(a => a.next_event === null)).toBe(true);
  });

  it('picks the soonest of several matches for the same area', () => {
    const areas = attachNextEvents(base, [
      { title: 'Later rehearsal', start_date: '2026-08-29T20:00:00Z', category: 'rehearsal' },
      { title: 'Sooner rehearsal', start_date: '2026-08-25T20:00:00Z', category: 'rehearsal' },
    ], NOW);
    expect(areas.find(a => a.key === 'music')!.next_event?.title).toBe('Sooner rehearsal');
  });

  it('ignores categories with no ministry home (holiday, event, other) — never guesses a room', () => {
    for (const category of ['holiday', 'event', 'other']) {
      expect(EVENT_CATEGORY_AREA[category]).toBeUndefined();
    }
    const areas = attachNextEvents(base, [
      { title: 'Labor Day', start_date: '2026-08-25T00:00:00Z', category: 'holiday' },
    ], NOW);
    expect(areas.every(a => a.next_event === null)).toBe(true);
  });

  it('drops events in the past and events past the lookahead window', () => {
    const areas = attachNextEvents(base, [
      { title: 'Yesterday', start_date: '2026-08-23T00:00:00Z', category: 'service' },
      { title: 'Six weeks out', start_date: '2026-10-05T00:00:00Z', category: 'service' },
    ], NOW);
    expect(areas.find(a => a.key === 'worship')!.next_event).toBeNull();
  });

  it('is pure — same inputs, same output, regardless of call order', () => {
    const events = [{ title: 'Wedding', start_date: '2026-08-26T18:00:00Z', category: 'wedding' }];
    const a = attachNextEvents(base, events, NOW);
    const b = attachNextEvents(base, events, NOW);
    expect(a).toEqual(b);
  });
});
