/* Blockcraft Battle Ground — Player physics, first/third-person camera, avatar, block picking and spawn.
   50-player.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ---------------- player physics ---------------- */
const PW = 0.3;      // half width
const PH = 1.8;      // height
const GRAVITY = 30;
const JUMP_V = 9.2;
const WALK = 4.6;
const SPRINT = 7.3;
const SNEAK = 1.8;
const FLY = 14;
const REACH = 6.5;
const FLOATING_BLOCK_DISTANCE = 3.5;
const PLAYER_EPS = 0.00001;
const JUMP_BUFFER = 0.12;
const COYOTE_TIME = 0.09;
const PLAYER_STEP = 1 / 120;

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
  swimming: false,
  cameraDistance: 0
};

let jumpQueued = false;
const playerMotion = {
  jumpBuffer: 0,
  coyote: 0,
  crouchDown: false,
  slideTime: 0,
  slideCooldown: 0,
  gait: 0,
  stance: 0,
  slidePose: 0,
  airPose: 0,
  bob: 0,
  eyeDrop: 0,
  cameraReady: false,
  cameraDistance: 0,
  cameraAnchor: new THREE.Vector3()
};
const playerReducedMotion = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const playerDt = (dt) => Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
const playerAlpha = (rate, dt) => 1 - Math.exp(-rate * dt);

