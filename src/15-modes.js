/* Blockcraft Battle Ground — Game modes, team scoring, seeded arenas and world re-rolls.
   15-modes.js
   Classic script. Loads AFTER 20-world.js (terrain helpers) and BEFORE 30-meshing.js.
   Owns BC.api.modes and BC.api.world. No DOM, audio or input work happens here.

   Network handoff (90-net.js / 92-sync.js own transport and validation):
   - Publish net.hostId (or BC.api.net.hostId) and net.id before receiving config.
     WS uses the server-assigned host; MQTT uses the agreed, topic-bound host.
     Missing authority locks configuration; this module never self-elects.
   - After validating welcome/match/seed, call modes.receiveConfig({mode, seed,
     generation?, epoch?},
     hostId). Its Promise settles after the world is ready; then replay ONLY the
     matching world's edits. Do not also call the legacy ensureSeed path.
   - Send local matchConfigChanged({mode, seed}) to every peer/late joiner. A
     received config updates persistence/HUD/loadouts but never echoes this event.
   - Route accepted deaths through addKillFeed once. Its confirmed killfeed hook
     carries {killerId, victimId, confirmed:true, killId, mode, seed}; an explicit
     authoritative:true is also accepted. personalKill is real self credit, not
     prediction. Actual predicted/localKill/optimistic feedback never scores.
     Tokens must identify one death across all peers.
   - worldWillReset({mode, seed}) precedes clearing voxels. Cancel old edit flushes,
     discard stale world packets/retained edits, and gate gameplay on worldBusy. */
'use strict';

/* ---------------- mode table ---------------- */
/* Optional per-mode rules (all read by the room authority as well):
   gravity  : player gravity multiplier (client physics)
   damage   : authority damage multiplier
   regen    : false disables health regeneration
   ladder   : Gun Game: each kill advances you to the next weapon */
// Strong guns first and the hardest last, so a leader has to earn the win.
const MODES_GUN_LADDER = Object.freeze(['rifle', 'smg', 'shotgun', 'burst', 'lmg', 'machinepistol', 'doublebarrel', 'dmr', 'revolver', 'sniper', 'crossbow', 'pistol']);
const MODES = Object.freeze([
  Object.freeze({
    id: 'tdm', name: 'Team Deathmatch', short: 'TDM',
    desc: 'Red vs Blue with the full arsenal on the full map. First team to 40 kills.',
    teams: true, weapons: null, arenaRadius: null, locked: false,
    scoreToWin: 40, respawnMs: 3200
  }),
  Object.freeze({
    id: 'ffa', name: 'Free For All', short: 'FFA',
    desc: 'Every player for themselves with the full arsenal. First to 20 kills.',
    teams: false, weapons: null, arenaRadius: null, locked: false,
    scoreToWin: 20, respawnMs: 3200
  }),
  Object.freeze({
    id: 'gungame', name: 'Gun Game', short: 'GUN GAME',
    desc: 'Every kill swaps you to the next gun, ending on the pistol. First through all twelve wins.',
    teams: false, weapons: null, ladder: MODES_GUN_LADDER, arenaRadius: 60, locked: true,
    scoreToWin: MODES_GUN_LADDER.length, respawnMs: 2600
  }),
  Object.freeze({
    id: 'moon', name: 'Low Gravity', short: 'LOW-G',
    desc: 'Red vs Blue at 45% gravity. Huge jumps, long slides, aerial gunfights. First to 30.',
    teams: true, weapons: null, gravity: 0.45, arenaRadius: 72, locked: true,
    scoreToWin: 30, respawnMs: 3200
  }),
  Object.freeze({
    id: 'hardcore', name: 'Hardcore', short: 'HARDCORE',
    desc: 'Red vs Blue. Weapons hit 50% harder and nobody regenerates health. First to 30.',
    teams: true, weapons: null, damage: 1.5, regen: false, arenaRadius: null, locked: false,
    scoreToWin: 30, respawnMs: 4200
  }),
  Object.freeze({
    id: 'snipers', name: 'Snipers Only', short: 'SNIPERS',
    desc: 'Sniper rifles only inside a long arena. First to 15 kills.',
    teams: false, weapons: Object.freeze(['sniper', 'dmr', 'crossbow']), arenaRadius: 64, locked: true,
    scoreToWin: 15, respawnMs: 3200
  }),
  Object.freeze({
    id: 'shotguns', name: 'Shotguns Only', short: 'SHOTGUNS',
    desc: 'Shotguns only inside a tight arena. First to 15 kills.',
    teams: false, weapons: Object.freeze(['shotgun', 'doublebarrel']), arenaRadius: 42, locked: true,
    scoreToWin: 15, respawnMs: 2600
  }),
  Object.freeze({
    id: 'sidearms', name: 'Sidearms', short: 'SIDEARMS',
    desc: 'Pistols and revolvers only in a compact arena. Aim for the head. First to 15.',
    teams: false, weapons: Object.freeze(['pistol', 'revolver', 'machinepistol']), arenaRadius: 44, locked: true,
    scoreToWin: 15, respawnMs: 2600
  }),
  Object.freeze({
    id: 'lockdown', name: 'Lockdown', short: 'LOCKDOWN',
    desc: 'Red vs Blue in a tight arena with rifles, SMGs, shotguns and revolvers. First to 25.',
    teams: true, weapons: Object.freeze(['rifle', 'smg', 'shotgun', 'revolver', 'burst']),
    arenaRadius: 36, locked: true, scoreToWin: 25, respawnMs: 3200
  })
]);

const MODES_BY_ID = Object.create(null);
for (let MODES_i = 0; MODES_i < MODES.length; MODES_i++) MODES_BY_ID[MODES[MODES_i].id] = MODES[MODES_i];

/* ---------------- live state ---------------- */
let MODES_activeDef = MODES_BY_ID[MODES_initialId()] || MODES[0];
let MODES_activeId = MODES_activeDef.id;
let MODES_localTeam = null;
let MODES_teamMap = new Map();
const MODES_nameTeams = new Map();
let MODES_teamSelf = '';
let MODES_teamCount = -1;
let MODES_teamDirty = true;
let MODES_rosterQueued = false;
let MODES_roomKey = 'offline';
const MODES_seenKills = new Set();
const MODES_recentKills = new Map();
const MODES_ffaKills = new Map();
const MODES_ffaNames = new Map();
let MODES_winner = null;
let MODES_winnerId = null;
let MODES_round = 0;
let MODES_matchStarted = 0;
let MODES_pending = false;
const MODES_scores = { red: 0, blue: 0 };
let MODES_settingsWriting = 0;
SEED = MODES_initialSeed();
let MODES_targetMode = MODES_activeId;
let MODES_targetSeed = SEED >>> 0;
let MODES_configSerial = 0;
let MODES_targetSerial = 0;
let MODES_lastConfigPromise = Promise.resolve();
let MODES_wireConfig = null;
let MODES_wireApplied = null;
let MODES_localWorldCommit = null;
let MODES_receivedRoom = '';
let MODES_loadoutKey = null;
let MODES_loadoutFx = null;
let MODES_loadoutFxKey = null;
const MODES_readyWaiters = [];

/* Arena state is one stable object: physics may cache the reference. */
const MODES_arena = {
  active: false,
  cx: Math.floor(WORLD / 2),
  cz: Math.floor(WORLD / 2),
  radius: 0,
  contains: function (x, z) {
    const dx = Number(x) - MODES_arena.cx, dz = Number(z) - MODES_arena.cz;
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return false;
    if (!MODES_arena.active) return true;
    // Thick voxel walls have inward diagonal corners; leave standing/boosted
    // bodies clear of those corners, not merely clear of the ideal circle.
    const limit = Math.max(0, MODES_arena.radius - 2.6);
    return dx * dx + dz * dz <= limit * limit;
  },
  clamp: function (pos, extra) {
    if (!MODES_arena.active || !pos) return false;
    const dx = Number(pos.x), dz = Number(pos.z);
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return false;
    const margin = Number(extra);
    const limit = Math.max(0, MODES_arena.radius - 2.6 -
      (Number.isFinite(margin) ? Math.max(0, margin) : 0));
    const ox = dx - MODES_arena.cx, oz = dz - MODES_arena.cz;
    const dist = Math.hypot(ox, oz);
    if (dist <= limit) return false;
    if (dist < 0.0001) { pos.x = MODES_arena.cx + limit; pos.z = MODES_arena.cz; return true; }
    pos.x = MODES_arena.cx + (ox / dist) * limit;
    pos.z = MODES_arena.cz + (oz / dist) * limit;
    return true;
  }
};

/* ---------------- arena build bookkeeping ---------------- */
let MODES_centreCache = null;
const MODES_ledger = [];
const MODES_LEDGER_LIMIT = 40000;
const MODES_SPAWN_NEAR = 22;      // closer than this to an enemy is never chosen unless forced
const MODES_SPAWN_IDEAL = 50;     // a short run from the fight
const MODES_SPAWN_TRIES = 12;
let MODES_ledgerSeed = -1;
let MODES_generationSeen = -1;
let MODES_builtKey = '';
let MODES_arenaSeed = -1;
let MODES_pads = { red: null, blue: null };
const MODES_gates = [];
let MODES_visualGroup = null;
let MODES_beaconGeo = null;
let MODES_redBeaconMat = null, MODES_blueBeaconMat = null;
let MODES_ringRedMat = null, MODES_ringBlueMat = null;
let MODES_spawnSerial = 0;

/* ---------------- helpers ---------------- */
function MODES_initialId() {
  let value = null;
  try {
    if (BC.settings) {
      if (typeof BC.settings.get === 'function') value = BC.settings.get('mode');
      if (value == null) value = BC.settings.mode;
    }
  } catch (e) { value = null; }
  if (value == null) {
    try { value = localStorage.getItem('blockcraft.mode'); } catch (e) { value = null; }
  }
  return (typeof value === 'string' && MODES_BY_ID[value]) ? value : 'tdm';
}

