/* Blockcraft Battle Ground — Player physics, first/third-person camera, avatar, block picking and spawn.
   50-player.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ---------------- player physics ---------------- */
const PW = 0.3;      // half width
const PH = 1.8;      // height
const BASE_GRAVITY = 30;
const JUMP_V = 10.4; // ~1.80-2.00 m quick tap; ~2.90 m with the bounded hold below
const PLAYER_JUMP_HOLD_TIME = 0.20;
const PLAYER_JUMP_HOLD_DELAY = 0.02; // keep a short tap near its normal trajectory
const PLAYER_JUMP_HOLD_GRAVITY = 0.32;
const PLAYER_UPWARD_CAP = Math.min(17.5, JUMP_V * 1.15);
const PLAYER_WATER_JUMP_DEPTH = 0.3;
// Arena-shooter pacing: quick to top speed, fast sprint, strong slides and
// real air strafing. Jump apex is unchanged so ramps and builds still line up.
const WALK = 5.4;
const SPRINT = 8.7;
const SNEAK = 3.4;
const FLY = 14;
const REACH = 6.5;
const FLOATING_BLOCK_DISTANCE = 3.5;
const PLAYER_EPS = 0.00001;
const JUMP_BUFFER = 0.12;
const COYOTE_TIME = 0.09;
const PLAYER_STEP = 1 / 120;
const PLAYER_WATER_SPEED = WALK * 0.92;
const PLAYER_AIR_ACCEL = 6.5;
const PLAYER_FALL_GRAVITY = 1.45;
const PLAYER_CROUCH_HEIGHT = 1.2;
const PLAYER_STANCE_DROP = 0.5;
const PLAYER_JUMP_CLEARANCE = 0.06;
const PLAYER_SLIDE_TIME = 0.85;
const PLAYER_SLIDE_SPEED = 13.6;
const PLAYER_SLIDE_END_SPEED = 10.4;
const PLAYER_SLIDE_COOLDOWN = 0.9;
const PLAYER_MOMENTUM_CAP = 14;
const PLAYER_SLIDE_HOP = 1.08; // jumping out of a slide keeps and slightly boosts momentum
// Keep even a full-tank ascent (and the standing head) inside the relay's
// 120-block vertical envelope rather than triggering server corrections.
const PLAYER_FLIGHT_CEILING = HEIGHT + 38;

const player = {
  pos: new THREE.Vector3(WORLD / 2 + 0.5, 40, WORLD / 2 + 0.5),
  vel: new THREE.Vector3(),
  onGround: false,
  fly: false,
  yaw: Math.PI * 0.25,
  pitch: -0.15,
  groundSpeed: 0,
  walkPhase: 0,
  sprinting: false,
  crouching: false,
  sliding: false,
  bodyHeight: PH,
  boosting: false,
  dashing: false,
  swimming: false,
  cameraDistance: 0
};

let jumpQueued = false;
const playerMotion = {
  jumpBuffer: 0,
  coyote: 0,
  jumpHold: 0,
  crouchDown: false,
  crouchJumpLock: false,
  slideTime: 0,
  slideCooldown: 0,
  slideX: 0,
  slideZ: 0,
  airCarry: 0,
  waterJump: false,
  waterExitLock: false,
  wasInWater: false,
  suspended: false,
  gait: 0,
  stance: 0,
  slidePose: 0,
  dashPose: 0,
  airPose: 0,
  bob: 0,
  eyeDrop: 0,
  cameraReady: false,
  cameraDistance: 0,
  cameraAnchor: new THREE.Vector3(),
  weaponPose: { pitch: 0, aim: false, firing: false, reload: -1, weapon: '', combat: false, alive: true, kick: 0 }
};
const playerReducedMotion = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const playerDt = (dt) => Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
const playerAlpha = (rate, dt) => 1 - Math.exp(-rate * dt);
let playerWet = false;
let playerSplashAt = -9999;

function playerResetJumpWaterState() {
  playerMotion.jumpHold = 0;
  playerMotion.waterJump = playerMotion.waterExitLock = playerMotion.wasInWater = false;
  playerWet = player.swimming = false;
  const phys = BC.api && BC.api.physics;
  if (phys && typeof phys.resetPlayerWater === 'function') phys.resetPlayerWater();
}

// Input/respawn owners also call this on unlock, blur, death and teleport.
function resetPlayerMotion() {
  const jet = BC.api && BC.api.jetpack;
  if (jet && typeof jet.cancelInput === 'function') jet.cancelInput();
  player.fly = false;
  jumpQueued = false;
  player.vel.set(0, 0, 0);
  player.onGround = false;
  player.groundSpeed = 0;
  player.walkPhase = 0;
  player.sprinting = player.sliding = player.swimming = player.boosting = player.dashing = false;
  // Input reset can happen inside a low tunnel. Never expand the collider just
  // because focus was lost; wait for real standing clearance.
  playerSetLowStance(!playerCanStand());
  player.cameraDistance = 0;
  playerResetJumpWaterState();
  playerMotion.jumpBuffer = playerMotion.coyote = 0;
  playerMotion.slideTime = 0;
  playerMotion.slideCooldown = Math.max(0, playerMotion.slideCooldown);
  playerMotion.slideX = playerMotion.slideZ = playerMotion.airCarry = 0;
  playerMotion.crouchJumpLock = false;
  playerMotion.crouchDown = playerCrouchHeld();
  playerMotion.gait = playerMotion.slidePose = playerMotion.dashPose = 0;
  playerMotion.stance = player.crouching ? 1 : 0;
  playerMotion.airPose = playerMotion.bob = playerMotion.eyeDrop = 0;
  playerMotion.cameraDistance = 0;
  playerMotion.cameraReady = false;
}

function playerWorldBusy() {
  const world = BC.api && BC.api.world;
  return !!((BC.flags && BC.flags.worldBusy) || (world && world.busy));
}

function playerReleaseMovementInputs() {
  for (const key in keys) keys[key] = false;
  // These later-script globals are deliberately read only when the game runs.
  if (typeof gun !== 'undefined' && gun) { gun.trigger = false; gun.aiming = false; }
  resetPlayerMotion();
}

function playerBeforeFrame(dt, now, playing) {
  const killcam = BC.api && BC.api.killcam;
  const dead = typeof alive !== 'undefined' && !alive;
  const suspended = playing === false || playerWorldBusy() || dead || !!(killcam && killcam.active);
  if (suspended && !playerMotion.suspended) playerReleaseMovementInputs();
  playerMotion.suspended = suspended;
}

/* ---------------- local avatar, character select & camera ---------------- */
let thirdPerson = true;
let charKey = 'cj';
let playerName = 'Wanderer';
let localAvatar = null;

try {
  const savedChar = localStorage.getItem('blockcraft.char');
  if (savedChar && CHARACTERS[savedChar] && CHAR_KEYS.includes(savedChar)) charKey = savedChar;
  const savedName = localStorage.getItem('blockcraft.name');
  if (savedName) playerName = savedName.slice(0, 14);
} catch (e) { /* ignore */ }

function buildAvatar() {
  if (localAvatar) scene.remove(localAvatar);
  localAvatar = makeHumanoid(charKey, null);
  scene.add(localAvatar);
  localAvatar.position.set(player.pos.x, player.pos.y, player.pos.z);
  localAvatar.rotation.y = player.yaw;
  const scoped = typeof isScopeActive === 'function' && isScopeActive();
  localAvatar.visible = playerAvatarCameraVisible(scoped);
  attachAvatarGun(localAvatar, currentWeapon().id);
  if (localAvatar.userData.gun) localAvatar.userData.gun.visible = thirdPerson;
  if (BC.api && BC.api.jetpack && typeof BC.api.jetpack.attachTo === 'function') {
    BC.api.jetpack.attachTo(localAvatar);
  }
  // A rebuilt rig starts standing. Apply its current stance without advancing
  // movement, fuel or pose clocks, so a character swap under a roof stays low.
  updateAvatar(0);
}

