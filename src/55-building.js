/* Blockcraft Battle Ground — Combat blueprints, transactional voxel construction and held building.
   55-building.js
   Classic script: combat, inventory, input and network references are deliberately deferred. */
'use strict';

const BUILD_PIECES = {
  wall: { label: 'WALL', size: '3×3', blocks: 9 },
  ramp: { label: 'RAMP', size: '3 STEPS', blocks: 18 },
  floor: { label: 'FLOOR', size: '3×3', blocks: 9 }
};
const BUILD_DIRECTIONS = [
  { x: 0, z: -1, label: 'N' }, { x: -1, z: 0, label: 'W' },
  { x: 0, z: 1, label: 'S' }, { x: 1, z: 0, label: 'E' }
];
const BUILD_REPEAT_MS = 180;
const quickBuild = {
  active: false, kind: 'wall', rotation: 0, material: PLANKS,
  anchor: null, plan: null, preview: null,
  valid: false, reason: '', cost: 0, available: 0,
  lastResult: null, lastPlacement: null
};
const buildingHeld = {
  left: false, right: false, nextActionAt: 0, anchors: new Set()
};
let buildingPreviewData = null;
let buildingHud = null;

function buildCellKey(c) { return c.x + ',' + c.y + ',' + c.z; }
function buildQuarterTurn(n) { return ((Math.round(n) % 4) + 4) % 4; }
function buildFacing() { return buildQuarterTurn(player.yaw / (Math.PI / 2) + quickBuild.rotation); }

function buildingEye() {
  const drop = typeof playerMotion !== 'undefined' && Number.isFinite(playerMotion.eyeDrop)
    ? playerMotion.eyeDrop : (player.crouching ? 0.14 : 0) + (player.sliding ? 0.12 : 0);
  const height = Number.isFinite(player.eyeHeight) ? player.eyeHeight : 1.62 - drop;
  return { x: player.pos.x, y: player.pos.y + height, z: player.pos.z };
}

function buildingGameplayReady() {
  const world = BC.api && BC.api.world;
  const riding = BC.api && BC.api.riding;
  const killcam = BC.api && BC.api.killcam;
  if ((BC.flags && (BC.flags.worldBusy || BC.flags.playerRepairBlocked)) || (world && world.busy) ||
      (riding && riding.active) || (killcam && killcam.active)) return false;
  if (typeof isGameplayInputActive === 'function') return isGameplayInputActive();
  return typeof loading !== 'undefined' && !loading && typeof alive !== 'undefined' && alive &&
    typeof craftOpen !== 'undefined' && !craftOpen && !document.hidden &&
    document.pointerLockElement === renderer.domElement;
}

function stopBuildingGun() {
  if (typeof gun !== 'undefined') { gun.trigger = false; gun.aiming = false; }
}

function clearBuildingHeld() {
  buildingHeld.left = false;
  buildingHeld.right = false;
  buildingHeld.anchors.clear();
  stopBuildingGun();
}

function hideBuildingPreview() {
  if (quickBuild.preview) quickBuild.preview.visible = false;
  if (buildingHud) buildingHud.root.classList.remove('show', 'ready', 'blocked', 'complete');
  document.body.classList.remove('quick-build');
}

function cancelQuickBuild() {
  quickBuild.active = false;
  quickBuild.plan = null;
  quickBuild.anchor = null;
  quickBuild.lastPlacement = null;
  quickBuild.lastResult = null;
  quickBuild.valid = false;
  quickBuild.reason = '';
  quickBuild.cost = quickBuild.available = 0;
  clearBuildingHeld();
  hideBuildingPreview();
}

function resetBuildingInput(cancelMode = true) {
  if (cancelMode) cancelQuickBuild();
  else { clearBuildingHeld(); hideBuildingPreview(); }
}

function resetBuildingWorldState() {
  cancelQuickBuild();
  buildingHeld.nextActionAt = 0;
  if (buildingPreviewData) buildingPreviewData.layoutKey = '';
}

