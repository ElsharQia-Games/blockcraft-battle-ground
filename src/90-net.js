/* Blockcraft Battle Ground — LAN WebSocket + internet MQTT transport, rooms and remote players.
   90-net.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ============================================================
   Multiplayer: LAN WebSocket server + internet MQTT relay
   ============================================================ */
const MQTT_RELAYS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];

const net = {
  mode: null,            // null | 'ws' | 'mqtt'
  ws: null, id: null, online: false, players: new Map(),
  attempts: 0, lastSent: 0, warned: false, closedByUs: false,
  room: ''
};

const mqtt = {
  ws: null, clientId: null, room: '', relay: 0,
  connected: false, subscribed: false, closedByUs: false,
  lastRx: 0, keep: null, tick: null, openTimer: null, reconnectTimer: null,
  fails: 0, peerSeen: new Map()
};

function netUrl() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  }
  return 'ws://localhost:8080';
}

function normalizeRoom(v) {
  return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}
function randomRoom() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function netSend(msg) {
  if (!msg) return;
  if (msg.t === 'voxelHit') {
    msg = netVoxelHitMessage(msg, net.id);
    if (!msg) return;
  }
  if (net.mode === 'mqtt') {
    if (!mqtt.ws || mqtt.ws.readyState !== 1 || !mqtt.connected) return;
    if (msg.t === 'edit') {
      const x = msg.x | 0, y = msg.y | 0, z = msg.z | 0, b = msg.b & 255;
      mqttPublish('blockcraft/' + net.room + '/e/' + x + '_' + y + '_' + z,
        JSON.stringify({ t: 'edit', x, y, z, b, by: net.id }), true);
    } else {
      mqttPublish('blockcraft/' + net.room + '/msg/' + net.id, JSON.stringify(msg), false);
    }
    return;
  }
  if (!net.ws || net.ws.readyState !== 1) return;
  try { net.ws.send(JSON.stringify(msg)); } catch (e) { /* ignore */ }
}

function netPlayerCount() { return net.players.size + (net.online ? 1 : 0); }

/* ---------------- room badge / clipboard ---------------- */
function updateRoomBadge() {
  const el = document.getElementById('roomBadge');
  if (!el) return;
  if (net.mode !== 'mqtt' || !net.room) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  while (el.firstChild) el.removeChild(el.firstChild);
  const dot = document.createElement('span');
  dot.className = 'dot';
  const label = document.createTextNode('ROOM ');
  const b = document.createElement('b');
  b.textContent = net.room;
  const count = netPlayerCount();
  const rest = document.createTextNode(
    ' · ' + (net.online ? count + ' PLAYER' + (count === 1 ? '' : 'S') : 'CONNECTING') + ' · COPY'
  );
  el.append(dot, label, b, rest);
  el.title = 'Click to copy the room code';
}

function copyRoom() {
  const code = net.room || (document.getElementById('roomInput') || {}).value || '';
  if (!code) return;
  const done = () => toast('Room code copied — send it to a friend');
  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    } catch (e) { toast('Room code: ' + code); }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, fallback);
    } else fallback();
  } catch (e) { fallback(); }
}

/* ---------------- shared world edits & remote avatars ---------------- */
const netDirtyChunks = new Set();
let netEditFlushHandle = null;
let netEditFlushIsFrame = false;

function flushNetEdits() {
  if (netEditFlushHandle !== null) {
    if (netEditFlushIsFrame) cancelAnimationFrame(netEditFlushHandle);
    else clearTimeout(netEditFlushHandle);
    netEditFlushHandle = null;
  }
  if (!netDirtyChunks.size) return;
  // Voxel writes already happened. Deduplicate expensive terrain remeshes,
  // including the adjacent chunk whose boundary face changed.
  for (const key of netDirtyChunks) {
    const [cx, cz] = key.split(',').map(Number);
    rebuildChunk(cx, cz);
  }
  netDirtyChunks.clear();
}

function netQueueDirty(x, z) {
  // Corner edits also affect the diagonal chunk's vertex ambient occlusion.
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const cx = Math.floor((x + dx) / CHUNK), cz = Math.floor((z + dz) / CHUNK);
    if (cx >= 0 && cz >= 0 && cx < CHUNKS && cz < CHUNKS) netDirtyChunks.add(cx + ',' + cz);
  }
  if (netEditFlushHandle !== null) return;
  // Also drain before the main loop starts, or while a menu pauses movement.
  netEditFlushIsFrame = typeof requestAnimationFrame === 'function';
  const run = () => { netEditFlushHandle = null; flushNetEdits(); };
  netEditFlushHandle = netEditFlushIsFrame ? requestAnimationFrame(run) : setTimeout(run, 16);
}

