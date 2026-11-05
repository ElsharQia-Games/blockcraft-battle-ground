/* Blockcraft Battle Ground — direct peer-to-peer links for internet rooms.
   91-rtc.js (after 90-net.js, whose MQTT publish/dispatch it plugs into)

   Internet rooms relay every packet through a public MQTT broker, which can be
   on another continent: client -> broker -> host -> broker -> client. This
   module opens a WebRTC data channel between each player and the room host
   (a star, because the host is the authority) and sends room traffic over it.
   The broker keeps doing discovery, signalling (offers/answers/ICE on
   blockcraft/<room>/rtc/<id>) and is the fallback whenever a direct link is
   not open, so nothing breaks behind strict NATs (no TURN server).

   Safety: a data-channel message is dispatched as if it arrived on
   blockcraft/<room>/msg/<peer id>, where the id is the peer this connection
   was negotiated with, never a field inside the message. It then passes the
   same validation, budgets, sequencing and authority dedupe as broker traffic.
   One reliable, ordered channel carries everything: hits, deaths and edits
   must not be lost or reordered behind newer state. */
'use strict';

const RTC_ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
const RTC_OPEN_TIMEOUT_MS = 9000;
const RTC_RETRY_MS = 15000;
const RTC_MAX_BUFFER = 256 * 1024;
const RTC_MAX_SIGNAL = 24000;

const rtc = {
  supported: typeof RTCPeerConnection === 'function',
  peers: new Map(),      // peer id -> { id, pc, dc, open, startedAt, pending: [], remoteSet }
  lastTry: new Map(),    // host id -> last offer time (clients)
  room: '', host: ''
};

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
  try { if (peer.dc) peer.dc.close(); } catch (e) { /* closed */ }
  try { peer.pc.close(); } catch (e) { /* closed */ }
  peer.open = false;
  if (reason) netEmitStatus();
}

function rtcCloseAll() { for (const id of [...rtc.peers.keys()]) rtcClose(id); }

function rtcWireChannel(peer, dc) {
  peer.dc = dc;
  dc.onopen = () => { peer.open = true; netEmitStatus(); };
  dc.onclose = () => { peer.open = false; rtcClose(peer.id, 'closed'); };
  dc.onerror = () => { peer.open = false; };
  dc.onmessage = (e) => {
    if (typeof e.data !== 'string' || e.data.length > NET_MAX_FRAME || !rtcActive()) return;
    mqttDispatch('blockcraft/' + net.room + '/msg/' + peer.id, e.data, e.data.length);
  };
}

function rtcNewPeer(id) {
  const pc = new RTCPeerConnection({ iceServers: RTC_ICE_SERVERS });
  const peer = { id, pc, dc: null, open: false, startedAt: performance.now(), pending: [], remoteSet: false };
  pc.onicecandidate = (e) => { if (e.candidate) rtcSignal(id, { type: 'ice', candidate: e.candidate.toJSON() }); };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') rtcClose(id, 'failed');
  };
  rtc.peers.set(id, peer);
  return peer;
}

async function rtcSetRemote(peer, description) {
  await peer.pc.setRemoteDescription(description);
  peer.remoteSet = true;
  for (const c of peer.pending.splice(0)) { try { await peer.pc.addIceCandidate(c); } catch (e) { /* stale */ } }
}

// Client side: offer a direct link to the current host.
async function rtcOffer(hostId) {
  rtc.lastTry.set(hostId, performance.now());
  const peer = rtcNewPeer(hostId);
  rtcWireChannel(peer, peer.pc.createDataChannel('bc', { ordered: true }));
  try {
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    rtcSignal(hostId, { type: 'offer', sdp: peer.pc.localDescription.sdp });
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
      if (!amHost || !mqtt.presence.has(from) || rtc.peers.size >= NET_MAX_PEERS) return;
      rtcClose(from);
      const peer = rtcNewPeer(from);
      peer.pc.ondatachannel = (e) => { if (e.channel.label === 'bc') rtcWireChannel(peer, e.channel); };
      await rtcSetRemote(peer, { type: 'offer', sdp: msg.sdp });
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      rtcSignal(from, { type: 'answer', sdp: peer.pc.localDescription.sdp });
    } else if (msg.type === 'answer' && typeof msg.sdp === 'string') {
      const peer = rtc.peers.get(from);
      if (peer && !peer.remoteSet && from === net.hostId) await rtcSetRemote(peer, { type: 'answer', sdp: msg.sdp });
    } else if (msg.type === 'ice' && msg.candidate && typeof msg.candidate === 'object') {
      const peer = rtc.peers.get(from);
      if (!peer) return;
      if (peer.remoteSet) await peer.pc.addIceCandidate(msg.candidate);
      else if (peer.pending.length < 64) peer.pending.push(msg.candidate);
    }
  } catch (e) { rtcClose(from); }
}

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
  // Host: fan out to every direct link; skip the broker only when every
  // player in the room has one (the others still need the broker copy).
  let all = true;
  for (const id of mqtt.presence.keys()) {
    if (id === net.id) continue;
    if (!send(rtc.peers.get(id))) all = false;
  }
  return all;
}

function rtcTick() {
  if (!rtcActive()) { if (rtc.peers.size) rtcCloseAll(); rtc.room = rtc.host = ''; return; }
  if (rtc.room !== net.room || rtc.host !== net.hostId) {
    rtcCloseAll();
    rtc.room = net.room; rtc.host = net.hostId || '';
  }
  const now = performance.now();
  for (const peer of [...rtc.peers.values()]) {
    if (!peer.open && now - peer.startedAt > RTC_OPEN_TIMEOUT_MS) rtcClose(peer.id);
    else if (net.hostId === net.id && !mqtt.presence.has(peer.id)) rtcClose(peer.id);
  }
  const host = net.hostId;
  if (net.authorityReady && host && host !== net.id && mqtt.presence.has(host) && !rtc.peers.has(host) &&
      now - (rtc.lastTry.get(host) || -Infinity) > RTC_RETRY_MS) rtcOffer(host);
}

function rtcDirectCount() {
  let n = 0;
  for (const peer of rtc.peers.values()) if (peer.open) n++;
  return n;
}

setInterval(rtcTick, 1000);

BC.api.rtc = {
  get supported() { return rtc.supported; },
  get direct() { return net.hostId === net.id ? rtcDirectCount() > 0 : !!(rtc.peers.get(net.hostId) || {}).open; },
  get links() { return rtcDirectCount(); },
  close: rtcCloseAll
};