const charsEl = document.getElementById('chars');
const nameInput = document.getElementById('nameInput');
nameInput.value = playerName;
const charButtons = [];

for (const key of CHAR_KEYS) {
  const btn = document.createElement('button');
  btn.className = 'char';
  btn.type = 'button';
  btn.textContent = CHARACTERS[key].name;
  btn.addEventListener('click', () => setCharacter(key));
  charsEl.appendChild(btn);
  charButtons.push({ key, btn });
}

function markCharButtons() {
  for (const cb of charButtons) cb.btn.classList.toggle('active', cb.key === charKey);
}

function setCharacter(key) {
  if (!CHARACTERS[key]) return;
  charKey = key;
  markCharButtons();
  buildAvatar();
  try { localStorage.setItem('blockcraft.char', key); } catch (e) { /* ignore */ }
  if (window.__netIdentity) window.__netIdentity();
  toast('Now playing as ' + CHARACTERS[key].name);
}

nameInput.addEventListener('input', () => {
  const v = nameInput.value.replace(/[^\w \-]/g, '').slice(0, 14) || 'Wanderer';
  playerName = v;
  try { localStorage.setItem('blockcraft.name', v); } catch (e) { /* ignore */ }
  if (window.__netIdentity) window.__netIdentity();
});

function cycleCharacter() {
  const i = CHAR_KEYS.indexOf(charKey);
  setCharacter(CHAR_KEYS[(i + 1) % CHAR_KEYS.length]);
}

markCharButtons();

const isSolidPoint = (x, y, z) => {
  const b = getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  return b !== AIR && b !== WATER;
};
const playerCameraCollisionBox = { x: 0, y: 0, z: 0, w: 0.18, h: 0.36, ignoreDragonIndex: -1 };
const playerCameraAimTarget = new THREE.Vector3();

function playerIgnoredDragonIndex() {
  const riding = BC.api && BC.api.riding;
  const dragon = riding && riding.active && riding.dragon;
  return dragon && Number.isInteger(dragon.index) ? dragon.index : -1;
}

function playerOverlapsSolidDragon(box) {
  const dragonBodies = BC.api && BC.api.dragons;
  return !!(dragonBodies && typeof dragonBodies.overlapsAabb === 'function' &&
    dragonBodies.overlapsAabb(box, box.ignoreDragonIndex));
}

const cameraBlocked = (x, y, z) => {
  // Check the whole near-camera volume, including corners and the floor.
  const r = 0.18;
  for (let bx = Math.floor(x - r + PLAYER_EPS); bx <= Math.floor(x + r - PLAYER_EPS); bx++)
    for (let by = Math.floor(y - r + PLAYER_EPS); by <= Math.floor(y + r - PLAYER_EPS); by++)
      for (let bz = Math.floor(z - r + PLAYER_EPS); bz <= Math.floor(z + r - PLAYER_EPS); bz++)
        if (isSolidPoint(bx, by, bz)) return true;
  const box = playerCameraCollisionBox;
  box.x = x; box.y = y - r; box.z = z;
  box.ignoreDragonIndex = playerIgnoredDragonIndex();
  return playerOverlapsSolidDragon(box);
};

const playerAvatarStancePose = { stance: 0, slide: 0, dash: 0, swing: 0, air: 0 };

function updateAvatar(dt) {
  if (!localAvatar) return;
  dt = playerDt(dt);
  const m = playerMotion;
  const k = playerAlpha(15, dt);
  const riding = BC.api && BC.api.riding;
  if (riding && riding.active) {
    // 46-riding owns root/hip/upper-body seated transforms. Clear a previous
    // crouch's child joints without undoing that pose or showing its hidden gun.
    if (typeof poseHumanoidStance === 'function') poseHumanoidStance(localAvatar, null, 0);
    m.gait = m.stance = m.slidePose = m.dashPose = m.airPose = m.bob = 0;
    return;
  }
  m.gait += ((alive ? Math.min(1.2, player.groundSpeed / WALK) : 0) - m.gait) * playerAlpha(12, dt);
  const stancePose = playerAvatarStancePose;
  stancePose.stance = alive && player.crouching && !player.swimming ? 1 : 0;
  stancePose.slide = alive && player.sliding ? 1 : 0;
  stancePose.dash = alive && player.dashing ? 1 : 0;
  stancePose.air = alive && !player.onGround && !player.swimming ? 1 : 0;
  stancePose.swing = alive ? Math.sin(player.walkPhase) * m.gait * 0.74 : 0;
  const articulated = typeof poseHumanoidStance === 'function' &&
    poseHumanoidStance(localAvatar, stancePose, alive ? dt : 0);
  if (articulated) {
    const state = localAvatar.userData.humanoidStance;
    m.stance = state.stance;
    m.slidePose = state.slide;
    m.dashPose = state.dash;
    m.airPose = state.air;
  } else if (!alive) {
    m.stance = m.slidePose = m.dashPose = m.airPose = 0;
  } else {
    m.stance += (stancePose.stance - m.stance) * k;
    m.slidePose += (stancePose.slide - m.slidePose) * k;
    m.dashPose += (stancePose.dash - m.dashPose) * k;
    m.airPose += (stancePose.air - m.airPose) * k;
  }
  const swing = stancePose.swing * (1 - m.slidePose);
  const bobTarget = playerReducedMotion && playerReducedMotion.matches ? 0
    : Math.abs(Math.sin(player.walkPhase)) * m.gait * 0.022 * (1 - m.airPose) * (1 - m.stance);
  m.bob += (bobTarget - m.bob) * playerAlpha(18, dt);
  localAvatar.position.set(player.pos.x, player.pos.y, player.pos.z);
  if (!articulated) localAvatar.position.y += m.bob;
  localAvatar.rotation.y = player.yaw;

  const parts = localAvatar.userData.parts;
  if (!articulated) {
    const tuck = m.airPose * 0.16 + m.stance * 1.04;
    const lowSwing = swing * (1 - m.stance * 0.6);
    parts.legL.rotation.x += (lowSwing + tuck + m.slidePose * 0.3 + m.dashPose * 0.12 - parts.legL.rotation.x) * k;
    parts.legR.rotation.x += (-lowSwing + tuck - m.slidePose * 0.12 + m.dashPose * 0.28 - parts.legR.rotation.x) * k;
    // Compatibility for a saved/third-party rig with the original rigid legs.
    const drop = Math.min(0.55, m.stance * PLAYER_STANCE_DROP + m.slidePose * 0.04 + m.dashPose * 0.025);
    parts.legL.position.y = parts.legR.position.y = 0.72 - drop * 0.65;
    parts.legL.position.z = parts.legR.position.z = m.stance * 0.12;
    parts.head.position.y = 1.34 - drop;
    parts.head.position.z = -m.stance * 0.07 - m.dashPose * 0.06;
    parts.armL.position.y = parts.armR.position.y = 1.3 - drop;
    if (parts.torso) {
      parts.torso.position.y = 0.72 - drop * 0.82;
      parts.torso.rotation.x += (-m.stance * 0.25 + m.slidePose * 0.5 - m.dashPose * 0.32 - parts.torso.rotation.x) * k;
    }
  }
  const hasWeaponPose = typeof updateAvatarWeaponPose === 'function';
  if (!hasWeaponPose || !combatMode || !alive || !localAvatar.userData.gun) {
    parts.armL.rotation.x += (-swing * 0.85 - parts.armL.rotation.x) * k;
    parts.armR.rotation.x += (swing * 0.85 - parts.armR.rotation.x) * k;
  }
  parts.head.rotation.x += (player.pitch * 0.55 - parts.head.rotation.x) * k;
  parts.head.rotation.y = 0;

  if (hasWeaponPose) {
    const pose = m.weaponPose;
    pose.pitch = player.pitch;
    pose.aim = gun.aiming;
    pose.firing = gun.trigger || gun.firePose > 0;
    pose.reload = gun.reloading > 0 ? Math.max(0, Math.min(1, 1 - gun.reloading / Math.max(0.001, gun.reloadTotal))) : -1;
    pose.weapon = currentWeapon().id;
    pose.combat = combatMode;
    pose.alive = alive;
    pose.kick = gun.kick;
    updateAvatarWeaponPose(localAvatar, pose, dt);
  }
}

