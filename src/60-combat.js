/* Blockcraft Battle Ground — Weapons, gun models, audio, effects, hit tests, health, death and respawn.
   60-combat.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ============================================================
   Guns, health & combat
   ============================================================ */

const WEAPONS = [
  { id: 'pistol',   name: 'Pistol',   damage: 26, rpm: 330, mag: 12, spread: 0.008, recoil: 0.026, range: 90,  pellets: 1, auto: false, reload: 1.15, sound: 0.55, scopeFov: 44, adsSpread: 0.42, kickBack: 0.065, recover: 20, report: [0.17, 1800, 158, 3.0] },
  { id: 'rifle',    name: 'Rifle',    damage: 17, rpm: 640, mag: 30, spread: 0.014, recoil: 0.013, range: 130, pellets: 1, auto: true,  reload: 1.85, sound: 0.42, scopeFov: 38, adsSpread: 0.36, kickBack: 0.048, recover: 25, report: [0.12, 2400, 176, 3.6] },
  { id: 'shotgun',  name: 'Shotgun',  damage: 10, rpm: 78,  mag: 6,  spread: 0.075, recoil: 0.070, range: 36,  pellets: 8, auto: false, reload: 2.35, sound: 0.80, scopeFov: 48, adsSpread: 0.72, kickBack: 0.120, recover: 13, report: [0.30, 850, 105, 2.0] },
  { id: 'smg',      name: 'SMG',      damage: 12, rpm: 870, mag: 32, spread: 0.023, recoil: 0.010, range: 68,  pellets: 1, auto: true,  reload: 1.45, sound: 0.34, scopeFov: 42, adsSpread: 0.48, kickBack: 0.038, recover: 30, report: [0.09, 3200, 215, 4.2] },
  { id: 'sniper',   name: 'Sniper',   damage: 76, rpm: 44,  mag: 5,  spread: 0.032, recoil: 0.095, range: 180, pellets: 1, auto: false, reload: 2.80, sound: 0.95, scopeFov: 18, adsSpread: 0.025, kickBack: 0.135, recover: 10, report: [0.38, 1450, 84, 2.3] },
  { id: 'revolver', name: 'Revolver', damage: 46, rpm: 185, mag: 6,  spread: 0.006, recoil: 0.055, range: 105, pellets: 1, auto: false, reload: 2.40, sound: 0.73, scopeFov: 40, adsSpread: 0.34, kickBack: 0.100, recover: 15, report: [0.25, 2050, 126, 2.7] },
  { id: 'lmg',      name: 'LMG',      damage: 19, rpm: 560, mag: 60, spread: 0.022, recoil: 0.021, range: 145, pellets: 1, auto: true,  reload: 3.60, sound: 0.62, scopeFov: 40, adsSpread: 0.50, kickBack: 0.075, recover: 18, report: [0.19, 1250, 118, 3.2] }
];
const WEAPON_BY_ID = Object.create(null);
const COMBAT_OPTIC_TYPES = {
  pistol: 'reflex', rifle: 'holo', shotgun: 'spread', smg: 'chevron',
  sniper: 'mildot', revolver: 'precision', lmg: 'support'
};
for (const w of WEAPONS) { w.optic = COMBAT_OPTIC_TYPES[w.id]; WEAPON_BY_ID[w.id] = w; }

const gun = {
  index: 0,
  ammo: WEAPONS.map((w) => w.mag),
  cooldown: 0,
  reloading: 0,
  reloadTotal: 1,
  reloadIndex: -1,
  reloadRounds: 0,
  aiming: false,
  trigger: false,
  kick: 0,
  firePose: 0,
  viewAim: 0,
  equip: 0,
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
const combatScopeOverlayEl = document.getElementById('scopeOverlay');
const combatScopeWeaponEl = document.getElementById('scopeWeapon');
const combatScopeZoomEl = document.getElementById('scopeZoom');
const combatCrosshairEl = document.getElementById('crosshair');
let combatScopeShown = null;
let combatScopeLabel = '';

const currentWeapon = () => WEAPONS[gun.index];
const safeName = (v) => String(v == null ? '' : v).replace(/[^\w \-'.]/g, '').trim().slice(0, 14) || '???';

function combatQuickBuilding() {
  return typeof quickBuild !== 'undefined' && !!quickBuild.active;
}

// Shared with 50's shoulder/eye camera. Aim input is immediate; only the FOV
// transition is damped. Reload remains timed normally while looking through it.
function isScopeActive() {
  return !!(combatMode && gun.aiming && alive && !combatQuickBuilding());
}

function combatUpdateScopeHud() {
  const scoped = isScopeActive(), w = currentWeapon();
  if (combatScopeShown !== scoped) {
    document.body.classList.toggle('scoped', scoped);
    if (combatScopeOverlayEl) {
      combatScopeOverlayEl.classList.toggle('on', scoped);
      combatScopeOverlayEl.style.pointerEvents = 'none';
      combatScopeOverlayEl.setAttribute('aria-hidden', 'true');
    }
    if (combatCrosshairEl) combatCrosshairEl.style.visibility = scoped ? 'hidden' : '';
    combatScopeShown = scoped;
  }
  const label = w.id + ':' + w.scopeFov + ':' + w.optic;
  if (combatScopeLabel !== label) {
    if (combatScopeOverlayEl) combatScopeOverlayEl.dataset.optic = w.optic;
    if (combatScopeWeaponEl) combatScopeWeaponEl.textContent = w.name;
    if (combatScopeZoomEl) combatScopeZoomEl.textContent = (Math.tan(74 * Math.PI / 360) / Math.tan(w.scopeFov * Math.PI / 360)).toFixed(1) + '×';
    combatScopeLabel = label;
  }
}

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
  combatUpdateScopeHud();
  if (weaponNameEl) weaponNameEl.textContent = w.name;
  if (ammoNowEl) ammoNowEl.textContent = String(gun.ammo[gun.index]);
  if (ammoLineEl) ammoLineEl.classList.toggle('low', gun.ammo[gun.index] <= Math.ceil(w.mag * 0.25));
  if (reloadBarEl) reloadBarEl.classList.toggle('on', gun.reloading > 0);
  if (reloadFillEl && gun.reloading > 0) {
    reloadFillEl.style.width = Math.max(0, Math.min(1, 1 - gun.reloading / gun.reloadTotal)) * 100 + '%';
  }
  if (dotsEl) {
    if (dotsEl.children.length !== WEAPONS.length) {
      while (dotsEl.firstChild) dotsEl.removeChild(dotsEl.firstChild);
      for (let i = 0; i < WEAPONS.length; i++) {
        const dot = document.createElement('i');
        dot.title = (i + 1) + ' · ' + WEAPONS[i].name;
        dot.setAttribute('aria-label', dot.title);
        dotsEl.appendChild(dot);
      }
    }
    for (let i = 0; i < dotsEl.children.length; i++) dotsEl.children[i].classList.toggle('on', i === gun.index);
  }
  setHealth(health);
  setKd();
}

/* ---------------- gun models ---------------- */
const combatMetalMats = new Map();
const combatCylinderGeos = new Map();
const combatOpticRingGeos = new Map();
const combatReticleMats = new Map();
const combatOpticGlass = new THREE.MeshStandardMaterial({
  color: '#83c5d2', transparent: true, opacity: 0.27, metalness: 0.08,
  roughness: 0.16, depthWrite: false
});
const combatReducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const combatClamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const combatDamp = (rate, dt) => 1 - Math.exp(-rate * Math.max(0, Number.isFinite(dt) ? dt : 0));

function combatMetal(color) {
  let mat = combatMetalMats.get(color);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.42 });
    combatMetalMats.set(color, mat);
  }
  return mat;
}

function combatMetalBox(parent, w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(charBox(w, h, d), combatMetal(color));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function combatCylinder(parent, radius, length, color, x, y, z) {
  const key = radius + ',' + length;
  let geo = combatCylinderGeos.get(key);
  if (!geo) {
    geo = new THREE.CylinderGeometry(radius, radius, length, 8);
    combatCylinderGeos.set(key, geo);
  }
  const mesh = new THREE.Mesh(geo, combatMetal(color));
  mesh.position.set(x, y, z);
  mesh.rotation.x = Math.PI / 2;
  parent.add(mesh);
  return mesh;
}

function combatReloadPart(root, name, object) {
  root.userData.reloadParts[name] = object;
  root.userData.reloadNodes.push(object);
  object.userData.combatBase = {
    position: object.position.clone(), quaternion: object.quaternion.clone(),
    scale: object.scale.clone(), visible: object.visible
  };
  return object;
}

function combatPartGroup(root, name, parent, x, y, z) {
  const part = new THREE.Group();
  part.position.set(x, y, z);
  parent.add(part);
  return combatReloadPart(root, name, part);
}

function combatOpticRing(parent, radius, thickness, color, x, y, z, glow) {
  const key = radius + ',' + thickness;
  let geometry = combatOpticRingGeos.get(key);
  if (!geometry) {
    geometry = new THREE.TorusGeometry(radius, thickness, 4, 20);
    combatOpticRingGeos.set(key, geometry);
  }
  let material = combatMetal(color);
  if (glow) {
    material = combatReticleMats.get(color);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      combatReticleMats.set(color, material);
    }
  }
  const ring = new THREE.Mesh(geometry, material);
  ring.position.set(x, y, z);
  parent.add(ring);
  return ring;
}

