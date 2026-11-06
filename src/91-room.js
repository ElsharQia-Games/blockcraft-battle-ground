/* Blockcraft Battle Ground — internet rooms: finding the host and staying linked.
   91-room.js (after 90-net.js, which owns the game rules on the host)

   How a room works
   - The host's browser is the server. Every player holds one reliable, ordered
     WebRTC link to the host; all game traffic runs on it. The link has two
     channels: reliable and ordered for events (shots, deaths, edits), and
     unreliable for positions and ping, where a late packet is worthless and
     waiting for a lost one would stall everything behind it.
   - Public MQTT brokers are used only as a meeting point: the host beacons,
     players send an offer, the host answers. Every handshake message goes
     through ALL brokers at once, so one slow or lossy broker does not matter,
     and a live room does not care if every broker disappears.
   - Paths: a link first tries the best route ICE can find (direct when
     possible, TURN otherwise). Retries force TURN (UDP, TCP, or TLS on 443),
     which passes strict NATs and firewalls. TURN servers come from
     net-config.js. ?relay=1 forces TURN from the start, ?direct=1 never uses it.
   - Staying alive: a dropped link reconnects by itself. If the host is gone, the
     player first in id order takes over, keeping the world, and the others
     reconnect to its beacon. A player asks "who hosts?" several times first, so
     a live host is never replaced because a few broker messages went missing.
     If two hosts ever appear, the one with more players stays.
   - Silence alone never ends a link. A slow phone can freeze for many seconds
     building the world while its connection is fine, so a quiet link only
     counts as dead once WebRTC agrees, or after ROOM_STALL_MS.
   - Retries back off with jitter. A player only takes over while it can prove it
     is online (a broker answers), so losing your own Wi-Fi never splits the room.
     Offline time does not count. After ROOM_GIVE_UP_MS the player is offered
     Retry and Leave while retries carry on behind them. roomStatus() describes
     all of this for 93-connection.js. */
'use strict';

const ROOM_PROTOCOL = 1;           // bump when old and new builds can't share a room
const ROOM_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const ROOM_STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
const ROOM_BEACON_MS = 2000;
const ROOM_WHO_MS = 1000;          // "who hosts?" while looking for one
const ROOM_WHO_EMPTY = 5;          // unanswered asks before a joiner hosts an empty room
const ROOM_WHO_GONE = 6;           // unanswered asks before a host counts as gone
const ROOM_BROKER_TIMEOUT_MS = 8000;
const ROOM_GATHER_MS = 1500;       // bundle candidates into the SDP for at most this long
const ROOM_RESEND_MS = 2000;       // re-send an unanswered offer
const ROOM_LINK_TIMEOUT_MS = 12000;
const ROOM_SILENCE_MS = 8000;      // quiet this long and WebRTC reports trouble: dead
const ROOM_STALL_MS = 30000;       // quiet this long, whatever WebRTC reports: dead
const ROOM_STALL_NOTICE_MS = 3000; // quiet this long: tell the player
const ROOM_TAKEOVER_MS = 4000;     // the successor waits this long for the old host to return
const ROOM_TAKEOVER_STEP_MS = 2000;// each player after the successor waits this much longer
const ROOM_GIVE_UP_MS = 45000;      // stop retrying and ask the player
const ROOM_NO_BROKER_MS = 15000;   // no broker at all: say so
const ROOM_FAST_MAX = 16000;       // bigger than this: loss is too likely, use the reliable channel
const ROOM_MAX_BUFFER = 256 * 1024;

const roomNet = {
  code: '', role: '',            // role: '', 'finding', 'host', 'player', 'reconnecting'
  brokers: [], seen: new Set(),
  links: new Map(),              // peer id -> link
  hostId: '', beaconAt: -Infinity, lastHostId: '',
  attempts: 0, nextTryAt: 0, downAt: 0, findAt: 0, tickAt: 0, deadline: 0, signalUpAt: 0, noSignalAt: 0,
  whoAt: 0, whoCount: 0, whoReplyAt: 0, failure: '', notice: '', noticeUntil: 0, hostLeft: false, badPingSince: 0, timer: null, beaconTimer: null, session: 0
};

