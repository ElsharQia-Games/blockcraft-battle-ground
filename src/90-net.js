/* Blockcraft Battle Ground — LAN WebSocket + internet MQTT transport, rooms and remote players.
   90-net.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ============================================================
   Multiplayer: LAN WebSocket server + internet MQTT relay
   ============================================================ */
const NET_SEND_MS = 50;
const NET_MAX_QUEUE = 48;
const NET_MAX_EDITS = 6000;
const NET_MAX_PEERS = 32;
const NET_FIRE_MS = { pistol: 167, rifle: 94, shotgun: 800, smg: 68, sniper: 1430, revolver: 353, lmg: 100 };
const NET_MODE_WEAPONS = { tdm: null, ffa: null, gungame: null, moon: null, hardcore: null, snipers: ['sniper'],
  shotguns: ['shotgun'], sidearms: ['pistol', 'revolver'], lockdown: ['rifle', 'smg', 'shotgun', 'revolver'] };
// Authority-side mode rules; keep in sync with MODES (15-modes.js) and server.js.
const NET_TEAM_MODES = new Set(['tdm', 'lockdown', 'moon', 'hardcore']);
const NET_MODE_DAMAGE = { hardcore: 1.5 };
const NET_NO_REGEN_MODES = new Set(['hardcore']);
function netModeDamage() { return NET_MODE_DAMAGE[net.matchMode] || 1; }
const NET_MAX_FRAME = 32 * 1024;
const NET_INTERP_MS = 100;  // draw other players this far in the past, so a lost packet never shows
const NET_MAX_BUFFER = 256 * 1024;
const NET_SHOT_WINDOW = 1000;
const NET_PEER_TIMEOUT = 16000;
const NET_BREATH_COS = Math.cos(32 * Math.PI / 180);
const NET_EDIT_RATE = 128;
const NET_EDIT_BURST = 192;
const NET_EDIT_BATCH = 64;
const NET_EDIT_FLIGHT_LIMIT = 16;
const NET_DRAGON_META = ['kind', 'type', 'role', 'routeFamily', 'size', 'rideable', 'ambient', 'indestructible', 'invulnerable'];
const NET_DRAGON_ROUTE_FIELDS = ['rx', 'rz', 'rotation', 'period', 'direction', 'tiltX', 'tiltZ', 'phase', 'flap', 'glide', 'swayPeriod', 'centerMode'];
const NET_DRAGON_CATALOG_BOUNDS = ['minCX', 'maxCX', 'minCZ', 'maxCZ', 'minAltitude', 'maxAltitude'];

const net = {
  mode: null,            // null | 'ws' | 'mqtt'
  ws: null, id: null, online: false, players: new Map(),
  attempts: 0, lastSent: 0, warned: false, closedByUs: false,
  room: '',
  ping: 0, jitter: 0, lastPong: 0, lastRx: 0,
  seq: 0, stateSeq: 0, rxSeq: new Map(), pingTimer: null,
  desync: false, sendBlockedUntil: 0, outbox: [], flushTimer: null,
  packetCount: 0, lastPacketAt: 0, lastPingReplyAt: 0,
  hostId: null, generation: 0, seed: null, matchMode: null, epoch: '',
  session: 0, onlineAt: 0, reconnectTimer: null, openTimer: null,
  pingSeq: 0, pings: new Map(), eventSeq: 0, shotId: '',
  configTask: null, configPending: false, configVersion: 0, appliedVersion: 0,
  configError: false, localReset: false, applyingConfig: false,
  pendingEdits: new Map(), editHistory: new Map(), editSeq: new Map(),
  authPlayers: new Map(), rides: new Map(), dragonCatalog: new Map(), seenHits: new Set(), seenKills: new Set(),
  killContext: null, damageContext: null, forceRideable: false,
  localLife: 0, healthSid: -1, pingSource: '', authorityReady: false,
  localWorldReset: false, seenShots: new Set(),
  pendingConfig: null, editOut: new Map(), editTokens: NET_EDIT_BURST, editAt: 0,
  editInFlight: new Map(), matchScores: { red: 0, blue: 0 }, scoreSeq: -1
};

// Host-side room state. The transport itself lives in 91-room.js.
const mqtt = {
  clientId: null, room: '', tick: null, lastRosterAt: 0, lastJoinAt: 0,
  pendingStates: new Map(), stateTimer: null, stateFlushAt: 0, historyJobs: new Map(),
  graceTimers: new Map(), limiters: new Map(), wireSeq: 0, editSerial: 0, scoreSerial: 0
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
  let text = String(v == null ? '' : v).trim();
  const invite = /[?&]room=([^&#\s]+)/i.exec(text);
  if (invite) {
    try { text = decodeURIComponent(invite[1]); } catch (e) { return ''; }
  } else if (/[/:?]/.test(text)) return ''; // do not turn an unrelated URL into a bogus room
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}
function randomRoom() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/* ---------------- status / seed / ping helpers ---------------- */
function netAPI(name) {
  return typeof BC !== 'undefined' && BC.api ? BC.api[name] : null;
}

function netValidId(id) { return typeof id === 'string' && /^[\w-]{1,40}$/.test(id); }
function netToken(value) { return typeof value === 'string' && /^[\w.:-]{1,96}$/.test(value) ? value : ''; }
function netValidSeed(seed) { return Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff; }
function netValidMode(mode) { return typeof mode === 'string' && Object.prototype.hasOwnProperty.call(NET_MODE_WEAPONS, mode); }
function netValidPosition(p) {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) &&
    p.x >= 0 && p.x <= WORLD && p.z >= 0 && p.z <= WORLD && p.y >= -8 && p.y <= HEIGHT + 48;
}
function netEpochNow() {
  return (Number.isFinite(performance.timeOrigin) ? performance.timeOrigin : Date.now() - performance.now()) + performance.now();
}
function netWorldBusy() {
  const world = netAPI('world');
  return net.configPending || net.localReset || !!(world && world.busy) ||
    !!(typeof BC !== 'undefined' && BC.flags && BC.flags.worldBusy);
}
function netCurrentMode() {
  const modes = netAPI('modes');
  return modes && netValidMode(modes.active) ? modes.active : 'ffa'; // legacy LAN has no modes module
}

function netCurrentSeed() {
  try {
    if (BC.api && BC.api.world && typeof BC.api.world.seed === 'function') {
      const seed = BC.api.world.seed();
      if (Number.isFinite(seed)) return seed >>> 0;
    }
    if (typeof SEED !== 'undefined' && Number.isFinite(SEED)) return SEED >>> 0;
  } catch (e) { /* ignore */ }
  return null;
}

// Classic scripts may expose the rules after this file is evaluated. Resolve
// lazily, and fail closed rather than inventing a second count/eligibility RNG.
function netDragonRules() {
  const rules = typeof window !== 'undefined' ? window.BCDragonRules : null;
  return rules && typeof rules.count === 'function' && typeof rules.isRideable === 'function' &&
    typeof rules.descriptor === 'function' ? rules : null;
}

function netDragonCount(seed) {
  if (seed === undefined) seed = net.seed === null ? netCurrentSeed() : net.seed;
  const rules = netDragonRules();
  return rules && netValidSeed(seed) ? rules.count(seed) : 0;
}

function netDragonRideable(index, seed) {
  if (seed === undefined) seed = net.seed === null ? netCurrentSeed() : net.seed;
  const rules = netDragonRules();
  return !!(rules && netValidSeed(seed) && rules.isRideable(seed, index));
}

function netDragonIndex(msg, seed) {
  if (!msg || (msg.dragon !== undefined && msg.index !== undefined && msg.dragon !== msg.index)) return -1;
  const index = msg.dragon === undefined ? msg.index : msg.dragon;
  return Number.isInteger(index) && index >= 0 && index < netDragonCount(seed) ? index : -1;
}

function netDragonRoleMatches(entry, descriptor) {
  if (!entry || !descriptor || (entry.scale !== undefined && entry.scale !== descriptor.size) ||
      (entry.index !== undefined && entry.index !== descriptor.index) ||
      (entry.dragon !== undefined && entry.dragon !== descriptor.index)) return false;
  for (const key of NET_DRAGON_META) if (entry[key] !== undefined && entry[key] !== descriptor[key]) return false;
  for (const key of NET_DRAGON_ROUTE_FIELDS) if (entry[key] !== undefined && entry[key] !== descriptor[key]) return false;
  if (entry.catalog !== undefined) {
    if (!entry.catalog || typeof entry.catalog !== 'object' || Array.isArray(entry.catalog)) return false;
    for (const key of NET_DRAGON_CATALOG_BOUNDS) if (entry.catalog[key] !== descriptor.catalog[key]) return false;
  }
  return true;
}

function netDragonCatalogEntry(entry, seed, generation) {
  const rules = netDragonRules();
  const descriptor = rules && netValidSeed(seed) && entry && rules.descriptor(seed, entry.index);
  const bounds = descriptor && descriptor.catalog;
  if (!descriptor || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz) || !Number.isFinite(entry.altitude) ||
      entry.cx < bounds.minCX || entry.cx > bounds.maxCX || entry.cz < bounds.minCZ || entry.cz > bounds.maxCZ ||
      entry.altitude < bounds.minAltitude || entry.altitude > bounds.maxAltitude ||
      (entry.seed !== undefined && entry.seed !== seed) ||
      (entry.generation !== undefined && entry.generation !== generation) || !netDragonRoleMatches(entry, descriptor)) return null;
  const out = { index: descriptor.index, seed, generation, cx: entry.cx, cz: entry.cz, altitude: entry.altitude };
  for (const key of NET_DRAGON_META) out[key] = descriptor[key];
  return out;
}

function netValidateDragonCatalog(list, seed, generation, count, allowPending) {
  const expected = netDragonCount(seed);
  if (!expected || !Number.isSafeInteger(generation) || generation < 0 ||
      (count !== undefined && count !== expected) || !Array.isArray(list)) return null;
  if (allowPending && !list.length) return [];
  if (list.length !== expected) return null;
  const out = new Array(expected);
  for (const entry of list) {
    const item = netDragonCatalogEntry(entry, seed, generation);
    if (!item || out[item.index]) return null;
    out[item.index] = item;
  }
  return out;
}

function netDragonCatalogSnapshot() {
  const out = [];
  for (const entry of net.dragonCatalog.values()) {
    if (entry.seed === net.seed && entry.generation === net.generation) out.push(entry);
  }
  return netValidateDragonCatalog(out, net.seed, net.generation, undefined, true) || [];
}

function netApplyDragonCatalog() {
  const rules = netDragonRules(), count = netDragonCount(net.seed);
  if (netWorldBusy() || netCurrentSeed() !== net.seed || typeof dragons === 'undefined' ||
      !count || dragons.length !== count || net.dragonCatalog.size !== count) return false;
  // Never install a controller or client-defined scale. The spawner owns the
  // shared route/rig/collider; only its bounded terrain-dependent offsets sync.
  for (const entry of net.dragonCatalog.values()) {
    const descriptor = rules.descriptor(net.seed, entry.index);
    const dragon = dragons[entry.index];
    if (!descriptor || entry.seed !== net.seed || entry.generation !== net.generation ||
        !netDragonRoleMatches(entry, descriptor) || !dragon || dragon.index !== entry.index || !dragon.orbit ||
        !netDragonRoleMatches(dragon.orbit, descriptor) ||
        (dragon.seed !== undefined && dragon.seed !== net.seed)) return false;
  }
  for (const entry of net.dragonCatalog.values()) {
    const dragon = dragons[entry.index], orbit = dragon.orbit;
    orbit.cx = entry.cx; orbit.cz = entry.cz; orbit.altitude = entry.altitude;
    // The collision-owned swept return/perch uses the same bounded center.
    // Updating its destination never teleports or replaces a local/remote rig.
    const home = dragon.motion && dragon.motion.home;
    if (home && typeof home.set === 'function') home.set(entry.cx, entry.altitude, entry.cz);
  }
  return true;
}

function netReceiveDragonCatalog(msg, by) {
  if (!msg || msg.seed !== net.seed || msg.generation !== net.generation || net.generation < 1 ||
      (net.mode === 'mqtt' && by !== net.hostId)) return false;
  const list = netValidateDragonCatalog(msg.dragons, msg.seed, msg.generation, msg.dragonCount, false);
  if (!list) return false;
  net.dragonCatalog.clear();
  for (const entry of list) net.dragonCatalog.set(entry.index, entry);
  netApplyDragonCatalog();
  return true;
}

function netDragonPacket() {
  const seed = netCurrentSeed();
  return { t: 'dragons', seed, dragonCount: netDragonCount(seed), dragons: netDragonCatalog() };
}

function netRiderMounted(id) {
  const now = performance.now();
  for (const [index, lease] of net.rides) {
    if (lease.id === id && lease.until > now && lease.seed === net.seed && lease.generation === net.generation &&
        netDragonRideable(index)) return true;
  }
  return false;
}

function netLocalRiding() {
  const riding = netAPI('riding');
  return !!((riding && riding.active) || netRiderMounted(net.id));
}

function netEnsureSeed(seed) {
  const world = netAPI('world');
  if (!world || typeof world.ensureSeed !== 'function') return null;
  try {
    const result = world.ensureSeed(seed);
    return result && typeof result.then === 'function' ? result : Promise.resolve(result);
  } catch (err) {
    return Promise.reject(err);
  }
}

function netApplySeed(seed, by) {
  if (!netValidSeed(seed) || by !== net.hostId) return false;
  return netReceiveConfig({ mode: net.matchMode || netCurrentMode(), seed,
    generation: net.generation, hostId: net.hostId, epoch: net.epoch }, by);
}

function netConfig() {
  return { mode: net.matchMode, seed: net.seed, generation: net.generation,
    hostId: net.hostId, epoch: net.epoch, forceRideable: net.forceRideable,
    dragonCount: netDragonCount(net.seed), dragons: netDragonCatalogSnapshot(),
    scores: { ...net.matchScores }, scoreSeq: Math.max(0, net.scoreSeq) };
}

function netReceiveScores(msg) {
  const scores = msg && msg.scores, seq = msg && msg.scoreSeq;
  if (!scores || !Number.isSafeInteger(seq) || seq < 0 || seq < net.scoreSeq ||
      !Number.isInteger(scores.red) || !Number.isInteger(scores.blue) || scores.red < 0 || scores.blue < 0 ||
      scores.red > 999999 || scores.blue > 999999 ||
      (seq === net.scoreSeq && (scores.red !== net.matchScores.red || scores.blue !== net.matchScores.blue))) return;
  net.matchScores.red = scores.red;
  net.matchScores.blue = scores.blue;
  net.scoreSeq = seq;
  netApplyMatchScores();
}

function netApplyMatchScores() {
  const modes = netAPI('modes');
  if (!net.online || net.configPending || !modes || modes.active !== net.matchMode || !modes.scores) return;
  modes.scores.red = net.matchScores.red;
  modes.scores.blue = net.matchScores.blue;
}

function netCanConfigure() {
  return !net.mode || !!(net.online && net.id && net.hostId === net.id &&
    net.authorityReady && !net.configPending && !net.configError);
}

function netSetAuthority(id, ready) {
  const changed = net.hostId !== id;
  net.hostId = netValidId(id) ? id : null;
  net.authorityReady = !!(ready && net.hostId && net.online);
  if (changed) {
    if (net.configTask) {
      net.configVersion++;
      net.configPending = true;
    }
    mqtt.pendingStates.clear();
    mqtt.historyJobs.clear();
  }
  if (typeof BC !== 'undefined' && BC.flags) {
    BC.flags.roomHostId = net.hostId || '';
    BC.flags.roomAuthorityReady = net.authorityReady;
  }
}

function netReceiveConfig(config, by) {
  if (!config || !netValidMode(config.mode) || !netValidSeed(config.seed) ||
      !Number.isSafeInteger(config.generation) || config.generation < 1 ||
      !netValidId(config.hostId) || by !== config.hostId || by !== net.hostId ||
      (net.epoch && config.epoch && config.epoch !== net.epoch) || config.generation < net.generation) return false;
  if (config.generation === net.generation && net.seed !== null &&
      (config.seed !== net.seed || config.mode !== net.matchMode)) return false;
  if (config.dragonCount !== undefined && config.dragonCount !== netDragonCount(config.seed)) return false;
  const catalog = config.dragons === undefined ? null :
    netValidateDragonCatalog(config.dragons, config.seed, config.generation, config.dragonCount, true);
  if (config.dragons !== undefined && !catalog) return false;
  const changed = config.generation !== net.generation || config.seed !== net.seed || config.mode !== net.matchMode;
  net.epoch = netToken(config.epoch) || net.epoch;
  net.forceRideable = config.forceRideable === true;
  net.generation = config.generation;
  net.seed = config.seed;
  net.matchMode = config.mode;
  if (changed) {
    net.configVersion++;
    net.configError = false;
    net.configPending = true;
    net.scoreSeq = -1;
    net.matchScores.red = net.matchScores.blue = 0;
    net.rxSeq.clear();
    net.rides.clear();
    net.dragonCatalog.clear();
    for (const r of net.players.values()) r.dragon = -1;
    if (net.mode === 'mqtt' && net.id === net.hostId) netMqttResetMatch();
    else net.authPlayers.clear();
    net.shotId = '';
    net.seenHits.clear();
    net.seenShots.clear();
    net.healthSid = -1;
    mqtt.pendingStates.clear();
    mqtt.historyJobs.clear();
    netClearEdits(true);
    for (const [key, edit] of net.editOut) if (!netEditMatches(edit)) net.editOut.delete(key);
    for (const [key, batch] of net.editInFlight) if (!netEditMatches(batch.packet)) net.editInFlight.delete(key);
    net.outbox = net.outbox.filter((m) => m.generation === undefined || m.generation === net.generation);
  }
  if (catalog && catalog.length) netReceiveDragonCatalog({ ...config, dragons: catalog }, by);
  netReceiveScores(config);
  if (net.mode === 'mqtt' && net.id === net.hostId) mqtt.scoreSerial = Math.max(0, net.scoreSeq);
  if (typeof BC !== 'undefined' && BC.flags && net.mode) BC.flags.forceRideable = net.forceRideable;
  netApplyConfig();
  return true;
}

