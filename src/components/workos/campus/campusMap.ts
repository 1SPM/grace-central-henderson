/**
 * The GRACE Virtual Campus floor plan.
 *
 * Transcribed from the church's architectural plan at 1 tile = 2.5 ft
 * (the building is ~140 ft × 150 ft → 56 × 60 tiles, plus a canopy strip).
 * Rooms are INTERIOR rectangles; walls are the 1-tile gaps between them and
 * around the footprint, derived by `buildGrid()` — so two rooms that
 * share a wall are separated by exactly one tile. Doors are wall tiles that
 * `buildGrid()` turns back into floor.
 *
 * Everything here is data. The renderer (CampusRenderer.ts) only knows how
 * to draw rooms, walls, furniture, and characters; the CRM meaning of a room
 * lives in campusBindings.ts via `department`.
 */

export const TILE = 32;
export const GRID_W = 56;
export const GRID_H = 64;

export type FloorSprite =
  | 'floor_tile_light' | 'floor_wood' | 'floor_checker_dark' | 'floor_checker_brown'
  | 'floor_tile_grey' | 'floor_tan' | 'floor_red' | 'floor_redbrick';
export type WallSprite = 'wall_lilac' | 'wall_grey' | 'wall_brick' | 'wall_white';

export interface Rect { x: number; y: number; w: number; h: number }

export interface CampusRoom {
  id: string;
  /** Label painted on the floor. */
  name: string;
  /** Second label line (the plan's own name for the room), optional. */
  planName?: string;
  /** Interior rectangle in tiles (walls sit outside it). */
  rect: Rect;
  floor: FloorSprite;
  /** Department binding id — see campusBindings.ts. */
  department: string;
  /** Render the wall line dashed and the floor slightly tinted. */
  confidential?: boolean;
  /** Outdoor space: drawn without walls (e.g. the canopy). */
  outdoor?: boolean;
}

export interface Furniture {
  sprite: string;
  x: number;
  y: number;
  /** Blocks walking. Default true for anything not flagged decor. */
  solid?: boolean;
  /** Draw flipped vertically (used for the stage front edge). */
  flipY?: boolean;
  /** Draw beneath characters and other furniture (rugs, mats). */
  decor?: boolean;
}

export interface FloorPatch { sprite: FloorSprite; rect: Rect }
export interface Door { rect: Rect }