function playerAvatarCameraVisible(scoped) {
  if (!thirdPerson || scoped || !(playerMotion.cameraDistance > 1.15)) return false;
  const near = Number.isFinite(camera.near) && camera.near > 0 ? camera.near : 0.08;
  const fov = Number.isFinite(camera.fov) ? Math.max(1, Math.min(150, camera.fov)) : 74;
  const aspect = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 1;
  const halfHeight = near * Math.tan(fov * Math.PI / 360);
  const radius = Math.max(0.18, Math.hypot(near, halfHeight, halfHeight * aspect));
  const p = player.pos, c = camera.position;
  const dx = Math.max(0, Math.abs(c.x - p.x) - PW);
  const dy = Math.max(0, p.y - c.y, c.y - p.y - playerBodyHeight());
  const dz = Math.max(0, Math.abs(c.z - p.z) - PW);
  // Boom length is measured from the eye, not the closest body point. Looking
  // up can put an otherwise long, floor-clipped boom beside the boots/body.
  return dx * dx + dy * dy + dz * dz > radius * radius;
}

function updateCamera(dt = 1 / 60) {
  dt = playerDt(dt);
  const m = playerMotion;
  const reduced = playerReducedMotion && playerReducedMotion.matches;
  const scoped = typeof isScopeActive === 'function' && isScopeActive();
  const eyeDrop = playerBodyHeight() < PH ? PLAYER_STANCE_DROP : 0;
  m.eyeDrop += (eyeDrop - m.eyeDrop) * playerAlpha(reduced ? 24 : 16, dt);
  // Shrinking is immediate for clearance; rising can ease only after the
  // standing collider fits. A smoothed eye must never remain above a low roof.
  const eyeY = player.pos.y + playerEyeHeight();
  const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
  const fx = -Math.sin(player.yaw) * cp;
  const fy = sp;
  const fz = -Math.cos(player.yaw) * cp;

  // Normal third person is over the right shoulder. Sweep the entire offset,
  // including its lateral/vertical framing, rather than adding it after collision.
   // Follow the actual body, never its gait bob. Mouse angles stay raw; only
   // steep downward viewing gets a parallax solve AFTER this shoulder sweep.
  const ox = -fx * 2.7 + Math.cos(player.yaw) * 0.68;
  const oy = -fy * 2.7 + 0.22;
  const oz = -fz * 2.7 - Math.sin(player.yaw) * 0.68;
  const length = Math.hypot(ox, oy, oz);
  const dx = ox / length, dy = oy / length, dz = oz / length;
  let clear = 0;
  if (!scoped && !cameraBlocked(player.pos.x, eyeY, player.pos.z)) {
    const steps = Math.ceil(length / 0.1);
    for (let i = 1; i <= steps; i++) {
      const t = length * i / steps;
      if (cameraBlocked(player.pos.x + dx * t, eyeY + dy * t, player.pos.z + dz * t)) {
        let hi = t;
        for (let j = 0; j < 7; j++) {
          const mid = (clear + hi) * 0.5;
          if (cameraBlocked(player.pos.x + dx * mid, eyeY + dy * mid, player.pos.z + dz * mid)) hi = mid;
          else clear = mid;
        }
        clear = Math.max(0, clear - 0.025);
        break;
      }
      clear = t;
    }
  }

  const target = thirdPerson && !scoped ? clear : 0;
  const teleported = m.cameraAnchor.distanceToSquared(player.pos) > 16;
  if (scoped || !m.cameraReady || teleported) {
    // The opaque optic masks this immediate eye transition, including dt=0 shot
    // syncs. Keep the V preference so releasing aim eases back to its prior view.
    m.cameraDistance = target;
    m.cameraReady = true;
  } else {
    m.cameraDistance += (target - m.cameraDistance) * playerAlpha(reduced ? 28 : (thirdPerson ? 11 : 18), dt);
    // Collision retracts immediately; opening space and view changes ease out/in.
    m.cameraDistance = Math.min(m.cameraDistance, clear);
    if (Math.abs(m.cameraDistance - target) < 0.003) m.cameraDistance = target;
  }
  m.cameraAnchor.copy(player.pos);
  player.cameraDistance = m.cameraDistance;
  camera.position.set(player.pos.x + dx * m.cameraDistance, eyeY + dy * m.cameraDistance, player.pos.z + dz * m.cameraDistance);
  camera.rotation.set(player.pitch, player.yaw, 0);
  const groundMarker = BC.api && BC.api.groundMarker;
  if (thirdPerson && !scoped && player.pitch < -Math.PI / 4 && m.cameraDistance > 0.01 && groundMarker) {
    const ground = groundMarker.surfaceAt(player.pos.x, player.pos.y, player.pos.z, false);
    if (ground && ground.y < eyeY - 0.05) {
      // Keep the camera physically on the shoulder. Converge its centre ray
      // toward an eye-centred ground target instead of moving the camera or
      // painting a false crosshair. At ~83 degrees down the target is exactly
      // beneath the feet, despite the lateral shoulder offset. Shooting and
      // building already consume this same camera ray, so they stay aligned.
      const t = Math.max(0, Math.min(1, (-player.pitch - Math.PI / 4) / (Math.PI * 0.46 - Math.PI / 4)));
      const weight = t * t * (3 - 2 * t);
      const floorY = ground.y;
      const cameraReach = (camera.position.y - floorY) / -fy;
      const eyeReach = (eyeY - floorY) / -fy;
      const aimX = player.pos.x + fx * eyeReach * (1 - weight);
      const aimZ = player.pos.z + fz * eyeReach * (1 - weight);
      playerCameraAimTarget.set(camera.position.x + fx * cameraReach, floorY, camera.position.z + fz * cameraReach);
      playerCameraAimTarget.x += (aimX - playerCameraAimTarget.x) * weight;
      playerCameraAimTarget.z += (aimZ - playerCameraAimTarget.z) * weight;
      camera.lookAt(playerCameraAimTarget);
    }
  }
  camera.updateMatrixWorld(true);
  if (localAvatar) localAvatar.visible = playerAvatarCameraVisible(scoped);
}

const keys = Object.create(null);
const SOLID_AT = (x, y, z) => {
  const b = getBlock(x, y, z);
  return b !== AIR && b !== WATER;
};
const playerSweepBox = { x: 0, y: 0, z: 0, w: PW, h: PH, ignoreDragonIndex: -1 };

