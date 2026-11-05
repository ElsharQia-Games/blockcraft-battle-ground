/* Blockcraft Battle Ground — direct links for internet rooms.
   91-rtc.js (after 90-net.js, whose MQTT publish/dispatch it plugs into)

   Transport ladder:
     1. TURN     — the default when a relay is configured: a WebRTC data
                   channel through the TURN relay (UDP, then TCP and TLS on
                   443), which connects reliably on every network
     2. direct   — peer-to-peer instead, opt-in with ?direct=1 (or the default
                   when no relay is configured)
     3. broker   — the public MQTT broker that rooms already use to meet
   Each player links to the room host (a star: the host is the authority).
   The broker always carries discovery and signalling (one offer and one
   answer per link on blockcraft/<room>/rtc/<id>, candidates bundled in the
   SDP, offers re-sent until answered) and takes over automatically whenever
   no link is open, so a room never breaks.

   TURN servers are not free any more, so they come from net-config.js:
   static servers, or a Metered app whose API mints short-lived credentials
   per session (no long-lived secret in the page). With no TURN configured
   the ladder is direct, then broker.

   Safety: a data-channel message is dispatched as if it arrived on
   blockcraft/<room>/msg/<peer id>, where the id is the peer this connection
   was negotiated with, never a field inside the message. It then passes the
   same validation, budgets, sequencing and authority dedupe as broker traffic.
   One reliable, ordered channel carries everything: hits, deaths and edits
   must not be lost or reordered behind newer state. */
'use strict';

const RTC_STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
const RTC_OPEN_TIMEOUT_MS = 15000;     // gathering + resends + TURN over TCP
const RTC_RETRY_MS = [2000, 5000, 10000, 20000];
const RTC_RESTART_AFTER_MS = 2500;     // 'disconnected' this long -> ICE restart
const RTC_MAX_BUFFER = 256 * 1024;
const RTC_MAX_SIGNAL = 48000;
const RTC_GATHER_MS = 2500;            // wait this long for candidates before signalling
const RTC_RESEND_MS = 3000;            // re-send an unanswered offer this often
const RTC_TURN_TTL_MS = 20 * 60 * 1000;

const rtc = {
  supported: typeof RTCPeerConnection === 'function',
  peers: new Map(),      // peer id -> { id, pc, dc, open, startedAt, pending, remoteSet, offerer, route }
  attempts: new Map(),   // host id -> { count, at } (clients)
  room: '', host: '',
  turn: { servers: [], at: -Infinity, loading: null }
};

/* ---------------- ICE servers (STUN + optional TURN) ---------------- */
function rtcConfig() {
  const c = typeof window !== 'undefined' && window.BC_NET_CONFIG;
  return c && typeof c === 'object' ? c : {};
}

function rtcCleanServers(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((s) => s && (typeof s.urls === 'string' || Array.isArray(s.urls))).map((s) => ({
    urls: s.urls, username: typeof s.username === 'string' ? s.username : undefined,
    credential: typeof s.credential === 'string' ? s.credential : undefined
  }));
}

async function rtcTurnServers() {
  const t = rtc.turn, cfg = rtcConfig();
  if (performance.now() - t.at < RTC_TURN_TTL_MS) return t.servers;
  if (t.loading) return t.loading;
  t.loading = (async () => {
    let servers = rtcCleanServers(cfg.turn);
    const m = cfg.metered;
    if (m && typeof m.domain === 'string' && typeof m.apiKey === 'string' && /^[\w.-]+$/.test(m.domain)) {
      try {
        const res = await fetch('https://' + m.domain + '/api/v1/turn/credentials?apiKey=' + encodeURIComponent(m.apiKey));
        if (res.ok) servers = servers.concat(rtcCleanServers(await res.json()));
      } catch (e) { /* TURN is optional; direct and broker still work */ }
    }
    t.servers = servers;
    t.at = performance.now();
    t.loading = null;
    return servers;
  })();
  return t.loading;
}

async function rtcIceServers() {
  return RTC_STUN.concat(await rtcTurnServers());
}

