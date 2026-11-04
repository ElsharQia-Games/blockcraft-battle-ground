#!/usr/bin/env node
/* ============================================================
   Blockcraft Battle Ground — multiplayer server, zero dependencies.
   Serves index.html + the src/ scripts and relays player positions,
   shots, damage and block edits over a minimal RFC 6455 WebSocket.

   Usage:  node server.js
   Then open: http://localhost:8080

   v2 hardening: per-client token buckets, coalesced state broadcasts,
   monotonic server timing, weapon fire locks, seed handshake, heartbeat
   and teleport/position validation. All timers below use a monotonic
   clock so a wild wall clock cannot be used to refill rate buckets.
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { performance: nodePerformance } = require('perf_hooks');
const SERVER_DRAGON_RULES = require('./src/44-dragon-rules.js');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const MAX_PLAYERS = 32;
const MAX_EDITS = 6000;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/* ---- rate/shape limits ------------------------------------------------- */
const MAX_MSGS_PER_SEC = 120;
const MAX_BYTES_PER_SEC = 180000;
const MSG_BURST = 140;
const MAX_STATE_PER_SEC = 30;
const MAX_STATE_BROADCASTS_PER_SEC = 30;
const MAX_FRAME_BYTES = 32 * 1024;
const MAX_FRAME_ABSOLUTE = 1024 * 1024;
const MAX_BUFFER_BYTES = 256 * 1024;
const MAX_TX_QUEUE = 48;
const MAX_ABUSE_DROPS = 400;
const MAX_ABUSE_BYTES_PER_SEC = 1200 * 1024;
const ABUSE_WINDOW_MS = 3000;
const HEARTBEAT_MS = 5000;
const CLIENT_TIMEOUT_MS = 12000;
const MAX_EDITS_PER_SEC = 128;
const EDIT_BURST = 192;
const MAX_EDIT_BATCH = 128;

/* ---- world / protocol ------------------------------------------------- */
const WORLD_SIZE = 256;
const WORLD_HEIGHT = 80;
const Y_MIN = -8;
const Y_MAX = 128;
const MAX_TELEPORT = 24;
const SHOT_GROUP_MS = 1000;
const MAX_SHOT_GROUPS = 16;
const MAX_EDIT_REACH = 48;
const FIRE_GRACE = 0.75;
const RESPAWN_MS = 3200;
const RIDE_MS = 30000;
const MOUNT_RANGE = 7;
const BREATH_MS = 180;
const BREATH_RANGE = 18;
const BREATH_COS = Math.cos(32 * Math.PI / 180);
const BREATH_DAMAGE = 55;
const ALLOW_FORCE_RIDEABLE = process.env.BC_ALLOW_FORCE_RIDEABLE === '1';
const SERVER_EPOCH = Date.now() - nodePerformance.now();
const SERVER_SESSION = crypto.randomBytes(8).toString('hex');
const SERVER_MODES = {
  tdm: null, ffa: null, gungame: null, moon: null, hardcore: null, snipers: ['sniper'], shotguns: ['shotgun'],
  sidearms: ['pistol', 'revolver'], lockdown: ['rifle', 'smg', 'shotgun', 'revolver']
};
// Keep in sync with MODES (src/15-modes.js) and src/90-net.js.
const SERVER_TEAM_MODES = new Set(['tdm', 'lockdown', 'moon', 'hardcore']);
const SERVER_MODE_DAMAGE = { hardcore: 1.5 };
const SERVER_NO_REGEN_MODES = new Set(['hardcore']);
// Only terrain-dependent centers/altitude come from the host. All class,
// eligibility, scale, route and phase fields come from the shared seed rules.
const SERVER_DRAGON_META = ['kind', 'type', 'role', 'routeFamily', 'size', 'rideable', 'ambient', 'indestructible', 'invulnerable'];
const SERVER_DRAGON_ROUTE_FIELDS = ['rx', 'rz', 'rotation', 'period', 'direction', 'tiltX', 'tiltZ', 'phase', 'flap', 'glide', 'swayPeriod', 'centerMode'];
const SERVER_DRAGON_CATALOG_BOUNDS = ['minCX', 'maxCX', 'minCZ', 'maxCZ', 'minAltitude', 'maxAltitude'];

/* Minimum trigger interval per weapon (milliseconds). SERVER_WEAPONS.reload
   is a slow fallback only: these are fire cadences, not reload durations. */
const SERVER_FIRE_MS = {
  pistol: 167, rifle: 94, shotgun: 800, smg: 68,
  sniper: 1430, revolver: 353, lmg: 100
};
const MAX_HP = 150; // keep in sync with MAX_HEALTH in src/60-combat.js

/** @type {Map<string, Client>} */
const clients = new Map();
const edits = new Map();
let nextId = 1;
let hostId = null;
let worldSeed = 20261104;
let worldGeneration = 1;
let roomMode = 'tdm';
let killSerial = 0;
let rideSerial = 0;
let editSerial = 0;
const roomScores = { red: 0, blue: 0 };
const riderLeases = new Map();
const dragonCatalog = new Map();
const healthTotals = { rx: 0, tx: 0, dropped: 0, teleports: 0 };

function log(...args) {
  console.log('[battle-ground]', ...args);
}

function nowMs() {
  return nodePerformance.now();
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

function healthPayload() {
  let seqIn = 0, joined = 0, queued = 0;
  for (const client of clients.values()) {
    if (client.joined) joined++;
    queued += client.txQueue.length + client.pendingState.size;
    seqIn += client.seqIn;
  }
  return {
    ok: true,
    players: clients.size,
    edits: edits.size,
    uptime: Math.round(process.uptime()),
    seed: worldSeed,
    mode: roomMode,
    generation: worldGeneration,
    host: hostId,
    hostId,
    joined,
    rides: riderLeases.size,
    dragonCount: SERVER_DRAGON_RULES.count(worldSeed),
    catalogCount: dragonCatalog.size,
    queued,
    ...healthTotals,
    seqIn,
    maxPlayers: MAX_PLAYERS,
    maxEdits: MAX_EDITS
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthPayload()));
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

function sendRaw(client, payload, opcode = 0x1, expendable = false) {
  if (client.closed || !client.socket.writable) return false;
  const frame = encodeFrame(payload, opcode);
  if (client.txQueue.length || client.socket.writableLength + frame.length > MAX_BUFFER_BYTES) {
    if (expendable) return false; // the per-peer pose map retains the latest state
    if (client.txQueue.length >= MAX_TX_QUEUE || client.txBytes + frame.length > MAX_BUFFER_BYTES) {
      closeClient(client); // fail closed, never silently evict a hit/death/config
      return false;
    }
    client.txQueue.push({ frame, bytes: payload.length });
    client.txBytes += frame.length;
    return true;
  }
  try {
    client.socket.write(frame);
    client.tx += payload.length;
    healthTotals.tx += payload.length;
    return true;
  } catch (e) {
    closeClient(client);
    return false;
  }
}

function flushSocketQueue(client) {
  if (client.closed) return;
  while (client.txQueue.length) {
    const item = client.txQueue[0];
    if (client.socket.writableLength + item.frame.length > MAX_BUFFER_BYTES) return;
    client.txQueue.shift();
    client.txBytes -= item.frame.length;
    try {
      const ready = client.socket.write(item.frame);
      client.tx += item.bytes;
      healthTotals.tx += item.bytes;
      if (!ready) return;
    } catch (e) { closeClient(client); return; }
  }
}

function sendJSON(client, obj, expendable = false) {
  return sendRaw(client, Buffer.from(JSON.stringify(obj), 'utf8'), 0x1, expendable);
}

function broadcast(obj, except) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  for (const c of clients.values()) {
    if (c === except || !c.joined) continue;
    sendRaw(c, payload);
  }
}

/* At most 20 pose frames/s per recipient, with one latest snapshot per actor.
   Batching preserves every peer; shot/death/respawn/config events bypass this
   queue and can never be overwritten by an unrelated player's state. */