function playerBodyHeight() {
  return Number.isFinite(player.bodyHeight) ? Math.max(PLAYER_CROUCH_HEIGHT, Math.min(PH, player.bodyHeight)) : PH;
}

function playerEyeHeight() {
  return Math.min(1.62 - playerMotion.eyeDrop, playerBodyHeight() - 0.1);
}

function playerCanStand(extra = 0) {
  return !collides(player.pos.x, player.pos.y, player.pos.z, PH + Math.max(0, extra));
}

function playerSetLowStance(wanted) {
  const low = !!wanted || !playerCanStand();
  player.bodyHeight = low ? PLAYER_CROUCH_HEIGHT : PH;
  player.crouching = low;
}

function playerCapHorizontal(limit) {
  const v = player.vel;
  const speed = Math.hypot(v.x, v.z);
  if (speed > limit) { v.x *= limit / speed; v.z *= limit / speed; }
}

function collides(px, py, pz, height = playerBodyHeight()) {
  const box = playerSweepBox;
  box.x = px; box.y = py; box.z = pz; box.h = height;
  box.ignoreDragonIndex = playerIgnoredDragonIndex();
  const phys = BC.api && BC.api.physics;
  const voxelOverlap = phys && (typeof phys.overlapsVoxels === 'function' ? phys.overlapsVoxels : phys.overlaps);
  if (typeof voxelOverlap === 'function') {
    if (voxelOverlap.call(phys, box)) return true;
  } else {
    const minX = Math.floor(px - PW + PLAYER_EPS), maxX = Math.floor(px + PW - PLAYER_EPS);
    const minY = Math.floor(py + PLAYER_EPS), maxY = Math.floor(py + height - PLAYER_EPS);
    const minZ = Math.floor(pz - PW + PLAYER_EPS), maxZ = Math.floor(pz + PW - PLAYER_EPS);
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++)
          if (SOLID_AT(x, y, z)) return true;
  }
  return playerOverlapsSolidDragon(box);
}

function moveAxis(axis, amount) {
  if (!Number.isFinite(amount) || amount === 0) return false;
  const p = player.pos;
  const height = playerBodyHeight();
  const phys = BC.api && BC.api.physics;
  if (phys && typeof phys.moveAxis === 'function') {
    const box = playerSweepBox;
    box.x = p.x; box.y = p.y; box.z = p.z; box.h = height;
    box.ignoreDragonIndex = playerIgnoredDragonIndex();
    const hit = phys.moveAxis(box, axis, amount);
    p[axis] = box[axis];
    return hit;
  }
  const ex = p.x + (axis === 'x' ? amount : 0);
  const ey = p.y + (axis === 'y' ? amount : 0);
  const ez = p.z + (axis === 'z' ? amount : 0);
  const minX = Math.floor(Math.min(p.x, ex) - PW + PLAYER_EPS);
  const maxX = Math.floor(Math.max(p.x, ex) + PW - PLAYER_EPS);
  const minY = Math.floor(Math.min(p.y, ey) + PLAYER_EPS);
  const maxY = Math.floor(Math.max(p.y, ey) + height - PLAYER_EPS);
  const minZ = Math.floor(Math.min(p.z, ez) - PW + PLAYER_EPS);
  const maxZ = Math.floor(Math.max(p.z, ez) + PW - PLAYER_EPS);
  const edge = p[axis] + (axis === 'y' ? (amount > 0 ? height : 0) : (amount > 0 ? PW : -PW));
  let allowed = amount;
  // Sweep all crossed voxels and stop exactly at the first face, not a frame-sized gap.
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++) {
        if (!SOLID_AT(x, y, z)) continue;
        const face = axis === 'x' ? x : axis === 'y' ? y : z;
        const gap = face + (amount < 0 ? 1 : 0) - edge;
        if (amount > 0 && gap >= -PLAYER_EPS && gap < allowed) allowed = Math.max(0, gap);
        if (amount < 0 && gap <= PLAYER_EPS && gap > allowed) allowed = Math.min(0, gap);
      }
  p[axis] += allowed;
  return allowed !== amount;
}

function playerSupportHeight(px, py, pz, inset = 0) {
  const w = PW - inset;
  const phys = BC.api && BC.api.physics;
  if (phys && typeof phys.supportAt === 'function') {
    const floor = phys.supportAt(px, py, pz, w, 0.045);
    // Feet remain the origin for both heights. Validate the CURRENT body at
    // the candidate floor, not an imaginary 1.8 m standing box.
    return Number.isFinite(floor) && floor >= py - 0.045 && !collides(px, floor, pz) ? floor : -Infinity;
  }
  let height = -Infinity;
  for (let x = Math.floor(px - w + PLAYER_EPS); x <= Math.floor(px + w - PLAYER_EPS); x++)
    for (let z = Math.floor(pz - w + PLAYER_EPS); z <= Math.floor(pz + w - PLAYER_EPS); z++)
      for (let y = Math.floor(py - 0.045); y <= Math.floor(py - PLAYER_EPS); y++) {
        if (y + 1 <= py + PLAYER_EPS && SOLID_AT(x, y, z)) height = Math.max(height, y + 1);
      }
  return height;
}

function playerSupportedOffset(axis, amount, inset) {
  const p = player.pos;
  return Number.isFinite(playerSupportHeight(
    p.x + (axis === 'x' ? amount : 0), p.y, p.z + (axis === 'z' ? amount : 0), inset));
}

function sneakDisplacement(axis, amount) {
  if (!amount) return 0;
  const p = player.pos;
  // If sneak is pressed on the last sliver of an edge, still allow retreat.
  const inset = Number.isFinite(playerSupportHeight(p.x, p.y, p.z, 0.05)) ? 0.05 : 0;
  let safe = 0;
  const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.1));
  for (let i = 1; i <= steps; i++) {
    const next = amount * i / steps;
    if (playerSupportedOffset(axis, next, inset)) { safe = next; continue; }
    let unsafe = next;
    for (let j = 0; j < 9; j++) {
      const mid = (safe + unsafe) * 0.5;
      if (playerSupportedOffset(axis, mid, inset)) safe = mid;
      else unsafe = mid;
    }
    return safe;
  }
  return amount;
}

// C or Ctrl crouch on foot (Ctrl+sprint slides). In flight Ctrl descends and
// C dashes, so Ctrl never counts as crouch while flying.
function playerCrouchHeld() {
  return !!(keys['KeyC'] || (!player.fly && (keys['ControlLeft'] || keys['ControlRight'])));
}

function playerGravity(dt, gravity, terminal) {
  const start = Math.max(-terminal, player.vel.y);
  const fallTime = Math.min(dt, Math.max(0, (start + terminal) / gravity));
  player.vel.y = Math.max(-terminal, start - gravity * dt);
  return start * fallTime - 0.5 * gravity * fallTime * fallTime - terminal * (dt - fallTime);
}

// Match modes may scale gravity (Low Gravity). Jumps get higher and floatier.
function playerModeGravity() {
  try {
    const def = BC.api && BC.api.modes && BC.api.modes.activeDef;
    const g = def && Number(def.gravity);
    return g > 0.1 && g <= 2 ? g : 1;
  } catch (e) { return 1; }
}

