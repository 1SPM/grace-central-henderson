// Sprite manifest for the GRACE Virtual Campus atlas.
//
// Every entry names a rectangle (in 32px tiles: col,row,w,h) on one of the
// LimeZu "Modern Interiors" / "Modern Office" source sheets. The build script
// (build-atlas.mjs) copies ONLY these rectangles into public/campus/atlas.png —
// the raw tilesets are never committed (licence: use in a project is allowed,
// redistribution of the asset is not).
//
// Sheet keys resolve against CAMPUS_ASSET_ROOT (see build-atlas.mjs).

export const SHEETS = {
  office: 'Modern_Office_Revamped_v1.2/Modern_Office_32x32.png',
  rb: 'Modern_Office_Revamped_v1.2/1_Room_Builder_Office/Room_Builder_Office_32x32.png',
  conf: 'moderninteriors-win/1_Interiors/32x32/Theme_Sorter_32x32/13_Conference_Hall_32x32.png',
  music: 'moderninteriors-win/1_Interiors/32x32/Theme_Sorter_32x32/6_Music_and_sport_32x32.png',
  bath: 'moderninteriors-win/1_Interiors/32x32/Theme_Sorter_32x32/3_Bathroom_32x32.png',
  gen: 'moderninteriors-win/1_Interiors/32x32/Theme_Sorter_32x32/1_Generic_32x32.png',
};

