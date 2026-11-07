/* Blockcraft Battle Ground — Weapons, gun models, audio, effects, hit tests, health, death and respawn.
   60-combat.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ============================================================
   Guns, health & combat
   ============================================================ */

const WEAPONS = [
  { id: 'pistol',   name: 'Pistol',   damage: 30, rpm: 360, mag: 14, spread: 0.008, recoil: 0.026, range: 90, pellets: 1, head: 2.0, auto: false, reload: 1.15, sound: 0.55, scopeFov: 64, adsSpread: 0.42, kickBack: 0.065, recover: 20, report: [0.17, 1800, 158, 3.0] },
  { id: 'rifle',    name: 'Rifle',    damage: 23, rpm: 640, mag: 30, spread: 0.014, recoil: 0.013, range: 130, pellets: 1, head: 1.6, auto: true,  reload: 1.85, sound: 0.42, scopeFov: 58, adsSpread: 0.36, kickBack: 0.048, recover: 25, report: [0.12, 2400, 176, 3.6] },
  { id: 'shotgun',  name: 'Shotgun',  damage: 14, rpm: 75, mag: 6, spread: 0.075, recoil: 0.070, range: 34, pellets: 9, head: 1.5, auto: false, reload: 2.35, sound: 0.80, scopeFov: 70, adsSpread: 0.72, kickBack: 0.120, recover: 13, report: [0.30, 850, 105, 2.0] },
  { id: 'smg',      name: 'SMG',      damage: 15, rpm: 880, mag: 32, spread: 0.023, recoil: 0.010, range: 70, pellets: 1, head: 1.4, auto: true,  reload: 1.45, sound: 0.34, scopeFov: 66, adsSpread: 0.48, kickBack: 0.038, recover: 30, report: [0.09, 3200, 215, 4.2] },
  { id: 'sniper',   name: 'Sniper',   damage: 115, rpm: 42, mag: 5, spread: 0.032, recoil: 0.095, range: 180, pellets: 1, head: 2.0, auto: false, reload: 2.80, sound: 0.95, scopeFov: 18, adsSpread: 0.025, kickBack: 0.135, recover: 10, report: [0.38, 1450, 84, 2.3] },
  { id: 'revolver', name: 'Revolver', damage: 58, rpm: 170, mag: 6, spread: 0.006, recoil: 0.055, range: 105, pellets: 1, head: 2.0, auto: false, reload: 2.40, sound: 0.73, scopeFov: 60, adsSpread: 0.34, kickBack: 0.100, recover: 15, report: [0.25, 2050, 126, 2.7] },
  { id: 'lmg',      name: 'LMG',      damage: 21, rpm: 600, mag: 75, spread: 0.022, recoil: 0.021, range: 145, pellets: 1, head: 1.4, auto: true,  reload: 3.60, sound: 0.62, scopeFov: 62, adsSpread: 0.50, kickBack: 0.075, recover: 18, report: [0.19, 1250, 118, 3.2] },
  { id: 'dmr',      name: 'Marksman', damage: 44, rpm: 240, mag: 12, spread: 0.006, recoil: 0.030, range: 150, pellets: 1, head: 1.8, auto: false, reload: 2.20, sound: 0.70, scopeFov: 44, adsSpread: 0.20, kickBack: 0.090, recover: 16, report: [0.22, 1900, 140, 2.8] },
  { id: 'burst',    name: 'Burst Rifle', damage: 30, rpm: 800, mag: 30, spread: 0.012, recoil: 0.012, range: 120, pellets: 1, head: 1.5, auto: false, burst: 3, burstGap: 0.34, reload: 2.00, sound: 0.46, scopeFov: 56, adsSpread: 0.38, kickBack: 0.046, recover: 26, report: [0.11, 2500, 170, 3.8] },
  { id: 'machinepistol', name: 'Machine Pistol', damage: 13, rpm: 1050, mag: 28, spread: 0.030, recoil: 0.009, range: 55, pellets: 1, head: 1.3, auto: true, reload: 1.25, sound: 0.30, scopeFov: 68, adsSpread: 0.60, kickBack: 0.032, recover: 32, report: [0.07, 3600, 230, 4.6] },
  { id: 'doublebarrel', name: 'Double Barrel', damage: 18, rpm: 300, mag: 2, spread: 0.090, recoil: 0.090, range: 24, pellets: 8, head: 1.3, auto: false, reload: 2.60, sound: 0.90, scopeFov: 72, adsSpread: 0.80, kickBack: 0.140, recover: 12, report: [0.34, 760, 92, 1.9] },
  { id: 'crossbow', name: 'Crossbow', damage: 120, rpm: 60, mag: 1, spread: 0.004, recoil: 0.030, range: 130, pellets: 1, head: 2.0, auto: false, reload: 1.80, sound: 0.14, scopeFov: 46, adsSpread: 0.10, kickBack: 0.050, recover: 14, report: [0.05, 900, 210, 6.0] }
];
const WEAPON_BY_ID = Object.create(null);
const COMBAT_OPTIC_TYPES = {
  pistol: 'reflex', rifle: 'holo', shotgun: 'spread', smg: 'chevron',
  sniper: 'mildot', revolver: 'precision', lmg: 'support',
  dmr: 'holo', burst: 'holo', machinepistol: 'chevron', doublebarrel: 'spread', crossbow: 'holo'
};
// Newer guns borrow the reload animation and sights of the gun they work like.
const COMBAT_FAMILY = { dmr: 'rifle', burst: 'rifle', machinepistol: 'smg', doublebarrel: 'shotgun', crossbow: 'sniper' };
const COMBAT_OPTIC_FAMILY = { crossbow: 'rifle' };
/* Keep the old optic tags for integrations; view, not optic, selects geometry.
   ADS times are time to 99.9% settled. These profiles NEVER change the legal
   damage/rpm/mag/range/pellets/reload values used by the room authority. */
const COMBAT_HANDLING = {
  pistol: {
    view: 'pistol-irons', sight: 'Open irons', role: 'Precision sidearm', adsInMs: 160, adsOutMs: 110, adsZ: -0.55,
    openingShots: 0, openingScale: 1, burstGapMs: 320, bloomPerShot: 0.22, bloomMax: 0.95, bloomRecovery: 0.85,
    moveSpread: 0.65, adsMoveSpread: 0.35, airSpread: 1.2, recoilScale: 0.88, recoilCap: 0.06,
    recoilHoldMs: 65, recoilReturn: 13, lateral: 0.18, yawPattern: [-0.6, 0.35, -0.2, 0.45],
    viewRise: 1.8, viewRoll: -0.028, cycle: 0.14, mechanism: 'slide', cueAt: -1,
    reloadStages: [[0.14, 'magazine out'], [0.43, 'magazine in'], [0.72, 'slide rack']]
  },
  rifle: {
    view: 'rifle-reflex', sight: 'Reflex window', role: 'Controlled bursts', adsInMs: 230, adsOutMs: 150, adsZ: -0.61,
    openingShots: 3, openingScale: 0.62, burstGapMs: 260, bloomPerShot: 0.17, bloomMax: 1.35, bloomRecovery: 1.3,
    moveSpread: 1, adsMoveSpread: 0.65, airSpread: 1.6, recoilScale: 0.82, recoilCap: 0.075,
    recoilHoldMs: 110, recoilReturn: 10, lateral: 0.28, yawPattern: [0.2, 0.45, -0.15, 0.65, -0.25, 0.4],
    viewRise: 1.4, viewRoll: 0.012, cycle: 0.085, mechanism: 'gas', cueAt: -1,
    reloadStages: [[0.15, 'magazine out'], [0.44, 'magazine in'], [0.74, 'charging handle']]
  },
  shotgun: {
    view: 'shotgun-rib', sight: 'Bead / barrel rib', role: 'Close-range breach', adsInMs: 200, adsOutMs: 135, adsZ: -0.58,
    openingShots: 0, openingScale: 1, burstGapMs: 850, bloomPerShot: 0.18, bloomMax: 0.4, bloomRecovery: 0.9,
    moveSpread: 0.25, adsMoveSpread: 0.15, airSpread: 0.65, recoilScale: 0.94, recoilCap: 0.10,
    recoilHoldMs: 135, recoilReturn: 7.5, lateral: 0.12, yawPattern: [0.65, -0.35],
    viewRise: 1.35, viewRoll: 0.038, cycle: 0.60, mechanism: 'pump', cueAt: 0.18,
    reloadStages: [[0.12, 'loading gate'], [0.17, 'shell feed'], [0.82, 'pump chamber']]
  },
  smg: {
    view: 'smg-hood', sight: 'CQB hood', role: 'Mobile close quarters', adsInMs: 130, adsOutMs: 95, adsZ: -0.54,
    openingShots: 2, openingScale: 0.8, burstGapMs: 190, bloomPerShot: 0.17, bloomMax: 1.45, bloomRecovery: 1.6,
    moveSpread: 0.4, adsMoveSpread: 0.2, airSpread: 0.9, recoilScale: 0.70, recoilCap: 0.055,
    recoilHoldMs: 80, recoilReturn: 16, lateral: 0.45, yawPattern: [-0.65, 0.7, -0.3, 0.6],
    viewRise: 1.1, viewRoll: -0.016, cycle: 0.060, mechanism: 'blowback', cueAt: -1,
    reloadStages: [[0.12, 'magazine out'], [0.36, 'magazine in'], [0.65, 'bolt release']]
  },
  sniper: {
    view: 'sniper-tube', sight: 'Magnified tube', role: 'Stationary long range', adsInMs: 360, adsOutMs: 200, adsZ: -0.64,
    openingShots: 0, openingScale: 1, burstGapMs: 1500, bloomPerShot: 0.9, bloomMax: 1.2, bloomRecovery: 1.8,
    moveSpread: 1.2, adsMoveSpread: 5.2, airSpread: 2.5, recoilScale: 0.96, recoilCap: 0.10,
    recoilHoldMs: 190, recoilReturn: 5.8, lateral: 0.08, yawPattern: [0.4, -0.3],
    viewRise: 1.0, viewRoll: -0.025, cycle: 1.08, mechanism: 'bolt', cueAt: 0.24,
    reloadStages: [[0.10, 'bolt unlock'], [0.21, 'bolt back'], [0.34, 'magazine out'], [0.52, 'magazine in'], [0.74, 'bolt close']]
  },
  revolver: {
    view: 'revolver-notch', sight: 'Notch / blade', role: 'Deliberate heavy shots', adsInMs: 220, adsOutMs: 145, adsZ: -0.59,
    openingShots: 0, openingScale: 1, burstGapMs: 480, bloomPerShot: 0.38, bloomMax: 1.05, bloomRecovery: 0.7,
    moveSpread: 0.8, adsMoveSpread: 0.45, airSpread: 1.4, recoilScale: 0.98, recoilCap: 0.085,
    recoilHoldMs: 110, recoilReturn: 8, lateral: 0.2, yawPattern: [-0.65, -0.25, 0.35],
    viewRise: 2.0, viewRoll: -0.052, cycle: 0.25, mechanism: 'cylinder', cueAt: 0.035,
    reloadStages: [[0.08, 'cylinder open'], [0.25, 'case eject'], [0.50, 'speedloader'], [0.79, 'cylinder close']]
  },
  lmg: {
    view: 'lmg-aperture', sight: 'Support aperture', role: 'Braced sustained fire', adsInMs: 310, adsOutMs: 185, adsZ: -0.60,
    openingShots: 2, openingScale: 0.86, burstGapMs: 350, bloomPerShot: 0.21, bloomMax: 1.9, bloomRecovery: 0.95,
    moveSpread: 1.75, adsMoveSpread: 1.15, airSpread: 2.0, recoilScale: 0.92, recoilCap: 0.09,
    recoilHoldMs: 145, recoilReturn: 6.8, lateral: 0.35, yawPattern: [0.5, 0.7, -0.35, 0.8, -0.25],
    viewRise: 1.6, viewRoll: 0.024, cycle: 0.10, mechanism: 'belt', cueAt: -1,
    reloadStages: [[0.10, 'feed cover open'], [0.26, 'box out'], [0.47, 'box in'], [0.57, 'belt seat'], [0.79, 'cover latch'], [0.91, 'charging handle']]
  }
};
Object.assign(COMBAT_HANDLING, {
  dmr: { ...COMBAT_HANDLING.rifle, sight: 'Reflex window', role: 'Accurate mid to long range', adsInMs: 260, adsOutMs: 165, openingShots: 0, openingScale: 1,
    burstGapMs: 420, bloomPerShot: 0.3, bloomMax: 1.0, bloomRecovery: 1.2, moveSpread: 1.1, adsMoveSpread: 0.9, recoilScale: 0.95, recoilCap: 0.09,
    yawPattern: [0.35, -0.25, 0.2], viewRise: 1.7, cycle: 0.16 },
  burst: { ...COMBAT_HANDLING.rifle, sight: 'Reflex window', role: 'Three rounds, then a pause', adsInMs: 215, burstGapMs: 340, bloomPerShot: 0.11, bloomMax: 0.9,
    bloomRecovery: 1.5, recoilScale: 0.7, yawPattern: [0.15, -0.2, 0.25], cycle: 0.07 },
  machinepistol: { ...COMBAT_HANDLING.smg, sight: 'CQB hood', role: 'Fastest gun, shortest reach', adsInMs: 105, adsOutMs: 80, bloomPerShot: 0.2, bloomMax: 1.7,
    recoilScale: 0.62, lateral: 0.6, yawPattern: [-0.8, 0.85, -0.45, 0.7], cycle: 0.05, reloadStages: [[0.14, 'magazine out'], [0.42, 'magazine in'], [0.7, 'bolt release']] },
  doublebarrel: { ...COMBAT_HANDLING.shotgun, sight: 'Bead', role: 'Two huge close shots', adsInMs: 180, burstGapMs: 500, bloomMax: 0.5, recoilScale: 1, viewRise: 1.6, viewRoll: 0.05,
    cycle: 0.16, mechanism: 'break', cueAt: -1, reloadStages: [[0.12, 'action open'], [0.3, 'shells out'], [0.62, 'shells in'], [0.86, 'action shut']] },
  crossbow: { ...COMBAT_HANDLING.rifle, sight: 'Reflex window', role: 'Silent one-shot bolt', adsInMs: 280, adsOutMs: 170, openingShots: 0, openingScale: 1, burstGapMs: 1200,
    bloomPerShot: 0.2, bloomMax: 0.6, moveSpread: 1.3, adsMoveSpread: 1.5, recoilScale: 0.7, yawPattern: [0.2, -0.2], viewRise: 0.8, viewRoll: 0, cycle: 0.2,
    mechanism: 'string', cueAt: -1, reloadStages: [[0.2, 'cock string'], [0.6, 'bolt in'], [0.85, 'seat']] }
});
for (const w of WEAPONS) {
  w.family = COMBAT_FAMILY[w.id] || w.id;
  w.opticFamily = COMBAT_OPTIC_FAMILY[w.id] || w.family;
  w.optic = COMBAT_OPTIC_TYPES[w.id];
  w.handling = COMBAT_HANDLING[w.id];
  w.view = w.handling.view;
  w.role = w.handling.role;
  Object.freeze(w.handling.yawPattern);
  for (const stage of w.handling.reloadStages) Object.freeze(stage);
  Object.freeze(w.handling.reloadStages);
  Object.freeze(w.handling);
  WEAPON_BY_ID[w.id] = w;
}

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
  sway: 0,
  burstLeft: 0,
  bloom: WEAPONS.map(() => 0),
  shots: WEAPONS.map(() => 0),
  lastSpread: 0,
  recoilSide: 0,
  shotAge: -1,
  mechanismCued: false
};

