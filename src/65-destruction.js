/* Blockcraft Battle Ground — Bullet damage, surface cracks and batched voxel destruction.
   65-destruction.js — classic script, after 60-combat.js and before 70-inventory.js.

   Damage uses weapon HP (the pistol deals 26). Numeric map keys are blockIndex(x,y,z).
   Partial damage/cracks expire after 60 seconds without a hit; at most 192 voxels
   are retained, evicting the least recently hit. These are receipt-time caches,
   not retained world state: peers may differ after expiry, eviction or late join.
   ANY peer reaching zero emits an ordinary AIR edit, which the existing WS/MQTT
   edit transport persists for convergence and late joiners. No voxelHit is echoed.
   Hit deduplication retains the latest 4096 IDs for at most 180 seconds, including
   hits rejected by the current block-type check. Replacing a block clears damage.

   Damage shows as eight pixel-art stages over the block, one depth-tested draw
   call per damaged voxel. Meshes are pooled to the same 192-slot bound and share
   one cube and eight materials; only a change of stage touches anything. */
'use strict';

const VOXEL_DURABILITY = Object.freeze({
  [GLASS]: 24, [LEAVES]: 36, [SNOW]: 40, [CACTUS]: 48,
  [SAND]: 48, [DIRT]: 60, [GRASS]: 66, [GRAVEL]: 72,
  [MUD]: 84, [PLANKS]: 88, [LOG]: 96,
  [SANDSTONE]: 120, [COBBLE]: 130, [BRICK]: 144,
  [STONE]: 156, [MOSSY]: 156, [STONEBRICK]: 180,
  [GOLD_ORE]: 234, [GOLD_BLOCK]: 260, [DIAMOND_ORE]: 286, [DIAMOND_BLOCK]: 312
});
const VOXEL_DEBRIS_COLORS = Object.freeze({
  [GLASS]: '#bde2f6', [LEAVES]: '#4a8c37', [SNOW]: '#eef4fa', [CACTUS]: '#55993f',
  [SAND]: '#ded3a5', [DIRT]: '#8a5a3c', [GRASS]: '#6cb046', [GRAVEL]: '#8b8781',
  [MUD]: '#c2a071', [PLANKS]: '#b78d52', [LOG]: '#7b5533',
  [SANDSTONE]: '#d9cea0', [COBBLE]: '#808080', [BRICK]: '#a3432f',
  [STONE]: '#8a8a8a', [MOSSY]: '#6f7566', [STONEBRICK]: '#7e7e7e',
  [GOLD_ORE]: '#b98d20', [GOLD_BLOCK]: '#eec84c', [DIAMOND_ORE]: '#2c9c9c', [DIAMOND_BLOCK]: '#4fd6d2'
});
const VOXEL_MAX_DAMAGED_BLOCKS = 192;
const VOXEL_DAMAGE_TTL_MS = 60000;
const VOXEL_MAX_SEEN_HITS = 4096;
const VOXEL_HIT_TTL_MS = 180000;
const VOXEL_CRACK_VIEW_DISTANCE = 120;
const VOXEL_CRACK_STAGES = 8;
const VOXEL_PEER_ID = /^[\w-]{1,40}$/;
const VOXEL_HIT_ID = /^[\w.:-]{1,96}$/;

const voxelDamageMap = new Map();
const DESTRUCTION_seenHits = new Map();
const DESTRUCTION_dirtyChunks = new Set();
const DESTRUCTION_crackPool = [];
const DESTRUCTION_debrisPoint = new THREE.Vector3();
const DESTRUCTION_sessionId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
let DESTRUCTION_hitSerial = 0;
let DESTRUCTION_crackMeshCount = 0;
let DESTRUCTION_crackMaterials = null;
let DESTRUCTION_crackGeometry = null;

function voxelDurability(type) {
  return Number.isInteger(type) && Object.prototype.hasOwnProperty.call(VOXEL_DURABILITY, type)
    ? VOXEL_DURABILITY[type] : 0;
}

function DESTRUCTION_validVoxel(x, y, z) {
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
    x >= 0 && x < WORLD && z >= 0 && z < WORLD && y >= 1 && y < HEIGHT;
}

function DESTRUCTION_weapon(id) {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(WEAPON_BY_ID, id)) return null;
  const weapon = WEAPON_BY_ID[id];
  return weapon && Number.isFinite(weapon.damage) && weapon.damage >= 1 ? weapon : null;
}

function DESTRUCTION_amount(amount, weapon) {
  // Integer HP avoids order-dependent floating-point sums across shooters.
  return Number.isFinite(amount) && amount > 0 ? Math.max(1, Math.floor(Math.min(amount, weapon.damage))) : 0;
}