export const ROOMS: CampusRoom[] = [
  // --- canopy (outdoor) -----------------------------------------------------
  { id: 'canopy', name: 'Canopy', rect: { x: 24, y: 0, w: 8, h: 4 }, floor: 'floor_tile_grey', department: 'entrance', outdoor: true },

  // --- top block (x 8..47) --------------------------------------------------
  { id: 'lobby', name: 'Lobby / Foyer', planName: 'Welcome Center', rect: { x: 15, y: 5, w: 26, h: 8 }, floor: 'floor_tile_light', department: 'welcome' },
  { id: 'restroom_w1', name: 'Women', rect: { x: 9, y: 5, w: 5, h: 4 }, floor: 'floor_checker_dark', department: 'facilities' },
  { id: 'restroom_m1', name: 'Men', rect: { x: 9, y: 10, w: 5, h: 3 }, floor: 'floor_checker_dark', department: 'facilities' },
  { id: 'mur1', name: 'Communications', planName: 'Multi-use Room #1', rect: { x: 42, y: 5, w: 5, h: 8 }, floor: 'floor_tan', department: 'communications' },
  { id: 'sanctuary', name: 'Sanctuary', rect: { x: 9, y: 14, w: 38, h: 24 }, floor: 'floor_wood', department: 'sanctuary' },

  // --- back-of-house band (y 39..43) ---------------------------------------
  { id: 'nursery1', name: 'Nursery #1', rect: { x: 1, y: 39, w: 7, h: 5 }, floor: 'floor_tan', department: 'children' },
  { id: 'music', name: 'Music', rect: { x: 9, y: 39, w: 8, h: 5 }, floor: 'floor_checker_brown', department: 'worship' },
  { id: 'platform_back', name: 'Baptistry · Sound', rect: { x: 18, y: 39, w: 18, h: 5 }, floor: 'floor_tile_grey', department: 'platform_back' },
  { id: 'storage', name: 'Platform Annex', planName: 'Storage', rect: { x: 37, y: 39, w: 5, h: 5 }, floor: 'floor_checker_dark', department: 'annex' },
  { id: 'conference', name: 'Conference Room', rect: { x: 43, y: 39, w: 12, h: 5 }, floor: 'floor_tan', department: 'leadership' },

  // --- hallway --------------------------------------------------------------
  { id: 'hallway', name: '', rect: { x: 1, y: 45, w: 54, h: 2 }, floor: 'floor_tile_light', department: 'hallway' },

  // --- bottom block (y 48..62) ---------------------------------------------
  { id: 'nursery2', name: 'Nursery #2', rect: { x: 1, y: 48, w: 7, h: 6 }, floor: 'floor_tan', department: 'children' },
  { id: 'nursery3', name: 'Nursery #3', rect: { x: 9, y: 48, w: 7, h: 6 }, floor: 'floor_tan', department: 'children' },
  { id: 'mur_a', name: 'Volunteer Hub', planName: 'M.U.R. #1', rect: { x: 1, y: 55, w: 7, h: 8 }, floor: 'floor_tile_light', department: 'volunteers' },
  { id: 'mur_b', name: 'Data Room', planName: 'M.U.R. #3', rect: { x: 9, y: 55, w: 7, h: 8 }, floor: 'floor_tile_light', department: 'data' },
  { id: 'fellowship', name: 'Fellowship Hall', planName: 'Multi-use Room #4', rect: { x: 17, y: 48, w: 14, h: 15 }, floor: 'floor_wood', department: 'fellowship' },
  { id: 'restroom_w2', name: 'Women', rect: { x: 32, y: 48, w: 4, h: 7 }, floor: 'floor_checker_dark', department: 'facilities' },
  { id: 'restroom_m2', name: 'Men', rect: { x: 32, y: 56, w: 4, h: 7 }, floor: 'floor_checker_dark', department: 'facilities' },
  { id: 'admin_front', name: 'Front Office', planName: 'Administrative Assistant', rect: { x: 37, y: 48, w: 9, h: 6 }, floor: 'floor_tile_light', department: 'records' },
  { id: 'admin_work', name: 'Finance & Impact Card', planName: 'Administrative Work Room', rect: { x: 47, y: 48, w: 8, h: 6 }, floor: 'floor_tile_light', department: 'finance' },
  { id: 'senior_pastor', name: "Pastor's Study", planName: 'Senior Pastor', rect: { x: 37, y: 55, w: 9, h: 8 }, floor: 'floor_tan', department: 'study' },
  { id: 'associate_pastor', name: 'Care Wing', planName: 'Associate Pastor', rect: { x: 47, y: 55, w: 8, h: 8 }, floor: 'floor_tan', department: 'care', confidential: true },
];

