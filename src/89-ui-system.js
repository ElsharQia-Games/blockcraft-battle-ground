/* Blockcraft Battle Ground — UI system: menus and HUD.
   89-ui-system.js (after 86-hud.js, 87-minimap.js and 88-menu.js; 88 owns
   screen flow and focus, 05-settings owns the settings controls, this file
   owns how everything looks and the in-match HUD)

   Design
   - Tokens on :root (--ui-*). The legacy --bc-* tokens used by the settings
     controls are remapped onto them, so every control shares one palette.
   - Surfaces: solid dark panels with a 1px hairline, 10px radius; one
     primary action per screen (.ui-cta); quiet secondary buttons (.ui-btn).
   - Type: heavy display face for numbers and titles, system UI for text.
   - Team colour is the only saturated colour; everything else is neutral.
   - The HUD is drawn from game state (health, ammo, scores, fps, ping) into
     four corner modules and a centre score bar; it writes to the DOM only
     when a value changes. Phones get the same modules, smaller and placed
     clear of both thumbs.

   Also here: mode cards on Home, the Players & teams panel (Home and Pause:
   everyone can switch their own side in team modes, the host can move
   anyone; requests go through BC.api.net.requestTeam), and the Pause-menu
   graphics toggle. */
'use strict';
(function () {
  BC.style('ui-system', UI_CSS());
  document.body.classList.add('ui3');

  function api() { return BC.api && BC.api.net; }
  function modesApi() { return BC.api && BC.api.modes; }
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ================= Home: mode selector =================
     One selector with previous/next, like a console menu, instead of a grid
     of equal cards. Arrow presses update the label at once and apply the
     mode 600 ms after the last press, so skipping through several modes does
     not rebuild the world for each one. */
  const modeSlot = document.getElementById('homeModesSlot');
  let modeKey = '', modePending = null, modeTimer = 0;
  const modeNodes = {};
  function modeList() { const m = modesApi(); return m && m.MODES ? m.MODES : []; }
  function buildModePicker() {
    if (!modeSlot || modeNodes.root) return;
    const root = el('div', 'ui-modepick');
    root.id = 'homeModes';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Match mode');
    const prev = el('button', 'ui-arrow', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous mode');
    const next = el('button', 'ui-arrow', '›'); next.type = 'button'; next.setAttribute('aria-label', 'Next mode');
    const body = el('div', 'ui-modepick-body');
    const name = el('p', 'ui-modepick-name'); name.id = 'homeModeName'; name.setAttribute('aria-live', 'polite');
    const rule = el('p', 'ui-modepick-rule');
    body.append(name, rule);
    root.append(prev, body, next);
    const desc = el('p', 'ui-mode-desc'); desc.id = 'homeModeDesc';
    modeSlot.append(root, desc);
    Object.assign(modeNodes, { root, prev, next, name, rule, desc });
    prev.addEventListener('click', () => stepMode(-1));
    next.addEventListener('click', () => stepMode(1));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepMode(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepMode(1); }
    });
  }
  function showMode(def, allowed) {
    modeNodes.name.textContent = def.name;
    modeNodes.rule.textContent = (def.teams ? 'Red vs Blue' : 'Free for all') + '. First to ' + def.scoreToWin + '.';
    // The selector already states the rule; the hint only adds who decides.
    modeNodes.desc.textContent = allowed ? '' : 'The room host picks the mode.';
    modeNodes.root.title = def.desc;
    modeNodes.prev.disabled = modeNodes.next.disabled = !allowed;
  }
  function stepMode(dir) {
    const modes = modesApi(), list = modeList();
    if (!modes || !list.length || !modes.canConfigure()) return;
    const from = modePending || modes.active;
    const i = Math.max(0, list.findIndex((d) => d.id === from));
    const def = list[(i + dir + list.length) % list.length];
    modePending = def.id;
    showMode(def, true);
    clearTimeout(modeTimer);
    modeTimer = setTimeout(() => {
      const id = modePending;
      modePending = null;
      if (id && id !== modes.active && modes.canConfigure()) modes.setActive(id);
      modeKey = '';
      renderModes();
    }, 600);
  }
  function renderModes() {
    const modes = modesApi();
    if (!modeSlot || !modes || !modes.MODES) return;
    buildModePicker();
    if (modePending) return;
    const allowed = typeof modes.canConfigure === 'function' ? modes.canConfigure() : true;
    const key = modes.active + '|' + allowed;
    if (key === modeKey) return;
    modeKey = key;
    if (modes.activeDef) showMode(modes.activeDef, allowed);
  }

  /* ================= Pixel icons =================
     Custom 12x12 pixel icons that match the voxel world. Each is an ASCII
     grid ('#' = filled) turned into one SVG of merged horizontal runs in
     currentColor. Any element with data-icon="name" gets its icon prepended. */
  const ICONS = {
    friends: ['............', '.##......##.', '####....####', '####....####', '.##......##.', '............',
      '####....####', '#####..#####', '#####..#####', '#####..#####', '............', '............'],
    teams: ['.##########.', '.#####....#.', '.#####....#.', '.#####....#.', '.#####....#.', '.#####....#.',
      '..####...#..', '..####...#..', '...###..#...', '....##.#....', '.....##.....', '............'],
    lan: ['..########..', '..#......#..', '..#......#..', '..########..', '.....##.....', '.....##.....',
      '.##########.', '.#...##...#.', '.#...##...#.', '###.####.###', '###.####.###', '............'],
    phone: ['............', '............', '############', '#.........##', '#.........##', '#.........##',
      '#.........##', '#.........##', '############', '............', '............', '............'],
    signal: ['..........##', '..........##', '..........##', '.......##.##', '.......##.##', '.......##.##',
      '....##.##.##', '....##.##.##', '....##.##.##', '.##.##.##.##', '.##.##.##.##', '.##.##.##.##'],
    move: ['.....##.....', '....####....', '...######...', '.....##.....', '..#..##..#..', '.##..##..##.',
      '############', '.##..##..##.', '..#..##..#..', '.....##.....', '...######...', '....####....'],
    fight: ['.....##.....', '.....##.....', '...##..##...', '..#......#..', '.#........#.', '##...##...##',
      '##...##...##', '.#........#.', '..#......#..', '...##..##...', '.....##.....', '.....##.....'],
    build: ['............', '###.###.###.', '###.###.###.', '............', '.###.###.###', '.###.###.###',
      '............', '###.###.###.', '###.###.###.', '............', '.###.###.###', '.###.###.###'],
    jet: ['.....##.....', '....####....', '....####....', '...######...', '...######...', '..###..###..',
      '..##....##..', '..##....##..', '...##..##...', '....####....', '.....##.....', '............'],
    view: ['............', '............', '....####....', '..##....##..', '.#...##...#.', '#...####...#',
      '#...####...#', '.#...##...#.', '..##....##..', '....####....', '............', '............'],
    modes: ['.#..........', '.#########..', '.##.##.###..', '.#########..', '.###.##.##..', '.#########..',
      '.#..........', '.#..........', '.#..........', '.#..........', '.#..........', '###.........'],
    settings: ['.....##.....', '..#.####.#..', '.##########.', '..###..###..', '.###....###.', '####....####',
      '####....####', '.###....###.', '..###..###..', '.##########.', '..#.####.#..', '.....##.....'],
    help: ['...######...', '..########..', '..##....##..', '........##..', '.......###..', '.....####...',
      '.....##.....', '.....##.....', '............', '.....##.....', '.....##.....', '............']
  };
  function pixelIcon(name) {
    const grid = ICONS[name];
    if (!grid) return '';
    let rects = '';
    grid.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        if (row[x] !== '#') { x++; continue; }
        let w = 0;
        while (row[x + w] === '#') w++;
        rects += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="1"/>';
        x += w;
      }
    });
    return '<svg class="ui-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false" shape-rendering="crispEdges">' + rects + '</svg>';
  }
  document.querySelectorAll('[data-icon]').forEach((node) => {
    if (node.querySelector(':scope > .ui-icon')) return;
    node.insertAdjacentHTML('afterbegin', pixelIcon(node.dataset.icon));
  });

  /* ================= Players & teams ================= */
  const teamHosts = ['homeTeams', 'pauseTeams'].map((id) => document.getElementById(id)).filter(Boolean);
  teamHosts.forEach((h) => h.classList.add('ui-teams'));

  function teamsActive() {
    const modes = modesApi();
    return !!(modes && modes.activeDef && modes.activeDef.teams);
  }

  function roster() {
    const list = [];
    if (typeof net === 'undefined' || !net || !net.online || !net.id) return list;
    const connection = api(), seen = new Set();
    const add = (id, name, k, d) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      list.push({ id, name: safeName(name || 'Player'), self: id === net.id, host: id === net.hostId,
        team: connection ? connection.teamFor(id) : null, kills: k || 0, deaths: d || 0 });
    };
    add(net.id, typeof playerName === 'string' ? playerName : 'You', kills, deaths);
    net.players.forEach((r, id) => add(id, r.name, r.kills, r.deaths));
    return list;
  }

  function teamButton(label, cls, onClick, title) {
    const b = el('button', 'ui-btn ui-btn-xs ' + cls, label);
    b.type = 'button';
    if (title) b.title = title;
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
    return b;
  }

  function renderTeams(host) {
    const players = roster();
    host.hidden = players.length === 0;
    host.inert = players.length === 0;
    if (!players.length) { host.textContent = ''; host.dataset.key = ''; return; }
    const connection = api(), amHost = !!(connection && connection.isHost), teams = teamsActive();
    const key = JSON.stringify([teams, amHost, players.map((p) => [p.id, p.name, p.team, p.host])]);
    if (host.dataset.key === key) return;
    host.dataset.key = key;
    host.textContent = '';
    const head = el('div', 'ui-teams-head');
    head.append(el('h3', '', 'Players'), el('span', 'ui-count', String(players.length)),
      el('p', 'ui-hint', teams ? (amHost ? 'You host: move anyone.' : 'Pick your side.') : 'Free for all.'));
    host.appendChild(head);
    const grid = el('div', 'ui-teams-grid' + (teams ? '' : ' is-solo'));
    (teams ? ['red', 'blue'] : [null]).forEach((team) => {
      const col = el('section', 'ui-team' + (team ? ' is-' + team : ''));
      if (team) col.appendChild(el('h4', '', team === 'red' ? 'Red' : 'Blue'));
      const members = players.filter((p) => !teams || p.team === team);
      if (!members.length) col.appendChild(el('p', 'ui-hint', 'Empty'));
      members.forEach((p) => {
        const row = el('div', 'ui-player' + (p.self ? ' is-self' : ''));
        const name = el('span', 'ui-player-name', p.name);
        if (p.self) name.appendChild(el('em', 'ui-you', '(you)'));
        if (p.host) name.appendChild(el('em', 'ui-host', 'Host'));
        row.appendChild(name);
        if (teams && team && (p.self || amHost)) {
          const other = team === 'red' ? 'blue' : 'red';
          row.appendChild(teamButton(p.self ? 'Switch' : 'Move', 'is-to-' + other, () => {
            if (connection) connection.requestTeam(p.self ? null : p.id, other);
          }, (p.self ? 'Join the ' : 'Move ' + p.name + ' to the ') + other + ' team'));
        }
        col.appendChild(row);
      });
      grid.appendChild(col);
    });
    host.appendChild(grid);
  }

  /* ================= Pause: graphics toggle ================= */
  (function () {
    const actions = document.querySelector('.ui-pause-actions');
    const graphics = BC.api.graphics;
    if (!actions || !graphics) return;
    const b = el('button', 'ui-btn');
    b.id = 'pauseGraphics';
    b.type = 'button';
    const label = () => { b.textContent = 'Graphics: ' + (graphics.quality === 'high' ? 'High' : 'Fast'); };
    b.addEventListener('click', () => { graphics.setQuality(graphics.quality === 'high' ? 'low' : 'high'); label(); });
    label();
    actions.insertBefore(b, document.getElementById('pauseHome'));
  })();

  /* ================= HUD ================= */
  const hud = el('div', 'ui-hud');
  hud.id = 'uiHud';
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML = `
    <div class="hud-score" id="hudScore">
      <div class="hud-side is-red"><b id="hudScoreRed">0</b></div>
      <div class="hud-mode"><span id="hudMode">TDM</span><small id="hudGoal">First to 40</small></div>
      <div class="hud-side is-blue"><b id="hudScoreBlue">0</b></div>
    </div>
    <div class="hud-net" id="hudNet"><span id="hudFps">60</span><small>fps</small><span id="hudPing">--</span><small>ms</small><small id="hudRoute"></small></div>
    <div class="hud-vitals" id="hudVitals">
      <div class="hud-hp"><b id="hudHp">150</b><small id="hudKd">0 / 0</small></div>
      <div class="hud-hpbar" id="hudHpBar"><span id="hudHpFill"></span></div>
    </div>
    <div class="hud-weapon" id="hudWeapon">
      <div class="hud-ammo"><b id="hudAmmo">14</b><small id="hudMag">/ 14</small></div>
      <div class="hud-gun"><span id="hudGun">Pistol</span><span class="hud-slots" id="hudSlots"></span></div>
      <div class="hud-reload" id="hudReload"><span id="hudReloadFill"></span></div>
    </div>`;
  document.body.appendChild(hud);
  const $ = (id) => document.getElementById(id);
  const H = {
    red: $('hudScoreRed'), blue: $('hudScoreBlue'),
    mode: $('hudMode'), goal: $('hudGoal'), score: $('hudScore'), fps: $('hudFps'), ping: $('hudPing'), net: $('hudNet'), route: $('hudRoute'),
    hp: $('hudHp'), kd: $('hudKd'), hpFill: $('hudHpFill'), hpBar: $('hudHpBar'), vitals: $('hudVitals'),
    ammo: $('hudAmmo'), mag: $('hudMag'), gun: $('hudGun'), slots: $('hudSlots'), reload: $('hudReload'), reloadFill: $('hudReloadFill'),
    weapon: $('hudWeapon')
  };
  const last = Object.create(null);
  function put(key, node, value, prop) {
    if (last[key] === value) return;
    last[key] = value;
    if (prop) node.style[prop] = value; else node.textContent = value;
  }
  function flag(key, node, cls, on) {
    const k = key + cls;
    if (last[k] === on) return;
    last[k] = on;
    node.classList.toggle(cls, on);
  }

  function hudUpdate() {
    try {
      const modes = modesApi(), match = modes && modes.matchState ? modes.matchState() : null;
      if (match) {
        put('red', H.red, String(match.red));
        put('blue', H.blue, String(match.blue));
        put('mode', H.mode, match.short || match.name || '');
        const goal = match.scoreToWin || 0;
        put('goal', H.goal, 'to ' + goal);
        flag('score', H.score, 'is-ffa', !match.teams);
        flag('score', H.score, 'self-red', match.selfTeam === 'red');
        flag('score', H.score, 'self-blue', match.selfTeam === 'blue');
      }
      put('fps', H.fps, String(typeof shownFps === 'number' && shownFps > 0 ? shownFps : '--'));
      const connection = api(), ping = connection && typeof connection.getPing === 'function' ? connection.getPing() : NaN;
      put('ping', H.ping, Number.isFinite(ping) ? String(ping) : '--');
      flag('net', H.net, 'is-bad', Number.isFinite(ping) && ping > 150);
      const rtcApi = BC.api.rtc, mqttRoom = typeof net !== 'undefined' && net.mode === 'mqtt' && net.online;
      put('route', H.route, mqttRoom ? (rtcApi && rtcApi.direct ? 'direct' : 'relay') : '');

      const hp = Math.max(0, Math.round(health));
      put('hp', H.hp, String(hp));
      put('kd', H.kd, kills + ' K · ' + deaths + ' D');
      put('hpFill', H.hpFill, (hp / MAX_HEALTH * 100).toFixed(1) + '%', 'width');
      flag('hp', H.vitals, 'is-low', hp <= MAX_HEALTH * 0.35);
      flag('hp', H.vitals, 'is-mid', hp > MAX_HEALTH * 0.35 && hp <= MAX_HEALTH * 0.6);

      const w = typeof currentWeapon === 'function' ? currentWeapon() : null;
      if (w) {
        const ammo = gun.ammo[gun.index];
        put('ammo', H.ammo, String(ammo));
        put('mag', H.mag, '/ ' + w.mag);
        put('gun', H.gun, w.name);
        flag('weapon', H.weapon, 'is-low', ammo <= Math.ceil(w.mag * 0.25));
        const reloading = gun.reloading > 0 && gun.reloadTotal > 0;
        flag('weapon', H.weapon, 'is-reloading', reloading);
        put('reload', H.reloadFill, (reloading ? (1 - gun.reloading / gun.reloadTotal) * 100 : 0).toFixed(0) + '%', 'width');
        const slotKey = WEAPONS.map((x, i) => (i === gun.index ? 'A' : combatWeaponAllowed(x) ? '1' : '0')).join('');
        if (last.slots !== slotKey) {
          last.slots = slotKey;
          H.slots.textContent = '';
          WEAPONS.forEach((x, i) => {
            const s = el('i', slotKey[i] === 'A' ? 'is-on' : slotKey[i] === '0' ? 'is-off' : '');
            s.textContent = String(i + 1);
            H.slots.appendChild(s);
          });
        }
      }
      const building = typeof quickBuild !== 'undefined' && (quickBuild.active || !combatMode);
      flag('body', document.body, 'hud-building', !!building);
    } catch (e) { /* HUD must never break the frame */ }
  }

  /* ================= refresh wiring ================= */
  function refreshMenus() {
    renderModes();
    teamHosts.forEach(renderTeams);
  }
  BC.on('netPacket', () => Promise.resolve().then(refreshMenus), 95);
  BC.on('teamChanged', refreshMenus, 95);
  BC.on('modeChanged', refreshMenus, 95);
  BC.on('lateFrame', hudUpdate, 900);
  setInterval(refreshMenus, 1000);
  refreshMenus();
  hudUpdate();

  BC.api.ui = { refresh: refreshMenus, roster, hud: H };
  BC.api.lobby = BC.api.ui; // older name
})();