function combatOpticMarks(parent, type, y, z) {
  const color = type === 'chevron' ? '#7affe0' : type === 'precision' ? '#ffe5a4' : '#ff765e';
  if (type === 'holo') {
    combatOpticRing(parent, 0.020, 0.0018, color, 0, y, z, true);
    glowBox(parent, 0.005, 0.005, 0.003, color, 0, y, z);
  } else if (type === 'chevron') {
    glowBox(parent, 0.019, 0.003, 0.003, color, -0.007, y, z).rotation.z = 0.65;
    glowBox(parent, 0.019, 0.003, 0.003, color, 0.007, y, z).rotation.z = -0.65;
  } else if (type === 'precision' || type === 'mildot') {
    const width = type === 'mildot' ? 0.064 : 0.033;
    glowBox(parent, width, 0.0018, 0.002, '#f5e8c6', 0, y, z);
    glowBox(parent, 0.0018, width, 0.002, '#f5e8c6', 0, y, z);
    if (type === 'mildot') for (const n of [-2, -1, 1, 2]) {
      glowBox(parent, 0.004, 0.004, 0.002, '#f5e8c6', n * 0.012, y, z);
      glowBox(parent, 0.004, 0.004, 0.002, '#f5e8c6', 0, y + n * 0.012, z);
    }
  } else if (type === 'support') {
    glowBox(parent, 0.034, 0.002, 0.003, color, 0, y, z);
    glowBox(parent, 0.003, 0.010, 0.003, color, 0, y, z);
    for (let i = 1; i <= 3; i++) glowBox(parent, 0.025 - i * 0.005, 0.002, 0.003, color, 0, y - i * 0.010, z);
  } else if (type === 'spread') {
    combatOpticRing(parent, 0.043, 0.0018, '#ffe49f', 0, y, z, true);
    glowBox(parent, 0.005, 0.005, 0.003, '#ffe49f', 0, y, z);
  } else {
    glowBox(parent, 0.007, 0.007, 0.003, color, 0, y, z);
  }
}

function combatAddOptic(root) {
  const u = root.userData, type = WEAPON_BY_ID[u.weaponId].optic;
  const optic = new THREE.Group();
  optic.name = 'optic-' + type;
  u.optic = optic;
  u.opticType = type;
  if (type === 'mildot') {
    // The long tube, objective bell and turrets are authored with the sniper.
    // Add raised mounting rings and an actual rear lens with a fine mil reticle.
    optic.position.set(0, 0.17, 0);
    root.add(optic);
    for (const z of [-0.13, 0.105]) {
      combatOpticRing(optic, 0.058, 0.007, '#87948b', 0, 0, z, false);
      combatMetalBox(optic, 0.087, 0.018, 0.038, '#45534a', 0, -0.055, z);
    }
    combatOpticRing(optic, 0.053, 0.008, '#26322e', 0, 0, 0.205, false);
    combatCylinder(optic, 0.050, 0.004, '#83c5d2', 0, 0, 0.205).material = combatOpticGlass;
    combatOpticMarks(optic, type, 0, 0.209);
    return;
  }
  if (type === 'spread') {
    optic.position.set(0, 0.15, 0.015);
    root.add(optic);
    combatMetalBox(optic, 0.11, 0.027, 0.105, '#3b4142', 0, -0.06, 0);
    for (const z of [-0.035, 0.035]) combatOpticRing(optic, 0.061, 0.010, '#8b7960', 0, 0, z, false);
    for (const x of [-0.061, 0.061]) combatMetalBox(optic, 0.011, 0.025, 0.078, '#454943', x, 0, 0);
    combatCylinder(optic, 0.050, 0.004, '#83c5d2', 0, 0, 0.038).material = combatOpticGlass;
    combatOpticMarks(optic, type, 0, 0.043);
    return;
  }
  const mini = type === 'reflex' || type === 'precision';
  const width = mini ? 0.079 : type === 'support' ? 0.134 : 0.116;
  const height = mini ? 0.062 : type === 'support' ? 0.108 : 0.089;
  const depth = mini ? 0.029 : 0.068;
  if (type === 'reflex') {
    optic.position.set(0, 0.065, 0.06);
    u.reloadParts.slide.add(optic);
  } else if (type === 'support') {
    optic.position.set(0, 0.037, 0.25);
    u.reloadParts.cover.add(optic);
  } else {
    optic.position.set(0, type === 'precision' ? 0.105 : 0.093, type === 'chevron' ? 0.008 : 0.065);
    root.add(optic);
  }
  const frame = mini ? '#303d45' : type === 'chevron' ? '#325253' : '#39483e';
  combatMetalBox(optic, width + 0.012, 0.022, depth + 0.07, frame, 0, 0, 0);
  for (const side of [-1, 1]) combatMetalBox(optic, 0.013, height, depth, frame, side * (width - 0.013) / 2, height / 2, 0);
  combatMetalBox(optic, width, 0.013, depth, mini ? '#7e929b' : '#657468', 0, height, 0);
  const glass = addBox(optic, width - 0.028, height - 0.020, 0.004, '#83c5d2', 0, height * 0.52, depth * 0.45);
  glass.material = combatOpticGlass;
  combatOpticMarks(optic, type, height * (type === 'support' ? 0.63 : 0.52), depth * 0.5 + 0.004);
  if (!mini) {
    combatMetalBox(optic, 0.026, 0.026, 0.028, '#a6afa1', width * 0.57, 0.027, 0);
    addBox(optic, 0.008, 0.014, 0.032, '#222b25', width * 0.70, 0.027, 0);
  }
}