// name: [sheet, col, row, w, h]  (tiles)
export const SPRITES = {
  // --- floors (1x1, tiled) ---
  floor_tile_light: ['rb', 11, 5, 1, 1],
  floor_wood: ['rb', 14, 5, 1, 1],
  floor_checker_dark: ['rb', 11, 7, 1, 1],
  floor_checker_brown: ['rb', 14, 7, 1, 1],
  floor_tile_grey: ['rb', 11, 9, 1, 1],
  floor_tan: ['rb', 14, 9, 1, 1],
  floor_red: ['rb', 11, 11, 1, 1],
  floor_redbrick: ['rb', 14, 11, 1, 1],
  // --- wall faces (1x1) ---
  wall_lilac: ['rb', 1, 6, 1, 1],
  wall_grey: ['rb', 1, 8, 1, 1],
  wall_brick: ['rb', 1, 10, 1, 1],
  wall_white: ['rb', 1, 12, 1, 1],
  wall_lilac_trim: ['rb', 1, 5, 1, 1],
  wall_white_trim: ['rb', 1, 11, 1, 1],

  // --- office furniture ---
  chair_dark_down: ['office', 0, 8, 1, 2],
  chair_dark_up: ['office', 1, 8, 1, 2],
  chair_dark_left: ['office', 4, 8, 1, 2],
  chair_dark_right: ['office', 5, 8, 1, 2],
  chair_orange_down: ['office', 0, 10, 1, 2],
  chair_orange_up: ['office', 1, 10, 1, 2],
  plant_big: ['office', 6, 8, 1, 2],
  plant_big2: ['office', 6, 10, 1, 2],
  plant_small: ['office', 6, 13, 1, 1],
  cert_frame: ['office', 7, 8, 1, 2],
  tv_wall: ['office', 9, 10, 2, 2],
  whiteboard_chart: ['office', 9, 12, 2, 2],
  shelf_books: ['office', 7, 12, 2, 2],
  shelf_tall: ['office', 7, 15, 2, 3],
  poster_team: ['office', 0, 12, 2, 2],
  lounge_blue: ['office', 3, 15, 1, 2],
  lounge_grey: ['office', 4, 15, 1, 2],
  lounge_lilac: ['office', 5, 15, 1, 2],
  lounge_tan: ['office', 6, 15, 1, 2],
  couch_grey: ['office', 0, 17, 2, 2],
  couch_grey2: ['office', 0, 19, 2, 2],
  sofa_l: ['office', 2, 17, 3, 3],
  table_tan: ['office', 5, 18, 2, 2],
  table_orange: ['office', 5, 20, 2, 2],
  table_brown: ['office', 5, 22, 2, 2],
  vending: ['office', 0, 23, 1, 3],
  vending2: ['office', 2, 23, 1, 3],
  fridge: ['office', 4, 24, 1, 2],
  printer_big: ['office', 8, 22, 1, 2],
  copier: ['office', 8, 19, 1, 2],
  desk_tan_3: ['office', 7, 28, 3, 2],
  desk_grey_3: ['office', 10, 28, 3, 2],
  desk_lilac_3: ['office', 1, 30, 3, 2],
  desk_tan_dots_3: ['office', 4, 30, 3, 2],
  desk_tan2_3: ['office', 7, 30, 3, 2],
  workstation_a: ['office', 8, 38, 2, 2],
  workstation_b: ['office', 10, 38, 2, 2],
  workstation_c: ['office', 12, 38, 2, 2],
  desk_printer: ['office', 8, 42, 2, 1],
  desk_l_tan: ['office', 0, 34, 3, 3],
  desk_l_lilac: ['office', 0, 37, 3, 3],
  desk_l_tan2: ['office', 4, 43, 3, 3],
  cabinet_grey: ['office', 14, 30, 1, 2],
  cabinet_files: ['office', 15, 30, 1, 2],
  water_cooler: ['office', 12, 15, 1, 2],
  desk_lamp: ['office', 11, 15, 1, 2],
  chair_swivel_grey: ['office', 13, 34, 1, 2],
  chair_swivel_grey2: ['office', 13, 36, 1, 2],
  servers: ['office', 13, 12, 1, 2],

  // --- conference hall / stage ---
  stage_tl: ['conf', 0, 1, 1, 1],
  stage_top: ['conf', 1, 1, 1, 1],
  stage_tr: ['conf', 3, 1, 1, 1],
  stage_left: ['conf', 0, 2, 1, 1],
  stage_floor: ['conf', 1, 2, 1, 1],
  stage_right: ['conf', 3, 2, 1, 1],
  stage_bl: ['conf', 0, 3, 1, 1],
  stage_front: ['conf', 1, 3, 1, 1],
  stage_br: ['conf', 3, 3, 1, 1],
  podium: ['conf', 7, 2, 1, 2],
  podium_mic: ['conf', 8, 2, 1, 2],
  banner_red: ['conf', 5, 4, 1, 2],
  banner_blue: ['conf', 6, 4, 1, 2],
  banner_blue2: ['conf', 7, 4, 1, 2],
  drape_left: ['conf', 0, 6, 2, 2],
  drape_right: ['conf', 2, 6, 2, 2],
  screen_sq: ['conf', 13, 1, 2, 2],
  seat_tan_pair: ['conf', 11, 6, 2, 2],
  table_long_brown: ['conf', 9, 4, 4, 2],
  mic_stand: ['conf', 13, 4, 1, 2],
  fire_ext: ['conf', 13, 7, 1, 2],
  spotlight_pool: ['conf', 0, 8, 5, 3],

  // --- music ---
  piano_upright: ['music', 0, 1, 2, 3],
  piano_red: ['music', 0, 6, 2, 3],
  guitar_acoustic: ['music', 7, 3, 1, 2],
  guitar_electric: ['music', 10, 3, 1, 2],
  harp: ['music', 13, 0, 2, 3],
  amp: ['music', 6, 0, 1, 2],
  drum_red: ['music', 10, 11, 2, 2],
  conga: ['music', 13, 11, 2, 2],
  piano_bench: ['music', 0, 4, 2, 1],

  // --- bathroom ---
  toilet_white: ['bath', 10, 0, 1, 2],
  toilet_tan: ['bath', 7, 0, 1, 2],
  sink_counter: ['bath', 7, 6, 2, 2],
  sink_counter2: ['bath', 9, 6, 2, 2],
  mirror_tall: ['bath', 4, 8, 2, 2],
  tub_blue: ['bath', 6, 12, 2, 2],
  bath_mat: ['bath', 0, 3, 1, 1],

  // --- generic ---
  table_big_orange: ['gen', 1, 5, 3, 3],
  table_big_yellow: ['gen', 1, 8, 3, 3],
  table_round_small: ['gen', 5, 5, 1, 1],
  table_long_orange: ['gen', 5, 6, 3, 2],
  rug_red_big: ['gen', 9, 4, 4, 3],
  rug_blue_big: ['gen', 9, 7, 4, 3],
  rug_tall_blue: ['gen', 13, 5, 3, 4],
  rug_tall_red: ['gen', 13, 9, 3, 4],
  rug_small_red: ['gen', 9, 10, 2, 2],
  rug_small_green: ['gen', 11, 10, 2, 2],
  rug_small_blue: ['gen', 11, 12, 2, 2],
  chair_wood: ['gen', 4, 11, 1, 2],
  chair_wood2: ['gen', 5, 11, 1, 2],
  bench_red: ['gen', 6, 11, 3, 2],
  cabinet_wood: ['gen', 0, 11, 1, 2],
  pew_light: ['gen', 0, 15, 2, 2],
  pew_orange: ['gen', 2, 15, 2, 2],
  bed_red: ['gen', 8, 16, 3, 2],
  bed_blue: ['gen', 8, 18, 3, 2],
  bed_white: ['gen', 8, 20, 3, 2],
  stool: ['gen', 0, 17, 1, 1],
  stool2: ['gen', 1, 17, 1, 1],
  palm: ['gen', 13, 25, 2, 3],
  drawers_a: ['gen', 3, 20, 1, 2],
  drawers_b: ['gen', 4, 20, 1, 2],
  window_small: ['gen', 5, 8, 2, 1],
  window_sq: ['gen', 5, 9, 2, 2],
  cabinet_glass: ['gen', 0, 21, 2, 2],
  painting_a: ['gen', 0, 13, 2, 1],
  painting_b: ['gen', 2, 13, 2, 1],
  painting_c: ['gen', 4, 13, 2, 1],
};

// Premade characters: sheet path pattern + frame layout (32x64 frames;
// row 1 = idle, row 2 = walk; 6 frames each for right, up, left, down).
export const CHARACTER_SHEET = (n) =>
  `moderninteriors-win/2_Characters/Character_Generator/0_Premade_Characters/32x32/Premade_Character_32x32_${String(n).padStart(2, '0')}.png`;
export const CHARACTER_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
export const FRAME_W = 32;
export const FRAME_H = 64;
export const IDLE_ROW_Y = 64;
export const WALK_ROW_Y = 128;
export const FRAMES_PER_DIR = 6;
export const DIRS = ['right', 'up', 'left', 'down'];
