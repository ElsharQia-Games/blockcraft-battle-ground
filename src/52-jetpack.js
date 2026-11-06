/* Blockcraft Battle Ground — Fuel jetpack, rig, flames and HUD.
   52-jetpack.js
   Loads after 50-player.js (player state) and 45-dragons.js, before 55-building.js.
   Replaces free flight: F calls toggle(), fuel drains while active, and a dry tank
   forces a sputtering landing. State is exposed through BC.api.jetpack so audio,
   input and the network layer can read it without keeping a second copy. */
'use strict';

/* ---------------- tuning ---------------- */
const JET_MAX_FUEL = 100;
const JET_DRAIN = 16;                 // fuel / second while active
const JET_RECHARGE = 22;              // fuel / second once safely grounded
const JET_RECHARGE_DELAY = 0.8;       // seconds on the floor before refuelling
const JET_GROUND_GRACE = 0.25;        // steps and small hops don't count as leaving the ground
const JET_MIN_ACTIVATE = 3;           // don't launch on fumes
const JET_LAUNCH_COST = 1.5;          // rapid F toggles cannot create free impulses
const JET_LAUNCH_COOLDOWN = 0.25;
const JET_BOOST_DRAIN = 10;           // additional fuel / second while boosting
const JET_BOOST_MIN_FUEL = 8;
const JET_BOOST_SPEED = 23.1;
const JET_ASCEND_SPEED = 14;
const JET_BOOST_ASCEND = 17.5;
const JET_DASH_COST = 12;
const JET_DASH_TIME = 0.25;
const JET_DASH_COOLDOWN = 1.2;
const JET_DASH_SPEED = 28;
const JET_SPEED_CAP = 28;
const JET_SPUTTER_TIME = 1.25;        // visible death-rattle after a dry landing
const JET_BASE_FOV = 74;
const JET_FOV_KICK = 7;
const JET_IMPULSE = 2.1;              // gentle pop so activation reads immediately
const JET_STREAK_MAX = 24;
const JET_STREAK_LIFE = 0.42;
const JET_STREAK_RATE = 46;           // particles / second while thrusting
const JET_NOZZLE_Y = 0.74;            // world offset from player feet
const JET_NOZZLE_X = 0.15;
const JET_NOZZLE_Z = 0.20;

const jetState = {
  active: false,
  fuel: JET_MAX_FUEL,
  thrusting: false,
  boosting: false,
  dashing: false,
  dashTime: 0,
  dashCooldown: 0,
  dashX: 0,
  dashZ: 0,
  dashDown: false,
  launchCooldown: 0,
  frameOwned: false,
  lastFrame: -Infinity,
  playing: true,
  groundTimer: 0,
  sputter: 0,
  hintFlash: 0,
  rig: null,
  rigAvatar: null,
  flameL: null,
  flameR: null,
  flameMat: null,
  coreMat: null,
  light: null,
  streakMesh: null,
  streakPositions: null,
  streakData: null,
  streakIndex: 0,
  streakSide: 0,
  streakAccum: 0,
  streakDrawn: 0,
  fovOffset: 0,
  fovTouched: false,
  hudEl: null,
  hudLabel: null,
  hudHint: null,
  hudSegs: null,
  hudPct: -1,
  hudLit: -1,
  hudMode: '',
  hudFlags: -1,
  hudLow: false,
  hudShown: null
};

const jetVecA = new THREE.Vector3();

/* ---------------- guards / helpers ---------------- */
function jetAlive() {
  try { return typeof alive === 'undefined' ? true : !!alive; } catch (e) { return true; }
}

function jetCanFly() {
  if (typeof player === 'undefined' || !player) return false;
  if (!jetAlive()) return false;
  const world = BC.api && BC.api.world;
  if ((BC.flags && BC.flags.worldBusy) || (world && world.busy)) return false;
  if (typeof document !== 'undefined' && document.hidden) return false;
  if (typeof isGameplayInputActive === 'function') {
    if (!isGameplayInputActive()) return false;
  } else if (!jetState.playing) return false;
  const riding = BC.api && BC.api.riding;
  if (riding && riding.active) return false;
  const killcam = BC.api && BC.api.killcam;
  if (killcam && killcam.active) return false;
  return true;
}

function jetToast(text) {
  if (typeof toast === 'function') toast(text);
}

function jetSfx(kind, volume) {
  const p = typeof player !== 'undefined' && player && player.pos ? player.pos : { x: 0, y: 0, z: 0 };
  BC.emit('sfx', {
    kind: kind,
    position: { x: p.x, y: p.y + 0.8, z: p.z },
    volume: volume
  });
}

function jetSetFlames(on) {
  if (jetState.flameL) jetState.flameL.visible = on;
  if (jetState.flameR) jetState.flameR.visible = on;
  if (!on && jetState.light) jetState.light.intensity = 0;
}

function jetCancelDash() {
  jetState.dashing = false;
  jetState.dashTime = 0;
  jetState.dashX = jetState.dashZ = 0;
  if (typeof player !== 'undefined' && player) player.dashing = false;
}

