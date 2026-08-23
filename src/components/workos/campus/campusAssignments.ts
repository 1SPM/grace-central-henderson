/**
 * Default seating chart — which room each registered agent sits in, where it
 * stands, and which LimeZu premade character it wears.
 *
 * This is the part Sean said we would "assign afterward": edit freely. The
 * campus only requires that `room` is a real room id (campusMap.ts) and
 * `tile` is a walkable tile inside it (enforced by campusMap.test.ts).
 *
 * Agent keys come from api/_lib/agentRegistry.ts. An agent that is in the
 * registry but missing here is seated in the Fellowship Hall so it is never
 * hidden; an entry here for a key the registry no longer has is ignored.
 */

export interface AgentSeat {
  room: string;
  /** Standing tile (top-left of the character's feet tile). */
  tile: { x: number; y: number };
  /** Premade character sheet number 1..20. */
  character: number;
  /** Facing when idle. */
  facing?: 'up' | 'down' | 'left' | 'right';
  /** Wander radius in tiles around the seat (0 = stays put). */
  wander?: number;
}

export const AGENT_SEATS: Record<string, AgentSeat> = {
  // Grace presides in the Fellowship Hall (rendered as the GRACE orb, not a sprite).
  grace:    { room: 'fellowship', tile: { x: 22, y: 52 }, character: 0, facing: 'down', wander: 3 },

  // Ministry desks
  welcome:  { room: 'lobby',            tile: { x: 29, y: 11 }, character: 2,  facing: 'up',   wander: 3 },
  herald:   { room: 'mur1',             tile: { x: 44, y: 9 },  character: 3,  facing: 'up',   wander: 1 },
  gather:   { room: 'sanctuary',        tile: { x: 19, y: 24 }, character: 4,  facing: 'down', wander: 4 },
  shepherd: { room: 'associate_pastor', tile: { x: 52, y: 60 }, character: 5,  facing: 'left', wander: 1 },
  verity:   { room: 'admin_front',      tile: { x: 40, y: 52 }, character: 6,  facing: 'up',   wander: 2 },
  sentinel: { room: 'admin_front',      tile: { x: 43, y: 52 }, character: 7,  facing: 'up',   wander: 2 },
  steward:  { room: 'admin_work',       tile: { x: 50, y: 52 }, character: 8,  facing: 'up',   wander: 1 },
  impact:   { room: 'admin_work',       tile: { x: 53, y: 52 }, character: 9,  facing: 'up',   wander: 1 },
  serve:    { room: 'mur_a',            tile: { x: 4, y: 60 },  character: 10, facing: 'down', wander: 2 },
  marci:    { room: 'mur_b',            tile: { x: 11, y: 60 }, character: 11, facing: 'up',   wander: 2 },
  compass:  { room: 'conference',       tile: { x: 45, y: 42 }, character: 12, facing: 'right', wander: 1 },
  clarence: { room: 'conference',       tile: { x: 52, y: 42 }, character: 13, facing: 'left', wander: 1 },

  // Platform Annex (VWS agents in the borrowed storage room)
  steve:    { room: 'storage', tile: { x: 39, y: 40 }, character: 14, facing: 'down', wander: 1 },
  charles:  { room: 'storage', tile: { x: 40, y: 40 }, character: 15, facing: 'down', wander: 1 },
  marco:    { room: 'storage', tile: { x: 39, y: 43 }, character: 16, facing: 'up',   wander: 1 },
};

/** Where an unassigned registry agent stands: the Fellowship Hall, near the door. */
export const OVERFLOW_SEAT: AgentSeat = { room: 'fellowship', tile: { x: 27, y: 52 }, character: 1, facing: 'down', wander: 2 };

/** The visitor (the pastor walking the campus with the arrow keys). */
export const PLAYER_START = { room: 'canopy', tile: { x: 27, y: 1 }, character: 17, facing: 'down' as const };