function flushStateBroadcast(client) {
  client.pendingTimer = null;
  if (client.closed || !clients.has(client.id)) return;
  if (!client.pendingState.size) return;
  const now = nowMs();
  if (now < client.outNextAt) {
    client.pendingTimer = setTimeout(() => flushStateBroadcast(client), Math.ceil(client.outNextAt - now));
    return;
  }
  const latest = [...client.pendingState.values()];
  const packet = latest.length === 1 ? latest[0] : {
    t: 'states', players: latest, generation: worldGeneration
  };
  client.outNextAt = now + 1000 / MAX_STATE_BROADCASTS_PER_SEC;
  if (sendJSON(client, packet, true)) client.pendingState.clear();
  else if (!client.closed) client.pendingTimer = setTimeout(() => flushStateBroadcast(client), 50);
}

function queueStateBroadcast(client, obj) {
  const id = obj.id || (obj.player && obj.player.id);
  if (!id || client.closed) return;
  client.pendingState.set(id, obj);
  if (client.pendingTimer) return;
  const delay = Math.max(0, Math.ceil(client.outNextAt - nowMs()));
  client.pendingTimer = setTimeout(() => flushStateBroadcast(client), delay);
}

function broadcastState(obj, except) {
  for (const c of clients.values()) {
    if (c === except || !c.joined) continue;
    queueStateBroadcast(c, obj);
  }
}

function closeClient(client) {
  if (client.closed) return;
  client.closed = true;
  clients.delete(client.id);
  if (client.pendingTimer) {
    clearTimeout(client.pendingTimer);
    client.pendingTimer = null;
  }
  if (client.historyTimer) { clearTimeout(client.historyTimer); client.historyTimer = null; }
  client.historyJob = null;
  client.pendingState.clear();
  client.txQueue.length = 0;
  client.txBytes = 0;
  releaseRide(client, 'left');
  for (const other of clients.values()) other.pendingState.delete(client.id);
  try { client.socket.destroy(); } catch (e) { /* ignore */ }
  if (hostId === client.id) {
    const ids = [...clients.values()].filter((c) => c.joined).map((c) => c.id).sort();
    hostId = ids[0] || null;
    broadcast(matchConfig());
  }
  if (client.joined) {
    broadcast({ t: 'leave', id: client.id, generation: worldGeneration });
    broadcastRoster();
  }
  log(client.name + ' left (' + clients.size + ' online)');
}

function noteDrop(client) {
  const now = nowMs();
  client.dropped++;
  healthTotals.dropped++;
  if (client.lastDropAt && now - client.lastDropAt > 5000) client.abuseSince = now;
  else if (!client.abuseSince) client.abuseSince = now;
  client.lastDropAt = now;
  if (client.dropped > MAX_ABUSE_DROPS && client.abuseSince &&
      now - client.abuseSince >= ABUSE_WINDOW_MS) {
    log('dropping abusive client ' + client.id + ' (' + client.dropped + ' dropped messages)');
    closeClient(client);
    return true;
  }
  return false;
}

function trackInboundBytes(client, bytes, now) {
  client.rx += bytes;
  healthTotals.rx += bytes;
  if (now - client.byteWindowAt >= 1000) {
    const rate = client.byteWindow * 1000 / (now - client.byteWindowAt);
    if (rate > MAX_ABUSE_BYTES_PER_SEC) {
      if (client.byteAbuseSince === null) client.byteAbuseSince = client.byteWindowAt;
    } else client.byteAbuseSince = null;
    if (client.byteAbuseSince !== null && now - client.byteAbuseSince >= ABUSE_WINDOW_MS) {
      closeClient(client);
      return true;
    }
    client.byteWindowAt = now;
    client.byteWindow = 0;
  }
  client.byteWindow += bytes;
  if (client.byteWindow > MAX_ABUSE_BYTES_PER_SEC) {
    if (client.byteAbuseSince === null) client.byteAbuseSince = client.byteWindowAt;
    else if (now - client.byteAbuseSince >= ABUSE_WINDOW_MS) {
      log('dropping flooding client ' + client.id + ' (>' + MAX_ABUSE_BYTES_PER_SEC + ' B/s)');
      closeClient(client);
      return true;
    }
  }
  return false;
}

function refillBuckets(client, now) {
  const dt = Math.max(0, now - client.bucketAt) / 1000;
  if (dt <= 0) return;
  client.msgTokens = Math.min(MSG_BURST, client.msgTokens + dt * MAX_MSGS_PER_SEC);
  client.byteTokens = Math.min(MAX_BYTES_PER_SEC, client.byteTokens + dt * MAX_BYTES_PER_SEC);
  client.bucketAt = now;
}

function allowMessage(client, bytes) {
  const now = nowMs();
  refillBuckets(client, now);
  bytes = Math.max(1, bytes | 0);
  if (client.msgTokens < 1 || client.byteTokens < bytes) {
    noteDrop(client);
    return false;
  }
  client.msgTokens -= 1;
  client.byteTokens = Math.max(0, client.byteTokens - bytes);
  return true;
}

function allowState(client) {
  const now = nowMs();
  if (now - client.stateWindowAt >= 1000) {
    client.stateWindowAt = now;
    client.stateWindowCount = 0;
  }
  if (client.stateWindowCount >= MAX_STATE_PER_SEC) {
    noteDrop(client);
    return false;
  }
  client.stateWindowCount++;
  return true;
}

function allowEdit(client, count = 1) {
  const now = nowMs();
  client.editTokens = Math.min(EDIT_BURST, client.editTokens + Math.max(0, now - client.editWindowAt) * MAX_EDITS_PER_SEC / 1000);
  client.editWindowAt = now;
  if (client.editTokens < count) return false;
  client.editTokens -= count;
  return true;
}

function validEditCell(msg, client) {
  return !!msg && Number.isInteger(msg.x) && Number.isInteger(msg.y) && Number.isInteger(msg.z) && Number.isInteger(msg.b) &&
    msg.x >= 0 && msg.z >= 0 && msg.x < WORLD_SIZE && msg.z < WORLD_SIZE && msg.y >= 0 && msg.y < WORLD_HEIGHT &&
    msg.b >= 0 && msg.b <= 255 &&
    Math.hypot(msg.x + 0.5 - client.x, msg.y + 0.5 - client.y, msg.z + 0.5 - client.z) <= MAX_EDIT_REACH;
}

function rememberEdit(msg) {
  const edit = { t: 'edit', x: msg.x, y: msg.y, z: msg.z, b: msg.b, generation: worldGeneration, sid: ++editSerial };
  const key = edit.x + ',' + edit.y + ',' + edit.z;
  edits.delete(key);
  edits.set(key, edit);
  if (edits.size > MAX_EDITS) edits.delete(edits.keys().next().value);
  return edit;
}

function flushEditHistory(client) {
  client.historyTimer = null;
  const job = client.historyJob;
  if (client.closed || !job || job.generation !== worldGeneration) { client.historyJob = null; return; }
  let count = 0;
  while (job.cursor < job.edits.length && count++ < 2 && client.txQueue.length < 8 && client.socket.writableLength < MAX_BUFFER_BYTES / 2) {
    const page = job.edits.slice(job.cursor, job.cursor + 128);
    if (!sendJSON(client, { t: 'edits', edits: page, generation: job.generation })) return;
    job.cursor += page.length;
  }
  if (job.cursor >= job.edits.length) client.historyJob = null;
  else if (!client.closed) client.historyTimer = setTimeout(() => flushEditHistory(client), 25);
}

/* Lock triggers, not individual pellets. Hit and voxelHit share ONE bounded
   allowance tied to the accepted weapon/shot id. A rejected trigger cannot
   fall through to a second independent damage clock. */
function acceptSequence(client, msg) {
  if (msg.seq === undefined) return true; // compatibility with unsequenced LAN clients
  if (!Number.isSafeInteger(msg.seq) || msg.seq <= client.seqIn) {
    noteDrop(client); return false;
  }
  client.seqIn = msg.seq;
  return true;
}

