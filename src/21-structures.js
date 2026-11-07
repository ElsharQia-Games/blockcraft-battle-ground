/* Blockcraft Battle Ground — fighting structures.
   21-structures.js (after 20-world.js, whose terrain/hash helpers it uses;
   15-modes.js calls STRUCT_buildArenaCover while building an arena)
   Every world gets a planned battlefield: a citadel in the middle, two rings of
   watchtowers, walled compounds, ruins and trench lines, roads that join them
   into loops, and scattered cover. Locked-arena modes add a mirror-symmetric
   three-lane layout so neither team's side is favoured.
   Everything is deterministic from the seed (hash2), so all players in a room
   generate the same structures without sending any edits. Builders take a
   put(x, y, z, type) callback: setBlock for the world, MODES_edit for arenas
   (which records the original blocks so the arena can be removed again). */
'use strict';

const STRUCT_SALT = 7919;
const STRUCT_RING_SITES = 6;
const STRUCT_INNER_RING = 62;
const STRUCT_OUTER_RING = 100;
const STRUCT_VILLAGE_CLEARANCE = 22;
const battleSites = [];
const battleSpawnPoints = [];

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
function structWatchtower(put, cx, cz, fixedBase) {
  const x0 = cx - 3, z0 = cz - 3, w = 7, base = fixedBase || structBase(x0, z0, w, w), H = 9;
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

/* The centre of the map: a walled yard around a climbable tower. The tallest
   point is the most exposed one, so it is worth fighting for, not camping. */
function structCitadel(put, cx, cz) {
  const R = 12, x0 = cx - R, z0 = cz - R, w = R * 2 + 1, base = structBase(x0, z0, w, w);
  structPrepare(put, x0, z0, w, w, base, 8, COBBLE);
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + w; z++) {
    put(x, base - 1, z, GRAVEL);
    const edge = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + w - 1;
    // Three-wide gates on every side, so nobody can be pinned inside.
    if (!edge || Math.abs(x - cx) <= 1 || Math.abs(z - cz) <= 1) continue;
    const notch = ((x + z) & 3) === 0;
    for (let y = base; y < base + 2; y++) put(x, y, z, STONEBRICK);
    if (!notch) put(x, base + 2, z, STONEBRICK);
  }
  for (const [dx, dz] of [[-8, -8], [7, -8], [-8, 7], [7, 7], [-8, 0], [7, -1]]) {
    for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) put(cx + dx + x, base + y, cz + dz + z, PLANKS);
  }
  structWatchtower(put, cx, cz, base);
  return { x: cx, z: cz, y: base, kind: 'citadel' };
}

const STRUCT_KINDS = [structWatchtower, structCompound, structRuins, structTrenches];
const STRUCT_NATURAL = () => [GRASS, DIRT, SAND, SNOW, STONE, GRAVEL, SANDSTONE, MUD];

function structFree(x, z, spacing) {
  const h = terrainHeight(x, z);
  if (h < SEA + 2 || h > 42) return false;
  let min = h, max = h;
  for (let dx = -8; dx <= 8; dx += 4) for (let dz = -8; dz <= 8; dz += 4) {
    const hh = terrainHeight(x + dx, z + dz);
    if (hh <= SEA) return false;
    min = Math.min(min, hh); max = Math.max(max, hh);
  }
  if (max - min > 5) return false;
  if (villageSites.some((v) => Math.hypot(v.x - x, v.z - z) < STRUCT_VILLAGE_CLEARANCE)) return false;
  return !battleSites.some((s) => Math.hypot(s.x - x, s.z - z) < spacing);
}

// The nearest buildable ground to a planned position.
function structSpotNear(tx, tz, reach, spacing) {
  for (let r = 0; r <= reach; r += 3) {
    const steps = r === 0 ? 1 : Math.round(r * 1.2);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const x = Math.round(tx + Math.cos(a) * r), z = Math.round(tz + Math.sin(a) * r);
      if (x >= 20 && z >= 20 && x < WORLD - 20 && z < WORLD - 20 && structFree(x, z, spacing)) return { x, z };
    }
  }
  return null;
}

// Removes a whole tree, so a road never leaves a canopy floating in the air.
function structFell(put, x, z, g) {
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let y = g; y <= g + 13; y++) {
    const b = getBlock(x + dx, y, z + dz);
    if (b === LOG || b === LEAVES) put(x + dx, y, z + dz, AIR);
  }
}

function structRoadTile(put, x, z, natural) {
  if (x < 2 || z < 2 || x >= WORLD - 2 || z >= WORLD - 2) return;
  const g = terrainHeight(x, z);
  if (g <= SEA) { put(x, SEA + 1, z, PLANKS); return; }
  if (!natural.includes(getBlock(x, g, z))) return;
  for (let y = g + 1; y <= g + 7; y++) {
    const b = getBlock(x, y, z);
    if (b === LOG || b === LEAVES) { structFell(put, x, z, g); break; }
    if (b === CACTUS) put(x, y, z, AIR);
  }
  put(x, g, z, structHash(x, z) < 0.25 ? COBBLE : GRAVEL);
}

