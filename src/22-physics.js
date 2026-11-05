/* Blockcraft Battle Ground — Shared body physics for players, critters and the jetpack.
   22-physics.js
   Loads after 20-world.js (voxel storage) and before 40-characters.js / 50-player.js.
   Sweeps axis-aligned boxes against voxels and the dragon owner's live bodies,
   resolves water buoyancy and forwards jetpack updates. Voxel-only bridges keep
   dragon world sweeps non-recursive. A dirty local-body repair handles raced edits;
   ordinary physics remains allocation-free through preallocated scratch boxes. */
'use strict';

/* ---------------- tuning ---------------- */
const BC_PHYS_GRAVITY = 28;              // blocks / s^2 for critters
const BC_PHYS_TERMINAL = 55;             // maximum falling speed
const BC_PHYS_STEP = 1 / 120;            // fixed sub-step used by movement owners
const BC_PHYS_EPS = 0.00001;             // face-snap epsilon (matches the player)
const BC_PHYS_STEP_UP = 1.02;            // one voxel, with a little snap tolerance
const BC_PHYS_STEP_DOWN = 1.08;
const BC_PHYS_WATER_DRAG = 6.4;          // vertical drag while submerged
const BC_PHYS_WATER_DRAG_H = 0.62;       // horizontal speed multiplier in water
const BC_PHYS_BUOYANCY = 18;             // buoyant acceleration while deep
const BC_PHYS_WADE_DEPTH = 0.9;          // shallower than this = wade, not float
const BC_PHYS_SWIM_UP = 4.0;             // hard cap on upward swim speed
const BC_PHYS_SWIM_STROKE = 2.8;         // impulse per swim stroke
const BC_PHYS_SWIM_COOLDOWN = 0.32;      // seconds between strokes
const BC_PHYS_PLAYER_EXIT_DEPTH = 0.65;  // surface band eligible for a shore pop
const BC_PHYS_PLAYER_EXIT_REACH = 0.45;  // inspect only the immediately approached bank
const BC_PHYS_PLAYER_EXIT_HEIGHT = 1.02; // at most one voxel above the water surface
const BC_PHYS_SPLASH_GAP = 0.11;         // seconds between splash events
const BC_PHYS_REPAIR_DISTANCE = 2;       // maximum TOTAL instantaneous displacement
const BC_PHYS_REPAIR_VERTICAL = 1.05;    // never climb/fall several storeys in a repair
const BC_PHYS_REPAIR_PATH_STEP = 0.1;
const BC_PHYS_REPAIR_CANDIDATES = 544;    // at most 272 points at each of two body heights
const BC_PHYS_DYNAMIC_REPAIR_GAP = 120;  // ms; retry moving-body failures only on relevant events

/* Chicken / villager collision bodies. x/z are the feet centre, y is the sole. */
const BC_PHYS_BODY = {
  chicken: { w: 0.22, h: 0.55 },
  villager: { w: 0.28, h: 1.7 }
};

/* ---------------- voxel queries ---------------- */
function bmSolidAt(x, y, z) {
  const b = getBlock(x, y, z);
  return b !== AIR && b !== WATER;
}

function bmLiquidAt(x, y, z) {
  return getBlock(x, y, z) === WATER;
}

/**
 * Top of the connected water column at/below a probe, or -Infinity when dry.
 * A finite probe stops at terrain, so water below a house floor cannot wet its
 * occupants. Probe near the feet, not above the head, to allow flooded caves.
 * With no probe, find the highest water column even underneath an overhang.
 */
function bmWaterSurfaceAt(x, z, fromY) {
  const bx = Math.floor(x), bz = Math.floor(z);
  let top = HEIGHT - 1;
  if (Number.isFinite(fromY)) top = Math.min(top, Math.floor(fromY));
  for (let y = top; y >= 0; y--) {
    const b = getBlock(bx, y, bz);
    if (b === WATER) {
      let s = y;
      while (s + 1 < HEIGHT && getBlock(bx, s + 1, bz) === WATER) s++;
      return s + 1;
    }
    // Terrain separates the finite probe from any water below that floor.
    // Stopping here also keeps the common dry-land query cheap.
    if (b !== AIR && Number.isFinite(fromY)) return -Infinity;
  }
  return -Infinity;
}

function bmWaterDepthAt(x, y, z) {
  if (!bmLiquidAt(x, y, z)) return 0;
  const surf = bmWaterSurfaceAt(x, z, y);
  return Number.isFinite(surf) ? Math.max(0, surf - y) : 0;
}

function bmIsInWaterAt(x, y, z) {
  return bmLiquidAt(x, y, z);
}

/**
 * Highest solid top face under a feet-centred box, within `depth` blocks.
 * Returns -Infinity when nothing is close enough, so callers can distinguish
 * "standing on a floor" from "over a drop".
 */
function bmSupportAt(x, y, z, w, depth) {
  const half = Math.max(0.02, Number.isFinite(w) ? w : 0.3);
  const reach = Math.max(0.05, Number.isFinite(depth) ? depth : BC_PHYS_STEP_DOWN);
  const x0 = Math.floor(x - half + BC_PHYS_EPS);
  const x1 = Math.floor(x + half - BC_PHYS_EPS);
  const z0 = Math.floor(z - half + BC_PHYS_EPS);
  const z1 = Math.floor(z + half - BC_PHYS_EPS);
  const y0 = Math.floor(y - BC_PHYS_EPS);
  const yEnd = Math.floor(y - reach);
  let best = -Infinity;
  for (let bx = x0; bx <= x1; bx++) {
    for (let bz = z0; bz <= z1; bz++) {
      for (let by = y0; by >= yEnd; by--) {
        if (!bmSolidAt(bx, by, bz)) continue;
        const top = by + 1;
        if (top <= y + BC_PHYS_EPS && top >= y - reach && top > best) best = top;
        break;
      }
    }
  }
  return best;
}

/* ---------------- swept AABB ---------------- */
const bmSweepBox = { x: 0, y: 0, z: 0, w: 0.3, h: 1.8 };
const bmVoxelSweepBox = { x: 0, y: 0, z: 0, w: 0.3, h: 1.8 };
const bmDragonSweepBox = { x: 0, y: 0, z: 0, w: 0.3, h: 1.8, ignoreDragonIndex: -1 };
const bmDragonSweepOut = { x: 0, y: 0, z: 0, hitX: false, hitY: false, hitZ: false };
const bmMoveBox = { x: 0, y: 0, z: 0, w: 0.3, h: 1.8 };
const bmStepProbe = { x: 0, y: 0, z: 0, w: 0.3, h: 1.8 };
const bmSpawnBox = { x: 0, y: 0, z: 0, w: 0.3, h: 1.8 };

/** Move one axis and stop exactly on the first voxel face. Mutates `box`. */
function bmAxisMoveVoxels(box, axis, amount) {
  if (!Number.isFinite(amount) || amount === 0) return false;
  const w = box.w, h = box.h;
  const px = box.x + (axis === 'x' ? amount : 0);
  const py = box.y + (axis === 'y' ? amount : 0);
  const pz = box.z + (axis === 'z' ? amount : 0);
  const minX = Math.floor(Math.min(box.x, px) - w + BC_PHYS_EPS);
  const maxX = Math.floor(Math.max(box.x, px) + w - BC_PHYS_EPS);
  const minY = Math.floor(Math.min(box.y, py) + BC_PHYS_EPS);
  const maxY = Math.floor(Math.max(box.y, py) + h - BC_PHYS_EPS);
  const minZ = Math.floor(Math.min(box.z, pz) - w + BC_PHYS_EPS);
  const maxZ = Math.floor(Math.max(box.z, pz) + w - BC_PHYS_EPS);
  const edge = box[axis] + (axis === 'y' ? (amount > 0 ? h : 0) : (amount > 0 ? w : -w));
  let allowed = amount;
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (!bmSolidAt(x, y, z)) continue;
        const face = axis === 'x' ? x : axis === 'y' ? y : z;
        const gap = face + (amount < 0 ? 1 : 0) - edge;
        if (amount > 0 && gap >= -BC_PHYS_EPS && gap < allowed) allowed = Math.max(0, gap);
        if (amount < 0 && gap <= BC_PHYS_EPS && gap > allowed) allowed = Math.min(0, gap);
      }
    }
  }
  box[axis] += allowed;
  return allowed !== amount;
}

