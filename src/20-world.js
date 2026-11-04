/* Blockcraft Battle Ground — Value noise, biomes, terrain, trees, Fayoum villages and waterfalls.
   20-world.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ---------------- value noise ---------------- */
function hash2(ix, iy) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + SEED;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, y, octaves) {
  let sum = 0, amp = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x, y) * amp;
    norm += amp;
    x *= 2.02; y *= 2.02; amp *= 0.5;
  }
  return sum / norm;
}
function biomeAt(x, z) {
  return {
    heat: fbm(x * 0.0062 + 311.7, z * 0.0062 - 128.3, 3),
    damp: fbm(x * 0.0054 - 71.2, z * 0.0054 + 44.9, 3)
  };
}
function terrainHeight(x, z) {
  const b = biomeAt(x, z);
  const base = fbm(x * 0.0105, z * 0.0105, 4);
  const hills = fbm(x * 0.031 + 50.2, z * 0.031 - 20.4, 3);
  const mount = Math.max(0, fbm(x * 0.0058 - 90.1, z * 0.0058 + 40.7, 3) - 0.47) * 2.6;
  const ridge = 1 - Math.abs(fbm(x * 0.014 + 7.7, z * 0.014 - 9.3, 3) * 2 - 1);
  let h = 13 + base * 13 + hills * 6 + mount * ridge * ridge * 30;
  if (b.heat > 0.56) h = h * 0.8 + 6;
  if (b.damp > 0.6) h -= 2.5;
  return Math.floor(h);
}
const snowLineAt = (x, z) => 44 + (1 - biomeAt(x, z).heat) * 7;

const trees = [];
const villageSites = [];

function plantTree(x, z, h) {
  const th = 4 + Math.floor(hash2(x * 3, z * 5) * 3);
  const top = h + th;
  if (top + 2 >= HEIGHT) return false;
  for (let y = h + 1; y <= h + th; y++) setBlock(x, y, z, LOG);
  for (let ly = top - 2; ly <= top + 1; ly++) {
    const r = ly >= top ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 &&
            hash2((x + dx) * 7, (z + dz) * 11) < 0.62) continue;
        if (getBlock(x + dx, ly, z + dz) === AIR) setBlock(x + dx, ly, z + dz, LEAVES);
      }
    }
  }
  return true;
}

function plantPalm(x, z, h) {
  const th = 6 + Math.floor(hash2(x * 5 + 3, z * 9 - 2) * 4);
  const top = h + th;
  if (top + 2 >= HEIGHT) return false;
  for (let y = h + 1; y <= h + th; y++) setBlock(x, y, z, LOG);
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const d = Math.abs(dx) + Math.abs(dz);
      if (d === 0 || d > 3) continue;
      if (d === 3 && hash2(x + dx * 3, z + dz * 3) < 0.4) continue;
      const ly = top + (d === 1 ? 1 : 0) - (d === 3 ? 1 : 0);
      if (getBlock(x + dx, ly, z + dz) === AIR) setBlock(x + dx, ly, z + dz, LEAVES);
    }
  }
  setBlock(x, top, z, LEAVES);
  return true;
}

function plantCactus(x, z, h) {
  const tall = 2 + Math.floor(hash2(x * 11, z * 17) * 3);
  if (h + tall + 1 >= HEIGHT) return;
  for (let y = h + 1; y <= h + tall; y++) {
    if (getBlock(x, y, z) === AIR) setBlock(x, y, z, CACTUS);
  }
}

function growFlora() {
  const dense = new Set();
  for (let x = 3; x < WORLD - 3; x++) {
    for (let z = 3; z < WORLD - 3; z++) {
      const h = terrainHeight(x, z);
      if (h <= SEA) continue;
      const b = biomeAt(x, z);
      const desert = b.heat > 0.56;
      const snowy = h >= snowLineAt(x, z);
      const r = hash2(x * 13 + 7, z * 7 - 3);
      const cell = (x >> 2) + ',' + (z >> 2);
      if (dense.has(cell)) continue;

      if (desert) {
        if (r > 0.991) { plantCactus(x, z, h); dense.add(cell); }
        else if (r < 0.006 && h <= SEA + 5) { plantPalm(x, z, h); dense.add(cell); }
        continue;
      }
      if (snowy) {
        if (r > 0.985) { plantTree(x, z, h); dense.add(cell); }
        continue;
      }
      if (h <= SEA + 3 && b.heat > 0.42 && r < 0.05) {
        plantPalm(x, z, h); dense.add(cell); continue;
      }
      const chance = b.damp > 0.58 ? 0.07 : 0.018;
      if (r > 1 - chance) {
        if (plantTree(x, z, h)) { trees.push({ x, z }); dense.add(cell); }
      }
    }
  }
}

/* ---------------- mudbrick villages (El Fayoum) ---------------- */
const VILLAGER_NAMES = ['Mahmoud', 'Fatma', 'Youssef', 'Amal', 'Hassan', 'Nour',
  'Sayed', 'Mariam', 'Khaled', 'Salma', 'Ibrahim', 'Zeinab', 'Tarek', 'Hoda', 'Omar', 'Laila'];