function selectBuildPiece(kind) {
  if (!Object.prototype.hasOwnProperty.call(BUILD_PIECES, kind)) return false;
  if (quickBuild.active && quickBuild.kind === kind) { cancelQuickBuild(); return false; }
  if (!buildingGameplayReady()) return false;
  clearBuildingHeld();
  if (!combatMode) setCombatMode(true);
  if (!quickBuild.active) {
    quickBuild.rotation = 0;
    const slot = HOTBAR.indexOf(quickBuild.material);
    if (slot >= 0) selectSlot(slot);
    else quickBuild.material = HOTBAR[selected];
  }
  quickBuild.kind = kind;
  quickBuild.active = true;
  quickBuild.lastPlacement = null;
  quickBuild.lastResult = null;
  refreshBuildingPreview();
  return true;
}

function rotateBuildPiece() {
  if (!quickBuild.active || !buildingGameplayReady()) return false;
  clearBuildingHeld();
  quickBuild.rotation = buildQuarterTurn(quickBuild.rotation + 1);
  quickBuild.lastPlacement = null;
  refreshBuildingPreview();
  return true;
}

function setQuickBuildMaterial(type) {
  if (!quickBuild.active || !isBuildMaterial(type)) return false;
  clearBuildingHeld();
  quickBuild.material = type;
  refreshBuildingPreview();
  return true;
}

/* Anchor = centre of the near row. Solid stairs have 1, 2, then 3 blocks of rise.
   Every template is face-connected; neither decorative meshes nor invisible collision planes. */
function buildPieceCells(kind, anchor, rotation) {
  if (!Object.prototype.hasOwnProperty.call(BUILD_PIECES, kind) || !anchor ||
      ![anchor.x, anchor.y, anchor.z, rotation].every(Number.isInteger)) return [];
  const f = BUILD_DIRECTIONS[buildQuarterTurn(rotation)];
  const rx = -f.z, rz = f.x;
  const cells = [];
  for (let w = -1; w <= 1; w++) {
    const depth = kind === 'wall' ? 1 : 3;
    for (let d = 0; d < depth; d++) {
      const height = kind === 'wall' ? 3 : kind === 'ramp' ? d + 1 : 1;
      for (let h = 0; h < height; h++) {
        cells.push({ x: anchor.x + rx * w + f.x * d, y: anchor.y + h,
          z: anchor.z + rz * w + f.z * d });
      }
    }
  }
  return cells;
}

function buildInBounds(x, y, z) {
  return x >= 0 && z >= 0 && x < WORLD && z < WORLD && y >= 0 && y < HEIGHT;
}

function buildSolid(x, y, z) {
  if (!buildInBounds(x, y, z)) return false;
  const b = getBlock(x, y, z);
  return b !== AIR && b !== WATER;
}

function buildIntersectsBody(c, p, height = PH) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return false;
  const epsilon = typeof PLAYER_EPS === 'number' ? PLAYER_EPS : 0.00001;
  return c.x + 1 > p.x - PW + epsilon && c.x < p.x + PW - epsilon &&
    c.y + 1 > p.y + epsilon && c.y < p.y + height - epsilon &&
    c.z + 1 > p.z - PW + epsilon && c.z < p.z + PW - epsilon;
}

const buildingRemoteCell = { x: 0, y: 0, z: 0 };
const buildingRemoteTarget = { x: 0, y: 0, z: 0 };
const buildingDragonCellBox = { x: 0, y: 0, z: 0, w: 0.5, h: 1, ignoreDragonIndex: -1 };
const buildingDragonRayDir = { x: 0, y: 0, z: 0 };

// Shared with 50's traditional canPlace gate. Query the single collider owner
// lazily; guardians and mounts are equally solid, with NO rider exemption here.
function buildVoxelHitsSolidDragon(x, y, z) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || !buildInBounds(x, y, z)) return false;
  const api = BC.api && BC.api.dragons;
  if (!api || typeof api.overlapsAabb !== 'function') return false;
  const box = buildingDragonCellBox;
  box.x = x + 0.5; box.y = y; box.z = z + 0.5;
  return !!api.overlapsAabb(box, -1);
}

function buildLineHitsSolidDragon(origin, target) {
  const api = BC.api && BC.api.dragons;
  if (!api || typeof api.raycast !== 'function') return false;
  const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z;
  const distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance) || distance <= 0.00001) return false;
  const dir = buildingDragonRayDir;
  dir.x = dx / distance; dir.y = dy / distance; dir.z = dz / distance;
  const hit = api.raycast(origin, dir, Math.max(0, distance - 0.00001), -1);
  return !!(hit && (!Number.isFinite(hit.distance) || hit.distance <= distance - 0.00001));
}

