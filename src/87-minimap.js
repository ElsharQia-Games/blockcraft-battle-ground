/* Blockcraft Battle Ground — Cached, north-up topographical minimap.
   Classic script / file:// safe. Load after 86-hud.js and before 90-net.js;
   later scripts and all gameplay globals are deliberately late-bound.
   Design: existing red/blue HUD extension (variance 3 / motion 2 / density 8 /
   assets 2 / fidelity 10). No pointer capture, bindings, tweens or Three passes.
   Full terrain sampling happens only on ready/reset/mode hooks or an explicit
   refreshTerrain(). Ground elevation (not roofs/canopy), 2m minor / 5m major
   marching-squares contours, and water are cached at 512px from a 128x128 grid.
    Live edits patch at most eight cached tiles per map tick. Missing voxel
    storage fails closed: procedural height guesses never become contours.
   HUD contract: #minimap, --bc-map-size; upper-left 16px / 72px, 156px square
   desktop or 112px square at <=560px. 86-hud.js owns the other HUD positions. */
'use strict';

(function () {
  var miniBC = window.BC;
  if (!miniBC || !miniBC.api || typeof miniBC.on !== 'function' ||
      typeof document === 'undefined' || miniBC.api.minimap) return;

  var MINI_GRID = 128, MINI_RANGE = 60, MINI_CONTACT_RANGE = 35;
  var MINI_ATLAS = 512, MINI_MINOR = 2, MINI_MAJOR = 5;
  var MINI_DRAW_MS = 100, MINI_LOS_MS = 250, MINI_SIGHT_MS = 300;
  var MINI_SHOT_MS = 1500, MINI_LOS_BUDGET = 6, MINI_RAY_STEPS = 96;
  var MINI_MAX_PEERS = 128, MINI_EDIT_BUDGET = 8, MINI_GAP = 8;
  var MINI_WHITE = '#f5fbff', MINI_RED = '#ff3556', MINI_BLUE = '#3585ff';
  var MINI_TAU = Math.PI * 2;
  var miniEnabled = true, miniReady = false, miniShown = false;
  var miniReason = 'boot', miniPending = '', miniRefreshQueued = false;
  var miniLastTick = -Infinity, miniLastDraw = -Infinity, miniLastLOS = -Infinity, miniLastClock = -Infinity;
  var miniLayoutAt = -Infinity, miniLayoutDirty = true, miniLOSIndex = 0;
  var miniRoot = null, miniCanvas = null, miniCtx = null, miniNodes = null;
  var miniTerrain = null, miniTerrainCtx = null, miniBase = null, miniBaseCtx = null, miniPixels = null;
  var miniCacheValid = false, miniAwaitWorldReset = false, miniRevision = 0, miniDrawRevision = 0, miniSeed = null;
  var miniWorld = 0, miniHeight = 0, miniBlocks = null, miniGetBlock = null;
  var miniAir = 0, miniWater = -1, miniGlass = -1, miniSea = 0;
  var miniSource = 'unavailable', miniSampleCount = 0, miniTerrainCount = 0;
  var miniKinds = new Uint8Array(256);
  var miniTiles = new Uint8Array(MINI_GRID * MINI_GRID);
  var miniElevations = new Float32Array(MINI_GRID * MINI_GRID), miniWet = new Uint8Array(MINI_GRID * MINI_GRID);
  var miniMinElevation = 0, miniMaxElevation = 0, miniContourCount = 0;
  var miniDirtyFlags = new Uint8Array(MINI_GRID * MINI_GRID), miniDirty = [];
  var miniDirtyAt = 0, miniVillages = [], miniPeers = [], miniPeerMap = new Map();
  var miniPeerSerial = 0, miniPeerNow = 0, miniNet = null, miniModes = null, miniNetKey = '';
  var miniTeam = null, miniOnline = false, miniAllies = 0, miniContacts = 0;
  var miniDragonCount = 0, miniSaddles = 0, miniGuardians = 0, miniVillageCount = 0;
  var miniSeedGuardians = 0, miniSeedMounts = 0;
  var miniX = 0, miniY = 0, miniZ = 0, miniYaw = 0, miniEyeY = 0;
  var miniPositionValid = false, miniArena = null, miniRemaining = null;
  var miniSize = 146, miniRadius = 61, miniScale = miniRadius / MINI_RANGE;
  var miniDPR = 1, miniDock = { layout: 'desktop', left: 16, top: 72, bottom: null, width: 156, height: 156 };
  var miniObstacles = [], miniShotPool = [], miniLastAnonymous = -Infinity;
  var miniLastBuild = null, miniLastSummary = '', miniSummaryAt = -Infinity;
  var miniColumnType = 0, miniColumnHeight = -1, miniColumnFound = false;
  var miniColumnGround = NaN, miniColumnWet = false, miniContourX = 0, miniContourY = 0;
  var miniContourLabels = [], miniContourBatchCount = 0;
  var miniLabelX = new Float32Array(3), miniLabelY = new Float32Array(3);
  var miniBearings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var miniObstacleIds = ['healthWrap', 'weaponHud', 'hotbar', 'buildHud', 'jetFuel',
    'stats', 'teamScore', 'matchChip', 'pingChip', 'killfeed', 'roomBadge', 'toast'];
  for (var miniPoolIndex = 0; miniPoolIndex < 16; miniPoolIndex++) {
    miniShotPool.push({ x: 0, y: 0, z: 0, until: 0, at: -Infinity });
  }

  function miniNow() {
    return typeof miniBC.now === 'function' ? miniBC.now()
      : window.performance && typeof window.performance.now === 'function' ? window.performance.now() : Date.now();
  }
  function miniFinitePos(p) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
  }
  function miniPlayer() {
    try { return typeof player !== 'undefined' && player && miniFinitePos(player.pos) ? player : null; }
    catch (err) { return null; }
  }
  function miniWorldBusy() {
    var world = miniBC.api.world;
    return !!((miniBC.flags && miniBC.flags.worldBusy) || (world && world.busy));
  }
  function miniPlayReason(playing) {
    if (!miniEnabled) return 'off';
    if (!miniReady) return 'boot';
    if (document.hidden) return 'background';
    if (miniAwaitWorldReset) return 'world-reset';
    if (miniWorldBusy()) return 'world-busy';
    var killcam = miniBC.api.killcam;
    if ((killcam && killcam.active) || (miniBC.flags && miniBC.flags.killcamActive)) return 'killcam';
    try {
      if (typeof loading !== 'undefined' && loading) return 'boot';
      if (typeof alive !== 'undefined' && !alive) return 'death';
      if (typeof craftOpen !== 'undefined' && craftOpen) return 'inventory';
    } catch (err) { return 'boot'; }
    var menu = document.getElementById('hint'), board = document.getElementById('scoreboard');
    if (menu && !menu.hidden && !menu.classList.contains('hidden')) return 'menu';
    if (board && board.classList.contains('show')) return 'scoreboard';
    if (!miniPlayer()) return 'no-position';
    if (playing === false) return 'paused';
    if (playing === true) return '';
    if (miniBC.flags && miniBC.flags.playing === true) return '';
    try {
      if (typeof renderer !== 'undefined' && renderer && document.pointerLockElement === renderer.domElement) return '';
    } catch (err) { /* reduced builds have no renderer */ }
    return 'paused';
  }

  /* Every injected selector is scoped to the map. HUDs owned by other modules
     are measured, never restyled or moved. Sizes are CSS pixels, not world units. */
  function miniEnsureDOM() {
    if (miniRoot) return true;
    if (!document.body || typeof miniBC.el !== 'function' || typeof miniBC.style !== 'function') return false;
    miniBC.style('bc-minimap-v2', `
      #minimap {
        --bc-mini-panel-size: var(--bc-map-size, 156px);
        position: fixed; left: var(--bc-mini-fit-left, var(--bc-map-left, 16px)); top: var(--bc-mini-fit-top, var(--bc-map-top, 72px)); bottom: auto; z-index: 5;
        width: var(--bc-mini-fit-size, var(--bc-mini-panel-size)); height: var(--bc-mini-fit-size, var(--bc-mini-panel-size)); padding: 4px;
        color: #f5fbff; background: var(--bc-glass-deep, rgba(10, 14, 19, .88));
        border: 1px solid var(--bc-line, rgba(214, 232, 245, .16)); border-radius: 8px;
        font: 500 9px/12px ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-variant-numeric: tabular-nums; letter-spacing: .02em;
        pointer-events: none; user-select: none; box-shadow: none; transition: none; animation: none;
      }
      #minimap, #minimap * { box-sizing: border-box; pointer-events: none; }
      #minimap[hidden] { display: none !important; }
      #minimap .bc-mini-head { position: absolute; left: 4px; right: 4px; top: 4px; z-index: 1; }
      #minimap .bc-mini-head, #minimap .bc-mini-line, #minimap .bc-mini-meta {
        display: flex; align-items: center; justify-content: space-between; gap: 4px; min-width: 0; height: 12px;
      }
      #minimapTitle { font-size: 9px; font-weight: 700; letter-spacing: .12em; }
      #minimapTitle, #minimapRange { background: #11191f; padding: 0 2px; }
      #minimapRange, #minimapHeading, #minimapEdge, #minimapSeed, #minimapContacts { white-space: nowrap; }
      #minimap .bc-mini-surface { position: absolute; inset: 4px; }
      #minimapCanvas { display: block; width: 100%; height: 100%; }
      #minimapNorth {
        position: absolute; top: 4px; left: 50%; transform: translateX(-50%);
        padding: 0 2px; background: #11191f; color: #f5fbff; font-size: 9px; font-weight: 700; line-height: 10px;
      }
      #minimap .bc-mini-data { position: absolute; left: 4px; right: 4px; bottom: 4px; height: 12px; min-width: 0; }
      #minimap .bc-mini-line > span { padding: 0 2px; background: #11191f; }
      #minimap .bc-mini-meta { position: absolute; left: 0; bottom: 24px; width: auto; height: 12px; white-space: nowrap; }
      #minimapSeed { font: inherit; font-size: 8px; color: inherit; padding: 0 2px; background: #11191f; }
      #minimapContacts { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); color: #f5fbff; }
      #minimapLegend { position: absolute; left: 0; right: 0; bottom: 12px; height: 12px; display: flex; justify-content: center; gap: 6px; white-space: nowrap; }
      #minimapLegend > span { display: flex; align-items: center; gap: 4px; white-space: nowrap; font-size: 8px; letter-spacing: 0; }
      #minimapLegend > .bc-mini-legend-other, #minimapContours { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      #minimapLegend > .bc-mini-legend-key { padding: 0 3px; background: #11191f; }
      #minimapLegend i { flex: none; display: inline-block; width: 6px; height: 6px; font-style: normal; }
      #minimapLegend .bc-mini-you { width: 0; height: 0; border-left: 3px solid transparent; border-right: 3px solid transparent; border-bottom: 6px solid #f5fbff; }
      #minimapLegend .bc-mini-ally { border-radius: 50%; background: var(--bc-red, #ff3556); box-shadow: 3px 0 0 var(--bc-blue, #3585ff); margin-right: 3px; }
      #minimapLegend .bc-mini-foe { position: relative; }
      #minimapLegend .bc-mini-foe::before, #minimapLegend .bc-mini-foe::after { content: ""; position: absolute; background: #f5fbff; }
      #minimapLegend .bc-mini-foe::before { top: 2px; left: 0; width: 6px; height: 2px; }
      #minimapLegend .bc-mini-foe::after { top: 0; left: 2px; width: 2px; height: 6px; }
      #minimapLegend .bc-mini-build { border: 1px solid #c8d4dc; }
      #minimapLegend .bc-mini-dragon, #minimapLegend .bc-mini-saddle { transform: rotate(45deg); border: 1px solid #d0dce5; }
      #minimapLegend .bc-mini-saddle { background: var(--bc-blue, #3585ff); border-color: #c8d4dc; }
      #minimap[data-edge="near"] #minimapEdge { color: var(--bc-red, #ff3556); }
      #minimap .bc-mini-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
      #minimap[data-layout="micro"] .bc-mini-line { font-size: 8px; }
      @media (max-width: 560px) { #minimap { --bc-mini-panel-size: min(var(--bc-map-size, 112px), 112px); } }
      @media (prefers-reduced-motion: reduce) { #minimap, #minimap * { transition: none !important; animation: none !important; } }
    `);
    var el = miniBC.el;
    miniNodes = {
      range: el('span', { id: 'minimapRange', text: '60 m', title: 'Map radius: 60 metres' }),
      heading: el('span', { id: 'minimapHeading', text: '--', 'aria-label': 'Heading unavailable' }),
      edge: el('span', { id: 'minimapEdge', text: '--' }),
      seed: el('code', { id: 'minimapSeed', text: 'S --' }),
      contacts: el('span', { id: 'minimapContacts', text: 'WAITING' }),
      summary: el('span', { id: 'minimapSummary', className: 'bc-mini-sr', text: 'Waiting for world terrain.' })
    };
    miniCanvas = el('canvas', { id: 'minimapCanvas', width: '146', height: '146', role: 'img',
      'aria-label': 'North-up topographical map centred on your player', 'aria-describedby': 'minimapSummary minimapGuide' },
    ['A topographical map is unavailable because this browser does not support canvas.']);
    var legend = el('div', { id: 'minimapLegend', 'aria-label': 'Map symbols' });
    var legendItems = [['you', 'YOU', 'White arrow: you'], ['ally', 'ALLY', 'Red or blue dots: teammates'],
      ['foe', 'FOE', 'Cross: visible opponent; hollow ring: recent nearby shot'],
      ['build', 'BLD', 'Square: village; lighter terrain: real built cover'],
      ['dragon', 'GUARD --', 'Large hollow diamond: indestructible guardian, never rideable'],
      ['saddle', 'RIDE --', 'Small filled blue diamond: rideable mount; one rider at a time']];
    for (var i = 0; i < legendItems.length; i++) {
      var key = legendItems[i][0] === 'dragon' || legendItems[i][0] === 'saddle';
      var label = el('b', { text: legendItems[i][1] });
      if (legendItems[i][0] === 'dragon') miniNodes.guardians = label;
      if (legendItems[i][0] === 'saddle') miniNodes.mounts = label;
      legend.appendChild(el('span', { title: legendItems[i][2], 'aria-label': legendItems[i][2],
        className: key ? 'bc-mini-legend-key' : 'bc-mini-legend-other' },
        [el('i', { className: 'bc-mini-' + legendItems[i][0], 'aria-hidden': 'true' }), label]));
    }
    legend.appendChild(el('span', { id: 'minimapContours', text: 'Fine contours: 2m; bold contours: 5m. Parchment-to-slate land indicates increasing ground elevation; muted blue is water.' }));
    miniRoot = el('section', { id: 'minimap', role: 'region', 'aria-labelledby': 'minimapTitle',
      'aria-describedby': 'minimapGuide minimapSummary', 'aria-live': 'off', 'aria-hidden': 'true', hidden: 'hidden',
      'data-layout': 'desktop', 'data-range': String(MINI_RANGE), 'data-contours': '2/5m', 'data-ready': 'false' }, [
      el('div', { className: 'bc-mini-head' }, [el('b', { id: 'minimapTitle', text: 'MAP' }), miniNodes.range]),
      el('div', { className: 'bc-mini-surface' }, [miniCanvas,
        el('span', { id: 'minimapNorth', text: 'N', title: 'North is world -Z', 'aria-label': 'North, world negative Z' })]),
      el('div', { className: 'bc-mini-data' }, [
        el('div', { className: 'bc-mini-line' }, [miniNodes.heading, miniNodes.edge]),
        el('div', { className: 'bc-mini-meta' }, [miniNodes.seed, miniNodes.contacts]), legend]),
      el('span', { id: 'minimapGuide', className: 'bc-mini-sr', text: 'North stays at the top (-Z). Radius 60 metres. Genuine voxel ground elevation with fine 2-metre and bold 5-metre contours; village roofs and tree canopy do not become mountains. Blue is water, subdued parchment/slate is land. White arrow: you. Red or blue dots: allies. Squares: villages; slate cover: real builds. Large hollow diamonds: indestructible guardians, never rideable. Smaller filled blue diamonds: small saddle mounts, rideable by any player with one exclusive rider at a time. A white centre dot marks an occupied mount. GUARD and RIDE are total counts for the displayed world seed, not a radar count. Opponents require line of sight within 35 metres. Crosses are short-lived last sightings, not hidden live tracking. Hollow rings mark approximate shot locations for 1.5 seconds. EDGE is remaining space to the playable arena or world boundary.' }),
      miniNodes.summary
    ]);
    document.body.appendChild(miniRoot);
    try { miniCtx = miniCanvas.getContext('2d'); } catch (err) { miniCtx = null; }
    if (!miniCtx) miniNodes.contacts.textContent = 'NO CANVAS';
    miniLayoutDirty = true;
    return true;
  }

  /* ---------------- terrain cache: 128 x 128, current voxels ---------------- */
  function miniReadSeed() {
    var world = miniBC.api.world, value = null;
    try {
      if (world && typeof world.seed === 'function') value = world.seed();
      if (!Number.isFinite(value) && typeof SEED !== 'undefined') value = SEED;
    }
    catch (err) { /* not booted */ }
    return Number.isFinite(value) ? value >>> 0 : null;
  }
  function miniSeedDragonCounts() {
    var rules = window.BCDragonRules;
    miniSeedGuardians = miniSeedMounts = 0;
    if (miniSeed !== null && rules && typeof rules.count === 'function' && Number.isInteger(rules.guardianCount)) {
      miniSeedGuardians = rules.guardianCount;
      miniSeedMounts = rules.count(miniSeed) - miniSeedGuardians;
    }
    if (miniRoot) {
      miniRoot.dataset.guardians = String(miniSeedGuardians);
      miniRoot.dataset.mounts = String(miniSeedMounts);
      miniRoot.dataset.dragonCount = String(miniSeedGuardians + miniSeedMounts);
    }
  }
  function miniReadSources() {
    try {
      miniWorld = typeof WORLD === 'number' && Number.isInteger(WORLD) && WORLD > 0 ? WORLD : 0;
      miniHeight = typeof HEIGHT === 'number' && Number.isInteger(HEIGHT) && HEIGHT > 0 ? HEIGHT : 0;
      miniBlocks = typeof blocks !== 'undefined' && blocks && blocks.length >= miniWorld * miniWorld * miniHeight ? blocks : null;
      miniGetBlock = typeof getBlock === 'function' ? getBlock : null;
      miniAir = typeof AIR === 'number' ? AIR : 0;
      miniWater = typeof WATER === 'number' ? WATER : -1;
      miniGlass = typeof GLASS === 'number' ? GLASS : -1;
      miniSea = typeof SEA === 'number' && Number.isFinite(SEA) ? SEA : 0;
    } catch (err) { miniWorld = 0; miniBlocks = miniGetBlock = null; }
    return miniWorld > 0 && miniHeight > 0 && !!(miniBlocks || miniGetBlock);
  }
  function miniBuildPalette() {
    miniKinds.fill(0);
    var defs = null;
    try { if (typeof BLOCK_DEFS !== 'undefined') defs = BLOCK_DEFS; } catch (err) { /* optional */ }
    for (var type = 0; type < 256; type++) {
      var name = defs && defs[type] && String(defs[type].name).toLowerCase(), kind = 0;
      if (type === miniWater || name === 'water') kind = 3;
      else if (name === 'grass' || name === 'dirt') kind = 1;
      else if (name === 'leaves' || name === 'log' || name === 'cactus') kind = 2;
      else if (name === 'sand' || name === 'sandstone' || name === 'gravel') kind = 4;
      else if (name === 'snow') kind = 5;
      else if (name && /planks|bricks|cobblestone|glass|mudbrick|gold block|diamond block/.test(name)) kind = 6;
      miniKinds[type] = kind;
    }
  }
  function miniColumn(x, z) {
    miniColumnFound = false; miniColumnType = miniAir; miniColumnHeight = -1; miniColumnGround = NaN;
    miniColumnWet = false;
    if (miniBlocks || miniGetBlock) {
      var plane = miniWorld * miniWorld, index = (miniHeight - 1) * plane + z * miniWorld + x, covered = false;
      for (var y = miniHeight - 1; y >= 0; y--, index -= plane) {
        var b = miniBlocks ? miniBlocks[index] : miniGetBlock(x, y, z);
        if (b !== miniAir && Number.isFinite(b)) {
          b &= 255;
          if (!miniColumnFound) { miniColumnType = b; miniColumnHeight = y; miniColumnFound = true; }
          // Separate substrate from recognisable roofs/canopy. Water remains
          // water under leaves, but a real bridge/roof is still built cover.
          var kind = miniKinds[b];
          if (kind === 2) continue;
          if (b === miniWater || kind === 3) { if (!covered) miniColumnWet = true; continue; }
          if (b === miniGlass || kind === 6) { covered = true; continue; }
          miniColumnGround = y + 1; return; // voxel top is its actual metre elevation
        }
      }
    }
  }
  function miniSampleTile(tile) {
    var gx = tile % MINI_GRID, gz = Math.floor(tile / MINI_GRID), unit = miniWorld / MINI_GRID;
    var x0 = Math.floor(gx * unit), z0 = Math.floor(gz * unit);
    var x1 = Math.min(miniWorld - 1, Math.max(x0, Math.ceil((gx + 1) * unit) - 1));
    var z1 = Math.min(miniWorld - 1, Math.max(z0, Math.ceil((gz + 1) * unit) - 1));
    var type = miniAir, height = -1, rank = -1, elevation = 0, groundColumns = 0, wetColumns = 0;
    // Four real columns per 2m tile preserve single-voxel walls and canopy edges.
    // This is still one cached 128x128 map, never a per-frame world traversal.
    for (var c = 0; c < 4; c++) {
      if ((c & 1) && x0 === x1 || c > 1 && z0 === z1) continue;
      miniColumn(c & 1 ? x1 : x0, c > 1 ? z1 : z0);
      if (!miniColumnFound) continue;
      if (miniColumnWet) wetColumns++;
      if (Number.isFinite(miniColumnGround)) { elevation += miniColumnGround; groundColumns++; }
      var kind = miniKinds[miniColumnType];
      var priority = kind === 6 ? 4 : kind === 2 ? 3 : kind === 3 ? 2 : 1;
      if (priority > rank || priority === rank && miniColumnHeight > height) {
        rank = priority; type = miniColumnType; height = miniColumnHeight;
      }
    }
    miniTiles[tile] = rank < 0 ? 255 : miniKinds[type];
    miniElevations[tile] = groundColumns ? elevation / groundColumns : NaN;
    miniWet[tile] = wetColumns ? 1 : 0; // preserve real narrow streams in a 2m tile
    return rank >= 0;
  }
  function miniColorTile(tile) {
    var kind = miniTiles[tile], h = miniElevations[tile];
    var elevation = Number.isFinite(h) ? Math.max(0, Math.min(1, (h - miniSea) / 32)) : 0;
    var r = 170 - elevation * 65, g = 163 - elevation * 39, b = 141 - elevation * 6;
    if (miniWet[tile]) { r = 39; g = 70; b = 93; }
    else if (kind === 6) { r *= .68; g *= .74; b *= .82; }
    else if (kind === 2) { r *= .92; g *= .92; b *= .92; }
    if (kind === 255) { r = 19; g = 27; b = 33; }
    var p = tile * 4, data = miniPixels.data;
    data[p] = r; data[p + 1] = g; data[p + 2] = b;
    data[p + 3] = 255;
  }

  /* Marching squares interpolates the measured ground grid. Each contour is
     an actual elevation crossing; no decorative noise or invented isolines.
     The two saddle cases use the cell mean to choose a consistent connection. */
  function miniContourEdge(edge, gx, gz, level, a, b, c, d) {
    var x = gx + .5, y = gz + .5, f;
    if (edge === 0) { f = (level - a) / (b - a); x += f; }
    else if (edge === 1) { x++; f = (level - b) / (c - b); y += f; }
    else if (edge === 2) { y++; f = (level - d) / (c - d); x += f; }
    else { f = (level - a) / (d - a); y += f; }
    miniContourX = x * MINI_ATLAS / MINI_GRID; miniContourY = y * MINI_ATLAS / MINI_GRID;
  }
  function miniContourPair(e0, e1, gx, gz, level, a, b, c, d, labels) {
    miniContourEdge(e0, gx, gz, level, a, b, c, d);
    var x = miniContourX, y = miniContourY;
    miniContourEdge(e1, gx, gz, level, a, b, c, d);
    miniTerrainCtx.moveTo(x, y); miniTerrainCtx.lineTo(miniContourX, miniContourY); miniContourBatchCount++;
    if (!labels || miniContourLabels.length >= 24 || miniContourBatchCount % 96 !== 0) return;
    var mx = (x + miniContourX) / 2, my = (y + miniContourY) / 2;
    if (mx < 16 || my < 16 || mx > MINI_ATLAS - 16 || my > MINI_ATLAS - 16) return;
    for (var i = 0; i < miniContourLabels.length; i++) {
      var label = miniContourLabels[i], dx = label.x - mx, dy = label.y - my;
      if (dx * dx + dy * dy < 2304) return;
    }
    miniContourLabels.push({ x: mx, y: my, height: level, text: String(level), gx: gx, gz: gz, valid: true });
  }
  function miniContourCell(gx, gz, level, a, b, c, d, labels) {
    var mask = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
    if (mask === 0 || mask === 15) return;
    var p = miniContourPair;
    if (mask === 1 || mask === 14) p(3, 0, gx, gz, level, a, b, c, d, labels);
    else if (mask === 2 || mask === 13) p(0, 1, gx, gz, level, a, b, c, d, labels);
    else if (mask === 3 || mask === 12) p(3, 1, gx, gz, level, a, b, c, d, labels);
    else if (mask === 4 || mask === 11) p(1, 2, gx, gz, level, a, b, c, d, labels);
    else if (mask === 6 || mask === 9) p(0, 2, gx, gz, level, a, b, c, d, labels);
    else if (mask === 7 || mask === 8) p(3, 2, gx, gz, level, a, b, c, d, labels);
    else {
      var joined = (a + b + c + d) / 4 > level;
      if (mask === 5 ? joined : !joined) {
        p(0, 1, gx, gz, level, a, b, c, d, labels); p(2, 3, gx, gz, level, a, b, c, d, labels);
      } else {
        p(0, 3, gx, gz, level, a, b, c, d, labels); p(1, 2, gx, gz, level, a, b, c, d, labels);
      }
    }
  }
  function miniPaintContours(x0, z0, x1, z1, labels) {
    var ctx = miniTerrainCtx;
    miniContourBatchCount = 0;
    for (var pass = 0; pass < 3; pass++) {
      ctx.beginPath(); ctx.lineWidth = pass === 1 ? 2.2 : pass === 2 ? 1.8 : 1.05;
      ctx.strokeStyle = pass === 1 ? 'rgba(43,55,61,.78)' : pass === 2 ? '#486374' : 'rgba(56,66,69,.42)';
      for (var z = Math.max(0, z0); z <= Math.min(MINI_GRID - 2, z1); z++) {
        for (var x = Math.max(0, x0); x <= Math.min(MINI_GRID - 2, x1); x++) {
          var i = z * MINI_GRID + x, j = i + MINI_GRID;
          if (miniTiles[i] === 255 || miniTiles[i + 1] === 255 || miniTiles[j] === 255 || miniTiles[j + 1] === 255) continue;
          if (pass === 2) {
            miniContourCell(x, z, .5, miniWet[i], miniWet[i + 1], miniWet[j + 1], miniWet[j], false); continue;
          }
          var a = miniElevations[i], b = miniElevations[i + 1], c = miniElevations[j + 1], d = miniElevations[j];
          if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c) || !Number.isFinite(d)) continue;
          var wetCount = miniWet[i] + miniWet[i + 1] + miniWet[j + 1] + miniWet[j];
          if (wetCount) continue; // never draw an elevation isoline across water
          var lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d), step = pass === 1 ? MINI_MAJOR : MINI_MINOR;
          for (var level = Math.ceil(lo / step) * step; level < hi; level += step) {
            if (pass === 0 && level % MINI_MAJOR === 0) continue;
            miniContourCell(x, z, level, a, b, c, d, labels && pass === 1);
          }
        }
      }
      ctx.stroke();
    }
  }
  function miniPaintCache(x0, z0, x1, z1, labels) {
    var ctx = miniTerrainCtx, scale = MINI_ATLAS / MINI_GRID;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 * scale, z0 * scale, (x1 - x0 + 1) * scale, (z1 - z0 + 1) * scale); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.drawImage(miniBase, 0, 0, MINI_ATLAS, MINI_ATLAS);
    miniPaintContours(x0 - 1, z0 - 1, x1, z1, labels);
    if (labels) miniContourCount = miniContourBatchCount;
    ctx.restore();
  }

  function miniRefreshTerrain(fromHook) {
    if (!miniReady || !miniEnsureDOM() || !miniCtx) return false;
    if (miniAwaitWorldReset || !fromHook && miniWorldBusy()) return false;
    if (!miniReadSources()) {
      miniCacheValid = false; miniSource = 'unavailable';
      miniRoot.dataset.ready = 'false'; miniRoot.dataset.source = miniSource;
      miniSetShown(false, 'no-terrain'); return false;
    }
    if (!miniTerrainCtx || !miniBaseCtx) {
      miniTerrain = document.createElement('canvas'); miniTerrain.width = miniTerrain.height = MINI_ATLAS;
      miniBase = document.createElement('canvas'); miniBase.width = miniBase.height = MINI_GRID;
      try { miniTerrainCtx = miniTerrain.getContext('2d'); } catch (err) { miniTerrainCtx = null; }
      try { miniBaseCtx = miniBase.getContext('2d'); } catch (err) { miniBaseCtx = null; }
      if (!miniTerrainCtx || !miniBaseCtx) return false;
      miniPixels = miniBaseCtx.createImageData(MINI_GRID, MINI_GRID);
    }
    miniBuildPalette();
    miniSource = 'voxels';
    miniTerrainCount = 0; miniMinElevation = Infinity; miniMaxElevation = -Infinity;
    for (var i = 0; i < MINI_GRID * MINI_GRID; i++) {
      if (miniSampleTile(i)) miniTerrainCount++;
      var elevation = miniElevations[i];
      if (Number.isFinite(elevation)) { miniMinElevation = Math.min(miniMinElevation, elevation); miniMaxElevation = Math.max(miniMaxElevation, elevation); }
      miniColorTile(i);
    }
    if (!Number.isFinite(miniMinElevation)) miniMinElevation = miniMaxElevation = null;
    miniBaseCtx.putImageData(miniPixels, 0, 0); miniContourLabels.length = 0;
    miniPaintCache(0, 0, MINI_GRID - 1, MINI_GRID - 1, true);
    miniVillages.length = 0;
    try {
      if (typeof villageSites !== 'undefined' && villageSites) {
        for (var v = 0; v < villageSites.length; v++) {
          var site = villageSites[v];
          if (site && Number.isFinite(site.x) && Number.isFinite(site.z) &&
              site.x >= 0 && site.z >= 0 && site.x < miniWorld && site.z < miniWorld) {
            miniVillages.push({ x: site.x + .5, z: site.z + .5, label: 'V' + (v + 1) });
          }
        }
      }
      // Fighting structures from 21-structures.js: T tower, C compound, R ruins, X trenches.
      if (typeof battleSites !== 'undefined' && battleSites) {
        var siteCodes = { watchtower: 'T', compound: 'C', ruins: 'R', trenches: 'X' };
        for (var s = 0; s < battleSites.length; s++) {
          var b = battleSites[s];
          if (b && Number.isFinite(b.x) && Number.isFinite(b.z) && b.x >= 0 && b.z >= 0 && b.x < miniWorld && b.z < miniWorld) {
            miniVillages.push({ x: b.x + .5, z: b.z + .5, label: siteCodes[b.kind] || 'F' });
          }
        }
      }
    } catch (err) { /* village layer stays empty, not synthetic */ }
    miniSeed = miniReadSeed(); miniSeedDragonCounts(); miniRevision++; miniSampleCount = MINI_GRID * MINI_GRID;
    miniCacheValid = miniTerrainCount > 0; miniPending = ''; miniLastTick = -Infinity;
    miniDirty.length = 0; miniDirtyAt = 0; miniDirtyFlags.fill(0); miniLastBuild = null;
    miniRoot.dataset.seed = miniSeed === null ? '' : String(miniSeed);
    miniRoot.dataset.source = miniSource;
    miniRoot.dataset.ready = miniCacheValid ? 'true' : 'false'; miniRoot.dataset.terrainRevision = String(miniRevision);
    miniNodes.seed.textContent = 'S ' + (miniSeed === null ? '--' : miniSeed);
    miniNodes.seed.title = miniSeed === null ? 'World seed unavailable' :
      'World seed ' + miniSeed + ': ' + miniSeedGuardians + ' guardians, ' + miniSeedMounts + ' rideable small mounts';
    if (!miniCacheValid) miniSetShown(false, 'no-terrain');
    return miniCacheValid;
  }
  function miniFlushRefresh() {
    miniRefreshQueued = false;
    if (!miniPending || !miniReady || miniAwaitWorldReset) return;
    // Coalesce mode/ready/reset in a microtask after synchronous arena edits.
    // Only a completed ready/reset hook may sample while world.busy is true.
    if (miniWorldBusy() && miniPending !== 'worldReset' && miniPending !== 'worldReady') return;
    miniRefreshTerrain(miniPending !== 'manual');
  }
  function miniQueueRefresh(reason) {
    miniPending = reason; miniCacheValid = false; miniLayoutDirty = true;
    if (miniRoot) miniRoot.dataset.ready = 'false';
    if (!miniReady || miniRefreshQueued) return;
    miniRefreshQueued = true;
    Promise.resolve().then(miniFlushRefresh);
  }
  function miniDirtyVoxel(x, z) {
    if (!miniCacheValid || !Number.isFinite(x) || !Number.isFinite(z) ||
        x < 0 || z < 0 || x >= miniWorld || z >= miniWorld) return;
    var gx = Math.min(MINI_GRID - 1, Math.floor(x / miniWorld * MINI_GRID));
    var gz = Math.min(MINI_GRID - 1, Math.floor(z / miniWorld * MINI_GRID)), index = gz * MINI_GRID + gx;
    if (!miniDirtyFlags[index]) { miniDirtyFlags[index] = 1; miniDirty.push(index); }
  }
  function miniPatchEdits() {
    try {
      if (typeof quickBuild !== 'undefined' && quickBuild && quickBuild.lastResult !== miniLastBuild) {
        miniLastBuild = quickBuild.lastResult;
        var result = miniLastBuild;
        if (result && result.ok && result.placed > 0 && Array.isArray(result.changes)) {
          for (var c = 0; c < result.changes.length; c++) miniDirtyVoxel(result.changes[c].x, result.changes[c].z);
        }
      }
    } catch (err) { /* building module is optional */ }
    for (var count = 0; count < MINI_EDIT_BUDGET && miniDirtyAt < miniDirty.length; count++) {
      var index = miniDirty[miniDirtyAt++]; miniDirtyFlags[index] = 0;
      var existed = miniTiles[index] !== 255, exists = miniSampleTile(index);
      miniTerrainCount += (exists ? 1 : 0) - (existed ? 1 : 0);
      miniColorTile(index);
      var gx = index % MINI_GRID, gz = Math.floor(index / MINI_GRID);
      for (var l = 0; l < miniContourLabels.length; l++) {
        var label = miniContourLabels[l];
        if (Math.abs(label.gx - gx) <= 1 && Math.abs(label.gz - gz) <= 1) label.valid = false;
      }
      miniBaseCtx.putImageData(miniPixels, 0, 0, gx, gz, 1, 1);
      // Repaint only a 3x3 cached neighbourhood, including its contour seams.
      // This is event-driven incremental repair, never a full map scan/tween.
      miniPaintCache(Math.max(0, gx - 1), Math.max(0, gz - 1), Math.min(MINI_GRID - 1, gx + 1), Math.min(MINI_GRID - 1, gz + 1), false);
    }
    if (miniDirtyAt === miniDirty.length) { miniDirty.length = 0; miniDirtyAt = 0; }
  }

  /* ---------------- contacts: bounded 4Hz voxel LOS, frozen sightings ---------------- */
  function miniReadNet() {
    try { miniNet = typeof net !== 'undefined' && net ? net : null; }
    catch (err) { miniNet = null; }
    miniModes = miniBC.api.modes || null;
    miniOnline = !!(miniNet && miniNet.online);
    var teams = miniModes && miniModes.activeDef && miniModes.activeDef.teams;
    var team = teams ? miniModes.localTeam : null;
    if (teams && miniOnline && miniNet.id && typeof miniModes.teamFor === 'function') team = miniModes.teamFor(miniNet.id);
    miniTeam = team === 'red' || team === 'blue' ? team : null;
  }
  function miniPeerTeam(id) {
    if (!miniModes || !miniModes.activeDef || !miniModes.activeDef.teams || typeof miniModes.teamFor !== 'function') return null;
    var team = miniModes.teamFor(id);
    return team === 'red' || team === 'blue' ? team : null;
  }
  function miniLivePeer(r, now) {
    return !!r && miniFinitePos(r) && r.hp > 0 && !(r.deadUntil > now) &&
      (!Number.isFinite(r.lastRx) || now - r.lastRx < 3000) &&
      r.x >= 0 && r.z >= 0 && r.x < miniWorld && r.z < miniWorld;
  }
  function miniEntry(id, r) {
    var entry = miniPeerMap.get(id);
    if (!entry && miniPeerMap.size < MINI_MAX_PEERS) {
      entry = { id: id, r: r, team: null, serial: 0, x: 0, y: 0, z: 0,
        seenUntil: 0, shotX: 0, shotY: 0, shotZ: 0, shotUntil: 0, shotAt: -Infinity };
      miniPeerMap.set(id, entry);
    }
    if (entry) entry.r = r;
    return entry;
  }
  function miniCollectPeer(r, id) {
    if (miniPeers.length >= MINI_MAX_PEERS || miniNet && id === miniNet.id) return;
    var entry = miniEntry(id, r);
    if (!entry) return;
    entry.serial = miniPeerSerial; entry.team = miniPeerTeam(id);
    if (!miniLivePeer(r, miniPeerNow)) { entry.seenUntil = entry.shotUntil = 0; return; }
    miniPeers.push(entry);
  }
  function miniRemoveOldPeer(entry, id) {
    if (entry.serial !== miniPeerSerial) miniPeerMap.delete(id);
  }
  function miniCollectPeers(now) {
    miniReadNet(); miniPeers.length = 0; miniPeerSerial++; miniPeerNow = now;
    if (miniOnline && miniNet.players && typeof miniNet.players.forEach === 'function') miniNet.players.forEach(miniCollectPeer);
    miniPeerMap.forEach(miniRemoveOldPeer);
  }
  function miniOpaque(x, y, z) {
    if (x < 0 || z < 0 || x >= miniWorld || z >= miniWorld || y < 0) return true;
    if (y >= miniHeight) return false;
    if (!miniBlocks && !miniGetBlock) return true; // missing cover data fails closed
    var b = miniBlocks ? miniBlocks[(y * miniWorld + z) * miniWorld + x] : miniGetBlock(x, y, z);
    return b !== miniAir && b !== miniWater && b !== miniGlass;
  }
  function miniLineClear(px, py, pz) {
    var dx = px - miniX, dy = py - miniEyeY, dz = pz - miniZ;
    var x = Math.floor(miniX), y = Math.floor(miniEyeY), z = Math.floor(miniZ);
    var sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    var ax = dx === 0 ? Infinity : Math.abs(1 / dx), ay = dy === 0 ? Infinity : Math.abs(1 / dy), az = dz === 0 ? Infinity : Math.abs(1 / dz);
    var tx = sx === 0 ? Infinity : (sx > 0 ? x + 1 - miniX : miniX - x) * ax;
    var ty = sy === 0 ? Infinity : (sy > 0 ? y + 1 - miniEyeY : miniEyeY - y) * ay;
    var tz = sz === 0 ? Infinity : (sz > 0 ? z + 1 - miniZ : miniZ - z) * az;
    for (var i = 0; i < MINI_RAY_STEPS; i++) {
      if (miniOpaque(x, y, z)) return false;
      var t = Math.min(tx, ty, tz);
      if (t >= 1 - 1e-8) return true;
      if (tx <= t + 1e-10) { x += sx; tx += ax; }
      if (ty <= t + 1e-10) { y += sy; ty += ay; }
      if (tz <= t + 1e-10) { z += sz; tz += az; }
    }
    return false;
  }
  function miniCheckLOS(now) {
    if (now - miniLastLOS < MINI_LOS_MS) return;
    miniLastLOS = now;
    var count = miniPeers.length, budget = MINI_LOS_BUDGET, visited = 0;
    if (!count) return;
    miniLOSIndex %= count;
    while (budget > 0 && visited < count) {
      var entry = miniPeers[miniLOSIndex], r = entry.r;
      miniLOSIndex = (miniLOSIndex + 1) % count; visited++;
      if (miniTeam && entry.team === miniTeam) continue;
      entry.seenUntil = 0;
      var head = r.crouch || r.slide ? 1.02 : 1.5;
      if (Number.isFinite(r.height)) head = Math.min(head, Math.max(.45, r.height - .15));
      var dx = r.x - miniX, dy = r.y + head - miniEyeY, dz = r.z - miniZ;
      if (dx * dx + dy * dy + dz * dz > MINI_CONTACT_RANGE * MINI_CONTACT_RANGE) continue;
      budget--;
      var clear = miniLineClear(r.x, r.y + head, r.z);
      if (!clear && budget > 0) { budget--; clear = miniLineClear(r.x, r.y + head * .6, r.z); }
      if (clear) {
        // Only receipt-time snapshots are drawable; no live enemy coordinates
        // between LOS checks, and no TTL renewal from a generic state packet.
        entry.x = r.x; entry.y = r.y; entry.z = r.z; entry.seenUntil = now + MINI_SIGHT_MS;
      }
    }
  }
  function miniClearContacts() {
    miniPeerMap.forEach(miniExpireContact);
    for (var i = 0; i < miniShotPool.length; i++) miniShotPool[i].until = 0;
    miniContacts = 0; miniLastLOS = -Infinity; miniLastAnonymous = -Infinity;
  }
  function miniExpireContact(entry) { entry.seenUntil = entry.shotUntil = 0; entry.shotAt = -Infinity; }
  function miniShotAllowed(p, now) {
    if (miniPlayReason() || !miniCacheValid || !miniFinitePos(p)) return false;
    var actor = miniPlayer(); if (!actor) return false;
    var self = actor.pos, dx = p.x - self.x, dy = p.y - (self.y + 1.3), dz = p.z - self.z;
    return p.x >= 0 && p.z >= 0 && p.x < miniWorld && p.z < miniWorld &&
      dx * dx + dy * dy + dz * dz <= MINI_CONTACT_RANGE * MINI_CONTACT_RANGE;
  }
  function miniRecordShot(entry, p, now) {
    if (!entry || !miniLivePeer(entry.r, now) || !miniShotAllowed(p, now)) return;
    entry.team = miniPeerTeam(entry.id);
    if (miniTeam && entry.team === miniTeam || now - entry.shotAt < 80) return;
    // A shot reveals its approximate origin, NOT the actor's continuing motion.
    entry.shotX = Math.max(.5, Math.min(miniWorld - .5, Math.round(p.x / 4) * 4)); entry.shotY = p.y;
    entry.shotZ = Math.max(.5, Math.min(miniWorld - .5, Math.round(p.z / 4) * 4));
    entry.shotAt = now; entry.shotUntil = now + MINI_SHOT_MS;
  }
  function miniOnPacket(msg) {
    if (!msg || typeof msg !== 'object' || !miniReady) return;
    if (msg.t === 'edit' && Number.isInteger(msg.x) && Number.isInteger(msg.z) &&
        Number.isInteger(msg.y) && msg.y >= 0 && msg.y < miniHeight &&
        Number.isInteger(msg.b) && msg.b >= 0 && msg.b <= 255) {
      miniDirtyVoxel(msg.x, msg.z); return;
    }
    if (msg.t === 'edits' && Array.isArray(msg.edits)) {
      for (var e = 0; e < Math.min(msg.edits.length, MINI_GRID * MINI_GRID); e++) {
        var edit = msg.edits[e];
        if (edit && Number.isInteger(edit.x) && Number.isInteger(edit.z)) miniDirtyVoxel(edit.x, edit.z);
      }
      return;
    }
    if (msg.t === 'leave' || msg.t === 'died' || msg.t === 'respawn') {
      var old = miniPeerMap.get(msg.id); if (old) miniExpireContact(old);
      if (msg.t === 'leave') miniPeerMap.delete(msg.id);
      return;
    }
    if (msg.t !== 'shot') return;
    miniReadNet();
    if (!miniOnline || !miniNet.players || typeof miniNet.players.get !== 'function' ||
        typeof msg.id !== 'string' || !/^[\w-]{1,40}$/.test(msg.id) || msg.id === miniNet.id ||
        msg.room && miniNet.room && msg.room !== miniNet.room) return;
    var r = miniNet.players.get(msg.id), now = miniNow(), p = miniFinitePos(msg.from) ? msg.from : msg;
    if (!miniLivePeer(r, now) || !miniFinitePos(p) || msg.build === true || msg.build === 1 ||
        msg.combat === false || msg.combat === 0 || r.build || !r.combat) return;
    try {
      if (typeof WEAPON_BY_ID !== 'undefined' && !Object.prototype.hasOwnProperty.call(WEAPON_BY_ID, msg.weapon)) return;
      if (miniModes && typeof miniModes.canUseWeapon === 'function' && !miniModes.canUseWeapon(msg.weapon)) return;
    } catch (err) { return; }
    // netPacket still precedes shot-specific validation. Independently reject
    // forged origins instead of turning an untrusted packet into a radar blip.
    var dx = p.x - r.x, dy = p.y - (r.y + 1.4), dz = p.z - r.z;
    if (dx * dx + dy * dy + dz * dz > 100) return;
    miniRecordShot(miniEntry(msg.id, r), p, now);
  }
  function miniOnSfx(info) {
    if (!info || info.kind !== 'shot' || !miniFinitePos(info.position) || !miniReady) return;
    miniReadNet();
    var p = info.position, now = miniNow();
    if (!miniShotAllowed(p, now) || info.local === true) return;
    var self = miniPlayer().pos, dx = p.x - self.x, dy = p.y - (self.y + 1.4), dz = p.z - self.z;
    if (dx * dx + dy * dy + dz * dz < 9) return; // unlabelled local muzzle events
    var id = info.byId || info.id, entry = id != null ? miniPeerMap.get(id) : null;
    var best = 25;
    if (!entry) {
      // The current remote sfx shape has no id; associate only a real, nearby
      // peer. An arbitrary positional effect is not evidence of an opponent.
      for (var i = 0; i < miniPeers.length; i++) {
        var candidate = miniPeers[i], r = candidate.r;
        dx = p.x - r.x; dy = p.y - (r.y + 1.4); dz = p.z - r.z;
        var dist = dx * dx + dy * dy + dz * dz;
        if (dist < best && miniLivePeer(r, now)) { best = dist; entry = candidate; }
      }
    }
    if (entry) { miniRecordShot(entry, p, now); return; }
    if (info.remote !== true || now - miniLastAnonymous < 100) return;
    miniLastAnonymous = now;
    var slot = miniShotPool[0];
    for (var s = 0; s < miniShotPool.length; s++) {
      var mark = miniShotPool[s];
      if (mark.until <= now) { slot = mark; break; }
      if (mark.at < slot.at) slot = mark;
    }
    slot.x = Math.max(.5, Math.min(miniWorld - .5, Math.round(p.x / 4) * 4)); slot.y = p.y;
    slot.z = Math.max(.5, Math.min(miniWorld - .5, Math.round(p.z / 4) * 4));
    slot.at = now; slot.until = now + MINI_SHOT_MS;
  }

  /* ---------------- docking: only measured on changes / a 1Hz safety check ---------------- */
  function miniElementRect(id) {
    var element = document.getElementById(id);
    if (!element || element.hidden || element.getAttribute('aria-hidden') === 'true') return null;
    var css = window.getComputedStyle(element);
    if (css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) < .02) return null;
    var rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  }
  function miniDockFits(left, top, size, viewportHeight) {
    var changed = true, passes = 0;
    while (changed && passes++ <= miniObstacles.length) {
      changed = false;
      var right = left + size, lower = top + size;
      for (var i = 0; i < miniObstacles.length; i++) {
        var r = miniObstacles[i];
        if (right + MINI_GAP <= r.left || left >= r.right + MINI_GAP || lower + MINI_GAP <= r.top || top >= r.bottom + MINI_GAP) continue;
        top = Math.max(top, r.bottom + MINI_GAP); changed = true; break;
      }
    }
    return top + size <= viewportHeight - MINI_GAP ? top : -1;
  }
  function miniLayout(now) {
    miniLayoutDirty = false; miniLayoutAt = now; miniObstacles.length = 0;
    var width = window.innerWidth, height = window.innerHeight;
    for (var o = 0; o < miniObstacleIds.length; o++) {
      var rect = miniElementRect(miniObstacleIds[o]); if (rect) miniObstacles.push(rect);
    }
    // Preserve an uncluttered aiming centre on narrow displays as well.
    miniObstacles.push({ left: width / 2 - 28, right: width / 2 + 28, top: height / 2 - 28, bottom: height / 2 + 28 });
    // Read 86-hud.js's CSS contract instead of overwriting --bc-map-size.
    // Only temporary collision/short-height fallbacks use private fit variables.
    miniRoot.style.removeProperty('--bc-mini-fit-size'); miniRoot.style.removeProperty('--bc-mini-fit-top');
    miniRoot.style.removeProperty('--bc-mini-fit-left');
    var css = window.getComputedStyle(miniRoot);
    var preferred = Math.max(84, Math.min(192, parseFloat(css.width) || (width <= 560 ? 112 : 156)));
    var requestedLeft = parseFloat(css.left), requestedTop = parseFloat(css.top);
    var left = Math.max(8, Math.min(Number.isFinite(requestedLeft) ? requestedLeft : 16, width - 92));
    var firstTop = Math.max(8, Number.isFinite(requestedTop) ? requestedTop : 72);
    for (var i = 0; i < 3; i++) {
      var panelSize = Math.min(i === 0 ? preferred : i === 1 ? 112 : 84, width - left - 8);
      if (panelSize < 84 || i > 0 && panelSize >= preferred) continue;
      var top = miniDockFits(left, firstTop, panelSize, height);
      if (top < 0) continue;
      miniDock.layout = panelSize <= 96 ? 'micro' : panelSize <= 112 ? 'small' : 'desktop';
      miniDock.left = left; miniDock.top = Math.ceil(top); miniDock.bottom = height - miniDock.top - panelSize;
      miniDock.width = miniDock.height = panelSize; miniRoot.dataset.layout = miniDock.layout;
      if (panelSize !== preferred) miniRoot.style.setProperty('--bc-mini-fit-size', panelSize + 'px');
      if (top !== firstTop) miniRoot.style.setProperty('--bc-mini-fit-top', miniDock.top + 'px');
      if (left !== requestedLeft) miniRoot.style.setProperty('--bc-mini-fit-left', left + 'px');
      var canvasSize = panelSize - 10;
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      if (miniSize !== canvasSize || miniDPR !== dpr || miniCanvas.width !== Math.round(canvasSize * dpr)) {
        // Header/footer occupy the corners, never a band over southern terrain.
        miniSize = canvasSize; miniDPR = dpr; miniRadius = miniSize / 2 - 12; miniScale = miniRadius / MINI_RANGE;
        miniCanvas.width = miniCanvas.height = Math.round(miniSize * miniDPR);
      }
      return true;
    }
    return false;
  }
  function miniSetShown(shown, reason) {
    miniReason = reason || '';
    if (miniRoot && miniRoot.dataset.hiddenReason !== miniReason) miniRoot.dataset.hiddenReason = miniReason;
    if (miniShown === shown) return;
    miniShown = shown;
    if (miniRoot) { miniRoot.hidden = !shown; miniRoot.setAttribute('aria-hidden', shown ? 'false' : 'true'); }
    if (!shown) miniClearContacts();
    // Resuming has already performed docking and drawing. Do not reset the
    // 10Hz clock here and accidentally redraw on the next animation frame.
  }

  /* ---------------- 2D draw: cached terrain + real moving overlays ---------------- */
  function miniInRange(x, z, range) {
    var dx = x - miniX, dz = z - miniZ;
    return dx * dx + dz * dz <= range * range;
  }
  function miniDrawElevationLabels() {
    var ctx = miniCtx, c = miniSize / 2, count = 0, limit = miniSize < 104 ? 1 : 3;
    ctx.font = '8px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#a6a18d'; ctx.fillStyle = '#28363e';
    for (var i = 0; i < miniContourLabels.length && count < limit; i++) {
      var label = miniContourLabels[i]; if (!label.valid) continue;
      var px = c + (label.x / MINI_ATLAS * miniWorld - miniX) * miniScale;
      var py = c + (label.y / MINI_ATLAS * miniWorld - miniZ) * miniScale;
      var dx = px - c, dy = py - c, distance = dx * dx + dy * dy;
      if (distance < 196 || distance > (miniRadius - 10) * (miniRadius - 10)) continue;
      var fits = true;
      for (var j = 0; j < count; j++) {
        dx = px - miniLabelX[j]; dy = py - miniLabelY[j];
        if (dx * dx + dy * dy < 676) { fits = false; break; }
      }
      if (!fits) continue;
      // Label only cached, genuine major crossings, at readable CSS-pixel size.
      // Editing the contributing cell expires its label until the next refresh.
      ctx.strokeText(label.text, px, py); ctx.fillText(label.text, px, py);
      miniLabelX[count] = px; miniLabelY[count++] = py;
    }
    ctx.font = '9px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  function miniDiamond(x, z, saddle, occupied) {
    var px = miniSize / 2 + (x - miniX) * miniScale, py = miniSize / 2 + (z - miniZ) * miniScale;
    var radius = saddle ? 3 : 4;
    miniCtx.beginPath(); miniCtx.moveTo(px, py - radius); miniCtx.lineTo(px + radius, py);
    miniCtx.lineTo(px, py + radius); miniCtx.lineTo(px - radius, py); miniCtx.closePath();
    miniCtx.strokeStyle = saddle ? '#e8f1f8' : '#d0dce5'; miniCtx.lineWidth = 1.2;
    if (saddle) { miniCtx.fillStyle = MINI_BLUE; miniCtx.fill(); }
    miniCtx.stroke();
    if (saddle && occupied) { miniCtx.fillStyle = MINI_WHITE; miniCtx.fillRect(px - 1, py - 1, 2, 2); }
  }
  function miniDrawContact(x, z, team, shot) {
    if (!miniInRange(x, z, shot ? MINI_CONTACT_RANGE + 3 : MINI_CONTACT_RANGE)) return false;
    var px = miniSize / 2 + (x - miniX) * miniScale, py = miniSize / 2 + (z - miniZ) * miniScale;
    miniCtx.strokeStyle = team === 'blue' ? MINI_BLUE : team === 'red' ? MINI_RED : MINI_WHITE;
    miniCtx.lineWidth = 1.4; miniCtx.beginPath();
    if (shot) miniCtx.arc(px, py, miniSize < 80 ? 3 : 4.5, 0, MINI_TAU);
    else { miniCtx.moveTo(px - 3, py); miniCtx.lineTo(px + 3, py); miniCtx.moveTo(px, py - 3); miniCtx.lineTo(px, py + 3); }
    miniCtx.stroke(); return true;
  }
  function miniDrawActors(now) {
    miniAllies = miniContacts = miniDragonCount = miniSaddles = miniGuardians = miniVillageCount = 0;
    for (var v = 0; v < miniVillages.length; v++) {
      var site = miniVillages[v]; if (!miniInRange(site.x, site.z, MINI_RANGE - 2)) continue;
      var vx = miniSize / 2 + (site.x - miniX) * miniScale, vy = miniSize / 2 + (site.z - miniZ) * miniScale;
      miniCtx.strokeStyle = '#c8d4dc'; miniCtx.lineWidth = 1; miniCtx.strokeRect(vx - 3, vy - 3, 6, 6);
      if (miniSize >= 104 && miniVillageCount < 2) { miniCtx.fillStyle = '#c8d4dc'; miniCtx.fillText(site.label, vx + 5, vy + 3); }
      miniVillageCount++;
    }
    var riding = miniBC.api.riding;
    var rules = window.BCDragonRules;
    try {
      if (typeof dragons !== 'undefined' && dragons) {
        for (var d = 0; d < dragons.length; d++) {
          var dragon = dragons[d], group = dragon && dragon.group, p = group && group.position;
          if (!p || group.visible === false || !miniFinitePos(p) || !miniInRange(p.x, p.z, MINI_RANGE - 2)) continue;
          var eligible = dragon.type !== 'guardian' && (rules && typeof rules.isRideable === 'function' && miniSeed !== null
            ? rules.isRideable(miniSeed, dragon.index) : dragon.type === 'mount' && dragon.rideable === true);
          var occupied = eligible && riding && typeof riding.occupied === 'function' && riding.occupied(dragon);
          miniCtx.globalAlpha = eligible ? .95 : .78; miniDiamond(p.x, p.z, eligible, occupied);
          miniDragonCount++; if (eligible) miniSaddles++; else miniGuardians++;
        }
      }
    } catch (err) { /* optional dragon/riding build */ }
    miniCtx.globalAlpha = 1;
    for (var i = 0; i < miniPeers.length; i++) {
      var entry = miniPeers[i], r = entry.r;
      if (miniTeam && entry.team === miniTeam) {
        if (!miniInRange(r.x, r.z, MINI_RANGE - 2)) continue;
        var px = miniSize / 2 + (r.x - miniX) * miniScale, py = miniSize / 2 + (r.z - miniZ) * miniScale;
        miniCtx.beginPath(); miniCtx.arc(px, py, 2.6, 0, MINI_TAU);
        miniCtx.fillStyle = entry.team === 'blue' ? MINI_BLUE : MINI_RED; miniCtx.fill();
        miniCtx.lineWidth = 1; miniCtx.strokeStyle = '#0a1016'; miniCtx.stroke(); miniAllies++;
      } else if (entry.seenUntil > now) {
        if (miniDrawContact(entry.x, entry.z, entry.team, false)) miniContacts++;
      } else if (entry.shotUntil > now && miniDrawContact(entry.shotX, entry.shotZ, entry.team, true)) miniContacts++;
    }
    for (var s = 0; s < miniShotPool.length; s++) {
      var shot = miniShotPool[s];
      if (shot.until > now && miniDrawContact(shot.x, shot.z, null, true)) miniContacts++;
    }
  }
  function miniDraw(now) {
    var c = miniSize / 2, ctx = miniCtx, span = MINI_RANGE / miniWorld * MINI_ATLAS;
    ctx.setTransform(miniDPR, 0, 0, miniDPR, 0, 0); ctx.clearRect(0, 0, miniSize, miniSize);
    ctx.font = '9px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'left';
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, miniRadius, 0, MINI_TAU); ctx.clip();
    ctx.fillStyle = '#131b21'; ctx.fillRect(0, 0, miniSize, miniSize); ctx.imageSmoothingEnabled = true;
    // Clip the source rectangle ourselves: negative drawImage source bounds
    // have inconsistent behaviour on older browsers near the world's edges.
    var sx = miniX / miniWorld * MINI_ATLAS - span, sy = miniZ / miniWorld * MINI_ATLAS - span;
    var x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(MINI_ATLAS, sx + span * 2), y1 = Math.min(MINI_ATLAS, sy + span * 2);
    var ratio = miniRadius / span;
    if (x1 > x0 && y1 > y0) ctx.drawImage(miniTerrain, x0, y0, x1 - x0, y1 - y0,
      c - miniRadius + (x0 - sx) * ratio, c - miniRadius + (y0 - sy) * ratio, (x1 - x0) * ratio, (y1 - y0) * ratio);
    miniDrawElevationLabels();
    miniArena = miniModes && miniModes.arena && miniModes.arena.active ? miniModes.arena : null;
    miniRemaining = null;
    if (miniArena && Number.isFinite(miniArena.cx) && Number.isFinite(miniArena.cz) && Number.isFinite(miniArena.radius) && miniArena.radius > 0) {
      var acx = c + (miniArena.cx - miniX) * miniScale, acy = c + (miniArena.cz - miniZ) * miniScale, ar = miniArena.radius * miniScale;
      miniRemaining = miniArena.radius - 1.8 - Math.hypot(miniX - miniArena.cx, miniZ - miniArena.cz);
      ctx.fillStyle = 'rgba(4,8,12,.48)'; ctx.beginPath(); ctx.rect(0, 0, miniSize, miniSize);
      ctx.arc(acx, acy, ar, 0, MINI_TAU); ctx.fill('evenodd');
      ctx.strokeStyle = MINI_RED; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(acx, acy, ar, 0, MINI_TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(53,133,255,.55)'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.arc(acx, acy, Math.max(0, miniArena.radius - 1.8) * miniScale, 0, MINI_TAU); ctx.stroke();
    } else {
      miniArena = null; miniRemaining = Math.min(miniX, miniZ, miniWorld - miniX, miniWorld - miniZ);
      ctx.strokeStyle = 'rgba(245,251,255,.32)'; ctx.strokeRect(c - miniX * miniScale, c - miniZ * miniScale, miniWorld * miniScale, miniWorld * miniScale);
    }
    miniDrawActors(now);
    // Canvas positive rotation is clockwise; world yaw +PI/2 faces -X.
    // Therefore rotate the north-facing arrow by -yaw, never rotate the map.
    ctx.save(); ctx.translate(c, c); ctx.rotate(-miniYaw); ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(0, 2); ctx.lineTo(-4, 4); ctx.closePath();
    ctx.fillStyle = MINI_WHITE; ctx.strokeStyle = '#080e13'; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.restore(); ctx.strokeStyle = 'rgba(245,251,255,.36)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, miniRadius + .5, 0, MINI_TAU); ctx.stroke();
    ctx.strokeStyle = MINI_WHITE; ctx.beginPath(); ctx.moveTo(c, c - miniRadius); ctx.lineTo(c, c - miniRadius + 4); ctx.stroke();
    if (miniSize >= 104) {
      ctx.fillStyle = '#9db0bf'; ctx.textAlign = 'center'; ctx.fillText('W', 4, c + 3); ctx.fillText('E', miniSize - 4, c + 3); ctx.fillText('S', c, miniSize - 1);
    }
  }
  function miniText(node, value) { if (node.textContent !== value) node.textContent = value; }
  function miniUpdateReadouts(now) {
    var degrees = ((-miniYaw * 180 / Math.PI) % 360 + 360) % 360;
    var bearing = miniBearings[Math.round(degrees / 45) % 8];
    var heading = bearing + ' ' + String(Math.round(degrees) % 360).padStart(3, '0') + '\u00b0';
    miniText(miniNodes.heading, miniSize < 90 ? bearing : heading); miniNodes.heading.setAttribute('aria-label', 'Heading ' + heading);
    var remaining = Math.floor(Math.abs(miniRemaining || 0));
    miniText(miniNodes.edge, (miniRemaining < 0 ? 'OUT ' : miniSize < 90 ? 'E ' : 'EDGE ') + remaining + 'm');
    miniNodes.edge.title = (miniArena ? 'Locked arena' : 'World boundary') + ': ' + remaining + ' metres ' + (miniRemaining < 0 ? 'outside' : 'remaining');
    miniRoot.dataset.edge = miniRemaining < 8 ? 'near' : 'clear';
    miniRoot.dataset.locked = miniArena ? 'true' : 'false';
    var contacts = !miniCtx ? 'NO CANVAS' : !miniTerrainCount ? 'NO TERRAIN'
      : miniContacts ? 'FOE ' + miniContacts : miniOnline ? 'CLEAR' : 'SOLO';
    miniText(miniNodes.contacts, contacts);
    miniNodes.contacts.title = miniContacts ? miniContacts + ' visible opponents or recent shot locations'
      : miniOnline ? 'No currently observed opponents; hidden players are not reported' : 'Offline: no network opponents';
    var compact = miniSize < 90;
    miniText(miniNodes.guardians, (compact ? 'G ' : 'GUARD ') + (miniSeed === null ? '--' : miniSeedGuardians));
    miniText(miniNodes.mounts, (compact ? 'R ' : 'RIDE ') + (miniSeed === null ? '--' : miniSeedMounts));
    if (now - miniSummaryAt < 1000) return;
    miniSummaryAt = now;
    var summary = (miniTerrainCount ? 'Topographical ' + miniSource + ' terrain with 2m minor and 5m major contours' : 'No terrain data') + ', seed ' +
      (miniSeed === null ? 'unavailable' : miniSeed) + '. Heading ' + heading + '. ' +
      (miniArena ? 'Locked arena, ' : 'World edge, ') + remaining + ' metres ' + (miniRemaining < 0 ? 'outside' : 'remaining') +
      '. ' + miniAllies + ' nearby allies, ' + miniContacts + ' observed contacts, ' + miniVillageCount + ' nearby villages, ' +
      miniGuardians + ' nearby guardians, ' + miniSaddles + ' nearby small mounts. This seed has ' + miniSeedGuardians +
      ' indestructible, non-rideable guardians and ' + miniSeedMounts + ' rideable small mounts. ' + (miniOnline ? 'Online.' : 'Offline: no network opponents.');
    if (summary !== miniLastSummary) { miniLastSummary = summary; miniText(miniNodes.summary, summary); }
  }

  function miniUpdate(dt, now, playing) {
    now = Number.isFinite(now) ? now : miniNow();
    if (now < miniLastClock) { miniClearContacts(); miniLastTick = miniLayoutAt = -Infinity; }
    miniLastClock = now;
    var reason = miniPlayReason(playing);
    if (reason) { miniSetShown(false, reason); return false; }
    if (!miniEnsureDOM() || !miniCtx) { miniSetShown(false, 'no-canvas'); return false; }
    if (!miniCacheValid) { miniSetShown(false, miniPending ? 'mapping' : 'no-terrain'); return false; }
    if (now - miniLastTick < MINI_DRAW_MS) return miniShown;
    if (!miniShown && miniReason === 'space' && !miniLayoutDirty && now - miniLayoutAt < 1000) return false;
    miniLastTick = now;
    if ((miniLayoutDirty || now - miniLayoutAt >= 1000 || !miniShown) && !miniLayout(now)) {
      miniSetShown(false, 'space'); return false;
    }
    var self = miniPlayer();
    miniX = self.pos.x; miniY = self.pos.y; miniZ = self.pos.z;
    miniYaw = Number.isFinite(self.yaw) ? self.yaw : 0; miniPositionValid = true;
    var low = self.crouching || self.sliding || self.dashing;
    var eye = Number.isFinite(self.eyeHeight) ? self.eyeHeight : low ? 1.1 : 1.62;
    try {
      if (!Number.isFinite(self.eyeHeight) && typeof playerEyeHeight === 'function') eye = playerEyeHeight();
      else if (!Number.isFinite(self.eyeHeight) && typeof playerMotion !== 'undefined' && Number.isFinite(playerMotion.eyeDrop)) eye = 1.62 - playerMotion.eyeDrop;
    }
    catch (err) { /* current stance fallback is adequate */ }
    var body = Number.isFinite(self.bodyHeight) ? self.bodyHeight : low ? 1.2 : 1.8;
    miniEyeY = miniY + Math.max(.45, Math.min(1.8, body - .1, Number.isFinite(eye) ? eye : 1.1));
    miniPatchEdits(); miniCollectPeers(now); miniCheckLOS(now);
    miniDraw(now); miniUpdateReadouts(now); miniSetShown(true, '');
    miniLastDraw = now; miniRoot.dataset.drawAt = String(now);
    if (miniDrawRevision !== miniRevision) {
      miniDrawRevision = miniRevision; miniRoot.dataset.drawRevision = String(miniDrawRevision);
    }
    return true;
  }
  function miniSetVisible(value) {
    var enabled = value === 'off' || value === 'false' ? false : !!value;
    if (enabled === miniEnabled) return miniEnabled;
    miniEnabled = enabled;
    miniLayoutDirty = true; miniLastTick = -Infinity;
    if (!miniEnabled) miniSetShown(false, 'off');
    return miniEnabled;
  }
  function miniProject(x, z) {
    var self = miniPlayer(), valid = !!self && Number.isFinite(x) && Number.isFinite(z);
    // Match the last 10Hz overlay's centre, not an unseen intermediate frame.
    var cx = miniPositionValid ? miniX : self ? self.pos.x : miniX;
    var cz = miniPositionValid ? miniZ : self ? self.pos.z : miniZ;
    var dx = valid ? x - cx : 0, dz = valid ? z - cz : 0;
    var distance = valid ? Math.hypot(dx, dz) : null;
    var inWorld = valid && miniWorld > 0 && x >= 0 && z >= 0 && x < miniWorld && z < miniWorld;
    return { x: valid ? miniSize / 2 + dx * miniScale : null, y: valid ? miniSize / 2 + dz * miniScale : null,
      onMap: !!(miniCacheValid && inWorld && distance <= MINI_RANGE), inWorld: !!inWorld,
      distance: distance, radius: MINI_RANGE, size: miniSize };
  }
  function miniOnReady() {
    miniReady = true; miniEnsureDOM(); miniQueueRefresh('worldReady');
  }
  function miniInvalidate() {
    miniClearContacts(); miniPeerMap.clear(); miniPeers.length = 0; miniLOSIndex = 0;
    miniPositionValid = false; miniLastBuild = null; miniLastTick = -Infinity;
    miniAllies = miniDragonCount = miniSaddles = miniGuardians = miniVillageCount = 0; miniArena = miniRemaining = null;
    miniSetShown(false, 'mapping');
  }
  function miniOnWorldWillReset() {
    miniAwaitWorldReset = true; miniInvalidate(); miniCacheValid = false; miniPending = 'worldReset';
    miniSeed = null; miniSeedDragonCounts(); miniSource = 'unavailable'; miniLastDraw = -Infinity; miniDrawRevision = 0;
    miniTerrainCount = miniContourCount = 0; miniMinElevation = miniMaxElevation = null;
    miniVillages.length = 0; miniDirty.length = 0; miniDirtyAt = 0; miniDirtyFlags.fill(0);
    if (miniRoot) {
      miniRoot.dataset.ready = 'false'; miniRoot.dataset.seed = ''; miniRoot.dataset.source = miniSource;
      miniRoot.removeAttribute('data-draw-at'); miniRoot.removeAttribute('data-draw-revision');
      miniText(miniNodes.seed, 'S --');
    }
  }
  function miniOnWorldReset() {
    miniAwaitWorldReset = false;
    miniInvalidate(); miniQueueRefresh('worldReset');
  }
  function miniOnModeChanged() {
    miniInvalidate(); miniQueueRefresh('modeChanged');
  }
  function miniOnWorldBusyChanged(busy) {
    if (busy) { miniSetShown(false, 'world-busy'); return; }
    miniLayoutDirty = true; miniLastTick = -Infinity;
    if (miniPending && !miniAwaitWorldReset) miniQueueRefresh(miniPending);
  }
  function miniOnVoxelChanged(change, y, z) {
    if (change && typeof change === 'object') miniDirtyVoxel(change.x, change.z);
    else miniDirtyVoxel(change, z);
  }
  function miniOnNetStatus() {
    miniReadNet(); miniLayoutDirty = true;
    var key = miniOnline ? miniNet.id + '/' + miniNet.room + '/' + miniNet.session + '/' + miniNet.epoch : 'offline';
    if (key === miniNetKey) return; // ping/peer-count status is not a world reset
    miniNetKey = key; miniClearContacts(); miniPeerMap.clear(); miniPeers.length = 0; miniLOSIndex = 0;
    miniAllies = 0; miniLastTick = -Infinity;
    miniSetShown(false, 'network');
  }
  function miniOnLayoutChange() { miniLayoutDirty = true; }
  function miniOnPauseChange() {
    miniLayoutDirty = true;
    var reason = miniPlayReason(); if (reason) miniSetShown(false, reason);
  }

  miniBC.api.minimap = {
    get visible() { return miniEnabled; },
    get ready() { return miniReady && miniCacheValid; },
    get drawTimestamp() { return Number.isFinite(miniLastDraw) ? miniLastDraw : null; },
    setVisible: miniSetVisible,
    on: function () { return miniSetVisible(true); },
    off: function () { return miniSetVisible(false); },
    toggle: function () { return miniSetVisible(!miniEnabled); },
    refreshTerrain: function () { return miniRefreshTerrain(false); },
    update: miniUpdate,
    project: miniProject,
    get state() {
      return { visible: miniEnabled, shown: miniShown, hiddenReason: miniReason, ready: miniReady && miniCacheValid, worldReady: miniReady,
        terrainCached: miniCacheValid, terrainRevision: miniRevision, drawRevision: miniDrawRevision, terrainSamples: miniSampleCount,
        terrainSource: miniSource, pendingEdits: miniDirty.length - miniDirtyAt, seed: miniSeed,
        contourMinor: MINI_MINOR, contourMajor: MINI_MAJOR, contourSegments: miniContourCount,
        elevationMin: miniMinElevation, elevationMax: miniMaxElevation, terrainResolution: MINI_GRID, cacheResolution: MINI_ATLAS,
        radius: MINI_RANGE, contactRange: MINI_CONTACT_RANGE, mapSize: miniSize,
        layout: miniDock.layout, left: miniDock.left, top: miniDock.top, bottom: miniDock.bottom, width: miniDock.width, height: miniDock.height,
        center: miniPositionValid ? { x: miniX, y: miniY, z: miniZ } : null, yaw: miniYaw,
        locked: !!miniArena, remaining: miniRemaining, allies: miniAllies, contacts: miniContacts,
        villages: miniVillageCount, dragons: miniDragonCount, saddles: miniSaddles,
        guardians: miniGuardians, mounts: miniSaddles, seedGuardians: miniSeedGuardians, seedMounts: miniSeedMounts,
        seedDragonCount: miniSeedGuardians + miniSeedMounts,
        lastUpdate: Number.isFinite(miniLastTick) ? miniLastTick : null,
        lastDraw: Number.isFinite(miniLastDraw) ? miniLastDraw : null,
        drawTimestamp: Number.isFinite(miniLastDraw) ? miniLastDraw : null };
    }
  };
  miniBC.on('worldReady', miniOnReady, 80);
  miniBC.on('worldWillReset', miniOnWorldWillReset, 80);
  miniBC.on('worldReset', miniOnWorldReset, 80);
  miniBC.on('worldBusyChanged', miniOnWorldBusyChanged, 80);
  miniBC.on('modeChanged', miniOnModeChanged, 80);
  miniBC.on('frame', miniUpdate, 80);
  miniBC.on('netPacket', miniOnPacket, 80);
  miniBC.on('voxelChanged', miniOnVoxelChanged, 80);
  miniBC.on('sfx', miniOnSfx, 80);
  miniBC.on('death', function () { miniSetShown(false, 'death'); miniClearContacts(); }, 80);
  miniBC.on('respawn', function () { miniClearContacts(); miniLayoutDirty = true; miniLastTick = -Infinity; }, 80);
  miniBC.on('netStatus', miniOnNetStatus, 80);
  miniBC.on('inputReset', miniOnPauseChange, 80);
  miniBC.on('settingsChanged', function (key, value) {
    if (key === 'minimap' || key === 'minimapVisible') miniSetVisible(value);
  }, 80);
  if (typeof miniBC.whenReady === 'function') miniBC.whenReady(function () { if (!miniReady) miniOnReady(); });
  window.addEventListener('resize', miniOnLayoutChange);
  document.addEventListener('pointerlockchange', miniOnPauseChange);
  document.addEventListener('visibilitychange', miniOnPauseChange);
  if (typeof MutationObserver !== 'undefined' && document.body) {
    var miniObserver = new MutationObserver(miniOnPauseChange);
    miniObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    var miniWatched = ['hint', 'craft', 'scoreboard', 'jetFuel', 'buildHud'];
    for (var miniWatch = 0; miniWatch < miniWatched.length; miniWatch++) {
      var miniWatchedEl = document.getElementById(miniWatched[miniWatch]);
      if (miniWatchedEl) miniObserver.observe(miniWatchedEl, { attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden'] });
    }
  }
  // DOM creation is harmless before boot; terrain and game state are not read.
  miniEnsureDOM();
})();