function applyNetEdit(m) {
  if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y) || !Number.isFinite(m.z) || !Number.isFinite(m.b)) return;
  const x = m.x | 0, y = m.y | 0, z = m.z | 0, b = m.b | 0;
  if (x < 0 || z < 0 || x >= WORLD || z >= WORLD || y < 0 || y >= HEIGHT || b < 0 || b > 255) return;
  if (getBlock(x, y, z) === b) return;
  setBlock(x, y, z, b);
  netQueueDirty(x, z);
}

function netPoseFlag(value, fallback) {
  return value === true || value === 1 ? 1 : value === false || value === 0 ? 0 : fallback;
}

function netPoseNumber(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function netPoseYaw(value, fallback) {
  return Number.isFinite(value) ? Math.atan2(Math.sin(value), Math.cos(value)) : fallback;
}

function netPoseWeapon(value, fallback) {
  return typeof value === 'string' && WEAPON_BY_ID[value] ? value : fallback || WEAPONS[0].id;
}

function netPoseReload(value) {
  return Number.isFinite(value) && value >= 0 ? Math.min(1, value) : -1;
}

function netVoxelHitMessage(m, sender) {
  if (!m || !Number.isInteger(m.x) || !Number.isInteger(m.y) || !Number.isInteger(m.z) ||
      m.x < 0 || m.z < 0 || m.x >= WORLD || m.z >= WORLD || m.y < 1 || m.y >= HEIGHT ||
      !Number.isInteger(m.block) || m.block < 1 || m.block > 22 || m.block === WATER ||
      typeof m.weapon !== 'string' || !WEAPON_BY_ID[m.weapon] ||
      !Number.isFinite(m.amount) || m.amount <= 0 ||
      typeof m.hitId !== 'string' || !/^[\w.:-]{1,96}$/.test(m.hitId)) return null;
  const by = sender || m.by;
  if (typeof by !== 'string' || !/^[\w-]{1,40}$/.test(by)) return null;
  return {
    t: 'voxelHit', x: m.x, y: m.y, z: m.z, block: m.block, weapon: m.weapon,
    amount: Math.max(1, Math.floor(Math.min(WEAPON_BY_ID[m.weapon].damage, m.amount))), hitId: m.hitId, by
  };
}

function netRemoteReloadProgress(r, now) {
  if (!r.combat || r.hp <= 0 || r.reload < 0) return -1;
  const elapsed = Math.max(0, now - r.reloadAt) / 1000;
  const p = r.reload + elapsed / r.reloadTotal;
  if (p >= 1) { r.reload = -1; return -1; }
  return Math.max(0, p);
}

function netSetRemoteWeapon(r, id) {
  if (r.weapon === id) return;
  r.weapon = id;
  r.reload = -1;
  r.kick = r.firePose = 0;
  r.gun = attachAvatarGun(r.group, id);
}

function netApplyRemotePose(r, p) {
  const w = WEAPON_BY_ID[r.weapon];
  const oldHp = r.hp;
  r.hp = netPoseNumber(p.hp, r.hp, 0, MAX_HEALTH);
  if (oldHp <= 0 && r.hp > 0) r.deathNoted = false;
  // State scores are absolute, never added to event-side increments. In MQTT a
  // killer's state can beat another peer's died event; the next snapshot also
  // corrects that ordering instead of permanently keeping an extra kill.
  r.kills = Math.floor(netPoseNumber(p.kills, r.kills, 0, 999999));
  r.deaths = Math.floor(netPoseNumber(p.deaths, r.deaths, 0, 999999));
  const fallbackCombat = p.build === undefined ? r.combat : 1 - netPoseFlag(p.build, 1 - r.combat);
  r.combat = netPoseFlag(p.combat, fallbackCombat);
  if (netPoseFlag(p.build, 0)) r.combat = 0;
  r.build = 1 - r.combat;
  if (p.reload !== undefined) {
    r.reload = netPoseReload(p.reload);
    r.reloadAt = performance.now();
    r.reloadTotal = netPoseNumber(p.reloadTotal, w.reload, 0.25, w.reload);
    r.reloadRounds = Math.round(netPoseNumber(p.reloadRounds, w.mag, 1, w.mag));
  }
  if (!r.combat || r.hp <= 0) { r.reload = -1; r.firePose = r.kick = 0; }
  const ready = r.combat && r.hp > 0 && netRemoteReloadProgress(r, performance.now()) < 0;
  r.aim = ready ? netPoseFlag(p.aim, r.aim) : 0;
  r.firing = ready ? netPoseFlag(p.firing, r.firing) : 0;
  r.crouch = netPoseFlag(p.crouch, r.crouch);
  r.slide = netPoseFlag(p.slide, r.slide);
}

function netRemotePoseState(r, now) {
  return {
    pitch: r.pitch, aim: r.aim, firing: r.firing || r.firePose > 0,
    reload: netRemoteReloadProgress(r, now), reloadRounds: r.reloadRounds,
    weapon: r.weapon, combat: r.combat, alive: r.hp > 0 && !(r.deadUntil > now),
    kick: r.kick, crouch: r.crouch, slide: r.slide
  };
}

function removeRemote(id) {
  const r = net.players.get(id);
  if (!r) return;
  scene.remove(r.group);
  net.players.delete(id);
  mqtt.peerSeen.delete(id);
  updateRoomBadge();
}

function addRemote(p) {
  if (!p || typeof p.id !== 'string' || !/^[\w-]{1,40}$/.test(p.id) || p.id === net.id) return;
  const existing = net.players.get(p.id);
  const incomingChar = typeof p.character === 'string' && Object.prototype.hasOwnProperty.call(CHARACTERS, p.character)
    ? p.character : existing ? existing.character : 'steve';
  const incomingName = typeof p.name === 'string' ? safeName(p.name) : existing ? existing.name : 'Player';
  if (existing && (existing.character !== incomingChar || existing.name !== incomingName)) {
    const seen = mqtt.peerSeen.get(p.id);
    removeRemote(p.id);
    if (seen) mqtt.peerSeen.set(p.id, seen);
  }
  let r = net.players.get(p.id);
  let added = false;
  if (!r) {
    const group = makeHumanoid(incomingChar, incomingName);
    const x = Number.isFinite(p.x) ? p.x : WORLD / 2;
    const y = Number.isFinite(p.y) ? p.y : 40;
    const z = Number.isFinite(p.z) ? p.z : WORLD / 2;
    group.position.set(x, y, z);
    scene.add(group);
    r = {
      id: p.id, name: incomingName, character: incomingChar,
      group, x, y, z, tx: x, ty: y, tz: z,
      yaw: netPoseYaw(p.yaw, 0),
      tyaw: netPoseYaw(p.yaw, 0),
      pitch: 0, tpitch: 0,
      phase: 0, speed: 0, weapon: 'pistol', hp: 100,
      aim: 0, deadUntil: 0, gun: null, combat: 1, build: 0, firing: 0,
      firePose: 0, kick: 0, reload: -1, reloadAt: 0, reloadTotal: WEAPONS[0].reload,
      reloadRounds: WEAPONS[0].mag, crouch: 0, slide: 0, stance: 0, slidePose: 0,
      kills: 0, deaths: 0, deathNoted: false
    };
    net.players.set(p.id, r);
    r.gun = attachAvatarGun(group, r.weapon);
    added = true;
  }
  if (Number.isFinite(p.x)) r.tx = p.x;
  if (Number.isFinite(p.y)) r.ty = p.y;
  if (Number.isFinite(p.z)) r.tz = p.z;
  r.tyaw = netPoseYaw(p.yaw, r.tyaw);
  r.tpitch = netPoseNumber(p.pitch, r.tpitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  netSetRemoteWeapon(r, netPoseWeapon(p.weapon, r.weapon));
  netApplyRemotePose(r, p);
  r.name = incomingName;
  if (added) updateRoomBadge();
}

function handleNet(msg) {
  if (!msg || typeof msg.t !== 'string') return;
  switch (msg.t) {
    case 'welcome':
      net.mode = 'ws';
      net.id = msg.id;
      net.online = true;
      net.attempts = 0;
      for (const id of [...net.players.keys()]) removeRemote(id);
      for (const p of (msg.players || [])) addRemote(p);
      for (const e of (msg.edits || [])) applyNetEdit(e);
      if (!net.warned) toast('Connected — ' + netPlayerCount() + ' player(s) online');
      net.warned = true;
      updateRoomBadge();
      break;
    case 'join':
      addRemote(msg.player || msg);
      if (!net.warned) toast('Connected — ' + netPlayerCount() + ' player(s) online');
      net.warned = true;
      break;
    case 'leave':
      removeRemote(msg.id);
      break;
    case 'state':
      if (msg.id === net.id) break;
      addRemote(msg);
      break;
    case 'edit':
      applyNetEdit(msg);
      break;
    case 'voxelHit': {
      const hit = netVoxelHitMessage(msg, msg.id || msg.by);
      if (hit && hit.by !== net.id && typeof applyVoxelDamage === 'function') applyVoxelDamage(hit);
      break;
    }
    case 'hit':
      if (msg.target === net.id) applyDamage(netPoseNumber(msg.dmg, 1, 1, 120), msg.by, !!netPoseFlag(msg.head, 0), msg.byId);
      break;
    case 'reload': {
      if (msg.id === net.id) break;
      addRemote(msg);
      const r = net.players.get(msg.id);
      if (r) updateAvatarWeaponPose(r.group, netRemotePoseState(r, performance.now()), 0);
      break;
    }
    case 'shot': {
      if (msg.id === net.id) break;
      const r = net.players.get(msg.id);
      if (!r || r.hp <= 0 || r.deadUntil > performance.now()) break;
      if (netPoseFlag(msg.build, r.build) || !netPoseFlag(msg.combat, r.combat)) break;
      netSetRemoteWeapon(r, netPoseWeapon(msg.weapon, r.weapon));
      r.combat = 1;
      r.build = 0;
      r.pitch = r.tpitch = netPoseNumber(msg.pitch, r.tpitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
      r.yaw = r.tyaw = netPoseYaw(msg.yaw, r.tyaw);
      r.group.rotation.y = r.yaw;
      r.aim = netPoseFlag(msg.aim, r.aim);
      r.reload = -1;
      r.firePose = r.kick = 1;
      updateAvatarWeaponPose(r.group, netRemotePoseState(r, performance.now()), 0);
      r.group.updateWorldMatrix(true, true);
      const pos = new THREE.Vector3();
      if (r.group.userData.gun) r.group.userData.gun.userData.muzzle.getWorldPosition(pos);
      else pos.set(r.x, r.y + 1.4, r.z);
      remoteMuzzle(pos);
      const dist = pos.distanceTo(camera.position);
      if (dist < 75) {
        const w = WEAPON_BY_ID[r.weapon];
        playShot(w, Math.max(0.05, 1 - dist / 75) * 0.95);
      }
      break;
    }
    case 'died': {
      if (msg.id === net.id) break; // already handled locally
      const victim = net.players.get(msg.id);
      const firstDeath = !victim || !victim.deathNoted;
      if (victim) {
        const count = Math.floor(netPoseNumber(msg.deaths, victim.deaths + (firstDeath ? 1 : 0), 0, 999999));
        victim.deaths = Math.max(victim.deaths, count);
        victim.kills = Math.max(victim.kills, Math.floor(netPoseNumber(msg.kills, victim.kills, 0, 999999)));
        victim.deathNoted = true;
      }
      if (!firstDeath) break;
      if (msg.byId && msg.byId === net.id) {
        kills = Math.max(kills, Math.floor(netPoseNumber(msg.killerKills, kills + 1, 0, 999999)));
        setKd();
        toast('You eliminated ' + safeName(msg.victim));
        playTone(880, 0.08, 'triangle', 0.08);
      } else if (msg.byId && msg.byId !== msg.id) {
        const killer = net.players.get(msg.byId);
        if (killer) killer.kills = Math.max(killer.kills, Math.floor(netPoseNumber(msg.killerKills, killer.kills + 1, 0, 999999)));
      }
      addKillFeed(msg.by, msg.victim);
      {
        const r = net.players.get(msg.id);
        if (r) {
          r.deadUntil = performance.now() + 3300;
          r.hp = 0;
          r.reload = -1;
          r.firePose = r.kick = r.firing = 0;
          updateAvatarWeaponPose(r.group, netRemotePoseState(r, performance.now()), 0);
          r.group.visible = false;
        }
      }
      break;
    }
    case 'respawn': {
      if (msg.id === net.id) break;
      const r = net.players.get(msg.id);
      if (r) {
        r.deadUntil = 0;
        r.deathNoted = false;
        r.hp = netPoseNumber(msg.hp, MAX_HEALTH, 1, MAX_HEALTH);
        r.reload = -1;
        r.firePose = r.kick = r.firing = r.aim = 0;
        r.group.visible = true;
        if (Number.isFinite(msg.x)) { r.x = r.tx = msg.x; }
        if (Number.isFinite(msg.y)) { r.y = r.ty = msg.y; }
        if (Number.isFinite(msg.z)) { r.z = r.tz = msg.z; }
      }
      addRemote(msg);
      break;
    }
  }
}

/* ---------------- LAN websocket ---------------- */
/* Our bundled server speaks ws:// only, so a page served over https (GitHub Pages,
   a CDN, ...) has nothing to connect to unless ?server=wss://... is given. */
function lanPossible() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return true;
  return location.protocol !== 'https:';
}

function connectNet() {
  if (net.mode === 'mqtt' || net.closedByUs) return;
  if (!lanPossible()) return;
  if (net.ws && (net.ws.readyState === 0 || net.ws.readyState === 1)) return;
  let ws;
  try { ws = new WebSocket(netUrl()); } catch (e) { return; }
  net.ws = ws;
  net.mode = 'ws';

  ws.onopen = () => {
    net.attempts = 0;
    netSend(combatNetState('join'));
  };
  ws.onmessage = (ev) => {
    try { handleNet(JSON.parse(ev.data)); } catch (e) { /* ignore bad frames */ }
  };
  ws.onerror = () => { /* onclose handles it */ };
  ws.onclose = () => {
    const wasOnline = net.online;
    net.online = false;
    net.id = null;
    net.ws = null;
    net.mode = null;
    for (const id of [...net.players.keys()]) removeRemote(id);
    if (wasOnline) toast('LAN multiplayer disconnected — playing solo');
    if (!net.closedByUs && net.attempts < 3) {
      net.attempts++;
      setTimeout(connectNet, 4000);
    }
  };
}

/* ---------------- MQTT 3.1.1 over WebSocket ---------------- */
function mqttVarint(n) {
  const out = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n > 0) b |= 0x80;
    out.push(b);
  } while (n > 0);
  return out;
}
function mqttStr(s) {
  const b = new TextEncoder().encode(s);
  return [b.length >> 8, b.length & 255, ...b];
}
function mqttPacket(type, body) {
  return new Uint8Array([type, ...mqttVarint(body.length), ...body]);
}
function mqttPublish(topic, payload, retain) {
  if (!mqtt.ws || mqtt.ws.readyState !== 1 || !mqtt.connected) return false;
  const body = [...mqttStr(topic), ...new TextEncoder().encode(payload)];
  try {
    mqtt.ws.send(mqttPacket(retain ? 0x31 : 0x30, body));
    return true;
  } catch (e) { return false; }
}

