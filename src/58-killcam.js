/* Blockcraft Battle Ground — Cinematic killer camera and KILLED BY card.
   58-killcam.js
   Runs after 50-player.js (camera/player helpers) and before 60-combat.js.
   Combat emits `death` / `respawn`; this module overrides the camera inside
   `lateFrame`, after the normal updateCamera pass, and never mutates player
   look/combat state. Classic script, no imports. */
'use strict';

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  var BC = window.BC;
  if (!BC || typeof BC.on !== 'function' || typeof BC.style !== 'function') return;

  var KILLCAM_DURATION = 3.2;       // combat respawn window
  var KILLCAM_BLEND = 0.55;         // death view -> shoulder view
  var KILLCAM_RETURN = 0.8;         // shoulder view -> normal view
  var KILLCAM_FOV = 62;
  var KILLCAM_DISTANCE = 3.4;
  var KILLCAM_HEIGHT = 1.9;
  var KILLCAM_SHOULDER = 0.72;
  var KILLCAM_ORBIT_DISTANCE = 3.3;
  var KILLCAM_ORBIT_HEIGHT = 2.05;
  var KILLCAM_ORBIT_SHOULDER = 0.55;
  var KILLCAM_ORBIT_SPEED = 0.25;   // rad/s
  var KILLCAM_HEARTBEAT = 0.5;      // seconds
  var KILLCAM_CSS_ID = 'blockcraft-killcam-css';

  var killcamReducedMotion = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function killcamReduced() {
    return !!(killcamReducedMotion && killcamReducedMotion.matches);
  }

  var KILLCAM_CSS = [
    '#killcamCard{',
    '--kc-accent:#d8e6f2;',
    'position:fixed;left:50%;bottom:clamp(76px,14vh,150px);z-index:14;',
    'width:min(620px,calc(100vw - 36px));box-sizing:border-box;padding:14px 24px 12px;',
    'text-align:center;pointer-events:none;color:#f4f8fb;',
    'background:radial-gradient(120% 160% at 50% 120%,rgba(255,255,255,.06),rgba(255,255,255,0) 55%),',
    'linear-gradient(180deg,rgba(9,16,24,.94),rgba(5,9,14,.88));',
    'border:1px solid rgba(230,242,250,.18);border-top:2px solid var(--kc-accent,#d8e6f2);',
    'border-radius:3px 3px 12px 12px;',
    'box-shadow:0 22px 60px rgba(0,0,0,.58),inset 0 0 0 1px rgba(0,0,0,.35);',
    'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);',
    'opacity:0;transform:translate(-50%,18px) scale(.95);transform-origin:50% 100%;',
    'transition:opacity .16s ease-out,transform .16s cubic-bezier(.2,.8,.2,1);',
    '}',
    '#killcamCard.show{opacity:1;transform:translate(-50%,0) scale(1);}',
    '#killcamCard.dismiss{opacity:0;transform:translate(-50%,10px) scale(.97);transition-duration:.42s;}',
    '.killcam-top{display:flex;align-items:center;justify-content:center;gap:10px;min-height:16px;}',
    '.killcam-eyebrow{font-size:10px;font-weight:700;letter-spacing:.42em;text-transform:uppercase;color:rgba(226,240,250,.66);}',
    '#killcamHeadshot{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:2px;',
    'background:var(--kc-accent);color:#081018;font-size:9px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;}',
    '#killcamHeadshot[hidden]{display:none;}',
    '#killcamKiller{margin:2px 0 4px;font-size:clamp(38px,8vw,78px);font-weight:800;line-height:.9;',
    'letter-spacing:.01em;text-transform:uppercase;color:var(--kc-accent);font-stretch:condensed;',
    'text-shadow:0 4px 0 rgba(0,0,0,.35),0 0 34px rgba(255,255,255,.08);overflow-wrap:anywhere;}',
    '.killcam-meta{display:flex;align-items:center;justify-content:center;gap:9px;font-size:10.5px;',
    'font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(230,242,250,.8);}',
    '.killcam-sep{color:rgba(230,242,250,.32);}',
    '.killcam-watch{display:inline-flex;align-items:center;gap:7px;margin-top:8px;font-size:9.5px;',
    'font-weight:700;letter-spacing:.26em;text-transform:uppercase;color:rgba(230,242,250,.6);}',
    '.killcam-dot{width:6px;height:6px;border-radius:50%;background:var(--kc-accent);',
    'box-shadow:0 0 10px var(--kc-accent);animation:killcamPulse 1.1s ease-in-out infinite;}',
    '.killcam-progress{position:relative;height:2px;margin-top:10px;background:rgba(230,242,250,.14);overflow:hidden;}',
    '.killcam-progress i{display:block;width:100%;height:100%;transform-origin:0 50%;transform:scaleX(1);',
    'background:linear-gradient(90deg,var(--kc-accent),rgba(255,255,255,.9));}',
    '@keyframes killcamPulse{0%,100%{opacity:.35;transform:scale(.8);}50%{opacity:1;transform:scale(1.15);}}',
    'body.killcam #crosshair,body.killcam #scopeOverlay,body.killcam #weaponHud,',
    'body.killcam #hurt,body.killcam #hitmarker,body.killcam #death{display:none !important;}',
    '@media (prefers-reduced-motion:reduce){',
    '#killcamCard,#killcamCard.show,#killcamCard.dismiss{transition:none;}',
    '.killcam-dot{animation:none;}',
    '}',
    '@media (max-width:560px){',
    '#killcamCard{bottom:64px;padding:12px 16px 10px;}',
    '.killcam-eyebrow{letter-spacing:.3em;}',
    '.killcam-meta{letter-spacing:.14em;}',
    '.killcam-watch{letter-spacing:.18em;}',
    '}'
  ].join('');

  try { BC.style(KILLCAM_CSS_ID, KILLCAM_CSS); } catch (e) { /* head not ready; retried on show */ }

  var KC = {
    active: false,
    killerName: '',
    victimName: '',
    byId: '',
    weaponId: '',
    headshot: false,
    team: null,
    accent: '#d8e6f2',
    distance: NaN,
    distanceText: '\u2014',
    elapsed: 0,
    deadline: 0,
    duration: KILLCAM_DURATION,
    drift: 0,
    heartbeatAt: 0,
    dismissed: false,
    lastProgress: -1,
    infoPos: { x: 0, y: 0, z: 0 },
    infoPosValid: false,
    victimPos: { x: 0, y: 0, z: 0 },
    killerPos: { x: 0, y: 0, z: 0 },
    startPos: { x: 0, y: 0, z: 0 },
    normalPos: { x: 0, y: 0, z: 0 },
    smoothPos: { x: 0, y: 0, z: 0 },
    smoothReady: false,
    mode: 'orbit',
    killerRemote: null,
    hadRemote: false,
    killerYaw: 0,
    fallbackYaw: 0,
    haveStart: false,
    fovTouched: false,
    startFov: 74,
    normalFov: 74,
    card: null,
    els: null,
    vec: null,
    look: null,
    startQuat: null,
    normalQuat: null,
    blendQuat: null
  };

  function killcamClamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function killcamSmoothStep(t) {
    t = killcamClamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function killcamEnsureThree() {
    if (KC.vec && KC.look && KC.startQuat) return true;
    if (typeof THREE === 'undefined' || !THREE) return false;
    try {
      KC.vec = new THREE.Vector3();
      KC.look = new THREE.Vector3();
      KC.startQuat = new THREE.Quaternion();
      KC.normalQuat = new THREE.Quaternion();
      KC.blendQuat = new THREE.Quaternion();
      return true;
    } catch (e) {
      return false;
    }
  }

  function killcamReadPos(src, out) {
    if (!src || typeof src !== 'object') return false;
    var x = src.x, y = src.y, z = src.z;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
    if (x === 0 && y === 0 && z === 0) return false;
    out.x = x;
    out.y = y;
    out.z = z;
    return true;
  }

  function killcamCaptureStart() {
    if (typeof camera === 'undefined' || !camera) return false;
    if (!killcamEnsureThree()) return false;
    var p = camera.position, q = camera.quaternion;
    if (!p || !q) return false;
    KC.startPos.x = p.x;
    KC.startPos.y = p.y;
    KC.startPos.z = p.z;
    KC.startQuat.copy(q);
    KC.startFov = Number.isFinite(camera.fov) ? camera.fov : 74;
    KC.haveStart = true;
    return true;
  }

  function killcamSafeName(value) {
    if (value == null) return '';
    var text = String(value).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
    if (!text || text === '???') return '';
    return text.slice(0, 24);
  }

  function killcamTeam(info) {
    var team = info && (info.team || info.killerTeam);
    if (!team && KC.killerRemote && KC.killerRemote.team) team = KC.killerRemote.team;
    if (!team && info && info.byId && typeof net !== 'undefined' && net && net.id === info.byId &&
        BC.api && BC.api.modes) {
      team = BC.api.modes.localTeam;
      if (!team && typeof BC.api.modes.teamFor === 'function') {
        try { team = BC.api.modes.teamFor(info.byId); } catch (e) { /* ignore */ }
      }
    }
    if (!team && BC.api && BC.api.modes && typeof BC.api.modes.teamFor === 'function' && info && info.byId) {
      try { team = BC.api.modes.teamFor(info.byId); } catch (e) { /* ignore */ }
    }
    return team === 'red' || team === 'blue' ? team : null;
  }

  function killcamWeaponName(id) {
    if (!id) return 'UNKNOWN WEAPON';
    if (typeof WEAPON_BY_ID !== 'undefined' && WEAPON_BY_ID && WEAPON_BY_ID[id] && WEAPON_BY_ID[id].name) {
      return String(WEAPON_BY_ID[id].name);
    }
    if (typeof WEAPONS !== 'undefined' && WEAPONS && WEAPONS.length) {
      for (var i = 0; i < WEAPONS.length; i++) {
        if (WEAPONS[i] && WEAPONS[i].id === id && WEAPONS[i].name) return String(WEAPONS[i].name);
      }
    }
    return String(id).replace(/[_-]+/g, ' ').toUpperCase().slice(0, 28);
  }

  function killcamBlockSolid(x, y, z) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
    if (typeof getBlock === 'function') {
      var block;
      try { block = getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); } catch (e) { return false; }
      if (block == null) return false;
      if (typeof AIR !== 'undefined' && block === AIR) return false;
      if (typeof WATER !== 'undefined' && block === WATER) return false;
      if (typeof AIR === 'undefined' && !block) return false;
      return true;
    }
    if (BC.api && BC.api.physics && typeof BC.api.physics.solidAt === 'function') {
      try { return !!BC.api.physics.solidAt(x, y, z); } catch (e) { /* ignore */ }
    }
    return false;
  }

  function killcamPointBlocked(x, y, z) {
    if (typeof cameraBlocked === 'function') {
      try { return cameraBlocked(x, y, z); } catch (e) { /* ignore */ }
    }
    return killcamBlockSolid(x, y, z);
  }

  function killcamResolveKiller() {
    KC.killerRemote = null;
    var byId = KC.byId;
    if (byId && typeof net !== 'undefined' && net && net.players &&
        typeof net.players.get === 'function') {
      var remote = null;
      try { remote = net.players.get(byId); } catch (e) { remote = null; }
      if (remote && remote.group && remote.group.position) {
        var now = BC.now();
        var gone = (Number.isFinite(remote.hp) && remote.hp <= 0) ||
          (Number.isFinite(remote.deadUntil) && remote.deadUntil > now);
        if (!gone) {
          if (KC.vec && typeof remote.group.getWorldPosition === 'function') {
            remote.group.getWorldPosition(KC.vec);
            KC.killerPos.x = KC.vec.x;
            KC.killerPos.y = KC.vec.y;
            KC.killerPos.z = KC.vec.z;
          } else {
            KC.killerPos.x = remote.group.position.x;
            KC.killerPos.y = remote.group.position.y;
            KC.killerPos.z = remote.group.position.z;
          }
          if (Number.isFinite(remote.group.rotation && remote.group.rotation.y)) {
            KC.killerYaw = remote.group.rotation.y;
          }
          KC.killerRemote = remote;
          KC.mode = 'remote';
          return 'remote';
        }
      }
    }
    if (KC.infoPosValid && !KC.hadRemote) {
      KC.killerPos.x = KC.infoPos.x;
      KC.killerPos.y = KC.infoPos.y;
      KC.killerPos.z = KC.infoPos.z;
      var dx = KC.victimPos.x - KC.killerPos.x;
      var dz = KC.victimPos.z - KC.killerPos.z;
      if (dx * dx + dz * dz > 1e-6) KC.killerYaw = Math.atan2(-dx, -dz);
      else KC.killerYaw = KC.fallbackYaw;
      KC.mode = 'info';
      return 'info';
    }
    KC.killerPos.x = KC.victimPos.x;
    KC.killerPos.y = KC.victimPos.y;
    KC.killerPos.z = KC.victimPos.z;
    KC.mode = 'orbit';
    return 'orbit';
  }

  function killcamBuildCard() {
    if (KC.card || typeof document === 'undefined' || !document.body) return;
    try { BC.style(KILLCAM_CSS_ID, KILLCAM_CSS); } catch (e) { /* ignore */ }

    var headshotEl = BC.el('span', {
      id: 'killcamHeadshot', 'class': 'killcam-headshot', text: 'HEADSHOT'
    });
    var topEl = BC.el('div', { 'class': 'killcam-top' }, [
      BC.el('span', { 'class': 'killcam-eyebrow', text: 'KILLED BY' }),
      headshotEl
    ]);
    var killerEl = BC.el('div', {
      id: 'killcamKiller', 'class': 'killcam-killer', text: KC.killerName || 'UNKNOWN'
    });
    var weaponEl = BC.el('span', {
      id: 'killcamWeapon', 'class': 'killcam-weapon', text: killcamWeaponName(KC.weaponId)
    });
    var distEl = BC.el('span', {
      id: 'killcamDist', 'class': 'killcam-dist', text: KC.distanceText
    });
    var metaEl = BC.el('div', { 'class': 'killcam-meta' }, [
      weaponEl,
      BC.el('span', { 'class': 'killcam-sep', text: '\u00b7' }),
      distEl
    ]);
    var watchText = BC.el('span', {
      id: 'killcamWatchText',
      text: 'WATCHING ' + (KC.killerName && KC.killerName !== 'UNKNOWN' ? KC.killerName : 'THE KILLER')
    });
    var watchEl = BC.el('div', { id: 'killcamWatch', 'class': 'killcam-watch', 'aria-live': 'polite' }, [
      BC.el('i', { 'class': 'killcam-dot', 'aria-hidden': 'true' }),
      watchText
    ]);
    var progressEl = BC.el('i', { id: 'killcamProgress' });
    var progressWrap = BC.el('div', {
      'class': 'killcam-progress', 'aria-hidden': 'true'
    }, [progressEl]);
    var card = BC.el('div', {
      id: 'killcamCard',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true'
    }, [topEl, killerEl, metaEl, watchEl, progressWrap]);

    card.style.setProperty('--kc-accent', KC.accent);
    if (card.dataset) card.dataset.team = KC.team || 'free';
    headshotEl.hidden = !KC.headshot;
    card.setAttribute('aria-label', 'Killed by ' + (KC.killerName || 'unknown') +
      ' with ' + killcamWeaponName(KC.weaponId) + ', ' + KC.distanceText);

    try { document.body.appendChild(card); } catch (e) { return; }
    KC.card = card;
    KC.els = {
      headshot: headshotEl,
      killer: killerEl,
      weapon: weaponEl,
      dist: distEl,
      watch: watchText,
      progress: progressEl
    };

    // Force a style flush so the 160 ms fade/scale-in really transitions.
    void card.offsetWidth;
    card.classList.add('show');
  }

  function killcamUpdateCard(remaining) {
    if (!KC.card || !KC.els) return;
    var p = killcamClamp(remaining / KC.duration, 0, 1);
    var q = Math.round(p * 200) / 200;
    if (q !== KC.lastProgress) {
      KC.els.progress.style.transform = 'scaleX(' + q + ')';
      KC.lastProgress = q;
    }
    if (!KC.dismissed && remaining <= KILLCAM_RETURN) {
      KC.dismissed = true;
      KC.card.classList.add('dismiss');
    }
  }

  function killcamShowInternal(info, victimName, killerName) {
    try {
      if (!killcamEnsureThree()) return;
      if (typeof camera === 'undefined' || !camera) return;
      info = info && typeof info === 'object' ? info : {};
      killcamHide();

      var victim = killcamSafeName(victimName || info.victim || info.victimName) ||
        (typeof playerName !== 'undefined' ? killcamSafeName(playerName) : '') || 'YOU';
      var killer = killcamSafeName(killerName || info.by || info.killer || info.killerName) ||
        'UNKNOWN';
      var byId = info.byId != null ? String(info.byId) : '';
      var weapon = info.weapon;
      if (weapon && typeof weapon === 'object') weapon = weapon.id || weapon.name;

      KC.active = true;
      KC.killerName = killer;
      KC.victimName = victim;
      KC.byId = byId;
      KC.weaponId = weapon ? String(weapon) : '';
      KC.headshot = !!(info.head || info.headshot);
      KC.elapsed = 0;
      KC.drift = 0;
      KC.heartbeatAt = 0;
      KC.dismissed = false;
      KC.lastProgress = -1;
      KC.smoothReady = false;
      KC.distance = NaN;
      KC.distanceText = '\u2014';
      KC.mode = 'orbit';
      KC.killerRemote = null;
      KC.infoPosValid = false;

      var haveVictim = false;
      if (typeof player !== 'undefined' && player && player.pos) {
        haveVictim = killcamReadPos(player.pos, KC.victimPos);
      }
      if (!haveVictim) haveVictim = killcamReadPos(info.victimPos, KC.victimPos);
      if (!haveVictim) {
        KC.victimPos.x = camera.position.x;
        KC.victimPos.y = camera.position.y;
        KC.victimPos.z = camera.position.z;
      }

      KC.infoPosValid = killcamReadPos(info.pos, KC.infoPos) ||
        killcamReadPos(info.killerPos, KC.infoPos);

      if (!killcamCaptureStart()) {
        KC.active = false;
        return;
      }

      var vx = KC.victimPos.x - KC.startPos.x;
      var vz = KC.victimPos.z - KC.startPos.z;
      if (vx * vx + vz * vz > 1e-4) KC.fallbackYaw = Math.atan2(-vx, -vz);
      else if (typeof player !== 'undefined' && player && Number.isFinite(player.yaw)) {
        KC.fallbackYaw = player.yaw;
      } else {
        KC.fallbackYaw = 0;
      }

      killcamResolveKiller();
      KC.hadRemote = KC.mode === 'remote';
      if (!KC.weaponId && KC.killerRemote && KC.killerRemote.weapon) {
        KC.weaponId = String(KC.killerRemote.weapon);
      }
      KC.team = killcamTeam(info);
      KC.accent = typeof BC.teamColor === 'function'
        ? BC.teamColor(KC.team) : (KC.team === 'red' ? '#ff3556' : KC.team === 'blue' ? '#3585ff' : '#d8e6f2');

      if (KC.mode !== 'orbit') {
        var ddx = KC.victimPos.x - KC.killerPos.x;
        var ddy = KC.victimPos.y - KC.killerPos.y;
        var ddz = KC.victimPos.z - KC.killerPos.z;
        var dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
        if (Number.isFinite(dist)) {
          KC.distance = dist;
          KC.distanceText = Math.max(0, Math.round(dist)) + ' M';
        }
      }

      KC.deadline = BC.now() + KILLCAM_DURATION * 1000;
      killcamBuildCard();

      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('killcam');
      }
      if (BC.flags) BC.flags.killcamActive = true;
      if (typeof vmRoot !== 'undefined' && vmRoot) vmRoot.visible = false;

      if (typeof BC.emit === 'function') {
        BC.emit('sfx', {
          kind: 'killcam',
          position: { x: KC.killerPos.x, y: KC.killerPos.y, z: KC.killerPos.z },
          volume: 0.9
        });
      }
    } catch (err) {
      console.error('[BC] killcam show failed', err);
      killcamHide();
    }
  }

  function killcamShow(info) {
    var data = info && typeof info === 'object' ? info : {};
    killcamShowInternal(data,
      data.victim || data.victimName,
      data.by || data.killer || data.killerName || data.byName);
  }

  function killcamHide() {
    KC.active = false;
    KC.haveStart = false;
    KC.smoothReady = false;
    KC.killerRemote = null;
    KC.hadRemote = false;
    KC.elapsed = 0;
    KC.drift = 0;
    KC.dismissed = false;
    KC.lastProgress = -1;
    KC.heartbeatAt = 0;
    KC.infoPosValid = false;

    if (KC.card && KC.card.parentNode) KC.card.parentNode.removeChild(KC.card);
    KC.card = null;
    KC.els = null;

    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('killcam');
    }
    if (KC.fovTouched && typeof camera !== 'undefined' && camera &&
        typeof camera.updateProjectionMatrix === 'function') {
      // Death may have started through a sniper optic. Restoring that old FOV
      // after respawn would zoom the normal camera back in without a scope.
      var restoreFov = 74;
      if (typeof isScopeActive === 'function' && isScopeActive() && typeof currentWeapon === 'function') {
        var optic = currentWeapon();
        if (optic && Number.isFinite(optic.scopeFov)) restoreFov = optic.scopeFov;
      }
      camera.fov = restoreFov;
      camera.updateProjectionMatrix();
    }
    KC.fovTouched = false;
    if (BC.flags) BC.flags.killcamActive = false;
  }

  function killcamUpdate(dt) {
    if (!KC.active) return;
    if (!killcamEnsureThree()) { killcamHide(); return; }
    if (typeof camera === 'undefined' || !camera) { killcamHide(); return; }
    dt = Number.isFinite(dt) ? killcamClamp(dt, 0, 0.1) : 0;

    var now = BC.now();
    KC.elapsed += dt;

    if (typeof alive !== 'undefined' && alive === true) { killcamHide(); return; }

    var remaining = Math.min(KC.duration - KC.elapsed, (KC.deadline - now) / 1000);
    if (!(remaining > 0)) { killcamHide(); return; }

    // Capture what updateCamera produced this frame before overriding it.
    KC.normalPos.x = camera.position.x;
    KC.normalPos.y = camera.position.y;
    KC.normalPos.z = camera.position.z;
    KC.normalFov = Number.isFinite(camera.fov) ? camera.fov : 74;
    KC.normalQuat.copy(camera.quaternion);

    if (!KC.haveStart && !killcamCaptureStart()) { killcamHide(); return; }

    // Resolve the killer live so the camera follows a moving remote avatar.
    killcamResolveKiller();

    var reduced = killcamReduced();
    if (!reduced) KC.drift += KILLCAM_ORBIT_SPEED * dt;

    var orbit = KC.mode === 'orbit';
    var centerX = orbit ? KC.victimPos.x : KC.killerPos.x;
    var centerY = orbit ? KC.victimPos.y : KC.killerPos.y;
    var centerZ = orbit ? KC.victimPos.z : KC.killerPos.z;
    var baseYaw = orbit ? KC.fallbackYaw : KC.killerYaw;
    if (!Number.isFinite(baseYaw)) baseYaw = KC.fallbackYaw;
    var angle = baseYaw + KC.drift;
    var dist = orbit ? KILLCAM_ORBIT_DISTANCE : KILLCAM_DISTANCE;
    var height = orbit ? KILLCAM_ORBIT_HEIGHT : KILLCAM_HEIGHT;
    var shoulder = orbit ? KILLCAM_ORBIT_SHOULDER : KILLCAM_SHOULDER;
    var sinA = Math.sin(angle);
    var cosA = Math.cos(angle);

    var wantX = centerX + sinA * dist + cosA * shoulder;
    var wantY = centerY + height;
    var wantZ = centerZ + cosA * dist - sinA * shoulder;

    // Subtle breathing sway, suppressed for reduced motion.
    if (!reduced) {
      wantY += Math.sin(KC.elapsed * 1.7) * 0.03;
      var side = Math.sin(KC.elapsed * 0.9) * 0.02;
      wantX += cosA * side;
      wantZ -= sinA * side;
    }

    // Smooth follow: a moving killer never snaps the camera.
    if (!KC.smoothReady) {
      KC.smoothPos.x = wantX;
      KC.smoothPos.y = wantY;
      KC.smoothPos.z = wantZ;
      KC.smoothReady = true;
    } else {
      var follow = 1 - Math.exp(-9 * dt);
      KC.smoothPos.x += (wantX - KC.smoothPos.x) * follow;
      KC.smoothPos.y += (wantY - KC.smoothPos.y) * follow;
      KC.smoothPos.z += (wantZ - KC.smoothPos.z) * follow;
    }

    var clearX = KC.smoothPos.x;
    var clearY = KC.smoothPos.y;
    var clearZ = KC.smoothPos.z;
    var originY = centerY + (orbit ? 1.2 : 1.45);

    // Pull the camera in before a wall rather than rendering inside it.
    var keep = 1;
    var steps = 14;
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      if (killcamBlockSolid(
        centerX + (clearX - centerX) * t,
        originY + (clearY - originY) * t,
        centerZ + (clearZ - centerZ) * t
      )) {
        keep = (i - 1) / steps;
        break;
      }
    }
    if (keep < 1) {
      keep = Math.max(0.12, keep * 0.94);
      clearX = centerX + (clearX - centerX) * keep;
      clearY = originY + (clearY - originY) * keep;
      clearZ = centerZ + (clearZ - centerZ) * keep;
    }

    // Keep the lens above the terrain and step out of any solid voxels.
    if (typeof terrainHeight === 'function') {
      var ground = terrainHeight(Math.floor(clearX), Math.floor(clearZ));
      if (Number.isFinite(ground) && clearY < ground + 1.0) clearY = ground + 1.0;
    }
    for (var s = 0; s < 10 && killcamPointBlocked(clearX, clearY, clearZ); s++) {
      clearY += 0.28;
    }

    var blendIn = reduced ? 1 : killcamSmoothStep(Math.min(1, KC.elapsed / KILLCAM_BLEND));
    var returnT = reduced ? 0
      : killcamSmoothStep((KILLCAM_RETURN - remaining) / KILLCAM_RETURN);

    var fx = KC.startPos.x + (clearX - KC.startPos.x) * blendIn;
    var fy = KC.startPos.y + (clearY - KC.startPos.y) * blendIn;
    var fz = KC.startPos.z + (clearZ - KC.startPos.z) * blendIn;
    if (returnT > 0) {
      fx += (KC.normalPos.x - fx) * returnT;
      fy += (KC.normalPos.y - fy) * returnT;
      fz += (KC.normalPos.z - fz) * returnT;
    }
    camera.position.set(fx, fy, fz);

    KC.look.set(KC.victimPos.x, KC.victimPos.y + 1.05, KC.victimPos.z);
    camera.lookAt(KC.look);

    if (blendIn < 1 || returnT > 0) {
      KC.blendQuat.copy(KC.startQuat).slerp(camera.quaternion, blendIn);
      camera.quaternion.copy(KC.blendQuat);
      if (returnT > 0) camera.quaternion.slerp(KC.normalQuat, returnT);
    }

    var cinemaFov = KC.startFov + (KILLCAM_FOV - KC.startFov) * blendIn;
    var fov = cinemaFov + (KC.normalFov - cinemaFov) * returnT;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      KC.fovTouched = true;
    }
    camera.updateMatrixWorld(true);

    // The first-person view gun lives on the camera; keep it out of the shot.
    if (typeof vmRoot !== 'undefined' && vmRoot) vmRoot.visible = false;

    killcamUpdateCard(remaining);

    KC.heartbeatAt += dt;
    while (KC.heartbeatAt >= KILLCAM_HEARTBEAT) {
      KC.heartbeatAt -= KILLCAM_HEARTBEAT;
      if (typeof BC.emit === 'function') {
        BC.emit('sfx', {
          kind: 'heartbeat',
          position: { x: KC.victimPos.x, y: KC.victimPos.y, z: KC.victimPos.z },
          volume: 0.16
        });
      }
    }
  }

  function killcamOnDeath(victimName, killerName, info) {
    try {
      killcamShowInternal(info, victimName, killerName);
    } catch (err) {
      console.error('[BC] killcam death handler failed', err);
      killcamHide();
    }
  }

  function killcamOnLateFrame(dt) {
    if (!KC.active) return;
    try {
      killcamUpdate(dt);
    } catch (err) {
      console.error('[BC] killcam update failed', err);
      killcamHide();
    }
  }

  var killcamApi = {
    get active() { return KC.active; },
    get killer() { return KC.killerName; },
    show: killcamShow,
    hide: killcamHide,
    update: killcamUpdate,
    victimPos: KC.victimPos,
    killerPos: KC.killerPos
  };

  BC.api.killcam = killcamApi;
  if (BC.flags) BC.flags.killcamActive = false;

  BC.on('death', killcamOnDeath);
  BC.on('respawn', killcamHide);
  BC.on('worldReset', killcamHide);
  BC.on('lateFrame', killcamOnLateFrame, 100);
})();