function bmOverlapsVoxels(box) {
  const w = box.w, h = box.h;
  const x0 = Math.floor(box.x - w + BC_PHYS_EPS);
  const x1 = Math.floor(box.x + w - BC_PHYS_EPS);
  const y0 = Math.floor(box.y + BC_PHYS_EPS);
  const y1 = Math.floor(box.y + h - BC_PHYS_EPS);
  const z0 = Math.floor(box.z - w + BC_PHYS_EPS);
  const z1 = Math.floor(box.z + w - BC_PHYS_EPS);
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        if (bmSolidAt(x, y, z)) return true;
  return false;
}

function bmDragonApi() {
  return BC.api && BC.api.dragons;
}

function bmIgnoreDragonIndex(box, ignoreIndex) {
  const index = Number.isInteger(ignoreIndex) ? ignoreIndex : box && box.ignoreDragonIndex;
  return Number.isInteger(index) && index >= 0 ? index : -1;
}

function bmOverlapsDragons(box, ignoreIndex) {
  const api = bmDragonApi();
  return !!(api && typeof api.overlapsAabb === 'function' &&
    api.overlapsAabb(box, bmIgnoreDragonIndex(box, ignoreIndex)));
}

function bmOverlaps(box, ignoreIndex) {
  return bmOverlapsVoxels(box) || bmOverlapsDragons(box, ignoreIndex);
}

/** The same feet-Y body and axis order as voxels, never whole-cell dragon solids. */
function bmAxisMove(box, axis, amount) {
  if (!Number.isFinite(amount) || amount === 0) return false;
  // The core may already have captured playing=true before a repair fails in
  // preFrame. Freeze ONLY its local-player box for that last frame, not NPCs or
  // public scratch sweeps; 80-input gates subsequent frames until space opens.
  if (BC.flags.playerRepairBlocked && typeof playerSweepBox !== 'undefined' && box === playerSweepBox) return true;
  const api = bmDragonApi();
  if (!api || typeof api.sweepAabb !== 'function') return bmAxisMoveVoxels(box, axis, amount);
  const start = box[axis], probe = bmDragonSweepBox;
  probe.x = box.x; probe.y = box.y; probe.z = box.z;
  probe.w = box.w; probe.h = box.h;
  probe.ignoreDragonIndex = bmIgnoreDragonIndex(box);
  const voxelHit = bmAxisMoveVoxels(box, axis, amount);
  const allowed = box[axis] - start;
  if (allowed === 0) return voxelHit;
  const out = bmDragonSweepOut;
  out.x = probe.x; out.y = probe.y; out.z = probe.z;
  out.hitX = out.hitY = out.hitZ = false;
  // 45 may call sweepVoxels while servicing this query. Its independent scratch
  // box and voxel-only moveAxis never re-enter the dynamic wrapper above.
  const result = api.sweepAabb(probe, axis === 'x' ? allowed : 0, axis === 'y' ? allowed : 0,
    axis === 'z' ? allowed : 0, out, probe.ignoreDragonIndex) || out;
  if (Number.isFinite(result[axis])) {
    const delta = result[axis] - start;
    box[axis] = start + (allowed > 0 ? Math.max(0, Math.min(allowed, delta)) : Math.min(0, Math.max(allowed, delta)));
  }
  return voxelHit || Math.abs(box[axis] - (start + allowed)) > BC_PHYS_EPS ||
    !!(axis === 'x' ? result.hitX : axis === 'y' ? result.hitY : result.hitZ);
}

/** Highest obstruction top that would be crossed by a horizontal move. */
function bmStepTop(box, axis, amount) {
  const w = box.w, h = box.h;
  const ex = box.x + (axis === 'x' ? amount : 0);
  const ez = box.z + (axis === 'z' ? amount : 0);
  const minX = Math.floor(Math.min(box.x, ex) - w + BC_PHYS_EPS);
  const maxX = Math.floor(Math.max(box.x, ex) + w - BC_PHYS_EPS);
  const minZ = Math.floor(Math.min(box.z, ez) - w + BC_PHYS_EPS);
  const maxZ = Math.floor(Math.max(box.z, ez) + w - BC_PHYS_EPS);
  const minY = Math.floor(box.y - 0.05);
  const maxY = Math.floor(box.y + BC_PHYS_STEP_UP);
  const maxH = box.y + h - BC_PHYS_EPS;
  let top = -Infinity;
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        if (!bmSolidAt(x, y, z)) continue;
        if (y >= maxH) continue;
        const cellTop = y + 1;
        if (cellTop <= box.y + 0.04) continue;
        if (cellTop > box.y + BC_PHYS_STEP_UP) continue;
        if (cellTop > top) top = cellTop;
      }
    }
  }
  return top;
}

/**
 * Try to walk up exactly one voxel. Runs a full dry run on a scratch box so a
 * rejected step never leaves the body partially moved.
 */
function bmTryStepUp(box, axis, amount, limitY) {
  const top = bmStepTop(box, axis, amount);
  if (!Number.isFinite(top)) return false;
  if (Number.isFinite(limitY) && top > limitY + BC_PHYS_EPS) return false;
  const lift = top - box.y;
  if (lift <= 0.002 || lift > BC_PHYS_STEP_UP) return false;
  const probe = bmStepProbe;
  probe.x = box.x; probe.y = box.y; probe.z = box.z;
  probe.w = box.w; probe.h = box.h;
  probe.ignoreDragonIndex = bmIgnoreDragonIndex(box);
  // Sweep the lift as well as the forward move: an empty destination above a
  // low roof is not permission to teleport through that roof.
  if (bmAxisMove(probe, 'y', lift)) return false;
  if (bmOverlaps(probe)) return false;
  if (bmAxisMove(probe, axis, amount)) return false;
  if (!Number.isFinite(bmSupportAt(probe.x, probe.y, probe.z, probe.w, 0.05))) return false;
  box.x = probe.x; box.y = probe.y; box.z = probe.z;
  return true;
}

/** Public one-shot sweep. Pass `out` to reuse the result without allocation. */
function bmSweepAabb(box, dx, dy, dz, out, ignoreIndex) {
  const b = bmSweepBox;
  b.x = Number.isFinite(box && box.x) ? box.x : 0;
  b.y = Number.isFinite(box && box.y) ? box.y : 0;
  b.z = Number.isFinite(box && box.z) ? box.z : 0;
  b.w = box && Number.isFinite(box.w) ? box.w : 0.3;
  b.h = box && Number.isFinite(box.h) ? box.h : 1.8;
  b.ignoreDragonIndex = bmIgnoreDragonIndex(box, ignoreIndex);
  const hitY = bmAxisMove(b, 'y', dy);
  const hitX = bmAxisMove(b, 'x', dx);
  const hitZ = bmAxisMove(b, 'z', dz);
  const result = out || {};
  result.x = b.x; result.y = b.y; result.z = b.z;
  result.hitX = hitX; result.hitY = hitY; result.hitZ = hitZ;
  return result;
}

/** Exact pre-dynamic sweep: dragon world motion must call THIS bridge, not sweepAabb. */
function bmSweepVoxels(box, dx, dy, dz, out) {
  const b = bmVoxelSweepBox;
  b.x = Number.isFinite(box && box.x) ? box.x : 0;
  b.y = Number.isFinite(box && box.y) ? box.y : 0;
  b.z = Number.isFinite(box && box.z) ? box.z : 0;
  b.w = box && Number.isFinite(box.w) ? box.w : 0.3;
  b.h = box && Number.isFinite(box.h) ? box.h : 1.8;
  const hitY = bmAxisMoveVoxels(b, 'y', dy);
  const hitX = bmAxisMoveVoxels(b, 'x', dx);
  const hitZ = bmAxisMoveVoxels(b, 'z', dz);
  const result = out || {};
  result.x = b.x; result.y = b.y; result.z = b.z;
  result.hitX = hitX; result.hitY = hitY; result.hitZ = hitZ;
  return result;
}