function makeGunModel(id) {
  if (!WEAPON_BY_ID[id]) id = WEAPONS[0].id;
  const root = new THREE.Group();
  const dark = '#20262c', metal = '#59626b', wood = '#765035', brass = '#c3a054';
  const u = root.userData;
  u.weaponId = id;
  u.reloadParts = Object.create(null);
  u.reloadNodes = [];
  u.reloadProgress = -1;
  u.grip = new THREE.Vector3(0, -0.12, 0.12);
  u.support = new THREE.Vector3(-0.055, -0.075, -0.18);
  u.supportTarget = new THREE.Vector3();
  u.rightTarget = new THREE.Vector3();
  u.reloadPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  u.heldScale = 0.86;
  u.viewScale = 0.90;
  let muzzleZ = -0.5, muzzleY = 0.045;

  if (id === 'rifle') {
    combatMetalBox(root, 0.095, 0.12, 0.44, metal, 0, 0.015, 0.02);
    combatCylinder(root, 0.025, 0.50, dark, 0, muzzleY, -0.47);
    combatCylinder(root, 0.037, 0.09, '#14191e', 0, muzzleY, -0.73);
    addBox(root, 0.085, 0.10, 0.25, wood, 0, -0.005, -0.29);
    addBox(root, 0.09, 0.15, 0.28, wood, 0, -0.015, 0.35);
    addBox(root, 0.10, 0.17, 0.035, dark, 0, -0.015, 0.505);
    addBox(root, 0.065, 0.19, 0.095, '#342920', 0, -0.12, 0.14);
    const mag = combatPartGroup(root, 'mag', root, 0, -0.13, -0.045);
    combatMetalBox(mag, 0.065, 0.22, 0.105, dark, 0, -0.025, 0);
    combatMetalBox(mag, 0.073, 0.025, 0.11, metal, 0, -0.137, 0);
    for (let i = 0; i < 3; i++) addBox(mag, 0.068, 0.012, 0.108, '#3e454a', 0, -0.01 - i * 0.055, 0);
    combatReloadPart(root, 'charging', combatMetalBox(root, 0.09, 0.022, 0.035, '#a6adb1', 0.065, 0.045, 0.055));
    addBox(root, 0.06, 0.025, 0.20, dark, 0, 0.091, 0.025);
    addBox(root, 0.022, 0.055, 0.022, dark, 0, 0.12, -0.36);
    glowBox(root, 0.012, 0.012, 0.012, '#ff7152', 0, 0.15, -0.36);
    muzzleZ = -0.78;
  } else if (id === 'shotgun') {
    combatMetalBox(root, 0.105, 0.12, 0.39, '#454b50', 0, 0.015, 0.02);
    combatCylinder(root, 0.034, 0.59, dark, 0, muzzleY, -0.46);
    combatCylinder(root, 0.027, 0.45, '#3e4449', 0, -0.035, -0.37);
    addBox(root, 0.10, 0.14, 0.28, wood, 0, -0.04, 0.33);
    addBox(root, 0.11, 0.16, 0.025, '#171c20', 0, -0.04, 0.48);
    addBox(root, 0.065, 0.17, 0.09, wood, 0, -0.12, 0.12);
    const pump = combatPartGroup(root, 'pump', root, 0, -0.025, -0.30);
    addBox(pump, 0.10, 0.09, 0.23, '#815735', 0, 0, 0);
    for (let i = 0; i < 5; i++) addBox(pump, 0.104, 0.095, 0.012, '#513b2a', 0, 0, -0.09 + i * 0.045);
    combatReloadPart(root, 'gate', combatMetalBox(root, 0.056, 0.012, 0.10, '#8c9295', 0, -0.049, -0.035));
    const shell = combatPartGroup(root, 'shell', root, -0.18, -0.18, 0.01);
    combatCylinder(shell, 0.023, 0.095, '#b84432', 0, 0, 0);
    combatCylinder(shell, 0.025, 0.02, brass, 0, 0, 0.047);
    shell.visible = shell.userData.combatBase.visible = false;
    glowBox(root, 0.018, 0.018, 0.018, '#ffbd61', 0, 0.083, -0.67);
    muzzleZ = -0.76;
  } else if (id === 'smg') {
    combatMetalBox(root, 0.115, 0.13, 0.33, '#46565b', 0, 0.005, 0.005);
    combatCylinder(root, 0.027, 0.28, dark, 0, muzzleY, -0.27);
    combatCylinder(root, 0.04, 0.075, '#141b20', 0, muzzleY, -0.425);
    addBox(root, 0.085, 0.10, 0.17, '#27373b', 0, -0.015, -0.18);
    addBox(root, 0.075, 0.19, 0.105, dark, 0, -0.12, 0.12);
    const mag = combatPartGroup(root, 'mag', root, 0, -0.14, -0.08);
    combatMetalBox(mag, 0.055, 0.20, 0.075, '#4b575c', 0, -0.025, 0);
    addBox(mag, 0.065, 0.027, 0.083, '#19282a', 0, -0.133, 0);
    combatReloadPart(root, 'bolt', combatMetalBox(root, 0.09, 0.025, 0.035, '#aab9b9', -0.06, 0.059, -0.01));
    for (const x of [-0.04, 0.04]) combatMetalBox(root, 0.018, 0.022, 0.23, metal, x, 0.025, 0.265);
    addBox(root, 0.105, 0.12, 0.025, dark, 0, -0.015, 0.38);
    addBox(root, 0.067, 0.055, 0.07, dark, 0, 0.09, 0.02);
    glowBox(root, 0.018, 0.012, 0.012, '#64daca', 0, 0.11, -0.22);
    u.support.z = -0.17;
    muzzleZ = -0.467;
  } else if (id === 'sniper') {
    combatMetalBox(root, 0.10, 0.11, 0.52, '#647069', 0, 0.01, 0);
    combatCylinder(root, 0.024, 0.75, '#313c3b', 0, muzzleY, -0.62);
    combatMetalBox(root, 0.075, 0.068, 0.13, '#171f20', 0, muzzleY, -1.02);
    addBox(root, 0.105, 0.11, 0.31, '#4a5841', 0, -0.035, -0.22);
    addBox(root, 0.105, 0.17, 0.34, '#586246', 0, -0.035, 0.38);
    addBox(root, 0.08, 0.20, 0.10, dark, 0, -0.12, 0.15);
    addBox(root, 0.105, 0.055, 0.20, '#2a332a', 0, 0.07, 0.35);
    addBox(root, 0.12, 0.18, 0.035, dark, 0, -0.035, 0.565);
    const mag = combatPartGroup(root, 'mag', root, 0, -0.12, -0.055);
    combatMetalBox(mag, 0.077, 0.12, 0.13, dark, 0, -0.025, 0);
    combatMetalBox(mag, 0.085, 0.018, 0.145, '#879185', 0, -0.085, 0);
    const bolt = combatPartGroup(root, 'bolt', root, 0, 0.045, 0.09);
    combatCylinder(bolt, 0.026, 0.22, '#b2b9b3', 0, 0, 0);
    const handle = combatPartGroup(root, 'boltHandle', bolt, 0, 0, 0.06);
    combatMetalBox(handle, 0.11, 0.018, 0.022, metal, 0.065, -0.015, 0);
    addBox(handle, 0.043, 0.05, 0.043, dark, 0.126, -0.02, 0);
    for (const z of [-0.12, 0.11]) addBox(root, 0.045, 0.09, 0.035, dark, 0, 0.11, z);
    combatCylinder(root, 0.056, 0.38, '#222c30', 0, 0.17, -0.035);
    combatCylinder(root, 0.071, 0.10, dark, 0, 0.17, -0.255);
    combatCylinder(root, 0.066, 0.012, '#468b93', 0, 0.17, -0.311);
    combatCylinder(root, 0.06, 0.045, metal, 0, 0.17, 0.175);
    addBox(root, 0.055, 0.045, 0.055, dark, 0, 0.237, -0.025);
    u.grip.z = 0.15;
    u.heldScale = 0.78;
    u.viewScale = 0.78;
    muzzleZ = -1.09;
  } else if (id === 'revolver') {
    combatMetalBox(root, 0.075, 0.115, 0.28, '#a8aca6', 0, 0.005, 0.055);
    combatCylinder(root, 0.030, 0.36, '#9fa7a4', 0, muzzleY, -0.265);
    combatMetalBox(root, 0.051, 0.035, 0.35, '#707976', 0, -0.025, -0.255);
    addBox(root, 0.078, 0.20, 0.105, '#693b27', 0, -0.13, 0.15).rotation.x = -0.16;
    combatMetalBox(root, 0.084, 0.018, 0.11, brass, 0, -0.228, 0.165);
    const hinge = combatPartGroup(root, 'cylinderHinge', root, -0.07, 0.015, 0.02);
    combatMetalBox(hinge, 0.10, 0.022, 0.11, metal, 0.05, -0.053, 0);
    const cylinder = combatPartGroup(root, 'cylinder', hinge, 0.07, 0, 0);
    combatCylinder(cylinder, 0.074, 0.15, '#727d80', 0, 0, 0);
    const rounds = combatPartGroup(root, 'rounds', cylinder, 0, 0, 0);
    const loader = combatPartGroup(root, 'loader', root, -0.21, 0.015, 0.22);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, x = Math.cos(a) * 0.046, y = Math.sin(a) * 0.046;
      combatCylinder(rounds, 0.014, 0.13, brass, x, y, 0.016);
      combatCylinder(loader, 0.014, 0.13, brass, x, y, 0);
    }
    combatCylinder(loader, 0.055, 0.035, dark, 0, 0, 0.07);
    loader.visible = loader.userData.combatBase.visible = false;
    combatReloadPart(root, 'ejector', combatMetalBox(cylinder, 0.017, 0.017, 0.16, '#c9d0cb', 0, 0, -0.035));
    combatReloadPart(root, 'hammer', combatMetalBox(root, 0.033, 0.05, 0.035, '#838d8b', 0, 0.082, 0.18));
    addBox(root, 0.018, 0.035, 0.023, dark, 0, 0.085, -0.405);
    glowBox(root, 0.009, 0.009, 0.009, '#ffd28d', 0, 0.104, -0.405);
    u.grip.set(0, -0.13, 0.15);
    u.support.set(-0.06, -0.13, 0.13);
    u.heldScale = 0.94;
    muzzleZ = -0.45;
  } else if (id === 'lmg') {
    combatMetalBox(root, 0.16, 0.16, 0.48, '#535d48', 0, 0.015, 0.015);
    combatCylinder(root, 0.032, 0.63, '#252e2b', 0, muzzleY, -0.56);
    combatCylinder(root, 0.045, 0.115, dark, 0, muzzleY, -0.89);
    addBox(root, 0.105, 0.10, 0.30, '#3a4734', 0, -0.025, -0.30);
    for (let i = 0; i < 5; i++) combatMetalBox(root, 0.115, 0.015, 0.025, '#76806a', 0, 0.036, -0.20 - i * 0.045);
    addBox(root, 0.10, 0.16, 0.29, '#48553c', 0, -0.035, 0.39);
    addBox(root, 0.115, 0.18, 0.035, dark, 0, -0.035, 0.55);
    addBox(root, 0.075, 0.20, 0.11, dark, 0, -0.12, 0.15);
    const mag = combatPartGroup(root, 'mag', root, -0.025, -0.17, -0.06);
    addBox(mag, 0.20, 0.24, 0.20, '#68734b', 0, -0.025, 0);
    combatMetalBox(mag, 0.21, 0.025, 0.215, '#333d31', 0, -0.155, 0);
    addBox(mag, 0.15, 0.045, 0.012, '#b3b782', 0, -0.035, -0.108);
    const cover = combatPartGroup(root, 'cover', root, 0, 0.106, -0.21);
    combatMetalBox(cover, 0.16, 0.035, 0.40, '#78836b', 0, 0, 0.20);
    addBox(cover, 0.055, 0.055, 0.10, dark, 0, 0.04, 0.28);
    const belt = combatPartGroup(root, 'belt', root, -0.10, 0.07, -0.065);
    for (let i = 0; i < 6; i++) {
      combatCylinder(belt, 0.013, 0.10, brass, -i * 0.028, -Math.max(0, i - 2) * 0.016, 0);
      addBox(belt, 0.032, 0.012, 0.022, '#39423a', -i * 0.028, -Math.max(0, i - 2) * 0.016, 0.018);
    }
    combatReloadPart(root, 'feed', combatMetalBox(root, 0.10, 0.017, 0.12, '#b0b6a6', 0, 0.079, -0.065));
    combatReloadPart(root, 'charging', combatMetalBox(root, 0.10, 0.027, 0.033, metal, 0.10, 0.018, 0.055));
    for (const x of [-0.055, 0.055]) combatMetalBox(root, 0.022, 0.04, 0.27, '#59634e', x, -0.065, -0.57);
    u.grip.z = 0.15;
    u.support.z = -0.19;
    u.heldScale = 0.78;
    u.viewScale = 0.82;
    muzzleZ = -0.952;
  } else {
    addBox(root, 0.09, 0.07, 0.30, dark, 0, -0.035, 0.025);
    const slide = combatPartGroup(root, 'slide', root, 0, 0.043, -0.035);
    combatMetalBox(slide, 0.096, 0.085, 0.35, metal, 0, 0, 0);
    for (let i = 0; i < 4; i++) combatMetalBox(slide, 0.098, 0.040, 0.012, '#313a40', 0, 0, 0.055 + i * 0.023);
    addBox(slide, 0.075, 0.02, 0.02, dark, 0, 0.056, 0.10);
    glowBox(slide, 0.014, 0.014, 0.014, '#ffdd66', 0, 0.056, -0.17);
    combatCylinder(root, 0.024, 0.27, '#1b2228', 0, muzzleY, -0.20);
    addBox(root, 0.077, 0.19, 0.11, '#332c27', 0, -0.12, 0.10);
    const mag = combatPartGroup(root, 'mag', root, 0, -0.17, 0.10);
    combatMetalBox(mag, 0.050, 0.18, 0.076, '#596267', 0, 0.015, 0);
    addBox(mag, 0.085, 0.028, 0.12, dark, 0, -0.075, 0);
    combatMetalBox(root, 0.092, 0.013, 0.047, '#8b969a', 0, -0.04, 0.105);
    u.grip.z = 0.10;
    u.support.set(-0.062, -0.115, 0.085);
    u.heldScale = 0.94;
    muzzleZ = -0.34;
  }

  // Every barrel is authored along -Z; the attachment/aim code uses that axis.
  combatCylinder(root, id === 'shotgun' ? 0.025 : 0.017, 0.008, '#090e12', 0, muzzleY, muzzleZ);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, muzzleY, muzzleZ - 0.006);
  root.add(muzzle);
  u.muzzle = muzzle;
  u.supportTarget.copy(u.support);
  u.rightTarget.copy(u.grip);
  combatAddOptic(root);
  return root;
}