/** Wall tiles turned back into floor. */
export const DOORS: Door[] = [
  { rect: { x: 26, y: 4, w: 4, h: 1 } },   // canopy → lobby (main entrance)
  { rect: { x: 26, y: 13, w: 4, h: 1 } },  // lobby → sanctuary (center)
  { rect: { x: 17, y: 13, w: 2, h: 1 } },  // lobby → sanctuary (left)
  { rect: { x: 37, y: 13, w: 2, h: 1 } },  // lobby → sanctuary (right)
  { rect: { x: 14, y: 6, w: 1, h: 2 } },   // women → lobby
  { rect: { x: 14, y: 10, w: 1, h: 2 } },  // men → lobby
  { rect: { x: 41, y: 8, w: 1, h: 2 } },   // communications → lobby
  { rect: { x: 12, y: 38, w: 2, h: 1 } },  // sanctuary → music
  { rect: { x: 26, y: 38, w: 2, h: 1 } },  // stage → baptistry/sound
  { rect: { x: 38, y: 38, w: 2, h: 1 } },  // sanctuary → storage
  { rect: { x: 44, y: 38, w: 2, h: 1 } },  // sanctuary → conference
  { rect: { x: 3, y: 44, w: 2, h: 1 } },   // nursery1 → hallway
  { rect: { x: 12, y: 44, w: 2, h: 1 } },  // music → hallway
  { rect: { x: 26, y: 44, w: 2, h: 1 } },  // baptistry/sound → hallway
  { rect: { x: 38, y: 44, w: 2, h: 1 } },  // storage → hallway
  { rect: { x: 51, y: 44, w: 2, h: 1 } },  // conference → hallway
  { rect: { x: 3, y: 47, w: 2, h: 1 } },   // hallway → nursery2
  { rect: { x: 11, y: 47, w: 2, h: 1 } },  // hallway → nursery3
  { rect: { x: 22, y: 47, w: 4, h: 1 } },  // hallway → fellowship (double)
  { rect: { x: 40, y: 47, w: 2, h: 1 } },  // hallway → front office
  { rect: { x: 50, y: 47, w: 2, h: 1 } },  // hallway → work room
  { rect: { x: 3, y: 54, w: 2, h: 1 } },   // nursery2 → volunteer hub
  { rect: { x: 11, y: 54, w: 2, h: 1 } },  // nursery3 → data room
  { rect: { x: 31, y: 50, w: 1, h: 2 } },  // fellowship → women
  { rect: { x: 31, y: 58, w: 1, h: 2 } },  // fellowship → men
  { rect: { x: 40, y: 54, w: 2, h: 1 } },  // front office → pastor's study
  { rect: { x: 50, y: 54, w: 2, h: 1 } },  // work room → care wing
  { rect: { x: 0, y: 45, w: 1, h: 2 } },   // west side entrance
  { rect: { x: 55, y: 45, w: 1, h: 2 } },  // east side entrance
];

/** Floor overrides painted on top of a room's base floor (aisles, carpets). */
export const FLOOR_PATCHES: FloorPatch[] = [
  { sprite: 'floor_red', rect: { x: 18, y: 14, w: 2, h: 19 } },  // left aisle runner
  { sprite: 'floor_red', rect: { x: 36, y: 14, w: 2, h: 19 } },  // right aisle runner
  { sprite: 'floor_red', rect: { x: 9, y: 33, w: 12, h: 1 } },   // front cross-aisle
  { sprite: 'floor_red', rect: { x: 35, y: 33, w: 12, h: 1 } },
  { sprite: 'floor_tile_grey', rect: { x: 26, y: 0, w: 4, h: 4 } }, // entry walk under canopy
];

function pews(): Furniture[] {
  const out: Furniture[] = [];
  const rows = [16, 18, 20, 22, 24, 26, 28, 30];
  const left = [10, 12, 14, 16];
  const center = [20, 22, 24, 26, 28, 30, 32, 34];
  const right = [38, 40, 42, 44];
  for (const y of rows) {
    for (const x of [...left, ...center, ...right]) out.push({ sprite: 'pew_orange', x, y });
  }
  return out;
}

function stage(): Furniture[] {
  const out: Furniture[] = [];
  // Platform x 21..34, y 33..37. Front (raised edge) faces the pews to the north.
  for (let x = 21; x <= 34; x++) out.push({ sprite: 'stage_front', x, y: 33, flipY: true, decor: true, solid: false });
  for (let y = 34; y <= 37; y++) for (let x = 21; x <= 34; x++) out.push({ sprite: 'stage_floor', x, y, decor: true, solid: false });
  return out;
}

