#!/usr/bin/env node
/**
 * Build the GRACE Virtual Campus sprite atlas.
 *
 *   CAMPUS_ASSET_ROOT="/Volumes/Orange 2026/Virtual Office Graphics" \
 *     node tools/campus/build-atlas.mjs
 *
 * Reads the rectangles named in tools/campus/manifest.mjs out of the LimeZu
 * source sheets and packs ONLY those into:
 *
 *   public/campus/atlas.png                      — the packed image
 *   src/components/workos/campus/atlas.json      — name → {x,y,w,h} (pixels)
 *
 * The source tilesets are never committed. Re-run this whenever the manifest
 * changes. Pure JS (pngjs) — no native image deps.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import {
  SHEETS, SPRITES, CHARACTER_SHEET, CHARACTER_IDS,
  FRAME_W, FRAME_H, IDLE_ROW_Y, WALK_ROW_Y, FRAMES_PER_DIR, DIRS,
} from './manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const ASSET_ROOT = process.env.CAMPUS_ASSET_ROOT || '/Volumes/Orange 2026/Virtual Office Graphics';
const TILE = 32;
const ATLAS_W = 1024;

function readPng(rel) {
  const abs = path.join(ASSET_ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing source sheet: ${abs}`);
  return PNG.sync.read(fs.readFileSync(abs));
}

const sheetCache = new Map();
function sheet(key) {
  if (!sheetCache.has(key)) sheetCache.set(key, readPng(key));
  return sheetCache.get(key);
}

// --- collect every rect we need ---------------------------------------------
/** @type {{name:string, src:PNG, sx:number, sy:number, w:number, h:number}[]} */
const items = [];

for (const [name, [sheetKey, col, row, w, h]] of Object.entries(SPRITES)) {
  const png = sheet(SHEETS[sheetKey]);
  const sx = col * TILE, sy = row * TILE, pw = w * TILE, ph = h * TILE;
  if (sx + pw > png.width || sy + ph > png.height) {
    throw new Error(`Sprite ${name} rect (${col},${row},${w},${h}) exceeds sheet ${sheetKey} (${png.width}x${png.height})`);
  }
  items.push({ name, src: png, sx, sy, w: pw, h: ph });
}

// Characters: one strip per character per animation (idle/walk), 24 frames wide.
const characters = {};
for (const id of CHARACTER_IDS) {
  const png = sheet(CHARACTER_SHEET(id));
  const key = `char_${String(id).padStart(2, '0')}`;
  characters[key] = { idle: `${key}_idle`, walk: `${key}_walk`, frameW: FRAME_W, frameH: FRAME_H, framesPerDir: FRAMES_PER_DIR, dirs: DIRS };
  items.push({ name: `${key}_idle`, src: png, sx: 0, sy: IDLE_ROW_Y, w: FRAME_W * FRAMES_PER_DIR * DIRS.length, h: FRAME_H });
  items.push({ name: `${key}_walk`, src: png, sx: 0, sy: WALK_ROW_Y, w: FRAME_W * FRAMES_PER_DIR * DIRS.length, h: FRAME_H });
}

// --- shelf pack -------------------------------------------------------------
items.sort((a, b) => b.h - a.h || b.w - a.w);
let x = 0, y = 0, shelfH = 0;
const placed = {};
for (const it of items) {
  if (it.w > ATLAS_W) throw new Error(`Sprite ${it.name} wider than atlas (${it.w})`);
  if (x + it.w > ATLAS_W) { x = 0; y += shelfH; shelfH = 0; }
  placed[it.name] = { x, y, w: it.w, h: it.h };
  it.dx = x; it.dy = y;
  x += it.w; shelfH = Math.max(shelfH, it.h);
}
const ATLAS_H = y + shelfH;

const atlas = new PNG({ width: ATLAS_W, height: ATLAS_H });
atlas.data.fill(0);
for (const it of items) {
  PNG.bitblt(it.src, atlas, it.sx, it.sy, it.w, it.h, it.dx, it.dy);
}

const outPng = path.join(repoRoot, 'public/campus/atlas.png');
const outJson = path.join(repoRoot, 'src/components/workos/campus/atlas.json');
fs.mkdirSync(path.dirname(outPng), { recursive: true });
fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outPng, PNG.sync.write(atlas));
fs.writeFileSync(outJson, JSON.stringify({
  image: '/campus/atlas.png',
  tile: TILE,
  width: ATLAS_W,
  height: ATLAS_H,
  sprites: placed,
  characters,
}, null, 1));

console.log(`atlas: ${ATLAS_W}x${ATLAS_H}, ${Object.keys(SPRITES).length} sprites, ${CHARACTER_IDS.length} characters`);
console.log(`wrote ${path.relative(repoRoot, outPng)} and ${path.relative(repoRoot, outJson)}`);