function jetClearControls(releaseKeys) {
  jetCancelDash();
  jetState.boosting = false;
  jetState.dashDown = false;
  if (typeof jumpQueued !== 'undefined') jumpQueued = false;
  if (typeof player !== 'undefined' && player) player.boosting = false;
  if (releaseKeys && typeof keys !== 'undefined') {
    keys['ShiftLeft'] = keys['ShiftRight'] = keys['ControlLeft'] = keys['ControlRight'] = false;
    keys['Space'] = keys['KeyC'] = false;
    if (typeof gun !== 'undefined' && gun) { gun.trigger = false; gun.aiming = false; }
  }
}

function jetCancelInput(releaseKeys = true) {
  jetState.active = false;
  jetState.thrusting = false;
  jetState.sputter = 0;
  jetState.groundTimer = 0;
  jetClearControls(releaseKeys !== false);
  if (typeof player !== 'undefined' && player) player.fly = false;
  jetSetFlames(false);
  if (jetState.rig) jetState.rig.visible = false;
  jetRestoreFov();
  jetUpdateHud();
}

function jetStartDash() {
  if (!jetState.active || jetState.dashCooldown > 0 || jetState.fuel < JET_DASH_COST + JET_MIN_ACTIVATE) return false;
  let ix = 0, iz = 0;
  if (keys['KeyW']) iz++;
  if (keys['KeyS']) iz--;
  if (keys['KeyD']) ix++;
  if (keys['KeyA']) ix--;
  const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
  const length = Math.hypot(ix, iz);
  if (length > 0) {
    jetState.dashX = (-s * iz + c * ix) / length;
    jetState.dashZ = (-c * iz - s * ix) / length;
  } else {
    const speed = Math.hypot(player.vel.x, player.vel.z);
    jetState.dashX = speed > 0.2 ? player.vel.x / speed : -s;
    jetState.dashZ = speed > 0.2 ? player.vel.z / speed : -c;
  }
  jetState.fuel -= JET_DASH_COST;
  jetState.dashTime = JET_DASH_TIME;
  jetState.dashCooldown = JET_DASH_COOLDOWN;
  jetState.dashing = true;
  player.dashing = true;
  player.vel.x = jetState.dashX * JET_DASH_SPEED;
  player.vel.z = jetState.dashZ * JET_DASH_SPEED;
  // No vertical impulse: dash cannot renew a jump or replace ascent fuel.
  jetSfx('jetpackOn', 0.32);
  return true;
}

/* ---------------- state machine ---------------- */
function jetSetActive(on) {
  on = !!on;
  if (on === jetState.active) return jetState.active;
  if (on) {
    if (!jetCanFly()) return false;
    if (jetState.launchCooldown > 0) return false;
    if (jetState.fuel < JET_MIN_ACTIVATE) {
      jetState.hintFlash = 2.2;
      jetToast(jetState.fuel > 1 ? 'Jetpack fuel is still recharging' : 'Jetpack is out of fuel');
      jetUpdateHud(true);
      return false;
    }
    jetState.active = true;
    jetState.thrusting = true;
    jetState.fuel -= JET_LAUNCH_COST;
    jetState.launchCooldown = JET_LAUNCH_COOLDOWN;
    jetState.dashDown = !!keys['KeyC'];
    jetState.sputter = 0;
    jetState.groundTimer = 0;
    if (typeof player !== 'undefined' && player) {
      player.fly = true;
      player.onGround = false;
      if (player.vel && (!Number.isFinite(player.vel.y) || player.vel.y < JET_IMPULSE)) {
        player.vel.y = JET_IMPULSE;
      }
    }
    try { if (typeof jumpQueued !== 'undefined') jumpQueued = false; } catch (e) { /* early boot */ }
    // No ignition burst on activation: the thruster loop fades in on its own.
    jetUpdateHud(true);
    return true;
  }

  jetState.active = false;
  jetState.thrusting = false;
  jetClearControls(false);
  jetState.sputter = 0;
  if (typeof player !== 'undefined' && player) player.fly = false;
  jetSetFlames(false);
  if (jetState.rig) jetState.rig.visible = false;
  jetUpdateHud(true);
  return false;
}

function jetForceLand(reason) {
  if (!jetState.active) return;
  const wasEmpty = jetState.fuel <= 0.001 || reason === 'empty';
  jetState.active = false;
  jetState.thrusting = false;
  jetClearControls(false);
  jetState.sputter = wasEmpty ? JET_SPUTTER_TIME : 0;
  if (typeof player !== 'undefined' && player) player.fly = false;
  if (wasEmpty) {
    jetState.fuel = 0;
    jetSfx('jetpackOn', 0.26);
    jetToast('Jetpack out of fuel');
  }
  jetUpdateHud(true);
}

function jetToggle() {
  if (jetState.active) return jetSetActive(false);
  return jetSetActive(true);
}