function shotFor(client, msg) {
  if (msg.shotId !== undefined) return client.shots.get(cleanToken(msg.shotId)) || null;
  return client.shot;
}

function fireLock(client, weapon, kind, msg) {
  const now = nowMs();
  const w = SERVER_WEAPONS[weapon] || SERVER_WEAPONS.pistol;
  const interval = (SERVER_FIRE_MS[weapon] || (w.reload * 1000)) * FIRE_GRACE;
  if (kind === 'shot') {
    client.seenShot = true;
    const id = cleanToken(msg.shotId);
    if ((msg.shotId !== undefined && !id) || (id && client.shots.has(id))) { noteDrop(client); return false; }
    let fireAt = now;
    if (msg.shotAt !== undefined) {
      if (!Number.isFinite(msg.shotAt) || msg.shotAt < 0 || msg.shotAt > Number.MAX_SAFE_INTEGER) {
        noteDrop(client); return false;
      }
      // The origin tracks the FASTEST delivery seen so far. Anchoring it to the
      // first packet meant one slow first shot made every later, normally
      // delivered shot look "from the future" and silently dropped all hits.
      const origin = now - msg.shotAt;
      if (client.fireClockOrigin === null || origin < client.fireClockOrigin) client.fireClockOrigin = origin;
      fireAt = msg.shotAt + client.fireClockOrigin;
      if (fireAt < now - 1500) { noteDrop(client); return false; }
    }
    if (fireAt - client.lastFireAt < Math.max(interval, client.lastFireInterval)) {
      noteDrop(client);
      return false;
    }
    client.lastShotAt = now;
    client.lastFireAt = fireAt;
    client.lastFireInterval = interval;
    client.shot = {
      at: now, weapon, id,
      remaining: w.pellets, seen: new Set(),
      x: msg.x, y: msg.y, z: msg.z
    };
    for (const [key, shot] of client.shots) if (now - shot.at > SHOT_GROUP_MS) client.shots.delete(key);
    if (id) client.shots.set(id, client.shot);
    while (client.shots.size > MAX_SHOT_GROUPS) client.shots.delete(client.shots.keys().next().value);
    return true;
  }
  // Compatibility for old hit-only clients; modern clients always send shot.
  if (!client.seenShot && (!client.shot || now - client.shot.at > SHOT_GROUP_MS)) {
    if (now - client.lastShotAt < interval) { noteDrop(client); return false; }
    client.lastShotAt = now;
    client.lastFireAt = now;
    client.lastFireInterval = interval;
    client.shot = {
      at: now, weapon, id: '', remaining: w.pellets, seen: new Set(),
      x: client.x, y: client.y + client.height * 0.75, z: client.z
    };
  }
  const shot = shotFor(client, msg);
  const token = cleanToken(msg && (msg.eventId || msg.hitId));
  if (!shot || shot.weapon !== weapon || now - shot.at > SHOT_GROUP_MS || shot.remaining <= 0 ||
       (client.seenShot && shot.id && msg.shotId === undefined) ||
      (token && shot.seen.has(token))) {
    noteDrop(client);
    return false;
  }
  shot.remaining--;
  if (token) shot.seen.add(token);
  return true;
}

function processFrames(client) {
  for (;;) {
    const buf = client.buffer;
    if (client.discardBytes) {
      const skip = Math.min(client.discardBytes, buf.length);
      client.discardBytes -= skip;
      client.buffer = buf.subarray(skip);
      if (client.discardBytes || !client.buffer.length) return;
      continue;
    }
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
      if (big > BigInt(MAX_FRAME_ABSOLUTE)) {
        try { client.socket.destroy(); } catch (e) { /* ignore */ }
        closeClient(client);
        return;
      }
      len = Number(big);
      off = 10;
    }

    if (!masked) {
      // all frames from browsers must be masked
      try { client.socket.destroy(); } catch (e) { /* ignore */ }
      closeClient(client);
      return;
    }
    if (buf.length < off + 4) return;

    if (len > MAX_FRAME_ABSOLUTE) {
      try { client.socket.destroy(); } catch (e) { /* ignore */ }
      closeClient(client);
      return;
    }

    // Normal gameplay never needs a 32KB message. Consume the frame without
    // JSON.parse so a flood cannot allocate giant strings exponentially.
    if (len > MAX_FRAME_BYTES) {
      const available = Math.min(len, buf.length - off - 4);
      client.buffer = buf.subarray(off + 4 + available);
      client.discardBytes = len - available;
      noteDrop(client);
      if (client.closed) return;
      continue;
    }

    if (buf[0] & 0x70 || !(buf[0] & 0x80) || (opcode >= 8 && len > 125)) {
      closeClient(client);
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
    try { msg = JSON.parse(payload.toString('utf8')); } catch (e) {
      allowMessage(client, len);
      noteDrop(client);
      if (client.closed) return;
      continue;
    }
    handleMessage(client, msg, len);
    if (client.closed) return;
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
  advanceHealth(client);
  const reload = serverReloadProgress(client);
  const ready = client.combat && client.hp > 0 && client.ride < 0 && reload < 0;
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
    slide: client.slide,
    sliding: client.slide,
    boost: client.boost, fly: client.fly, fuel: client.fuel,
    onGround: client.onGround,
    dash: client.dash, height: client.height, bodyHeight: client.height, team: client.team || null,
    life: client.life, dragon: client.ride, generation: worldGeneration,
    sid: client.seqOut++
  };
}

// Match the classic-script weapon catalogue; the server has no browser imports.
const SERVER_WEAPONS = {
  pistol: { reload: 1.15, mag: 14, damage: 30, pellets: 1, range: 90, head: 2.0 },
  rifle: { reload: 1.85, mag: 30, damage: 23, pellets: 1, range: 130, head: 1.6 },
  shotgun: { reload: 2.35, mag: 6, damage: 14, pellets: 9, range: 34, head: 1.5 },
  smg: { reload: 1.45, mag: 32, damage: 15, pellets: 1, range: 70, head: 1.4 },
  sniper: { reload: 2.80, mag: 5, damage: 115, pellets: 1, range: 180, head: 2.0 },
  revolver: { reload: 2.40, mag: 6, damage: 58, pellets: 1, range: 105, head: 2.0 },
  lmg: { reload: 3.60, mag: 75, damage: 21, pellets: 1, range: 145, head: 1.4 }
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
      msg.x < 0 || msg.z < 0 || msg.x >= WORLD_SIZE || msg.z >= WORLD_SIZE ||
      msg.y < 1 || msg.y >= WORLD_HEIGHT ||
      !Number.isInteger(msg.block) || msg.block < 1 || msg.block > 22 || msg.block === 10 ||
      typeof msg.weapon !== 'string' || !Object.prototype.hasOwnProperty.call(SERVER_WEAPONS, msg.weapon) ||
      !Number.isFinite(msg.amount) || msg.amount <= 0 || msg.amount > SERVER_WEAPONS[msg.weapon].damage ||
      typeof msg.hitId !== 'string' || !/^[\w.:-]{1,96}$/.test(msg.hitId)) return null;
  return {
    t: 'voxelHit', x: msg.x, y: msg.y, z: msg.z, block: msg.block, weapon: msg.weapon,
    amount: Math.max(1, Math.floor(msg.amount)), hitId: msg.hitId, by,
    shotId: cleanToken(msg.shotId), generation: worldGeneration
  };
}

function serverReloadProgress(client) {
  if (!client.combat || client.hp <= 0 || client.reload < 0) return -1;
  const p = client.reload + Math.max(0, nowMs() - client.reloadAt) / (client.reloadTotal * 1000);
  if (p >= 1) { client.reload = -1; return -1; }
  return Math.max(0, p);
}