/* ---------------- bounded local-body edit repair ---------------- */
const bmPlayerRepair = {
  pending: false, blocked: false, status: 'idle', attempts: 0, candidates: 0,
  lastDistance: 0, height: 1.8, dynamic: false, dynamicRetryAt: 0,
  fromX: 0, fromY: 0, fromZ: 0, toX: 0, toY: 0, toZ: 0
};
const bmRepairSource = { x: 0, y: 0, z: 0, w: 0.3, h: 1.8 };
const bmRepairProbe = { x: 0, y: 0, z: 0, w: 0.3, h: 1.8 };
const bmRepairDynamicRegion = { x: 0, y: 0, z: 0, w: 0.3, h: 1.8, ignoreDragonIndex: -1 };
const bmRepairDragonCollider = { x: NaN, y: NaN, z: NaN, w: NaN, h: NaN,
  minX: NaN, minY: NaN, minZ: NaN, maxX: NaN, maxY: NaN, maxZ: NaN };
const bmRepairDragonBounds = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
const bmDragonPenetration = { minX: Infinity, minY: Infinity, minZ: Infinity,
  maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
const bmRepairPlanesX = new Float64Array(3);
const bmRepairPlanesY = new Float64Array(3);
const bmRepairPlanesZ = new Float64Array(3);
const bmRepairSearch = {
  bestScore: Infinity, bestDistance: 0, bestX: 0, bestY: 0, bestZ: 0, bestHeight: 1.8,
  heightPenalty: 0, preferSupport: false, dragonApi: null, dragonCount: 0, dynamicSource: false
};

function bmDragonColliderCount(api) {
  // The actual list stays owned by 45. This is a cold repair query, not a
  // duplicated catalog/eligibility roll or a cached second set of colliders.
  let count = api && (typeof api.count === 'function' ? api.count() : api.count);
  if (!Number.isInteger(count) && typeof dragons !== 'undefined' && dragons) count = dragons.length;
  if (!Number.isInteger(count) && api && api.dragons) count = api.dragons.length;
  return Number.isInteger(count) ? Math.max(0, Math.min(64, count)) : 0;
}

function bmReadDragonBounds(api, index) {
  if (!api || typeof api.getCollider !== 'function') return null;
  const scratch = bmRepairDragonCollider;
  scratch.x = scratch.y = scratch.z = scratch.w = scratch.h = NaN;
  scratch.minX = scratch.minY = scratch.minZ = scratch.maxX = scratch.maxY = scratch.maxZ = NaN;
  scratch.solid = true; scratch.active = true;
  return bmBoundsForDragonCollider(api.getCollider(index, scratch));
}

function bmBoundsForDragonCollider(collider) {
  if (!collider || collider.solid === false || collider.active === false) return null;
  const bounds = bmRepairDragonBounds;
  if (Number.isFinite(collider.minX) && Number.isFinite(collider.minY) && Number.isFinite(collider.minZ) &&
      Number.isFinite(collider.maxX) && Number.isFinite(collider.maxY) && Number.isFinite(collider.maxZ)) {
    bounds.minX = collider.minX; bounds.minY = collider.minY; bounds.minZ = collider.minZ;
    bounds.maxX = collider.maxX; bounds.maxY = collider.maxY; bounds.maxZ = collider.maxZ;
  } else if (Number.isFinite(collider.x) && Number.isFinite(collider.y) && Number.isFinite(collider.z) &&
      Number.isFinite(collider.w) && collider.w > 0 && Number.isFinite(collider.h) && collider.h > 0) {
    bounds.minX = collider.x - collider.w; bounds.minY = collider.y; bounds.minZ = collider.z - collider.w;
    bounds.maxX = collider.x + collider.w; bounds.maxY = collider.y + collider.h; bounds.maxZ = collider.z + collider.w;
  } else if (collider.min && collider.max && Number.isFinite(collider.min.x + collider.min.y + collider.min.z) &&
      Number.isFinite(collider.max.x + collider.max.y + collider.max.z)) {
    bounds.minX = collider.min.x; bounds.minY = collider.min.y; bounds.minZ = collider.min.z;
    bounds.maxX = collider.max.x; bounds.maxY = collider.max.y; bounds.maxZ = collider.max.z;
  } else return false; // unknown bounds must not turn an escape into a through-body teleport
  return bounds.maxX > bounds.minX && bounds.maxY > bounds.minY && bounds.maxZ > bounds.minZ ? bounds : false;
}

function bmBoxOverlapsDragonBounds(box, bounds) {
  return box.x + box.w > bounds.minX + BC_PHYS_EPS && box.x - box.w < bounds.maxX - BC_PHYS_EPS &&
    box.y + box.h > bounds.minY + BC_PHYS_EPS && box.y < bounds.maxY - BC_PHYS_EPS &&
    box.z + box.w > bounds.minZ + BC_PHYS_EPS && box.z - box.w < bounds.maxZ - BC_PHYS_EPS;
}

function bmIncludeDragonPenetration(box, collider, out) {
  const bounds = bmBoundsForDragonCollider(collider);
  if (!bounds || !bmBoxOverlapsDragonBounds(box, bounds)) return;
  out.minX = Math.min(out.minX, bounds.minX); out.maxX = Math.max(out.maxX, bounds.maxX);
  out.minY = Math.min(out.minY, bounds.minY); out.maxY = Math.max(out.maxY, bounds.maxY);
  out.minZ = Math.min(out.minZ, bounds.minZ); out.maxZ = Math.max(out.maxZ, bounds.maxZ);
}

function bmDragonPenetrationBounds(box, api, count, out) {
  out.minX = out.minY = out.minZ = Infinity;
  out.maxX = out.maxY = out.maxZ = -Infinity;
  if (!api || typeof api.getCollider !== 'function') return false;
  for (let index = 0; index < count; index++) {
    if (index === bmIgnoreDragonIndex(box)) continue;
    // Borrow the owner's live record only during this cold query. In particular
    // use overlapping articulated parts, not empty space in its broad-phase box.
    const collider = api.getCollider(index);
    if (!collider || collider.active === false || collider.solid === false) continue;
    if (collider.parts && Number.isInteger(collider.partCount) && collider.partCount > 0) {
      for (let part = 0; part < collider.partCount && part < collider.parts.length; part++) {
        bmIncludeDragonPenetration(box, collider.parts[part], out);
      }
    } else bmIncludeDragonPenetration(box, collider, out);
  }
  return Number.isFinite(out.minX);
}

function bmPlayerRepairEligible() {
  const world = BC.api && BC.api.world;
  const riding = BC.api && BC.api.riding;
  const killcam = BC.api && BC.api.killcam;
  return !(BC.flags.worldBusy || (world && world.busy) || (riding && riding.active) ||
    (killcam && killcam.active) || (typeof alive !== 'undefined' && !alive) ||
    (typeof loading !== 'undefined' && loading));
}

function bmReadPlayerRepairBox() {
  if (typeof player === 'undefined' || !player || !player.pos) return false;
  const p = player.pos, box = bmRepairSource;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return false;
  const height = typeof playerBodyHeight === 'function' ? playerBodyHeight() : player.bodyHeight;
  box.x = p.x; box.y = p.y; box.z = p.z;
  box.w = typeof PW === 'number' ? PW : 0.3;
  box.h = Number.isFinite(height) ? Math.max(1.2, Math.min(1.8, height)) : 1.8;
  box.ignoreDragonIndex = -1; // an active rider is ineligible, never repair its own core
  return true;
}

function bmPlayerRepairState() {
  return {
    pending: bmPlayerRepair.pending, blocked: bmPlayerRepair.blocked, status: bmPlayerRepair.status,
    attempts: bmPlayerRepair.attempts, candidates: bmPlayerRepair.candidates,
    lastDistance: bmPlayerRepair.lastDistance, height: bmPlayerRepair.height, dynamic: bmPlayerRepair.dynamic,
    maxDistance: BC_PHYS_REPAIR_DISTANCE, maxVertical: BC_PHYS_REPAIR_VERTICAL,
    maxCandidates: BC_PHYS_REPAIR_CANDIDATES,
    from: { x: bmPlayerRepair.fromX, y: bmPlayerRepair.fromY, z: bmPlayerRepair.fromZ },
    to: { x: bmPlayerRepair.toX, y: bmPlayerRepair.toY, z: bmPlayerRepair.toZ }
  };
}

function bmClearPlayerRepair(status = 'idle') {
  bmPlayerRepair.pending = bmPlayerRepair.blocked = false;
  bmPlayerRepair.dynamic = false;
  bmPlayerRepair.dynamicRetryAt = 0;
  bmPlayerRepair.status = status;
  BC.flags.playerRepairBlocked = false;
}

function bmQueuePlayerRepair() {
  if (!bmPlayerRepairEligible() || !bmReadPlayerRepairBox()) return false;
  if (!bmOverlaps(bmRepairSource)) { bmClearPlayerRepair('clear'); return false; }
  bmPlayerRepair.pending = true;
  bmPlayerRepair.status = 'pending';
  return true;
}

function bmOnPlayerVoxelChanged(edit) {
  if (!edit || !Number.isInteger(edit.x) || !Number.isInteger(edit.y) || !Number.isInteger(edit.z) ||
      !bmPlayerRepairEligible() || !bmReadPlayerRepairBox()) return;
  const box = bmRepairSource;
  // A blocked request retries only after a relevant local edit (including a
  // removal opening an escape), never from a repeated per-frame world search.
  const margin = bmPlayerRepair.blocked ? BC_PHYS_REPAIR_DISTANCE : 0;
  if (edit.x + 1 <= box.x - box.w - margin + BC_PHYS_EPS || edit.x >= box.x + box.w + margin - BC_PHYS_EPS ||
      edit.z + 1 <= box.z - box.w - margin + BC_PHYS_EPS || edit.z >= box.z + box.w + margin - BC_PHYS_EPS ||
      edit.y + 1 <= box.y - margin + BC_PHYS_EPS || edit.y >= box.y + box.h + margin - BC_PHYS_EPS) return;
  if (!bmPlayerRepair.blocked && !bmSolidAt(edit.x, edit.y, edit.z)) return;
  bmPlayerRepair.pending = true;
  bmPlayerRepair.status = 'pending';
}

function bmOnDragonCollidersChanged(change) {
  if (!bmPlayerRepairEligible() || !bmReadPlayerRepairBox()) return;
  const source = bmRepairSource, state = bmPlayerRepair;
  const dynamic = bmOverlapsDragons(source);
  if (!dynamic && !bmOverlapsVoxels(source)) {
    if (state.pending || state.blocked) bmClearPlayerRepair('clear');
    return;
  }
  if (!state.blocked) {
    if (dynamic) { state.pending = true; state.status = 'pending'; }
    return;
  }
  // A departing body can open a previously impossible voxel escape. Clear or
  // retry it once, while a distant moving guardian never restarts the search.
  if (state.dynamic && !dynamic) { state.pending = true; state.status = 'pending'; return; }
  const region = bmRepairDynamicRegion;
  region.x = source.x; region.y = source.y - BC_PHYS_REPAIR_VERTICAL; region.z = source.z;
  region.w = source.w + BC_PHYS_REPAIR_DISTANCE;
  region.h = source.h + BC_PHYS_REPAIR_VERTICAL * 2;
  const index = Number.isInteger(change) ? change : change && change.index;
  if (Number.isInteger(index)) {
    const bounds = bmReadDragonBounds(bmDragonApi(), index);
    if (bounds && !bmBoxOverlapsDragonBounds(region, bounds)) return;
  }
  if (!dynamic && !bmOverlapsDragons(region)) return;
  const now = BC.now();
  if (now < state.dynamicRetryAt) return;
  state.pending = true;
  state.status = 'pending';
}

function bmRepairPositionAllowed(x, y, z) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
  const ceiling = typeof PLAYER_FLIGHT_CEILING === 'number' ? PLAYER_FLIGHT_CEILING : HEIGHT + 38;
  if (x < 1.2 || z < 1.2 || x > WORLD - 1.2 || z > WORLD - 1.2 || y < 1 || y > ceiling) return false;
  const modes = BC.api && BC.api.modes;
  const arena = modes && modes.arena;
  return !arena || !arena.active || typeof arena.contains !== 'function' || arena.contains(x, z);
}