function MODES_normalizeSeed(value) {
  const fallback = 20261104;
  if (typeof value === 'number') {
    if (!isFinite(value)) return fallback;
    return Math.trunc(value) >>> 0;
  }
  const text = value == null ? '' : String(value).trim();
  if (!text) return fallback;
  if (/^-?\d+$/.test(text)) {
    const n = Number(text);
    if (isFinite(n)) return Math.trunc(n) >>> 0;
  }
  let h = 0;
  try { h = (BC && typeof BC.hashSeed === 'function') ? BC.hashSeed(text) : 0; } catch (e) { h = 0; }
  if (!h) {
    h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

function MODES_initialSeed() {
  // Mirror core's precedence, but preserve explicit zero in queries and storage.
  let value = null;
  try {
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const params = new URLSearchParams(location.search);
      if (params.has('seed')) return MODES_normalizeSeed(params.get('seed'));
    }
  } catch (e) { /* location is optional in reduced builds */ }
  try { value = localStorage.getItem('blockcraft.seed'); } catch (e) { /* file:// */ }
  if (value != null && String(value).trim() !== '') return MODES_normalizeSeed(value);
  try {
    if (BC.settings) {
      value = typeof BC.settings.get === 'function' ? BC.settings.get('seed') : BC.settings.seed;
    }
  } catch (e) { value = null; }
  return MODES_normalizeSeed(value == null ? SEED : value);
}

function MODES_newSeed() {
  try {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] >>> 0;
    }
  } catch (e) { /* fall back when crypto is unavailable */ }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

function MODES_localId() {
  try {
    if (typeof net !== 'undefined' && net && (net.online || net.mode) &&
        net.id != null && net.id !== '') return 'n:' + String(net.id);
  } catch (e) { /* 90-net.js not loaded yet */ }
  let name = 'Wanderer';
  try { if (typeof playerName === 'string' && playerName) name = playerName; } catch (e) { /* 50-player.js not loaded yet */ }
  return 'l:' + name;
}

function MODES_rosterIds() {
  const ids = [MODES_localId()];
  try {
    // Offline, net.players holds the bots.
    if (typeof net !== 'undefined' && net &&
        net.players && typeof net.players.forEach === 'function') {
      net.players.forEach(function (_record, id) {
        if (id == null || id === '') return;
        const key = 'n:' + String(id);
        if (ids.indexOf(key) < 0) ids.push(key);
      });
    }
  } catch (e) { /* late file */ }
  return ids;
}

function MODES_rosterSize() {
  try {
    if (typeof net !== 'undefined' && net && net.players) return net.players.size;
  } catch (e) { /* late script */ }
  return 0;
}

function MODES_isLocal(id, name) {
  if (id != null && id !== '') {
    const key = String(id), self = MODES_localId();
    // An explicit remote id wins over a coincidentally identical display name.
    return key === self || key === self.slice(2);
  }
  try {
    if (name != null && typeof playerName === 'string' && String(name) === playerName) return true;
  } catch (e) { /* ignore */ }
  return false;
}

function MODES_clampScores() {
  const red = Number(MODES_scores.red), blue = Number(MODES_scores.blue);
  MODES_scores.red = isFinite(red) ? Math.max(0, Math.min(9999, Math.floor(red))) : 0;
  MODES_scores.blue = isFinite(blue) ? Math.max(0, Math.min(9999, Math.floor(blue))) : 0;
}

/* ---------------- room authority ---------------- */
function MODES_sessionInfo() {
  let n = null, api = null, snapshot = null;
  try { if (typeof net !== 'undefined' && net) n = net; } catch (e) { /* late script */ }
  try { if (BC.api && BC.api.net) api = BC.api.net; } catch (e) { /* optional bridge */ }
  if (!n && api && typeof api.syncState === 'function') {
    try { snapshot = api.syncState(); } catch (e) { /* disconnected */ }
  }
  const state = n || snapshot || api || {};
  const mode = state.mode || null;
  const online = !!state.online;
  const inRoom = online || mode === 'ws' || mode === 'mqtt';
  const idValue = state.id != null ? state.id : state.localId;
  const id = idValue == null ? '' : String(idValue);
  let host = state.hostId != null ? state.hostId : state.host;
  if (host == null && api) host = api.hostId != null ? api.hostId : api.host;
  const hostId = (typeof host === 'string' || typeof host === 'number') ? String(host) : '';
  const room = state.room == null ? '' : String(state.room);
  const epoch = typeof state.epoch === 'string' ? state.epoch : '';
  const generation = Number.isSafeInteger(state.generation) ? state.generation : 0;
  return {
    inRoom: inRoom, online: online, id: id, hostId: hostId,
    pending: !!state.configPending, generation: generation, epoch: epoch,
    key: inRoom ? String(mode || 'room') + '|' + room + '|' + id + '|' +
      String(state.session == null ? '' : state.session) + '|' + epoch : 'offline'
  };
}

function MODES_canConfigure() {
  const session = MODES_sessionInfo();
  return !session.inRoom || !!(session.online && !session.pending && session.id &&
    session.hostId && session.id === session.hostId);
}

function MODES_config() {
  return { mode: MODES_activeId, seed: SEED >>> 0 };
}

function MODES_configError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function MODES_authority(by, received) {
  const session = MODES_sessionInfo();
  const sender = by == null ? '' : String(by);
  if (session.inRoom) {
    if (received) {
      if (!session.hostId || sender !== session.hostId) {
        throw MODES_configError('Match configuration did not come from the room host.', 'BC_NOT_HOST');
      }
    } else if (!MODES_canConfigure()) {
      throw MODES_configError('Only the room host can change the mode or map seed.', 'BC_NOT_HOST');
    }
  } else if (received && sender) {
    throw MODES_configError('The room was left before its configuration arrived.', 'BC_STALE_CONFIG');
  }
  return { session: session.key, received: !!received, by: sender };
}

function MODES_checkAuthority(authority) {
  const session = MODES_sessionInfo();
  if (session.key !== authority.session) {
    throw MODES_configError('The room changed while configuration was queued.', 'BC_STALE_CONFIG');
  }
  if (authority.received) MODES_authority(authority.by, true);
  else if (session.inRoom && (!session.online || !session.id || session.id !== session.hostId)) {
    throw MODES_configError('Room authority changed while configuration was queued.', 'BC_NOT_HOST');
  }
  // configPending locks NEW controls, not an already-authorized local job
  // queued behind the host's earlier acknowledged generation.
}

function MODES_denyConfig(error) {
  MODES_restoreSettings();
  try { BC.emit('matchConfigDenied', error); } catch (e) { /* optional HUD feedback */ }
}

function MODES_emitConfig(fullWorld) {
  const session = MODES_sessionInfo();
  MODES_localWorldCommit = fullWorld && session.inRoom
    ? { session: session.key, mode: MODES_activeId, seed: SEED >>> 0 } : null;
  try { BC.emit('matchConfigChanged', MODES_config()); } catch (e) { /* transport owns delivery */ }
}

/* ---------------- teams ---------------- */
function MODES_addTeamName(name, team) {
  if (name == null || name === '') return;
  const key = String(name);
  if (MODES_nameTeams.has(key) && MODES_nameTeams.get(key) !== team) MODES_nameTeams.set(key, null);
  else if (!MODES_nameTeams.has(key)) MODES_nameTeams.set(key, team);
}

function MODES_assignTeams() {
  const def = MODES_activeDef || MODES[0];
  MODES_teamMap = new Map();
  MODES_nameTeams.clear();
  MODES_teamSelf = MODES_localId();
  MODES_teamCount = MODES_rosterSize();
  MODES_teamDirty = false;
  if (!def.teams) { MODES_localTeam = null; return null; }
  const online = MODES_onlineTeams();
  const sorted = MODES_rosterIds().sort();
  for (let i = 0; i < sorted.length; i++) {
    const key = sorted[i];
    const raw = key.slice(2);
    // Online, the room authority owns team membership (sticky, switchable).
    // Offline there is only the local player and practice bots.
    const team = online ? netTeamFor(raw) : (i % 2 === 0) ? 'red' : 'blue';
    if (!team) continue;
    MODES_teamMap.set(key, team);
    if (raw) MODES_teamMap.set(raw, team);
  }
  // Keep names separate from ids; duplicate display names cannot overwrite a
  // real roster id or turn an enemy into a teammate.
  try {
    if (typeof net !== 'undefined' && net && net.players && typeof net.players.forEach === 'function') {
      net.players.forEach(function (record, id) {
        if (!record || !record.name || id == null) return;
        const team = MODES_teamMap.get('n:' + String(id)) || MODES_teamMap.get(String(id));
        if (team) MODES_addTeamName(record.name, team);
      });
    }
    if (typeof playerName === 'string' && playerName) {
      const local = MODES_teamMap.get(MODES_localId());
      if (local) MODES_addTeamName(playerName, local);
    }
  } catch (e) { /* roster is optional */ }
  MODES_localTeam = MODES_teamMap.get(MODES_localId()) || null;
  return MODES_localTeam;
}

function MODES_syncTeams() {
  const def = MODES_activeDef || MODES[0];
  if (!def.teams) {
    if (MODES_localTeam !== null) MODES_localTeam = null;
    return null;
  }
  const self = MODES_localId();
  if (MODES_onlineTeams()) {
    // Cheap and always current: switches apply without waiting for a roster.
    MODES_localTeam = netTeamFor(net.id);
    if (MODES_teamDirty || self !== MODES_teamSelf || MODES_rosterSize() !== MODES_teamCount) MODES_assignTeams();
    return MODES_localTeam;
  }
  if (MODES_teamDirty || self !== MODES_teamSelf || MODES_rosterSize() !== MODES_teamCount ||
      !MODES_teamMap.has(self)) MODES_assignTeams();
  else MODES_localTeam = MODES_teamMap.get(self) || MODES_localTeam;
  return MODES_localTeam;
}

function MODES_onlineTeams() {
  try {
    return typeof net !== 'undefined' && net && net.online && net.id && typeof netTeamFor === 'function';
  } catch (e) { return false; }
}

function MODES_teamFor(id) {
  const def = MODES_activeDef || MODES[0];
  if (!def.teams || id == null || id === '') return null;
  const key = String(id);
  if (MODES_onlineTeams()) {
    const raw = key.indexOf('n:') === 0 ? key.slice(2) : key;
    if (raw === net.id || /^[\w-]{1,40}$/.test(raw)) {
      const team = netTeamFor(raw);
      if (raw === net.id) MODES_localTeam = team;
      if (team || net.authPlayers.has(raw)) return team;
    }
  }
  MODES_syncTeams();
  if (MODES_teamMap.has(key)) return MODES_teamMap.get(key);
  return MODES_nameTeams.has(key) ? MODES_nameTeams.get(key) : null;
}