function applyClientPose(client, msg) {
  advanceHealth(client);
  const weapon = cleanWeapon(msg.weapon, client.weapon);
  if (weapon !== client.weapon) { client.reload = -1; client.firing = 0; }
  client.weapon = weapon;
  const w = SERVER_WEAPONS[weapon];
  client.yaw = poseYaw(msg.yaw, client.yaw);
  client.pitch = poseNumber(msg.pitch, client.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  // HP, kills and deaths are server state. A late living pose cannot resurrect
  // a known dead player, and a fabricated snapshot cannot grant score/healing.
  const fallbackCombat = msg.build === undefined ? client.combat : 1 - poseFlag(msg.build, 1 - client.combat);
  client.combat = poseFlag(msg.combat, fallbackCombat);
  if (poseFlag(msg.build, 0)) client.combat = 0;
  client.build = 1 - client.combat;
  if (msg.reload !== undefined) {
    client.reload = Number.isFinite(msg.reload) && msg.reload >= 0 ? Math.min(1, msg.reload) : -1;
    client.reloadAt = nowMs();
    client.reloadTotal = poseNumber(msg.reloadTotal, w.reload, 0.25, w.reload);
    client.reloadRounds = Math.round(poseNumber(msg.reloadRounds, w.mag, 1, w.mag));
  }
  if (!client.combat || client.hp <= 0) client.reload = -1;
  const ready = client.combat && client.hp > 0 && client.ride < 0 && serverReloadProgress(client) < 0;
  client.aim = ready ? poseFlag(msg.aim, client.aim) : 0;
  client.firing = ready ? poseFlag(msg.firing, client.firing) : 0;
  client.crouch = poseFlag(msg.crouch, client.crouch);
  client.slide = poseFlag(msg.sliding === undefined ? msg.slide : msg.sliding, client.slide);
  client.fly = poseFlag(msg.fly, client.fly);
  client.onGround = poseFlag(msg.onGround, client.onGround);
  client.boost = client.fly ? poseFlag(msg.boost, 0) : 0;
  client.dash = poseFlag(msg.dash, 0);
  client.fuel = poseNumber(msg.fuel, client.fuel, 0, 100);
  client.height = poseNumber(msg.bodyHeight === undefined ? msg.height : msg.bodyHeight,
    client.crouch || client.slide || client.dash ? 1.2 : 1.8, 1.1, 1.9);
  if (client.hp <= 0) client.fly = client.boost = client.dash = client.firing = 0;
}

function cleanId(value) {
  return typeof value === 'string' && /^[\w-]{1,40}$/.test(value) ? value : '';
}

function toUint32(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff ? value : null;
}

function cleanToken(value) {
  return typeof value === 'string' && /^[\w.:-]{1,96}$/.test(value) ? value : '';
}

function validMode(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SERVER_MODES, value);
}

function weaponAllowed(weapon) {
  return Object.prototype.hasOwnProperty.call(SERVER_WEAPONS, weapon) &&
    (!SERVER_MODES[roomMode] || SERVER_MODES[roomMode].includes(weapon));
}

// Teams are sticky per player: assigned once on join to the smaller side and
// changed only by an explicit switch. Recomputing from the sorted roster
// reshuffled everyone whenever a player joined or left.
function teamFor(id) {
  if (!SERVER_TEAM_MODES.has(roomMode)) return null;
  const client = clients.get(id);
  return client && (client.team === 'red' || client.team === 'blue') ? client.team : null;
}

function balancedTeam(except) {
  let red = 0, blue = 0;
  for (const c of clients.values()) {
    if (c === except || !c.joined) continue;
    if (c.team === 'red') red++;
    else if (c.team === 'blue') blue++;
  }
  return blue < red ? 'blue' : 'red';
}

function setTeam(target, team, by) {
  target.team = team;
  releaseRide(target, 'team');
  if (target.hp > 0) {
    target.hp = MAX_HP;
    target.lastDamageAt = -Infinity;
    target.healthAt = nowMs();
  }
  // The switched player moves to the new team's spawn.
  target.spawnAllowedUntil = nowMs() + 5000;
  broadcast({ t: 'teamSet', id: target.id, team, by: by.id, byName: by.name,
    generation: worldGeneration, authoritative: true });
  broadcastRoster();
  log(target.name + ' moved to ' + team + (by !== target ? ' by ' + by.name : ''));
}

function enemies(a, b) {
  if (a === b) return false;
  const team = teamFor(a.id);
  return !team || team !== teamFor(b.id);
}

function matchConfig() {
  return {
    t: 'match', mode: roomMode, seed: worldSeed, generation: worldGeneration,
    hostId, epoch: SERVER_SESSION, forceRideable: ALLOW_FORCE_RIDEABLE,
    dragonCount: SERVER_DRAGON_RULES.count(worldSeed), dragons: publicDragonCatalog(),
    scores: { ...roomScores }, scoreSeq: killSerial
  };
}

function broadcastRoster() {
  broadcast({
    t: 'roster', players: [...clients.values()].filter((c) => c.joined).map(publicPlayer),
    generation: worldGeneration, hostId, scores: { ...roomScores }, scoreSeq: killSerial
  });
}

function changeConfig(mode, seed, reset = false) {
  if (!reset && mode === roomMode && seed === worldSeed) return false;
  roomMode = mode;
  worldSeed = seed;
  worldGeneration++;
  roomScores.red = roomScores.blue = 0;
  edits.clear();
  dragonCatalog.clear();
  for (const client of clients.values()) {
    releaseRide(client, 'reset');
    client.pendingState.clear();
    if (client.historyTimer) { clearTimeout(client.historyTimer); client.historyTimer = null; }
    client.historyJob = null;
    client.editBatches.clear();
    client.shot = null;
    client.shots.clear();
    client.hp = MAX_HP;
    client.kills = client.deaths = 0;
    client.deathReported = false;
    client.deathEvent = null;
    client.life++;
    client.healthAt = nowMs();
    client.lastDamageAt = -Infinity;
    client.spawnAllowedUntil = nowMs() + 15000;
    client.reload = -1;
    client.aim = client.firing = client.fly = client.boost = client.dash = 0;
  }
  return true;
}

function advanceHealth(client) {
  const now = nowMs();
  if (client.hp > 0 && client.hp < MAX_HP && !SERVER_NO_REGEN_MODES.has(roomMode)) {
    const from = Math.max(client.healthAt, client.lastDamageAt + 6000);
    if (now > from) client.hp = Math.min(MAX_HP, client.hp + (now - from) * 0.014);
  }
  client.healthAt = now;
}

function sendHealth(client) {
  client.healthSentAt = nowMs();
  sendJSON(client, {
    t: 'health', id: client.id, hp: client.hp, kills: client.kills, deaths: client.deaths,
    life: client.life, sid: client.seqOut++, generation: worldGeneration
  });
}

function validPosition(x, y, z) {
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) &&
    x >= 0 && x <= WORLD_SIZE && z >= 0 && z <= WORLD_SIZE &&
    y >= Y_MIN && y <= Y_MAX;
}

/* Returns false only when the position is malformed/out of bounds. A
   teleport snap keeps the previous position but still accepts the pose. */
function applyPosition(client, msg, checkTeleport) {
  const hasX = msg.x !== undefined, hasY = msg.y !== undefined, hasZ = msg.z !== undefined;
  if (!hasX && !hasY && !hasZ) return true;
  const x = msg.x, y = msg.y, z = msg.z;
  if (!validPosition(x, y, z)) return false;
  if (client.spawnAllowedUntil > nowMs() && client.hp > 0) {
    checkTeleport = false;
    client.spawnAllowedUntil = 0;
  }
  if (checkTeleport) {
    const dx = x - client.x, dy = y - client.y, dz = z - client.z;
    const jump = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
    // Ordinary 90ms poses get the 24-block floor. Allow elapsed, bounded
    // travel after jitter/silence (including 40m/s flight/dashes), not a blanket
    // "fly" bypass. Fresh join/respawn explicitly authorises a new spawn.
    const elapsed = Math.max(0, (nowMs() - client.positionAt) / 1000);
    const limit = Math.max(MAX_TELEPORT, Math.min(96, elapsed * 64 + 4));
    if (jump > limit) {
      client.teleports++;
      healthTotals.teleports++;
      sendJSON(client, { t: 'correction', ...publicPlayer(client), sid: client.seqOut++ });
      return true;
    }
  }
  client.x = x;
  client.y = y;
  client.z = z;
  client.positionAt = nowMs();
  return true;
}