function buildRemoteBodyHeight(r) {
  const data = r.group && r.group.userData;
  let height = Number.isFinite(r.bodyHeight) && r.bodyHeight > 0 ? r.bodyHeight : r.height;
  if ((!Number.isFinite(height) || height <= 0) && data) {
    height = Number.isFinite(data.colliderHeight) && data.colliderHeight > 0 ? data.colliderHeight : data.bodyHeight;
  }
  if (!Number.isFinite(height) || height <= 0) {
    height = r.crouch || r.crouching || r.slide || r.sliding || r.dash || r.dashing ? 1.2 : PH;
  }
  return Math.max(1.1, Math.min(1.9, height));
}

// Public single-cell guard. The traditional placement owner calls this BEFORE
// debiting inventory/writing voxels; blueprints use the exact same body rule.
function buildVoxelHitsLivingRemote(x, y, z, now = performance.now()) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || !buildInBounds(x, y, z) ||
      typeof net === 'undefined' || !net || !net.players) return false;
  const c = buildingRemoteCell;
  c.x = x; c.y = y; c.z = z;
  const self = net.id;
  const hasSelf = self != null && self !== '';
  for (const id of net.players.keys()) {
    if (hasSelf && id === self) continue;
    const r = net.players.get(id);
    if (!r || (hasSelf && r.id === self) || !Number.isFinite(r.hp) || r.hp <= 0 || r.dead === true || r.dead === 1 ||
        r.alive === false || r.alive === 0 || r.deathNoted === true || r.deadUntil > now) continue;
    const height = buildRemoteBodyHeight(r);
    const drawn = r.group && r.group.position ? r.group.position : r;
    if (buildIntersectsBody(c, drawn, height)) return true;
    const received = Number.isFinite(r.tx) && Number.isFinite(r.ty) && Number.isFinite(r.tz);
    buildingRemoteTarget.x = received ? r.tx : r.x;
    buildingRemoteTarget.y = received ? r.ty : r.y;
    buildingRemoteTarget.z = received ? r.tz : r.z;
    if (buildIntersectsBody(c, buildingRemoteTarget, height)) return true;
  }
  return false;
}

function buildOverlapsRemote(c, now) {
  return buildVoxelHitsLivingRemote(c.x, c.y, c.z, now);
}

/* Exact voxel traversal from the player's eye. Only matching blocks IN this template
   can be reused through; an unrelated wall still blocks construction behind it. */
function buildingLineClear(eye, target, reusable) {
  if (buildLineHitsSolidDragon(eye, target)) return false;
  const dx = target.x - eye.x, dy = target.y - eye.y, dz = target.z - eye.z;
  let x = Math.floor(eye.x), y = Math.floor(eye.y), z = Math.floor(eye.z);
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const ax = dx === 0 ? Infinity : Math.abs(1 / dx);
  const ay = dy === 0 ? Infinity : Math.abs(1 / dy);
  const az = dz === 0 ? Infinity : Math.abs(1 / dz);
  let tx = sx === 0 ? Infinity : (sx > 0 ? x + 1 - eye.x : eye.x - x) * ax;
  let ty = sy === 0 ? Infinity : (sy > 0 ? y + 1 - eye.y : eye.y - y) * ay;
  let tz = sz === 0 ? Infinity : (sz > 0 ? z + 1 - eye.z : eye.z - z) * az;
  for (let i = 0; i < 128; i++) {
    if (buildSolid(x, y, z) && !reusable.has(x + ',' + y + ',' + z)) return false;
    const t = Math.min(tx, ty, tz);
    if (t >= 1 - 1e-8) return true;
    // Advance tied axes together: merely grazing a block edge is not an obstruction.
    if (tx <= t + 1e-10) { x += sx; tx += ax; }
    if (ty <= t + 1e-10) { y += sy; ty += ay; }
    if (tz <= t + 1e-10) { z += sz; tz += az; }
  }
  return false;
}