/* ---------------- scoring ---------------- */
function MODES_refreshFfaScores() {
  let self = 0, opponent = 0;
  MODES_ffaKills.forEach(function (count, id) {
    if (MODES_isLocal(id, MODES_ffaNames.get(id))) self = Math.max(self, count);
    else opponent = Math.max(opponent, count);
  });
  MODES_scores.red = self;
  MODES_scores.blue = opponent;
}

function MODES_recordKill(killerId, killerName, victimId, victimName, info) {
  info = info || {};
  const confirmed = info.confirmed === true || info.authoritative === true;
  // UI prediction must not consume a token or suppress the later real death.
  // personalKill is deliberately absent: confirmed personal eliminations score.
  if (info.predicted || info.localKill || info.optimistic || info.confirmed === false ||
      (info.authoritative === false && !confirmed)) return false;
  if (MODES_worldBusy || MODES_queued > 0 || (BC.flags && BC.flags.worldBusy)) return false;
  if (info.mode != null && info.mode !== MODES_activeId) return false;
  if (info.seed != null && (!Number.isInteger(info.seed) || (info.seed >>> 0) !== (SEED >>> 0))) return false;
  if (MODES_winnerId != null) return false;
  MODES_syncTeams();
  const token = info.killId != null ? info.killId
    : (info.killToken != null ? info.killToken : info.eventId);
  const tokenKey = (typeof token === 'string' || (typeof token === 'number' && Number.isFinite(token)))
    ? String(token) : '';
  const hasKiller = killerId != null && killerId !== '';
  const hasVictim = victimId != null && victimId !== '';
  const session = MODES_sessionInfo();
  if (session.inRoom &&
      (session.pending || !confirmed || !tokenKey || !hasKiller || !hasVictim)) return false;
  if (MODES_wireConfig && MODES_wireConfig.session === session.key &&
      ((info.generation != null && info.generation !== MODES_wireConfig.generation) ||
       (info.epoch != null && info.epoch !== MODES_wireConfig.epoch))) return false;
  if (tokenKey.length > 256 || (tokenKey && MODES_seenKills.has(tokenKey))) return false;
  if (hasKiller && hasVictim && String(killerId) === String(victimId)) return false;
  if ((!hasKiller || !hasVictim) && killerName && victimName && killerName === victimName) return false;
  if (!hasKiller && !killerName) return false;

  const def = MODES_activeDef || MODES[0];
  let killerTeam = null;
  if (def.teams) {
    // A roster change can rebalance teams between the death and its receipt.
    // Prefer the authority's teams AT THE DEATH over a newer local assignment.
    killerTeam = confirmed && (info.killerTeam === 'red' || info.killerTeam === 'blue')
      ? info.killerTeam : MODES_teamFor(hasKiller ? killerId : killerName);
    if (!killerTeam) return false;
    if (hasVictim || victimName) {
      const victimTeam = confirmed && (info.victimTeam === 'red' || info.victimTeam === 'blue')
        ? info.victimTeam : MODES_teamFor(hasVictim ? victimId : victimName);
      if (victimTeam && victimTeam === killerTeam) return false;
    }
  }

  if (tokenKey) {
    // Keep every accepted token for this round rather than evicting old tokens
    // and allowing a replay to score. Normal score-to-win rounds are tiny.
    if (MODES_seenKills.size >= 4096) return false;
    MODES_seenKills.add(tokenKey);
  } else {
    // Legacy offline callers have no authority token. This fallback is never
    // used online, and never merges two distinct authoritative death tokens.
    const pair = JSON.stringify([hasKiller ? String(killerId) : killerName,
      hasVictim ? String(victimId) : victimName]);
    let now;
    try { now = typeof BC.now === 'function' ? BC.now() : Date.now(); }
    catch (e) { now = Date.now(); }
    const seenAt = MODES_recentKills.get(pair);
    if (seenAt != null && now >= seenAt && now - seenAt < 2600) return false;
    MODES_recentKills.set(pair, now);
    if (MODES_recentKills.size > 128) MODES_recentKills.delete(MODES_recentKills.keys().next().value);
  }

  MODES_clampScores();
  if (def.teams) {
    MODES_scores[killerTeam] += 1;
    if (MODES_scores[killerTeam] >= def.scoreToWin) {
      MODES_winner = killerTeam;
      MODES_winnerId = killerTeam;
    }
  } else {
    const id = hasKiller ? String(killerId)
      : (MODES_isLocal(null, killerName) ? MODES_localId() : 'name:' + String(killerName));
    const count = (MODES_ffaKills.get(id) || 0) + 1;
    MODES_ffaKills.set(id, count);
    MODES_ffaNames.set(id, killerName);
    MODES_refreshFfaScores();
    if (count >= def.scoreToWin) {
      MODES_winnerId = id;
      MODES_winner = MODES_isLocal(id, killerName) ? 'red' : 'blue';
    }
  }
  MODES_clampScores();
  return true;
}

function MODES_resetMatch() {
  if (!MODES_canConfigure()) return MODES_matchState();
  const session = MODES_sessionInfo();
  if (session.inRoom) {
    // A room round reset must invalidate authoritative kills/edits for every
    // peer, not merely zero the host's local scoreboard.
    if (session.generation > 0 && !MODES_queued && !MODES_worldBusy) {
      MODES_regenerate(SEED).catch(MODES_denyConfig);
    }
    return MODES_matchState();
  }
  MODES_beginRound();
  MODES_syncTeams();
  return MODES_matchState();
}

function MODES_matchState() {
  const def = MODES_activeDef || MODES[0];
  MODES_syncTeams();
  if (!def.teams) MODES_refreshFfaScores();
  MODES_clampScores();
  return {
    mode: def.id,
    name: def.name,
    short: def.short,
    teams: !!def.teams,
    weapons: def.weapons,
    red: MODES_scores.red,
    blue: MODES_scores.blue,
    selfTeam: MODES_localTeam,
    scoreToWin: def.scoreToWin,
    timeLeft: null,
    seed: SEED >>> 0,
    winner: MODES_winner,
    winnerId: MODES_winnerId,
    round: MODES_round | 0
  };
}

/* ---------------- weapons ---------------- */
function MODES_ladderStep() {
  let count = 0;
  try { count = typeof kills === 'number' ? kills : 0; } catch (e) { /* combat not loaded yet */ }
  return Math.max(0, Math.min(MODES_GUN_LADDER.length - 1, Math.floor(count)));
}

function MODES_allowedWeapons() {
  const def = MODES_activeDef || MODES[0];
  if (def.ladder) return [def.ladder[Math.min(def.ladder.length - 1, MODES_ladderStep())]];
  return def.weapons || null;
}

function MODES_canUseWeapon(id) {
  const allowed = MODES_allowedWeapons();
  if (!allowed) return true;
  return typeof id === 'string' && allowed.indexOf(id) >= 0;
}

function MODES_applyLoadout() {
  const allowed = MODES_allowedWeapons();
  const key = allowed ? allowed.join('|') : '*';
  try {
    // Roster/status refreshes must not keep forcing a legal selected weapon back
    // to the first gun. Invalidate combat's cached rules only when rules change.
    if (MODES_loadoutKey !== key && typeof combatOnLoadoutChanged === 'function') {
      combatOnLoadoutChanged();
      MODES_loadoutKey = key;
    }
    if (allowed && typeof WEAPONS !== 'undefined' && typeof selectWeapon === 'function' &&
        typeof currentWeapon === 'function') {
      const current = currentWeapon();
      const id = current && current.id ? current.id : null;
      if (!id || allowed.indexOf(id) < 0) {
        for (let i = 0; i < WEAPONS.length; i++) {
          if (allowed.indexOf(WEAPONS[i].id) >= 0) { selectWeapon(i); break; }
        }
      }
    }
  } catch (e) { /* combat not loaded yet */ }
  try {
    const fx = BC.api && BC.api.combatFx;
    if (fx && typeof fx.setLoadout === 'function' &&
        (MODES_loadoutFx !== fx || MODES_loadoutFxKey !== key)) {
      fx.setLoadout(allowed ? allowed.slice() : null);
      MODES_loadoutFx = fx;
      MODES_loadoutFxKey = key;
    }
  } catch (e) { /* ignore */ }
  return allowed;
}

/* ---------------- deterministic arena centre ---------------- */
function MODES_centre() {
  if (MODES_centreCache && MODES_centreCache.seed === SEED) return MODES_centreCache;
  const mid = Math.floor(WORLD / 2);
  let best = null, bestScore = Infinity;
  // Always choose for the largest supported ring so switching restricted modes
  // on the same seed uses one stable centre. Broaden the search, not the terrain.
  const margin = 60;
  for (let ring = 0; ring <= 17; ring++) {
    const radius = ring * 4;
    const steps = ring === 0 ? 1 : Math.min(24, 6 + ring * 2);
    for (let s = 0; s < steps; s++) {
      const ang = (s / steps) * Math.PI * 2 + ring * 0.37;
      const x = Math.round(mid + Math.cos(ang) * radius);
      const z = Math.round(mid + Math.sin(ang) * radius);
      if (x < margin || z < margin || x > WORLD - margin - 1 || z > WORLD - margin - 1) continue;
      const h = terrainHeight(x, z);
      if (!isFinite(h) || h <= SEA + 2) continue;
      let lo = h, hi = h, water = 0;
      for (let a = 0; a < 12; a++) {
        const aa = (a / 12) * Math.PI * 2;
        for (let rr = 12; rr <= 54; rr += 14) {
          const hh = terrainHeight(Math.round(x + Math.cos(aa) * rr), Math.round(z + Math.sin(aa) * rr));
          if (hh < lo) lo = hh;
          if (hh > hi) hi = hh;
          if (hh <= SEA) water++;
        }
      }
      let score = (hi - lo) * 12 + water * 45 + Math.abs(h - (SEA + 14)) * 0.4 + radius * 0.15;
      let tooClose = false;
      try {
        if (typeof villageSites !== 'undefined' && villageSites && villageSites.length) {
          for (let v = 0; v < villageSites.length; v++) {
            const site = villageSites[v];
            if (!site) continue;
            const d = Math.hypot(site.x - x, site.z - z);
            if (d < 34) { tooClose = true; break; }
            // Prefer an intact perimeter outside every village footprint. When
            // no such centre exists, protected cells are still never overwritten.
            if (d < 81) score += 10000 + (81 - d) * 100;
          }
        }
      } catch (e) { /* ignore */ }
      if (tooClose) continue;
      if (score < bestScore) { bestScore = score; best = { x: x, z: z, h: h }; }
    }
  }
  if (!best) {
    // Dry central candidates may all be unsuitable. A village-free wet site
    // can still support deterministic raised pads without deleting any houses.
    for (let x = margin; x < WORLD - margin; x += 4) {
      for (let z = margin; z < WORLD - margin; z += 4) {
        if (MODES_nearVillage(x - 4, z - 4) || MODES_nearVillage(x + 4, z - 4) ||
            MODES_nearVillage(x - 4, z + 4) || MODES_nearVillage(x + 4, z + 4)) continue;
        const h = terrainHeight(x, z);
        if (!Number.isFinite(h)) continue;
        const score = Math.hypot(x - mid, z - mid) + Math.max(0, SEA + 3 - h) * 20;
        if (score < bestScore) { bestScore = score; best = { x: x, z: z, h: h }; }
      }
    }
    if (!best) {
      const h = terrainHeight(mid, mid);
      best = { x: mid, z: mid, h: isFinite(h) ? h : SEA + 8 };
    }
  }
  MODES_centreCache = { seed: SEED, x: best.x, z: best.z, h: best.h };
  return MODES_centreCache;
}