/* ---------------- links ---------------- */
function rtcActive() {
  return rtc.supported && typeof net !== 'undefined' && net.mode === 'mqtt' && net.online && !!net.id && !!net.room;
}

function rtcSignal(to, data) {
  // The rtc topic is never routed back into a data channel (see rtcRoute).
  mqttPublish('blockcraft/' + net.room + '/rtc/' + net.id, JSON.stringify({ ...data, to }), false);
}

function rtcClose(id, reason) {
  const peer = rtc.peers.get(id);
  if (!peer) return;
  rtc.peers.delete(id);
  clearTimeout(peer.restartTimer);
  clearTimeout(peer.resendTimer);
  try { if (peer.dc) peer.dc.close(); } catch (e) { /* closed */ }
  try { peer.pc.close(); } catch (e) { /* closed */ }
  peer.open = false;
  if (reason) netEmitStatus();
}

function rtcCloseAll() { for (const id of [...rtc.peers.keys()]) rtcClose(id); }

function rtcWireChannel(peer, dc) {
  peer.dc = dc;
  dc.onopen = () => {
    peer.open = true;
    rtc.attempts.delete(peer.id);
    rtcReadRoute(peer);
    netEmitStatus();
  };
  dc.onclose = () => { peer.open = false; rtcClose(peer.id, 'closed'); };
  dc.onerror = () => { peer.open = false; };
  dc.onmessage = (e) => {
    if (typeof e.data !== 'string' || e.data.length > NET_MAX_FRAME || !rtcActive()) return;
    mqttDispatch('blockcraft/' + net.room + '/msg/' + peer.id, e.data, e.data.length);
  };
}

// Was the chosen path direct or through a TURN relay? (For the HUD.)
async function rtcReadRoute(peer) {
  try {
    const stats = await peer.pc.getStats();
    let pair = null;
    stats.forEach((s) => { if (s.type === 'transport' && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId); });
    if (!pair) stats.forEach((s) => { if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') pair = s; });
    const local = pair && stats.get(pair.localCandidateId), remote = pair && stats.get(pair.remoteCandidateId);
    peer.route = (local && local.candidateType === 'relay') || (remote && remote.candidateType === 'relay') ? 'turn' : 'direct';
  } catch (e) { peer.route = 'direct'; }
}

async function rtcNewPeer(id, offerer) {
  // TURN is the default whenever a relay is configured: it connects reliably
  // on every network. ?direct=1 opts into peer-to-peer; ?relay=1 forces TURN.
  const servers = await rtcTurnServers();
  let forceRelay = servers.some((sv) => [].concat(sv.urls).some((u) => /^turns?:/.test(u)));
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('direct') === '1') forceRelay = false;
    if (q.get('relay') === '1') forceRelay = true;
  } catch (e) { /* optional */ }
  const pc = new RTCPeerConnection({ iceServers: await rtcIceServers(), iceTransportPolicy: forceRelay ? 'relay' : 'all' });
  const peer = { id, pc, dc: null, open: false, startedAt: performance.now(), pending: [], remoteSet: false,
    offerer, route: '', restartTimer: 0, restarts: 0 };
  // Candidates travel inside the offer/answer SDP (see rtcGathered): the
  // public broker drops bursts of small messages, which lost whole links.
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === 'connected') { clearTimeout(peer.restartTimer); peer.restarts = 0; rtcReadRoute(peer); }
    else if (state === 'disconnected') {
      // A brief Wi-Fi/mobile blip: renegotiate the path instead of dropping the link.
      clearTimeout(peer.restartTimer);
      peer.restartTimer = setTimeout(() => rtcRestart(peer), RTC_RESTART_AFTER_MS);
    } else if (state === 'failed') {
      if (peer.offerer && peer.restarts < 2) rtcRestart(peer);
      else rtcClose(id, 'failed');
    } else if (state === 'closed') rtcClose(id, 'closed');
  };
  rtc.peers.set(id, peer);
  return peer;
}

