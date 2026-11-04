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
const FLY = 14;
const REACH = 6.5;

const player = {
  pos: new THREE.Vector3(WORLD / 2 + 0.5, 40, WORLD / 2 + 0.5),
  vel: new THREE.Vector3(),
  onGround: false,
  fly: false,
  yaw: Math.PI * 0.25,
  pitch: -0.15,
  groundSpeed: 0,
  walkPhase: 0
};

let jumpQueued = false;

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
  if (isSolidPoint(x, y, z)) return true;
  const o = 0.22;
  return isSolidPoint(x + o, y, z) || isSolidPoint(x - o, y, z) ||
         isSolidPoint(x, y, z + o) || isSolidPoint(x, y, z - o) ||
         isSolidPoint(x, y + o, z);
};

function updateAvatar(dt) {
  if (!localAvatar) return;
  localAvatar.position.set(player.pos.x, player.pos.y, player.pos.z);
  localAvatar.rotation.y = player.yaw;

  const parts = localAvatar.userData.parts;
  const moving = player.groundSpeed > 0.7;
  const amp = moving ? Math.min(1, player.groundSpeed / 4.6) * 0.82 : 0;
  const swing = Math.sin(player.walkPhase) * amp;
  const k = Math.min(1, dt * 12);
  parts.legL.rotation.x += (swing - parts.legL.rotation.x) * k;
  parts.legR.rotation.x += (-swing - parts.legR.rotation.x) * k;
  parts.armL.rotation.x += (-swing * 0.85 - parts.armL.rotation.x) * k;
  parts.armR.rotation.x += (swing * 0.85 - parts.armR.rotation.x) * k;
  if (localAvatar.userData.gun) {
    const aim = combatMode && gun.aiming && alive;
    const targetR = aim ? Math.PI / 2 - 0.05 : 0.12;
    const targetL = aim ? Math.PI / 2 - 0.16 : -swing * 0.85;
    const hk = Math.min(1, dt * 15);
    parts.armR.rotation.x += (targetR - parts.armR.rotation.x) * hk;
    parts.armL.rotation.x += (targetL - parts.armL.rotation.x) * hk;
  }
  parts.head.rotation.x += (-player.pitch * 0.3 - parts.head.rotation.x) * k;
  parts.head.rotation.y = 0;
  localAvatar.position.y += Math.abs(Math.sin(player.walkPhase)) * (moving ? 0.035 : 0);
}

function updateCamera() {
  const eyeY = player.pos.y + 1.62;
  const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
  const fx = -Math.sin(player.yaw) * cp;
  const fy = sp;
  const fz = -Math.cos(player.yaw) * cp;

  if (!thirdPerson) {
    camera.position.set(player.pos.x, eyeY, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    if (localAvatar) localAvatar.visible = false;
    return;
  }

  const maxDist = 4.6;
  let dist = maxDist;
  for (let i = 2; i <= 30; i++) {
    const t = (maxDist * i) / 30;
    if (cameraBlocked(player.pos.x - fx * t, eyeY - fy * t + 0.3, player.pos.z - fz * t)) {
      dist = Math.max(0.85, t - 0.55);
      break;
    }
  }
  camera.position.set(player.pos.x - fx * dist, eyeY - fy * dist + 0.3, player.pos.z - fz * dist);
  camera.rotation.set(player.pitch, player.yaw, 0);
  if (localAvatar) localAvatar.visible = dist > 1.35;
}

const keys = Object.create(null);
const SOLID_AT = (x, y, z) => {
  const b = getBlock(x, y, z);
  return b !== AIR && b !== WATER;
};

function collides(px, py, pz) {
  const minX = Math.floor(px - PW), maxX = Math.floor(px + PW);
  const minY = Math.floor(py + 0.001), maxY = Math.floor(py + PH - 0.001);
  const minZ = Math.floor(pz - PW), maxZ = Math.floor(pz + PW);
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        if (SOLID_AT(x, y, z)) return true;
  return false;
}

function moveAxis(axis, amount) {
  if (amount === 0) return false;
  const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.2));
  const d = amount / steps;
  for (let i = 0; i < steps; i++) {
    player.pos[axis] += d;
    if (collides(player.pos.x, player.pos.y, player.pos.z)) {
      player.pos[axis] -= d;
      return true;
    }
  }
  return false;
}

function isInWater() {
  const b1 = getBlock(player.pos.x, player.pos.y + 0.15, player.pos.z);
  const b2 = getBlock(player.pos.x, player.pos.y + 1.45, player.pos.z);
  return b1 === WATER || b2 === WATER;
}