function bmRepairPathClear(source, x, y, z, distance) {
  const steps = Math.max(1, Math.ceil(distance / BC_PHYS_REPAIR_PATH_STEP));
  const dx = (x - source.x) / steps, dy = (y - source.y) / steps, dz = (z - source.z) / steps;
  const orders = dx !== 0 && dz !== 0 ? 2 : 1;
  const probe = bmRepairProbe;
  for (let order = 0; order < orders; order++) {
    probe.x = source.x; probe.y = source.y; probe.z = source.z;
    probe.w = source.w; probe.h = source.h;
    probe.ignoreDragonIndex = bmIgnoreDragonIndex(source);
    let clear = true;
    for (let step = 0; step < steps; step++) {
      // An initial penetration may be exited, but each swept slice still stops
      // at a NEW solid face. No teleport through unrelated walls/ceilings/bodies.
      if (dy > 0 && bmAxisMove(probe, 'y', dy)) { clear = false; break; }
      const hit = order === 0
        ? bmAxisMove(probe, 'x', dx) || bmAxisMove(probe, 'z', dz)
        : bmAxisMove(probe, 'z', dz) || bmAxisMove(probe, 'x', dx);
      if (hit || (dy <= 0 && bmAxisMove(probe, 'y', dy))) { clear = false; break; }
    }
    if (clear && !bmOverlaps(probe)) return true;
  }
  return false;
}

function bmConsiderPlayerRepair(x, y, z) {
  if (++bmPlayerRepair.candidates > BC_PHYS_REPAIR_CANDIDATES) return;
  const source = bmRepairSource, search = bmRepairSearch;
  const dx = x - source.x, dy = y - source.y, dz = z - source.z;
  const distanceSq = dx * dx + dy * dy + dz * dz;
  if (distanceSq > BC_PHYS_REPAIR_DISTANCE * BC_PHYS_REPAIR_DISTANCE ||
      Math.abs(dy) > BC_PHYS_REPAIR_VERTICAL || !bmRepairPositionAllowed(x, y, z)) return;
  const minimumScore = distanceSq + Math.abs(dy) * 0.2 + search.heightPenalty;
  if (minimumScore >= search.bestScore) return;
  const probe = bmRepairProbe;
  probe.x = x; probe.y = y; probe.z = z; probe.w = source.w; probe.h = source.h;
  probe.ignoreDragonIndex = bmIgnoreDragonIndex(source);
  if (bmOverlaps(probe)) return;
  const supported = Number.isFinite(bmSupportAt(x, y, z, source.w, 0.05));
  probe.h = 1.8;
  const standing = !bmOverlaps(probe);
  probe.h = source.h;
  const score = minimumScore + (search.preferSupport && !supported ? 0.25 : 0) +
    (!standing ? 0.02 : 0) + (dx !== 0 && dz !== 0 ? 0.002 : 0);
  if (score >= search.bestScore || !bmRepairPathClear(source, x, y, z, Math.sqrt(distanceSq))) return;
  search.bestScore = score;
  search.bestDistance = Math.sqrt(distanceSq);
  search.bestX = x; search.bestY = y; search.bestZ = z; search.bestHeight = source.h;
}