function mqttClearTimers() {
  if (mqtt.openTimer) { clearTimeout(mqtt.openTimer); mqtt.openTimer = null; }
  if (mqtt.keep) { clearInterval(mqtt.keep); mqtt.keep = null; }
  if (mqtt.reconnectTimer) { clearTimeout(mqtt.reconnectTimer); mqtt.reconnectTimer = null; }
  if (mqtt.tick) { clearInterval(mqtt.tick); mqtt.tick = null; }
}
function mqttDropSocket() {
  const ws = mqtt.ws;
  mqtt.ws = null;
  mqtt.connected = false;
  mqtt.subscribed = false;
  if (ws) {
    try {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      ws.close();
    } catch (e) { /* ignore */ }
  }
}

function mqttScheduleReconnect() {
  if (mqtt.closedByUs || net.mode !== 'mqtt') return;
  if (mqtt.reconnectTimer) return;
  net.online = false;
  updateRoomBadge();
  const delay = Math.min(9000, 700 * Math.pow(1.7, Math.min(5, mqtt.fails)));
  mqtt.fails++;
  mqtt.reconnectTimer = setTimeout(() => {
    mqtt.reconnectTimer = null;
    mqttOpen(mqtt.relay + 1);
  }, delay);
}

function mqttOpen(relay) {
  mqttClearTimers();
  mqttDropSocket();
  if (!mqtt.room || !mqtt.clientId || mqtt.closedByUs) return;

  relay = relay || 0;
  const url = MQTT_RELAYS[relay % MQTT_RELAYS.length];
  mqtt.relay = relay;
  let ws;
  try { ws = new WebSocket(url, ['mqtt']); } catch (e) { mqttScheduleReconnect(); return; }
  mqtt.ws = ws;
  ws.binaryType = 'arraybuffer';
  mqtt.connected = false;
  mqtt.subscribed = false;
  mqtt.lastRx = Date.now();

  mqtt.openTimer = setTimeout(() => {
    if (!mqtt.connected && mqtt.ws === ws) {
      try { ws.close(); } catch (e) { /* ignore */ }
      mqttScheduleReconnect();
    }
  }, 10000);

  ws.onopen = () => {
    const willTopic = 'blockcraft/' + mqtt.room + '/msg/' + mqtt.clientId;
    const will = JSON.stringify({ t: 'leave', id: mqtt.clientId });
    const body = [
      ...mqttStr('MQTT'), 4, 0x06, 0, 30,
      ...mqttStr(mqtt.clientId),
      ...mqttStr(willTopic),
      ...mqttStr(will)
    ];
    try { ws.send(mqttPacket(0x10, body)); } catch (e) { mqttScheduleReconnect(); }
  };
  ws.onmessage = (ev) => {
    const data = ev.data;
    if (data instanceof ArrayBuffer) mqttOnData(new Uint8Array(data));
    else if (ArrayBuffer.isView(data)) mqttOnData(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  };
  ws.onerror = () => { /* onclose handles it */ };
  ws.onclose = () => {
    if (mqtt.ws === ws) mqtt.ws = null;
    const wasOnline = net.online;
    net.online = false;
    mqtt.connected = false;
    mqtt.subscribed = false;
    updateRoomBadge();
    if (wasOnline) toast('Online link lost — reconnecting…');
    if (!mqtt.closedByUs) mqttScheduleReconnect();
  };
}

function mqttOnData(buf) {
  mqtt.lastRx = Date.now();
  let i = 0;
  while (i < buf.length) {
    const first = buf[i++];
    const type = first >> 4;
    let len = 0, mul = 1, b;
    do {
      if (i >= buf.length) return;
      b = buf[i++];
      len += (b & 0x7f) * mul;
      mul *= 128;
    } while (b & 0x80);
    if (i + len > buf.length) return;
    const body = buf.subarray(i, i + len);
    i += len;

    if (type === 2) { // CONNACK
      const rc = body[1];
      if (rc === 0) {
        mqtt.connected = true;
        if (mqtt.openTimer) { clearTimeout(mqtt.openTimer); mqtt.openTimer = null; }
        const filter = 'blockcraft/' + mqtt.room + '/#';
        const subBody = [0, 1, ...mqttStr(filter), 0];
        try { mqtt.ws.send(mqttPacket(0x82, subBody)); } catch (e) { mqttScheduleReconnect(); }
      } else {
        try { mqtt.ws.close(); } catch (e) { /* ignore */ }
        mqttScheduleReconnect();
      }
    } else if (type === 3) { // PUBLISH
      mqttHandlePublish(first, body);
    } else if (type === 9) { // SUBACK
      mqttOnSuback(body);
    } else if (type === 13) { // PINGRESP
      /* lastRx already updated */
    }
  }
}

function mqttOnSuback(body) {
  if (mqtt.subscribed) return;
  const code = body.length >= 3 ? body[2] : 0;
  if (code === 0x80) {
    try { mqtt.ws.close(); } catch (e) { /* ignore */ }
    mqttScheduleReconnect();
    return;
  }
  mqtt.subscribed = true;
  net.online = true;
  net.id = mqtt.clientId;
  net.attempts = 0;
  mqtt.fails = 0;
  mqttStartTimers();
  updateRoomBadge();
  const join = { ...combatNetState('join'), id: mqtt.clientId };
  mqttPublish('blockcraft/' + mqtt.room + '/msg/' + mqtt.clientId, JSON.stringify(join), false);
  net.lastSent = 0;
  if (!net.warned) toast('Online — room ' + mqtt.room + ' · share the code');
  else toast('Reconnected to room ' + mqtt.room);
  net.warned = true;
  playTone(660, 0.09, 'sine', 0.08);
}

function mqttHandlePublish(first, body) {
  const qos = (first >> 1) & 3;
  if (body.length < 2) return;
  const topicLen = (body[0] << 8) | body[1];
  if (body.length < 2 + topicLen) return;
  const topic = new TextDecoder().decode(body.subarray(2, 2 + topicLen));
  let p = 2 + topicLen;
  if (qos > 0) {
    if (body.length < p + 2) return;
    const pid = (body[p] << 8) | body[p + 1];
    p += 2;
    try { mqtt.ws.send(mqttPacket(0x40, [pid >> 8, pid & 255])); } catch (e) { /* ignore */ }
  }
  const payload = new TextDecoder().decode(body.subarray(p));
  const parts = topic.split('/');
  if (parts[0] !== 'blockcraft' || parts[1] !== mqtt.room) return;

  if (parts[2] === 'e') {
    let obj = null;
    try { obj = JSON.parse(payload); } catch (e) { /* ignore */ }
    const xyz = (parts[3] || '').split('_').map(Number);
    if (obj && typeof obj === 'object') {
      if (!Number.isFinite(obj.x)) obj.x = xyz[0];
      if (!Number.isFinite(obj.y)) obj.y = xyz[1];
      if (!Number.isFinite(obj.z)) obj.z = xyz[2];
      if (obj.by && obj.by === net.id) return;
      applyNetEdit(obj);
    } else if (xyz.length === 3 && Number.isFinite(xyz[0])) {
      applyNetEdit({ x: xyz[0], y: xyz[1], z: xyz[2], b: Number(payload) || 0 });
    }
    return;
  }

  if (parts[2] !== 'msg') return;
  const from = parts[3] || '';
  if (!/^[\w-]{1,40}$/.test(from)) return;
  let msg;
  try { msg = JSON.parse(payload); } catch (e) { return; }
  if (!msg || typeof msg !== 'object') return;
  // WS assigns identity at the connection; MQTT assigns it at the peer topic.
  msg.id = from;
  if (msg.t === 'join' && msg.player && typeof msg.player === 'object') msg.player.id = from;
  if (msg.t === 'hit') msg.byId = from;
  if (msg.t === 'voxelHit') msg.by = from;
  if (from && from !== mqtt.clientId) mqtt.peerSeen.set(from, Date.now());
  handleNet(msg);
}

function mqttStartTimers() {
  if (mqtt.keep) clearInterval(mqtt.keep);
  mqtt.keep = setInterval(() => {
    if (!mqtt.ws || mqtt.ws.readyState !== 1) return;
    try { mqtt.ws.send(new Uint8Array([0xc0, 0])); } catch (e) { /* ignore */ }
    if (Date.now() - mqtt.lastRx > 22000) {
      try { mqtt.ws.close(); } catch (e) { /* ignore */ }
    }
  }, 12000);

  if (mqtt.tick) clearInterval(mqtt.tick);
  mqtt.tick = setInterval(() => {
    if (!net.online) return;
    const now = Date.now();
    for (const id of [...net.players.keys()]) {
      if (now - (mqtt.peerSeen.get(id) || 0) > 16000) removeRemote(id);
    }
    updateRoomBadge();
  }, 3000);
}

function startOnline(roomArg) {
  const typed = normalizeRoom(roomArg || (document.getElementById('roomInput') || {}).value);
  if (!typed) {
    toast('Enter a room code, or press Create room');
    return;
  }
  const room = typed;
  if (net.mode === 'mqtt' && net.room === room && net.online) {
    toast('Already in room ' + room);
    return;
  }

  mqtt.closedByUs = true;
  mqttClearTimers();
  mqttDropSocket();
  if (net.ws) {
    const oldWs = net.ws;
    net.ws = null;
    try {
      oldWs.onopen = oldWs.onmessage = oldWs.onerror = oldWs.onclose = null;
      oldWs.close();
    } catch (e) { /* ignore */ }
  }
  for (const id of [...net.players.keys()]) removeRemote(id);
  mqtt.peerSeen.clear();

  const input = document.getElementById('roomInput');
  if (input) input.value = room;
  try { localStorage.setItem('blockcraft.room', room); } catch (e) { /* ignore */ }

  net.mode = 'mqtt';
  net.room = room;
  net.online = false;
  net.closedByUs = false;
  net.attempts = 0;
  net.warned = false;
  mqtt.room = room;
  mqtt.closedByUs = false;
  mqtt.connected = false;
  mqtt.subscribed = false;
  mqtt.fails = 0;
  mqtt.relay = 0;
  mqtt.clientId = 'bc_' + Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 8);
  net.id = mqtt.clientId;

  updateRoomBadge();
  toast('Joining room ' + room + '…');
  mqttOpen(0);
  if (hintEl && !hintEl.classList.contains('hidden')) lockPointer();
}