function updatePlayer(dt) {
  if (!alive) { player.vel.set(0, 0, 0); player.groundSpeed = 0; return; }
  const v = player.vel;
  const inWater = isInWater();

  let ix = 0, iz = 0;
  if (keys['KeyW']) iz += 1;
  if (keys['KeyS']) iz -= 1;
  if (keys['KeyD']) ix += 1;
  if (keys['KeyA']) ix -= 1;

  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const wx = -sy * iz + cy * ix;
  const wz = -cy * iz - sy * ix;
  let wl = Math.hypot(wx, wz);
  if (wl > 0) { wl = 1 / wl; }

  const sprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && !inWater;
  const speed = player.fly ? (sprinting ? FLY * 1.7 : FLY) : (inWater ? WALK * 0.72 : (sprinting ? SPRINT : WALK));
  const tx = wx * wl * speed;
  const tz = wz * wl * speed;

  const accel = player.fly ? 11 : (player.onGround ? 17 : 6.5);
  const k = Math.min(1, accel * dt);
  v.x += (tx - v.x) * k;
  v.z += (tz - v.z) * k;

  if (player.fly) {
    let targetY = 0;
    if (keys['Space']) targetY += FLY;
    if (keys['ShiftLeft'] || keys['ShiftRight']) targetY -= FLY;
    v.y += (targetY - v.y) * Math.min(1, 11 * dt);
  } else if (inWater) {
    v.y -= GRAVITY * 0.22 * dt;
    v.y = Math.max(v.y, -3.4);
    if (keys['Space']) v.y = 4.4;
    if (jumpQueued) jumpQueued = false;
  } else {
    v.y -= GRAVITY * dt;
    if (v.y < -56) v.y = -56;
    if (jumpQueued) {
      if (player.onGround) { v.y = JUMP_V; player.onGround = false; }
      jumpQueued = false;
    }
  }

  player.onGround = false;
  if (moveAxis('y', v.y * dt)) {
    if (v.y < 0) player.onGround = true;
    v.y = 0;
  }
  if (moveAxis('x', v.x * dt)) v.x = 0;
  if (moveAxis('z', v.z * dt)) v.z = 0;

  player.pos.x = Math.max(1.2, Math.min(WORLD - 1.2, player.pos.x));
  player.pos.z = Math.max(1.2, Math.min(WORLD - 1.2, player.pos.z));
  if (player.pos.y < -10) respawn();
  jumpQueued = false;

  player.groundSpeed = player.onGround ? Math.hypot(v.x, v.z) : Math.hypot(v.x, v.z) * 0.45;
  if (player.groundSpeed > 0.6) player.walkPhase += dt * (3.2 + player.groundSpeed * 1.35);
}

/* ---------------- block picking ---------------- */
function raycastVoxel(maxDist, originArg, dirArg) {
  const origin = originArg || camera.position;
  const dir = dirArg || camera.getWorldDirection(new THREE.Vector3());

  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
  const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
  const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

  const tdx = stepX === 0 ? Infinity : Math.abs(1 / dir.x);
  const tdy = stepY === 0 ? Infinity : Math.abs(1 / dir.y);
  const tdz = stepZ === 0 ? Infinity : Math.abs(1 / dir.z);

  let tmx = stepX === 0 ? Infinity : (stepX > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tdx;
  let tmy = stepY === 0 ? Infinity : (stepY > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tdy;
  let tmz = stepZ === 0 ? Infinity : (stepZ > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tdz;

  let nx = 0, ny = 0, nz = 0, t = 0;

  for (let i = 0; i < 256; i++) {
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
  if (hovered) {
    highlight.visible = true;
    highlight.position.set(hovered.x + 0.5, hovered.y + 0.5, hovered.z + 0.5);
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
  if (!hit) return;
  const tx = hit.x + hit.nx, ty = hit.y + hit.ny, tz = hit.z + hit.nz;
  if (ty < 1 || ty >= HEIGHT || tx < 0 || tx >= WORLD || tz < 0 || tz >= WORLD) return;
  const current = getBlock(tx, ty, tz);
  if (current !== AIR && current !== WATER) return;
  if (blockIntersectsPlayer(tx, ty, tz)) return;
  const type = HOTBAR[selected];
  if (itemCount(type) <= 0) {
    toast('No ' + (BLOCK_DEFS[type] ? BLOCK_DEFS[type].name : 'blocks') + ' left — craft or mine more');
    return;
  }
  setBlock(tx, ty, tz, type);
  takeItem(type, 1);
  markDirty(tx, tz);
  if (window.__netEdit) window.__netEdit(tx, ty, tz, type);
}

function respawn() {
  const spawn = findSpawn();
  player.pos.set(spawn.x, spawn.y, spawn.z);
  player.vel.set(0, 0, 0);
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