function bmFindPlayerRepair() {
  const source = bmRepairSource, search = bmRepairSearch;
  const originalHeight = source.h;
  search.bestScore = Infinity;
  search.heightPenalty = 0;
  search.preferSupport = Number.isFinite(bmSupportAt(source.x, source.y, source.z, source.w, 0.05));
  search.dragonApi = bmDragonApi();
  search.dragonCount = bmDragonColliderCount(search.dragonApi);
  bmPlayerRepair.candidates = 0;
  for (let pass = 0; pass < (originalHeight > 1.2 ? 2 : 1); pass++) {
    source.h = pass === 0 ? originalHeight : 1.2;
    search.dynamicSource = bmOverlapsDragons(source);
    search.heightPenalty = pass === 0 ? 0 : 0.08;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let x = Math.floor(source.x - source.w + BC_PHYS_EPS); x <= Math.floor(source.x + source.w - BC_PHYS_EPS); x++) {
      for (let y = Math.floor(source.y + BC_PHYS_EPS); y <= Math.floor(source.y + source.h - BC_PHYS_EPS); y++) {
        for (let z = Math.floor(source.z - source.w + BC_PHYS_EPS); z <= Math.floor(source.z + source.w - BC_PHYS_EPS); z++) {
          if (!bmSolidAt(x, y, z)) continue;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x + 1);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y + 1);
          minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z + 1);
        }
      }
    }
    if (search.dynamicSource && bmDragonPenetrationBounds(source, search.dragonApi, search.dragonCount, bmDragonPenetration)) {
      const bounds = bmDragonPenetration;
      minX = Math.min(minX, bounds.minX); maxX = Math.max(maxX, bounds.maxX);
      minY = Math.min(minY, bounds.minY); maxY = Math.max(maxY, bounds.maxY);
      minZ = Math.min(minZ, bounds.minZ); maxZ = Math.max(maxZ, bounds.maxZ);
    }
    if (!Number.isFinite(minX)) {
      bmConsiderPlayerRepair(source.x, source.y, source.z);
      if (!search.dynamicSource) continue;
    } else {
      // Exact voxel/dragon face exits precede the unchanged bounded lattice.
      bmRepairPlanesX[0] = source.x;
      bmRepairPlanesX[1] = minX - source.w - BC_PHYS_EPS;
      bmRepairPlanesX[2] = maxX + source.w + BC_PHYS_EPS;
      bmRepairPlanesY[0] = source.y;
      bmRepairPlanesY[1] = minY - source.h - BC_PHYS_EPS;
      bmRepairPlanesY[2] = maxY + BC_PHYS_EPS;
      bmRepairPlanesZ[0] = source.z;
      bmRepairPlanesZ[1] = minZ - source.w - BC_PHYS_EPS;
      bmRepairPlanesZ[2] = maxZ + source.w + BC_PHYS_EPS;
      for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) {
        bmConsiderPlayerRepair(bmRepairPlanesX[x], bmRepairPlanesY[y], bmRepairPlanesZ[z]);
      }
    }
    // Fixed local lattice, never a world scan. All candidates also obey the
    // Euclidean cap, current arena boundary and swept path/headroom checks.
    for (let x = -3; x <= 3; x++) for (let y = -2; y <= 2; y++) for (let z = -3; z <= 3; z++) {
      bmConsiderPlayerRepair(source.x + x * 0.5, source.y + y * 0.5, source.z + z * 0.5);
    }
  }
  source.h = originalHeight;
  return Number.isFinite(search.bestScore);
}

function bmPlayerRepairMotionReset() {
  if (typeof resetPlayerMotion === 'function') resetPlayerMotion();
  else {
    if (player.vel && typeof player.vel.set === 'function') player.vel.set(0, 0, 0);
    else if (player.vel) player.vel.x = player.vel.y = player.vel.z = 0;
    player.groundSpeed = 0;
    player.sliding = player.dashing = player.boosting = false;
  }
}

// Returns true for an already-clear/repaired body, false when deferred/blocked.
// force=true is an explicit bounded retry; ordinary frames never poll a failure.
function bmRepairPlayerOverlap(force = false) {
  if (!bmPlayerRepairEligible()) { bmClearPlayerRepair(); return false; }
  if (!bmReadPlayerRepairBox()) return false;
  const source = bmRepairSource, state = bmPlayerRepair;
  if (state.blocked && !state.pending && !force && source.x === state.fromX && source.y === state.fromY &&
      source.z === state.fromZ && source.h === state.height) return false;
  state.pending = false;
  if (!bmOverlaps(source)) { bmClearPlayerRepair('clear'); return true; }
  state.attempts++;
  state.lastDistance = 0;
  state.fromX = state.toX = source.x;
  state.fromY = state.toY = source.y;
  state.fromZ = state.toZ = source.z;
  state.height = source.h;
  state.dynamic = bmOverlapsDragons(source);
  state.dynamicRetryAt = BC.now() + BC_PHYS_DYNAMIC_REPAIR_GAP;
  if (bmFindPlayerRepair()) {
    const found = bmRepairSearch;
    bmClearPlayerRepair('repaired');
    player.pos.x = found.bestX; player.pos.y = found.bestY; player.pos.z = found.bestZ;
    player.bodyHeight = found.bestHeight;
    player.crouching = found.bestHeight < 1.8;
    bmPlayerRepairMotionReset(); // no impulse, fuel refill, stale slide or buffered jump
    bmReadPlayerRepairBox();
    player.onGround = !player.fly && Number.isFinite(bmSupportAt(player.pos.x, player.pos.y, player.pos.z, source.w, 0.05));
    state.toX = player.pos.x; state.toY = player.pos.y; state.toZ = player.pos.z;
    state.lastDistance = found.bestDistance;
    state.height = source.h;
    BC.emit('playerRepaired', bmPlayerRepairState());
    return true;
  }
  const wasBlocked = state.blocked;
  if (!wasBlocked) state.blockedSince = BC.now();
  state.blocked = true;
  state.status = 'blocked';
  BC.flags.playerRepairBlocked = true;
  // Keep authoritative voxels intact. Freeze controls/velocity while waiting
  // for a nearby opening or an authoritative reposition, not a random respawn.
  BC.emit('inputReset', 'playerRepairBlocked');
  bmPlayerRepairMotionReset();
  bmReadPlayerRepairBox();
  state.height = source.h;
  BC.emit('playerRepairBlocked', bmPlayerRepairState());
  if (!wasBlocked && typeof toast === 'function') toast(state.dynamic
    ? 'Blocked by a dragon. Waiting for nearby space' : 'Blocked by construction. Waiting for nearby space');
  return false;
}

/* Escape hatch: the local search only looks 2 blocks around the body. If that
   stays blocked (built in by another player, spawned into a structure), lift
   the player onto the nearest free spot within 12 blocks, preferring the top
   of the column, and fall back to a respawn point. Never freeze for good. */
const BC_PHYS_ESCAPE_AFTER_MS = 1200;
const BC_PHYS_ESCAPE_RADIUS = 12;

function bmEscapeFits(x, y, z) {
  return y > 0 && y < HEIGHT + 30 && x > 0.5 && z > 0.5 && x < WORLD - 0.5 && z < WORLD - 0.5 &&
    !collides(x, y, z, PH) && collides(x, y - 0.1, z, 0.1);
}

function bmEscapePlayer() {
  const p = player.pos, baseX = Math.floor(p.x), baseZ = Math.floor(p.z), baseY = Math.floor(p.y);
  let best = null, bestScore = Infinity;
  for (let r = 0; r <= BC_PHYS_ESCAPE_RADIUS && !best; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = baseX + dx + 0.5, z = baseZ + dz + 0.5;
      for (let y = baseY; y <= Math.min(HEIGHT + 20, baseY + 24); y++) {
        if (!bmEscapeFits(x, y, z)) continue;
        const score = dx * dx + dz * dz + (y - baseY) * 0.6;
        if (score < bestScore) { bestScore = score; best = { x, y, z }; }
        break;
      }
    }
  }
  if (!best) {
    let spawn = null;
    try { const modes = BC.api.modes; spawn = modes && modes.respawnPoint ? modes.respawnPoint(modes.localTeam) : null; } catch (e) { /* optional */ }
    if (!spawn || !Number.isFinite(spawn.x)) spawn = typeof findSpawn === 'function' ? findSpawn() : null;
    if (spawn) best = spawn;
  }
  if (!best) return false;
  p.set(best.x, best.y, best.z);
  player.vel.set(0, 0, 0);
  bmClearPlayerRepair('escaped');
  bmPlayerRepairMotionReset();
  if (typeof toast === 'function') toast('Moved you out of the blocks');
  BC.emit('playerRepaired', bmPlayerRepairState());
  return true;
}

