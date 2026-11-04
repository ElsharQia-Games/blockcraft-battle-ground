/* Blockcraft Battle Ground — Weapons, gun models, audio, effects, hit tests, health, death and respawn.
   60-combat.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ============================================================
   Guns, health & combat
   ============================================================ */

const WEAPONS = [
  { id: 'pistol',  name: 'Pistol',  damage: 26, rpm: 330, mag: 12, spread: 0.008, recoil: 0.026, range: 90,  pellets: 1, auto: false, reload: 1.15, sound: 0.55 },
  { id: 'rifle',   name: 'Rifle',   damage: 17, rpm: 640, mag: 30, spread: 0.014, recoil: 0.013, range: 130, pellets: 1, auto: true,  reload: 1.85, sound: 0.42 },
  { id: 'shotgun', name: 'Shotgun', damage: 10, rpm: 78,  mag: 6,  spread: 0.075, recoil: 0.07,  range: 36,  pellets: 8, auto: false, reload: 2.35, sound: 0.8 }
];
const WEAPON_BY_ID = Object.create(null);
for (const w of WEAPONS) WEAPON_BY_ID[w.id] = w;

const gun = {
  index: 0,
  ammo: WEAPONS.map((w) => w.mag),
  cooldown: 0,
  reloading: 0,
  reloadTotal: 1,
  aiming: false,
  trigger: false,
  kick: 0,
  sway: 0
};

const MAX_HEALTH = 100;
let health = MAX_HEALTH;
let alive = true;
let lastDamageAt = -9999;
let respawnAt = 0;
let kills = 0;
let deaths = 0;
let combatMode = true;
let muted = false;

const healthFillEl = document.getElementById('healthFill');
const healthNumEl = document.getElementById('healthNum');
const kdEl = document.getElementById('kd');
const ammoNowEl = document.getElementById('ammoNow');
const ammoLineEl = document.getElementById('ammoLine');
const weaponNameEl = document.getElementById('weaponName');
const reloadBarEl = document.getElementById('reloadBar');
const reloadFillEl = document.getElementById('reloadFill');
const dotsEl = document.getElementById('weaponDots');
const killfeedEl = document.getElementById('killfeed');
const hitmarkerEl = document.getElementById('hitmarker');
const hurtEl = document.getElementById('hurt');
const deathEl = document.getElementById('death');
const respawnInEl = document.getElementById('respawnIn');