// A slightly wandering road. Returns its points so cover can line it.
function structRoad(put, a, b, natural) {
  const length = Math.hypot(b.x - a.x, b.z - a.z), phase = structHash(a.x, b.z) * 6.28;
  const ux = (b.x - a.x) / length, uz = (b.z - a.z) / length, points = [];
  for (let d = 0; d <= length; d += 0.5) {
    const t = d / length, bend = Math.sin(t * Math.PI) * Math.sin(t * 7 + phase) * 4;
    const x = a.x + ux * d - uz * bend, z = a.z + uz * d + ux * bend;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) structRoadTile(put, Math.round(x) + i, Math.round(z) + j, natural);
    if (d % 16 === 0) points.push({ x, z, nx: -uz, nz: ux });
  }
  return points;
}

/* Small cover, about shoulder high with notches to shoot through. It breaks up
   long sightlines so open ground is crossed in hops, not in one run. */
function structCover(put, cx, cz, natural) {
  const column = (x, z, h, type) => {
    const g = terrainHeight(x, z);
    if (g <= SEA || !natural.includes(getBlock(x, g, z)) || getBlock(x, g + 1, z) !== AIR) return;
    for (let y = g + 1; y <= g + h; y++) put(x, y, z, type);
  };
  const kind = Math.floor(structHash(cx * 3, cz * 5) * 4), flip = structHash(cx, cz * 3) < 0.5 ? 1 : -1;
  if (kind === 0) {
    for (let i = 0; i < 4; i++) column(cx + i * flip, cz, i === 2 ? 1 : 2, COBBLE);
    for (let i = 1; i < 3; i++) column(cx, cz + i * flip, 2, COBBLE);
  } else if (kind === 1) {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) column(cx + i, cz + j, 2, PLANKS);
    column(cx + 2 * flip, cz, 1, PLANKS);
  } else if (kind === 2) {
    for (let i = -2; i <= 2; i++) if (i !== 1) column(cx + i, cz + Math.abs(i) * flip, 2, i === 0 ? GRAVEL : SAND);
  } else {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (structHash(cx + i * 7, cz + j * 9) > 0.25) column(cx + i, cz + j, 1 + Math.floor(structHash(cx - i, cz - j) * 3), STONE);
    }
  }
}

function structNearVillage(x, z, reach) { return villageSites.some((v) => Math.hypot(v.x - x, v.z - z) < reach); }
function structNearSite(x, z, reach) { return battleSites.some((s) => Math.hypot(s.x - x, s.z - z) < reach); }

/* Called by generateTerrain() after villages, before waterfalls/critters.
   The map is planned, not scattered: a citadel in the middle, two rings of
   sites and roads that form loops. Every site can be reached two ways, so a
   fight can always be flanked and players never have to double back. */
function buildBattleSites() {
  battleSites.length = 0;
  battleSpawnPoints.length = 0;
  const put = (x, y, z, type) => {
    if (x < 1 || z < 1 || x >= WORLD - 1 || z >= WORLD - 1 || y < 1 || y >= HEIGHT) return;
    setBlock(x, y, z, type);
  };
  const mid = WORLD / 2, turn = structHash(11, 23) * Math.PI * 2;
  const hubSpot = structSpotNear(mid, mid, 30, 0);
  const hub = hubSpot ? structCitadel(put, hubSpot.x, hubSpot.z) : null;
  if (hub) battleSites.push(hub);
  const plant = (radius, angle, kind) => {
    const spot = structSpotNear(mid + Math.cos(angle) * radius, mid + Math.sin(angle) * radius, 27, 30);
    if (!spot) return null;
    const site = STRUCT_KINDS[kind % STRUCT_KINDS.length](put, spot.x, spot.z);
    battleSites.push(site);
    return site;
  };
  const inner = [], outer = [];
  for (let i = 0; i < STRUCT_RING_SITES; i++) {
    const site = plant(STRUCT_INNER_RING, turn + i * Math.PI * 2 / STRUCT_RING_SITES, i);
    if (site) inner.push(site);
  }
  for (let i = 0; i < STRUCT_RING_SITES; i++) {
    const site = plant(STRUCT_OUTER_RING, turn + (i + 0.5) * Math.PI * 2 / STRUCT_RING_SITES, i + 2);
    if (site) outer.push(site);
  }

  const natural = STRUCT_NATURAL(), lanes = [];
  inner.forEach((site, i) => { if (inner.length > 2) lanes.push(structRoad(put, site, inner[(i + 1) % inner.length], natural)); });
  if (hub) inner.forEach((site, i) => { if (i % 2 === 0) lanes.push(structRoad(put, hub, site, natural)); });
  outer.forEach((site) => {
    const near = inner.slice().sort((a, b) => Math.hypot(a.x - site.x, a.z - site.z) - Math.hypot(b.x - site.x, b.z - site.z));
    for (const other of near.slice(0, 2)) lanes.push(structRoad(put, site, other, natural));
  });

  for (const lane of lanes) {
    lane.forEach((point, i) => {
      const side = i % 2 ? 1 : -1, x = Math.round(point.x + point.nx * 5 * side), z = Math.round(point.z + point.nz * 5 * side);
      if (!structNearSite(x, z, 11) && !structNearVillage(x, z, 18)) structCover(put, x, z, natural);
    });
  }
  // Cover in the gaps between roads, so no field is a free shooting gallery.
  for (let gx = 16; gx < WORLD - 12; gx += 26) for (let gz = 16; gz < WORLD - 12; gz += 26) {
    const x = gx + Math.floor(structHash(gx, gz) * 12), z = gz + Math.floor(structHash(gz, gx) * 12);
    if (structHash(gx * 3, gz * 3) < 0.7 && !structNearSite(x, z, 11) && !structNearVillage(x, z, 18)) structCover(put, x, z, natural);
  }

  // Far more spawn points than players, around every site.
  for (const site of battleSites) {
    const reach = site.kind === 'citadel' ? 18 : 13;
    for (let i = 0; i < 3; i++) {
      const a = structHash(site.x + i, site.z - i) * Math.PI * 2 + i * 2.1;
      battleSpawnPoints.push({ x: site.x + Math.cos(a) * reach, z: site.z + Math.sin(a) * reach });
    }
  }
}