function netApplyConfig() {
  if (!net.online || net.configTask || !net.configPending) return;
  const config = netConfig(), version = net.configVersion, session = net.session;
  const modes = netAPI('modes');
  let task;
  try {
    net.applyingConfig = true;
    // receiveConfig already ensures/rebuilds the world. Never start a second
    // regeneration alongside it; use ensureSeed only for legacy integrations.
    if (modes && typeof modes.receiveConfig === 'function') task = modes.receiveConfig(config, net.hostId);
    else if (netCurrentSeed() === config.seed && netCurrentMode() === config.mode) task = Promise.resolve();
    else task = netEnsureSeed(config.seed);
    net.applyingConfig = false;
    if (!task) { net.configError = true; net.desync = true; return; }
  } catch (err) {
    net.applyingConfig = false;
    net.configError = true;
    net.desync = true;
    return;
  }
  net.configTask = Promise.resolve(task).then(() => {
    if (session !== net.session || version !== net.configVersion) return;
    if (netCurrentSeed() !== config.seed || (modes && netCurrentMode() !== config.mode)) throw new Error('World/config not ready');
    net.appliedVersion = version;
    net.configPending = net.configError = net.localReset = net.localWorldReset = false;
    net.desync = false;
    netApplyDragonCatalog();
    netApplyMatchScores();
    netDrainEdits();
    net.lastSent = performance.now();
    netSend(combatNetState()); // announce the rebuilt spawn before gun/ride input resumes
    if (typeof window.__netIdentity === 'function') window.__netIdentity(); // current history + leases after world readiness
    if (net.id === net.hostId) netSend(netDragonPacket());
    netEmitStatus();
  }).catch((err) => {
    if (session === net.session && version === net.configVersion) {
      net.configError = net.desync = true;
      console.warn('[net] configuration sync failed', err);
      netEmitStatus();
    }
  }).then(() => {
    if (session !== net.session) return;
    net.configTask = null;
    if (version !== net.configVersion) netApplyConfig();
  });
}

function netDragonCatalog() {
  const out = [], seed = netCurrentSeed(), count = netDragonCount(seed), rules = netDragonRules();
  if (!count || typeof dragons === 'undefined' || dragons.length !== count) return out;
  for (const dragon of dragons) {
    if (!dragon || !dragon.orbit || !Number.isInteger(dragon.index) ||
        (dragon.seed !== undefined && dragon.seed !== seed)) return [];
    const descriptor = rules.descriptor(seed, dragon.index);
    if (!netDragonRoleMatches(dragon.orbit, descriptor)) return [];
    const entry = netDragonCatalogEntry({ index: dragon.index, cx: dragon.orbit.cx, cz: dragon.orbit.cz,
      altitude: dragon.orbit.altitude }, seed, net.generation);
    if (!entry) return [];
    out.push(entry);
  }
  return netValidateDragonCatalog(out, seed, net.generation, count, false) || [];
}

function netSeedValue() {
  const seed = netCurrentSeed();
  return seed === null ? undefined : seed;
}

function netJoinPacket() {
  const msg = combatNetState('join');
  const seed = netSeedValue();
  if (seed !== undefined) msg.seed = seed;
  msg.mode = netCurrentMode();
  msg.at = netEpochNow();
  msg.clockAt = performance.now();
  msg.generation = net.generation;
  msg.dragonCount = netDragonCount(seed);
  msg.dragons = netDragonCatalog();
  return msg;
}

function netStatusPayload() {
  return {
    online: !!net.online,
    mode: net.mode,
    room: net.mode === 'mqtt' ? net.room : '',
    players: netPlayerCount(),
    ping: net.online && net.ping > 0 ? Math.round(net.ping) : null,
    jitter: net.lastPong ? Math.round(net.jitter) : null,
    connected: netConnectedTransport(), pingSource: net.pingSource,
    desync: !!net.desync,
    hostId: net.hostId, generation: net.generation, seed: net.seed,
    matchMode: net.matchMode, canConfigure: netCanConfigure(),
    configPending: net.configPending, configError: !!net.configError, authorityReady: net.authorityReady,
    id: net.id, epoch: net.epoch,
    dragonCount: netDragonCount(net.seed), catalogCount: net.dragonCatalog.size
  };
}

function netEmitStatus() {
  if (typeof BC === 'undefined' || !BC.emit) return;
  BC.emit('netStatus', netStatusPayload());
}

function netEmitSfx(info) {
  if (typeof BC === 'undefined' || !BC.emit || !info) return;
  BC.emit('sfx', info);
}

function netPositionSfx(msg, fallbackY) {
  if (Number.isFinite(msg.x) && Number.isFinite(msg.y) && Number.isFinite(msg.z)) {
    return { x: msg.x, y: msg.y, z: msg.z };
  }
  return null;
}

/* ---------------- outbound queue ----------------
   Only transport backpressure creates a queue. State packets are expendable,
   critical events (died/hit/ping) are never evicted. */
function netConnectedTransport() {
  if (net.mode === 'mqtt') return roomReady();
  return !!(net.ws && net.ws.readyState === 1);
}

function netTransportBuffered() {
  if (net.mode === 'mqtt') return roomBuffered();
  return !!(net.ws && net.ws.readyState === 1 && net.ws.bufferedAmount > 256 * 1024);
}

function netStopFlush() {
  if (net.flushTimer) {
    clearInterval(net.flushTimer);
    net.flushTimer = null;
  }
}

function netDropQueue() {
  net.outbox.length = 0;
  net.editOut.clear();
  net.editInFlight.clear();
  net.editTokens = NET_EDIT_BURST;
  net.editAt = performance.now();
  net.sendBlockedUntil = 0;
  netStopFlush();
}

function netQueueOutbound(msg) {
  const packet = msg.t === 'authority' ? msg.packet : msg;
  if (packet && (packet.t === 'state' || packet.t === 'states' || packet.t === 'roster' || (packet.t === 'ride' && packet.active))) {
    const prior = net.outbox.findIndex((m) => {
      const p = m.t === 'authority' ? m.packet : m;
      return p && p.t === packet.t && (packet.t === 'states' ||
        (packet.t === 'roster' ? m.to === msg.to : (p.id || p.riderId) === (packet.id || packet.riderId)));
    });
    if (prior >= 0 && packet.t === 'states') {
      const merged = new Map();
      for (const p of net.outbox[prior].packet.players) merged.set(p.id, p);
      for (const p of packet.players) merged.set(p.id, p);
      packet.players = [...merged.values()].slice(0, NET_MAX_PEERS);
    }
    if (prior >= 0) net.outbox.splice(prior, 1);
  }
  if (net.outbox.length >= NET_MAX_QUEUE) {
    const stateAt = net.outbox.findIndex((m) => m.t === 'state' ||
      (m.t === 'authority' && m.packet && (m.packet.t === 'state' || m.packet.t === 'states' || m.packet.t === 'roster')));
    if (stateAt >= 0) {
      net.outbox.splice(stateAt, 1);
    } else {
      const low = net.outbox.findIndex((m) => m.t === 'reload' || m.t === 'dragons');
      if (low >= 0) net.outbox.splice(low, 1);
      else {
        // A finite queue cannot promise infinite delivery. On LAN, end the
        // unhealthy session; in a room, losing one old event beats losing the match.
        if (net.mode !== 'mqtt') { netDisconnect('Network queue full. Reconnect to continue', true); return false; }
        net.outbox.shift();
      }
    }
  }
  net.outbox.push(msg);
  if (!net.flushTimer) {
    net.flushTimer = setInterval(netFlushOutbound, 50);
  }
  return true;
}

function netFlushOutbound() {
  if (!net.outbox.length && !net.editOut.size && !net.editInFlight.size) { netStopFlush(); return; }
  const now = performance.now();
  if (now < net.sendBlockedUntil) return;
  if (!netConnectedTransport()) { netDropQueue(); return; }
  if (netTransportBuffered()) {
    net.sendBlockedUntil = now + 250;
    return;
  }
  let sent = 0;
  while (net.outbox.length && sent++ < 8) {
    if (netTransportBuffered()) { net.sendBlockedUntil = performance.now() + 250; break; }
    const message = net.outbox[0];
    if (!netSendNow(message)) return;
    if (net.outbox[0] === message) net.outbox.shift();
  }
  netFlushLocalEdits(now);
  if (!net.outbox.length && !net.editOut.size && !net.editInFlight.size) netStopFlush();
}

function netValidEditCell(msg) {
  return !!msg && Number.isInteger(msg.x) && Number.isInteger(msg.y) && Number.isInteger(msg.z) && Number.isInteger(msg.b) &&
    msg.x >= 0 && msg.z >= 0 && msg.x < WORLD && msg.z < WORLD && msg.y >= 0 && msg.y < HEIGHT && msg.b >= 0 && msg.b <= 255;
}

function netQueuedEditCells() {
  let count = net.editOut.size;
  for (const batch of net.editInFlight.values()) count += batch.packet.edits.length;
  return count;
}

function netQueueLocalEdit(msg) {
  if (!netValidEditCell(msg)) return false;
  const key = msg.x + ',' + msg.y + ',' + msg.z;
  if (!net.editOut.has(key) && netQueuedEditCells() >= NET_MAX_EDITS) {
    if (net.mode !== 'mqtt') { netDisconnect('World edit backlog full. Reconnect to continue', true); return false; }
    net.editOut.delete(net.editOut.keys().next().value);
  }
  net.editOut.delete(key);
  net.editOut.set(key, msg);
  if (!net.flushTimer) net.flushTimer = setInterval(netFlushOutbound, 50);
  return true;
}

function netFlushLocalEdits(now) {
  if (netWorldBusy() || (net.mode === 'mqtt' && !net.authorityReady) || net.outbox.length || netTransportBuffered()) return;
  net.editTokens = Math.min(NET_EDIT_BURST, net.editTokens + Math.max(0, now - net.editAt) * NET_EDIT_RATE / 1000);
  net.editAt = now;
  for (const [id, batch] of net.editInFlight) {
    if (!netEditMatches(batch.packet)) { net.editInFlight.delete(id); continue; }
    if (now < batch.retryAt) continue;
    if (batch.attempts >= 4) {
      if (net.mode !== 'mqtt') { netDisconnect('World edit acknowledgement timed out. Reconnect to resync', true); return; }
      net.editInFlight.delete(id);
      if (net.hostId !== net.id) netSend({ ...netJoinPacket(), id: net.id }); // joining again replays the host's edits
      continue;
    }
    if (net.editTokens < batch.packet.edits.length) continue;
    batch.packet.life = net.localLife || undefined;
    batch.attempts++;
    batch.retryAt = now + 5000;
    if (!netSendNow(batch.packet)) return;
    net.editTokens -= batch.packet.edits.length;
    if (netTransportBuffered()) return;
  }
  if (net.editInFlight.size >= NET_EDIT_FLIGHT_LIMIT || !net.editOut.size || net.editTokens < 1) return;
  const entries = [], edits = [];
  const limit = Math.min(NET_EDIT_BATCH, Math.floor(net.editTokens));
  for (const [key, edit] of net.editOut) {
    if (!netEditMatches(edit)) { net.editOut.delete(key); continue; }
    if (edits.length >= limit) break;
    entries.push([key, edit]);
    edits.push({ x: edit.x, y: edit.y, z: edit.z, b: edit.b });
  }
  if (!edits.length) return;
  const batchId = net.id + ':edits:' + (++net.eventSeq);
  const packet = { t: 'edits', edits, batchId, generation: net.generation, epoch: net.epoch, life: net.localLife || undefined };
  net.editInFlight.set(batchId, { packet, attempts: 1, retryAt: now + 5000 });
  if (!netSendNow(packet)) { net.editInFlight.delete(batchId); return; }
  net.editTokens -= edits.length;
  for (const [key, edit] of entries) if (net.editOut.get(key) === edit) net.editOut.delete(key);
}

function netEditResponse(msg) {
  const batch = net.editInFlight.get(netToken(msg.batchId));
  if (!batch || !netEditMatches(batch.packet)) return;
  if (msg.t === 'editAck') {
    if (Array.isArray(msg.edits) && msg.edits.length <= 128) {
      for (const cell of msg.edits) if (netValidEditCell(cell) && Number.isSafeInteger(cell.sid)) {
        applyNetEdit({ ...cell, generation: batch.packet.generation, epoch: batch.packet.epoch });
      }
    }
    net.editInFlight.delete(msg.batchId);
    return;
  }
  if (msg.retryable !== true) {
    if (net.mode !== 'mqtt') {
      netDisconnect('World edit rejected (' + String(msg.reason || 'validation').slice(0, 32) + '). Reconnect to resync', true);
      return;
    }
    // A refused build is a normal event in a live match: take the host's blocks back.
    net.editInFlight.delete(netToken(msg.batchId));
    for (const cell of Array.isArray(msg.cells) ? msg.cells.slice(0, 128) : []) {
      if (netValidEditCell(cell)) applyNetEdit({ ...cell, generation: batch.packet.generation, epoch: batch.packet.epoch });
    }
    return;
  }
  batch.retryAt = performance.now() + netPoseNumber(msg.retryMs, 250, 50, 2000);
}

function netRememberEditBatch(msg) {
  const id = netToken(msg.batchId), by = msg.by;
  if (!id || !netValidId(by)) return;
  const r = net.authPlayers.get(by);
  if (r) {
    if (!r.editBatches) r.editBatches = new Map();
    r.editBatches.set(id, true);
    while (r.editBatches.size > 512) r.editBatches.delete(r.editBatches.keys().next().value);
  }
  if (by === net.id) netEditResponse({ t: 'editAck', batchId: id });
}

function netSendNow(msg) {
  if (!netConnectedTransport()) return false;
  if (msg.generation !== undefined && msg.t !== 'join' && msg.t !== 'match' && msg.generation !== net.generation) return true;
  // Positions travel on the unreliable channel, so they count separately from
  // the reliable actions: neither may overtake and invalidate the other.
  if (netMqttAction(msg.t)) msg = { ...msg, seq: msg.t === 'state' ? ++net.stateSeq : ++net.seq };
  if (msg.t === 'ping') {
    if (net.mode === 'mqtt' && !netPingPeer()) return true; // alone in the room
    msg = { ...msg, seq: ++net.pingSeq, at: performance.now() };
    const to = net.mode === 'mqtt' ? netPingPeer() : null;
    if (to) msg.to = to;
    net.pings.set(msg.seq, { at: msg.at, peer: to });
    while (net.pings.size > 8) net.pings.delete(net.pings.keys().next().value);
  }
  if (net.mode === 'mqtt') {
    if (msg.t === 'authority' && msg.hostId !== net.hostId) return true;
    if (msg.t === 'match' || msg.t === 'seed') return netBroadcastConfig(msg);
    if (net.authorityReady && net.hostId === net.id && netMqttAction(msg.t)) return netMqttProcess(msg, net.id);
    return roomSend(msg);
  }
  try { net.ws.send(JSON.stringify(msg)); return true; }
  catch (e) { netDisconnect('Network send failed', true); return false; }
}

function netPoseFields(msg) {
  const jet = netAPI('jetpack');
  msg.fly = player.fly ? 1 : 0;
  msg.onGround = player.onGround ? 1 : 0;
  msg.sliding = msg.slide = player.sliding ? 1 : 0;
  msg.crouch = player.crouching ? 1 : 0;
  msg.boost = (player.boosting || player.boost || (jet && jet.boosting)) ? 1 : 0;
  msg.dash = (player.dashing || player.dash || (jet && jet.dashing)) ? 1 : 0;
  msg.fuel = jet && Number.isFinite(jet.fuel) ? netPoseNumber(jet.fuel, 100, 0, 100) : 100;
  const bodyHeight = typeof playerBodyHeight === 'function' ? playerBodyHeight() : player.bodyHeight;
  msg.height = msg.bodyHeight = netPoseNumber(bodyHeight,
    msg.crouch || msg.slide || msg.dash ? 1.2 : 1.8, 1.1, 1.9);
  const riding = netAPI('riding');
  const index = riding && riding.active && riding.dragon ? riding.dragon.index : -1;
  const own = net.authPlayers.get(net.id);
  msg.dragon = netDragonRideable(index) ? index : own && netRiderMounted(net.id) && netDragonRideable(own.dragon) ? own.dragon : -1;
  if (netLocalRiding()) msg.aim = msg.firing = 0;
  return msg;
}

function netSend(msg) {
  if (!msg || typeof msg.t !== 'string' || !netConnectedTransport()) return false;
  msg = { ...msg };
  if (!['ping', 'pong', 'join', 'match', 'seed', 'leave'].includes(msg.t) &&
      ((msg.generation !== undefined && msg.generation !== net.generation) || (msg.epoch !== undefined && msg.epoch !== net.epoch))) return false;
  if (msg.t === 'state' || msg.t === 'join' || msg.t === 'reload' || msg.t === 'respawn') {
    if (!netValidPosition(msg)) return false;
    netPoseFields(msg);
  }
  if (msg.t !== 'join' && netMqttAction(msg.t) && net.localLife > 0) msg.life = net.localLife;
  if (msg.t === 'respawn') net.respawnSentAt = performance.now();
  if (msg.t === 'shot') {
    if (!netValidPosition(msg)) return false;
    if (netLocalRiding()) return false;
    netPoseFields(msg);
    net.shotId = net.id + ':shot:' + (++net.eventSeq);
    msg.shotId = net.shotId;
    msg.shotAt = performance.now();
  }
  if (msg.t === 'hit' || msg.t === 'voxelHit') {
    if (netLocalRiding()) return false; // breath is NEVER a sniper hit
    msg.shotId = net.shotId || undefined;
    msg.eventId = net.id + ':event:' + (++net.eventSeq);
  }
  if (msg.t === 'dragons' || msg.t === 'ride' || msg.t === 'breath') {
    if ((msg.seed !== undefined && msg.seed !== net.seed) ||
        (msg.dragonCount !== undefined && msg.dragonCount !== netDragonCount(net.seed))) return false;
    msg.seed = net.seed;
    msg.dragonCount = netDragonCount(net.seed);
  }
  if (msg.t === 'dragons') {
    const catalog = netValidateDragonCatalog(msg.dragons, net.seed, net.generation, msg.dragonCount, false);
    if (!catalog) return false;
    msg.dragons = catalog;
  }
  if (msg.t === 'ride' || msg.t === 'breath') {
    const index = netDragonIndex(msg, net.seed), rules = netDragonRules();
    const descriptor = rules && rules.descriptor(net.seed, index);
    if (!netDragonRideable(index) || !netDragonRoleMatches(msg, descriptor) ||
        (msg.t === 'ride' && netPoseFlag(msg.active, -1) < 0)) return false;
    msg.dragon = index;
    const lease = net.rides.get(index);
    if (lease && lease.id === net.id) msg.lease = lease.lease;
  }
  if (msg.t === 'died' && net.damageContext && net.damageContext.kill) {
    msg.killId = net.damageContext.kill.killId;
    msg.weapon = net.damageContext.weapon;
    msg.head = net.damageContext.head;
  }
  if (msg.t !== 'ping' && msg.t !== 'pong' && msg.t !== 'leave') {
    msg.generation = net.generation;
    msg.epoch = net.epoch;
  }
  if (msg.t === 'voxelHit') {
    msg = netVoxelHitMessage(msg, net.id);
    if (!msg) return false;
  }
  if (netWorldBusy() && !['ping', 'pong', 'join', 'match', 'seed', 'dragons', 'leave', 'authority'].includes(msg.t)) return false;
  if (msg.t === 'edit') return netQueueLocalEdit(msg);
  if (msg.t === 'edits') {
    if (!Array.isArray(msg.edits) || !msg.edits.length || msg.edits.length > 128 || msg.edits.some((cell) => !netValidEditCell(cell))) return false;
    for (const cell of msg.edits) if (!netQueueLocalEdit({ ...cell, t: 'edit', generation: net.generation, epoch: net.epoch })) return false;
    return true;
  }
  const now = performance.now();
  if (netTransportBuffered()) net.sendBlockedUntil = now + 250;
  if (net.outbox.length || now < net.sendBlockedUntil) {
    return netQueueOutbound(msg);
  }
  return netSendNow(msg);
}