function createRoom() {
  const room = randomRoom();
  const input = document.getElementById('roomInput');
  if (input) input.value = room;
  startOnline(room);
  copyRoom();
}

function leaveOnline() {
  if (net.mode === 'mqtt' && net.online) {
    mqttPublish('blockcraft/' + net.room + '/msg/' + net.id, JSON.stringify({ t: 'leave', id: net.id }), false);
  }
  mqtt.closedByUs = true;
  mqttClearTimers();
  mqttDropSocket();
  net.online = false;
  net.mode = null;
  net.room = '';
  for (const id of [...net.players.keys()]) removeRemote(id);
  updateRoomBadge();
  connectNet();
}

/* ---------------- remote muzzle flashes ---------------- */
const remoteFlashes = [];
function remoteMuzzle(pos) {
  const mat = new THREE.SpriteMaterial({
    map: flashTex, color: 0xffcf84, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  });
  const s = new THREE.Sprite(mat);
  s.position.copy(pos);
  s.scale.setScalar(0.62 + Math.random() * 0.3);
  scene.add(s);
  remoteFlashes.push({ s, life: 0.06, max: 0.06 });
}

/* ---------------- per-frame network ---------------- */
function sendNetState(now) {
  if (!net.online) return;
  if (net.mode === 'mqtt') {
    if (!mqtt.connected) return;
  } else if (!net.ws || net.ws.readyState !== 1) return;
  if (now - net.lastSent < 90) return;
  net.lastSent = now;
  netSend(combatNetState());
}

