/* Blockcraft Battle Ground — fighting structures.
   21-structures.js (after 20-world.js, whose terrain/hash helpers it uses;
   15-modes.js calls STRUCT_buildArenaCover while building an arena)
   Every world gets battle sites spread across the map: watchtowers, walled
   compounds, ruins and sandbag trench lines. Locked-arena modes add a
   mirror-symmetric cover layout so neither team's side is favoured.
   Everything is deterministic from the seed (hash2), so all players in a room
   generate the same structures without sending any edits. Builders take a
   put(x, y, z, type) callback: setBlock for the world, MODES_edit for arenas
   (which records the original blocks so the arena can be removed again). */
'use strict';

const STRUCT_SALT = 7919;
const STRUCT_SITE_COUNT = 8;
const STRUCT_SITE_SPACING = 40;
const STRUCT_VILLAGE_CLEARANCE = 30;
const battleSites = [];

function structHash(a, b) { return hash2(a * 31 + STRUCT_SALT, b * 17 - STRUCT_SALT); }

// Level a rectangular footprint: fill below with a foundation, clear above.
function structPrepare(put, x0, z0, w, d, base, clear, foundation) {
  for (let x = x0; x < x0 + w; x++) {
    for (let z = z0; z < z0 + d; z++) {
      const g = terrainHeight(x, z);
      for (let y = Math.min(g, base - 1); y < base; y++) put(x, y, z, foundation);
      for (let y = base; y <= base + clear; y++) put(x, y, z, AIR);
    }
  }
}

function structBase(x0, z0, w, d) {
  let base = 0;
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) base = Math.max(base, terrainHeight(x, z));
  return Math.max(SEA + 2, base + 1);
}

/* Two-storey 7×7 tower: doors on two sides, wall-hugging block stairs (one
   block per step, so a normal jump climbs them), a mid floor, a crenellated
   roof and window slits for shooting out. */
function structWatchtower(put, cx, cz) {
  const x0 = cx - 3, z0 = cz - 3, w = 7, base = structBase(x0, z0, w, w), H = 9;
  structPrepare(put, x0 - 1, z0 - 1, w + 2, w + 2, base, H + 2, STONE);
  for (let y = base; y < base + H; y++) {
    for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + w; z++) {
      const edge = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + w - 1;
      if (!edge) continue;
      const corner = (x === x0 || x === x0 + w - 1) && (z === z0 || z === z0 + w - 1);
      let type = corner ? COBBLE : STONEBRICK;
      if ((y - base) % 4 === 1 && !corner && (x === cx || z === cz)) type = AIR; // window slits
      put(x, y, z, type);
    }
  }
  // doors (2 high) on the south and east faces
  for (let y = base; y < base + 2; y++) { put(cx, y, z0, AIR); put(x0 + w - 1, y, cz, AIR); }
  // Mid floor (block at base+4, walk surface base+5) and roof (block at
  // base+8, surface base+9). Each flight is four one-block steps; the slab
  // above steps 2-4 is left open for headroom.
  const mid = base + 4, roof = base + H - 1;
  for (let x = x0 + 1; x < x0 + w - 1; x++) for (let z = z0 + 1; z < z0 + w - 1; z++) {
    if (!(x === x0 + 1 && z >= z0 + 2 && z <= z0 + 4)) put(x, mid, z, PLANKS);
    if (!(x === x0 + w - 2 && z >= z0 + 2 && z <= z0 + 4)) put(x, roof, z, PLANKS);
  }
  for (let k = 1; k <= 4; k++) {
    // ground flight: west wall, rising north to south (z0+1 .. z0+4)
    for (let y = base; y < base + k; y++) put(x0 + 1, y, z0 + k, COBBLE);
    // roof flight: east wall, rising south to north (z0+5 .. z0+2), on the mid floor
    for (let y = mid + 1; y < mid + 1 + k; y++) put(x0 + w - 2, y, z0 + 6 - k, PLANKS);
  }
  // crenellations
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + w; z++) {
    const edge = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + w - 1;
    if (edge && ((x + z) & 1) === 0) put(x, base + H, z, STONEBRICK);
  }
  return { x: cx, z: cz, y: base, kind: 'watchtower' };
}

