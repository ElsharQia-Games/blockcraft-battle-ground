/* Blockcraft Battle Ground — Procedural texture atlas, block definitions and voxel storage.
   10-textures.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ---------------- procedural texture atlas ---------------- */
const ATLAS_COLS = 8, ATLAS_ROWS = 8, TILE_PX = 16;
const ATLAS_W = ATLAS_COLS * TILE_PX, ATLAS_H = ATLAS_ROWS * TILE_PX;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const paintRnd = mulberry32(918273);
const tileCanvas = document.createElement('canvas');
tileCanvas.width = ATLAS_W;
tileCanvas.height = ATLAS_H;
const tctx = tileCanvas.getContext('2d');
tctx.imageSmoothingEnabled = false;

function tileOrigin(i) {
  return [ (i % ATLAS_COLS) * TILE_PX, Math.floor(i / ATLAS_COLS) * TILE_PX ];
}
function px(i, x, y, color) {
  const [ox, oy] = tileOrigin(i);
  tctx.fillStyle = color;
  tctx.fillRect(ox + x, oy + y, 1, 1);
}
function fillTile(i, color) {
  const [ox, oy] = tileOrigin(i);
  tctx.fillStyle = color;
  tctx.fillRect(ox, oy, TILE_PX, TILE_PX);
}
function speckle(i, colors, count) {
  for (let k = 0; k < count; k++) {
    px(i, Math.floor(paintRnd() * TILE_PX), Math.floor(paintRnd() * TILE_PX),
       colors[Math.floor(paintRnd() * colors.length)]);
  }
}
function noiseTile(i, base, colors, count) {
  fillTile(i, base);
  speckle(i, colors, count);
}

/* solid colours per material */
const C = {
  grass:  ['#5c9c3b', '#6cb046', '#4f8b32', '#77ba50'],
  dirt:   ['#8a5a3c', '#7a4e33', '#96654a', '#6f452c'],
  stone:  ['#8a8a8a', '#7d7d7d', '#969696', '#747474'],
  sand:   ['#ded3a5', '#e7ddb4', '#cfc497', '#f0e7c4'],
  bark:   ['#6d4a2c', '#5c3d23', '#7b5533', '#4e331d'],
  leaf:   ['#3d7a2c', '#356b26', '#4a8c37', '#2c5c1f'],
  plank:  ['#b78d52', '#a87f47', '#c69a5e', '#9a7340'],
  cobble: ['#808080', '#6f6f6f', '#909090', '#636363'],
  brick:  ['#a3432f', '#8f3a29', '#b34d36', '#7d3222'],
  water:  ['#3f86d9', '#4a92e3', '#3779c8', '#5a9deb']
};

/* ---- block textures ---- */
function clearTile(i) {
  const [ox, oy] = tileOrigin(i);
  tctx.clearRect(ox, oy, TILE_PX, TILE_PX);
}
function oreTile(i, spot, dark, count) {
  noiseTile(i, C.stone[0], C.stone.slice(1), 150);
  for (let k = 0; k < count; k++) {
    const bx = 2 + Math.floor(paintRnd() * 11), by = 2 + Math.floor(paintRnd() * 11);
    px(i, bx, by, spot); px(i, bx + 1, by, spot);
    px(i, bx, by + 1, spot); px(i, bx + 1, by + 1, dark);
  }
}
function brickPattern(i, base, light, dark) {
  fillTile(i, base);
  for (let k = 0; k < 70; k++) px(i, Math.floor(paintRnd() * 16), Math.floor(paintRnd() * 16),
    paintRnd() > 0.5 ? light : dark);
  for (let x = 0; x < TILE_PX; x++) { px(i, x, 0, dark); px(i, x, 8, dark); }
  for (let y = 0; y < 8; y++) px(i, 0, y, dark);
  for (let y = 8; y < 16; y++) { px(i, 4, y, dark); px(i, 12, y, dark); }
  for (let x = 1; x < 16; x++) px(i, x, 1, light);
  for (let x = 5; x < 16; x++) px(i, x, 9, light);
}