// Input/respawn owners also call this on unlock, blur, death and teleport.
function resetPlayerMotion() {
  jumpQueued = false;
  player.vel.set(0, 0, 0);
  player.onGround = false;
  player.groundSpeed = 0;
  player.walkPhase = 0;
  player.sprinting = player.crouching = player.sliding = player.swimming = false;
  player.cameraDistance = 0;
  playerMotion.jumpBuffer = playerMotion.coyote = 0;
  playerMotion.slideTime = playerMotion.slideCooldown = 0;
  playerMotion.crouchDown = !!(keys['ControlLeft'] || keys['ControlRight']);
  playerMotion.gait = playerMotion.stance = playerMotion.slidePose = 0;
  playerMotion.airPose = playerMotion.bob = playerMotion.eyeDrop = 0;
  playerMotion.cameraDistance = 0;
  playerMotion.cameraReady = false;
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
  localAvatar.visible = thirdPerson;
  attachAvatarGun(localAvatar, currentWeapon().id);
  if (localAvatar.userData.gun) localAvatar.userData.gun.visible = thirdPerson;
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
const cameraBlocked = (x, y, z) => {
  // Check the whole near-camera volume, including corners and the floor.
  const r = 0.18;
  for (let bx = Math.floor(x - r + PLAYER_EPS); bx <= Math.floor(x + r - PLAYER_EPS); bx++)
    for (let by = Math.floor(y - r + PLAYER_EPS); by <= Math.floor(y + r - PLAYER_EPS); by++)
      for (let bz = Math.floor(z - r + PLAYER_EPS); bz <= Math.floor(z + r - PLAYER_EPS); bz++)
        if (isSolidPoint(bx, by, bz)) return true;
  return false;
};

function updateAvatar(dt) {
  if (!localAvatar) return;
  dt = playerDt(dt);
  const m = playerMotion;
  const k = playerAlpha(15, dt);
  m.gait += (Math.min(1.2, player.groundSpeed / WALK) - m.gait) * playerAlpha(12, dt);
  m.stance += ((player.crouching ? 1 : 0) - m.stance) * k;
  m.slidePose += ((player.sliding ? 1 : 0) - m.slidePose) * k;
  m.airPose += ((!player.onGround && !player.fly && !player.swimming && alive ? 1 : 0) - m.airPose) * k;
  const swing = Math.sin(player.walkPhase) * m.gait * 0.74 * (1 - m.slidePose);
  const bobTarget = playerReducedMotion && playerReducedMotion.matches ? 0
    : Math.abs(Math.sin(player.walkPhase)) * m.gait * 0.022 * (1 - m.airPose) * (1 - m.stance);
  m.bob += (bobTarget - m.bob) * playerAlpha(18, dt);
  localAvatar.position.set(player.pos.x, player.pos.y, player.pos.z);
  localAvatar.position.y += m.bob;
  localAvatar.rotation.y = player.yaw;

  const parts = localAvatar.userData.parts;
  const tuck = m.airPose * 0.16 + m.stance * 0.16;
  parts.legL.rotation.x += (swing + tuck - m.slidePose * 0.72 - parts.legL.rotation.x) * k;
  parts.legR.rotation.x += (-swing + tuck + m.slidePose * 0.42 - parts.legR.rotation.x) * k;
  const hasWeaponPose = typeof updateAvatarWeaponPose === 'function';
  if (!hasWeaponPose || !combatMode || !alive || !localAvatar.userData.gun) {
    parts.armL.rotation.x += (-swing * 0.85 - parts.armL.rotation.x) * k;
    parts.armR.rotation.x += (swing * 0.85 - parts.armR.rotation.x) * k;
  }
  // Sneaking is a stance/speed change; the collision and network body stays PH tall.
  const drop = m.stance * 0.12 + m.slidePose * 0.12;
  parts.head.position.y = 1.34 - drop;
  parts.armL.position.y = parts.armR.position.y = 1.3 - drop;
  if (parts.torso) {
    parts.torso.position.y = 0.72 - drop * 0.65;
    parts.torso.rotation.x += (-m.stance * 0.16 + m.slidePose * 0.22 - parts.torso.rotation.x) * k;
  }
  parts.head.rotation.x += (player.pitch * 0.55 - parts.head.rotation.x) * k;
  parts.head.rotation.y = 0;

  if (hasWeaponPose) updateAvatarWeaponPose(localAvatar, {
    pitch: player.pitch,
    aim: gun.aiming,
    firing: gun.trigger || gun.firePose > 0,
    reload: gun.reloading > 0 ? Math.max(0, Math.min(1, 1 - gun.reloading / Math.max(0.001, gun.reloadTotal))) : -1,
    weapon: currentWeapon().id,
    combat: combatMode,
    alive,
    kick: gun.kick
  }, dt);
}

function updateCamera(dt = 1 / 60) {
  dt = playerDt(dt);
  const m = playerMotion;
  const reduced = playerReducedMotion && playerReducedMotion.matches;
  const scoped = typeof isScopeActive === 'function' && isScopeActive();
  const eyeDrop = (player.crouching ? 0.14 : 0) + (player.sliding ? 0.12 : 0);
  m.eyeDrop += (eyeDrop - m.eyeDrop) * playerAlpha(reduced ? 24 : 16, dt);
  const eyeY = player.pos.y + 1.62 - m.eyeDrop;
  const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
  const fx = -Math.sin(player.yaw) * cp;
  const fy = sp;
  const fz = -Math.cos(player.yaw) * cp;

  // Normal third person is over the right shoulder. Sweep the entire offset,
  // including its lateral/vertical framing, rather than adding it after collision.
  // Follow the actual body, never its gait bob. The view direction is always raw.
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
  camera.updateMatrixWorld(true);
  if (localAvatar) localAvatar.visible = thirdPerson && !scoped && m.cameraDistance > 1.15;
}

const keys = Object.create(null);
const SOLID_AT = (x, y, z) => {
  const b = getBlock(x, y, z);
  return b !== AIR && b !== WATER;
};

function collides(px, py, pz) {
  const minX = Math.floor(px - PW + PLAYER_EPS), maxX = Math.floor(px + PW - PLAYER_EPS);
  const minY = Math.floor(py + PLAYER_EPS), maxY = Math.floor(py + PH - PLAYER_EPS);
  const minZ = Math.floor(pz - PW + PLAYER_EPS), maxZ = Math.floor(pz + PW - PLAYER_EPS);
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        if (SOLID_AT(x, y, z)) return true;
  return false;
}

function moveAxis(axis, amount) {
  if (!Number.isFinite(amount) || amount === 0) return false;
  const p = player.pos;
  const ex = p.x + (axis === 'x' ? amount : 0);
  const ey = p.y + (axis === 'y' ? amount : 0);
  const ez = p.z + (axis === 'z' ? amount : 0);
  const minX = Math.floor(Math.min(p.x, ex) - PW + PLAYER_EPS);
  const maxX = Math.floor(Math.max(p.x, ex) + PW - PLAYER_EPS);
  const minY = Math.floor(Math.min(p.y, ey) + PLAYER_EPS);
  const maxY = Math.floor(Math.max(p.y, ey) + PH - PLAYER_EPS);
  const minZ = Math.floor(Math.min(p.z, ez) - PW + PLAYER_EPS);
  const maxZ = Math.floor(Math.max(p.z, ez) + PW - PLAYER_EPS);
  const edge = p[axis] + (axis === 'y' ? (amount > 0 ? PH : 0) : (amount > 0 ? PW : -PW));
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
  let height = -Infinity;
  for (let x = Math.floor(px - w + PLAYER_EPS); x <= Math.floor(px + w - PLAYER_EPS); x++)
    for (let z = Math.floor(pz - w + PLAYER_EPS); z <= Math.floor(pz + w - PLAYER_EPS); z++)
      for (let y = Math.floor(py - 0.045); y <= Math.floor(py - PLAYER_EPS); y++) {
        if (y + 1 <= py + PLAYER_EPS && SOLID_AT(x, y, z)) height = Math.max(height, y + 1);
      }
  return height;
}

function sneakDisplacement(axis, amount) {
  if (!amount) return 0;
  const p = player.pos;
  // If sneak is pressed on the last sliver of an edge, still allow retreat.
  const inset = Number.isFinite(playerSupportHeight(p.x, p.y, p.z, 0.05)) ? 0.05 : 0;
  const supported = (d) => Number.isFinite(playerSupportHeight(
    p.x + (axis === 'x' ? d : 0), p.y, p.z + (axis === 'z' ? d : 0), inset));
  let safe = 0;
  const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.1));
  for (let i = 1; i <= steps; i++) {
    const next = amount * i / steps;
    if (supported(next)) { safe = next; continue; }
    let unsafe = next;
    for (let j = 0; j < 9; j++) {
      const mid = (safe + unsafe) * 0.5;
      if (supported(mid)) safe = mid;
      else unsafe = mid;
    }
    return safe;
  }
  return amount;
}