function damageVoxelFromShot(hit, weaponId, amount) {
  const weapon = DESTRUCTION_weapon(weaponId);
  if (!hit || !weapon || !DESTRUCTION_validVoxel(hit.x, hit.y, hit.z) ||
      !Number.isFinite(hit.dist) || hit.dist < 0 || !Number.isFinite(weapon.range) || hit.dist > weapon.range) return false;
  const block = getBlock(hit.x, hit.y, hit.z), damage = DESTRUCTION_amount(amount, weapon);
  if (!voxelDurability(block) || !damage) return false;
  // net is declared by a later classic script; only inspect it at call time.
  const by = typeof net !== 'undefined' && net && typeof net.id === 'string' && VOXEL_PEER_ID.test(net.id)
    ? net.id : 'local_' + DESTRUCTION_sessionId;
  const msg = {
    t: 'voxelHit', x: hit.x, y: hit.y, z: hit.z, block, weapon: weaponId, amount: damage,
    hitId: by + '_' + DESTRUCTION_sessionId + '_' + (++DESTRUCTION_hitSerial).toString(36), by
  };
  if (!applyVoxelDamage(msg)) return false;
  if (typeof netSend === 'function') netSend(msg);
  return true;
}

function applyVoxelDamage(msg) {
  if (!msg || msg.t !== 'voxelHit' || !DESTRUCTION_validVoxel(msg.x, msg.y, msg.z) ||
      typeof msg.by !== 'string' || !VOXEL_PEER_ID.test(msg.by) ||
      typeof msg.hitId !== 'string' || !VOXEL_HIT_ID.test(msg.hitId) ||
      (msg.id !== undefined && msg.id !== msg.by)) return false;
  const weapon = DESTRUCTION_weapon(msg.weapon), max = voxelDurability(msg.block);
  if (!weapon || !max) return false;
  const amount = DESTRUCTION_amount(msg.amount, weapon);
  if (!amount) return false;

  const now = performance.now(), hitKey = msg.by + ':' + msg.hitId;
  const seenAt = DESTRUCTION_seenHits.get(hitKey);
  if (seenAt !== undefined && now - seenAt < VOXEL_HIT_TTL_MS) return false;
  DESTRUCTION_seenHits.delete(hitKey);
  if (DESTRUCTION_seenHits.size >= VOXEL_MAX_SEEN_HITS) {
    DESTRUCTION_seenHits.delete(DESTRUCTION_seenHits.keys().next().value);
  }
  DESTRUCTION_seenHits.set(hitKey, now);
  // Remember mismatches too: a delayed duplicate must not hit a later replacement.
  const x = msg.x, y = msg.y, z = msg.z;
  if (getBlock(x, y, z) !== msg.block) return false;
  const key = blockIndex(x, y, z);
  let record = voxelDamageMap.get(key);
  if (record && (record.type !== msg.block || now >= record.expiresAt)) {
    DESTRUCTION_release(record);
    record = null;
  }
  const remaining = Math.max(0, (record ? record.remaining : max) - amount);

  if (remaining === 0) {
    // The block breaks with its material's sound (glass shatters, wood splinters).
    try {
      const surface = BC.api.blockSurface ? BC.api.blockSurface(msg.block, false) : 'stone';
      BC.emit('sfx', { kind: 'break', surface: surface === 'soft' || surface === 'metal' ? 'stone' : surface,
        position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, volume: 0.42 });
    } catch (e) { /* sound is optional */ }
    // Storage changes synchronously. setBlock's reset hook returns any crack mesh
    // to its pool; only the expensive terrain remesh waits for the next frame.
    setBlock(x, y, z, AIR);
    DESTRUCTION_queueRemesh(x, z);
    // Once AIR, later pellets/duplicates fail the type check and cannot resend.
    if (typeof window !== 'undefined' && typeof window.__netEdit === 'function') window.__netEdit(x, y, z, AIR);
    else if (typeof netSend === 'function') netSend({ t: 'edit', x, y, z, b: AIR });
    if (typeof addImpact === 'function') {
      DESTRUCTION_debrisPoint.set(x + 0.5, y + 0.65, z + 0.5);
      addImpact(DESTRUCTION_debrisPoint, VOXEL_DEBRIS_COLORS[msg.block]);
    }
    return true;
  }

  if (!record) {
    if (voxelDamageMap.size >= VOXEL_MAX_DAMAGED_BLOCKS) {
      DESTRUCTION_release(voxelDamageMap.values().next().value);
    }
    record = {
      key, x, y, z, type: msg.block, max, remaining, health: remaining,
      lastHit: now, expiresAt: now + VOXEL_DAMAGE_TTL_MS, progress: 1 - remaining / max,
      seed: DESTRUCTION_hash(Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^
        Math.imul(z, 83492791) ^ Math.imul(msg.block, 2654435761) ^ SEED),
      mesh: DESTRUCTION_acquireCrack(x, y, z), renderedHealth: -1
    };
  } else {
    record.health = record.remaining = remaining;
    record.lastHit = now;
    record.expiresAt = now + VOXEL_DAMAGE_TTL_MS;
    record.progress = 1 - remaining / max;
    voxelDamageMap.delete(key);
  }
  // Insertion order doubles as an LRU, with no per-frame sorting or allocations.
  voxelDamageMap.set(key, record);
  DESTRUCTION_refreshCrack(record);
  return true;
}

