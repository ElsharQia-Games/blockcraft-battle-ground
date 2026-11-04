/* Blockcraft Battle Ground — lobby layer for Home and Pause.
   89-lobby.js (after 88-menu.js, whose markup and screens it styles)
   - One visual system for every menu page: glass panels, clear hierarchy and
     a single primary action per screen, sized for desktop and landscape phones.
   - One-tap mode chips on Home (solo or room host).
   - Players & teams panel on Home and Pause: everyone can switch their own
     side in team modes and the host can move anyone. Requests go through
     BC.api.net.requestTeam; the room authority decides and broadcasts. */
'use strict';
(function () {
  BC.style('bc-lobby-v3', LOBBY_CSS());

  /* ---------------- mode chips ---------------- */
  var modeHost = null;
  function renderModes() {
    var modes = BC.api && BC.api.modes;
    if (!modes || !modes.MODES) return;
    if (!modeHost) {
      var launch = document.querySelector('.bc-home-launch');
      if (!launch) return;
      modeHost = document.createElement('div');
      modeHost.id = 'homeModes';
      modeHost.className = 'bc-mode-chips';
      modeHost.setAttribute('role', 'group');
      modeHost.setAttribute('aria-label', 'Match mode');
      launch.insertBefore(modeHost, launch.firstChild);
    }
    var allowed = typeof modes.canConfigure === 'function' ? modes.canConfigure() : true;
    var key = modes.active + '|' + allowed;
    if (modeHost.dataset.key === key) return;
    modeHost.dataset.key = key;
    modeHost.textContent = '';
    modes.MODES.forEach(function (def) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bc-mode-chip' + (def.id === modes.active ? ' is-active' : '') + (def.teams ? ' is-team' : '');
      b.textContent = def.name;
      b.title = def.desc + (allowed ? '' : ' (only the room host can change the mode)');
      b.setAttribute('aria-pressed', String(def.id === modes.active));
      b.disabled = !allowed && def.id !== modes.active;
      b.addEventListener('click', function () {
        if (def.id === modes.active || !modes.canConfigure()) return;
        modes.setActive(def.id);
        toast(def.name + ': ' + def.desc);
        modeHost.dataset.key = '';
        setTimeout(renderModes, 50);
      });
      modeHost.appendChild(b);
    });
  }

  var hosts = [];

  function api() { return BC.api && BC.api.net; }
  function teamsActive() {
    var modes = BC.api && BC.api.modes;
    return !!(modes && modes.activeDef && modes.activeDef.teams);
  }

  function roster() {
    var list = [];
    if (typeof net === 'undefined' || !net || !net.online || !net.id) return list;
    var connection = api();
    var seen = new Set();
    function add(id, name, character, kills, deaths) {
      if (!id || seen.has(id)) return;
      seen.add(id);
      list.push({ id: id, name: safeName(name || 'Player'), self: id === net.id, host: id === net.hostId,
        team: connection ? connection.teamFor(id) : null, kills: kills || 0, deaths: deaths || 0, character: character });
    }
    add(net.id, typeof playerName === 'string' ? playerName : 'You', typeof charKey === 'string' ? charKey : '', kills, deaths);
    net.players.forEach(function (r, id) { add(id, r.name, r.character, r.kills, r.deaths); });
    return list;
  }

  function button(label, cls, onClick, title) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bc-button bc-team-move ' + (cls || '');
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(); });
    return b;
  }

  function render(host) {
    var players = roster();
    host.hidden = players.length === 0;
    host.inert = players.length === 0;
    if (!players.length) { host.textContent = ''; return; }
    var connection = api();
    var amHost = !!(connection && connection.isHost);
    var teams = teamsActive();
    var key = JSON.stringify([teams, amHost, players.map(function (p) { return [p.id, p.name, p.team, p.host]; })]);
    if (host.dataset.key === key) return;
    host.dataset.key = key;
    host.textContent = '';

    var head = document.createElement('div');
    head.className = 'bc-teams-head';
    head.innerHTML = '<h3>Players <span>' + players.length + '</span></h3>' +
      (teams ? '<p>' + (amHost ? 'You are the host: move anyone.' : 'Pick your side.') + '</p>' : '<p>Every player for themselves.</p>');
    host.appendChild(head);

    var columns = teams ? ['red', 'blue'] : [null];
    var grid = document.createElement('div');
    grid.className = 'bc-teams-grid' + (teams ? '' : ' bc-teams-solo');
    columns.forEach(function (team) {
      var col = document.createElement('section');
      col.className = 'bc-team-col' + (team ? ' bc-team-' + team : '');
      if (team) {
        var title = document.createElement('h4');
        title.textContent = team === 'red' ? 'Red team' : 'Blue team';
        col.appendChild(title);
      }
      var members = players.filter(function (p) { return !teams || p.team === team; });
      if (!members.length) {
        var empty = document.createElement('p');
        empty.className = 'bc-team-empty';
        empty.textContent = 'Nobody yet';
        col.appendChild(empty);
      }
      members.forEach(function (p) {
        var row = document.createElement('div');
        row.className = 'bc-team-row' + (p.self ? ' is-self' : '');
        var name = document.createElement('span');
        name.className = 'bc-team-name';
        name.textContent = p.name + (p.self ? ' (you)' : '');
        if (p.host) {
          var crown = document.createElement('em');
          crown.textContent = 'HOST';
          name.appendChild(crown);
        }
        row.appendChild(name);
        if (teams && team && (p.self || amHost)) {
          var other = team === 'red' ? 'blue' : 'red';
          row.appendChild(button(p.self ? 'Switch to ' + other : 'Move to ' + other, 'bc-to-' + other, function () {
            if (connection) connection.requestTeam(p.self ? null : p.id, other);
          }, p.self ? 'Join the ' + other + ' team' : 'Move ' + p.name + ' to the ' + other + ' team'));
        }
        col.appendChild(row);
      });
      grid.appendChild(col);
    });
    host.appendChild(grid);
  }

  function refresh() {
    for (var i = 0; i < hosts.length; i++) render(hosts[i]);
    renderModes();
  }

  function mount(id, parentSelector, before) {
    var parent = document.querySelector(parentSelector);
    if (!parent || document.getElementById(id)) return;
    var host = document.createElement('div');
    host.id = id;
    host.className = 'bc-teams-panel';
    host.hidden = true;
    if (before && parent.querySelector(before)) parent.insertBefore(host, parent.querySelector(before));
    else parent.appendChild(host);
    hosts.push(host);
  }

  mount('homeTeams', '.bc-home-match', '.bc-home-map');
  mount('pauseTeams', '.bc-pause-shell', '#pauseInputHint');

  BC.on('netPacket', function () { Promise.resolve().then(refresh); }, 95);
  BC.on('teamChanged', refresh, 95);
  BC.on('modeChanged', refresh, 95);
  setInterval(refresh, 1000);
  refresh();


  /* ---------------- graphics quality toggle (Pause) ---------------- */
  (function () {
    var actions = document.querySelector('.bc-pause-actions');
    var graphics = BC.api.graphics;
    if (!actions || !graphics) return;
    var b = document.createElement('button');
    b.id = 'pauseGraphics';
    b.type = 'button';
    b.className = 'bc-button bc-button-quiet';
    function label() { b.textContent = 'Graphics: ' + (graphics.quality === 'high' ? 'High' : 'Fast'); }
    b.addEventListener('click', function () {
      graphics.setQuality(graphics.quality === 'high' ? 'low' : 'high');
      label();
    });
    label();
    actions.insertBefore(b, document.getElementById('pauseHome'));
  })();

  BC.api.lobby = { refresh: refresh, roster: roster };
})();