/* ---------------- fuel + HUD ---------------- */
function jetAdvance(dt) {
  dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
  if (!jetCanFly()) {
    if (jetState.active || jetState.boosting || jetState.dashing) jetCancelInput();
    jetState.groundTimer = 0;
    jetUpdateHud();
    return;
  }
  if (dt <= 0) { jetUpdateHud(); return; }
  jetState.launchCooldown = Math.max(0, jetState.launchCooldown - dt);
  jetState.dashCooldown = Math.max(0, jetState.dashCooldown - dt);
  jetState.dashTime = Math.max(0, jetState.dashTime - dt);
  if (jetState.dashing && jetState.dashTime === 0) jetCancelDash();
  jetState.sputter = Math.max(0, jetState.sputter - dt);
  jetState.hintFlash = Math.max(0, jetState.hintFlash - dt);
  const dash = !!keys['KeyC'];
  const dashPressed = dash && !jetState.dashDown;
  jetState.dashDown = dash;

  if (jetState.active) {
    jetState.groundTimer = 0;
    if (dashPressed) {
      if (!jetStartDash() && jetState.fuel < JET_DASH_COST + JET_MIN_ACTIVATE) jetState.hintFlash = 1;
    }
    jetState.thrusting = true;
    jetState.boosting = !!(keys['ShiftLeft'] || keys['ShiftRight']) && jetState.fuel >= JET_BOOST_MIN_FUEL;
    jetState.fuel = Math.max(0, jetState.fuel - (JET_DRAIN + (jetState.boosting ? JET_BOOST_DRAIN : 0)) * dt);
    if (jetState.fuel <= 0) jetForceLand('empty');
  } else {
    jetState.thrusting = false;
    jetState.boosting = false;
    jetCancelDash();
    // Ground contact flickers at every step, so walking and sprinting must not
    // restart the delay; only a real time in the air does.
    const touching = typeof player !== 'undefined' && player && player.onGround;
    jetState.airTime = touching ? 0 : (jetState.airTime || 0) + dt;
    const grounded = jetState.airTime < JET_GROUND_GRACE;
    if (grounded) {
      const wait = Math.max(0, JET_RECHARGE_DELAY - jetState.groundTimer);
      jetState.groundTimer = Math.min(JET_RECHARGE_DELAY, jetState.groundTimer + dt);
      if (dt > wait && jetState.fuel < JET_MAX_FUEL) {
        jetState.fuel = Math.min(JET_MAX_FUEL, jetState.fuel + JET_RECHARGE * (dt - wait));
      }
    } else {
      jetState.groundTimer = 0;
    }
  }

  if (typeof player !== 'undefined' && player) {
    player.fly = jetState.active;
    player.boosting = jetState.boosting;
    player.dashing = jetState.dashing;
  }
  jetUpdateHud();
}

function jetUpdate(dt) {
  // Compatibility for reduced builds. Once preFrame is seen, it is the sole
  // clock owner, even if an old caller also invokes physics.updateJetpack().
  if (!jetState.frameOwned) jetAdvance(dt);
  return jetState.active;
}

function jetEnsureHud() {
  if (jetState.hudEl) return jetState.hudEl;
  if (typeof BC.style !== 'function' || typeof BC.el !== 'function' || typeof document === 'undefined') return null;

  BC.style('bc-jetpack-v2', `
    #jetFuel {
      position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
      z-index: 5; min-width: 214px; max-width: calc(100vw - 24px);
      box-sizing: border-box; padding: 9px 12px 8px; pointer-events: none;
      border: 1px solid rgba(214, 232, 245, .18); border-radius: 10px;
      background: linear-gradient(180deg, rgba(12, 21, 30, .72), rgba(8, 15, 22, .66));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .05);
      backdrop-filter: blur(8px);
      font: 700 10px/1.35 ui-monospace, Menlo, Consolas, monospace;
      letter-spacing: .13em; text-transform: uppercase; color: #eaf3f9;
      opacity: 0; transition: opacity .18s ease;
    }
    #jetFuel.on { opacity: 1; }
    #jetFuel .bc-jet-label { white-space: nowrap; color: #cfe0ec; font-variant-numeric: tabular-nums; }
    #jetFuel .bc-jet-bar {
      display: flex; gap: 3px; height: 6px; margin-top: 6px;
      border-radius: 2px; overflow: hidden;
    }
    #jetFuel .bc-jet-seg {
      flex: 1 1 0; height: 100%; border-radius: 1px;
      background: rgba(207, 224, 236, .15);
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .18);
    }
    #jetFuel .bc-jet-seg.on {
      background: #3585ff;
      box-shadow: 0 0 6px rgba(53, 133, 255, .55);
    }
    #jetFuel.low .bc-jet-seg.on {
      background: #ff3556;
      box-shadow: 0 0 6px rgba(255, 53, 86, .55);
    }
    #jetFuel.thrust .bc-jet-label { color: #9fc4ff; }
    #jetFuel.low .bc-jet-label { color: #ffc0ca; }
    #jetFuel .bc-jet-hint {
      margin-top: 5px; font-size: 8.5px; letter-spacing: .18em; color: #8fa4b4;
    }
    body.quick-build #jetFuel { bottom: 86px; }
    @media (max-width: 860px) {
      body.quick-build #jetFuel { bottom: 78px; }
    }
    @media (prefers-reduced-motion: reduce) {
      #jetFuel, #jetFuel .bc-jet-seg { transition: none; }
    }
  `);

  // BC.el passes attributes through; use `class`, not an inert `className`
  // attribute, so the existing stylesheet really styles the segmented meter.
  const label = BC.el('div', { class: 'bc-jet-label', text: 'JETPACK · LANDED · 100%' });
  const bar = BC.el('div', { class: 'bc-jet-bar' });
  const segs = [];
  for (let i = 0; i < 10; i++) {
    const seg = BC.el('i', { class: 'bc-jet-seg' });
    bar.appendChild(seg);
    segs.push(seg);
  }
  const hint = BC.el('div', { class: 'bc-jet-hint', text: 'F · JETPACK' });
  const hud = BC.el('div', {
    id: 'jetFuel',
    class: 'bc-jet',
    role: 'meter',
    'aria-label': 'Jetpack fuel',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': '100',
    'aria-valuetext': '100 percent, landed',
    'aria-hidden': 'true'
  }, [label, bar, hint]);

  const host = document.body || document.documentElement;
  if (!host) return null;
  host.appendChild(hud);
  jetState.hudEl = hud;
  jetState.hudLabel = label;
  jetState.hudHint = hint;
  jetState.hudSegs = segs;
  return hud;
}