export const FURNITURE: Furniture[] = [
  // --- lobby ---
  { sprite: 'rug_red_big', x: 26, y: 5, decor: true, solid: false },
  { sprite: 'desk_tan_3', x: 26, y: 9 },
  { sprite: 'chair_dark_down', x: 27, y: 7 },
  { sprite: 'couch_grey', x: 16, y: 6 },
  { sprite: 'couch_grey', x: 16, y: 10 },
  { sprite: 'table_tan', x: 18, y: 8 },
  { sprite: 'lounge_blue', x: 36, y: 6 },
  { sprite: 'lounge_grey', x: 37, y: 6 },
  { sprite: 'lounge_lilac', x: 36, y: 10 },
  { sprite: 'lounge_tan', x: 37, y: 10 },
  { sprite: 'table_tan', x: 38, y: 8 },
  { sprite: 'plant_big', x: 15, y: 8 },
  { sprite: 'plant_big2', x: 40, y: 5 },
  { sprite: 'plant_big', x: 21, y: 11 },
  { sprite: 'plant_big2', x: 40, y: 11 },
  { sprite: 'poster_team', x: 32, y: 4, solid: false },
  { sprite: 'painting_a', x: 21, y: 4, solid: false },
  { sprite: 'water_cooler', x: 22, y: 11 },
  { sprite: 'vending', x: 23, y: 10 },

  // --- restrooms (top) ---
  { sprite: 'toilet_white', x: 9, y: 5 }, { sprite: 'toilet_white', x: 11, y: 5 }, { sprite: 'sink_counter', x: 9, y: 7 },
  { sprite: 'toilet_white', x: 9, y: 10 }, { sprite: 'toilet_white', x: 10, y: 10 }, { sprite: 'sink_counter', x: 11, y: 11 },

  // --- communications (MUR #1) ---
  { sprite: 'workstation_b', x: 42, y: 6 },
  { sprite: 'chair_dark_up', x: 43, y: 8 },
  { sprite: 'printer_big', x: 46, y: 5 },
  { sprite: 'shelf_books', x: 44, y: 10 },
  { sprite: 'plant_small', x: 46, y: 12 },
  { sprite: 'tv_wall', x: 44, y: 4, solid: false },

  // --- sanctuary ---
  ...pews(),
  ...stage(),
  { sprite: 'piano_upright', x: 22, y: 34 },
  { sprite: 'mic_stand', x: 25, y: 35 },
  { sprite: 'podium_mic', x: 27, y: 35 },
  { sprite: 'guitar_acoustic', x: 30, y: 34 },
  { sprite: 'drum_red', x: 31, y: 35 },
  { sprite: 'drape_left', x: 19, y: 34, solid: false },
  { sprite: 'drape_right', x: 35, y: 34, solid: false },
  { sprite: 'screen_sq', x: 12, y: 34, solid: false },
  { sprite: 'screen_sq', x: 42, y: 34, solid: false },
  { sprite: 'plant_big', x: 9, y: 36 },
  { sprite: 'plant_big2', x: 46, y: 36 },
  { sprite: 'workstation_a', x: 44, y: 14 },   // sound desk at the back
  { sprite: 'banner_red', x: 23, y: 37, solid: false },
  { sprite: 'banner_blue', x: 32, y: 37, solid: false },

  // --- nursery #1 ---
  { sprite: 'bed_blue', x: 1, y: 39 }, { sprite: 'bed_red', x: 4, y: 39 },
  { sprite: 'rug_small_green', x: 2, y: 42, decor: true, solid: false }, { sprite: 'stool', x: 6, y: 42 }, { sprite: 'plant_small', x: 7, y: 43 },

  // --- music ---
  { sprite: 'piano_red', x: 9, y: 39 }, { sprite: 'harp', x: 15, y: 39 }, { sprite: 'amp', x: 11, y: 39 },
  { sprite: 'guitar_acoustic', x: 9, y: 42 }, { sprite: 'guitar_electric', x: 10, y: 42 }, { sprite: 'drum_red', x: 15, y: 42 }, { sprite: 'chair_wood', x: 14, y: 40 },

  // --- baptistry & sound booth ---
  { sprite: 'tub_blue', x: 26, y: 40 }, { sprite: 'bath_mat', x: 25, y: 41, decor: true, solid: false },
  { sprite: 'workstation_c', x: 19, y: 40 }, { sprite: 'chair_dark_up', x: 19, y: 42 }, { sprite: 'servers', x: 22, y: 39 },
  { sprite: 'shelf_books', x: 32, y: 39 }, { sprite: 'cabinet_grey', x: 34, y: 39 }, { sprite: 'amp', x: 35, y: 42 },

  // --- storage / platform annex ---
  { sprite: 'cabinet_files', x: 37, y: 39 }, { sprite: 'cabinet_grey', x: 37, y: 41 }, { sprite: 'drawers_a', x: 41, y: 39 },
  { sprite: 'drawers_b', x: 41, y: 41 }, { sprite: 'workstation_b', x: 39, y: 41 },

  // --- conference room ---
  { sprite: 'chair_dark_down', x: 46, y: 39 }, { sprite: 'chair_dark_down', x: 47, y: 39 }, { sprite: 'chair_dark_down', x: 48, y: 39 }, { sprite: 'chair_dark_down', x: 49, y: 39 },
  { sprite: 'table_long_brown', x: 46, y: 40 },
  { sprite: 'chair_dark_up', x: 46, y: 42 }, { sprite: 'chair_dark_up', x: 47, y: 42 }, { sprite: 'chair_dark_up', x: 48, y: 42 }, { sprite: 'chair_dark_up', x: 49, y: 42 },
  { sprite: 'tv_wall', x: 50, y: 38, solid: false }, { sprite: 'whiteboard_chart', x: 53, y: 38, solid: false },
  { sprite: 'plant_big2', x: 54, y: 42 }, { sprite: 'water_cooler', x: 43, y: 42 },

  // --- hallway ---
  { sprite: 'whiteboard_chart', x: 18, y: 44, solid: false },   // the Bulletin Board
  { sprite: 'fire_ext', x: 30, y: 44, solid: false },
  { sprite: 'plant_small', x: 16, y: 46 }, { sprite: 'plant_small', x: 36, y: 46 }, { sprite: 'plant_small', x: 8, y: 46 },

  // --- nurseries #2, #3 ---
  { sprite: 'bed_white', x: 1, y: 50 }, { sprite: 'bed_blue', x: 4, y: 50 }, { sprite: 'rug_small_red', x: 2, y: 52, decor: true, solid: false },
  { sprite: 'table_round_small', x: 6, y: 52 }, { sprite: 'stool', x: 1, y: 53 },
  { sprite: 'bed_red', x: 9, y: 50 }, { sprite: 'bed_white', x: 12, y: 50 }, { sprite: 'rug_small_blue', x: 10, y: 52, decor: true, solid: false },
  { sprite: 'cabinet_wood', x: 9, y: 48 }, { sprite: 'stool2', x: 14, y: 52 },

  // --- volunteer hub ---
  { sprite: 'table_big_yellow', x: 2, y: 56 }, { sprite: 'chair_wood', x: 1, y: 56 }, { sprite: 'chair_wood2', x: 5, y: 56 },
  { sprite: 'whiteboard_chart', x: 5, y: 54, solid: false }, { sprite: 'shelf_books', x: 6, y: 60 }, { sprite: 'plant_big', x: 1, y: 61 },

  // --- data room ---
  { sprite: 'workstation_a', x: 9, y: 56 }, { sprite: 'chair_dark_up', x: 9, y: 58 },
  { sprite: 'workstation_c', x: 12, y: 56 }, { sprite: 'chair_dark_up', x: 12, y: 58 },
  { sprite: 'servers', x: 15, y: 55 }, { sprite: 'whiteboard_chart', x: 13, y: 54, solid: false },
  { sprite: 'printer_big', x: 15, y: 60 }, { sprite: 'plant_big2', x: 9, y: 61 },

  // --- fellowship hall ---
  { sprite: 'table_big_orange', x: 18, y: 49 }, { sprite: 'chair_wood', x: 17, y: 49 }, { sprite: 'chair_wood2', x: 21, y: 49 },
  { sprite: 'table_big_orange', x: 24, y: 49 }, { sprite: 'chair_wood', x: 23, y: 49 }, { sprite: 'chair_wood2', x: 27, y: 49 },
  { sprite: 'table_big_orange', x: 18, y: 55 }, { sprite: 'chair_wood', x: 17, y: 55 }, { sprite: 'chair_wood2', x: 21, y: 55 },
  { sprite: 'table_big_orange', x: 24, y: 55 }, { sprite: 'chair_wood', x: 23, y: 55 }, { sprite: 'chair_wood2', x: 27, y: 55 },
  { sprite: 'vending', x: 29, y: 48 }, { sprite: 'fridge', x: 30, y: 48 }, { sprite: 'water_cooler', x: 29, y: 52 },
  { sprite: 'tv_wall', x: 18, y: 47, solid: false }, { sprite: 'podium', x: 28, y: 60 },
  { sprite: 'plant_big', x: 17, y: 61 }, { sprite: 'plant_big2', x: 30, y: 61 },

  // --- restrooms (bottom) ---
  { sprite: 'toilet_white', x: 32, y: 48 }, { sprite: 'toilet_white', x: 34, y: 48 }, { sprite: 'sink_counter', x: 32, y: 52 }, { sprite: 'bath_mat', x: 34, y: 53, decor: true, solid: false },
  { sprite: 'toilet_white', x: 32, y: 56 }, { sprite: 'toilet_white', x: 34, y: 56 }, { sprite: 'sink_counter', x: 32, y: 60 }, { sprite: 'bath_mat', x: 34, y: 61, decor: true, solid: false },

  // --- front office (records) ---
  { sprite: 'workstation_a', x: 37, y: 49 }, { sprite: 'chair_dark_up', x: 38, y: 51 },
  { sprite: 'workstation_c', x: 41, y: 49 }, { sprite: 'chair_dark_up', x: 42, y: 51 },
  { sprite: 'cabinet_files', x: 45, y: 48 }, { sprite: 'cabinet_grey', x: 45, y: 50 }, { sprite: 'copier', x: 44, y: 52 },
  { sprite: 'poster_team', x: 43, y: 47, solid: false },

  // --- work room (finance & impact card) ---
  { sprite: 'desk_grey_3', x: 47, y: 49 }, { sprite: 'chair_dark_up', x: 48, y: 51 },
  { sprite: 'workstation_b', x: 51, y: 49 }, { sprite: 'chair_dark_up', x: 52, y: 51 },
  { sprite: 'printer_big', x: 54, y: 48 }, { sprite: 'cabinet_files', x: 54, y: 50 },
  { sprite: 'whiteboard_chart', x: 48, y: 47, solid: false }, { sprite: 'plant_big2', x: 54, y: 52 },

  // --- pastor's study ---
  { sprite: 'rug_red_big', x: 41, y: 59, decor: true, solid: false },
  { sprite: 'desk_l_tan2', x: 39, y: 56 }, { sprite: 'chair_dark_up', x: 40, y: 59 },
  { sprite: 'shelf_books', x: 37, y: 55 }, { sprite: 'shelf_tall', x: 44, y: 55 },
  { sprite: 'couch_grey', x: 37, y: 60 }, { sprite: 'plant_big', x: 45, y: 61 },
  { sprite: 'cert_frame', x: 42, y: 54, solid: false }, { sprite: 'cert_frame', x: 43, y: 54, solid: false },
  { sprite: 'lounge_tan', x: 43, y: 59 },

  // --- care wing (associate pastor) ---
  { sprite: 'rug_blue_big', x: 50, y: 59, decor: true, solid: false },
  { sprite: 'desk_lilac_3', x: 48, y: 56 }, { sprite: 'chair_dark_up', x: 49, y: 58 },
  { sprite: 'couch_grey2', x: 52, y: 56 },
  { sprite: 'lounge_blue', x: 47, y: 60 }, { sprite: 'lounge_grey', x: 48, y: 60 }, { sprite: 'table_tan', x: 49, y: 60 },
  { sprite: 'plant_big2', x: 54, y: 61 }, { sprite: 'cert_frame', x: 51, y: 54, solid: false }, { sprite: 'shelf_books', x: 53, y: 58 },
];