// 150 HP with per-weapon headshot multipliers: every gun needs several body
// shots (roughly 0.55-0.8 s time-to-kill), precision rewards heads, and only
// a sniper headshot is a one-shot kill.
const MAX_HEALTH = 150;
const COMBAT_MAX_HIT = 300;
const COMBAT_RIDER_REACH = 5;
function combatRegenAllowed() {
  try {
    const def = BC.api && BC.api.modes && BC.api.modes.activeDef;
    return !def || def.regen !== false;
  } catch (e) { return true; }
}
function combatDamageCap(w, head) { return w ? w.damage * (head ? w.head || 2 : 1) : 0; }
let health = MAX_HEALTH;
let alive = true;
let lastDamageAt = -9999;
let respawnAt = 0;
let kills = 0;
let deaths = 0;
let combatMode = true;
let muted = false;

/* Burst memory and ONLY the recoil we add. Recovery subtracts that contribution,
   never the player's independent mouse motion. Climb stays bounded. */
let combatRecoilAccum = 0;
let combatRecoilStamp = -9999;
let combatBurstShots = 0;
let combatBurstStamp = -9999;
const COMBAT_RECOIL_CAP = 0.10;
const COMBAT_ASSIST_MAX_TURN = Math.PI / 720; // 0.25 degrees per shot
const COMBAT_PEER_STALE_MS = 2000;
const COMBAT_SOLID_RAY_EPS = 0.00001;
const COMBAT_MAX_WEAPON_RANGE = WEAPONS.reduce((max, w) => Math.max(max, w.range), 0);
/* undefined = not resolved yet, null = every weapon allowed. */
let combatAllowedIds;
let combatLastHitInfo = null;
let combatPendingHitPacket = null;
let combatPendingDeathPacket = null;

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
const combatScopeSightEl = document.getElementById('scopeSight');
const combatScopeRoleEl = document.getElementById('scopeRole');
const combatScopeFrameEl = document.getElementById('scopeFrame');
const combatCrosshairEl = document.getElementById('crosshair');
let combatScopeShown = null;
let combatScopeLabel = '';
let combatScopeFrameWidth = -1, combatScopeFrameHeight = -1;
let combatScopeFrameX = NaN, combatScopeFrameY = NaN;

const currentWeapon = () => WEAPONS[gun.index];
const safeName = (v) => String(v == null ? '' : v).replace(/[^\w \-'.]/g, '').trim().slice(0, 14) || '???';

/* ---------------- optional cross-module bridges ---------------- */
function combatApi(name) {
  try {
    return (typeof BC !== 'undefined' && BC && BC.api) ? BC.api[name] : null;
  } catch (e) { return null; }
}

function combatEmit(name, a, b, c) {
  try {
    if (typeof BC !== 'undefined' && BC && typeof BC.emit === 'function') BC.emit(name, a, b, c);
  } catch (e) { /* feedback must never break combat */ }
}

function combatWorldBusy() {
  try {
    const world = combatApi('world');
    return !!((world && world.busy) || (typeof BC !== 'undefined' && BC && BC.flags && BC.flags.worldBusy));
  } catch (e) { return true; }
}

function combatActionBlocked() {
  try {
    const riding = combatApi('riding'), killcam = combatApi('killcam');
    return combatWorldBusy() || !!(riding && riding.active) || !!(killcam && killcam.active) ||
      !!(typeof loading !== 'undefined' && loading) || !!(typeof craftOpen !== 'undefined' && craftOpen) ||
      !!(typeof BC !== 'undefined' && BC && BC.flags && (BC.flags.paused || BC.flags.playerRepairBlocked)) ||
      !!(typeof document !== 'undefined' && document.hidden);
  } catch (e) { return true; } // Later classic-script globals may still be in their TDZ.
}

function combatReleaseGun(notify) {
  combatClearGeneratedRecoil();
  gun.trigger = gun.aiming = false;
  gun.firePose = gun.kick = 0;
  gun.recoilSide = 0;
  gun.shotAge = -1;
  gun.mechanismCued = false;
  combatRecoilAccum = combatBurstShots = 0;
  combatRecoilStamp = combatBurstStamp = -9999;
  if (gun.reloading > 0) cancelReload(notify);
}

function combatAllowedWeapons() {
  const modes = combatApi('modes');
  if (!modes) return null;
  try {
    if (typeof modes.allowedWeapons === 'function') {
      const list = modes.allowedWeapons();
      return Array.isArray(list) ? list : null;
    }
    const def = modes.activeDef;
    return def && Array.isArray(def.weapons) ? def.weapons : null;
  } catch (e) { return null; }
}

function combatResolvedAllowed() {
  // Consult the mode on every action, but copy only when the small list changes.
  // This also catches late registration and callers that omit modeChanged.
  const ids = combatAllowedWeapons();
  let changed = combatAllowedIds === undefined || (ids === null) !== (combatAllowedIds === null);
  if (ids && combatAllowedIds) {
    changed = ids.length !== combatAllowedIds.length;
    for (let i = 0; !changed && i < ids.length; i++) changed = ids[i] !== combatAllowedIds[i];
  }
  if (changed) combatAllowedIds = ids ? ids.slice() : null;
  return combatAllowedIds;
}

function combatWeaponAllowed(w) {
  if (!w) return false;
  const ids = combatResolvedAllowed();
  if (ids && ids.indexOf(w.id) < 0) return false;
  const modes = combatApi('modes');
  try {
    return !(modes && typeof modes.canUseWeapon === 'function') || modes.canUseWeapon(w.id) !== false;
  } catch (e) { return false; }
}

function combatFirstAllowedIndex() {
  for (let i = 0; i < WEAPONS.length; i++) if (combatWeaponAllowed(WEAPONS[i])) return i;
  return -1;
}

function combatSyncLoadout() {
  const fx = combatApi('combatFx');
  if (fx && typeof fx.setLoadout === 'function') {
    try { fx.setLoadout(combatResolvedAllowed()); } catch (e) { /* overlay is optional */ }
  }
}

function combatTeamMode() {
  const modes = combatApi('modes');
  try {
    if (!modes) return false;
    if (modes.activeDef && typeof modes.activeDef.teams === 'boolean') return modes.activeDef.teams;
    return modes.localTeam === 'red' || modes.localTeam === 'blue';
  } catch (e) { return false; }
}

function combatTeamForId(id) {
  if (!id || !combatTeamMode()) return '';
  const modes = combatApi('modes');
  try {
    if (modes && (typeof modes.teamOf === 'function' || typeof modes.teamFor === 'function')) {
      const exact = typeof modes.teamOf === 'function' ? modes.teamOf(id) : modes.teamFor(id);
      if (exact === 'red' || exact === 'blue') return exact;
    }
    if (typeof net !== 'undefined' && net) {
      if (id === net.id && modes) return modes.localTeam === 'red' || modes.localTeam === 'blue' ? modes.localTeam : '';
      const peer = net.players && net.players.get(id);
      if (peer && (peer.team === 'red' || peer.team === 'blue')) return peer.team;
    }
  } catch (e) { return ''; }
  return '';
}

function combatIsFriendly(id, name, peer, explicitTeam) {
  if (!combatTeamMode()) return false;
  try {
    const self = typeof net !== 'undefined' && net ? net.id : '';
    if (id && id === self) return false; // Do not turn environmental/self damage into immunity.
    const modes = combatApi('modes');
    const localTeam = modes && (modes.localTeam === 'red' || modes.localTeam === 'blue')
      ? modes.localTeam : combatTeamForId(self);
    const resolved = id || combatIdByName(name);
    const team = explicitTeam === 'red' || explicitTeam === 'blue' ? explicitTeam
      : peer && (peer.team === 'red' || peer.team === 'blue') ? peer.team : combatTeamForId(resolved);
    return (localTeam === 'red' || localTeam === 'blue') && team === localTeam;
  } catch (e) { return false; }
}

function combatPeerEligible(peer, now) {
  if (!peer || !Number.isFinite(peer.hp) || peer.hp <= 0 || peer.dead === true || peer.alive === false ||
      peer.hidden === true || peer.visible === false || peer.stale === true || peer.deathNoted === true) return false;
  if (peer.deadUntil > now || (peer.group && peer.group.visible === false)) return false;
  const received = Number.isFinite(peer.lastRx) ? peer.lastRx : peer.recvAt;
  if (Number.isFinite(received) && (now - received > COMBAT_PEER_STALE_MS || received - now > 1000)) return false;
  try { if (typeof net !== 'undefined' && net && peer.id === net.id) return false; } catch (e) { /* ignore */ }
  return !combatIsFriendly(peer.id, peer.name, peer);
}

function combatBodyHeight(actor) {
  actor = actor || player;
  const local = actor === player;
  const low = !!(actor.crouching || actor.sliding || actor.crouch || actor.slide);
  let height = Number.isFinite(actor.bodyHeight) ? actor.bodyHeight : actor.height;
  if (!Number.isFinite(height) && actor.group && actor.group.userData) height = actor.group.userData.bodyHeight;
  if (!Number.isFinite(height)) {
    try {
      if (typeof playerBodyHeight === 'function') {
        const value = local ? playerBodyHeight() : playerBodyHeight(actor);
        // A no-argument local-only helper must not shrink a standing enemy just
        // because this player is crouching (or do the reverse).
        if (Number.isFinite(value) && (local || (low ? value <= 1.45 : value >= 1.5))) height = value;
      }
    } catch (e) { /* Movement may not have registered its height helper yet. */ }
  }
  if (!Number.isFinite(height)) height = low ? 1.2 : (typeof PH === 'number' ? PH : 1.8);
  return Math.max(0.8, Math.min(2.5, height));
}

function combatSourcePosition() {
  const out = new THREE.Vector3();
  try {
    const model = combatMuzzleModel();
    if (model && model.userData && model.userData.muzzle) {
      model.updateWorldMatrix(true, true);
      model.userData.muzzle.getWorldPosition(out);
      if (Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z)) return out;
    }
  } catch (e) { /* A source position is still available before models are built. */ }
  return out.copy(player.pos).addScaledVector(combatWorldUp, combatBodyHeight(player) * 2 / 3);
}

function combatSpatialAudioAvailable() {
  const spatialAudio = combatApi('audio');
  return !!(spatialAudio && spatialAudio.available);
}

function combatSettingsStore() {
  const settings = combatApi('settings');
  if (settings) return settings;
  try {
    const fallback = typeof BC !== 'undefined' && BC ? BC.settings : null;
    return fallback && typeof fallback.get === 'function' && fallback.get('muted') !== undefined ? fallback : null;
  } catch (e) { return null; }
}

function combatReadMute() {
  const settings = combatSettingsStore();
  try {
    if (settings) {
      const value = typeof settings.get === 'function' ? settings.get('muted') : settings.muted;
      if (typeof value === 'boolean') return value;
      if (typeof settings.muted === 'boolean') return settings.muted;
    }
    const spatialAudio = combatApi('audio');
    if (spatialAudio && typeof spatialAudio.muted === 'boolean') return spatialAudio.muted;
  } catch (e) { /* The legacy flag remains a valid fallback. */ }
  return muted;
}

function combatSyncMute(value) {
  muted = typeof value === 'boolean' ? value : combatReadMute();
  const spatialAudio = combatApi('audio');
  if (spatialAudio && typeof spatialAudio.setMuted === 'function') {
    try { if (spatialAudio.muted !== muted) spatialAudio.setMuted(muted); } catch (e) { /* optional */ }
  }
}

function combatIdByName(name) {
  const clean = safeName(name);
  try {
    if (typeof net === 'undefined' || !net) return '';
    if (typeof playerName !== 'undefined' && safeName(playerName) === clean && net.id) return net.id;
    if (net.players) for (const [id, r] of net.players) if (r && safeName(r.name) === clean) return id;
  } catch (e) { /* ignore */ }
  return '';
}

/* Authoritative tokens, not predicted HP, identify a kill. Legacy rows without
   a token use a bounded fallback; they never suppress a distinct supplied token. */
const combatKfDedupe = new Map();

function combatOnLoadoutChanged() {
  combatResolvedAllowed();
  const first = combatFirstAllowedIndex();
  if (!combatWeaponAllowed(currentWeapon())) {
    combatReleaseGun(false);
    if (first >= 0) selectWeapon(first, true);
  }
  combatSyncLoadout();
  updateCombatHud();
}

function combatQuickBuilding() {
  return typeof quickBuild !== 'undefined' && !!quickBuild.active;
}

// Shared with 50's shoulder/eye camera. Every ADS view uses the eye camera;
// scope does NOT imply a circular mask or a hidden gun. Aim input is immediate.
function isScopeActive() {
  return !!(combatMode && gun.aiming && alive && !combatQuickBuilding() &&
    !combatActionBlocked() && combatWeaponAllowed(currentWeapon()));
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
  const label = w.id + ':' + w.scopeFov + ':' + w.optic + ':' + w.view;
  if (combatScopeLabel !== label) {
    if (combatScopeOverlayEl) {
      combatScopeOverlayEl.dataset.optic = w.optic;
      combatScopeOverlayEl.dataset.view = w.view;
      combatScopeOverlayEl.dataset.reticleSource = w.view === 'sniper-tube' ? 'tube' : 'model';
    }
    if (combatScopeWeaponEl) combatScopeWeaponEl.textContent = w.name;
    if (combatScopeZoomEl) combatScopeZoomEl.textContent = (Math.tan(74 * Math.PI / 360) / Math.tan(w.scopeFov * Math.PI / 360)).toFixed(1) + '×';
    if (combatScopeSightEl) combatScopeSightEl.textContent = w.handling.sight;
    if (combatScopeRoleEl) combatScopeRoleEl.textContent = w.role;
    if (combatScopeFrameEl) {
      combatScopeFrameEl.dataset.geometrySource = w.view === 'sniper-tube' ? 'tube' : 'model';
      combatScopeFrameEl.style.width = combatScopeFrameEl.style.height = combatScopeFrameEl.style.transform = '';
      combatScopeFrameWidth = combatScopeFrameHeight = -1;
      combatScopeFrameX = combatScopeFrameY = NaN;
    }
    combatScopeLabel = label;
  }
}

function setHealth(v) {
  health = Math.max(0, Math.min(MAX_HEALTH, v));
  const pct = (health / MAX_HEALTH) * 100;
  if (healthFillEl) {
    healthFillEl.style.width = pct + '%';
    healthFillEl.classList.toggle('low', health <= MAX_HEALTH * 0.35);
    healthFillEl.classList.toggle('mid', health > MAX_HEALTH * 0.35 && health <= MAX_HEALTH * 0.6);
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
    const allowedDots = combatResolvedAllowed();
    for (let i = 0; i < dotsEl.children.length; i++) {
      const dot = dotsEl.children[i];
      dot.classList.toggle('on', i === gun.index);
      const off = !!(allowedDots && WEAPONS[i] && allowedDots.indexOf(WEAPONS[i].id) < 0);
      dot.classList.toggle('off', off);
      dot.style.display = off ? 'none' : '';
    }
  }
  setHealth(health);
  setKd();
}

/* ---------------- gun models ---------------- */
const combatMetalMats = new Map();
const combatCylinderGeos = new Map();
const combatOpticRingGeos = new Map();
const combatReticleMats = new Map();
const combatSightBeadGeo = new THREE.SphereGeometry(0.0075, 8, 6);
const combatOpticGlass = new THREE.MeshStandardMaterial({
  color: '#83c5d2', transparent: true, opacity: 0.27, metalness: 0.08,
  roughness: 0.16, depthWrite: false
});
const combatReducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const combatClamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const combatDamp = (rate, dt) => 1 - Math.exp(-rate * Math.max(0, Number.isFinite(dt) ? dt : 0));

/* Every weapon part's colour picks a physical finish, so the same model reads
   as steel, polymer, wood or brass instead of one flat material:
   - warm browns: oiled wood (non-metal, satin)
   - yellow/gold: brass (full metal, polished)
   - near-black: polymer / anodised furniture (matte, barely metallic)
   - greys/greens: gunmetal steel (metallic, satin), lighter = more worn
   All metals reflect the sky environment map from 41-graphics.js. */
function combatFinish(color) {
  const c = new THREE.Color(color), hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.s > 0.35 && hsl.h > 0.11 && hsl.h < 0.17 && hsl.l > 0.35) return { metalness: 1, roughness: 0.28, envMapIntensity: 1.1 };
  if (hsl.s > 0.2 && (hsl.h < 0.11 || hsl.h > 0.95) && hsl.l < 0.55) return { metalness: 0, roughness: 0.62, envMapIntensity: 0.35 };
  if (hsl.l < 0.17) return { metalness: 0.15, roughness: 0.72, envMapIntensity: 0.4 };
  return { metalness: 0.82, roughness: 0.3 + Math.min(0.2, hsl.l * 0.25), envMapIntensity: 0.9 };
}