/* ---------------- arena editing ---------------- */
const MODES_ledgerSeen = new Set();
const MODES_dirtyChunks = new Set();
let MODES_worldBusy = false;
let MODES_queued = 0;
let MODES_prepared = false;
let MODES_worldReadySeen = !!(typeof BC !== 'undefined' && BC && BC.readyFired);
let MODES_worldQueue = Promise.resolve();

function MODES_nearVillage(x, z) {
  try {
    if (typeof villageSites === 'undefined' || !villageSites || !villageSites.length) return false;
    for (let i = 0; i < villageSites.length; i++) {
      const site = villageSites[i];
      if (!site) continue;
      // Houses extend up to 15m from their site, plus roof/palm overhangs.
      if (Math.hypot(site.x - x, site.z - z) < 27) return true;
    }
  } catch (e) { /* world not generated yet */ }
  return false;
}

function MODES_markDirty(x, z) {
  const size = typeof CHUNK === 'number' ? CHUNK : 16;
  const count = typeof CHUNKS === 'number' ? CHUNKS : 16;
  // Boundary faces and corner AO depend on the adjacent chunk as well.
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const cx = Math.floor((x + dx) / size), cz = Math.floor((z + dz) / size);
    if (cx >= 0 && cz >= 0 && cx < count && cz < count) MODES_dirtyChunks.add(cx + ',' + cz);
  }
}

function MODES_flushDirty() {
  if (!MODES_dirtyChunks.size) return;
  const list = [];
  MODES_dirtyChunks.forEach(function (key) { list.push(key); });
  MODES_dirtyChunks.clear();
  if (typeof chunkMeshes === 'undefined' || !chunkMeshes || !chunkMeshes.size) return;
  if (typeof rebuildChunk !== 'function') return;
  for (let i = 0; i < list.length; i++) {
    const parts = list[i].split(',');
    try { rebuildChunk(Number(parts[0]), Number(parts[1])); } catch (e) { /* mesh race */ }
  }
}

function MODES_touch(x, y, z) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (x < 0 || z < 0 || x >= WORLD || z >= WORLD || y < 0 || y >= HEIGHT) return false;
  const index = blockIndex(x, y, z);
  if (MODES_ledgerSeen.has(index)) return true;
  if (MODES_ledger.length >= MODES_LEDGER_LIMIT) return false;
  MODES_ledgerSeen.add(index);
  MODES_ledger.push({ x: x, y: y, z: z, type: getBlock(x, y, z) });
  return true;
}

function MODES_put(x, y, z, type) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (x < 0 || z < 0 || x >= WORLD || z >= WORLD || y < 0 || y >= HEIGHT) return false;
  const old = getBlock(x, y, z);
  if (old === type) return false;
  if (!MODES_touch(x, y, z)) return false;
  setBlock(x, y, z, type);
  MODES_markDirty(x, z);
  return true;
}

function MODES_edit(x, y, z, type, force) {
  if (!force && MODES_nearVillage(x, z)) return false;
  return MODES_put(x, y, z, type);
}

function MODES_restoreLedger() {
  if (MODES_ledgerSeed === SEED) {
    for (let i = MODES_ledger.length - 1; i >= 0; i--) {
      const e = MODES_ledger[i];
      try { setBlock(e.x, e.y, e.z, e.type); } catch (err) { /* ignore */ }
      MODES_markDirty(e.x, e.z);
    }
  }
  MODES_ledger.length = 0;
  MODES_ledgerSeen.clear();
  MODES_ledgerSeed = -1;
}

function MODES_discardLedger() {
  MODES_ledger.length = 0;
  MODES_ledgerSeen.clear();
  MODES_ledgerSeed = -1;
}

/* ---------------- arena geometry ---------------- */
function MODES_gateHalf(radius) {
  return Math.max(2.6, Math.min(6, radius * 0.085));
}

function MODES_buildPad(side, x, z, baseMat, edgeMat, accentMat) {
  x = Math.round(x); z = Math.round(z);
  // A pad is either completely safe to build, or not built at all. Returning a
  // nominal pad on top of an unedited house would create a trapped spawn.
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
    if (MODES_nearVillage(x + dx, z + dz)) return null;
  }
  let maxG = terrainHeight(x, z);
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      const h = terrainHeight(x + dx, z + dz);
      if (isFinite(h) && h > maxG) maxG = h;
    }
  }
  if (!isFinite(maxG)) return null;
  const top = Math.min(HEIGHT - 7, Math.max(SEA + 2, maxG + 1));
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      const px = x + dx, pz = z + dz;
      const edge = Math.max(Math.abs(dx), Math.abs(dz)) === 4;
      const corner = Math.abs(dx) === 4 && Math.abs(dz) === 4;
      const ground = terrainHeight(px, pz);
      for (let y = Math.min(top - 2, ground); y <= top; y++) {
        let type = baseMat;
        if (y === top && edge) type = edgeMat;
        if (y === top && corner) type = accentMat;
        MODES_edit(px, y, pz, type);
      }
      for (let y = top + 1; y <= top + 5; y++) MODES_edit(px, y, pz, AIR);
    }
  }
  return { x: x + 0.5, y: top + 1.05, z: z + 0.5, top: top, side: side };
}

function MODES_buildSidePad(side, x, z, baseMat, edgeMat, accentMat) {
  const offsets = [0, -6, 6, -12, 12];
  for (let i = 0; i < offsets.length; i++) {
    const pad = MODES_buildPad(side, x, z + offsets[i], baseMat, edgeMat, accentMat);
    if (pad) return pad;
  }
  return null;
}

function MODES_buildGate(index, cx, cz, radius, baseY) {
  const angle = index * Math.PI * 0.5;
  const ux = Math.cos(angle), uz = Math.sin(angle);
  const half = MODES_gateHalf(radius);

  // clear a walk-through corridor across the wall
  for (let t = radius - 5; t <= radius + 4; t += 0.75) {
    for (let l = -half; l <= half; l += 0.75) {
      const px = Math.round(cx + ux * t - uz * l);
      const pz = Math.round(cz + uz * t + ux * l);
      const g = terrainHeight(px, pz);
      if (!isFinite(g)) continue;
      const y0 = Math.max(SEA + 2, g + 1);
      // Keep a supported floor, rather than excavating a pit beneath the gate.
      for (let y = g; y < y0; y++) MODES_edit(px, y, pz, STONEBRICK);
      for (let y = y0; y <= y0 + 6; y++) MODES_edit(px, y, pz, AIR);
    }
  }

  // flanking pillars with gold/diamond caps
  for (let side = -1; side <= 1; side += 2) {
    const l = side * (half + 1.25);
    const px = Math.round(cx + ux * radius - uz * l);
    const pz = Math.round(cz + uz * radius + ux * l);
    const g = terrainHeight(px, pz);
    if (!isFinite(g)) continue;
    const y0 = Math.max(SEA + 2, g + 1);
    for (let y = y0 - 1; y >= g - 1; y--) MODES_edit(px, y, pz, STONEBRICK);
    for (let y = y0; y <= y0 + 6; y++) {
      let type = STONEBRICK;
      if (y === y0) type = BRICK;
      else if (y === y0 + 5) type = GOLD_BLOCK;
      else if (y === y0 + 6) type = DIAMOND_BLOCK;
      MODES_edit(px, y, pz, type);
    }
  }

  MODES_gates.push({
    x: cx + ux * radius, z: cz + uz * radius, angle: angle,
    ux: ux, uz: uz, half: half,
    y: Math.max(SEA + 2, terrainHeight(Math.round(cx + ux * radius), Math.round(cz + uz * radius)) + 1)
  });
}