const currentWeapon = () => WEAPONS[gun.index];
const safeName = (v) => String(v == null ? '' : v).replace(/[^\w \-'.]/g, '').trim().slice(0, 14) || '???';

function setHealth(v) {
  health = Math.max(0, Math.min(MAX_HEALTH, v));
  const pct = (health / MAX_HEALTH) * 100;
  if (healthFillEl) {
    healthFillEl.style.width = pct + '%';
    healthFillEl.classList.toggle('low', health <= 35);
  }
  if (healthNumEl) healthNumEl.textContent = String(Math.ceil(health));
}

function setKd() {
  if (kdEl) kdEl.textContent = kills + ' K · ' + deaths + ' D';
}

function updateCombatHud() {
  const w = currentWeapon();
  if (weaponNameEl) weaponNameEl.textContent = w.name;
  if (ammoNowEl) ammoNowEl.textContent = String(gun.ammo[gun.index]);
  if (ammoLineEl) ammoLineEl.classList.toggle('low', gun.ammo[gun.index] <= Math.ceil(w.mag * 0.25));
  if (reloadBarEl) reloadBarEl.classList.toggle('on', gun.reloading > 0);
  if (reloadFillEl && gun.reloading > 0) {
    reloadFillEl.style.width = Math.max(0, Math.min(1, 1 - gun.reloading / gun.reloadTotal)) * 100 + '%';
  }
  if (dotsEl) {
    [...dotsEl.children].forEach((d, i) => d.classList.toggle('on', i === gun.index));
  }
  setHealth(health);
  setKd();
}

/* ---------------- gun models ---------------- */
function makeGunModel(id) {
  const root = new THREE.Group();
  const dark = '#262a2f';
  const metal = '#3b4148';
  const wood = '#6b4726';
  let muzzleZ = -0.5;

  if (id === 'rifle') {
    addBox(root, 0.085, 0.1, 0.46, metal, 0, 0.01, 0.02);
    addBox(root, 0.048, 0.048, 0.5, dark, 0, 0.03, -0.45);
    addBox(root, 0.055, 0.055, 0.09, '#15181b', 0, 0.03, -0.72);
    addBox(root, 0.07, 0.13, 0.24, wood, 0, -0.02, 0.35);
    addBox(root, 0.06, 0.19, 0.1, dark, 0, -0.13, 0.03);
    addBox(root, 0.055, 0.16, 0.08, '#33241a', 0, -0.13, 0.16);
    addBox(root, 0.05, 0.05, 0.14, dark, 0, 0.09, 0.05);
    addBox(root, 0.022, 0.05, 0.022, dark, 0, 0.13, -0.16);
    glowBox(root, 0.016, 0.016, 0.016, '#ff5d3c', 0, 0.13, -0.16);
    muzzleZ = -0.78;
  } else if (id === 'shotgun') {
    addBox(root, 0.1, 0.11, 0.42, metal, 0, 0.01, 0.02);
    addBox(root, 0.058, 0.058, 0.58, dark, 0, 0.04, -0.46);
    addBox(root, 0.078, 0.06, 0.24, '#4a3524', 0, -0.03, 0.31);
    addBox(root, 0.07, 0.075, 0.26, '#5b3d25', 0, -0.02, -0.28);
    addBox(root, 0.055, 0.17, 0.09, '#33241a', 0, -0.12, 0.12);
    addBox(root, 0.052, 0.05, 0.16, dark, 0, 0.09, 0.04);
    glowBox(root, 0.018, 0.018, 0.018, '#ffb03c', 0, 0.09, 0.12);
    muzzleZ = -0.76;
  } else {
    addBox(root, 0.095, 0.12, 0.34, metal, 0, 0.02, 0.02);
    addBox(root, 0.055, 0.055, 0.22, dark, 0, 0.045, -0.28);
    addBox(root, 0.045, 0.045, 0.05, '#15181b', 0, 0.045, -0.4);
    addBox(root, 0.075, 0.19, 0.11, '#33241a', 0, -0.12, 0.11);
    addBox(root, 0.05, 0.05, 0.12, dark, 0, 0.09, 0.06);
    glowBox(root, 0.015, 0.015, 0.015, '#ffdd66', 0, 0.11, -0.06);
    muzzleZ = -0.45;
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.045, muzzleZ);
  root.add(muzzle);
  root.userData.muzzle = muzzle;
  return root;
}

/* first-person viewmodel */
const vmRoot = new THREE.Group();
camera.add(vmRoot);
scene.add(camera);
let viewGun = null;
let viewGunId = '';

function buildViewGun(id) {
  for (let i = vmRoot.children.length - 1; i >= 0; i--) vmRoot.remove(vmRoot.children[i]);
  const g = makeGunModel(id);
  const sc = id === 'shotgun' ? 1.02 : 0.95;
  g.scale.setScalar(sc);
  g.position.set(0.27, -0.27, -0.56);
  g.rotation.set(0.03, 0.03, 0);
  vmRoot.add(g);
  viewGun = g;
  viewGunId = id;
}

/* third-person gun held in the right hand */
function attachAvatarGun(avatar, weaponId) {
  if (!avatar) return null;
  const parts = avatar.userData.parts;
  if (!parts || !parts.armR) return null;
  if (avatar.userData.gun) {
    parts.armR.remove(avatar.userData.gun);
    avatar.userData.gun = null;
  }
  const g = makeGunModel(weaponId);
  g.position.set(0.02, -0.62, -0.02);
  g.rotation.x = -Math.PI / 2;
  parts.armR.add(g);
  avatar.userData.gun = g;
  return g;
}

function refreshGunModels() {
  const id = currentWeapon().id;
  if (localAvatar) attachAvatarGun(localAvatar, id);
  buildViewGun(id);
  updateCombatHud();
}

/* ---------------- audio ---------------- */
let actx = null;
const shotBuffers = new Map();

function audio() {
  if (muted) return null;
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function shotBuffer(ctx, w) {
  let buf = shotBuffers.get(w.id);
  if (buf) return buf;
  const dur = w.id === 'shotgun' ? 0.3 : w.id === 'rifle' ? 0.12 : 0.17;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const p = i / len;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - p, w.id === 'shotgun' ? 2 : 3);
  }
  shotBuffers.set(w.id, buf);
  return buf;
}

function playShot(w, vol) {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const dur = w.id === 'shotgun' ? 0.3 : w.id === 'rifle' ? 0.12 : 0.17;
  const src = ctx.createBufferSource();
  src.buffer = shotBuffer(ctx, w);
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = w.id === 'shotgun' ? 850 : w.id === 'pistol' ? 1800 : 2200;
  const gain = ctx.createGain();
  gain.gain.value = (w.sound || 0.5) * (vol == null ? 1 : vol);
  src.connect(flt).connect(gain).connect(ctx.destination);
  src.start(t);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(w.id === 'shotgun' ? 105 : 158, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + dur);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.22 * (vol == null ? 1 : vol), t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(og).connect(ctx.destination);
  osc.start(t); osc.stop(t + dur);
}

function playTone(freq, dur, type, vol) {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.55), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol == null ? 0.12 : vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur);
}