function combatMetal(color) {
  let mat = combatMetalMats.get(color);
  if (!mat) {
    const env = BC.api && BC.api.graphics ? BC.api.graphics.envMap : null;
    mat = new THREE.MeshStandardMaterial(Object.assign({ color, envMap: env || null }, combatFinish(color)));
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
  const color = type === 'chevron' ? '#e7f2ff' : type === 'precision' ? '#e8edf1' : '#ff3556';
  if (type === 'holo') {
    // One actual projected dot in the rectangular glass, not a second HUD aim.
    glowBox(parent, 0.005, 0.005, 0.002, color, 0, y, z);
  } else if (type === 'chevron') {
    // Both halves meet exactly at (0,y); no extra dot below the apex.
    glowBox(parent, 0.014, 0.002, 0.002, color, -0.005, y - 0.005, z).rotation.z = Math.PI / 4;
    glowBox(parent, 0.014, 0.002, 0.002, color, 0.005, y - 0.005, z).rotation.z = -Math.PI / 4;
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

function combatSightLine(root, y, frontZ, rearZ) {
  const u = root.userData;
  u.adsAnchor.set(0, y, frontZ);
  u.adsRear.set(0, y, rearZ);
  // Real scene-graph points make alignment inspectable without inventing a
  // second aiming state. All bores and sight lines use the authored -Z axis.
  const front = new THREE.Object3D(), rear = new THREE.Object3D();
  front.name = 'ads-aimline-front'; rear.name = 'ads-aimline-rear';
  front.position.copy(u.adsAnchor); rear.position.copy(u.adsRear);
  root.add(front, rear);
  u.adsAimPoint = front; u.adsRearPoint = rear;
}

function combatAddOptic(root) {
  const u = root.userData, w = WEAPON_BY_ID[u.weaponId], type = w.optic;
  const optic = new THREE.Group();
  optic.name = 'optic-' + type;
  u.optic = optic;
  u.opticType = type;
  u.adsView = w.view;
  if (w.opticFamily === 'pistol') {
    // Square rear notch, paired witness marks and a separate real front blade.
    // Nothing covers peripheral vision; both sights ride the reciprocating slide.
    optic.position.set(0, 0.060, 0);
    u.reloadParts.slide.add(optic);
    combatMetalBox(optic, 0.080, 0.013, 0.028, '#202a30', 0, -0.008, 0.135);
    for (const x of [-0.028, 0.028]) {
      combatMetalBox(optic, 0.020, 0.044, 0.026, '#26323a', x, 0.008, 0.135);
      glowBox(optic, 0.005, 0.005, 0.003, '#d6e1e5', x, 0.021, 0.150);
    }
    combatMetalBox(optic, 0.015, 0.036, 0.024, '#dce6e5', 0, 0.012, -0.145);
    combatMetalBox(optic, 0.029, 0.009, 0.037, '#253038', 0, -0.002, -0.145);
    combatSightLine(root, 0.133, -0.180, 0.100);
    return;
  }
  if (w.opticFamily === 'shotgun') {
    // A vented rib with a single bead, not an optic or a spread-circle overlay.
    optic.position.set(0, 0.090, 0);
    root.add(optic);
    combatMetalBox(optic, 0.024, 0.012, 0.61, '#354148', 0, 0, -0.378);
    for (let i = 0; i < 4; i++) {
      combatMetalBox(optic, 0.030, 0.012, 0.018, '#566268', 0, -0.010, -0.22 - i * 0.13);
    }
    const bead = new THREE.Mesh(combatSightBeadGeo, combatMetal('#f1f2df'));
    bead.position.set(0, 0.013, -0.688);
    optic.add(bead);
    combatMetalBox(optic, 0.055, 0.011, 0.024, '#222c31', 0, -0.007, 0.070);
    combatSightLine(root, 0.103, -0.688, 0.070);
    return;
  }
  if (w.opticFamily === 'revolver') {
    // Deep, slightly tapered steel V-notch and a long narrow front blade.
    // Unlike pistol irons this has no pair of glowing rear dots or slide optic.
    optic.position.set(0, 0.085, 0);
    root.add(optic);
    combatMetalBox(optic, 0.066, 0.012, 0.039, '#68736f', 0, -0.008, 0.145);
    for (const side of [-1, 1]) {
      combatMetalBox(optic, 0.020, 0.047, 0.034, '#303b3b', side * 0.025, 0.0125, 0.145).rotation.z = side * -0.12;
    }
    combatMetalBox(optic, 0.041, 0.012, 0.31, '#697571', 0, -0.006, -0.248);
    combatMetalBox(optic, 0.012, 0.050, 0.026, '#e0e6df', 0, 0.011, -0.403);
    combatSightLine(root, 0.121, -0.403, 0.145);
    return;
  }
  if (w.opticFamily === 'sniper') {
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
    combatSightLine(root, 0.170, -0.311, 0.205);
    return;
  }
  if (w.opticFamily === 'rifle') {
    // Compact rectangular reflex window. The only illumination is in its glass.
    optic.position.set(0, 0.114, 0.042);
    root.add(optic);
    combatMetalBox(optic, 0.136, 0.024, 0.079, '#303e43', 0, -0.010, 0);
    for (const x of [-0.054, 0.054]) combatMetalBox(optic, 0.014, 0.10, 0.052, '#303e43', x, 0.044, 0);
    combatMetalBox(optic, 0.122, 0.014, 0.052, '#627473', 0, 0.094, 0);
    const glass = addBox(optic, 0.094, 0.083, 0.003, '#83c5d2', 0, 0.046, 0.026);
    glass.material = combatOpticGlass;
    combatOpticMarks(optic, type, 0.046, 0.029);
    combatMetalBox(optic, 0.020, 0.020, 0.022, '#96a5a2', 0.075, 0.017, 0);
    combatSightLine(root, 0.160, 0.071, 0.042);
    return;
  }
  if (w.opticFamily === 'smg') {
    // Deeper close-quarters hood, with chamfered shoulders instead of the
    // rifle's flat rectangular roof. This is a small open window, not a tube.
    optic.position.set(0, 0.103, 0.005);
    root.add(optic);
    combatMetalBox(optic, 0.105, 0.019, 0.115, '#273b43', 0, -0.004, 0);
    for (const side of [-1, 1]) {
      combatMetalBox(optic, 0.014, 0.059, 0.10, '#344c55', side * 0.045, 0.028, 0);
      combatMetalBox(optic, 0.035, 0.014, 0.10, '#68848c', side * 0.030, 0.065, 0).rotation.z = side * -0.55;
    }
    combatMetalBox(optic, 0.048, 0.012, 0.10, '#68848c', 0, 0.074, 0);
    const glass = addBox(optic, 0.066, 0.049, 0.003, '#83c5d2', 0, 0.035, 0.051);
    glass.material = combatOpticGlass;
    combatOpticMarks(optic, type, 0.035, 0.055);
    combatSightLine(root, 0.138, 0.060, 0.005);
    return;
  }
  // A wide octagonal support aperture and separate guarded front post. There
  // is no glass, coloured dot, circular vignette or magnification tube here.
  optic.position.set(0, 0.044, 0.255);
  u.reloadParts.cover.add(optic);
  combatMetalBox(optic, 0.230, 0.022, 0.069, '#3b493b', 0, -0.010, 0);
  for (const side of [-1, 1]) {
    combatMetalBox(optic, 0.021, 0.116, 0.045, '#465441', side * 0.105, 0.049, 0);
    combatMetalBox(optic, 0.044, 0.018, 0.045, '#798570', side * 0.088, 0.116, 0).rotation.z = side * -0.62;
    combatMetalBox(optic, 0.023, 0.10, 0.060, '#28372d', side * 0.138, -0.003, 0);
  }
  combatMetalBox(optic, 0.160, 0.018, 0.045, '#798570', 0, 0.130, 0);
  combatMetalBox(root, 0.080, 0.018, 0.052, '#3b483c', 0, 0.087, -0.650);
  combatMetalBox(root, 0.026, 0.120, 0.024, '#465444', 0, 0.144, -0.650);
  combatMetalBox(root, 0.012, 0.036, 0.020, '#dbe1d4', 0, 0.195, -0.650);
  for (const x of [-0.031, 0.031]) combatMetalBox(root, 0.013, 0.043, 0.025, '#66745f', x, 0.193, -0.650);
  combatSightLine(root, 0.213, -0.650, 0.045);
}

function makeGunModel(id) {
  if (!WEAPON_BY_ID[id]) id = WEAPONS[0].id;
  const root = new THREE.Group();
  const dark = '#20262c', metal = '#59626b', wood = '#765035', brass = '#c3a054';
  const u = root.userData;
  u.weaponId = id;
  u.family = WEAPON_BY_ID[id].family;
  u.reloadParts = Object.create(null);
  u.reloadNodes = [];
  u.reloadProgress = -1;
  u.shotProgress = -1;
  u.adsAnchor = new THREE.Vector3();
  u.adsRear = new THREE.Vector3();
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
  } else if (id === 'dmr') {
    combatMetalBox(root, 0.09, 0.11, 0.42, '#4b5446', 0, 0.015, 0.02);
    combatCylinder(root, 0.022, 0.72, dark, 0, muzzleY, -0.56);
    combatMetalBox(root, 0.052, 0.052, 0.12, '#14191e', 0, muzzleY, -0.96);
    addBox(root, 0.085, 0.095, 0.36, '#5b4632', 0, -0.01, -0.36);
    addBox(root, 0.09, 0.16, 0.30, '#5b4632', 0, -0.02, 0.36);
    addBox(root, 0.09, 0.05, 0.16, '#463626', 0, 0.075, 0.34);
    addBox(root, 0.10, 0.17, 0.035, dark, 0, -0.02, 0.525);
    addBox(root, 0.065, 0.19, 0.095, '#342920', 0, -0.12, 0.14);
    const mag = combatPartGroup(root, 'mag', root, 0, -0.12, -0.05);
    combatMetalBox(mag, 0.06, 0.14, 0.11, dark, 0, -0.02, 0);
    combatReloadPart(root, 'charging', combatMetalBox(root, 0.09, 0.022, 0.035, '#a6adb1', 0.065, 0.045, 0.055));
    addBox(root, 0.06, 0.025, 0.24, dark, 0, 0.091, 0.025);
    u.heldScale = 0.82;
    u.viewScale = 0.85;
    muzzleZ = -1.02;
  } else if (id === 'burst') {
    combatMetalBox(root, 0.105, 0.135, 0.40, '#2c3238', 0, 0.015, 0.03);
    combatCylinder(root, 0.026, 0.34, dark, 0, muzzleY, -0.36);
    combatCylinder(root, 0.042, 0.11, '#101418', 0, muzzleY, -0.56);
    addBox(root, 0.10, 0.11, 0.26, '#3a4148', 0, -0.005, -0.26);
    for (let i = 0; i < 4; i++) addBox(root, 0.104, 0.014, 0.03, '#b98a3a', 0, 0.056, -0.16 - i * 0.05);
    addBox(root, 0.09, 0.15, 0.22, '#2c3238', 0, -0.015, 0.33);
    addBox(root, 0.10, 0.17, 0.035, dark, 0, -0.015, 0.45);
    addBox(root, 0.065, 0.19, 0.095, '#1f2428', 0, -0.12, 0.14);
    addBox(root, 0.055, 0.12, 0.06, '#1f2428', 0, -0.11, -0.28);
    const mag = combatPartGroup(root, 'mag', root, 0, -0.13, -0.045);
    combatMetalBox(mag, 0.065, 0.22, 0.105, '#3a4148', 0, -0.025, 0);
    combatReloadPart(root, 'charging', combatMetalBox(root, 0.09, 0.022, 0.035, '#a6adb1', 0.065, 0.045, 0.055));
    addBox(root, 0.06, 0.025, 0.22, dark, 0, 0.097, 0.025);
    muzzleZ = -0.615;
  } else if (id === 'machinepistol') {
    combatMetalBox(root, 0.09, 0.11, 0.25, '#3b4348', 0, 0.015, 0.01);
    combatCylinder(root, 0.022, 0.16, dark, 0, muzzleY, -0.19);
    addBox(root, 0.072, 0.18, 0.10, dark, 0, -0.10, 0.09);
    const mag = combatPartGroup(root, 'mag', root, 0, -0.17, 0.09);
    combatMetalBox(mag, 0.05, 0.27, 0.07, '#596267', 0, -0.03, 0);
    addBox(mag, 0.06, 0.025, 0.08, dark, 0, -0.17, 0);
    combatReloadPart(root, 'bolt', combatMetalBox(root, 0.08, 0.022, 0.03, '#aab9b9', -0.05, 0.055, 0));
    addBox(root, 0.05, 0.06, 0.05, '#596267', 0, -0.05, -0.10);
    u.grip.z = 0.09;
    u.support.set(-0.06, -0.12, 0.07);
    u.heldScale = 0.94;
    muzzleZ = -0.27;
  } else if (id === 'doublebarrel') {
    combatMetalBox(root, 0.125, 0.11, 0.24, '#6b6256', 0, 0.01, 0.03);
    for (const x of [-0.034, 0.034]) {
      combatCylinder(root, 0.032, 0.66, dark, x, muzzleY, -0.42);
      combatCylinder(root, 0.036, 0.015, '#0a0d10', x, muzzleY, -0.75);
    }
    addBox(root, 0.05, 0.016, 0.62, '#3a4046', 0, 0.083, -0.41);
    addBox(root, 0.11, 0.14, 0.31, wood, 0, -0.04, 0.33);
    addBox(root, 0.115, 0.16, 0.025, '#171c20', 0, -0.04, 0.49);
    addBox(root, 0.07, 0.17, 0.09, wood, 0, -0.12, 0.12);
    const pump = combatPartGroup(root, 'pump', root, 0, -0.02, -0.25);
    addBox(pump, 0.115, 0.075, 0.20, '#815735', 0, 0, 0);
    combatReloadPart(root, 'gate', combatMetalBox(root, 0.056, 0.012, 0.10, '#8c9295', 0, -0.049, -0.035));
    const shell = combatPartGroup(root, 'shell', root, -0.18, -0.18, 0.01);
    combatCylinder(shell, 0.023, 0.095, '#b84432', 0, 0, 0);
    combatCylinder(shell, 0.025, 0.02, brass, 0, 0, 0.047);
    shell.visible = shell.userData.combatBase.visible = false;
    muzzleZ = -0.76;
  } else if (id === 'crossbow') {
    addBox(root, 0.08, 0.09, 0.62, wood, 0, 0, -0.05);
    addBox(root, 0.09, 0.15, 0.26, wood, 0, -0.03, 0.38);
    addBox(root, 0.07, 0.17, 0.09, '#4d3423', 0, -0.12, 0.14);
    const stave = combatMetalBox(root, 0.34, 0.03, 0.04, '#3a4046', 0.17, 0.03, -0.36);
    stave.rotation.y = 0.32;
    const stave2 = combatMetalBox(root, 0.34, 0.03, 0.04, '#3a4046', -0.17, 0.03, -0.36);
    stave2.rotation.y = -0.32;
    for (const side of [-1, 1]) {
      const cord = addBox(root, 0.34, 0.008, 0.008, '#e6e0cf', side * 0.16, 0.04, -0.17);
      cord.rotation.y = side * -0.72;
    }
    const mag = combatPartGroup(root, 'mag', root, 0, -0.07, -0.16);
    combatMetalBox(mag, 0.05, 0.05, 0.10, dark, 0, 0, 0);
    const bolt = combatPartGroup(root, 'bolt', root, 0, 0.056, -0.20);
    combatCylinder(bolt, 0.009, 0.46, '#c9b48a', 0, 0, 0);
    combatMetalBox(bolt, 0.022, 0.022, 0.05, '#7c8790', 0, 0, -0.24);
    const handle = combatPartGroup(root, 'boltHandle', bolt, 0, 0, 0.2);
    combatMetalBox(handle, 0.05, 0.03, 0.012, '#c04a3a', 0, 0.02, 0);
    u.grip.z = 0.14;
    u.heldScale = 0.84;
    u.viewScale = 0.86;
    muzzleZ = -0.5;
  } else {
    addBox(root, 0.09, 0.07, 0.30, dark, 0, -0.035, 0.025);
    const slide = combatPartGroup(root, 'slide', root, 0, 0.043, -0.035);
    combatMetalBox(slide, 0.096, 0.085, 0.35, metal, 0, 0, 0);
    for (let i = 0; i < 4; i++) combatMetalBox(slide, 0.098, 0.040, 0.012, '#313a40', 0, 0, 0.055 + i * 0.023);
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
  // A stable DOM frame hook projects these REAL housing bounds. The browser
  // draws no duplicate chrome over the 3D sights; sniper alone uses a DOM tube.
  u.opticBounds = new THREE.Box3().setFromObject(u.optic);
  u.opticBounds.applyMatrix4(u.optic.matrixWorld.clone().invert());
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
  u.shotProgress = -1;
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

  if (u.family === 'pistol') {
    pose.pitch = 0.24 * lift; pose.roll = -0.32 * lift;
    const mag = combatMagSwap(parts.mag, p, 0.14, 0.32, 0.43, 0.67, 0.26);
    parts.slide.position.z += 0.09 * combatPulse(p, 0.72, 0.82, 0.85, 0.94);
    u.supportTarget.set(-0.065, -0.17 - mag * 0.26, 0.10);
    u.supportTarget.lerp(u.support, combatStage(p, 0.91, 1));
    const rackHand = combatPulse(p, 0.64, 0.75, 0.88, 0.98);
    u.supportTarget.x += (-0.075 - u.supportTarget.x) * rackHand;
    u.supportTarget.y += (0.085 - u.supportTarget.y) * rackHand;
    u.supportTarget.z += (0.055 + parts.slide.position.z - parts.slide.userData.combatBase.position.z - u.supportTarget.z) * rackHand;
  } else if (u.family === 'rifle') {
    pose.pitch = 0.18 * lift; pose.roll = -0.26 * lift; pose.yaw = 0.12 * lift;
    const mag = combatMagSwap(parts.mag, p, 0.15, 0.34, 0.44, 0.66, 0.29);
    parts.mag.rotation.x -= mag * 0.18;
    parts.charging.position.z += 0.13 * combatPulse(p, 0.74, 0.83, 0.86, 0.95);
    u.supportTarget.set(-0.07, -0.19 - mag * 0.25, -0.045);
    if (p > 0.70) u.supportTarget.lerp(u.support, combatStage(p, 0.70, 0.88));
    u.rightTarget.lerp(parts.charging.position, combatPulse(p, 0.69, 0.76, 0.92, 1));
  } else if (u.family === 'shotgun') {
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
  } else if (u.family === 'smg') {
    pose.pitch = 0.28 * lift; pose.roll = -0.20 * lift;
    const mag = combatMagSwap(parts.mag, p, 0.12, 0.28, 0.36, 0.57, 0.23);
    parts.bolt.position.z += 0.095 * combatPulse(p, 0.65, 0.76, 0.79, 0.9);
    u.supportTarget.set(-0.07, -0.19 - mag * 0.23, -0.08);
    if (p > 0.60) u.supportTarget.lerp(parts.bolt.position, combatPulse(p, 0.60, 0.68, 0.86, 0.97));
    u.supportTarget.lerp(u.support, combatStage(p, 0.90, 1));
  } else if (u.family === 'sniper') {
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
  } else if (u.family === 'revolver') {
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
  } else if (u.family === 'lmg') {
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

/* Shot actions sample one age, on the same articulated parts as reload. No
   timers, promises, additional ammunition state or automatic semi-auto shots. */
function combatSampleShotMechanism(model, age, serial) {
  if (!model || !model.userData.reloadParts) return;
  const u = model.userData, w = WEAPON_BY_ID[u.weaponId], h = w.handling;
  const active = Number.isFinite(age) && age >= 0 && age < h.cycle;
  if (!active && u.shotProgress === -1) return;
  combatResetGunParts(model);
  const parts = u.reloadParts;
  if (!active) {
    if (w.id === 'revolver') parts.cylinder.rotation.z = (Math.max(0, serial || 0) % 6) * Math.PI / 3;
    return;
  }
  const p = combatClamp01(age / h.cycle), pose = u.reloadPose;
  u.shotProgress = p;
  if (w.id === 'pistol') {
    parts.slide.position.z += 0.085 * combatPulse(p, 0, 0.08, 0.30, 0.76);
  } else if (w.family === 'rifle') {
    parts.charging.position.z += 0.065 * combatPulse(p, 0, 0.10, 0.25, 0.90);
  } else if (w.id === 'shotgun') {
    const pump = combatPulse(p, 0.26, 0.46, 0.66, 0.95);
    parts.pump.position.z += 0.17 * pump;
    u.supportTarget.z += 0.17 * pump;
    parts.gate.rotation.x = -0.28 * pump;
    pose.roll = 0.042 * pump; pose.y = -0.009 * pump;
  } else if (w.family === 'smg') {
    parts.bolt.position.z += 0.050 * combatPulse(p, 0, 0.12, 0.25, 0.92);
  } else if (w.id === 'sniper') {
    const lift = combatPulse(p, 0.19, 0.34, 0.85, 0.99);
    const pull = combatPulse(p, 0.33, 0.51, 0.65, 0.86);
    parts.boltHandle.rotation.z = 1.18 * lift;
    parts.bolt.position.z += 0.17 * pull;
    const hand = combatPulse(p, 0.16, 0.30, 0.87, 1);
    u.rightTarget.x += (0.13 - u.rightTarget.x) * hand;
    u.rightTarget.y += (0.055 + lift * 0.09 - u.rightTarget.y) * hand;
    u.rightTarget.z += (parts.bolt.position.z + 0.06 - u.rightTarget.z) * hand;
    pose.yaw = 0.065 * hand; pose.roll = -0.035 * hand;
  } else if (w.id === 'revolver') {
    const turn = combatStage(p, 0.02, 0.43);
    const previous = Math.max(0, (serial || 1) - 1) % 6;
    parts.cylinder.rotation.z = (previous + turn) * Math.PI / 3;
    parts.hammer.rotation.x = -0.50 * combatPulse(p, 0, 0.08, 0.22, 0.41);
  } else if (w.id === 'lmg') {
    const feed = combatPulse(p, 0, 0.15, 0.45, 0.94);
    parts.belt.position.x += 0.028 * feed;
    parts.belt.position.y -= 0.009 * feed;
    parts.feed.position.y += 0.006 * feed;
    parts.charging.position.z += 0.065 * feed;
    u.supportTarget.y -= 0.008 * feed;
  }
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
  // Slightly oversized in third person so the weapon reads clearly from the
  // shoulder camera and to other players.
  g.scale.setScalar(g.userData.heldScale * 1.12);
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

/* How each weapon sits in the right arm. hip/ads: shoulder lift (radians,
   added to camera pitch) at the ready and when aiming; roll/adsRoll: inward
   arm roll that brings the grip to the body's centre line; kick: recoil
   multiplier on the arm.
   - Handguns are held out in a two-handed isosceles grip.
   - Rifles, the shotgun and the sniper are tucked into the shoulder pocket.
   - The SMG rides compact at the chest; the heavy LMG hangs at the hip
     until aimed. */
const COMBAT_HOLD_STANCES = {
  // Rolls keep the weapon in front of the RIGHT shoulder rather than on the
  // body's centre line, so the over-the-shoulder camera can see it.
  pistol:   { hip: 1.40, ads: 1.52, roll: -0.14, adsRoll: -0.10, kick: 1.3 },
  revolver: { hip: 1.38, ads: 1.54, roll: -0.16, adsRoll: -0.10, kick: 1.6 },
  smg:      { hip: 1.18, ads: 1.32, roll: -0.40, adsRoll: -0.46, kick: 0.8 },
  rifle:    { hip: 1.20, ads: 1.36, roll: -0.50, adsRoll: -0.56, kick: 1.0 },
  shotgun:  { hip: 1.12, ads: 1.32, roll: -0.46, adsRoll: -0.54, kick: 1.4 },
  sniper:   { hip: 1.16, ads: 1.40, roll: -0.52, adsRoll: -0.60, kick: 1.2 },
  lmg:      { hip: 0.98, ads: 1.26, roll: -0.36, adsRoll: -0.50, kick: 0.9 },
  dmr:      { hip: 1.18, ads: 1.40, roll: -0.52, adsRoll: -0.58, kick: 1.2 },
  burst:    { hip: 1.22, ads: 1.36, roll: -0.48, adsRoll: -0.54, kick: 0.9 },
  machinepistol: { hip: 1.36, ads: 1.48, roll: -0.20, adsRoll: -0.14, kick: 0.7 },
  doublebarrel:  { hip: 1.08, ads: 1.30, roll: -0.44, adsRoll: -0.52, kick: 1.7 },
  crossbow: { hip: 1.14, ads: 1.38, roll: -0.42, adsRoll: -0.52, kick: 0.6 }
};

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
    (avatar !== localAvatar || (!combatQuickBuilding() && !combatActionBlocked() && combatWeaponAllowed(currentWeapon())));
  const firing = !!state.firing;
  const reload = active && Number.isFinite(state.reload) ? state.reload : -1;
  const rounds = Number.isFinite(state.reloadRounds) ? state.reloadRounds : model.userData.reloadRounds;
  updateWeaponReload(model, reload, rounds);
  if (reload < 0) {
    const w = WEAPON_BY_ID[model.userData.weaponId];
    // Remote kick already decays with w.recover, so its age is reconstructible
    // without a new packet field or a separately running mechanism clock.
    const age = avatar === localAvatar ? gun.shotAge
      : state.kick > 0 ? -Math.log(Math.min(1, state.kick)) / w.recover : -1;
    combatSampleShotMechanism(model, active ? age : -1, avatar === localAvatar ? gun.shots[gun.index] : 1);
  }
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
  // Walking only drives the arms' X swing. Every weapon frame also writes Y/Z
  // (and the support arm's full quaternion), so those must be blended
  // ABSOLUTELY toward the relaxed pose. Blending relative to last frame left
  // the right arm stuck diagonally in front after building, riding or death.
  const right = parts.armR, free = 1 - pose.weight;
  right.rotation.y *= free;
  if (parts.armL) { parts.armL.rotation.y *= free; parts.armL.rotation.z *= free; }
  if (pose.weight < 0.001) { right.rotation.z = 0; return; }
  const pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, Number.isFinite(state.pitch) ? state.pitch : 0));
  const rp = model.userData.reloadPose;
  const w = WEAPON_BY_ID[model.userData.weaponId] || WEAPONS[0];
  const recoil = reload < 0 ? combatClamp01(state.kick) * w.recoil * 0.75 : 0;
  const stance = COMBAT_HOLD_STANCES[w.id] || COMBAT_HOLD_STANCES.rifle;
  const aimBlend = state.aim ? 1 : 0;
  const shoulder = stance.hip + (stance.ads - stance.hip) * aimBlend;
  const roll = stance.roll + (stance.adsRoll - stance.roll) * aimBlend;
  const targetR = shoulder + pitch + rp.pitch * 0.5 + recoil * stance.kick;
  right.rotation.x += (targetR - right.rotation.x) * pose.weight;
  right.rotation.z = roll * pose.weight;
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
  // This is also the network module's legacy entry point. Suppress it there
  // as well as locally when the positional SFX engine owns playback.
  if (combatSpatialAudioAvailable()) return;
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
  if (combatSpatialAudioAvailable()) return;
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

// All impact particles share ONE instanced mesh (one draw call), with a
// fixed pool and per-instance colour. A shotgun volley used to add dozens of
// separate meshes and draw calls.
const PARTICLE_MAX = 192;
const particleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 0.055, 0.055),
  new THREE.MeshBasicMaterial({ toneMapped: false }), PARTICLE_MAX);
particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
particleMesh.frustumCulled = false;
particleMesh.count = 0;
particleMesh.name = 'impact-particles';
scene.add(particleMesh);
const particleColor = new THREE.Color();
const particleObj = new THREE.Object3D();
const particles = [];
let combatImpactSfxAt = -9999;
// Which sound material a shot hit, from the block under the ray.
function combatImpactSurface(block) {
  try {
    if (!block || !BC.api.blockSurface) return 'stone';
    return BC.api.blockSurface(getBlock(block.x, block.y, block.z), false);
  } catch (e) { return 'stone'; }
}

function addImpact(point, color, info) {
  // One positional event per impact cluster, not one per pellet/particle.
  const sfxAt = performance.now();
  if (!(info && info.silent) && sfxAt - combatImpactSfxAt > 28) {
    combatImpactSfxAt = sfxAt;
    combatEmit('sfx', { kind: 'impact', weapon: info && info.weapon, surface: info && info.surface,
      position: point.clone(), volume: 0.34 });
  }
  const n = 6;
  particleColor.set(color);
  for (let i = 0; i < n; i++) {
    if (particles.length >= PARTICLE_MAX) break;
    particles.push({
      x: point.x, y: point.y, z: point.z, rx: 0, ry: 0, color: particleColor.clone(),
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
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy -= 16 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.rx += dt * 8; p.ry += dt * 6;
  }
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    particleObj.position.set(p.x, p.y, p.z);
    particleObj.rotation.set(p.rx, p.ry, 0);
    particleObj.scale.setScalar(Math.max(0.05, p.life / p.max));
    particleObj.updateMatrix();
    particleMesh.setMatrixAt(i, particleObj.matrix);
    particleMesh.setColorAt(i, p.color);
  }
  particleMesh.count = particles.length;
  particleMesh.instanceMatrix.needsUpdate = true;
  if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
  if (hurtEl) {
    const o = parseFloat(hurtEl.style.opacity || '0');
    if (o > 0) hurtEl.style.opacity = String(Math.max(0, o - dt * 1.6));
  }
}

/* ---------------- hit tests ---------------- */
const combatDragonRayOrigin = { x: 0, y: 0, z: 0 };
const combatDragonRayDir = { x: 0, y: 0, z: 0 };
const combatSolidRayOut = { distance: 0, block: null, dragon: null, dragonIndex: -1, kind: 'none' };

function combatRaycastDragon(origin, dir, maxDistance, ignoreIndex) {
  const api = combatApi('dragons');
  if (!api || typeof api.raycast !== 'function' || !Number.isFinite(maxDistance) || maxDistance < 0) return null;
  const hit = api.raycast(origin, dir, maxDistance, Number.isInteger(ignoreIndex) && ignoreIndex >= 0 ? ignoreIndex : -1);
  return hit && Number.isFinite(hit.distance) && hit.distance >= 0 && hit.distance <= maxDistance + COMBAT_SOLID_RAY_EPS
    ? hit : null;
}

// Camera, barrel obstruction and EVERY pellet select the same earliest solid.
// Copy hit scalars immediately: the dragon owner may reuse its ray-hit object.
function combatRaycastSolid(origin, dir, maxDistance, out) {
  const result = out || {};
  result.distance = maxDistance;
  result.block = result.dragon = null;
  result.dragonIndex = -1;
  result.kind = 'none';
  const block = raycastVoxel(maxDistance, origin, dir);
  if (block) {
    result.distance = block.dist;
    result.block = block;
    result.kind = 'voxel';
  }
  const dragon = combatRaycastDragon(origin, dir, result.distance);
  if (dragon && dragon.distance <= result.distance + COMBAT_SOLID_RAY_EPS) {
    result.distance = Math.min(maxDistance, dragon.distance);
    result.block = null; // a voxel behind (or touching) the body is NOT a voxel impact
    result.dragon = dragon.dragon || null;
    result.dragonIndex = Number.isInteger(dragon.index) ? dragon.index : -1;
    result.kind = 'dragon';
  }
  return result;
}

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

function combatPeerRiding(r) {
  return !!r && (r.dragon >= 0 || (typeof netRiderMounted === 'function' && netRiderMounted(r.id)));
}

function raycastRemote(ox, oy, oz, dx, dy, dz, maxDist, ignoreDragonIndex) {
  let best = null;
  if (typeof net === 'undefined' || !net || !net.players) return null;
  maxDist = Math.min(COMBAT_MAX_WEAPON_RANGE, Math.max(0, Number(maxDist) || 0));
  const riderReach = maxDist + COMBAT_RIDER_REACH;
  combatDragonRayOrigin.x = ox; combatDragonRayOrigin.y = oy; combatDragonRayOrigin.z = oz;
  combatDragonRayDir.x = dx; combatDragonRayDir.y = dy; combatDragonRayDir.z = dz;
  const dragon = combatRaycastDragon(combatDragonRayOrigin, combatDragonRayDir, maxDist, ignoreDragonIndex);
  if (dragon) {
    if (dragon.distance <= COMBAT_SOLID_RAY_EPS) return null;
    maxDist = Math.min(maxDist, dragon.distance - COMBAT_SOLID_RAY_EPS);
  }
  const now = performance.now();
  for (const r of net.players.values()) {
    if (!combatPeerEligible(r, now)) continue;
    const pos = r.group && r.group.position ? r.group.position : r;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) continue;
    // Preserve the standing 1.46/1.90 m split; lower both boxes for a crouch or
    // slide, preferring the movement/network owner's runtime bodyHeight.
    const top = combatBodyHeight(r) + 0.1;
    const headBase = Math.max(0.4, top - 0.44);
    const body = rayBox(ox, oy, oz, dx, dy, dz,
      pos.x - 0.3, pos.y + 0.05, pos.z - 0.3, pos.x + 0.3, pos.y + headBase, pos.z + 0.3);
    const head = rayBox(ox, oy, oz, dx, dy, dz,
      pos.x - 0.24, pos.y + headBase, pos.z - 0.24, pos.x + 0.24, pos.y + top, pos.z + 0.24);
    // A rider sits on the dragon's back, so the body can't shield them from every
    // angle: shots reach them even when the ray has just touched the dragon.
    const reach = combatPeerRiding(r) ? riderReach : maxDist;
    if (body >= 0 && body <= reach && (!best || body < best.t)) best = { r, t: body, head: false };
    if (head >= 0 && head <= reach && (!best || head < best.t)) best = { r, t: head, head: true };
  }
  return best;
}

/* ---------------- shooting ---------------- */
function getReloadProgress() {
  if (gun.reloading <= 0 || gun.reloadIndex !== gun.index || !alive || !combatMode || combatQuickBuilding() ||
      combatActionBlocked() || !combatWeaponAllowed(currentWeapon())) return -1;
  return combatClamp01(1 - gun.reloading / Math.max(0.001, gun.reloadTotal));
}

function combatLocalPoseState() {
  const ready = alive && combatMode && !combatQuickBuilding() && !combatActionBlocked() && combatWeaponAllowed(currentWeapon());
  return {
    pitch: player.pitch, aim: ready && gun.aiming && gun.reloading <= 0,
    firing: ready && (gun.firePose > 0 || gun.trigger), reload: getReloadProgress(),
    reloadRounds: gun.reloadRounds, weapon: currentWeapon().id,
    combat: ready, alive, kick: ready ? gun.kick : 0
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
  const ready = alive && !building && !combatActionBlocked() && combatWeaponAllowed(currentWeapon());
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
const combatSightAlignTemp = new THREE.Vector3();
const combatScopeProjectTemp = new THREE.Vector3();

function combatAdsRate(w, aiming, reduced) {
  const ms = aiming ? w.handling.adsInMs : w.handling.adsOutMs;
  return Math.log(1000) / (ms * 0.001 * (reduced ? 0.65 : 1));
}

function combatClearGeneratedRecoil() {
  // Killcam, riding and world resets may already own the camera/player pose.
  // Only remove a live, locally generated contribution when they do not.
  if (alive && !combatActionBlocked()) {
    const lim = Math.PI / 2 - 0.02;
    player.pitch = Math.max(-lim, Math.min(lim, player.pitch - combatRecoilAccum));
    player.yaw -= gun.recoilSide;
  }
  combatRecoilAccum = 0;
  gun.recoilSide = 0;
}

function combatStepHandling(dt, now, w) {
  for (let i = 0; i < WEAPONS.length; i++) {
    gun.bloom[i] = Math.max(0, gun.bloom[i] - WEAPONS[i].handling.bloomRecovery * dt);
  }
  if (gun.shotAge >= 0) {
    gun.shotAge += dt;
    const h = w.handling;
    if (!gun.mechanismCued && h.cueAt >= 0 && gun.shotAge >= h.cueAt && gun.shotAge < h.cycle) {
      gun.mechanismCued = true;
      combatEmit('sfx', {
        kind: 'mechanism', action: h.mechanism, weapon: w.id,
        position: combatSourcePosition(), volume: w.id === 'revolver' ? 0.24 : 0.36
      });
      playTone(w.id === 'shotgun' ? 185 : w.id === 'sniper' ? 360 : 510, 0.055, 'square', 0.035);
    }
    if (gun.shotAge >= h.cycle) gun.shotAge = -1;
  }
  if (now - combatRecoilStamp <= w.handling.recoilHoldMs || dt <= 0) return false;
  const decay = Math.exp(-w.handling.recoilReturn * dt);
  const pitchNext = combatRecoilAccum * decay, sideNext = gun.recoilSide * decay;
  const pitchDelta = combatRecoilAccum - (pitchNext < 0.00001 ? 0 : pitchNext);
  const sideDelta = gun.recoilSide - (Math.abs(sideNext) < 0.00001 ? 0 : sideNext);
  combatRecoilAccum -= pitchDelta;
  gun.recoilSide -= sideDelta;
  if (pitchDelta === 0 && sideDelta === 0) return false;
  const lim = Math.PI / 2 - 0.02;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch - pitchDelta));
  player.yaw -= sideDelta;
  return true;
}

function combatSpreadForShot(w) {
  const h = w.handling, a = isScopeActive() ? combatClamp01(gun.viewAim) : 0;
  const speed = Math.max(Number.isFinite(player.groundSpeed) ? player.groundSpeed : 0,
    Math.hypot(player.vel.x, player.vel.z));
  const moving = Math.min(1.65, speed / 7.3);
  const airborne = player.fly || (player.onGround === false && !player.swimming);
  const braced = player.crouching && !player.sliding && moving < 0.12;
  const opening = w.auto && combatBurstShots <= h.openingShots ? h.openingScale : 1;
  const stance = braced ? (w.id === 'lmg' ? 0.72 : 0.88) : 1;
  const movement = moving * (h.moveSpread + a * h.adsMoveSpread) + (airborne ? h.airSpread : 0);
  // Bloom measures the current weapon, not trigger duration. Rapid taps also
  // bloom; changing weapons cannot create automatic semi-auto fire.
  return w.spread * (0.8 + (w.adsSpread - 0.8) * a) *
    (opening + gun.bloom[gun.index] + movement) * stance;
}

function combatApplyShotRecoil(w, shotAt) {
  const h = w.handling;
  combatRecoilStamp = shotAt;
  const a = isScopeActive() ? combatClamp01(gun.viewAim) : 0;
  const recoilBase = w.recoil * 0.75 * h.recoilScale * (1 - 0.3 * a);
  const recoilRoom = Math.max(0, Math.min(COMBAT_RECOIL_CAP, h.recoilCap) - combatRecoilAccum);
  const oldPitch = player.pitch, lim = Math.PI / 2 - 0.02;
  player.pitch = Math.max(-lim, Math.min(lim, oldPitch + Math.min(recoilBase, recoilRoom)));
  combatRecoilAccum += Math.max(0, player.pitch - oldPitch);
  const pattern = h.yawPattern[(combatBurstShots - 1) % h.yawPattern.length];
  const sideNext = Math.max(-0.025, Math.min(0.025, gun.recoilSide + recoilBase * h.lateral * pattern));
  player.yaw += sideNext - gun.recoilSide;
  gun.recoilSide = sideNext;
}

function combatAlignViewSight(model, a) {
  if (!model || !model.userData.adsAnchor || a <= 0) return;
  const point = model.userData.adsAnchor;
  combatSightAlignTemp.copy(point).multiply(model.scale).applyQuaternion(model.quaternion);
  // Keep the real front blade/bead/dot on the eye's aim line as the model
  // rotates. This compensates rotation, not the player's camera input.
  model.position.x -= (combatSightAlignTemp.x - point.x * model.scale.x) * a;
  model.position.y -= (combatSightAlignTemp.y - point.y * model.scale.y) * a;
  model.updateWorldMatrix(true, true);
}

function combatProjectScopeHousing(model) {
  if (!combatScopeFrameEl || !isScopeActive() || currentWeapon().view === 'sniper-tube' || !model) return;
  const u = model.userData, box = u.opticBounds;
  if (!box || !u.optic) return;
  u.optic.updateWorldMatrix(true, false);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < 8; i++) {
    combatScopeProjectTemp.set(i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
      .applyMatrix4(u.optic.matrixWorld).project(camera);
    const x = (combatScopeProjectTemp.x * 0.5 + 0.5) * window.innerWidth;
    const y = (0.5 - combatScopeProjectTemp.y * 0.5) * window.innerHeight;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const width = Math.max(1, maxX - minX), height = Math.max(1, maxY - minY);
  if (!Number.isFinite(width + height)) return;
  const x = (minX + maxX) * 0.5 - window.innerWidth * 0.5;
  const y = (minY + maxY) * 0.5 - window.innerHeight * 0.5;
  if (!Number.isFinite(x + y)) return;
  // Idle, settled ADS must not allocate style strings or repaint every frame.
  if (Math.abs(width - combatScopeFrameWidth) > 0.05) {
    combatScopeFrameEl.style.width = width.toFixed(2) + 'px';
    combatScopeFrameWidth = width;
  }
  if (Math.abs(height - combatScopeFrameHeight) > 0.05) {
    combatScopeFrameEl.style.height = height.toFixed(2) + 'px';
    combatScopeFrameHeight = height;
  }
  if (!Number.isFinite(combatScopeFrameX) || Math.abs(x - combatScopeFrameX) > 0.05 || Math.abs(y - combatScopeFrameY) > 0.05) {
    combatScopeFrameEl.style.transform = 'translate(-50%, -50%) translate(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px)';
    combatScopeFrameX = x; combatScopeFrameY = y;
  }
}

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
  const scoped = isScopeActive();
  const openAds = scoped && currentWeapon().view !== 'sniper-tube';
  return viewGun && (openAds || (!thirdPerson && !scoped)) ? viewGun : localAvatar && localAvatar.userData.gun;
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
  const solid = combatRaycastSolid(origin, dir, w.range, combatSolidRayOut);
  const ent = raycastRemote(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, solid.distance);
  const entFirst = ent && (solid.kind === 'none' || ent.t < solid.distance - COMBAT_SOLID_RAY_EPS);
  return origin.clone().addScaledVector(dir, entFirst ? ent.t : solid.distance);
}

function combatMuzzleObstruction(muzzle) {
  const anchor = new THREE.Vector3(player.pos.x, player.pos.y + combatBodyHeight(player) * 13 / 18, player.pos.z);
  const parts = localAvatar && localAvatar.userData.parts;
  if (parts && parts.armR) {
    parts.armR.getWorldPosition(combatAimMuzzle);
    anchor.y = combatAimMuzzle.y;
  }
  const dir = muzzle.clone().sub(anchor);
  const distance = dir.length();
  if (distance < 0.0001) return null;
  dir.multiplyScalar(1 / distance);
  const solid = combatRaycastSolid(anchor, dir, distance + 0.012, combatSolidRayOut);
  if (solid.kind === 'none') return null;
  return {
    block: solid.block, dragon: solid.dragon, dragonIndex: solid.dragonIndex, kind: solid.kind,
    point: anchor.clone().addScaledVector(dir, solid.distance),
    from: anchor.addScaledVector(dir, Math.max(0, solid.distance - 0.025))
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
  combatEmit('sfx', { kind: 'ui', action: 'hitConfirm', position: combatSourcePosition(), volume: 0.2, head: !!head });
  playTone(head ? 1180 : 860, 0.06, 'triangle', 0.07);
}

function startReload() {
  if (!alive || !combatMode || combatQuickBuilding() || combatActionBlocked()) { combatReleaseGun(); return; }
  const w = currentWeapon();
  if (!combatWeaponAllowed(w)) { combatOnLoadoutChanged(); return; }
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
  gun.shotAge = -1;
  gun.mechanismCued = false;
  combatResetGunParts(viewGun);
  if (localAvatar) combatResetGunParts(localAvatar.userData.gun);
  combatRefreshLocalPose(0);
  updateGunVisual(0);
  playTone(300, 0.05, 'square', 0.06);
  combatEmit('sfx', {
    kind: 'reload', action: 'start', weapon: w.id, duration: w.reload, rounds: gun.reloadRounds,
    position: combatSourcePosition(),
    volume: 0.5
  });
  netSend(combatNetState('reload'));
  updateCombatHud();
}

function fireOnce() {
  if (!alive || !combatMode || combatQuickBuilding() || combatActionBlocked()) { combatReleaseGun(); return; }
  const w = currentWeapon();
  if (!combatWeaponAllowed(w)) {
    combatOnLoadoutChanged();
    return;
  }
  if (gun.cooldown > 0 || gun.reloading > 0) return;
  if (gun.ammo[gun.index] <= 0) { startReload(); return; }
  if (combatLookNeedsSync && typeof updateCamera === 'function') updateCamera(0);
  combatLookNeedsSync = false;
  gun.firePose = 1;
  if (typeof updateAvatar === 'function') updateAvatar(0);
  combatRefreshLocalPose(0);
  camera.updateWorldMatrix(true, false);
  updateGunVisual(0);

  const origin = camera.getWorldPosition(new THREE.Vector3());
  const cameraDir = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const target = combatCameraTarget(w, origin, cameraDir);
  const from = combatGetMuzzle(new THREE.Vector3());
  // A camera collision can put its target behind the held barrel. Do not twist
  // the wrist around or fire backward in that case.
  if (target.clone().sub(from).dot(cameraDir) < 0.1) target.copy(from).addScaledVector(cameraDir, w.range);
  const source = combatMuzzleModel();
  combatAimGunAt(source, target);
  combatGetMuzzle(from);
  const obstruction = combatMuzzleObstruction(from);

  // combatCameraTarget is a WORLD POSITION. Finish the camera/barrel solve,
  // then convert it to a normalized MUZZLE DIRECTION before assisting once.
  // Pellets use that direction directly; re-projecting from the camera would
  // undo the assist or amplify it through close-range shoulder parallax.
  const baseDir = target.clone().sub(from);
  if (baseDir.lengthSq() < 0.01 || baseDir.dot(cameraDir) < 0.05) baseDir.copy(cameraDir);
  else baseDir.normalize();
  const fxApi = combatApi('combatFx');
  if (!obstruction && fxApi && typeof fxApi.aimAssist === 'function') {
    try {
      const assisted = fxApi.aimAssist(from, baseDir, w.id);
      if (assisted && assisted.isVector3 && Number.isFinite(assisted.x) && Number.isFinite(assisted.y) &&
          Number.isFinite(assisted.z) && Math.abs(assisted.lengthSq() - 1) < 1e-6 &&
          baseDir.dot(assisted) >= Math.cos(COMBAT_ASSIST_MAX_TURN) - 1e-12) {
        baseDir.copy(assisted);
      }
    } catch (e) { /* aim assistance is optional */ }
  }

  gun.ammo[gun.index]--;
  gun.cooldown = 60 / w.rpm;
  gun.kick = 1;
  gun.shotAge = 0;
  gun.mechanismCued = false;
  gun.shots[gun.index]++;
  const helper = Math.abs(baseDir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(baseDir, helper).normalize();
  const up = new THREE.Vector3().crossVectors(right, baseDir).normalize();

  const shotAt = performance.now();
  if (shotAt - combatBurstStamp > w.handling.burstGapMs) combatBurstShots = 0;
  combatBurstStamp = shotAt;
  combatBurstShots++;
  const shotSpread = combatSpreadForShot(w);
  gun.lastSpread = shotSpread;
  gun.bloom[gun.index] = Math.min(w.handling.bloomMax, gun.bloom[gun.index] + w.handling.bloomPerShot);

  // Establish this shot's weapon/combat state before its hit messages. This is
  // important for firing immediately after cancelling a combat blueprint.
  netSend({ ...combatNetState('shot'), x: from.x, y: from.y, z: from.z });
  let hitAny = false, hitDragon = false, hitHead = false, shotTargetId = '', firstHitName = '', shotEnd = null;
  const impactInfo = { weapon: w.id, silent: false };
  for (let i = 0; i < w.pellets; i++) {
    if (obstruction) {
      if (i === 0) {
        shotEnd = obstruction.point.clone();
        addTracer(obstruction.from, obstruction.point);
        impactInfo.surface = obstruction.kind === 'dragon' ? 'soft' : combatImpactSurface(obstruction.block);
        addImpact(obstruction.point, obstruction.kind === 'dragon' ? '#e8af57' : '#cbb593', impactInfo);
        impactInfo.silent = true;
      }
      if (obstruction.block && typeof damageVoxelFromShot === 'function') damageVoxelFromShot(obstruction.block, w.id, w.damage);
      continue;
    }
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * shotSpread;
    const dir = baseDir.clone()
      .addScaledVector(right, Math.cos(ang) * rad)
      .addScaledVector(up, Math.sin(ang) * rad)
      .normalize();
    // Damage and the tracer use the same muzzle ray. The camera chooses the
    // crosshair target; it no longer lets a barrel bypass adjacent cover.
    const solid = combatRaycastSolid(from, dir, w.range, combatSolidRayOut);
    // Each weapon's declared range is the combat envelope, including long-range
    // rifle/sniper/LMG hits accepted by the room authority.
    const ent = raycastRemote(from.x, from.y, from.z, dir.x, dir.y, dir.z, solid.distance);
    const liveEnt = ent && combatPeerEligible(ent.r, shotAt) &&
      (solid.kind === 'none' || ent.t < solid.distance - COMBAT_SOLID_RAY_EPS || (solid.kind === 'dragon' && combatPeerRiding(ent.r)));
    const end = from.clone().addScaledVector(dir, liveEnt ? ent.t : solid.distance);
    addTracer(from, end);
    if (!shotEnd) shotEnd = end.clone();

    // No knockback and no vertical impulse: a hit only sends damage, so the
    // "everybody flies" bug cannot come from the combat layer.
    if (liveEnt && spawnShieldPeerActive(ent.r)) {
      if (!impactInfo.silent) combatEmit('sfx', { kind: 'shieldBlock', position: end.clone(), volume: 0.5 });
      addImpact(end, '#9fe8ff', impactInfo);
      impactInfo.silent = true;
    } else if (liveEnt) {
      hitAny = true;
      if (ent.head) hitHead = true;
      if (!shotTargetId) { shotTargetId = ent.r.id; firstHitName = ent.r.name || ''; }
      const dmg = Math.round(combatDamageCap(w, ent.head) * (ent.t > w.range * 0.65 ? 0.8 : 1));
      if (!(typeof window.botTakeHit === 'function' && window.botTakeHit(ent.r.id, dmg, ent.head, w.id))) {
        netSend({ t: 'hit', target: ent.r.id, dmg, head: ent.head, weapon: w.id, byId: net.id, by: playerName });
      }
      addImpact(end, '#b83030', impactInfo);
      impactInfo.silent = true;
    } else if (solid.kind === 'dragon') {
      if (typeof dragonLifeShot === 'function' && dragonLifeShot(solid.dragonIndex, Math.round(w.damage), w.id)) {
        if (!impactInfo.silent) combatEmit('sfx', { kind: 'dragonHit', position: end.clone(), volume: 0.7 });
        hitDragon = true;
      }
      addImpact(end, '#e8af57', impactInfo);
      impactInfo.silent = true;
    } else if (solid.block) {
      impactInfo.surface = combatImpactSurface(solid.block);
      addImpact(end, '#cbb593', impactInfo);
      impactInfo.silent = true;
      if (typeof damageVoxelFromShot === 'function') damageVoxelFromShot(solid.block, w.id, w.damage);
    }
  }

  // Hit markers can be optimistic. Kill banners, feed events and match scores
  // are produced only by a confirmed death, never by this target-HP estimate.
  if (hitAny && fxApi && typeof fxApi.hitFeedback === 'function') {
    try { fxApi.hitFeedback(hitHead, firstHitName); } catch (e) { /* optional */ }
  }

  // Audio first: 94-audio's `sfx` listener claims the shot family, so its
  // `shot` listener does not voice the same round twice.
  combatEmit('sfx', {
    kind: 'shot', weapon: w.id, position: from.clone(),
    volume: Math.min(1, (w.sound || 0.5) * 1.15)
  });
  combatEmit('shot', {
    weapon: w.id, from: from.clone(),
    to: shotEnd || from.clone().addScaledVector(baseDir, w.range),
    hit: hitAny, head: hitHead, targetId: shotTargetId || null
  });

  if (hitAny || hitDragon) flashHitmarker(hitHead);
  muzzleBurst(obstruction ? obstruction.from : from);
  const spatialAudio = combatApi('audio');
  if (!(spatialAudio && spatialAudio.available)) playShot(w);
  combatApplyShotRecoil(w, shotAt);
  updateCombatHud();
  if (w.burst) {
    gun.burstLeft = gun.burstLeft > 0 ? gun.burstLeft - 1 : w.burst - 1;
    if (!gun.burstLeft) gun.cooldown = w.burstGap;
  }
}

/* ---------------- damage, death & respawn ---------------- */
function combatCopyPosition(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) return null;
  return new THREE.Vector3(value.x, value.y, value.z);
}

function combatWeaponId(value) {
  const id = value && typeof value === 'object' ? value.id : value;
  return typeof id === 'string' && /^[\w-]{1,32}$/.test(id) ? id : '';
}

function combatWeaponForId(id) {
  try {
    const peer = typeof net !== 'undefined' && net && net.players ? net.players.get(id) : null;
    return peer ? combatWeaponId(peer.weapon) : '';
  } catch (e) { return ''; }
}

function combatKillToken(info) {
  if (!info) return null;
  for (const key of ['killId', 'killToken', 'eventId', 'killEventId']) {
    const value = info[key];
    if (typeof value === 'string' && value.length > 0 && value.length <= 160) return value;
    if (Number.isFinite(value) && value >= 0) return String(value);
  }
  return null;
}

function combatObserveNetPacket(msg) {
  if (!msg || typeof msg !== 'object') return;
  try {
    if (typeof net === 'undefined' || !net) return;
    if (msg.room && net.room && msg.room !== net.room) return;
    const at = performance.now();
    // This hook runs before the network dispatcher. Only CACHE metadata here;
    // applyDamage/addKillFeed consume it after that dispatcher accepts a hit or
    // death. A raw packet never produces a banner, damage or match score.
    if (msg.t === 'hit' && msg.target === net.id) combatPendingHitPacket = { msg, at };
    else if (msg.t === 'died') combatPendingDeathPacket = { msg, at };
  } catch (e) { /* Optional compatibility with older four-/two-argument calls. */ }
}

function combatHitInfo(dmg, byName, head, byId, info, extra) {
  let packet = null;
  let activeKill = null;
  try {
    if (typeof net !== 'undefined' && net) {
      const context = net.damageContext;
      if (context && context.target === net.id && (!byId || context.byId === byId) &&
          (!byName || safeName(context.by) === safeName(byName))) packet = context;
      const kill = net.killContext;
      if (kill && kill.victimId === net.id && (!byId || kill.byId === byId)) activeKill = kill;
    }
  } catch (e) { /* The fifth argument remains sufficient without network context. */ }
  const pending = combatPendingHitPacket;
  if (!packet && pending && performance.now() - pending.at < 250) {
    const p = pending.msg;
    const packetAmount = Math.max(1, Math.min(COMBAT_MAX_HIT, Number(p.dmg) || 0));
    if ((!byId || p.byId === byId) && (!byName || safeName(p.by) === safeName(byName)) &&
        packetAmount === Math.max(1, Math.min(COMBAT_MAX_HIT, Number(dmg) || 0)) &&
        (head == null || !!p.head === !!head)) packet = p;
  }
  combatPendingHitPacket = null;
  const supplied = typeof info === 'string' ? { weapon: info }
    : info && typeof info === 'object' && !Array.isArray(info) ? info : null;
  const source = Object.assign({}, packet, supplied,
    extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : null);
  const kill = source.kill && typeof source.kill === 'object' ? source.kill : null;
  const result = Object.assign({}, source, activeKill, kill);
  const authority = kill && kill.authoritative === true ? kill : activeKill;
  result.byId = authority ? authority.killerId || authority.byId || ''
    : byId || result.byId || result.killerId || combatIdByName(byName || result.by);
  result.killerId = result.byId || '';
  result.byName = safeName(authority && (authority.by || authority.byName) || byName || result.byName || result.by);
  result.head = authority ? !!authority.head
    : head == null ? !!(result.head || result.headshot) : !!head;
  result.weapon = combatWeaponId(result.weapon) || combatWeaponForId(result.byId);
  result.killerPos = combatCopyPosition(result.killerPos) || combatCopyPosition(result.from) ||
    combatCopyPosition(result.pos) || combatPositionForId(result.byId);
  result.from = combatCopyPosition(source.from) || combatCopyPosition(result.killerPos);
  result.pos = combatCopyPosition(result.killerPos);
  result.victimPos = player.pos.clone();
  result.at = performance.now();
  // Server hit packets may contain both corrected HP and the actual death
  // event. Preserve that event's token, weapon, headshot and source position.
  result.authoritativeHealth = Number.isFinite(source.health) &&
    (result.authoritative === true || (packet && typeof net !== 'undefined' && net && net.mode === 'ws'))
    ? Math.max(0, Math.min(MAX_HEALTH, source.health)) : null;
  return result;
}

function combatPositionForId(id) {
  if (!id) return null;
  try {
    if (typeof net !== 'undefined' && net && net.id && id === net.id) return player.pos.clone();
    if (typeof net !== 'undefined' && net && net.players) {
      const r = net.players.get(id);
      if (r) {
        if (r.group && r.group.position) return r.group.position.clone();
        if (Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.z)) {
          return new THREE.Vector3(r.x, r.y, r.z);
        }
      }
    }
  } catch (e) { /* position is cosmetic */ }
  return null;
}

function combatLocalName() {
  try { return typeof playerName === 'string' ? safeName(playerName) : ''; } catch (e) { return ''; }
}

function applyDamage(dmg, byName, head, byId, info) {
  if (!alive) return false;
  const numeric = Number(dmg);
  if (!Number.isFinite(numeric) || numeric <= 0) return false;
  const hit = combatHitInfo(numeric, byName, head, byId, info, arguments[5]);
  // A hit confirmed by the room authority already passed its team and range
  // checks. Re-judging it with this client's guesses made players unkillable.
  if (hit.authoritative !== true) {
    if (spawnShieldActive()) return false;
    if (combatIsFriendly(hit.byId, hit.byName, null, hit.killerTeam || hit.byTeam)) return false;
    const hitWeapon = WEAPON_BY_ID[hit.weapon];
    if (hit.killerPos && hitWeapon && hit.killerPos.distanceTo(player.pos) > hitWeapon.range) return false;
  }
  const amount = Math.max(1, Math.min(COMBAT_MAX_HIT, numeric));
  health = hit.authoritativeHealth === null ? Math.max(0, health - amount) : hit.authoritativeHealth;
  combatLastHitInfo = hit;
  lastDamageAt = performance.now();
  if (hurtEl) hurtEl.style.opacity = String(Math.min(0.9, 0.28 + (1 - health / MAX_HEALTH) * 0.7));
  setHealth(health);
  playTone(hit.head ? 190 : 150, 0.1, 'sawtooth', 0.1);
  const impactPos = player.pos.clone().addScaledVector(combatWorldUp, combatBodyHeight(player) * 2 / 3);
  combatEmit('sfx', { kind: 'hit', weapon: hit.weapon, position: impactPos.clone(), volume: 0.9 });
  if (hit.byName || hit.byId) {
    const fxApi = combatApi('combatFx');
    if (fxApi && typeof fxApi.damageDirection === 'function') {
      try { fxApi.damageDirection({ from: hit.from, pos: hit.killerPos, byId: hit.byId, byName: hit.byName, amount }); } catch (e) { /* optional */ }
    }
  }
  combatEmit('damage', {
    amount, byName: hit.byName, byId: hit.byId, health, weapon: hit.weapon, head: hit.head,
    from: combatCopyPosition(hit.from), killerPos: combatCopyPosition(hit.killerPos), pos: impactPos
  });
  if (health <= 0) die(hit.byName, hit.byId, hit);
  return true; // Network callers must not force HP/SFX after a rejected hit.
}

function die(byName, byId, hitInfo) {
  if (!alive) return;
  const last = combatLastHitInfo;
  const matchesLast = last && performance.now() - last.at < 8000 &&
    (!byId || byId === last.byId) && (!byName || safeName(byName) === last.byName);
  const hit = hitInfo && typeof hitInfo === 'object' ? hitInfo : matchesLast ? last : {};
  const killerId = byId || hit.byId || hit.killerId || combatIdByName(byName);
  const killerName = safeName(byName || hit.byName || hit.by);
  const victimPos = player.pos.clone(); // Freeze before movement/ride reset hooks run.
  const deathSoundPos = victimPos.clone().addScaledVector(combatWorldUp, combatBodyHeight(player) * 2 / 3);
  const killerPos = combatCopyPosition(hit.killerPos) || combatCopyPosition(hit.pos) ||
    combatCopyPosition(hit.from) || combatPositionForId(killerId);
  alive = false;
  // The network may already have applied this absolute count before announcing
  // a missed-hit death. Adopting it must not add a second local death.
  deaths = hit.authoritative === true && Number.isFinite(hit.deaths)
    ? Math.max(0, Math.floor(hit.deaths)) : deaths + 1;
  if (hit.authoritative === true && Number.isFinite(hit.kills)) kills = Math.max(0, Math.floor(hit.kills));
  const diedAt = performance.now();
  respawnAt = diedAt + 3200;
  gun.trigger = false;
  gun.aiming = false;
  gun.firePose = 0;
  gun.kick = 0;
  gun.shotAge = -1;
  gun.mechanismCued = false;
  gun.recoilSide = 0;
  combatRecoilAccum = 0;
  combatBurstShots = 0;
  cancelReload(false);
  if (typeof resetPlayerMotion === 'function') resetPlayerMotion();
  if (typeof cancelQuickBuild === 'function') cancelQuickBuild();
  if (typeof resetBuildingInput === 'function') resetBuildingInput();
  player.vel.set(0, 0, 0);
  updateGunVisual(0);
  setHealth(0);
  setKd();
  const info = Object.assign({}, hit, {
    byId: killerId || '', killerId: killerId || '', victimId: typeof net !== 'undefined' && net ? net.id : '',
    weapon: combatWeaponId(hit.weapon) || combatWeaponForId(killerId), head: !!hit.head,
    pos: killerPos, killerPos: combatCopyPosition(killerPos), victimPos,
    killerTeam: hit.killerTeam || combatTeamForId(killerId),
    victimTeam: hit.victimTeam || combatTeamForId(typeof net !== 'undefined' && net ? net.id : ''),
    localDeath: true, confirmed: true, deaths
  });
  const token = combatKillToken(info);
  if (token !== null) info.killId = token;
  const killcam = combatApi('killcam');
  const fxApi = combatApi('combatFx');
  const fallback = !killcam && fxApi && typeof fxApi.killBanner === 'function';
  if (deathEl) {
    deathEl.classList.toggle('show', !killcam);
    deathEl.classList.toggle('combat-fx-fallback', !!fallback);
    const heading = deathEl.querySelector('h2');
    if (heading) heading.textContent = killerName !== '???' ? killerName + ' got you' : 'Eliminated';
  }
  if (respawnInEl) respawnInEl.textContent = '3';
  // Positional sound first suppresses audio's death/killfeed fallbacks.
  combatEmit('sfx', { kind: 'death', weapon: info.weapon, position: deathSoundPos, volume: 0.9, killId: info.killId });
  // Core/killcam/audio consume this after the local alive flag is already false.
  combatEmit('death', playerName, killerName, info);
  if (fallback) {
    try { fxApi.killBanner(playerName, killerName, info); } catch (e) { /* optional */ }
  }
  addKillFeed(killerName, playerName, info);
  // A server/host death token already represents the reported death. Only the
  // legacy victim-confirmed path needs to send a fresh died report.
  if (info.authoritative !== true || token === null) {
    netSend({
      t: 'died', id: net.id, victimId: net.id, victim: playerName, by: killerName,
      byId: info.byId, killerId: info.killerId, weapon: info.weapon, head: info.head,
      killId: info.killId, killToken: info.killToken, eventId: info.eventId,
      victimPos: info.victimPos, killerPos: info.killerPos, life: info.life, generation: info.generation,
      kills, deaths
    });
  }
  playTone(90, 0.5, 'sawtooth', 0.14);
}

function doRespawn() {
  if (combatWorldBusy()) { combatReleaseGun(false); return false; }
  let spawn = null;
  const modes = combatApi('modes');
  try { if (modes && typeof modes.respawnPoint === 'function') spawn = modes.respawnPoint(modes.localTeam); } catch (e) { /* optional */ }
  if (!spawn || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.y) || !Number.isFinite(spawn.z)) spawn = findSpawn();
  player.pos.set(spawn.x, spawn.y, spawn.z);
  player.vel.set(0, 0, 0);
  if (Number.isFinite(spawn.yaw)) { player.yaw = spawn.yaw; player.pitch = 0; }
  if (typeof resetPlayerMotion === 'function') resetPlayerMotion();
  if (typeof resetBuildingInput === 'function') resetBuildingInput();
  health = MAX_HEALTH;
  alive = true;
  gun.ammo = WEAPONS.map((w) => w.mag);
  cancelReload(false);
  gun.cooldown = 0;
  gun.burstLeft = 0;
  gun.aiming = false;
  gun.trigger = false;
  gun.firePose = gun.kick = gun.viewAim = 0;
  gun.equip = 1;
  combatRecoilAccum = 0;
  gun.recoilSide = 0;
  gun.shotAge = -1;
  gun.mechanismCued = false;
  gun.bloom.fill(0);
  gun.shots.fill(0);
  gun.lastSpread = 0;
  combatBurstShots = 0;
  combatRecoilStamp = combatBurstStamp = -9999;
  combatLastHitInfo = combatPendingHitPacket = combatPendingDeathPacket = null;
  lastDamageAt = -9999;
  if (deathEl) deathEl.classList.remove('show', 'combat-fx-fallback');
  if (hurtEl) hurtEl.style.opacity = '0';
  setHealth(health);
  combatOnLoadoutChanged();
  combatEmit('sfx', {
    kind: 'respawn', position: player.pos.clone().addScaledVector(combatWorldUp, combatBodyHeight(player) * 2 / 3), volume: 0.5
  });
  // Emit once, after alive/position reset and before the view gun is restored.
  combatEmit('respawn');
  updateGunVisual(0);
  updateCombatHud();
  netSend({ ...combatNetState('respawn'), id: net.id });
  return true;
}

function combatKillfeedInfo(killer, victim, info) {
  const supplied = info && typeof info === 'object' && !Array.isArray(info) ? info : {};
  let packet = null;
  const pending = combatPendingDeathPacket;
  if (pending && performance.now() - pending.at < 250 &&
      safeName(pending.msg.by) === safeName(killer) && safeName(pending.msg.victim) === safeName(victim)) {
    packet = pending.msg;
    combatPendingDeathPacket = null;
  }
  const source = Object.assign({}, packet, supplied);
  const self = typeof net !== 'undefined' && net ? net.id : '';
  const killerId = source.killerId || source.byId || combatIdByName(killer);
  const victimId = source.victimId || (source.t === 'died' ? source.id : '') || combatIdByName(victim);
  const victimPos = combatCopyPosition(source.victimPos) || combatPositionForId(victimId);
  const killerPos = combatCopyPosition(source.killerPos) ||
    (source.localDeath ? combatCopyPosition(source.pos) : null) || combatPositionForId(killerId);
  const predicted = !!(source.predicted || source.optimistic || source.localKill);
  const confirmed = !predicted &&
    source.confirmed !== false && source.authoritative !== false &&
    (!!packet || source.confirmed === true || source.authoritative === true);
  const result = Object.assign({}, source, {
    confirmed, killerId: killerId || '', byId: killerId || '', victimId: victimId || '',
    weapon: combatWeaponId(source.weapon) || combatWeaponForId(killerId), head: source.head == null ? !!source.headshot : !!source.head,
    killerPos, victimPos, pos: combatCopyPosition(victimPos),
    killerTeam: source.killerTeam || combatTeamForId(killerId), victimTeam: source.victimTeam || combatTeamForId(victimId),
    // Modes reserves localKill for old HP-prediction events. Never set it on a
    // confirmed/scoring event; the overlay identifies personal kills by IDs.
    predicted, localKill: false, optimistic: false,
    personalKill: !!self && killerId === self && victimId !== self,
    localDeath: source.localDeath === true || (!!self && victimId === self)
  });
  const token = combatKillToken(result);
  if (token !== null) result.killId = token; // Preserve aliases as well as the canonical token.
  return result;
}

function addKillFeed(killer, victim, info) {
  info = combatKillfeedInfo(killer, victim, info);
  const killerName = safeName(killer);
  const victimName = safeName(victim);
  const now = performance.now();
  const token = combatKillToken(info);
  const ordinal = Number.isFinite(info.life) ? 'life:' + info.life : Number.isFinite(info.deaths) ? 'death:' + info.deaths : '';
  const key = token !== null && info.confirmed ? 'kill:' + token
    : (info.confirmed ? 'confirmed:' : 'row:') + (info.killerId || killerName) + '>' +
      (info.victimId || victimName) + ':' + (info.generation == null ? '' : info.generation) + ':' + ordinal;
  const seen = combatKfDedupe.get(key);
  if (seen !== undefined && (token !== null && info.confirmed || ordinal || now - seen < 2600)) return true;
  if (info.confirmed && info.authoritative === true && info.localDeath && alive) {
    // A confirmed died packet must also activate death/killcam when its hit
    // packet was missed. die posts the same token after flipping alive=false,
    // so this path produces one local death and one row without recursion.
    if (typeof net !== 'undefined' && net && Number.isSafeInteger(info.life) &&
        Number.isSafeInteger(net.localLife) && info.life < net.localLife) return true;
    if (!Number.isFinite(info.deaths) && typeof net !== 'undefined' && net && net.killContext &&
        net.killContext.killId === token) info.deaths = deaths; // netApplyOwnState already adopted this count.
    die(killerName, info.killerId, info);
    return true;
  }
  combatKfDedupe.set(key, now);
  while (combatKfDedupe.size > 256) combatKfDedupe.delete(combatKfDedupe.keys().next().value);
  // A legacy two-name call still renders a row. Only accepted death packets or
  // explicitly confirmed actual deaths can reach the match-scoring hook.
  if (!killfeedEl) {
    if (info.confirmed) combatEmit('killfeed', killerName, victimName, info);
    return true;
  }
  const weaponId = info.weapon;
  const weapon = weaponId && WEAPON_BY_ID[weaponId] ? WEAPON_BY_ID[weaponId].name : (weaponId ? weaponId.toUpperCase() : 'eliminated');
  const killerTeam = info.killerTeam;
  const victimTeam = info.victimTeam;
  const row = document.createElement('div');
  row.className = 'kf';
  const a = document.createElement('b');
  a.className = 'kf-k' + (killerTeam ? ' kf-' + killerTeam : '');
  a.textContent = killerName;
  const mid = document.createElement('i');
  mid.className = 'kf-x';
  mid.textContent = weapon;
  const b = document.createElement('b');
  b.className = 'kf-v' + (victimTeam ? ' kf-' + victimTeam : '');
  b.textContent = victimName;
  row.append(a, mid, b);
  if (info.head) {
    const hs = document.createElement('span');
    hs.className = 'kf-hs';
    hs.textContent = 'HEADSHOT';
    row.appendChild(hs);
  }
  killfeedEl.appendChild(row);
  while (killfeedEl.children.length > 5) killfeedEl.removeChild(killfeedEl.firstChild);
  setTimeout(() => row.remove(), 5200);
  if (info.confirmed) combatEmit('killfeed', killerName, victimName, info);
  return true;
}

/* ---------------- weapon selection & modes ---------------- */
function selectWeapon(i, silent) {
  if (!Number.isInteger(i) || i < 0 || i >= WEAPONS.length) return;
  if (!combatWeaponAllowed(WEAPONS[i])) {
    if (typeof toast === 'function') toast('Not in this loadout');
    return;
  }
  if (gun.index === i) return;
  combatClearGeneratedRecoil();
  cancelReload(false);
  gun.index = i;
  gun.cooldown = 0.18;
  gun.aiming = false;
  gun.trigger = false;
  gun.firePose = gun.kick = gun.viewAim = 0;
  gun.equip = 1;
  gun.shotAge = -1;
  gun.mechanismCued = false;
  combatBurstShots = 0;
  combatRecoilStamp = combatBurstStamp = -9999;
  refreshGunModels();
  if (!silent && alive && !combatActionBlocked()) {
    playTone(420, 0.04, 'square', 0.05);
    combatEmit('sfx', { kind: 'ui', action: 'swap', weapon: WEAPONS[i].id, position: combatSourcePosition(), volume: 0.4 });
  }
  if (typeof netSend === 'function') netSend(combatNetState());
}

function cycleWeapon(direction) {
  const step = direction < 0 ? -1 : 1;
  for (let n = 1; n <= WEAPONS.length; n++) {
    const idx = ((gun.index + step * n) % WEAPONS.length + WEAPONS.length) % WEAPONS.length;
    if (combatWeaponAllowed(WEAPONS[idx])) { selectWeapon(idx); return; }
  }
}

function setCombatMode(on) {
  combatMode = !!on;
  document.body.classList.toggle('combat', combatMode);
  document.body.classList.toggle('build', !combatMode);
  // The dedicated Home/Pause controller owns visibility when installed.
  // A loadout or build-mode change must not silently hide the Home screen.
  if (!(BC.api && BC.api.menus)) hintEl.classList.add('hidden');
  combatReleaseGun(false);
  gun.viewAim = 0;
  combatOnLoadoutChanged();
  if (typeof cancelQuickBuild === 'function') cancelQuickBuild();
  if (typeof resetBuildingInput === 'function') resetBuildingInput();
  updateGunVisual(0);
  netSend(combatNetState());
  if (highlight) highlight.visible = false;
  combatEmit('sfx', { kind: 'ui', action: 'combatMode', position: combatSourcePosition(), volume: 0.2 });
  playTone(combatMode ? 520 : 360, 0.06, 'square', 0.05);
  if (typeof toast === 'function') toast(combatMode ? 'Combat mode. Left click shoots' : 'Build mode. Mine and place blocks');
}

function toggleMute() {
  const next = !combatReadMute(); // Choose once; every bridge adopts this value.
  muted = next; // Set before the store can resume the shared audio() context.
  let adopted = next;
  const settings = combatSettingsStore();
  try {
    if (settings && typeof settings.set === 'function') {
      const saved = settings.set('muted', next);
      if (typeof saved === 'boolean') adopted = saved;
    }
  } catch (e) { /* Local-file storage failure must not disable the toggle. */ }
  combatSyncMute(adopted);
  if (typeof toast === 'function') toast(muted ? 'Sound muted' : 'Sound on');
}

/* ---------------- per-frame combat update ---------------- */
function updateCombat(dt, now) {
  dt = Math.max(0, Number.isFinite(dt) ? dt : 0);
  now = Number.isFinite(now) ? now : performance.now();
  const blocked = combatActionBlocked();
  if (blocked) combatReleaseGun();
  if (combatWorldBusy()) { updateGunVisual(0); updateFx(dt); return; }
  if (alive && !combatWeaponAllowed(currentWeapon())) combatOnLoadoutChanged();
  const w = currentWeapon();
  const reduced = combatReducedMotion && combatReducedMotion.matches;
  const scoped = isScopeActive();
  const sprint = !reduced && alive && !scoped && !gun.trigger && !player.fly && player.groundSpeed > 5.3 &&
    (player.sprinting || keys.ShiftLeft || keys.ShiftRight);
  const riding = combatApi('riding'), killcam = combatApi('killcam'), jetpack = combatApi('jetpack');
  const externalFov = !!((riding && riding.active) || (killcam && killcam.active) ||
    (!scoped && ((jetpack && jetpack.active) || player.fly)));
  const targetFov = scoped ? w.scopeFov : 74 + (sprint ? 3 : 0);
  if (!externalFov && Math.abs(camera.fov - targetFov) > 0.001) {
    const nextFov = camera.fov + (targetFov - camera.fov) * combatDamp(combatAdsRate(w, scoped, reduced), dt);
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

  // Input owns semi-auto DOWN edges. Only automatic weapons sample a held
  // trigger below, at most once per frame. Keep sub-frame cadence carry during
  // normal frames, but drop missed-round debt after a hitch (never catch up).
  const interval = 60 / w.rpm;
  const cooldownCarry = !blocked && gun.cooldown > 0 && dt <= interval ? Math.min(0, gun.cooldown - dt) : 0;
  if (!blocked) gun.cooldown = Math.max(0, gun.cooldown - dt);
  if (!blocked && combatStepHandling(dt, now, w) && typeof updateCamera === 'function') updateCamera(0);
  gun.kick *= Math.exp(-w.recover * dt);
  if (gun.kick < 0.0001) gun.kick = 0;
  gun.firePose = Math.max(0, gun.firePose - dt / Math.max(0.06, w.handling.cycle));
  if (gun.reloading > 0 && (blocked || !combatMode || combatQuickBuilding() ||
      !combatWeaponAllowed(currentWeapon()) || gun.reloadIndex !== gun.index)) cancelReload();
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
  if (gun.burstLeft > 0) {
    if (blocked || !currentWeapon().burst || gun.ammo[gun.index] <= 0) gun.burstLeft = 0;
    else fireOnce();
  }
  if (!blocked && gun.trigger && currentWeapon().auto) {
    const before = gun.ammo[gun.index];
    fireOnce();
    if (gun.ammo[gun.index] < before) gun.cooldown = Math.max(0, gun.cooldown + cooldownCarry);
  }

  if (now - lastDamageAt > 6000 && health < MAX_HEALTH && combatRegenAllowed()) {
    health = Math.min(MAX_HEALTH, health + dt * 14);
    setHealth(health);
  }

  updateGunVisual(dt);
  updateFx(dt);
}

function updateGunVisual(dt) {
  const active = alive && combatMode && !combatQuickBuilding() && !combatActionBlocked() && combatWeaponAllowed(currentWeapon());
  const scoped = isScopeActive();
  combatUpdateScopeHud();
  const w = currentWeapon(), reload = getReloadProgress();
  const tube = scoped && w.view === 'sniper-tube';
  const showView = active && (!thirdPerson || scoped) && !tube;
  const reduced = combatReducedMotion && combatReducedMotion.matches;
  const aim = active && gun.aiming ? 1 : 0;
  gun.viewAim += (aim - gun.viewAim) * combatDamp(combatAdsRate(w, !!aim, reduced), dt);
  if (Math.abs(gun.viewAim - aim) <= 0.001) gun.viewAim = aim;
  gun.equip *= Math.exp(-18 * Math.max(0, dt));
  vmRoot.visible = showView;
  if (viewGun) {
    viewGun.visible = showView;
    updateWeaponReload(viewGun, active ? reload : -1, gun.reloadRounds);
    if (reload < 0) combatSampleShotMechanism(viewGun, active ? gun.shotAge : -1, gun.shots[gun.index]);
    const rp = viewGun.userData.reloadPose, a = gun.viewAim;
    const move = reduced ? 0 : Math.min(1, Math.max(0, player.groundSpeed) / 7.3) * (1 - a) * (reload < 0 ? 1 : 0);
    const phase = Number.isFinite(player.walkPhase) ? player.walkPhase : 0;
    const recoil = gun.kick * w.kickBack * (reduced ? 0.35 : 1);
    const adsY = -viewGun.userData.adsAnchor.y * viewGun.scale.y;
    // Base + offsets, not an offset accumulated on last frame's position.
    viewGun.position.set(
      0.27 * (1 - a) + rp.x + Math.sin(phase) * 0.008 * move,
      -0.27 + (adsY + 0.27) * a + rp.y - gun.equip * (reduced ? 0.03 : 0.12) + Math.cos(phase * 2) * 0.006 * move,
      -0.56 + (w.handling.adsZ + 0.56) * a + rp.z + recoil
    );
    viewGun.rotation.set(rp.pitch, rp.yaw, rp.roll);
    combatViewHands(viewGun);
  }
  if (localAvatar) {
    const held = localAvatar.userData.gun;
    if (held) {
      held.visible = active && thirdPerson && !scoped;
      updateWeaponReload(held, active ? reload : -1, gun.reloadRounds);
      if (reload < 0) combatSampleShotMechanism(held, active ? gun.shotAge : -1, gun.shots[gun.index]);
    }
    // Avatar visibility belongs to camera collision/movement, not combat.
    if (scoped) localAvatar.visible = false;
  }
  if (active && reload < 0 && !tube) {
    camera.getWorldPosition(combatVisualOrigin);
    camera.getWorldDirection(combatVisualDir);
    const solid = combatRaycastSolid(combatVisualOrigin, combatVisualDir, w.range, combatSolidRayOut);
    combatVisualTarget.copy(combatVisualOrigin).addScaledVector(combatVisualDir, solid.distance);
    combatGetMuzzle(combatAimMuzzle);
    if ((combatVisualTarget.x - combatAimMuzzle.x) * combatVisualDir.x +
        (combatVisualTarget.y - combatAimMuzzle.y) * combatVisualDir.y +
        (combatVisualTarget.z - combatAimMuzzle.z) * combatVisualDir.z < 0.1) {
      combatVisualTarget.copy(combatAimMuzzle).addScaledVector(combatVisualDir, w.range);
    }
    if (showView) {
      combatAimGunAt(viewGun, combatVisualTarget);
      // Mechanism posing and kick are visual feedback, sampled on top of the
      // actual camera/barrel solve. Real ADS points remain centred afterwards.
      const rp = viewGun.userData.reloadPose, feedback = reduced ? 0.35 : 1;
      viewGun.rotation.x += rp.pitch + gun.kick * w.recoil * w.handling.viewRise * feedback;
      viewGun.rotation.y += rp.yaw;
      viewGun.rotation.z += rp.roll + gun.kick * w.handling.viewRoll * feedback;
      combatAlignViewSight(viewGun, gun.viewAim);
    }
    if (thirdPerson && !scoped && localAvatar) combatAimGunAt(localAvatar.userData.gun, combatVisualTarget);
  }
  if (scoped && !tube && viewGun) combatProjectScopeHousing(viewGun);
  if (dt > 0) combatLookNeedsSync = false;
}

function combatReloadPhase() {
  const progress = getReloadProgress();
  if (progress < 0) return 'ready';
  const stages = currentWeapon().handling.reloadStages;
  let phase = 'raise weapon';
  for (let i = 0; i < stages.length && progress >= stages[i][0]; i++) phase = stages[i][1];
  return phase;
}

function combatHandlingProfile(id) {
  const w = id == null ? currentWeapon() : WEAPON_BY_ID[id];
  return w ? w.handling : null;
}

/* On-demand observation only; normal frames never allocate a second gun state.
   Probes/audio/HUD may read the profile or the existing gun/viewmodel directly. */
function combatHandlingState() {
  const w = currentWeapon();
  return {
    weapon: w.id, view: w.view, optic: w.optic, role: w.role,
    ads: isScopeActive(), aimProgress: gun.viewAim, fov: camera.fov,
    vmRootVisible: vmRoot.visible, viewGunVisible: !!(viewGun && viewGun.visible),
    bloom: gun.bloom[gun.index], lastSpread: gun.lastSpread,
    recoilPitch: combatRecoilAccum, recoilYaw: gun.recoilSide,
    shotAge: gun.shotAge, mechanism: w.handling.mechanism,
    mechanismProgress: gun.shotAge < 0 ? -1 : combatClamp01(gun.shotAge / w.handling.cycle),
    reloadProgress: getReloadProgress(), reloadPhase: combatReloadPhase(), reloadTotal: gun.reloadTotal
  };
}

/* ---------------- runtime wiring ---------------- */
if (typeof BC !== 'undefined' && BC && typeof BC.on === 'function') {
  if (BC.api) {
    const api = BC.api.combat || {};
    api.getProfile = combatHandlingProfile;
    api.getState = combatHandlingState;
    api.isScopeActive = isScopeActive;
    api.muzzleModel = combatMuzzleModel;
    api.raycastSolidDragon = combatRaycastDragon;
    api.raycastSolid = combatRaycastSolid;
    Object.defineProperties(api, {
      gun: { enumerable: true, configurable: true, get: () => gun },
      weapon: { enumerable: true, configurable: true, get: currentWeapon },
      profile: { enumerable: true, configurable: true, get: () => currentWeapon().handling },
      viewGun: { enumerable: true, configurable: true, get: () => viewGun },
      vmRoot: { enumerable: true, configurable: true, get: () => vmRoot },
      reloadPhase: { enumerable: true, configurable: true, get: combatReloadPhase }
    });
    BC.api.combat = api;
  }
  BC.on('netPacket', combatObserveNetPacket, -20);
  BC.on('modeChanged', combatOnLoadoutChanged);
  BC.on('loadoutChanged', combatOnLoadoutChanged);
  BC.on('settingsChanged', (key, value) => {
    if (key === 'muted') combatSyncMute(value);
    else if (key === 'mode') combatOnLoadoutChanged();
  });
  BC.on('inputReset', () => combatReleaseGun());
  BC.on('preFrame', (dt, now, playing) => {
    if (!playing || combatActionBlocked()) combatReleaseGun();
  }, -20);
  BC.on('worldReset', () => {
    combatReleaseGun(false);
    gun.bloom.fill(0);
    gun.shots.fill(0);
    gun.lastSpread = 0;
    combatLastHitInfo = combatPendingHitPacket = combatPendingDeathPacket = null;
    combatKfDedupe.clear();
    combatOnLoadoutChanged();
  });
  BC.on('netStatus', () => {
    combatPendingHitPacket = combatPendingDeathPacket = null;
    combatOnLoadoutChanged();
  });
  if (typeof BC.whenReady === 'function') {
    BC.whenReady(() => {
      combatSyncMute();
      combatOnLoadoutChanged();
    });
  }
}