/* ---------------- handshake over public MQTT brokers ---------------- */
function roomVarint(n) {
  const out = [];
  do { let b = n & 0x7f; n >>>= 7; if (n > 0) b |= 0x80; out.push(b); } while (n > 0);
  return out;
}
function roomStr(s) { const b = new TextEncoder().encode(s); return [b.length >> 8, b.length & 255, ...b]; }
function roomPacket(type, body) { return new Uint8Array([type, ...roomVarint(body.length), ...body]); }
function roomTopic() { return 'bc3/' + roomNet.code + '/sig'; }

function roomBrokerOpen(url, session) {
  const entry = { url, ws: null, ready: false, buffer: new Uint8Array(0), ping: null, fails: 0, probeAt: 0 };
  roomNet.brokers.push(entry);
  const retry = () => setTimeout(connect, roomBackoff(entry.fails++, 30000));
  const connect = () => {
    if (session !== roomNet.session) return;
    let ws;
    try { ws = new WebSocket(url, 'mqtt'); } catch (e) { retry(); return; }
    entry.ws = ws;
    ws.binaryType = 'arraybuffer';
    const stuck = setTimeout(() => { if (!entry.ready) try { ws.close(); } catch (e) { /* closed */ } }, ROOM_BROKER_TIMEOUT_MS);
    ws.onopen = () => {
      const id = 'bc' + Math.random().toString(36).slice(2, 14);
      ws.send(roomPacket(0x10, [...roomStr('MQTT'), 4, 2, 0, 60, ...roomStr(id)]));
      entry.ping = setInterval(() => { try { ws.send(new Uint8Array([0xc0, 0])); } catch (e) { /* closing */ } }, 25000);
    };
    ws.onmessage = (e) => { if (session === roomNet.session) roomBrokerData(entry, new Uint8Array(e.data)); };
    ws.onerror = () => {};
    ws.onclose = () => {
      entry.ready = false;
      entry.probeAt = 0;
      clearTimeout(stuck);
      clearInterval(entry.ping);
      entry.buffer = new Uint8Array(0);
      if (session === roomNet.session) retry();
    };
  };
  connect();
}

function roomBackoff(tries, max) {
  return Math.min(max, 500 * 2 ** tries) * (0.8 + Math.random() * 0.4);
}

// A socket can look open long after the network behind it went away. Ping each
// broker; one that stays quiet is reconnected by roomTick.
function roomProbeBrokers() {
  for (const b of roomNet.brokers) {
    if (!b.ready || b.probeAt) continue;
    b.probeAt = performance.now();
    try { b.ws.send(new Uint8Array([0xc0, 0])); } catch (e) { /* roomTick closes it */ }
  }
}

function roomSignalReady() {
  return roomNet.brokers.some((b) => b.ready && !b.probeAt);
}

function roomBrokerData(entry, chunk) {
  entry.probeAt = 0;
  const buf = new Uint8Array(entry.buffer.length + chunk.length);
  buf.set(entry.buffer); buf.set(chunk, entry.buffer.length);
  let i = 0;
  while (i + 2 <= buf.length) {
    const first = buf[i];
    let p = i + 1, len = 0, mul = 1, done = false;
    while (p < buf.length) {
      const b = buf[p++];
      len += (b & 127) * mul; mul *= 128;
      if (!(b & 128)) { done = true; break; }
      if (mul > 2097152) { try { entry.ws.close(); } catch (e) { /* closing */ } return; }
    }
    if (!done || p + len > buf.length) break;
    const body = buf.subarray(p, p + len);
    i = p + len;
    const type = first >> 4;
    if (type === 2) { // CONNACK: subscribe
      if (body[1] === 0) entry.ws.send(roomPacket(0x82, [0, 1, ...roomStr(roomTopic()), 0]));
    } else if (type === 9) { // SUBACK
      if (!roomSignalReady()) roomNet.signalUpAt = performance.now();
      entry.ready = true;
      entry.fails = 0;
      if (!roomNet.findAt) { roomNet.findAt = performance.now(); roomNet.deadline = roomNet.findAt + ROOM_GIVE_UP_MS; }
      if (roomNet.role === 'host') roomBeacon();
    } else if (type === 3) { // PUBLISH, QoS 0
      const n = (body[0] << 8) | body[1];
      try { roomSignalIn(JSON.parse(new TextDecoder().decode(body.subarray(2 + n)))); } catch (e) { /* not ours */ }
    }
  }
  entry.buffer = buf.slice(i);
}