/* ---------------- muzzle flash, tracers & impacts ---------------- */
const flashTex = (() => {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,235,1)');
  grd.addColorStop(0.28, 'rgba(255,214,120,0.95)');
  grd.addColorStop(0.65, 'rgba(255,140,40,0.4)');
  grd.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
const muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({
  map: flashTex, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending,
  depthWrite: false, toneMapped: false
}));
muzzleFlash.visible = false;
muzzleFlash.scale.set(0.72, 0.72, 1);
scene.add(muzzleFlash);
const muzzleLight = new THREE.PointLight(0xffb257, 0, 14, 2);
scene.add(muzzleLight);
let flashLife = 0;

const tracers = [];
function addTracer(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  scene.add(line);
  tracers.push({ line, mat, life: 0.09, max: 0.09 });
}

const PARTICLE_GEO = new THREE.BoxGeometry(0.055, 0.055, 0.055);
const PARTICLE_MATS = new Map();
const particles = [];
function particleMat(color) {
  let m = PARTICLE_MATS.get(color);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, toneMapped: false }); PARTICLE_MATS.set(color, m); }
  return m;
}
function addImpact(point, color) {
  const n = 6;
  for (let i = 0; i < n; i++) {
    if (particles.length > 160) break;
    const mesh = new THREE.Mesh(PARTICLE_GEO, particleMat(color));
    mesh.position.copy(point);
    scene.add(mesh);
    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 5.5,
      vy: Math.random() * 4.5 + 0.5,
      vz: (Math.random() - 0.5) * 5.5,
      life: 0.35 + Math.random() * 0.25,
      max: 0.6
    });
  }
}

function muzzleBurst() {
  const src = (!thirdPerson && viewGun) ? viewGun : (localAvatar && localAvatar.userData.gun);
  let pos;
  if (src) {
    pos = new THREE.Vector3();
    src.userData.muzzle.getWorldPosition(pos);
  } else {
    pos = camera.position.clone();
    const d = camera.getWorldDirection(new THREE.Vector3());
    pos.addScaledVector(d, 0.9);
  }
  muzzleFlash.position.copy(pos);
  muzzleFlash.scale.setScalar(0.55 + Math.random() * 0.4);
  muzzleFlash.material.rotation = Math.random() * Math.PI * 2;
  muzzleFlash.visible = true;
  muzzleLight.position.copy(pos);
  muzzleLight.intensity = 2.8;
  flashLife = 0.055;
}