function playerGravity(dt, gravity, terminal) {
  const start = Math.max(-terminal, player.vel.y);
  const fallTime = Math.min(dt, Math.max(0, (start + terminal) / gravity));
  player.vel.y = Math.max(-terminal, start - gravity * dt);
  return start * fallTime - 0.5 * gravity * fallTime * fallTime - terminal * (dt - fallTime);
}

function consumePlayerJump() {
  playerMotion.jumpBuffer = playerMotion.coyote = playerMotion.slideTime = 0;
  player.vel.y = JUMP_V;
  player.onGround = false;
}

function isInWater() {
  const b1 = getBlock(player.pos.x, player.pos.y + 0.15, player.pos.z);
  const b2 = getBlock(player.pos.x, player.pos.y + 1.45, player.pos.z);
  return b1 === WATER || b2 === WATER;
}

function updatePlayer(dt) {
  if (!alive) { resetPlayerMotion(); return; }
  dt = playerDt(dt);
  if (dt <= 0) return;
  const m = playerMotion;
  const v = player.vel;
  if (jumpQueued) { m.jumpBuffer = JUMP_BUFFER; jumpQueued = false; }
  const crouch = !!(keys['ControlLeft'] || keys['ControlRight']);
  const shift = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  const crouchPressed = crouch && !m.crouchDown;
  m.crouchDown = crouch;

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

  // Small bounded physics slices resolve contacts/input windows without delaying input.
  for (let i = 0; i < steps; i++) {
    const inWater = isInWater();
    player.swimming = inWater && !player.fly;
    player.crouching = crouch && !player.fly && !inWater;
    const support = playerSupportHeight(player.pos.x, player.pos.y, player.pos.z);
    player.onGround = !player.fly && v.y <= 0 && Number.isFinite(support);
    if (player.onGround) { player.pos.y = support; v.y = 0; }

    if (player.fly || inWater) {
      m.jumpBuffer = m.coyote = m.slideTime = 0;
    } else {
      m.coyote = player.onGround ? COYOTE_TIME : Math.max(0, m.coyote - h);
    }
    if (i === 0 && crouchPressed && shift && player.onGround && !inWater && !player.fly &&
        inputLength > 0 && Math.hypot(v.x, v.z) > SPRINT * 0.78 && m.slideCooldown <= 0 && m.jumpBuffer <= 0) {
      const boost = Math.max(1, 8.6 / Math.hypot(v.x, v.z));
      v.x *= boost; v.z *= boost;
      m.slideTime = 0.55;
      m.slideCooldown = 1;
    }
    if (!crouch || !player.onGround) m.slideTime = 0;
    if (m.jumpBuffer > 0 && m.coyote > 0 && !player.fly && !inWater) consumePlayerJump();
    player.sliding = m.slideTime > 0;

    const sprinting = shift && inputLength > 0 && !player.crouching && !inWater;
    const speed = player.fly ? (shift ? FLY * 1.7 : FLY)
      : inWater ? WALK * 0.72 : player.crouching ? SNEAK : sprinting ? SPRINT : WALK;
    const tx = player.sliding ? 0 : wx * speed;
    const tz = player.sliding ? 0 : wz * speed;
    const reversing = v.x * wx + v.z * wz < -0.1;
    const rate = player.sliding ? 2.4 : player.fly ? 11 : inWater ? 9
      : player.onGround ? (!inputLength || reversing || crouch ? 30 : 22) : (inputLength ? 6.5 : 1.5);
    const k = playerAlpha(rate, h);
    // Integrate exponential damping analytically, including distance travelled.
    let mx = tx * h + (v.x - tx) * k / rate;
    let mz = tz * h + (v.z - tz) * k / rate;
    v.x += (tx - v.x) * k;
    v.z += (tz - v.z) * k;

    let my = 0;
    if (player.fly) {
      // Keep legacy Shift descent; Ctrl is also a descent key in flight.
      const targetY = ((keys['Space'] ? 1 : 0) - (shift || crouch ? 1 : 0)) * FLY;
      const ky = playerAlpha(11, h);
      my = targetY * h + (v.y - targetY) * ky / 11;
      v.y += (targetY - v.y) * ky;
    } else if (inWater && (keys['Space'] || crouch)) {
      const targetY = keys['Space'] ? 4.4 : -3.4;
      const ky = playerAlpha(12, h);
      my = targetY * h + (v.y - targetY) * ky / 12;
      v.y += (targetY - v.y) * ky;
    } else if (!player.onGround) {
      my = playerGravity(h, inWater ? GRAVITY * 0.22 : GRAVITY, inWater ? 3.4 : 56);
    }

    if (moveAxis('y', my)) {
      player.onGround = my < 0 && !player.fly;
      v.y = 0;
      if (player.onGround && m.jumpBuffer > 0 && !inWater) consumePlayerJump();
    } else if (my > 0) player.onGround = false;

    const protectEdge = player.crouching && player.onGround;
    const startX = player.pos.x, startZ = player.pos.z;
    if (protectEdge) {
      const safeX = sneakDisplacement('x', mx);
      if (Math.abs(safeX - mx) > PLAYER_EPS) { v.x = 0; m.slideTime = 0; }
      mx = safeX;
    }
    if (moveAxis('x', mx)) { v.x = 0; m.slideTime = 0; }
    if (protectEdge) {
      const safeZ = sneakDisplacement('z', mz);
      if (Math.abs(safeZ - mz) > PLAYER_EPS) { v.z = 0; m.slideTime = 0; }
      mz = safeZ;
    }
    if (moveAxis('z', mz)) { v.z = 0; m.slideTime = 0; }
    const boundX = Math.max(1.2, Math.min(WORLD - 1.2, player.pos.x));
    const boundZ = Math.max(1.2, Math.min(WORLD - 1.2, player.pos.z));
    if (boundX !== player.pos.x) { player.pos.x = boundX; v.x = 0; }
    if (boundZ !== player.pos.z) { player.pos.z = boundZ; v.z = 0; }
    if (player.onGround && !Number.isFinite(playerSupportHeight(player.pos.x, player.pos.y, player.pos.z))) player.onGround = false;
    const travelled = Math.hypot(player.pos.x - startX, player.pos.z - startZ);
    distance += travelled;
    stride += travelled * (player.onGround && !player.sliding ? 1 : 0.2);
    m.jumpBuffer = Math.max(0, m.jumpBuffer - h);
    m.slideTime = Math.max(0, m.slideTime - h);
    m.slideCooldown = Math.max(0, m.slideCooldown - h);
  }
  player.sliding = m.slideTime > 0;
  player.sprinting = shift && !player.crouching && !player.swimming && !player.fly && distance / dt > WALK * 0.75;
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
    (player.pos.y + 1.62 - playerMotion.eyeDrop - origin.y) * dir.y + (player.pos.z - origin.z) * dir.z);
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
           by + 1 <= p.y || by >= p.y + PH ||
           bz + 1 <= p.z - PW || bz >= p.z + PW);
}

