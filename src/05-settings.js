/* Blockcraft Battle Ground — Personal settings, match setup and crosshair.
   05-settings.js
   Loads after 00-core.js and before the gameplay systems. Every gameplay global
   is reached lazily through BC.api / hooks, so this file is safe in solo,
   file:// and reduced builds where later modules never register.
   The top-HUD IDs are scaffolded here; 86-hud.js alone owns their live data,
   layout and ping clock. 88-menu.js owns screen visibility, focus and capture;
   this file keeps the existing native controls and authority-safe store. */
'use strict';

(function () {
  var BC = window.BC;
  if (!BC || typeof BC.el !== 'function' || typeof BC.style !== 'function') return;

  /* ---------------- constants ---------------- */
  var STORAGE_KEY = 'blockcraft.settings.v2';
  var LEGACY_SEED_KEY = 'blockcraft.seed';
  var CROSSHAIRS = ['cross', 'dot', 'circle', 'brackets', 'chevron', 'tcross', 'none'];
  var THEMES = ['red', 'blue', 'auto'];
  var MODE_IDS = ['tdm', 'ffa', 'snipers', 'shotguns', 'lockdown'];
  var DEFAULT_SENSITIVITY = 1;
  var DEFAULT_VOLUME = 0.8;
  // 60-combat.js loads later. Keep only the stable IDs / UI names here, never
  // reach WEAPONS while initializing the personal settings store.
  var WEAPON_SENSITIVITY_DEFS = [
    { id: 'pistol', name: 'Pistol' }, { id: 'rifle', name: 'Rifle' },
    { id: 'shotgun', name: 'Shotgun' }, { id: 'smg', name: 'SMG' },
    { id: 'sniper', name: 'Sniper' }, { id: 'revolver', name: 'Revolver' },
    { id: 'lmg', name: 'LMG' }
  ];

  var FALLBACK_MODES = [
    { id: 'tdm', name: 'Team Deathmatch', short: 'TDM', desc: 'Red versus blue. First team to the score cap wins.', teams: true },
    { id: 'ffa', name: 'Free For All', short: 'FFA', desc: 'No teams. Every player for themselves.', teams: false },
    { id: 'snipers', name: 'Snipers', short: 'SNP', desc: 'One shot, one kill. Long rifles only.', teams: false },
    { id: 'shotguns', name: 'Shotguns', short: 'SHG', desc: 'Close quarters. Shotguns only.', teams: false },
    { id: 'lockdown', name: 'Lockdown', short: 'LCK', desc: 'Hold the tight arena and force every fight.', teams: true }
  ];

  /* ---------------- injected stylesheet ---------------- */
  BC.style('bc-settings-v2', `
    :root {
      --bc-red: #ff3b4a; --bc-blue: #338bff;
      --bc-red-fill: #ce2038; --bc-red-hover: #db263f;
      --bc-blue-fill: #165bd8; --bc-blue-hover: #236bea;
      --bc-accent: var(--bc-blue); --bc-accent-fill: var(--bc-blue-fill);
      --bc-ink: #f7faff; --bc-dim: #bdceed;
      --bc-line: #36537b; --bc-line-strong: #6584b1;
      --bc-panel: #101e3a; --bc-surface: #162b4b; --bc-surface-hover: #1c385f;
      --bc-glass: #101e3a; --bc-glass-deep: #09152b; --bc-edge: #060e1e;
      --bc-radius: 2px;
      --bc-panel-bevel: inset 0 1px 0 rgba(201,225,255,.16), 0 3px 0 var(--bc-edge);
      --bc-control-bevel: inset 0 2px 0 rgba(255,255,255,.17), inset 0 -2px 0 rgba(4,12,27,.28), 0 2px 0 var(--bc-edge);
      --bc-display-font: "Arial Black", Impact, "Segoe UI", Arial, sans-serif;
      --bc-ui-font: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
      --bc-hud-font: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }
    body[data-bc-accent="red"] { --bc-accent: var(--bc-red); --bc-accent-fill: var(--bc-red-fill); }
    body[data-bc-accent="blue"], body[data-bc-accent="auto"] { --bc-accent: var(--bc-blue); --bc-accent-fill: var(--bc-blue-fill); }

    /* Match information lives on Home. Mode/map controls live on Play setup;
       personal controls are mounted in their own settings tabs, not the lobby. */
    #bcLobby {
      display: flex; flex-direction: column; gap: 12px; min-width: 0;
      font-variant-numeric: tabular-nums; color: var(--bc-ink);
    }
    #bcLobby *, #bcLobby *::before, #bcLobby *::after { box-sizing: border-box; }
    #bcMatchMode { font-family: var(--bc-display-font); font-size: 26px; font-weight: 900; letter-spacing: -.025em; }
    #bcMatchRule { color: var(--bc-dim); font-size: 12px; line-height: 1.55; }
    #lobbyStatus { font-size: 12px; line-height: 1.5; color: var(--bc-dim); overflow-wrap: anywhere; }
    .bcs-section { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    .bcs-label { margin: 0; font-size: 16px; font-weight: 800; color: var(--bc-ink); }
    .bcs-note { margin: 0; font-size: 12px; line-height: 1.55; color: var(--bc-dim); }
    .bcs-note b { color: var(--bc-ink); font-weight: 800; }
    .bcs-setup-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(240px, 1fr); gap: 32px; }
    .bcs-map-section { padding-left: 24px; border-left: 1px solid var(--bc-line); }
    .bcs-modes { display: flex; flex-direction: column; gap: 8px; }
    .bcs-mode {
      display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px;
      align-items: center; min-width: 0; min-height: 66px; padding: 10px 12px;
      font: inherit; color: var(--bc-ink); text-align: left; cursor: pointer;
      background: var(--bc-surface); border: 1px solid var(--bc-line-strong); border-radius: var(--bc-radius);
      box-shadow: var(--bc-control-bevel);
      transition: background .12s ease, border-color .12s ease;
    }
    .bcs-mode:hover:not(:disabled) { background: var(--bc-surface-hover); border-color: var(--bc-blue); }
    .bcs-mode[aria-pressed="true"] {
      border-color: var(--bc-blue); background: var(--bc-blue-fill); box-shadow: var(--bc-control-bevel);
    }
    .bcs-mode[aria-pressed="true"]:hover:not(:disabled) { background: var(--bc-blue-hover); border-color: var(--bc-blue); }
    .bcs-mode:disabled { cursor: not-allowed; color: var(--bc-dim); }
    .bcs-mode[aria-pressed="true"]:disabled { color: var(--bc-ink); }
    #bcConfigHint[data-locked="true"] { color: var(--bc-dim); }
    .bcs-mode-name { font-size: 14px; font-weight: 800; line-height: 1.25; overflow-wrap: anywhere; }
    .bcs-mode-rule { grid-column: 1 / -1; font-size: 12px; line-height: 1.4; color: var(--bc-dim); overflow-wrap: anywhere; }
    .bcs-mode[aria-pressed="true"] .bcs-mode-rule { color: var(--bc-ink); }
    .bcs-teams { display: flex; align-items: center; gap: 3px; grid-column: 2; grid-row: 1; }
    .bcs-dot { display: block; width: 7px; height: 7px; border-radius: 1px; }
    .bcs-dot.red { background: var(--bc-red); }
    .bcs-dot.blue { background: var(--bc-blue); }
    .bcs-dot.free { background: var(--bc-ink); }
    .bcs-row { display: flex; align-items: center; gap: 16px; min-width: 0; }
    .bcs-row output {
      flex: none; min-width: 64px; text-align: right; font: 700 16px/1.5 var(--bc-hud-font);
      color: var(--bc-ink); font-variant-numeric: tabular-nums;
    }
    .bcs-row input[type="range"] {
      flex: 1; min-width: 0; height: 44px; margin: 0; padding: 0;
      background: transparent; accent-color: var(--bc-accent); cursor: pointer; color-scheme: dark;
    }
    .bcs-aim-section { max-width: 620px; }
    .bcs-weapon-section { padding-top: 20px; border-top: 1px solid var(--bc-line); }
    .bcs-weapon-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    #bcWeaponSensReset { font-size: 12px; }
    #bcWeaponSelect { max-width: 320px; }
    .bcs-weapon-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 28px; padding-top: 4px; }
    .bcs-weapon-name { grid-column: 1 / -1; font-size: 16px; font-weight: 800; color: var(--bc-ink); }
    .bcs-weapon-control { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .bcs-weapon-phase { font-size: 13px; color: var(--bc-dim); }
    .bcs-weapon-control .bcs-row { gap: 12px; }
    .bcs-effective { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 20px; color: var(--bc-dim); font-size: 12px; }
    .bcs-effective output { color: var(--bc-ink); font: 700 13px/1.5 var(--bc-hud-font); font-variant-numeric: tabular-nums; }
    .bcs-cross-layout { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 24px; }
    #bcCrosshairPreview { display: grid; place-items: center; width: 96px; height: 96px; border: 1px solid var(--bc-line-strong); border-radius: var(--bc-radius); background: var(--bc-surface); box-shadow: var(--bc-panel-bevel); }
    #bcCrosshairPreview svg { display: block; width: 40px; height: 40px; }
    .bcs-crosses { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .bcs-cross {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
      min-width: 0; min-height: 64px; padding: 8px 6px;
      font: inherit; font-size: 12px; color: var(--bc-ink); cursor: pointer;
      background: var(--bc-surface); border: 1px solid var(--bc-line-strong); border-radius: var(--bc-radius);
      box-shadow: var(--bc-control-bevel);
      transition: background .12s ease, border-color .12s ease, color .12s ease;
    }
    .bcs-cross:hover { background: var(--bc-surface-hover); border-color: var(--bc-accent); }
    .bcs-cross[aria-pressed="true"] { color: var(--bc-ink); border-color: var(--bc-accent); background: var(--bc-accent-fill); }
    .bcs-cross svg { display: block; width: 24px; height: 24px; pointer-events: none; }
    .bcs-seg { display: flex; flex-wrap: wrap; gap: 8px; max-width: 480px; }
    .bcs-seg button {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      flex: 1; min-height: 44px; padding: 9px 12px; font: inherit; font-size: 13px; font-weight: 800;
      color: var(--bc-ink); cursor: pointer; background: var(--bc-surface); border: 1px solid var(--bc-line-strong); border-radius: var(--bc-radius);
      box-shadow: var(--bc-control-bevel);
    }
    .bcs-seg button:hover { background: var(--bc-surface-hover); border-color: var(--bc-blue); }
    .bcs-seg button[aria-pressed="true"] { color: var(--bc-ink); border-color: var(--bc-blue); background: var(--bc-blue-fill); }
    .bcs-seg button[data-theme="red"][aria-pressed="true"] { border-color: var(--bc-red); background: var(--bc-red-fill); }
    .bcs-toggle {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      min-height: 48px; padding: 10px 12px; width: 100%; max-width: 620px;
      font: inherit; font-size: 14px; font-weight: 800; color: var(--bc-ink); cursor: pointer;
      background: var(--bc-surface); border: 1px solid var(--bc-line-strong); border-radius: var(--bc-radius);
      box-shadow: var(--bc-control-bevel);
    }
    .bcs-toggle:hover { background: var(--bc-surface-hover); border-color: var(--bc-accent); }
    .bcs-toggle[aria-pressed="true"] { color: var(--bc-ink); border-color: var(--bc-accent); background: var(--bc-accent-fill); }
    .bcs-toggle .bcs-state { font-size: 12px; color: var(--bc-ink); }
    .bcs-seedrow { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; min-width: 0; }
    #bcSeedValue { font: 700 24px/1.5 var(--bc-hud-font); font-variant-numeric: tabular-nums; color: var(--bc-ink); overflow-wrap: anywhere; }
    #bcSeedRandom[aria-busy="true"] { cursor: progress; }
    .bcs-match { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 12px; margin: 0; font-size: 12px; }
    .bcs-match dt { color: var(--bc-dim); }
    .bcs-match dd { margin: 0; min-width: 0; text-align: right; color: var(--bc-ink); font-variant-numeric: tabular-nums; }
    .bcs-match b { font-weight: 600; overflow-wrap: anywhere; }
    .bcs-mrow b.team-red { color: var(--bc-red); }
    .bcs-mrow b.team-blue { color: var(--bc-blue); }
    #bcMatchTeam.team-red { color: var(--bc-red); }
    #bcMatchTeam.team-blue { color: var(--bc-blue); }
    .bcs-scoreline { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .bcs-scoreline progress { width: 100%; height: 4px; border: 0; background: var(--bc-line); accent-color: var(--bc-blue); }
    .bcs-scoreline progress.red { accent-color: var(--bc-red); }
    .bcs-scoreline progress::-webkit-progress-bar { background: var(--bc-line); }
    .bcs-scoreline progress::-webkit-progress-value { background: var(--bc-blue); }
    .bcs-scoreline progress.red::-webkit-progress-value { background: var(--bc-red); }

    /* Gameplay panels and the three top-HUD IDs are styled in 86-hud.js. */
    body:not(.bc-compact-hud) #teamScore,
    body:not(.bc-compact-hud) #matchChip,
    body:not(.bc-compact-hud) #pingChip { display: none; }

    /* ---------- crosshair layer ---------- */
    #crosshair::before, #crosshair::after { content: none !important; display: none !important; }
    #crosshair svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; pointer-events: none; }
    body.scoped #crosshair { visibility: hidden !important; opacity: 0 !important; }

    @media (max-width: 700px) {
      .bcs-setup-layout { grid-template-columns: minmax(0, 1fr); gap: 24px; }
      .bcs-map-section { padding: 20px 0 0; border-left: 0; border-top: 1px solid var(--bc-line); }
      #bcMatchMode { font-size: 23px; }
      #bcMatchRule { display: none; }
      #bcLobby { gap: 10px; }
      .bcs-match { grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 6px 10px; }
      .bcs-match dd { text-align: left; }
    }
    @media (max-width: 560px) {
      .bcs-weapon-row { grid-template-columns: minmax(0, 1fr); gap: 16px; }
      .bcs-cross-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
      #bcCrosshairPreview { width: 100%; height: 76px; }
      .bcs-crosses { gap: 6px; }
      .bcs-cross { font-size: 11px; }
      .bcs-row { gap: 12px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .bcs-mode, .bcs-cross, .bcs-seg button { transition: none; }
    }
  `);

  /* ---------------- small helpers ---------------- */
  function bcNum(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function bcClamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
  }
  function bcUint32(value, fallback) {
    if (value == null || String(value).trim() === '') return fallback;
    var n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.trunc(n) >>> 0;
  }
  function bcSensitivity(value) {
    var n = bcNum(value, DEFAULT_SENSITIVITY);
    return Math.round(bcClamp(n, 0.35, 2.5) * 20) / 20;
  }
  function bcWeaponMultiplier(value) {
    // Numeric strings from native range controls are valid; blank strings,
    // booleans, objects, NaN and infinities are not measured multipliers.
    if (typeof value !== 'number' && typeof value !== 'string') return 1;
    if (typeof value === 'string' && value.trim() === '') return 1;
    var n = Number(value);
    return Number.isFinite(n) ? bcClamp(n, 0.35, 2.5) : 1;
  }
  function bcSanitizeWeaponSensitivity(value) {
    var source = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    var result = {};
    for (var i = 0; i < WEAPON_SENSITIVITY_DEFS.length; i++) {
      var id = WEAPON_SENSITIVITY_DEFS[i].id;
      var entry = source && bcHas(source, id) ? source[id] : null;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) entry = null;
      result[id] = {
        hip: bcWeaponMultiplier(entry && bcHas(entry, 'hip') ? entry.hip : 1),
        ads: bcWeaponMultiplier(entry && bcHas(entry, 'ads') ? entry.ads : 1)
      };
    }
    return result;
  }
  function bcCopyWeaponSensitivity(value) {
    var copy = {};
    for (var i = 0; i < WEAPON_SENSITIVITY_DEFS.length; i++) {
      var id = WEAPON_SENSITIVITY_DEFS[i].id;
      copy[id] = { hip: value[id].hip, ads: value[id].ads };
    }
    return copy;
  }
  function bcSameWeaponSensitivity(a, b) {
    for (var i = 0; i < WEAPON_SENSITIVITY_DEFS.length; i++) {
      var id = WEAPON_SENSITIVITY_DEFS[i].id;
      if (a[id].hip !== b[id].hip || a[id].ads !== b[id].ads) return false;
    }
    return true;
  }
  function bcSettingCopy(key, value) {
    return key === 'weaponSensitivity' ? bcCopyWeaponSensitivity(value) : value;
  }
  function bcFormatWeaponMultiplier(value) {
    return value.toFixed(2) + '\u00d7';
  }
  function bcCrosshair(value) {
    var id = String(value == null ? '' : value).toLowerCase();
    return CROSSHAIRS.indexOf(id) >= 0 ? id : 'cross';
  }
  function bcTheme(value) {
    var id = String(value == null ? '' : value).toLowerCase();
    if (id === 'redblue' || id === 'red-blue') id = 'auto';
    return THEMES.indexOf(id) >= 0 ? id : 'auto';
  }
  function bcVolume(value) {
    return Math.round(bcClamp(bcNum(value, DEFAULT_VOLUME), 0, 1) * 100) / 100;
  }
  function bcMode(value) {
    var id = String(value == null ? '' : value).toLowerCase().trim().slice(0, 24);
    return MODE_IDS.indexOf(id) >= 0 ? id : 'tdm';
  }
  function bcHas(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }
  function bcValidTeam(value) {
    return value === 'red' || value === 'blue' ? value : null;
  }
  function bcFormatSensitivity(value) {
    return bcSensitivity(value).toFixed(2) + '\u00d7';
  }

  /* ---------------- persistence (never throws on file://) ---------------- */
  function bcReadStorage() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }
  function bcWriteStorage(data) {
    try {
      // Migrate the known fields without discarding unrelated saved choices.
      // A null-prototype target also keeps parsed "__proto__" keys inert.
      var saved = Object.assign(Object.create(null), stored, data);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      stored = saved;
      return true;
    } catch (err) { return false; /* private mode, file:// or quota — settings stay in memory */ }
  }
  function bcReadLegacySeed() {
    try {
      var raw = window.localStorage.getItem(LEGACY_SEED_KEY);
      if (raw == null || String(raw).trim() === '') return null;
      var n = Number(raw);
      return Number.isFinite(n) ? bcUint32(n, null) : null;
    } catch (err) {
      return null;
    }
  }
  function bcWriteLegacySeed(seed) {
    try {
      window.localStorage.setItem(LEGACY_SEED_KEY, String(seed >>> 0));
    } catch (err) { /* non-persistent file:// is fine */ }
  }

  function bcLiveSeed() {
    var world = BC.api && BC.api.world;
    if (world && typeof world.seed === 'function') {
      try {
        var fromWorld = Number(world.seed());
        if (Number.isFinite(fromWorld)) return bcUint32(fromWorld, 20261104);
      } catch (err) { /* world still booting */ }
    }
    try {
      if (typeof SEED !== 'undefined') {
        var fromCore = Number(SEED);
        if (Number.isFinite(fromCore)) return bcUint32(fromCore, 20261104);
      }
    } catch (err) { /* 00-core not loaded in a reduced build */ }
    var legacy = bcReadLegacySeed();
    return legacy == null ? 20261104 : legacy;
  }

  function bcActiveModeId() {
    var modes = BC.api && BC.api.modes;
    if (modes && typeof modes.active === 'string' && MODE_IDS.indexOf(modes.active) >= 0) return modes.active;
    return null;
  }

  /* ---------------- settings state ---------------- */
  var stored = bcReadStorage();
  var initialSeed = bcLiveSeed();
  var state = {
    sensitivity: bcSensitivity(bcHas(stored, 'sensitivity') ? stored.sensitivity : DEFAULT_SENSITIVITY),
    weaponSensitivity: bcSanitizeWeaponSensitivity(bcHas(stored, 'weaponSensitivity') ? stored.weaponSensitivity : null),
    crosshair: bcCrosshair(bcHas(stored, 'crosshair') ? stored.crosshair : 'cross'),
    theme: bcTheme(bcHas(stored, 'theme') ? stored.theme : 'auto'),
    volume: bcVolume(bcHas(stored, 'volume') ? stored.volume : DEFAULT_VOLUME),
    muted: stored.muted === true,
    mode: bcActiveModeId() || bcMode(bcHas(stored, 'mode') ? stored.mode : 'tdm'),
    seed: bcUint32(bcHas(stored, 'seed') ? stored.seed : initialSeed, initialSeed)
  };

  var listeners = [];
  var lobbyEl = null;
  var lobbyStatusEl = null;
  var seedValueEl = null;
  var seedButtonEl = null;
  var seedPending = false;
  var seedButtonBusy = null;
  var modePending = false;
  var configHintEl = null;
  var playOwnedLock = false;
  var playOwnedText = '';
  var roomHintBase = '';
  var roomHintOwned = false;
  var modeGridEl = null;
  var modeButtons = [];
  var sensInputEl = null;
  var sensValueEl = null;
  var sensPreviewEl = null;
  var weaponSensRowsEl = null;
  var weaponSensControls = [];
  var weaponSensSelectEl = null;
  var weaponSensSelected = 'rifle';
  var weaponHipEffectiveEl = null;
  var weaponAdsEffectiveEl = null;
  var crossGridEl = null;
  var crossButtons = [];
  var crossPreviewEl = null;
  var themeGroupEl = null;
  var themeButtons = [];
  var volumeInputEl = null;
  var volumeValueEl = null;
  var muteButtonEl = null;
  var matchModeEl = null;
  var matchRuleEl = null;
  var matchTeamEl = null;
  var matchScoreEl = null;
  var lobbyScoreRedEl = null;
  var lobbyScoreBlueEl = null;
  var teamScoreEl = null;
  var teamScoreRedEl = null;
  var teamScoreBlueEl = null;
  var teamScoreModeEl = null;
  var teamScoreMeterEl = null;
  var matchChipEl = null;
  var matchChipModeEl = null;
  var matchChipTeamEl = null;
  var matchChipBarRedEl = null;
  var matchChipBarBlueEl = null;
  var pingChipEl = null;
  var pingMsEl = null;
  var pingNetEl = null;
  var pingBarsEl = null;
  var readyHandled = false;
  var lastStatus = '';
  var lastHudKey = '';

  function bcStatus(text) {
    if (!lobbyStatusEl) return;
    var next = String(text == null ? '' : text);
    if (next === lastStatus) return;
    lastStatus = next;
    lobbyStatusEl.textContent = next;
  }

  /* ---------------- public store ---------------- */
  var api = {
    get sensitivity() { return state.sensitivity; },
    get weaponSensitivity() { return bcCopyWeaponSensitivity(state.weaponSensitivity); },
    get crosshair() { return state.crosshair; },
    get theme() { return state.theme; },
    get volume() { return state.volume; },
    get muted() { return state.muted; },
    get mode() { return bcActiveModeId() || state.mode; },
    get seed() { return state.seed; },
    read: function (key) {
      if (typeof key === 'string') return api.get(key);
      return {
        sensitivity: state.sensitivity, crosshair: state.crosshair, theme: state.theme,
        weaponSensitivity: bcCopyWeaponSensitivity(state.weaponSensitivity),
        volume: state.volume, muted: state.muted, mode: api.mode, seed: state.seed
      };
    },
    get: function (key) {
      if (key === 'mode') return api.mode;
      return typeof key === 'string' && bcHas(state, key) ? bcSettingCopy(key, state[key]) : undefined;
    },
    getWeaponSensitivity: function (id, aiming) {
      // Hot mouse-input path: direct scalar lookup, no snapshots / allocations.
      if (typeof id !== 'string' || !bcHas(state.weaponSensitivity, id)) return 1;
      return state.weaponSensitivity[id][aiming ? 'ads' : 'hip'];
    },
    setWeaponSensitivity: function (id, phase, value) {
      if (typeof id !== 'string' || !bcHas(state.weaponSensitivity, id) || (phase !== 'hip' && phase !== 'ads')) return undefined;
      var next = bcWeaponMultiplier(value);
      if (state.weaponSensitivity[id][phase] === next) return next;
      var map = bcCopyWeaponSensitivity(state.weaponSensitivity);
      map[id][phase] = next;
      // One store commit owns persistence, UI synchronization and one emission.
      api.set('weaponSensitivity', map);
      return next;
    },
    set: function (key, value) {
      if (typeof key !== 'string' || !bcHas(state, key)) return undefined;
      var next;
      if (key === 'sensitivity') next = bcSensitivity(value);
      else if (key === 'weaponSensitivity') next = bcSanitizeWeaponSensitivity(value);
      else if (key === 'crosshair') next = bcCrosshair(value);
      else if (key === 'theme') next = bcTheme(value);
      else if (key === 'volume') next = bcVolume(value);
      else if (key === 'muted') next = value === true || value === 1 || value === 'true';
      // Route public mode requests through the same authority-safe action.
      // Modes' post-commit writes already equal active and never recurse.
      else if (key === 'mode') {
        next = bcMode(value);
        var activeMode = bcActiveModeId();
        if (activeMode && next !== activeMode) {
          bcSelectMode(next);
          return bcActiveModeId() || state.mode;
        }
        if (activeMode) next = activeMode;
      }
      else next = bcUint32(value, state.seed);

      var changed = key === 'weaponSensitivity' ? !bcSameWeaponSensitivity(state[key], next) : state[key] !== next;
      state[key] = next;
      if (changed) {
        var saved = bcWriteStorage(state);
        if (key === 'seed') bcWriteLegacySeed(next);
        if (key !== 'seed' && key !== 'mode') {
          var saveStatus = document.getElementById('settingsSaveStatus');
          if (saveStatus) saveStatus.textContent = saved
            ? 'Saved on this device. Changes apply immediately; Back never resumes gameplay.'
            : 'Applied for this session. Browser storage is unavailable; Back never resumes gameplay.';
        }
      }
      bcApplySetting(key);
      if (!changed) return bcSettingCopy(key, next);

      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](key, bcSettingCopy(key, next)); } catch (err) { console.error('[BC] settings listener failed', err); }
      }
      try { BC.emit('settingsChanged', key, bcSettingCopy(key, next)); } catch (err) { console.error('[BC] settingsChanged failed', err); }
      return bcSettingCopy(key, next);
    },
    onChange: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () {
        var at = listeners.indexOf(fn);
        if (at >= 0) listeners.splice(at, 1);
      };
    },
    refresh: function () {
      var active = bcActiveModeId();
      if (active && active !== state.mode) api.set('mode', active);
      bcApplyAll();
      return api;
    },
    openLobby: function () {
      var menus = BC.api && BC.api.menus;
      if (menus) return BC.flags && BC.flags.hasPlayed ? menus.showPause() : menus.showHome();
      var hint = document.getElementById('hint');
      if (!hint) return false;
      if (document.pointerLockElement && typeof document.exitPointerLock === 'function') {
        try { document.exitPointerLock(); } catch (err) { /* already released */ }
      }
      hint.classList.remove('hidden');
      hint.hidden = false;
      hint.inert = false;
      hint.setAttribute('aria-hidden', 'false');
      var play = document.getElementById('play');
      if (play && !bcConfigBusy() && play.textContent !== 'Click to play') {
        play.textContent = 'Click to resume';
      }
      bcSyncSeedButton();
      return true;
    },
    closeLobby: function () {
      var menus = BC.api && BC.api.menus;
      if (menus) return menus.hide();
      var hint = document.getElementById('hint');
      if (!hint) return false;
      hint.classList.add('hidden');
      hint.hidden = true;
      hint.inert = true;
      hint.setAttribute('aria-hidden', 'true');
      return true;
    }
  };

  BC.settings = api;
  BC.api.settings = api;

  /* ---------------- modes (read lazily; fallback keeps the lobby usable) ---------------- */
  function bcModeDefs() {
    var modes = BC.api && BC.api.modes;
    var list = modes && modes.MODES;
    if (Array.isArray(list) && list.length) return list;
    return FALLBACK_MODES;
  }
  function bcFindMode(id) {
    var list = bcModeDefs();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    for (var j = 0; j < FALLBACK_MODES.length; j++) {
      if (FALLBACK_MODES[j].id === id) return FALLBACK_MODES[j];
    }
    return FALLBACK_MODES[0];
  }
  function bcModeName(id) {
    var def = bcFindMode(id);
    return (def && def.name) || 'Team Deathmatch';
  }
  function bcModeShort(id) {
    var def = bcFindMode(id);
    return (def && (def.short || def.name)) || 'TDM';
  }
  function bcCurrentModeId() {
    var active = bcActiveModeId();
    return active || state.mode;
  }
  function bcWorldBusy() {
    if (BC.flags && BC.flags.worldBusy) return true;
    var world = BC.api && BC.api.world;
    try { return !!(world && world.busy); } catch (err) { return false; }
  }
  function bcLoading() {
    // loading is declared in 99-boot.js, not in this earlier classic script.
    try { if (typeof loading !== 'undefined') return !!loading; } catch (err) { /* late binding */ }
    return !readyHandled && !(BC.flags && BC.flags.bootReady === true);
  }
  function bcConfigBusy() {
    return seedPending || modePending || bcWorldBusy() || bcLoading();
  }
  function bcCanConfigure() {
    var modes = BC.api && BC.api.modes;
    if (modes && typeof modes.canConfigure === 'function') {
      try { return !!modes.canConfigure(); } catch (err) { return false; }
    }
    // Reduced/older builds may configure solo, never a room of unknown authority.
    var connection = BC.api && BC.api.net;
    if (connection && (connection.online || connection.connected)) return false;
    try {
      if (typeof net !== 'undefined' && net && (net.online || net.mode === 'ws' || net.mode === 'mqtt')) return false;
    } catch (err) { return false; }
    return true;
  }
  function bcModeTeams(id) {
    var def = bcFindMode(id);
    if (!def) return true;
    return def.teams !== false;
  }
  function bcScorePair() {
    var modes = BC.api && BC.api.modes;
    var match = null;
    if (modes && typeof modes.matchState === 'function') {
      try { match = modes.matchState(); } catch (err) { match = null; }
    }
    var red = match && Number.isFinite(Number(match.red)) ? Math.max(0, Math.floor(Number(match.red))) : 0;
    var blue = match && Number.isFinite(Number(match.blue)) ? Math.max(0, Math.floor(Number(match.blue))) : 0;
    var team = bcValidTeam(match && match.selfTeam);
    if (!team && modes) team = bcValidTeam(modes.localTeam);
    return { red: red, blue: blue, team: team, match: match };
  }
  function bcResolvedTeam() {
    var pair = bcScorePair();
    return pair.team;
  }

  /* ---------------- crosshair artwork ---------------- */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function bcSvg(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (var key in attrs) {
        if (bcHas(attrs, key) && attrs[key] != null) el.setAttribute(key, String(attrs[key]));
      }
    }
    return el;
  }
  function bcCrosshairSvg(design, preview) {
    var svg = bcSvg('svg', {
      viewBox: '0 0 20 20', xmlns: SVG_NS, 'aria-hidden': 'true',
      focusable: 'false', 'shape-rendering': 'geometricPrecision'
    });
    if (design === 'none') {
      if (!preview) return svg;
      var off = bcSvg('g', { stroke: '#7f929f', fill: 'none', 'stroke-width': '1.4', 'stroke-linecap': 'round' });
      var ring = bcSvg('circle', { cx: 10, cy: 10, r: 5.6, 'stroke-dasharray': '2 2.4' });
      var slash = bcSvg('path', { d: 'M6.4 6.4 13.6 13.6' });
      off.appendChild(ring);
      off.appendChild(slash);
      svg.appendChild(off);
      return svg;
    }

    // Every mark is white with a one-pixel dark outline. Duplicated strokes give
    // the outline on lines without filters, so it stays crisp on sky and terrain.
    var outline = bcSvg('g', { stroke: '#050c12', 'stroke-width': '3.2', 'stroke-linecap': 'butt', fill: 'none' });
    var white = bcSvg('g', { stroke: '#f5fbff', 'stroke-width': '1.6', 'stroke-linecap': 'butt', fill: 'none' });
    var fillOutline = bcSvg('g', { stroke: '#050c12', 'stroke-width': '1', 'stroke-linejoin': 'round' });
    var fillWhite = bcSvg('g', { stroke: '#050c12', 'stroke-width': '0.6', 'stroke-linejoin': 'round', fill: '#f5fbff' });

    function linePath(d) {
      outline.appendChild(bcSvg('path', { d: d }));
      white.appendChild(bcSvg('path', { d: d }));
    }
    function block(x, y, w, h) {
      fillOutline.appendChild(bcSvg('rect', { x: x, y: y, width: w, height: h, rx: 0.35, fill: 'none' }));
      fillWhite.appendChild(bcSvg('rect', { x: x, y: y, width: w, height: h, rx: 0.35 }));
    }
    function dot(cx, cy, r) {
      fillOutline.appendChild(bcSvg('circle', { cx: cx, cy: cy, r: r, fill: 'none' }));
      fillWhite.appendChild(bcSvg('circle', { cx: cx, cy: cy, r: r }));
    }

    if (design === 'dot') {
      dot(10, 10, 1.75);
      svg.appendChild(fillOutline);
      svg.appendChild(fillWhite);
      return svg;
    }
    if (design === 'circle') {
      linePath('M10 4.3 A5.7 5.7 0 1 0 10 15.7 A5.7 5.7 0 1 0 10 4.3');
      dot(10, 10, 1.1);
      svg.appendChild(outline);
      svg.appendChild(white);
      svg.appendChild(fillOutline);
      svg.appendChild(fillWhite);
      return svg;
    }
    if (design === 'brackets') {
      linePath('M2.5 7 V2.5 H7 M13 2.5 H17.5 V7 M2.5 13 V17.5 H7 M13 17.5 H17.5 V13');
      dot(10, 10, 1.05);
      svg.appendChild(outline);
      svg.appendChild(white);
      svg.appendChild(fillOutline);
      svg.appendChild(fillWhite);
      return svg;
    }
    if (design === 'chevron') {
      linePath('M5 12.4 L10 7.8 L15 12.4');
      dot(10, 15.4, 1.1);
      svg.appendChild(outline);
      svg.appendChild(white);
      svg.appendChild(fillOutline);
      svg.appendChild(fillWhite);
      return svg;
    }
    if (design === 'tcross') {
      block(2, 6.6, 16, 2);
      block(9, 6.6, 2, 10.4);
      svg.appendChild(fillOutline);
      svg.appendChild(fillWhite);
      return svg;
    }

    // default: classic four-arm cross
    block(9, 2, 2, 5.4);
    block(9, 12.6, 2, 5.4);
    block(2, 9, 5.4, 2);
    block(12.6, 9, 5.4, 2);
    svg.appendChild(fillOutline);
    svg.appendChild(fillWhite);
    return svg;
  }
  function bcCrosshairLabel(id) {
    if (id === 'tcross') return 'T-cross';
    if (id === 'none') return 'Off';
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  /* ---------------- lobby DOM ---------------- */
  function bcBuildModeCards() {
    if (!modeGridEl) return;
    modeButtons = [];
    while (modeGridEl.firstChild) modeGridEl.removeChild(modeGridEl.firstChild);
    var defs = bcModeDefs();
    for (var i = 0; i < defs.length; i++) {
      var def = defs[i];
      if (!def || typeof def.id !== 'string') continue;
      var teams = def.teams !== false;
      var teamRow = BC.el('span', { className: 'bcs-teams', 'aria-hidden': 'true' }, teams
        ? [BC.el('i', { className: 'bcs-dot red' }), BC.el('i', { className: 'bcs-dot blue' })]
        : [BC.el('i', { className: 'bcs-dot free' })]);
      var button = BC.el('button', {
        type: 'button', className: 'bcs-mode', 'aria-pressed': 'false',
        dataset: { mode: def.id }, title: def.desc || def.name || def.id,
        onclick: (function (id) { return function () { bcSelectMode(id); }; })(def.id)
      }, [
        BC.el('span', { className: 'bcs-mode-name', text: def.name || def.id }),
        BC.el('span', { className: 'bcs-mode-rule', text: def.desc || 'Standard match rules.' }),
        teamRow
      ]);
      modeGridEl.appendChild(button);
      modeButtons.push({ id: def.id, el: button });
    }
    if (!modeButtons.length) {
      for (var f = 0; f < FALLBACK_MODES.length; f++) {
        var fb = FALLBACK_MODES[f];
        var fbutton = BC.el('button', {
          type: 'button', className: 'bcs-mode', 'aria-pressed': 'false',
          dataset: { mode: fb.id }, title: fb.desc,
          onclick: (function (id) { return function () { bcSelectMode(id); }; })(fb.id)
        }, [
          BC.el('span', { className: 'bcs-mode-name', text: fb.name }),
          BC.el('span', { className: 'bcs-mode-rule', text: fb.desc }),
          BC.el('span', { className: 'bcs-teams', 'aria-hidden': 'true' }, fb.teams
            ? [BC.el('i', { className: 'bcs-dot red' }), BC.el('i', { className: 'bcs-dot blue' })]
            : [BC.el('i', { className: 'bcs-dot free' })])
        ]);
        modeGridEl.appendChild(fbutton);
        modeButtons.push({ id: fb.id, el: fbutton });
      }
    }
    bcSyncModeCards();
  }

  function bcBuildCrosshairButtons() {
    if (!crossGridEl) return;
    crossButtons = [];
    while (crossGridEl.firstChild) crossGridEl.removeChild(crossGridEl.firstChild);
    for (var i = 0; i < CROSSHAIRS.length; i++) {
      var id = CROSSHAIRS[i];
      var label = bcCrosshairLabel(id);
      var button = BC.el('button', {
        type: 'button', className: 'bcs-cross', 'aria-pressed': 'false',
        dataset: { crosshair: id }, 'aria-label': 'Crosshair ' + label,
        onclick: (function (design) { return function () { api.set('crosshair', design); }; })(id)
      }, [
        bcCrosshairSvg(id, true),
        BC.el('span', { text: label })
      ]);
      crossGridEl.appendChild(button);
      crossButtons.push({ id: id, el: button });
    }
    bcSyncCrosshairButtons();
  }

  function bcBuildThemeButtons() {
    if (!themeGroupEl) return;
    themeButtons = [];
    while (themeGroupEl.firstChild) themeGroupEl.removeChild(themeGroupEl.firstChild);
    for (var i = 0; i < THEMES.length; i++) {
      var theme = THEMES[i];
      var label = theme === 'auto' ? 'Auto' : (theme === 'red' ? 'Red' : 'Blue');
      var button = BC.el('button', {
        type: 'button', 'aria-pressed': 'false', dataset: { theme: theme },
        'aria-label': theme === 'auto' ? 'Automatic team accent' : label + ' accent',
        onclick: (function (value) { return function () { api.set('theme', value); }; })(theme)
      }, [
        BC.el('i', { className: 'bcs-dot ' + (theme === 'red' ? 'red' : theme === 'blue' ? 'blue' : 'free') }),
        BC.el('span', { text: label })
      ]);
      themeGroupEl.appendChild(button);
      themeButtons.push({ id: theme, el: button });
    }
    bcSyncThemeButtons();
  }

  function bcBuildWeaponSensControl(def, phase) {
    var id = 'bcWeaponSens-' + def.id + '-' + phase;
    var phaseLabel = phase === 'ads' ? 'ADS' : 'Hipfire';
    var value = state.weaponSensitivity[def.id][phase];
    var input = BC.el('input', {
      id: id, type: 'range', min: '0.35', max: '2.5', step: '0.01', value: String(value),
      'aria-label': def.name + ' ' + phaseLabel + ' sensitivity multiplier', 'aria-describedby': 'bcWeaponSensHelp'
    });
    var output = BC.el('output', { id: id + 'Value', for: id, text: bcFormatWeaponMultiplier(value) });
    input.addEventListener('input', function () { api.setWeaponSensitivity(def.id, phase, input.value); });
    weaponSensControls.push({ id: def.id, phase: phase, input: input, output: output });
    return BC.el('div', { className: 'bcs-weapon-control' }, [
      BC.el('label', { htmlFor: id, className: 'bcs-weapon-phase', text: phaseLabel }),
      BC.el('div', { className: 'bcs-row' }, [input, output])
    ]);
  }

  function bcBuildWeaponSensRows() {
    if (!weaponSensRowsEl) return;
    weaponSensControls.length = 0;
    while (weaponSensRowsEl.firstChild) weaponSensRowsEl.removeChild(weaponSensRowsEl.firstChild);
    for (var i = 0; i < WEAPON_SENSITIVITY_DEFS.length; i++) {
      var def = WEAPON_SENSITIVITY_DEFS[i];
      var labelId = 'bcWeaponSens-' + def.id + '-label';
      weaponSensRowsEl.appendChild(BC.el('div', {
        className: 'bcs-weapon-row', role: 'group', 'aria-labelledby': labelId, dataset: { weapon: def.id }
      }, [
        BC.el('h3', { id: labelId, className: 'bcs-weapon-name', text: def.name }),
        bcBuildWeaponSensControl(def, 'hip'), bcBuildWeaponSensControl(def, 'ads')
      ]));
    }
    bcSelectWeaponSensRow();
    bcSyncWeaponSensControls();
  }

  function bcSelectWeaponSensRow() {
    if (weaponSensSelectEl) weaponSensSelected = weaponSensSelectEl.value;
    if (!bcHas(state.weaponSensitivity, weaponSensSelected)) weaponSensSelected = 'rifle';
    if (weaponSensRowsEl) {
      var rows = weaponSensRowsEl.querySelectorAll('.bcs-weapon-row');
      for (var i = 0; i < rows.length; i++) {
        rows[i].hidden = rows[i].dataset.weapon !== weaponSensSelected;
        rows[i].inert = rows[i].hidden;
      }
    }
    bcSyncWeaponPreview();
  }

  function bcSyncWeaponPreview() {
    var multipliers = state.weaponSensitivity[weaponSensSelected];
    if (!multipliers) return;
    if (weaponHipEffectiveEl) weaponHipEffectiveEl.textContent = (state.sensitivity * multipliers.hip).toFixed(2) + '\u00d7';
    if (weaponAdsEffectiveEl) weaponAdsEffectiveEl.textContent = (state.sensitivity * multipliers.ads).toFixed(2) + '\u00d7';
  }

  function bcBuildLobby() {
    var homeHost = document.getElementById('homeMatchHost');
    var setupHost = document.getElementById('playSetupContent');
    var aimHost = document.getElementById('settingsAim');
    var reticleHost = document.getElementById('settingsReticle');
    var audioHost = document.getElementById('settingsAudio');
    var statusHost = document.getElementById('playSetupStatusHost');
    if (!homeHost || !setupHost || !aimHost || !reticleHost || !audioHost || !statusHost || document.getElementById('bcLobby')) return;

    lobbyStatusEl = BC.el('span', {
      id: 'lobbyStatus', role: 'status', 'aria-live': 'polite', text: 'Generating world\u2026'
    });
    lastStatus = 'Generating world\u2026';
    statusHost.appendChild(lobbyStatusEl);

    modeGridEl = BC.el('div', {
      id: 'bcModeGrid', className: 'bcs-modes', role: 'group', 'aria-labelledby': 'bcModeLabel'
    });
    var modeSection = BC.el('section', { className: 'bcs-section' }, [
      BC.el('h2', { className: 'bcs-label', id: 'bcModeLabel', text: 'Game mode' }),
      modeGridEl,
      configHintEl = BC.el('p', {
        id: 'bcConfigHint', className: 'bcs-note', role: 'status', 'aria-live': 'polite',
        text: 'Personal aim and audio settings stay yours.'
      })
    ]);

    sensInputEl = BC.el('input', {
      id: 'bcSens', type: 'range', min: '0.35', max: '2.5', step: '0.05',
      value: String(state.sensitivity), 'aria-label': 'Global aim sensitivity base'
    });
    sensValueEl = BC.el('output', { id: 'bcSensValue', for: 'bcSens', text: bcFormatSensitivity(state.sensitivity) });
    sensPreviewEl = BC.el('span', { id: 'bcSensPreview', text: bcFormatSensitivity(state.sensitivity) });
    sensInputEl.addEventListener('input', function () { api.set('sensitivity', sensInputEl.value); });

    crossGridEl = BC.el('div', {
      id: 'bcCrosshairGrid', className: 'bcs-crosses', role: 'group', 'aria-label': 'Crosshair design'
    });
    themeGroupEl = BC.el('div', {
      id: 'bcThemeGroup', className: 'bcs-seg', role: 'group', 'aria-label': 'Personal accent'
    });

    var aimSection = BC.el('section', { className: 'bcs-section bcs-aim-section' }, [
      BC.el('label', { className: 'bcs-label bcs-aim-label', htmlFor: 'bcSens', text: 'Global aim base' }),
      BC.el('div', { className: 'bcs-row' }, [sensInputEl, sensValueEl]),
      BC.el('p', { className: 'bcs-note' }, [
        BC.el('b', { text: 'Base' }), ' ', sensPreviewEl,
        ' \u00b7 Weapon multipliers below tune hipfire / ADS. Building and riding use only this base.'
      ])
    ]);

    volumeInputEl = BC.el('input', {
      id: 'bcVolume', type: 'range', min: '0', max: '100', step: '1',
      value: String(Math.round(state.volume * 100)), 'aria-label': 'Master volume'
    });
    volumeValueEl = BC.el('output', { id: 'bcVolumeValue', for: 'bcVolume', text: Math.round(state.volume * 100) + '%' });
    volumeInputEl.addEventListener('input', function () { api.set('volume', Number(volumeInputEl.value) / 100); });

    muteButtonEl = BC.el('button', {
      id: 'bcMute', type: 'button', className: 'bcs-toggle', 'aria-pressed': 'false',
      onclick: function () { api.set('muted', !state.muted); }
    }, [
      BC.el('span', { text: 'Mute sound' }),
      BC.el('span', { className: 'bcs-state', id: 'bcMuteState', text: 'Off' })
    ]);

    seedValueEl = BC.el('code', { id: 'bcSeedValue', text: String(state.seed) });
    seedButtonEl = BC.el('button', {
      id: 'bcSeedRandom', type: 'button', className: 'bc-button', text: 'Randomize map',
      onclick: bcRandomizeMap
    });

    matchModeEl = BC.el('h2', { id: 'bcMatchMode', text: bcModeName(bcCurrentModeId()) });
    matchRuleEl = BC.el('p', { id: 'bcMatchRule', text: bcFindMode(bcCurrentModeId()).desc || '' });
    matchTeamEl = BC.el('b', { id: 'bcMatchTeam', text: 'Red' });
    matchScoreEl = BC.el('b', { id: 'bcMatchScore', text: '0 \u2013 0' });
    var audioSection = BC.el('section', { className: 'bcs-section bcs-aim-section' }, [
      BC.el('label', { className: 'bcs-label', htmlFor: 'bcVolume', text: 'Master volume' }),
      BC.el('div', { className: 'bcs-row' }, [volumeInputEl, volumeValueEl]),
      muteButtonEl,
      BC.el('p', { className: 'bcs-note', text: 'Weapon, movement and world audio share this volume. M toggles mute during play. Audio starts with a Play or Resume gesture.' })
    ]);

    var mapSection = BC.el('section', { className: 'bcs-section bcs-map-section' }, [
      BC.el('h2', { className: 'bcs-label', text: 'World seed' }),
      BC.el('div', { className: 'bcs-seedrow' }, [seedValueEl, seedButtonEl]),
      BC.el('p', { className: 'bcs-note', id: 'bcSeedHint', text: 'Randomizing rebuilds the current world. In a room, only the host can change the shared mode and seed. A ?seed= URL overrides the saved solo seed.' })
    ]);

    weaponSensSelectEl = BC.el('select', { id: 'bcWeaponSelect', 'aria-controls': 'bcWeaponSensRows' });
    for (var w = 0; w < WEAPON_SENSITIVITY_DEFS.length; w++) {
      var weaponDef = WEAPON_SENSITIVITY_DEFS[w];
      weaponSensSelectEl.appendChild(BC.el('option', { value: weaponDef.id, text: weaponDef.name }));
    }
    weaponSensSelectEl.value = weaponSensSelected;
    weaponSensSelectEl.addEventListener('change', bcSelectWeaponSensRow);
    weaponSensRowsEl = BC.el('div', { id: 'bcWeaponSensRows' });
    var weaponSection = BC.el('section', {
      id: 'bcWeaponSensitivity', className: 'bcs-section bcs-weapon-section', 'aria-labelledby': 'bcWeaponSensLabel'
    }, [
      BC.el('div', { className: 'bcs-weapon-head' }, [
        BC.el('h2', { id: 'bcWeaponSensLabel', className: 'bcs-label', text: 'Per-weapon aim' }),
        BC.el('button', {
          id: 'bcWeaponSensReset', type: 'button', className: 'bc-button bc-button-quiet', text: 'Reset all weapon aim',
          title: 'Reset all weapon hipfire and ADS multipliers to 1.00\u00d7; keep the global base',
          onclick: function () {
            api.set('weaponSensitivity', null);
            bcStatus('Weapon multipliers reset \u00b7 global base unchanged.');
          }
        })
      ]),
      BC.el('p', {
        id: 'bcWeaponSensHelp', className: 'bcs-note',
        text: 'Hipfire and ADS (aim down sights) multiply the global base. 1.00\u00d7 keeps that base unchanged. These settings are personal, including in a room.'
      }),
      BC.el('label', { className: 'bc-field', htmlFor: 'bcWeaponSelect' }, [
        BC.el('span', { text: 'Tune a weapon' }), weaponSensSelectEl
      ]),
      weaponSensRowsEl,
      BC.el('div', { className: 'bcs-effective', 'aria-label': 'Effective sensitivity including the global base' }, [
        BC.el('span', { text: 'With global base:' }),
        BC.el('span', {}, ['Hipfire ', weaponHipEffectiveEl = BC.el('output', { id: 'bcWeaponHipEffective', for: 'bcSens bcWeaponSelect', text: '1.00\u00d7' })]),
        BC.el('span', {}, ['ADS ', weaponAdsEffectiveEl = BC.el('output', { id: 'bcWeaponAdsEffective', for: 'bcSens bcWeaponSelect', text: '1.00\u00d7' })])
      ])
    ]);

    lobbyEl = BC.el('section', {
      id: 'bcLobby', className: 'bcs-lobby', 'aria-label': 'Current match'
    }, [
      matchModeEl, matchRuleEl,
      BC.el('dl', { className: 'bcs-match' }, [
        BC.el('dt', { text: 'Team' }), BC.el('dd', {}, [matchTeamEl]),
        BC.el('dt', { text: 'Score' }), BC.el('dd', {}, [matchScoreEl])
      ])
    ]);

    homeHost.appendChild(lobbyEl);
    setupHost.appendChild(BC.el('div', { className: 'bcs-setup-layout' }, [modeSection, mapSection]));
    aimHost.appendChild(aimSection);
    aimHost.appendChild(weaponSection);
    crossPreviewEl = BC.el('div', { id: 'bcCrosshairPreview', role: 'img', 'aria-label': 'Selected crosshair preview' });
    reticleHost.appendChild(BC.el('section', { className: 'bcs-section' }, [
      BC.el('h2', { className: 'bcs-label', text: 'Crosshair' }),
      BC.el('div', { className: 'bcs-cross-layout' }, [crossGridEl, crossPreviewEl]),
      BC.el('p', { className: 'bcs-note', text: 'White with a dark outline, readable against sky and terrain. The crosshair hides while aiming through each weapon\u2019s physical sights. Only the sniper uses a scope tube.' })
    ]));
    reticleHost.appendChild(BC.el('section', { className: 'bcs-section' }, [
      BC.el('h2', { className: 'bcs-label', text: 'Personal HUD accent' }), themeGroupEl,
      BC.el('p', { className: 'bcs-note', text: 'Auto follows your team. Your accent does not change anyone else\u2019s HUD or the red-versus-blue match identity.' })
    ]));
    audioHost.appendChild(audioSection);
    bcBuildModeCards();
    bcBuildCrosshairButtons();
    bcBuildThemeButtons();
    bcBuildWeaponSensRows();
    bcSyncSeedLabel();
    bcSyncSensControls();
    bcSyncVolumeControls();
    bcUpdateHud(true);
  }

  /* ---------------- control synchronisation ---------------- */
  function bcSyncModeCards() {
    var active = bcCurrentModeId();
    var canConfigure = bcCanConfigure();
    var busy = bcConfigBusy();
    var modes = BC.api && BC.api.modes;
    var available = !!(modes && typeof modes.setActive === 'function');
    for (var i = 0; i < modeButtons.length; i++) {
      var entry = modeButtons[i];
      if (!entry.el) continue;
      var on = entry.id === active;
      entry.el.setAttribute('aria-pressed', on ? 'true' : 'false');
      entry.el.classList.toggle('is-active', on);
      entry.el.disabled = busy || !canConfigure || !available;
      entry.el.setAttribute('aria-disabled', entry.el.disabled ? 'true' : 'false');
      entry.el.setAttribute('aria-busy', busy ? 'true' : 'false');
      entry.el.setAttribute('aria-describedby', 'bcConfigHint');
      var def = bcFindMode(entry.id);
      entry.el.title = !canConfigure ? 'Host controls mode and map'
        : busy ? 'Configuration is loading' : (def.desc || def.name || entry.id);
    }
  }

  function bcSyncCrosshairButtons() {
    for (var i = 0; i < crossButtons.length; i++) {
      var entry = crossButtons[i];
      if (!entry.el) continue;
      var on = entry.id === state.crosshair;
      entry.el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function bcSyncThemeButtons() {
    for (var i = 0; i < themeButtons.length; i++) {
      var entry = themeButtons[i];
      if (!entry.el) continue;
      entry.el.setAttribute('aria-pressed', entry.id === state.theme ? 'true' : 'false');
    }
  }

  function bcSyncSensControls() {
    var text = bcFormatSensitivity(state.sensitivity);
    if (sensInputEl) {
      if (sensInputEl.value !== String(state.sensitivity)) sensInputEl.value = String(state.sensitivity);
      sensInputEl.setAttribute('aria-valuetext', text + ' global base');
    }
    if (sensValueEl) sensValueEl.textContent = text;
    if (sensPreviewEl) sensPreviewEl.textContent = text;
    bcSyncWeaponPreview();
  }

  function bcSyncWeaponSensControls() {
    // Only explicit store changes / refreshes call this. Read internal scalars,
    // not the defensive-copy API, and keep all fourteen native controls alive.
    for (var i = 0; i < weaponSensControls.length; i++) {
      var control = weaponSensControls[i];
      var value = state.weaponSensitivity[control.id][control.phase];
      var raw = String(value);
      var text = bcFormatWeaponMultiplier(value);
      if (control.input.value !== raw) control.input.value = raw;
      if (control.output.textContent !== text) control.output.textContent = text;
      if (control.input.getAttribute('aria-valuetext') !== text) control.input.setAttribute('aria-valuetext', text);
    }
    bcSyncWeaponPreview();
  }

  function bcSyncVolumeControls() {
    var pct = Math.round(state.volume * 100);
    if (volumeInputEl) {
      if (volumeInputEl.value !== String(pct)) volumeInputEl.value = String(pct);
      volumeInputEl.setAttribute('aria-valuetext', pct + ' percent');
    }
    if (volumeValueEl) volumeValueEl.textContent = pct + '%';
    if (muteButtonEl) {
      muteButtonEl.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
      muteButtonEl.setAttribute('aria-label', state.muted ? 'Unmute sound' : 'Mute sound');
    }
    var muteState = document.getElementById('bcMuteState');
    if (muteState) muteState.textContent = state.muted ? 'Muted' : 'Live';
  }

  function bcSyncSeedLabel() {
    if (!seedValueEl) return;
    var text = String(state.seed >>> 0);
    if (seedValueEl.textContent !== text) seedValueEl.textContent = text;
    seedValueEl.title = 'World seed ' + text;
  }

  var seedButtonText = '';
  function bcSyncSeedButton() {
    var world = BC.api && BC.api.world;
    var busy = bcConfigBusy();
    var canConfigure = bcCanConfigure();
    var available = !!(world && typeof world.regenerate === 'function');
    var disabled = busy || !canConfigure || !available;
    if (seedButtonEl && seedButtonBusy !== disabled) {
      seedButtonBusy = disabled;
      seedButtonEl.disabled = disabled;
      seedButtonEl.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
    if (seedButtonEl) {
      seedButtonEl.setAttribute('aria-busy', busy ? 'true' : 'false');
      seedButtonEl.setAttribute('aria-describedby', 'bcConfigHint');
      seedButtonEl.title = !canConfigure ? 'Host controls mode and map'
        : !available ? 'Map controls are not available yet' : 'Generate a new shared world seed';
    }
    var text = seedPending ? 'Rebuilding\u2026' : !canConfigure ? 'Host controlled' : 'Randomize map';
    if (seedButtonEl && seedButtonText !== text) {
      seedButtonText = text;
      seedButtonEl.textContent = text;
    }
    bcSyncModeCards();

    var note = busy ? 'Loading configuration\u2026 Personal settings remain available.'
      : !canConfigure ? 'Host controls mode and map. Personal settings remain available.'
      : 'Personal aim and audio settings stay yours.';
    if (configHintEl) {
      if (configHintEl.textContent !== note) configHintEl.textContent = note;
      configHintEl.dataset.locked = canConfigure ? 'false' : 'true';
    }
    // Network owns roomHint's connection progress. Host locks have their own
    // labelled explanation on Play setup, so they never erase a join/error hint.

    var play = document.getElementById('play');
    if (!play) return;
    if (busy) {
      playOwnedLock = true;
      play.disabled = true;
      play.setAttribute('aria-busy', 'true');
      // Preserve boot's progress text; only a runtime rebuild belongs to us.
      if (!bcLoading()) {
        playOwnedText = seedPending || bcWorldBusy() ? 'Rebuilding world\u2026' : 'Applying mode\u2026';
        if (play.textContent !== playOwnedText) play.textContent = playOwnedText;
      }
    } else if (playOwnedLock) {
      playOwnedLock = false;
      play.disabled = false;
      play.setAttribute('aria-busy', 'false');
      if (playOwnedText && play.textContent === playOwnedText) {
        play.textContent = 'Play';
      }
      playOwnedText = '';
    }
  }

  /* ---------------- visual application ---------------- */
  function bcApplyCrosshair() {
    var host = document.getElementById('crosshair');
    if (host) {
      while (host.firstChild) host.removeChild(host.firstChild);
      host.dataset.design = state.crosshair;
      if (state.crosshair !== 'none') host.appendChild(bcCrosshairSvg(state.crosshair, false));
    }
    if (crossPreviewEl) {
      while (crossPreviewEl.firstChild) crossPreviewEl.removeChild(crossPreviewEl.firstChild);
      crossPreviewEl.appendChild(bcCrosshairSvg(state.crosshair, true));
      crossPreviewEl.setAttribute('aria-label', bcCrosshairLabel(state.crosshair) + ' crosshair preview');
    }
    bcSyncCrosshairButtons();
  }

  function bcApplyTheme() {
    var accent = 'auto';
    if (state.theme === 'red' || state.theme === 'blue') accent = state.theme;
    else {
      var team = bcResolvedTeam();
      accent = team || 'auto';
    }
    var body = document.body;
    if (body.dataset.bcAccent !== accent) body.dataset.bcAccent = accent;
    if (body.dataset.bcTheme !== state.theme) body.dataset.bcTheme = state.theme;
    bcSyncThemeButtons();
  }

  function bcApplyAudio() {
    var audio = BC.api && BC.api.audio;
    if (!audio) return;
    try {
      if (typeof audio.setVolume === 'function') audio.setVolume(state.volume);
    } catch (err) { /* the audio module may still be booting */ }
    try {
      if (typeof audio.setMuted === 'function') audio.setMuted(state.muted);
    } catch (err) { /* the audio module may still be booting */ }
  }

  function bcApplySetting(key) {
    if (key === 'sensitivity') bcSyncSensControls();
    else if (key === 'weaponSensitivity') bcSyncWeaponSensControls();
    else if (key === 'crosshair') bcApplyCrosshair();
    else if (key === 'theme') bcApplyTheme();
    else if (key === 'volume' || key === 'muted') { bcSyncVolumeControls(); bcApplyAudio(); }
    else if (key === 'mode') { bcSyncModeCards(); bcUpdateHud(true); }
    else if (key === 'seed') bcSyncSeedLabel();
  }

  function bcApplyAll() {
    bcApplyCrosshair();
    bcApplyTheme();
    bcApplyAudio();
    bcSyncSensControls();
    bcSyncWeaponSensControls();
    bcSyncVolumeControls();
    bcSyncModeCards();
    bcSyncSeedLabel();
    bcSyncSeedButton();
    bcUpdateHud(true);
  }

  /* ---------------- actions ---------------- */
  function bcSelectMode(id) {
    var next = bcMode(id);
    var modes = BC.api && BC.api.modes;
    if (!bcCanConfigure()) {
      bcStatus('Host controls mode and map');
      bcSyncSeedButton();
      return;
    }
    if (bcConfigBusy()) { bcStatus('Configuration is loading\u2026'); return; }
    if (!modes || typeof modes.setActive !== 'function') {
      bcStatus('Mode controls are unavailable in this build.');
      return;
    }
    modePending = true;
    bcSyncSeedButton();
    function finish(error) {
      modePending = false;
      var active = bcActiveModeId();
      if (active) api.set('mode', active);
      bcSyncSeedButton();
      bcUpdateHud(true);
      if (error) bcStatus('Mode unchanged \u00b7 ' + bcModeName(bcCurrentModeId()));
      else if (active === next) bcStatus('Mode \u00b7 ' + bcModeName(active));
      else if (bcWorldBusy()) bcStatus('Applying mode\u2026');
      else bcStatus('Mode unchanged \u00b7 ' + bcModeName(bcCurrentModeId()));
    }
    var task;
    try { task = modes.setActive(next); } catch (err) { finish(err); return; }
    if (task && typeof task.then === 'function') {
      task.then(function () { finish(null); }, function (err) { finish(err); });
    } else finish(null);
  }

  function bcRandomSeed() {
    var seed = 0;
    try {
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        var buffer = new Uint32Array(1);
        window.crypto.getRandomValues(buffer);
        seed = buffer[0];
      }
    } catch (err) { seed = 0; }
    if (!seed) seed = (Math.random() * 4294967296) >>> 0;
    return (seed >>> 0) || 1;
  }

  function bcRandomizeMap() {
    if (!bcCanConfigure()) {
      bcStatus('Host controls mode and map');
      bcSyncSeedButton();
      return;
    }
    if (bcConfigBusy()) { bcStatus('Configuration is loading\u2026'); bcSyncSeedButton(); return; }
    var world = BC.api && BC.api.world;
    if (!world || typeof world.regenerate !== 'function') {
      bcStatus('Map controls are unavailable in this build.');
      return;
    }
    var seed = bcRandomSeed();
    var finished = false;
    seedPending = true;
    bcSyncSeedButton();
    bcStatus('Rebuilding world\u2026');

    function finish(error) {
      if (finished) return;
      finished = true;
      seedPending = false;
      if (!error) {
        // A queued room change may have been denied or superseded. Persist
        // the world that actually committed, never the requested seed.
        api.set('seed', bcLiveSeed());
        bcSyncSeedLabel();
      }
      bcSyncSeedButton();
      if (error) {
        if (window.console && console.warn) console.warn('[BC] map regeneration failed', error);
        bcStatus('Map rebuild failed \u00b7 staying on the current world.');
      } else {
        bcStatus((state.seed === seed ? 'Map ready' : 'Map unchanged') + ' \u00b7 seed ' + (state.seed >>> 0));
      }
    }

    var task;
    try { task = world.regenerate(seed); }
    catch (err) { finish(err); return; }
    if (task && typeof task.then === 'function') {
      task.then(function () { finish(null); }, function (err) { finish(err); });
    } else {
      finish(null);
    }
  }

  /* ---------------- one-time top-HUD ID scaffold ----------------
     86-hud.js reuses and nests these nodes. No live chrome writer or ping
     interval belongs to settings; the scaffold is hidden until 86 is loaded. */
  function bcBuildHud() {
    if (!document.getElementById('teamScore')) {
      teamScoreRedEl = BC.el('b', { id: 'teamScoreRed', text: '0' });
      teamScoreBlueEl = BC.el('b', { id: 'teamScoreBlue', text: '0' });
      teamScoreModeEl = BC.el('span', { id: 'teamScoreMode', text: 'TDM' });
      teamScoreMeterEl = BC.el('i', { className: 'ts-meter' });
      teamScoreEl = BC.el('div', {
        id: 'teamScore', role: 'status', 'aria-live': 'off', 'aria-label': 'Team score'
      }, [
        BC.el('div', { className: 'ts-side red' }, [
          BC.el('span', { className: 'ts-tag', text: 'Red' }), teamScoreRedEl
        ]),
        BC.el('div', { className: 'ts-mid' }, [teamScoreModeEl]),
        BC.el('div', { className: 'ts-side blue' }, [
          teamScoreBlueEl, BC.el('span', { className: 'ts-tag', text: 'Blue' })
        ]),
        teamScoreMeterEl
      ]);
      document.body.appendChild(teamScoreEl);
    } else {
      teamScoreEl = document.getElementById('teamScore');
      teamScoreRedEl = document.getElementById('teamScoreRed');
      teamScoreBlueEl = document.getElementById('teamScoreBlue');
      teamScoreModeEl = document.getElementById('teamScoreMode');
      teamScoreMeterEl = document.querySelector('#teamScore .ts-meter');
    }

    if (!document.getElementById('matchChip')) {
      matchChipModeEl = BC.el('b', { id: 'matchMode', text: 'TDM' });
      matchChipTeamEl = BC.el('span', { id: 'matchTeam', className: 'mc-team red', text: 'RED' });
      matchChipBarRedEl = BC.el('i', { className: 'red' });
      matchChipBarBlueEl = BC.el('i', { className: 'blue' });
      matchChipEl = BC.el('div', {
        id: 'matchChip', role: 'status', 'aria-live': 'off', 'aria-label': 'Current mode and team'
      }, [
        matchChipModeEl,
        BC.el('span', { className: 'mc-sep', text: '\u00b7' }),
        matchChipTeamEl,
        BC.el('span', { className: 'mc-bar', 'aria-hidden': 'true' }, [matchChipBarRedEl, matchChipBarBlueEl])
      ]);
      document.body.appendChild(matchChipEl);
    } else {
      matchChipEl = document.getElementById('matchChip');
      matchChipModeEl = document.getElementById('matchMode');
      matchChipTeamEl = document.getElementById('matchTeam');
      matchChipBarRedEl = document.querySelector('#matchChip .mc-bar .red');
      matchChipBarBlueEl = document.querySelector('#matchChip .mc-bar .blue');
    }

    if (!document.getElementById('pingChip')) {
      pingBarsEl = BC.el('span', { className: 'bc-bars', 'aria-hidden': 'true' }, [
        BC.el('i'), BC.el('i'), BC.el('i'), BC.el('i')
      ]);
      pingMsEl = BC.el('span', { id: 'pingMs', text: '--' });
      pingNetEl = BC.el('span', { id: 'pingNet', text: 'solo' });
      pingChipEl = BC.el('div', {
        id: 'pingChip', role: 'status', 'aria-live': 'off', 'aria-label': 'Connection status'
      }, [pingBarsEl, pingMsEl, pingNetEl]);
      document.body.appendChild(pingChipEl);
    } else {
      pingChipEl = document.getElementById('pingChip');
      pingBarsEl = pingChipEl.querySelector('.bc-bars');
      pingMsEl = document.getElementById('pingMs');
      pingNetEl = document.getElementById('pingNet');
    }
    bcUpdateHud(true);
  }

  // Kept private under its old name, but now updates only the lobby's Match
  // card. 86 owns teamScore / matchChip / pingChip and all gameplay readouts.
  function bcUpdateHud(force) {
    var modeId = bcCurrentModeId();
    var name = bcModeName(modeId);
    var pair = bcScorePair();
    var team = pair.team;
    var teamLabel = team === 'red' ? 'Red' : team === 'blue' ? 'Blue'
      : bcModeTeams(modeId) ? 'Unassigned' : 'Free for all';
    var localKills = 0;
    try { if (typeof kills !== 'undefined') localKills = Math.max(0, Number(kills) || 0); } catch (err) { /* combat loads later */ }
    var key = modeId + '|' + pair.red + '|' + pair.blue + '|' + String(team) + '|' + name + '|' + localKills;
    if (!force && key === lastHudKey) return;
    lastHudKey = key;

    var total = pair.red + pair.blue;
    var redShare = total > 0 ? Math.round((pair.red / total) * 100) : 50;
    if (redShare < 4) redShare = 4;
    if (redShare > 96) redShare = 96;

    if (matchModeEl) matchModeEl.textContent = name;
    if (matchRuleEl) matchRuleEl.textContent = bcFindMode(modeId).desc || '';
    if (matchTeamEl) {
      matchTeamEl.textContent = teamLabel;
      matchTeamEl.className = team === 'red' ? 'team-red' : team === 'blue' ? 'team-blue' : '';
    }
    if (matchScoreEl) matchScoreEl.textContent = bcModeTeams(modeId) ? pair.red + ' \u2013 ' + pair.blue : localKills + ' kills';
    if (lobbyScoreRedEl) lobbyScoreRedEl.style.width = redShare + '%';
    if (lobbyScoreBlueEl) lobbyScoreBlueEl.style.width = (100 - redShare) + '%';

    if (state.theme === 'auto') bcApplyTheme();
    bcSyncSeedButton();
  }

  /* ---------------- hooks and lifecycle ---------------- */
  function bcOnWorldReady() {
    if (readyHandled) {
      bcApplyAudio();
      bcUpdateHud(true);
      return;
    }
    readyHandled = true;
    // The real mode table only exists once its module is live; rebuild one time.
    bcBuildModeCards();
    var active = bcActiveModeId();
    if (active) {
      if (state.mode !== active) api.set('mode', active);
      else bcSyncModeCards();
    }
    var live = bcLiveSeed();
    if (live !== state.seed) api.set('seed', live);
    else bcSyncSeedLabel();
    bcApplyAll();
    bcStatus('World ready \u00b7 ' + bcModeName(bcCurrentModeId()));
  }

  function bcOnWorldReset(seed) {
    var next = bcUint32(seed, null);
    if (next == null) next = bcLiveSeed();
    api.set('seed', next);
    bcSyncSeedLabel();
    // A local regeneration promise owns seedPending until it completes. A
    // worldReset emitted mid-commit must not unlock a second configuration.
    bcSyncSeedButton();
  }

  function bcOnModeChanged(id, def) {
    var next = bcActiveModeId() || bcMode(id);
    if (state.mode !== next) api.set('mode', next);
    else { bcSyncModeCards(); bcUpdateHud(true); }
    var label = def && def.name ? def.name : bcModeName(next);
    if (!seedPending) bcStatus('Mode \u00b7 ' + label);
    bcApplyTheme();
  }

  function bcBindHooks() {
    if (typeof BC.on !== 'function') return;
    BC.on('worldReady', bcOnWorldReady, 10);
    BC.on('worldReset', bcOnWorldReset, 10);
    BC.on('modeChanged', bcOnModeChanged, 10);
    BC.on('netStatus', function () { bcSyncSeedButton(); bcUpdateHud(true); }, 10);
    BC.on('worldBusyChanged', bcSyncSeedButton, 10);
  }

  var settingsTimer = 0;
  function bcStartSettingsTimer() {
    if (settingsTimer) return;
    settingsTimer = window.setInterval(function () {
      bcSyncSeedButton();
      var menu = document.getElementById('hint');
      if (menu && !menu.classList.contains('hidden')) bcUpdateHud(false);
    }, 500);
  }

  function bcInit() {
    try { bcBuildLobby(); } catch (err) { console.error('[BC] lobby build failed', err); }
    try { bcBuildHud(); } catch (err) { console.error('[BC] HUD chrome failed', err); }
    try { bcApplyAll(); } catch (err) { console.error('[BC] settings apply failed', err); }
    bcBindHooks();
    bcStartSettingsTimer();
    // Audio registers later than this file in the loader; catch it once the
    // world is up even if worldReady fired before the audio module existed.
    window.setTimeout(bcApplyAudio, 1000);
  }

  bcInit();
})();