let roomSignalSerial = 0;
function roomSignal(data) {
  const payload = JSON.stringify({ ...data, from: net.id, nonce: net.id + ':' + (++roomSignalSerial) });
  const body = [...roomStr(roomTopic()), ...new TextEncoder().encode(payload)];
  for (const b of roomNet.brokers) {
    if (!b.ready) continue;
    try { b.ws.send(roomPacket(0x30, body)); } catch (e) { /* the other broker still carries it */ }
  }
}

function roomSignalIn(m) {
  if (!m || typeof m.from !== 'string' || m.from === net.id || !netValidId(m.from) || typeof m.nonce !== 'string') return;
  if (roomNet.seen.has(m.nonce)) return;     // the same message via the other broker
  roomNet.seen.add(m.nonce);
  if (roomNet.seen.size > 300) roomNet.seen.delete(roomNet.seen.values().next().value);
  if (m.k === 'beacon') roomOnBeacon(m);
  else if (m.k === 'who') roomOnWho();
  else if (m.to !== net.id) return;
  else if (m.k === 'offer' && typeof m.sdp === 'string') roomOnOffer(m);
  else if (m.k === 'answer' && typeof m.sdp === 'string') roomOnAnswer(m);
  else if (m.k === 'full' && roomNet.role === 'finding') roomFail('Room ' + roomNet.code + ' is full');
}

/* ---------------- ICE ---------------- */
function roomConfig() {
  const c = window.BC_NET_CONFIG;
  return c && typeof c === 'object' ? c : {};
}

let roomTurnCache = { at: -Infinity, servers: [] };
async function roomIceServers() {
  if (performance.now() - roomTurnCache.at < 20 * 60 * 1000) return ROOM_STUN.concat(roomTurnCache.servers);
  const cfg = roomConfig();
  let servers = Array.isArray(cfg.turn) ? cfg.turn.filter((s) => s && s.urls) : [];
  const m = cfg.metered;
  if (m && typeof m.domain === 'string' && typeof m.apiKey === 'string' && /^[\w.-]+$/.test(m.domain)) {
    try {
      const res = await fetch('https://' + m.domain + '/api/v1/turn/credentials?apiKey=' + encodeURIComponent(m.apiKey));
      if (res.ok) servers = servers.concat(await res.json());
    } catch (e) { /* TURN is optional */ }
  }
  roomTurnCache = { at: performance.now(), servers };
  return ROOM_STUN.concat(servers);
}

function roomUrlFlag(name) {
  try { return new URLSearchParams(location.search).get(name) === '1'; } catch (e) { return false; }
}

function roomGathered(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); clearTimeout(timer); resolve(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, ROOM_GATHER_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

/* ---------------- links ---------------- */
function roomLinkNew(id, pc) {
  const link = { id, pc, dc: null, fast: null, open: false, startedAt: performance.now(), rxAt: performance.now(),
    route: '', offerSdp: '', answerSdp: '', timers: [] };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') roomLinkLost(link);
  };
  roomNet.links.set(id, link);
  return link;
}

