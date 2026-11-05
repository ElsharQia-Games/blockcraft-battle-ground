/* Blockcraft Battle Ground — Hold-Tab match scoreboard.
   85-scoreboard.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';

const SCOREBOARD_REFRESH_MS = 250;
// Keep initialization inert: net and loading are declared by later scripts.
const scoreboard = {
  visible: false, lastUpdate: -Infinity, count: 0,
  el: null, rowsEl: null, roomEl: null, countEl: null,
  roomText: '', countText: '', rows: new Map()
};

function scoreboardBindDom() {
  if (!scoreboard.el) {
    scoreboard.el = document.getElementById('scoreboard');
    if (scoreboard.el) scoreboard.el.style.pointerEvents = 'none';
  }
  if (!scoreboard.rowsEl) scoreboard.rowsEl = document.getElementById('scoreboardRows');
  if (!scoreboard.roomEl) scoreboard.roomEl = document.getElementById('scoreboardRoom');
  if (!scoreboard.countEl) scoreboard.countEl = document.getElementById('scoreboardCount');
  return !!(scoreboard.el && scoreboard.rowsEl);
}

function scoreboardText(value, fallback) {
  return typeof value === 'string' ? value.trim().slice(0, 48) || fallback : fallback;
}

function scoreboardLabel(definitions, id) {
  const entry = typeof id === 'string' && Object.prototype.hasOwnProperty.call(definitions, id)
    ? definitions[id] : null;
  return scoreboardText(entry && entry.name, 'Unknown');
}

function scoreboardCounter(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : 0;
}

function scoreboardHealth(value) {
  return Number.isFinite(value) ? Math.ceil(Math.max(0, Math.min(MAX_HEALTH, value))) : 0;
}

function scoreboardCompareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function scoreboardPlayers(now) {
  const localId = typeof net.id === 'string' ? net.id : '';
  const weapon = currentWeapon();
  const localHp = scoreboardHealth(health);
  const players = [{
    key: 'local', id: localId, local: true,
    name: scoreboardText(playerName, 'Player'),
    character: scoreboardLabel(CHARACTERS, charKey),
    weapon: scoreboardText(weapon && weapon.name, 'Unknown'),
    kills: scoreboardCounter(kills), deaths: scoreboardCounter(deaths),
    hp: alive ? localHp : 0, dead: !alive || localHp === 0
  }];
  const seen = new Set([localId]);
  for (const [mapId, r] of net.players) {
    if (!r || typeof r !== 'object') continue;
    const id = typeof r.id === 'string' ? r.id : mapId;
    if (typeof id !== 'string' || !id || mapId === localId || seen.has(id)) continue;
    seen.add(id);
    const hp = scoreboardHealth(r.hp);
    const dead = hp === 0 || (Number.isFinite(r.deadUntil) && r.deadUntil > now);
    players.push({
      key: 'remote:' + id, id, local: false,
      name: scoreboardText(r.name, 'Player'),
      character: scoreboardLabel(CHARACTERS, r.character),
      weapon: scoreboardLabel(WEAPON_BY_ID, r.weapon),
      kills: scoreboardCounter(r.kills), deaths: scoreboardCounter(r.deaths),
      hp: dead ? 0 : hp, dead
    });
  }
  players.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths ||
    scoreboardCompareText(a.name.toLowerCase(), b.name.toLowerCase()) || scoreboardCompareText(a.id, b.id));
  return players;
}

function scoreboardRoomText() {
  if (net.mode === 'mqtt') {
    return 'ROOM ' + scoreboardText(net.room, '-') + ' · MQTT' + (net.online ? '' : ' · CONNECTING');
  }
  if (net.mode === 'ws') return 'LAN' + (net.online ? '' : ' · CONNECTING');
  return 'SOLO';
}

function scoreboardRefresh(now) {
  const players = scoreboardPlayers(now);
  const present = new Set(players.map((p) => p.key));
  // Bound the cache to this roster, including after a room switch or reconnect.
  for (const [key, entry] of scoreboard.rows) {
    if (!present.has(key)) {
      entry.el.remove();
      scoreboard.rows.delete(key);
    }
  }

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    let entry = scoreboard.rows.get(p.key);
    if (!entry) {
      const el = document.createElement('tr');
      const cells = [];
      for (let c = 0; c < 6; c++) {
        const cell = document.createElement('td');
        el.appendChild(cell);
        cells.push(cell);
      }
      entry = { el, cells, values: [], className: null, id: null };
      scoreboard.rows.set(p.key, entry);
    }
    const values = [
      (i + 1) + '. ' + p.name + (p.local ? ' (YOU)' : ''),
      p.character, p.weapon, String(p.kills), String(p.deaths), String(p.hp)
    ];
    for (let c = 0; c < values.length; c++) {
      if (entry.values[c] !== values[c]) {
        // Peer names are text, never HTML or selectors.
        entry.cells[c].textContent = values[c];
        entry.values[c] = values[c];
      }
    }
    const className = (p.local ? 'is-local' : '') + (p.dead ? ' is-dead' : '');
    if (entry.className !== className) {
      entry.el.className = className.trim();
      entry.className = className;
    }
    if (entry.id !== p.id) {
      entry.el.dataset.playerId = p.id;
      entry.id = p.id;
    }
    // Move only out-of-order rows; a steady roster causes no DOM writes.
    const at = scoreboard.rowsEl.children[i] || null;
    if (at !== entry.el) scoreboard.rowsEl.insertBefore(entry.el, at);
  }

  const roomText = scoreboardRoomText();
  const countText = players.length + ' PLAYER' + (players.length === 1 ? '' : 'S');
  if (scoreboard.roomEl && scoreboard.roomText !== roomText) {
    scoreboard.roomEl.textContent = roomText;
    scoreboard.roomText = roomText;
  }
  if (scoreboard.countEl && scoreboard.countText !== countText) {
    scoreboard.countEl.textContent = countText;
    scoreboard.countText = countText;
  }
  scoreboard.count = players.length;
  scoreboard.lastUpdate = now;
}

// 80-input owns Tab and all input-reset events. Showing never changes game input.
function setScoreboardVisible(on) {
  const show = !!on && isGameplayInputActive() && scoreboardBindDom();
  if (show === scoreboard.visible) return scoreboard.visible;
  scoreboard.visible = show;
  if (show) scoreboardRefresh(performance.now());
  if (scoreboard.el) {
    scoreboard.el.classList.toggle('show', show);
    scoreboard.el.setAttribute('aria-hidden', String(!show));
  }
  document.body.classList.toggle('scoreboard-open', show);
  return show;
}

// 99-boot calls this each frame; now is the requestAnimationFrame time in ms.
function updateScoreboard(dt, now) {
  if (!scoreboard.visible) return;
  if (!isGameplayInputActive()) { setScoreboardVisible(false); return; }
  const time = Number.isFinite(now) ? now : performance.now();
  if (time >= scoreboard.lastUpdate && time - scoreboard.lastUpdate < SCOREBOARD_REFRESH_MS) return;
  scoreboardRefresh(time);
}