function updateFx(dt) {
  if (flashLife > 0) {
    flashLife -= dt;
    if (flashLife <= 0) { muzzleFlash.visible = false; muzzleLight.intensity = 0; }
    else muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 45);
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    t.mat.opacity = Math.max(0, t.life / t.max) * 0.9;
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      t.mat.dispose();
      tracers.splice(i, 1);
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.vy -= 16 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += dt * 8;
    p.mesh.rotation.y += dt * 6;
    const s = Math.max(0.05, p.life / p.max);
    p.mesh.scale.setScalar(s);
  }
  if (hurtEl) {
    const o = parseFloat(hurtEl.style.opacity || '0');
    if (o > 0) hurtEl.style.opacity = String(Math.max(0, o - dt * 1.6));
  }
}

/* ---------------- hit tests ---------------- */
function rayBox(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ) {
  let tmin = 0, tmax = Infinity;
  const axes = [[ox, dx, minX, maxX], [oy, dy, minY, maxY], [oz, dz, minZ, maxZ]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return -1;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  return tmax < 0 ? -1 : tmin;
}

function raycastRemote(ox, oy, oz, dx, dy, dz, maxDist) {
  let best = null;
  if (!net || !net.players) return null;
  const now = performance.now();
  for (const r of net.players.values()) {
    if (r.deadUntil && r.deadUntil > now) continue;
    if (r.group && !r.group.visible) continue;
    const body = rayBox(ox, oy, oz, dx, dy, dz,
      r.x - 0.3, r.y + 0.05, r.z - 0.3, r.x + 0.3, r.y + 1.46, r.z + 0.3);
    const head = rayBox(ox, oy, oz, dx, dy, dz,
      r.x - 0.24, r.y + 1.46, r.z - 0.24, r.x + 0.24, r.y + 1.9, r.z + 0.24);
    if (body >= 0 && body <= maxDist && (!best || body < best.t)) best = { r, t: body, head: false };
    if (head >= 0 && head <= maxDist && (!best || head < best.t)) best = { r, t: head, head: true };
  }
  return best;
}

/* ---------------- shooting ---------------- */
function flashHitmarker(head) {
  if (!hitmarkerEl) return;
  hitmarkerEl.classList.remove('show');
  void hitmarkerEl.offsetWidth;
  hitmarkerEl.classList.add('show');
  hitmarkerEl.style.filter = head ? 'drop-shadow(0 0 7px #ffb03c)' : '';
  playTone(head ? 1180 : 860, 0.06, 'triangle', 0.07);
}

function startReload() {
  if (!alive) return;
  const w = currentWeapon();
  if (gun.reloading > 0 || gun.ammo[gun.index] >= w.mag) return;
  gun.reloading = w.reload;
  gun.reloadTotal = w.reload;
  gun.trigger = false;
  playTone(300, 0.05, 'square', 0.06);
  updateCombatHud();
}

function fireOnce() {
  if (!alive || loading || craftOpen) return;
  const w = currentWeapon();
  if (gun.cooldown > 0 || gun.reloading > 0) return;
  if (gun.ammo[gun.index] <= 0) { startReload(); return; }
  gun.ammo[gun.index]--;
  gun.cooldown = 60 / w.rpm;
  gun.kick = 1;

  const origin = camera.position.clone();
  const baseDir = camera.getWorldDirection(new THREE.Vector3());
  const helper = Math.abs(baseDir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(baseDir, helper).normalize();
  const up = new THREE.Vector3().crossVectors(right, baseDir).normalize();

  let hitAny = false, hitHead = false;
  for (let i = 0; i < w.pellets; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * w.spread * (gun.aiming ? 0.42 : 1);
    const dir = baseDir.clone()
      .addScaledVector(right, Math.cos(ang) * rad)
      .addScaledVector(up, Math.sin(ang) * rad)
      .normalize();

    const block = raycastVoxel(w.range, origin, dir);
    const blockT = block ? block.dist : w.range;
    const ent = raycastRemote(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, Math.min(blockT, w.range));
    const end = ent
      ? origin.clone().addScaledVector(dir, ent.t)
      : origin.clone().addScaledVector(dir, blockT);

    const from = new THREE.Vector3();
    const src = (!thirdPerson && viewGun) ? viewGun : (localAvatar && localAvatar.userData.gun);
    if (src) src.userData.muzzle.getWorldPosition(from);
    else from.copy(origin).addScaledVector(baseDir, 0.7);
    addTracer(from, end);

    if (ent) {
      hitAny = true;
      if (ent.head) hitHead = true;
      const dmg = Math.round(w.damage * (ent.head ? 2 : 1) * (ent.t > w.range * 0.65 ? 0.8 : 1));
      netSend({ t: 'hit', target: ent.r.id, dmg, head: ent.head, weapon: w.id, byId: net.id, by: playerName });
      addImpact(end, '#b83030');
    } else if (block) {
      addImpact(end, '#cbb593');
    }
  }

  if (hitAny) flashHitmarker(hitHead);
  muzzleBurst();
  playShot(w);
  player.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, player.pitch + w.recoil * (gun.aiming ? 0.7 : 1)));
  netSend({ t: 'shot', weapon: w.id, x: player.pos.x, y: player.pos.y + 1.4, z: player.pos.z });
  updateCombatHud();
}

