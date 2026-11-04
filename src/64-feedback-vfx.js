/* Blockcraft Battle Ground — combat feel: shake, flashes, casings and puffs.
   64-feedback-vfx.js (after 60-combat.js, whose shot/damage events and muzzle
   helpers it uses)
   - Trauma-based camera shake: each shot, hit taken or kill adds trauma that
     decays quickly; the visible shake is trauma² so small events stay subtle.
     It is applied only between the preRender and postRender hooks (99-boot),
     so aiming, hit tests and the network pose never see it.
   - Per-weapon muzzle flash size/brightness with a short smoke puff.
   - Brass casings ejected to the right of the weapon, bouncing once.
   - Dust puffs at bullet impacts and a white pulse on your eliminations. */
'use strict';

const VFX_WEAPON = {
  //        trauma  flash  light  casing
  pistol:   [0.16,  0.75,  3.2,   0.8],
  revolver: [0.30,  1.00,  4.2,   0.0],  // revolvers keep their brass
  smg:      [0.09,  0.65,  2.6,   0.7],
  rifle:    [0.13,  0.85,  3.4,   1.0],
  lmg:      [0.15,  0.95,  3.8,   1.1],
  shotgun:  [0.42,  1.35,  5.2,   1.6],
  sniper:   [0.55,  1.30,  5.6,   1.3]
};
const VFX_MAX_CASINGS = 24;
const VFX_MAX_PUFFS = 24;

const vfx = {
  trauma: 0,
  seed: Math.random() * 1000,
  applied: null,
  casings: [],
  puffs: [],
  reduced: false
};

try { vfx.reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* optional */ }

function vfxAddTrauma(amount) {
  vfx.trauma = Math.min(1, vfx.trauma + amount * (vfx.reduced ? 0.35 : 1));
}

/* ---------------- camera shake (render-only) ---------------- */
function vfxNoise(t, k) {
  return Math.sin(t * 37.1 + k * 11.3) * 0.6 + Math.sin(t * 61.7 + k * 3.7) * 0.4;
}

function vfxApplyShake() {
  if (vfx.trauma <= 0.001) return;
  const s = vfx.trauma * vfx.trauma, t = performance.now() / 1000 + vfx.seed;
  const yaw = vfxNoise(t, 1) * 0.035 * s, pitch = vfxNoise(t, 2) * 0.03 * s, roll = vfxNoise(t, 3) * 0.05 * s;
  vfx.applied = { yaw, pitch, roll, x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z };
  camera.rotation.x += pitch;
  camera.rotation.y += yaw;
  camera.rotation.z += roll;
}

function vfxRemoveShake() {
  const a = vfx.applied;
  if (!a) return;
  vfx.applied = null;
  // Restore exactly what the game set, unless something replaced it meanwhile.
  camera.rotation.set(a.x, a.y, a.z);
}

/* ---------------- muzzle flash + smoke ---------------- */
const vfxSmokeTex = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(235,235,235,0.55)');
  grd.addColorStop(0.6, 'rgba(200,200,200,0.22)');
  grd.addColorStop(1, 'rgba(200,200,200,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();

function vfxPuff(pos, size, life, rise, tint) {
  if (vfx.puffs.length >= VFX_MAX_PUFFS) {
    const old = vfx.puffs.shift();
    scene.remove(old.sprite);
    old.sprite.material.dispose();
  }
  const mat = new THREE.SpriteMaterial({ map: vfxSmokeTex, color: tint || 0xdddddd, transparent: true, depthWrite: false, opacity: 0.8 });
  const sprite = new THREE.Sprite(mat);
  sprite.position.copy(pos);
  sprite.scale.setScalar(size);
  sprite.material.rotation = Math.random() * Math.PI * 2;
  scene.add(sprite);
  vfx.puffs.push({ sprite, life, max: life, rise, grow: size * 1.8 });
}

function vfxMuzzle(weaponId) {
  const spec = VFX_WEAPON[weaponId] || VFX_WEAPON.rifle;
  if (typeof muzzleFlash === 'undefined' || !muzzleFlash.visible) return;
  muzzleFlash.scale.multiplyScalar(spec[1]);
  muzzleLight.intensity = spec[2];
  muzzleLight.distance = 10 + spec[2] * 2.4;
  vfxPuff(muzzleFlash.position, 0.28 * spec[1], 0.42, 0.9, 0xcfcfcf);
}

/* ---------------- casings ---------------- */
const VFX_CASING_GEO = new THREE.BoxGeometry(0.035, 0.035, 0.085);
const VFX_CASING_MAT = new THREE.MeshLambertMaterial({ color: 0xc9a043, emissive: 0x2a1c05 });
const VFX_SHELL_MAT = new THREE.MeshLambertMaterial({ color: 0xb3262b, emissive: 0x1a0505 });

function vfxEjectCasing(weaponId) {
  const spec = VFX_WEAPON[weaponId] || VFX_WEAPON.rifle;
  if (!spec[3] || typeof combatGetMuzzle !== 'function') return;
  const muzzle = combatGetMuzzle(new THREE.Vector3());
  if (!Number.isFinite(muzzle.x)) return;
  const forward = camera.getWorldDirection(new THREE.Vector3());
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  // The ejection port sits behind the muzzle on the right-hand side.
  const pos = muzzle.clone().addScaledVector(forward, -0.32).addScaledVector(right, 0.05);
  if (vfx.casings.length >= VFX_MAX_CASINGS) {
    const old = vfx.casings.shift();
    scene.remove(old.mesh);
  }
  const mesh = new THREE.Mesh(VFX_CASING_GEO, weaponId === 'shotgun' ? VFX_SHELL_MAT : VFX_CASING_MAT);
  mesh.scale.setScalar(spec[3]);
  mesh.userData.noShadow = true;
  mesh.position.copy(pos);
  mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  scene.add(mesh);
  const v = right.multiplyScalar(2.2 + Math.random() * 1.2).add(new THREE.Vector3(0, 2.6 + Math.random(), 0))
    .addScaledVector(forward, -0.6);
  vfx.casings.push({ mesh, v, spin: 14 + Math.random() * 10, life: 2.2, bounced: false });
}

function vfxSolidAt(p) {
  try { const b = getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)); return b !== AIR && b !== WATER; }
  catch (e) { return false; }
}

