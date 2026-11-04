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
function applyNetEdit(m) {
  const x = m.x | 0, y = m.y | 0, z = m.z | 0, b = m.b | 0;
  if (x < 0 || z < 0 || x >= WORLD || z >= WORLD || y < 0 || y >= HEIGHT || b > 255) return;
  setBlock(x, y, z, b);
  markDirty(x, z);
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
  if (!p || !p.id || p.id === net.id) return;
  const incomingChar = p.character || 'steve';
  const incomingName = p.name || 'Player';
  const existing = net.players.get(p.id);
  if (existing && (existing.character !== incomingChar || existing.name !== incomingName)) {
    removeRemote(p.id);
  }
  let r = net.players.get(p.id);
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
      yaw: Number.isFinite(p.yaw) ? p.yaw : 0,
      tyaw: Number.isFinite(p.yaw) ? p.yaw : 0,
      pitch: 0, tpitch: 0,
      phase: 0, speed: 0, weapon: 'pistol', hp: 100,
      aim: 0, deadUntil: 0, gun: null
    };
    net.players.set(p.id, r);
    r.gun = attachAvatarGun(group, r.weapon);
  }
  if (Number.isFinite(p.x)) r.tx = p.x;
  if (Number.isFinite(p.y)) r.ty = p.y;
  if (Number.isFinite(p.z)) r.tz = p.z;
  if (Number.isFinite(p.yaw)) r.tyaw = p.yaw;
  if (Number.isFinite(p.pitch)) r.tpitch = p.pitch;
  if (typeof p.weapon === 'string' && WEAPON_BY_ID[p.weapon] && r.weapon !== p.weapon) {
    r.weapon = p.weapon;
    r.gun = attachAvatarGun(r.group, r.weapon);
  }
  if (Number.isFinite(p.hp)) r.hp = p.hp;
  r.aim = p.aim ? 1 : 0;
  r.name = incomingName;
  updateRoomBadge();
}

function handleNet(msg) {
  if (!msg || typeof msg.t !== 'string') return;
  switch (msg.t) {
    case 'welcome':
      net.mode = 'ws';
      net.id = msg.id;
      net.online = true;
      net.attempts = 0;
      net.players.clear();
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
    case 'hit':
      if (msg.target === net.id) applyDamage(msg.dmg, msg.by, !!msg.head, msg.byId);
      break;
    case 'shot': {
      if (msg.id === net.id) break;
      const r = net.players.get(msg.id);
      if (!r) break;
      const pos = new THREE.Vector3();
      if (r.group.userData.gun) r.group.userData.gun.userData.muzzle.getWorldPosition(pos);
      else pos.set(r.x, r.y + 1.4, r.z);
      remoteMuzzle(pos);
      const dist = pos.distanceTo(camera.position);
      if (dist < 75) {
        const w = WEAPON_BY_ID[msg.weapon] || WEAPONS[0];
        playShot(w, Math.max(0.05, 1 - dist / 75) * 0.95);
      }
      break;
    }
    case 'died':
      if (msg.id === net.id) break; // already handled locally
      if (msg.byId && msg.byId === net.id) {
        kills++;
        setKd();
        toast('You eliminated ' + safeName(msg.victim));
        playTone(880, 0.08, 'triangle', 0.08);
      }
      addKillFeed(msg.by, msg.victim);
      {
        const r = net.players.get(msg.id);
        if (r) {
          r.deadUntil = performance.now() + 3300;
          r.group.visible = false;
        }
      }
      break;
    case 'respawn': {
      if (msg.id === net.id) break;
      const r = net.players.get(msg.id);
      if (r) {
        r.deadUntil = 0;
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
function connectNet() {
  if (net.mode === 'mqtt' || net.closedByUs) return;
  if (net.ws && (net.ws.readyState === 0 || net.ws.readyState === 1)) return;
  let ws;
  try { ws = new WebSocket(netUrl()); } catch (e) { return; }
  net.ws = ws;
  net.mode = 'ws';

  ws.onopen = () => {
    net.attempts = 0;
    netSend({
      t: 'join', name: playerName, character: charKey,
      x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw,
      pitch: player.pitch, weapon: currentWeapon().id, hp: health, aim: 0
    });
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
  const join = {
    t: 'join', id: mqtt.clientId, name: playerName, character: charKey,
    x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw,
    pitch: player.pitch, weapon: currentWeapon().id, hp: health, aim: gun.aiming ? 1 : 0
  };
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
  let msg;
  try { msg = JSON.parse(payload); } catch (e) { return; }
  if (!msg || typeof msg !== 'object') return;
  if (!msg.id) msg.id = from;
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
  netSend({
    t: 'state', x: player.pos.x, y: player.pos.y, z: player.pos.z,
    yaw: player.yaw, pitch: player.pitch, character: charKey, name: playerName,
    weapon: currentWeapon().id, hp: health, aim: gun.aiming ? 1 : 0
  });
}

function updateNetPlayers(dt) {
  const now = performance.now();
  for (const r of net.players.values()) {
    const dead = r.deadUntil && r.deadUntil > now;
    if (r.deadUntil && !dead) { r.deadUntil = 0; r.group.visible = true; }

    const k = Math.min(1, dt * 9);
    const dx = r.tx - r.x, dz = r.tz - r.z;
    const dist = Math.hypot(dx, dz);
    r.x += dx * k;
    r.z += dz * k;
    r.y += (r.ty - r.y) * Math.min(1, dt * 6);
    let dy = r.tyaw - r.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    r.yaw += dy * Math.min(1, dt * 8);
    r.pitch += (r.tpitch - r.pitch) * Math.min(1, dt * 9);
    r.speed = dist / Math.max(dt, 0.0001);
    if (dist > 0.02) r.phase += dt * 9;

    if (!dead) {
      r.group.position.set(r.x, r.y, r.z);
      r.group.rotation.y = r.yaw;
    }

    const parts = r.group.userData.parts;
    if (parts) {
      const moving = r.speed > 0.6;
      const swing = Math.sin(r.phase) * (moving ? 0.75 : 0);
      const aiming = r.aim > 0.5;
      const hk = Math.min(1, dt * 12);
      parts.legL.rotation.x += (swing - parts.legL.rotation.x) * hk;
      parts.legR.rotation.x += (-swing - parts.legR.rotation.x) * hk;
      const targetL = aiming ? Math.PI / 2 - 0.16 : -swing * 0.8;
      const targetR = aiming ? Math.PI / 2 - 0.05 : swing * 0.8;
      parts.armL.rotation.x += (targetL - parts.armL.rotation.x) * hk;
      parts.armR.rotation.x += (targetR - parts.armR.rotation.x) * hk;
      const pitchTarget = Math.max(-0.75, Math.min(0.75, -r.pitch * 0.6));
      parts.head.rotation.x += (pitchTarget - parts.head.rotation.x) * Math.min(1, dt * 10);
    }
    if (r.gun) r.gun.visible = !dead;
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
  netSend({
    t: 'join', id: net.id, name: playerName, character: charKey,
    x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw,
    pitch: player.pitch, weapon: currentWeapon().id, hp: health, aim: gun.aiming ? 1 : 0
  });
};
if (window.__netRoom === undefined) window.__netRoom = startOnline;