function buildingCellVisible(eye, c, reusable) {
  const centre = { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 };
  if (buildingLineClear(eye, centre, reusable)) return true;
  // A bridge's top can be visible even when the ledge hides the voxel centre.
  // Test only faces looking toward the eye; unrelated cover must still occlude every ray.
  for (const axis of ['x', 'y', 'z']) {
    if (eye[axis] > c[axis] && eye[axis] < c[axis] + 1) continue;
    const face = { ...centre };
    face[axis] = c[axis] + (eye[axis] <= c[axis] ? 0.002 : 0.998);
    if (buildingLineClear(eye, face, reusable)) return true;
  }
  return false;
}

/* No mutations. This is also useful to the console/VM tests and integration tooling. */
function preflightBuildPiece(kind, anchor, rotation, material) {
  const cells = buildPieceCells(kind, anchor, rotation);
  const available = buildItemCount(material);
  const plan = { ok: false, code: 'invalid', reason: 'Choose a blueprint', kind, anchor,
    rotation, material, cells, changes: [], cost: cells.length, available, reused: 0, placed: 0 };
  const fail = (code, reason) => { plan.code = code; plan.reason = reason; return plan; };
  if (!cells.length || !isBuildMaterial(material)) return fail('invalid', 'Choose a solid block material');

  const reusable = new Set();
  let boundary = false, occupied = false;
  for (const c of cells) {
    if (!buildInBounds(c.x, c.y, c.z) || c.y < 1) { boundary = true; continue; }
    const before = getBlock(c.x, c.y, c.z);
    if (before === material) { reusable.add(buildCellKey(c)); plan.reused++; }
    else if (before === AIR || before === WATER) plan.changes.push({ x: c.x, y: c.y, z: c.z, before });
    else occupied = true;
  }
  plan.cost = cells.length - plan.reused;
  if (boundary) return fail('bounds', 'Outside world bounds');
  if (occupied) return fail('occupied', 'Terrain or another block is in the way');
  // The geometric cost counts only new voxels, including when materials are unlimited.
  plan.cost = plan.changes.length;
  if (!plan.cost) return fail('complete', 'Already built — move or aim to extend');

  const now = performance.now();
  const eye = buildingEye();
  const bodyHeight = typeof playerBodyHeight === 'function' ? playerBodyHeight() : PH;
  for (const c of plan.changes) {
    if (buildIntersectsBody(c, player.pos, bodyHeight)) return fail('self', 'Step back — you are inside the blueprint');
    if (buildOverlapsRemote(c, now)) return fail('player', 'Another player is in the way');
    if (buildVoxelHitsSolidDragon(c.x, c.y, c.z)) return fail('dragon', 'A solid dragon is in the way');
  }
  for (const c of cells) {
    if (Math.hypot(c.x + 0.5 - eye.x, c.y + 0.5 - eye.y, c.z + 0.5 - eye.z) > REACH + 1e-6) {
      return fail('reach', 'Too far — move closer');
    }
  }
  for (const c of plan.changes) {
    if (!buildingCellVisible(eye, c, reusable)) {
      return fail('occluded', 'View blocked — build on the visible side');
    }
  }

  // Air building is intentional; attachment to terrain is not a placement requirement.
  if (available < plan.cost) return fail('materials', 'Not enough ' + blockName(material) + ' — choose a material');
  plan.ok = true;
  plan.code = 'ready';
  plan.reason = 'Hold LMB to build';
  return plan;
}

/* Include face seams AND diagonal AO neighbours, then rebuild each chunk only once. */
function collectBuildChunks(changes) {
  const touched = new Set();
  for (const c of changes) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = Math.floor((c.x + dx) / CHUNK), cz = Math.floor((c.z + dz) / CHUNK);
        if (cx >= 0 && cz >= 0 && cx < CHUNKS && cz < CHUNKS) touched.add(cx + ',' + cz);
      }
    }
  }
  return touched;
}