function MODES_buildArena() {
  const def = MODES_activeDef || MODES[0];
  if (!def || !def.locked || !def.arenaRadius) return;
  const centre = MODES_centre();
  const radius = def.arenaRadius;
  const cx = Math.floor(centre.x), cz = Math.floor(centre.z);
  const baseY = Math.max(SEA + 2, centre.h + 1);
  let visualY = baseY + 5;
  const half = MODES_gateHalf(radius);
  const outer = Math.ceil(radius + 2);

  MODES_pads = { red: null, blue: null };
  MODES_gates.length = 0;
  MODES_ledgerSeed = SEED;
  // Start from bare ground: world structures and trees inside would favour one
  // side, and these lanes are mirrored for fairness.
  for (let x = cx - outer; x <= cx + outer; x++) {
    for (let z = cz - outer; z <= cz + outer; z++) {
      if (Math.hypot(x - cx, z - cz) >= radius - 4.5) continue;
      const g = terrainHeight(x, z);
      for (let y = g + 1, top = Math.min(HEIGHT - 1, g + 16); y <= top; y++) {
        const b = getBlock(x, y, z);
        if (b === AIR || b === WATER) continue;
        // The surface can sit one block above the noise height: leave the ground.
        if (y === g + 1 && (b === GRASS || b === DIRT || b === SAND || b === SNOW || b === STONE)) continue;
        MODES_edit(x, y, z, AIR);
      }
    }
  }
  // Reserve the safe side spawns first; a bounded ledger can never leave the
  // spawn pads unbuilt after spending its budget on a perimeter foundation.
  const padDist = radius * 0.55;
  MODES_pads.red = MODES_buildSidePad('red', cx - padDist, cz, STONE, BRICK, GOLD_BLOCK);
  MODES_pads.blue = MODES_buildSidePad('blue', cx + padDist, cz, PLANKS, STONEBRICK, DIAMOND_BLOCK);

  for (let x = cx - outer; x <= cx + outer; x++) {
    for (let z = cz - outer; z <= cz + outer; z++) {
      const dist = Math.hypot(x - cx, z - cz);
      if (dist < radius - 4.5 || dist > radius + 1.5) continue;
      const g = terrainHeight(x, z);
      if (!isFinite(g)) continue;
      const y0 = Math.max(SEA + 2, g + 1);
      visualY = Math.max(visualY, y0 + 5);
      const wall = dist >= radius - 1.35 && dist <= radius + 1.35;

      let gate = false;
      if (wall) {
        for (let gi = 0; gi < 4; gi++) {
          const ga = gi * Math.PI * 0.5;
          const gx = cx + Math.cos(ga) * radius;
          const gz = cz + Math.sin(ga) * radius;
          if (Math.hypot(x - gx, z - gz) <= half + 0.5) { gate = true; break; }
        }
      }

      if (wall && !gate) {
        for (let y = y0; y <= y0 + 4; y++) {
          let type = ((x + z + y) & 1) ? STONEBRICK : BRICK;
          if (y === y0 + 4) type = GLASS;
          MODES_edit(x, y, z, type);
        }
        for (let y = y0 - 1; y >= g - 1; y--) {
          const cur = getBlock(x, y, z);
          if (cur === AIR || cur === WATER || cur === LEAVES || cur === LOG) {
            MODES_edit(x, y, z, STONEBRICK);
          }
        }
      } else if (dist < radius - 1.35) {
        // keep a three-block band just inside the wall clear
        for (let y = g; y < y0; y++) MODES_edit(x, y, z, STONEBRICK);
        for (let y = y0; y <= y0 + 5; y++) {
          if (getBlock(x, y, z) !== AIR) MODES_edit(x, y, z, AIR);
        }
      }
    }
  }

  for (let gi = 0; gi < 4; gi++) MODES_buildGate(gi, cx, cz, radius, baseY);
  if (typeof STRUCT_buildArenaCover === 'function') STRUCT_buildArenaCover(MODES_edit, cx, cz, radius);

  MODES_buildVisuals(cx, cz, visualY, radius);
}

/* ---------------- arena visuals ---------------- */
function MODES_clearVisuals() {
  const geometries = new Set(), materials = new Set();
  if (MODES_beaconGeo) geometries.add(MODES_beaconGeo);
  [MODES_redBeaconMat, MODES_blueBeaconMat, MODES_ringRedMat, MODES_ringBlueMat].forEach(function (mat) {
    if (mat) materials.add(mat);
  });
  try {
    if (MODES_visualGroup) {
      if (MODES_visualGroup.parent) MODES_visualGroup.parent.remove(MODES_visualGroup);
      MODES_visualGroup.traverse(function (obj) {
        if (obj.geometry) geometries.add(obj.geometry);
        const list = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (let i = 0; i < list.length; i++) if (list[i]) materials.add(list[i]);
      });
    }
  } catch (e) { /* visual cleanup is best-effort */ }
  // Four beacons share a geometry and two materials. Dispose each resource once,
  // including resources allocated before an optional visual constructor failed.
  geometries.forEach(function (geo) { if (typeof geo.dispose === 'function') geo.dispose(); });
  materials.forEach(function (mat) { if (typeof mat.dispose === 'function') mat.dispose(); });
  MODES_visualGroup = null;
  MODES_beaconGeo = null;
  MODES_redBeaconMat = null;
  MODES_blueBeaconMat = null;
  MODES_ringRedMat = null;
  MODES_ringBlueMat = null;
}

function MODES_buildVisuals(cx, cz, baseY, radius) {
  MODES_clearVisuals();
  if (typeof THREE === 'undefined' || !THREE || !radius || typeof scene === 'undefined' || !scene) return;
  try {
    const group = new THREE.Group();
    MODES_visualGroup = group;
    group.name = 'bc-arena-visuals';

    MODES_ringRedMat = new THREE.MeshBasicMaterial({
      color: 0xff3556, transparent: true, opacity: 0.34, side: THREE.DoubleSide, forceSinglePass: true,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    });
    MODES_ringBlueMat = new THREE.MeshBasicMaterial({
      color: 0x3585ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, forceSinglePass: true,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    });

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.55, radius + 0.55, 128, 1), MODES_ringRedMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.set(cx + 0.5, baseY + 0.12, cz + 0.5);
    outerRing.renderOrder = 2;
    group.add(outerRing);

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(radius - 3.3, radius - 2.7, 128, 1), MODES_ringBlueMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.set(cx + 0.5, baseY + 0.1, cz + 0.5);
    innerRing.renderOrder = 2;
    group.add(innerRing);

    MODES_beaconGeo = new THREE.BoxGeometry(0.42, 4.4, 0.42);
    MODES_redBeaconMat = new THREE.MeshBasicMaterial({
      color: 0xff3556, transparent: true, opacity: 0.72, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    });
    MODES_blueBeaconMat = new THREE.MeshBasicMaterial({
      color: 0x3585ff, transparent: true, opacity: 0.72, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    });

    for (let i = 0; i < MODES_gates.length; i++) {
      const gate = MODES_gates[i];
      if (!gate) continue;
      const beacon = new THREE.Mesh(
        MODES_beaconGeo, (i & 1) ? MODES_blueBeaconMat : MODES_redBeaconMat);
      beacon.position.set(gate.x + 0.5, gate.y + 2.2, gate.z + 0.5);
      beacon.renderOrder = 2;
      group.add(beacon);
    }

    scene.add(group);
    MODES_visualGroup = group;
  } catch (e) {
    MODES_clearVisuals();
  }
}

/* ---------------- respawn points ---------------- */
function MODES_spawnOpen(x, y, z) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) ||
      x < 1 || z < 1 || x >= WORLD - 1 || z >= WORLD - 1 || y < 1 || y + 1.8 >= HEIGHT) return false;
  if (MODES_arena.active && !MODES_arena.contains(x, z)) return false;
  const minX = Math.floor(x - 0.31), maxX = Math.floor(x + 0.31);
  const minZ = Math.floor(z - 0.31), maxZ = Math.floor(z + 0.31);
  const supportY = Math.floor(y - 0.08);
  for (let bx = minX; bx <= maxX; bx++) for (let bz = minZ; bz <= maxZ; bz++) {
    const floor = getBlock(bx, supportY, bz);
    if (floor === AIR || floor === WATER || floor === LEAVES || floor === CACTUS || floor === LOG) return false;
    // Use standing headroom even if the current life is crouched: a respawn or
    // teleport must never trap the taller body under a ceiling.
    for (let by = Math.floor(y); by <= Math.floor(y + 1.8); by++) {
      if (getBlock(bx, by, bz) !== AIR) return false;
    }
  }
  return true;
}

function MODES_padValid(pad) {
  if (!pad) return false;
  return MODES_spawnOpen(pad.x, pad.y, pad.z);
}

function MODES_padSpawn(pad, serial) {
  let hash = null;
  try { if (typeof BC.hashSeed === 'function') hash = BC.hashSeed(SEED + '|' + MODES_localId() + '|' + serial) >>> 0; }
  catch (e) { /* centre remains a safe fallback */ }
  if (hash === null) return { x: pad.x, y: pad.y, z: pad.z };
  const x = pad.x + (hash % 5) - 2;
  const z = pad.z + ((hash >>> 8) % 5) - 2;
  if (MODES_spawnOpen(x, pad.y, z)) return { x: x, y: pad.y, z: z };
  return { x: pad.x, y: pad.y, z: pad.z };
}

function MODES_scanGround(px, pz, maxR) {
  const cx = Math.round(px), cz = Math.round(pz);
  for (let r = 0; r <= maxR; r++) {
    const steps = r === 0 ? 1 : Math.max(8, Math.round(r * 8));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2 + r * 0.7;
      const x = Math.round(cx + Math.cos(a) * r);
      const z = Math.round(cz + Math.sin(a) * r);
      if (x < 1 || z < 1 || x >= WORLD - 1 || z >= WORLD - 1) continue;
      if (MODES_arena.active && !MODES_arena.contains(x + 0.5, z + 0.5)) continue;
      // terrainHeight is the original surface, not a raised pad, cleared strip,
      // or destructible world. Inspect the live voxels for support/headroom.
      for (let h = HEIGHT - 3; h > SEA; h--) {
        const floor = getBlock(x, h, z);
        if (floor === AIR || floor === WATER || floor === LEAVES || floor === LOG || floor === CACTUS) continue;
        if (MODES_spawnOpen(x + 0.5, h + 1.05, z + 0.5)) {
          return { x: x + 0.5, y: h + 1.05, z: z + 0.5 };
        }
      }
    }
  }
  return null;
}

/* ---------------- choosing a safe spawn ---------------- */
function MODES_livePeers() {
  const list = [];
  try {
    for (const r of net.players.values()) {
      const pos = r.group && r.group.position;
      if (!pos || r.hp <= 0 || r.group.visible === false) continue;
      list.push({ x: pos.x, y: pos.y, z: pos.z, friend: typeof combatIsFriendly === 'function' && combatIsFriendly(r.id, r.name, r) });
    }
  } catch (e) { /* net not ready */ }
  return list;
}

function MODES_clearSight(ax, ay, az, bx, by, bz) {
  const dist = Math.hypot(bx - ax, by - ay, bz - az), steps = Math.ceil(dist);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isOpaque(Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t), Math.floor(az + (bz - az) * t))) return false;
  }
  return true;
}

function MODES_faceFrom(spot, peers) {
  let tx = WORLD / 2, tz = WORLD / 2, best = Infinity;
  if (MODES_arena.active) { tx = MODES_arena.cx; tz = MODES_arena.cz; }
  for (const p of peers) {
    const d = Math.hypot(p.x - spot.x, p.z - spot.z);
    if (!p.friend && d < best) { best = d; tx = p.x; tz = p.z; }
  }
  spot.yaw = Math.atan2(spot.x - tx, spot.z - tz);
  return spot;
}