/* A reload is a pure sample of progress, never a chain of timers/tweens. Reset
   the few cached moving nodes before sampling so reverse seeks/cancellation
   cannot leave a detached magazine, open cylinder or raised feed cover. */
function combatResetGunParts(model) {
  if (!model || !model.userData.reloadNodes) return;
  const u = model.userData;
  for (const part of u.reloadNodes) {
    const base = part.userData.combatBase;
    part.position.copy(base.position);
    part.quaternion.copy(base.quaternion);
    part.scale.copy(base.scale);
    part.visible = base.visible;
  }
  const pose = u.reloadPose;
  pose.x = pose.y = pose.z = pose.pitch = pose.yaw = pose.roll = 0;
  u.supportTarget.copy(u.support);
  u.rightTarget.copy(u.grip);
  u.reloadProgress = -1;
}

function combatStage(p, a, b) {
  const t = combatClamp01((p - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function combatPulse(p, a, b, c, d) {
  return combatStage(p, a, b) * (1 - combatStage(p, c, d));
}

function combatMagSwap(part, p, outStart, outEnd, inStart, inEnd, drop) {
  const pull = combatStage(p, outStart, outEnd) * (1 - combatStage(p, inStart, inEnd));
  part.position.y -= pull * drop;
  part.position.x -= pull * 0.075;
  part.rotation.z -= pull * 0.14;
  part.visible = p < outEnd + 0.025 || p >= inStart;
  return pull;
}

function updateWeaponReload(model, progress, rounds) {
  if (!model || !model.userData.reloadParts) return;
  const u = model.userData;
  if (Number.isFinite(rounds)) u.reloadRounds = rounds;
  const active = Number.isFinite(progress) && progress > 0 && progress < 1;
  if (!active && u.reloadProgress === -1) return;
  combatResetGunParts(model);
  if (!active) return;
  const p = combatClamp01(progress), parts = u.reloadParts, pose = u.reloadPose;
  const lift = combatPulse(p, 0, 0.14, 0.88, 1);
  pose.x = -0.065 * lift;
  pose.y = 0.025 * lift;
  pose.z = 0.11 * lift;
  u.reloadProgress = p;

  if (u.weaponId === 'pistol') {
    pose.pitch = 0.24 * lift; pose.roll = -0.32 * lift;
    const mag = combatMagSwap(parts.mag, p, 0.14, 0.32, 0.43, 0.67, 0.26);
    parts.slide.position.z += 0.09 * combatPulse(p, 0.72, 0.82, 0.85, 0.94);
    u.supportTarget.set(-0.065, -0.17 - mag * 0.26, 0.10);
    u.supportTarget.lerp(u.support, combatStage(p, 0.91, 1));
    const rackHand = combatPulse(p, 0.64, 0.75, 0.88, 0.98);
    u.supportTarget.x += (-0.075 - u.supportTarget.x) * rackHand;
    u.supportTarget.y += (0.085 - u.supportTarget.y) * rackHand;
    u.supportTarget.z += (0.055 + parts.slide.position.z - parts.slide.userData.combatBase.position.z - u.supportTarget.z) * rackHand;
  } else if (u.weaponId === 'rifle') {
    pose.pitch = 0.18 * lift; pose.roll = -0.26 * lift; pose.yaw = 0.12 * lift;
    const mag = combatMagSwap(parts.mag, p, 0.15, 0.34, 0.44, 0.66, 0.29);
    parts.mag.rotation.x -= mag * 0.18;
    parts.charging.position.z += 0.13 * combatPulse(p, 0.74, 0.83, 0.86, 0.95);
    u.supportTarget.set(-0.07, -0.19 - mag * 0.25, -0.045);
    if (p > 0.70) u.supportTarget.lerp(u.support, combatStage(p, 0.70, 0.88));
    u.rightTarget.lerp(parts.charging.position, combatPulse(p, 0.69, 0.76, 0.92, 1));
  } else if (u.weaponId === 'shotgun') {
    pose.pitch = 0.17 * lift; pose.roll = 0.48 * lift; pose.yaw = -0.10 * lift;
    const count = Math.max(1, Math.min(6, Math.round(Number.isFinite(rounds) ? rounds : 6)));
    if (p >= 0.12 && p < 0.84) {
      const shellTime = p < 0.17 || p >= 0.79 ? 0 : ((p - 0.17) / 0.62 * count) % 1;
      const feed = combatStage(shellTime, 0.10, 0.75);
      parts.shell.visible = p >= 0.17 && p < 0.79 && shellTime < 0.82;
      parts.shell.position.set(-0.20 * (1 - feed), -0.23 + feed * 0.165, 0.02 - feed * 0.085);
      parts.gate.rotation.x = -0.5 * combatPulse(shellTime, 0.38, 0.56, 0.78, 0.98);
      const handFeed = feed * (1 - combatStage(shellTime, 0.80, 1));
      const reach = combatPulse(p, 0.12, 0.18, 0.78, 0.84);
      u.supportTarget.x += (-0.245 + handFeed * 0.20 - u.supportTarget.x) * reach;
      u.supportTarget.y += (-0.23 + handFeed * 0.165 - u.supportTarget.y) * reach;
      u.supportTarget.z += (0.02 - handFeed * 0.085 - u.supportTarget.z) * reach;
    }
    parts.pump.position.z += 0.16 * combatPulse(p, 0.82, 0.89, 0.91, 0.98);
    if (p >= 0.79) u.supportTarget.z += parts.pump.position.z - parts.pump.userData.combatBase.position.z;
  } else if (u.weaponId === 'smg') {
    pose.pitch = 0.28 * lift; pose.roll = -0.20 * lift;
    const mag = combatMagSwap(parts.mag, p, 0.12, 0.28, 0.36, 0.57, 0.23);
    parts.bolt.position.z += 0.095 * combatPulse(p, 0.65, 0.76, 0.79, 0.9);
    u.supportTarget.set(-0.07, -0.19 - mag * 0.23, -0.08);
    if (p > 0.60) u.supportTarget.lerp(parts.bolt.position, combatPulse(p, 0.60, 0.68, 0.86, 0.97));
    u.supportTarget.lerp(u.support, combatStage(p, 0.90, 1));
  } else if (u.weaponId === 'sniper') {
    pose.pitch = 0.13 * lift; pose.roll = -0.22 * lift; pose.yaw = 0.08 * lift;
    const open = combatPulse(p, 0.10, 0.22, 0.84, 0.94);
    parts.boltHandle.rotation.z = 1.18 * open;
    parts.bolt.position.z += 0.17 * combatPulse(p, 0.21, 0.32, 0.74, 0.85);
    const mag = combatMagSwap(parts.mag, p, 0.34, 0.47, 0.52, 0.71, 0.23);
    u.supportTarget.lerp(parts.mag.position, combatPulse(p, 0.28, 0.37, 0.72, 0.82));
    u.supportTarget.y -= mag * 0.04;
    const boltHand = Math.max(combatPulse(p, 0.07, 0.16, 0.30, 0.37), combatPulse(p, 0.73, 0.79, 0.94, 1));
    u.rightTarget.x += (0.13 - u.rightTarget.x) * boltHand;
    u.rightTarget.y += (0.055 + open * 0.09 - u.rightTarget.y) * boltHand;
    u.rightTarget.z += (parts.bolt.position.z + 0.06 - u.rightTarget.z) * boltHand;
  } else if (u.weaponId === 'revolver') {
    pose.pitch = 0.34 * lift; pose.roll = 0.26 * lift;
    const open = combatPulse(p, 0.08, 0.23, 0.79, 0.94);
    parts.cylinderHinge.rotation.z = 0.55 * open;
    parts.cylinderHinge.position.x -= 0.16 * open;
    parts.cylinder.rotation.z = 0.3 * open;
    const eject = combatPulse(p, 0.25, 0.33, 0.38, 0.44);
    parts.ejector.position.z += 0.12 * eject;
    parts.rounds.position.z += 0.22 * combatStage(p, 0.28, 0.39) * (1 - combatStage(p, 0.62, 0.71));
    parts.rounds.visible = p < 0.38 || p >= 0.70;
    parts.loader.visible = p >= 0.49 && p < 0.73;
    parts.loader.position.x = parts.cylinderHinge.position.x + 0.07 * Math.cos(parts.cylinderHinge.rotation.z);
    parts.loader.position.y = parts.cylinderHinge.position.y + 0.07 * Math.sin(parts.cylinderHinge.rotation.z);
    parts.loader.rotation.z = parts.cylinderHinge.rotation.z + parts.cylinder.rotation.z;
    parts.loader.position.z -= 0.17 * combatStage(p, 0.50, 0.69);
    parts.hammer.rotation.x = -0.24 * combatPulse(p, 0.91, 0.95, 0.97, 1);
    u.supportTarget.set(-0.20 * open - 0.05, -0.05, 0.18 - combatStage(p, 0.50, 0.70) * 0.14);
    u.supportTarget.lerp(u.support, combatStage(p, 0.76, 1));
  } else if (u.weaponId === 'lmg') {
    pose.pitch = 0.16 * lift; pose.roll = -0.18 * lift; pose.yaw = 0.14 * lift;
    parts.cover.rotation.x = -1.20 * combatPulse(p, 0.10, 0.25, 0.79, 0.92);
    const mag = combatMagSwap(parts.mag, p, 0.26, 0.42, 0.47, 0.64, 0.30);
    const belt = combatPulse(p, 0.25, 0.38, 0.57, 0.74);
    parts.belt.position.x -= belt * 0.14;
    parts.belt.position.y += belt * 0.13;
    parts.belt.visible = p < 0.40 || p >= 0.56;
    parts.feed.position.y += 0.035 * combatPulse(p, 0.24, 0.36, 0.70, 0.78);
    parts.charging.position.z += 0.14 * combatPulse(p, 0.91, 0.95, 0.97, 1);
    u.supportTarget.set(-0.12, -0.17 - mag * 0.30, -0.055);
    const coverHand = Math.max(combatPulse(p, 0, 0.10, 0.20, 0.30), combatPulse(p, 0.64, 0.74, 0.90, 0.98));
    u.supportTarget.x += (-0.08 - u.supportTarget.x) * coverHand;
    u.supportTarget.y += (0.15 - u.supportTarget.y) * coverHand;
    u.supportTarget.z += (0.03 + Math.sin(p * Math.PI) * 0.10 - u.supportTarget.z) * coverHand;
    u.supportTarget.lerp(u.support, combatStage(p, 0.92, 1));
  }
  // Blend hand travel at the ends, including direct seeks to 0/1.
  u.supportTarget.lerp(u.support, 1 - lift);
}

/* first-person viewmodel */
const vmRoot = new THREE.Group();
camera.add(vmRoot);
scene.add(camera);
let viewGun = null;
let viewGunId = '';
const combatViewCache = new Map();

function combatViewHands(model) {
  const u = model.userData;
  const c = CHARACTERS[charKey] || CHARACTERS.steve;
  if (!u.viewHands) {
    const right = new THREE.Group(), left = new THREE.Group();
    const skin = [], sleeves = [];
    for (const hand of [right, left]) {
      skin.push(addBox(hand, 0.075, 0.105, 0.095, c.glove || c.skin, 0, 0, 0));
      skin.push(addBox(hand, 0.025, 0.050, 0.058, c.glove || c.skin, hand === right ? -0.045 : 0.045, 0.012, -0.012));
      sleeves.push(addBox(hand, 0.095, 0.19, 0.11, c.sleeve || c.shirt, hand === right ? 0.025 : -0.025, -0.14, 0.055));
      model.add(hand);
    }
    u.viewHands = { right, left, skin, sleeves, key: '' };
  }
  const hands = u.viewHands;
  if (hands.key !== charKey) {
    for (const mesh of hands.skin) mesh.material = charMaterial(c.glove || c.skin);
    for (const mesh of hands.sleeves) mesh.material = charMaterial(c.sleeve || c.shirt);
    hands.key = charKey;
  }
  hands.right.position.copy(u.rightTarget);
  hands.left.position.copy(u.supportTarget);
  hands.left.rotation.set(-0.18, 0.2, -0.35);
  hands.right.rotation.set(-0.12, 0, 0.15);
}

function buildViewGun(id) {
  if (viewGun) { combatResetGunParts(viewGun); vmRoot.remove(viewGun); }
  let g = combatViewCache.get(id);
  if (!g) { g = makeGunModel(id); combatViewCache.set(id, g); }
  combatResetGunParts(g);
  g.scale.setScalar(g.userData.viewScale);
  g.position.set(0.27, -0.27, -0.56);
  g.rotation.set(0, 0, 0);
  combatViewHands(g);
  vmRoot.add(g);
  viewGun = g;
  viewGunId = id;
}

/* third-person gun held in the right hand */
function attachAvatarGun(avatar, weaponId) {
  if (!avatar) return null;
  const parts = avatar.userData.parts;
  if (!parts || !parts.armR) return null;
  const u = avatar.userData;
  if (!WEAPON_BY_ID[weaponId]) weaponId = WEAPONS[0].id;
  if (u.gun && u.gun.userData.weaponId === weaponId) return u.gun;
  if (u.gun) {
    combatResetGunParts(u.gun);
    parts.armR.remove(u.gun);
  }
  if (!u.combatGuns) u.combatGuns = new Map();
  let g = u.combatGuns.get(weaponId);
  if (!g) { g = makeGunModel(weaponId); u.combatGuns.set(weaponId, g); }
  combatResetGunParts(g);
  g.scale.setScalar(g.userData.heldScale);
  g.userData.held = true;
  g.rotation.set(-Math.PI / 2, 0, 0);
  combatBindGrip(g);
  parts.armR.add(g);
  u.gun = g;
  return g;
}

const combatGripTemp = new THREE.Vector3();
function combatBindGrip(model) {
  combatGripTemp.copy(model.userData.grip).multiply(model.scale).applyQuaternion(model.quaternion);
  model.position.set(-combatGripTemp.x, -0.66 - combatGripTemp.y, -combatGripTemp.z);
}

const combatPoseEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const combatPoseQuat = new THREE.Quaternion();
const combatPoseInverse = new THREE.Quaternion();
const combatSupportTemp = new THREE.Vector3();
const combatArmDown = new THREE.Vector3(0, -1, 0);

/* Shared by local movement (after walk/head posing) and remote interpolation.
   Pitch is not damped: mouse input controls aim immediately. Only stance weight
   is eased. Compensating the wrist also keeps the barrel correct while the arms
   blend out of a walk, rather than shooting down the old hanging-arm axis. */
function updateAvatarWeaponPose(avatar, state, dt) {
  if (!avatar || !avatar.userData || !state) return;
  const parts = avatar.userData.parts, model = avatar.userData.gun;
  if (!parts || !parts.armR || !model) return;
  let pose = avatar.userData.combatPose;
  if (!pose) pose = avatar.userData.combatPose = { weight: 0 };
  const active = state.combat !== false && state.combat !== 0 && state.alive !== false && state.alive !== 0 &&
    (avatar !== localAvatar || !combatQuickBuilding());
  const firing = !!state.firing;
  const reload = active && Number.isFinite(state.reload) ? state.reload : -1;
  const rounds = Number.isFinite(state.reloadRounds) ? state.reloadRounds : model.userData.reloadRounds;
  updateWeaponReload(model, reload, rounds);
  model.visible = active;
  const weight = active ? 1 : 0;
  if (dt === 0 || firing) pose.weight = weight;
  else pose.weight += (weight - pose.weight) * combatDamp(20, dt);
  if (!active && avatar === localAvatar && combatQuickBuilding()) {
    const swing = Math.sin(player.walkPhase) * Math.min(1, player.groundSpeed / 4.6) * 0.65;
    const k = combatDamp(15, dt);
    parts.armR.rotation.x += (swing - parts.armR.rotation.x) * k;
    if (parts.armL) parts.armL.rotation.x += (-swing - parts.armL.rotation.x) * k;
  }
  if (pose.weight < 0.001) return;
  const pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, Number.isFinite(state.pitch) ? state.pitch : 0));
  const rp = model.userData.reloadPose;
  const w = WEAPON_BY_ID[model.userData.weaponId] || WEAPONS[0];
  const recoil = reload < 0 ? combatClamp01(state.kick) * w.recoil * 0.75 : 0;
  const right = parts.armR;
  const handgun = w.id === 'pistol' || w.id === 'revolver';
  // Bring the grip inward instead of fully extending a rifle at arm's length;
  // the support hand can then reach its rear foregrip without stretched limbs.
  const shoulder = handgun ? (state.aim ? 1.50 : 1.42) : (state.aim ? 1.35 : 1.20);
  const targetR = shoulder + pitch + rp.pitch * 0.5 + recoil;
  right.rotation.x += (targetR - right.rotation.x) * pose.weight;
  right.rotation.y *= 1 - pose.weight;
  right.rotation.z += ((handgun ? -0.48 : -0.90) - right.rotation.z) * pose.weight;
  combatPoseQuat.setFromEuler(combatPoseEuler.set(pitch + rp.pitch + recoil, rp.yaw, rp.roll));
  combatPoseInverse.copy(right.quaternion).invert();
  model.quaternion.copy(combatPoseInverse).multiply(combatPoseQuat);
  combatBindGrip(model);
  if (parts.armL) {
    // Point the support arm toward the foregrip or the current reload action.
    combatSupportTemp.copy(model.userData.supportTarget).multiply(model.scale).applyQuaternion(model.quaternion)
      .add(model.position).applyQuaternion(right.quaternion).add(right.position).sub(parts.armL.position).normalize();
    combatPoseQuat.setFromUnitVectors(combatArmDown, combatSupportTemp);
    parts.armL.quaternion.slerp(combatPoseQuat, pose.weight);
  }
}

function refreshGunModels() {
  const id = currentWeapon().id;
  if (localAvatar) attachAvatarGun(localAvatar, id);
  buildViewGun(id);
  combatRefreshLocalPose(0);
  updateGunVisual(0);
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
  const dur = w.report[0];
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const p = i / len;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - p, w.report[3]);
  }
  shotBuffers.set(w.id, buf);
  return buf;
}