/* ---------------- damage, death & respawn ---------------- */
function applyDamage(dmg, byName, head, byId) {
  if (!alive) return;
  const amount = Math.max(1, Math.min(120, Number(dmg) || 0));
  health = Math.max(0, health - amount);
  lastDamageAt = performance.now();
  if (hurtEl) hurtEl.style.opacity = String(Math.min(0.9, 0.28 + (1 - health / MAX_HEALTH) * 0.7));
  setHealth(health);
  playTone(head ? 190 : 150, 0.1, 'sawtooth', 0.1);
  if (health <= 0) die(byName, byId);
}

function die(byName, byId) {
  if (!alive) return;
  alive = false;
  deaths++;
  respawnAt = performance.now() + 3200;
  gun.trigger = false;
  gun.aiming = false;
  gun.reloading = 0;
  player.vel.set(0, 0, 0);
  setHealth(0);
  setKd();
  if (deathEl) deathEl.classList.add('show');
  if (respawnInEl) respawnInEl.textContent = '3';
  if (deathEl) deathEl.querySelector('h2').textContent = byName && byName !== '???' ? safeName(byName) + ' got you' : 'Eliminated';
  addKillFeed(byName, playerName);
  if (byId && byId === net.id) { kills++; setKd(); }
  netSend({ t: 'died', id: net.id, victim: playerName, by: safeName(byName), byId: byId || '', weapon: currentWeapon().id });
  playTone(90, 0.5, 'sawtooth', 0.14);
}

function doRespawn() {
  const spawn = findSpawn();
  player.pos.set(spawn.x, spawn.y, spawn.z);
  player.vel.set(0, 0, 0);
  health = MAX_HEALTH;
  alive = true;
  gun.ammo = WEAPONS.map((w) => w.mag);
  gun.reloading = 0;
  gun.cooldown = 0;
  gun.aiming = false;
  lastDamageAt = -9999;
  if (deathEl) deathEl.classList.remove('show');
  if (hurtEl) hurtEl.style.opacity = '0';
  setHealth(health);
  updateCombatHud();
  netSend({
    t: 'respawn', id: net.id, x: player.pos.x, y: player.pos.y, z: player.pos.z,
    yaw: player.yaw, character: charKey, name: playerName, hp: health, weapon: currentWeapon().id
  });
}

function addKillFeed(killer, victim) {
  if (!killfeedEl) return;
  const row = document.createElement('div');
  row.className = 'kf';
  const a = document.createElement('b');
  a.textContent = safeName(killer);
  const mid = document.createElement('i');
  mid.textContent = 'eliminated';
  const b = document.createElement('b');
  b.textContent = safeName(victim);
  row.append(a, mid, b);
  killfeedEl.appendChild(row);
  while (killfeedEl.children.length > 5) killfeedEl.removeChild(killfeedEl.firstChild);
  setTimeout(() => row.remove(), 5200);
}

