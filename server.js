#!/usr/bin/env node
/* ============================================================
   Blockcraft Battle Ground — multiplayer server, zero dependencies.
   Serves index.html + the src/ scripts and relays player positions,
   shots, damage and block edits over a minimal RFC 6455 WebSocket.

   Usage:  node server.js
   Then open: http://localhost:8080
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const MAX_PLAYERS = 32;
const MAX_EDITS = 6000;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** @type {Map<string, Client>} */
const clients = new Map();
const edits = [];
let nextId = 1;

function log(...args) {
  console.log('[battle-ground]', ...args);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/* Static files live next to server.js: index.html plus the src/ scripts. */
function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found: ' + path.basename(filePath));
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      players: clients.size,
      edits: edits.length,
      uptime: Math.round(process.uptime())
    }));
    return;
  }

  let rel = url.pathname;
  if (rel === '/' || rel === '') rel = '/index.html';
  let decoded;
  try {
    decoded = decodeURIComponent(rel);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  const filePath = path.resolve(ROOT, '.' + path.posix.normalize('/' + decoded));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  serveFile(res, filePath);
});

/* ---------------- WebSocket framing ---------------- */

function encodeFrame(payload, opcode = 0x1) {
  const len = payload.length;
  let head;
  if (len < 126) {
    head = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    head = Buffer.allocUnsafe(4);
    head[0] = 0x80 | opcode;
    head[1] = 126;
    head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.allocUnsafe(10);
    head[0] = 0x80 | opcode;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([head, payload]);
}

function sendRaw(client, payload, opcode = 0x1) {
  if (!client.socket.writable) return;
  try {
    client.socket.write(encodeFrame(payload, opcode));
  } catch (e) {
    /* socket died; close handler will clean up */
  }
}

function sendJSON(client, obj) {
  sendRaw(client, Buffer.from(JSON.stringify(obj), 'utf8'));
}

function broadcast(obj, except) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  for (const c of clients.values()) {
    if (c === except) continue;
    sendRaw(c, payload);
  }
}

function closeClient(client) {
  clients.delete(client.id);
  try { client.socket.end(); } catch (e) { /* ignore */ }
  broadcast({ t: 'leave', id: client.id });
  log(client.name + ' left (' + clients.size + ' online)');
}

function processFrames(client) {
  for (;;) {
    const buf = client.buffer;
    if (buf.length < 2) return;

    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let off = 2;

    if (len === 126) {
      if (buf.length < 4) return;
      len = buf.readUInt16BE(2);
      off = 4;
    } else if (len === 127) {
      if (buf.length < 10) return;
      const big = buf.readBigUInt64BE(2);
      if (big > 1000000n) { try { client.socket.destroy(); } catch (e) {} return; }
      len = Number(big);
      off = 10;
    }

    if (!masked) {
      // all frames from browsers must be masked
      try { client.socket.destroy(); } catch (e) {}
      return;
    }
    if (buf.length < off + 4 + len) return;

    const mask = buf.subarray(off, off + 4);
    off += 4;
    const payload = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) payload[i] = buf[off + i] ^ mask[i & 3];
    client.buffer = buf.subarray(off + len);

    if (opcode === 0x8) { closeClient(client); return; }
    if (opcode === 0x9) { sendRaw(client, payload, 0xa); continue; }
    if (opcode !== 0x1) continue;

    let msg;
    try { msg = JSON.parse(payload.toString('utf8')); } catch (e) { continue; }
    handleMessage(client, msg);
  }
}

/* ---------------- protocol ---------------- */