function playerJumpGravity(dt) {
  const m = playerMotion;
  const GRAVITY = BASE_GRAVITY * playerModeGravity();
  // Only the consumed ground jump owns this window. Releasing Space, hitting
  // a roof or switching to flight/swimming cannot renew it in mid-air.
  if (!keys['Space'] || player.fly || player.swimming || player.vel.y <= 0) m.jumpHold = 0;
  const delay = Math.min(dt, Math.max(0, m.jumpHold - (PLAYER_JUMP_HOLD_TIME - PLAYER_JUMP_HOLD_DELAY)));
  let dy = delay > 0 ? playerGravity(delay, GRAVITY, 56) : 0;
  m.jumpHold = Math.max(0, m.jumpHold - delay);
  dt -= delay;
  const held = Math.min(dt, m.jumpHold);
  if (held > 0) dy += playerGravity(held, GRAVITY * PLAYER_JUMP_HOLD_GRAVITY, 56);
  m.jumpHold = Math.max(0, m.jumpHold - held);
  const rest = dt - held;
  if (rest > 0) dy += playerGravity(rest, GRAVITY * (player.vel.y < 0 ? PLAYER_FALL_GRAVITY : 1), 56);
  return dy;
}

function consumePlayerJump() {
  if (!playerCanStand(PLAYER_JUMP_CLEARANCE)) return false;
  const carry = player.sliding || playerMotion.slideTime > 0 || playerMotion.airCarry > WALK;
  if (player.sliding || playerMotion.slideTime > 0) { player.vel.x *= PLAYER_SLIDE_HOP; player.vel.z *= PLAYER_SLIDE_HOP; }
  playerCapHorizontal(PLAYER_MOMENTUM_CAP);
  playerMotion.airCarry = carry ? Math.hypot(player.vel.x, player.vel.z) : 0;
  playerMotion.waterJump = playerWet;
  playerMotion.jumpHold = keys['Space'] ? PLAYER_JUMP_HOLD_TIME : 0;
  // Latch the cancellation until C is released. Re-reading held C in
  // the next 1/120 slice must not undo the jump and shrink the body again.
  playerMotion.crouchJumpLock = true;
  player.bodyHeight = PH;
  player.crouching = player.sliding = false;
  playerMotion.jumpBuffer = playerMotion.coyote = playerMotion.slideTime = 0;
  player.vel.y = JUMP_V;
  player.onGround = false;
  return true;
}

function isInWater() {
  const phys = BC.api && BC.api.physics;
  const head = Math.min(1.45, playerBodyHeight() - 0.15);
  let wet;
  if (phys && typeof phys.isInWaterAt === 'function') {
    wet = phys.isInWaterAt(player.pos.x, player.pos.y + 0.15, player.pos.z) ||
      phys.isInWaterAt(player.pos.x, player.pos.y + head, player.pos.z);
  } else {
    const b1 = getBlock(player.pos.x, player.pos.y + 0.15, player.pos.z);
    const b2 = getBlock(player.pos.x, player.pos.y + head, player.pos.z);
    wet = b1 === WATER || b2 === WATER;
  }
  if (wet && !playerWet) {
    const now = BC.now();
    if (now - playerSplashAt > 320) {
      playerSplashAt = now;
      BC.emit('sfx', {
        kind: 'splash',
        position: { x: player.pos.x, y: player.pos.y + 0.15, z: player.pos.z },
        volume: 0.55
      });
    }
  }
  playerWet = wet;
  return wet;
}

/** Pull the player back inside the active mode arena and kill outward velocity. */
function clampPlayerArena(vel) {
  const modes = BC.api && BC.api.modes;
  const arena = modes && modes.arena;
  if (!arena || !arena.active || !(arena.radius > 0) || typeof arena.clamp !== 'function') return false;
  const beforeX = player.pos.x, beforeZ = player.pos.z;
  if (!arena.clamp(player.pos)) return false;
  const ox = beforeX - arena.cx, oz = beforeZ - arena.cz;
  const len = Math.hypot(ox, oz);
  if (len < 0.0001) return true;
  const nx = ox / len, nz = oz / len;
  const outward = vel.x * nx + vel.z * nz;
  if (outward > 0) {
    vel.x -= outward * nx;
    vel.z -= outward * nz;
  }
  return true;
}