// Near enough to be back in the fight, never in anyone's sights.
function MODES_spawnScore(spot, peers) {
  let nearest = Infinity, score = Math.random() * 6;
  for (const p of peers) {
    const d = Math.hypot(p.x - spot.x, p.z - spot.z);
    if (p.friend) { if (d < 30) score += 8; continue; }
    nearest = Math.min(nearest, d);
    if (d < 100 && MODES_clearSight(spot.x, spot.y + 1.6, spot.z, p.x, p.y + 1.6, p.z)) score -= 70;
  }
  if (nearest < MODES_SPAWN_NEAR) score -= 200 - nearest;
  else if (nearest !== Infinity) score -= Math.abs(nearest - MODES_SPAWN_IDEAL) * 0.6;
  return score;
}

function MODES_bestSpawn(points) {
  const peers = MODES_livePeers();
  let best = null, bestScore = -Infinity;
  for (let i = points.length - 1, tries = 0; i >= 0 && tries < MODES_SPAWN_TRIES; i--, tries++) {
    const pick = Math.floor(Math.random() * (i + 1)), point = points[pick];
    points[pick] = points[i]; points[i] = point;
    const spot = MODES_scanGround(point.x, point.z, 6);
    if (!spot) continue;
    const score = MODES_spawnScore(spot, peers);
    if (score > bestScore) { bestScore = score; best = spot; }
  }
  return best ? MODES_faceFrom(best, peers) : null;
}

function MODES_respawnPoint(team) {
  if (MODES_arena.active) {
    const serial = MODES_spawnSerial++;
    const wanted = (team === 'red' || team === 'blue') ? team : null;
    let pad = wanted ? MODES_pads[wanted] : null;
    if (!wanted) {
      // Every player for themselves: anywhere around the ring, away from gates.
      const ring = [];
      for (let i = 0; i < 12; i++) {
        const a = (i + 0.5) * Math.PI / 6;
        ring.push({ x: MODES_arena.cx + Math.cos(a) * MODES_arena.radius * 0.72, z: MODES_arena.cz + Math.sin(a) * MODES_arena.radius * 0.72 });
      }
      const spot = MODES_bestSpawn(ring);
      if (spot) return spot;
      pad = MODES_padValid(MODES_pads.red) ? MODES_pads.red : MODES_pads.blue;
    }
    if (!MODES_padValid(pad)) pad = null; // scan the correct team side before any central fallback
    if (pad) return MODES_faceFrom(MODES_padSpawn(pad, serial), MODES_livePeers());

    const angle = wanted === 'blue' ? 0
      : wanted === 'red' ? Math.PI
      : ((serial & 1) ? 0 : Math.PI);
    const px = MODES_arena.cx + Math.cos(angle) * MODES_arena.radius * 0.6;
    const pz = MODES_arena.cz + Math.sin(angle) * MODES_arena.radius * 0.6;
    const spot = MODES_scanGround(px, pz, Math.max(8, Math.round(MODES_arena.radius * 0.35)));
    if (spot) return spot;

    const central = MODES_scanGround(MODES_arena.cx, MODES_arena.cz, Math.ceil(MODES_arena.radius));
    if (central) return central;
    // No safe support remains (for example, an arena destroyed down to water).
    // Do not silently edit a non-host's world; stay inside the boundary above it.
    return { x: MODES_arena.cx, y: HEIGHT + 2, z: MODES_arena.cz };
  }

  if (typeof battleSpawnPoints !== 'undefined' && battleSpawnPoints.length) {
    const spot = MODES_bestSpawn(battleSpawnPoints);
    if (spot) return spot;
  }
  if (typeof findSpawn === 'function') {
    try {
      const spawn = findSpawn();
      if (spawn && MODES_spawnOpen(spawn.x, spawn.y, spawn.z)) return spawn;
    } catch (e) { /* player module not ready */ }
  }
  const safe = MODES_scanGround(WORLD / 2, WORLD / 2, 80);
  return safe || { x: WORLD / 2 + 0.5, y: HEIGHT + 2, z: WORLD / 2 + 0.5 };
}

/* ---------------- activation and world preparation ---------------- */
function MODES_syncArenaState(def, centre, radius) {
  MODES_arena.active = !!(def && def.locked && radius > 0);
  MODES_arena.cx = centre ? centre.x + 0.5 : Math.floor(WORLD / 2) + 0.5;
  MODES_arena.cz = centre ? centre.z + 0.5 : Math.floor(WORLD / 2) + 0.5;
  MODES_arena.radius = MODES_arena.active ? radius : 0;
}

function MODES_prepareWorld(force) {
  const generation = typeof WORLD_generation === 'number' ? WORLD_generation : 0;
  if (typeof WORLD_generation === 'number' && generation === 0) {
    MODES_pending = true;
    return MODES_arena;
  }
  if (generation !== MODES_generationSeen) {
    // Fresh terrain, including a SAME-SEED re-roll, is not the terrain recorded
    // in the previous arena ledger. Restoring it would resurrect stale edits.
    MODES_discardLedger();
    MODES_dirtyChunks.clear();
    MODES_centreCache = null;
    MODES_builtKey = '';
    MODES_arenaSeed = -1;
    MODES_generationSeen = generation;
  }
  const def = MODES_activeDef || MODES[0];
  const centre = MODES_centre();
  const radius = (def.locked && def.arenaRadius) ? def.arenaRadius : 0;
  const key = generation + '|' + SEED + '|' + def.id + '|' + radius + '|' + centre.x + '|' + centre.z;

  if (MODES_ledgerSeed !== -1 && MODES_ledgerSeed !== SEED) MODES_discardLedger();

  if (!force && MODES_prepared && MODES_builtKey === key && MODES_arenaSeed === SEED) {
    MODES_syncArenaState(def, centre, radius);
    return MODES_arena;
  }

  MODES_restoreLedger();
  MODES_syncArenaState(def, centre, radius);

  if (MODES_arena.active) {
    MODES_buildArena();
  } else {
    MODES_pads = { red: null, blue: null };
    MODES_gates.length = 0;
    MODES_clearVisuals();
  }

  MODES_flushDirty();
  MODES_prepared = true;
  MODES_pending = false;
  MODES_arenaSeed = SEED;
  MODES_builtKey = key;
  MODES_syncTeams();
  return MODES_arena;
}

function MODES_persistMode(id) {
  MODES_settingsWriting++;
  try {
    if (BC.settings && typeof BC.settings.set === 'function') BC.settings.set('mode', id);
  } catch (e) { /* settings is optional */ }
  finally { MODES_settingsWriting--; }
  try { localStorage.setItem('blockcraft.mode', id); } catch (e) { /* file:// */ }
}

function MODES_persistSeed(seed) {
  MODES_settingsWriting++;
  try {
    if (BC.settings && typeof BC.settings.set === 'function') BC.settings.set('seed', seed >>> 0);
  } catch (e) { /* settings is optional */ }
  finally { MODES_settingsWriting--; }
  // Write this last: even an older settings bridge that rejects zero must not
  // replace the correct reload seed in legacy storage.
  try { localStorage.setItem('blockcraft.seed', String(seed >>> 0)); } catch (e) { /* file:// */ }
}

function MODES_restoreSettings() {
  MODES_persistMode(MODES_activeId);
  MODES_persistSeed(SEED);
}

function MODES_repositionPlayer(def, force) {
  try {
    if (typeof player === 'undefined' || !player || !player.pos) return;
    const pos = player.pos;
    if (force || !MODES_spawnOpen(pos.x, pos.y, pos.z)) {
      const spawn = MODES_respawnPoint(MODES_localTeam);
      if (spawn) {
        pos.set(spawn.x, spawn.y, spawn.z);
        if (typeof resetPlayerMotion === 'function') resetPlayerMotion();
      }
    } else {
      MODES_arena.clamp(pos);
    }
  } catch (e) { /* pre-boot */ }
}

function MODES_beginRound() {
  MODES_scores.red = 0;
  MODES_scores.blue = 0;
  MODES_seenKills.clear();
  MODES_recentKills.clear();
  MODES_ffaKills.clear();
  MODES_ffaNames.clear();
  MODES_winner = null;
  MODES_winnerId = null;
  MODES_spawnSerial = 0;
  MODES_round = (MODES_round | 0) + 1;
  // Gun Game climbs on this count, so a new round must start back at the first
  // gun. In a room the host's count follows straight after.
  try { kills = deaths = 0; if (typeof setKd === 'function') setKd(); } catch (e) { /* combat not loaded yet */ }
  try { MODES_matchStarted = (BC && typeof BC.now === 'function') ? BC.now() : Date.now(); }
  catch (e) { MODES_matchStarted = Date.now(); }
}

function MODES_setActive(id, opts) {
  opts = opts || {};
  const def = MODES_BY_ID[id];
  if (!def) return MODES_activeDef;

  // HUD/settings synchronization may write the already-active value on a peer.
  // That is a harmless no-op, not permission to force a rebuild.
  if (def.id === MODES_activeId && def.id === MODES_targetMode && !opts.force) {
    if (opts.persist !== false) MODES_persistMode(def.id);
    MODES_applyLoadout();
    return def;
  }
  try {
    const authority = MODES_authority(null, false);
    const request = MODES_requestConfig({ mode: def.id, seed: MODES_targetSeed }, authority, {
      persist: opts.persist !== false,
      forceMode: !!opts.force && !MODES_sessionInfo().inRoom,
      // The room transport versions match changes and discards old edits. Give
      // the host the same fresh world as peers, not just a newly overlaid arena.
      forceWorld: MODES_sessionInfo().inRoom && MODES_sessionInfo().generation > 0
    });
    // setActive keeps its classic synchronous definition return. Runtime edits
    // queued behind a re-roll still have explicit failure feedback and no race.
    request.catch(MODES_denyConfig);
    return def;
  } catch (error) {
    MODES_denyConfig(error);
  }
  return MODES_activeDef;
}

function MODES_isReady() {
  return MODES_worldReadySeen || !!(BC.readyFired || (BC.flags && BC.flags.bootReady));
}

function MODES_waitReady() {
  if (MODES_isReady()) return Promise.resolve();
  return new Promise(function (resolve) { MODES_readyWaiters.push(resolve); });
}

function MODES_setDefinition(id) {
  const changed = id !== MODES_activeId;
  MODES_activeDef = MODES_BY_ID[id];
  MODES_activeId = id;
  if (changed) MODES_teamDirty = true;
  MODES_syncTeams();
  return changed;
}

function MODES_notifyMode(changed, force) {
  if (changed || force) {
    try { BC.emit('modeChanged', MODES_activeId, MODES_activeDef); } catch (e) { /* optional listener */ }
  }
  MODES_applyLoadout();
}