function commitBuildPiece(kind, anchor, rotation, material) {
  // Revalidate at the moment of commitment, including fresh remote positions and inventory.
  const plan = preflightBuildPiece(kind, anchor, rotation, material);
  if (!plan.ok) return plan;
  if (!takeBuildItems(material, plan.cost)) {
    return Object.assign(plan, { ok: false, code: 'materials', reason: 'Materials changed — try again' });
  }
  try {
    for (const c of plan.changes) setBlock(c.x, c.y, c.z, material);
  } catch (error) {
    for (const c of plan.changes) setBlock(c.x, c.y, c.z, c.before);
    if (!UNLIMITED_BUILDING) addItem(material, plan.cost);
    return Object.assign(plan, { ok: false, code: 'write', reason: UNLIMITED_BUILDING
      ? 'Could not place — try again' : 'Could not place — materials returned' });
  }
  for (const key of collectBuildChunks(plan.changes)) {
    const [cx, cz] = key.split(',').map(Number);
    rebuildChunk(cx, cz);
  }
  // Existing edit transport persists every changed voxel for LAN, MQTT and late joins.
  if (typeof window.__netEdit === 'function') {
    for (const c of plan.changes) window.__netEdit(c.x, c.y, c.z, material);
  }
  return Object.assign(plan, { placed: plan.cost, code: 'placed', reason: 'Built ' + plan.cost + ' blocks' });
}

function buildAimDelta(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }

function findBuildAnchor() {
  const rotation = buildFacing();
  const last = quickBuild.lastPlacement;
  if (last && last.kind === quickBuild.kind && last.rotation === rotation &&
      Math.abs(buildAimDelta(player.yaw, last.yaw)) < 0.09 && Math.abs(player.pitch - last.pitch) < 0.09) {
    const dx = player.pos.x - last.pos.x, dz = player.pos.z - last.pos.z;
    const f = BUILD_DIRECTIONS[rotation];
    const forward = dx * f.x + dz * f.z, sideways = dx * -f.z + dz * f.x;
    if (quickBuild.kind === 'ramp' && forward >= 1.35 && Math.abs(sideways) < 0.85 &&
        Math.abs(player.pos.y - last.pos.y) < 3.2) {
      // Share the previous top step. This keeps chained ramps face-connected and one-block walkable.
      return { anchor: { x: last.anchor.x + f.x * 2, y: last.anchor.y + 2,
        z: last.anchor.z + f.z * 2 }, rotation };
    }
    const distance = quickBuild.kind === 'ramp' ? 1.35 : 0.7;
    if (Math.hypot(dx, dz) < distance && Math.abs(player.pos.y - last.pos.y) < 0.7) {
      // A newly placed wall must not become a new ray target and silently stack while held.
      return { anchor: { ...last.anchor }, rotation };
    }
  }

  // Follow the visible crosshair, including the shoulder offset. The default ray
  // starts at the player-eye plane; preflight separately checks the actual eye's reach/LOS.
  const hit = raycastVoxel(REACH);
  let anchor;
  if (hit) {
    anchor = { x: hit.x + hit.nx, y: hit.y + hit.ny, z: hit.z + hit.nz };
    if (hit.ny === 0 && quickBuild.kind !== 'floor') {
      anchor.y = Math.max(Math.floor(player.pos.y + 0.05), hit.y - 1);
    }
  } else {
    const distance = quickBuild.kind === 'wall' ? 2.7 : 1.9;
    anchor = {
      x: Math.floor(player.pos.x - Math.sin(player.yaw) * distance),
      y: Math.floor(player.pos.y + 0.05) - (quickBuild.kind === 'floor' ? 1 : 0),
      z: Math.floor(player.pos.z - Math.cos(player.yaw) * distance)
    };
    if (quickBuild.kind !== 'floor') {
      // Seat cover on nearby uneven ground; never carve or reach down into distant terrain.
      const low = anchor.y - 2, high = anchor.y;
      let ground = -Infinity;
      for (const c of buildPieceCells('floor', anchor, rotation)) {
        if (quickBuild.kind === 'wall') {
          const f = BUILD_DIRECTIONS[rotation];
          if ((c.x - anchor.x) * f.x + (c.z - anchor.z) * f.z !== 0) continue;
        }
        for (let y = high; y >= low; y--) {
          if (buildSolid(c.x, y, c.z)) { ground = Math.max(ground, y + 1); break; }
        }
      }
      if (Number.isFinite(ground)) anchor.y = ground;
    }
  }
  return { anchor, rotation };
}

function buildAnchorKey(plan) {
  return plan.kind + ':' + plan.rotation + ':' + buildCellKey(plan.anchor);
}

function setBuildingPlan(plan) {
  quickBuild.plan = plan;
  quickBuild.anchor = plan.anchor;
  quickBuild.valid = plan.ok;
  quickBuild.reason = plan.reason;
  quickBuild.cost = plan.cost;
  quickBuild.available = plan.available;
}