/* 0 grass top */
noiseTile(0, C.grass[0], C.grass.slice(1), 150);
/* 1 grass side: dirt with a green cap */
noiseTile(1, C.dirt[0], C.dirt.slice(1), 130);
for (let x = 0; x < TILE_PX; x++) {
  const depth = 3 + Math.floor(paintRnd() * 3);
  for (let y = 0; y < depth; y++) px(1, x, y, C.grass[Math.floor(paintRnd() * 4)]);
}
/* 2 dirt */
noiseTile(2, C.dirt[0], C.dirt.slice(1), 150);
/* 3 stone */
noiseTile(3, C.stone[0], C.stone.slice(1), 160);
for (let k = 0; k < 6; k++) {
  const bx = Math.floor(paintRnd() * 13), by = Math.floor(paintRnd() * 13);
  for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) px(3, bx + x, by + y, C.stone[3]);
}
/* 4 cobble */
noiseTile(4, C.cobble[0], C.cobble.slice(1), 140);
for (let k = 0; k < 9; k++) {
  const bx = Math.floor(paintRnd() * 11), by = Math.floor(paintRnd() * 11);
  const w = 2 + Math.floor(paintRnd() * 4), h = 2 + Math.floor(paintRnd() * 4);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) px(4, bx + x, by + y, C.cobble[2]);
  for (let x = 0; x < w; x++) px(4, bx + x, by + h, '#5a5a5a');
  for (let y = 0; y < h; y++) px(4, bx + w, by + y, '#5a5a5a');
}
/* 5 sand */
noiseTile(5, C.sand[0], C.sand.slice(1), 170);
/* 6 sandstone */
noiseTile(6, '#d9cea0', ['#e5dbb2', '#cec191', '#efe6c0'], 90);
for (let y = 2; y < TILE_PX; y += 5) for (let x = 0; x < TILE_PX; x++) px(6, x, y, '#bfb181');
/* 7 gravel */
noiseTile(7, '#8b8781', ['#9b968f', '#77736d', '#a8a29a', '#6a665f'], 190);
for (let k = 0; k < 12; k++) {
  const bx = Math.floor(paintRnd() * 14), by = Math.floor(paintRnd() * 14);
  const c = ['#a9a49c', '#75716b', '#918b83'][Math.floor(paintRnd() * 3)];
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) px(7, bx + x, by + y, c);
}
/* 8 log side */
noiseTile(8, C.bark[0], C.bark.slice(1), 130);
for (let x = 2; x < TILE_PX; x += 4) {
  for (let y = 0; y < TILE_PX; y++) if (paintRnd() > 0.25) px(8, x, y, C.bark[3]);
}
/* 9 log top: rings */
fillTile(9, '#8a5f34');
for (let x = 1; x < TILE_PX - 1; x++) for (let y = 1; y < TILE_PX - 1; y++) {
  const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
  px(9, x, y, Math.floor(d) % 2 === 0 ? '#a4743f' : '#7a5230');
}
for (let x = 0; x < TILE_PX; x++) { px(9, x, 0, '#5c3d23'); px(9, x, 15, '#5c3d23'); }
for (let y = 0; y < TILE_PX; y++) { px(9, 0, y, '#5c3d23'); px(9, 15, y, '#5c3d23'); }
/* 10 leaves */
noiseTile(10, C.leaf[0], C.leaf.slice(1), 220);
for (let k = 0; k < 16; k++) px(10, Math.floor(paintRnd() * 16), Math.floor(paintRnd() * 16), '#24501a');
/* 11 planks */
noiseTile(11, C.plank[0], C.plank.slice(1), 120);
for (let y = 0; y < TILE_PX; y += 4) for (let x = 0; x < TILE_PX; x++) px(11, x, y, '#8a6738');
for (let k = 0; k < 4; k++) {
  const x = 1 + Math.floor(paintRnd() * 14), y0 = k * 4;
  for (let y = y0; y < Math.min(y0 + 4, 16); y++) px(11, x, y, '#8a6738');
}
/* 12 brick */
fillTile(12, '#cbbfae');
for (let row = 0; row < 4; row++) {
  const y0 = row * 4, off = row % 2 === 0 ? 0 : 4;
  for (let bx = -1; bx < 3; bx++) {
    const x0 = bx * 9 + off;
    for (let x = 1; x < 8; x++) for (let y = 1; y < 3; y++) {
      px(12, (x0 + x + 16) % 16, y0 + y, C.brick[(x + y + row) % C.brick.length]);
    }
  }
}
/* 13 stone brick */
brickPattern(13, '#7e7e7e', '#9a9a9a', '#5c5c5c');
/* 14 mossy stone brick */
brickPattern(14, '#6f7566', '#8b9179', '#4d5347');
for (let k = 0; k < 40; k++) {
  px(14, Math.floor(paintRnd() * 16), Math.floor(paintRnd() * 16),
     ['#5f8a3c', '#4d7530', '#6d9a45'][Math.floor(paintRnd() * 3)]);
}
/* 15 snow */
noiseTile(15, '#eef4fa', ['#ffffff', '#dde8f2', '#e4eef7', '#cfdeeb'], 140);
/* 16 glass */
clearTile(16);
tctx.fillStyle = 'rgba(190, 226, 246, 0.26)';
tctx.fillRect(tileOrigin(16)[0] + 1, tileOrigin(16)[1] + 1, 14, 14);
(function () {
  const [ox, oy] = tileOrigin(16);
  tctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  tctx.fillRect(ox, oy, 16, 1); tctx.fillRect(ox, oy + 15, 16, 1);
  tctx.fillRect(ox, oy, 1, 16); tctx.fillRect(ox + 15, oy, 1, 16);
  tctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  tctx.fillRect(ox + 3, oy + 12, 7, 1);
  tctx.fillRect(ox + 4, oy + 11, 1, 1);
  tctx.fillRect(ox + 5, oy + 10, 1, 1);
})();
/* 17 gold ore */
oreTile(17, '#f2c94c', '#b98d20', 7);
/* 18 gold block */
noiseTile(18, '#eec84c', ['#f8dc7a', '#d9ad33', '#ffe98f'], 60);
for (let x = 0; x < 16; x++) { px(18, x, 0, '#b58a1f'); px(18, x, 15, '#b58a1f'); }
for (let y = 0; y < 16; y++) { px(18, 0, y, '#b58a1f'); px(18, 15, y, '#b58a1f'); }
for (let i = 0; i < 5; i++) px(18, 3 + i, 4 + i, '#fff3b8');
/* 19 diamond ore */
oreTile(19, '#5fe3e0', '#2c9c9c', 7);
/* 20 diamond block */
noiseTile(20, '#4fd6d2', ['#7ff0ec', '#33b3b0', '#b6fff9'], 70);
for (let x = 0; x < 16; x++) { px(20, x, 0, '#278f8c'); px(20, x, 15, '#278f8c'); }
for (let y = 0; y < 16; y++) { px(20, 0, y, '#278f8c'); px(20, 15, y, '#278f8c'); }
for (let i = 0; i < 6; i++) px(20, 3 + i, 3 + i, '#d8fffc');
/* 21 water */
noiseTile(21, C.water[0], C.water.slice(1), 120);
for (let k = 0; k < 7; k++) {
  const y = Math.floor(paintRnd() * 16), x = Math.floor(paintRnd() * 12);
  for (let i = 0; i < 3 + Math.floor(paintRnd() * 3); i++) px(21, (x + i) % 16, y, '#6cb0f0');
}
/* 22 mudbrick */
noiseTile(22, '#c2a071', ['#cfae7e', '#b18d61', '#d8bb8b', '#a07d52'], 150);
for (let k = 0; k < 22; k++) {
  px(22, Math.floor(paintRnd() * 16), Math.floor(paintRnd() * 16), '#e0c99b');
}
for (let y = 3; y < TILE_PX; y += 6) {
  for (let x = 0; x < TILE_PX; x++) if (paintRnd() > 0.15) px(22, x, y, '#9c7a4f');
  for (let x = (y % 12 === 3 ? 3 : 9); x < TILE_PX; x += 6) px(22, x, y - 1, '#9c7a4f');
}
/* 23 cactus */
noiseTile(23, '#4b8a3c', ['#55993f', '#3f7733', '#63a94b'], 130);
for (let x = 2; x < TILE_PX; x += 4) {
  for (let y = 0; y < TILE_PX; y++) px(23, x, y, '#3a6b2e');
}
for (let k = 0; k < 14; k++) {
  px(23, Math.floor(paintRnd() * 16), Math.floor(paintRnd() * 16), '#d8e8b0');
}