function serverDragonRoleMatches(entry, descriptor) {
  if (!entry || !descriptor || (entry.scale !== undefined && entry.scale !== descriptor.size) ||
      (entry.index !== undefined && entry.index !== descriptor.index) ||
      (entry.dragon !== undefined && entry.dragon !== descriptor.index)) return false;
  for (const key of SERVER_DRAGON_META) if (entry[key] !== undefined && entry[key] !== descriptor[key]) return false;
  for (const key of SERVER_DRAGON_ROUTE_FIELDS) if (entry[key] !== undefined && entry[key] !== descriptor[key]) return false;
  if (entry.catalog !== undefined) {
    if (!entry.catalog || typeof entry.catalog !== 'object' || Array.isArray(entry.catalog)) return false;
    for (const key of SERVER_DRAGON_CATALOG_BOUNDS) if (entry.catalog[key] !== descriptor.catalog[key]) return false;
  }
  return true;
}

function publicDragonCatalog() {
  const list = [];
  const count = SERVER_DRAGON_RULES.count(worldSeed);
  if (dragonCatalog.size !== count) return list;
  for (const entry of dragonCatalog.values()) {
    const descriptor = SERVER_DRAGON_RULES.descriptor(worldSeed, entry.index);
    if (!descriptor || entry.seed !== worldSeed || entry.generation !== worldGeneration ||
        !serverDragonRoleMatches(entry, descriptor)) return [];
    const item = { index: entry.index, seed: worldSeed, generation: worldGeneration,
      cx: entry.cx, cz: entry.cz, altitude: entry.altitude };
    for (const key of SERVER_DRAGON_META) item[key] = descriptor[key];
    list.push(item);
  }
  return list.sort((a, b) => a.index - b.index);
}

function setDragonCatalog(client, list, scope) {
  const count = SERVER_DRAGON_RULES.count(worldSeed);
  if (client.id !== hostId || !scope || scope.seed !== worldSeed || scope.generation !== worldGeneration ||
      (scope.dragonCount !== undefined && scope.dragonCount !== count) ||
      !Array.isArray(list) || list.length !== count) return false;
  const next = new Map();
  for (const entry of list) {
    if (!entry || !Number.isInteger(entry.index) || next.has(entry.index)) return false;
    const route = SERVER_DRAGON_RULES.descriptor(worldSeed, entry.index);
    const bounds = route && route.catalog;
    if (!route || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz) ||
        !Number.isFinite(entry.altitude) || entry.cx < bounds.minCX || entry.cx > bounds.maxCX ||
        entry.cz < bounds.minCZ || entry.cz > bounds.maxCZ ||
        entry.altitude < bounds.minAltitude || entry.altitude > bounds.maxAltitude ||
        (entry.seed !== undefined && entry.seed !== worldSeed) ||
        (entry.generation !== undefined && entry.generation !== worldGeneration) ||
        !serverDragonRoleMatches(entry, route)) return false;
    next.set(entry.index, { ...route, cx: entry.cx, cz: entry.cz, altitude: entry.altitude,
      generation: worldGeneration });
  }
  // A malformed/partial catalog cannot replace a previously valid family.
  dragonCatalog.clear();
  for (const [index, entry] of next) dragonCatalog.set(index, entry);
  return true;
}

function dragonCatalogPacket() {
  return { t: 'dragons', seed: worldSeed, generation: worldGeneration, epoch: SERVER_SESSION,
    dragonCount: SERVER_DRAGON_RULES.count(worldSeed), dragons: publicDragonCatalog() };
}

function dragonPosition(index, client) {
  const o = dragonCatalog.get(index);
  const route = SERVER_DRAGON_RULES.descriptor(worldSeed, index);
  if (!route || !o || o.seed !== worldSeed || o.generation !== worldGeneration) return null;
  const seconds = (SERVER_EPOCH + nowMs() + client.clockOffset) / 1000;
  const phase = route.phase;
  const angle = seconds % route.period / route.period * Math.PI * 2 * route.direction + phase;
  const c = Math.cos(angle), s = Math.sin(angle), cos = Math.cos(route.rotation), sin = Math.sin(route.rotation);
  return {
    x: o.cx + route.rx * c * cos - route.rz * s * sin,
    y: o.altitude + route.tiltX * c + route.tiltZ * s + 0.6 * Math.sin(2 * angle + phase),
    z: o.cz + route.rx * c * sin + route.rz * s * cos
  };
}

function rideIndex(msg) {
  if (msg.dragon !== undefined && msg.index !== undefined && msg.dragon !== msg.index) return -1;
  const index = msg.dragon === undefined ? msg.index : msg.dragon;
  return Number.isInteger(index) && index >= 0 && index < SERVER_DRAGON_RULES.count(worldSeed) ? index : -1;
}

function ridePacket(lease, active, reason) {
  return {
    t: active ? 'rideGrant' : 'ride', id: lease.id, riderId: lease.id, active: active ? 1 : 0,
    dragon: lease.index, index: lease.index, lease: lease.token,
    x: lease.x, y: lease.y, z: lease.z, yaw: lease.yaw, pitch: lease.pitch,
    remainingMs: active ? Math.max(0, lease.until - nowMs()) : 0,
    generation: worldGeneration, seed: worldSeed, dragonCount: SERVER_DRAGON_RULES.count(worldSeed), reason
  };
}

function releaseRide(client, reason) {
  const lease = riderLeases.get(client.ride);
  client.ride = -1;
  if (!lease || lease.id !== client.id) return;
  riderLeases.delete(lease.index);
  client.spawnAllowedUntil = nowMs() + 1500; // safe forced-dismount landing
  broadcast(ridePacket(lease, false, reason));
}

function denyRide(client, index, reason) {
  sendJSON(client, { t: 'rideDenied', id: client.id, riderId: client.id, dragon: index, index, reason,
    generation: worldGeneration, seed: worldSeed, dragonCount: SERVER_DRAGON_RULES.count(worldSeed) });
}

function handleRide(client, msg) {
  const index = rideIndex(msg), now = nowMs();
  if (poseFlag(msg.active, -1) === 0) {
    const active = riderLeases.get(client.ride);
    if (active && (index !== active.index || (msg.lease !== undefined && msg.lease !== active.token))) {
      denyRide(client, index, 'stale lease'); return;
    }
    releaseRide(client, 'manual'); return;
  }
  if (index < 0 || poseFlag(msg.active, -1) !== 1 || client.hp <= 0 ||
      SERVER_MODES[roomMode] ||
      !serverDragonRoleMatches(msg, SERVER_DRAGON_RULES.descriptor(worldSeed, index)) ||
      !validPosition(msg.x, msg.y, msg.z) || !Number.isFinite(msg.yaw) || !Number.isFinite(msg.pitch)) {
    denyRide(client, index, 'invalid'); return;
  }
  // The demo/test flag never changes classes: guardians are always denied,
  // and every actual small mount is eligible for any player.
  if (!SERVER_DRAGON_RULES.isRideable(worldSeed, index)) { denyRide(client, index, 'not rideable'); return; }
  let lease = riderLeases.get(index);
  if (lease && lease.until <= now) {
    const rider = clients.get(lease.id);
    if (rider) releaseRide(rider, 'time');
    lease = null;
  }
  if (lease && lease.id !== client.id) { denyRide(client, index, 'occupied'); return; }
  if (client.ride >= 0 && client.ride !== index) { denyRide(client, index, 'already riding'); return; }
  if (!lease) {
    const ambient = dragonPosition(index, client);
    if (!ambient) { denyRide(client, index, 'world pending'); return; }
    if (Math.hypot(msg.x - ambient.x, msg.y - ambient.y, msg.z - ambient.z) > MOUNT_RANGE + 3 ||
        Math.hypot(msg.x - client.x, msg.y - client.y, msg.z - client.z) > MOUNT_RANGE + 3) {
      denyRide(client, index, 'out of range'); return;
    }
    lease = {
      id: client.id, index, token: SERVER_SESSION + ':ride:' + (++rideSerial),
      until: now + RIDE_MS, at: now, breathAt: -Infinity,
      x: msg.x, y: msg.y, z: msg.z, yaw: poseYaw(msg.yaw, 0), pitch: poseNumber(msg.pitch, 0, -1.5, 1.5)
    };
    riderLeases.set(index, lease);
    client.ride = index;
    client.aim = client.firing = 0;
    client.shot = null;
    client.shots.clear();
    broadcast(ridePacket(lease, true, 'granted'));
    return;
  }
  // Repeated active updates do not renew the original 30-second deadline.
  if (msg.lease !== undefined && msg.lease !== lease.token) { denyRide(client, index, 'stale lease'); return; }
  const limit = Math.max(8, Math.min(96, (now - lease.at) * 0.048 + 3));
  if (Math.hypot(msg.x - lease.x, msg.y - lease.y, msg.z - lease.z) > limit) {
    noteDrop(client); sendJSON(client, ridePacket(lease, true, 'correction')); return;
  }
  lease.x = msg.x; lease.y = msg.y; lease.z = msg.z;
  lease.yaw = poseYaw(msg.yaw, lease.yaw);
  lease.pitch = poseNumber(msg.pitch, lease.pitch, -1.5, 1.5);
  lease.at = now;
  broadcast({ ...ridePacket(lease, true, 'pose'), t: 'ride' }, client);
}