function netSendPing() {
  if (!netConnectedTransport()) return;
  if (!net.outbox.some((m) => m.t === 'ping')) netSend({ t: 'ping' });
}

function netPingPeer() {
  if (net.hostId && net.hostId !== net.id) return net.hostId;
  for (const link of roomNet.links.values()) if (link.open) return link.id;
  return null;
}

function netRecordPong(msg, from) {
  const pending = net.pings.get(msg.seq);
  if (!pending || pending.at !== msg.at || (net.mode === 'mqtt' &&
      (msg.to !== net.id || from === net.id || from !== pending.peer))) return;
  const sample = performance.now() - pending.at;
  net.pings.delete(msg.seq);
  if (sample < 0 || sample > 10000) return;
  const source = from || 'server';
  const comparable = net.lastPong && net.pingSource === source;
  const delta = comparable ? Math.abs(sample - net.ping) : 0;
  net.jitter = comparable ? net.jitter + (delta - net.jitter) * 0.25 : 0;
  net.ping = comparable ? net.ping + (sample - net.ping) * 0.25 : sample;
  net.lastPong = performance.now();
  net.pingSource = source;
}

function netStartPing() {
  if (net.pingTimer) return;
  net.pingTimer = setInterval(netSendPing, 1000);
}

function netStopPing() {
  if (net.pingTimer) {
    clearInterval(net.pingTimer);
    net.pingTimer = null;
  }
  net.pings.clear();
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
  const code = net.room || normalizeRoom((document.getElementById('roomInput') || {}).value);
  if (!code) return Promise.resolve(false);
  const done = () => {
    const hint = document.getElementById('roomHint');
    if (hint && net.room === code) hint.textContent = 'Invite code ' + code + ' copied. Send it to your friend.';
    toast('Invite code ' + code + ' copied');
    return true;
  };
  const failed = () => {
    const hint = document.getElementById('roomHint');
    if (hint) hint.textContent = 'Copy was blocked. Select the invite code and copy it manually.';
    toast('Copy blocked. Room code: ' + code);
    return false;
  };
  const fallback = () => {
    const previousFocus = document.activeElement;
    let ta;
    try {
      ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      return document.execCommand('copy') ? done() : failed();
    } catch (e) { return failed(); }
    finally {
      if (ta) ta.remove();
      if (previousFocus && previousFocus.isConnected && !previousFocus.closest('[hidden], [inert]')) previousFocus.focus({ preventScroll: true });
    }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(code).then(done, fallback);
    }
    return Promise.resolve(fallback());
  } catch (e) { return Promise.resolve(fallback()); }
}

/* ---------------- shared world edits & remote avatars ---------------- */
const netDirtyChunks = new Set();
let netEditFlushHandle = null;
let netEditFlushIsFrame = false;
let netEditWorkAt = -Infinity;

function netClearEdits(history) {
  if (netEditFlushHandle !== null) {
    if (netEditFlushIsFrame) cancelAnimationFrame(netEditFlushHandle);
    else clearTimeout(netEditFlushHandle);
  }
  netEditFlushHandle = null;
  netDirtyChunks.clear();
  net.editSeq.clear();
  if (history) net.editHistory.clear();
  for (const [key, edit] of net.pendingEdits) {
    if (!netEditMatches(edit)) net.pendingEdits.delete(key);
  }
}

function netEditMatches(edit) {
  return edit.generation === net.generation && (!edit.epoch || edit.epoch === net.epoch);
}

function netScheduleEdits() {
  if (netEditFlushHandle !== null || netWorldBusy()) return;
  netEditFlushIsFrame = typeof requestAnimationFrame === 'function';
  const run = () => { netEditFlushHandle = null; flushNetEdits(); };
  netEditFlushHandle = netEditFlushIsFrame ? requestAnimationFrame(run) : setTimeout(run, 16);
}

function netDrainEdits() {
  if (netWorldBusy()) return;
  const start = performance.now();
  let count = 0;
  for (const [key, edit] of net.pendingEdits) {
    if (count++ >= 128 || performance.now() - start > 3) break;
    net.pendingEdits.delete(key);
    if (!netEditMatches(edit)) continue;
    if (getBlock(edit.x, edit.y, edit.z) !== edit.b) {
      setBlock(edit.x, edit.y, edit.z, edit.b);
      netQueueDirty(edit.x, edit.z);
    }
    net.editHistory.set(edit.x + ',' + edit.y + ',' + edit.z, edit);
    if (net.editHistory.size > NET_MAX_EDITS) net.editHistory.delete(net.editHistory.keys().next().value);
  }
  if (net.pendingEdits.size || netDirtyChunks.size) netScheduleEdits();
}

function flushNetEdits() {
  if (netEditFlushHandle !== null) {
    if (netEditFlushIsFrame) cancelAnimationFrame(netEditFlushHandle);
    else clearTimeout(netEditFlushHandle);
    netEditFlushHandle = null;
  }
  if (netWorldBusy()) return;
  const start = performance.now();
  if (start - netEditWorkAt < 8) { netScheduleEdits(); return; }
  netEditWorkAt = start;
  netDrainEdits();
  // Voxel writes already happened. Deduplicate expensive terrain remeshes,
  // including the adjacent chunk whose boundary face changed.
  let count = 0;
  for (const key of netDirtyChunks) {
    if (count++ >= 4 || performance.now() - start > 4) break;
    netDirtyChunks.delete(key);
    const cx = key % CHUNKS, cz = Math.floor(key / CHUNKS);
    rebuildChunk(cx, cz);
  }
  if (netDirtyChunks.size || net.pendingEdits.size) netScheduleEdits();
}

function netQueueDirty(x, z) {
  // Corner edits also affect the diagonal chunk's vertex ambient occlusion.
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const cx = Math.floor((x + dx) / CHUNK), cz = Math.floor((z + dz) / CHUNK);
    if (cx >= 0 && cz >= 0 && cx < CHUNKS && cz < CHUNKS) netDirtyChunks.add(cz * CHUNKS + cx);
  }
  netScheduleEdits();
}

function applyNetEdit(m) {
  if (!m || !Number.isInteger(m.x) || !Number.isInteger(m.y) || !Number.isInteger(m.z) || !Number.isInteger(m.b)) return;
  const x = m.x, y = m.y, z = m.z, b = m.b;
  if (x < 0 || z < 0 || x >= WORLD || z >= WORLD || y < 0 || y >= HEIGHT || b < 0 || b > 255) return;
  const generation = m.generation === undefined && net.mode === 'ws' ? net.generation : m.generation;
  if (!Number.isSafeInteger(generation) || generation < net.generation || (m.epoch && m.epoch !== net.epoch)) return;
  const key = (m.epoch || net.epoch) + ':' + generation + ':' + x + ',' + y + ',' + z;
  if (Number.isSafeInteger(m.sid)) {
    if (m.sid <= (net.editSeq.get(key) || -1)) return;
    net.editSeq.set(key, m.sid);
    if (net.editSeq.size > NET_MAX_EDITS) net.editSeq.delete(net.editSeq.keys().next().value);
  }
  net.pendingEdits.delete(key);
  net.pendingEdits.set(key, { ...m, x, y, z, b, generation });
  if (net.pendingEdits.size > NET_MAX_EDITS) net.pendingEdits.delete(net.pendingEdits.keys().next().value);
  netScheduleEdits();
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
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WEAPON_BY_ID, value) ? value : fallback || WEAPONS[0].id;
}

function netPoseReload(value) {
  return Number.isFinite(value) && value >= 0 ? Math.min(1, value) : -1;
}

function netVoxelHitMessage(m, sender) {
  if (!m || !Number.isInteger(m.x) || !Number.isInteger(m.y) || !Number.isInteger(m.z) ||
      m.x < 0 || m.z < 0 || m.x >= WORLD || m.z >= WORLD || m.y < 1 || m.y >= HEIGHT ||
      !Number.isInteger(m.block) || m.block < 1 || m.block > 22 || m.block === WATER ||
      typeof m.weapon !== 'string' || !WEAPON_BY_ID[m.weapon] ||
      !Number.isFinite(m.amount) || m.amount <= 0 || m.amount > WEAPON_BY_ID[m.weapon].damage ||
      typeof m.hitId !== 'string' || !/^[\w.:-]{1,96}$/.test(m.hitId)) return null;
  const by = sender || m.by;
  if (typeof by !== 'string' || !/^[\w-]{1,40}$/.test(by)) return null;
  return {
    t: 'voxelHit', x: m.x, y: m.y, z: m.z, block: m.block, weapon: m.weapon,
    amount: Math.max(1, Math.floor(m.amount)), hitId: m.hitId, by,
    shotId: m.shotId, eventId: m.eventId, generation: m.generation, epoch: m.epoch
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
  const authoritative = net.mode === 'mqtt' ? net.authPlayers.get(r.id) : p;
  const oldHp = r.hp;
  const life = authoritative && Number.isSafeInteger(authoritative.life) ? authoritative.life : r.life;
  if (life > r.life) { r.deadUntil = 0; r.deathNoted = false; }
  if (authoritative && !(oldHp <= 0 && life <= r.life && authoritative.hp > 0)) {
    r.hp = netPoseNumber(authoritative.hp, r.hp, 0, MAX_HEALTH);
  }
  r.life = Math.max(r.life, life || 0);
  if (oldHp <= 0 && r.hp > 0) r.deathNoted = false;
  // State scores are absolute, never added to event-side increments. In MQTT a
  // killer's state can beat another peer's died event; the next snapshot also
  // corrects that ordering instead of permanently keeping an extra kill.
  if (authoritative) {
    r.kills = Math.floor(netPoseNumber(authoritative.kills, r.kills, 0, 999999));
    r.deaths = Math.floor(netPoseNumber(authoritative.deaths, r.deaths, 0, 999999));
  }
  if (p.dragon !== undefined) r.dragon = netDragonRideable(p.dragon) ? p.dragon : -1;
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
  const ready = r.combat && r.hp > 0 && r.dragon < 0 && !netRiderMounted(r.id) && netRemoteReloadProgress(r, performance.now()) < 0;
  r.aim = ready ? netPoseFlag(p.aim, r.aim) : 0;
  r.firing = ready ? netPoseFlag(p.firing, r.firing) : 0;
  if (r.dragon >= 0 || netRiderMounted(r.id)) r.firePose = r.kick = 0;
  r.crouch = netPoseFlag(p.crouch, r.crouch);
  r.slide = netPoseFlag(p.sliding === undefined ? p.slide : p.sliding, r.slide);
  r.fly = netPoseFlag(p.fly, r.fly);
  r.onGround = netPoseFlag(p.onGround, r.onGround);
  r.boost = r.fly ? netPoseFlag(p.boost, 0) : 0;
  r.dash = netPoseFlag(p.dash, 0);
  r.fuel = netPoseNumber(p.fuel, r.fuel, 0, 100);
  r.height = r.bodyHeight = netPoseNumber(p.bodyHeight === undefined ? p.height : p.bodyHeight,
    r.crouch || r.slide || r.dash ? 1.2 : 1.8, 1.1, 1.9);
  r.group.userData.colliderHeight = r.group.userData.bodyHeight = r.bodyHeight;
  r.team = netTeamFor(r.id);
}

function netRemotePoseState(r, now) {
  return {
    pitch: r.pitch, aim: r.aim, firing: r.firing || r.firePose > 0,
    reload: netRemoteReloadProgress(r, now), reloadRounds: r.reloadRounds,
    weapon: r.weapon, combat: r.combat, alive: r.hp > 0 && !(r.deadUntil > now),
    kick: r.kick, crouch: r.crouch, slide: r.slide,
    boost: r.boost, fly: r.fly, fuel: r.fuel, dash: r.dash, height: r.height, bodyHeight: r.bodyHeight
  };
}

function removeRemote(id) {
  const r = net.players.get(id);
  if (!r) return;
  const jet = netAPI('jetpack');
  if (r.jetpackRig && jet && typeof jet.disposeRemoteRig === 'function') jet.disposeRemoteRig(r.jetpackRig);
  r.jetpackRig = null;
  scene.remove(r.group);
  net.players.delete(id);
  net.rxSeq.delete(id);
  updateRoomBadge();
}

function addRemote(p) {
  if (!p || typeof p.id !== 'string' || !/^[\w-]{1,40}$/.test(p.id) || p.id === net.id) return;
  if ((p.x !== undefined || p.y !== undefined || p.z !== undefined) && !netValidPosition(p)) return;
  if (!net.players.has(p.id) && net.players.size >= NET_MAX_PEERS - 1) return;
  const existing = net.players.get(p.id);
  const incomingChar = typeof p.character === 'string' && Object.prototype.hasOwnProperty.call(CHARACTERS, p.character)
    ? p.character : existing ? existing.character : 'steve';
  const incomingName = typeof p.name === 'string' ? safeName(p.name) : existing ? existing.name : 'Player';
  if (existing && (existing.character !== incomingChar || existing.name !== incomingName)) {
    const sequence = net.rxSeq.get(p.id);
    const authority = net.authPlayers.get(p.id);
    removeRemote(p.id);
    if (sequence !== undefined) net.rxSeq.set(p.id, sequence);
    if (authority) net.authPlayers.set(p.id, authority);
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
      phase: 0, speed: 0, weapon: 'pistol', hp: MAX_HEALTH,
      aim: 0, deadUntil: 0, gun: null, jetpackRig: null, combat: 1, build: 0, firing: 0,
      firePose: 0, kick: 0, reload: -1, reloadAt: 0, reloadTotal: WEAPONS[0].reload,
      reloadRounds: WEAPONS[0].mag, crouch: 0, slide: 0, stance: 0, slidePose: 0,
      kills: existing ? existing.kills : 0, deaths: existing ? existing.deaths : 0,
      deathNoted: existing ? existing.deathNoted : false, life: existing ? existing.life : 0,
      boost: 0, fly: 0, onGround: 1, fuel: 100, dash: 0, dragon: -1, height: 1.8, bodyHeight: 1.8, poseDrop: 0, dashPose: 0, airPose: 0, team: null,
      stanceInput: { stance: 0, slide: 0, dash: 0, swing: 0, air: 0 },
      px: x, py: y, pz: z, recvAt: performance.now(), lastRx: performance.now(),
      vx: 0, vy: 0, vz: 0
    };
    net.players.set(p.id, r);
    if (existing) { r.hp = existing.hp; r.deadUntil = existing.deadUntil; }
    r.gun = attachAvatarGun(group, r.weapon);
    const jet = netAPI('jetpack');
    if (jet && typeof jet.createRemoteRig === 'function' && typeof jet.disposeRemoteRig === 'function') {
      r.jetpackRig = jet.createRemoteRig(group);
    }
    added = true;
  }
  const now = performance.now();
  const priorRx = r.recvAt || now;
  const nx = Number.isFinite(p.x) ? p.x : r.tx;
  const ny = Number.isFinite(p.y) ? p.y : r.ty;
  const nz = Number.isFinite(p.z) ? p.z : r.tz;
  const jump = Math.abs(nx - r.x) + Math.abs(ny - r.y) + Math.abs(nz - r.z);
  if (jump > 32) {
    // A server-authorised correction (or respawn) is a snap, not a glide.
    r.x = nx; r.y = ny; r.z = nz;
    r.vx = r.vy = r.vz = 0;
    r.trail = [];
  } else {
    const dt = Math.max(0.02, (now - priorRx) / 1000);
    const moving = Math.abs(nx - r.px) + Math.abs(ny - r.py) + Math.abs(nz - r.pz) > 0.01;
    if (moving) {
      r.vx = Math.max(-48, Math.min(48, (nx - r.px) / dt));
      r.vy = Math.max(-48, Math.min(48, (ny - r.py) / dt));
      r.vz = Math.max(-48, Math.min(48, (nz - r.pz) / dt));
    } else {
      r.vx = r.vy = r.vz = 0;
    }
  }
  r.tx = nx; r.ty = ny; r.tz = nz;
  r.px = nx; r.py = ny; r.pz = nz;
  if (!r.trail) r.trail = [];
  r.trail.push({ at: now, x: nx, y: ny, z: nz });
  if (r.trail.length > 12) r.trail.shift();
  r.recvAt = now;
  r.lastRx = now;
  r.tyaw = netPoseYaw(p.yaw, r.tyaw);
  r.tpitch = netPoseNumber(p.pitch, r.tpitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  netSetRemoteWeapon(r, netPoseWeapon(p.weapon, r.weapon));
  netApplyRemotePose(r, p);
  r.name = incomingName;
  const jet = netAPI('jetpack');
  if (r.jetpackRig && jet && typeof jet.updateRemoteRig === 'function') {
    let blocked = r.deadUntil > now;
    for (const lease of net.rides.values()) if (lease.id === r.id && lease.until > now) { blocked = true; break; }
    jet.updateRemoteRig(r.jetpackRig, r, 0, blocked);
  }
  if (added) updateRoomBadge();
}

function netInboundOK(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.t !== 'string' || msg.t.length > 24) return false;
  if (msg.room !== undefined && msg.room !== null && msg.room !== '') {
    const room = normalizeRoom(msg.room);
    if (room && net.room && room !== net.room) return false;
  }
  const idTypes = { welcome: 1, join: 1, state: 1, leave: 1, reload: 1, shot: 1, died: 1, respawn: 1, ride: 1, rideGrant: 1, rideDenied: 1, breath: 1 };
  if (idTypes[msg.t] && msg.id != null &&
      (typeof msg.id !== 'string' || !/^[\w-]{1,40}$/.test(msg.id))) return false;
  if (typeof msg.name === 'string' && msg.name.length > 64) return false;
  if (typeof msg.victim === 'string' && msg.victim.length > 96) return false;
  if (typeof msg.by === 'string' && msg.by.length > 96) return false;
  if ((msg.x !== undefined || msg.y !== undefined || msg.z !== undefined) && !netValidPosition(msg)) return false;
  if (msg.player && (!netValidId(msg.player.id) || !netValidPosition(msg.player))) return false;
  if (msg.players !== undefined && (!Array.isArray(msg.players) || msg.players.length > NET_MAX_PEERS)) return false;
  if (msg.edits !== undefined && (!Array.isArray(msg.edits) || msg.edits.length > NET_MAX_EDITS)) return false;
  if (msg.seq !== undefined && (!Number.isSafeInteger(msg.seq) || msg.seq < 0)) return false;
  if (msg.sid !== undefined && (!Number.isSafeInteger(msg.sid) || msg.sid < 0)) return false;
  if (msg.generation !== undefined && (!Number.isSafeInteger(msg.generation) || msg.generation < 0)) return false;
  if (msg.epoch !== undefined && msg.epoch !== '' && !netToken(msg.epoch)) return false;
  if (msg.t === 'pong' && msg.at !== undefined && !Number.isFinite(msg.at)) return false;
  if (msg.seed !== undefined && !netValidSeed(msg.seed)) return false;
  return true;
}