function canPlacePlayerBlock(x, y, z) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) ||
      y < 1 || y >= HEIGHT || x < 0 || x >= WORLD || z < 0 || z >= WORLD) return false;
  const current = getBlock(x, y, z);
  return (current === AIR || current === WATER) && !blockIntersectsPlayer(x, y, z);
}

function blockPlacementPathClear(origin, point) {
  const dx = point.x - origin.x, dy = point.y - origin.y, dz = point.z - origin.z;
  const distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance)) return false;
  if (distance <= PLAYER_EPS) return true;
  return !raycastVoxel(distance - PLAYER_EPS, origin, new THREE.Vector3(dx / distance, dy / distance, dz / distance));
}

function floatingBlockTarget() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const point = blockReachOrigin(dir).addScaledVector(dir, Math.min(FLOATING_BLOCK_DISTANCE, REACH));
  const target = { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z) };
  if (!canPlacePlayerBlock(target.x, target.y, target.z)) return null;
  const eye = new THREE.Vector3(player.pos.x, player.pos.y + 1.62 - playerMotion.eyeDrop, player.pos.z);
  if (Math.hypot(target.x + 0.5 - eye.x, target.y + 0.5 - eye.y, target.z + 0.5 - eye.z) > REACH) return null;
  // Shoulder peeking must not place through nearby cover. Check both the real
  // eye's reach path and the full camera ray, including its skipped boom section.
  if (!blockPlacementPathClear(eye, point) || !blockPlacementPathClear(camera.position, point)) return null;
  return target;
}

function breakBlock() {
  const hit = raycastVoxel(REACH);
  if (!hit || hit.y <= 0) return;
  const broken = getBlock(hit.x, hit.y, hit.z);
  setBlock(hit.x, hit.y, hit.z, AIR);
  markDirty(hit.x, hit.z);
  if (broken && broken !== WATER) {
    addItem(broken, 1);
    toast('+' + (BLOCK_DEFS[broken] ? BLOCK_DEFS[broken].name : 'Block'));
  }
  if (window.__netEdit) window.__netEdit(hit.x, hit.y, hit.z, AIR);
}

function placeBlock() {
  const hit = raycastVoxel(REACH);
  const target = hit ? { x: hit.x + hit.nx, y: hit.y + hit.ny, z: hit.z + hit.nz } : floatingBlockTarget();
  if (!target || !canPlacePlayerBlock(target.x, target.y, target.z)) return;
  const tx = target.x, ty = target.y, tz = target.z;
  const type = HOTBAR[selected];
  if (buildItemCount(type) <= 0 || !takeBuildItems(type, 1)) {
    toast('No ' + (BLOCK_DEFS[type] ? BLOCK_DEFS[type].name : 'blocks') + ' left — craft or mine more');
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