function updateNetPlayers(dt) {
  flushNetEdits();
  dt = Math.max(0, Number.isFinite(dt) ? dt : 0);
  const now = performance.now();
  for (const r of net.players.values()) {
    const dead = r.hp <= 0 || r.deadUntil > now;
    if (r.deadUntil && r.deadUntil <= now) r.deadUntil = 0;
    r.group.visible = !dead;

    const k = combatDamp(12, dt);
    const dx = r.tx - r.x, dz = r.tz - r.z;
    const dist = Math.hypot(dx, dz);
    r.x += dx * k;
    r.z += dz * k;
    r.y += (r.ty - r.y) * combatDamp(12, dt);
    const dy = Math.atan2(Math.sin(r.tyaw - r.yaw), Math.cos(r.tyaw - r.yaw));
    r.yaw += dy * combatDamp(16, dt);
    r.pitch += (r.tpitch - r.pitch) * combatDamp(18, dt);
    r.firePose = Math.max(0, r.firePose - dt * 3.5);
    r.kick *= Math.exp(-WEAPON_BY_ID[r.weapon].recover * dt);
    r.speed = dist / Math.max(dt, 0.0001);
    if (dist > 0.02) r.phase += dt * 9;

    if (!dead) {
      r.group.position.set(r.x, r.y, r.z);
      r.group.rotation.y = r.yaw;
    }

    const parts = r.group.userData.parts;
    if (parts) {
      const moving = r.speed > 0.6;
      r.stance += (r.crouch - r.stance) * combatDamp(15, dt);
      r.slidePose += (r.slide - r.slidePose) * combatDamp(15, dt);
      const swing = Math.sin(r.phase) * (moving ? 0.75 : 0) * (1 - r.slidePose);
      const hk = combatDamp(12, dt);
      parts.legL.rotation.x += (swing + r.stance * 0.16 - r.slidePose * 0.72 - parts.legL.rotation.x) * hk;
      parts.legR.rotation.x += (-swing + r.stance * 0.16 + r.slidePose * 0.42 - parts.legR.rotation.x) * hk;
      parts.armL.rotation.x += (-swing * 0.8 - parts.armL.rotation.x) * hk;
      parts.armR.rotation.x += (swing * 0.8 - parts.armR.rotation.x) * hk;
      // Mirror 50's visual stance only; r.y and the fixed gameplay hitboxes stay
      // unchanged for crouching/sliding peers.
      const drop = r.stance * 0.12 + r.slidePose * 0.12;
      parts.head.position.y = 1.34 - drop;
      parts.armL.position.y = parts.armR.position.y = 1.3 - drop;
      if (parts.torso) {
        parts.torso.position.y = 0.72 - drop * 0.65;
        parts.torso.rotation.x += (-r.stance * 0.16 + r.slidePose * 0.22 - parts.torso.rotation.x) * hk;
      }
      const pitchTarget = Math.max(-0.75, Math.min(0.75, r.pitch * 0.6));
      parts.head.rotation.x += (pitchTarget - parts.head.rotation.x) * combatDamp(14, dt);
    }
    updateAvatarWeaponPose(r.group, netRemotePoseState(r, now), dt);
    if (r.group.userData.tag) {
      const dxp = r.x - player.pos.x, dzp = r.z - player.pos.z;
      r.group.userData.tag.visible = !dead && (dxp * dxp + dzp * dzp) < 36 * 36;
    }
  }

  for (let i = remoteFlashes.length - 1; i >= 0; i--) {
    const f = remoteFlashes[i];
    f.life -= dt;
    f.s.material.opacity = Math.max(0, f.life / f.max);
    if (f.life <= 0) {
      scene.remove(f.s);
      f.s.material.dispose();
      remoteFlashes.splice(i, 1);
    }
  }
}