// ---------------------------------------------------------------------------
// Derived grids
// ---------------------------------------------------------------------------

export const Cell = { Outside: 0, Floor: 1, Wall: 2 } as const;

export interface CampusGrid {
  cells: Uint8Array;       // Cell per tile (GRID_W * GRID_H)
  roomAt: Int16Array;      // room index per tile, -1 if none
  solid: Uint8Array;       // 1 = not walkable (walls, solid furniture, outside)
}

export function idx(x: number, y: number): number { return y * GRID_W + x; }
export function inBounds(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H; }

/** Build the cell, room-index, and solidity grids from the data above. */
export function buildGrid(): CampusGrid {
  const n = GRID_W * GRID_H;
  const cells = new Uint8Array(n);
  const roomAt = new Int16Array(n).fill(-1);
  const solid = new Uint8Array(n).fill(1);

  // Floors
  ROOMS.forEach((room, ri) => {
    const { x, y, w, h } = room.rect;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const i = idx(xx, yy); cells[i] = Cell.Floor; roomAt[i] = ri; solid[i] = 0;
    }
  });

  // Walls = tiles adjacent (8-neighbour) to an indoor floor tile that are not floor.
  for (const room of ROOMS) {
    if (room.outdoor) continue;
    const { x, y, w, h } = room.rect;
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      if (!inBounds(xx, yy)) continue;
      const i = idx(xx, yy);
      if (cells[i] !== Cell.Floor) { cells[i] = Cell.Wall; solid[i] = 1; }
    }
  }

  // Doors: wall → floor, inherit the room of the nearest floor neighbour.
  for (const door of DOORS) {
    const { x, y, w, h } = door.rect;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!inBounds(xx, yy)) continue;
      const i = idx(xx, yy);
      cells[i] = Cell.Floor; solid[i] = 0;
      if (roomAt[i] < 0) {
        const nb = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => inBounds(xx + dx, yy + dy) ? roomAt[idx(xx + dx, yy + dy)] : -1).find(r => r >= 0);
        roomAt[i] = nb ?? -1;
      }
    }
  }

  // Solid furniture
  for (const f of FURNITURE) {
    if (f.solid === false || f.decor) continue;
    const size = spriteFootprint(f.sprite);
    for (let yy = f.y; yy < f.y + size.h; yy++) for (let xx = f.x; xx < f.x + size.w; xx++) {
      if (inBounds(xx, yy)) solid[idx(xx, yy)] = 1;
    }
  }

  return { cells, roomAt, solid };
}