function playShot(w, vol) {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const dur = w.report[0];
  const src = ctx.createBufferSource();
  src.buffer = shotBuffer(ctx, w);
  const flt = ctx.createBiquadFilter();
  flt.type = w.id === 'smg' ? 'bandpass' : 'lowpass';
  flt.frequency.value = w.report[1];
  flt.Q.value = w.id === 'revolver' ? 1.1 : 0.7;
  const gain = ctx.createGain();
  gain.gain.value = (w.sound || 0.5) * (vol == null ? 1 : vol);
  src.connect(flt).connect(gain).connect(ctx.destination);
  src.start(t);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(w.report[2], t);
  osc.frequency.exponentialRampToValueAtTime(w.id === 'sniper' ? 32 : 42, t + dur);
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

function muzzleBurst(position) {
  const src = combatMuzzleModel();
  let pos = position;
  if (!pos && src) {
    pos = new THREE.Vector3();
    src.updateWorldMatrix(true, true);
    src.userData.muzzle.getWorldPosition(pos);
  } else if (!pos) {
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
    if (r.hp <= 0) continue;
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
function getReloadProgress() {
  if (gun.reloading <= 0 || gun.reloadIndex !== gun.index || !alive || !combatMode || combatQuickBuilding()) return -1;
  return combatClamp01(1 - gun.reloading / Math.max(0.001, gun.reloadTotal));
}

function combatLocalPoseState() {
  return {
    pitch: player.pitch, aim: gun.aiming && gun.reloading <= 0,
    firing: gun.firePose > 0 || gun.trigger, reload: getReloadProgress(),
    reloadRounds: gun.reloadRounds, weapon: currentWeapon().id,
    combat: combatMode && !combatQuickBuilding(), alive, kick: gun.kick
  };
}

function combatRefreshLocalPose(dt) {
  if (localAvatar) updateAvatarWeaponPose(localAvatar, combatLocalPoseState(), dt);
}

/* One packet shape is used for WS and MQTT, including immediate mode, reload
   and weapon changes. Remote clocks advance progress from receipt, not from a
   sender's performance.now()/wall clock. */
function combatNetState(type) {
  const building = !combatMode || combatQuickBuilding();
  const ready = alive && !building && !craftOpen;
  return {
    t: type || 'state', x: player.pos.x, y: player.pos.y, z: player.pos.z,
    yaw: player.yaw, pitch: player.pitch, character: charKey, name: playerName,
    weapon: currentWeapon().id, hp: health,
    kills, deaths,
    aim: ready && gun.aiming && gun.reloading <= 0 ? 1 : 0,
    firing: ready && gun.reloading <= 0 && (gun.trigger || gun.firePose > 0) ? 1 : 0,
    combat: building ? 0 : 1, build: building ? 1 : 0,
    reload: getReloadProgress(), reloadTotal: gun.reloadTotal,
    reloadRounds: gun.reloadRounds,
    crouch: player.crouching ? 1 : 0, slide: player.sliding ? 1 : 0
  };
}

function cancelReload(notify) {
  const wasReloading = gun.reloading > 0;
  gun.reloading = 0;
  gun.reloadIndex = -1;
  gun.reloadRounds = 0;
  combatResetGunParts(viewGun);
  if (localAvatar) combatResetGunParts(localAvatar.userData.gun);
  combatRefreshLocalPose(0);
  updateGunVisual(0);
  if (wasReloading) {
    if (reloadFillEl) reloadFillEl.style.width = '0%';
    updateCombatHud();
    if (notify !== false) netSend(combatNetState('reload'));
  }
}

const combatAimMatrix = new THREE.Matrix4();
const combatAimQuat = new THREE.Quaternion();
const combatAimParentQuat = new THREE.Quaternion();
const combatAimMuzzle = new THREE.Vector3();
const combatWorldUp = new THREE.Vector3(0, 1, 0);
const combatVisualOrigin = new THREE.Vector3();
const combatVisualDir = new THREE.Vector3();
const combatVisualTarget = new THREE.Vector3();

function combatAimGunAt(model, target) {
  if (!model || !model.parent || !model.userData.muzzle) return;
  // Two short solves account for the bore being above the grip. All scratch
  // objects are shared; this runs only for the local gun(s), never every peer.
  for (let i = 0; i < 2; i++) {
    model.userData.muzzle.getWorldPosition(combatAimMuzzle);
    if (combatAimMuzzle.distanceToSquared(target) < 0.0001) break;
    combatAimMatrix.lookAt(combatAimMuzzle, target, combatWorldUp);
    combatAimQuat.setFromRotationMatrix(combatAimMatrix);
    model.parent.getWorldQuaternion(combatAimParentQuat).invert();
    model.quaternion.copy(combatAimParentQuat).multiply(combatAimQuat);
    if (model.userData.held) combatBindGrip(model);
  }
  model.updateWorldMatrix(true, true);
}

function combatMuzzleModel() {
  return !thirdPerson && !isScopeActive() && viewGun ? viewGun : localAvatar && localAvatar.userData.gun;
}

function combatGetMuzzle(out) {
  const model = combatMuzzleModel();
  if (model && model.userData.muzzle) {
    model.updateWorldMatrix(true, true);
    model.userData.muzzle.getWorldPosition(out);
  } else {
    camera.getWorldPosition(out);
    camera.getWorldDirection(combatVisualDir);
    out.addScaledVector(combatVisualDir, 0.7);
  }
  return out;
}

function combatCameraTarget(w, origin, dir) {
  const block = raycastVoxel(w.range, origin, dir);
  const blockT = block ? block.dist : w.range;
  const ent = raycastRemote(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, blockT);
  return origin.clone().addScaledVector(dir, ent ? ent.t : blockT);
}

function combatMuzzleObstruction(muzzle) {
  const anchor = new THREE.Vector3(player.pos.x, player.pos.y + 1.3, player.pos.z);
  const parts = localAvatar && localAvatar.userData.parts;
  if (parts && parts.armR) {
    parts.armR.getWorldPosition(combatAimMuzzle);
    anchor.y = combatAimMuzzle.y;
  }
  const dir = muzzle.clone().sub(anchor);
  const distance = dir.length();
  if (distance < 0.0001) return null;
  dir.multiplyScalar(1 / distance);
  const block = raycastVoxel(distance + 0.012, anchor, dir);
  if (!block) return null;
  return {
    block,
    point: anchor.clone().addScaledVector(dir, block.dist),
    from: anchor.addScaledVector(dir, Math.max(0, block.dist - 0.025))
  };
}

// Only genuine pointer motion invalidates the last camera sample. Console and
// logic tests may deliberately set a camera ray; fireOnce must respect it.
let combatLookNeedsSync = false;
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === renderer.domElement && (e.movementX || e.movementY)) combatLookNeedsSync = true;
});
for (const event of ['mousedown', 'mouseup']) document.addEventListener(event, (e) => {
  if (e.button === 2 && document.pointerLockElement === renderer.domElement) combatLookNeedsSync = true;
});