function roomWire(link, dc) {
  link.dc = dc;
  dc.onopen = () => {
    if (roomNet.links.get(link.id) !== link) return;
    link.open = true;
    link.rxAt = performance.now();
    roomReadRoute(link);
    if (roomNet.role === 'host') netHostLinkUp(link.id);
    else {
      roomNet.role = 'player';
      roomNet.attempts = 0;
      roomNet.nextTryAt = 0;
      roomNet.hostLeft = false;
      roomNet.failure = '';
      netPlayerLinkUp(link.id);
    }
  };
  dc.onclose = () => roomLinkLost(link);
  dc.onmessage = (e) => {
    if (typeof e.data !== 'string' || e.data.length > NET_MAX_FRAME) return;
    link.rxAt = performance.now();
    roomInbound(link.id, e.data);
  };
}

function roomWireFast(link, dc) {
  link.fast = dc;
  dc.onmessage = (e) => {
    if (typeof e.data !== 'string' || e.data.length > NET_MAX_FRAME) return;
    link.rxAt = performance.now();
    roomInbound(link.id, e.data);
  };
}

function roomLinkClose(link) {
  if (roomNet.links.get(link.id) === link) roomNet.links.delete(link.id);
  link.timers.forEach(clearTimeout);
  link.open = false;
  try { if (link.dc) { link.dc.onclose = null; link.dc.close(); } } catch (e) { /* closed */ }
  try { if (link.fast) link.fast.close(); } catch (e) { /* closed */ }
  link.pc.onconnectionstatechange = null;
  setTimeout(() => { try { link.pc.close(); } catch (e) { /* closed */ } }, 100); // lets a final 'leave' out
}

function roomLinkLost(link) {
  if (roomNet.links.get(link.id) !== link) return;
  const wasOpen = link.open;
  roomLinkClose(link);
  if (roomNet.role === 'host') { if (wasOpen) netHostLinkDown(link.id); return; }
  if (wasOpen) {
    roomNet.role = 'reconnecting';
    roomNet.downAt = performance.now();
    roomNet.lastHostId = link.id;
    roomNet.attempts = 0;
    roomNet.nextTryAt = 0;
    roomNet.deadline = roomNet.downAt + ROOM_GIVE_UP_MS;
    roomProbeBrokers();
    netPlayerLinkDown();
  }
}

async function roomReadRoute(link) {
  try {
    const stats = await link.pc.getStats();
    let pair = null;
    stats.forEach((s) => { if (s.type === 'transport' && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId); });
    const a = pair && stats.get(pair.localCandidateId), b = pair && stats.get(pair.remoteCandidateId);
    link.route = (a && a.candidateType === 'relay') || (b && b.candidateType === 'relay') ? 'turn' : 'direct';
  } catch (e) { link.route = 'direct'; }
  netEmitStatus();
}

function roomTryConnect(id) {
  const now = performance.now();
  if (now < roomNet.nextTryAt) return;
  roomNet.nextTryAt = now + roomBackoff(roomNet.attempts, 8000);
  roomConnect(id);
}

// Player: offer a link to the host, re-sending until answered. The first
// attempt takes the best path; retries force TURN.
async function roomConnect(hostId) {
  const session = roomNet.session;
  roomNet.hostId = hostId;
  roomNet.attempts++;
  const iceServers = await roomIceServers();
  const hasTurn = iceServers.some((s) => [].concat(s.urls).some((u) => /^turns?:/.test(u)));
  const relay = hasTurn && !roomUrlFlag('direct') && (roomUrlFlag('relay') || roomNet.attempts > 1);
  const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: relay ? 'relay' : 'all' });
  if (session !== roomNet.session || roomNet.links.has(hostId)) { pc.close(); return; }
  const link = roomLinkNew(hostId, pc);
  roomWire(link, pc.createDataChannel('game', { ordered: true }));
  roomWireFast(link, pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 }));
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await roomGathered(pc);
  } catch (e) { roomLinkClose(link); return; }
  const send = () => {
    if (roomNet.links.get(hostId) !== link || pc.signalingState !== 'have-local-offer') return;
    roomSignal({ k: 'offer', to: hostId, sdp: pc.localDescription.sdp, relay });
    link.timers.push(setTimeout(send, ROOM_RESEND_MS));
  };
  send();
}