/* ================= stylesheet ================= */
function UI_CSS() {
  return `
  /* Block language: sharp 3px corners, solid surfaces, and controls with an
     extruded bottom edge that presses down like a block. One accent, the
     player's team colour; everything else is neutral. No glass, no glows,
     no gradient text. */
  :root {
    --ui-ink: #f2f1ee; --ui-ink-2: #b9b8b3; --ui-ink-3: #85847f;
    --ui-0: #101113; --ui-1: #17181b; --ui-2: #202227; --ui-3: #2b2e34; --ui-edge: #08090a;
    --ui-line: #2f3238;
    --ui-red: #e8403f; --ui-red-edge: #8f1f22; --ui-blue: #3b7ff0; --ui-blue-edge: #1d4594;
    --ui-accent: var(--ui-red); --ui-accent-edge: var(--ui-red-edge);
    --ui-r: 3px;
    --ui-font: "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
    --ui-display: "Arial Black", "Segoe UI Black", system-ui, sans-serif;
    --ui-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
    --ui-gut: clamp(14px, 3vw, 40px);
    /* legacy tokens read by the settings controls in 05-settings.js */
    --bc-ink: var(--ui-ink); --bc-dim: var(--ui-ink-2); --bc-line: var(--ui-line); --bc-line-strong: var(--ui-line);
    --bc-panel: var(--ui-1); --bc-surface: var(--ui-2); --bc-surface-hover: var(--ui-3); --bc-glass: var(--ui-1);
    --bc-glass-deep: var(--ui-0); --bc-edge: var(--ui-edge); --bc-radius: var(--ui-r);
    --bc-panel-bevel: none; --bc-control-bevel: 0 3px 0 var(--ui-edge); --bc-ui-font: var(--ui-font); --bc-display-font: var(--ui-display);
    --bc-blue: var(--ui-accent); --bc-blue-fill: var(--ui-accent); --bc-red: var(--ui-red); --bc-red-fill: var(--ui-red);
    --menu-muted: var(--ui-ink-2); --menu-line: var(--ui-line);
  }
  body[data-bc-accent="blue"] { --ui-accent: var(--ui-blue); --ui-accent-edge: var(--ui-blue-edge); }

  /* ---------- screens ---------- */
  .bc-menu { position: fixed; inset: 0; z-index: 10; display: flex; color: var(--ui-ink); font: 500 15px/1.45 var(--ui-font); overflow: hidden; }
  .bc-menu.hidden, .bc-menu[hidden], .bc-menu [hidden] { display: none !important; }
  .bc-menu :is(h1, h2, h3, h4, p) { margin: 0; }
  :where(.bc-menu) button { font-family: inherit; color: inherit; -webkit-tap-highlight-color: transparent; }
  .bc-menu :focus-visible { outline: 2px solid var(--ui-ink); outline-offset: 3px; }
  .bc-menu [tabindex="-1"]:focus { outline: none; }
  .bc-menu, .bc-menu * { scrollbar-width: thin; scrollbar-color: var(--ui-3) transparent; }
  .bc-menu ::-webkit-scrollbar { width: 8px; height: 8px; }
  .bc-menu ::-webkit-scrollbar-thumb { background: var(--ui-3); border-radius: 4px; }
  .bc-menu ::-webkit-scrollbar-track { background: transparent; }
  .bc-menu kbd { display: inline-block; padding: 0 6px; border-radius: var(--ui-r); background: var(--ui-3); box-shadow: 0 2px 0 var(--ui-edge);
    font: 700 11px/1.7 var(--ui-mono); color: var(--ui-ink); }
  .bc-menu code { font-family: var(--ui-mono); }
  .ui-label { display: block; color: var(--ui-ink-2); font-size: 13px; font-weight: 600; }
  .ui-hint { color: var(--ui-ink-3); font-size: 13px; }

  .ui-icon { width: 1.15em; height: 1.15em; flex: none; fill: currentColor; vertical-align: -.18em; }
  :is(h2, h3)[data-icon] { display: flex; align-items: center; gap: .5em; }
  :is(h2, h3)[data-icon] > .ui-icon { color: var(--ui-accent); }
  .ui-row > .ui-icon { color: var(--ui-ink-2); width: 18px; height: 18px; }
  /* ---------- controls ---------- */
  .ui-btn, .ui-cta, .ui-back, .ui-row, .ui-arrow { appearance: none; border: 0; cursor: pointer; border-radius: var(--ui-r); font-weight: 700;
    transition: transform .06s, box-shadow .06s, background .1s; }
  .ui-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: 0 16px; white-space: nowrap;
    background: var(--ui-3); color: var(--ui-ink); box-shadow: 0 3px 0 var(--ui-edge); }
  .ui-btn:hover:not(:disabled) { background: #363a42; }
  .ui-btn:active:not(:disabled), .ui-row:active, .ui-arrow:active:not(:disabled), .ui-back:active { transform: translateY(3px); box-shadow: 0 0 0 var(--ui-edge); }
  .ui-btn:disabled, .ui-cta:disabled, .ui-arrow:disabled { opacity: .45; cursor: not-allowed; }
  .ui-btn-quiet { background: transparent; box-shadow: none; color: var(--ui-ink-2); padding: 0 4px; min-height: 32px; justify-content: flex-start; }
  .ui-btn-quiet:hover:not(:disabled) { background: transparent; color: var(--ui-ink); text-decoration: underline; }
  .ui-btn-xs { min-height: 28px; padding: 0 10px; font-size: 12.5px; box-shadow: 0 2px 0 var(--ui-edge); }
  .ui-cta { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 64px; padding: 0 24px;
    background: var(--ui-accent); color: #fff; box-shadow: 0 5px 0 var(--ui-accent-edge); font: 900 22px/1 var(--ui-display); letter-spacing: .02em; }
  .ui-cta:hover:not(:disabled) { filter: brightness(1.06); }
  .ui-cta:active:not(:disabled) { transform: translateY(5px); box-shadow: 0 0 0 var(--ui-accent-edge); }
  .ui-cta-sm { width: auto; min-height: 46px; font-size: 16px; box-shadow: 0 4px 0 var(--ui-accent-edge); }
  .ui-input, .bc-menu input[type="text"] { box-sizing: border-box; min-height: 42px; padding: 0 12px; min-width: 0; border-radius: var(--ui-r);
    border: 2px solid var(--ui-3); background: var(--ui-0); color: var(--ui-ink); font: 700 15px var(--ui-font); }
  .ui-input::placeholder { color: #5f5e5a; }
  .ui-input:focus, .bc-menu input[type="text"]:focus { outline: none; border-color: var(--ui-ink-2); }
  .bc-menu input[aria-invalid="true"] { border-color: var(--ui-red); }
  #roomInput { letter-spacing: .2em; text-transform: uppercase; font-family: var(--ui-mono); }

  /* ---------- Home ---------- */
  .ui-home { display: grid; grid-template-columns: minmax(300px, 400px) 1fr minmax(280px, 340px); grid-template-rows: 1fr auto;
    background: linear-gradient(90deg, rgba(16, 17, 19, .94) 0, rgba(16, 17, 19, .82) 400px, rgba(16, 17, 19, .1) 62%, rgba(16, 17, 19, .55) 100%); }
  .ui-rail { grid-row: 1 / -1; display: flex; flex-direction: column; gap: 18px; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
    padding: clamp(18px, 4vh, 44px) var(--ui-gut); padding-left: max(var(--ui-gut), env(safe-area-inset-left)); }
  .ui-wordmark { font: 900 clamp(34px, 4.2vw, 52px)/.92 var(--ui-display); letter-spacing: -.02em; }
  .ui-wordmark span { display: block; margin-top: 8px; color: var(--ui-accent); font-size: .42em; letter-spacing: .01em; }
  .ui-modepick { display: grid; grid-template-columns: 44px 1fr 44px; align-items: stretch; gap: 6px; margin-top: 6px; }
  .ui-arrow { background: var(--ui-2); color: var(--ui-ink); font: 900 24px/1 var(--ui-font); box-shadow: 0 3px 0 var(--ui-edge); }
  .ui-arrow:hover:not(:disabled) { background: var(--ui-3); }
  .ui-modepick-body { display: grid; align-content: center; gap: 2px; padding: 10px 14px; background: var(--ui-2); border-radius: var(--ui-r);
    box-shadow: inset 0 0 0 2px var(--ui-accent); }
  .ui-modepick-name { font: 900 19px/1.15 var(--ui-display); }
  .ui-modepick-rule { color: var(--ui-ink-2); font-size: 13px; }
  .ui-mode-desc { color: var(--ui-ink-3); font-size: 13px; }
  .ui-mode-desc:empty { display: none; }
  .ui-match-host:empty { display: none; }
  .ui-match-host :is(#bcMatchMode, #bcMatchRule) { display: none; }
  .ui-match-host .bcs-match { display: flex; gap: 4px 12px; flex-wrap: wrap; margin: 0; font-size: 13px; color: var(--ui-ink-3); }
  .ui-match-host .bcs-match dd { margin: 0 10px 0 0; color: var(--ui-ink); font-weight: 700; }
  .ui-launch { display: grid; gap: 8px; }
  #homeProgress { width: 100%; height: 6px; appearance: none; border: 0; border-radius: var(--ui-r); background: var(--ui-2); overflow: hidden; }
  #homeProgress::-webkit-progress-bar { background: var(--ui-2); }
  #homeProgress::-webkit-progress-value { background: var(--ui-ink-2); }
  #homeProgress::-moz-progress-bar { background: var(--ui-ink-2); }
  #homeProgress:not([value]), #homeProgress[value="100"] { display: none; }
  .ui-menu { display: grid; gap: 6px; margin-top: 8px; }
  .ui-row { display: flex; align-items: center; gap: 12px; min-height: 46px; padding: 0 14px; text-align: left; font-size: 16px;
    background: transparent; color: var(--ui-ink); box-shadow: none; }
  .ui-row:hover { background: var(--ui-2); box-shadow: 0 3px 0 var(--ui-edge); }
  .ui-row-profile { min-height: 58px; background: var(--ui-2); box-shadow: 0 3px 0 var(--ui-edge); }
  .ui-row-profile:hover { background: var(--ui-3); }
  .ui-portrait { width: 38px; height: 38px; image-rendering: pixelated; border-radius: var(--ui-r); background: var(--ui-3); flex: none; }
  .ui-row-text { display: grid; line-height: 1.2; }
  #homePlayerName { font-weight: 800; }
  #homeCharacter { color: var(--ui-ink-3); font-size: 13px; font-weight: 600; }
  .ui-publisher { margin-top: auto; padding-top: 8px; color: var(--ui-ink-3); font-size: 12.5px; font-weight: 700; }

  .ui-squad { grid-column: 3; grid-row: 1; align-self: start; box-sizing: border-box; max-height: calc(100% - 2 * clamp(18px, 4vh, 44px));
    margin: clamp(18px, 4vh, 44px) var(--ui-gut) 0 0; margin-right: max(var(--ui-gut), env(safe-area-inset-right));
    display: flex; flex-direction: column; gap: 14px; padding: 18px; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;
    background: var(--ui-1); border-radius: var(--ui-r); box-shadow: 0 4px 0 var(--ui-edge); }
  .ui-squad-head h2 { font: 900 20px/1.1 var(--ui-display); }
  .ui-status { margin-top: 4px; color: var(--ui-ink-3); font-size: 13px; }
  #homeConnectionLabel { color: var(--ui-ink); font-weight: 700; }
  .ui-room-connect { display: grid; gap: 14px; }
  .ui-room-connect > .ui-btn { width: 100%; }
  .ui-join { display: grid; gap: 6px; }
  .ui-join-row { display: flex; gap: 8px; }
  .ui-join-row .ui-input { flex: 1; }
  .ui-invite { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 4px 10px; padding: 12px; border-radius: var(--ui-r); background: var(--ui-0); }
  .ui-invite .ui-label { grid-column: 1 / -1; }
  #homeRoomCode { font: 800 24px var(--ui-mono); letter-spacing: .14em; }
  .ui-keys { grid-column: 2 / 4; display: flex; gap: 18px; justify-content: flex-end; flex-wrap: wrap; padding: 12px var(--ui-gut) 16px;
    padding-right: max(var(--ui-gut), env(safe-area-inset-right)); color: var(--ui-ink-2); font-size: 13px; text-shadow: 0 1px 2px #000; }
  .ui-keys span { display: inline-flex; gap: 6px; align-items: center; }

  /* ---------- players & teams ---------- */
  .ui-teams { display: grid; gap: 10px; }
  .ui-teams[hidden] { display: none; }
  .ui-teams-head { display: flex; align-items: baseline; gap: 8px; padding-top: 12px; border-top: 2px solid var(--ui-2); }
  .ui-teams-head h3 { font-size: 15px; font-weight: 800; }
  .ui-count { color: var(--ui-ink-3); font-weight: 700; }
  .ui-teams-head .ui-hint { margin-left: auto; }
  .ui-teams-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .ui-teams-grid.is-solo { grid-template-columns: 1fr; }
  .ui-team { display: grid; gap: 4px; align-content: start; min-width: 0; }
  .ui-team h4 { font-size: 13px; font-weight: 800; padding-bottom: 4px; border-bottom: 3px solid var(--ui-3); }
  .ui-team.is-red h4 { color: var(--ui-red); border-color: var(--ui-red); }
  .ui-team.is-blue h4 { color: var(--ui-blue); border-color: var(--ui-blue); }
  .ui-team > .ui-hint { padding: 6px 0; }
  .ui-player { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; min-height: 34px; min-width: 0; }
  .ui-player-name { flex: 1; min-width: 0; font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ui-player-name em { margin-left: 5px; font-style: normal; font-size: 12px; font-weight: 600; color: var(--ui-ink-3); }
  .ui-player-name em.ui-host { color: var(--ui-ink-2); }
  .ui-btn.is-to-red { box-shadow: 0 2px 0 var(--ui-red-edge); background: var(--ui-red); color: #fff; }
  .ui-btn.is-to-blue { box-shadow: 0 2px 0 var(--ui-blue-edge); background: var(--ui-blue); color: #fff; }

  /* ---------- pages ---------- */
  .ui-page { align-items: stretch; justify-content: flex-start; background: rgba(16, 17, 19, .72); }
  .ui-sheet { box-sizing: border-box; display: flex; flex-direction: column; width: min(980px, 100%); height: 100%;
    background: var(--ui-1); box-shadow: 4px 0 0 var(--ui-edge); }
  .ui-sheet-head { display: flex; align-items: center; gap: 16px; padding: 16px var(--ui-gut); padding-left: max(var(--ui-gut), env(safe-area-inset-left)); }
  .ui-sheet-head h2 { font: 900 26px/1.1 var(--ui-display); }
  .ui-back { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; background: var(--ui-3); color: var(--ui-ink); box-shadow: 0 3px 0 var(--ui-edge); }
  .ui-sheet-body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; display: grid; gap: 22px; align-content: start;
    padding: 6px var(--ui-gut) 24px; padding-left: max(var(--ui-gut), env(safe-area-inset-left)); }
  .ui-sheet-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px var(--ui-gut);
    padding-left: max(var(--ui-gut), env(safe-area-inset-left)); border-top: 2px solid var(--ui-2); }
  .ui-tabs { display: flex; gap: 6px; padding: 0 var(--ui-gut) 10px; padding-left: max(var(--ui-gut), env(safe-area-inset-left)); overflow-x: auto; }
  .ui-tabs button { appearance: none; border: 0; border-radius: var(--ui-r); background: transparent; color: var(--ui-ink-2); font-weight: 700;
    font-size: 15px; padding: 9px 14px; cursor: pointer; white-space: nowrap; }
  .ui-tabs button:hover { color: var(--ui-ink); background: var(--ui-2); }
  .ui-tabs button[aria-selected="true"] { color: var(--ui-ink); background: var(--ui-3); box-shadow: 0 3px 0 var(--ui-edge), inset 0 -3px 0 var(--ui-accent); }
  .bc-settings-panel { max-width: 860px; width: 100%; }
  .bc-settings-panel > * + * { margin-top: 22px; }
  .ui-identity { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(220px, 320px); align-items: center; gap: 18px; }
  .ui-portrait-lg { width: 72px; height: 72px; }
  #characterSelected { font: 900 26px/1.15 var(--ui-display); }
  .ui-field { display: grid; gap: 6px; }
  #chars { display: grid; grid-template-columns: repeat(auto-fill, minmax(156px, 1fr)); gap: 10px; }
  #chars .char { display: flex; align-items: center; gap: 10px; min-height: 58px; padding: 8px 10px; text-align: left; cursor: pointer; border: 0;
    border-radius: var(--ui-r); background: var(--ui-2); color: var(--ui-ink); font: 700 14px/1.25 var(--ui-font); box-shadow: 0 3px 0 var(--ui-edge); }
  #chars .char:hover { background: var(--ui-3); }
  #chars .char:active { transform: translateY(3px); box-shadow: none; }
  #chars .char.active { box-shadow: 0 3px 0 var(--ui-edge), inset 0 0 0 2px var(--ui-accent); }
  #chars .char canvas { flex: none; width: 38px; height: 38px; image-rendering: pixelated; border-radius: var(--ui-r); }
  .ui-help { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
  .ui-help section { display: grid; gap: 6px; align-content: start; }
  .ui-help h3 { font-size: 16px; font-weight: 800; }
  .ui-help p { color: var(--ui-ink-2); font-size: 14px; }
  .ui-session { padding: 16px; display: grid; gap: 6px; align-content: start; background: var(--ui-0); border-radius: var(--ui-r); }
  #onlineSessionName { font: 900 22px var(--ui-display); }
  .ui-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 22px 32px; }
  .ui-controls h3 { font-size: 16px; font-weight: 800; margin-bottom: 8px; }
  .ui-controls dl { display: grid; grid-template-columns: minmax(96px, auto) 1fr; gap: 8px 14px; margin: 0; font-size: 14px; }
  .ui-controls dt { color: var(--ui-ink); }
  .ui-controls dd { margin: 0; color: var(--ui-ink-2); }
  #tiny { color: var(--ui-ink-3); font-size: 12px; overflow-wrap: anywhere; }

  /* ---------- pause ---------- */
  .ui-pause { align-items: stretch; background: linear-gradient(90deg, rgba(16, 17, 19, .94), rgba(16, 17, 19, .6) 460px, rgba(16, 17, 19, .25)); }
  .ui-pause-card { box-sizing: border-box; width: min(420px, 100%); height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 18px;
    padding: clamp(18px, 4vh, 44px) var(--ui-gut); padding-left: max(var(--ui-gut), env(safe-area-inset-left)); }
  #pauseTitle { font: 900 40px/1 var(--ui-display); }
  #pauseContext { color: var(--ui-ink-2); margin-top: 8px; }
  .ui-pause-score { display: flex; justify-content: space-between; margin-top: 10px; font-weight: 800; }
  #pauseTeam.red { color: var(--ui-red); } #pauseTeam.blue { color: var(--ui-blue); }
  .ui-pause-actions { display: grid; gap: 10px; }
  .ui-pause-actions .ui-btn { width: 100%; min-height: 46px; font-size: 15px; }

  /* ---------- settings controls (05-settings.js) ---------- */
  .bc-menu :is(.bcs-mode, .bcs-cross, .bcs-seg button, .bcs-toggle, #bcWeaponSensReset, #bcSeedRandom) {
    border-radius: var(--ui-r) !important; box-shadow: 0 3px 0 var(--ui-edge) !important; border: 0 !important; background: var(--ui-2) !important; }
  .bc-menu :is(.bcs-mode, .bcs-cross, .bcs-seg button, .bcs-toggle)[aria-pressed="true"] { box-shadow: 0 3px 0 var(--ui-edge), inset 0 0 0 2px var(--ui-accent) !important; }
  .bc-menu input[type="range"] { accent-color: var(--ui-accent); }
  .bc-menu select { min-height: 38px; border-radius: var(--ui-r); background: var(--ui-0); color: var(--ui-ink); border: 2px solid var(--ui-3); }

  /* ---------- layouts by size ---------- */
  @media (max-width: 1100px) {
    .ui-home { grid-template-columns: minmax(280px, 380px) 1fr; }
    .ui-squad { grid-column: 2; justify-self: end; width: min(340px, calc(100% - var(--ui-gut))); }
    .ui-keys { grid-column: 2; }
  }
  @media (max-width: 720px) and (min-height: 521px) {
    .ui-home { display: block; overflow-y: auto; background: linear-gradient(180deg, rgba(16, 17, 19, .94), rgba(16, 17, 19, .7)); }
    .ui-rail { overflow: visible; }
    .ui-squad { width: auto; max-height: none; margin: 0 var(--ui-gut) var(--ui-gut); }
    .ui-keys { display: none; }
    .ui-identity { grid-template-columns: auto 1fr; }
    .ui-identity .ui-field { grid-column: 1 / -1; }
  }
  /* Landscape phones: rail and squad side by side, Play in reach. */
  @media (max-height: 520px) {
    .ui-home { grid-template-columns: minmax(0, 1fr) minmax(250px, 42%); background: linear-gradient(90deg, rgba(16, 17, 19, .92), rgba(16, 17, 19, .6)); }
    .ui-rail { gap: 10px; padding-block: 12px; }
    .ui-wordmark { font-size: 24px; }
    .ui-wordmark span { display: inline; margin: 0 0 0 6px; font-size: .55em; }
    .ui-mode-desc, #homeLoadHint, .ui-publisher, .ui-keys, .ui-match-host { display: none; }
    .ui-modepick-body { padding: 6px 10px; }
    .ui-modepick-name { font-size: 16px; }
    .ui-cta { min-height: 50px; font-size: 18px; }
    .ui-menu { grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 0; }
    .ui-row { min-height: 38px; font-size: 14px; }
    .ui-row-profile { grid-column: 1 / -1; min-height: 46px; }
    .ui-squad { grid-column: 2; width: auto; max-height: calc(100% - 24px); margin: 12px max(12px, env(safe-area-inset-right)) 0 0; padding: 12px; gap: 10px; }
    .ui-sheet-head { padding-block: 8px; }
    .ui-sheet-head h2 { font-size: 20px; }
    .ui-pause-card { padding-block: 12px; gap: 10px; }
    #pauseTitle { font-size: 28px; }
  }
  body.touch-ui .ui-keys { display: none; }
  @media (prefers-reduced-motion: reduce) { .bc-menu * { transition: none !important; } }

  /* =================== HUD =================== */
  /* Retired panels from 86-hud.js; their owners still update them. */
  body.ui3 :is(#stats, #teamScore, #pingChip, #healthWrap, #weaponHud) { display: none !important; }
  .ui-hud { position: fixed; inset: 0; z-index: 4; pointer-events: none; color: var(--ui-ink); font: 700 13px/1 var(--ui-font);
    font-variant-numeric: tabular-nums; display: none; text-shadow: 0 2px 0 rgba(0, 0, 0, .55); }
  body.started .ui-hud { display: block; }
  body[data-bc-hud-visible="false"] .ui-hud, body.scoped .ui-hud .hud-net { display: none; }
  .ui-hud small { color: var(--ui-ink-2); }
  .hud-score { position: absolute; top: max(12px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
    display: grid; grid-template-columns: 64px auto 64px; border-radius: var(--ui-r); overflow: hidden; box-shadow: 0 3px 0 rgba(0, 0, 0, .45); }
  .hud-side { display: grid; place-items: center; padding: 6px 0; }
  .hud-side b { font: 900 26px/1 var(--ui-display); color: #fff; text-shadow: none; }
  .hud-side.is-red { background: var(--ui-red); } .hud-side.is-blue { background: var(--ui-blue); }
  .hud-mode { display: grid; place-items: center; gap: 3px; padding: 5px 12px; background: rgba(16, 17, 19, .82); text-shadow: none; }
  #hudMode { font: 900 13px/1 var(--ui-display); }
  #hudGoal { font-size: 11px; font-weight: 600; }
  .hud-score.is-ffa .hud-side.is-red { background: var(--ui-ink); } .hud-score.is-ffa .hud-side.is-red b { color: var(--ui-0); }
  .hud-score.is-ffa .hud-side.is-blue { background: var(--ui-3); }
  .hud-net { position: absolute; top: max(14px, env(safe-area-inset-top)); right: max(16px, env(safe-area-inset-right));
    display: flex; align-items: baseline; gap: 4px; font-size: 14px; }
  .hud-net small { font-size: 11px; margin-right: 8px; }
  .hud-net small:last-child { margin-right: 0; }
  .hud-net.is-bad #hudPing { color: var(--ui-red); }
  .hud-vitals { position: absolute; left: max(20px, env(safe-area-inset-left)); bottom: max(18px, env(safe-area-inset-bottom)); width: 230px; display: grid; gap: 8px; }
  .hud-hp { display: flex; align-items: baseline; gap: 10px; }
  #hudHp { font: 900 44px/1 var(--ui-display); }
  #hudKd { margin-left: auto; font-size: 12px; color: var(--ui-ink-2); }
  .hud-hpbar { position: relative; height: 10px; border-radius: var(--ui-r); background: rgba(16, 17, 19, .7); box-shadow: 0 2px 0 rgba(0, 0, 0, .45); overflow: hidden; }
  .hud-hpbar span { position: absolute; inset: 0 auto 0 0; width: 100%; background: var(--ui-ink); transition: width .12s ease-out; }
  .hud-vitals.is-mid .hud-hpbar span { background: #f0a43a; }
  .hud-vitals.is-low .hud-hpbar span, .hud-vitals.is-low #hudHp { background-color: var(--ui-red); }
  .hud-vitals.is-low #hudHp { background: none; color: var(--ui-red); }
  .hud-weapon { position: absolute; right: max(20px, env(safe-area-inset-right)); bottom: max(18px, env(safe-area-inset-bottom)); display: grid; gap: 8px; justify-items: end; }
  .hud-ammo { display: flex; align-items: baseline; gap: 6px; }
  #hudAmmo { font: 900 44px/1 var(--ui-display); }
  #hudMag { font-size: 15px; }
  .hud-weapon.is-low #hudAmmo { color: #f0a43a; }
  .hud-gun { display: flex; align-items: center; gap: 10px; }
  #hudGun { font-size: 14px; color: var(--ui-ink); }
  .hud-slots { display: flex; gap: 3px; }
  .hud-slots i { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 2px; font: 800 10px/1 var(--ui-font); font-style: normal;
    background: rgba(16, 17, 19, .7); color: var(--ui-ink-3); text-shadow: none; }
  .hud-slots i.is-on { background: var(--ui-ink); color: var(--ui-0); }
  .hud-slots i.is-off { opacity: .3; }
  .hud-reload { width: 100%; height: 4px; border-radius: 2px; background: rgba(16, 17, 19, .7); overflow: hidden; visibility: hidden; }
  .hud-reload span { display: block; height: 100%; width: 0; background: var(--ui-ink); }
  .hud-weapon.is-reloading .hud-reload { visibility: visible; }
  body.hud-building .hud-weapon { opacity: .45; }
  /* Kept modules, matched to the block language. */
  body.ui3 #killfeed .kf { border-radius: var(--ui-r) !important; background: rgba(16, 17, 19, .8) !important; border: 0 !important;
    box-shadow: 0 2px 0 rgba(0, 0, 0, .45) !important; font-family: var(--ui-font) !important; font-weight: 700; letter-spacing: 0 !important; }
  body.ui3 #toast { border-radius: var(--ui-r) !important; background: var(--ui-1) !important; border: 0 !important;
    box-shadow: 0 3px 0 var(--ui-edge) !important; font-family: var(--ui-font) !important; letter-spacing: 0 !important; text-transform: none !important; font-size: 13px !important; }
  body.ui3 :is(#buildHud, #jetFuel, #dragonRideHud, #dragonRidePrompt, #roomBadge) { border-radius: var(--ui-r) !important;
    background: rgba(16, 17, 19, .82) !important; border: 0 !important; box-shadow: 0 3px 0 rgba(0, 0, 0, .45) !important; }
  body.ui3 #hotbar { background: transparent !important; border: 0 !important; box-shadow: none !important; }
  body.ui3 #hotbar .slot { border-radius: var(--ui-r) !important; background: rgba(16, 17, 19, .78) !important; border-color: transparent !important; box-shadow: 0 3px 0 rgba(0, 0, 0, .45) !important; }
  body.ui3 #hotbar .slot.active { box-shadow: 0 3px 0 rgba(0, 0, 0, .45), inset 0 0 0 2px var(--ui-ink) !important; }
  body.ui3 #death h2 { font-family: var(--ui-display); }

  /* Phones: same modules, smaller, clear of both thumbs. */
  body.touch-playing .hud-score { transform: translateX(-50%) scale(.82); transform-origin: center top; }
  body.touch-playing .hud-net { top: auto; bottom: max(8px, env(safe-area-inset-bottom)); right: 50%; transform: translateX(50%); font-size: 11px; }
  body.touch-playing .hud-vitals { left: max(12px, env(safe-area-inset-left)); bottom: max(10px, env(safe-area-inset-bottom)); width: 150px; gap: 4px; }
  body.touch-playing #hudHp { font-size: 28px; }
  body.touch-playing .hud-weapon { right: auto; left: 50%; bottom: auto; top: 64px; transform: translateX(-50%); justify-items: center; gap: 4px; }
  body.touch-playing #hudAmmo { font-size: 26px; }
  body.touch-playing .hud-slots { display: none; }
  `;
}