/* 15×15 walled compound: 3-high walls with two-wide gaps on every side,
   crates and a low centre wall for cover inside. */
function structCompound(put, cx, cz) {
  const x0 = cx - 7, z0 = cz - 7, w = 15, base = structBase(x0, z0, w, w);
  structPrepare(put, x0, z0, w, w, base, 6, COBBLE);
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + w; z++) {
    put(x, base - 1, z, GRAVEL);
    const edge = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + w - 1;
    if (!edge) continue;
    const gap = Math.abs(x - cx) <= 1 && (z === z0 || z === z0 + w - 1) || Math.abs(z - cz) <= 1 && (x === x0 || x === x0 + w - 1);
    if (gap) continue;
    for (let y = base; y < base + 3; y++) put(x, y, z, y === base + 2 && ((x + z) & 1) ? AIR : COBBLE);
  }
  // corner crates (2×2×2 planks)
  for (const [dx, dz] of [[-5, -5], [4, -5], [-5, 4], [4, 4]]) {
    for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) put(cx + dx + x, base + y, cz + dz + z, PLANKS);
  }
  // low centre wall, waist high
  for (let i = -2; i <= 2; i++) { put(cx + i, base, cz, STONEBRICK); put(cx + i, base + 1, cz, i === 0 ? AIR : STONEBRICK); }
  return { x: cx, z: cz, y: base, kind: 'compound' };
}

/* Broken stone walls of uneven height around a mossy floor. */
function structRuins(put, cx, cz) {
  const R = 9, base = structBase(cx - R, cz - R, R * 2 + 1, R * 2 + 1);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + structHash(cx + i, cz) * 0.5;
    const r = 3 + structHash(cx - i, cz + i) * (R - 3);
    const len = 3 + Math.floor(structHash(cx + i * 3, cz - i) * 4);
    const along = a + Math.PI / 2;
    const sx = cx + Math.cos(a) * r, sz = cz + Math.sin(a) * r;
    for (let k = 0; k < len; k++) {
      const x = Math.round(sx + Math.cos(along) * k), z = Math.round(sz + Math.sin(along) * k);
      const g = terrainHeight(x, z);
      const top = Math.max(base, g + 1);
      const h = 1 + Math.floor(structHash(x, z) * 4);
      for (let y = g + 1; y < top; y++) put(x, y, z, COBBLE);
      for (let y = top; y < top + h; y++) put(x, y, z, structHash(x + y, z - y) > 0.5 ? MOSSY : STONEBRICK);
      for (let y = top + h; y < top + h + 3; y++) if (getBlock(x, y, z) === LEAVES) put(x, y, z, AIR);
    }
  }
  return { x: cx, z: cz, y: base, kind: 'ruins' };
}

/* Two facing sandbag trench lines with gravel caps and firing gaps. */
function structTrenches(put, cx, cz) {
  const L = 8;
  for (const side of [-1, 1]) {
    for (let i = -L; i <= L; i++) {
      const x = cx + i, z = cz + side * (6 + Math.round(Math.sin(i * 0.5) * 1.2));
      const g = terrainHeight(x, z);
      if (g <= SEA) continue;
      const firingGap = i % 4 === 0;
      put(x, g + 1, z, SAND);
      put(x, g + 2, z, firingGap ? AIR : GRAVEL);
      for (let y = g + 3; y < g + 6; y++) if (getBlock(x, y, z) === LEAVES || getBlock(x, y, z) === LOG) put(x, y, z, AIR);
    }
  }
  return { x: cx, z: cz, y: terrainHeight(cx, cz) + 1, kind: 'trenches' };
}

const STRUCT_KINDS = [structWatchtower, structCompound, structRuins, structTrenches];