function resetVoxelDamage(x, y, z, oldType, newType) {
  // Called millions of times by terrain generation. Empty/no-entry paths allocate
  // nothing (numeric blockIndex, no coordinate strings, vectors or neighbor work).
  if (!voxelDamageMap.size || (oldType !== undefined && newType !== undefined && oldType === newType)) return;
  const record = voxelDamageMap.get(blockIndex(x, y, z));
  if (record) DESTRUCTION_release(record);
}

function DESTRUCTION_release(record) {
  voxelDamageMap.delete(record.key);
  if (!record.mesh) return;
  record.mesh.visible = false;
  scene.remove(record.mesh);
  DESTRUCTION_crackPool.push(record.mesh);
  record.mesh = null;
}

function DESTRUCTION_queueRemesh(x, z) {
  // Share 90's scheduler when loaded, including while playing offline. Otherwise
  // its earlier frame flush could rebuild a chunk that our own queue then repeats.
  if (typeof netQueueDirty === 'function') {
    netQueueDirty(x, z);
    return;
  }
  // Ambient-occlusion corner samples cross diagonal chunk boundaries as well as
  // face boundaries. A numeric Set batches all pellets/players to one rebuild.
  const x0 = Math.max(0, Math.floor((x - 1) / CHUNK));
  const x1 = Math.min(CHUNKS - 1, Math.floor((x + 1) / CHUNK));
  const z0 = Math.max(0, Math.floor((z - 1) / CHUNK));
  const z1 = Math.min(CHUNKS - 1, Math.floor((z + 1) / CHUNK));
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
    DESTRUCTION_dirtyChunks.add(cz * CHUNKS + cx);
  }
}

function updateDestruction(dt, now) {
  // now is the RAF/performance.now() timestamp in milliseconds. Expiry uses real
  // elapsed time even when dt is clamped/zero in menus or after a background tab.
  if (!Number.isFinite(now)) now = performance.now();
  for (const record of voxelDamageMap.values()) {
    if (now >= record.expiresAt || getBlock(record.x, record.y, record.z) !== record.type) DESTRUCTION_release(record);
    else DESTRUCTION_refreshCrack(record);
  }
  for (const [id, seenAt] of DESTRUCTION_seenHits) {
    if (now - seenAt < VOXEL_HIT_TTL_MS) break;
    DESTRUCTION_seenHits.delete(id);
  }
  if (typeof flushNetEdits === 'function') flushNetEdits();
  for (const key of DESTRUCTION_dirtyChunks) rebuildChunk(key % CHUNKS, Math.floor(key / CHUNKS));
  DESTRUCTION_dirtyChunks.clear();
}

/* ---------------- bounded surface-crack renderer ---------------- */
function DESTRUCTION_hash(seed) {
  seed = Math.imul(seed ^ (seed >>> 16), 0x7feb352d);
  seed = Math.imul(seed ^ (seed >>> 15), 0x846ca68b);
  return (seed ^ (seed >>> 16)) >>> 0;
}

/* Eight pixel-art damage stages drawn into 16x16 tiles, the same grain as the
   block textures. Each stage reveals more of one fixed crack map, so a block
   visibly breaks up hit by hit instead of growing thin lines. */