function updatePlayer(dt) {
  if (playerWorldBusy()) {
    if (!playerMotion.suspended) playerReleaseMovementInputs();
    playerMotion.suspended = true;
    return;
  }
  const killcam = BC.api && BC.api.killcam;
  if (killcam && killcam.active) {
    // The kill cam owns the camera and the corpse; do not integrate gravity.
    player.vel.set(0, 0, 0);
    player.groundSpeed = 0;
    player.sprinting = player.sliding = player.swimming = false;
    player.crouching = playerBodyHeight() < PH;
    player.boosting = player.dashing = false;
    playerMotion.jumpBuffer = playerMotion.coyote = playerMotion.slideTime = 0;
    playerResetJumpWaterState();
    jumpQueued = false;
    return;
  }
  const riding = BC.api && BC.api.riding;
  if (riding && riding.active) {
    // 46-riding writes the saddle position every frame.
    player.fly = false;
    player.vel.set(0, 0, 0);
    player.onGround = false;
    player.groundSpeed = 0;
    player.sprinting = player.sliding = player.swimming = false;
    player.crouching = playerBodyHeight() < PH;
    player.boosting = player.dashing = false;
    playerMotion.jumpBuffer = playerMotion.coyote = playerMotion.slideTime = 0;
    playerResetJumpWaterState();
    jumpQueued = false;
    return;
  }
  if (!alive) { resetPlayerMotion(); return; }
  dt = playerDt(dt);
  if (dt <= 0) return;
  const m = playerMotion;
  const v = player.vel;
  const phys = BC.api && BC.api.physics;
  const jet = BC.api && BC.api.jetpack;
  if (jet) player.fly = !!jet.active;
  player.boosting = !!(player.fly && jet && jet.boosting);
  player.dashing = !!(player.fly && jet && jet.dashing);
  if (!Number.isFinite(v.x)) v.x = 0;
  if (!Number.isFinite(v.y)) v.y = 0;
  if (!Number.isFinite(v.z)) v.z = 0;
  if (jumpQueued) {
    m.jumpBuffer = JUMP_BUFFER;
    // A fresh keydown also covers release/re-press between physics frames.
    // It ends the old hold window; only consuming a legal jump opens a new one.
    m.jumpHold = 0;
    m.waterExitLock = false;
    jumpQueued = false;
  }
  const crouch = playerCrouchHeld();
  const space = !!keys['Space'];
  if (!space) { m.jumpHold = 0; m.waterExitLock = false; }
  const shift = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  const crouchPressed = crouch && !m.crouchDown;
  m.crouchDown = crouch;
  if (!crouch) m.crouchJumpLock = false;

  let ix = 0, iz = 0;
  if (keys['KeyW']) iz += 1;
  if (keys['KeyS']) iz -= 1;
  if (keys['KeyD']) ix += 1;
  if (keys['KeyA']) ix -= 1;

  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const inputLength = Math.hypot(ix, iz);
  const wx = inputLength ? (-sy * iz + cy * ix) / inputLength : 0;
  const wz = inputLength ? (-cy * iz - sy * ix) / inputLength : 0;
  const steps = Math.max(1, Math.ceil(dt / PLAYER_STEP));
  const h = dt / steps;
  let distance = 0;
  let stride = 0;
  let touchedWater = false;

  // Small bounded physics slices resolve contacts/input windows without delaying input.
  for (let i = 0; i < steps; i++) {
    player.boosting = !!(player.fly && jet && jet.boosting);
    player.dashing = !!(player.fly && jet && jet.dashing);
    playerSetLowStance((player.fly ? player.dashing : crouch && !m.crouchJumpLock) || m.slideTime > 0);
    const inWater = isInWater();
    touchedWater = touchedWater || inWater;
    const support = playerSupportHeight(player.pos.x, player.pos.y, player.pos.z);
    player.onGround = !player.fly && v.y <= 0 && Number.isFinite(support);
    if (player.onGround) {
      player.pos.y = support; v.y = 0;
      m.airCarry = 0;
      m.waterJump = false;
      m.jumpHold = 0;
      if (!inWater) m.waterExitLock = false;
    }
    if (v.y <= 0) m.waterJump = false;
    if (!inWater) {
      m.waterJump = false;
      if (m.wasInWater && phys && typeof phys.resetPlayerWater === 'function') phys.resetPlayerWater();
    }
    m.wasInWater = inWater;
    let surface = inWater && phys && typeof phys.waterSurfaceAt === 'function'
      ? phys.waterSurfaceAt(player.pos.x, player.pos.z, player.pos.y + 0.15) : -Infinity;
    if (inWater && !Number.isFinite(surface) && phys && typeof phys.waterSurfaceAt === 'function') {
      surface = phys.waterSurfaceAt(player.pos.x, player.pos.z, player.pos.y + playerBodyHeight() - 0.15);
    }
    const waterDepth = Number.isFinite(surface) ? surface - player.pos.y : 1.5;
    const wading = inWater && player.onGround && waterDepth < 0.9;
    if (player.fly) {
      m.jumpHold = 0;
      m.waterJump = m.waterExitLock = false;
    } else if (inWater && !player.onGround && !m.waterJump && !m.waterExitLock && space &&
        Number.isFinite(surface) && waterDepth <= PLAYER_WATER_JUMP_DEPTH && v.y >= -0.4) {
      // Space at the surface uses the SAME jump as land, including its bounded
      // hold window. It is not locked to a nearby bank. Holding swim-up from
      // depth may launch once on reaching the surface; release before repeating.
      if (consumePlayerJump()) m.waterExitLock = true;
    }
    player.swimming = inWater && !player.fly && !wading && !m.waterJump;

    if (player.fly || player.swimming) {
      m.jumpBuffer = m.coyote = m.slideTime = 0;
      m.jumpHold = 0;
    } else {
      m.coyote = player.onGround ? COYOTE_TIME : Math.max(0, m.coyote - h);
    }
    if (i === 0 && crouchPressed && shift && player.onGround && !inWater && !player.fly &&
        inputLength > 0 && m.slideCooldown <= 0 && m.jumpBuffer <= 0 && !m.crouchJumpLock) {
      m.slideX = wx; m.slideZ = wz;
      v.x = wx * PLAYER_SLIDE_SPEED; v.z = wz * PLAYER_SLIDE_SPEED;
      m.slideTime = PLAYER_SLIDE_TIME;
      m.slideCooldown = PLAYER_SLIDE_COOLDOWN;
    }
    if (!player.onGround) {
      if (m.slideTime > 0) m.airCarry = Math.min(PLAYER_MOMENTUM_CAP, Math.hypot(v.x, v.z));
      m.slideTime = 0;
    }
    if (m.jumpBuffer > 0 && m.coyote > 0 && !player.fly && !player.swimming) consumePlayerJump();
    // Jump/knockback can never launch the player above a fair rocket jump.
    if (!player.fly && v.y > PLAYER_UPWARD_CAP) v.y = PLAYER_UPWARD_CAP;
    player.sliding = m.slideTime > 0;
    playerSetLowStance((player.fly ? player.dashing : crouch && !m.crouchJumpLock) || player.sliding);
    const flightCap = jet && Number.isFinite(jet.speedCap) ? jet.speedCap : FLY * 2;
    playerCapHorizontal(player.fly ? flightCap : PLAYER_MOMENTUM_CAP);

    const sprinting = shift && inputLength > 0 && !player.crouching && !inWater && player.onGround;
    const flightSpeed = jet && Number.isFinite(jet.boostSpeed) ? jet.boostSpeed : FLY * 1.65;
    const airSpeed = m.airCarry > WALK ? Math.min(PLAYER_MOMENTUM_CAP, m.airCarry) : WALK;
    const speed = player.fly ? ((jet ? player.boosting : shift) ? flightSpeed : FLY)
      : inWater ? PLAYER_WATER_SPEED : player.onGround ? (player.crouching ? SNEAK : sprinting ? SPRINT : WALK)
        : (player.crouching && !m.airCarry ? SNEAK : airSpeed);
    let tx = wx * speed, tz = wz * speed;
    if (player.sliding) {
      const slideSpeed = PLAYER_SLIDE_END_SPEED + (PLAYER_SLIDE_SPEED - PLAYER_SLIDE_END_SPEED) * m.slideTime / PLAYER_SLIDE_TIME;
      tx = m.slideX * slideSpeed; tz = m.slideZ * slideSpeed;
    } else if (player.dashing && jet) {
      tx = jet.dashX * jet.dashSpeed; tz = jet.dashZ * jet.dashSpeed;
    }
    const reversing = v.x * wx + v.z * wz < -0.1;
    const rate = player.sliding ? 14 : player.fly ? (player.dashing ? 16 : 11) : inWater ? 18
      : player.onGround ? (!inputLength || reversing || crouch ? 40 : 34)
        : (inputLength ? PLAYER_AIR_ACCEL : m.airCarry > WALK ? 0.35 : 1.5);
    const k = playerAlpha(rate, h);
    // Integrate exponential damping analytically, including distance travelled.
    let mx = tx * h + (v.x - tx) * k / rate;
    let mz = tz * h + (v.z - tz) * k / rate;
    v.x += (tx - v.x) * k;
    v.z += (tz - v.z) * k;

    let my = 0;
    if (player.fly) {
      // Shift is exclusively boost; C is exclusively dash/low pose. Space
      // wins even if all three are held. Only held Ctrl requests descent.
      const ascend = jet && Number.isFinite(jet.ascendSpeed) ? jet.ascendSpeed : FLY * (shift ? 1.25 : 1);
      const descend = !!(keys['ControlLeft'] || keys['ControlRight']);
      const targetY = keys['Space'] ? ascend : descend ? -FLY : 0;
      v.y = Math.max(-FLY, Math.min(ascend, v.y));
      const ky = playerAlpha(11, h);
      my = targetY * h + (v.y - targetY) * ky / 11;
      v.y += (targetY - v.y) * ky;
    } else if (inWater && m.waterJump) {
      // A supported wading jump or normal surface jump is not a swim stroke.
      // Keep its finite rising impulse instead of capping it back to 4 m/s in
      // the next slice; descending/re-entering water restores normal buoyancy.
      my = playerJumpGravity(h);
    } else if (inWater) {
      if (phys && typeof phys.resolvePlayerWater === 'function') {
        my = phys.resolvePlayerWater(h, space, crouch && !space);
      } else {
        const targetY = keys['Space'] ? 4.4 : crouch ? -3.4 : 0;
        const ky = playerAlpha(7, h);
        my = targetY * h + (v.y - targetY) * ky / 7;
        v.y += (targetY - v.y) * ky;
      }
    } else if (!player.onGround) {
      my = playerJumpGravity(h);
    }

    if (moveAxis('y', my)) {
      player.onGround = my < 0 && !player.fly;
      v.y = 0;
      m.jumpHold = 0;
      m.waterJump = false;
      if (player.onGround && m.jumpBuffer > 0 && !player.swimming) consumePlayerJump();
    } else if (my > 0) player.onGround = false;
    if (player.fly && player.pos.y > PLAYER_FLIGHT_CEILING) {
      player.pos.y = PLAYER_FLIGHT_CEILING;
      v.y = Math.min(0, v.y);
    }

    const protectEdge = player.crouching && player.onGround && !player.sliding && !inWater;
    const startX = player.pos.x, startZ = player.pos.z;
    if (protectEdge) {
      const safeX = sneakDisplacement('x', mx);
      if (Math.abs(safeX - mx) > PLAYER_EPS) { v.x = 0; m.slideTime = 0; }
      mx = safeX;
    }
    if (moveAxis('x', mx)) {
      v.x = 0; m.slideTime = 0;
      if (player.dashing && jet && typeof jet.cancelDash === 'function') jet.cancelDash();
    }
    if (protectEdge) {
      const safeZ = sneakDisplacement('z', mz);
      if (Math.abs(safeZ - mz) > PLAYER_EPS) { v.z = 0; m.slideTime = 0; }
      mz = safeZ;
    }
    if (moveAxis('z', mz)) {
      v.z = 0; m.slideTime = 0;
      if (player.dashing && jet && typeof jet.cancelDash === 'function') jet.cancelDash();
    }
    const boundX = Math.max(1.2, Math.min(WORLD - 1.2, player.pos.x));
    const boundZ = Math.max(1.2, Math.min(WORLD - 1.2, player.pos.z));
    const worldHit = boundX !== player.pos.x || boundZ !== player.pos.z;
    if (boundX !== player.pos.x) { player.pos.x = boundX; v.x = 0; }
    if (boundZ !== player.pos.z) { player.pos.z = boundZ; v.z = 0; }
    const arenaHit = clampPlayerArena(v);
    if (arenaHit || worldHit) {
      m.slideTime = 0;
      if (player.dashing && jet && typeof jet.cancelDash === 'function') jet.cancelDash();
    }
    if (player.onGround && !Number.isFinite(playerSupportHeight(player.pos.x, player.pos.y, player.pos.z))) player.onGround = false;
    if (!player.onGround && !player.fly && m.slideTime > 0) {
      m.airCarry = Math.min(PLAYER_MOMENTUM_CAP, Math.hypot(v.x, v.z));
      m.slideTime = 0;
    }
    if (!player.onGround && !player.fly && !player.swimming && m.airCarry > 0) {
      m.airCarry = Math.min(m.airCarry, Math.hypot(v.x, v.z)) * Math.exp(-0.35 * h);
    }
    const travelled = Math.hypot(player.pos.x - startX, player.pos.z - startZ);
    distance += travelled;
    stride += travelled * (player.onGround && !player.sliding ? 1 : 0.2);
    m.jumpBuffer = Math.max(0, m.jumpBuffer - h);
    m.slideTime = Math.max(0, m.slideTime - h);
    m.slideCooldown = Math.max(0, m.slideCooldown - h);
  }
  if (!touchedWater) playerWet = false;
  player.sliding = m.slideTime > 0;
  player.dashing = !!(player.fly && jet && jet.dashing);
  playerSetLowStance((player.fly ? player.dashing : crouch && !m.crouchJumpLock) || player.sliding);
  player.sprinting = shift && !player.crouching && !player.swimming && !player.fly && player.onGround && distance / dt > WALK * 0.75;
  player.groundSpeed = distance / dt * (player.onGround ? 1 : 0.35);
  player.walkPhase = (player.walkPhase + stride * 2.2) % (Math.PI * 2);
  if (player.pos.y < -10) respawn();
}

