/* Blockcraft Battle Ground — Mount a dragon, fly it for 30 s, breathe fire.
   46-riding.js
   Loads immediately after 45-dragons.js and before 50-player.js. Every later
   global (player, keys, gun, alive, updateCamera, ...) is resolved lazily from
   hooks, so this classic script never touches a binding that is not ready yet.

   Ownership:
   - 44/45 own shared dragon classes, rigs, saddle markers and solid bodies.
   - This file owns the mount state, steering, chase camera, breath, dismount.
   - Player physics must skip while BC.api.riding.active (22-physics contract).
   - Combat already refuses fireOnce() while riding; our capture handlers also
     keep the normal gun/build paths from ever seeing the click. */
'use strict';

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  var BC = window.BC;
  if (!BC || !BC.api || !BC.flags || typeof BC.on !== 'function' ||
      typeof BC.el !== 'function' || typeof BC.style !== 'function') return;
  var rideRules = window.BCDragonRules;
  if (!rideRules || typeof rideRules.count !== 'function' || typeof rideRules.isRideable !== 'function') return;
  if (BC.api.riding && BC.api.riding.moduleVersion === 2) return;

  var RIDE_SECONDS = 30;
  var MOUNT_RANGE = 7;
  var BREATH_RANGE = 18;           // authority applies 55 damage per valid tick
  var BREATH_INTERVAL = 0.18;      // seconds between held-fire breaths
  var BREATH_CONE_COS = Math.cos(32 * Math.PI / 180);
  var BREATH_MOUTH_OFFSET = 10;    // shared root-to-mouth authority limit
  var HEAT_SECONDS = 3.5;
  var HEAT_PER_BREATH = BREATH_INTERVAL / HEAT_SECONDS;
  var HEAT_COOL_RATE = 0.28;       // per second while the trigger is released
  var OVERHEAT_RESUME = 0.25;
  var CSS_ID = 'blockcraft-riding-css';
  var RIDE_SEND_INTERVAL = 100;   // ms; ride transforms at 10 Hz
  var GRANT_TIMEOUT = 3000;
  var FLAME_POOL_SIZE = 24;
  var LATE_PRIORITY = 30;         // ride 30, jetpack 40 (gated), killcam 100, audio 1000
  // A rotation-invariant envelope for the torso, neck/snout, tucked legs,
  // saddle and unscaled rider. Wings/tail never become a wingspan-wide body.
  var RIDE_CORE_RADIUS = 4.35;     // authored torso clearance before rider/snout
  var RIDE_CORE_BOTTOM = 5.3;      // jaw/snout clearance at maximum descent pitch
  var RIDE_BODY_REACH = 8.1;       // contains the solid neck/snout, never wings/tail
  var RIDE_RIDER_HALF = 2.9;       // unscaled seated rider through pitch/roll
  var RIDE_RIDER_TOP = 3.1;        // head/torso do not shrink with a small mount
  var RIDE_MOTION_STEP = 0.4;
  var RIDE_MAX_STEPS = 12;         // normal + Shift/Space fit without dropping motion
  var RIDE_WORLD_MARGIN = 8;
  var COLLISION_EPS = 0.0001;
  var CAMERA_HALF = 0.32;
  var CAMERA_SKIN = 0.035;
  var CAMERA_BOOM_MAX = 32;
  var CAMERA_SWEEP_STEP = 0.3;
  var CAMERA_MAX_STEPS = 107;      // ceil(32 / 0.3), bounded live-voxel probes

  var reducedMotion = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function prefersReducedMotion() {
    return !!(reducedMotion && reducedMotion.matches);
  }

  // Retain the old demo flag for compatibility only. Shared class eligibility
  // always wins: ?ride cannot make a guardian mountable.
  try {
    if (new URLSearchParams(window.location.search).has('ride')) BC.flags.forceRideable = true;
  } catch (e) { /* file:// or an older browser */ }

  /* ---------------- DOM + styles ---------------- */
  var CSS = [
    '#dragonRideHud{',
    '--dr-red:#ff3556;--dr-blue:#3585ff;--dr-ink:#0c1219;',
    'position:fixed;right:var(--bc-ride-right,12px);bottom:var(--bc-ride-bottom,16px);z-index:13;',
    'width:min(284px,calc(100vw - 24px));box-sizing:border-box;',
    'display:flex;flex-direction:column;gap:4px;padding:8px 12px;',
    'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
    'color:#eaf2fa;font-size:10px;line-height:1.4;font-variant-numeric:tabular-nums;',
    'pointer-events:none;user-select:none;background:rgba(12,18,25,.94);',
    'border:1px solid rgba(226,240,250,.2);border-radius:8px;',
    '}',
    '#dragonRideHud[hidden],#dragonRidePrompt[hidden]{display:none!important;}',
    '.dr-top{display:flex;align-items:center;gap:4px;min-height:16px;}',
    '.dr-dot{width:6px;height:6px;flex:0 0 auto;border-radius:50%;background:var(--dr-blue);}',
    '#dragonRideName{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;',
    'color:#eaf2fa;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.dr-spacer{flex:1 1 auto;}',
    '#dragonRideSpeed{font-size:9px;white-space:nowrap;color:#aebbc8;}',
    '#dragonRideTimer{font-size:15px;font-weight:800;letter-spacing:.04em;color:var(--dr-blue);',
    'font-variant-numeric:tabular-nums;min-width:58px;text-align:right;}',
    '#dragonRideTimer.low{color:var(--dr-red);}',
    '.dr-heat-row{display:flex;align-items:center;gap:8px;}',
    '.dr-heat-label{font-size:9px;font-weight:700;letter-spacing:.08em;color:#aebbc8;}',
    '.dr-heat{position:relative;flex:1 1 auto;height:7px;overflow:hidden;background:rgba(226,240,250,.12);',
    'border:1px solid rgba(226,240,250,.1);border-radius:2px;}',
    '#dragonRideHeatFill{display:block;width:0%;height:100%;',
    'background:var(--dr-blue);}',
    '#dragonRideHeatFill.hot{background:var(--dr-red);}',
    '#dragonRideHeatText{font-size:9px;font-weight:700;letter-spacing:.06em;color:#c9d5df;',
    'min-width:58px;text-align:right;}',
    '#dragonRideOverheat{font-size:9px;font-weight:700;letter-spacing:.04em;color:var(--dr-red);',
    'text-align:center;text-transform:uppercase;}',
    '.dr-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px;',
    'font-size:9px;color:#aebbc8;}',
    '.dr-foot b{color:#eaf2fa;font-weight:700;}',
    '#dragonRidePrompt{',
    'position:fixed;left:50%;top:58%;z-index:13;transform:translate(-50%,-50%);',
    'max-width:calc(100vw - 24px);box-sizing:border-box;',
    'display:inline-flex;align-items:center;gap:9px;padding:8px 13px 8px 9px;',
    'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
    'font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;',
    'color:#eaf2fa;pointer-events:none;user-select:none;',
    'background:rgba(12,18,25,.94);',
    'border:1px solid rgba(226,240,250,.2);border-radius:8px;',
    '}',
    '.dr-key{display:inline-grid;place-items:center;min-width:25px;height:23px;padding:0 7px;',
    'border-radius:3px;background:#eaf2fa;color:#081018;font-size:12px;font-weight:900;',
    'letter-spacing:0;box-shadow:0 2px 0 rgba(0,0,0,.4);}',
    '.dr-pname{color:#eaf2fa;font-weight:800;letter-spacing:.06em;min-width:0;overflow-wrap:anywhere;}',
    'body.riding #crosshair,body.riding #scopeOverlay,body.riding #weaponHud,',
    'body.riding #buildHud,body.riding #hotbar,body.riding #jetFuel{display:none!important;}',
    '#dragonRideOverheat[hidden]{display:none!important;}',
    '@media (max-width:560px){',
    '#dragonRideHud{bottom:var(--bc-ride-bottom,88px);width:min(280px,calc(100vw - 24px));}',
    '}'
  ].join('');

  try { BC.style(CSS_ID, CSS); } catch (e) { /* head is not ready in bare tests */ }

  var hud = null;
  var prompt = null;
  var nameEl = null;
  var timerEl = null;
  var speedEl = null;
  var heatFill = null;
  var heatText = null;
  var overheatEl = null;
  var promptName = null;

  function buildDom() {
    if (hud || !document.body) return;
    hud = document.getElementById('dragonRideHud');
    if (hud) {
      nameEl = document.getElementById('dragonRideName');
      timerEl = document.getElementById('dragonRideTimer');
      speedEl = document.getElementById('dragonRideSpeed');
      heatFill = document.getElementById('dragonRideHeatFill');
      heatText = document.getElementById('dragonRideHeatText');
      overheatEl = document.getElementById('dragonRideOverheat');
    } else {
      nameEl = BC.el('b', { id: 'dragonRideName', text: 'DRAGON' });
      speedEl = BC.el('span', { id: 'dragonRideSpeed', text: '0 km/h' });
      timerEl = BC.el('span', { id: 'dragonRideTimer', text: '30.0s' });
      hud = BC.el('div', {
        id: 'dragonRideHud', hidden: true, role: 'status',
        'aria-live': 'off',
        'aria-label': 'Dragon ride: WASD and mouse steer, Shift boosts, Space rises, C descends, left click breathes, E dismounts'
      }, [
        BC.el('div', { class: 'dr-top' }, [
          BC.el('span', { class: 'dr-dot' }),
          nameEl,
          BC.el('span', { class: 'dr-spacer' }),
          speedEl,
          timerEl
        ]),
        BC.el('div', { class: 'dr-heat-row' }, [
          BC.el('span', { class: 'dr-heat-label', text: 'BREATH' }),
          BC.el('div', { class: 'dr-heat' }, [
            heatFill = BC.el('i', { id: 'dragonRideHeatFill' })
          ]),
          heatText = BC.el('span', { id: 'dragonRideHeatText', text: 'READY' })
        ]),
        overheatEl = BC.el('div', { id: 'dragonRideOverheat', hidden: true,
          role: 'status', 'aria-live': 'polite', text: 'OVERHEATED \u00b7 RELEASE TO COOL' }),
        BC.el('div', { class: 'dr-foot' }, [
          BC.el('span', {}, [BC.el('b', { text: 'LMB' }), ' fire']),
          BC.el('span', {}, [BC.el('b', { text: 'SHIFT / SPACE / C' }), ' boost / rise / down']),
          BC.el('span', {}, [BC.el('b', { text: 'E' }), ' leave'])
        ])
      ]);
      document.body.appendChild(hud);
    }

    prompt = document.getElementById('dragonRidePrompt');
    if (prompt) { promptName = document.getElementById('dragonRidePromptName'); return; }
    promptName = BC.el('span', { id: 'dragonRidePromptName', class: 'dr-pname', text: 'DRAGON' });
    prompt = BC.el('div', {
      id: 'dragonRidePrompt', hidden: true, role: 'status', 'aria-live': 'polite'
    }, [
      BC.el('b', { class: 'dr-key', text: 'E' }),
      BC.el('span', { text: 'RIDE' }),
      promptName
    ]);
    document.body.appendChild(prompt);
  }

  if (document.body) buildDom();
  else window.addEventListener('DOMContentLoaded', buildDom);

  /* ---------------- state ---------------- */
  var API = BC.api.riding = {};
  API.moduleVersion = 2;
  API.active = false;
  API.pending = false;
  API.pendingDragon = null;
  API.dragon = null;
  API.remaining = 0;
  API.firing = false;
  API.heat = 0;
  API.overheated = false;
  API.speed = 0;
  // Stable, read-only-by-convention diagnostics. These are copies, not another
  // movement owner or a force-mount/test-control API. Boxes use physics' feet-Y
  // convention: x/z centre, y bottom, w half-width, h full height.
  var collision = API.collision = {
    ready: false, hitX: false, hitY: false, hitZ: false, substeps: 0,
    mouthOffsetLimit: BREATH_MOUTH_OFFSET,
    movedX: 0, movedY: 0, movedZ: 0,
    core: { x: 0, y: 0, z: 0, w: 0, h: 0, offsetY: 0, lowerHeight: 0, upperHeight: 0, clear: false },
    camera: { x: 0, y: 0, z: 0, w: CAMERA_HALF, h: CAMERA_HALF * 2,
      anchorX: 0, anchorY: 0, anchorZ: 0, requestedBoom: 0, boom: 0,
      blocked: false, clear: false, nearPlaneClear: false, rayProbes: 0, sweepSteps: 0 }
  };

  var R = {
    savedThird: true,
    savedFov: 74,
    savedVmRoot: null,
    savedVmVisible: false,
    avatar: null,
    avatarPose: null,
    heldKeys: Object.create(null),
    resettingInputs: false,
    eHeld: false,
    pendingUntilWall: 0,
    pendingUntilNow: 0,
    pendingSeed: 0,
    pendingSession: '',
    leaseUntilWall: 0,
    leaseUntilNow: 0,
    leaseToken: '',
    onlineLease: false,
    ownerId: '',
    sessionKey: '',
    lastRideSentAt: -Infinity,
    fireStartedAt: -Infinity,
    fireStartHeat: 0,
    lastHeatAt: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    cameraReady: false,
    lastFireAt: -Infinity,
    lastBreathVoiceAt: -Infinity,
    shake: 0,
    lastTimerTenth: -1,
    lastHeatPct: -1,
    lastPromptName: '',
    lastUpdateNow: -Infinity,
    lastRemoteNow: -Infinity,
    hitTargets: [],
    cameraPos: new THREE.Vector3(),
    cameraAnchor: new THREE.Vector3(),
    cameraWanted: new THREE.Vector3(),
    cameraSafeWanted: new THREE.Vector3(),
    cameraCandidate: new THREE.Vector3(),
    cameraBounded: new THREE.Vector3(),
    cameraDirection: new THREE.Vector3(),
    cameraRayOrigin: new THREE.Vector3(),
    cameraProbe: new THREE.Vector3(),
    cameraForward: new THREE.Vector3(),
    cameraRight: new THREE.Vector3(),
    cameraUp: new THREE.Vector3(),
    cameraHalf: CAMERA_HALF,
    cameraBox: { x: 0, y: 0, z: 0, w: CAMERA_HALF, h: CAMERA_HALF * 2, ignoreDragonIndex: -1 },
    cameraSweepBox: { x: 0, y: 0, z: 0, w: CAMERA_HALF, h: CAMERA_HALF * 2, ignoreDragonIndex: -1 },
    cameraSweepOut: { x: 0, y: 0, z: 0, hitX: false, hitY: false, hitZ: false },
    coreRadius: RIDE_CORE_RADIUS,
    coreBottom: RIDE_CORE_RADIUS,
    coreTop: RIDE_CORE_RADIUS,
    coreBox: { x: 0, y: 0, z: 0, w: RIDE_CORE_RADIUS, h: RIDE_CORE_RADIUS * 2, ignoreDragonIndex: -1 },
    standingBox: { x: 0, y: 0, z: 0, w: 0.3, h: 1.8 },
    dismountBox: { x: 0, y: 0, z: 0, w: 0.3, h: 1.8, ignoreDragonIndex: -1 },
    dismountSweep: { x: 0, y: 0, z: 0, hitX: false, hitY: false, hitZ: false },
    coreSweepOut: { x: 0, y: 0, z: 0, hitX: false, hitY: false, hitZ: false },
    motionTarget: new THREE.Vector3(),
    motionDelta: new THREE.Vector3(),
    lookTarget: new THREE.Vector3(),
    saddle: new THREE.Vector3(),
    mouth: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    upHint: new THREE.Vector3(0, 1, 0),
    point: new THREE.Vector3(),
    tmp: new THREE.Vector3(),
    avatarOffset: new THREE.Vector3(),
    savedPosition: new THREE.Vector3()
  };

  // One owner per seeded dragon. A state packet cannot extend or replace a
  // live lease; only an authority grant may change its owner/deadline.
  var leases = [];
  for (var slot = 0; slot < rideRules.guardianCount + rideRules.maxMounts; slot++) {
    leases.push({
      owner: '', dragon: null, token: '', retiredToken: '', untilWall: 0, untilNow: 0, confirmed: false,
      poseReady: false, target: new THREE.Vector3(), yaw: 0, pitch: 0,
      lastRx: -Infinity, lastBreath: -Infinity, breathUntil: 0,
      avatar: null, avatarPose: null
    });
  }

  var RIDE_KEYS = {
    KeyW: true, KeyA: true, KeyS: true, KeyD: true,
    Space: true, ShiftLeft: true, ShiftRight: true,
    KeyC: true
  };
  var BLOCKED_KEYS = {
    KeyB: true, ControlLeft: true, ControlRight: true, KeyF: true, KeyG: true, KeyQ: true,
    KeyR: true, KeyT: true, KeyV: true, KeyX: true, KeyZ: true
  };
  var DIGIT_KEY = /^(?:Digit|Numpad)[1-9]$/;

  /* ---------------- optional cosmetic particles ---------------- */
  var fxGroup = null;
  var fxGeometry = null;
  var fxMaterials = null;
  var fxLight = null;
  var fxLightLife = 0;
  var fxRecords = [];
  var fxCursor = 0;

  function initFx() {
    if (BC.flags.bootReady !== true || typeof scene === 'undefined' || typeof THREE === 'undefined') return;
    if (fxGroup) {
      if (fxGroup.parent !== scene) scene.add(fxGroup);
      return;
    }
    fxGeometry = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    fxMaterials = [
      new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: 0xff3556, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: 0xffd39a, toneMapped: false })
    ];
    fxGroup = new THREE.Group();
    fxGroup.name = 'dragon-breath-fx';
    for (var i = 0; i < FLAME_POOL_SIZE; i++) {
      var mesh = new THREE.Mesh(fxGeometry, fxMaterials[i % fxMaterials.length]);
      mesh.visible = false;
      fxGroup.add(mesh);
      fxRecords.push({ mesh: mesh, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
    }
    fxLight = new THREE.PointLight(0xff803c, 0, 12, 2);
    fxLight.name = 'dragon-breath-light';
    fxLight.castShadow = false;
    fxLight.visible = false;
    fxGroup.add(fxLight);
    scene.add(fxGroup);
  }

  function flashFxLight(position) {
    initFx();
    if (!fxLight || !finitePosition(position)) return;
    // One pooled, shadow-free light follows the closest simultaneous breath.
    if (fxLightLife > 0 && typeof camera !== 'undefined' &&
        camera.position.distanceToSquared(fxLight.position) < camera.position.distanceToSquared(position)) return;
    fxLight.position.copy(position);
    fxLightLife = 0.16;
    fxLight.intensity = 2.2;
    fxLight.visible = true;
  }

  function spawnFx(position, direction, count) {
    initFx();
    if (!fxGroup) return;
    for (var i = 0; i < count; i++) {
      var rec = null;
      for (var scan = 0; scan < fxRecords.length; scan++) {
        var at = (fxCursor + scan) % fxRecords.length;
        if (fxRecords[at].life <= 0) { rec = fxRecords[at]; fxCursor = (at + 1) % fxRecords.length; break; }
      }
      if (!rec) break;
      rec.life = rec.max = 0.3 + Math.random() * 0.34;
      rec.vx = direction.x * 24 + (Math.random() - 0.5) * 6;
      rec.vy = direction.y * 24 + Math.random() * 3 - 0.4;
      rec.vz = direction.z * 24 + (Math.random() - 0.5) * 6;
      rec.mesh.position.set(
        position.x + (Math.random() - 0.5) * 0.55,
        position.y + (Math.random() - 0.5) * 0.55,
        position.z + (Math.random() - 0.5) * 0.55
      );
      rec.mesh.scale.setScalar(0.55 + Math.random() * 1.35);
      rec.mesh.visible = true;
    }
  }

  function updateFx(dt) {
    if (!fxGroup || dt <= 0) return;
    if (fxLight && fxLightLife > 0) {
      fxLightLife = Math.max(0, fxLightLife - dt);
      fxLight.intensity = 2.2 * fxLightLife / 0.16;
      fxLight.visible = fxLightLife > 0;
    }
    for (var i = 0; i < fxRecords.length; i++) {
      var rec = fxRecords[i];
      if (rec.life <= 0) continue;
      rec.life -= dt;
      if (rec.life <= 0) { rec.mesh.visible = false; continue; }
      rec.vy += 3.1 * dt;
      rec.vx *= Math.max(0, 1 - 2.3 * dt);
      rec.vz *= Math.max(0, 1 - 2.3 * dt);
      rec.mesh.position.x += rec.vx * dt;
      rec.mesh.position.y += rec.vy * dt;
      rec.mesh.position.z += rec.vz * dt;
      rec.mesh.scale.setScalar(0.32 + rec.life * 2.1);
    }
  }

  function clearFx() {
    fxCursor = 0;
    fxLightLife = 0;
    if (fxLight) { fxLight.intensity = 0; fxLight.visible = false; }
    for (var i = 0; i < fxRecords.length; i++) {
      fxRecords[i].life = 0;
      fxRecords[i].mesh.visible = false;
    }
  }

  function disposeFx() {
    clearFx();
    if (fxGroup && fxGroup.parent) fxGroup.parent.remove(fxGroup);
    if (fxGeometry) fxGeometry.dispose();
    if (fxMaterials) for (var i = 0; i < fxMaterials.length; i++) fxMaterials[i].dispose();
    if (fxLight && typeof fxLight.dispose === 'function') fxLight.dispose();
    if (fxGroup) fxGroup.clear();
    fxRecords.length = 0;
    fxGroup = fxGeometry = fxMaterials = fxLight = null;
  }

  /* ---------------- helpers ---------------- */
  function worldBusy() {
    var world = BC.api.world;
    return !!(BC.flags.worldBusy || (world && world.busy));
  }

  function editable(target) {
    if (!target) return false;
    if (typeof isInputEditable === 'function') return isInputEditable(target);
    if (target.nodeType === 3) target = target.parentElement;
    return !!(target && (target.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || '') ||
      (target.closest && target.closest('[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))));
  }

  function gameReady(event) {
    if (BC.flags.bootReady !== true || worldBusy()) return false;
    if (typeof loading !== 'undefined' && loading) return false;
    if (typeof alive !== 'undefined' && !alive) return false;
    if (typeof craftOpen !== 'undefined' && craftOpen) return false;
    if (document.hidden) return false;
    var killcam = BC.api.killcam;
    if (killcam && killcam.active) return false;
    if (editable(document.activeElement) || editable(event && event.target)) return false;
    if (typeof isGameplayInputActive === 'function') return isGameplayInputActive(event);
    if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
    return typeof renderer !== 'undefined' && !!renderer &&
      document.pointerLockElement === renderer.domElement;
  }

  function worldSeed() {
    return typeof SEED !== 'undefined' && Number.isFinite(SEED) ? SEED >>> 0 : 0;
  }

  function netRef() {
    return typeof net !== 'undefined' && net ? net : null;
  }

  function online() {
    var n = netRef();
    return !!(n && n.online);
  }

  function localId() {
    var n = netRef();
    return n && typeof n.id === 'string' ? n.id : '';
  }

  function transportReady() {
    var n = netRef();
    if (!n || !n.online || typeof netSend !== 'function') return false;
    var sync = BC.api.net;
    if (sync && typeof sync.connected === 'boolean') return sync.connected;
    if (n.mode === 'ws') return !!(n.ws && n.ws.readyState === 1);
    return n.mode === 'mqtt' && typeof roomReady === 'function' && roomReady();
  }

  function mqttAuthority() {
    // The network owner elects/agrees the host. Never elect ourselves here:
    // independent client elections are exactly how competing riders arise.
    var sync = BC.api.net;
    var n = netRef();
    if ((sync && sync.authorityReady === false) || (n && n.authorityReady === false) ||
        BC.flags.roomAuthorityReady === false || (n && (n.configPending || n.configError))) return '';
    var authority = sync && sync.authority;
    if (authority && authority.agreed === true && typeof authority.id === 'string' &&
        /^[\w-]{1,40}$/.test(authority.id)) return authority.id;
    var agreed = (sync && sync.authorityReady === true) || (n && n.authorityReady === true) ||
      BC.flags.roomAuthorityReady === true;
    var id = (sync && (sync.authorityId || sync.hostId)) ||
      (n && (n.authorityId || n.hostId)) || BC.flags.roomHostId;
    // Legacy config-only builds can prove agreement with a settled generation.
    // An explicit not-ready value above always wins, including host elections.
    if (!agreed && n && n.mode === 'mqtt' && n.online && n.hostId === id &&
        typeof n.epoch === 'string' && n.epoch && Number.isSafeInteger(n.generation) && n.generation > 0 &&
        n.seed === worldSeed() && !n.configPending && !n.configError &&
        n.appliedVersion === n.configVersion) agreed = true;
    return agreed && typeof id === 'string' && /^[\w-]{1,40}$/.test(id) ? id : '';
  }

  function connectionKey() {
    var n = netRef();
    return n && n.online ? [n.mode, n.id, n.room || '', n.session || 0,
      n.generation || 0, n.epoch || '', worldSeed(),
      n.mode === 'mqtt' ? mqttAuthority() : 'server'].join(':') : 'solo:' + worldSeed();
  }

  function trustedPacket(msg) {
    var n = netRef();
    if (!msg || !n || !n.online) return false;
    if (n.mode === 'ws') return true; // LAN server owns validation/grants.
    var host = mqttAuthority();
    return n.mode === 'mqtt' && !!host && msg.id === host;
  }

  function packetIndex(msg) {
    var index = Number.isInteger(msg.dragon) ? msg.dragon : msg.index;
    return Number.isInteger(index) && index >= 0 && index < rideRules.count(worldSeed()) ? index : -1;
  }

  function packetOwner(msg) {
    var n = netRef();
    // MQTT's id is the publishing host, not the rider. Forwarded packets must
    // preserve the authenticated actor in riderId (also accepted on LAN).
    var id = msg.riderId || msg.rider || (n && n.mode === 'mqtt' ? '' : msg.id);
    return typeof id === 'string' && /^[\w-]{1,40}$/.test(id) ? id : '';
  }

  function packetLease(msg) {
    return typeof msg.lease === 'string' && /^[\w.:-]{1,96}$/.test(msg.lease) ? msg.lease : '';
  }

  function dragonAt(index) {
    if (typeof dragons === 'undefined') return null;
    var dragon = dragons[index];
    return dragon && dragon.index === index && dragon.group && dragon.group.parent === scene ? dragon : null;
  }

  function leaseLive(lease, wall, now) {
    return !!(lease && lease.owner && lease.confirmed && lease.dragon &&
      rideRules.isRideable(worldSeed(), lease.dragon.index) &&
      lease.dragon === dragonAt(lease.dragon.index) && wall < lease.untilWall && now < lease.untilNow);
  }

  function occupied(dragon) {
    if (BC.flags.bootReady !== true || worldBusy() || !dragon) return false;
    return leaseLive(leases[dragon.index], Date.now(), BC.now());
  }

  function remoteFiring(dragon) {
    var lease = dragon && leases[dragon.index];
    return !!(lease && occupied(dragon) && lease.owner !== R.ownerId && BC.now() < lease.breathUntil);
  }

  function clearLease(index) {
    var lease = leases[index];
    if (!lease) return;
    restoreAvatar(lease.avatar, lease.avatarPose);
    if (lease.dragon && lease.dragon.group) {
      lease.dragon.group.userData.ambient = true;
      delete lease.dragon.group.userData.riderId;
      if (typeof dragonResumeAmbient === 'function') dragonResumeAmbient(lease.dragon);
    }
    lease.owner = '';
    lease.dragon = null;
    if (lease.token) lease.retiredToken = lease.token;
    lease.token = '';
    lease.confirmed = lease.poseReady = false;
    lease.untilWall = lease.untilNow = lease.breathUntil = 0;
    lease.lastRx = lease.lastBreath = -Infinity;
    lease.avatar = lease.avatarPose = null;
  }

  function clearLeases(newWorld) {
    for (var i = 0; i < leases.length; i++) {
      clearLease(i);
      if (newWorld) leases[i].retiredToken = '';
    }
  }

  function consume(event) {
    if (!event) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  }

  function isRideable(dragon) {
    if (!dragon || !dragon.group || !rideRules.isRideable(worldSeed(), dragon.index) ||
        dragon.type === 'guardian' || dragon.group.userData && dragon.group.userData.guardian === true) return false;
    var modes = BC.api.modes;
    if (modes && modes.activeDef && modes.activeDef.locked) return false;
    return true;
  }

  function nearestDragon() {
    if (typeof dragons === 'undefined' || !dragons.length || typeof player === 'undefined') return null;
    var best = null;
    var bestDist = MOUNT_RANGE * MOUNT_RANGE;
    for (var i = 0; i < dragons.length; i++) {
      var dragon = dragons[i];
      if (!isRideable(dragon) || dragon.down || dragon.group.parent !== scene || dragon.routeReady === false || occupied(dragon)) continue;
      if (typeof dragon.saddlePos !== 'function') continue;
      dragon.saddlePos(R.saddle);
      var dx = R.saddle.x - player.pos.x;
      var dy = R.saddle.y - player.pos.y;
      var dz = R.saddle.z - player.pos.z;
      var dist = dx * dx + dy * dy + dz * dz;
      if (dist <= bestDist) { bestDist = dist; best = dragon; }
    }
    return best;
  }

  function emitSfx(kind, position, volume) {
    if (!position) return;
    try {
      BC.emit('sfx', {
        kind: kind,
        position: { x: position.x, y: position.y, z: position.z },
        volume: volume
      });
    } catch (e) { /* audio is optional */ }
  }

  function hidePrompt() {
    if (!prompt) return;
    if (!prompt.hidden) prompt.hidden = true;
    R.lastPromptName = '';
  }

  function updatePrompt() {
    if (!prompt) return;
    if (API.active || !gameReady()) { hidePrompt(); return; }
    var dragon = API.pending ? API.pendingDragon : nearestDragon();
    if (!dragon) { hidePrompt(); return; }
    var label = (dragon.group.userData && dragon.group.userData.palette) || 'Dragon';
    if (API.pending) label += ' \u00b7 WAITING FOR GRANT';
    if (R.lastPromptName !== label) {
      R.lastPromptName = label;
      if (promptName) promptName.textContent = label.toUpperCase();
    }
    prompt.hidden = false;
  }

  function updateHud(force) {
    if (!hud) return;
    var tenths = Math.max(0, Math.ceil(API.remaining * 10));
    if (force || tenths !== R.lastTimerTenth) {
      R.lastTimerTenth = tenths;
      if (timerEl) {
        timerEl.textContent = (tenths / 10).toFixed(1) + 's';
        timerEl.classList.toggle('low', tenths <= 50);
      }
    }
    var pct = Math.round(BC.clamp(API.heat, 0, 1) * 100);
    if (force || pct !== R.lastHeatPct) {
      R.lastHeatPct = pct;
      if (heatFill) {
        heatFill.style.width = pct + '%';
        heatFill.classList.toggle('hot', API.heat >= 0.72 || API.overheated);
      }
      if (heatText) heatText.textContent = API.overheated ? 'OVERHEAT' : (pct >= 72 ? 'HOT' : 'READY');
    }
    if (overheatEl) overheatEl.hidden = !API.overheated;
    var speed = Math.round(API.speed * 3.6);
    if (speedEl && (force || speed !== R.lastSpeed)) {
      R.lastSpeed = speed;
      speedEl.textContent = speed + ' km/h';
    }
  }

  /* ---------------- mount / dismount ---------------- */
  var LAND_OFFSETS = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, 3], [3, -3], [-3, -3]];

  function finitePosition(p) {
    return !!(p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
  }

  /* ---------------- live-voxel ride / camera collision ---------------- */
  function ridingPhysics() {
    var physics = BC.api.physics;
    return physics && typeof physics.sweepAabb === 'function' &&
      typeof physics.overlaps === 'function' ? physics : null;
  }

  function rideArena() {
    var modes = BC.api.modes;
    var arena = modes && modes.arena;
    return arena && arena.active ? arena : null;
  }

  function arenaLimit(arena, half) {
    return arena && Number.isFinite(arena.cx) && Number.isFinite(arena.cz) &&
      Number.isFinite(arena.radius) ? Math.max(0, arena.radius - 2.6 - half * Math.SQRT2) : Infinity;
  }

  function prepareRideBox(dragon) {
    var position = dragon && dragon.group && dragon.group.position;
    if (!finitePosition(position)) return false;
    var scale = dragon.group.scale;
    var size = scale && Number.isFinite(scale.x + scale.y + scale.z)
      ? Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)) : 1;
    if (!(size > 0)) return false;
    // Lower dragon-body clearance scales; rider headroom does not. The snout
    // still belongs to the solid body, unlike the broad cosmetic wings/tail.
    var lower = R.coreBottom = Math.max(RIDE_CORE_RADIUS, RIDE_CORE_BOTTOM) * size;
    var upper = R.coreTop = Math.max(lower, RIDE_RIDER_TOP);
    var radius = R.coreRadius = Math.max(lower, RIDE_BODY_REACH * size, RIDE_RIDER_HALF);
    var box = R.coreBox;
    box.x = position.x; box.y = position.y - lower; box.z = position.z;
    box.w = radius; box.h = lower + upper;
    box.ignoreDragonIndex = dragon.index;
    R.cameraBox.ignoreDragonIndex = R.cameraSweepBox.ignoreDragonIndex = dragon.index;
    return true;
  }

  function rideRootInBounds(position, half) {
    var margin = Math.max(RIDE_WORLD_MARGIN, half + COLLISION_EPS);
    if (!finitePosition(position) || position.x < margin - COLLISION_EPS || position.x > WORLD - margin + COLLISION_EPS ||
        position.z < margin - COLLISION_EPS || position.z > WORLD - margin + COLLISION_EPS || position.y < R.coreBottom ||
        position.y > Math.min(HEIGHT + 34, HEIGHT + 48 - R.coreTop - COLLISION_EPS) + COLLISION_EPS) return false;
    var arena = rideArena();
    if (!arena) return true;
    var limit = arenaLimit(arena, half);
    if (Number.isFinite(limit)) {
      var dx = position.x - arena.cx, dz = position.z - arena.cz;
      return dx * dx + dz * dz <= limit * limit + COLLISION_EPS;
    }
    if (typeof arena.contains !== 'function') return false;
    return arena.contains(position.x - half, position.z - half) &&
      arena.contains(position.x + half, position.z - half) &&
      arena.contains(position.x - half, position.z + half) &&
      arena.contains(position.x + half, position.z + half);
  }

  function clampRideTarget(position, half) {
    var margin = Math.max(RIDE_WORLD_MARGIN, half + COLLISION_EPS);
    position.x = BC.clamp(position.x, margin, WORLD - margin);
    position.z = BC.clamp(position.z, margin, WORLD - margin);
    position.y = BC.clamp(position.y, R.coreBottom + COLLISION_EPS,
      Math.min(HEIGHT + 34, HEIGHT + 48 - R.coreTop - COLLISION_EPS));
    var arena = rideArena();
    if (arena && typeof arena.clamp === 'function') arena.clamp(position, half * Math.SQRT2);
  }

  function rideAxisAmount(axis, amount) {
    var box = R.coreBox, half = R.coreRadius;
    if (axis === 'y') return BC.clamp(box.y + amount, COLLISION_EPS,
      Math.min(HEIGHT + 34 - R.coreBottom, HEIGHT + 48 - box.h - COLLISION_EPS)) - box.y;
    var margin = Math.max(RIDE_WORLD_MARGIN, half + COLLISION_EPS);
    var min = margin, max = WORLD - margin;
    var arena = rideArena();
    var limit = arenaLimit(arena, half);
    if (arena && Number.isFinite(limit)) {
      var other = axis === 'x' ? box.z - arena.cz : box.x - arena.cx;
      var edge = Math.sqrt(Math.max(0, limit * limit - other * other));
      var centre = axis === 'x' ? arena.cx : arena.cz;
      min = Math.max(min, centre - edge);
      max = Math.min(max, centre + edge);
    }
    return BC.clamp(box[axis] + amount, min, max) - box[axis];
  }

  function sweepRideAxis(physics, axis, amount) {
    var box = R.coreBox, out = R.coreSweepOut;
    var allowed = rideAxisAmount(axis, amount);
    physics.sweepAabb(box, axis === 'x' ? allowed : 0, axis === 'y' ? allowed : 0,
      axis === 'z' ? allowed : 0, out);
    box.x = out.x; box.y = out.y; box.z = out.z;
    var bounded = Math.abs(allowed - amount) > COLLISION_EPS;
    if (axis === 'x') collision.hitX = collision.hitX || out.hitX || bounded;
    else if (axis === 'y') collision.hitY = collision.hitY || out.hitY || bounded;
    else collision.hitZ = collision.hitZ || out.hitZ || bounded;
  }

  function syncCoreCollision(physics) {
    var box = R.coreBox, core = collision.core;
    core.x = box.x; core.y = box.y; core.z = box.z;
    core.w = box.w; core.h = box.h; core.offsetY = -R.coreBottom;
    core.lowerHeight = R.coreBottom; core.upperHeight = R.coreTop;
    core.clear = !!physics && !physics.overlaps(box);
  }

  function moveRiddenCore(dragon, physics) {
    if (!prepareRideBox(dragon)) return false;
    syncCoreCollision(physics);
    // A new block may enclose the body between frames. A sweep does not repair
    // an already overlapping start: reject it, rather than escaping through a
    // wall or carving the builder's cover. Dismount uses the existing safe exit.
    if (!collision.core.clear || !rideRootInBounds(dragon.group.position, R.coreRadius)) return false;
    var position = dragon.group.position;
    clampRideTarget(R.motionTarget, R.coreRadius);
    R.motionDelta.copy(R.motionTarget).sub(position);
    if (!finitePosition(R.motionDelta)) return false;
    var distance = R.motionDelta.length();
    var maxDistance = RIDE_MOTION_STEP * RIDE_MAX_STEPS;
    if (distance > maxDistance) { R.motionDelta.multiplyScalar(maxDistance / distance); distance = maxDistance; }
    var steps = collision.substeps = distance > 0 ? Math.min(RIDE_MAX_STEPS, Math.ceil(distance / RIDE_MOTION_STEP)) : 0;
    collision.hitX = collision.hitY = collision.hitZ = false;
    var dx = steps ? R.motionDelta.x / steps : 0;
    var dy = steps ? R.motionDelta.y / steps : 0;
    var dz = steps ? R.motionDelta.z / steps : 0;
    for (var step = 0; step < steps; step++) {
      // Independent axes retain rise/slide at a wall. Constrain each axis using
      // the current perpendicular coordinate, so a partial voxel hit cannot
      // push a diagonal move outside the arena's conservative inner circle.
      sweepRideAxis(physics, 'y', dy);
      sweepRideAxis(physics, 'x', dx);
      sweepRideAxis(physics, 'z', dz);
    }
    syncCoreCollision(physics);
    if (!collision.core.clear || !finitePosition(R.coreBox)) return false;
    R.motionTarget.set(R.coreBox.x, R.coreBox.y + R.coreBottom, R.coreBox.z);
    if (!rideRootInBounds(R.motionTarget, R.coreRadius)) return false;
    collision.movedX = R.coreBox.x - position.x;
    collision.movedY = R.coreBox.y + R.coreBottom - position.y;
    collision.movedZ = R.coreBox.z - position.z;
    position.copy(R.motionTarget);
    return true;
  }

  function cameraHalfExtent() {
    var near = Number.isFinite(camera.near) && camera.near > 0 ? camera.near : 0.08;
    var aspect = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 1;
    var fov = Number.isFinite(camera.fov) ? BC.clamp(camera.fov, 1, 150) : 74;
    var halfHeight = near * Math.tan(fov * Math.PI / 360);
    // Contains the whole near plane even after roll/shake, not just its centre.
    return Math.max(CAMERA_HALF, Math.hypot(near, halfHeight, halfHeight * aspect) + CAMERA_SKIN);
  }

  function setCameraBox(box, point) {
    box.x = point.x; box.y = point.y - R.cameraHalf; box.z = point.z;
    box.w = R.cameraHalf; box.h = R.cameraHalf * 2;
    box.ignoreDragonIndex = API.dragon ? API.dragon.index : -1;
  }

  function cameraPointClear(point, physics) {
    var half = R.cameraHalf;
    if (!finitePosition(point) || point.x < half + COLLISION_EPS || point.x > WORLD - half - COLLISION_EPS ||
        point.z < half + COLLISION_EPS || point.z > WORLD - half - COLLISION_EPS ||
        point.y < half + COLLISION_EPS || point.y > HEIGHT + 48 - half - COLLISION_EPS) return false;
    var arena = rideArena();
    if (arena && typeof arena.contains === 'function' &&
        (!arena.contains(point.x - half, point.z - half) || !arena.contains(point.x + half, point.z - half) ||
         !arena.contains(point.x - half, point.z + half) || !arena.contains(point.x + half, point.z + half))) return false;
    setCameraBox(R.cameraBox, point);
    return !physics.overlaps(R.cameraBox);
  }

  function traceRideCamera(anchor, wanted, out, physics) {
    var half = R.cameraHalf;
    var target = R.cameraBounded.copy(wanted);
    target.x = BC.clamp(target.x, half + COLLISION_EPS, WORLD - half - COLLISION_EPS);
    target.z = BC.clamp(target.z, half + COLLISION_EPS, WORLD - half - COLLISION_EPS);
    target.y = BC.clamp(target.y, half + COLLISION_EPS, HEIGHT + 48 - half - COLLISION_EPS);
    var arena = rideArena();
    if (arena && typeof arena.clamp === 'function') arena.clamp(target, half * Math.SQRT2);
    if (target.x !== wanted.x || target.y !== wanted.y || target.z !== wanted.z) collision.camera.blocked = true;
    var direction = R.cameraDirection.copy(target).sub(anchor);
    var length = direction.length();
    if (!Number.isFinite(length)) { out.copy(anchor); collision.camera.blocked = true; return; }
    if (length < COLLISION_EPS) { out.copy(anchor); return; }
    direction.multiplyScalar(1 / length);
    var requested = length;
    length = Math.min(length, CAMERA_BOOM_MAX);
    // Centre + eight parallel corner rays keep built cover between the saddle
    // and eye from being bypassed. The box sweeps below also catch edge grazes
    // and larger near-plane clearance volumes without scanning the world.
    var dragonBodies = BC.api.dragons;
    if (typeof raycastVoxel === 'function' || dragonBodies && typeof dragonBodies.raycast === 'function') {
      for (var ray = 0; ray < 9; ray++) {
        R.cameraRayOrigin.copy(anchor);
        if (ray) {
          var corner = ray - 1;
          R.cameraRayOrigin.x += (corner & 1 ? 1 : -1) * half;
          R.cameraRayOrigin.y += (corner & 2 ? 1 : -1) * half;
          R.cameraRayOrigin.z += (corner & 4 ? 1 : -1) * half;
        }
        var hit = typeof raycastVoxel === 'function' ? raycastVoxel(length, R.cameraRayOrigin, direction) : null;
        collision.camera.rayProbes++;
        if (hit && Number.isFinite(hit.dist)) length = Math.min(length, Math.max(0, hit.dist - CAMERA_SKIN));
        if (dragonBodies && typeof dragonBodies.raycast === 'function') {
          var bodyHit = dragonBodies.raycast(R.cameraRayOrigin, direction, length, API.dragon ? API.dragon.index : -1);
          if (bodyHit && Number.isFinite(bodyHit.distance)) length = Math.min(length, Math.max(0, bodyHit.distance - CAMERA_SKIN));
        }
      }
    }
    var steps = Math.max(1, Math.min(CAMERA_MAX_STEPS, Math.ceil(length / CAMERA_SWEEP_STEP)));
    var stride = length / steps, travelled = 0;
    setCameraBox(R.cameraSweepBox, anchor);
    for (var step = 0; step < steps && stride > 0; step++) {
      var result = R.cameraSweepOut;
      physics.sweepAabb(R.cameraSweepBox, direction.x * stride, direction.y * stride, direction.z * stride, result);
      collision.camera.sweepSteps++;
      R.cameraProbe.copy(anchor).addScaledVector(direction, travelled + stride);
      if (result.hitX || result.hitY || result.hitZ || !cameraPointClear(R.cameraProbe, physics)) {
        var lo = 0, hi = stride;
        for (var refine = 0; refine < 6; refine++) {
          var mid = (lo + hi) * 0.5;
          physics.sweepAabb(R.cameraSweepBox, direction.x * mid, direction.y * mid, direction.z * mid, result);
          R.cameraProbe.copy(anchor).addScaledVector(direction, travelled + mid);
          if (result.hitX || result.hitY || result.hitZ || !cameraPointClear(R.cameraProbe, physics)) hi = mid;
          else lo = mid;
        }
        travelled += Math.max(0, lo - CAMERA_SKIN);
        collision.camera.blocked = true;
        break;
      }
      travelled += stride;
      setCameraBox(R.cameraSweepBox, R.cameraProbe);
    }
    if (travelled + COLLISION_EPS < requested) collision.camera.blocked = true;
    out.copy(anchor).addScaledVector(direction, travelled);
  }

  function rideNearPlaneClear(physics) {
    var near = Number.isFinite(camera.near) && camera.near > 0 ? camera.near : 0.08;
    var aspect = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 1;
    var halfHeight = near * Math.tan(BC.clamp(camera.fov, 1, 150) * Math.PI / 360);
    var halfWidth = halfHeight * aspect;
    R.cameraForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    R.cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    R.cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    for (var probe = 0; probe < 9; probe++) {
      R.cameraProbe.copy(camera.position).addScaledVector(R.cameraForward, near)
        .addScaledVector(R.cameraRight, ((probe % 3) - 1) * halfWidth)
        .addScaledVector(R.cameraUp, (Math.floor(probe / 3) - 1) * halfHeight);
      if (typeof physics.solidAt === 'function' && physics.solidAt(Math.floor(R.cameraProbe.x),
          Math.floor(R.cameraProbe.y), Math.floor(R.cameraProbe.z))) return false;
    }
    return true;
  }

  function standingClear(x, y, z) {
    if (typeof getBlock !== 'function' || !Number.isFinite(x + y + z)) return false;
    var half = typeof PW === 'number' ? PW : 0.3;
    var height = typeof PH === 'number' ? PH : 1.8;
    for (var bx = Math.floor(x - half + 0.00001); bx <= Math.floor(x + half - 0.00001); bx++) {
      for (var by = Math.floor(y + 0.00001); by <= Math.floor(y + height - 0.00001); by++) {
        for (var bz = Math.floor(z - half + 0.00001); bz <= Math.floor(z + half - 0.00001); bz++) {
          if (getBlock(bx, by, bz) !== AIR) return false;
        }
      }
    }
    var physics = BC.api.physics;
    if (physics && typeof physics.overlaps === 'function') {
      R.standingBox.x = x; R.standingBox.y = y; R.standingBox.z = z;
      R.standingBox.w = half; R.standingBox.h = height;
      if (physics.overlaps(R.standingBox)) return false;
    }
    return true;
  }

  function inArena(x, z) {
    var modes = BC.api.modes;
    var arena = modes && modes.arena;
    return !arena || !arena.active || typeof arena.contains !== 'function' || arena.contains(x, z);
  }

  var DISMOUNT_DIRECTIONS = [[1, 0], [-1, 0], [0, -1], [0, 1], [0.707, -0.707], [-0.707, -0.707], [0.707, 0.707], [-0.707, 0.707]];
  var DISMOUNT_RADII = [0.9, 1.4, 2.2, 3.2, 4.8, 6.4];
  function airDismountSpot(from, dragon) {
    if (!finitePosition(from)) return null;
    var physics = BC.api.physics;
    var rightX = Math.cos(R.yaw), rightZ = -Math.sin(R.yaw);
    var forwardX = -Math.sin(R.yaw), forwardZ = -Math.cos(R.yaw);
    // A small sideways seat exit at the CURRENT height. Never search a ground
    // column or send the player back to their pre-ride position. The final body
    // must clear every dragon; only the sweep out of its own saddle ignores it.
    for (var lift = 0; lift < 3; lift++) {
      var dy = lift === 0 ? 0.06 : lift === 1 ? 0.4 : 0.8;
      for (var radius = 0; radius < DISMOUNT_RADII.length; radius++) {
        for (var i = 0; i < DISMOUNT_DIRECTIONS.length; i++) {
          var dir = DISMOUNT_DIRECTIONS[i], r = DISMOUNT_RADII[radius];
          var dx = (rightX * dir[0] + forwardX * dir[1]) * r;
          var dz = (rightZ * dir[0] + forwardZ * dir[1]) * r;
          var x = from.x + dx, y = from.y + dy, z = from.z + dz;
          if (x < 1 || z < 1 || x > WORLD - 1 || z > WORLD - 1 || !inArena(x, z) || !standingClear(x, y, z)) continue;
          if (physics && typeof physics.sweepAabb === 'function') {
            var box = R.dismountBox;
            box.x = from.x; box.y = from.y; box.z = from.z;
            box.w = typeof PW === 'number' ? PW : 0.3;
            box.h = typeof PH === 'number' ? PH : 1.8;
            box.ignoreDragonIndex = dragon ? dragon.index : -1;
            var moved = physics.sweepAabb(box, dx, dy, dz, R.dismountSweep);
            if (!moved || moved.hitX || moved.hitY || moved.hitZ ||
                Math.abs(moved.x - x) + Math.abs(moved.y - y) + Math.abs(moved.z - z) > 0.01) continue;
          }
          return { x: x, y: y, z: z, sideX: dx / r, sideZ: dz / r };
        }
      }
    }
    return null;
  }

  function safeSpawn() {
    var modes = BC.api.modes;
    var spawn = null;
    if (modes && typeof modes.respawnPoint === 'function') {
      try { spawn = modes.respawnPoint(modes.localTeam); } catch (e) { /* optional mode */ }
    }
    if (finitePosition(spawn) && inArena(spawn.x, spawn.z) && standingClear(spawn.x, spawn.y, spawn.z)) return spawn;
    if (typeof findSpawn === 'function') {
      try { spawn = findSpawn(); } catch (e) { spawn = null; }
    }
    return finitePosition(spawn) && inArena(spawn.x, spawn.z) && standingClear(spawn.x, spawn.y, spawn.z) ? spawn : null;
  }

  function stopJetpack() {
    var jet = BC.api.jetpack;
    if (!jet || !jet.active) return true;
    try {
      if (typeof jet.setActive === 'function') jet.setActive(false);
      else if (typeof jet.toggle === 'function') jet.toggle();
    } catch (e) { return false; }
    // Never refill fuel or restore unmetered player.fly on dismount.
    return !jet.active;
  }

  function releaseRideInputs() {
    API.firing = false;
    R.fireStartedAt = -Infinity;
    for (var code in R.heldKeys) R.heldKeys[code] = false;
    R.resettingInputs = true;
    try {
      if (typeof resetGameplayInput === 'function') resetGameplayInput(false);
      else {
        if (typeof keys !== 'undefined') for (var key in RIDE_KEYS) keys[key] = false;
        if (typeof resetBuildingInput === 'function') resetBuildingInput();
        if (typeof resetPlayerMotion === 'function') resetPlayerMotion();
      }
    } finally { R.resettingInputs = false; }
    if (typeof gun !== 'undefined' && gun) {
      gun.trigger = gun.aiming = false;
      gun.firePose = gun.kick = 0;
    }
    if (typeof cancelReload === 'function') cancelReload(false);
    if (typeof jumpQueued !== 'undefined') jumpQueued = false;
  }

  function saveAvatar(avatar) {
    if (!avatar) return null;
    var data = avatar.userData || {};
    var parts = data.parts || {};
    var saved = { visible: avatar.visible, rotation: avatar.rotation.clone(),
      gun: data.gun || null, gunVisible: data.gun ? data.gun.visible : false, nodes: [] };
    var names = ['legL', 'legR', 'armL', 'armR', 'torso', 'head'];
    for (var i = 0; i < names.length; i++) {
      var part = parts[names[i]];
      if (part) saved.nodes.push({ part: part, position: part.position.clone(), rotation: part.rotation.clone() });
    }
    return saved;
  }

  function restoreAvatar(avatar, saved) {
    if (!avatar || !saved) return;
    avatar.rotation.copy(saved.rotation);
    avatar.visible = saved.visible;
    if (saved.gun) saved.gun.visible = saved.gunVisible;
    for (var i = 0; i < saved.nodes.length; i++) {
      var node = saved.nodes[i];
      node.part.position.copy(node.position);
      node.part.rotation.copy(node.rotation);
    }
  }

  function seatAvatar(avatar, dragon, saved) {
    if (!avatar || !dragon || !saved) return;
    dragon.saddlePos(R.saddle);
    R.avatarOffset.set(0, -0.64, 0).applyQuaternion(dragon.group.quaternion);
    avatar.position.copy(R.saddle).add(R.avatarOffset);
    avatar.quaternion.copy(dragon.group.quaternion);
    avatar.visible = true;
    var parts = avatar.userData && avatar.userData.parts;
    if (avatar.userData && avatar.userData.gun) avatar.userData.gun.visible = false;
    for (var i = 0; i < saved.nodes.length; i++) saved.nodes[i].part.position.copy(saved.nodes[i].position);
    if (!parts) return;
    if (parts.legL) parts.legL.rotation.set(-1.12, 0, -0.24);
    if (parts.legR) parts.legR.rotation.set(-1.12, 0, 0.24);
    if (parts.armL) parts.armL.rotation.set(-0.75, -0.08, -0.12);
    if (parts.armR) parts.armR.rotation.set(-0.75, 0.08, 0.12);
    if (parts.torso) parts.torso.rotation.set(0.10, 0, 0);
    if (parts.head) parts.head.rotation.set(0.08, 0, 0);
    // The mount can start from a crouch/slide. Use authored seated anchors,
    // not the last frame's lowered head and hips; preserve them only for exit.
    if (parts.legL) { parts.legL.position.y = 0.72; parts.legL.position.z = 0; }
    if (parts.legR) { parts.legR.position.y = 0.72; parts.legR.position.z = 0; }
    if (parts.armL) { parts.armL.position.y = 1.3; parts.armL.position.z = 0; }
    if (parts.armR) { parts.armR.position.y = 1.3; parts.armR.position.z = 0; }
    if (parts.torso) { parts.torso.position.y = 0.72; parts.torso.position.z = 0; }
    if (parts.head) { parts.head.position.y = 1.34; parts.head.position.z = 0; }
    // Null only clears the new knee/ankle/shoe joints; a full standing stance
    // here would overwrite the seated hips, saddle root and upper-body anchors.
    if (typeof poseHumanoidStance === 'function') poseHumanoidStance(avatar, null, 0);
  }

  function sendRide(dragon, active, force, now) {
    if (!dragon || !online() || !transportReady()) return false;
    now = Number.isFinite(now) ? now : BC.now();
    if (!force && now - R.lastRideSentAt < RIDE_SEND_INTERVAL) return false;
    var p = dragon.group.position;
    if (!finitePosition(p)) return false;
    try {
      var packet = { t: 'ride', active: !!active, dragon: dragon.index,
        x: p.x, y: p.y, z: p.z,
        yaw: dragon.group.rotation.y, pitch: dragon.group.rotation.x };
      var lease = leases[dragon.index];
      if (lease && lease.owner === localId() && lease.token) packet.lease = lease.token;
      if (netSend(packet) === false) return false;
      R.lastRideSentAt = now;
      return true;
    } catch (e) { return false; }
  }

  function cancelPending(send) {
    var dragon = API.pendingDragon;
    var session = R.pendingSession;
    API.pending = false;
    API.pendingDragon = null;
    R.pendingUntilWall = R.pendingUntilNow = 0;
    R.pendingSession = '';
    if (send && dragon && session === connectionKey()) sendRide(dragon, false, true);
    hidePrompt();
    return !!dragon;
  }

  function nearby(dragon) {
    if (!dragon || typeof dragon.saddlePos !== 'function' || typeof player === 'undefined') return false;
    dragon.saddlePos(R.saddle);
    return finitePosition(R.saddle) && R.saddle.distanceToSquared(player.pos) <= MOUNT_RANGE * MOUNT_RANGE;
  }

  function mountDragon(dragon, duration, networkLease, token) {
    if (!dragon || API.active || !gameReady() || !isRideable(dragon) || !nearby(dragon)) return false;
    var wall = Date.now(), now = BC.now();
    duration = Number.isFinite(duration) ? BC.clamp(duration, 0, RIDE_SECONDS * 1000) : RIDE_SECONDS * 1000;
    if (duration <= 0 || (networkLease && !token)) return false;
    var lease = leases[dragon.index];
    if (leaseLive(lease, wall, now) && lease.owner !== (networkLease ? localId() : 'solo')) return false;
    var physics = ridingPhysics();
    if (!physics || !prepareRideBox(dragon)) return false;
    syncCoreCollision(physics);
    if (!collision.core.clear || !rideRootInBounds(dragon.group.position, R.coreRadius)) return false;
    if (!stopJetpack()) return false;
    R.savedThird = typeof thirdPerson !== 'undefined' ? !!thirdPerson : true;
    R.savedFov = typeof camera !== 'undefined' && Number.isFinite(camera.fov) &&
      !(typeof gun !== 'undefined' && gun && gun.aiming) ? camera.fov : 74;
    R.savedVmRoot = typeof vmRoot !== 'undefined' && vmRoot ? vmRoot : null;
    R.savedVmVisible = !!(R.savedVmRoot && R.savedVmRoot.visible);
    R.savedPosition.copy(player.pos);
    releaseRideInputs();
    if (typeof cancelQuickBuild === 'function') cancelQuickBuild();
    if (!dragon.saddle && typeof dragonAttachSaddle === 'function') dragonAttachSaddle(dragon);

    R.leaseUntilWall = networkLease ? Math.min(lease.untilWall, wall + duration) : wall + duration;
    R.leaseUntilNow = networkLease ? Math.min(lease.untilNow, now + duration) : now + duration;
    R.leaseToken = networkLease ? token : '';
    R.onlineLease = !!networkLease;
    R.ownerId = networkLease ? localId() : 'solo';
    R.sessionKey = connectionKey();
    API.active = true;
    collision.ready = true;
    collision.hitX = collision.hitY = collision.hitZ = false;
    collision.substeps = 0;
    collision.movedX = collision.movedY = collision.movedZ = 0;
    API.dragon = dragon;
    API.remaining = duration / 1000;
    API.firing = false;
    API.heat = 0;
    API.overheated = false;
    API.speed = 16;
    R.yaw = Number.isFinite(dragon.group.rotation.y) ? dragon.group.rotation.y : player.yaw;
    R.pitch = BC.clamp(Number.isFinite(dragon.group.rotation.x) ? dragon.group.rotation.x : 0, -0.35, 0.35);
    R.roll = 0;
    R.cameraReady = false;
    R.lastFireAt = -Infinity;
    R.lastHeatAt = now;
    R.shake = 0;
    R.lastTimerTenth = -1;
    R.lastHeatPct = -1;
    R.hitTargets.length = 0;
    lease.owner = R.ownerId;
    lease.dragon = dragon;
    lease.token = R.leaseToken;
    lease.confirmed = true;
    lease.untilWall = R.leaseUntilWall;
    lease.untilNow = R.leaseUntilNow;
    lease.poseReady = false;
    dragon.group.userData.ambient = false;
    dragon.group.userData.riderId = R.ownerId;

    player.fly = false;
    player.vel.set(0, 0, 0);
    player.onGround = false;
    player.sprinting = player.crouching = player.sliding = false;
    if (typeof dragon.saddlePos === 'function') {
      dragon.saddlePos(R.saddle);
      player.pos.copy(R.saddle);
    }
    player.yaw = R.yaw;
    player.pitch = R.pitch;

    if (document.body) document.body.classList.add('riding');
    if (hud) hud.hidden = false;
    hidePrompt();
    updateHud(true);
    if (typeof vmRoot !== 'undefined' && vmRoot) vmRoot.visible = false;
    R.avatar = typeof localAvatar !== 'undefined' ? localAvatar : null;
    R.avatarPose = saveAvatar(R.avatar);
    seatAvatar(R.avatar, dragon, R.avatarPose);
    if (typeof dragonSyncCollider === 'function') dragonSyncCollider(dragon);

    var name = (dragon.group.userData && dragon.group.userData.palette) || 'Dragon';
    if (nameEl) nameEl.textContent = name.toUpperCase();
    if (typeof toast === 'function') toast(name + ' \u00b7 30 seconds of fire');
    dragon.mouthPos(R.mouth);
    emitSfx('dragonRoar', R.mouth, 0.7);
    sendRide(dragon, true, true, now);
    return true;
  }

  function mountNearest() {
    if (API.active || API.pending || !gameReady()) return false;
    var dragon = nearestDragon();
    if (!dragon) return false;
    if (!online()) return mountDragon(dragon, RIDE_SECONDS * 1000, false);
    var n = netRef();
    if (!localId() || !transportReady() || (n.mode === 'mqtt' && !mqttAuthority())) {
      if (typeof toast === 'function') toast('Dragon lease authority unavailable');
      return false;
    }
    API.pending = true;
    API.pendingDragon = dragon;
    R.pendingUntilWall = Date.now() + GRANT_TIMEOUT;
    R.pendingUntilNow = BC.now() + GRANT_TIMEOUT;
    R.pendingSeed = worldSeed();
    R.pendingSession = connectionKey();
    if (!sendRide(dragon, true, true)) { cancelPending(false); return false; }
    updatePrompt();
    return true; // request accepted locally; active remains false until grant
  }

  function dismount(reason) {
    if (!API.active) return cancelPending(true);
    reason = String(reason || 'manual');
    var dragon = API.dragon;
    var at = (typeof player !== 'undefined' && player.pos) ? R.point.copy(player.pos) : null;
    var exitSpeed = Math.min(8, Math.max(0, API.speed));
    if (R.onlineLease && connectionKey() === R.sessionKey) sendRide(dragon, false, true);

    API.active = false;
    collision.ready = false;
    API.dragon = null;
    API.remaining = 0;
    API.firing = false;
    API.heat = 0;
    API.overheated = false;
    API.speed = 0;
    R.leaseUntilWall = R.leaseUntilNow = 0;
    R.leaseToken = '';
    R.onlineLease = false;
    R.ownerId = '';
    R.sessionKey = '';
    cancelPending(false);
    releaseRideInputs();
    stopJetpack();
    if (dragon) clearLease(dragon.index);
    restoreAvatar(R.avatar, R.avatarPose);
    R.avatar = R.avatarPose = null;

    if (document.body) document.body.classList.remove('riding');
    if (hud) hud.hidden = true;
    hidePrompt();
    R.cameraReady = false;
    R.shake = 0;

    var killcam = BC.api.killcam;
    if (typeof camera !== 'undefined' && camera && !(killcam && killcam.active)) {
      camera.fov = R.savedFov;
      camera.updateProjectionMatrix();
    }

    // A lifecycle reset/respawn owns its own spawn. Never move the corpse or
    // overwrite a freshly regenerated spawn with the retired saddle position.
    var relocate = reason !== 'reset' && reason !== 'busy' && reason !== 'death' && reason !== 'respawn';
    var safe = relocate ? airDismountSpot(at, dragon) : null;
    if (safe && typeof player !== 'undefined') {
      player.pos.set(safe.x, safe.y, safe.z);
    }
    if (typeof localAvatar !== 'undefined' && localAvatar && typeof player !== 'undefined') {
      localAvatar.position.copy(player.pos);
    }

    if (typeof player !== 'undefined') {
      player.vel.set(0, 0, 0);
      if (relocate) {
        player.vel.x = -Math.sin(R.yaw) * exitSpeed + (safe ? safe.sideX * 4 : 0);
        player.vel.z = -Math.cos(R.yaw) * exitSpeed + (safe ? safe.sideZ * 4 : 0);
        player.vel.y = Math.min(0, Math.sin(R.pitch) * exitSpeed);
        if (typeof playerCapHorizontal === 'function') playerCapHorizontal(12);
        if (typeof playerMotion !== 'undefined') playerMotion.airCarry = Math.hypot(player.vel.x, player.vel.z);
      }
      player.fly = false;
      player.onGround = false;
      player.yaw = R.yaw;
      player.pitch = BC.clamp(R.pitch * 0.55, -1.45, 1.45);
      player.sprinting = player.sliding = player.swimming = false;
      if (typeof playerSetLowStance === 'function') playerSetLowStance(false);
      else player.crouching = false;
    }

    if (typeof vmRoot !== 'undefined' && vmRoot) {
      vmRoot.visible = !(killcam && killcam.active) && reason !== 'death' &&
        vmRoot === R.savedVmRoot && R.savedVmVisible;
    }
    R.savedVmRoot = null;
    if (relocate && !worldBusy() && !(killcam && killcam.active)) {
      if (typeof updateCamera === 'function') updateCamera(0);
      if (typeof updateGunVisual === 'function') updateGunVisual(0);
    }
    if (dragon && typeof dragon.mouthPos === 'function') {
      dragon.mouthPos(R.mouth);
      emitSfx('dragonRoar', R.mouth, 0.45);
    } else if (at) emitSfx('dragonRoar', at, 0.45);

    if (reason === 'time' || reason === 'key' || reason === 'manual') {
      if (typeof toast === 'function') {
        var jet = BC.api.jetpack;
        toast(jet && jet.fuel > 3 ? 'Dismounted \u00b7 falling \u00b7 F for jetpack' : 'Dismounted \u00b7 falling');
      }
    }
    if (dragon && dragon.tag) dragon.tag.visible = true;

    R.lastPromptName = '';
    return true;
  }

  /* ---------------- fire breath ---------------- */
  function leaseRemaining(now) {
    return Math.max(0, Math.min(R.leaseUntilWall - Date.now(), R.leaseUntilNow - now)) / 1000;
  }

  function rideConnected() {
    return R.onlineLease ? online() && transportReady() && connectionKey() === R.sessionKey : !online();
  }

  function overheat() {
    if (API.overheated) return;
    API.heat = 1;
    API.overheated = true;
    if (typeof toast === 'function') toast('Breath overheated \u2014 release to cool');
  }

  function updateHeat(now) {
    var elapsed = Math.max(0, now - R.lastHeatAt) / 1000;
    R.lastHeatAt = now;
    if (!API.firing) API.heat = Math.max(0, API.heat - HEAT_COOL_RATE * elapsed);
    else if (!API.overheated && now - R.fireStartedAt >= HEAT_SECONDS * 1000 * (1 - R.fireStartHeat)) {
      // A slow/stalled frame cannot turn a 3.5-second flame into a long lease
      // of continuous fire. Per-tick heat also prevents rapid-click bypasses.
      overheat();
    }
    if (API.overheated && !API.firing && API.heat <= OVERHEAT_RESUME) API.overheated = false;
  }

  function stopFire() {
    if (API.active) updateHeat(BC.now());
    API.firing = false;
    R.fireStartedAt = -Infinity;
  }

  function friendly(remote) {
    var modes = BC.api.modes;
    return !!(modes && modes.activeDef && modes.activeDef.teams && modes.localTeam &&
      remote.team === modes.localTeam);
  }

  function breathPathDry(distance, direction) {
    if (typeof getBlock !== 'function') return false;
    var steps = Math.max(1, Math.ceil(Math.min(BREATH_RANGE, distance) * 4));
    for (var i = 0; i <= steps; i++) {
      var at = distance * i / steps;
      if (getBlock(Math.floor(R.mouth.x + direction.x * at),
          Math.floor(R.mouth.y + direction.y * at),
          Math.floor(R.mouth.z + direction.z * at)) === WATER) return false;
    }
    return true;
  }

  function collectBreathTargets(now) {
    R.hitTargets.length = 0;
    var n = netRef();
    if (!n || !n.players || typeof n.players.values !== 'function') return;
    for (var remote of n.players.values()) {
      if (R.hitTargets.length >= 32) break;
      if (!remote || typeof remote.id !== 'string' || remote.id === localId() ||
          !Number.isFinite(remote.hp) || remote.hp <= 0 || remote.deadUntil > now || friendly(remote)) continue;
      if (!Number.isFinite(remote.x + remote.y + remote.z)) continue;
      var height = Number.isFinite(remote.height) ? BC.clamp(remote.height, 1.1, 1.9) : 1.8;
      R.tmp.set(remote.x - R.mouth.x, remote.y + height * 0.55 - R.mouth.y, remote.z - R.mouth.z);
      var distance = R.tmp.length();
      if (distance > BREATH_RANGE || distance < 0.001) continue;
      R.tmp.multiplyScalar(1 / distance);
      if (R.tmp.dot(R.forward) < BREATH_CONE_COS) continue;
      var cover = typeof raycastVoxel === 'function' ? raycastVoxel(distance, R.mouth, R.tmp) : null;
      if (cover && cover.dist < distance - 0.3) continue;
      var bodies = BC.api.dragons;
      var bodyCover = bodies && typeof bodies.raycast === 'function'
        ? bodies.raycast(R.mouth, R.tmp, distance, API.dragon ? API.dragon.index : -1) : null;
      if (bodyCover && bodyCover.distance < distance - 0.3) continue;
      if (!breathPathDry(distance, R.tmp)) continue;
      if (R.hitTargets.indexOf(remote.id) < 0) R.hitTargets.push(remote.id);
    }
  }

  function sendBreath(now) {
    if (!R.onlineLease) return true;
    if (!transportReady()) return false;
    // Publish the current root before its mouth packet. A boost must not make
    // validation compare today's jaws against a 100 ms-old ride transform.
    if (now > R.lastRideSentAt && !sendRide(API.dragon, true, true, now)) return false;
    var packet = { t: 'breath', dragon: API.dragon.index,
      x: R.mouth.x, y: R.mouth.y, z: R.mouth.z,
      dx: R.forward.x, dy: R.forward.y, dz: R.forward.z,
      lease: R.leaseToken, targets: R.hitTargets.slice() };
    // An empty hint list must stay empty; omitting it would let the authority
    // hit targets that our voxel/water visibility check deliberately excluded.
    try { return netSend(packet) !== false; } catch (e) { return false; }
  }

  function breathVoice(position, now, volume) {
    if (now - R.lastBreathVoiceAt < 140) return;
    if (typeof camera !== 'undefined' && camera && camera.position.distanceToSquared(position) > 90 * 90) return;
    R.lastBreathVoiceAt = now;
    emitSfx('dragonBreath', position, volume);
  }

  function scorchBlock(x, y, z) {
    if (typeof getBlock !== 'function' || typeof setBlock !== 'function') return false;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (x < 1 || z < 1 || x >= WORLD - 1 || z >= WORLD - 1 || y <= 0 || y >= HEIGHT) return false;
    var block = getBlock(x, y, z);
    if (block === AIR || block === WATER || block === GLASS || getBlock(x, y + 1, z) === WATER) return false;
    if (online()) {
      var n = netRef();
      if (!R.onlineLease || !transportReady() || !n || !Number.isSafeInteger(n.generation) || n.generation < 1) return false;
      try {
        if (netSend({ t: 'edit', x: x, y: y, z: z, b: AIR,
          generation: n.generation, epoch: n.epoch }) === false) return false;
      } catch (e) { return false; }
    }
    setBlock(x, y, z, AIR);
    if (typeof markDirty === 'function') markDirty(x, z);
    return true;
  }

  function breathShot(now) {
    if (!API.active || !API.dragon) return false;

    var dragon = API.dragon;
    if (typeof dragon.mouthPos === 'function') dragon.mouthPos(R.mouth);
    else R.mouth.copy(player.pos).add(R.forward);

    var yaw = Number.isFinite(player.yaw) ? player.yaw : R.yaw;
    var pitch = BC.clamp(Number.isFinite(player.pitch) ? player.pitch : R.pitch, -0.62, 0.82);
    var cp = Math.cos(pitch);
    R.forward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    if (!finitePosition(R.mouth) || !finitePosition(R.forward)) return false;
    if (R.mouth.distanceToSquared(dragon.group.position) > BREATH_MOUTH_OFFSET * BREATH_MOUTH_OFFSET) return false;
    R.forward.normalize();
    R.upHint.set(Math.abs(R.forward.y) > 0.95 ? 1 : 0, Math.abs(R.forward.y) > 0.95 ? 0 : 1, 0);
    R.right.crossVectors(R.forward, R.upHint).normalize();
    R.up.crossVectors(R.right, R.forward).normalize();

    // These IDs are visibility/cone hints, never client-authoritative damage.
    // The server/agreed MQTT host alone applies the allowed 55-damage tick and
    // confirms deaths. No sniper hit/shot, predicted kills or local HP writes.
    collectBreathTargets(now);
    if (!sendBreath(now)) return false;
    R.lastFireAt = now;
    API.heat = Math.min(1, API.heat + HEAT_PER_BREATH);
    R.shake = Math.min(1.1, R.shake + 0.55);
    var scorched = 0;
    for (var ray = 0; ray < 3; ray++) {
      var spread = ray === 0 ? 0 : (ray === 1 ? 0.22 : 0.45);
      var angle = Math.random() * Math.PI * 2;
      R.tmp.copy(R.forward)
        .addScaledVector(R.right, Math.cos(angle) * spread)
        .addScaledVector(R.up, Math.sin(angle) * spread)
        .normalize();

      var block = (typeof raycastVoxel === 'function')
        ? raycastVoxel(BREATH_RANGE, R.mouth, R.tmp) : null;
      var bodies = BC.api.dragons;
      var body = bodies && typeof bodies.raycast === 'function' ? bodies.raycast(R.mouth, R.tmp, BREATH_RANGE, dragon.index) : null;
      if (body && (!block || body.distance < block.dist)) {
        R.point.copy(R.mouth).addScaledVector(R.tmp, body.distance);
        spawnFx(R.point, R.tmp, 1);
        block = null; // solid dragons stop the breath; never scorch through one
      }
      if (block) {
        R.point.copy(R.mouth).addScaledVector(R.tmp, block.dist);
        if (breathPathDry(block.dist, R.tmp)) {
          if (scorched < 3 && scorchBlock(block.x, block.y, block.z)) scorched++;
          spawnFx(R.point, R.tmp, 1);
        }
      }

      spawnFx(R.mouth, R.tmp, 3);
    }
    flashFxLight(R.mouth);

    if (R.hitTargets.length && typeof flashHitmarker === 'function') flashHitmarker(false);

    breathVoice(R.mouth, now, 0.8);

    if (API.heat >= 1) overheat();
    return true;
  }

  function fireBreath() {
    if (!API.active || !API.dragon || !gameReady()) return false;
    var now = BC.now();
    if (leaseRemaining(now) <= 0) { dismount('time'); return false; }
    if (!rideConnected()) { dismount('network'); return false; }
    updateHeat(now);
    if (API.overheated || now - R.lastFireAt < BREATH_INTERVAL * 1000) return false;
    return breathShot(now);
  }

  /* ---------------- authority grants + remote visual leases ---------------- */
  function leaseDuration(msg) {
    var duration = 0; // active states without an authority deadline cannot mint a lease
    if (Number.isFinite(msg.remainingMs)) duration = msg.remainingMs;
    else if (Number.isFinite(msg.remaining)) duration = msg.remaining * 1000;
    else if (Number.isFinite(msg.expiresAt)) duration = msg.expiresAt - Date.now();
    return BC.clamp(duration, 0, RIDE_SECONDS * 1000);
  }

  function grantOwner(msg) {
    var owner = packetOwner(msg);
    if (!owner && typeof msg.target === 'string' && /^[\w-]{1,40}$/.test(msg.target)) owner = msg.target;
    var n = netRef();
    // An owner-less LAN grant is a direct response on our server connection.
    // MQTT broadcasts MUST identify the rider; otherwise every waiting peer
    // could mistake one host grant for its own.
    if (!owner && n && n.mode === 'ws') owner = localId();
    return owner;
  }

  function claimLease(index, owner, msg) {
    var dragon = dragonAt(index);
    var duration = leaseDuration(msg);
    var token = packetLease(msg);
    if (!dragon || !owner || !token || duration <= 0 || !isRideable(dragon)) return null;
    var now = BC.now(), wall = Date.now();
    var lease = leases[index];
    if (token === lease.retiredToken) return null;
    if (leaseLive(lease, wall, now)) {
      if (lease.owner !== owner || lease.token !== token) return null;
      lease.untilWall = Math.min(lease.untilWall, wall + duration);
      lease.untilNow = Math.min(lease.untilNow, now + duration);
      return lease; // duplicate grants/heartbeats never restart 30 seconds
    }
    for (var i = 0; i < leases.length; i++) {
      if (i !== index && leases[i].owner === owner && leaseLive(leases[i], wall, now)) return null;
    }
    if (API.active && API.dragon && API.dragon.index === index) dismount('lease');
    clearLease(index);
    if (token === lease.retiredToken) return null;
    for (var other = 0; other < leases.length; other++) {
      if (other !== index && leases[other].owner === owner) clearLease(other);
    }
    lease.owner = owner;
    lease.dragon = dragon;
    lease.token = token;
    lease.confirmed = true;
    lease.untilWall = wall + duration;
    lease.untilNow = now + duration;
    lease.lastRx = now;
    dragon.group.userData.ambient = false;
    dragon.group.userData.riderId = owner;
    if (typeof dragonSyncCollider === 'function') dragonSyncCollider(dragon);
    return lease;
  }

  function validRidePose(msg) {
    return Number.isFinite(msg.x) && Number.isFinite(msg.y) && Number.isFinite(msg.z) &&
      Number.isFinite(msg.yaw) && Number.isFinite(msg.pitch) &&
      msg.x >= 0 && msg.x <= WORLD && msg.z >= 0 && msg.z <= WORLD &&
      msg.y > 0 && msg.y <= HEIGHT + 48 && Math.abs(msg.pitch) <= Math.PI / 2;
  }

  function receivePose(lease, msg) {
    if (!lease || !validRidePose(msg)) return;
    lease.target.set(msg.x, msg.y, msg.z);
    lease.yaw = Math.atan2(Math.sin(msg.yaw), Math.cos(msg.yaw));
    lease.pitch = BC.clamp(msg.pitch, -0.62, 0.82);
    if (!lease.poseReady) {
      lease.dragon.group.position.copy(lease.target);
      lease.dragon.group.rotation.set(lease.pitch, lease.yaw, 0, 'YXZ');
    }
    lease.poseReady = true;
    lease.lastRx = BC.now();
    if (typeof dragonSyncCollider === 'function') dragonSyncCollider(lease.dragon);
  }

  function onRideGrant(msg) {
    var index = packetIndex(msg);
    var dragon = dragonAt(index);
    var owner = grantOwner(msg);
    if (index < 0 || !dragon || !owner || !packetLease(msg) || !isRideable(dragon) || !validRidePose(msg)) return;
    if (owner !== localId()) {
      var remoteLease = claimLease(index, owner, msg);
      receivePose(remoteLease, msg);
      return;
    }
    if (API.active && API.dragon === dragon) {
      var activeLease = claimLease(index, owner, msg);
      if (activeLease) {
        R.leaseUntilWall = Math.min(R.leaseUntilWall, activeLease.untilWall);
        R.leaseUntilNow = Math.min(R.leaseUntilNow, activeLease.untilNow);
        if (msg.reason === 'correction') {
          dragon.group.position.set(msg.x, msg.y, msg.z);
          R.yaw = Math.atan2(Math.sin(msg.yaw), Math.cos(msg.yaw));
          R.pitch = BC.clamp(msg.pitch, -0.62, 0.82);
          dragon.group.rotation.set(R.pitch, R.yaw, 0, 'YXZ');
          player.yaw = R.yaw;
          player.pitch = R.pitch;
          dragon.saddlePos(R.saddle);
          player.pos.copy(R.saddle);
          R.cameraReady = false;
          if (typeof dragonSyncCollider === 'function') dragonSyncCollider(dragon);
        }
      }
      return;
    }
    var pending = API.pending && API.pendingDragon === dragon && R.pendingSeed === worldSeed() &&
      R.pendingSession === connectionKey() && Date.now() < R.pendingUntilWall && BC.now() < R.pendingUntilNow;
    if (!pending || !gameReady()) {
      sendRide(dragon, false, true); // release a late/cancelled grant, never auto-mount
      return;
    }
    var granted = claimLease(index, owner, msg);
    cancelPending(false);
    receivePose(granted, msg);
    var duration = granted ? Math.max(0, Math.min(granted.untilWall - Date.now(), granted.untilNow - BC.now())) : 0;
    if (!granted || !mountDragon(dragon, duration, true, granted.token)) {
      sendRide(dragon, false, true);
      if (granted && granted.owner === owner) clearLease(index);
      if (typeof toast === 'function') toast('Dragon mount cancelled \u00b7 move closer');
    }
  }

  function onRideDenied(msg) {
    var index = packetIndex(msg);
    var owner = grantOwner(msg);
    if (index < 0 || owner !== localId()) return;
    var relevant = API.pending && API.pendingDragon && API.pendingDragon.index === index;
    if (relevant) cancelPending(false);
    else if (API.active && API.dragon && API.dragon.index === index) {
      dismount('denied');
      relevant = true;
    }
    if (relevant && typeof toast === 'function') toast(msg.reason === 'occupied' ? 'Dragon already occupied' : 'Dragon lease denied');
  }

  function onRideState(msg) {
    var index = packetIndex(msg);
    var owner = packetOwner(msg);
    if (index < 0 || !owner) return;
    var lease = leases[index];
    if (msg.active === false || msg.active === 0) {
      if (lease.owner !== owner) return;
      if (packetLease(msg) && packetLease(msg) !== lease.token) return;
      if (API.active && API.dragon && API.dragon.index === index && owner === R.ownerId) {
        dismount(msg.reason === 'death' ? 'death' : msg.reason === 'time' ? 'time' : 'lease');
      }
      else clearLease(index);
      return;
    }
    if (msg.active !== true && msg.active !== 1) return;
    if (owner === localId()) return; // an echoed request/state is NOT a grant
    var dragon = dragonAt(index);
    if (!dragon || !packetLease(msg) || !isRideable(dragon) || !validRidePose(msg)) return;
    var now = BC.now(), wall = Date.now();
    if (leaseLive(lease, wall, now) && lease.owner !== owner) return;
    if (!leaseLive(lease, wall, now)) {
      // A late joiner may see the authority's active state before its grant.
      // Only trusted server/host messages reach here, never peer requests.
      lease = claimLease(index, owner, msg);
    } else {
      if (packetLease(msg) !== lease.token) return;
      var duration = leaseDuration(msg);
      lease.untilWall = Math.min(lease.untilWall, wall + duration);
      lease.untilNow = Math.min(lease.untilNow, now + duration);
    }
    receivePose(lease, msg);
  }

  function onRemoteBreath(msg) {
    var index = packetIndex(msg);
    var lease = leases[index];
    var owner = packetOwner(msg);
    var now = BC.now();
    if (index < 0 || !leaseLive(lease, Date.now(), now) || !owner || lease.owner !== owner ||
        owner === localId() || packetLease(msg) !== lease.token) return;
    if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y) || !Number.isFinite(msg.z) ||
        !Number.isFinite(msg.dx) || !Number.isFinite(msg.dy) || !Number.isFinite(msg.dz)) return;
    R.tmp.set(msg.dx, msg.dy, msg.dz);
    var length = R.tmp.length();
    if (length < 0.5 || length > 1.5 || now - lease.lastBreath < BREATH_INTERVAL * 1000 - 40) return;
    R.point.set(msg.x, msg.y, msg.z);
    // Use the last authoritative root, not the lagging rendered mouth. The
    // current root is sent immediately before every breath, including boosts.
    if (!lease.poseReady || R.point.distanceToSquared(lease.target) > BREATH_MOUTH_OFFSET * BREATH_MOUTH_OFFSET) return;
    R.tmp.multiplyScalar(1 / length);
    lease.lastBreath = now;
    lease.breathUntil = now + 240;
    spawnFx(R.point, R.tmp, 9);
    flashFxLight(R.point);
    // 90-net already emits the directional remote breath sfx from this point.
    // Visuals only: do NOT apply HP damage, scorches, kill feed or scores here.
  }

  function onNetPacket(msg) {
    if (!msg || typeof msg.t !== 'string' || BC.flags.bootReady !== true || worldBusy()) return;
    if (msg.t === 'rideGrant' || msg.t === 'rideDenied' || msg.t === 'ride' || msg.t === 'breath') {
      var n = netRef();
      if (!trustedPacket(msg) || (Number.isFinite(msg.seed) && (msg.seed >>> 0) !== worldSeed()) ||
          (msg.generation !== undefined && (!n || msg.generation !== n.generation)) ||
          (msg.epoch && n && n.epoch && msg.epoch !== n.epoch)) return;
      if (msg.t === 'rideGrant') onRideGrant(msg);
      else if (msg.t === 'rideDenied') onRideDenied(msg);
      else if (msg.t === 'ride') onRideState(msg);
      else onRemoteBreath(msg);
    } else if ((msg.t === 'leave' || msg.t === 'died') && trustedPacket(msg)) {
      var owner = packetOwner(msg);
      for (var i = 0; i < leases.length; i++) {
        if (!owner || leases[i].owner !== owner) continue;
        if (API.active && API.dragon && API.dragon.index === i) dismount(msg.t === 'died' ? 'death' : 'network');
        else clearLease(i);
      }
    }
  }

  /* ---------------- per-frame ride ---------------- */
  function updateRemoteRides(dt, now, wall, stamp) {
    var n = netRef();
    for (var i = 0; i < leases.length; i++) {
      var lease = leases[i];
      if (!lease.owner) continue;
      if (API.active && API.dragon === lease.dragon && lease.owner === R.ownerId) continue;
      if (!leaseLive(lease, wall, now)) { clearLease(i); continue; }
      var dragon = lease.dragon;
      if (lease.poseReady) {
        var position = dragon.group.position;
        position.x = BC.damp(position.x, lease.target.x, 12, dt);
        position.y = BC.damp(position.y, lease.target.y, 12, dt);
        position.z = BC.damp(position.z, lease.target.z, 12, dt);
        var angle = lease.yaw - dragon.group.rotation.y;
        angle = Math.atan2(Math.sin(angle), Math.cos(angle));
        var yaw = dragon.group.rotation.y + angle * (1 - Math.exp(-12 * dt));
        var pitch = BC.damp(dragon.group.rotation.x, lease.pitch, 12, dt);
        dragon.group.rotation.set(pitch, yaw, 0, 'YXZ');
      }
      if (typeof poseRiddenDragon === 'function') poseRiddenDragon(dragon, DRAGON_TIME_ORIGIN * 0.001 + stamp * 0.001);
      if (dragon.tag) dragon.tag.visible = false;
      var remote = n && n.players && typeof n.players.get === 'function' ? n.players.get(lease.owner) : null;
      var avatar = remote && remote.hp > 0 && !(remote.deadUntil > now) ? remote.group : null;
      if (avatar !== lease.avatar) {
        restoreAvatar(lease.avatar, lease.avatarPose);
        lease.avatar = avatar;
        lease.avatarPose = saveAvatar(avatar);
      }
      seatAvatar(lease.avatar, dragon, lease.avatarPose);
      if (typeof dragonSyncCollider === 'function') dragonSyncCollider(dragon);
    }
  }

  function onFrame(dt, now) {
    if (BC.flags.bootReady !== true || worldBusy()) return;
    var stamp = Number.isFinite(now) ? now : BC.now();
    if (stamp <= R.lastRemoteNow) return;
    R.lastRemoteNow = stamp;
    var d = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
    initFx();
    updateRemoteRides(d, BC.now(), Date.now(), stamp);
    updateFx(d);
  }

  function update(dt, now) {
    if (BC.flags.bootReady !== true) return;
    var d = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
    var stamp = Number.isFinite(now) ? now : BC.now();
    if (stamp <= R.lastUpdateNow) return;
    R.lastUpdateNow = stamp;
    var clock = BC.now(), wall = Date.now();

    if (worldBusy()) {
      if (API.active || API.pending) dismount('busy');
      clearFx();
      return;
    }
    // Normally frame already ran after updateNetPlayers. Keep direct API.update
    // compatibility without advancing remote interpolation/particles twice.
    onFrame(d, stamp);

    if (API.pending) {
      if (wall >= R.pendingUntilWall || clock >= R.pendingUntilNow) {
        cancelPending(true);
        if (typeof toast === 'function') toast('Dragon lease request timed out');
      } else if (!gameReady() || R.pendingSeed !== worldSeed() || R.pendingSession !== connectionKey()) {
        cancelPending(true);
      }
    }

    if (!API.active) {
      updatePrompt();
      return;
    }

    var dragon = API.dragon;
    if (!dragon || dragonAt(dragon.index) !== dragon || typeof player === 'undefined') {
      dismount('lost');
      return;
    }
    if (typeof alive !== 'undefined' && !alive) { dismount('death'); return; }
    var killcam = BC.api.killcam;
    if (killcam && killcam.active) { dismount('killcam'); return; }
    API.remaining = leaseRemaining(clock);
    if (API.remaining <= 0) { dismount('time'); return; }
    if (!rideConnected()) { dismount('network'); return; }
    if (leases[dragon.index].owner !== R.ownerId) { dismount('lease'); return; }
    if (!gameReady()) { dismount('pause'); return; }
    var modes = BC.api.modes;
    if (modes && modes.activeDef && modes.activeDef.locked) { dismount('mode'); return; }
    var physics = ridingPhysics();
    if (!physics) { dismount('lost'); return; }

    updateHeat(clock);

    var keysRef = R.heldKeys;
    var turn = 0, lift = 0, throttle = 0;
    if (keysRef) {
      if (keysRef.KeyA) turn += 1;
      if (keysRef.KeyD) turn -= 1;
      // Space wins over C; Shift is boost only, Ctrl never descends a dragon.
      if (keysRef.Space) lift = 1;
      else if (keysRef.KeyC) lift = -1;
      if (keysRef.KeyW) throttle += 1;
      if (keysRef.KeyS) throttle -= 1;
    }

    // 80-input owns the only mouse sensitivity pass. Read its heading rather
    // than installing another mousemove listener or overwriting mouse deltas.
    R.yaw = (Number.isFinite(player.yaw) ? player.yaw : R.yaw) + turn * 1.05 * d;
    R.yaw = Math.atan2(Math.sin(R.yaw), Math.cos(R.yaw));
    R.pitch = BC.clamp(Number.isFinite(player.pitch) ? player.pitch : R.pitch, -0.62, 0.82);
    var targetSpeed = throttle > 0 ? 30 : throttle < 0 ? 7 : 18;
    if (keysRef && (keysRef.ShiftLeft || keysRef.ShiftRight)) targetSpeed *= 1.35;
    API.speed = BC.damp(API.speed, targetSpeed, 2.2, d);

    var cp = Math.cos(R.pitch);
    R.forward.set(-Math.sin(R.yaw) * cp, Math.sin(R.pitch), -Math.cos(R.yaw) * cp);
    var position = dragon.group.position;
    var vertical = R.forward.y * API.speed;
    if (lift > 0) vertical = Math.max(0, vertical) + 12;
    else if (lift < 0) vertical = Math.min(0, vertical) - 10;
    R.motionTarget.set(position.x + R.forward.x * API.speed * d,
      position.y + vertical * d, position.z + R.forward.z * API.speed * d);
    if (d > 0 && typeof terrainHeight === 'function') {
      var here = terrainHeight(R.motionTarget.x, R.motionTarget.z);
      var ahead = terrainHeight(R.motionTarget.x + R.forward.x * 12, R.motionTarget.z + R.forward.z * 12);
      var floorY = Math.max(here, ahead) + 5.5;
      // Noise is a broad flight-clearance hint, never a teleport through a
      // roof. Even its bounded automatic climb is swept against live voxels.
      if (Number.isFinite(floorY) && R.motionTarget.y < floorY) {
        R.motionTarget.y = Math.max(R.motionTarget.y, Math.min(floorY, position.y + 12 * d));
      }
    }
    if (!moveRiddenCore(dragon, physics)) { dismount('blocked'); return; }

    R.roll = BC.damp(R.roll, turn * 0.42, 5, d);
    dragon.group.rotation.set(R.pitch, R.yaw, R.roll, 'YXZ');
    if (typeof poseRiddenDragon === 'function') poseRiddenDragon(dragon, DRAGON_TIME_ORIGIN * 0.001 + stamp * 0.001);

    if (typeof dragon.saddlePos === 'function') {
      dragon.saddlePos(R.saddle);
      player.pos.copy(R.saddle);
    }
    player.fly = false;
    player.onGround = false;
    player.vel.set(0, 0, 0);
    player.yaw = R.yaw;
    player.pitch = R.pitch;
    player.groundSpeed = API.speed;
    player.sprinting = player.crouching = player.sliding = player.swimming = false;
    if (typeof localAvatar !== 'undefined' && localAvatar !== R.avatar) {
      restoreAvatar(R.avatar, R.avatarPose);
      R.avatar = localAvatar;
      R.avatarPose = saveAvatar(R.avatar);
    }
    seatAvatar(R.avatar, dragon, R.avatarPose);
    if (typeof dragonSyncCollider === 'function') dragonSyncCollider(dragon);
    if (typeof vmRoot !== 'undefined' && vmRoot) vmRoot.visible = false;
    if (typeof gun !== 'undefined' && gun) gun.trigger = gun.aiming = false;
    sendRide(dragon, true, false, clock);
    if (API.firing && !API.overheated && clock - R.lastFireAt >= BREATH_INTERVAL * 1000) breathShot(clock);

    // Chase camera. This remains the only ride camera owner in lateFrame 30.
    // Clear the desired boom BEFORE damping, then clear the damped/shaken boom
    // again: smoothing or a newly placed wall must not put the eye behind cover.
    var targetFov = 74 + (prefersReducedMotion() ? 0 : BC.clamp((API.speed - 16) * 0.35, 0, 8) + Math.max(0, R.pitch) * 4);
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = BC.damp(camera.fov, targetFov, 3.2, d);
      camera.updateProjectionMatrix();
    }
    R.cameraHalf = cameraHalfExtent();
    collision.camera.blocked = false;
    collision.camera.rayProbes = collision.camera.sweepSteps = 0;
    R.cameraAnchor.copy(player.pos);
    R.cameraAnchor.y += 0.8;
    if (!cameraPointClear(R.cameraAnchor, physics)) R.cameraAnchor.copy(position);
    if (!cameraPointClear(R.cameraAnchor, physics)) { dismount('blocked'); return; }
    var back = 9.4 + API.speed * 0.12;
    var camX = player.pos.x + Math.sin(R.yaw) * back * Math.cos(R.pitch * 0.3);
    var camZ = player.pos.z + Math.cos(R.yaw) * back * Math.cos(R.pitch * 0.3);
    var camY = player.pos.y + 3.2 - Math.sin(R.pitch) * back * 0.35;
    if (typeof terrainHeight === 'function') {
      var camFloor = terrainHeight(camX, camZ) + 1.4;
      if (camY < camFloor) camY = camFloor;
    }
    R.cameraWanted.set(camX, camY, camZ);
    collision.camera.requestedBoom = R.cameraWanted.distanceTo(R.cameraAnchor);
    traceRideCamera(R.cameraAnchor, R.cameraWanted, R.cameraSafeWanted, physics);
    if (!R.cameraReady) {
      R.cameraPos.copy(R.cameraSafeWanted);
      R.cameraReady = true;
    } else {
      R.cameraCandidate.set(
        BC.damp(R.cameraPos.x, R.cameraSafeWanted.x, 8, d),
        BC.damp(R.cameraPos.y, R.cameraSafeWanted.y, 8, d),
        BC.damp(R.cameraPos.z, R.cameraSafeWanted.z, 8, d));
      traceRideCamera(R.cameraAnchor, R.cameraCandidate, R.cameraPos, physics);
    }
    R.lookTarget.set(
      player.pos.x - Math.sin(R.yaw) * 9 * cp,
      player.pos.y + 2.1 + Math.sin(R.pitch) * 9,
      player.pos.z - Math.cos(R.yaw) * 9 * cp
    );
    camera.position.copy(R.cameraPos);
    if (R.shake > 0.001) {
      var shake = prefersReducedMotion() ? 0 : R.shake;
      R.cameraCandidate.copy(R.cameraPos);
      R.cameraCandidate.x += (Math.random() - 0.5) * shake * 0.28;
      R.cameraCandidate.y += (Math.random() - 0.5) * shake * 0.22;
      R.cameraCandidate.z += (Math.random() - 0.5) * shake * 0.28;
      traceRideCamera(R.cameraAnchor, R.cameraCandidate, camera.position, physics);
      R.shake = Math.max(0, R.shake - d * 3.6);
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(R.lookTarget);
    if (R.roll && !prefersReducedMotion()) camera.rotateZ(R.roll * 0.32);
    collision.camera.clear = cameraPointClear(camera.position, physics);
    collision.camera.nearPlaneClear = rideNearPlaneClear(physics);
    collision.camera.x = R.cameraBox.x; collision.camera.y = R.cameraBox.y; collision.camera.z = R.cameraBox.z;
    collision.camera.w = R.cameraBox.w; collision.camera.h = R.cameraBox.h;
    collision.camera.anchorX = R.cameraAnchor.x;
    collision.camera.anchorY = R.cameraAnchor.y;
    collision.camera.anchorZ = R.cameraAnchor.z;
    collision.camera.boom = camera.position.distanceTo(R.cameraAnchor);
    if (!collision.camera.clear || !collision.camera.nearPlaneClear) { dismount('blocked'); return; }
    camera.updateMatrixWorld(true);

    updateHud(false);
  }

  /* ---------------- captured input ---------------- */
  function onKeyDown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    var ready = gameReady(event);
    if (!ready) {
      if (API.active || API.pending) dismount(worldBusy() ? 'busy' : 'pause');
      R.eHeld = false;
      return; // menus, text fields and crafting keep their normal E behavior
    }
    if (event.code === 'KeyE') {
      if (event.altKey || event.metaKey) return;
      if (R.eHeld || event.repeat) {
        if (R.eHeld) consume(event);
        return;
      }
      if (API.active) {
        R.eHeld = true;
        consume(event);
        dismount('key');
      } else if (API.pending) {
        R.eHeld = true;
        consume(event);
        cancelPending(true);
      } else if (nearestDragon()) {
        R.eHeld = true;
        consume(event);
        mountNearest();
      }
      return;
    }

    if (API.active) {
      if (event.code === 'Escape') return; // let the normal pause path unlock
      R.heldKeys.ShiftLeft = !!event.shiftKey;
      if (RIDE_KEYS[event.code]) {
        R.heldKeys[event.code] = true;
        consume(event);
        return;
      }
      if (BLOCKED_KEYS[event.code] || DIGIT_KEY.test(event.code)) consume(event);
      return;
    }
  }

  function onKeyUp(event) {
    if (event.code === 'KeyE' && R.eHeld) {
      R.eHeld = false;
      if (typeof keys !== 'undefined') keys.KeyE = false;
      if (gameReady(event)) consume(event);
      return;
    }
    if (!API.active) return;
    R.heldKeys.ShiftLeft = !!event.shiftKey;
    if (RIDE_KEYS[event.code]) {
      R.heldKeys[event.code] = false;
      if (gameReady(event)) consume(event);
      return;
    }
    if (gameReady(event) && (BLOCKED_KEYS[event.code] || DIGIT_KEY.test(event.code))) consume(event);
  }

  function onMouseDown(event) {
    if (!API.active || (event.button !== 0 && event.button !== 2)) return;
    if (!gameReady(event)) return;
    consume(event);
    if (event.button === 0 && !API.firing) {
      var now = BC.now();
      updateHeat(now);
      R.fireStartedAt = now;
      R.fireStartHeat = API.heat;
      API.firing = true;
      fireBreath();
    }
  }

  function onMouseUp(event) {
    if (!API.active) return;
    if (event.button !== 0 && event.button !== 2) return;
    if (event.button === 0) stopFire();
    if (gameReady(event)) consume(event);
  }

  function onWheel(event) {
    if (!API.active || !gameReady(event)) return;
    consume(event);
  }

  function onPointerLockChange() {
    if (!API.active && !API.pending) return;
    if (typeof renderer === 'undefined' || document.pointerLockElement !== renderer.domElement) {
      dismount('unlock');
      R.eHeld = false;
      clearFx();
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (API.active || API.pending) dismount('unlock');
      R.eHeld = false;
      clearFx();
    }
  }

  function onWindowBlur() {
    if (API.active || API.pending) dismount('unlock');
    R.eHeld = false;
    clearFx();
  }

  /* ---------------- hooks ---------------- */
  function onDeath() {
    if (API.active || API.pending) dismount('death');
    R.eHeld = false;
    clearFx();
  }

  function onRespawn() {
    if (API.active || API.pending) dismount('respawn');
    API.firing = false;
    API.heat = 0;
    API.overheated = false;
    R.eHeld = false;
    hidePrompt();
  }

  function onWorldReset() {
    if (API.active || API.pending) dismount('reset');
    clearLeases(true);
    disposeFx();
    API.firing = API.overheated = false;
    API.remaining = API.heat = API.speed = 0;
    collision.ready = false;
    collision.core.clear = collision.camera.clear = collision.camera.nearPlaneClear = false;
    R.hitTargets.length = 0;
    for (var code in R.heldKeys) R.heldKeys[code] = false;
    R.eHeld = false;
    R.leaseUntilWall = R.leaseUntilNow = 0;
    R.leaseToken = '';
    R.pendingUntilWall = R.pendingUntilNow = 0;
    R.lastUpdateNow = R.lastRemoteNow = R.lastFireAt = R.lastRideSentAt = R.lastBreathVoiceAt = -Infinity;
    R.lastHeatAt = BC.now();
    R.cameraReady = false;
    R.lastPromptName = '';
    R.netSession = connectionKey();
    hidePrompt();
  }

  function onWorldBusyChanged(busy) {
    if (!busy) return;
    if (API.active || API.pending) dismount('busy');
    clearLeases();
    clearFx();
    hidePrompt();
    R.eHeld = false;
  }

  function onPreFrame(dt, now, playing) {
    if (!API.active && !API.pending) return;
    if (BC.flags.bootReady !== true || worldBusy()) { dismount('busy'); return; }
    if (typeof alive !== 'undefined' && !alive) { dismount('death'); return; }
    var killcam = BC.api.killcam;
    if (killcam && killcam.active) { dismount('killcam'); return; }
    if (API.active && leaseRemaining(BC.now()) <= 0) { dismount('time'); return; }
    if (API.active && !rideConnected()) { dismount('network'); return; }
    if (playing === false || !gameReady()) dismount('pause');
  }

  function onInputReset() {
    if (R.resettingInputs) return;
    stopFire();
    for (var code in R.heldKeys) R.heldKeys[code] = false;
    R.eHeld = false;
    if (!gameReady()) { clearFx(); hidePrompt(); }
    if (!gameReady() && (API.active || API.pending)) {
      var reason = worldBusy() ? 'busy' : typeof alive !== 'undefined' && !alive ? 'death' : 'pause';
      dismount(reason);
    }
  }

  function onNetStatus() {
    var key = connectionKey();
    if (API.active && !rideConnected()) dismount('network');
    if (API.pending && R.pendingSession !== key) cancelPending(true);
    if (R.netSession !== key) clearLeases();
    R.netSession = key;
  }

  function onModeChanged() {
    if (API.active && !isRideable(API.dragon)) dismount('mode');
    if (API.pending && !isRideable(API.pendingDragon)) cancelPending(true);
    var modes = BC.api.modes;
    if (modes && modes.activeDef && modes.activeDef.locked) clearLeases();
  }

  API.mountNearest = mountNearest;
  API.dismount = dismount;
  // Touch controls press the same flight keys and breath trigger.
  API.setHeld = function (code, on) { if (RIDE_KEYS[code]) R.heldKeys[code] = !!on && API.active; };
  API.startFire = function () {
    if (!API.active || API.firing) return;
    var now = BC.now();
    updateHeat(now);
    R.fireStartedAt = now;
    R.fireStartHeat = API.heat;
    API.firing = true;
    fireBreath();
  };
  API.stopFire = stopFire;
  API.canMount = function () { return !API.active && !API.pending && gameReady() && !!nearestDragon(); };
  API.fireBreath = fireBreath;
  API.rideable = isRideable;
  API.occupied = occupied;
  API.remoteFiring = remoteFiring;
  API.update = update;

  BC.on('preFrame', onPreFrame, -20);
  BC.on('frame', onFrame, -20);
  BC.on('lateFrame', update, LATE_PRIORITY);
  BC.on('death', onDeath, -20);
  BC.on('respawn', onRespawn, -20);
  BC.on('worldReset', onWorldReset, -20);
  BC.on('worldBusyChanged', onWorldBusyChanged, -20);
  BC.on('worldReady', initFx, -20);
  BC.on('inputReset', onInputReset, -20);
  BC.on('netPacket', onNetPacket, -20);
  BC.on('netStatus', onNetStatus, -20);
  BC.on('modeChanged', onModeChanged, -20);

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('mouseup', onMouseUp, true);
  window.addEventListener('wheel', onWheel, { capture: true, passive: false });
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('blur', onWindowBlur);

  if (typeof BC.whenReady === 'function') BC.whenReady(initFx);
})();