function structFindSite(tries0) {
  for (let tries = tries0; tries < tries0 + 400; tries++) {
    const x = 20 + Math.floor(structHash(tries * 13 + 5, tries * 7 + 91) * (WORLD - 40));
    const z = 20 + Math.floor(structHash(tries * 29 + 77, tries * 3 + 11) * (WORLD - 40));
    const h = terrainHeight(x, z);
    if (h < SEA + 2 || h > 40) continue;
    let min = h, max = h;
    for (let dx = -8; dx <= 8; dx += 4) for (let dz = -8; dz <= 8; dz += 4) {
      const hh = terrainHeight(x + dx, z + dz);
      if (hh <= SEA) { min = -1; break; }
      min = Math.min(min, hh); max = Math.max(max, hh);
    }
    if (min < 0 || max - min > 4) continue;
    if (villageSites.some((v) => Math.hypot(v.x - x, v.z - z) < STRUCT_VILLAGE_CLEARANCE)) continue;
    if (battleSites.some((s) => Math.hypot(s.x - x, s.z - z) < STRUCT_SITE_SPACING)) continue;
    return { x, z, tries };
  }
  return null;
}

// Called by generateTerrain() after villages, before waterfalls/critters.
function buildBattleSites() {
  battleSites.length = 0;
  const put = (x, y, z, type) => {
    if (x < 1 || z < 1 || x >= WORLD - 1 || z >= WORLD - 1 || y < 1 || y >= HEIGHT) return;
    setBlock(x, y, z, type);
  };
  let cursor = 0;
  for (let i = 0; i < STRUCT_SITE_COUNT; i++) {
    const site = structFindSite(cursor);
    if (!site) break;
    cursor = site.tries + 1;
    battleSites.push(STRUCT_KINDS[i % STRUCT_KINDS.length](put, site.x, site.z));
  }
}

/* Arena cover, mirror-symmetric across both axes so red (west) and blue
   (east) get identical sightlines. Spawn pads sit on the x axis at ±0.55r
   and gates on both axes, so pieces stay on the diagonals and the centre. */
function STRUCT_buildArenaCover(put, cx, cz, radius) {
  const placeWall = (x, z, dx, dz, len, h, type) => {
    for (let k = 0; k < len; k++) {
      const px = Math.round(x + dx * k), pz = Math.round(z + dz * k);
      const g = terrainHeight(px, pz);
      const y0 = Math.max(SEA + 2, g + 1);
      for (let y = g + 1; y < y0; y++) put(px, y, pz, STONEBRICK);
      for (let y = y0; y < y0 + h; y++) put(px, y, pz, type);
      for (let y = y0 + h; y < y0 + h + 4; y++) if (getBlock(px, y, pz) !== AIR) put(px, y, pz, AIR);
    }
  };
  // centre: a cross of chest-high walls with a raised plinth
  const arm = Math.max(3, Math.round(radius * 0.09));
  placeWall(cx - arm, cz, 1, 0, arm * 2 + 1, 2, STONEBRICK);
  placeWall(cx, cz - arm, 0, 1, arm * 2 + 1, 2, STONEBRICK);
  // diagonal L-shaped cover at two rings
  for (const ring of [0.34, 0.72]) {
    const r = radius * ring;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = cx + sx * r * 0.7071, z = cz + sz * r * 0.7071;
      const len = ring < 0.5 ? 4 : 3;
      const h = ring < 0.5 ? 3 : 2;
      placeWall(x, z, -sx, 0, len, h, ring < 0.5 ? COBBLE : PLANKS);
      placeWall(x, z, 0, -sz, len, h, ring < 0.5 ? COBBLE : PLANKS);
    }
  }
  // flank crates halfway between the pads and the side walls
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = Math.round(cx + sx * radius * 0.42), z = Math.round(cz + sz * radius * 0.3);
    placeWall(x, z, 1, 0, 2, 2, PLANKS);
    placeWall(x, z + 1, 1, 0, 2, 2, PLANKS);
  }
}