async function roomOnOffer(m) {
  if (roomNet.role !== 'host') return;
  let link = roomNet.links.get(m.from);
  if (link && link.offerSdp === m.sdp) {
    if (link.answerSdp) roomSignal({ k: 'answer', to: m.from, sdp: link.answerSdp });
    return;
  }
  if (link) roomLinkClose(link);
  if (roomNet.links.size >= NET_MAX_PEERS - 1) { roomSignal({ k: 'full', to: m.from }); return; }
  const pc = new RTCPeerConnection({ iceServers: ROOM_STUN.concat(roomTurnCache.servers), iceTransportPolicy: m.relay === true ? 'relay' : 'all' });
  link = roomLinkNew(m.from, pc);
  link.offerSdp = m.sdp;
  pc.ondatachannel = (e) => {
    if (e.channel.label === 'game') roomWire(link, e.channel);
    else if (e.channel.label === 'fast') roomWireFast(link, e.channel);
  };
  try {
    await pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await roomGathered(pc);
  } catch (e) { roomLinkClose(link); return; }
  link.answerSdp = pc.localDescription.sdp;
  const send = () => { if (roomNet.links.get(m.from) === link && !link.open) roomSignal({ k: 'answer', to: m.from, sdp: link.answerSdp }); };
  send();
  link.timers.push(setTimeout(send, 1000), setTimeout(send, 3000));
}

function roomOnAnswer(m) {
  const link = roomNet.links.get(m.from);
  if (!link || m.from !== roomNet.hostId || link.pc.signalingState !== 'have-local-offer') return;
  link.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp }).catch(() => roomLinkClose(link));
}

function roomOnWho() {
  const now = performance.now();
  if (roomNet.role !== 'host' || now - roomNet.whoReplyAt < 300) return;
  roomNet.whoReplyAt = now;
  roomBeacon();
}

function roomOpenLinks() {
  let count = 0;
  for (const link of roomNet.links.values()) if (link.open) count++;
  return count;
}

function roomOnBeacon(m) {
  roomNet.whoCount = 0;
  if (roomNet.role === 'host') {
    // Two hosts: the room with more players stays, and a tie goes to the lower id.
    const mine = roomOpenLinks(), theirs = Number.isSafeInteger(m.n) ? m.n : 0;
    if (theirs > mine || (theirs === mine && m.from < net.id)) roomYieldTo(m.from);
    return;
  }
  if (m.v !== ROOM_PROTOCOL) {
    if (roomNet.role === 'finding') roomFail('This room runs a different version. Refresh the page.');
    return;
  }
  if (roomNet.hostId !== m.from) { roomNet.attempts = 0; roomNet.nextTryAt = 0; } // a new host starts clean
  roomNet.hostId = m.from;
  roomNet.beaconAt = performance.now();
  if (roomNet.role === 'failed') return;
  if (!roomNet.links.has(m.from)) {
    for (const link of [...roomNet.links.values()]) if (link.id !== m.from) roomLinkClose(link);
    roomTryConnect(m.from);
  }
}

function roomYieldTo(id) {
  roomStopBeacon();
  for (const link of [...roomNet.links.values()]) roomLinkClose(link);
  roomNet.role = 'reconnecting';
  roomNet.downAt = roomNet.beaconAt = performance.now();
  roomNet.deadline = roomNet.downAt + ROOM_GIVE_UP_MS;
  roomNet.hostId = id;
  roomNet.attempts = 0;
  roomNet.nextTryAt = 0;
  netPlayerLinkDown();
  roomTryConnect(id);
}

/* ---------------- host role ---------------- */
function roomBeacon() {
  roomSignal({ k: 'beacon', v: ROOM_PROTOCOL, n: roomOpenLinks() });
}