function jetUpdateHud(force) {
  const hud = jetState.hudEl || jetEnsureHud();
  if (!hud) return;
  if (force) {
    jetState.hudPct = -1;
    jetState.hudLit = -1;
    jetState.hudMode = '';
    jetState.hudFlags = -1;
    jetState.hudShown = null;
  }

  const active = jetState.active;
  const pct = Math.round(jetState.fuel);
  const low = jetState.fuel <= 25 || jetState.sputter > 0;
  const mode = active ? 'THRUST' : 'LANDED';
  const lit = Math.max(0, Math.min(10, Math.ceil(jetState.fuel / 10)));
  const show = active || jetState.sputter > 0 || jetState.fuel < JET_MAX_FUEL - 0.0001 || jetState.hintFlash > 0;
  const flags = (active ? 4 : 0) | (jetState.boosting ? 2 : 0) | (jetState.dashing ? 1 : 0);
  if (flags !== jetState.hudFlags) {
    jetState.hudHint.textContent = active ? (jetState.dashing ? 'AIR DASH · F TO LAND'
      : jetState.boosting ? 'BOOST · C DASH · CTRL DESCEND' : 'SHIFT BOOST · C DASH · CTRL DESCEND') : 'F · JETPACK';
    jetState.hudFlags = flags;
  }

  if (show !== jetState.hudShown) {
    hud.classList.toggle('on', show);
    hud.setAttribute('aria-hidden', show ? 'false' : 'true');
    jetState.hudShown = show;
  }
  if (pct !== jetState.hudPct || mode !== jetState.hudMode) {
    jetState.hudLabel.textContent = 'JETPACK · ' + mode + ' · ' + pct + '%';
    hud.setAttribute('aria-valuenow', String(pct));
    hud.setAttribute('aria-valuetext', pct + ' percent, ' + (active ? 'thrusting' : 'landed'));
    jetState.hudPct = pct;
    jetState.hudMode = mode;
  }
  if (lit !== jetState.hudLit) {
    for (let i = 0; i < jetState.hudSegs.length; i++) {
      jetState.hudSegs[i].className = i < lit ? 'bc-jet-seg on' : 'bc-jet-seg';
    }
    jetState.hudLit = lit;
  }
  if (low !== jetState.hudLow) {
    hud.classList.toggle('low', low);
    hud.classList.toggle('thrust', active && !low);
    jetState.hudLow = low;
  } else {
    hud.classList.toggle('thrust', active && !low);
  }
}

/* ---------------- rig ---------------- */
let jetRigAssets = null;
let jetRemoteRigCount = 0;