const atlasTexture = new THREE.CanvasTexture(tileCanvas);
atlasTexture.magFilter = THREE.NearestFilter;
atlasTexture.minFilter = THREE.NearestFilter;
atlasTexture.generateMipmaps = false;
atlasTexture.colorSpace = THREE.SRGBColorSpace;

/* uv rect per tile */
const TILE_UV = [];
for (let i = 0; i < ATLAS_COLS * ATLAS_ROWS; i++) {
  const col = i % ATLAS_COLS, row = Math.floor(i / ATLAS_COLS);
  const pad = 0.0015;
  TILE_UV.push({
    u0: col / ATLAS_COLS + pad, u1: (col + 1) / ATLAS_COLS - pad,
    v0: 1 - (row + 1) / ATLAS_ROWS + pad, v1: 1 - row / ATLAS_ROWS - pad
  });
}
/* ---------------- voxel storage ---------------- */
const blocks = new Uint8Array(WORLD * WORLD * HEIGHT);
const blockIndex = (x, y, z) => (y * WORLD + z) * WORLD + x;

function getBlock(x, y, z) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (y < 0) return STONE;
  if (x < 0 || x >= WORLD || z < 0 || z >= WORLD || y >= HEIGHT) return AIR;
  return blocks[blockIndex(x, y, z)];
}
function setBlock(x, y, z, type) {
  if (x < 0 || x >= WORLD || z < 0 || z >= WORLD || y < 0 || y >= HEIGHT) return;
  const index = blockIndex(x, y, z), oldType = blocks[index];
  blocks[index] = type;
  if (oldType !== blocks[index] && typeof resetVoxelDamage === 'function') {
    resetVoxelDamage(x, y, z, oldType, blocks[index]);
  }
}
const isOpaque = (x, y, z) => {
  const b = getBlock(x, y, z);
  return b !== AIR && b !== WATER && b !== GLASS;
};