function roomStartBeacon() {
  roomStopBeacon();
  roomBeacon();
  roomNet.beaconTimer = setInterval(roomBeacon, ROOM_BEACON_MS);
}
function roomStopBeacon() { clearInterval(roomNet.beaconTimer); roomNet.beaconTimer = null; }

function roomBecomeHost() {
  for (const link of [...roomNet.links.values()]) roomLinkClose(link);
  roomNet.role = 'host';
  roomNet.hostId = net.id;
  roomNet.failure = '';
  roomIceServers();
  roomStartBeacon();
  netHostStart();
}

/* ---------------- sending and receiving game traffic ---------------- */
function roomLinkSend(link, text, fast) {
  if (!link || !link.open || !link.dc || link.dc.readyState !== 'open') return false;
  const dc = fast && link.fast && link.fast.readyState === 'open' && text.length <= ROOM_FAST_MAX ? link.fast : link.dc;
  try { dc.send(text); return true; } catch (e) { return false; }
}

// Only what the next packet replaces anyway may go unreliable.
function roomIsFast(msg) {
  return msg.t === 'state' || msg.t === 'ping' || msg.t === 'pong' || (msg.t === 'authority' && msg.packet.t === 'states');
}

// Host: to one player, or everyone. Player: always to the host.
function roomSend(msg) {
  const text = JSON.stringify(msg), fast = roomIsFast(msg);
  if (roomNet.role !== 'host') return roomLinkSend(roomNet.links.get(roomNet.hostId), text, fast);
  if (msg.to) return roomLinkSend(roomNet.links.get(msg.to), text, fast) || true;
  for (const link of roomNet.links.values()) roomLinkSend(link, text, fast);
  return true;
}

function roomReady() {
  if (roomNet.role === 'host') return true;
  const link = roomNet.links.get(roomNet.hostId);
  return roomNet.role === 'player' && !!link && link.open;
}

function roomBuffered() {
  for (const link of roomNet.links.values()) if (link.dc && link.dc.readyState === 'open' && link.dc.bufferedAmount > ROOM_MAX_BUFFER) return true;
  return false;
}

/* ---------------- room lifecycle ---------------- */
function roomFail(reason) {
  for (const link of [...roomNet.links.values()]) roomLinkClose(link);
  roomNet.role = 'failed';
  roomNet.failure = reason;
  netEmitStatus();
}

function roomRetry() {
  const now = performance.now();
  if (roomNet.role === 'failed') roomNet.role = net.online ? 'reconnecting' : 'finding';
  roomNet.failure = '';
  roomNet.attempts = 0;
  roomNet.nextTryAt = 0;
  roomNet.downAt = now;
  roomNet.deadline = now + ROOM_GIVE_UP_MS;
  roomNet.whoCount = 0;
  roomProbeBrokers();
}

function roomNotify(text) {
  roomNet.notice = text;
  roomNet.noticeUntil = performance.now() + 2500;
}