function jetEnsureRigAssets() {
  if (jetRigAssets) return jetRigAssets;
  if (typeof THREE === 'undefined') return null;
  // Module-lifetime assets: remote cleanup must never traverse-dispose these.
  // The local core is animated; remote palette cores are shared, but immutable.
  jetRigAssets = {
    shell: new THREE.MeshStandardMaterial({ color: 0x263544, metalness: 0.72, roughness: 0.34 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x0d161e, metalness: 0.5, roughness: 0.62 }),
    core: new THREE.MeshStandardMaterial({
      color: 0x163a66, emissive: 0x3585ff, emissiveIntensity: 1.9, metalness: 0.3, roughness: 0.24
    }),
    remoteCoreBlue: new THREE.MeshStandardMaterial({
      color: 0x163a66, emissive: 0x3585ff, emissiveIntensity: 1.9, metalness: 0.3, roughness: 0.24
    }),
    remoteCoreRed: new THREE.MeshStandardMaterial({
      color: 0x66202e, emissive: 0xff3556, emissiveIntensity: 1.9, metalness: 0.3, roughness: 0.24
    }),
    tankGeo: new THREE.CylinderGeometry(0.075, 0.087, 0.42, 8),
    capGeo: new THREE.CylinderGeometry(0.062, 0.062, 0.035, 8),
    nozzleGeo: new THREE.CylinderGeometry(0.096, 0.062, 0.105, 8),
    coreGeo: new THREE.BoxGeometry(0.115, 0.3, 0.055),
    flameGeo: new THREE.ConeGeometry(0.105, 0.46, 7, 1, true)
  };
  return jetRigAssets;
}

function jetCreateFlameMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color: color, transparent: true, opacity: opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
}

function jetBuildRig(assets, core, flameMat, name) {
  const rig = new THREE.Group();
  rig.name = name;

  for (const side of [-1, 1]) {
    const tank = new THREE.Mesh(assets.tankGeo, assets.shell);
    tank.position.set(side * 0.15, 0.02, 0);
    rig.add(tank);

    const cap = new THREE.Mesh(assets.capGeo, assets.trim);
    cap.position.set(side * 0.15, 0.245, 0);
    rig.add(cap);

    const nozzle = new THREE.Mesh(assets.nozzleGeo, assets.trim);
    nozzle.position.set(side * 0.15, -0.265, 0);
    rig.add(nozzle);
  }

  const coreMesh = new THREE.Mesh(assets.coreGeo, core);
  coreMesh.position.set(0, 0.04, 0.075);
  rig.add(coreMesh);

  const flameL = new THREE.Mesh(assets.flameGeo, flameMat);
  flameL.position.set(-0.15, -0.54, 0);
  flameL.rotation.x = Math.PI;
  flameL.visible = false;
  rig.add(flameL);

  const flameR = new THREE.Mesh(assets.flameGeo, flameMat);
  flameR.position.set(0.15, -0.54, 0);
  flameR.rotation.x = Math.PI;
  flameR.visible = false;
  rig.add(flameR);

  rig.visible = false;
  return { rig, coreMesh, flameL, flameR };
}

function jetEnsureRig() {
  if (jetState.rig) return jetState.rig;
  if (typeof THREE === 'undefined' || typeof scene === 'undefined' || !scene) return null;
  const assets = jetEnsureRigAssets();
  if (!assets) return null;
  const flameMat = jetCreateFlameMaterial(0x8fc8ff, 0.72);
  const built = jetBuildRig(assets, assets.core, flameMat, 'bcJetpack');
  const rig = built.rig;

  const light = new THREE.PointLight(0x5bb8ff, 0, 5, 2);
  light.position.set(0, -0.35, 0.12);
  rig.add(light);

  jetState.rig = rig;
  jetState.flameL = built.flameL;
  jetState.flameR = built.flameR;
  jetState.flameMat = flameMat;
  jetState.coreMat = assets.core;
  jetState.light = light;
  return rig;
}

function jetAttachTo(avatar) {
  // Local-only attachment. Remote avatars use their own createRemoteRig().
  if (!avatar || !avatar.userData || !avatar.userData.parts || !avatar.userData.parts.torso) return false;
  const rig = jetEnsureRig();
  if (!rig) return false;
  const torso = avatar.userData.parts.torso;
  if (rig.parent && rig.parent !== torso) rig.parent.remove(rig);
  if (rig.parent !== torso) torso.add(rig);
  rig.position.set(0, 0.30, 0.20);
  rig.rotation.set(0, 0, 0);
  rig.visible = jetState.active || jetState.sputter > 0;
  jetState.rigAvatar = avatar;
  return true;
}

function jetAttachCurrent() {
  if (typeof localAvatar === 'undefined' || !localAvatar) return false;
  if (localAvatar === jetState.rigAvatar && jetState.rig && jetState.rig.parent) return true;
  return jetAttachTo(localAvatar);
}

/* ---------------- remote rigs (visuals only; no fuel/control clock) ---------------- */
// Returns a dedicated torso-attached THREE.Group (or null); caller owns disposal.
function jetCreateRemoteRig(avatar) {
  if (!avatar || !avatar.userData || !avatar.userData.parts || !avatar.userData.parts.torso) return null;
  const assets = jetEnsureRigAssets();
  if (!assets) return null;
  const flameMat = jetCreateFlameMaterial(0x3585ff, 0);
  const built = jetBuildRig(assets, assets.remoteCoreBlue, flameMat, 'bcRemoteJetpack');
  const rig = built.rig;
  // Only this material and phase belong to the peer. Two small flame meshes,
  // no additional point light, streak pool, interval or retained avatar map.
  rig.userData.jetRemote = {
    flameL: built.flameL, flameR: built.flameR, coreMesh: built.coreMesh,
    flameMat, phase: Math.random() * Math.PI * 2, red: false
  };
  rig.position.set(0, 0.30, 0.20);
  avatar.userData.parts.torso.add(rig);
  jetRemoteRigCount++;
  return rig;
}