function netAcceptPose(msg) {
  const p = msg.player || msg;
  const id = p.id || (msg.t === 'health' ? net.id : '');
  if (!netValidId(id)) return false;
  const r = net.players.get(id);
  const life = id === net.id ? net.localLife : r ? r.life : 0;
  if (Number.isSafeInteger(p.life) && p.life < life) return false;
  const sid = Number.isSafeInteger(msg.sid) ? msg.sid : p.sid;
  if (Number.isSafeInteger(sid)) {
    const last = net.rxSeq.get(id);
    if (last !== undefined && sid <= last) return false;
    net.rxSeq.set(id, sid);
  }
  return true;
}

function netRememberState(p) {
  if (!p || !netValidId(p.id)) return;
  const previous = net.authPlayers.get(p.id);
  if (previous) {
    const deadHp = previous.hp <= 0 && p.hp > 0 && (!Number.isSafeInteger(p.life) || p.life <= previous.life);
    const nextLife = Number.isSafeInteger(p.life) && p.life > previous.life;
    Object.assign(previous, deadHp ? { ...p, hp: 0 } : p);
    if (nextLife && p.hp > 0) { previous.deathReported = false; previous.deathEvent = null; previous.deathAt = -Infinity; }
  }
  else net.authPlayers.set(p.id, { ...p });
}

// Teams come from ONE place: the room authority's sticky per-player record.
// Every peer used to derive teams from its own sorted view of the roster, so
// the host and a victim could disagree and silently drop hits as "friendly".
function netTeamFor(id) {
  if (!NET_TEAM_MODES.has(net.matchMode)) return null;
  const record = net.authPlayers.get(id);
  if (record && (record.team === 'red' || record.team === 'blue')) return record.team;
  if (record && net.mode === 'mqtt' && net.hostId === net.id && net.authorityReady) return netAssignTeam(record);
  return null;
}

function netAssignTeam(record) {
  let red = 0, blue = 0;
  for (const r of net.authPlayers.values()) {
    if (r === record) continue;
    if (r.team === 'red') red++;
    else if (r.team === 'blue') blue++;
  }
  record.team = blue < red ? 'blue' : 'red';
  return record.team;
}

// Anyone may switch their own team; the host may move anyone.
function netRequestTeam(targetId, team) {
  if (team !== 'red' && team !== 'blue') return false;
  const target = netValidId(targetId) ? targetId : net.id;
  if (!net.online || !net.id) return false;
  if (target !== net.id && net.hostId !== net.id) { toast('Only the host can move other players'); return false; }
  return netSend({ t: 'team', target, team });
}

function netOnTeamSet(msg) {
  if (!netValidId(msg.id) || (msg.team !== 'red' && msg.team !== 'blue')) return;
  const record = net.authPlayers.get(msg.id);
  if (record) record.team = msg.team;
  const remote = net.players.get(msg.id);
  if (remote) remote.team = netTeamFor(msg.id);
  const label = msg.team === 'red' ? 'Red' : 'Blue';
  if (msg.id === net.id) {
    if (alive) {
      // Fresh life on the new side: full health at that team's spawn.
      let spawn = null;
      const modes = netAPI('modes');
      try { if (modes && typeof modes.respawnPoint === 'function') spawn = modes.respawnPoint(msg.team); } catch (e) { /* optional */ }
      if (!spawn || !Number.isFinite(spawn.x)) spawn = findSpawn();
      player.pos.set(spawn.x, spawn.y, spawn.z);
      player.vel.set(0, 0, 0);
      if (typeof resetPlayerMotion === 'function') resetPlayerMotion();
      setHealth(MAX_HEALTH);
    }
    toast(msg.by && msg.by !== net.id ? 'The host moved you to ' + label + ' team' : 'You joined ' + label + ' team');
  } else {
    const name = remote ? remote.name : record && record.name ? record.name : 'A player';
    toast(safeName(name) + ' joined ' + label + ' team');
  }
  if (typeof BC !== 'undefined' && BC.emit) BC.emit('teamChanged', msg.id, msg.team);
  netEmitStatus();
}

// The authority says we are dead but this client still thinks it is alive:
// die locally. Without this the player became an unkillable ghost, because
// the authority ignores damage to a player it already considers dead.
function netForceLocalDeath(p) {
  if (!alive || typeof die !== 'function') return;
  if (performance.now() - (net.respawnSentAt || -Infinity) < 2500) return; // our respawn is in flight
  const event = p.t === 'died' ? p : p.deathEvent && typeof p.deathEvent === 'object' ? p.deathEvent : null;
  const info = event ? { ...event, authoritative: true } : { authoritative: true };
  die(event ? event.by : '', event ? event.byId || event.killerId : '', info);
}

function netEnemies(a, b) {
  if (!a || !b || a === b) return false;
  const team = netTeamFor(a);
  return !team || team !== netTeamFor(b);
}

function netApplyOwnState(p) {
  if (!p || (p.id && p.id !== net.id) || (Number.isSafeInteger(p.life) && p.life < (net.localLife || 0))) return;
  if (Number.isSafeInteger(p.life) && p.life > (net.localLife || 0)) {
    net.localLife = p.life;
    net.healthSid = -1;
    if (p.hp > 0 && !alive) {
      alive = true;
      if (typeof resetPlayerMotion === 'function') resetPlayerMotion();
      if (typeof deathEl !== 'undefined' && deathEl) deathEl.classList.remove('show');
      if (typeof BC !== 'undefined' && BC.emit) BC.emit('respawn');
    }
  }
  if (Number.isSafeInteger(p.sid)) {
    if (p.sid < net.healthSid) return;
    net.healthSid = p.sid;
  }
  if (Number.isFinite(p.hp) && alive && p.hp > 0) setHealth(netPoseNumber(p.hp, health, 0, MAX_HEALTH));
  if (Number.isFinite(p.kills)) kills = Math.floor(netPoseNumber(p.kills, kills, 0, 999999));
  if (Number.isFinite(p.deaths)) deaths = Math.floor(netPoseNumber(p.deaths, deaths, 0, 999999));
  setKd();
  if (Number.isFinite(p.hp) && p.hp <= 0 && alive &&
      (!Number.isSafeInteger(p.life) || p.life === (net.localLife || p.life))) netForceLocalDeath(p);
}

function netKillInfo(msg) {
  return {
    killerId: msg.killerId || msg.byId || '', victimId: msg.victimId || msg.id,
    byId: msg.byId || msg.killerId || '', weapon: msg.weapon, head: !!msg.head,
    killerPos: msg.killerPos || null, victimPos: msg.victimPos || null,
    pos: msg.killerPos || null, killId: msg.killId, authoritative: true,
    predicted: false, localKill: false, optimistic: false,
    personalKill: (msg.killerId || msg.byId) === net.id,
    killerTeam: msg.killerTeam, victimTeam: msg.victimTeam,
    mode: net.matchMode, seed: net.seed, generation: net.generation,
    life: msg.life, deaths: msg.deaths, kills: msg.kills,
    killerKills: msg.killerKills, confirmed: true,
    localDeath: (msg.victimId || msg.id) === net.id
  };
}

function netAnnounceKill(msg) {
  if (!netToken(msg.killId) || net.seenKills.has(msg.killId)) return;
  const info = netKillInfo(msg);
  net.seenKills.add(msg.killId);
  while (net.seenKills.size > 512) net.seenKills.delete(net.seenKills.values().next().value);
  const previous = net.killContext;
  net.killContext = info;
  try {
    // Combat owns confirmed-only feed/banner/scoring and its return gate.
    // Never bypass it with an additional killfeed emit.
    return addKillFeed(msg.by, msg.victim, info) === true;
  } finally { net.killContext = previous; }
}

function netReceiveRide(msg) {
  const index = netDragonIndex(msg, net.seed);
  const id = msg.riderId || msg.id;
  const rules = netDragonRules(), descriptor = rules && rules.descriptor(net.seed, index);
  if (!descriptor || !netValidId(id) || msg.generation !== net.generation || msg.seed !== net.seed ||
      (msg.dragonCount !== undefined && msg.dragonCount !== netDragonCount(net.seed)) ||
      !netDragonRoleMatches(msg, descriptor)) return false;
  const previous = net.rides.get(index);
  if (msg.active === 0 || msg.active === false || msg.t === 'rideDenied') {
    if (previous && msg.lease && msg.lease !== previous.lease) return false;
    if (!previous || previous.id === id) net.rides.delete(index);
    return true;
  }
  if (netPoseFlag(msg.active, -1) !== 1 || !netDragonRideable(index) || !netValidPosition(msg) || !netToken(msg.lease) ||
      !Number.isFinite(msg.yaw) || !Number.isFinite(msg.pitch) || Math.abs(msg.pitch) > Math.PI / 2 ||
      !Number.isFinite(msg.remainingMs) || msg.remainingMs <= 0) return false;
  if (previous && previous.id !== id && previous.until > performance.now()) return false;
  for (const [other, lease] of net.rides) if (other !== index && lease.id === id && lease.until > performance.now()) return false;
  const until = performance.now() + Math.max(0, Math.min(30000, msg.remainingMs));
  net.rides.set(index, { ...previous, ...msg, id,
    until: previous && previous.lease === msg.lease ? Math.min(previous.until, until) : until });
  return true;
}

function netReceiveBreath(msg) {
  const index = netDragonIndex(msg, net.seed);
  const id = msg.riderId || msg.id, lease = net.rides.get(index);
  const rules = netDragonRules(), descriptor = rules && rules.descriptor(net.seed, index);
  if (!netDragonRideable(index) || msg.seed !== net.seed || msg.generation !== net.generation ||
      (msg.dragonCount !== undefined && msg.dragonCount !== netDragonCount(net.seed)) ||
      !netDragonRoleMatches(msg, descriptor) ||
      !lease || lease.id !== id || lease.until <= performance.now() || msg.lease !== lease.lease ||
      !netValidPosition(msg) || Math.hypot(msg.x - lease.x, msg.y - lease.y, msg.z - lease.z) > 10 ||
      !Number.isFinite(msg.dx) || !Number.isFinite(msg.dy) || !Number.isFinite(msg.dz)) return false;
  const length = Math.hypot(msg.dx, msg.dy, msg.dz);
  return length >= 0.5 && length <= 1.5 && (msg.targets === undefined ||
    (Array.isArray(msg.targets) && msg.targets.length <= NET_MAX_PEERS && msg.targets.every(netValidId)));
}