function flashHitmarker(head) {
  if (!hitmarkerEl) return;
  hitmarkerEl.classList.remove('show');
  void hitmarkerEl.offsetWidth;
  hitmarkerEl.classList.add('show');
  hitmarkerEl.style.filter = head ? 'drop-shadow(0 0 7px #ffb03c)' : '';
  playTone(head ? 1180 : 860, 0.06, 'triangle', 0.07);
}

function startReload() {
  if (!alive || !combatMode || combatQuickBuilding() || loading || craftOpen) return;
  const w = currentWeapon();
  if (gun.reloading > 0 || gun.ammo[gun.index] >= w.mag) return;
  gun.reloading = w.reload;
  gun.reloadTotal = w.reload;
  gun.reloadIndex = gun.index;
  gun.reloadRounds = Math.max(1, w.mag - gun.ammo[gun.index]);
  if (viewGun) viewGun.userData.reloadRounds = gun.reloadRounds;
  if (localAvatar && localAvatar.userData.gun) localAvatar.userData.gun.userData.reloadRounds = gun.reloadRounds;
  gun.trigger = false;
  gun.kick = 0;
  gun.firePose = 0;
  playTone(300, 0.05, 'square', 0.06);
  netSend(combatNetState('reload'));
  updateCombatHud();
}