// What the player should be told right now, or null when all is well.
function roomStatus() {
  const now = performance.now(), role = roomNet.role, tries = roomNet.attempts;
  if (!role) return null;
  if (roomNet.failure) return { tone: 'bad', title: roomNet.failure, detail: role === 'failed' ? '' : 'Still trying…', actions: true };
  if (navigator.onLine === false && role !== 'host') return { tone: 'bad', title: 'You are offline', detail: 'Waiting for your network…' };
  if (role === 'finding') {
    if (!roomNet.findAt) return { tone: 'busy', title: 'Connecting', detail: 'Reaching the room servers…' };
    if (!roomNet.hostId) return { tone: 'busy', title: 'Looking for room ' + roomNet.code, detail: '' };
    return { tone: 'busy', title: 'Connecting to the host', detail: tries > 1 ? 'Try ' + tries + ', using the relay' : '' };
  }
  if (role === 'reconnecting') {
    const secs = Math.round((now - roomNet.downAt) / 1000);
    if (roomNet.hostLeft || roomNet.whoCount >= ROOM_WHO_GONE) {
      return { tone: 'busy', title: 'Host left', detail: 'Finding a new host… ' + secs + 's' };
    }
    return { tone: 'busy', title: 'Connection lost', detail: 'Reconnecting… ' + secs + 's' + (tries > 1 ? ', try ' + tries : '') };
  }
  if (role === 'player' && !net.authorityReady) return { tone: 'busy', title: 'Syncing the match', detail: '' };
  if (role === 'player') {
    const link = roomNet.links.get(roomNet.hostId), quiet = link ? now - link.rxAt : 0;
    if (quiet > ROOM_STALL_NOTICE_MS) return { tone: 'busy', title: 'Waiting for the host', detail: Math.round(quiet / 1000) + 's' };
  }
  if (now < roomNet.noticeUntil) return { tone: 'good', title: roomNet.notice, detail: '' };
  if (role === 'host') {
    const open = [...roomNet.links.values()].some((l) => l.open);
    if (!open && roomNet.noSignalAt && now - roomNet.noSignalAt > ROOM_NO_BROKER_MS) {
      return { tone: 'bad', title: 'Friends can\'t join yet', detail: 'Can\'t reach the room servers, still trying' };
    }
  }
  if (roomNet.badPingSince && now - roomNet.badPingSince > 4000) return { tone: 'bad', title: 'Unstable connection', detail: 'High ping to the host' };
  return null;
}

function roomWatchQuality(now) {
  const ping = BC.api.net && BC.api.net.getPing ? BC.api.net.getPing() : NaN;
  const bad = roomNet.role === 'player' && (!Number.isFinite(ping) || ping > 250);
  if (!bad) roomNet.badPingSince = 0;
  else if (!roomNet.badPingSince) roomNet.badPingSince = now;
}

function roomTick() {
  const now = performance.now(), role = roomNet.role;
  if (!role) return;
  roomWatchQuality(now);
  if (roomSignalReady()) roomNet.noSignalAt = 0;
  else if (!roomNet.noSignalAt) roomNet.noSignalAt = now;
  for (const b of roomNet.brokers) {
    if (b.probeAt && now - b.probeAt > 3000) { b.probeAt = 0; try { b.ws.close(); } catch (e) { /* closed */ } }
  }
  if (role === 'failed') return;
  // Ask who hosts while there is no working link and no recent beacon.
  const looking = role === 'finding' ? !roomNet.hostId : role === 'reconnecting' && now - roomNet.beaconAt >= ROOM_BEACON_MS * 2;
  if (looking && roomSignalReady() && now - roomNet.whoAt >= ROOM_WHO_MS) {
    roomNet.whoAt = now;
    roomNet.whoCount++;
    roomSignal({ k: 'who' });
  }
  // Waiting on our own network: nothing can work, so nothing is decided or timed.
  if (navigator.onLine === false && role !== 'host') {
    roomNet.downAt = now;
    roomNet.deadline = now + ROOM_GIVE_UP_MS;
    return;
  }
  if (now - roomNet.tickAt > 2000) for (const link of roomNet.links.values()) link.rxAt = now;
  roomNet.tickAt = now;
  for (const link of [...roomNet.links.values()]) {
    const quiet = now - link.rxAt;
    if (link.open && (quiet > ROOM_STALL_MS || (quiet > ROOM_SILENCE_MS && link.pc.connectionState !== 'connected'))) roomLinkLost(link);
    else if (!link.open && now - link.startedAt > ROOM_LINK_TIMEOUT_MS) roomLinkClose(link);
  }
  if (role === 'finding') {
    if (roomNet.hostId && !roomNet.links.size && now - roomNet.beaconAt > ROOM_BEACON_MS * 3) {
      roomNet.hostId = '';            // that host went away before we linked
      roomNet.findAt = now;
    }
    if (!roomNet.hostId && roomNet.whoCount >= ROOM_WHO_EMPTY) { roomBecomeHost(); roomNotify('Room was empty, you are hosting it'); return; }
    if (now > roomNet.deadline && !roomNet.failure) roomNet.failure = roomNet.findAt ? 'Can\'t reach the host of room ' + roomNet.code : 'Can\'t reach the room servers';
  } else if (role === 'reconnecting') {
    const quiet = now - roomNet.downAt;
    if (roomNet.hostId && now - roomNet.beaconAt < ROOM_BEACON_MS * 2) {
      if (!roomNet.links.size) roomTryConnect(roomNet.hostId);
      if (now > roomNet.deadline && !roomNet.failure) roomNet.failure = 'Can\'t get back to the host';
      return;
    }
    const ids = [...net.authPlayers.keys()].filter((id) => id !== roomNet.lastHostId).sort();
    // Only with a working broker, and after long enough on it to have heard a beacon.
    const heard = roomSignalReady() && now - roomNet.signalUpAt > ROOM_BEACON_MS * 2 &&
      (roomNet.hostLeft || roomNet.whoCount >= ROOM_WHO_GONE);
    const rank = ids.indexOf(net.id);
    const turn = ROOM_TAKEOVER_MS + (rank < 0 ? ids.length : rank) * ROOM_TAKEOVER_STEP_MS;
    if (heard && quiet > turn) roomBecomeHost();
    else if (now > roomNet.deadline && !roomNet.failure) roomNet.failure = 'Lost the connection to the room';
  } else if (role === 'player' && !roomNet.links.has(roomNet.hostId)) {
    roomNet.role = 'reconnecting';
    roomNet.downAt = now;
    roomNet.lastHostId = roomNet.hostId;
  }
}