/* Arena cover: three lanes between the red (west) and blue (east) pads, joined
   by gaps in the dividers. Mirrored west to east, so neither side is favoured.
   North is open and long, south is tight and close, and the middle is blocked
   so neither pad can ever see the other. */
function STRUCT_buildArenaCover(put, cx, cz, radius) {
  const placeWall = (x, z, dx, dz, len, h, type, top) => {
    for (let k = 0; k < len; k++) {
      const px = Math.round(x + dx * k), pz = Math.round(z + dz * k);
      const g = terrainHeight(px, pz);
      const y0 = Math.max(SEA + 2, g + 1), end = Math.max(y0 + h, top || 0);
      for (let y = g + 1; y < y0; y++) put(px, y, pz, STONEBRICK);
      for (let y = y0; y < end; y++) put(px, y, pz, type);
      for (let y = end; y < end + 4; y++) if (getBlock(px, y, pz) !== AIR) put(px, y, pz, AIR);
    }
  };
  const mirrored = (offset, z, dx, dz, len, h, type) => {
    for (const side of offset ? [-1, 1] : [1]) placeWall(cx + side * offset, z, dx * side, dz, len, h, type);
  };

  // Lane dividers, broken by connector gaps.
  const seg = Math.max(4, Math.round(radius * 0.16)), gap = Math.max(4, Math.round(radius * 0.09)), lane = Math.round(radius * 0.24);
  for (const side of [-1, 1]) {
    const z = cz + side * lane;
    placeWall(cx - Math.floor(seg / 2), z, 1, 0, seg, 3, COBBLE);
    mirrored(Math.round(seg / 2 + gap), z, 1, 0, seg, 3, COBBLE);
  }

  // Middle lane: a wide block at the centre with staggered cover either side.
  const arm = Math.max(4, Math.round(radius * 0.16));
  placeWall(cx, cz - arm, 0, 1, arm * 2 + 1, 3, STONEBRICK);
  mirrored(Math.round(radius * 0.26), cz - 2, 0, 1, 5, 2, STONEBRICK);

  // North lane: long sightlines broken only by two low blocks.
  const north = cz - Math.round(radius * 0.5), south = cz + Math.round(radius * 0.5);
  for (const offset of [Math.round(radius * 0.14), Math.round(radius * 0.42)]) {
    mirrored(offset, north, 1, 0, 3, 2, PLANKS);
  }
  // South lane: dense, for shotguns and SMGs.
  for (const offset of [0, Math.round(radius * 0.2), Math.round(radius * 0.4)]) {
    mirrored(offset, south - 1, 1, 0, 3, 2, PLANKS);
    mirrored(offset, south + 2, 0, 1, 3, 2, PLANKS);
  }

  // Each pad gets a shelter facing the enemy; players leave around either end
  // or out of the back gate, so it can't be locked down from one spot.
  const pads = typeof MODES_pads !== 'undefined' ? MODES_pads : null;
  for (const pad of pads ? [pads.red, pads.blue] : []) {
    if (!pad) continue;
    const toward = pad.x < cx ? 1 : -1;
    // Pads stand proud of the ground, so measure the height from the pad.
    placeWall(pad.x + toward * 7, pad.z - 5, 0, 1, 11, 3, STONEBRICK, Math.ceil(pad.y) + 3);
  }
}