/* ---------------- block picking ---------------- */
function blockReachOrigin(dir) {
  // Keep the visible crosshair ray, measuring reach at the player's eye plane
  // rather than spending it on the third-person camera boom.
  const origin = camera.position.clone();
  const advance = Math.max(0, (player.pos.x - origin.x) * dir.x +
    (player.pos.y + playerEyeHeight() - origin.y) * dir.y + (player.pos.z - origin.z) * dir.z);
  return origin.addScaledVector(dir, advance);
}

function raycastVoxel(maxDist, originArg, dirArg) {
  let origin = originArg || camera.position;
  let dir = dirArg || camera.getWorldDirection(new THREE.Vector3());
  const dirLength = Math.hypot(dir.x, dir.y, dir.z);
  if (!Number.isFinite(maxDist) || maxDist < 0 || !Number.isFinite(dirLength) || dirLength < 1e-12 ||
      !Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z)) return null;
  if (Math.abs(dirLength - 1) > 1e-12) dir = new THREE.Vector3(dir.x / dirLength, dir.y / dirLength, dir.z / dirLength);
  if (!originArg && !dirArg) origin = blockReachOrigin(dir);

  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(z)) return null;
  const stepX = Math.abs(dir.x) < 1e-12 ? 0 : dir.x > 0 ? 1 : -1;
  const stepY = Math.abs(dir.y) < 1e-12 ? 0 : dir.y > 0 ? 1 : -1;
  const stepZ = Math.abs(dir.z) < 1e-12 ? 0 : dir.z > 0 ? 1 : -1;

  const tdx = stepX === 0 ? Infinity : Math.abs(1 / dir.x);
  const tdy = stepY === 0 ? Infinity : Math.abs(1 / dir.y);
  const tdz = stepZ === 0 ? Infinity : Math.abs(1 / dir.z);

  let tmx = stepX === 0 ? Infinity : (stepX > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tdx;
  let tmy = stepY === 0 ? Infinity : (stepY > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tdy;
  let tmz = stepZ === 0 ? Infinity : (stepZ > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tdz;

  let nx = 0, ny = 0, nz = 0, t = 0;

  // A unit ray can cross |dx| + |dy| + |dz| grid planes per world unit.
  // The generous finite cap only protects malformed, astronomically long calls.
  const maxSteps = Math.min(65536, Math.ceil(maxDist * (Math.abs(dir.x) + Math.abs(dir.y) + Math.abs(dir.z))) + 4);
  for (let i = 0; i < maxSteps; i++) {
    const b = getBlock(x, y, z);
    if (b !== AIR && b !== WATER) return { x, y, z, nx, ny, nz, dist: t };
    if (tmx < tmy && tmx < tmz) {
      x += stepX; t = tmx; tmx += tdx; nx = -stepX; ny = 0; nz = 0;
    } else if (tmy < tmz) {
      y += stepY; t = tmy; tmy += tdy; nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -stepZ;
    }
    if (t > maxDist) return null;
  }
  return null;
}

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x101010, transparent: true, opacity: 0.55 })
);
highlight.visible = false;
scene.add(highlight);

let hovered = null;

function updateHover() {
  hovered = raycastVoxel(REACH);
  const preview = hovered || (!combatMode && alive &&
    !(typeof quickBuild !== 'undefined' && quickBuild.active) ? floatingBlockTarget() : null);
  if (preview) {
    highlight.visible = true;
    highlight.position.set(preview.x + 0.5, preview.y + 0.5, preview.z + 0.5);
  } else {
    highlight.visible = false;
  }
}

function markDirty(x, z) {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  const set = new Set([cx + ',' + cz]);
  if (x % CHUNK === 0) set.add((cx - 1) + ',' + cz);
  if (x % CHUNK === CHUNK - 1) set.add((cx + 1) + ',' + cz);
  if (z % CHUNK === 0) set.add(cx + ',' + (cz - 1));
  if (z % CHUNK === CHUNK - 1) set.add(cx + ',' + (cz + 1));
  for (const key of set) {
    const parts = key.split(',');
    rebuildChunk(parseInt(parts[0], 10), parseInt(parts[1], 10));
  }
}

function blockIntersectsPlayer(bx, by, bz) {
  const p = player.pos;
  return !(bx + 1 <= p.x - PW || bx >= p.x + PW ||
           by + 1 <= p.y || by >= p.y + playerBodyHeight() ||
           bz + 1 <= p.z - PW || bz >= p.z + PW);
}