// Pass the actual remote record. blocked is the caller's death/rider gate;
// changing it never reparents a rig or changes another peer/local pack.
function jetUpdateRemoteRig(rig, remote, dt, blocked = false) {
  const owned = rig && rig.userData && rig.userData.jetRemote;
  if (!owned) return false;
  const show = !!remote && remote.hp > 0 && !!remote.fly && !blocked;
  const fuel = remote && Number.isFinite(remote.fuel) ? Math.max(0, Math.min(JET_MAX_FUEL, remote.fuel)) : JET_MAX_FUEL;
  const burning = show && fuel > 0;
  rig.visible = show;
  owned.flameL.visible = owned.flameR.visible = burning;
  const red = !!remote && (remote.team === 'red' || fuel <= 25);
  if (red !== owned.red) {
    owned.red = red;
    owned.flameMat.color.setHex(red ? 0xff3556 : 0x3585ff);
    owned.coreMesh.material = red ? jetRigAssets.remoteCoreRed : jetRigAssets.remoteCoreBlue;
  }
  if (!burning) {
    owned.flameMat.opacity = 0;
    return show;
  }

  const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
  owned.phase = (owned.phase + step * 28) % (Math.PI * 2);
  const pulse = 0.5 + Math.sin(owned.phase) * 0.5;
  const extra = remote.dash ? 1.45 : remote.boost ? 1.25 : 1;
  const fuelPower = 0.4 + Math.min(1, fuel / 25) * 0.6;
  const power = (0.76 + pulse * 0.4) * extra * fuelPower;
  const width = 0.84 + pulse * 0.16;
  owned.flameL.scale.set(width, power, width);
  owned.flameR.scale.set(width, power * 1.08, width);
  // Keep the flame mouths at the nozzle as boost/dash/low fuel change length.
  owned.flameL.position.y = -0.32 - 0.23 * power;
  owned.flameR.position.y = -0.32 - 0.23 * power * 1.08;
  owned.flameMat.opacity = (0.62 + pulse * 0.18) * fuelPower;
  return show;
}

function jetDisposeRemoteRig(rig) {
  const owned = rig && rig.userData && rig.userData.jetRemote;
  if (!owned) return false; // Also protects the singleton local rig.
  rig.visible = false;
  if (rig.parent) rig.parent.remove(rig);
  // Do not dispose any geometry, tank material or cached palette core.
  owned.flameMat.dispose();
  rig.clear();
  owned.flameMat = owned.flameL = owned.flameR = owned.coreMesh = null;
  delete rig.userData.jetRemote;
  jetRemoteRigCount--;
  return true;
}

/* ---------------- streaks ---------------- */
function jetEnsureStreaks() {
  if (jetState.streakMesh) return jetState.streakMesh;
  if (typeof THREE === 'undefined' || typeof scene === 'undefined' || !scene) return null;

  const positions = new Float32Array(JET_STREAK_MAX * 2 * 3);
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  geo.setDrawRange(0, 0);

  const mat = new THREE.LineBasicMaterial({
    color: 0x9ed0ff, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  mesh.visible = false;
  scene.add(mesh);

  const data = [];
  for (let i = 0; i < JET_STREAK_MAX; i++) {
    data.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: JET_STREAK_LIFE });
  }

  jetState.streakMesh = mesh;
  jetState.streakPositions = positions;
  jetState.streakData = data;
  return mesh;
}

function jetNozzleWorld(side, out) {
  if (jetState.rig && jetState.rig.parent) {
    out.set(side * JET_NOZZLE_X, -0.265, 0);
    return jetState.rig.localToWorld(out);
  }
  if (typeof player === 'undefined' || !player || !player.pos) return out.set(0, 0, 0);
  const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
  const lx = side * JET_NOZZLE_X, lz = JET_NOZZLE_Z;
  out.x = player.pos.x + lx * c + lz * s;
  out.y = player.pos.y + JET_NOZZLE_Y;
  out.z = player.pos.z - lx * s + lz * c;
  return out;
}

function jetSpawnStreak() {
  const data = jetState.streakData;
  if (!data) return;
  const p = data[jetState.streakIndex];
  jetState.streakIndex = (jetState.streakIndex + 1) % JET_STREAK_MAX;
  jetState.streakSide = jetState.streakSide ? 0 : 1;
  jetNozzleWorld(jetState.streakSide ? 1 : -1, jetVecA);
  p.x = jetVecA.x + (Math.random() - 0.5) * 0.06;
  p.y = jetVecA.y;
  p.z = jetVecA.z + (Math.random() - 0.5) * 0.06;
  p.vx = (Math.random() - 0.5) * 0.9;
  p.vy = -5.6 - Math.random() * 3.2;
  p.vz = (Math.random() - 0.5) * 0.9;
  p.life = JET_STREAK_LIFE;
  p.max = JET_STREAK_LIFE;
}