/* ---------------- weapon selection & modes ---------------- */
function selectWeapon(i) {
  if (i < 0 || i >= WEAPONS.length) return;
  if (gun.index === i) return;
  gun.index = i;
  gun.reloading = 0;
  gun.cooldown = 0.18;
  gun.aiming = false;
  refreshGunModels();
  playTone(420, 0.04, 'square', 0.05);
  netSend({ t: 'state', x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch, character: charKey, name: playerName, weapon: currentWeapon().id, hp: health, aim: 0 });
}

function cycleWeapon() {
  selectWeapon((gun.index + 1) % WEAPONS.length);
}

function setCombatMode(on) {
  combatMode = !!on;
  document.body.classList.toggle('combat', combatMode);
  document.body.classList.toggle('build', !combatMode);
  hintEl.classList.add('hidden');
  gun.trigger = false;
  gun.aiming = false;
  if (highlight) highlight.visible = false;
  if (audio()) playTone(combatMode ? 520 : 360, 0.06, 'square', 0.05);
  toast(combatMode ? 'Combat mode — left click shoots' : 'Build mode — mine and place blocks');
}

function toggleMute() {
  muted = !muted;
  toast(muted ? 'Sound muted' : 'Sound on');
}

/* ---------------- per-frame combat update ---------------- */
function updateCombat(dt, now) {
  if (!alive) {
    const left = Math.max(0, respawnAt - now);
    if (respawnInEl) respawnInEl.textContent = String(Math.max(1, Math.ceil(left / 1000)));
    if (left <= 0) doRespawn();
    updateFx(dt);
    if (thirdPerson && localAvatar) {
      localAvatar.rotation.z += (1.35 - localAvatar.rotation.z) * Math.min(1, dt * 4);
      localAvatar.visible = true;
    }
    return;
  }
  if (localAvatar) localAvatar.rotation.z += (0 - localAvatar.rotation.z) * Math.min(1, dt * 8);

  gun.cooldown = Math.max(0, gun.cooldown - dt);
  if (gun.reloading > 0) {
    gun.reloading -= dt;
    if (gun.reloading <= 0) {
      gun.reloading = 0;
      gun.ammo[gun.index] = currentWeapon().mag;
      playTone(620, 0.05, 'square', 0.06);
      updateCombatHud();
    }
  }
  if (gun.trigger && currentWeapon().auto) fireOnce();

  if (now - lastDamageAt > 7000 && health < MAX_HEALTH) {
    health = Math.min(MAX_HEALTH, health + dt * 9);
    setHealth(health);
  }

  const targetFov = gun.aiming ? 56 : 74;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
    camera.updateProjectionMatrix();
  }

  updateGunVisual(dt);
  updateFx(dt);
}

function updateGunVisual(dt) {
  const showView = !thirdPerson && alive;
  if (viewGun) {
    viewGun.visible = showView;
    const aim = gun.aiming && alive;
    const tx = aim ? 0.015 : 0.27;
    const ty = aim ? -0.175 : -0.27;
    const tz = aim ? -0.44 : -0.56;
    const k = Math.min(1, dt * 15);
    viewGun.position.x += (tx - viewGun.position.x) * k;
    viewGun.position.y += (ty - viewGun.position.y) * k;
    viewGun.position.z += (tz - viewGun.position.z) * k;
    const kick = gun.kick;
    viewGun.position.z += kick * 0.075;
    viewGun.rotation.x = 0.03 + kick * 0.16;
    gun.kick = Math.max(0, gun.kick - dt * 9);
  }
  if (localAvatar) {
    if (!thirdPerson) localAvatar.visible = false;
    else if (alive) localAvatar.visible = true;
    if (localAvatar.userData.gun) localAvatar.userData.gun.visible = alive && thirdPerson;
  }
}