function bmBeforePlayerRepair(dt, now, playing) {
  if (!bmPlayerRepairEligible()) { bmClearPlayerRepair(); return; }
  if (bmPlayerRepair.blocked && BC.now() - (bmPlayerRepair.blockedSince || 0) > BC_PHYS_ESCAPE_AFTER_MS && bmEscapePlayer()) return;
  if (bmPlayerRepair.blocked && bmReadPlayerRepairBox()) {
    const box = bmRepairSource;
    if (box.x !== bmPlayerRepair.fromX || box.y !== bmPlayerRepair.fromY ||
        box.z !== bmPlayerRepair.fromZ || box.h !== bmPlayerRepair.height) bmPlayerRepair.pending = true;
  }
  if (!bmPlayerRepair.pending || (playing === false && !bmPlayerRepair.blocked)) return;
  bmRepairPlayerOverlap();
}

/* ---------------- critter bodies ---------------- */
function bmBodyBox(c, out) {
  const def = c.kind === 'chicken' ? BC_PHYS_BODY.chicken : BC_PHYS_BODY.villager;
  out.x = c.x; out.y = c.y; out.z = c.z;
  out.w = Number.isFinite(c.halfW) ? c.halfW : def.w;
  out.h = Number.isFinite(c.height) ? c.height : def.h;
  out.ignoreDragonIndex = bmIgnoreDragonIndex(c);
  return out;
}

const bmCritterDynamicRepair = { bestScore: Infinity, x: 0, y: 0, z: 0, preferSupport: false };

function bmConsiderCritterDynamicRepair(source, x, y, z) {
  const search = bmCritterDynamicRepair;
  const dx = x - source.x, dy = y - source.y, dz = z - source.z;
  const distanceSq = dx * dx + dy * dy + dz * dz;
  if (!Number.isFinite(distanceSq) || distanceSq > BC_PHYS_REPAIR_DISTANCE * BC_PHYS_REPAIR_DISTANCE ||
      Math.abs(dy) > BC_PHYS_REPAIR_VERTICAL || x < source.w || x > WORLD - source.w ||
      z < source.w || z > WORLD - source.w || y < 0 || y + source.h > HEIGHT + 38) return;
  const minimumScore = distanceSq + Math.abs(dy) * 0.2;
  if (minimumScore >= search.bestScore) return;
  const probe = bmRepairProbe;
  probe.x = x; probe.y = y; probe.z = z; probe.w = source.w; probe.h = source.h;
  probe.ignoreDragonIndex = bmIgnoreDragonIndex(source);
  if (bmOverlaps(probe)) return;
  const supported = Number.isFinite(bmSupportAt(x, y, z, source.w, 0.05));
  const score = minimumScore + (search.preferSupport && !supported ? 0.25 : 0);
  if (score >= search.bestScore || !bmRepairPathClear(source, x, y, z, Math.sqrt(distanceSq))) return;
  search.bestScore = score; search.x = x; search.y = y; search.z = z;
}

function bmRepairCritterDragonOverlap(c, source) {
  const now = BC.now();
  if (Number.isFinite(c.bmDragonRepairRetryAt) && now < c.bmDragonRepairRetryAt) return false;
  const api = bmDragonApi(), search = bmCritterDynamicRepair;
  search.bestScore = Infinity;
  search.preferSupport = Number.isFinite(bmSupportAt(source.x, source.y, source.z, source.w, 0.05));
  if (bmDragonPenetrationBounds(source, api, bmDragonColliderCount(api), bmDragonPenetration)) {
    const bounds = bmDragonPenetration;
    bmRepairPlanesX[0] = source.x;
    bmRepairPlanesX[1] = bounds.minX - source.w - BC_PHYS_EPS;
    bmRepairPlanesX[2] = bounds.maxX + source.w + BC_PHYS_EPS;
    bmRepairPlanesY[0] = source.y;
    bmRepairPlanesY[1] = bounds.minY - source.h - BC_PHYS_EPS;
    bmRepairPlanesY[2] = bounds.maxY + BC_PHYS_EPS;
    bmRepairPlanesZ[0] = source.z;
    bmRepairPlanesZ[1] = bounds.minZ - source.w - BC_PHYS_EPS;
    bmRepairPlanesZ[2] = bounds.maxZ + source.w + BC_PHYS_EPS;
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) {
      bmConsiderCritterDynamicRepair(source, bmRepairPlanesX[x], bmRepairPlanesY[y], bmRepairPlanesZ[z]);
    }
  }
  for (let x = -3; x <= 3; x++) for (let y = -2; y <= 2; y++) for (let z = -3; z <= 3; z++) {
    bmConsiderCritterDynamicRepair(source, source.x + x * 0.5, source.y + y * 0.5, source.z + z * 0.5);
  }
  if (!Number.isFinite(search.bestScore)) {
    c.bmDragonRepairRetryAt = now + BC_PHYS_DYNAMIC_REPAIR_GAP;
    return false; // wait, never use the old cold voxel-spawn roof fallback for a moving body
  }
  c.x = search.x; c.y = search.y; c.z = search.z;
  c.vx = c.vy = c.vz = 0;
  c.onGround = Number.isFinite(bmSupportAt(c.x, c.y, c.z, source.w, 0.05));
  c.hitWall = true;
  c.bmDragonRepairRetryAt = 0;
  return true;
}

/**
 * Keep an NPC's initial body out of live voxels. Noise-height spawns can be
 * inside a later house/tree, and building can enclose an existing NPC. Repair
 * only an overlapping body; ordinary walking/falling never uses this search.
 * No random draws or skipped residents: village counts/performers stay intact.
 */
function bmPlaceCritter(c) {
  if (!c) return false;
  const box = bmBodyBox(c, bmSpawnBox);
  const ox = Number.isFinite(box.x) ? box.x : WORLD * 0.5;
  const oy = Number.isFinite(box.y) ? box.y : HEIGHT;
  const oz = Number.isFinite(box.z) ? box.z : WORLD * 0.5;
  box.x = Math.max(box.w, Math.min(WORLD - box.w, ox));
  box.y = Math.max(0, oy);
  box.z = Math.max(box.w, Math.min(WORLD - box.w, oz));
  if (!bmOverlapsVoxels(box)) {
    // Keep the completed voxel-spawn/house repair below intact. A dragon moving
    // into an NPC gets only a swept <=2m local escape, never a jump to a roof.
    if (bmOverlapsDragons(box)) return bmRepairCritterDragonOverlap(c, box);
    c.x = box.x; c.y = box.y; c.z = box.z;
    if (c.bmDragonRepairRetryAt) c.bmDragonRepairRetryAt = 0;
    return true;
  }

  const cx = Math.floor(box.x), cz = Math.floor(box.z);
  const fromY = box.y;
  const minY = Math.max(0, Math.floor(fromY) - 4);
  const maxY = Math.min(HEIGHT - 1, Math.floor(fromY) + 3);
  let best = Infinity, bx = box.x, by = box.y, bz = box.z;
  // Bounded local search, cold path only. Prefer a nearby yard/floor over
  // lifting a resident through several storeys onto a roof.
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx + 0.5, z = cz + dz + 0.5;
      if (x < box.w || x > WORLD - box.w || z < box.w || z > WORLD - box.w) continue;
      box.x = x; box.z = z;
      for (let y = minY; y <= maxY; y++) {
        if (!bmSolidAt(cx + dx, y, cz + dz)) continue;
        box.y = y + 1;
        const lift = box.y - fromY;
        const score = (x - ox) * (x - ox) + (z - oz) * (z - oz) + lift * lift * 2;
        if (score >= best || bmOverlaps(box)) continue;
        best = score; bx = box.x; by = box.y; bz = box.z;
      }
    }
  }
  if (!Number.isFinite(best)) {
    // Extremely obstructed spawn: the highest live face in this column is
    // still safe. Do not delete a villager or carve the user's construction.
    box.x = cx + 0.5; box.z = cz + 0.5;
    box.y = HEIGHT;
    for (let y = HEIGHT - 1; y >= 0; y--) {
      if (!bmSolidAt(cx, y, cz)) continue;
      box.y = y + 1;
      if (!bmOverlaps(box)) break;
      box.y = HEIGHT;
    }
    if (bmOverlaps(box)) return false;
    bx = box.x; by = box.y; bz = box.z;
  }
  c.x = bx; c.y = by; c.z = bz;
  c.vx = c.vy = c.vz = 0;
  c.onGround = Number.isFinite(bmSupportAt(bx, by, bz, box.w, 0.05));
  c.hitWall = true;
  return true;
}