function placeQuickBuild() {
  if (!quickBuild.active || !buildingGameplayReady()) {
    return { ok: false, code: 'inactive', reason: 'Select a blueprint during play', placed: 0 };
  }
  const now = performance.now();
  if (now < buildingHeld.nextActionAt) return { ok: false, code: 'cooldown', reason: 'Building cooldown', placed: 0 };
  buildingHeld.nextActionAt = now + BUILD_REPEAT_MS;
  const target = findBuildAnchor();
  const key = buildAnchorKey({ kind: quickBuild.kind, rotation: target.rotation, anchor: target.anchor });
  if (buildingHeld.left && buildingHeld.anchors.has(key)) {
    return { ok: false, code: 'held-repeat', reason: 'Move or aim to extend', placed: 0 };
  }
  const result = commitBuildPiece(quickBuild.kind, target.anchor, target.rotation, quickBuild.material);
  quickBuild.lastResult = result;
  if (result.ok) {
    buildingHeld.anchors.add(key);
    quickBuild.lastPlacement = { kind: quickBuild.kind, rotation: target.rotation, anchor: { ...target.anchor },
      pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z }, yaw: player.yaw, pitch: player.pitch };
  }
  refreshBuildingPreview();
  return result;
}

function runHeldBuilding() {
  if (!buildingGameplayReady() || performance.now() < buildingHeld.nextActionAt) return false;
  if (quickBuild.active) return buildingHeld.left ? placeQuickBuild() : false;
  if (combatMode || (!buildingHeld.left && !buildingHeld.right)) return false;
  buildingHeld.nextActionAt = performance.now() + BUILD_REPEAT_MS;
  // Preserve the original single-block APIs, drops, inventory rules and edit transport.
  if (buildingHeld.left) breakBlock();
  else placeBlock();
  return true;
}

function setBuildingHeld(button, held) {
  if (button !== 0 && button !== 2) return false;
  const key = button === 0 ? 'left' : 'right';
  if (!held) { buildingHeld[key] = false; return true; }
  if (!buildingGameplayReady()) return false;
  if (quickBuild.active && button === 2) { cancelQuickBuild(); return true; }
  if (combatMode && !quickBuild.active) return false;
  if (buildingHeld[key]) return false;
  buildingHeld[key] = true;
  if (button === 0) buildingHeld.anchors.clear();
  stopBuildingGun();
  return runHeldBuilding();
}

function createBuildingPreview() {
  if (buildingPreviewData) return buildingPreviewData;
  const group = new THREE.Group();
  group.name = 'combat-building-blueprint';
  const geometry = new THREE.BoxGeometry(0.985, 0.985, 0.985);
  const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x62efd2, transparent: true,
    opacity: 0.19, depthWrite: false, toneMapped: false });
  const fill = new THREE.InstancedMesh(geometry, fillMaterial, 18);
  fill.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fill.frustumCulled = false;
  fill.renderOrder = 8;
  const edges = new THREE.EdgesGeometry(geometry);
  const edgePoints = edges.getAttribute('position').array.slice();
  edges.dispose();
  const lineGeometry = new THREE.BufferGeometry();
  const linePositions = new THREE.Float32BufferAttribute(new Float32Array(edgePoints.length * 18), 3);
  linePositions.setUsage(THREE.DynamicDrawUsage);
  lineGeometry.setAttribute('position', linePositions);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x62efd2, transparent: true,
    opacity: 0.9, depthTest: false, depthWrite: false, toneMapped: false });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.frustumCulled = false;
  lines.renderOrder = 9;
  group.add(fill, lines);
  scene.add(group);
  group.visible = false;
  quickBuild.preview = group;
  buildingPreviewData = { group, fill, lines, fillMaterial, lineMaterial, linePositions,
    edgePoints, matrix: new THREE.Matrix4(), layoutKey: '' };
  return buildingPreviewData;
}