function deathEvent(victim, killer, weapon, head) {
  if (victim.deathReported) return victim.deathEvent;
  victim.hp = 0;
  victim.deathReported = true;
  victim.deathAt = nowMs();
  victim.deaths++;
  victim.aim = victim.firing = victim.fly = victim.boost = victim.dash = 0;
  victim.reload = -1;
  victim.shot = null;
  victim.shots.clear();
  releaseRide(victim, 'death');
  if (killer && enemies(killer, victim)) {
    killer.kills++;
    const team = teamFor(killer.id);
    if (team) roomScores[team]++;
  }
  else killer = null;
  const event = {
    t: 'died', id: victim.id, victimId: victim.id, victim: victim.name,
    killerId: killer ? killer.id : '', byId: killer ? killer.id : '', by: killer ? killer.name : '???',
    weapon, head: !!head, killId: SERVER_SESSION + ':' + worldGeneration + ':' + (++killSerial),
    scores: { ...roomScores }, scoreSeq: killSerial,
    authoritative: true, life: victim.life, sid: victim.seqOut++, generation: worldGeneration,
    kills: victim.kills, deaths: victim.deaths, killerKills: killer ? killer.kills : undefined,
    victimTeam: teamFor(victim.id), killerTeam: killer ? teamFor(killer.id) : null,
    victimPos: { x: victim.x, y: victim.y, z: victim.z },
    killerPos: killer ? { x: killer.x, y: killer.y, z: killer.z } : null
  };
  victim.deathEvent = event;
  return event;
}

function damageTarget(attacker, target, damage, weapon, head, eventId, shotId) {
  advanceHealth(target);
  if (target.hp <= 0 || !enemies(attacker, target)) return;
  const base = Math.min(SERVER_WEAPONS[weapon] ? SERVER_WEAPONS[weapon].damage * (head ? SERVER_WEAPONS[weapon].head : 1) : BREATH_DAMAGE, damage);
  const amount = Math.round(base * (SERVER_WEAPONS[weapon] ? SERVER_MODE_DAMAGE[roomMode] || 1 : 1));
  target.hp = Math.max(0, target.hp - amount);
  target.lastDamageAt = target.healthAt = nowMs();
  const kill = target.hp <= 0 ? deathEvent(target, attacker, weapon, head) : null;
  const hit = {
    t: 'hit', target: target.id, dmg: amount, health: target.hp, head, weapon,
    byId: attacker.id, by: attacker.name, eventId, kill, life: target.life, sid: target.seqOut++,
    shotId: shotId || undefined,
    generation: worldGeneration, authoritative: true,
    from: { x: attacker.x, y: attacker.y, z: attacker.z }
  };
  sendJSON(target, hit);
  // The shooter needs the accepted damage/HP too. Do not infer floating
  // numbers from an optimistic hit or broadcast private hit feedback to all.
  if (attacker !== target) sendJSON(attacker, hit);
  if (kill) broadcast(kill);
  broadcastState({ t: 'state', ...publicPlayer(target), sid: target.seqOut++ });
}

function handleBreath(client, msg) {
  const index = rideIndex(msg), lease = riderLeases.get(index), now = nowMs();
  if (!SERVER_DRAGON_RULES.isRideable(worldSeed, index) || !lease || lease.id !== client.id || lease.until <= now || client.hp <= 0 ||
      !serverDragonRoleMatches(msg, SERVER_DRAGON_RULES.descriptor(worldSeed, index)) ||
      (msg.lease !== undefined && msg.lease !== lease.token) || !validPosition(msg.x, msg.y, msg.z) ||
      Math.hypot(msg.x - lease.x, msg.y - lease.y, msg.z - lease.z) > 10 ||
      !Number.isFinite(msg.dx) || !Number.isFinite(msg.dy) || !Number.isFinite(msg.dz)) {
    noteDrop(client); return;
  }
  const length = Math.hypot(msg.dx, msg.dy, msg.dz);
  if (length < 0.5 || length > 1.5 || now - lease.breathAt < BREATH_MS ||
      (msg.targets !== undefined && (!Array.isArray(msg.targets) || msg.targets.length > MAX_PLAYERS ||
        msg.targets.some((id) => !cleanId(id))))) { noteDrop(client); return; }
  lease.breathAt = now;
  const dx = msg.dx / length, dy = msg.dy / length, dz = msg.dz / length;
  const targets = [];
  for (const target of clients.values()) {
    if (!target.joined || target.hp <= 0 || !enemies(client, target) ||
        (msg.targets && !msg.targets.includes(target.id))) continue;
    const x = target.x - msg.x, y = target.y + target.height * 0.55 - msg.y, z = target.z - msg.z;
    const distance = Math.hypot(x, y, z);
    if (distance > BREATH_RANGE || (distance > 0.001 && (x * dx + y * dy + z * dz) / distance < BREATH_COS)) continue;
    targets.push(target.id);
    damageTarget(client, target, BREATH_DAMAGE, 'dragon', false, lease.token + ':breath:' + now);
  }
  broadcast({
    t: 'breath', id: client.id, riderId: client.id, dragon: index, lease: lease.token,
    x: msg.x, y: msg.y, z: msg.z, dx, dy, dz, targets,
    generation: worldGeneration, seed: worldSeed, dragonCount: SERVER_DRAGON_RULES.count(worldSeed), authoritative: true
  }, client);
}