function fireOnce() {
  if (!alive || !combatMode || combatQuickBuilding() || loading || craftOpen) return;
  const w = currentWeapon();
  if (gun.cooldown > 0 || gun.reloading > 0) return;
  if (gun.ammo[gun.index] <= 0) { startReload(); return; }
  if (combatLookNeedsSync && typeof updateCamera === 'function') updateCamera(0);
  combatLookNeedsSync = false;
  gun.firePose = 1;
  if (typeof updateAvatar === 'function') updateAvatar(0);
  combatRefreshLocalPose(0);
  camera.updateWorldMatrix(true, false);

  const origin = camera.getWorldPosition(new THREE.Vector3());
  const baseDir = camera.getWorldDirection(new THREE.Vector3());
  const target = combatCameraTarget(w, origin, baseDir);
  const from = combatGetMuzzle(new THREE.Vector3());
  // A camera collision can put its target behind the held barrel. Do not twist
  // the wrist around or fire backward in that case.
  if (target.clone().sub(from).dot(baseDir) < 0.1) target.copy(from).addScaledVector(baseDir, w.range);
  const source = combatMuzzleModel();
  combatAimGunAt(source, target);
  combatGetMuzzle(from);
  const obstruction = combatMuzzleObstruction(from);

  gun.ammo[gun.index]--;
  gun.cooldown = 60 / w.rpm;
  gun.kick = 1;
  const helper = Math.abs(baseDir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(baseDir, helper).normalize();
  const up = new THREE.Vector3().crossVectors(right, baseDir).normalize();

  // Establish this shot's weapon/combat state before its hit messages. This is
  // important for firing immediately after cancelling a combat blueprint.
  netSend({ ...combatNetState('shot'), x: from.x, y: from.y, z: from.z });
  let hitAny = false, hitHead = false;
  for (let i = 0; i < w.pellets; i++) {
    if (obstruction) {
      if (i === 0) { addTracer(obstruction.from, obstruction.point); addImpact(obstruction.point, '#cbb593'); }
      if (typeof damageVoxelFromShot === 'function') damageVoxelFromShot(obstruction.block, w.id, w.damage);
      continue;
    }
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * w.spread * (gun.aiming ? w.adsSpread : 1);
    const cameraDir = baseDir.clone()
      .addScaledVector(right, Math.cos(ang) * rad)
      .addScaledVector(up, Math.sin(ang) * rad)
      .normalize();
    const aimPoint = combatCameraTarget(w, origin, cameraDir);
    const dir = aimPoint.sub(from);
    if (dir.dot(baseDir) <= 0.05) dir.copy(cameraDir);
    dir.normalize();
    // Damage and the tracer use the same muzzle ray. The camera chooses the
    // crosshair target; it no longer lets a barrel bypass adjacent cover.
    const block = raycastVoxel(w.range, from, dir);
    const blockT = block ? block.dist : w.range;
    const ent = raycastRemote(from.x, from.y, from.z, dir.x, dir.y, dir.z, Math.min(blockT, w.range));
    const end = ent
      ? from.clone().addScaledVector(dir, ent.t)
      : from.clone().addScaledVector(dir, blockT);
    addTracer(from, end);

    if (ent) {
      hitAny = true;
      if (ent.head) hitHead = true;
      const dmg = Math.round(w.damage * (ent.head ? 2 : 1) * (ent.t > w.range * 0.65 ? 0.8 : 1));
      netSend({ t: 'hit', target: ent.r.id, dmg, head: ent.head, weapon: w.id, byId: net.id, by: playerName });
      addImpact(end, '#b83030');
    } else if (block) {
      addImpact(end, '#cbb593');
      if (typeof damageVoxelFromShot === 'function') damageVoxelFromShot(block, w.id, w.damage);
    }
  }

  if (hitAny) flashHitmarker(hitHead);
  muzzleBurst(obstruction ? obstruction.from : from);
  playShot(w);
  player.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, player.pitch + w.recoil * (gun.aiming ? 0.7 : 1)));
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
  gun.firePose = 0;
  gun.kick = 0;
  cancelReload(false);
  if (typeof resetPlayerMotion === 'function') resetPlayerMotion();
  if (typeof cancelQuickBuild === 'function') cancelQuickBuild();
  if (typeof resetBuildingInput === 'function') resetBuildingInput();
  player.vel.set(0, 0, 0);
  updateGunVisual(0);
  setHealth(0);
  setKd();
  if (deathEl) deathEl.classList.add('show');
  if (respawnInEl) respawnInEl.textContent = '3';
  if (deathEl) deathEl.querySelector('h2').textContent = byName && byName !== '???' ? safeName(byName) + ' got you' : 'Eliminated';
  addKillFeed(byName, playerName);
  netSend({ t: 'died', id: net.id, victim: playerName, by: safeName(byName), byId: byId || '', weapon: currentWeapon().id, kills, deaths });
  playTone(90, 0.5, 'sawtooth', 0.14);
}

