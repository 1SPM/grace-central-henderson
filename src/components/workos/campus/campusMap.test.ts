import { describe, it, expect } from 'vitest';
import {
  ROOMS, DOORS, FURNITURE, FLOOR_PATCHES, buildGrid, idx, inBounds, spriteFootprint, GRID_W, GRID_H, Cell, TILE,
} from './campusMap';
import { DEPARTMENTS } from './campusBindings';
import { AGENT_SEATS, OVERFLOW_SEAT, PLAYER_START } from './campusAssignments';
import atlas from './atlas.json';
import { AGENT_REGISTRY } from '../../../../api/_lib/agentRegistry';

const grid = buildGrid();
const roomIndex = (id: string) => ROOMS.findIndex(r => r.id === id);

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('campus floor plan (layout integrity)', () => {
  it('room interiors never overlap and stay inside the grid', () => {
    for (let i = 0; i < ROOMS.length; i++) {
      const a = ROOMS[i];
      expect(a.rect.x).toBeGreaterThanOrEqual(0);
      expect(a.rect.y).toBeGreaterThanOrEqual(0);
      expect(a.rect.x + a.rect.w).toBeLessThanOrEqual(GRID_W);
      expect(a.rect.y + a.rect.h).toBeLessThanOrEqual(GRID_H);
      for (let j = i + 1; j < ROOMS.length; j++) {
        expect(rectsOverlap(a.rect, ROOMS[j].rect), `${a.id} overlaps ${ROOMS[j].id}`).toBe(false);
      }
    }
  });

  it('every room binds to a real department, and every department has a room', () => {
    const used = new Set<string>();
    for (const r of ROOMS) {
      expect(DEPARTMENTS[r.department], `room ${r.id} → department ${r.department}`).toBeDefined();
      used.add(r.department);
    }
    for (const id of Object.keys(DEPARTMENTS)) expect(used.has(id), `department ${id} has no room`).toBe(true);
  });

  it('confidential rooms bind to confidential departments (the Care Wing stays closed)', () => {
    for (const r of ROOMS) {
      if (r.confidential) expect(DEPARTMENTS[r.department].confidential).toBe(true);
    }
  });

  it('every door turns wall into floor and is walkable on both sides', () => {
    for (const d of DOORS) {
      const horizontal = d.rect.w >= d.rect.h;
      for (let y = d.rect.y; y < d.rect.y + d.rect.h; y++) for (let x = d.rect.x; x < d.rect.x + d.rect.w; x++) {
        expect(grid.cells[idx(x, y)]).toBe(Cell.Floor);
        expect(grid.solid[idx(x, y)]).toBe(0);
        const [ax, ay, bx, by] = horizontal ? [x, y - 1, x, y + 1] : [x - 1, y, x + 1, y];
        for (const [px, py] of [[ax, ay], [bx, by]]) {
          if (!inBounds(px, py)) continue; // exterior doors open onto the grid edge
          expect(grid.solid[idx(px, py)], `door at ${x},${y} is blocked on the ${px},${py} side`).toBe(0);
        }
      }
    }
  });

  it('every furniture sprite exists in the atlas and its collision footprint matches the sprite size', () => {
    const sprites = (atlas as { sprites: Record<string, { w: number; h: number }> }).sprites;
    for (const f of FURNITURE) {
      const s = sprites[f.sprite];
      expect(s, `sprite ${f.sprite} missing from atlas`).toBeDefined();
      const fp = spriteFootprint(f.sprite);
      expect(fp.w * TILE, `${f.sprite} footprint width`).toBe(s.w);
      expect(fp.h * TILE, `${f.sprite} footprint height`).toBe(s.h);
    }
    for (const p of FLOOR_PATCHES) expect(sprites[p.sprite]).toBeDefined();
    for (const r of ROOMS) expect(sprites[r.floor]).toBeDefined();
  });

  it('solid furniture sits on floor tiles inside exactly one room', () => {
    for (const f of FURNITURE) {
      if (f.solid === false || f.decor) continue;
      const fp = spriteFootprint(f.sprite);
      for (let y = f.y; y < f.y + fp.h; y++) for (let x = f.x; x < f.x + fp.w; x++) {
        expect(inBounds(x, y)).toBe(true);
        expect(grid.roomAt[idx(x, y)], `${f.sprite} at ${f.x},${f.y} hangs over a wall at ${x},${y}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('every registry agent has a seat, on a walkable tile, inside the room it is assigned to', () => {
    for (const def of AGENT_REGISTRY) {
      const seat = AGENT_SEATS[def.key];
      expect(seat, `agent ${def.key} has no seat in campusAssignments.ts`).toBeDefined();
      const ri = roomIndex(seat.room);
      expect(ri, `seat room ${seat.room} for ${def.key}`).toBeGreaterThanOrEqual(0);
      const k = idx(seat.tile.x, seat.tile.y);
      expect(grid.solid[k], `${def.key} stands on something solid at ${seat.tile.x},${seat.tile.y}`).toBe(0);
      expect(grid.roomAt[k], `${def.key} is not inside ${seat.room}`).toBe(ri);
      expect(seat.character).toBeGreaterThanOrEqual(0);
      expect(seat.character).toBeLessThanOrEqual(20);
    }
    // and no seat refers to a key the registry does not know
    const keys = new Set(AGENT_REGISTRY.map(a => a.key));
    for (const k of Object.keys(AGENT_SEATS)) expect(keys.has(k), `seat for unknown agent ${k}`).toBe(true);
    // overflow and player start are walkable too
    expect(grid.solid[idx(OVERFLOW_SEAT.tile.x, OVERFLOW_SEAT.tile.y)]).toBe(0);
    expect(grid.solid[idx(PLAYER_START.tile.x, PLAYER_START.tile.y)]).toBe(0);
  });

  it('every room is reachable on foot from the canopy (no sealed rooms)', () => {
    const start = idx(PLAYER_START.tile.x, PLAYER_START.tile.y);
    const seen = new Uint8Array(GRID_W * GRID_H);
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const k = queue.pop()!;
      const x = k % GRID_W, y = Math.floor(k / GRID_W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const nk = idx(nx, ny);
        if (seen[nk] || grid.solid[nk]) continue;
        seen[nk] = 1; queue.push(nk);
      }
    }
    for (let ri = 0; ri < ROOMS.length; ri++) {
      let reachable = false;
      for (let k = 0; k < seen.length && !reachable; k++) if (seen[k] && grid.roomAt[k] === ri) reachable = true;
      expect(reachable, `room ${ROOMS[ri].id} cannot be walked into`).toBe(true);
    }
  });

  it('every department route points at a real View and a hash that starts with #/', () => {
    for (const d of Object.values(DEPARTMENTS)) {
      for (const r of d.routes) {
        expect(r.hash.startsWith('#/')).toBe(true);
        expect(r.view.length).toBeGreaterThan(0);
      }
    }
  });
});