/* ---------------- room UI wiring ---------------- */
const roomInputEl = document.getElementById('roomInput');
const onlineBtnEl = document.getElementById('onlineBtn');
const createBtnEl = document.getElementById('createBtn');
try {
  const urlRoom = normalizeRoom(new URLSearchParams(location.search).get('room') || '');
  const savedRoom = normalizeRoom(localStorage.getItem('blockcraft.room') || '');
  if (roomInputEl) roomInputEl.value = urlRoom || savedRoom;
} catch (e) { /* ignore */ }
if (roomInputEl) {
  roomInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); startOnline(); }
  });
}
if (onlineBtnEl) onlineBtnEl.addEventListener('click', () => startOnline());
if (createBtnEl) createBtnEl.addEventListener('click', createRoom);
const roomBadgeEl = document.getElementById('roomBadge');
if (roomBadgeEl) roomBadgeEl.addEventListener('click', copyRoom);
window.addEventListener('pagehide', () => {
  if (net.mode === 'mqtt' && mqtt.connected) {
    mqttPublish('blockcraft/' + net.room + '/msg/' + net.id, JSON.stringify({ t: 'leave', id: net.id }), false);
  }
  mqtt.closedByUs = true;
  mqttClearTimers();
  mqttDropSocket();
});

window.__netEdit = (x, y, z, b) => netSend({ t: 'edit', x, y, z, b });
window.__netIdentity = () => {
  if (!net.online) return;
  netSend({ ...combatNetState('join'), id: net.id });
};
if (window.__netRoom === undefined) window.__netRoom = startOnline;