/**
 * Axis-separated move with 1-voxel step-up and step-down snapping.
 * Mutates c.x/c.y/c.z, c.vy, c.onGround and flags c.hitWall when blocked.
 */
function bmMoveCritter(c, dx, dy, dz, dt) {
  if (!c) return;
  const box = bmBodyBox(c, bmMoveBox);
  if (!Number.isFinite(c.vy)) c.vy = 0;
  dx = Number.isFinite(dx) ? dx : 0;
  dy = Number.isFinite(dy) ? dy : 0;
  dz = Number.isFinite(dz) ? dz : 0;
  // Never trust last frame's floor after digging or destruction.
  const floor = bmSupportAt(box.x, box.y, box.z, box.w, 0.05);
  let grounded = dy <= 0 && c.vy <= 0 && Number.isFinite(floor);
  let canSnap = grounded;
  if (grounded) box.y = floor;

  if (dy !== 0) {
    const blockedY = bmAxisMove(box, 'y', dy);
    if (blockedY) {
      grounded = dy < 0;
      canSnap = grounded;
      c.vy = 0;
    } else {
      grounded = false;
    }
  }

  const stepLimit = box.y + BC_PHYS_STEP_UP;
  dx = Math.max(box.w, Math.min(WORLD - box.w, box.x + dx)) - box.x;
  dz = Math.max(box.w, Math.min(WORLD - box.w, box.z + dz)) - box.z;
  if (dx) {
    const start = box.x;
    const blockedX = bmAxisMove(box, 'x', dx);
    if (blockedX) {
      // Retry only the untravelled portion; replaying the whole move would
      // add extra speed each time an animal met a stair.
      if (grounded && Number.isFinite(bmSupportAt(box.x, box.y, box.z, box.w, 0.05)) &&
          bmTryStepUp(box, 'x', dx - (box.x - start), stepLimit)) {
        c.vy = 0;
        canSnap = true;
      } else {
        c.vx = 0;
        c.hitWall = true;
      }
    }
  }
  if (dz) {
    const start = box.z;
    const blockedZ = bmAxisMove(box, 'z', dz);
    if (blockedZ) {
      if (grounded && Number.isFinite(bmSupportAt(box.x, box.y, box.z, box.w, 0.05)) &&
          bmTryStepUp(box, 'z', dz - (box.z - start), stepLimit)) {
        c.vy = 0;
        canSnap = true;
      } else {
        c.vz = 0;
        c.hitWall = true;
      }
    }
  }

  /* Only a supported walker may step down. Falling bodies and swimmers must
     actually fall/float; otherwise a dug floor or shallow seabed becomes an
     invisible platform that repeatedly snaps the body to the bottom. */
  grounded = c.vy <= 0 && dy <= 0 && Number.isFinite(bmSupportAt(box.x, box.y, box.z, box.w, 0.05));
  if (!grounded && canSnap && dy <= 0 && c.vy <= 0) {
    const support = bmSupportAt(box.x, box.y, box.z, box.w, BC_PHYS_STEP_DOWN);
    if (Number.isFinite(support)) {
      const drop = box.y - support;
      if (drop >= 0 && drop <= BC_PHYS_STEP_DOWN) {
        bmAxisMove(box, 'y', -drop);
        grounded = true;
      }
    }
  }
  c.onGround = grounded;
  if (grounded && c.vy < 0) c.vy = 0;
  c.x = box.x; c.y = box.y; c.z = box.z;
}

/* ---------------- water helpers ---------------- */
let bmLastSplash = -1;
function bmSplashAt(x, y, z) {
  const now = BC.now();
  if (bmLastSplash >= 0 && now - bmLastSplash < BC_PHYS_SPLASH_GAP * 1000) return;
  bmLastSplash = now;
  BC.emit('sfx', { kind: 'splash', position: { x: x, y: y, z: z }, volume: 0.75 });
}

/* Player swim strokes are global: only one local player exists. */
const bmSwim = { cool: 0, wet: false };
const bmPlayerWaterExitProbe = { x: 0, y: 0, z: 0, w: 0.3, h: 1.86, ignoreDragonIndex: -1 };

function bmResetPlayerWater() {
  bmSwim.cool = 0;
  bmSwim.wet = false;
}

/**
 * A nearby 0/1-block bank with a fully swept standing-height route. This is a
 * read-only eligibility probe: 50 supplies a bounded impulse, never a snap.
 * Water below a solid floor is excluded by the same finite surface query.
 */
function bmPlayerWaterExitHeight(moveX, moveZ, surface) {
  if (typeof player === 'undefined' || !player || !player.pos || player.fly ||
      BC.flags.playerRepairBlocked || (BC.api.riding && BC.api.riding.active)) return -Infinity;
  const p = player.pos;
  const surf = Number.isFinite(surface) ? surface : bmWaterSurfaceAt(p.x, p.z, p.y + 0.15);
  const depth = surf - p.y;
  const length = Math.hypot(moveX, moveZ);
  if (!Number.isFinite(surf) || depth <= 0.02 || depth > BC_PHYS_PLAYER_EXIT_DEPTH ||
      !Number.isFinite(length) || length < 0.001 ||
      !bmLiquidAt(p.x, p.y + 0.15, p.z)) return -Infinity;
  const dx = moveX / length * BC_PHYS_PLAYER_EXIT_REACH;
  const dz = moveZ / length * BC_PHYS_PLAYER_EXIT_REACH;
  const probe = bmPlayerWaterExitProbe;
  probe.x = p.x; probe.y = p.y; probe.z = p.z;
  probe.w = typeof PW === 'number' ? PW : 0.3;
  probe.h = (typeof PH === 'number' ? PH : 1.8) +
    (typeof PLAYER_JUMP_CLEARANCE === 'number' ? PLAYER_JUMP_CLEARANCE : 0.06);
  probe.ignoreDragonIndex = typeof playerIgnoredDragonIndex === 'function' ? playerIgnoredDragonIndex() : -1;
  if (bmOverlaps(probe)) return -Infinity;
  const blockedX = bmAxisMove(probe, 'x', dx);
  const blockedZ = bmAxisMove(probe, 'z', dz);
  if (!blockedX && !blockedZ) return -Infinity;

  // Voxel water surfaces are integer faces. Check the one-block bank first,
  // then a shore flush with the surface; neither a taller wall nor a dragon
  // body alone qualifies as a shoreline/support surface.
  for (let level = 1; level >= 0; level--) {
    const top = bmSupportAt(p.x + dx, surf + level + 0.02, p.z + dz, probe.w, 0.05);
    if (!Number.isFinite(top) || top < surf - BC_PHYS_EPS || top > surf + BC_PHYS_PLAYER_EXIT_HEIGHT) continue;
    const lift = top + 0.02 - p.y;
    if (lift <= 0 || lift > BC_PHYS_PLAYER_EXIT_DEPTH + BC_PHYS_PLAYER_EXIT_HEIGHT + 0.02) continue;
    probe.x = p.x; probe.y = p.y; probe.z = p.z;
    if (bmAxisMove(probe, 'y', lift) || bmOverlaps(probe)) continue;
    if (bmAxisMove(probe, 'x', dx) || bmAxisMove(probe, 'z', dz) || bmOverlaps(probe)) continue;
    if (!Number.isFinite(bmSupportAt(probe.x, probe.y, probe.z, probe.w, 0.05))) continue;
    return top;
  }
  return -Infinity;
}

/**
 * Buoyancy, drag and swim strokes for the local player. Returns the vertical
 * displacement for this sub-step and writes the resulting velocity back into
 * player.vel.y. Called from 50-player.js while the body is in water.
 */
