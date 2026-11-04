/* Blockcraft Battle Ground — Combat feedback overlay: kill/death banner, directional
   damage arcs, hit confirms, readable kill feed rows, loadout strip and tiny aim
   assistance. 62-combat-fx.js — loaded immediately after 60-combat.js. */
'use strict';

(function () {
  const FX_STYLE_ID = 'bc-combat-fx-css';
  const FX_REDUCED = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  const CSS = `
#killBanner {
  position: fixed; left: 50%; top: max(54px, 9.5vh); transform: translateX(-50%);
  width: min(94vw, 940px); display: none; z-index: 14; pointer-events: none;
  text-align: center; font-family: "Segoe UI", system-ui, sans-serif;
}
#killBanner.show { display: block; }
body.killcam #killBanner[data-mode="death"] { display: none !important; }
#death.combat-fx-fallback h2 { display: none; }
#killBanner .kb-card {
  --kb-accent: #ff3556; --kb-accent2: #3585ff;
  position: relative; padding: 13px 22px 18px; border-radius: 12px; overflow: hidden;
  background: linear-gradient(180deg, rgba(7,13,19,.93), rgba(7,13,19,.68));
  border: 1px solid rgba(255,255,255,.2); border-top: 3px solid var(--kb-accent);
  box-shadow: 0 20px 60px rgba(0,0,0,.52), inset 0 0 0 1px rgba(255,255,255,.05);
}
#killBanner[data-mode="death"] .kb-card { --kb-accent: #ff3556; }
#killBanner[data-mode="kill"] .kb-card { --kb-accent: #3585ff; --kb-accent2: #7dffa5; }
#killBanner .kb-kicker {
  font-size: clamp(10px, 1vw, 12px); font-weight: 800; letter-spacing: .44em;
  text-transform: uppercase; color: var(--kb-accent); margin-bottom: 5px;
}
#killBanner .kb-name {
  font-family: "Arial Narrow", "Roboto Condensed", "Oswald", system-ui, sans-serif;
  font-weight: 800; font-size: clamp(30px, 4.4vw, 44px); line-height: .94;
  letter-spacing: .015em; text-transform: uppercase; color: #fff;
  text-shadow: 0 3px 0 rgba(0,0,0,.35); overflow-wrap: anywhere;
}
#killBanner[data-mode="death"] .kb-name {
  font-size: clamp(46px, min(7vw, 8.6vh), 64px);
}
#killBanner .kb-meta {
  display: flex; flex-wrap: wrap; gap: 7px; justify-content: center;
  align-items: center; margin-top: 9px;
}
#killBanner .kb-tag {
  padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.17); color: rgba(255,255,255,.88);
  font-size: clamp(9px, .95vw, 11px); font-weight: 800; letter-spacing: .16em;
  text-transform: uppercase; white-space: nowrap;
}
#killBanner .kb-tag.kb-w { border-color: var(--kb-accent2); color: #dce9ff; }
#killBanner .kb-tag.kb-hs {
  background: rgba(255,53,86,.18); border-color: rgba(255,53,86,.6); color: #ff9aac;
}
#killBanner .kb-bar {
  position: absolute; left: 0; right: 0; bottom: 0; height: 4px;
  background: rgba(255,255,255,.1); overflow: hidden;
}
#killBanner .kb-bar i {
  display: block; width: 100%; height: 100%; transform-origin: left center;
  background: var(--kb-accent); animation: bcKbDrain 3.2s linear forwards;
}
@keyframes bcKbDrain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
#killBanner.show .kb-card { animation: bcKbIn .2s ease-out; }
@keyframes bcKbIn {
  from { opacity: 0; transform: translateY(-10px) scale(.985); }
  to { opacity: 1; transform: none; }
}

#damageDir {
  position: fixed; inset: 0; z-index: 7; pointer-events: none;
  overflow: hidden; --dd-r: min(38vmin, 300px);
}
#damageDir .dd-item {
  position: absolute; left: 50%; top: 50%;
  width: calc(var(--dd-r) * 2); height: calc(var(--dd-r) * 2);
  margin: calc(var(--dd-r) * -1) 0 0 calc(var(--dd-r) * -1);
  opacity: 0; transition: opacity .12s ease;
  will-change: transform, opacity;
}
#damageDir .dd-item.on { opacity: var(--dd-op, .8); }
#damageDir .dd-item.fade { opacity: 0; }
#damageDir .dd-arc {
  position: absolute; left: 50%; top: 0; width: clamp(48px, 8vmin, 92px); height: clamp(14px, 2.4vmin, 24px);
  margin-left: calc(clamp(48px, 8vmin, 92px) * -0.5);
  border-top: 4px solid rgba(255,53,86,.96);
  border-radius: 50% 50% 0 0;
  box-shadow: 0 -2px 16px rgba(255,53,86,.6);
}
#damageDir .dd-arc::after {
  content: ""; position: absolute; left: 50%; top: -11px;
  margin-left: -7px; width: 0; height: 0;
  border-left: 7px solid transparent; border-right: 7px solid transparent;
  border-bottom: 10px solid rgba(255,53,86,.96);
  filter: drop-shadow(0 0 6px rgba(255,53,86,.8));
}

#hitConfirm {
  position: fixed; left: 50%; top: calc(50% + 34px); transform: translateX(-50%);
  z-index: 7; pointer-events: none; opacity: 0; transition: opacity .12s ease;
  font-family: "Segoe UI", system-ui, sans-serif; font-weight: 800; font-size: 13px;
  line-height: 1.2; letter-spacing: .2em; text-transform: uppercase;
  color: #ffd166; text-shadow: 0 2px 6px rgba(0,0,0,.85); white-space: nowrap;
}
#hitConfirm.show { opacity: 1; }
#hitConfirm.hc-head { color: #ffb03c; }
#hitConfirm.hc-kill { color: #7dffa5; font-size: 15px; letter-spacing: .24em; }

#combatLoadout {
  position: fixed; left: 50%; bottom: clamp(84px, 12vh, 110px); transform: translateX(-50%); z-index: 6;
  display: none; gap: 4px; max-width: min(64vw, 440px); flex-wrap: wrap;
  justify-content: center; pointer-events: none;
  font-family: "Segoe UI", system-ui, sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: .12em; text-transform: uppercase;
}
#combatLoadout.show { display: flex; }
#combatLoadout .lo-chip {
  padding: 4px 7px; border-radius: 4px; color: rgba(255,255,255,.78);
  background: rgba(10,18,26,.62); border: 1px solid rgba(255,255,255,.18);
  backdrop-filter: blur(6px);
}

#killfeed .kf {
  display: flex; align-items: center; gap: .55em; padding: 7px 12px;
  border-radius: 8px; background: rgba(5,10,16,.8);
  border: 1px solid rgba(255,255,255,.18);
  box-shadow: 0 8px 24px rgba(0,0,0,.35);
  font-size: clamp(18px, calc(10px + 1.05vw), 24px); font-weight: 700;
  line-height: 1.16; letter-spacing: .01em; white-space: nowrap;
  animation: bcKfIn .2s ease-out;
}
#killfeed .kf b { font-size: 1em; font-weight: 800; }
#killfeed .kf .kf-k, #killfeed .kf .kf-v { color: #ffe6a8; }
#killfeed .kf .kf-k.kf-red, #killfeed .kf .kf-v.kf-red { color: #ff6d84; }
#killfeed .kf .kf-k.kf-blue, #killfeed .kf .kf-v.kf-blue { color: #6aa8ff; }
#killfeed .kf .kf-x {
  font-style: normal; font-weight: 700; font-size: .6em; letter-spacing: .14em;
  text-transform: uppercase; color: rgba(255,255,255,.62);
  padding: 2px 7px; border-radius: 999px; background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.13);
}
#killfeed .kf .kf-hs {
  font-size: .55em; font-weight: 800; letter-spacing: .14em; color: #ffb03c;
  padding: 2px 6px; border-radius: 999px; background: rgba(255,176,60,.14);
  border: 1px solid rgba(255,176,60,.45);
}
@keyframes bcKfIn {
  from { opacity: 0; transform: translateX(18px); }
  to { opacity: 1; transform: none; }
}

@media (max-width: 560px) {
  #killBanner { top: max(48px, 9vh); width: min(94vw, 560px); }
  #killfeed .kf { white-space: normal; max-width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  #killBanner.show .kb-card { animation: none; }
  #killBanner .kb-bar i { animation: none !important; transform: scaleX(1); }
  #damageDir .dd-item, #damageDir .dd-item.on, #damageDir .dd-item.fade { transition: none; }
  #hitConfirm { transition: none; }
  #killfeed .kf { animation: none; }
}
`;

  let bannerEl = null;
  let bannerCardEl = null;
  let bannerKickerEl = null;
  let bannerNameEl = null;
  let bannerMetaEl = null;
  let bannerFillEl = null;
  let bannerTimer = 0;
  let dirEl = null;
  let hitConfirmEl = null;
  let hitTimer = 0;
  let loadoutEl = null;
  const dirLayers = [];
  const personalKillTokens = new Set();

  function runtime() {
    try { return (typeof window !== 'undefined' && window.BC) ? window.BC : null; } catch (e) { return null; }
  }
  function doc() {
    try { return typeof document !== 'undefined' ? document : null; } catch (e) { return null; }
  }
  function byId(id) {
    const d = doc();
    if (!d) return null;
    try { return d.getElementById(id); } catch (e) { return null; }
  }
  function nowMs() {
    try { return (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') ? performance.now() : Date.now(); } catch (e) { return Date.now(); }
  }
  function cleanName(v) {
    return String(v == null ? '' : v).replace(/[^\w \-'.]/g, '').trim().slice(0, 14);
  }
  function localName() {
    try { return typeof playerName === 'string' ? cleanName(playerName) : ''; } catch (e) { return ''; }
  }
  function isLocal(name) {
    const mine = localName();
    const theirs = cleanName(name);
    return !!mine && !!theirs && mine.toLowerCase() === theirs.toLowerCase();
  }
  function localPos() {
    try {
      if (typeof player !== 'undefined' && player && player.pos && Number.isFinite(player.pos.x)) return player.pos;
      if (typeof camera !== 'undefined' && camera && camera.position && Number.isFinite(camera.position.x)) return camera.position;
    } catch (e) { /* ignore */ }
    return null;
  }
  function remotePos(id) {
    if (!id) return null;
    try {
      if (typeof net === 'undefined' || !net || !net.players) return null;
      const r = net.players.get(id);
      if (!r) return null;
      if (r.group && r.group.position && Number.isFinite(r.group.position.x)) return r.group.position;
      if (Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.z)) return { x: r.x, y: r.y, z: r.z };
    } catch (e) { /* ignore */ }
    return null;
  }
  function posOf(v) {
    if (!v) return null;
    if (Number.isFinite(v.x) && Number.isFinite(v.z)) return v;
    if (v.pos && Number.isFinite(v.pos.x) && Number.isFinite(v.pos.z)) return v.pos;
    return null;
  }
  function teamOf(id) {
    try {
      if (typeof combatTeamForId === 'function') return combatTeamForId(id);
      const b = runtime();
      const modes = b && b.api ? b.api.modes : null;
      const localTeam = modes && (modes.localTeam === 'red' || modes.localTeam === 'blue') ? modes.localTeam : '';
      if (modes && (typeof modes.teamOf === 'function' || typeof modes.teamFor === 'function')) {
        const exact = typeof modes.teamOf === 'function' ? modes.teamOf(id) : modes.teamFor(id);
        if (exact === 'red' || exact === 'blue') return exact;
      }
      if (typeof net !== 'undefined' && net && net.id && id === net.id) return localTeam;
      const peer = typeof net !== 'undefined' && net && net.players ? net.players.get(id) : null;
      if (peer && (peer.team === 'red' || peer.team === 'blue')) return peer.team;
    } catch (e) { return ''; }
    return '';
  }
  function weaponLabel(id) {
    if (typeof id !== 'string' || !id) return '';
    try {
      if (typeof WEAPONS !== 'undefined' && Array.isArray(WEAPONS)) {
        for (const w of WEAPONS) if (w && w.id === id) return w.name;
      }
    } catch (e) { /* ignore */ }
    return id.toUpperCase();
  }
  function totalWeapons() {
    try { return typeof WEAPONS !== 'undefined' && Array.isArray(WEAPONS) ? WEAPONS.length : 0; } catch (e) { return 0; }
  }

  function injectStyle() {
    try {
      const b = runtime();
      if (b && typeof b.style === 'function') { b.style(FX_STYLE_ID, CSS); return; }
      const d = doc();
      if (!d || !d.head || byId(FX_STYLE_ID)) return;
      const tag = d.createElement('style');
      tag.id = FX_STYLE_ID;
      tag.textContent = CSS;
      d.head.appendChild(tag);
    } catch (e) { /* styling is optional */ }
  }

  function ensureBanner() {
    if (bannerEl) return bannerEl;
    const d = doc();
    if (!d || !d.body) return null;
    bannerEl = byId('killBanner');
    if (!bannerEl) {
      bannerEl = d.createElement('div');
      bannerEl.id = 'killBanner';
      bannerEl.setAttribute('aria-hidden', 'true');
      d.body.appendChild(bannerEl);
    }
    bannerEl.setAttribute('role', 'status');
    bannerEl.setAttribute('aria-live', 'polite');
    bannerEl.setAttribute('aria-atomic', 'true');
    if (!bannerEl.firstChild) {
      const card = d.createElement('div');
      card.className = 'kb-card';
      const kicker = d.createElement('div');
      kicker.className = 'kb-kicker';
      const name = d.createElement('div');
      name.className = 'kb-name';
      const meta = d.createElement('div');
      meta.className = 'kb-meta';
      const bar = d.createElement('div');
      bar.className = 'kb-bar';
      const fill = d.createElement('i');
      bar.appendChild(fill);
      card.append(kicker, name, meta, bar);
      bannerEl.appendChild(card);
      bannerCardEl = card;
      bannerKickerEl = kicker;
      bannerNameEl = name;
      bannerMetaEl = meta;
      bannerFillEl = fill;
    } else {
      bannerCardEl = bannerEl.querySelector('.kb-card');
      bannerKickerEl = bannerEl.querySelector('.kb-kicker');
      bannerNameEl = bannerEl.querySelector('.kb-name');
      bannerMetaEl = bannerEl.querySelector('.kb-meta');
      bannerFillEl = bannerEl.querySelector('.kb-bar > i');
    }
    return bannerEl;
  }

  function ensureDom() {
    const d = doc();
    if (!d || !d.body) return;
    injectStyle();
    ensureBanner();
    if (!dirEl) {
      dirEl = byId('damageDir');
      if (!dirEl) {
        dirEl = d.createElement('div');
        dirEl.id = 'damageDir';
        dirEl.setAttribute('aria-hidden', 'true');
        d.body.appendChild(dirEl);
      }
    }
    if (!hitConfirmEl) {
      hitConfirmEl = byId('hitConfirm');
      if (!hitConfirmEl) {
        hitConfirmEl = d.createElement('div');
        hitConfirmEl.id = 'hitConfirm';
        hitConfirmEl.setAttribute('aria-hidden', 'true');
        d.body.appendChild(hitConfirmEl);
      }
    }
  }

  function setBannerMeta(info) {
    if (!bannerMetaEl) return;
    while (bannerMetaEl.firstChild) bannerMetaEl.removeChild(bannerMetaEl.firstChild);
    const d = doc();
    if (!d) return;
    const tags = [];
    const label = weaponLabel(info.weapon);
    if (label) tags.push({ text: label, cls: 'kb-w' });
    if (info.head) tags.push({ text: 'HEADSHOT', cls: 'kb-hs' });
    const here = posOf(info.victimPos) || localPos();
    const there = posOf(info.killerPos) || posOf(info.from) || posOf(info.pos);
    if (here && there) {
      const dist = Math.hypot(there.x - here.x, there.y - here.y, there.z - here.z);
      if (Number.isFinite(dist) && dist > 0.5 && dist < 400) {
        tags.push({ text: Math.round(dist) + ' m', cls: 'kb-dist' });
      }
    }
    for (let i = 0; i < tags.length; i++) {
      const tag = d.createElement('span');
      tag.className = 'kb-tag ' + tags[i].cls;
      tag.textContent = tags[i].text;
      bannerMetaEl.appendChild(tag);
    }
    bannerMetaEl.style.display = tags.length ? '' : 'none';
  }

  function hideBanner() {
    clearTimeout(bannerTimer);
    bannerTimer = 0;
    if (!bannerEl) return;
    bannerEl.classList.remove('show');
    bannerEl.setAttribute('aria-hidden', 'true');
  }

  function showBanner(mode, name, info, duration) {
    if (!ensureBanner()) return;
    info = info || {};
    const team = mode === 'death' ? info.killerTeam || teamOf(info.byId) : info.victimTeam || teamOf(info.victimId);
    let accent;
    if (mode === 'death') accent = team === 'blue' ? '#3585ff' : '#ff3556';
    else if (team === 'red') accent = '#ff3556';
    else if (team === 'blue') accent = '#3585ff';
    else accent = '#3585ff';
    if (bannerKickerEl) bannerKickerEl.textContent = mode === 'death' ? 'KILLED BY' : 'ELIMINATED';
    if (bannerNameEl) bannerNameEl.textContent = name || (mode === 'death' ? 'THE VOID' : 'TARGET');
    if (bannerCardEl) bannerCardEl.style.setProperty('--kb-accent', accent);
    bannerEl.dataset.mode = mode;
    setBannerMeta(info);
    if (bannerFillEl) {
      bannerFillEl.style.animation = 'none';
      void bannerFillEl.offsetWidth;
      bannerFillEl.style.animation = (FX_REDUCED && FX_REDUCED.matches)
        ? 'none' : 'bcKbDrain ' + duration + 'ms linear forwards';
    }
    clearTimeout(bannerTimer);
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('show');
    bannerEl.setAttribute('aria-hidden', 'false');
    bannerTimer = setTimeout(hideBanner, duration);
  }

  function killBanner(victim, killer, info) {
    info = info || {};
    if (info.predicted === true || info.confirmed === false) return false;
    const victimName = cleanName(victim);
    const killerName = cleanName(killer);
    let self = '';
    try { self = typeof net !== 'undefined' && net ? net.id : ''; } catch (e) { /* ignore */ }
    let death = info.localDeath === true;
    let kill = info.personalKill === true || info.localKill === true;
    if (!death) death = self && info.victimId ? info.victimId === self : isLocal(victimName);
    if (!death && !kill) kill = self && info.killerId ? info.killerId === self : isLocal(killerName);
    if (!death && !kill) return false;
    if (death) {
      const b = runtime();
      if (b && b.api && b.api.killcam) { hideBanner(); return false; }
      const shown = killerName && killerName !== '???' ? killerName : 'THE VOID';
      showBanner('death', shown, info, 3200);
    } else {
      if (info.confirmed !== true && info.authoritative !== true) return false;
      try { if (typeof alive !== 'undefined' && !alive) return false; } catch (e) { return false; }
      const token = typeof combatKillToken === 'function' ? combatKillToken(info)
        : info.killId || info.killToken || info.eventId;
      if (token != null) {
        const key = String(token);
        if (personalKillTokens.has(key) || personalKillTokens.size >= 4096) return false;
        personalKillTokens.add(key);
      }
      const shown = victimName && victimName !== '???' ? victimName : 'TARGET';
      showBanner('kill', shown, info, 1400);
    }
    return true;
  }

  function clearDamageDirections() {
    while (dirLayers.length) {
      const rec = dirLayers.pop();
      if (!rec) continue;
      clearTimeout(rec.fade);
      clearTimeout(rec.timer);
      if (rec.el) rec.el.remove();
    }
  }

  function damageDirection(info) {
    info = info || {};
    ensureDom();
    if (!dirEl) return;
    const d = doc();
    if (!d) return;
    const from = posOf(info.from) || posOf(info.killerPos) || posOf(info.pos) || remotePos(info.byId);
    const origin = localPos();
    if (!from || !origin) return;
    const dx = from.x - origin.x;
    const dz = from.z - origin.z;
    const dist = Math.hypot(dx, dz);
    if (!Number.isFinite(dist) || dist < 0.05) return;
    let yaw = 0;
    try {
      if (typeof player !== 'undefined' && player && Number.isFinite(player.yaw)) yaw = player.yaw;
    } catch (e) { /* ignore */ }
    const forward = (dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / dist;
    const right = (dx * Math.cos(yaw) + dz * -Math.sin(yaw)) / dist;
    const angle = Math.atan2(right, forward);
    const amount = Number(info.amount);
    const opacity = Number.isFinite(amount) ? Math.max(0.55, Math.min(0.95, 0.55 + amount / 90)) : 0.8;

    const layer = d.createElement('div');
    layer.className = 'dd-item';
    layer.style.transform = 'rotate(' + angle + 'rad)';
    layer.style.setProperty('--dd-op', String(opacity));
    const arc = d.createElement('div');
    arc.className = 'dd-arc';
    layer.appendChild(arc);
    dirEl.appendChild(layer);

    while (dirLayers.length >= 3) {
      const old = dirLayers.shift();
      if (!old) continue;
      clearTimeout(old.fade);
      clearTimeout(old.timer);
      if (old.el) old.el.remove();
    }
    const rec = { el: layer, fade: 0, timer: 0 };
    dirLayers.push(rec);
    const raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : function (fn) { return setTimeout(fn, 16); };
    raf(function () { layer.classList.add('on'); });
    rec.fade = setTimeout(function () { layer.classList.add('fade'); }, 720);
    rec.timer = setTimeout(function () {
      layer.remove();
      const at = dirLayers.indexOf(rec);
      if (at >= 0) dirLayers.splice(at, 1);
    }, 1100);
  }

  function hitFeedback(head, targetName, kill) {
    try { if (typeof alive !== 'undefined' && !alive) return; } catch (e) { return; }
    ensureDom();
    if (!hitConfirmEl) return;
    let text = '';
    if (kill) text = 'ELIMINATED';
    else text = head ? 'HEADSHOT' : 'HIT';
    if (kill && head) text += ' · HEADSHOT';
    hitConfirmEl.textContent = text;
    hitConfirmEl.setAttribute('aria-label', text + (cleanName(targetName) ? ' ' + cleanName(targetName) : ''));
    hitConfirmEl.classList.toggle('hc-kill', !!kill);
    hitConfirmEl.classList.toggle('hc-head', !kill && !!head);
    hitConfirmEl.classList.remove('show');
    void hitConfirmEl.offsetWidth;
    hitConfirmEl.classList.add('show');
    clearTimeout(hitTimer);
    hitTimer = setTimeout(function () { hitConfirmEl.classList.remove('show'); }, kill ? 900 : 500);
  }

  function isVec(v) {
    return !!v && typeof v === 'object' &&
      Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  }

  function friendlyPeer(peer) {
    if (typeof combatIsFriendly === 'function') return combatIsFriendly(peer.id, peer.name, peer);
    const b = runtime();
    const modes = b && b.api ? b.api.modes : null;
    if (!modes) return false;
    try {
      const def = modes.activeDef;
      const teams = def && typeof def.teams === 'boolean' ? def.teams
        : modes.localTeam === 'red' || modes.localTeam === 'blue';
      const team = peer.team || teamOf(peer.id);
      return teams && (modes.localTeam === 'red' || modes.localTeam === 'blue') && team === modes.localTeam;
    } catch (e) { return false; }
  }

  /* Exactly (origin, NORMALIZED direction, weapon). No order/length guessing
     and no world-space target input. The returned vector is always a new value;
     neither input nor the camera is changed. Call once per shot, not per pellet. */
  function aimAssist(origin, dir, weapon) {
    if (typeof THREE === 'undefined' || !THREE || typeof THREE.Vector3 !== 'function') return null;
    if (!isVec(origin) || !isVec(dir)) return null;
    const dirLen = Math.hypot(dir.x, dir.y, dir.z);
    if (!Number.isFinite(dirLen) || dirLen < 1e-6) return null;
    const nd = new THREE.Vector3(dir.x / dirLen, dir.y / dirLen, dir.z / dirLen);
    if (Math.abs(dirLen - 1) > 1e-3 || typeof raycastVoxel !== 'function') return nd;

    let peers = null;
    try { peers = (typeof net !== 'undefined' && net) ? net.players : null; } catch (e) { peers = null; }
    if (!peers || typeof peers.values !== 'function') return nd;

    const weaponId = typeof weapon === 'string' ? weapon : weapon && weapon.id;
    const threshold = weaponId === 'shotgun' ? 3.0 : weaponId === 'sniper' ? 1.2 : 2.2;
    const maxCos = Math.cos(threshold * Math.PI / 180);
    let maxRange = 70;
    try {
      const def = weapon && typeof weapon === 'object' ? weapon
        : typeof WEAPON_BY_ID !== 'undefined' ? WEAPON_BY_ID[weaponId] : null;
      if (def && Number.isFinite(def.range)) maxRange = Math.min(maxRange, Math.max(0, def.range));
    } catch (e) { /* Unknown weapons use only the conservative default cone/range. */ }
    const now = nowMs();
    const chestDir = new THREE.Vector3();
    let bestDx = 0, bestDy = 0, bestDz = 0, bestDist = 0;
    let bestScore = Infinity;
    for (const r of peers.values()) {
      if (typeof combatPeerEligible === 'function') {
        if (!combatPeerEligible(r, now)) continue;
      } else {
        if (!r || !Number.isFinite(r.hp) || r.hp <= 0 || r.dead === true || r.alive === false ||
            r.hidden === true || r.visible === false || r.stale === true || r.deathNoted === true) continue;
        if (r.deadUntil > now || (r.group && r.group.visible === false)) continue;
        const received = Number.isFinite(r.lastRx) ? r.lastRx : r.recvAt;
        if (Number.isFinite(received) && (now - received > 2000 || received - now > 1000)) continue;
        if (friendlyPeer(r)) continue;
        try { if (typeof net !== 'undefined' && net && r.id === net.id) continue; } catch (e) { /* ignore */ }
      }
      const px = r.group && r.group.position ? r.group.position.x : r.x;
      const py = r.group && r.group.position ? r.group.position.y : r.y;
      const pz = r.group && r.group.position ? r.group.position.z : r.z;
      if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) continue;
      const dx = px - origin.x;
      const bodyHeight = typeof combatBodyHeight === 'function' ? combatBodyHeight(r)
        : Number.isFinite(r.bodyHeight) ? r.bodyHeight : r.crouch || r.crouching || r.slide || r.sliding ? 1.2 : 1.8;
      const dy = (py + Math.min(1.12, bodyHeight * 1.12 / 1.8)) - origin.y;
      const dz = pz - origin.z;
      const dist = Math.hypot(dx, dy, dz);
      if (!(dist > 0.5) || dist > maxRange) continue;
      const dot = (dx * nd.x + dy * nd.y + dz * nd.z) / dist;
      if (dot < maxCos) continue;
      const score = (1 - dot) * 1000 + dist * 0.001;
      if (score >= bestScore) continue;
      chestDir.set(dx / dist, dy / dist, dz / dist);
      // Cover is tested before ranking, so a nearer occluded chest cannot
      // suppress a genuinely visible candidate. Missing/failed LOS is no assist.
      try {
        const dragonRange = Math.max(0, dist - 0.00001);
        const b = runtime();
        const dragonsApi = b && b.api ? b.api.dragons : null;
        const dragon = typeof combatRaycastDragon === 'function'
          ? combatRaycastDragon(origin, chestDir, dragonRange)
          : dragonsApi && typeof dragonsApi.raycast === 'function'
            ? dragonsApi.raycast(origin, chestDir, dragonRange, -1) : null;
        // The live body, not just terrain, must leave a clear line all the way
        // to the chest. This is only a LOS bridge; camera and turn cap are intact.
        if (dragon && (!Number.isFinite(dragon.distance) || dragon.distance <= dragonRange + 1e-6)) continue;
        const block = raycastVoxel(Math.max(0, dist - 0.3), origin, chestDir);
        if (block && (!Number.isFinite(block.dist) || block.dist <= dist - 0.3 + 1e-6)) continue;
      } catch (e) { continue; }
      bestScore = score;
      bestDx = dx; bestDy = dy; bestDz = dz; bestDist = dist;
    }
    if (!(bestDist > 0)) return nd;
    chestDir.set(bestDx, bestDy, bestDz).multiplyScalar(1 / bestDist);

    const cosA = Math.max(-1, Math.min(1, nd.x * chestDir.x + nd.y * chestDir.y + nd.z * chestDir.z));
    const angle = Math.acos(cosA);
    if (!(angle > 1e-5)) return nd;
    // 0.25 degrees is the absolute per-shot cap. Only a fraction of the
    // remaining angle is used, so even a nearly aligned chest never snaps.
    const falloff = bestDist > 40 ? 0.35 : 1;
    const turn = Math.min(Math.PI / 720, angle * 0.22) * falloff;
    if (!(turn > 1e-6)) return nd;

    let px = chestDir.x - nd.x * cosA;
    let py = chestDir.y - nd.y * cosA;
    let pz = chestDir.z - nd.z * cosA;
    const pl = Math.hypot(px, py, pz);
    if (!(pl > 1e-6)) return nd;
    px /= pl; py /= pl; pz /= pl;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    return nd.set(
      nd.x * c + px * s,
      nd.y * c + py * s,
      nd.z * c + pz * s
    ).normalize();
  }

  function clearFeedback() {
    hideBanner();
    clearDamageDirections();
    clearTimeout(hitTimer);
    hitTimer = 0;
    if (hitConfirmEl) {
      hitConfirmEl.classList.remove('show');
      hitConfirmEl.textContent = '';
    }
    const hitmarker = byId('hitmarker');
    if (hitmarker) {
      hitmarker.classList.remove('show');
      hitmarker.style.filter = '';
    }
  }

  function confirmedKill(killer, victim, info) {
    if (!info || info.localDeath || info.predicted === true || info.optimistic === true ||
        info.confirmed === false || (info.confirmed !== true && info.authoritative !== true)) return;
    let self = '';
    try { self = typeof net !== 'undefined' && net ? net.id : ''; } catch (e) { /* ignore */ }
    if (self && info.victimId === self) return;
    const mine = info.personalKill || (self && info.killerId === self) || (!info.killerId && isLocal(killer));
    if (mine && killBanner(victim, killer, info)) hitFeedback(!!info.head, victim, true);
  }

  function hideLoadoutStrip() {
    if (!loadoutEl) return;
    loadoutEl.classList.remove('show');
    loadoutEl.setAttribute('aria-hidden', 'true');
  }

  function updateLoadoutStrip(list) {
    const d = doc();
    if (!d || !d.body) return;
    if (!loadoutEl) {
      loadoutEl = byId('combatLoadout');
      if (!loadoutEl) {
        loadoutEl = d.createElement('div');
        loadoutEl.id = 'combatLoadout';
        d.body.appendChild(loadoutEl);
      }
    }
    while (loadoutEl.firstChild) loadoutEl.removeChild(loadoutEl.firstChild);
    const seen = new Set();
    for (let i = 0; i < list.length; i++) {
      const id = list[i];
      if (typeof id !== 'string' || seen.has(id)) continue;
      seen.add(id);
      const chip = d.createElement('span');
      chip.className = 'lo-chip';
      chip.dataset.weapon = id;
      chip.textContent = weaponLabel(id);
      loadoutEl.appendChild(chip);
    }
    loadoutEl.classList.toggle('show', seen.size > 0);
    loadoutEl.setAttribute('aria-hidden', seen.size ? 'false' : 'true');
  }

  function setLoadout(ids) {
    ensureDom();
    const restricted = Array.isArray(ids);
    const list = restricted ? ids.filter(function (id) { return typeof id === 'string'; }) : null;
    const dots = byId('weaponDots');
    if (dots) {
      const total = totalWeapons();
      for (let i = 0; i < dots.children.length; i++) {
        const dot = dots.children[i];
        let id = '';
        try {
          if (typeof WEAPONS !== 'undefined' && WEAPONS[i]) id = WEAPONS[i].id;
        } catch (e) { /* ignore */ }
        const off = restricted && (id ? list.indexOf(id) < 0 : total > 0);
        dot.style.display = off ? 'none' : '';
        dot.classList.toggle('off', off);
      }
    }
    if (restricted && list.length < totalWeapons()) updateLoadoutStrip(list);
    else hideLoadoutStrip();
    return restricted ? list.slice() : null;
  }

  const API = {
    killBanner: killBanner,
    banner: killBanner,
    hideBanner: hideBanner,
    damageDirection: damageDirection,
    aimAssist: aimAssist,
    setLoadout: setLoadout,
    hitFeedback: hitFeedback
  };

  const boot = runtime();
  if (boot && boot.api) boot.api.combatFx = API;
  try {
    ensureDom();
    if (boot && typeof boot.on === 'function') {
      boot.on('death', clearFeedback, 10);
      boot.on('respawn', clearFeedback);
      boot.on('worldReset', function () { clearFeedback(); personalKillTokens.clear(); });
      boot.on('killfeed', confirmedKill, 20);
      if (typeof boot.whenReady === 'function') boot.whenReady(ensureDom);
    }
  } catch (e) {
    // Feedback must never prevent the game from booting.
  }
})();