function canPlacePlayerBlock(x, y, z) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) ||
      y < 1 || y >= HEIGHT || x < 0 || x >= WORLD || z < 0 || z >= WORLD) return false;
  const current = getBlock(x, y, z);
  return (current === AIR || current === WATER) && !blockIntersectsPlayer(x, y, z) &&
    !(typeof buildVoxelHitsLivingRemote === 'function' && buildVoxelHitsLivingRemote(x, y, z)) &&
    !(typeof buildVoxelHitsSolidDragon === 'function' && buildVoxelHitsSolidDragon(x, y, z));
}

function blockPlacementPathClear(origin, point) {
  const dx = point.x - origin.x, dy = point.y - origin.y, dz = point.z - origin.z;
  const distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance)) return false;
  if (distance <= PLAYER_EPS) return true;
  const building = BC.api && BC.api.building;
  if (building && typeof building.lineHitsSolidDragon === 'function' &&
      building.lineHitsSolidDragon(origin, point)) return false;
  return !raycastVoxel(distance - PLAYER_EPS, origin, new THREE.Vector3(dx / distance, dy / distance, dz / distance));
}

function blockHitPathClear(hit) {
  if (!hit) return false;
  const direction = camera.getWorldDirection(new THREE.Vector3());
  const origin = blockReachOrigin(direction);
  // Voxel hits expose `dist`. Trace to the contacted face, not the solid
  // block's centre, or the occlusion check rejects the target itself.
  const hitDist = Number.isFinite(hit.dist) ? hit.dist : hit.t;
  const point = Number.isFinite(hitDist) ? origin.clone().addScaledVector(direction, Math.max(0, hitDist))
    : new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  return blockPlacementPathClear(origin, point);
}

function floatingBlockTarget() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const point = blockReachOrigin(dir).addScaledVector(dir, Math.min(FLOATING_BLOCK_DISTANCE, REACH));
  const target = { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z) };
  if (!canPlacePlayerBlock(target.x, target.y, target.z)) return null;
  const eye = new THREE.Vector3(player.pos.x, player.pos.y + playerEyeHeight(), player.pos.z);
  if (Math.hypot(target.x + 0.5 - eye.x, target.y + 0.5 - eye.y, target.z + 0.5 - eye.z) > REACH) return null;
  // Shoulder peeking must not place through nearby cover. Check both the real
  // eye's reach path and the full camera ray, including its skipped boom section.
  if (!blockPlacementPathClear(eye, point) || !blockPlacementPathClear(camera.position, point)) return null;
  return target;
}

function breakBlock() {
  const hit = raycastVoxel(REACH);
  if (!hit || hit.y <= 0 || !blockHitPathClear(hit)) return;
  const broken = getBlock(hit.x, hit.y, hit.z);
  setBlock(hit.x, hit.y, hit.z, AIR);
  markDirty(hit.x, hit.z);
  if (broken && broken !== WATER &&
      (typeof UNLIMITED_BUILDING === 'undefined' || !UNLIMITED_BUILDING) && typeof addItem === 'function') {
    addItem(broken, 1);
    toast('+' + (BLOCK_DEFS[broken] ? BLOCK_DEFS[broken].name : 'Block'));
  }
  if (window.__netEdit) window.__netEdit(hit.x, hit.y, hit.z, AIR);
}

function placeBlock() {
  const hit = raycastVoxel(REACH);
  if (hit && !blockHitPathClear(hit)) return;
  const target = hit ? { x: hit.x + hit.nx, y: hit.y + hit.ny, z: hit.z + hit.nz } : floatingBlockTarget();
  if (!target || !canPlacePlayerBlock(target.x, target.y, target.z)) return;
  const tx = target.x, ty = target.y, tz = target.z;
  const type = HOTBAR[selected];
  if (buildItemCount(type) <= 0 || !takeBuildItems(type, 1)) {
    toast('Choose a solid building material');
    return;
  }
  setBlock(tx, ty, tz, type);
  markDirty(tx, tz);
  if (window.__netEdit) window.__netEdit(tx, ty, tz, type);
}

function respawn() {
  const spawn = findSpawn();
  player.pos.set(spawn.x, spawn.y, spawn.z);
  resetPlayerMotion();
  // Core hook: kill cam, jetpack and net all clear per-life state from this.
  BC.emit('respawn');
}

function findSpawn() {
  const cx = Math.floor(WORLD / 2), cz = Math.floor(WORLD / 2);
  const solidGround = (id) => id === GRASS || id === DIRT || id === SAND ||
    id === SNOW || id === GRAVEL || id === SANDSTONE || id === MUD;

  const isOpen = (x, z, h) => {
    if (!solidGround(getBlock(x, h, z))) return false;
    // headroom plus a little breathing room on all sides
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let y = h + 1; y <= h + 4; y++) {
          if (isOpaque(x + dx, y, z + dz)) return false;
        }
      }
    }
    return true;
  };

  let best = null;
  for (let r = 0; r < 80 && !best; r++) {
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(ang) * r);
      const z = Math.round(cz + Math.sin(ang) * r);
      if (x < 3 || z < 3 || x > WORLD - 3 || z > WORLD - 3) continue;
      const h = terrainHeight(x, z);
      if (h <= SEA + 1) continue;
      if (isOpen(x, z, h)) {
        best = { x: x + 0.5, y: h + 1.05, z: z + 0.5 };
        break;
      }
    }
  }

  // last resort: pick any dry column, clear whatever is above the head
  if (!best) {
    for (let r = 0; r < 80 && !best; r++) {
      for (let a = 0; a < 40; a++) {
        const ang = (a / 40) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(ang) * r);
        const z = Math.round(cz + Math.sin(ang) * r);
        if (x < 3 || z < 3 || x > WORLD - 3 || z > WORLD - 3) continue;
        const h = terrainHeight(x, z);
        if (h <= SEA + 1) continue;
        for (let y = h + 1; y <= h + 4; y++) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (isOpaque(x + dx, y, z + dz)) setBlock(x + dx, y, z + dz, AIR);
            }
          }
        }
        best = { x: x + 0.5, y: h + 1.05, z: z + 0.5 };
        break;
      }
    }
  }
  if (!best) best = { x: cx + 0.5, y: 45, z: cz + 0.5 };
  return best;
}

if (BC.api && BC.api.physics) {
  BC.api.physics.playerBodyHeight = playerBodyHeight;
  BC.api.physics.playerCanStand = playerCanStand;
  BC.api.physics.playerEyeHeight = playerEyeHeight;
}
function playerResetLifeState() {
  playerResetJumpWaterState();
  playerMotion.slideCooldown = 0;
  playerMotion.suspended = false;
}
BC.on('preFrame', playerBeforeFrame, -20);
// The hook may be emitted without 80-input's direct reset (world/life owners).
// Clear slide/coyote/velocity as well as the jetpack's held boost/dash keys.
BC.on('inputReset', playerReleaseMovementInputs, 0);
BC.on('death', playerReleaseMovementInputs, 0);
BC.on('respawn', playerResetLifeState, 0);
BC.on('worldReset', playerResetLifeState, 0);
BC.on('worldReady', playerResetLifeState, 0);
BC.on('worldWillReset', playerResetJumpWaterState, 0);
BC.on('modeChanged', playerResetJumpWaterState, 0);
BC.on('worldBusyChanged', (busy) => { if (busy) playerResetJumpWaterState(); }, 0);
BC.flags.playerPhysicsReady = true;