function handleNet(msg, from, nested) {
  if (!netInboundOK(msg)) return;
  if (msg.t !== 'welcome' && msg.t !== 'match' && msg.t !== 'seed' && msg.t !== 'tick' && msg.t !== 'edit' && msg.t !== 'edits' &&
      msg.generation !== undefined && msg.generation !== net.generation) return;
  if (msg.epoch && net.epoch && msg.epoch !== net.epoch) return;
  if (!['welcome', 'match', 'seed', 'join'].includes(msg.t) && msg.seed !== undefined && msg.seed !== net.seed) return;
  if (['state', 'join', 'reload', 'respawn', 'health', 'correction'].includes(msg.t) && !netAcceptPose(msg)) return;
  if (msg.t === 'died' && (!netToken(msg.killId) || !netValidId(msg.victimId || msg.id))) return;
  if (msg.t === 'died' && net.seenKills.has(msg.killId)) { netReceiveScores(msg); return; }
  if ((msg.t === 'ride' || msg.t === 'rideGrant' || msg.t === 'rideDenied') && !netReceiveRide(msg)) return;
  if (msg.t === 'breath' && !netReceiveBreath(msg)) return;
  if (msg.t === 'dragons' && !netReceiveDragonCatalog(msg, from)) return;
  if (msg.t === 'shot') {
    const key = netToken(msg.shotId) || (netValidId(msg.id) && Number.isSafeInteger(msg.sid) ? msg.id + ':shot:' + msg.sid : '');
    if (!key || net.seenShots.has(key)) return;
    net.seenShots.add(key);
    while (net.seenShots.size > 512) net.seenShots.delete(net.seenShots.values().next().value);
  }
  if (msg.t === 'hit' && netToken(msg.eventId) && net.seenHits.has(msg.eventId)) return;
  const rxNow = performance.now();
  const prevRx = net.lastRx;
  if (!nested) {
    if (net.mode !== 'mqtt' || from !== net.id) net.lastRx = rxNow;
    net.lastPacketAt = rxNow;
    net.packetCount++;
    if (typeof BC !== 'undefined' && BC.emit) {
      // The riding owner authenticates MQTT's publishing host in id and reads
      // the actual actor from riderId. Dispatch still uses the actor's id.
      const hook = net.mode === 'mqtt' && from === net.hostId &&
        ['ride', 'rideGrant', 'rideDenied', 'breath', 'died', 'leave'].includes(msg.t)
        ? { ...msg, id: from, riderId: msg.riderId || msg.victimId || msg.id, authorityId: from } : msg;
      BC.emit('netPacket', hook);
    }
  }

  try {
    switch (msg.t) {
    case 'welcome': {
      if (!netValidId(msg.id)) break;
      const changedId = net.id !== msg.id;
      net.mode = 'ws';
      net.id = msg.id;
      net.online = true;
      net.attempts = 0;
      net.desync = false;
      net.onlineAt = net.onlineAt || rxNow;
      if (net.openTimer) { clearTimeout(net.openTimer); net.openTimer = null; }
      if (changedId) {
        net.rxSeq.clear();
        for (const id of [...net.players.keys()]) removeRemote(id);
      }
      netSetAuthority(netValidId(msg.hostId) ? msg.hostId : msg.id, true);
      netReceiveConfig({ mode: netValidMode(msg.mode) ? msg.mode : netCurrentMode(),
        seed: netValidSeed(msg.seed) ? msg.seed : netCurrentSeed(), generation: msg.generation || 1,
        hostId: net.hostId, epoch: msg.epoch || net.epoch, forceRideable: msg.forceRideable,
        dragonCount: msg.dragonCount, dragons: msg.dragons,
        scores: msg.scores, scoreSeq: msg.scoreSeq }, net.hostId);
      if (msg.self) { net.authPlayers.set(net.id, msg.self); netApplyOwnState(msg.self); }
      for (const e of (msg.edits || [])) applyNetEdit({ ...e, generation: msg.generation || net.generation });
      const present = new Set();
      for (const p of (msg.players || [])) {
        if (!p || !netValidId(p.id) || !netValidPosition(p)) continue;
        present.add(p.id);
        net.authPlayers.set(p.id, p);
        addRemote(p);
      }
      for (const id of [...net.players.keys()]) if (!present.has(id)) removeRemote(id);
      if (!net.warned) toast('Connected. ' + netPlayerCount() + ' player(s) online');
      net.warned = true;
      updateRoomBadge();
      netStartPing();
      netSendPing();
      netEmitStatus();
      break;
    }
    case 'join':
      if (msg.player) netRememberState(msg.player);
      { // Tell the room about newcomers, but not about everyone already there as you arrive.
        const p = msg.player || msg, fresh = !net.players.has(p.id) && p.id !== net.id;
        addRemote(p);
        if (fresh && net.mode === 'mqtt' && performance.now() - net.onlineAt > 3000 && net.players.has(p.id)) toast(netPeerName(p.id) + ' joined');
      }
      if (!net.warned) toast('Connected. ' + netPlayerCount() + ' player(s) online');
      net.warned = true;
      netEmitStatus();
      break;
    case 'leave':
      net.authPlayers.delete(msg.id);
      for (const [index, lease] of net.rides) if (lease.id === msg.id) net.rides.delete(index);
      if (net.mode === 'mqtt' && net.players.has(msg.id)) toast(netPeerName(msg.id) + ' left');
      removeRemote(msg.id);
      netEmitStatus();
      break;
    case 'state': {
      netRememberState(msg);
      if (msg.id === net.id) { netApplyOwnState(msg); break; }
      // A host relay is older than the peer's own direct pose. Take its
      // authoritative fields but do not pull the avatar back in time.
      const direct = net.mode === 'mqtt' ? net.players.get(msg.id) : null;
      if (direct && rxNow - (direct.directAt || -Infinity) < 600) netApplyRemotePose(direct, msg);
      else addRemote(msg);
      break;
    }
    case 'states':
      for (const p of (msg.players || [])) if (p && p.t === 'state') handleNet(p, from, true);
      break;
    case 'roster': {
      const ids = new Set();
      for (const p of (msg.players || [])) {
        if (!p || !netValidId(p.id) || !netValidPosition(p)) continue;
        ids.add(p.id);
        if (!netAcceptPose(p)) continue;
        netRememberState(p);
        if (p.id === net.id) netApplyOwnState(p);
        else addRemote(p);
      }
      for (const id of [...net.players.keys()]) if (!ids.has(id)) { net.authPlayers.delete(id); removeRemote(id); }
      netReceiveScores(msg);
      netEmitStatus();
      break;
    }
    case 'health':
      netApplyOwnState(msg);
      break;
    case 'teamSet':
      netOnTeamSet(msg);
      break;
    case 'correction':
      if (msg.id === net.id && netValidPosition(msg)) {
        player.pos.set(msg.x, msg.y, msg.z);
        player.vel.set(0, 0, 0);
        netApplyOwnState(msg);
      }
      break;
    case 'edit':
      applyNetEdit(msg);
      break;
    case 'edits':
      netRememberEditBatch(msg);
      for (const e of (msg.edits || [])) applyNetEdit({ ...e, generation: msg.generation, epoch: msg.epoch });
      break;
    case 'editAck':
    case 'editReject':
      netEditResponse(msg);
      break;
    case 'voxelHit': {
      const hit = netVoxelHitMessage(msg, msg.id || msg.by);
      if (hit && hit.by !== net.id && typeof applyVoxelDamage === 'function') applyVoxelDamage(hit);
      break;
    }
    case 'hit':
      if (!Number.isFinite(msg.dmg) || msg.dmg <= 0 || !netValidId(msg.target) || !netValidId(msg.byId)) break;
      if (netToken(msg.eventId)) net.seenHits.add(msg.eventId);
      while (net.seenHits.size > 256) net.seenHits.delete(net.seenHits.values().next().value);
      if (msg.target !== net.id && Number.isFinite(msg.health) && netEnemies(msg.byId, msg.target)) {
        const targetRecord = net.authPlayers.get(msg.target);
        if (targetRecord && (!Number.isSafeInteger(msg.life) || msg.life >= targetRecord.life) &&
            (!Number.isSafeInteger(msg.sid) || !Number.isSafeInteger(targetRecord.sid) || msg.sid >= targetRecord.sid)) {
          targetRecord.hp = netPoseNumber(msg.health, targetRecord.hp, 0, MAX_HEALTH);
          if (Number.isSafeInteger(msg.sid)) targetRecord.sid = msg.sid;
          const remote = net.players.get(msg.target);
          if (remote) remote.hp = targetRecord.hp;
          if (msg.kill && netToken(msg.kill.killId)) {
            targetRecord.deathReported = true;
            targetRecord.deathEvent = msg.kill;
            if (!Number.isFinite(targetRecord.deathAt)) targetRecord.deathAt = rxNow;
          }
          if (remote && msg.byId === net.id && msg.authoritative === true) {
            BC.emit('playerHit', {
              targetId: msg.target, byId: msg.byId, damage: msg.dmg, health: targetRecord.hp,
              head: !!netPoseFlag(msg.head, 0), weapon: msg.weapon, life: msg.life,
              shotId: msg.shotId, eventId: msg.eventId, generation: net.generation, authoritative: true
            });
          }
        }
      }
      if (msg.target === net.id) {
        if (!Number.isFinite(msg.dmg) || msg.dmg <= 0 || !netValidId(msg.byId)) break;
        const w = Object.prototype.hasOwnProperty.call(WEAPON_BY_ID, msg.weapon) ? WEAPON_BY_ID[msg.weapon] : null;
        if (msg.weapon === 'dragon' ? msg.dmg > 55 : !w || msg.dmg > combatDamageCap(w, msg.head) * netModeDamage() + 0.5) break;
        if (Number.isSafeInteger(msg.life) && msg.life < (net.localLife || 0)) break;
        if (Number.isSafeInteger(msg.sid) && msg.sid < net.healthSid) break;
        const previousDamage = net.damageContext, previousKill = net.killContext;
        net.damageContext = msg;
        if (msg.kill && netToken(msg.kill.killId)) net.killContext = netKillInfo(msg.kill);
        try {
          const amount = Number.isFinite(msg.health) ? Math.max(0, health - Math.max(0, msg.health)) : msg.dmg;
          const accepted = amount > 0
            ? applyDamage(Math.min(COMBAT_MAX_HIT, amount), msg.by, !!netPoseFlag(msg.head, 0), msg.byId, { ...msg, authoritative: true })
            : alive && netEnemies(msg.byId, net.id);
          if (accepted !== false) {
            if (alive && Number.isFinite(msg.health) && msg.health > 0) setHealth(netPoseNumber(msg.health, health, 0, MAX_HEALTH));
            if (Number.isSafeInteger(msg.sid)) net.healthSid = msg.sid;
            const own = net.authPlayers.get(net.id);
            if (own && Number.isFinite(msg.health)) {
              own.hp = msg.health;
              if (Number.isSafeInteger(msg.sid)) own.sid = msg.sid;
              if (msg.kill && netToken(msg.kill.killId)) {
                own.deathReported = true; own.deathEvent = msg.kill;
                if (!Number.isFinite(own.deathAt)) own.deathAt = rxNow;
              }
            }
          }
        } finally { net.damageContext = previousDamage; net.killContext = previousKill; }
        // applyDamage owns local hit/death sounds and hooks; do not voice twice.
      }
      break;
    case 'reload': {
      if (msg.id === net.id) break;
      netRememberState(msg);
      addRemote(msg);
      const r = net.players.get(msg.id);
      if (r) updateAvatarWeaponPose(r.group, netRemotePoseState(r, performance.now()), 0);
      break;
    }
    case 'shot': {
      if (msg.id === net.id) break;
      const r = net.players.get(msg.id);
      if (!r || r.hp <= 0 || r.deadUntil > performance.now() || r.dragon >= 0 || netRiderMounted(r.id)) break;
      if (netPoseFlag(msg.build, r.build) || !netPoseFlag(msg.combat, r.combat)) break;
      r.lastRx = rxNow;
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
      const spatialAudio = netAPI('audio');
      if (dist < 75 && !(spatialAudio && spatialAudio.available)) {
        const w = WEAPON_BY_ID[r.weapon];
        playShot(w, Math.max(0.05, 1 - dist / 75) * 0.95);
      }
      netEmitSfx({
        kind: 'shot', weapon: r.weapon,
        position: netPositionSfx(msg) || { x: pos.x, y: pos.y, z: pos.z },
        volume: Math.max(0.05, 1 - dist / 90)
      });
      break;
    }
    case 'died': {
      const knownLife = msg.id === net.id ? net.localLife : (net.players.get(msg.id) || {}).life;
      if (Number.isSafeInteger(msg.life) && msg.life < (knownLife || 0)) {
        netAnnounceKill(msg); break; // score a delayed token without killing a new life
      }
      const victim = net.players.get(msg.id);
      const firstDeath = !net.seenKills.has(msg.killId);
      const record = net.authPlayers.get(msg.id);
      if (record) {
        record.hp = 0; record.deaths = msg.deaths; record.kills = msg.kills;
        record.life = msg.life; record.deathReported = true;
        record.deathEvent = msg;
        if (!Number.isFinite(record.deathAt)) record.deathAt = rxNow;
        if (Number.isSafeInteger(msg.sid)) record.sid = Math.max(record.sid || 0, msg.sid);
      }
      if (victim) {
        victim.lastRx = rxNow;
        victim.deaths = Math.floor(netPoseNumber(msg.deaths, victim.deaths, 0, 999999));
        victim.kills = Math.floor(netPoseNumber(msg.kills, victim.kills, 0, 999999));
        victim.deathNoted = true;
      }
      if (msg.id === net.id) netApplyOwnState({ ...msg, hp: 0 });
      if (msg.byId && msg.byId === net.id) {
        kills = Math.floor(netPoseNumber(msg.killerKills, kills, 0, 999999));
        setKd();
        if (firstDeath) {
          toast('You eliminated ' + safeName(msg.victim));
          playTone(880, 0.08, 'triangle', 0.08);
        }
      } else if (msg.byId && msg.byId !== msg.id) {
        const killer = net.players.get(msg.byId);
        if (killer) killer.kills = Math.floor(netPoseNumber(msg.killerKills, killer.kills, 0, 999999));
      }
      const killerRecord = net.authPlayers.get(msg.byId);
      if (killerRecord && Number.isFinite(msg.killerKills)) killerRecord.kills = msg.killerKills;
      if (victim && firstDeath) netEmitSfx({ kind: 'death', weapon: msg.weapon,
        position: { x: victim.x, y: victim.y + victim.bodyHeight * 2 / 3, z: victim.z }, volume: 1, killId: msg.killId });
      netAnnounceKill(msg);
      netReceiveScores(msg);
      {
        const r = net.players.get(msg.id);
        if (r) {
          r.deadUntil = performance.now() + 3300;
          r.hp = 0;
          r.vx = r.vy = r.vz = 0;
          r.reload = -1;
          r.firePose = r.kick = r.firing = 0;
          updateAvatarWeaponPose(r.group, netRemotePoseState(r, performance.now()), 0);
          r.group.visible = false;
        }
      }
      break;
    }
    case 'respawn': {
      netRememberState(msg);
      if (msg.id === net.id) { netApplyOwnState(msg); break; }
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
    case 'pong': {
      netRecordPong(msg, from);
      break;
    }
    case 'ping': {
      // LAN pings are answered by server.js. The MQTT relay has no server, so a
      // peer answers directly (echoing the sender's own clock stamp).
      if (net.mode !== 'mqtt' || !Number.isFinite(msg.at) || from === net.id || msg.to !== net.id || !Number.isSafeInteger(msg.seq)) break;
      netSend({ t: 'pong', at: msg.at, seq: msg.seq, to: from });
      break;
    }
    case 'tick':
      if (!net.online) break;
      if ((!prevRx || rxNow - prevRx > 6000 || msg.generation !== net.generation) && typeof window.__netIdentity === 'function') window.__netIdentity();
      break;
    case 'seed':
    case 'match': {
      if (net.mode === 'ws' && netValidId(msg.hostId)) netSetAuthority(msg.hostId, true);
      if (net.mode === 'mqtt' && from !== net.hostId) break;
      netReceiveConfig(msg, net.hostId);
      netEmitStatus();
      break;
    }
    case 'rideGrant':
    case 'rideDenied':
    case 'ride':
    case 'dragons':
      break;
    case 'breath':
      // 46-riding.js owns remote flame particles/voice through netPacket.
      if (!netAPI('riding')) netEmitSfx({ kind: 'breath', position: netPositionSfx(msg), volume: 0.7 });
      break;
  }
  } catch (err) {
    // A malformed peer packet must never break the receive path.
    console.warn('[net] ignored packet', err);
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

function netClearLanTimers() {
  if (net.openTimer) { clearTimeout(net.openTimer); net.openTimer = null; }
  if (net.reconnectTimer) { clearTimeout(net.reconnectTimer); net.reconnectTimer = null; }
}

function netDropLanSocket() {
  const ws = net.ws;
  net.ws = null;
  if (!ws) return;
  ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
  try { ws.close(); } catch (e) { /* already closed */ }
}

function netCancelSession(clearHistory, keepAuthority) {
  net.session++;
  netStopPing();
  netDropQueue();
  net.configTask = null;
  net.configVersion++;
  net.rxSeq.clear();
  net.rides.clear();
  net.dragonCatalog.clear();
  net.seenHits.clear();
  net.seenShots.clear();
  net.pendingEdits.clear();
  netClearEdits(clearHistory);
  net.healthSid = -1;
  net.ping = net.jitter = net.lastPong = net.lastRx = net.onlineAt = 0;
  net.pingSource = '';
  for (const id of [...net.players.keys()]) removeRemote(id);
  for (const flash of remoteFlashes) { scene.remove(flash.s); flash.s.material.dispose(); }
  remoteFlashes.length = 0;
  if (!keepAuthority) {
    net.authPlayers.clear();
    net.seenKills.clear();
    net.localLife = 0;
    net.hostId = null;
    net.seed = net.matchMode = null;
    net.generation = 0;
    net.epoch = '';
    net.forceRideable = false;
    net.configPending = net.configError = net.localReset = net.localWorldReset = false;
    net.matchScores.red = net.matchScores.blue = 0;
    net.scoreSeq = -1;
  }
  net.authorityReady = false;
  if (typeof BC !== 'undefined' && BC.flags) {
    BC.flags.roomAuthorityReady = false;
    BC.flags.roomHostId = net.hostId || '';
  }
}

function netDisconnect(reason, manual) {
  const active = !!(net.mode || net.ws || net.reconnectTimer);
  net.closedByUs = manual === true;
  netClearLanTimers();
  mqttClearTimers();
  netDropLanSocket();
  roomStop();
  net.online = false;
  netCancelSession(true, false);
  mqtt.limiters.clear();
  net.mode = null;
  net.id = null;
  net.room = '';
  net.desync = false;
  updateRoomBadge();
  if (active) netEmitStatus();
  if (active && reason && typeof toast === 'function') toast(reason);
  return active;
}

function netScheduleLanReconnect() {
  if (net.closedByUs || net.mode === 'mqtt' || net.reconnectTimer) return;
  if (net.attempts >= 3) {
    net.mode = null;
    netEmitStatus();
    return;
  }
  net.attempts++;
  const session = net.session;
  net.reconnectTimer = setTimeout(() => {
    net.reconnectTimer = null;
    if (session === net.session && !net.closedByUs && net.mode !== 'mqtt') connectNet();
  }, 4000);
}

function netLoseLanConnection(ws) {
  if (net.ws !== ws || net.mode !== 'ws') return;
  const wasOnline = net.online;
  netClearLanTimers();
  netDropLanSocket();
  net.online = false;
  net.id = null;
  netCancelSession(true, false);
  net.mode = 'ws';
  net.desync = false;
  netEmitStatus();
  if (wasOnline) toast('LAN multiplayer disconnected. Reconnecting…');
  netScheduleLanReconnect();
}

function connectNet() {
  if (net.mode === 'mqtt' || net.closedByUs) return;
  if (!lanPossible()) return;
  if (net.ws && (net.ws.readyState === 0 || net.ws.readyState === 1)) return;
  netClearLanTimers();
  const session = ++net.session;
  net.mode = 'ws';
  let ws;
  try { ws = new WebSocket(netUrl()); } catch (e) { netScheduleLanReconnect(); return; }
  net.ws = ws;
  const current = () => net.ws === ws && net.mode === 'ws' && net.session === session;
  net.openTimer = setTimeout(() => { if (current()) netLoseLanConnection(ws); }, 10000);

  ws.onopen = () => {
    if (!current()) return;
    net.desync = false;
    net.rxSeq.clear();
    netSend(netJoinPacket());
    netStartPing();
    netSendPing();
    netEmitStatus();
  };
  ws.onmessage = (ev) => {
    if (!current()) return;
    if (typeof ev.data !== 'string' || ev.data.length > NET_MAX_FRAME) { netLoseLanConnection(ws); return; }
    try { handleNet(JSON.parse(ev.data)); } catch (e) { /* ignore bad frames */ }
  };
  ws.onerror = () => { /* onclose handles it */ };
  ws.onclose = () => {
    if (current()) netLoseLanConnection(ws);
  };
}

/* ---------------- MQTT 3.1.1 over WebSocket ---------------- */
function netMqttAction(type) {
  switch (type) {
    case 'join': case 'state': case 'reload': case 'shot': case 'hit':
    case 'voxelHit': case 'edit': case 'edits': case 'died': case 'respawn':
    case 'ride': case 'breath': case 'dragons': case 'team': return true;
    default: return false;
  }
}

function netMqttBudget(id, bytes, control, authority) {
  const now = performance.now(), lane = control ? 'c' : authority ? 'a' : 'r';
  const key = id + ':' + lane, rate = control ? 8 : authority ? 1000 : 100;
  const burst = control ? 12 : authority ? 256 : 140;
  const byteRate = authority ? 1200 * 1024 : 180000;
  let bucket = mqtt.limiters.get(key);
  if (!bucket) {
    if (mqtt.limiters.size >= NET_MAX_PEERS * 3) return false;
    bucket = { at: now, messages: burst, bytes: byteRate, drops: 0, blockedUntil: 0 };
    mqtt.limiters.set(key, bucket);
  }
  const dt = Math.max(0, now - bucket.at) / 1000;
  bucket.messages = Math.min(burst, bucket.messages + dt * rate);
  bucket.bytes = Math.min(byteRate, bucket.bytes + dt * byteRate);
  bucket.at = now;
  if (now < bucket.blockedUntil || bucket.messages < 1 || bucket.bytes < bytes) {
    if (++bucket.drops > 400) { bucket.blockedUntil = now + NET_PEER_TIMEOUT; bucket.drops = 0; }
    return false;
  }
  bucket.messages--;
  bucket.bytes -= bytes;
  bucket.drops = Math.max(0, bucket.drops - 1);
  return true;
}

function netMqttRecord(id, msg, create) {
  let r = net.authPlayers.get(id);
  if (!r) {
    if (!create || !netValidPosition(msg) || net.authPlayers.size >= NET_MAX_PEERS) return null;
    r = { id, name: 'Player', character: 'steve', x: msg.x, y: msg.y, z: msg.z,
      yaw: 0, pitch: 0, weapon: 'pistol', hp: MAX_HEALTH, kills: 0, deaths: 0,
      life: 1, aim: 0, firing: 0, combat: 1, build: 0, reload: -1,
      reloadTotal: WEAPON_BY_ID.pistol.reload, reloadRounds: WEAPON_BY_ID.pistol.mag,
      crouch: 0, slide: 0, fly: 0, onGround: 1, boost: 0, dash: 0, fuel: 100, height: 1.8,
      bodyHeight: 1.8, dragon: -1, deathReported: false, deathEvent: null, team: null };
    net.authPlayers.set(id, r);
    netAssignTeam(r);
  }
  if (!r.shots) {
    const now = performance.now();
    r.shots = new Map();
    r.shot = null;
    r.seqIn = r.stateIn = -1;
    r.outSid = Math.max(Number.isSafeInteger(r.sid) ? r.sid : 0, net.rxSeq.get(id) || 0,
      id === net.id ? net.healthSid : 0);
    r.positionAt = r.healthAt = now;
    r.lastDamageAt = r.hp < MAX_HEALTH ? now : -Infinity;
    r.lastFireAt = -Infinity;
    r.lastFireInterval = 0;
    r.fireClockOrigin = Number.isFinite(msg.clockAt) && msg.clockAt >= 0 ? now - msg.clockAt : null;
    r.editAt = now;
    r.editTokens = NET_EDIT_BURST;
    if (!r.editBatches) r.editBatches = new Map();
    r.awaitingSpawn = msg.generation !== net.generation || msg.seed !== net.seed;
    if (!Number.isFinite(r.deathAt)) r.deathAt = r.hp <= 0 ? now - 3200 : -Infinity;
  }
  if (r.hp <= 0) r.deathReported = true;
  else if (r.deathReported) { r.deathReported = false; r.deathEvent = null; r.deathAt = -Infinity; }
  r.lastRx = performance.now();
  return r;
}

function netMqttAdvanceHealth(r) {
  const now = performance.now();
  if (r.hp > 0 && r.hp < MAX_HEALTH && !NET_NO_REGEN_MODES.has(net.matchMode)) {
    const from = Math.max(r.healthAt || now, r.lastDamageAt + 6000);
    if (now > from) r.hp = Math.min(MAX_HEALTH, r.hp + (now - from) * 0.014);
  }
  r.healthAt = now;
}

function netMqttReload(r) {
  if (!r.combat || r.hp <= 0 || !(r.reload >= 0)) return -1;
  const value = r.reload + Math.max(0, performance.now() - r.reloadAt) / (r.reloadTotal * 1000);
  if (value >= 1) { r.reload = -1; return -1; }
  return value;
}

function netMqttPose(r, msg) {
  netMqttAdvanceHealth(r);
  let weapon = netPoseWeapon(msg.weapon, r.weapon);
  const allowed = NET_MODE_WEAPONS[net.matchMode];
  if (allowed && !allowed.includes(weapon)) weapon = allowed[0];
  if (weapon !== r.weapon) { r.reload = -1; r.firing = 0; }
  r.weapon = weapon;
  const w = WEAPON_BY_ID[weapon];
  r.yaw = netPoseYaw(msg.yaw, r.yaw);
  r.pitch = netPoseNumber(msg.pitch, r.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  r.combat = netPoseFlag(msg.combat, msg.build === undefined ? r.combat : 1 - netPoseFlag(msg.build, r.build));
  if (netPoseFlag(msg.build, 0)) r.combat = 0;
  r.build = 1 - r.combat;
  if (msg.reload !== undefined) {
    r.reload = netPoseReload(msg.reload);
    r.reloadAt = performance.now();
    r.reloadTotal = netPoseNumber(msg.reloadTotal, w.reload, 0.25, w.reload);
    r.reloadRounds = Math.round(netPoseNumber(msg.reloadRounds, w.mag, 1, w.mag));
  }
  const ready = r.combat && r.hp > 0 && r.dragon < 0 && netMqttReload(r) < 0;
  r.aim = ready ? netPoseFlag(msg.aim, r.aim) : 0;
  r.firing = ready ? netPoseFlag(msg.firing, r.firing) : 0;
  r.crouch = netPoseFlag(msg.crouch, r.crouch);
  r.slide = netPoseFlag(msg.sliding === undefined ? msg.slide : msg.sliding, r.slide);
  r.fly = r.hp > 0 ? netPoseFlag(msg.fly, r.fly) : 0;
  r.onGround = netPoseFlag(msg.onGround, r.onGround);
  r.boost = r.fly ? netPoseFlag(msg.boost, 0) : 0;
  r.dash = r.hp > 0 ? netPoseFlag(msg.dash, 0) : 0;
  r.fuel = netPoseNumber(msg.fuel, r.fuel, 0, 100);
  r.height = r.bodyHeight = netPoseNumber(msg.bodyHeight === undefined ? msg.height : msg.bodyHeight,
    r.crouch || r.slide || r.dash ? 1.2 : 1.8, 1.1, 1.9);
  if (!ready) r.reload = r.hp <= 0 || !r.combat ? -1 : r.reload;
}

function netMqttPublic(r) {
  netMqttAdvanceHealth(r);
  const dragon = netDragonRideable(r.dragon) ? r.dragon : -1;
  const reload = netMqttReload(r), ready = r.combat && r.hp > 0 && dragon < 0 && reload < 0;
  return { id: r.id, name: r.name, character: r.character, x: r.x, y: r.y, z: r.z,
    yaw: r.yaw, pitch: r.pitch, weapon: r.weapon, hp: r.hp, kills: r.kills, deaths: r.deaths,
    life: r.life, aim: ready ? r.aim : 0, firing: ready ? r.firing : 0, combat: r.combat, build: r.build,
    reload, reloadTotal: r.reloadTotal, reloadRounds: r.reloadRounds,
    crouch: r.crouch, slide: r.slide, sliding: r.slide, fly: r.fly, onGround: r.onGround, boost: r.boost,
    dash: r.dash, fuel: r.fuel, height: r.height, bodyHeight: r.bodyHeight,
    dragon, team: r.team || netAssignTeam(r), generation: net.generation, sid: ++r.outSid };
}

function netMqttResetMatch() {
  net.matchScores.red = net.matchScores.blue = 0;
  net.scoreSeq = mqtt.scoreSerial = 0;
  for (const r of net.authPlayers.values()) {
    r.hp = MAX_HEALTH;
    r.kills = r.deaths = 0;
    r.life = (Number.isSafeInteger(r.life) ? r.life : 0) + 1;
    r.deathReported = false;
    r.deathEvent = null;
    r.dragon = -1;
    r.shot = null;
    if (r.shots) r.shots.clear();
    r.aim = r.firing = r.fly = r.boost = r.dash = 0;
    r.reload = -1;
    r.awaitingSpawn = true;
    r.healthAt = performance.now();
    r.lastDamageAt = -Infinity;
  }
}

function netMqttAuthority(packet, to) {
  if (!net.online || !net.authorityReady || net.hostId !== net.id) return false;
  packet = { ...packet, generation: net.generation, epoch: net.epoch, authoritative: true };
  const envelope = { t: 'authority', hostId: net.id, generation: net.generation,
    epoch: net.epoch, wireSeq: ++mqtt.wireSeq, packet };
  if (to) envelope.to = to;
  // Apply the authority's own decision directly. Its broker echo is ignored,
  // so local grants, damage and score events cannot run twice.
  if (!to || to === net.id) handleNet(packet, net.id);
  return netSend(envelope);
}

// Relays run on arrival, with the timer only as a backstop: background tabs
// clamp timers to 1 s, which would freeze everyone when the host alt-tabs.
function netMqttQueueState(packet) {
  mqtt.pendingStates.set(packet.id, packet);
  if (performance.now() - mqtt.stateFlushAt >= NET_SEND_MS) netMqttFlushStates();
  else if (!mqtt.stateTimer) mqtt.stateTimer = setTimeout(netMqttFlushStates, NET_SEND_MS);
}

function netMqttFlushStates() {
  if (mqtt.stateTimer) { clearTimeout(mqtt.stateTimer); mqtt.stateTimer = null; }
  if (!net.online || net.hostId !== net.id || !net.authorityReady || !mqtt.pendingStates.size) return;
  const now = mqtt.stateFlushAt = performance.now();
  const players = [...mqtt.pendingStates.values()];
  mqtt.pendingStates.clear();
  handleNet({ t: 'states', players, generation: net.generation, epoch: net.epoch, authoritative: true }, net.id);
  const changed = [], rows = [];
  for (const p of players) {
    const r = net.authPlayers.get(p.id);
    if (!r) continue;
    const key = roomSlowKey(p);
    if (key !== r.slowKey) { r.slowKey = key; changed.push(p); continue; }
    const row = roomPoseRow(p), same = String(row);
    // Someone standing still only sends enough to show they are alive.
    if (same === r.rowKey && now - (r.rowAt || 0) < 800) continue;
    r.rowKey = same;
    r.rowAt = now;
    rows.push([p.id.slice(-6), p.sid, ...row]);
  }
  if (changed.length) {
    netSend({ t: 'authority', hostId: net.id, generation: net.generation, epoch: net.epoch, wireSeq: ++mqtt.wireSeq,
      packet: { t: 'states', players: changed, generation: net.generation, epoch: net.epoch, authoritative: true } });
  }
  if (rows.length) roomSendRows(rows, net.generation);
}

function netMqttRoster(to) {
  if (net.hostId !== net.id || !net.authorityReady) return;
  netMqttAuthority({ t: 'roster', hostId: net.id, players: [...net.authPlayers.values()].map(netMqttPublic),
    scores: { ...net.matchScores }, scoreSeq: Math.max(0, net.scoreSeq) }, to);
}

function netMqttPosition(r, msg, spawn) {
  if (!netValidPosition(msg)) return false;
  if (r.hp <= 0 && !spawn) return true;
  const now = performance.now(), elapsed = Math.max(0, now - r.positionAt) / 1000;
  // 64 is an L1 travel envelope, NOT a 28m/s total-vector cap: legal 28m/s
  // horizontal boost plus 17.5m/s ascent (also diagonal) fits comfortably.
  const limit = Math.max(24, Math.min(96, elapsed * 64 + 4));
  if (!spawn && !r.awaitingSpawn && Math.abs(msg.x - r.x) + Math.abs(msg.y - r.y) + Math.abs(msg.z - r.z) > limit) {
    netMqttAuthority({ t: 'correction', ...netMqttPublic(r) }, r.id);
    return true;
  }
  r.x = msg.x; r.y = msg.y; r.z = msg.z;
  r.positionAt = now;
  r.awaitingSpawn = false;
  return true;
}

function netMqttWeaponAllowed(id) {
  const allowed = NET_MODE_WEAPONS[net.matchMode];
  return Object.prototype.hasOwnProperty.call(WEAPON_BY_ID, id) && (!allowed || allowed.includes(id));
}

function netMqttFireLock(r, msg, type) {
  const now = performance.now(), w = WEAPON_BY_ID[msg.weapon];
  if (!w) return false;
  const interval = NET_FIRE_MS[msg.weapon] * 0.75;
  if (type === 'shot') {
    const id = netToken(msg.shotId);
    if (!id || r.shots.has(id)) return false;
    let fireAt = now;
    if (msg.shotAt !== undefined) {
      if (!Number.isFinite(msg.shotAt) || msg.shotAt < 0 || msg.shotAt > Number.MAX_SAFE_INTEGER) return false;
      // Track the fastest delivery seen. Anchoring to the first packet let one
      // slow first shot reject every later on-time shot (and all its hits).
      const origin = now - msg.shotAt;
      if (r.fireClockOrigin === null || origin < r.fireClockOrigin) r.fireClockOrigin = origin;
      fireAt = msg.shotAt + r.fireClockOrigin;
      if (fireAt < now - 1500) return false;
    }
    if (fireAt - r.lastFireAt < Math.max(interval, r.lastFireInterval)) return false;
    r.lastFireAt = fireAt;
    r.lastFireInterval = interval;
    for (const [key, shot] of r.shots) if (now - shot.at > NET_SHOT_WINDOW) r.shots.delete(key);
    r.shot = { id, weapon: msg.weapon, at: now, remaining: w.pellets, seen: new Set(), x: msg.x, y: msg.y, z: msg.z };
    r.shots.set(id, r.shot);
    while (r.shots.size > 16) r.shots.delete(r.shots.keys().next().value);
    return true;
  }
  const shot = r.shots.get(netToken(msg.shotId)), token = netToken(msg.eventId || msg.hitId);
  if (!shot || shot.weapon !== msg.weapon || now - shot.at > NET_SHOT_WINDOW || shot.remaining <= 0 || !token || shot.seen.has(token)) return false;
  shot.remaining--;
  shot.seen.add(token);
  return true;
}

function netMqttLeasePacket(lease, active, reason) {
  return { t: active ? 'rideGrant' : 'ride', id: lease.id, riderId: lease.id,
    active: active ? 1 : 0, dragon: lease.dragon, index: lease.dragon, lease: lease.lease,
    x: lease.x, y: lease.y, z: lease.z, yaw: lease.yaw, pitch: lease.pitch,
    remainingMs: active ? Math.max(0, lease.until - performance.now()) : 0,
    seed: net.seed, dragonCount: netDragonCount(net.seed), reason };
}

function netMqttReleaseRide(r, reason) {
  const lease = net.rides.get(r.dragon);
  r.dragon = -1;
  if (!lease || lease.id !== r.id) return;
  net.rides.delete(lease.dragon);
  netMqttAuthority(netMqttLeasePacket(lease, false, reason));
}

function netMqttRide(r, msg) {
  const index = netDragonIndex(msg, net.seed), now = performance.now();
  const rules = netDragonRules(), descriptor = rules && rules.descriptor(net.seed, index);
  const deny = (reason) => netMqttAuthority({ t: 'rideDenied', id: r.id, riderId: r.id,
    dragon: index, index, seed: net.seed,
    dragonCount: netDragonCount(net.seed), reason }, r.id);
  if (msg.active === false || msg.active === 0) {
    const current = net.rides.get(r.dragon);
    if (current && (current.dragon !== index || msg.lease !== current.lease || !netDragonRoleMatches(msg, descriptor))) { deny('stale lease'); return; }
    netMqttReleaseRide(r, 'manual'); return;
  }
  if (msg.active !== true && msg.active !== 1 || !netDragonRoleMatches(msg, descriptor) ||
      !netValidPosition(msg) || !Number.isFinite(msg.yaw) || !Number.isFinite(msg.pitch) || r.hp <= 0 || NET_MODE_WEAPONS[net.matchMode]) {
    deny('invalid'); return;
  }
  if (!netDragonRideable(index)) { deny('not rideable'); return; }
  let lease = net.rides.get(index);
  if (lease && lease.until <= now) {
    const rider = net.authPlayers.get(lease.id);
    if (rider) netMqttReleaseRide(rider, 'time');
    else net.rides.delete(index);
    lease = null;
  }
  if (lease && lease.id !== r.id) { deny('occupied'); return; }
  if (r.dragon >= 0 && r.dragon !== index) { deny('already riding'); return; }
  if (!lease) {
    const dragon = typeof dragons !== 'undefined' ? dragons[index] : null;
    const catalog = net.dragonCatalog.get(index);
    if (netWorldBusy() || netCurrentSeed() !== net.seed || !catalog || catalog.seed !== net.seed ||
        catalog.generation !== net.generation || !dragon || dragon.index !== index || !dragon.group ||
        (dragon.seed !== undefined && dragon.seed !== net.seed)) { deny('world pending'); return; }
    const p = dragon.group.position;
    if (Math.hypot(msg.x - p.x, msg.y - p.y, msg.z - p.z) > 10 ||
        Math.hypot(msg.x - r.x, msg.y - r.y, msg.z - r.z) > 10) { deny('out of range'); return; }
    lease = { id: r.id, dragon: index, lease: net.epoch + ':' + net.id + ':ride:' + (++net.eventSeq),
      until: now + 30000, at: now, breathAt: -Infinity, x: msg.x, y: msg.y, z: msg.z,
      yaw: netPoseYaw(msg.yaw, 0), pitch: netPoseNumber(msg.pitch, 0, -1.5, 1.5),
      seed: net.seed, generation: net.generation, epoch: net.epoch };
    r.dragon = index;
    r.aim = r.firing = 0;
    r.shot = null;
    r.shots.clear();
    net.rides.set(index, lease);
    netMqttAuthority(netMqttLeasePacket(lease, true, 'granted'));
    return;
  }
  if (msg.lease !== lease.lease) { deny('stale lease'); return; }
  const limit = Math.max(8, Math.min(96, (now - lease.at) * 0.048 + 3));
  if (Math.hypot(msg.x - lease.x, msg.y - lease.y, msg.z - lease.z) > limit) {
    netMqttAuthority(netMqttLeasePacket(lease, true, 'correction'), r.id); return;
  }
  lease.x = msg.x; lease.y = msg.y; lease.z = msg.z;
  lease.yaw = netPoseYaw(msg.yaw, lease.yaw);
  lease.pitch = netPoseNumber(msg.pitch, lease.pitch, -1.5, 1.5);
  lease.at = now;
  netMqttAuthority({ ...netMqttLeasePacket(lease, true, 'pose'), t: 'ride' });
}

function netMqttDeath(victim, killer, weapon, head) {
  if (victim.deathReported && victim.deathEvent) return victim.deathEvent;
  victim.hp = 0;
  victim.deathReported = true;
  victim.deathAt = performance.now();
  victim.deaths++;
  victim.aim = victim.firing = victim.fly = victim.boost = victim.dash = 0;
  victim.reload = -1;
  victim.shot = null;
  victim.shots.clear();
  netMqttReleaseRide(victim, 'death');
  if (killer && netEnemies(killer.id, victim.id)) {
    killer.kills++;
    const team = netTeamFor(killer.id);
    if (team) net.matchScores[team]++;
  }
  else killer = null;
  const event = { t: 'died', id: victim.id, victimId: victim.id, victim: victim.name,
    byId: killer ? killer.id : '', killerId: killer ? killer.id : '', by: killer ? killer.name : '???',
    weapon, head: !!head, killId: net.epoch + ':' + net.id + ':kill:' + net.generation + ':' + (++net.eventSeq),
    scores: { ...net.matchScores }, scoreSeq: ++mqtt.scoreSerial,
    authoritative: true, life: victim.life, sid: ++victim.outSid,
    kills: victim.kills, deaths: victim.deaths, killerKills: killer ? killer.kills : undefined,
    killerTeam: killer ? netTeamFor(killer.id) : null, victimTeam: netTeamFor(victim.id),
    killerPos: killer ? { x: killer.x, y: killer.y, z: killer.z } : null,
    victimPos: { x: victim.x, y: victim.y, z: victim.z } };
  victim.deathEvent = event;
  net.scoreSeq = event.scoreSeq;
  return event;
}

function netMqttDamage(attacker, target, amount, weapon, head, eventId, origin) {
  netMqttAdvanceHealth(target);
  if (target.hp <= 0 || !netEnemies(attacker.id, target.id)) return;
  const cap = weapon === 'dragon' ? 55 : combatDamageCap(WEAPON_BY_ID[weapon], head);
  amount = Math.round(Math.min(cap, amount) * (weapon === 'dragon' ? 1 : netModeDamage()));
  target.hp = Math.max(0, target.hp - amount);
  target.lastDamageAt = target.healthAt = performance.now();
  const kill = target.hp <= 0 ? netMqttDeath(target, attacker, weapon, head) : null;
  netMqttAuthority({ t: 'hit', target: target.id, dmg: amount, health: target.hp, weapon, head: !!head,
    byId: attacker.id, by: attacker.name, eventId, life: target.life, sid: ++target.outSid, kill,
    shotId: weapon !== 'dragon' && origin ? origin.id : undefined,
    from: { x: origin.x, y: origin.y, z: origin.z } });
  if (kill) netMqttAuthority(kill);
  netMqttQueueState({ t: 'state', ...netMqttPublic(target) });
}

function netMqttBreath(r, msg) {
  const index = netDragonIndex(msg, net.seed);
  const lease = net.rides.get(index), now = performance.now();
  const rules = netDragonRules(), descriptor = rules && rules.descriptor(net.seed, index);
  if (!netDragonRideable(index) || !lease || lease.id !== r.id || lease.until <= now || r.hp <= 0 || msg.lease !== lease.lease ||
      !netDragonRoleMatches(msg, descriptor) ||
      !netValidPosition(msg) || Math.hypot(msg.x - lease.x, msg.y - lease.y, msg.z - lease.z) > 10 ||
      !Number.isFinite(msg.dx) || !Number.isFinite(msg.dy) || !Number.isFinite(msg.dz)) return;
  const length = Math.hypot(msg.dx, msg.dy, msg.dz);
  if (length < 0.5 || length > 1.5 || now - lease.breathAt < 180 ||
      (msg.targets !== undefined && (!Array.isArray(msg.targets) || msg.targets.length > NET_MAX_PEERS || msg.targets.some((id) => !netValidId(id))))) return;
  lease.breathAt = now;
  const dx = msg.dx / length, dy = msg.dy / length, dz = msg.dz / length, targets = [];
  for (const target of net.authPlayers.values()) {
    if (target.hp <= 0 || !netEnemies(r.id, target.id) || (msg.targets && !msg.targets.includes(target.id))) continue;
    const x = target.x - msg.x, y = target.y + target.bodyHeight * 0.55 - msg.y, z = target.z - msg.z;
    const distance = Math.hypot(x, y, z);
    if (distance > 18 || (distance > 0.001 && (x * dx + y * dy + z * dz) / distance < NET_BREATH_COS)) continue;
    targets.push(target.id);
    netMqttDamage(r, target, 55, 'dragon', false, lease.lease + ':breath:' + (++net.eventSeq), msg);
  }
  netMqttAuthority({ t: 'breath', id: r.id, riderId: r.id, dragon: index, lease: lease.lease,
    x: msg.x, y: msg.y, z: msg.z, dx, dy, dz, targets, seed: net.seed, dragonCount: netDragonCount(net.seed) });
}

function netMqttProcess(msg, from, budgeted) {
  if (!net.online || !net.authorityReady || net.hostId !== net.id || !netMqttAction(msg.t)) return false;
  if (!netInboundOK(msg) || !netValidId(from)) return true;
  if (!budgeted && !netMqttBudget(from, JSON.stringify(msg).length, false, false)) return true;
  const existed = net.authPlayers.has(from);
  const r = netMqttRecord(from, msg, msg.t === 'join');
  if (!r) return true;
  if (msg.t !== 'join' && (msg.generation !== net.generation || msg.epoch !== net.epoch ||
      (msg.life !== undefined && msg.life !== r.life) ||
      (['dragons', 'ride', 'breath'].includes(msg.t) && (msg.seed !== net.seed ||
        (msg.dragonCount !== undefined && msg.dragonCount !== netDragonCount(net.seed)))))) {
    netMqttRoster(from); return true;
  }
  const lane = msg.t === 'state' ? 'stateIn' : 'seqIn';
  if (!Number.isSafeInteger(msg.seq) || msg.seq <= r[lane]) return true;
  r[lane] = msg.seq;
  if (msg.t === 'join') {
    const current = msg.generation === net.generation && msg.seed === net.seed;
    if ((!existed || current) && !netMqttPosition(r, msg, !existed)) return true;
    if (!existed || current) netMqttPose(r, msg);
    if (!existed && !current) r.awaitingSpawn = true;
    r.name = typeof msg.name === 'string' ? safeName(msg.name).slice(0, 14) : r.name;
    r.character = typeof msg.character === 'string' && Object.prototype.hasOwnProperty.call(CHARACTERS, msg.character) ? msg.character : r.character;
    if (!existed) netMqttAuthority({ t: 'join', player: netMqttPublic(r) });
    if (current && from === net.hostId) netReceiveDragonCatalog(msg, from);
    mqttAdvertiseConfig();
    mqtt.historyJobs.set(from, { edits: [...net.editHistory.values()].filter(netEditMatches), cursor: 0,
      generation: net.generation, epoch: net.epoch });
    for (const lease of net.rides.values()) netMqttAuthority({ ...netMqttLeasePacket(lease, true, 'snapshot'), t: 'ride' }, from);
    if (r.deathReported && r.deathEvent) netMqttAuthority(r.deathEvent, from);
    netMqttRoster();
    return true;
  }
  // New-generation poses and validated edit transactions can be staged while
  // meshes rebuild. Dropping them here would lose legal fast-client building.
  if (netWorldBusy() && !['state', 'reload', 'edit', 'edits', 'dragons'].includes(msg.t)) return true;
  switch (msg.t) {
    case 'state': case 'reload':
      if (!netMqttPosition(r, msg, false)) break;
      netMqttPose(r, msg);
      if (typeof msg.name === 'string') r.name = safeName(msg.name).slice(0, 14);
      if (typeof msg.character === 'string' && Object.prototype.hasOwnProperty.call(CHARACTERS, msg.character)) r.character = msg.character;
      netMqttQueueState({ t: 'state', ...netMqttPublic(r) });
      break;
    case 'shot': {
      netMqttPose(r, msg);
      if (r.hp <= 0 || !r.combat || r.dragon >= 0 || netMqttReload(r) >= 0 || !netMqttWeaponAllowed(msg.weapon) || msg.weapon !== r.weapon ||
          !netValidPosition(msg) || Math.hypot(msg.x - r.x, msg.y - r.y, msg.z - r.z) >
          10 + Math.min(16, Math.max(0, performance.now() - r.positionAt) * 0.05) || !netMqttFireLock(r, msg, 'shot')) break;
      netMqttAuthority({ t: 'shot', id: r.id, weapon: r.weapon, shotId: msg.shotId,
        x: msg.x, y: msg.y, z: msg.z, yaw: r.yaw, pitch: r.pitch, aim: r.aim,
        firing: 1, combat: 1, build: 0, reload: -1, life: r.life, sid: ++r.outSid });
      break;
    }
    case 'hit': {
      const target = net.authPlayers.get(msg.target), w = WEAPON_BY_ID[msg.weapon];
      const head = netPoseFlag(msg.head, 0), shot = r.shots.get(netToken(msg.shotId));
      // The shot already passed the reload gate; pellets just ride on it.
      if (!target || !w || !shot || r.hp <= 0 || r.dragon >= 0 ||
          !netEnemies(r.id, target.id) || !netMqttWeaponAllowed(msg.weapon) || msg.weapon !== r.weapon ||
          !Number.isFinite(msg.dmg) || msg.dmg <= 0 || msg.dmg > combatDamageCap(w, head) ||
          Math.hypot(target.x - shot.x, target.y + target.bodyHeight * 0.55 - shot.y, target.z - shot.z) > Math.min(w.range, 120) + 2 ||
          !netMqttFireLock(r, msg, 'hit')) break;
      netMqttDamage(r, target, msg.dmg, msg.weapon, head, netToken(msg.eventId), shot);
      break;
    }
    case 'voxelHit': {
      const hit = netVoxelHitMessage(msg, r.id), shot = r.shots.get(netToken(msg.shotId));
      if (!hit || !shot || r.hp <= 0 || !r.combat || r.dragon >= 0 || netMqttReload(r) >= 0 ||
          !netMqttWeaponAllowed(hit.weapon) || hit.weapon !== r.weapon ||
          Math.hypot(hit.x + 0.5 - shot.x, hit.y + 0.5 - shot.y, hit.z + 0.5 - shot.z) > WEAPON_BY_ID[hit.weapon].range + 2 ||
          !netMqttFireLock(r, msg, 'voxelHit')) break;
      netMqttAuthority(hit);
      break;
    }
    case 'edit': case 'edits': {
      const list = msg.t === 'edit' ? [msg] : msg.edits, batchId = netToken(msg.batchId);
      if (batchId && r.editBatches.has(batchId)) {
        const current = Array.isArray(list) && list.length <= 128
          ? list.map((cell) => cell && net.editHistory.get(cell.x + ',' + cell.y + ',' + cell.z)).filter(Boolean) : [];
        netMqttAuthority({ t: 'editAck', batchId, edits: current }, r.id);
        break;
      }
      // Generous range: the host sees positions late, and jetpacks are fast.
      if (!Array.isArray(list) || !list.length || list.length > 128 || list.some((cell) => !netValidEditCell(cell) ||
          Math.hypot(cell.x + 0.5 - r.x, cell.y + 0.5 - r.y, cell.z + 0.5 - r.z) > 80)) {
        const cells = Array.isArray(list) ? list.slice(0, 128).filter(netValidEditCell).map((c) => ({ x: c.x, y: c.y, z: c.z, b: getBlock(c.x, c.y, c.z) })) : [];
        if (batchId) netMqttAuthority({ t: 'editReject', batchId, reason: 'shape/range', retryable: false, cells }, r.id);
        break;
      }
      const now = performance.now();
      r.editTokens = Math.min(NET_EDIT_BURST, r.editTokens + Math.max(0, now - r.editAt) * NET_EDIT_RATE / 1000);
      r.editAt = now;
      if (r.editTokens < list.length) {
        if (batchId) netMqttAuthority({ t: 'editReject', batchId, reason: 'rate', retryable: true,
          retryMs: Math.ceil((list.length - r.editTokens) * 1000 / NET_EDIT_RATE) + 25 }, r.id);
        break;
      }
      r.editTokens -= list.length;
      const accepted = [];
      for (const cell of list) {
        const edit = { t: 'edit', x: cell.x, y: cell.y, z: cell.z, b: cell.b, sid: ++mqtt.editSerial,
          generation: net.generation, epoch: net.epoch };
        const key = edit.x + ',' + edit.y + ',' + edit.z;
        net.editHistory.delete(key);
        net.editHistory.set(key, edit);
        accepted.push(edit);
      }
      while (net.editHistory.size > NET_MAX_EDITS) net.editHistory.delete(net.editHistory.keys().next().value);
      netMqttAuthority(msg.t === 'edit' ? accepted[0] : { t: 'edits', edits: accepted, batchId, by: r.id });
      if (batchId) {
        r.editBatches.set(batchId, true);
        while (r.editBatches.size > 512) r.editBatches.delete(r.editBatches.keys().next().value);
        netMqttAuthority({ t: 'editAck', batchId, edits: accepted }, r.id);
      }
      break;
    }
    case 'team': {
      const target = net.authPlayers.get(netValidId(msg.target) ? msg.target : r.id);
      if (!target || (msg.team !== 'red' && msg.team !== 'blue') ||
          (target !== r && r.id !== net.hostId) || target.team === msg.team) break;
      target.team = msg.team;
      netMqttReleaseRide(target, 'team');
      if (target.hp > 0) { target.hp = MAX_HEALTH; target.lastDamageAt = -Infinity; target.healthAt = performance.now(); }
      target.awaitingSpawn = true; // the switched player teleports to their new spawn
      netMqttAuthority({ t: 'teamSet', id: target.id, team: msg.team, by: r.id });
      netMqttRoster();
      break;
    }
    case 'ride': netMqttRide(r, msg); break;
    case 'breath': netMqttBreath(r, msg); break;
    case 'died':
      // Victim reports can confirm only an environmental/self death. Attribution
      // and score never come from arbitrary peer snapshots or died reports.
      netMqttAuthority(r.deathReported && r.deathEvent ? r.deathEvent : netMqttDeath(r, null, 'world', false));
      break;
    case 'respawn':
      if (!r.deathReported || performance.now() - r.deathAt < 2500 || !netValidPosition(msg)) {
        netMqttAuthority({ t: 'health', ...netMqttPublic(r) }, r.id); break;
      }
      r.hp = MAX_HEALTH;
      r.life++;
      r.lastDamageAt = -Infinity;
      r.healthAt = performance.now();
      r.deathReported = false;
      r.deathEvent = null;
      r.shot = null;
      r.shots.clear();
      netMqttPosition(r, msg, true);
      netMqttPose(r, msg);
      r.reload = -1;
      r.aim = r.firing = 0;
      netMqttAuthority({ t: 'respawn', ...netMqttPublic(r) });
      break;
    case 'dragons':
      // Only the agreed host supplies bounded offsets. Retain the canonical
      // family/count with match config and echo it through the authority lane.
      if (from === net.hostId && netReceiveDragonCatalog(msg, from)) {
        mqttAdvertiseConfig();
        netMqttAuthority({ t: 'dragons', seed: net.seed, dragonCount: netDragonCount(net.seed),
          dragons: netDragonCatalogSnapshot() });
      }
      break;
  }
  return true;
}

function mqttNewEpoch() {
  try {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return 'm' + values[0].toString(16).padStart(8, '0') + values[1].toString(16).padStart(8, '0');
  } catch (e) { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}

function mqttAdvertiseConfig() {
  if (!net.online || !net.authorityReady || net.hostId !== net.id || !netValidSeed(net.seed) || !netValidMode(net.matchMode)) return;
  roomSend({ t: 'match', ...netConfig(), at: netEpochNow() });
}

/* ---------------- room events from 91-room.js ---------------- */
function netRoomOnline() {
  net.online = true;
  net.attempts = 0;
  net.desync = false;
  net.onlineAt = net.lastRx = performance.now();
  net.lastSent = 0;
  mqttStartTimers();
  netStartPing();
  updateRoomBadge();
}

// This browser hosts: a new room, or a takeover that keeps world and scores.
function netHostStart() {
  const first = !net.online;
  const inherited = !first && netValidSeed(net.seed) && netValidMode(net.matchMode) && net.generation > 0 ? netConfig() : null;
  netRoomOnline();
  net.rides.clear();
  for (const r of net.authPlayers.values()) { r.dragon = -1; if (r.shots) r.shots.clear(); r.shot = null; }
  for (const edit of net.editHistory.values()) if (Number.isSafeInteger(edit.sid)) mqtt.editSerial = Math.max(mqtt.editSerial, edit.sid);
  for (const edit of net.pendingEdits.values()) if (netEditMatches(edit) && Number.isSafeInteger(edit.sid)) mqtt.editSerial = Math.max(mqtt.editSerial, edit.sid);
  for (const sid of net.editSeq.values()) if (Number.isSafeInteger(sid)) mqtt.editSerial = Math.max(mqtt.editSerial, sid);
  mqtt.scoreSerial = inherited && Number.isSafeInteger(inherited.scoreSeq) ? inherited.scoreSeq : Math.max(0, net.scoreSeq);
  const config = { mode: inherited ? inherited.mode : netCurrentMode(), seed: inherited ? inherited.seed : netCurrentSeed(),
    generation: inherited ? inherited.generation : 1, epoch: inherited ? inherited.epoch : mqttNewEpoch(),
    hostId: net.id, forceRideable: false, scores: inherited ? inherited.scores : { red: 0, blue: 0 },
    dragonCount: netDragonCount(inherited ? inherited.seed : netCurrentSeed()), dragons: inherited ? inherited.dragons : [],
    scoreSeq: mqtt.scoreSerial };
  if (!netValidSeed(config.seed)) { net.desync = true; netEmitStatus(); return; }
  netSetAuthority(net.id, true);
  netReceiveConfig(config, net.id);
  netSend({ ...netJoinPacket(), id: net.id });
  // The old host is gone; everyone else gets the usual time to reconnect here.
  mqttRemovePeer(roomNet.lastHostId, 'timeout');
  for (const id of net.authPlayers.keys()) if (id !== net.id) netHostHold(id);
  netMqttRoster();
  netEmitStatus();
  if (first) { toast('Online. Room ' + net.room + ' · share the code'); playTone(660, 0.09, 'sine', 0.08); }
  else { roomNotify('You are now hosting'); playTone(660, 0.09, 'sine', 0.08); }
}

function netPeerName(id) {
  const p = net.players.get(id);
  return p && p.name ? p.name : 'A player';
}

function netHostLinkUp(id) {
  if (mqtt.graceTimers.has(id)) netPeerLinkChange(id, true);
  clearTimeout(mqtt.graceTimers.get(id));
  mqtt.graceTimers.delete(id);
  mqtt.lastRosterAt = 0;
  roomSend({ t: 'match', ...netConfig(), at: netEpochNow(), to: id });
  netEmitStatus();
}

// Everyone hears when a player drops or comes back.
function netPeerLinkChange(id, up) {
  toast(netPeerName(id) + (up ? ' is back' : ' lost connection'));
  roomSend({ t: 'peerLink', id, up });
}

function netHostLinkDown(id) {
  netPeerLinkChange(id, false);
  netHostHold(id);
}

// A player's link dropped: keep them in the match briefly so they can return.
function netHostHold(id) {
  clearTimeout(mqtt.graceTimers.get(id));
  mqtt.graceTimers.set(id, setTimeout(() => {
    mqtt.graceTimers.delete(id);
    if (!roomNet.links.has(id)) mqttRemovePeer(id, 'timeout');
  }, 30000));
}

function netPlayerLinkUp(hostId) {
  const first = !net.online;
  netRoomOnline();
  netEmitStatus();
  roomNotify(first ? 'Joined room ' + net.room : 'Reconnected');
  net.warned = true;
  playTone(660, 0.09, 'sine', 0.08);
}

function netPlayerLinkDown() {
  net.authorityReady = false;
  netDropQueue();
  netEmitStatus();
  playTone(220, 0.12, 'square', 0.05);
}

// Everything that arrives on a data channel. `from` is the peer this link was
// negotiated with, never a field inside the message.
function roomInbound(from, text) {
  let msg;
  try { msg = JSON.parse(text); } catch (e) { return; }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;
  if (msg.t === 'ping' || msg.t === 'pong') { handleNet(msg, from); return; }
  if (roomNet.role === 'host') {
    const link = roomNet.links.get(from);
    if (msg.t === 'state' && link) link.lastState = msg;
    if (msg.t === 's') {
      if (!link || !link.lastState || !Array.isArray(msg.p) || msg.p.length !== 6 || msg.g !== link.lastState.generation) return;
      msg = { ...roomApplyRow(link.lastState, msg.p), seq: msg.q };
    }
    if (!netMqttBudget(from, text.length, false, false) || !netInboundOK(msg)) return;
    msg.id = from;
    if (msg.t === 'join' && msg.player && typeof msg.player === 'object') msg.player.id = from;
    if (msg.t === 'hit') msg.byId = from;
    if (msg.t === 'voxelHit') msg.by = from;
    if (msg.t === 'leave') { roomLinkLost(roomNet.links.get(from)); mqttRemovePeer(from, 'left'); return; }
    netMqttProcess(msg, from, true);
    return;
  }
  if (from !== roomNet.hostId) return;
  if (msg.t === 'hostLeft') {
    // Skip the wait: the host said goodbye, so go straight to picking a new one.
    roomNet.hostLeft = true;
    roomNet.beaconAt = -Infinity;
    roomLinkLost(roomNet.links.get(from));
    return;
  }
  if (msg.t === 'p') {
    if (!net.authorityReady || msg.g !== net.generation || !Array.isArray(msg.r)) return;
    const players = [];
    for (const row of msg.r) {
      if (!Array.isArray(row) || row.length !== 8) continue;
      const id = [...net.authPlayers.keys()].find((key) => key.endsWith(row[0])), base = id && net.authPlayers.get(id);
      if (base) players.push({ ...roomApplyRow(base, row.slice(2)), t: 'state', id, sid: row[1] });
    }
    if (players.length) handleNet({ t: 'states', players }, from);
    return;
  }
  if (msg.t === 'peerLink') {
    if (netValidId(msg.id) && msg.id !== net.id) toast(netPeerName(msg.id) + (msg.up === true ? ' is back' : ' lost connection'));
    return;
  }
  if (msg.t === 'match') {
    if (!netValidMode(msg.mode) || !netValidSeed(msg.seed) || !Number.isSafeInteger(msg.generation) || !netToken(msg.epoch)) return;
    if (net.epoch && net.epoch !== msg.epoch) mqttResetRealm();
    const wasReady = net.authorityReady;
    net.hostId = from;
    netSetAuthority(from, true);
    handleNet(msg, from);
    if (!wasReady) { mqtt.lastJoinAt = performance.now(); netSend({ ...netJoinPacket(), id: net.id }); }
    netEmitStatus();
  } else if (msg.t === 'authority') {
    const packet = msg.packet;
    if (!net.authorityReady || msg.epoch !== net.epoch || msg.generation !== net.generation || !netInboundOK(packet)) return;
    if (!['join', 'state', 'states', 'roster', 'health', 'correction', 'shot', 'hit', 'voxelHit', 'edit', 'edits', 'editAck', 'editReject',
      'died', 'respawn', 'ride', 'rideGrant', 'rideDenied', 'breath', 'dragons', 'leave', 'teamSet'].includes(packet.t) ||
      packet.generation !== net.generation || packet.epoch !== net.epoch) return;
    handleNet(packet, from);
  }
}

function netBroadcastConfig(config) {
  if (!config || !net.online || !net.authorityReady || net.id !== net.hostId ||
      !netValidMode(config.mode || net.matchMode) || !netValidSeed(config.seed === undefined ? net.seed : config.seed)) return false;
  const mode = config.mode || net.matchMode, seed = config.seed === undefined ? net.seed : config.seed;
  const reset = config.reset === true || net.localWorldReset;
  if (net.mode === 'ws') return netSend({ t: 'match', mode, seed, reset,
    dragonCount: netDragonCount(seed), dragons: netDragonCatalog() });
  if (net.mode !== 'mqtt') return false;
  const changed = mode !== net.matchMode || seed !== net.seed || reset;
  const next = { mode, seed, hostId: net.id, epoch: net.epoch,
    generation: net.generation + (changed ? 1 : 0), forceRideable: false,
    dragonCount: netDragonCount(seed), dragons: changed ? [] : netDragonCatalogSnapshot() };
  if (!netReceiveConfig(next, net.id)) return false;
  mqttAdvertiseConfig();
  netMqttRoster();
  return true;
}

function mqttRemovePeer(id, reason) {
  if (!netValidId(id) || id === net.id) return;
  const record = net.authPlayers.get(id);
  if (!record && !net.players.has(id)) return;
  if (net.hostId === net.id && record) netMqttReleaseRide(record, reason || 'left');
  mqtt.historyJobs.delete(id);
  mqtt.pendingStates.delete(id);
  if (net.hostId === net.id) netMqttAuthority({ t: 'leave', id });
  else { net.authPlayers.delete(id); removeRemote(id); }
  netEmitStatus();
}

function mqttDrainHistory() {
  if (net.hostId !== net.id || netTransportBuffered() || net.outbox.length > 8) return;
  let count = 0;
  for (const [id, job] of mqtt.historyJobs) {
    if (job.generation !== net.generation || job.epoch !== net.epoch || !roomNet.links.has(id)) { mqtt.historyJobs.delete(id); continue; }
    if (job.cursor >= job.edits.length) { mqtt.historyJobs.delete(id); continue; }
    if (count++ >= 4 || netTransportBuffered()) break;
    const edits = job.edits.slice(job.cursor, job.cursor + 64);
    if (!netMqttAuthority({ t: 'edits', edits }, id)) break;
    job.cursor += edits.length;
    if (job.cursor >= job.edits.length) mqtt.historyJobs.delete(id);
  }
}

function mqttClearTimers() {
  if (mqtt.tick) { clearInterval(mqtt.tick); mqtt.tick = null; }
  if (mqtt.stateTimer) { clearTimeout(mqtt.stateTimer); mqtt.stateTimer = null; }
  for (const timer of mqtt.graceTimers.values()) clearTimeout(timer);
  mqtt.graceTimers.clear();
  mqtt.pendingStates.clear();
  mqtt.historyJobs.clear();
}

function mqttResetRealm() {
  net.configVersion++;
  net.seed = net.matchMode = null;
  net.generation = 0;
  net.epoch = '';
  net.configPending = net.configError = false;
  net.localLife = 0;
  net.scoreSeq = -1;
  net.matchScores.red = net.matchScores.blue = 0;
  net.healthSid = -1;
  net.authPlayers.clear();
  net.rides.clear();
  net.dragonCatalog.clear();
  net.rxSeq.clear();
  net.pendingEdits.clear();
  netClearEdits(true);
  netDropQueue();
  mqtt.editSerial = 0;
  mqtt.pendingStates.clear();
  mqtt.historyJobs.clear();
}

function mqttStartTimers() {
  if (mqtt.tick) clearInterval(mqtt.tick);
  mqtt.tick = setInterval(() => {
    if (!net.online) return;
    const now = performance.now();
    if (net.hostId === net.id) net.lastRx = now; // a host is never out of date, even alone
    for (const [key, bucket] of mqtt.limiters) if (now - bucket.at > NET_PEER_TIMEOUT * 2) mqtt.limiters.delete(key);
    if (net.hostId === net.id && net.authorityReady) {
      for (const lease of net.rides.values()) {
        if (lease.until <= now) {
          const rider = net.authPlayers.get(lease.id);
          if (rider) netMqttReleaseRide(rider, 'time');
          else net.rides.delete(lease.dragon);
        }
      }
      netMqttFlushStates();
      if (now - mqtt.lastRosterAt >= 2000 && !netTransportBuffered()) {
        mqtt.lastRosterAt = now;
        netMqttRoster();
        for (const lease of net.rides.values()) netMqttAuthority({ ...netMqttLeasePacket(lease, true, 'heartbeat'), t: 'ride' });
      }
      mqttDrainHistory();
    } else if (net.authorityReady && !net.authPlayers.has(net.id) && now - mqtt.lastJoinAt >= 3000) {
      mqtt.lastJoinAt = now;
      netSend({ ...netJoinPacket(), id: net.id });
    }
    updateRoomBadge();
  }, 250);
}

function startOnline(roomArg, create) {
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

  netDisconnect(null, false);

  const input = document.getElementById('roomInput');
  if (input) input.value = room;
  try { localStorage.setItem('blockcraft.room', room); } catch (e) { /* ignore */ }

  net.mode = 'mqtt';
  net.room = room;
  net.online = false;
  net.closedByUs = false;
  net.attempts = 0;
  net.warned = false;
  net.desync = false;
  mqtt.room = room;
  try { sessionStorage.setItem('blockcraft.activeRoom', room); } catch (e) { /* ignore */ }
  mqtt.clientId = 'bc_' + Date.now().toString(36).padStart(10, '0') + Math.random().toString(36).slice(2, 8);
  net.id = mqtt.clientId;
  net.seq = net.stateSeq = 0;
  mqtt.wireSeq = 0;
  mqtt.editSerial = 0;
  mqtt.lastRosterAt = 0;

  updateRoomBadge();
  netEmitStatus();
  const hint = document.getElementById('roomHint');
  if (hint) hint.textContent = 'Connecting to room ' + room + '…';
  toast('Joining room ' + room + '…');
  // Transport only: Home/Pause stays open until an explicit Play/Resume.
  roomStart(room, create === true);
}

function createRoom() {
  const room = randomRoom();
  const input = document.getElementById('roomInput');
  if (input) input.value = room;
  startOnline(room, true);
  copyRoom();
}

function roomSayGoodbye() {
  if (net.mode !== 'mqtt' || !net.online) return;
  if (net.hostId === net.id) roomSend({ t: 'hostLeft' });
  else netSend({ t: 'leave', id: net.id });
}

function leaveOnline(returnToLan = true) {
  try { sessionStorage.removeItem('blockcraft.activeRoom'); } catch (e) { /* ignore */ }
  roomSayGoodbye();
  netDisconnect(null, returnToLan === false);
  if (returnToLan) connectNet();
  else {
    if (roomInputEl) roomInputEl.value = '';
    try { localStorage.removeItem('blockcraft.room'); } catch (e) { /* optional storage */ }
    try {
      const url = new URL(location.href); url.searchParams.delete('room');
      history.replaceState(history.state, '', url.href);
    } catch (e) { /* file:// may restrict history */ }
    const hint = document.getElementById('roomHint');
    if (hint) hint.textContent = 'Disconnected. Play solo, create a room, or join another code.';
  }
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
  if (!netConnectedTransport()) return;
  if (now - net.lastSent < NET_SEND_MS) return;
  net.lastSent = now;
  const msg = combatNetState();
  netSend(msg);
}

function updateNetPlayers(dt) {
  flushNetEdits();
  dt = Math.max(0, Number.isFinite(dt) ? dt : 0);
  const now = performance.now();
  const jet = netAPI('jetpack');
  for (const r of net.players.values()) {
    const dead = r.hp <= 0 || r.deadUntil > now;
    if (r.deadUntil && r.deadUntil <= now) r.deadUntil = 0;
    r.group.visible = !dead;

    // Bound interpolation: snap when a peer goes quiet, otherwise extrapolate
    // only for a short window so a missed packet does not rubber-band an avatar.
    const age = Math.max(0, now - (r.lastRx || 0));
    let tx = r.tx, ty = r.ty, tz = r.tz;
    if (dead || age > 2500) {
      if (!dead && age > 2500) { tx = r.x; ty = r.y; tz = r.z; }
      r.vx = r.vy = r.vz = 0;
    } else {
      // Between the two received positions around (now - NET_INTERP_MS); past
      // the newest one, carry on briefly along the last known velocity.
      const trail = r.trail || [], at = now - NET_INTERP_MS;
      let i = trail.length - 1;
      while (i > 0 && trail[i - 1].at > at) i--;
      const a = trail[i - 1], b = trail[i];
      if (a && b && b.at > at) {
        const f = Math.max(0, Math.min(1, (at - a.at) / Math.max(1, b.at - a.at)));
        tx = a.x + (b.x - a.x) * f;
        ty = a.y + (b.y - a.y) * f;
        tz = a.z + (b.z - a.z) * f;
      } else if (age > NET_INTERP_MS && age <= NET_INTERP_MS + 250) {
        const ahead = (age - NET_INTERP_MS) / 1000;
        tx = Math.max(0, Math.min(WORLD, r.tx + r.vx * ahead));
        ty = Math.max(-8, Math.min(HEIGHT + 48, r.ty + r.vy * ahead));
        tz = Math.max(0, Math.min(WORLD, r.tz + r.vz * ahead));
      }
    }

    const k = combatDamp(28, dt);
    const dx = tx - r.x, dz = tz - r.z;
    const dist = Math.hypot(dx, dz);
    r.x += dx * k;
    r.z += dz * k;
    r.y += (ty - r.y) * combatDamp(28, dt);
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

    let riding = false;
    for (const lease of net.rides.values()) if (lease.id === r.id && lease.until > now) { riding = true; break; }
    if (r.jetpackRig && jet && typeof jet.updateRemoteRig === 'function') {
      jet.updateRemoteRig(r.jetpackRig, r, dt, dead || riding);
    }
    const parts = r.group.userData.parts;
    if (riding) {
      if (typeof poseHumanoidStance === 'function') poseHumanoidStance(r.group, null, 0);
      // 46-riding.js is the sole seated/root/upper-body controller. Clear only
      // lower-joint residues; do not install a competing walking or gun pose.
    } else if (parts) {
      const moving = r.speed > 0.6;
      const low = r.crouch || r.slide || r.dash ? 1 : 0;
      r.stance += (low - r.stance) * combatDamp(15, dt);
      r.slidePose += (r.slide - r.slidePose) * combatDamp(15, dt);
      r.dashPose += (r.dash - r.dashPose) * combatDamp(18, dt);
      r.airPose += ((!r.onGround && !r.fly && !dead ? 1 : 0) - r.airPose) * combatDamp(12, dt);
      const rawSwing = Math.sin(r.phase) * (moving ? 0.75 : 0);
      const swing = rawSwing * (1 - r.slidePose);
      const hk = combatDamp(12, dt);
      const pose = r.stanceInput;
      // The shared helper eases these raw targets itself (rate 15).
      pose.stance = low; pose.slide = r.slide; pose.dash = r.dash;
      pose.swing = rawSwing; pose.air = !r.onGround && !r.fly && !dead ? 1 : 0;
      const sharedPose = typeof poseHumanoidStance === 'function' && poseHumanoidStance(r.group, pose, dt) === true;
      if (!sharedPose) {
        parts.legL.rotation.x += (swing + r.stance * 0.16 - r.slidePose * 0.72 - parts.legL.rotation.x) * hk;
        parts.legR.rotation.x += (-swing + r.stance * 0.16 + r.slidePose * 0.42 - parts.legR.rotation.x) * hk;
        // Legacy, unsplit-leg fallback ONLY. Never overwrite articulated hips,
        // knees/ankles or offsets after the shared helper has posed them.
        const drop = Math.min(0.55, r.stance * 0.48 + r.slidePose * 0.04 + r.dashPose * 0.025);
        parts.legL.position.y = parts.legR.position.y = 0.72 - drop * 0.65;
        parts.legL.position.z = parts.legR.position.z = r.stance * 0.12;
        parts.head.position.y = 1.34 - drop;
        parts.head.position.z = -r.stance * 0.07 - r.dashPose * 0.06;
        parts.armL.position.y = parts.armR.position.y = 1.3 - drop;
        if (parts.torso) {
          parts.torso.position.y = 0.72 - drop * 0.82;
          parts.torso.rotation.x += (-r.stance * 0.25 + r.slidePose * 0.5 - r.dashPose * 0.32 - parts.torso.rotation.x) * hk;
        }
      }
      parts.armL.rotation.x += (-swing * 0.8 - parts.armL.rotation.x) * hk;
      parts.armR.rotation.x += (swing * 0.8 - parts.armR.rotation.x) * hk;
      const pitchTarget = Math.max(-0.75, Math.min(0.75, r.pitch * 0.6));
      parts.head.rotation.x += (pitchTarget - parts.head.rotation.x) * combatDamp(14, dt);
    }
    if (!riding) updateAvatarWeaponPose(r.group, netRemotePoseState(r, now), dt);
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
const roomJoinFormEl = document.getElementById('roomJoinForm');
try {
  const urlRoom = normalizeRoom(new URLSearchParams(location.search).get('room') || '');
  const savedRoom = normalizeRoom(localStorage.getItem('blockcraft.room') || '');
  if (roomInputEl) roomInputEl.value = urlRoom || savedRoom;
} catch (e) { /* ignore */ }
if (roomInputEl && !roomJoinFormEl) {
  roomInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); startOnline(); }
  });
}
if (roomJoinFormEl) roomJoinFormEl.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!onlineBtnEl || onlineBtnEl.disabled) return;
  startOnline();
});
else if (onlineBtnEl) onlineBtnEl.addEventListener('click', () => startOnline());
if (createBtnEl) createBtnEl.addEventListener('click', createRoom);
const roomBadgeEl = document.getElementById('roomBadge');
if (roomBadgeEl) roomBadgeEl.addEventListener('click', copyRoom);
let netResumeRoom = '';
window.addEventListener('pagehide', (e) => {
  netResumeRoom = e.persisted && net.mode === 'mqtt' ? net.room : '';
  roomSayGoodbye();
  netDisconnect(null, true);
});
// Restored from the back/forward cache: go straight back to the room.
window.addEventListener('pageshow', (e) => {
  if (e.persisted && netResumeRoom) startOnline(netResumeRoom);
  netResumeRoom = '';
});