function buildHouse(cx, cz, w, d) {
  let base = 0;
  for (let x = cx - (w >> 1) - 1; x <= cx + (w >> 1) + 1; x++)
    for (let z = cz - (d >> 1) - 1; z <= cz + (d >> 1) + 1; z++)
      base = Math.max(base, terrainHeight(x, z));
  const y0 = base + 1;
  const wallH = 3 + Math.floor(hash2(cx * 3, cz * 5) * 2);
  const x0 = cx - (w >> 1), z0 = cz - (d >> 1);

  for (let x = x0 - 1; x <= x0 + w; x++) {
    for (let z = z0 - 1; z <= z0 + d; z++) {
      for (let y = terrainHeight(x, z) + 1; y <= y0 + wallH + 1; y++) setBlock(x, y, z, AIR);
      for (let y = y0 - 1; y >= terrainHeight(x, z); y--) setBlock(x, y, z, MUD);
      setBlock(x, y0 - 1, z, SANDSTONE);
    }
  }

  for (let y = y0; y < y0 + wallH; y++) {
    for (let x = x0; x < x0 + w; x++) {
      for (let z = z0; z < z0 + d; z++) {
        const edge = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1;
        if (edge) setBlock(x, y, z, MUD);
      }
    }
  }
  // door
  const doorX = x0 + 1 + Math.floor(hash2(cx, cz) * (w - 2));
  setBlock(doorX, y0, z0, AIR);
  setBlock(doorX, y0 + 1, z0, AIR);
  // windows
  setBlock(x0, y0 + 1, z0 + 1, GLASS);
  setBlock(x0 + w - 1, y0 + 1, z0 + d - 2, GLASS);
  setBlock(x0 + 2, y0 + 1, z0 + d - 1, GLASS);
  // roof + parapet
  for (let x = x0 - 1; x <= x0 + w; x++)
    for (let z = z0 - 1; z <= z0 + d; z++) setBlock(x, y0 + wallH, z, PLANKS);
  for (let x = x0 - 1; x <= x0 + w; x++) {
    setBlock(x, y0 + wallH + 1, z0 - 1, MUD);
    setBlock(x, y0 + wallH + 1, z0 + d, MUD);
  }
  for (let z = z0 - 1; z <= z0 + d; z++) {
    setBlock(x0 - 1, y0 + wallH + 1, z, MUD);
    setBlock(x0 + w, y0 + wallH + 1, z, MUD);
  }
  return { x: doorX + 0.5, y: y0, z: z0 - 1.5 };
}

function makeVillage(site) {
  const count = 3 + Math.floor(hash2(site.x * 3, site.z * 7) * 4);
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + hash2(site.x + i, site.z - i) * 0.7;
    const r = 6 + hash2(site.x - i * 5, site.z + i * 3) * 9;
    const hx = Math.round(site.x + Math.cos(ang) * r);
    const hz = Math.round(site.z + Math.sin(ang) * r);
    if (hx < 8 || hz < 8 || hx > WORLD - 8 || hz > WORLD - 8) continue;
    if (terrainHeight(hx, hz) <= SEA + 1) continue;
    const w = 5 + Math.floor(hash2(hx, hz) * 2) * 2;
    const d = 5 + Math.floor(hash2(hz, hx) * 2) * 2;
    const door = buildHouse(hx, hz, w, d);
    spawnVillager(door.x, door.y, door.z, site.x, site.z, VILLAGER_NAMES[(i + villageSites.length * 3) % VILLAGER_NAMES.length]);
    for (let k = 0; k < 2; k++) {
      const px = hx + Math.round(Math.cos(ang + k * 1.7 + 1) * (r * 0.6));
      const pz = hz + Math.round(Math.sin(ang + k * 1.7 + 1) * (r * 0.6));
      const ph = terrainHeight(px, pz);
      if (ph > SEA + 1) plantPalm(px, pz, ph);
    }
    // chickens pecking around the yard
    for (let k = 0; k < 2; k++) {
      const cx = hx + Math.round(Math.cos(i + k * 3) * 4);
      const cz = hz + Math.round(Math.sin(i + k * 3) * 4);
      const cy = terrainHeight(cx, cz);
      if (cy > SEA + 1) spawnChicken(cx + 0.5, cy + 1, cz + 0.5);
    }
  }
}