function handleMessage(client, msg, bytes) {
  if (client.closed) return;
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.t !== 'string') {
    allowMessage(client, bytes); noteDrop(client); return;
  }

  // Ping is answered before any token bucket or state throttling so latency
  // measurement survives a client that is currently rate-limited.
  if (msg.t === 'ping') {
    const now = nowMs();
    // A separate control lane keeps genuine ping independent of gameplay
    // throttling without letting an unmetered ping flood fill the TX queue.
    if (!Number.isFinite(msg.at)) return;
    if (now - client.lastPingAt < 200) { noteDrop(client); return; }
    client.lastPingAt = now;
    const pong = { t: 'pong', at: msg.at };
    if (Number.isSafeInteger(msg.seq)) pong.seq = msg.seq;
    sendJSON(client, pong);
    return;
  }

  if (!allowMessage(client, bytes)) return;

  if (msg.t === 'join') {
    if (!allowState(client) || !validPosition(msg.x, msg.y, msg.z)) { noteDrop(client); return; }
    if (!acceptSequence(client, msg)) return;
    const firstJoin = !client.joined;
    if (firstJoin) client.generationAware = msg.generation !== undefined;
    const joinSeed = toUint32(msg.seed);
    if (!hostId) {
      hostId = client.id; // first valid JOIN, not the first idle upgrade socket
      changeConfig(validMode(msg.mode) ? msg.mode : roomMode, joinSeed === null ? worldSeed : joinSeed);
    }
    const currentJoin = firstJoin || !client.generationAware || msg.generation === worldGeneration;
    if (currentJoin && !applyPosition(client, msg, !firstJoin)) return;
    if (!client.team) client.team = balancedTeam(client);
    client.joined = true;
    if (firstJoin && Number.isFinite(msg.at)) client.clockOffset = Math.max(-86400000, Math.min(86400000, msg.at - SERVER_EPOCH - nowMs()));
    if (firstJoin && Number.isFinite(msg.clockAt) && msg.clockAt >= 0 && msg.clockAt <= Number.MAX_SAFE_INTEGER) {
      client.fireClockOrigin = nowMs() - msg.clockAt;
    }
    if (firstJoin && (joinSeed !== worldSeed || msg.mode !== roomMode)) client.spawnAllowedUntil = nowMs() + 15000;
    client.name = cleanText(msg.name, client.name || 'Player', 14);
    client.character = cleanCharacter(msg.character);
    if (currentJoin) applyClientPose(client, msg);
    if (joinSeed === worldSeed && currentJoin) setDragonCatalog(client, msg.dragons, msg);
    const history = [...edits.values()];

    sendJSON(client, {
      id: client.id,
      ...matchConfig(), t: 'welcome', at: SERVER_EPOCH + nowMs(),
      self: publicPlayer(client),
      players: [...clients.values()].filter((c) => c !== client && c.joined).map(publicPlayer),
      edits: history.slice(0, 128)
    });
    // History is paged, so a full 6000-edit room cannot create a giant frame.
    if (client.historyTimer) { clearTimeout(client.historyTimer); client.historyTimer = null; }
    client.historyJob = history.length > 128 ? { edits: history, cursor: 128, generation: worldGeneration } : null;
    if (client.historyJob) client.historyTimer = setTimeout(() => flushEditHistory(client), 25);
    for (const lease of riderLeases.values()) sendJSON(client, { ...ridePacket(lease, true, 'snapshot'), t: 'ride' });
    if (client.deathReported && client.deathEvent) sendJSON(client, client.deathEvent);
    broadcastState({ t: 'join', player: publicPlayer(client), sid: client.seqOut++, generation: worldGeneration }, client);
    broadcast(matchConfig());
    broadcastRoster();
    log(client.name + ' joined as ' + client.character + ' (' + clients.size + ' online, seed ' + worldSeed + ')');
    return;
  }

  if (msg.t === 'leave') { closeClient(client); return; }
  if (!client.joined) { noteDrop(client); return; }

  if (msg.t === 'seed' || msg.t === 'match') {
    const seed = msg.seed === undefined ? worldSeed : toUint32(msg.seed);
    const mode = msg.mode === undefined ? roomMode : msg.mode;
    if (client.id !== hostId || seed === null || !validMode(mode) ||
        (msg.generation !== undefined && msg.generation !== worldGeneration)) {
      sendJSON(client, matchConfig()); noteDrop(client); return;
    }
    const changed = changeConfig(mode, seed, msg.reset === true);
    // A reset retires the old catalog even when the seed/count happens to be
    // unchanged. The ready host re-announces with the new generation.
    if (!changed) setDragonCatalog(client, msg.dragons, { ...msg, seed });
    broadcast(matchConfig());
    if (msg.t === 'seed') broadcast({ ...matchConfig(), t: 'seed', by: client.id });
    broadcastRoster();
    return;
  }

  if ((client.generationAware || msg.generation !== undefined) && msg.generation !== worldGeneration) {
    noteDrop(client); return;
  }
  if (['dragons', 'ride', 'breath'].includes(msg.t) &&
      (msg.generation !== worldGeneration || msg.seed !== worldSeed ||
        (msg.dragonCount !== undefined && msg.dragonCount !== SERVER_DRAGON_RULES.count(worldSeed)))) {
    noteDrop(client); return;
  }
  if (msg.epoch !== undefined && msg.epoch !== SERVER_SESSION) { noteDrop(client); return; }
  if (msg.life !== undefined && (!Number.isSafeInteger(msg.life) || msg.life !== client.life)) {
    sendHealth(client); noteDrop(client); return;
  }
  if (!acceptSequence(client, msg)) return;
  if (msg.t === 'dragons') {
    if (setDragonCatalog(client, msg.dragons, msg)) broadcast(dragonCatalogPacket());
    return;
  }
  if (msg.t === 'team') {
    // Anyone may switch their own team; only the host may move other players.
    const target = clients.get(cleanId(msg.target) || client.id);
    if (!target || !target.joined || (msg.team !== 'red' && msg.team !== 'blue') ||
        (target !== client && client.id !== hostId)) { noteDrop(client); return; }
    if (target.team !== msg.team) setTeam(target, msg.team, client);
    return;
  }
  if (msg.t === 'ride') { if (allowState(client)) handleRide(client, msg); return; }
  if (msg.t === 'breath') { handleBreath(client, msg); return; }

  if (msg.t === 'state') {
    if (!allowState(client)) return;
    if (!validPosition(msg.x, msg.y, msg.z) || !applyPosition(client, msg, true)) { noteDrop(client); return; }
    applyClientPose(client, msg);
    if (typeof msg.name === 'string') client.name = cleanText(msg.name, client.name, 14);
    if (typeof msg.character === 'string') client.character = cleanCharacter(msg.character);
    broadcastState({ t: 'state', ...publicPlayer(client), sid: client.seqOut++ }, client);
    if (Number.isFinite(msg.hp) && Math.abs(msg.hp - client.hp) > 0.5 && nowMs() - client.healthSentAt > 1000) sendHealth(client);
    return;
  }

  if (msg.t === 'reload') {
    if (!allowState(client) || !applyPosition(client, msg, true)) { noteDrop(client); return; }
    applyClientPose(client, msg);
    broadcastState({ t: 'reload', ...publicPlayer(client), sid: client.seqOut++ }, client);
    return;
  }

  if (msg.t === 'edit' || msg.t === 'edits') {
    const batchId = cleanToken(msg.batchId);
    const list = msg.t === 'edit' ? [msg] : msg.edits;
    if (batchId && client.editBatches.has(batchId)) {
      const current = Array.isArray(list) && list.length <= MAX_EDIT_BATCH
        ? list.map((cell) => cell && edits.get(cell.x + ',' + cell.y + ',' + cell.z)).filter(Boolean) : [];
      sendJSON(client, { t: 'editAck', batchId, edits: current, generation: worldGeneration }); return;
    }
    if (!Array.isArray(list) || !list.length || list.length > MAX_EDIT_BATCH || list.some((cell) => !validEditCell(cell, client))) {
      if (batchId) sendJSON(client, { t: 'editReject', batchId, reason: 'shape/range', retryable: false, generation: worldGeneration });
      noteDrop(client); return;
    }
    if (!allowEdit(client, list.length)) {
      if (batchId) sendJSON(client, { t: 'editReject', batchId, reason: 'rate', retryable: true,
        retryMs: Math.ceil((list.length - client.editTokens) * 1000 / MAX_EDITS_PER_SEC) + 25, generation: worldGeneration });
      return;
    }
    const accepted = list.map(rememberEdit);
    // Echo authority to the origin too. Another player's accepted edit may
    // have replaced its optimistic cell before this transaction was accepted.
    broadcast(msg.t === 'edit' ? accepted[0] : { t: 'edits', edits: accepted, batchId, by: client.id, generation: worldGeneration });
    if (batchId) {
      client.editBatches.set(batchId, true);
      while (client.editBatches.size > 512) client.editBatches.delete(client.editBatches.keys().next().value);
      sendJSON(client, { t: 'editAck', batchId, edits: accepted, generation: worldGeneration });
    }
    return;
  }

  if (msg.t === 'voxelHit') {
    if (client.ride >= 0 || !client.combat || client.hp <= 0 || serverReloadProgress(client) >= 0) return;
    const hit = cleanVoxelHit(msg, client.id);
    if (!hit || !weaponAllowed(hit.weapon) || hit.weapon !== client.weapon) { noteDrop(client); return; }
    const origin = shotFor(client, msg) || client;
    if (Math.hypot(hit.x + 0.5 - origin.x, hit.y + 0.5 - origin.y, hit.z + 0.5 - origin.z) > SERVER_WEAPONS[hit.weapon].range + 2) {
      noteDrop(client); return;
    }
    if (!fireLock(client, hit.weapon, 'voxelHit', msg)) return;
    broadcast(hit, client);
    return;
  }

  if (msg.t === 'shot') {
    applyClientPose(client, msg);
    if (client.ride >= 0 || !client.combat || client.hp <= 0 || serverReloadProgress(client) >= 0 || !weaponAllowed(msg.weapon)) return;
    if (!validPosition(msg.x, msg.y, msg.z) ||
        Math.hypot(msg.x - client.x, msg.y - client.y, msg.z - client.z) >
          10 + Math.min(16, Math.max(0, nowMs() - client.positionAt) * 0.05)) {
      noteDrop(client); return;
    }
    if (!fireLock(client, client.weapon, 'shot', msg)) return;
    broadcast({
      t: 'shot',
      id: client.id,
      weapon: client.weapon,
      x: msg.x, y: msg.y, z: msg.z,
      yaw: client.yaw, pitch: client.pitch, aim: client.aim, firing: 1,
      combat: client.combat, build: client.build, reload: -1,
      shotId: cleanToken(msg.shotId), sid: client.seqOut++, generation: worldGeneration
    }, client);
    return;
  }

  if (msg.t === 'hit') {
    // The shot itself already passed the reload/fire gates. Re-checking an
    // extrapolated reload here dropped pellets that arrived just after a pose.
    if (client.ride >= 0 || client.hp <= 0) return;
    const target = clients.get(cleanId(msg.target));
    if (!target || !target.joined || target.hp <= 0 || !enemies(client, target)) return;
    const weapon = msg.weapon;
    if (!weaponAllowed(weapon) || weapon !== client.weapon) { noteDrop(client); return; }
    const w = SERVER_WEAPONS[weapon];
    const head = poseFlag(msg.head, 0);
    const maxDamage = w.damage * (head ? w.head : 1);
    const dmg = msg.dmg;
    const origin = shotFor(client, msg) || client;
    const distance = Math.hypot(target.x - origin.x, target.y + target.height * 0.55 - origin.y, target.z - origin.z);
    if (!Number.isFinite(dmg) || dmg <= 0 || dmg > maxDamage || distance > Math.min(w.range, 120) + 2) {
      noteDrop(client);
      return;
    }
    if (!fireLock(client, weapon, 'hit', msg)) return;
    damageTarget(client, target, dmg, weapon, head, cleanToken(msg.eventId) || SERVER_SESSION + ':hit:' + client.id + ':' + nowMs(), cleanToken(msg.shotId));
    return;
  }

  if (msg.t === 'died') {
    if (client.deathReported) { sendJSON(client, client.deathEvent); return; }
    // Environmental/self death is allowed, but client-supplied attribution can
    // never manufacture a kill for another player.
    broadcast(deathEvent(client, null, 'world', false));
    return;
  }

  if (msg.t === 'respawn') {
    if (!client.deathReported) { sendHealth(client); return; }
    if (client.deathReported && nowMs() - client.deathAt < RESPAWN_MS - 700) { sendHealth(client); return; }
    if (!validPosition(msg.x, msg.y, msg.z) || !applyPosition(client, msg, false)) { noteDrop(client); return; }
    if (client.deathReported) {
      client.hp = MAX_HP;
      client.life++;
      client.lastDamageAt = -Infinity;
    }
    applyClientPose(client, msg);
    client.reload = -1;
    client.aim = client.firing = 0;
    client.deathReported = false;
    client.deathEvent = null;
    client.shot = null;
    client.shots.clear();
    client.spawnAllowedUntil = 0;
    broadcast({ t: 'respawn', ...publicPlayer(client), sid: client.seqOut++ });
  }
}