/* ---------------- visual system ---------------- */
function LOBBY_CSS() {
  return `
  :root {
    --lb-glass: rgba(9, 13, 22, .74); --lb-glass-2: rgba(18, 24, 38, .84);
    --lb-line: rgba(255, 255, 255, .12); --lb-line-2: rgba(255, 255, 255, .22);
    --lb-ink: #f4f7fb; --lb-mute: rgba(226, 233, 244, .66);
    --lb-red: #ff3b4a; --lb-blue: #3a8dff; --lb-gold: #ffc247; --lb-radius: 16px;
    --lb-shadow: 0 18px 60px rgba(0, 0, 0, .45), 0 2px 0 rgba(255, 255, 255, .04) inset;
  }
  .bc-menu { color: var(--lb-ink); }
  /* Readable over any terrain: darken the left (text) side and the edges. */
  #hint { background: linear-gradient(90deg, rgba(6, 9, 16, .82) 0%, rgba(6, 9, 16, .45) 52%, rgba(6, 9, 16, .62) 100%) !important; }
  #hint .bc-home-hero { overflow-wrap: anywhere; }

  /* Home: hero + one obvious Play action on the left, social on the right. */
  #hint .bc-home-shell { box-sizing: border-box; min-height: 100%; display: grid; grid-template-rows: auto 1fr auto;
    gap: clamp(8px, 2vh, 20px); padding: clamp(12px, 3vh, 32px) clamp(16px, 4vw, 56px); }
  #hint .bc-home-main { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(300px, 430px);
    gap: clamp(16px, 3vw, 48px); align-items: center; min-height: 0; }
  #hint .bc-home-hero { display: flex; flex-direction: column; gap: clamp(10px, 2vh, 18px); min-width: 0; }
  #hint .bc-wordmark { margin: 0; line-height: .9; }
  #hint .bc-wordmark .brand { font-size: clamp(36px, 5.4vw, 84px); letter-spacing: -.02em;
    text-shadow: 0 6px 0 rgba(0, 0, 0, .35), 0 18px 40px rgba(0, 0, 0, .45); }
  #hint .bc-home-copy { margin: 0; max-width: 34ch; color: var(--lb-mute); font-size: clamp(13px, 1.4vw, 16px); }
  #hint .bc-home-launch { display: grid; gap: 10px; max-width: 540px; }
  #hint #play { min-height: clamp(52px, 9vh, 72px); border-radius: 14px; font-size: clamp(18px, 2.4vw, 26px);
    letter-spacing: .08em; background: linear-gradient(180deg, #ff4a58, #c91d34); border: 0;
    box-shadow: 0 10px 30px rgba(206, 32, 56, .45), 0 -3px 0 rgba(0, 0, 0, .25) inset; transition: transform .12s, filter .12s; }
  #hint #play:not(:disabled):hover { filter: brightness(1.08); transform: translateY(-1px); }
  #hint #play:not(:disabled):active { transform: translateY(1px) scale(.99); }
  #hint #play:disabled { filter: grayscale(.6) brightness(.8); }
  #hint #homeLoadHint { margin: 0; color: var(--lb-mute); font-size: 12px; }
  #hint .bc-home-profile { align-self: start; border-radius: 12px; background: var(--lb-glass); border: 1px solid var(--lb-line);
    padding: 8px 12px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
  #hint .bc-home-match { box-sizing: border-box; max-height: calc(100vh - 140px); overflow: auto; overscroll-behavior: contain;
    background: var(--lb-glass); border: 1px solid var(--lb-line); border-radius: var(--lb-radius); box-shadow: var(--lb-shadow);
    backdrop-filter: blur(14px) saturate(1.2); -webkit-backdrop-filter: blur(14px) saturate(1.2);
    padding: clamp(14px, 2vh, 20px); display: grid; gap: 14px; }
  #hint .bc-home-match > * { margin: 0; }
  #hint .bc-home-foot { color: var(--lb-mute); }

  /* Mode chips */
  .bc-mode-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .bc-mode-chip { appearance: none; border: 1px solid var(--lb-line-2); background: rgba(10, 14, 24, .6); color: var(--lb-ink);
    border-radius: 999px; padding: 6px 12px; font-family: inherit; font-size: 12px; font-weight: 600; line-height: 1.2;
    cursor: pointer; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transition: background .12s, border-color .12s; }
  .bc-mode-chip:hover:not(:disabled) { border-color: rgba(255, 255, 255, .55); }
  .bc-mode-chip.is-team::before { content: ''; display: inline-block; width: 10px; height: 6px; margin-right: 6px; vertical-align: 1px;
    border-radius: 2px; background: linear-gradient(90deg, var(--lb-red) 50%, var(--lb-blue) 50%); }
  .bc-mode-chip.is-active { background: var(--lb-ink); color: #0b0f18; border-color: var(--lb-ink); }
  .bc-mode-chip:disabled { opacity: .45; cursor: not-allowed; }

  /* Players & teams */
  .bc-teams-panel { display: grid; gap: 10px; }
  .bc-teams-panel[hidden] { display: none; }
  .bc-teams-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .bc-teams-head h3 { margin: 0; font-size: 15px; }
  .bc-teams-head h3 span { margin-left: 4px; padding: 1px 7px; border-radius: 999px; background: rgba(255, 255, 255, .12); font-size: 12px; }
  .bc-teams-head p { margin: 0; color: var(--lb-mute); font-size: 12px; }
  .bc-teams-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .bc-teams-grid.bc-teams-solo { grid-template-columns: 1fr; }
  .bc-team-col { border-radius: 12px; padding: 8px; background: rgba(255, 255, 255, .04); border: 1px solid var(--lb-line);
    display: grid; gap: 6px; align-content: start; }
  .bc-team-col h4 { margin: 0 0 2px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
  .bc-team-red { border-top: 3px solid var(--lb-red); }
  .bc-team-red h4 { color: var(--lb-red); }
  .bc-team-blue { border-top: 3px solid var(--lb-blue); }
  .bc-team-blue h4 { color: var(--lb-blue); }
  .bc-team-row { display: grid; gap: 4px; padding: 6px 8px; border-radius: 8px; background: rgba(0, 0, 0, .22); }
  .bc-team-row.is-self { outline: 1px solid rgba(255, 255, 255, .35); }
  .bc-team-name { font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
  .bc-team-name em { margin-left: 6px; font-style: normal; font-size: 9px; letter-spacing: .1em; color: #0b0f18;
    background: var(--lb-gold); border-radius: 4px; padding: 1px 4px; vertical-align: 1px; }
  .bc-team-empty { margin: 0; color: var(--lb-mute); font-size: 12px; }
  .bc-team-move { min-height: 28px !important; padding: 3px 8px !important; font-size: 11px !important; border-radius: 7px !important; }
  .bc-team-move.bc-to-red { border-color: var(--lb-red) !important; }
  .bc-team-move.bc-to-blue { border-color: var(--lb-blue) !important; }

  /* Pages and Pause share the same glass card. */
  .bc-page-shell, .bc-pause-shell { background: var(--lb-glass-2) !important; border: 1px solid var(--lb-line) !important;
    border-radius: var(--lb-radius) !important; box-shadow: var(--lb-shadow) !important;
    backdrop-filter: blur(16px) saturate(1.15); -webkit-backdrop-filter: blur(16px) saturate(1.15); }
  .bc-pause-shell { display: grid; gap: 12px; max-height: calc(100vh - 32px); overflow: auto; }
  .bc-menu .bc-button { border-radius: 10px; }

  /* Short landscape screens (phones): two columns, Play always visible. */
  @media (max-height: 520px) {
    #hint .bc-home-shell { grid-template-rows: auto 1fr; gap: 8px;
      padding: 10px max(14px, env(safe-area-inset-right)) 10px max(14px, env(safe-area-inset-left)); }
    #hint .bc-home-main { grid-template-columns: minmax(0, 1fr) minmax(260px, 46%); gap: 14px; align-items: start; }
    #hint .bc-wordmark .brand { font-size: clamp(30px, 6.5vw, 54px); }
    #hint .bc-wordmark .word { font-size: 14px; }
    #hint .bc-home-copy, #hint #homeLoadHint, #hint .bc-home-foot, #hint .bc-home-id .bc-publisher { display: none; }
    #hint .bc-home-hero { gap: 8px; }
    #hint #play { min-height: 48px; font-size: 18px; }
    #hint .bc-home-match { max-height: calc(100vh - 64px); padding: 12px; gap: 10px; }
    .bc-mode-chip { padding: 5px 10px; font-size: 11px; }
  }
  /* Narrow portrait windows: one column. */
  @media (max-width: 720px) and (min-height: 521px) {
    #hint .bc-home-main { grid-template-columns: 1fr; align-items: start; }
    #hint .bc-home-match { max-height: none; }
  }
  body.touch-ui .bc-home-foot { display: none; }
  `;
}