function findVillageSite() {
  for (let tries = 0; tries < 600; tries++) {
    const x = 24 + Math.floor(hash2(tries * 17 + 101, tries * 29 + 55) * (WORLD - 48));
    const z = 24 + Math.floor(hash2(tries * 31 + 17, tries * 13 + 203) * (WORLD - 48));
    const h = terrainHeight(x, z);
    if (h < SEA + 3 || h > 32) continue;
    let min = h, max = h;
    for (let dx = -8; dx <= 8; dx += 4) for (let dz = -8; dz <= 8; dz += 4) {
      const hh = terrainHeight(x + dx, z + dz);
      if (hh < min) min = hh;
      if (hh > max) max = hh;
    }
    if (max - min > 3) continue;
    let nearWater = false;
    for (let a = 0; a < 16 && !nearWater; a++) {
      const ang = (a / 16) * Math.PI * 2;
      for (let dd = 8; dd <= 26; dd += 6) {
        if (terrainHeight(Math.round(x + Math.cos(ang) * dd), Math.round(z + Math.sin(ang) * dd)) <= SEA) {
          nearWater = true; break;
        }
      }
    }
    if (!nearWater) continue;
    if (villageSites.some(v => Math.abs(v.x - x) < 45 && Math.abs(v.z - z) < 45)) continue;
    return { x, z, h };
  }
  return null;
}

function buildVillages() {
  for (let i = 0; i < 12; i++) {
    const site = findVillageSite();
    if (!site) break;
    villageSites.push(site);
    makeVillage(site);
  }
}

/* ---------------- waterfalls ---------------- */
function makeWaterfall(sx, sz, sh, dirIndex) {
  const ang = (dirIndex / 8) * Math.PI * 2;
  const dx = Math.round(Math.cos(ang)), dz = Math.round(Math.sin(ang));
  if (dx === 0 && dz === 0) return false;
  let cx = sx, cz = sz, cy = sh;
  let fell = false;

  for (let step = 0; step < 12; step++) {
    const ht = terrainHeight(cx, cz);
    if (ht > cy + 2) break;
    if (ht < cy - 1) {
      const bottom = Math.max(ht, SEA - 2);
      const depth = Math.min(cy - bottom, 26);
      for (let y = cy; y > cy - depth; y--) setBlock(cx, y, cz, WATER);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          if (terrainHeight(cx + ox, cz + oz) <= bottom + 1) {
            setBlock(cx + ox, bottom, cz + oz, WATER);
            for (let y = bottom + 1; y <= bottom + 3; y++) setBlock(cx + ox, y, cz + oz, AIR);
          }
        }
      }
      fell = true;
      break;
    }
    cy = ht;
    setBlock(cx, cy, cz, WATER);
    for (let y = cy + 1; y <= cy + 5; y++) setBlock(cx, y, cz, AIR);
    if (step === 0) {
      setBlock(cx + 1, cy, cz, WATER);
      setBlock(cx, cy, cz + 1, WATER);
      setBlock(cx + 1, cy, cz + 1, WATER);
      for (let ox = 0; ox <= 1; ox++) for (let oz = 0; oz <= 1; oz++)
        for (let y = cy + 1; y <= cy + 4; y++) setBlock(cx + ox, y, cz + oz, AIR);
    }
    cx += dx; cz += dz;
    if (cx < 4 || cz < 4 || cx > WORLD - 4 || cz > WORLD - 4) break;
  }
  return fell;
}

function createWaterfalls() {
  let made = 0;
  for (let tries = 0; tries < 900 && made < 14; tries++) {
    const x = 14 + Math.floor(hash2(tries * 7 + 3, tries * 11 + 909) * (WORLD - 28));
    const z = 14 + Math.floor(hash2(tries * 23 + 11, tries * 5 + 77) * (WORLD - 28));
    const h = terrainHeight(x, z);
    if (h < 28) continue;
    let bestA = -1, bestDrop = 0;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const drop = h - terrainHeight(Math.round(x + Math.cos(ang) * 7), Math.round(z + Math.sin(ang) * 7));
      if (drop > bestDrop) { bestDrop = drop; bestA = a; }
    }
    if (bestDrop < 5) continue;
    if (makeWaterfall(x, z, h, bestA)) made++;
  }
  return made;
}

function generateTerrain() {
  for (let x = 0; x < WORLD; x++) {
    for (let z = 0; z < WORLD; z++) {
      const h = terrainHeight(x, z);
      const b = biomeAt(x, z);
      const desert = b.heat > 0.56;
      const beach = h <= SEA + 1;
      const alpine = h >= snowLineAt(x, z);
      const gritty = noise2(x * 0.09 + 11.3, z * 0.09 - 4.7) > 0.68;
      const sandy = beach || desert;

      for (let y = 0; y <= h; y++) {
        let type = STONE;
        if (y === h) type = beach ? (gritty ? GRAVEL : SAND) : (desert ? SAND : (alpine ? SNOW : GRASS));
        else if (y >= h - 2) type = sandy ? SANDSTONE : (alpine ? SNOW : DIRT);
        else if (y >= h - 4) type = sandy ? SANDSTONE : DIRT;

        if (type === STONE) {
          const r = hash2(x * 7 + y * 131, z * 11 - y * 17);
          if (r > 0.9962) type = GOLD_ORE;
          else if (y < 14 && r < 0.0034) type = DIAMOND_ORE;
        }
        setBlock(x, y, z, type);
      }
      for (let y = h + 1; y <= SEA; y++) setBlock(x, y, z, WATER);
    }
  }
  growFlora();
  buildVillages();
  createWaterfalls();
  spawnCritters();
}