window.__netEdit = (x, y, z, b) => netSend({ t: 'edit', x, y, z, b });
window.__netIdentity = () => {
  if (!net.online || !net.id) return;
  netSend({ ...netJoinPacket(), id: net.id });
};
if (window.__netRoom === undefined) window.__netRoom = startOnline;

if (typeof BC !== 'undefined' && typeof BC.on === 'function') {
  BC.on('killfeed', (killer, victim, info) => {
    if (!info || info.authoritative !== true || !netToken(info.killId)) return;
    net.seenKills.add(info.killId);
    while (net.seenKills.size > 512) net.seenKills.delete(net.seenKills.values().next().value);
  }, -100);
  BC.on('worldWillReset', () => {
    if (!net.mode) return;
    const receiving = net.applyingConfig || !!net.configTask || net.configPending;
    net.localReset = true;
    if (!receiving && net.hostId === net.id) net.localWorldReset = true;
    if (!receiving) net.pendingEdits.clear();
    if (!receiving) {
      net.rides.clear();
      net.dragonCatalog.clear();
      for (const r of net.players.values()) r.dragon = -1;
      for (const r of net.authPlayers.values()) r.dragon = -1;
    }
    netClearEdits(!receiving);
    if (receiving) for (const edit of net.editHistory.values()) if (netEditMatches(edit)) applyNetEdit(edit);
    for (const [key, edit] of net.editOut) if (!receiving || !netEditMatches(edit)) net.editOut.delete(key);
    for (const [key, batch] of net.editInFlight) if (!receiving || !netEditMatches(batch.packet)) net.editInFlight.delete(key);
    net.outbox = net.outbox.filter((m) => ['ping', 'pong', 'join', 'match', 'seed', 'dragons', 'leave'].includes(m.t) ||
      (receiving && m.generation === net.generation && (!m.epoch || m.epoch === net.epoch)));
    mqtt.pendingStates.clear();
    for (const [key, job] of mqtt.historyJobs) if (!receiving || job.generation !== net.generation || job.epoch !== net.epoch) mqtt.historyJobs.delete(key);
    net.shotId = '';
  }, -100);
  BC.on('worldReset', () => {
    if (!net.mode) { net.localReset = false; return; }
    if (net.configPending) return; // the receiveConfig Promise owns readiness
    if (net.localWorldReset && net.hostId === net.id) return; // await host config event
    net.localReset = false;
    netApplyDragonCatalog();
    netDrainEdits();
  });
  BC.on('matchConfigChanged', (config) => {
    if (!config || !netValidMode(config.mode) || !netValidSeed(config.seed)) return;
    if (net.applyingConfig || net.configTask || !net.online || net.id !== net.hostId || !net.authorityReady) return;
    netBroadcastConfig({ ...config, reset: true }); // same-seed round resets also advance the room generation
  });
}