/**
 * Footprint in tiles for collision. Sprite pixel sizes come from the atlas at
 * render time; for collision we only need the tile grid, so this mirrors the
 * manifest (w,h in tiles). Anything not listed is assumed 1x1.
 */
const FOOTPRINTS: Record<string, { w: number; h: number }> = {
  chair_dark_down: { w: 1, h: 2 }, chair_dark_up: { w: 1, h: 2 }, chair_dark_left: { w: 1, h: 2 }, chair_dark_right: { w: 1, h: 2 },
  chair_orange_down: { w: 1, h: 2 }, chair_orange_up: { w: 1, h: 2 }, plant_big: { w: 1, h: 2 }, plant_big2: { w: 1, h: 2 },
  cert_frame: { w: 1, h: 2 }, tv_wall: { w: 2, h: 2 }, whiteboard_chart: { w: 2, h: 2 }, shelf_books: { w: 2, h: 2 }, shelf_tall: { w: 2, h: 3 },
  poster_team: { w: 2, h: 2 }, lounge_blue: { w: 1, h: 2 }, lounge_grey: { w: 1, h: 2 }, lounge_lilac: { w: 1, h: 2 }, lounge_tan: { w: 1, h: 2 },
  couch_grey: { w: 2, h: 2 }, couch_grey2: { w: 2, h: 2 }, sofa_l: { w: 3, h: 3 }, table_tan: { w: 2, h: 2 }, table_orange: { w: 2, h: 2 }, table_brown: { w: 2, h: 2 },
  vending: { w: 1, h: 3 }, vending2: { w: 1, h: 3 }, fridge: { w: 1, h: 2 }, printer_big: { w: 1, h: 2 }, copier: { w: 1, h: 2 },
  desk_tan_3: { w: 3, h: 2 }, desk_grey_3: { w: 3, h: 2 }, desk_lilac_3: { w: 3, h: 2 }, desk_tan_dots_3: { w: 3, h: 2 }, desk_tan2_3: { w: 3, h: 2 },
  workstation_a: { w: 2, h: 2 }, workstation_b: { w: 2, h: 2 }, workstation_c: { w: 2, h: 2 }, desk_printer: { w: 2, h: 1 },
  desk_l_tan: { w: 3, h: 3 }, desk_l_lilac: { w: 3, h: 3 }, desk_l_tan2: { w: 3, h: 3 }, cabinet_grey: { w: 1, h: 2 }, cabinet_files: { w: 1, h: 2 },
  water_cooler: { w: 1, h: 2 }, desk_lamp: { w: 1, h: 2 }, chair_swivel_grey: { w: 1, h: 2 }, chair_swivel_grey2: { w: 1, h: 2 }, servers: { w: 1, h: 2 },
  podium: { w: 1, h: 2 }, podium_mic: { w: 1, h: 2 }, banner_red: { w: 1, h: 2 }, banner_blue: { w: 1, h: 2 }, banner_blue2: { w: 1, h: 2 },
  drape_left: { w: 2, h: 2 }, drape_right: { w: 2, h: 2 }, screen_sq: { w: 2, h: 2 }, seat_tan_pair: { w: 2, h: 2 }, table_long_brown: { w: 4, h: 2 },
  mic_stand: { w: 1, h: 2 }, fire_ext: { w: 1, h: 2 }, spotlight_pool: { w: 5, h: 3 },
  piano_upright: { w: 2, h: 3 }, piano_red: { w: 2, h: 3 }, guitar_acoustic: { w: 1, h: 2 }, guitar_electric: { w: 1, h: 2 }, harp: { w: 2, h: 3 },
  amp: { w: 1, h: 2 }, drum_red: { w: 2, h: 2 }, conga: { w: 2, h: 2 }, piano_bench: { w: 2, h: 1 },
  toilet_white: { w: 1, h: 2 }, toilet_tan: { w: 1, h: 2 }, sink_counter: { w: 2, h: 2 }, sink_counter2: { w: 2, h: 2 }, mirror_tall: { w: 2, h: 2 }, tub_blue: { w: 2, h: 2 },
  table_big_orange: { w: 3, h: 3 }, table_big_yellow: { w: 3, h: 3 }, table_long_orange: { w: 3, h: 2 },
  rug_red_big: { w: 4, h: 3 }, rug_blue_big: { w: 4, h: 3 }, rug_tall_blue: { w: 3, h: 4 }, rug_tall_red: { w: 3, h: 4 },
  rug_small_red: { w: 2, h: 2 }, rug_small_green: { w: 2, h: 2 }, rug_small_blue: { w: 2, h: 2 },
  chair_wood: { w: 1, h: 2 }, chair_wood2: { w: 1, h: 2 }, bench_red: { w: 3, h: 2 }, cabinet_wood: { w: 1, h: 2 },
  pew_light: { w: 2, h: 2 }, pew_orange: { w: 2, h: 2 }, bed_red: { w: 3, h: 2 }, bed_blue: { w: 3, h: 2 }, bed_white: { w: 3, h: 2 },
  palm: { w: 2, h: 3 }, drawers_a: { w: 1, h: 2 }, drawers_b: { w: 1, h: 2 }, window_small: { w: 2, h: 1 }, window_sq: { w: 2, h: 2 }, cabinet_glass: { w: 2, h: 2 },
  painting_a: { w: 2, h: 1 }, painting_b: { w: 2, h: 1 }, painting_c: { w: 2, h: 1 },
};

export function spriteFootprint(sprite: string): { w: number; h: number } {
  return FOOTPRINTS[sprite] ?? { w: 1, h: 1 };
}

export function roomById(id: string): CampusRoom | undefined {
  return ROOMS.find(r => r.id === id);
}

/** Centre of a room in tile coordinates (fractional). */
export function roomCentre(room: CampusRoom): { x: number; y: number } {
  return { x: room.rect.x + room.rect.w / 2, y: room.rect.y + room.rect.h / 2 };
}