function jetUpdateStreaks(dt, spawning) {
  const mesh = jetState.streakMesh || (spawning ? jetEnsureStreaks() : null);
  if (!mesh) return;
  const data = jetState.streakData;
  const pos = jetState.streakPositions;

  if (spawning) {
    jetState.streakAccum += dt * JET_STREAK_RATE;
    let burst = 0;
    while (jetState.streakAccum >= 1 && burst < 4) {
      jetState.streakAccum -= 1;
      jetSpawnStreak();
      burst++;
    }
    if (jetState.streakAccum > 3) jetState.streakAccum = 3;
  } else {
    jetState.streakAccum = 0;
  }

  let write = 0;
  for (let i = 0; i < data.length; i++) {
    const p = data[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    const tail = 0.045;
    const base = write * 6;
    pos[base] = p.x;
    pos[base + 1] = p.y;
    pos[base + 2] = p.z;
    pos[base + 3] = p.x - p.vx * tail;
    pos[base + 4] = p.y - p.vy * tail;
    pos[base + 5] = p.z - p.vz * tail;
    write++;
  }

  if (write !== jetState.streakDrawn) {
    mesh.geometry.setDrawRange(0, write * 2);
    jetState.streakDrawn = write;
  }
  if (write > 0) mesh.geometry.attributes.position.needsUpdate = true;
  mesh.visible = write > 0;
}

/* ---------------- per-frame visuals ---------------- */
function jetUpdateVisuals(dt, playing) {
  jetAttachCurrent();
  const rig = jetState.rig;
  const active = jetState.active && playing;
  const sputter = jetState.sputter > 0 && playing;
  const show = active || sputter;

  if (rig) {
    rig.visible = show;
    if (show) {
      const extra = jetState.dashing ? 1.45 : jetState.boosting ? 1.25 : 1;
      const power = active ? (0.72 + Math.random() * 0.55) * extra : 0.2 + Math.random() * 0.45;
      if (jetState.flameL && jetState.flameR) {
        jetState.flameL.visible = true;
        jetState.flameR.visible = true;
        jetState.flameL.scale.set(0.82 + Math.random() * 0.32, power, 0.82 + Math.random() * 0.32);
        jetState.flameR.scale.set(0.82 + Math.random() * 0.32, power * 1.08, 0.82 + Math.random() * 0.32);
      }
      if (jetState.flameMat) jetState.flameMat.opacity = active ? 0.62 + Math.random() * 0.2 : 0.22 + Math.random() * 0.22;
      if (jetState.coreMat) jetState.coreMat.emissiveIntensity = active ? 1.7 + Math.random() * 1.1 : 0.65 + Math.random() * 0.7;
      if (jetState.light) jetState.light.intensity = active ? (1.4 + Math.random() * 0.9) * extra : 0.5 + Math.random() * 0.5;
    } else {
      jetSetFlames(false);
      if (jetState.flameMat) jetState.flameMat.opacity = 0;
      if (jetState.coreMat) jetState.coreMat.emissiveIntensity = 0.35;
    }
  }

  jetUpdateStreaks(dt, active);
}

function jetFovOwnedElsewhere() {
  const riding = BC.api && BC.api.riding;
  const killcam = BC.api && BC.api.killcam;
  return !!((typeof isScopeActive === 'function' && isScopeActive()) ||
    (riding && riding.active) || (killcam && killcam.active));
}

function jetRestoreFov() {
  if (jetState.fovTouched && typeof camera !== 'undefined' && camera && !jetFovOwnedElsewhere()) {
    if (Math.abs(camera.fov - JET_BASE_FOV) > 0.01) {
      camera.fov = JET_BASE_FOV;
      camera.updateProjectionMatrix();
    }
  }
  jetState.fovOffset = 0;
  jetState.fovTouched = false;
}

function jetApplyFov(dt) {
  if (typeof camera === 'undefined' || !camera) return;
  if (jetFovOwnedElsewhere()) {
    // Optics, saddles and kill cams own their projection; don't fight them.
    jetState.fovOffset = 0;
    jetState.fovTouched = false;
    return;
  }

  const reduced = typeof playerReducedMotion !== 'undefined' && playerReducedMotion && playerReducedMotion.matches;
  const target = jetState.active && jetState.playing && jetState.fuel > 0 && !reduced
    ? JET_FOV_KICK + (jetState.dashing ? 4 : jetState.boosting ? 3 : 0) : 0;
  const rate = target > jetState.fovOffset ? 8 : 5;
  jetState.fovOffset += (target - jetState.fovOffset) * (1 - Math.exp(-rate * Math.max(0, dt)));
  if (Math.abs(jetState.fovOffset) < 0.01) jetState.fovOffset = 0;

  if (jetState.fovOffset > 0.001) {
    const next = JET_BASE_FOV + jetState.fovOffset;
    if (Math.abs(camera.fov - next) > 0.01) {
      camera.fov = next;
      camera.updateProjectionMatrix();
      jetState.fovTouched = true;
    }
  } else if (jetState.fovTouched) {
    if (Math.abs(camera.fov - JET_BASE_FOV) > 0.01) {
      camera.fov = JET_BASE_FOV;
      camera.updateProjectionMatrix();
    }
    jetState.fovTouched = false;
  }
}

/* ---------------- lifecycle ---------------- */
function jetReset() {
  jetRestoreFov();
  jetClearControls(true);
  jetState.active = false;
  jetState.thrusting = false;
  jetState.fuel = JET_MAX_FUEL;
  jetState.groundTimer = 0;
  jetState.dashCooldown = jetState.launchCooldown = 0;
  jetState.sputter = 0;
  jetState.hintFlash = 0;
  jetState.streakAccum = 0;
  jetState.streakIndex = 0;
  if (typeof player !== 'undefined' && player) player.fly = false;
  if (jetState.streakData) {
    for (let i = 0; i < jetState.streakData.length; i++) jetState.streakData[i].life = 0;
  }
  if (jetState.streakMesh) {
    jetState.streakMesh.geometry.setDrawRange(0, 0);
    jetState.streakMesh.visible = false;
  }
  jetState.streakDrawn = 0;
  jetState.fovOffset = 0;
  jetState.fovTouched = false;
  jetSetFlames(false);
  jetAttachCurrent();
  jetUpdateHud(true);
}

function jetOnDeath() {
  jetCancelInput();
  jetUpdateHud(true);
}

function jetPreFrame(dt, now, playing) {
  const wasPlaying = jetState.playing;
  jetState.playing = playing !== false;
  const stamp = Number.isFinite(now) ? now : BC.now();
  const repeated = stamp === jetState.lastFrame;
  jetState.frameOwned = true;
  jetState.lastFrame = stamp;
  if (!jetState.playing || !jetCanFly()) {
    // Pausing turns the pack OFF rather than leaving a free hover waiting to
    // resume. Keep fuel/cooldowns, release held controls, and resume gravity.
    const riding = BC.api && BC.api.riding;
    if ((!jetState.playing && wasPlaying) || jetState.active || jetState.boosting || jetState.dashing) {
      // A rider owns the held movement keys. Cancel jet state on mount, but
      // don't keep swallowing that rider's Shift/Space on every frame.
      jetCancelInput(!(jetState.playing && riding && riding.active));
    }
    jetUpdateHud();
    return;
  }
  if (!repeated) jetAdvance(dt);
}

function jetPostPlayer(dt, now, playing) {
  const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
  jetUpdateVisuals(step, playing !== false && jetCanFly());
  jetApplyFov(step);
}

/* ---------------- public API ---------------- */
const jetpackApi = {
  get active() { return jetState.active; },
  get fuel() { return jetState.fuel; },
  get maxFuel() { return JET_MAX_FUEL; },
  get thrusting() { return jetState.thrusting; },
  get boosting() { return jetState.boosting; },
  get dashing() { return jetState.dashing; },
  get dashRemaining() { return jetState.dashTime; },
  get dashCooldown() { return jetState.dashCooldown; },
  get dashX() { return jetState.dashX; },
  get dashZ() { return jetState.dashZ; },
  get dashSpeed() { return JET_DASH_SPEED; },
  get boostSpeed() { return JET_BOOST_SPEED; },
  get ascendSpeed() { return jetState.boosting ? JET_BOOST_ASCEND : JET_ASCEND_SPEED; },
  get speedCap() { return JET_SPEED_CAP; },
  get isActive() { return jetState.active; },
  get remoteRigCount() { return jetRemoteRigCount; },
  toggle: jetToggle,
  update: jetUpdate,
  setActive: jetSetActive,
  canFly: jetCanFly,
  cancelDash: jetCancelDash,
  cancelInput: jetCancelInput,
  attachTo: jetAttachTo,
  createRemoteRig: jetCreateRemoteRig,
  updateRemoteRig: jetUpdateRemoteRig,
  disposeRemoteRig: jetDisposeRemoteRig
};

BC.api.jetpack = jetpackApi;
BC.flags.jetpackReady = true;

BC.on('preFrame', jetPreFrame, -10);
BC.on('postPlayer', jetPostPlayer, 0);
// postPlayer advances the FOV once. lateFrame only reapplies its current value.
BC.on('lateFrame', function () { jetApplyFov(0); }, 40);
BC.on('inputReset', jetCancelInput, 0);
BC.on('worldReady', function () { jetReset(); }, 0);
BC.on('worldReset', jetReset, 0);
BC.on('respawn', jetReset, 0);
BC.on('death', jetOnDeath, 0);
BC.on('modeChanged', function () {
  if (jetState.active && !jetCanFly()) jetForceLand('mode');
}, 0);
