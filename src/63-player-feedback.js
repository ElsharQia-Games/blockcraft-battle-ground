/* Blockcraft Battle Ground — Confirmed, world-anchored player hit feedback.
   63-player-feedback.js
   Health bars appear briefly AFTER an accepted hit; damage numbers use the
   same accepted event. No predicted HP, through-wall labels or extra 3D passes. */
'use strict';

(function () {
  const BAR_MS = 4200, NUMBER_MS = 850, MAX_NUMBERS = 32;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const bars = new Map(), numbers = [], numberPool = [];
  const point = new THREE.Vector3(), projected = new THREE.Vector3();
  const direction = new THREE.Vector3(), forward = new THREE.Vector3();
  let root = null, serial = 0;

  BC.style('bc-player-feedback-css', `
    #playerFeedback { position: fixed; inset: 0; z-index: 4; overflow: hidden; pointer-events: none; }
    #playerFeedback[hidden], #playerFeedback [hidden] { display: none !important; }
    #playerFeedback.pf-tube { clip-path: circle(calc(min(82vmin, max(96px, calc(100vh - 152px))) / 2 - 19px) at 50% 50%); }
    #playerFeedback .pf-health { position: absolute; left: 0; top: 0; width: 112px;
      color: #f5fbff; --pf-team: #d8e6f2; text-align: center;
      font: 700 11px/14px var(--bc-ui-font, "Segoe UI", sans-serif);
      text-shadow: 0 1px 2px #03070c, 1px 0 #03070c, -1px 0 #03070c; }
    #playerFeedback .pf-health[data-team="red"] { --pf-team: var(--bc-red, #ff3556); }
    #playerFeedback .pf-health[data-team="blue"] { --pf-team: var(--bc-blue, #3585ff); }
    #playerFeedback .pf-name { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    #playerFeedback .pf-health-line { display: flex; justify-content: center; align-items: center; gap: 4px; }
    #playerFeedback .pf-meter { width: 74px; height: 8px; box-sizing: border-box; overflow: hidden;
      border: 1px solid var(--pf-team); background: #09152b; box-shadow: 0 0 0 1px #03070c; }
    #playerFeedback .pf-fill { display: block; width: 100%; height: 100%; background: var(--pf-team);
      transform-origin: left; transition: transform 100ms ease-out; }
    #playerFeedback .pf-hp { min-width: 20px; font: 700 11px/14px var(--bc-hud-font, Consolas, monospace); }
    #playerFeedback .pf-damage { position: absolute; left: 0; top: 0; color: #f5fbff;
      font: 900 22px/1 var(--bc-display-font, "Arial Black", sans-serif);
      text-shadow: -1px -1px #03070c, 1px -1px #03070c, -1px 1px #03070c, 1px 1px #03070c, 0 2px 0 #03070c;
      white-space: nowrap; will-change: transform, opacity; }
    #playerFeedback .pf-damage.head { color: #ffd166; font-size: 25px; }
    @media (prefers-reduced-motion: reduce) { #playerFeedback .pf-fill { transition: none; } }
  `);

  function ensureRoot() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'playerFeedback';
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(root);
  }
  function peerFor(id) { return typeof net !== 'undefined' && net.players ? net.players.get(id) : null; }
  function peerHeight(peer) { return typeof combatBodyHeight === 'function' ? combatBodyHeight(peer) : 1.8; }
  function removeBar(id) {
    const bar = bars.get(id);
    if (bar) bar.el.remove();
    bars.delete(id);
  }
  function makeBar(peer, now) {
    if (bars.size >= 32) removeBar(bars.keys().next().value);
    const el = document.createElement('div'); el.className = 'pf-health';
    const name = document.createElement('span'); name.className = 'pf-name';
    const line = document.createElement('div'); line.className = 'pf-health-line';
    const meter = document.createElement('span'); meter.className = 'pf-meter';
    const fill = document.createElement('i'); fill.className = 'pf-fill';
    const hp = document.createElement('b'); hp.className = 'pf-hp';
    meter.appendChild(fill); line.append(meter, hp); el.append(name, line);
    el.hidden = true; root.appendChild(el);
    const bar = { el, name, hp, fill, life: peer.life, until: now + BAR_MS,
      displayedHp: -1, losAt: -Infinity, clear: false };
    bars.set(peer.id, bar);
    return bar;
  }
  function retireNumber(index) {
    const rec = numbers[index];
    rec.el.hidden = true;
    if (numberPool.length < MAX_NUMBERS) numberPool.push(rec);
    else rec.el.remove();
    numbers.splice(index, 1);
  }
  function clear() {
    for (const id of bars.keys()) removeBar(id);
    while (numbers.length) retireNumber(numbers.length - 1);
    if (root) root.hidden = true;
  }

  function acceptedHit(info) {
    if (!info || info.authoritative !== true || !Number.isFinite(info.damage) || info.damage <= 0 ||
        !Number.isFinite(info.health) || info.health < 0 || info.health > MAX_HEALTH ||
        typeof net === 'undefined' || info.byId !== net.id || info.generation !== net.generation ||
        !alive || BC.flags.menuOpen || BC.flags.worldBusy) return;
    const peer = peerFor(info.targetId);
    if (!peer || (Number.isSafeInteger(info.life) && info.life < peer.life)) return;
    ensureRoot();
    const now = performance.now();
    let bar = bars.get(peer.id);
    if (bar && bar.life !== peer.life) { removeBar(peer.id); bar = null; }
    if (!bar) bar = makeBar(peer, now);
    bar.until = now + BAR_MS; bar.losAt = -Infinity;

    // Shotgun pellets share a shot id: show one total, not eight overlapping
    // numbers. Older authorities can use the short same-target arrival window.
    let rec = numbers.find((n) => n.id === peer.id && n.life === peer.life && n.weapon === info.weapon &&
      (info.shotId ? n.shotId === info.shotId : now - n.born < 65));
    if (!rec) {
      if (numbers.length >= MAX_NUMBERS) retireNumber(0);
      rec = numberPool.pop();
      if (!rec) {
        const el = document.createElement('b'); el.className = 'pf-damage';
        el.hidden = true; root.appendChild(el);
        rec = { el };
      }
      rec.id = peer.id; rec.life = peer.life; rec.weapon = info.weapon;
      rec.shotId = info.shotId; rec.born = now; rec.amount = 0; rec.head = false;
      rec.offset = ((serial++ % 3) - 1) * 13;
      numbers.push(rec);
    }
    rec.amount += info.damage; rec.head = rec.head || info.head;
    rec.el.textContent = String(Math.round(rec.amount));
    rec.el.classList.toggle('head', rec.head);
  }

  function project(position) {
    direction.copy(position).sub(camera.position);
    if (direction.dot(forward) <= 0.05 || direction.lengthSq() > 185 * 185) return false;
    projected.copy(position).project(camera);
    return projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
  }
  function clearRay(position) {
    direction.copy(position).sub(camera.position);
    const distance = direction.length();
    if (distance < 0.05) return true;
    direction.multiplyScalar(1 / distance);
    const range = Math.max(0, distance - 0.12);
    if (raycastVoxel(range, camera.position, direction)) return false;
    const dragons = BC.api.dragons;
    return !(dragons && dragons.raycast(camera.position, direction, range, -1));
  }
  function updateLOS(bar, peer, now) {
    if (now - bar.losAt < 80) return;
    bar.losAt = now;
    const p = peer.group.position, h = peerHeight(peer);
    // Test the body/head, not the label ABOVE a wall, so the overlay cannot
    // reveal a completely hidden player just because its label clears cover.
    point.set(p.x, p.y + h * 0.6, p.z);
    bar.clear = clearRay(point);
    if (!bar.clear) { point.y = p.y + h * 0.93; bar.clear = clearRay(point); }
  }
  function place(el, x, y, rise, side, scale) {
    el.style.transform = 'translate(' + (x + side).toFixed(1) + 'px,' + (y - rise).toFixed(1) +
      'px) translate(-50%,-100%) scale(' + scale.toFixed(3) + ')';
  }

  function update(dt, now) {
    if (!root) return;
    const playing = BC.flags.playing && !BC.flags.menuOpen && !BC.flags.worldBusy && alive && !document.hidden;
    root.hidden = !playing;
    camera.updateWorldMatrix(true, false);
    camera.getWorldDirection(forward);
    const tube = isScopeActive() && currentWeapon().view === 'sniper-tube';
    root.classList.toggle('pf-tube', tube);
    for (const [id, bar] of bars) {
      const peer = peerFor(id);
      if (!peer || peer.life !== bar.life || now >= bar.until) { removeBar(id); continue; }
      bar.el.hidden = true;
      if (!playing || peer.hp <= 0 || peer.deadUntil > now || !peer.group.visible || now - peer.lastRx > 2500) continue;
      const p = peer.group.position;
      point.set(p.x, p.y + peerHeight(peer) + 0.3, p.z);
      if (!project(point)) continue;
      const x = (projected.x * 0.5 + 0.5) * innerWidth, y = (0.5 - projected.y * 0.5) * innerHeight;
      updateLOS(bar, peer, now);
      if (!bar.clear) continue;
      const hp = Math.max(0, Math.min(MAX_HEALTH, peer.hp));
      if (bar.displayedHp !== hp) {
        bar.hp.textContent = String(Math.ceil(hp));
        bar.fill.style.transform = 'scaleX(' + (hp / MAX_HEALTH).toFixed(3) + ')';
        bar.displayedHp = hp;
      }
      if (bar.name.textContent !== peer.name) bar.name.textContent = peer.name;
      const team = typeof netTeamFor === 'function' ? netTeamFor(id) : peer.team;
      if (bar.el.dataset.team !== (team || 'neutral')) bar.el.dataset.team = team || 'neutral';
      bar.el.style.opacity = String(Math.min(1, (bar.until - now) / 350));
      place(bar.el, x, y, 0, 0, 1);
      bar.el.hidden = false;
      // The name is included in this bar; do not draw a duplicate sprite label.
      if (peer.group.userData.tag) peer.group.userData.tag.visible = false;
    }
    for (let i = numbers.length - 1; i >= 0; i--) {
      const rec = numbers[i], peer = peerFor(rec.id), age = Math.max(0, (now - rec.born) / NUMBER_MS);
      if (!peer || peer.life !== rec.life || age >= 1) { retireNumber(i); continue; }
      rec.el.hidden = true;
      const bar = bars.get(rec.id);
      if (!playing || !bar) continue;
      const p = peer.group.position;
      point.set(p.x, p.y + peerHeight(peer) + 0.62, p.z);
      if (!project(point)) continue;
      const x = (projected.x * 0.5 + 0.5) * innerWidth, y = (0.5 - projected.y * 0.5) * innerHeight;
      updateLOS(bar, peer, now);
      if (!bar.clear) continue;
      const rise = reduced.matches ? 0 : 28 * (1 - (1 - age) * (1 - age));
      const scale = reduced.matches ? 1 : 1 + 0.12 * Math.max(0, 1 - age * 8);
      rec.el.style.opacity = String(Math.min(1, (1 - age) / 0.28));
      place(rec.el, x, y, rise, rec.offset, scale);
      rec.el.hidden = false;
    }
  }

  BC.api.playerFeedback = { clear, get state() { return { healthBars: bars.size, damageNumbers: numbers.length }; } };
  BC.on('playerHit', acceptedHit);
  BC.on('lateFrame', update, 900);
  for (const event of ['death', 'respawn', 'worldWillReset', 'worldReset']) BC.on(event, clear);
  BC.on('netStatus', (status) => { if (!status || !status.online) clear(); });
})();