/* ---------------- heartbeat ---------------- */

const heartbeat = setInterval(() => {
  const now = nowMs();
  for (const client of [...clients.values()]) {
    if (client.closed) continue;
    if (now - client.lastRxAt > CLIENT_TIMEOUT_MS) {
      log('client ' + client.id + ' timed out');
      closeClient(client);
      continue;
    }
    flushSocketQueue(client);
    const lease = riderLeases.get(client.ride);
    if (lease && lease.until <= now) releaseRide(client, 'time');
    if (now - client.lastTickAt >= HEARTBEAT_MS) {
      client.lastTickAt = now;
      sendJSON(client, { t: 'tick', at: SERVER_EPOCH + now, generation: worldGeneration });
    }
  }
}, 1000);

/* ---------------- upgrade ---------------- */

server.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(key) ||
      req.headers['sec-websocket-version'] !== '13' ||
      String(req.headers.upgrade).toLowerCase() !== 'websocket') {
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

  const createdAt = nowMs();
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
    hp: MAX_HP,
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
    boost: 0, fly: 0, onGround: 1, fuel: 100, dash: 0, height: 1.8,
    life: 1, ride: -1, joined: false, team: null,
    deathAt: 0, deathEvent: null,
    lastDamageAt: -Infinity, healthAt: createdAt, healthSentAt: 0,
    positionAt: createdAt, spawnAllowedUntil: 0, clockOffset: 0,
    buffer: Buffer.alloc(0),
    discardBytes: 0,
    txQueue: [], txBytes: 0,
    rx: 0,
    tx: 0,
    dropped: 0,
    teleports: 0,
    seqIn: 0,
    seqOut: 1,
    msgTokens: MSG_BURST,
    byteTokens: MAX_BYTES_PER_SEC,
    bucketAt: createdAt,
    lastDropAt: 0,
    abuseSince: 0,
    byteWindowAt: createdAt,
    byteWindow: 0,
    byteAbuseSince: null,
    stateWindowAt: createdAt,
    stateWindowCount: 0,
    editWindowAt: createdAt,
    editCount: 0, editTokens: EDIT_BURST, editBatches: new Map(), generationAware: false,
    historyJob: null, historyTimer: null,
    outNextAt: createdAt,
    pendingState: new Map(),
    pendingTimer: null,
    lastRxAt: createdAt,
    lastTickAt: createdAt,
    lastShotAt: -Infinity, lastFireAt: -Infinity, lastFireInterval: 0,
    fireClockOrigin: null, seenShot: false, shot: null, shots: new Map(), lastPingAt: -Infinity,
    closed: false
  };
  clients.set(client.id, client);

  const onData = (chunk) => {
    if (client.closed) return;
    const now = nowMs();
    client.lastRxAt = now;
    if (trackInboundBytes(client, chunk.length, now)) return;
    if (client.discardBytes && !client.buffer.length) {
      const skip = Math.min(client.discardBytes, chunk.length);
      client.discardBytes -= skip;
      chunk = chunk.subarray(skip);
      if (!chunk.length) return;
    }
    if (client.buffer.length + chunk.length > MAX_BUFFER_BYTES) {
      log('client ' + client.id + ' exceeded the inbound buffer cap');
      try { socket.destroy(); } catch (e) { /* ignore */ }
      closeClient(client);
      return;
    }
    client.buffer = client.buffer.length ? Buffer.concat([client.buffer, chunk]) : chunk;
    processFrames(client);
  };
  socket.on('data', onData);
  socket.on('drain', () => flushSocketQueue(client));
  socket.on('close', () => closeClient(client));
  socket.on('error', () => closeClient(client));
  if (head && head.length) onData(head);
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

/* Keep the heartbeat from keeping a dead test process alive forever. */
if (typeof heartbeat.unref === 'function') heartbeat.unref();