function MODES_resetTransientState(config, resetWorld) {
  if (resetWorld) {
    try { BC.emit('worldWillReset', config); } catch (e) { /* net/input owners clear stale work */ }
  }
  const api = BC.api || {};
  if (api.riding && typeof api.riding.dismount === 'function') {
    try { api.riding.dismount('reset'); } catch (e) { /* optional riding module */ }
  }
  if (api.killcam && typeof api.killcam.hide === 'function') {
    try { api.killcam.hide(); } catch (e) { /* optional killcam module */ }
  }
  if (api.jetpack && typeof api.jetpack.reset === 'function') {
    try { api.jetpack.reset(); } catch (e) { /* optional movement reset */ }
  } else if (api.jetpack) {
    if (typeof api.jetpack.cancelInput === 'function') {
      try { api.jetpack.cancelInput(); } catch (e) { /* release boost/dash without advancing fuel */ }
    }
    if (typeof api.jetpack.setActive === 'function') {
      try { api.jetpack.setActive(false); } catch (e) { /* resume gravity on the new spawn */ }
    }
  }
  if (api.combat && typeof api.combat.resetWorld === 'function') {
    try { api.combat.resetWorld(config); } catch (e) { /* optional per-life reset */ }
  }
  if (typeof resetPlayerMotion === 'function') {
    try { resetPlayerMotion(); } catch (e) { /* pre-boot */ }
  }
}

function MODES_applyConfigNow(config, opts) {
  const seedChanged = config.seed !== (SEED >>> 0);
  const modeChanged = config.mode !== MODES_activeId;
  const rebuild = modeChanged || !!opts.forceMode;
  if (MODES_isReady() && rebuild) MODES_resetTransientState(config, false);
  SEED = config.seed >>> 0;
  MODES_setDefinition(config.mode);
  if (seedChanged || rebuild) MODES_beginRound();
  if (opts.persist !== false) MODES_persistMode(MODES_activeId);
  MODES_persistSeed(SEED);
  if (MODES_isReady() && MODES_prepared && rebuild) {
    MODES_prepareWorld(true);
    // A shrinking arena can place a pad/wall over a previously safe position;
    // a round change uses the correct side pad, even if the old position is in it.
    MODES_repositionPlayer(MODES_activeDef, true);
  } else if (rebuild || seedChanged) {
    MODES_pending = true;
  }
  MODES_notifyMode(modeChanged, opts.forceMode);
  return seedChanged || rebuild;
}

function MODES_requestConfig(config, authority, opts) {
  opts = opts || {};
  MODES_checkAuthority(authority);
  const sameTarget = config.mode === MODES_targetMode && config.seed === MODES_targetSeed;
  if (sameTarget && MODES_queued > 0 && !opts.forceWorld && !opts.forceMode) return MODES_lastConfigPromise;
  const serial = ++MODES_configSerial;
  MODES_targetSerial = serial;
  MODES_targetMode = config.mode;
  MODES_targetSeed = config.seed;
  const ready = MODES_isReady();
  const preTerrain = !MODES_prepared &&
    (typeof WORLD_generation !== 'number' || WORLD_generation === 0);
  const mustRegenerate = !preTerrain && (config.seed !== (SEED >>> 0) || opts.forceWorld);
  let result;

  if (!MODES_queued && !MODES_worldBusy && !mustRegenerate) {
    const pause = ready && (config.mode !== MODES_activeId || opts.forceMode);
    if (pause) MODES_setBusy(true);
    try {
      MODES_checkAuthority(authority);
      const changed = MODES_applyConfigNow(config, opts);
      if (changed && !authority.received) MODES_emitConfig(false);
      result = Promise.resolve();
    } catch (error) {
      if (MODES_targetSerial === serial) {
        MODES_targetMode = MODES_activeId;
        MODES_targetSeed = SEED >>> 0;
      }
      throw error;
    } finally {
      if (pause) MODES_setBusy(MODES_queued > 0);
    }
  } else {
    result = MODES_enqueue(async function () {
      if (!MODES_isReady()) await MODES_waitReady();
      MODES_checkAuthority(authority);
      let changed, fullWorld = false;
      if (config.seed !== (SEED >>> 0) || opts.forceWorld) {
        await MODES_regenerateNow(config, opts);
        changed = true;
        fullWorld = true;
      } else {
        changed = MODES_applyConfigNow(config, opts);
      }
      MODES_checkAuthority(authority);
      if (changed && !authority.received) MODES_emitConfig(fullWorld);
    });
  }
  const completion = result.catch(function (error) {
    if (MODES_targetSerial === serial) {
      MODES_targetMode = MODES_activeId;
      MODES_targetSeed = SEED >>> 0;
      MODES_restoreSettings();
    }
    throw error;
  });
  if (MODES_targetSerial === serial) MODES_lastConfigPromise = completion;
  return completion;
}

/* ---------------- seeded world re-roll ---------------- */
function MODES_setBusy(on) {
  const changed = MODES_worldBusy !== !!on;
  MODES_worldBusy = !!on;
  try { if (BC.flags) BC.flags.worldBusy = !!on; } catch (e) { /* ignore */ }
  if (changed) {
    if (on) {
      try { BC.emit('inputReset', 'worldBusy'); } catch (e) { /* input/combat/jetpack own held controls */ }
    }
    try { BC.emit('worldBusyChanged', !!on); } catch (e) { /* gameplay input owners release held actions */ }
  }
}

function MODES_worldYield() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

function MODES_clearChunkMeshes() {
  if (typeof chunkMeshes === 'undefined' || !chunkMeshes) return;
  const keys = [];
  chunkMeshes.forEach(function (_rec, key) { keys.push(key); });
  for (let i = 0; i < keys.length; i++) {
    try { disposeChunk(chunkMeshes.get(keys[i])); } catch (e) { /* ignore */ }
  }
  try { chunkMeshes.clear(); } catch (e) { /* ignore */ }
}

function MODES_clearDamage() {
  if (typeof DESTRUCTION_dirtyChunks !== 'undefined' && DESTRUCTION_dirtyChunks) DESTRUCTION_dirtyChunks.clear();
  if (typeof voxelDamageMap === 'undefined' || !voxelDamageMap) return;
  try {
    const list = [];
    voxelDamageMap.forEach(function (rec) { list.push(rec); });
    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      if (!rec) continue;
      try {
        if (typeof resetVoxelDamage === 'function') {
          resetVoxelDamage(rec.x, rec.y, rec.z, rec.type, -1);
        }
      } catch (e) { /* ignore */ }
    }
    voxelDamageMap.clear();
  } catch (e) { /* ignore */ }
}

function MODES_clearCritters() {
  if (typeof WORLD_clearCritters === 'function') WORLD_clearCritters();
}

function MODES_clearDragons() {
  try {
    if (typeof dragons === 'undefined' || !dragons) return;
    for (let i = dragons.length - 1; i >= 0; i--) {
      const dragon = dragons[i];
      if (dragon && dragon.group) {
        if (typeof WORLD_releasePopulationRoot === 'function') WORLD_releasePopulationRoot(dragon.group);
        else if (typeof scene !== 'undefined' && scene) scene.remove(dragon.group);
      }
    }
    dragons.length = 0;
  } catch (e) { /* ignore */ }
}

async function MODES_regenerateNow(config, opts) {
  if (typeof generateTerrain !== 'function' || typeof rebuildChunk !== 'function' ||
      typeof blocks === 'undefined' || !blocks || typeof blocks.fill !== 'function') {
    throw MODES_configError('Terrain and meshing modules are not ready.', 'BC_WORLD_NOT_READY');
  }
  MODES_resetTransientState(config, true);
  const modeChanged = config.mode !== MODES_activeId;
  SEED = config.seed >>> 0;
  MODES_setDefinition(config.mode);
  if (opts.persist !== false) MODES_persistMode(MODES_activeId);
  MODES_persistSeed(SEED);

  MODES_discardLedger();
  MODES_dirtyChunks.clear();
  MODES_clearVisuals();
  MODES_pads = { red: null, blue: null };
  MODES_gates.length = 0;
  MODES_arenaSeed = -1;
  MODES_builtKey = '';
  MODES_centreCache = null;
  MODES_prepared = false;
  MODES_spawnSerial = 0;

  MODES_clearDragons();
  MODES_clearCritters();

  try { if (typeof trees !== 'undefined' && trees) trees.length = 0; } catch (e) { /* ignore */ }
  try { if (typeof villageSites !== 'undefined' && villageSites) villageSites.length = 0; } catch (e) { /* ignore */ }

  blocks.fill(0);
  MODES_clearChunkMeshes();
  MODES_clearDamage();

  generateTerrain(true);

  // generateTerrain already prepared the arena; this explicit call is a safe
  // fallback for reduced builds, not a second restore/build of the same ring.
  MODES_prepareWorld();
  MODES_beginRound();
  MODES_repositionPlayer(MODES_activeDef, true);

  const count = typeof CHUNKS === 'number' ? CHUNKS : 16;
  const total = count * count;
  for (let i = 0; i < total; i++) {
    const cx = i % count, cz = Math.floor(i / count);
    rebuildChunk(cx, cz);
    if (i % 7 === 6) await MODES_worldYield();
  }

  if (typeof spawnDragons === 'function') spawnDragons();

  MODES_syncTeams();
  MODES_notifyMode(modeChanged, false);
  MODES_pending = false;

  MODES_settingsWriting++;
  try { BC.emit('worldReset', SEED); } catch (e) { /* optional listeners */ }
  finally { MODES_settingsWriting--; }
  MODES_persistSeed(SEED);
  if (!BC.readyFired && !MODES_worldReadySeen) {
    MODES_worldReadySeen = true;
    try { BC.emit('worldReady'); } catch (e) { /* ignore */ }
  }
}

function MODES_enqueue(task) {
  MODES_queued++;
  // Pause immediately, including the microtask before the first queued rebuild.
  MODES_setBusy(true);
  const run = MODES_worldQueue.then(task);
  const settled = run.then(function (value) {
    MODES_queued--;
    MODES_setBusy(MODES_queued > 0);
    return value;
  }, function (error) {
    MODES_queued--;
    MODES_setBusy(MODES_queued > 0);
    throw error;
  });
  // A failed job releases busy and does not poison later re-rolls.
  MODES_worldQueue = settled.then(function () {}, function () {});
  return settled;
}