function bmResolvePlayerWater(dt, inputUp, inputDown) {
  if (typeof player === 'undefined' || !player || !player.pos || !player.vel) return 0;
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  const p = player.pos, v = player.vel;
  const height = typeof playerBodyHeight === 'function' ? playerBodyHeight() : 1.8;
  let surf = bmWaterSurfaceAt(p.x, p.z, p.y + 0.15);
  if (!Number.isFinite(surf)) surf = bmWaterSurfaceAt(p.x, p.z, p.y + height - 0.15);
  if (!Number.isFinite(surf)) {
    bmResetPlayerWater();
    v.y = Math.max(v.y - BC_PHYS_GRAVITY * dt, -BC_PHYS_TERMINAL);
    return v.y * dt;
  }
  const depth = surf - p.y;
  if (depth <= 0.02) {
    bmSwim.wet = false;
    v.y = Math.max(v.y - BC_PHYS_GRAVITY * 0.45 * dt, -BC_PHYS_TERMINAL);
    return v.y * dt;
  }

  bmSwim.wet = true;
  bmSwim.cool = Math.max(0, bmSwim.cool - dt);
  inputUp = !!inputUp;
  inputDown = !!inputDown && !inputUp;

  /* Wading only applies with a floor under the boots. Floating just under the
     surface of deep water must stay buoyant even when the water there is
     shallower than the wade threshold, otherwise the body sinks until the
     threshold and bobs on a hard edge instead of settling at the target. */
  if (depth < BC_PHYS_WADE_DEPTH && player.onGround && !inputUp) {
    /* Shallow water: keep boots on the floor, just heavy and slow. */
    v.y = Math.max(v.y - BC_PHYS_GRAVITY * 0.55 * dt, -BC_PHYS_TERMINAL);
    v.y *= Math.exp(-BC_PHYS_WATER_DRAG * 0.5 * dt);
    return v.y * dt;
  }

  const sub = Math.min(1, depth / 1.5);
  const rest = surf - 0.45;
  const buoy = Math.max(-12, Math.min(26, (rest - p.y) * BC_PHYS_BUOYANCY * sub));
  // C must actually dive, not settle at the depth where buoyancy cancels the
  // old downward force. Releasing it restores the usual head-above-water rest.
  v.y += ((inputDown ? -9 : buoy) - v.y * BC_PHYS_WATER_DRAG) * dt;

  if (inputUp && bmSwim.cool <= 0) {
    v.y += BC_PHYS_SWIM_STROKE;
    bmSwim.cool = BC_PHYS_SWIM_COOLDOWN;
  }
  if (v.y > BC_PHYS_SWIM_UP) v.y = BC_PHYS_SWIM_UP;
  if (v.y < -3.6) v.y = -3.6;
  return v.y * dt;
}

/* ---------------- critter step ---------------- */
/**
 * Integrate one critter frame: buoyancy in water, gravity on land, then a
 * swept move. Callers set c.vx / c.vz from their AI before calling.
 */
function bmStepCritter(c, dt) {
  if (!c) return;
  dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
  if (dt <= 0) return;
  if (!bmPlaceCritter(c)) {
    c.vx = c.vy = c.vz = 0;
    c.onGround = false;
    c.hitWall = true;
    return;
  }

  const chicken = c.kind === 'chicken';
  const height = Number.isFinite(c.height) ? c.height : (chicken ? 0.55 : 1.7);
  if (!Number.isFinite(c.vy)) c.vy = 0;
  const half = Number.isFinite(c.halfW) ? c.halfW : (chicken ? 0.22 : 0.28);
  const floor = bmSupportAt(c.x, c.y, c.z, half, 0.05);
  c.onGround = c.vy <= 0 && Number.isFinite(floor);
  if (c.onGround) { c.y = floor; c.vy = 0; }
  const surf = bmWaterSurfaceAt(c.x, c.z, c.y + 0.08);
  const feetWet = Number.isFinite(surf) && c.y + 0.08 < surf;
  const bodyWet = Number.isFinite(surf) && c.y + height * 0.55 < surf;
  const inWater = feetWet || bodyWet;
  if (inWater && !c.inWater) bmSplashAt(c.x, c.y + 0.12, c.z);
  c.inWater = inWater;

  if (inWater) {
    const depth = Number.isFinite(surf) ? surf - c.y : 0;
    if (chicken) {
      /* Chickens bob with their back above the surface. */
      const target = surf - 0.18;
      const vyTarget = Math.max(-2.4, Math.min(2.4, (target - c.y) * 3.0));
      c.vy += (vyTarget - c.vy) * (1 - Math.exp(-5 * dt));
    } else if (depth > 1.25 || !c.onGround) {
      /* Deep water: villagers paddle just enough to keep their head out. */
      const target = surf - Math.min(1.2, height * 0.72);
      const vyTarget = Math.max(-2.0, Math.min(2.0, (target - c.y) * 2.3));
      c.vy += (vyTarget - c.vy) * (1 - Math.exp(-4 * dt));
    } else {
      /* Wading: still grounded, just dragged down. */
      c.vy -= BC_PHYS_GRAVITY * 0.42 * dt;
      c.vy *= Math.exp(-3.2 * dt);
    }
  } else {
    c.vy -= BC_PHYS_GRAVITY * dt;
  }
  if (c.vy < -BC_PHYS_TERMINAL) c.vy = -BC_PHYS_TERMINAL;
  if (c.vy > 8) c.vy = 8;

  const drag = inWater ? BC_PHYS_WATER_DRAG_H : 1;
  const vx = (Number.isFinite(c.vx) ? c.vx : 0) * drag;
  const vz = (Number.isFinite(c.vz) ? c.vz : 0) * drag;
  bmMoveCritter(c, vx * dt, c.vy * dt, vz * dt, dt);

  if (c.onGround && c.vy < 0) c.vy = 0;
}

/* ---------------- jetpack bridge ---------------- */
function bmUpdateJetpack(dt) {
  const jet = BC.api && BC.api.jetpack;
  // update() is a compatibility driver only until preFrame takes ownership.
  // Neither player substeps nor this bridge may advance hooked fuel twice.
  if (jet && typeof jet.update === 'function') jet.update(dt);
}

/* ---------------- public API ---------------- */
BC.api.physics = {
  solidAt: bmSolidAt,
  liquidAt: bmLiquidAt,
  waterDepthAt: bmWaterDepthAt,
  waterSurfaceAt: bmWaterSurfaceAt,
  isInWaterAt: bmIsInWaterAt,
  supportAt: bmSupportAt,
  sweepVoxels: bmSweepVoxels,
  overlapsVoxels: bmOverlapsVoxels,
  sweepAabb: bmSweepAabb,
  moveAxis: bmAxisMove,
  overlaps: bmOverlaps,
  repairPlayerOverlap: bmRepairPlayerOverlap,
  queuePlayerRepair: bmQueuePlayerRepair,
  playerRepairState: bmPlayerRepairState,
  maxPlayerRepairDistance: BC_PHYS_REPAIR_DISTANCE,
  maxPlayerRepairVertical: BC_PHYS_REPAIR_VERTICAL,
  moveCritter: bmMoveCritter,
  stepCritter: bmStepCritter,
  placeCritter: bmPlaceCritter,
  updateJetpack: bmUpdateJetpack,
  resolvePlayerWater: bmResolvePlayerWater,
  resetPlayerWater: bmResetPlayerWater,
  playerWaterExitHeight: bmPlayerWaterExitHeight,
  playerBodyHeight: function () {
    return typeof playerBodyHeight === 'function' ? playerBodyHeight() : 1.8;
  },
  bodyFor: function (kind) {
    return kind === 'chicken' ? BC_PHYS_BODY.chicken : BC_PHYS_BODY.villager;
  },
  gravity: BC_PHYS_GRAVITY,
  terminal: BC_PHYS_TERMINAL,
  step: BC_PHYS_STEP
};

BC.flags.physicsReady = true;
BC.flags.playerRepairBlocked = false;
BC.on('voxelChanged', bmOnPlayerVoxelChanged, -30);
BC.on('dragonCollidersChanged', bmOnDragonCollidersChanged, -30);
BC.on('preFrame', bmBeforePlayerRepair, -15);
BC.on('worldWillReset', () => bmClearPlayerRepair(), -90);
BC.on('worldReset', () => bmClearPlayerRepair(), -90);
BC.on('worldReady', () => bmClearPlayerRepair(), -90);
BC.on('death', () => bmClearPlayerRepair(), -90);
BC.on('respawn', () => bmClearPlayerRepair(), -90);
BC.on('worldBusyChanged', (busy) => {
  if (busy) bmClearPlayerRepair();
  else bmQueuePlayerRepair(); // one cheap body check after the world becomes readable
}, -90);