function cleanText(value, fallback, max) {
  if (typeof value !== 'string') return fallback;
  const out = value.replace(/[^\w \-'.]/g, '').trim().slice(0, max);
  return out || fallback;
}

function cleanCharacter(value) {
  const allowed = ['steve', 'cj', 'mario', 'ashen', 'undead', 'wolf', 'tarnished', 'fayoum',
    'seif', 'meedo', 'mko', 'mj', 'hokage', 'kestrel', 'oren', 'kratos', 'leon'];
  return allowed.includes(value) ? value : 'steve';
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function publicPlayer(client) {
  const reload = serverReloadProgress(client);
  const ready = client.combat && client.hp > 0 && reload < 0;
  return {
    id: client.id,
    name: client.name,
    character: client.character,
    x: client.x,
    y: client.y,
    z: client.z,
    yaw: client.yaw,
    pitch: client.pitch,
    weapon: client.weapon,
    hp: client.hp,
    kills: client.kills,
    deaths: client.deaths,
    aim: ready ? client.aim : 0,
    firing: ready ? client.firing : 0,
    combat: client.combat,
    build: client.build,
    reload,
    reloadTotal: client.reloadTotal,
    reloadRounds: client.reloadRounds,
    crouch: client.crouch,
    slide: client.slide
  };
}

// Match the classic-script weapon catalogue; the server has no browser imports.
const SERVER_WEAPONS = {
  pistol: { reload: 1.15, mag: 12, damage: 26 }, rifle: { reload: 1.85, mag: 30, damage: 17 },
  shotgun: { reload: 2.35, mag: 6, damage: 10 }, smg: { reload: 1.45, mag: 32, damage: 12 },
  sniper: { reload: 2.80, mag: 5, damage: 76 }, revolver: { reload: 2.40, mag: 6, damage: 46 },
  lmg: { reload: 3.60, mag: 60, damage: 19 }
};

function cleanWeapon(value, fallback) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SERVER_WEAPONS, value) ? value : fallback || 'pistol';
}

function poseFlag(value, fallback) {
  return value === true || value === 1 ? 1 : value === false || value === 0 ? 0 : fallback;
}

function poseNumber(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function poseYaw(value, fallback) {
  return Number.isFinite(value) ? Math.atan2(Math.sin(value), Math.cos(value)) : fallback;
}

function cleanVoxelHit(msg, by) {
  if (!Number.isInteger(msg.x) || !Number.isInteger(msg.y) || !Number.isInteger(msg.z) ||
      msg.x < 0 || msg.z < 0 || msg.x >= 256 || msg.z >= 256 || msg.y < 1 || msg.y >= 80 ||
      !Number.isInteger(msg.block) || msg.block < 1 || msg.block > 22 || msg.block === 10 ||
      typeof msg.weapon !== 'string' || !Object.prototype.hasOwnProperty.call(SERVER_WEAPONS, msg.weapon) ||
      !Number.isFinite(msg.amount) || msg.amount <= 0 ||
      typeof msg.hitId !== 'string' || !/^[\w.:-]{1,96}$/.test(msg.hitId)) return null;
  return {
    t: 'voxelHit', x: msg.x, y: msg.y, z: msg.z, block: msg.block, weapon: msg.weapon,
    amount: Math.max(1, Math.floor(Math.min(SERVER_WEAPONS[msg.weapon].damage, msg.amount))), hitId: msg.hitId, by
  };
}

function serverReloadProgress(client) {
  if (!client.combat || client.hp <= 0 || client.reload < 0) return -1;
  const p = client.reload + Math.max(0, Date.now() - client.reloadAt) / (client.reloadTotal * 1000);
  if (p >= 1) { client.reload = -1; return -1; }
  return Math.max(0, p);
}

function applyClientPose(client, msg) {
  const weapon = cleanWeapon(msg.weapon, client.weapon);
  if (weapon !== client.weapon) { client.reload = -1; client.firing = 0; }
  client.weapon = weapon;
  const w = SERVER_WEAPONS[weapon];
  client.yaw = poseYaw(msg.yaw, client.yaw);
  client.pitch = poseNumber(msg.pitch, client.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  const oldHp = client.hp;
  client.hp = poseNumber(msg.hp, client.hp, 0, 100);
  if (oldHp <= 0 && client.hp > 0) client.deathReported = false;
  client.kills = Math.max(client.kills, Math.floor(poseNumber(msg.kills, client.kills, 0, 999999)));
  client.deaths = Math.max(client.deaths, Math.floor(poseNumber(msg.deaths, client.deaths, 0, 999999)));
  const fallbackCombat = msg.build === undefined ? client.combat : 1 - poseFlag(msg.build, 1 - client.combat);
  client.combat = poseFlag(msg.combat, fallbackCombat);
  if (poseFlag(msg.build, 0)) client.combat = 0;
  client.build = 1 - client.combat;
  if (msg.reload !== undefined) {
    client.reload = Number.isFinite(msg.reload) && msg.reload >= 0 ? Math.min(1, msg.reload) : -1;
    client.reloadAt = Date.now();
    client.reloadTotal = poseNumber(msg.reloadTotal, w.reload, 0.25, w.reload);
    client.reloadRounds = Math.round(poseNumber(msg.reloadRounds, w.mag, 1, w.mag));
  }
  if (!client.combat || client.hp <= 0) client.reload = -1;
  const ready = client.combat && client.hp > 0 && serverReloadProgress(client) < 0;
  client.aim = ready ? poseFlag(msg.aim, client.aim) : 0;
  client.firing = ready ? poseFlag(msg.firing, client.firing) : 0;
  client.crouch = poseFlag(msg.crouch, client.crouch);
  client.slide = poseFlag(msg.slide, client.slide);
}

function cleanId(value) {
  return typeof value === 'string' && /^[\w-]{1,40}$/.test(value) ? value : '';
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function handleMessage(client, msg) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.t === 'join') {
    client.name = cleanText(msg.name, client.name || 'Player', 14);
    client.character = cleanCharacter(msg.character);
    client.x = finite(msg.x, client.x);
    client.y = finite(msg.y, client.y);
    client.z = finite(msg.z, client.z);
    applyClientPose(client, msg);

    sendJSON(client, {
      t: 'welcome',
      id: client.id,
      players: [...clients.values()].filter((c) => c !== client).map(publicPlayer),
      edits
    });
    broadcast({ t: 'join', player: publicPlayer(client) }, client);
    log(client.name + ' joined as ' + client.character + ' (' + clients.size + ' online)');
    return;
  }

  if (msg.t === 'state') {
    client.x = finite(msg.x, client.x);
    client.y = finite(msg.y, client.y);
    client.z = finite(msg.z, client.z);
    applyClientPose(client, msg);
    if (typeof msg.name === 'string') client.name = cleanText(msg.name, client.name, 14);
    if (typeof msg.character === 'string') client.character = cleanCharacter(msg.character);
    broadcast({ t: 'state', ...publicPlayer(client) }, client);
    return;
  }

  if (msg.t === 'reload') {
    applyClientPose(client, msg);
    broadcast({ t: 'reload', ...publicPlayer(client) }, client);
    return;
  }

  if (msg.t === 'edit') {
    const x = msg.x | 0, y = msg.y | 0, z = msg.z | 0, b = msg.b & 255;
    if (x < 0 || z < 0 || x > 1023 || z > 1023 || y < 0 || y > 255) return;
    const edit = { t: 'edit', x, y, z, b };
    edits.push(edit);
    if (edits.length > MAX_EDITS) edits.shift();
    broadcast(edit, client);
    return;
  }

  if (msg.t === 'voxelHit') {
    if (!client.combat || client.hp <= 0 || serverReloadProgress(client) >= 0) return;
    const hit = cleanVoxelHit(msg, client.id);
    if (hit) broadcast(hit, client);
    return;
  }

  if (msg.t === 'shot') {
    applyClientPose(client, msg);
    if (!client.combat || client.hp <= 0 || serverReloadProgress(client) >= 0) return;
    broadcast({
      t: 'shot',
      id: client.id,
      weapon: client.weapon,
      x: finite(msg.x, client.x),
      y: finite(msg.y, client.y + 1.4),
      z: finite(msg.z, client.z),
      yaw: client.yaw, pitch: client.pitch, aim: client.aim, firing: 1,
      combat: client.combat, build: client.build, reload: -1
    }, client);
    return;
  }

  if (msg.t === 'hit') {
    if (!client.combat || client.hp <= 0 || serverReloadProgress(client) >= 0) return;
    const target = clients.get(cleanId(msg.target));
    if (!target || target === client) return;
    sendJSON(target, {
      t: 'hit',
      target: target.id,
      dmg: poseNumber(msg.dmg, 1, 1, 120),
      head: poseFlag(msg.head, 0),
      weapon: cleanWeapon(msg.weapon),
      byId: client.id,
      by: client.name
    });
    return;
  }

  if (msg.t === 'died') {
    if (client.deathReported) return;
    client.deathReported = true;
    client.deaths = Math.max(client.deaths, Math.floor(poseNumber(msg.deaths, client.deaths + 1, 0, 999999)));
    client.kills = Math.max(client.kills, Math.floor(poseNumber(msg.kills, client.kills, 0, 999999)));
    const killer = clients.get(cleanId(msg.byId));
    if (killer && killer !== client) killer.kills = Math.min(999999, killer.kills + 1);
    client.hp = 0;
    client.reload = -1;
    client.aim = client.firing = 0;
    broadcast({
      t: 'died',
      id: client.id,
      victim: client.name,
      by: cleanText(msg.by, '???', 14),
      byId: cleanId(msg.byId),
      weapon: cleanWeapon(msg.weapon),
      kills: client.kills, deaths: client.deaths,
      killerKills: killer && killer !== client ? killer.kills : undefined
    }, client);
    return;
  }

  if (msg.t === 'respawn') {
    client.x = finite(msg.x, client.x);
    client.y = finite(msg.y, client.y);
    client.z = finite(msg.z, client.z);
    client.hp = poseNumber(msg.hp, 100, 1, 100);
    applyClientPose(client, msg);
    client.reload = -1;
    client.aim = client.firing = 0;
    client.deathReported = false;
    broadcast({ t: 'respawn', ...publicPlayer(client) }, client);
  }
}

/* ---------------- upgrade ---------------- */

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }
  if (clients.size >= MAX_PLAYERS) {
    socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    return;
  }

  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  socket.setNoDelay(true);

  const client = {
    id: 'p' + (nextId++),
    socket,
    name: 'Player',
    character: 'steve',
    x: 128,
    y: 40,
    z: 128,
    yaw: 0,
    pitch: 0,
    weapon: 'pistol',
    hp: 100,
    kills: 0,
    deaths: 0,
    deathReported: false,
    aim: 0,
    firing: 0,
    combat: 1,
    build: 0,
    reload: -1,
    reloadAt: 0,
    reloadTotal: SERVER_WEAPONS.pistol.reload,
    reloadRounds: SERVER_WEAPONS.pistol.mag,
    crouch: 0,
    slide: 0,
    buffer: Buffer.alloc(0)
  };
  clients.set(client.id, client);

  socket.on('data', (chunk) => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    if (client.buffer.length > 2 * 1024 * 1024) {
      try { socket.destroy(); } catch (e) {}
      return;
    }
    processFrames(client);
  });
  socket.on('close', () => closeClient(client));
  socket.on('error', () => closeClient(client));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('[battle-ground] port ' + PORT + ' is already in use. Set PORT=8081 and try again.');
  } else {
    console.error('[battle-ground] server error:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  log('serving Blockcraft Battle Ground at http://localhost:' + PORT);
  log('open the URL above in two browser tabs to test multiplayer');
});