function MODES_regenerate(seed) {
  try {
    const authority = MODES_authority(null, false);
    const next = MODES_normalizeSeed(seed);
    const session = MODES_sessionInfo(), online = session.inRoom;
    // A versioned room can explicitly reset the same seed. Without that protocol
    // an equal seed must remain a no-op, or only this peer would lose its edits.
    if (online && session.generation < 1 && next === MODES_targetSeed) {
      return MODES_queued > 0 ? MODES_lastConfigPromise.then(function () {}) : Promise.resolve();
    }
    return MODES_requestConfig({ mode: MODES_targetMode, seed: next }, authority, {
      forceWorld: !online || session.generation > 0
    }).then(function () {
      return MODES_waitReady();
    });
  } catch (error) {
    MODES_denyConfig(error);
    return Promise.reject(error);
  }
}

function MODES_ensureSeed(seed, by) {
  if (seed == null || seed === '') return Promise.resolve();
  const next = MODES_normalizeSeed(seed);
  if (next === (SEED >>> 0) && next === MODES_targetSeed) {
    return MODES_queued > 0 ? MODES_lastConfigPromise.then(function () {}) : Promise.resolve();
  }
  if (MODES_sessionInfo().inRoom) {
    // Never give a bare local ensureSeed call an authority bypass. The new net
    // handoff supplies the validated host, preferably through receiveConfig.
    return MODES_receiveConfig({ seed: next }, by);
  }
  try {
    return MODES_requestConfig({ mode: MODES_targetMode, seed: next },
      MODES_authority(null, true), {}).then(MODES_waitReady);
  } catch (error) { return Promise.reject(error); }
}

function MODES_receiveConfig(config, by) {
  try {
    const authority = MODES_authority(by, true);
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw MODES_configError('Invalid match configuration.', 'BC_BAD_CONFIG');
    }
    const hasMode = Object.prototype.hasOwnProperty.call(config, 'mode');
    const hasSeed = Object.prototype.hasOwnProperty.call(config, 'seed');
    const hasGeneration = Object.prototype.hasOwnProperty.call(config, 'generation');
    if ((!hasMode && !hasSeed) || (hasMode && (typeof config.mode !== 'string' || !MODES_BY_ID[config.mode])) ||
        (hasSeed && (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 4294967295)) ||
        (hasGeneration && (!Number.isSafeInteger(config.generation) || config.generation < 1)) ||
        (config.epoch != null && (typeof config.epoch !== 'string' || config.epoch.length > 96))) {
      throw MODES_configError('A valid mode id and uint32 seed are required.', 'BC_BAD_CONFIG');
    }
    const next = {
      mode: hasMode ? config.mode : MODES_targetMode,
      seed: hasSeed ? config.seed >>> 0 : MODES_targetSeed
    };
    const currentSession = MODES_sessionInfo();
    let freshGeneration = currentSession.inRoom && MODES_receivedRoom !== currentSession.key;
    let receivedWire = null;
    if (hasGeneration) {
      const session = MODES_sessionInfo();
      const epoch = config.epoch == null ? session.epoch : config.epoch;
      if (session.epoch && epoch !== session.epoch) {
        throw MODES_configError('Match configuration belongs to a different room epoch.', 'BC_STALE_CONFIG');
      }
      const previous = MODES_wireConfig;
      const sameRoom = previous && previous.session === session.key && previous.epoch === epoch;
      if (sameRoom && (config.generation < previous.generation ||
          (config.generation === previous.generation && (next.mode !== previous.mode || next.seed !== previous.seed)))) {
        throw MODES_configError('Match configuration is stale or conflicts with its generation.', 'BC_STALE_CONFIG');
      }
      if (sameRoom && config.generation === previous.generation && MODES_queued > 0 &&
          next.mode === MODES_targetMode && next.seed === MODES_targetSeed) {
        return MODES_lastConfigPromise.then(MODES_waitReady);
      }
      const applied = MODES_wireApplied;
      freshGeneration = !applied || applied.session !== session.key || applied.epoch !== epoch ||
        config.generation > applied.generation;
      MODES_wireConfig = {
        session: session.key, epoch: epoch, generation: config.generation,
        mode: next.mode, seed: next.seed
      };
      receivedWire = MODES_wireConfig;
      const prepared = MODES_localWorldCommit;
      if (freshGeneration && prepared && prepared.session === session.key &&
          prepared.mode === next.mode && prepared.seed === next.seed) {
        // The host already built this world before announcing it. Adopt its
        // validated generation without overwriting a newer queued host choice.
        MODES_localWorldCommit = null;
        MODES_receivedRoom = session.key;
        MODES_wireApplied = receivedWire;
        return MODES_waitReady();
      }
    }
    if (currentSession.inRoom) MODES_receivedRoom = currentSession.key;
    return MODES_requestConfig(next, authority, { forceWorld: freshGeneration }).then(function () {
      if (receivedWire && (!MODES_wireApplied || MODES_wireApplied.session !== receivedWire.session ||
          MODES_wireApplied.epoch !== receivedWire.epoch || MODES_wireApplied.generation <= receivedWire.generation)) {
        MODES_wireApplied = receivedWire;
      }
      return MODES_waitReady();
    });
  } catch (error) { return Promise.reject(error); }
}

/* ---------------- public APIs ---------------- */
if (typeof BC !== 'undefined' && BC) {
  BC.api = BC.api || Object.create(null);

  BC.api.modes = {
    MODES: MODES,
    get active() { return MODES_activeId; },
    get activeDef() { return MODES_activeDef; },
    get localTeam() { return MODES_localTeam; },
    setActive: MODES_setActive,
    canConfigure: MODES_canConfigure,
    receiveConfig: MODES_receiveConfig,
    allowedWeapons: MODES_allowedWeapons,
    canUseWeapon: MODES_canUseWeapon,
    recordKill: MODES_recordKill,
    scores: MODES_scores,
    matchState: MODES_matchState,
    arena: MODES_arena,
    respawnPoint: MODES_respawnPoint,
    applyLoadout: MODES_applyLoadout,
    resetMatch: MODES_resetMatch,
    newSeed: MODES_newSeed,
    prepareWorld: MODES_prepareWorld,
    teamFor: MODES_teamFor,
    // Alias kept for consumers that already look up teams by the shorter name.
    teamOf: MODES_teamFor,
    assignTeams: MODES_assignTeams
  };

  BC.api.world = {
    seed: function () { return SEED >>> 0; },
    newSeed: MODES_newSeed,
    regenerate: MODES_regenerate,
    ensureSeed: MODES_ensureSeed,
    get busy() { return !!(MODES_worldBusy || MODES_queued > 0 || (BC.flags && BC.flags.worldBusy)); }
  };
}

/* ---------------- runtime hooks ---------------- */
function MODES_onWorldReady() {
  const pending = MODES_pending;
  MODES_worldReadySeen = true;
  MODES_teamDirty = true;
  MODES_syncTeams();
  MODES_prepareWorld();
  MODES_applyLoadout();
  MODES_repositionPlayer(MODES_activeDef, pending);
  MODES_restoreSettings();
  const waiters = MODES_readyWaiters.splice(0);
  for (let i = 0; i < waiters.length; i++) waiters[i]();
}

function MODES_queueRosterRefresh() {
  MODES_teamDirty = true;
  if (MODES_rosterQueued) return;
  MODES_rosterQueued = true;
  // netPacket precedes handleNet's roster mutation. Read only the actual roster
  // afterwards, never trust a raw packet's proposed ids, host, or configuration.
  Promise.resolve().then(function () {
    MODES_rosterQueued = false;
    MODES_assignTeams();
    MODES_clampScores();
  });
}

if (typeof BC !== 'undefined' && BC && typeof BC.on === 'function') {
  BC.on('worldReady', MODES_onWorldReady, 5);

  BC.on('worldReset', function () {
    // Idempotent for the reset emitted by regenerate; generation identity also
    // catches an external same-seed generateTerrain(true) before this hook.
    MODES_prepareWorld();
    MODES_syncTeams();
    MODES_applyLoadout();
    MODES_persistSeed(SEED);
  }, 5);

  BC.on('killfeed', function (killer, victim, info) {
    info = info || {};
    MODES_recordKill(info.killerId, killer, info.victimId, victim, info);
  }, 5);

  BC.on('netStatus', function () {
    const key = MODES_sessionInfo().key;
    if (key !== MODES_roomKey) {
      MODES_roomKey = key;
      if (MODES_wireConfig && MODES_wireConfig.session !== key) MODES_wireConfig = null;
      if (MODES_wireApplied && MODES_wireApplied.session !== key) MODES_wireApplied = null;
      if (MODES_localWorldCommit && MODES_localWorldCommit.session !== key) MODES_localWorldCommit = null;
      if (MODES_receivedRoom !== key) MODES_receivedRoom = '';
      MODES_beginRound();
    }
    MODES_teamDirty = true;
    MODES_syncTeams();
    MODES_clampScores();
    MODES_applyLoadout();
  }, 5);

  // Gun Game: the allowed gun depends on this player's kill count.
  function MODES_refreshLadder() {
    if ((MODES_activeDef || MODES[0]).ladder) Promise.resolve().then(MODES_applyLoadout);
  }
  BC.on('killfeed', MODES_refreshLadder, 0);
  BC.on('respawn', MODES_refreshLadder, 0);

  BC.on('netPacket', function (msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'welcome' || msg.t === 'join' || msg.t === 'leave' ||
        msg.t === 'state' || msg.t === 'roster' || msg.t === 'teamSet' || msg.t === 'authority') {
      MODES_queueRosterRefresh();
    }
  }, 5);

  BC.on('settingsChanged', function (key, value) {
    if (MODES_settingsWriting || value == null) return;
    if (key === 'mode') {
      if (!MODES_BY_ID[value]) MODES_persistMode(MODES_activeId);
      else MODES_setActive(value, { persist: false });
    } else if (key === 'seed' && !MODES_canConfigure() &&
               MODES_normalizeSeed(value) !== (SEED >>> 0)) {
      MODES_denyConfig(MODES_configError('Only the room host can change the map seed.', 'BC_NOT_HOST'));
    }
    // Seed settings are also written back by worldReady/worldReset. Actual map
    // changes must use world.regenerate or receiveConfig, not this feedback hook.
  }, 5);

  MODES_syncTeams();
  if (typeof BC.whenReady === 'function') BC.whenReady(function () {
    if (!MODES_worldReadySeen) MODES_onWorldReady();
  });
}
