/* Blockcraft Battle Ground — Network sync watchdog and health API.
   92-sync.js
   Loads after 90-net.js (and before 99-boot.js). It never owns a socket: the
   transports still live in 90-net.js, and this file only observes their state,
   reports health through BC.api.net, and nudges a silent session to re-join. */
'use strict';

(function () {
  if (typeof BC === 'undefined') return;
  BC.api = BC.api || Object.create(null);
  if (BC.api.net && typeof BC.api.net.syncState === 'function') return;

  const STALE_MS = 3500;      // no inbound packet for this long => desync
  const WATCHDOG_MS = 2000;   // how often the watchdog samples the session
  const SEND_MS = 90;         // matches sendNetState's throttle in 90-net.js

  let timer = null;
  let onlineAt = 0;
  let joinSent = false;
  let lastDesync = false;
  let rateAt = 0;
  let rateCount = 0;
  let rateValue = 0;
  let rateSession = -1;

  function N() {
    return typeof net !== 'undefined' && net ? net : null;
  }

  function isOnline() {
    const n = N();
    return !!(n && n.online);
  }

  function transportReady() {
    const n = N();
    if (!n) return false;
    if (typeof netConnectedTransport === 'function') {
      try { return netConnectedTransport(); } catch (e) { /* ignore */ }
    }
    return !!(n.online && n.mode === 'ws' && n.ws && n.ws.readyState === 1);
  }

  function packetCount() {
    const n = N();
    return n && Number.isFinite(n.packetCount) ? n.packetCount : 0;
  }

  function sampleRate() {
    const n = N();
    const now = performance.now();
    if (!n || !n.online) { rateValue = 0; rateAt = 0; return 0; }
    if (rateSession !== n.session) {
      rateSession = n.session;
      rateAt = now;
      rateCount = packetCount();
      rateValue = 0;
    }
    if (!rateAt) { rateAt = now; rateCount = packetCount(); return rateValue; }
    const dt = (now - rateAt) / 1000;
    if (dt < 1) return rateValue;
    const count = packetCount();
    const instant = Math.max(0, (count - rateCount) / dt);
    rateValue = rateValue > 0 ? rateValue + (instant - rateValue) * 0.4 : instant;
    rateAt = now;
    rateCount = count;
    return rateValue;
  }

  function playerTotal() {
    if (typeof netPlayerCount === 'function') {
      try {
        const count = netPlayerCount();
        if (Number.isFinite(count)) return count;
      } catch (e) { /* fall through */ }
    }
    const n = N();
    return n && n.players ? n.players.size + (n.online ? 1 : 0) : 0;
  }

  function statusText() {
    const n = N();
    if (!n || !n.mode) return 'solo';
    const count = playerTotal();
    const base = n.mode === 'mqtt'
      ? 'MQTT' + (n.room ? ' ' + n.room : '')
      : 'LAN';
    const peers = count > 1 ? ' · ' + count + 'P' : '';
    if (!n.online) return base + ' · connecting';
    if (n.configError) return base + peers + ' · sync error';
    if (n.mode === 'mqtt' && !n.authorityReady) return base + peers + ' · agreeing host';
    if (n.configPending || n.localReset) return base + peers + ' · syncing';
    return base + peers + (n.desync ? ' · resync' : n.pingSource === 'broker' ? ' · relay RTT' : '');
  }

  function syncState() {
    const n = N();
    const now = performance.now();
    return {
      online: !!(n && n.online),
      connected: transportReady(),
      mode: n ? n.mode : null,
      room: n ? n.room : '',
      players: playerTotal(),
      ping: getPing(),
      jitter: getJitter(),
      desync: !!(n && n.desync),
      silentMs: n && n.lastRx ? Math.max(0, Math.round(now - n.lastRx)) : null,
      packets: packetCount(),
      packetRate: Math.round(sampleRate() * 10) / 10,
      sendRate: SEND_MS,
      seq: n ? n.seq : 0,
      id: n ? n.id : null,
      localId: n ? n.id : null,
      hostId: n ? n.hostId : null,
      authorityReady: !!(n && n.authorityReady && n.online),
      authority: { id: n ? n.hostId : null, agreed: !!(n && n.authorityReady && n.online) },
      generation: n ? n.generation : 0,
      epoch: n ? n.epoch : '',
      seed: n ? n.seed : null,
      dragonCount: typeof netDragonCount === 'function' ? netDragonCount() : 0,
      catalogCount: n && n.dragonCatalog ? n.dragonCatalog.size : 0,
      matchMode: n ? n.matchMode : null,
      configPending: !!(n && n.configPending),
      configError: !!(n && n.configError),
      canConfigure: typeof netCanConfigure === 'function' ? netCanConfigure() : false,
      pingSource: n ? n.pingSource : '',
      latencyStale: !n || !n.lastPong || now - n.lastPong > 6000,
      queue: n ? n.outbox.length : 0,
      editQueue: n && n.editOut ? n.editOut.size : 0,
      pendingEdits: n && n.pendingEdits ? n.pendingEdits.size : 0
    };
  }

  function getPing() {
    const n = N();
    if (!n || !n.online || !n.lastPong || !Number.isFinite(n.ping) || n.ping < 0 || performance.now() - n.lastPong > 6000) return NaN;
    return Math.round(n.ping);
  }

  function getJitter() {
    const n = N();
    if (!n || !n.online || !Number.isFinite(getPing())) return NaN;
    return Math.round(n.jitter || 0);
  }

  function emitStatus() {
    if (typeof netEmitStatus === 'function') { netEmitStatus(); return; }
    if (typeof BC.emit === 'function') BC.emit('netStatus', {
      online: isOnline(),
      mode: N() ? N().mode : null,
      room: N() ? N().room : '',
      players: playerTotal(),
      ping: Number.isFinite(getPing()) ? getPing() : null,
      desync: !!(N() && N().desync)
    });
  }

  function setDesync(value) {
    const n = N();
    if (!n || n.desync === value) return;
    n.desync = value;
    if (value !== lastDesync) {
      lastDesync = value;
      emitStatus();
    }
  }

  function watchdog() {
    const n = N();
    if (!n || !n.online) {
      if (lastDesync) { lastDesync = false; }
      joinSent = false;
      return;
    }
    if (!onlineAt) onlineAt = n.onlineAt || performance.now();
    const now = performance.now();
    const seen = n.lastRx > 0 ? n.lastRx : onlineAt;
    const silent = now - seen;

    const pending = !!(n.configPending || n.configError || n.localReset || (n.mode === 'mqtt' && !n.authorityReady));
    if (silent > STALE_MS || pending) {
      setDesync(true);
      // One join per outage; normal state packets resume on their own once the
      // transport recovers, so repeated joins would only add noise.
      if (silent > STALE_MS && !pending && transportReady() && !joinSent && typeof window.__netIdentity === 'function') {
        joinSent = true;
        try { window.__netIdentity(); } catch (e) { /* ignore */ }
      }
    } else {
      joinSent = false;
      setDesync(false);
    }
    if (silent > 12000 && transportReady()) {
      if (n.mode === 'ws' && typeof netLoseLanConnection === 'function') netLoseLanConnection(n.ws);
      else if (n.mode === 'mqtt' && typeof mqttLoseConnection === 'function') mqttLoseConnection(mqtt.ws);
    }
  }

  function kick(reason) {
    const n = N();
    if (!n) return false;
    if (typeof netDisconnect === 'function') return netDisconnect(reason || 'Disconnected from the session', true);
    try {
      n.closedByUs = true;
      if (typeof netStopPing === 'function') netStopPing();
      if (typeof netDropQueue === 'function') netDropQueue();
      if (n.mode === 'mqtt' && typeof mqttDropSocket === 'function') {
        if (typeof mqttClearTimers === 'function') mqttClearTimers();
        mqtt.closedByUs = true;
        mqttDropSocket();
      }
      if (n.ws) {
        const ws = n.ws;
        n.ws = null;
        try {
          ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
          ws.close();
        } catch (e) { /* ignore */ }
      }
      n.online = false;
      n.mode = null;
      n.id = null;
      n.desync = true;
      lastDesync = true;
      emitStatus();
      if (typeof toast === 'function') toast(reason || 'Disconnected from the session');
      return true;
    } catch (e) {
      return false;
    }
  }

  if (typeof BC.on === 'function') {
    BC.on('netPacket', function () {
      const n = N();
      if (!n) return;
      if (n.online && !onlineAt) onlineAt = performance.now();
      if (lastDesync && !n.configPending && !n.configError && !n.localReset && (n.mode !== 'mqtt' || n.authorityReady)) {
        joinSent = false;
        setDesync(false);
      }
    });
    BC.on('netStatus', function (status) {
      const n = N();
      if (!n) return;
      if (status && status.online) {
        onlineAt = n.onlineAt || onlineAt || performance.now();
        lastDesync = !!status.desync;
      } else {
        onlineAt = 0;
        joinSent = false;
        lastDesync = false;
      }
    });
  }

  const authority = {
    get id() { const n = N(); return n ? n.hostId : null; },
    get agreed() { const n = N(); return !!(n && n.online && n.authorityReady); }
  };

  BC.api.net = {
    getPing: getPing,
    getJitter: getJitter,
    packetRate: function () { return Math.round(sampleRate() * 10) / 10; },
    statusText: statusText,
    sendRate: SEND_MS,
    get connected() { return transportReady(); },
    get online() { return isOnline(); },
    syncState: syncState,
    kick: kick,
    authority: authority,
    get authorityReady() { return authority.agreed; },
    get authorityId() { return authority.id; },
    get hostId() { return authority.id; },
    get id() { const n = N(); return n ? n.id : null; },
    get generation() { const n = N(); return n ? n.generation : 0; },
    get dragonCount() { return typeof netDragonCount === 'function' ? netDragonCount() : 0; },
    dragonCatalog: function () { return typeof netDragonCatalogSnapshot === 'function' ? netDragonCatalogSnapshot() : []; },
    get configPending() { const n = N(); return !!(n && n.configPending); },
    canConfigure: function () { return typeof netCanConfigure === 'function' && netCanConfigure(); },
    teamFor: function (id) { return typeof netTeamFor === 'function' ? netTeamFor(id) : null; },
    enemies: function (a, b) { return typeof netEnemies === 'function' && netEnemies(a, b); }
  };

  function startWatchdog() {
    if (timer !== null) return;
    timer = setInterval(watchdog, WATCHDOG_MS);
    if (timer && typeof timer.unref === 'function') timer.unref();
  }
  startWatchdog();
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', function () { if (timer !== null) { clearInterval(timer); timer = null; } });
    window.addEventListener('pageshow', startWatchdog);
  }
})();