function roomStart(code, create) {
  roomStop();
  roomNet.code = code;
  roomNet.session++;
  roomNet.attempts = 0;
  roomNet.findAt = 0;
  roomNet.hostId = '';
  roomNet.role = 'finding';
  roomNet.failure = '';
  roomNet.nextTryAt = 0;
  roomNet.noticeUntil = 0;
  roomNet.signalUpAt = roomNet.noSignalAt = roomNet.badPingSince = 0;
  roomNet.hostLeft = false;
  roomNet.whoCount = roomNet.whoAt = 0;
  roomNet.deadline = performance.now() + ROOM_NO_BROKER_MS;
  roomNet.seen.clear();
  for (const url of ROOM_BROKERS) roomBrokerOpen(url, roomNet.session);
  roomNet.timer = setInterval(roomTick, 500);
  if (create) roomBecomeHost();
}

function roomStop() {
  roomNet.session++;
  clearInterval(roomNet.timer);
  roomStopBeacon();
  for (const link of [...roomNet.links.values()]) roomLinkClose(link);
  for (const b of roomNet.brokers) { b.ready = false; clearInterval(b.ping); try { b.ws.close(); } catch (e) { /* closed */ } }
  roomNet.brokers.length = 0;
  roomNet.role = '';
  roomNet.hostId = '';
}

function roomRouteName() {
  if (roomNet.role === 'host') {
    const open = [...roomNet.links.values()].filter((l) => l.open);
    return !open.length ? '' : open.some((l) => l.route === 'direct') ? 'direct' : 'turn';
  }
  const link = roomNet.links.get(roomNet.hostId);
  return link && link.open ? link.route || 'direct' : '';
}

// Back online: don't wait out the backoff, and check the old sockets still work.
window.addEventListener('online', () => {
  if (!roomNet.role) return;
  roomNet.nextTryAt = 0;
  for (const b of roomNet.brokers) b.fails = 0;
  roomProbeBrokers();
  if (roomNet.role === 'failed') roomRetry();
});

// Returning to the tab (phones suspend pages): act now instead of on the next timer.
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !roomNet.role) return;
  roomNet.nextTryAt = 0;
  roomProbeBrokers();
});

BC.api.rtc = {
  get route() { return roomRouteName(); },
  get links() { return [...roomNet.links.values()].filter((l) => l.open).length; },
  get role() { return roomNet.role; }
};
