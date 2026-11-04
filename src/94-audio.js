/* Blockcraft Battle Ground — Proximity + directional SFX engine.
   94-audio.js
   Loads after 90-net.js (and after 60-combat.js so the shared audio() context
   can be reused). Builds a WebAudio graph:
     BufferSource -> BiquadFilter -> Gain -> PannerNode -> master -> limiter
   CC0 firearm excerpts come from assets/audio/weapon-samples.js, a classic
   script containing base64 audio, not runtime fetches (including on file://).
   Decode once after a user gesture; bake small procedural transient/body/
   mechanism layers into cached mono buffers, so each round uses ONE voice.
   Reloads, actions and other game sounds are procedural, not sourced recordings.
   See assets/audio/LICENCES.md for provenance and the AK-47-to-LMG adaptation.
   Without assets/decoding/WebAudio, the existing procedural/no-op fallback stays. */
'use strict';

(function () {
  var BCR = window.BC;
  if (!BCR || typeof BCR.on !== 'function') return;
  if (BCR.api && BCR.api.audio && BCR.api.audio.__spatial) return;

  var AC = window.AudioContext || window.webkitAudioContext || null;

  var MAX_VOICES = 24;
  var REF_DISTANCE = 6;
  var MAX_DISTANCE = 90;
  var ROLLOFF = 1.35;
  var MAX_POOL = 20;

  var ctx = null;
  var master = null;
  var limiter = null;
  var outputGuard = null;
  var graphReady = false;
  var gestureSeen = false;

  var sfxVolume = 0.8;
  var sfxMuted = false;

  var buffers = new Map();
  var recordedBuffers = Object.create(null);
  var voices = [];
  var pool = [];
  var warmingDone = false;
  var sampleStarted = false;
  var sampleState = 'waiting';
  var sampleReady = 0;
  var sampleFailed = 0;
  var samplePending = 0;
  var samplePlayCount = 0;
  var proceduralShotCount = 0;

  var playCount = 0;
  var dropCount = 0;
  var occludedCount = 0;

  /* Listener cache, updated every frame without allocating. */
  var lx = 0, ly = 0, lz = 0;
  var fx = 0, fy = 0, fz = -1;
  var ux = 0, uy = 1, uz = 0;
  var rx = 1, ry = 0, rz = 0;
  var listenerLive = false;
  var explicitCamera = null;

  /* Combat/network own sfx events; do not infer extra shots from poses or
     damage/feed hooks. Only respawn retains its older lifecycle fallback. */
  var lastRespawnSfx = -1e9;

  var jetpackLoop = null;

  /* ------------------------------------------------------------------ utils */

  function now() {
    try { return BCR.now(); } catch (e) { return Date.now(); }
  }

  function clamp(v, lo, hi) {
    v = Number(v);
    if (!isFinite(v)) return lo;
    return v < lo ? lo : v > hi ? hi : v;
  }

  function num(v, fallback) {
    v = Number(v);
    return isFinite(v) ? v : fallback;
  }

  function settingsObject() {
    try { return (BCR.api && BCR.api.settings) || BCR.settings || null; } catch (e) { return null; }
  }

  function readSetting(key) {
    var s = settingsObject();
    if (!s) return undefined;
    try {
      var v = s[key];
      if (v !== undefined) return v;
    } catch (e) { /* getter threw */ }
    try { if (typeof s.get === 'function') return s.get(key); } catch (e2) { /* ignore */ }
    return undefined;
  }

  function refreshSettings() {
    var v = readSetting('volume');
    if (v !== undefined) sfxVolume = clamp(v, 0, 1);
    var m = readSetting('muted');
    if (m !== undefined) sfxMuted = !!m;
  }

  function targetMasterGain() {
    return sfxMuted ? 0 : sfxVolume * 0.9;
  }

  function setParam(param, value) {
    if (!param) return;
    try { param.value = value; } catch (e) {
      try { param.setValueAtTime(value, ctx ? ctx.currentTime : 0); } catch (e2) { /* ignore */ }
    }
  }

  function rampMaster(seconds) {
    if (!master || !ctx) return;
    var target = targetMasterGain();
    var t = ctx.currentTime;
    var g = master.gain;
    try {
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0, g.value), t);
      g.linearRampToValueAtTime(target, t + (seconds || 0.08));
    } catch (e) {
      try { g.value = target; } catch (e2) { /* ignore */ }
    }
  }

  /* -------------------------------------------------------- audio context */

  function syncReady() {
    if (graphReady && ctx && ctx.state === 'running') {
      if (!api.available) api.available = true;
    } else if (api.available) {
      api.available = false;
    }
  }

  function buildGraph() {
    if (!ctx || graphReady) return;
    try {
      master = ctx.createGain();
      master.gain.value = targetMasterGain();
      var output = ctx.destination;
      try {
        // Transparent through ordinary levels; bound stacked transients even
        // during a compressor's attack. This curve is allocated only once.
        outputGuard = ctx.createWaveShaper();
        var curve = new Float32Array(1025);
        for (var i = 0; i < curve.length; i++) {
          var x = i * 2 / (curve.length - 1) - 1;
          var a = Math.abs(x);
          curve[i] = (x < 0 ? -1 : 1) * (a <= 0.82 ? a : 0.82 + 0.12 * (1 - Math.exp(-(a - 0.82) / 0.12)));
        }
        outputGuard.curve = curve;
        outputGuard.connect(ctx.destination);
        output = outputGuard;
      } catch (guardError) { outputGuard = null; }
      try {
        limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -16;
        limiter.knee.value = 12;
        limiter.ratio.value = 8;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.18;
        master.connect(limiter);
        limiter.connect(output);
      } catch (e) {
        limiter = null;
        master.connect(output);
      }
      graphReady = true;
    } catch (err) {
      master = null;
      graphReady = false;
    }
    syncReady();
  }

  /* Adopt the combat module's context when possible so the whole game shares
     one AudioContext and one output chain. Only create our own when no combat
     audio module exists at all. */
  function ensureContext() {
    gestureSeen = true;
    if (ctx) {
      if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
        try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
      }
      prepareAudio();
      syncReady();
      return;
    }
    if (!AC) return;
    var shared = null;
    if (typeof audio === 'function') {
      try { shared = audio(); } catch (e) { shared = null; }
      if (shared && typeof shared.createBufferSource === 'function') ctx = shared;
      else return; /* combat owns a context that is currently muted/unavailable */
    } else {
      try { ctx = new AC(); } catch (e2) { ctx = null; }
    }
    if (!ctx) return;
    if (typeof ctx.addEventListener === 'function') {
      try { ctx.addEventListener('statechange', syncReady); } catch (e3) { /* ignore */ }
    }
    buildGraph();
    prepareAudio();
  }

  function resume() {
    if (!ctx) {
      if (!gestureSeen) return Promise.resolve(false);
      ensureContext();
    }
    if (!ctx) return Promise.resolve(false);
    var settle = function () { syncReady(); return api.available; };
    try {
      if (ctx.state === 'running') return Promise.resolve(settle());
      var p = typeof ctx.resume === 'function' ? ctx.resume() : null;
      if (p && typeof p.then === 'function') return p.then(settle, function () { return false; });
    } catch (e) { /* ignore */ }
    return Promise.resolve(settle());
  }

  /* ------------------------------------------------------------- listener */

  function resolveCamera() {
    if (explicitCamera) return explicitCamera;
    try {
      if (typeof camera !== 'undefined' && camera) return camera;
    } catch (e) { /* ignore */ }
    return null;
  }

  function updateListener(force) {
    var cam = resolveCamera();
    if (!cam) return;
    // Killcam/ride handlers may have changed the transform after updateCamera;
    // renderer.render has not refreshed matrixWorld at lateFrame yet.
    try {
      if (typeof cam.updateWorldMatrix === 'function') cam.updateWorldMatrix(true, false);
      else if (typeof cam.updateMatrixWorld === 'function') cam.updateMatrixWorld(true);
    } catch (e) { /* Minimal/legacy cameras still expose position/rotation. */ }
    var px = 0, py = 0, pz = 0;
    var m = cam.matrixWorld && cam.matrixWorld.elements;
    if (m) { px = num(m[12], 0); py = num(m[13], 0); pz = num(m[14], 0); }
    else if (cam.position) { px = num(cam.position.x, 0); py = num(cam.position.y, 0); pz = num(cam.position.z, 0); }

    var nfx = 0, nfy = 0, nfz = -1, nux = 0, nuy = 1, nuz = 0;
    if (m) {
      nfx = -num(m[8], 0); nfy = -num(m[9], 0); nfz = -num(m[10], -1);
      nux = num(m[4], 0); nuy = num(m[5], 1); nuz = num(m[6], 0);
    } else if (cam.rotation) {
      var cp = Math.cos(num(cam.rotation.x, 0)), sp = Math.sin(num(cam.rotation.x, 0));
      var cy = Math.cos(num(cam.rotation.y, 0)), sy = Math.sin(num(cam.rotation.y, 0));
      nfx = -sy * cp; nfy = sp; nfz = -cy * cp;
    }
    var fl = Math.sqrt(nfx * nfx + nfy * nfy + nfz * nfz) || 1;
    nfx /= fl; nfy /= fl; nfz /= fl;
    var ul = Math.sqrt(nux * nux + nuy * nuy + nuz * nuz) || 1;
    nux /= ul; nuy /= ul; nuz /= ul;

    lx = px; ly = py; lz = pz;
    fx = nfx; fy = nfy; fz = nfz;
    ux = nux; uy = nuy; uz = nuz;
    /* Screen-right = forward x up. */
    rx = fy * uz - fz * uy;
    ry = fz * ux - fx * uz;
    rz = fx * uy - fy * ux;
    var rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    listenerLive = true;

    if (!ctx || !ctx.listener) return;
    var L = ctx.listener;
    if (L.positionX) {
      setParam(L.positionX, lx);
      setParam(L.positionY, ly);
      setParam(L.positionZ, lz);
      setParam(L.forwardX, fx);
      setParam(L.forwardY, fy);
      setParam(L.forwardZ, fz);
      setParam(L.upX, ux);
      setParam(L.upY, uy);
      setParam(L.upZ, uz);
    } else {
      try { if (typeof L.setPosition === 'function') L.setPosition(lx, ly, lz); } catch (e) { /* ignore */ }
      try { if (typeof L.setOrientation === 'function') L.setOrientation(fx, fy, fz, ux, uy, uz); } catch (e2) { /* ignore */ }
    }
    if (force) syncReady();
  }

  /* ---------------------------------------------------------------- public */

  var api = {
    available: false,
    get recordedKinds() { return Object.keys(recordedBank).sort(); },
    play: function (info) { return play(info); },
    spatialize: function (kind, position, opts) {
      opts = opts || {};
      return play({
        kind: kind,
        position: position,
        volume: opts.volume,
        team: opts.team,
        weapon: opts.weapon,
        occluded: opts.occluded,
        rate: opts.rate,
        action: opts.action
      });
    },
    setListener: function (cam) {
      explicitCamera = cam || null;
      if (cam) updateListener(true);
    },
    setVolume: function (v) { setVolume(v); },
    setMuted: function (v) { setMuted(v, false); },
    resume: function () { return resume(); },
    stats: function () {
      return {
        available: !!api.available,
        context: ctx ? String(ctx.state) : 'none',
        sampleRate: ctx ? ctx.sampleRate : 0,
        voices: voices.length + (jetpackLoop ? 1 : 0),
        maxVoices: MAX_VOICES,
        pooled: pool.length,
        buffers: buffers.size + sampleReady,
        played: playCount,
        dropped: dropCount,
        occluded: occludedCount,
        sampleState: sampleState,
        sampledWeapons: sampleReady,
        sampleFailures: sampleFailed,
        sampleShots: samplePlayCount,
        proceduralShots: proceduralShotCount,
        listeners: listenerLive ? 1 : 0,
        volume: Math.round(sfxVolume * 100) / 100,
        muted: !!sfxMuted
      };
    },
    weaponSource: function (id) {
      id = String(id || '').toLowerCase();
      if (SHOT_IDS[id] !== 1) return null;
      var asset = window.BCWeaponSamples;
      var entry = asset && asset.entries && asset.entries[id];
      return {
        weapon: id,
        playback: recordedBuffers[id] ? 'recording + procedural layers' : 'procedural fallback',
        title: entry ? entry.title : null,
        creator: entry ? asset.creator : null,
        source: entry ? asset.sourceUrl : null,
        sourceFile: entry ? entry.sourceFile : null,
        licence: entry ? asset.licence : null,
        licenceUrl: entry ? asset.licenceUrl : null,
        sha256: entry ? entry.sha256 : null,
        adapted: id === 'lmg' ? 'AK-47 recording, processed as an LMG; not an original LMG recording' : null
      };
    },
    getContext: function () { return ctx || null; },
    __spatial: true
  };

  Object.defineProperty(api, 'muted', {
    enumerable: true,
    get: function () { return !!sfxMuted; },
    set: function (v) { setMuted(v, false); }
  });
  Object.defineProperty(api, 'volume', {
    enumerable: true,
    get: function () { return sfxVolume; },
    set: function (v) { setVolume(v); }
  });

  function setVolume(v) {
    sfxVolume = clamp(v, 0, 1);
    if (master) rampMaster(0.06);
    else syncReady();
  }

  function setMuted(v, persist) {
    var next = !!v;
    var changed = next !== sfxMuted;
    sfxMuted = next;
    if (master) rampMaster(changed ? 0.05 : 0.12);
    if (!next && gestureSeen) ensureContext();
    if (persist && changed) {
      var s = settingsObject();
      try {
        if (s && typeof s.set === 'function') {
          var current = readSetting('muted');
          if (!!current !== sfxMuted) s.set('muted', sfxMuted);
        }
      } catch (e) { /* never break the toggle on a storage error */ }
    }
  }

  refreshSettings();

  /* ----------------------------------------------------------------- voices */

  function setPannerPosition(chain, x, y, z) {
    var p = chain.panner;
    if (!p) return;
    if (p.positionX) {
      setParam(p.positionX, x);
      setParam(p.positionY, y);
      setParam(p.positionZ, z);
    } else if (typeof p.setPosition === 'function') {
      try { p.setPosition(x, y, z); } catch (e) { /* ignore */ }
    }
  }

  function makeChain() {
    var chain = { src: null, gain: null, filter: null, panner: null, stereo: null, stopAt: 0, effective: 0 };
    chain.gain = ctx.createGain();
    chain.gain.gain.value = 0.0001;
    try {
      chain.filter = ctx.createBiquadFilter();
      chain.filter.type = 'lowpass';
      chain.filter.Q.value = 0.6;
      chain.filter.frequency.value = 8000;
    } catch (e) { chain.filter = null; }

    if (typeof ctx.createPanner === 'function') {
      try {
        var p = ctx.createPanner();
        p.panningModel = 'HRTF';
        p.distanceModel = 'inverse';
        p.refDistance = REF_DISTANCE;
        p.maxDistance = MAX_DISTANCE;
        p.rolloffFactor = ROLLOFF;
        p.coneInnerAngle = 360;
        p.coneOuterAngle = 360;
        p.coneOuterGain = 1;
        chain.panner = p;
      } catch (e2) { chain.panner = null; }
    }
    if (!chain.panner && typeof ctx.createStereoPanner === 'function') {
      try { chain.stereo = ctx.createStereoPanner(); } catch (e3) { chain.stereo = null; }
    }

    if (chain.filter) chain.filter.connect(chain.gain);
    if (chain.panner) {
      chain.gain.connect(chain.panner);
      chain.panner.connect(master);
    } else if (chain.stereo) {
      chain.gain.connect(chain.stereo);
      chain.stereo.connect(master);
    } else {
      chain.gain.connect(master);
    }
    return chain;
  }

  function destroyChain(chain) {
    try { if (chain.src) { chain.src.onended = null; chain.src.disconnect(); } } catch (e) { /* ignore */ }
    try { if (chain.filter) chain.filter.disconnect(); } catch (e2) { /* ignore */ }
    try { if (chain.gain) chain.gain.disconnect(); } catch (e3) { /* ignore */ }
    try { if (chain.panner) chain.panner.disconnect(); } catch (e4) { /* ignore */ }
    try { if (chain.stereo) chain.stereo.disconnect(); } catch (e5) { /* ignore */ }
    chain.src = null;
  }

  function recycleChain(chain) {
    try {
      if (chain.src) {
        chain.src.onended = null;
        try { chain.src.disconnect(); } catch (e) { /* ignore */ }
        chain.src = null;
      }
    } catch (e2) { /* ignore */ }
    chain.stopAt = 0;
    chain.effective = 0;
    if (pool.length < MAX_POOL) pool.push(chain);
    else destroyChain(chain);
  }

  function acquireChain() {
    var chain = pool.pop();
    if (chain) {
      try { chain.gain.gain.cancelScheduledValues(ctx.currentTime); } catch (e) { /* ignore */ }
      setParam(chain.gain.gain, 0.0001);
      if (chain.filter) {
        setParam(chain.filter.frequency, 8000);
        setParam(chain.filter.Q, 0.6);
      }
      if (chain.stereo) setParam(chain.stereo.pan, 0);
      return chain;
    }
    return makeChain();
  }

  function pruneVoices() {
    if (!ctx) return;
    var t = ctx.currentTime;
    for (var i = voices.length - 1; i >= 0; i--) {
      var c = voices[i];
      if (!c.src || (c.stopAt && t > c.stopAt + 0.35)) {
        voices.splice(i, 1);
        recycleChain(c);
      }
    }
  }

  function stealVoice() {
    var worst = -1, worstScore = Infinity, worstStart = Infinity;
    for (var i = 0; i < voices.length; i++) {
      var c = voices[i];
      var s = c.effective;
      if (s < worstScore - 0.001 || (Math.abs(s - worstScore) <= 0.001 && c.stopAt < worstStart)) {
        worstScore = s;
        worstStart = c.stopAt;
        worst = i;
      }
    }
    if (worst < 0) return;
    var victim = voices.splice(worst, 1)[0];
    try {
      if (victim.src) {
        victim.src.onended = null;
        try { victim.src.stop(0); } catch (e) { /* ignore */ }
      }
    } catch (e2) { /* ignore */ }
    recycleChain(victim);
  }

  /* --------------------------------------------------------------- spatial */

  function blockSolidAt(x, y, z) {
    if (typeof getBlock !== 'function') return false;
    try {
      var b = getBlock(x, y, z);
      if (!b) return false;
      var water = typeof WATER === 'number' ? WATER : 10;
      var glass = typeof GLASS === 'number' ? GLASS : 11;
      return b !== water && b !== glass;
    } catch (e) { return false; }
  }

  function occludedBetween(ax, ay, az, bx, by, bz) {
    var dx = bx - ax, dy = by - ay, dz = bz - az;
    for (var i = 1; i <= 3; i++) {
      var t = i / 4;
      if (blockSolidAt(ax + dx * t, ay + dy * t, az + dz * t)) return true;
    }
    return false;
  }

  var spDist = 0, spPan = 0, spGain = 1, spOccluded = false, spHasPos = false;
  var posX = 0, posY = 0, posZ = 0;

  function readPosition(p) {
    spHasPos = false;
    posX = posY = posZ = 0;
    if (!p || typeof p !== 'object') return;
    var x = p.x, y = p.y, z = p.z;
    if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number' && isFinite(x) && isFinite(y) && isFinite(z)) {
      posX = x; posY = y; posZ = z;
      spHasPos = true;
    }
  }

  function computeSpatial(forceOccluded) {
    spOccluded = false;
    spPan = 0;
    spGain = 1;
    spDist = 0;
    if (!spHasPos) return true;
    var dx = posX - lx, dy = posY - ly, dz = posZ - lz;
    spDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (spDist > MAX_DISTANCE) return false;
    if (spDist > 0.001) {
      spPan = clamp((dx * rx + dy * ry + dz * rz) / spDist, -1, 1) * 0.85;
    }
    if (forceOccluded) spOccluded = true;
    else if (spDist > 2.5) spOccluded = occludedBetween(lx, ly, lz, posX, posY, posZ);
    if (spOccluded) occludedCount++;
    return true;
  }

  function tailFade(dist) {
    if (dist <= MAX_DISTANCE - 14) return 1;
    return clamp((MAX_DISTANCE - dist) / 14, 0, 1);
  }

  /* --------------------------------------------------------- buffer specs */

  var SHOT_SPEC = {
    pistol:   { dur: 0.32, cut: 6200, thump: 165, decay: 5.0, crack: 0.005, crackAmp: 0.60, thumpAmp: 0.38, drive: 1.35, vol: 0.55 },
    rifle:    { dur: 0.28, cut: 7200, thump: 155, decay: 6.0, crack: 0.004, crackAmp: 0.58, thumpAmp: 0.28, drive: 1.30, vol: 0.42 },
    shotgun:  { dur: 0.50, cut: 3100, thump:  88, decay: 3.2, crack: 0.010, crackAmp: 0.58, thumpAmp: 0.60, drive: 1.45, vol: 0.80 },
    smg:      { dur: 0.21, cut: 7900, thump: 205, decay: 7.2, crack: 0.003, crackAmp: 0.48, thumpAmp: 0.22, drive: 1.20, vol: 0.34 },
    sniper:   { dur: 0.64, cut: 4300, thump:  76, decay: 3.4, crack: 0.009, crackAmp: 0.80, thumpAmp: 0.65, drive: 1.45, vol: 0.95 },
    revolver: { dur: 0.40, cut: 5600, thump: 123, decay: 4.2, crack: 0.007, crackAmp: 0.70, thumpAmp: 0.48, drive: 1.40, vol: 0.73 },
    lmg:      { dur: 0.42, cut: 4800, thump: 102, decay: 4.8, crack: 0.006, crackAmp: 0.62, thumpAmp: 0.46, drive: 1.35, vol: 0.62 }
  };
  var SHOT_IDS = { pistol: 1, rifle: 1, shotgun: 1, smg: 1, sniper: 1, revolver: 1, lmg: 1 };
  var WEAPON_IDS = Object.keys(SHOT_IDS);
  var ACTION_IDS = { pump: 1, bolt: 1, cylinder: 1 };

  var KIND_SPEC = {
    impact:      { playCut: 2200, vol: 0.50, variants: 3 },
    hit:         { playCut: 4500, vol: 0.55, variants: 2 },
    reload:      { playCut: 5000, vol: 0.45, variants: 2 },
    pump:        { playCut: 4800, vol: 0.34, variants: 2 },
    bolt:        { playCut: 6200, vol: 0.30, variants: 2 },
    cylinder:    { playCut: 6500, vol: 0.32, variants: 2 },
    death:       { playCut: 2600, vol: 0.80, variants: 2 },
    respawn:     { playCut: 5000, vol: 0.50, variants: 2 },
    splash:      { playCut: 3200, vol: 0.50, variants: 2 },
    jetpackOn:   { playCut: 4000, vol: 0.50, variants: 2 },
    jetpackLoop: { playCut: 1800, vol: 0.40, variants: 1 },
    dragonRoar:  { playCut: 2200, vol: 0.85, variants: 2 },
    dragonBreath:{ playCut: 4200, vol: 0.80, variants: 2 },
    killcam:     { playCut: 1500, vol: 0.55, variants: 2 },
    confirm:     { playCut: 9000, vol: 0.42, variants: 1 },
    step:        { playCut: 5200, vol: 0.20, variants: 1 },
    land:        { playCut: 4200, vol: 0.40, variants: 1 },
    ui:          { playCut: 6000, vol: 0.35, variants: 2 }
  };

  var KIND_ALIAS = {
    shot: 'shot', gunshot: 'shot', fire: 'shot', weapon: 'shot', shots: 'shot',
    impact: 'impact', bulletimpact: 'impact', ricochet: 'impact', thud: 'impact',
    hit: 'hit', flesh: 'hit', damage: 'hit', hitmark: 'hit',
    reload: 'reload', reloading: 'reload',
    pump: 'pump', bolt: 'bolt', cylinder: 'cylinder',
    death: 'death', died: 'death', kill: 'death', eliminated: 'death',
    respawn: 'respawn', spawn: 'respawn',
    splash: 'splash', water: 'splash', swim: 'splash',
    jetpack: 'jetpackOn', jetpackon: 'jetpackOn', jetpackloop: 'jetpackLoop',
    dragonroar: 'dragonRoar', roar: 'dragonRoar', growl: 'dragonRoar',
    dragonbreath: 'dragonBreath', breath: 'dragonBreath', firebreath: 'dragonBreath',
    killcam: 'killcam', heartbeat: 'killcam',
    ui: 'ui', blip: 'ui', click: 'ui', beep: 'ui',
    confirm: 'confirm', killconfirm: 'confirm', step: 'step', footstep: 'step', land: 'land', landing: 'land'
  };

  function weaponReport(id) {
    try {
      if (typeof WEAPONS !== 'undefined' && WEAPONS) {
        for (var i = 0; i < WEAPONS.length; i++) {
          if (WEAPONS[i] && WEAPONS[i].id === id) return WEAPONS[i];
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function newBuffer(seconds) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * Math.max(0.02, seconds)));
    return ctx.createBuffer(1, len, ctx.sampleRate);
  }

  function addOsc(d, sr, at, dur, f0, f1, amp, type, swell) {
    var start = Math.floor(at * sr);
    var len = Math.max(1, Math.floor(dur * sr));
    var phase = 0;
    for (var j = 0; j < len; j++) {
      var idx = start + j;
      if (idx < 0 || idx >= d.length) continue;
      var p = j / len;
      var f = f0 + (f1 - f0) * p;
      phase += 6.283185307179586 * f / sr;
      var s;
      if (type === 'saw') s = ((phase / 6.283185307179586) % 1) * 2 - 1;
      else if (type === 'square') s = Math.sin(phase) >= 0 ? 1 : -1;
      else s = Math.sin(phase);
      var env = swell ? Math.sin(Math.PI * p) : Math.pow(1 - p, 2);
      d[idx] += s * amp * env;
    }
  }

  function addClick(d, sr, at, amp, freq) {
    var start = Math.floor(at * sr);
    var len = Math.max(1, Math.floor(sr * 0.05));
    for (var j = 0; j < len; j++) {
      var idx = start + j;
      if (idx < 0 || idx >= d.length) continue;
      var p = j / len;
      var env = Math.exp(-p * 9);
      var noise = Math.random() * 2 - 1;
      var s = noise * 0.7 + Math.sin(6.283185307179586 * freq * j / sr) * 0.5;
      d[idx] += s * amp * env;
    }
  }

  function finishBuffer(buf) {
    var d = buf.getChannelData(0), mean = 0, peak = 0;
    var i;
    for (i = 0; i < d.length; i++) mean += d[i];
    mean /= Math.max(1, d.length);
    for (i = 0; i < d.length; i++) {
      d[i] -= mean;
      if (Math.abs(d[i]) > peak) peak = Math.abs(d[i]);
    }
    var scale = peak > 0.78 ? 0.78 / peak : 1;
    var fade = Math.min(d.length / 3, Math.floor(buf.sampleRate * 0.012));
    for (i = 0; i < d.length; i++) {
      d[i] *= scale * Math.min(1, i / 4, (d.length - 1 - i) / Math.max(1, fade));
    }
    return buf;
  }

  function addRatchet(d, sr, at, dur, amp, cut, teeth) {
    var start = Math.floor(at * sr), len = Math.floor(dur * sr);
    var lp = 0, alpha = 1 - Math.exp(-6.283185307179586 * cut / sr);
    for (var i = 0; i < len && start + i < d.length; i++) {
      var p = i / Math.max(1, len);
      var noise = Math.random() * 2 - 1;
      lp += (noise - lp) * alpha;
      var ridge = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(p * teeth * 6.283185307179586)), 2);
      d[start + i] += (noise - lp) * amp * Math.sin(Math.PI * p) * ridge;
    }
  }

  /* These are synthesized supporting layers, never claimed as recordings.
     Pumps/bolt cycles are NOT scheduled here: combat owns their action events. */
  function addShotLayers(d, sr, weapon, strength) {
    if (weapon === 'pistol') {
      addClick(d, sr, 0.001, 0.16 * strength, 3700);
      addOsc(d, sr, 0.004, 0.09, 170, 78, 0.12 * strength, 'sine', false);
      addClick(d, sr, 0.030, 0.09 * strength, 1850);
    } else if (weapon === 'rifle') {
      addClick(d, sr, 0.001, 0.15 * strength, 4800);
      addClick(d, sr, 0.023, 0.08 * strength, 2250);
      addRatchet(d, sr, 0.046, 0.042, 0.08 * strength, 1700, 3);
    } else if (weapon === 'shotgun') {
      addOsc(d, sr, 0.002, 0.22, 88, 35, 0.33 * strength, 'sine', false);
      addOsc(d, sr, 0.008, 0.13, 175, 82, 0.11 * strength, 'sine', false);
      addClick(d, sr, 0.002, 0.10 * strength, 2350);
    } else if (weapon === 'smg') {
      addClick(d, sr, 0.001, 0.11 * strength, 5500);
      addClick(d, sr, 0.012, 0.09 * strength, 2800);
      addRatchet(d, sr, 0.032, 0.037, 0.09 * strength, 2100, 3);
    } else if (weapon === 'sniper') {
      addOsc(d, sr, 0.002, 0.33, 76, 28, 0.35 * strength, 'sine', false);
      addOsc(d, sr, 0.012, 0.22, 146, 63, 0.11 * strength, 'sine', false);
      addClick(d, sr, 0.001, 0.18 * strength, 4200);
    } else if (weapon === 'revolver') {
      addOsc(d, sr, 0.005, 0.15, 130, 57, 0.20 * strength, 'sine', false);
      addOsc(d, sr, 0.015, 0.12, 2430, 2230, 0.10 * strength, 'sine', false);
      addClick(d, sr, 0.027, 0.13 * strength, 1450);
    } else if (weapon === 'lmg') {
      addOsc(d, sr, 0.004, 0.19, 104, 43, 0.23 * strength, 'sine', false);
      addClick(d, sr, 0.022, 0.13 * strength, 1120);
      addRatchet(d, sr, 0.045, 0.11, 0.15 * strength, 1200, 7);
      addClick(d, sr, 0.103, 0.07 * strength, 850);
    }
  }

  function buildImpact() {
    var dur = 0.15 + Math.random() * 0.08;
    var buf = newBuffer(dur);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    var n = d.length;
    var cut = 800 + Math.random() * 900;
    var a = 1 - Math.exp(-6.283185307179586 * cut / sr);
    var lp = 0, phase = 0, f0 = 85 + Math.random() * 65;
    for (var i = 0; i < n; i++) {
      var p = i / n;
      var env = Math.pow(1 - p, 3.2);
      var noise = Math.random() * 2 - 1;
      lp += (noise - lp) * a;
      phase += 6.283185307179586 * f0 * (1 - p * 0.5) / sr;
      var v = lp * env * 1.25 + Math.sin(phase) * Math.pow(1 - p, 4) * 0.55;
      d[i] = Math.tanh(v * 1.3) * 0.9;
    }
    return buf;
  }

  function buildHit() {
    var dur = 0.075 + Math.random() * 0.03;
    var buf = newBuffer(dur);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    var n = d.length;
    var cut = 2200 + Math.random() * 1400;
    var a = 1 - Math.exp(-6.283185307179586 * cut / sr);
    var lp = 0, phase = 0, f0 = 170 + Math.random() * 80;
    for (var i = 0; i < n; i++) {
      var p = i / n;
      var env = Math.pow(1 - p, 4.5);
      var noise = Math.random() * 2 - 1;
      lp += (noise - lp) * a;
      phase += 6.283185307179586 * f0 / sr;
      var v = lp * env * 1.15 + Math.sin(phase) * Math.pow(1 - p, 5) * 0.45;
      d[i] = Math.tanh(v * 1.4) * 0.9;
    }
    return buf;
  }

  function buildReload(weapon) {
    var duration = { pistol: 0.40, rifle: 0.62, shotgun: 0.62, smg: 0.38, sniper: 0.72, revolver: 0.70, lmg: 0.96 };
    var buf = newBuffer(duration[weapon] || duration.rifle);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    if (weapon === 'pistol' || weapon === 'smg') {
      var compact = weapon === 'smg';
      addClick(d, sr, 0.015, 0.32, compact ? 2200 : 1650);
      addClick(d, sr, compact ? 0.13 : 0.19, 0.44, compact ? 1650 : 1050);
      addRatchet(d, sr, compact ? 0.20 : 0.26, 0.065, 0.24, 1400, 3);
      addClick(d, sr, compact ? 0.29 : 0.33, 0.30, 2100);
    } else if (weapon === 'shotgun') {
      // Tube-fed shell insertion, not a second automatic pump cycle.
      addClick(d, sr, 0.025, 0.28, 960);
      addOsc(d, sr, 0.045, 0.10, 280, 155, 0.11, 'sine', false);
      addClick(d, sr, 0.23, 0.32, 1250);
      addRatchet(d, sr, 0.31, 0.12, 0.17, 1800, 4);
      addClick(d, sr, 0.48, 0.24, 860);
    } else if (weapon === 'revolver') {
      addClick(d, sr, 0.012, 0.36, 2150);
      addRatchet(d, sr, 0.08, 0.09, 0.23, 1900, 6);
      for (var i = 0; i < 6; i++) addClick(d, sr, 0.20 + i * 0.039, 0.15, 2650 + i * 80);
      addClick(d, sr, 0.56, 0.40, 1450);
      addOsc(d, sr, 0.57, 0.08, 2200, 2050, 0.09, 'sine', false);
    } else if (weapon === 'lmg') {
      addClick(d, sr, 0.02, 0.42, 720);
      addClick(d, sr, 0.085, 0.25, 1100);
      addRatchet(d, sr, 0.17, 0.29, 0.26, 1300, 13);
      addClick(d, sr, 0.60, 0.48, 860);
      addRatchet(d, sr, 0.70, 0.10, 0.25, 1750, 5);
      addClick(d, sr, 0.84, 0.36, 1230);
    } else {
      var precision = weapon === 'sniper';
      addClick(d, sr, 0.02, 0.30, precision ? 1400 : 2100);
      addRatchet(d, sr, 0.17, 0.10, 0.19, 1800, 4);
      addClick(d, sr, precision ? 0.34 : 0.30, 0.43, precision ? 850 : 1200);
      addRatchet(d, sr, precision ? 0.47 : 0.41, 0.09, 0.22, precision ? 2100 : 1700, 4);
      addClick(d, sr, precision ? 0.61 : 0.52, 0.32, precision ? 2650 : 1850);
    }
    return finishBuffer(buf);
  }

  function buildAction(kind) {
    var buf = newBuffer(kind === 'pump' ? 0.34 : kind === 'bolt' ? 0.28 : 0.25);
    var sr = ctx.sampleRate, d = buf.getChannelData(0);
    if (kind === 'pump') {
      addClick(d, sr, 0.006, 0.44, 950);
      addRatchet(d, sr, 0.055, 0.11, 0.27, 1200, 6);
      addClick(d, sr, 0.21, 0.53, 720);
      addOsc(d, sr, 0.212, 0.07, 155, 90, 0.18, 'sine', false);
    } else if (kind === 'bolt') {
      addClick(d, sr, 0.006, 0.35, 2750);
      addRatchet(d, sr, 0.038, 0.09, 0.25, 2400, 5);
      addClick(d, sr, 0.17, 0.46, 1900);
      addOsc(d, sr, 0.175, 0.065, 3100, 2700, 0.12, 'sine', false);
    } else {
      addClick(d, sr, 0.006, 0.41, 1750);
      addRatchet(d, sr, 0.055, 0.065, 0.21, 2500, 6);
      addClick(d, sr, 0.14, 0.36, 2400);
      addOsc(d, sr, 0.145, 0.07, 2850, 2500, 0.12, 'sine', false);
    }
    return finishBuffer(buf);
  }

  function buildDeath() {
    var dur = 0.95;
    var buf = newBuffer(dur);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    var n = d.length;
    var phase = 0;
    var lp = 0;
    var a = 1 - Math.exp(-6.283185307179586 * 700 / sr);
    for (var i = 0; i < n; i++) {
      var p = i / n;
      var t = i / sr;
      var f = 32 + 118 * Math.pow(1 - p, 1.5);
      phase += 6.283185307179586 * f / sr;
      var saw = ((phase / 6.283185307179586) % 1) * 2 - 1;
      var noise = Math.random() * 2 - 1;
      lp += (noise - lp) * a;
      var attack = Math.min(1, t / 0.012);
      var env = attack * Math.pow(1 - p, 1.35);
      var trem = 0.82 + 0.18 * Math.sin(6.283185307179586 * 9 * t);
      d[i] = Math.tanh((saw * 0.6 + lp * 0.4) * env * trem * 1.1) * 0.9;
    }
    return buf;
  }

  function buildRespawn() {
    var buf = newBuffer(0.72);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    addOsc(d, sr, 0.02, 0.24, 320, 520, 0.30, 'sine', true);
    addOsc(d, sr, 0.02, 0.24, 640, 1040, 0.09, 'sine', true);
    addOsc(d, sr, 0.28, 0.40, 480, 780, 0.28, 'sine', true);
    addOsc(d, sr, 0.28, 0.40, 960, 1560, 0.08, 'sine', true);
    for (var i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * 1.2) * 0.9;
    return buf;
  }

  function buildSplash() {
    var buf = newBuffer(0.46);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    var n = d.length;
    var lp = 0;
    for (var i = 0; i < n; i++) {
      var p = i / n;
      var t = i / sr;
      var cut = 900 + 3200 * Math.pow(1 - p, 1.6);
      var a = 1 - Math.exp(-6.283185307179586 * cut / sr);
      lp += ((Math.random() * 2 - 1) - lp) * a;
      var attack = Math.min(1, t / 0.008);
      var env = attack * Math.pow(1 - p, 1.7);
      var v = lp * env * 1.4 + Math.sin(6.283185307179586 * 720 * t) * Math.pow(1 - p, 6) * 0.15;
      d[i] = Math.tanh(v * 1.1) * 0.85;
    }
    return buf;
  }

  function buildJetpackOn() {
    var buf = newBuffer(0.62);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    var n = d.length;
    var lp = 0;
    for (var i = 0; i < n; i++) {
      var p = i / n;
      var cut = 420 + 2300 * p;
      var a = 1 - Math.exp(-6.283185307179586 * cut / sr);
      lp += ((Math.random() * 2 - 1) - lp) * a;
      var env = Math.pow(Math.sin(Math.PI * p), 0.8);
      var v = lp * env * 1.3 + Math.sin(6.283185307179586 * (70 + 110 * p) * (i / sr)) * env * 0.18;
      d[i] = Math.tanh(v * 1.2) * 0.85;
    }
    return buf;
  }

  function buildJetpackLoop() {
    var dur = 1.2;
    var buf = newBuffer(dur);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    var n = d.length;
    var lp = 0;
    var a = 1 - Math.exp(-6.283185307179586 * 1500 / sr);
    for (var i = 0; i < n; i++) {
      var t = i / sr;
      lp += ((Math.random() * 2 - 1) - lp) * a;
      var mod = 0.72 + 0.28 * Math.sin(6.283185307179586 * 4.5 * t);
      var v = lp * 1.15 * mod + Math.sin(6.283185307179586 * 58 * t) * 0.16;
      d[i] = Math.tanh(v * 1.05) * 0.8;
    }
    var xf = Math.min(n - 1, Math.floor(sr * 0.03));
    for (var j = 0; j < xf; j++) {
      var w = j / xf;
      d[n - xf + j] = d[n - xf + j] * (1 - w) + d[j] * w;
    }
    var mean = 0;
    for (var k = 0; k < n; k++) mean += d[k];
    mean /= n;
    for (var m = 0; m < n; m++) d[m] -= mean;
    return buf;
  }

  function buildDragonRoar() {
    var dur = 1.7;
    var buf = newBuffer(dur);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    var n = d.length;
    var ph1 = 0, ph2 = 0, lp = 0;
    var a = 1 - Math.exp(-6.283185307179586 * 520 / sr);
    for (var i = 0; i < n; i++) {
      var p = i / n;
      var t = i / sr;
      var f = 52 + 7 * Math.sin(6.283185307179586 * 3.1 * t) + 3 * Math.sin(6.283185307179586 * 7.3 * t);
      ph1 += 6.283185307179586 * f / sr;
      ph2 += 6.283185307179586 * f * 1.51 / sr;
      var s1 = ((ph1 / 6.283185307179586) % 1) * 2 - 1;
      var s2 = ((ph2 / 6.283185307179586) % 1) * 2 - 1;
      lp += ((Math.random() * 2 - 1) - lp) * a;
      var attack = Math.min(1, t / 0.12);
      var env = attack * Math.pow(1 - p, 1.1);
      var growl = 0.75 + 0.25 * Math.sin(6.283185307179586 * 13 * t);
      d[i] = Math.tanh((s1 * 0.45 + s2 * 0.22 + lp * 0.5) * env * growl * 1.1) * 0.92;
    }
    return buf;
  }

  function buildDragonBreath() {
    var dur = 1.5;
    var buf = newBuffer(dur);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    var n = d.length;
    var lp = 0;
    for (var i = 0; i < n; i++) {
      var p = i / n;
      var t = i / sr;
      var sweep = Math.sin(Math.PI * Math.min(1, p * 1.3));
      var cut = 450 + 950 * sweep;
      var a = 1 - Math.exp(-6.283185307179586 * cut / sr);
      lp += ((Math.random() * 2 - 1) - lp) * a;
      var attack = Math.min(1, t / 0.05);
      var env = attack * Math.pow(1 - p, 0.9);
      var roar = 0.72 + 0.28 * Math.sin(6.283185307179586 * 12 * t);
      var v = lp * env * roar * 1.5 + Math.sin(6.283185307179586 * 62 * t) * env * 0.2;
      d[i] = Math.tanh(v * 1.15) * 0.9;
    }
    return buf;
  }

  function buildKillcam() {
    var buf = newBuffer(2.4);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    var beats = [
      [0.05, 0.75], [0.30, 0.55], [1.05, 0.66], [1.30, 0.48]
    ];
    for (var i = 0; i < beats.length; i++) {
      addOsc(d, sr, beats[i][0], 0.22, 64, 30, beats[i][1], 'sine', false);
      addOsc(d, sr, beats[i][0], 0.06, 120, 60, beats[i][1] * 0.35, 'sine', false);
    }
    return buf;
  }

  function buildUi() {
    var buf = newBuffer(0.075);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    addOsc(d, sr, 0, 0.07, 880, 1180, 0.4, 'sine', false);
    addOsc(d, sr, 0, 0.04, 1760, 2360, 0.1, 'sine', false);
    return buf;
  }

  function buildShot(weaponId) {
    var spec = SHOT_SPEC[weaponId] || SHOT_SPEC.rifle;
    var dur = spec.dur, cut = spec.cut, thump = spec.thump, decay = spec.decay;
    dur *= 0.94 + Math.random() * 0.12;
    var buf = newBuffer(dur);
    var sr = ctx.sampleRate;
    var d = buf.getChannelData(0);
    var n = d.length;
    var c = cut * (0.9 + Math.random() * 0.2);
    var alpha = 1 - Math.exp(-6.283185307179586 * Math.min(c, sr * 0.45) / sr);
    var lp = 0, phase = 0, phase2 = 0;
    var thumpF = thump * (0.97 + Math.random() * 0.06);
    var crackN = Math.max(1, Math.floor(sr * spec.crack));
    for (var i = 0; i < n; i++) {
      var p = i / n;
      var env = Math.pow(1 - p, decay);
      var noise = Math.random() * 2 - 1;
      lp += (noise - lp) * alpha;
      var high = noise - lp;
      var v = lp * env * 1.15;
      if (i < crackN) v += high * (1 - i / crackN) * spec.crackAmp;
      var f = thumpF * (1 - p * 0.6);
      phase += 6.283185307179586 * f / sr;
      v += Math.sin(phase) * Math.pow(1 - p, 2.4) * spec.thumpAmp;
      phase2 += 6.283185307179586 * f * 1.5 / sr;
      v += Math.sin(phase2) * Math.pow(1 - p, 3.4) * spec.thumpAmp * 0.3;
      d[i] = Math.tanh(v * spec.drive) * 0.9;
    }
    addShotLayers(d, sr, weaponId, 0.65);
    return finishBuffer(buf);
  }

  function buildBuffer(kind, weapon) {
    if (kind === 'shot') return buildShot(weapon || 'rifle');
    if (kind === 'impact') return buildImpact();
    if (kind === 'hit') return buildHit();
    if (kind === 'reload') return buildReload(weapon || 'rifle');
    if (ACTION_IDS[kind] === 1) return buildAction(kind);
    if (kind === 'death') return buildDeath();
    if (kind === 'respawn') return buildRespawn();
    if (kind === 'splash') return buildSplash();
    if (kind === 'jetpackOn') return buildJetpackOn();
    if (kind === 'jetpackLoop') return buildJetpackLoop();
    if (kind === 'dragonRoar') return buildDragonRoar();
    if (kind === 'dragonBreath') return buildDragonBreath();
    if (kind === 'killcam') return buildKillcam();
    if (kind === 'ui') return buildUi();
    return null;
  }

  function bufferFor(kind, weapon) {
    var recorded = recordedBank[kind === 'reload' ? 'reload:' + (weapon || 'rifle') : kind === 'step' ? 'step:' + weapon : kind];
    if (kind !== 'shot' && recorded && recorded.length) return recorded[(Math.random() * recorded.length) | 0];
    if (kind === 'shot' && recordedBuffers[weapon]) {
      var samples = recordedBuffers[weapon];
      return samples[(Math.random() * samples.length) | 0];
    }
    var key = kind + '|' + (kind === 'shot' || kind === 'reload' ? (weapon || 'rifle') : '');
    var list = buffers.get(key);
    if (list) return list[(Math.random() * list.length) | 0];
    list = [];
    var count = kind === 'shot' ? 2 : (KIND_SPEC[kind] ? KIND_SPEC[kind].variants : 2);
    try {
      for (var i = 0; i < count; i++) {
        var b = buildBuffer(kind, weapon);
        if (b) list.push(b);
      }
    } catch (e) { list.length = 0; }
    if (!list.length) return null;
    buffers.set(key, list);
    return list[(Math.random() * list.length) | 0];
  }

  /* ---------------------------------------------------- local CC0 samples */

  function buildRecordedShot(weapon, decoded) {
    var spec = SHOT_SPEC[weapon];
    var sr = decoded.sampleRate;
    var source = decoded.getChannelData(0);
    var scan = Math.min(source.length, Math.floor(sr * 0.12));
    var peak = 0, offset = 0, i;
    for (i = 0; i < scan; i++) if (Math.abs(source[i]) > peak) peak = Math.abs(source[i]);
    // MP3 decoders differ in their handling of encoder delay. Align the first
    // transient once, not on every trigger; retain 0.8 ms before the onset.
    if (peak > 0.001) {
      for (i = 0; i < scan; i++) {
        if (Math.abs(source[i]) >= peak * 0.07) {
          offset = Math.max(0, i - Math.floor(sr * 0.0008));
          break;
        }
      }
    }
    var length = Math.max(1, Math.floor(sr * spec.dur));
    var buf = ctx.createBuffer(1, length, sr);
    var d = buf.getChannelData(0);
    var lp = 0, alpha = 1 - Math.exp(-6.283185307179586 * spec.cut / sr);
    for (i = 0; i < length; i++) {
      var s = i + offset < source.length ? source[i + offset] : 0;
      lp += (s - lp) * alpha;
      d[i] = s * 0.82 + lp * 0.12;
    }
    addShotLayers(d, sr, weapon, 1);
    return finishBuffer(buf);
  }

  function decodeWeapon(weapon, entry) {
    var settled = false;
    function complete(decoded) {
      if (settled) return;
      settled = true;
      try {
        if (!decoded || decoded.numberOfChannels !== 1 || decoded.duration > 1.5 || decoded.duration < 0.03) {
          throw new Error('Invalid local firearm sample');
        }
        var variants = [buildRecordedShot(weapon, decoded), buildRecordedShot(weapon, decoded)];
        recordedBuffers[weapon] = variants;
        buffers.delete('shot|' + weapon); // release warmed fallback buffers
        sampleReady++;
      } catch (e) { sampleFailed++; }
      samplePending--;
      if (!samplePending) sampleState = sampleReady === WEAPON_IDS.length ? 'ready' : sampleReady ? 'partial' : 'failed';
    }
    try {
      if (!entry || typeof entry.base64 !== 'string' || entry.base64.length > 32000) {
        complete(null);
        return;
      }
      var binary = window.atob(entry.base64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      // Callback + Promise overloads are both supported; complete() is guarded
      // because some engines deliver both. There is no local XHR/fetch/CORS.
      var pending = ctx.decodeAudioData(bytes.buffer, complete, function () { complete(null); });
      if (pending && typeof pending.then === 'function') pending.then(complete, function () { complete(null); });
    } catch (e) { complete(null); }
  }

  function prepareAudio() {
    if (!gestureSeen || !ctx || !graphReady) return;
    if (!warmingDone) {
      warmingDone = true;
      // Gunfire and mechanism buffers are built on the activation gesture,
      // never decoded/generated in lateFrame or on an automatic-fire tick.
      for (var i = 0; i < WEAPON_IDS.length; i++) {
        bufferFor('shot', WEAPON_IDS[i]);
        bufferFor('reload', WEAPON_IDS[i]);
      }
      bufferFor('pump', '');
      bufferFor('bolt', '');
      bufferFor('cylinder', '');
      bufferFor('hit', '');
      bufferFor('impact', '');
      bufferFor('jetpackLoop', '');
      // Reserve one inaudible, reused loop on activation rather than allocating
      // nodes/buffers in lateFrame when thrust first becomes active.
      if (BCR.api && BCR.api.jetpack) startJetpackLoop();
    }
    if (sampleStarted) return;
    sampleStarted = true;
    var asset = window.BCWeaponSamples;
    if (!asset || asset.version !== 1 || asset.licence !== 'CC0-1.0' || !asset.entries) {
      sampleState = 'missing';
      return;
    }
    if (typeof ctx.decodeAudioData !== 'function' || typeof window.atob !== 'function') {
      sampleState = 'failed';
      sampleFailed = WEAPON_IDS.length;
      return;
    }
    sampleState = 'loading';
    samplePending = WEAPON_IDS.length;
    var sfx = window.BCSfxBank && window.BCSfxBank.version === 1 && window.BCSfxBank.licence === 'CC0-1.0'
      ? window.BCSfxBank.entries : null;
    for (var n = 0; n < WEAPON_IDS.length; n++) {
      var id = WEAPON_IDS[n], fresh = sfx && sfx['shot:' + id] && sfx['shot:' + id][0];
      decodeWeapon(id, fresh || asset.entries[id]);
    }
    if (sfx) decodeBank(sfx);
  }

  /* Recorded effects bank (assets/audio/sfx-bank.js): real CC0 recordings for
     impacts, body hits, handling, UI ticks, footsteps and landings. Each
     weapon's reload is assembled from real magazine/rack/pump/bolt clips
     placed at that weapon's reload stages, so it lines up with the animation. */
  var recordedBank = Object.create(null);
  var RELOAD_CLIPS = [
    [/out/, 'magOut'], [/gate|feed|shell|in\b|insert/, 'magIn'], [/pump/, 'pump'], [/bolt/, 'bolt'],
    [/cylinder|eject|ejector/, 'cylinder'], [/slide/, 'slide'], [/charg|rack|release|handle/, 'rack']
  ];

  function decodeClip(entry, done) {
    var settled = false;
    function finish(buf) { if (!settled) { settled = true; done(buf && buf.duration > 0.01 && buf.duration < 2 ? buf : null); } }
    try {
      if (!entry || typeof entry.base64 !== 'string' || entry.base64.length > 40000) { finish(null); return; }
      var binary = window.atob(entry.base64), bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var pending = ctx.decodeAudioData(bytes.buffer, finish, function () { finish(null); });
      if (pending && typeof pending.then === 'function') pending.then(finish, function () { finish(null); });
    } catch (e) { finish(null); }
  }

  function decodeBank(entries) {
    var keys = Object.keys(entries).filter(function (k) { return k.indexOf('shot:') !== 0; });
    var waiting = 0;
    keys.forEach(function (key) {
      var list = Array.isArray(entries[key]) ? entries[key] : [];
      list.forEach(function (entry) {
        waiting++;
        decodeClip(entry, function (buf) {
          if (buf) (recordedBank[key] = recordedBank[key] || []).push(buf);
          if (--waiting === 0) assembleReloads();
        });
      });
    });
  }

  function mixInto(out, clip, at, gain) {
    var d = out.getChannelData(0), c = clip.getChannelData(0);
    var start = Math.max(0, Math.floor(at * out.sampleRate)), ratio = clip.sampleRate / out.sampleRate;
    for (var i = 0; start + i < d.length; i++) {
      var j = Math.floor(i * ratio);
      if (j >= c.length) break;
      d[start + i] += c[j] * gain;
    }
  }

  function assembleReloads() {
    var handling = typeof COMBAT_HANDLING !== 'undefined' ? COMBAT_HANDLING : null;
    for (var n = 0; n < WEAPON_IDS.length; n++) {
      var id = WEAPON_IDS[n], w = typeof WEAPON_BY_ID !== 'undefined' ? WEAPON_BY_ID[id] : null;
      var stages = handling && handling[id] && handling[id].reloadStages;
      if (!w || !Array.isArray(stages) || !stages.length) continue;
      var seconds = Math.min(4, Math.max(0.5, w.reload));
      var out = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate), placed = 0;
      for (var s2 = 0; s2 < stages.length; s2++) {
        var name = String(stages[s2][1] || '').toLowerCase(), clipKey = null;
        for (var k = 0; k < RELOAD_CLIPS.length && !clipKey; k++) if (RELOAD_CLIPS[k][0].test(name)) clipKey = RELOAD_CLIPS[k][1];
        if (id === 'revolver' && clipKey === 'magOut') clipKey = 'cylinder';
        if (id === 'pistol' && clipKey === 'rack') clipKey = 'slide';
        var clips = clipKey && recordedBank[clipKey];
        if (!clips || !clips.length) continue;
        // Mechanism stages are cued slightly before the stage mark so the
        // transient lands on the visible motion.
        mixInto(out, clips[0], Math.max(0, stages[s2][0] * seconds - 0.04), 0.9);
        placed++;
      }
      if (placed) recordedBank['reload:' + id] = [out];
    }
  }

  /* ------------------------------------------------------------- playback */

  function normalizeKind(kind, info) {
    var k = String(kind == null ? '' : kind).toLowerCase();
    var action = info && String(info.action || '').toLowerCase();
    if ((k === 'action' || k === 'mechanism' || k === 'ui') && ACTION_IDS[action] === 1) return action;
    if (!k && info && info.weapon) k = 'shot';
    if (SHOT_IDS[k] === 1) return 'shot';
    return Object.prototype.hasOwnProperty.call(KIND_ALIAS, k) ? KIND_ALIAS[k] : '';
  }

  function resolveTeam(info) {
    if (!info) return null;
    var t = info.team || info.shooterTeam || info.byTeam || info.side || null;
    if (!t) {
      var id = info.peerId || info.id;
      if (id) {
        try {
          if (typeof net !== 'undefined' && net && net.players && typeof net.players.get === 'function') {
            var r = net.players.get(id);
            if (r && r.team) t = r.team;
          }
        } catch (e) { /* ignore */ }
      }
    }
    return t === 'red' || t === 'blue' ? t : null;
  }

  function play(info) {
    if (!info || typeof info !== 'object') return false;
    try {
      if (!ctx || !graphReady || !master || ctx.state !== 'running' || sfxMuted || sfxVolume <= 0) {
        dropCount++;
        return false;
      }
      var rawKind = info.kind;
      var lower = String(rawKind == null ? '' : rawKind).toLowerCase();
      var kind = normalizeKind(rawKind, info);
      if (!kind) return false;
      if (kind === 'jetpackLoop') {
        if (!jetpackLoop) startJetpackLoop();
        updateJetpackLoop();
        return !!jetpackLoop;
      }

      var weaponValue = info.weapon && typeof info.weapon === 'object' ? info.weapon.id : info.weapon;
      var weapon = SHOT_IDS[lower] === 1 ? lower : String(weaponValue || 'rifle').toLowerCase();
      if (SHOT_IDS[weapon] !== 1) weapon = 'rifle';
      if (kind === 'step') weapon = info.surface === 'hard' ? 'hard' : 'soft';
      var spec = kind === 'shot' ? (SHOT_SPEC[weapon] || SHOT_SPEC.rifle) : (KIND_SPEC[kind] || KIND_SPEC.ui);
      var buf = bufferFor(kind, weapon);
      if (!buf) return false;

      if (!listenerLive) updateListener(false);
      readPosition(info.position);
      var hasPos = spHasPos;
      if (!computeSpatial(!!info.occluded)) return false;

      var vol = spec.vol;
      if (kind === 'shot') {
        var rp = weaponReport(weapon);
        if (rp && isFinite(rp.sound)) vol = clamp(rp.sound, 0.2, 1);
      }
      if (info.volume != null && isFinite(Number(info.volume))) vol = clamp(info.volume, 0, 1.5);

      var gainValue = hasPos ? vol * tailFade(spDist) * (spOccluded ? 0.55 : 1) : vol;
      var playCut = kind === 'shot' ? 9000 : (spec.playCut || 4000);
      var cut = playCut;
      if (hasPos) {
        cut = playCut * (0.18 + 0.82 * (1 - Math.min(1, spDist / MAX_DISTANCE)));
        if (spOccluded) cut *= 0.38;
      }
      cut = clamp(cut, 180, 12000);

      var team = resolveTeam(info);
      var rate = 1;
      if (kind === 'shot') {
        if (team === 'red') rate = 0.94;
        else if (team === 'blue') rate = 1.06;
      }
      rate *= kind === 'shot' ? 0.985 + Math.random() * 0.03 : 0.96 + Math.random() * 0.08;
      if (info.rate != null && isFinite(Number(info.rate))) rate *= clamp(info.rate, 0.5, 2);
      rate = clamp(rate, 0.5, 2);

      pruneVoices();
      if (voices.length >= MAX_VOICES - (jetpackLoop ? 1 : 0)) stealVoice();
      var chain = acquireChain();
      if (!chain.panner && hasPos) {
        gainValue *= REF_DISTANCE / (REF_DISTANCE + ROLLOFF * Math.max(0, spDist - REF_DISTANCE));
      }
      gainValue = clamp(gainValue, 0, 0.95);
      if (gainValue <= 0.0003) {
        recycleChain(chain);
        dropCount++;
        return false;
      }

      var src = null;
      try {
        src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
      } catch (e) {
        recycleChain(chain);
        return false;
      }

      chain.src = src;
      // Steal the quietest audible source, not an equal-gain distant report
      // whose attenuation happens later inside its HRTF panner.
      chain.effective = gainValue * (chain.panner && hasPos ?
        REF_DISTANCE / (REF_DISTANCE + ROLLOFF * Math.max(0, spDist - REF_DISTANCE)) : 1);
      chain.stopAt = 0;
      try { src.connect(chain.filter || chain.gain); } catch (e2) {
        recycleChain(chain);
        return false;
      }
      if (chain.filter) setParam(chain.filter.frequency, cut);
      if (hasPos) setPannerPosition(chain, posX, posY, posZ);
      else setPannerPosition(chain, lx, ly, lz);
      if (chain.stereo) setParam(chain.stereo.pan, hasPos ? spPan : 0);

      var t = ctx.currentTime + 0.006;
      var g = chain.gain.gain;
      try {
        g.cancelScheduledValues(t);
        g.setValueAtTime(0.0001, t);
        g.linearRampToValueAtTime(gainValue, t + (kind === 'shot' ? 0.001 : 0.004));
      } catch (e3) {
        try { g.value = gainValue; } catch (e4) { /* ignore */ }
      }

      var dur = buf.duration / Math.max(0.5, rate);
      var end = t + Math.max(0.03, dur);
      try {
        g.setValueAtTime(gainValue, Math.max(t + 0.012, end - 0.035));
        g.linearRampToValueAtTime(0.0001, end);
      } catch (e5) { /* ignore */ }

      src.onended = function () {
        if (chain.src !== src) return;
        src.onended = null;
        try { src.disconnect(); } catch (e) { /* already disconnected */ }
        chain.src = null;
        var at = voices.indexOf(chain);
        if (at >= 0) voices.splice(at, 1);
        recycleChain(chain);
      };
      chain.stopAt = end + 0.06;

      try {
        src.start(t);
        src.stop(end + 0.02);
      } catch (e6) {
        chain.src = null;
        src.onended = null;
        try { src.disconnect(); } catch (e7) { /* ignore */ }
        recycleChain(chain);
        return false;
      }
      voices.push(chain);
      playCount++;
      if (kind === 'shot') {
        if (recordedBuffers[weapon]) samplePlayCount++;
        else proceduralShotCount++;
      }
      return true;
    } catch (err) {
      dropCount++;
      return false;
    }
  }

  /* ------------------------------------------------------- game sfx hooks */

  function onSfx(info) {
    if (!info) return;
    try {
      var kind = normalizeKind(info.kind, info);
      if (!kind) return;
      if (kind === 'respawn') lastRespawnSfx = now();
      // sfx is authoritative for local AND remote audio. A shot+shot-hook or
      // packet+firePose inference must not double it; no global time gate may
      // drop unrelated peers or legal high-RPM rounds. Preserve action/rate.
      play(info);
    } catch (e) { /* never break the frame */ }
  }

  /* ----------------------------------------------------------- jetpack loop */

  function setLoopGain(v) {
    if (!jetpackLoop || !ctx) return;
    var t = ctx.currentTime;
    var g = jetpackLoop.gain.gain;
    var target = Math.max(0, v);
    if (jetpackLoop.target === target) return;
    jetpackLoop.target = target;
    try {
      g.cancelScheduledValues(t);
      g.setTargetAtTime(target, t, 0.09);
    } catch (e) {
      try { g.value = target; } catch (e2) { /* ignore */ }
    }
    jetpackLoop.on = v > 0.001;
  }

  function startJetpackLoop() {
    if (jetpackLoop || !ctx || !master) return;
    var buf = bufferFor('jetpackLoop', '');
    if (!buf) return;
    try {
      if (voices.length >= MAX_VOICES) stealVoice();
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1600;
      filter.Q.value = 0.5;
      var gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(ctx.currentTime);
      jetpackLoop = { src: src, filter: filter, gain: gain, on: false, target: 0 };
    } catch (e) {
      jetpackLoop = null;
    }
  }

  function updateJetpackLoop() {
    var thrusting = false;
    try { thrusting = !!(BCR.api.jetpack && BCR.api.jetpack.thrusting); } catch (e) { /* ignore */ }
    if (!ctx || !master || ctx.state !== 'running' || sfxMuted) {
      if (jetpackLoop) setLoopGain(0);
      return;
    }
    if (!jetpackLoop) return;
    setLoopGain(thrusting ? 0.32 : 0);
  }

  /* --------------------------------------------------------------- frames */

  function onFrame(dt) {
    updateListener(false);
    updateJetpackLoop();
    syncReady();
  }

  /* -------------------------------------------------------- input / unmute */

  var muteKeyPending = false;
  var muteKeyBefore = false;

  function unlockOnGesture() {
    if (!ctx || ctx.state !== 'running') ensureContext();
    else syncReady();
  }

  function onKeyDown(e) {
    if (!e) return;
    var el = e.target;
    var tag = el && el.tagName ? String(el.tagName) : '';
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(el && el.isContentEditable);
    if (typing) return;
    unlockOnGesture();
    if (e.code !== 'KeyM' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    // The classic input/combat handler was registered before this listener.
    // It already toggled the store during this event; a deferred second toggle
    // would undo it. Keep only the fallback for builds without combat input.
    if (typeof toggleMute === 'function') return;
    if (muteKeyPending) return;
    muteKeyPending = true;
    muteKeyBefore = sfxMuted;
    /* Defer one tick: if the settings/lobby handler already changed our mute
       during this same key event, adopt its value instead of toggling twice. */
    try {
      setTimeout(function () {
        muteKeyPending = false;
        if (sfxMuted !== muteKeyBefore) return;
        setMuted(!sfxMuted, true);
      }, 0);
    } catch (err) {
      muteKeyPending = false;
      setMuted(!sfxMuted, true);
    }
  }

  /* --------------------------------------------------------------- wiring */

  try { BCR.api.audio = api; } catch (e) { /* ignore */ }

  BCR.on('sfx', onSfx);

  /* Footsteps and landings for the local player, from real recordings. Steps
     follow distance travelled (so sprinting steps faster), switch between
     soft (grass, dirt, sand, snow, leaves) and hard surfaces, and a fall
     faster than 7 m/s lands with a thud. */
  var stepDistance = 0, stepWasGround = true, stepLastVy = 0, stepLastLand = 0;
  var SOFT_BLOCKS = null;
  function stepSurface() {
    try {
      if (!SOFT_BLOCKS) SOFT_BLOCKS = [GRASS, DIRT, SAND, SNOW, LEAVES, GRAVEL, MUD];
      var b = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.2), Math.floor(player.pos.z));
      return SOFT_BLOCKS.indexOf(b) >= 0 ? 'soft' : 'hard';
    } catch (e) { return 'soft'; }
  }
  BCR.on('postPlayer', function (dt) {
    try {
      if (typeof player === 'undefined' || typeof alive === 'undefined' || !alive || !isFinite(dt) || dt <= 0) return;
      var riding = BCR.api && BCR.api.riding && BCR.api.riding.active;
      if (riding || player.fly || player.swimming) { stepWasGround = false; stepDistance = 0; return; }
      var t = now();
      if (player.onGround && !stepWasGround && stepLastVy < -7 && t - stepLastLand > 250) {
        stepLastLand = t;
        play({ kind: 'land', volume: Math.min(0.7, 0.25 + (-stepLastVy - 7) * 0.03) });
        stepDistance = 0;
      }
      stepWasGround = player.onGround;
      stepLastVy = player.vel.y;
      if (!player.onGround || player.sliding) return;
      var speed = Math.hypot(player.vel.x, player.vel.z);
      if (speed < 1.2) { stepDistance = Math.min(stepDistance, 1.2); return; }
      stepDistance += speed * dt;
      var stride = player.crouching ? 1.6 : speed > 7 ? 2.6 : 2.15;
      if (stepDistance >= stride) {
        stepDistance -= stride;
        play({ kind: 'step', surface: stepSurface(), volume: player.crouching ? 0.08 : speed > 7 ? 0.24 : 0.17 });
      }
    } catch (e) { /* footsteps are cosmetic */ }
  }, 60);
  // Kill confirmation for the local player's eliminations.
  BCR.on('killfeed', function (killer, victim, info) {
    try {
      var self = typeof net !== 'undefined' && net ? net.id : '';
      var mine = info && (info.killerId === self || info.byId === self) && info.victimId !== self;
      if (mine && info.confirmed !== false) play({ kind: 'confirm', volume: 0.5 });
    } catch (e) { /* optional */ }
  }, 40);
  BCR.on('respawn', function () {
    if (now() - lastRespawnSfx < 50) return;
    lastRespawnSfx = now();
    play({ kind: 'respawn', volume: 1 });
  });
  BCR.on('settingsChanged', function (key) {
    if (key === 'muted') setMuted(readSetting('muted'), false);
    else if (key === 'volume') setVolume(readSetting('volume'));
    else refreshSettings();
  });
  BCR.on('worldReady', function () {
    refreshSettings();
    if (master) rampMaster(0.1);
  });
  // Track the final ride/killcam camera, after every camera-owning module.
  BCR.on('lateFrame', onFrame, 1000);
  if (typeof BCR.whenReady === 'function') {
    BCR.whenReady(function () { refreshSettings(); });
  }

  document.addEventListener('pointerdown', unlockOnGesture, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('pointerlockchange', unlockOnGesture);

  refreshSettings();
  syncReady();
})();