const BLOCK_DEFS = {
  [GRASS]:         { top: 0,  side: 1,  bottom: 2,  name: 'Grass' },
  [DIRT]:          { top: 2,  side: 2,  bottom: 2,  name: 'Dirt' },
  [STONE]:         { top: 3,  side: 3,  bottom: 3,  name: 'Stone' },
  [SAND]:          { top: 5,  side: 5,  bottom: 5,  name: 'Sand' },
  [LOG]:           { top: 9,  side: 8,  bottom: 9,  name: 'Log' },
  [LEAVES]:        { top: 10, side: 10, bottom: 10, name: 'Leaves' },
  [PLANKS]:        { top: 11, side: 11, bottom: 11, name: 'Planks' },
  [COBBLE]:        { top: 4,  side: 4,  bottom: 4,  name: 'Cobblestone' },
  [BRICK]:         { top: 12, side: 12, bottom: 12, name: 'Bricks' },
  [GLASS]:         { top: 16, side: 16, bottom: 16, name: 'Glass', glass: true },
  [STONEBRICK]:    { top: 13, side: 13, bottom: 13, name: 'Stone Bricks' },
  [MOSSY]:         { top: 14, side: 14, bottom: 14, name: 'Mossy Bricks' },
  [SNOW]:          { top: 15, side: 15, bottom: 15, name: 'Snow' },
  [GRAVEL]:        { top: 7,  side: 7,  bottom: 7,  name: 'Gravel' },
  [SANDSTONE]:     { top: 6,  side: 6,  bottom: 6,  name: 'Sandstone' },
  [GOLD_ORE]:      { top: 17, side: 17, bottom: 17, name: 'Gold Ore' },
  [GOLD_BLOCK]:    { top: 18, side: 18, bottom: 18, name: 'Gold Block' },
  [DIAMOND_ORE]:   { top: 19, side: 19, bottom: 19, name: 'Diamond Ore' },
  [DIAMOND_BLOCK]: { top: 20, side: 20, bottom: 20, name: 'Diamond Block' },
  [WATER]:         { top: 21, side: 21, bottom: 21, name: 'Water' },
  [MUD]:           { top: 22, side: 22, bottom: 22, name: 'Mudbrick' },
  [CACTUS]:        { top: 23, side: 23, bottom: 23, name: 'Cactus' }
};

/* order shown in the inventory */
const BLOCK_IDS = [
  GRASS, DIRT, STONE, COBBLE, SAND, SANDSTONE, GRAVEL, LOG, PLANKS, LEAVES,
  BRICK, STONEBRICK, MOSSY, SNOW, GLASS, MUD, CACTUS, GOLD_ORE, GOLD_BLOCK,
  DIAMOND_ORE, DIAMOND_BLOCK
];