function doRespawn() {
  const spawn = findSpawn();
  player.pos.set(spawn.x, spawn.y, spawn.z);
  player.vel.set(0, 0, 0);
  if (typeof resetPlayerMotion === 'function') resetPlayerMotion();
  if (typeof resetBuildingInput === 'function') resetBuildingInput();
  health = MAX_HEALTH;
  alive = true;
  gun.ammo = WEAPONS.map((w) => w.mag);
  cancelReload(false);
  gun.cooldown = 0;
  gun.aiming = false;
  gun.trigger = false;
  gun.firePose = gun.kick = gun.viewAim = 0;
  gun.equip = 1;
  lastDamageAt = -9999;
  if (deathEl) deathEl.classList.remove('show');
  if (hurtEl) hurtEl.style.opacity = '0';
  setHealth(health);
  updateGunVisual(0);
  updateCombatHud();
  netSend({ ...combatNetState('respawn'), id: net.id });
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
  if (!Number.isInteger(i) || i < 0 || i >= WEAPONS.length) return;
  if (gun.index === i) return;
  cancelReload(false);
  gun.index = i;
  gun.cooldown = 0.18;
  gun.aiming = false;
  gun.trigger = false;
  gun.firePose = gun.kick = gun.viewAim = 0;
  gun.equip = 1;
  refreshGunModels();
  playTone(420, 0.04, 'square', 0.05);
  netSend(combatNetState());
}

function cycleWeapon(direction) {
  selectWeapon((gun.index + (direction < 0 ? -1 : 1) + WEAPONS.length) % WEAPONS.length);
}

function setCombatMode(on) {
  combatMode = !!on;
  document.body.classList.toggle('combat', combatMode);
  document.body.classList.toggle('build', !combatMode);
  hintEl.classList.add('hidden');
  gun.trigger = false;
  gun.aiming = false;
  gun.firePose = gun.kick = gun.viewAim = 0;
  cancelReload(false);
  if (typeof cancelQuickBuild === 'function') cancelQuickBuild();
  if (typeof resetBuildingInput === 'function') resetBuildingInput();
  updateGunVisual(0);
  netSend(combatNetState());
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
  dt = Math.max(0, Number.isFinite(dt) ? dt : 0);
  now = Number.isFinite(now) ? now : performance.now();
  const reduced = combatReducedMotion && combatReducedMotion.matches;
  const scoped = isScopeActive();
  const sprint = !reduced && alive && !scoped && !gun.trigger && !player.fly && player.groundSpeed > 5.3 &&
    (player.sprinting || keys.ShiftLeft || keys.ShiftRight);
  const targetFov = scoped ? currentWeapon().scopeFov : 74 + (sprint ? 3 : 0);
  const nextFov = camera.fov + (targetFov - camera.fov) * combatDamp(reduced ? 20 : 14, dt);
  if (Math.abs(camera.fov - targetFov) > 0.001) {
    camera.fov = Math.abs(nextFov - targetFov) < 0.001 ? targetFov : nextFov;
    camera.updateProjectionMatrix();
  }
  if (!alive) {
    const left = Math.max(0, respawnAt - now);
    if (respawnInEl) respawnInEl.textContent = String(Math.max(1, Math.ceil(left / 1000)));
    if (left <= 0) doRespawn();
    updateGunVisual(dt);
    updateFx(dt);
    if (thirdPerson && localAvatar) {
      localAvatar.rotation.z += (1.35 - localAvatar.rotation.z) * combatDamp(4, dt);
    }
    return;
  }
  if (localAvatar) localAvatar.rotation.z += (0 - localAvatar.rotation.z) * combatDamp(8, dt);

  const cooldownCarry = gun.cooldown > 0 ? Math.min(0, gun.cooldown - dt) : 0;
  gun.cooldown = Math.max(0, gun.cooldown - dt);
  gun.kick *= Math.exp(-currentWeapon().recover * dt);
  if (gun.kick < 0.0001) gun.kick = 0;
  gun.firePose = Math.max(0, gun.firePose - dt * 3.5);
  if (gun.reloading > 0 && (!combatMode || combatQuickBuilding() || craftOpen || gun.reloadIndex !== gun.index)) cancelReload();
  if (gun.reloading > 0) {
    gun.reloading -= dt;
    if (gun.reloading <= 0) {
      const completedIndex = gun.reloadIndex;
      cancelReload(false);
      if (completedIndex === gun.index) gun.ammo[completedIndex] = currentWeapon().mag;
      playTone(620, 0.05, 'square', 0.06);
      updateCombatHud();
      netSend(combatNetState('reload'));
    } else if (reloadFillEl) {
      reloadFillEl.style.width = getReloadProgress() * 100 + '%';
    }
  }
  if (gun.trigger && currentWeapon().auto) {
    const before = gun.ammo[gun.index];
    fireOnce();
    if (gun.ammo[gun.index] < before) gun.cooldown = Math.max(0, gun.cooldown + cooldownCarry);
  }

  if (now - lastDamageAt > 7000 && health < MAX_HEALTH) {
    health = Math.min(MAX_HEALTH, health + dt * 9);
    setHealth(health);
  }

  updateGunVisual(dt);
  updateFx(dt);
}

function updateGunVisual(dt) {
  const active = alive && combatMode && !combatQuickBuilding() && !craftOpen;
  const scoped = isScopeActive();
  combatUpdateScopeHud();
  const showView = !thirdPerson && active && !scoped;
  const w = currentWeapon(), reload = getReloadProgress();
  const reduced = combatReducedMotion && combatReducedMotion.matches;
  const aim = active && gun.aiming && reload < 0 ? 1 : 0;
  gun.viewAim += (aim - gun.viewAim) * combatDamp(18, dt);
  gun.equip *= Math.exp(-18 * Math.max(0, dt));
  vmRoot.visible = showView;
  if (viewGun) {
    viewGun.visible = showView;
    updateWeaponReload(viewGun, active ? reload : -1, gun.reloadRounds);
    const rp = viewGun.userData.reloadPose, a = gun.viewAim;
    const move = reduced ? 0 : Math.min(1, Math.max(0, player.groundSpeed) / 7.3) * (1 - a) * (reload < 0 ? 1 : 0);
    const phase = Number.isFinite(player.walkPhase) ? player.walkPhase : 0;
    const recoil = gun.kick * w.kickBack * (reduced ? 0.35 : 1);
    // Base + offsets, not an offset accumulated on last frame's position.
    viewGun.position.set(
      0.27 + (0.008 - 0.27) * a + rp.x + Math.sin(phase) * 0.008 * move,
      -0.27 + ((w.id === 'sniper' ? -0.185 : -0.15) + 0.27) * a + rp.y - gun.equip * (reduced ? 0.03 : 0.12) + Math.cos(phase * 2) * 0.006 * move,
      -0.56 + 0.045 * a + rp.z + recoil
    );
    viewGun.rotation.set(rp.pitch, rp.yaw, rp.roll);
    combatViewHands(viewGun);
  }
  if (localAvatar) {
    const held = localAvatar.userData.gun;
    if (held) {
      held.visible = active && thirdPerson && !scoped;
      updateWeaponReload(held, active ? reload : -1, gun.reloadRounds);
    }
    // Avatar visibility belongs to camera collision/movement, not combat.
    if (scoped) localAvatar.visible = false;
  }
  if (active && reload < 0 && !scoped) {
    camera.getWorldPosition(combatVisualOrigin);
    camera.getWorldDirection(combatVisualDir);
    const block = raycastVoxel(w.range, combatVisualOrigin, combatVisualDir);
    combatVisualTarget.copy(combatVisualOrigin).addScaledVector(combatVisualDir, block ? block.dist : w.range);
    combatGetMuzzle(combatAimMuzzle);
    if ((combatVisualTarget.x - combatAimMuzzle.x) * combatVisualDir.x +
        (combatVisualTarget.y - combatAimMuzzle.y) * combatVisualDir.y +
        (combatVisualTarget.z - combatAimMuzzle.z) * combatVisualDir.z < 0.1) {
      combatVisualTarget.copy(combatAimMuzzle).addScaledVector(combatVisualDir, w.range);
    }
    if (showView) combatAimGunAt(viewGun, combatVisualTarget);
    if (thirdPerson && localAvatar) combatAimGunAt(localAvatar.userData.gun, combatVisualTarget);
  }
  if (dt > 0) combatLookNeedsSync = false;
}