// Resolve once ICE gathering completes, or after RTC_GATHER_MS with whatever
// was gathered (TURN over TCP can be slow); the SDP then carries the candidates.
function rtcGathered(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); clearTimeout(timer); resolve(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, RTC_GATHER_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

// Player side: keep re-sending the offer until the host answers, since a
// single broker message can be lost.
function rtcSendOffer(peer, restart) {
  const send = () => {
    if (!rtc.peers.has(peer.id) || peer.pc.signalingState !== 'have-local-offer') return;
    rtcSignal(peer.id, { type: 'offer', restart: !!restart, sdp: peer.pc.localDescription.sdp });
    peer.resendTimer = setTimeout(send, RTC_RESEND_MS);
  };
  clearTimeout(peer.resendTimer);
  send();
}

async function rtcRestart(peer) {
  if (!rtc.peers.has(peer.id) || peer.pc.connectionState === 'connected') return;
  if (!peer.offerer) return; // the host waits for the player's restart offer
  peer.restarts++;
  try {
    peer.pc.setConfiguration({ iceServers: await rtcIceServers() });
    const offer = await peer.pc.createOffer({ iceRestart: true });
    await peer.pc.setLocalDescription(offer);
    await rtcGathered(peer.pc);
    rtcSendOffer(peer, true);
  } catch (e) { rtcClose(peer.id, 'failed'); }
}

async function rtcSetRemote(peer, description) {
  await peer.pc.setRemoteDescription(description);
  peer.remoteSet = true;
  for (const c of peer.pending.splice(0)) { try { await peer.pc.addIceCandidate(c); } catch (e) { /* stale */ } }
}

// Player side: offer a link to the current host.
async function rtcOffer(hostId) {
  const a = rtc.attempts.get(hostId) || { count: 0, at: 0 };
  a.count++; a.at = performance.now();
  rtc.attempts.set(hostId, a);
  let peer;
  try {
    peer = await rtcNewPeer(hostId, true);
    rtcWireChannel(peer, peer.pc.createDataChannel('bc', { ordered: true }));
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    await rtcGathered(peer.pc);
    rtcSendOffer(peer, false);
  } catch (e) { rtcClose(hostId); }
}

// Every signal arrives through the broker on blockcraft/<room>/rtc/<from>.
async function rtcOnSignal(from, payload) {
  if (!rtcActive() || typeof payload !== 'string' || payload.length > RTC_MAX_SIGNAL) return;
  let msg;
  try { msg = JSON.parse(payload); } catch (e) { return; }
  if (!msg || msg.to !== net.id) return;
  const amHost = net.hostId === net.id && net.authorityReady;
  try {
    if (msg.type === 'offer' && typeof msg.sdp === 'string') {
      // Only the host accepts links, only from players actually in the room.
      if (!amHost || !mqtt.presence.has(from)) return;
      let peer = rtc.peers.get(from);
      if (peer && peer.offerSdp === msg.sdp && peer.answerSdp) {
        rtcSignal(from, { type: 'answer', sdp: peer.answerSdp }); // our answer was lost: repeat it
        return;
      }
      if (!(msg.restart && peer)) {
        if (!peer && rtc.peers.size >= NET_MAX_PEERS) return;
        rtcClose(from);
        peer = await rtcNewPeer(from, false);
        peer.pc.ondatachannel = (e) => { if (e.channel.label === 'bc') rtcWireChannel(peer, e.channel); };
      }
      await rtcSetRemote(peer, { type: 'offer', sdp: msg.sdp });
      peer.offerSdp = msg.sdp;
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      await rtcGathered(peer.pc);
      peer.answerSdp = peer.pc.localDescription.sdp;
      rtcSignal(from, { type: 'answer', sdp: peer.answerSdp });
    } else if (msg.type === 'answer' && typeof msg.sdp === 'string') {
      const peer = rtc.peers.get(from);
      if (peer && peer.offerer && from === net.hostId && peer.pc.signalingState === 'have-local-offer') {
        clearTimeout(peer.resendTimer);
        await rtcSetRemote(peer, { type: 'answer', sdp: msg.sdp });
      }
    } else if (msg.type === 'ice' && msg.candidate && typeof msg.candidate === 'object') {
      const peer = rtc.peers.get(from);
      if (!peer) return;
      if (peer.remoteSet) await peer.pc.addIceCandidate(msg.candidate);
      else if (peer.pending.length < 64) peer.pending.push(msg.candidate);
    }
  } catch (e) { rtcClose(from); }
}

/* ---------------- routing ---------------- */
// Called by mqttPublish for every non-retained publish. Returns true when the
// broker copy can be skipped.
function rtcRoute(topic, payload) {
  if (!rtcActive() || rtc.peers.size === 0) return false;
  const parts = topic.split('/');
  if (parts.length !== 4 || parts[2] !== 'msg' || parts[3] !== net.id) return false;
  if (payload.charCodeAt(0) !== 123 || payload.startsWith('{"t":"leave"')) return false; // leaves always use the broker
  const send = (peer) => {
    if (!peer || !peer.open || !peer.dc || peer.dc.readyState !== 'open' || peer.dc.bufferedAmount > RTC_MAX_BUFFER) return false;
    try { peer.dc.send(payload); return true; } catch (e) { return false; }
  };
  if (net.hostId !== net.id) return send(rtc.peers.get(net.hostId));
  // Host: fan out to every link; skip the broker only when every player in
  // the room has one (the others still need the broker copy).
  let all = true;
  for (const id of mqtt.presence.keys()) {
    if (id === net.id) continue;
    if (!send(rtc.peers.get(id))) all = false;
  }
  return all;
}

function rtcTick() {
  if (!rtcActive()) { if (rtc.peers.size) rtcCloseAll(); rtc.room = rtc.host = ''; rtc.attempts.clear(); return; }
  if (rtc.room !== net.room || rtc.host !== net.hostId) {
    rtcCloseAll();
    rtc.attempts.clear();
    rtc.room = net.room; rtc.host = net.hostId || '';
    rtcTurnServers(); // warm the TURN credentials before the first offer
  }
  const now = performance.now();
  for (const peer of [...rtc.peers.values()]) {
    if (!peer.open && now - peer.startedAt > RTC_OPEN_TIMEOUT_MS && peer.pc.connectionState !== 'connected') rtcClose(peer.id);
    else if (net.hostId === net.id && !mqtt.presence.has(peer.id)) rtcClose(peer.id);
  }
  const host = net.hostId;
  if (!net.authorityReady || !host || host === net.id || !mqtt.presence.has(host) || rtc.peers.has(host)) return;
  const a = rtc.attempts.get(host);
  const wait = a ? RTC_RETRY_MS[Math.min(RTC_RETRY_MS.length - 1, a.count - 1)] : 0;
  if (!a || now - a.at > wait) rtcOffer(host);
}

function rtcOpenPeers() {
  const out = [];
  for (const peer of rtc.peers.values()) if (peer.open) out.push(peer);
  return out;
}

// 'direct', 'turn' or 'broker' for this player's link to the host (the host
// reports its best link).
function rtcRouteName() {
  if (!rtcActive()) return '';
  if (net.hostId === net.id) {
    const open = rtcOpenPeers();
    return !open.length ? 'broker' : open.some((p) => p.route === 'direct') ? 'direct' : 'turn';
  }
  const peer = rtc.peers.get(net.hostId);
  return peer && peer.open ? peer.route || 'direct' : 'broker';
}

setInterval(rtcTick, 1000);

BC.api.rtc = {
  get supported() { return rtc.supported; },
  get direct() { const r = rtcRouteName(); return r === 'direct' || r === 'turn'; },
  get route() { return rtcRouteName(); },
  get links() { return rtcOpenPeers().length; },
  get turnConfigured() { const c = rtcConfig(); return !!((c.turn && c.turn.length) || (c.metered && c.metered.apiKey)); },
  close: rtcCloseAll
};