/* ---------------- per-frame ---------------- */
function vfxUpdate(dt) {
  if (!(dt > 0)) return;
  vfx.trauma = Math.max(0, vfx.trauma - dt * 2.3);
  for (let i = vfx.casings.length - 1; i >= 0; i--) {
    const c = vfx.casings[i];
    c.life -= dt;
    c.v.y -= 22 * dt;
    c.mesh.position.addScaledVector(c.v, dt);
    c.mesh.rotation.x += c.spin * dt;
    c.mesh.rotation.y += c.spin * 0.6 * dt;
    if (vfxSolidAt(c.mesh.position)) {
      c.mesh.position.y = Math.floor(c.mesh.position.y) + 1.02;
      if (!c.bounced) { c.v.set(c.v.x * 0.35, 1.6, c.v.z * 0.35); c.bounced = true; c.spin *= 0.4; }
      else { c.v.set(0, 0, 0); c.spin = 0; }
    }
    if (c.life <= 0) { scene.remove(c.mesh); vfx.casings.splice(i, 1); }
  }
  for (let i = vfx.puffs.length - 1; i >= 0; i--) {
    const p = vfx.puffs[i];
    p.life -= dt;
    const k = 1 - p.life / p.max;
    p.sprite.position.y += p.rise * dt;
    p.sprite.scale.setScalar(p.grow * (0.55 + k * 0.6));
    p.sprite.material.opacity = Math.max(0, 0.7 * (1 - k));
    if (p.life <= 0) { scene.remove(p.sprite); p.sprite.material.dispose(); vfx.puffs.splice(i, 1); }
  }
}

/* ---------------- kill pulse ---------------- */
const vfxFlashEl = document.createElement('div');
vfxFlashEl.id = 'vfxFlash';
vfxFlashEl.setAttribute('aria-hidden', 'true');
document.body.appendChild(vfxFlashEl);
BC.style('bc-vfx', `
  #vfxFlash { position: fixed; inset: 0; pointer-events: none; z-index: 8; opacity: 0;
    background: radial-gradient(ellipse at center, rgba(255,255,255,0) 45%, rgba(255,255,255,.55) 100%); }
  #vfxFlash.kill { animation: vfxKill .38s ease-out; }
  @keyframes vfxKill { 0% { opacity: .9; } 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { #vfxFlash.kill { animation-duration: .2s; } }
`);
function vfxKillPulse() {
  vfxFlashEl.classList.remove('kill');
  void vfxFlashEl.offsetWidth; // restart the animation
  vfxFlashEl.classList.add('kill');
}

/* ---------------- wiring ---------------- */
BC.on('shot', (info) => {
  const id = info && info.weapon;
  const spec = VFX_WEAPON[id] || VFX_WEAPON.rifle;
  vfxAddTrauma(spec[0] * (gun.aiming ? 0.6 : 1));
  // combat emits 'shot' just before muzzleBurst(); boost the flash after it.
  queueMicrotask(() => vfxMuzzle(id));
  vfxEjectCasing(id);
  if (info && info.to && !info.hit) vfxPuff(info.to, 0.35, 0.5, 0.35, 0xb9a98c);
}, 20);
BC.on('damage', (info) => {
  const amount = info && Number(info.amount);
  if (amount > 0) vfxAddTrauma(Math.min(0.6, 0.12 + amount / 160));
}, 20);
BC.on('killfeed', (killer, victim, info) => {
  try {
    const self = typeof net !== 'undefined' && net ? net.id : '';
    if (info && (info.killerId === self || info.byId === self) && info.victimId !== self) { vfxKillPulse(); vfxAddTrauma(0.2); }
  } catch (e) { /* optional */ }
}, 20);
BC.on('death', () => { vfxAddTrauma(0.7); }, 20);
BC.on('frame', (dt) => vfxUpdate(dt), 40);
BC.on('preRender', vfxApplyShake, 0);
BC.on('postRender', vfxRemoveShake, 0);

BC.api.vfx = {
  get trauma() { return vfx.trauma; },
  addTrauma: vfxAddTrauma,
  get casings() { return vfx.casings.length; }
};