function DESTRUCTION_crackMap() {
  const SIZE = 16, cells = [], seen = new Set();
  let seed = 977;
  const rand = () => { seed = DESTRUCTION_hash(seed + 1); return seed / 4294967296; };
  const add = (x, y) => {
    const key = y * SIZE + x;
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || seen.has(key)) return false;
    seen.add(key);
    cells.push([x, y]);
    return true;
  };
  // Cracks run out from an off-centre strike point, forking as they go.
  const walkers = [];
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 0.4 + rand() * 0.6;
    walkers.push({ x: 7, y: 8, dx: Math.cos(a), dy: Math.sin(a) });
  }
  for (let step = 0; step < 140 && walkers.length; step++) {
    const w = walkers[step % walkers.length];
    w.x += w.dx + (rand() - 0.5) * 0.9;
    w.y += w.dy + (rand() - 0.5) * 0.9;
    add(Math.round(w.x), Math.round(w.y));
    if (rand() < 0.08 && walkers.length < 9) {
      const a = Math.atan2(w.dy, w.dx) + (rand() < 0.5 ? -1 : 1) * (0.7 + rand() * 0.5);
      walkers.push({ x: w.x, y: w.y, dx: Math.cos(a), dy: Math.sin(a) });
    }
  }
  return { SIZE, cells };
}

function DESTRUCTION_initCracks() {
  if (DESTRUCTION_crackMaterials) return;
  const map = DESTRUCTION_crackMap(), SIZE = map.SIZE;
  DESTRUCTION_crackMaterials = [];
  for (let stage = 0; stage < VOXEL_CRACK_STAGES; stage++) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const g = canvas.getContext('2d');
    const reveal = (stage + 1) / VOXEL_CRACK_STAGES;
    const count = Math.ceil(map.cells.length * (0.16 + reveal * 0.84));
    // A chipped pale lip beside each dark split, as on a stone edge.
    g.fillStyle = 'rgba(255,244,226,0.22)';
    for (let i = 0; i < count; i++) g.fillRect(map.cells[i][0] + 1, map.cells[i][1] + 1, 1, 1);
    // The last stages darken the whole face: the block is about to go.
    if (reveal > 0.6) { g.fillStyle = 'rgba(8,6,5,' + ((reveal - 0.6) * 0.75).toFixed(3) + ')'; g.fillRect(0, 0, SIZE, SIZE); }
    g.fillStyle = 'rgba(10,8,7,0.92)';
    for (let i = 0; i < count; i++) g.fillRect(map.cells[i][0], map.cells[i][1], 1, 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    DESTRUCTION_crackMaterials.push(new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthTest: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, toneMapped: false
    }));
  }
  DESTRUCTION_crackGeometry = new THREE.BoxGeometry(1.004, 1.004, 1.004);
}

function DESTRUCTION_acquireCrack(x, y, z) {
  DESTRUCTION_initCracks();
  let mesh = DESTRUCTION_crackPool.pop();
  if (!mesh) {
    if (DESTRUCTION_crackMeshCount >= VOXEL_MAX_DAMAGED_BLOCKS) return null;
    mesh = new THREE.Mesh(DESTRUCTION_crackGeometry, DESTRUCTION_crackMaterials[0]);
    mesh.name = 'voxel-damage-cracks';
    mesh.renderOrder = 3;
    mesh.matrixAutoUpdate = false;
    DESTRUCTION_crackMeshCount++;
  }
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  // A quarter turn per block, so neighbours don't show the same crack.
  mesh.rotation.y = (DESTRUCTION_hash(Math.imul(x, 73856093) ^ Math.imul(z, 83492791)) & 3) * Math.PI * 0.5;
  mesh.updateMatrix();
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}

function DESTRUCTION_exposed(record) {
  for (let fi = 0; fi < FACES.length; fi++) {
    const dir = FACES[fi].dir;
    const neighbor = getBlock(record.x + dir[0], record.y + dir[1], record.z + dir[2]);
    if (neighbor === AIR || neighbor === WATER || (neighbor === GLASS && record.type !== GLASS)) return true;
  }
  return false;
}

function DESTRUCTION_refreshCrack(record) {
  const mesh = record.mesh;
  if (!mesh) return;
  const dx = camera.position.x - record.x - 0.5, dy = camera.position.y - record.y - 0.5;
  const dz = camera.position.z - record.z - 0.5;
  if (dx * dx + dy * dy + dz * dz > VOXEL_CRACK_VIEW_DISTANCE * VOXEL_CRACK_VIEW_DISTANCE) {
    mesh.visible = false;
    return;
  }
  mesh.visible = DESTRUCTION_exposed(record);
  if (record.renderedHealth === record.remaining) return;
  const stage = Math.max(0, Math.min(VOXEL_CRACK_STAGES - 1, Math.ceil(record.progress * VOXEL_CRACK_STAGES) - 1));
  mesh.material = DESTRUCTION_crackMaterials[stage];
  record.renderedHealth = record.remaining;
}