function drawBuildingPreview(plan) {
  const p = createBuildingPreview();
  const key = buildAnchorKey(plan);
  if (p.layoutKey !== key) {
    p.layoutKey = key;
    p.fill.count = plan.cells.length;
    for (let i = 0; i < plan.cells.length; i++) {
      const c = plan.cells[i];
      p.fill.setMatrixAt(i, p.matrix.makeTranslation(c.x + 0.5, c.y + 0.5, c.z + 0.5));
      for (let j = 0; j < p.edgePoints.length; j += 3) {
        const index = i * p.edgePoints.length + j;
        p.linePositions.array[index] = p.edgePoints[j] + c.x + 0.5;
        p.linePositions.array[index + 1] = p.edgePoints[j + 1] + c.y + 0.5;
        p.linePositions.array[index + 2] = p.edgePoints[j + 2] + c.z + 0.5;
      }
    }
    p.fill.instanceMatrix.needsUpdate = true;
    p.linePositions.needsUpdate = true;
    p.lines.geometry.setDrawRange(0, plan.cells.length * p.edgePoints.length / 3);
  }
  const color = plan.ok ? 0x62efd2 : plan.code === 'complete' ? 0x63cdff : 0xff626c;
  p.fillMaterial.color.setHex(color);
  p.lineMaterial.color.setHex(color);
  p.fillMaterial.opacity = plan.code === 'complete' ? 0.08 : 0.19;
  p.group.visible = true;
}

function updateBuildingHud(plan) {
  if (!buildingHud) {
    const root = document.getElementById('buildHud'), piece = document.getElementById('buildPiece');
    const cost = document.getElementById('buildCost'), hint = document.getElementById('buildHint');
    if (!root || !piece || !cost || !hint) return;
    buildingHud = { root, piece, cost, hint };
  }
  const h = buildingHud, piece = BUILD_PIECES[plan.kind];
  const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
  text(h.piece, piece.label + ' ' + piece.size + ' · ' + BUILD_DIRECTIONS[plan.rotation].label);
  text(h.cost, plan.cost + ' voxel' + (plan.cost === 1 ? '' : 's') + ' · ' + blockName(plan.material) + ' · ' +
    (plan.available === Infinity ? '∞' : plan.available) + ' available' +
    (plan.reused ? ' · ' + plan.reused + ' reused' : ''));
  text(h.hint, plan.reason + ' · 1 wall · 2 floor · 3 ramp · R rotate · Shift+wheel material · Q gun');
  h.root.classList.add('show');
  h.root.classList.toggle('ready', plan.ok);
  h.root.classList.toggle('complete', plan.code === 'complete');
  h.root.classList.toggle('blocked', !plan.ok && plan.code !== 'complete');
  h.root.dataset.kind = plan.kind;
  h.root.dataset.reason = plan.code;
  document.body.classList.add('quick-build');
}

function refreshBuildingPreview() {
  if (!quickBuild.active) return;
  const target = findBuildAnchor();
  const plan = preflightBuildPiece(quickBuild.kind, target.anchor, target.rotation, quickBuild.material);
  setBuildingPlan(plan);
  drawBuildingPreview(plan);
  updateBuildingHud(plan);
  if (typeof highlight !== 'undefined') highlight.visible = false;
}

function updateBuilding(dt) {
  if (typeof updateInputState === 'function') updateInputState();
  if (!buildingGameplayReady()) {
    if (quickBuild.active || buildingHeld.left || buildingHeld.right) resetBuildingInput();
    stopBuildingGun();
    if (typeof highlight !== 'undefined') highlight.visible = false;
    return;
  }
  if (quickBuild.active && !combatMode) cancelQuickBuild();
  if (quickBuild.active) {
    stopBuildingGun();
    // Called after combat/camera so the blueprint owns the final visibility this frame.
    if (typeof viewGun !== 'undefined' && viewGun) viewGun.visible = false;
    if (typeof localAvatar !== 'undefined' && localAvatar && localAvatar.userData.gun) {
      localAvatar.userData.gun.visible = false;
    }
    refreshBuildingPreview();
  }
  runHeldBuilding();
}

BC.api.building = BC.api.building || {};
BC.api.building.voxelHitsLivingRemote = buildVoxelHitsLivingRemote;
BC.api.building.voxelHitsSolidDragon = buildVoxelHitsSolidDragon;
BC.api.building.lineHitsSolidDragon = buildLineHitsSolidDragon;
BC.api.building.remoteBodyHeight = buildRemoteBodyHeight;
BC.api.building.resetWorld = resetBuildingWorldState;
BC.on('worldWillReset', resetBuildingWorldState, -90);
BC.on('worldReset', resetBuildingWorldState, -90);
BC.on('modeChanged', resetBuildingWorldState, -90);
