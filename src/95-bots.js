/* Blockcraft Battle Ground — bots for offline play.
   95-bots.js (after 90-net.js and 60-combat.js)

   Bots are ordinary remote players: they live in net.players and arrive through
   the same packets as people (addRemote, 'shot', 'died', 'respawn'). So models,
   hit boxes, the kill feed, the scoreboard, teams and every mode work unchanged.
   Offline only: any room or LAN session removes them. Their hits are decided by
   a roll from skill and distance, so a bot's aim stays easy to tune. */
'use strict';

(function () {
  const NAMES = ['Rook', 'Ember', 'Slate', 'Moss', 'Flint', 'Cobalt', 'Birch', 'Onyx', 'Sable', 'Quartz', 'Ash', 'Basalt'];
  const WEAPON_POOL = ['rifle', 'smg', 'shotgun', 'pistol', 'lmg', 'revolver'];
  const SKILLS = {
    easy: { reaction: 800, aim: 0.14, head: 0.04, speed: 4.2, sight: 45 },
    normal: { reaction: 450, aim: 0.26, head: 0.1, speed: 5, sight: 70 },
    hard: { reaction: 220, aim: 0.42, head: 0.2, speed: 5.8, sight: 110 }
  };
  const THINK_MS = 200, POSE_MS = 50, EYE = 1.5, GRAVITY = 24, MAX_BOTS = 7;
  const MAX_SHOTS_PER_S = 5;       // bots fire in measured bursts, whatever the gun
  const SPAWN_MIN_DIST = 16;

  const bots = new Map();
  const config = { count: 3, skill: 'normal' };
  let serial = 0, poseAt = 0, activeKey = '', lastScore = 0;

  try {
    const saved = JSON.parse(localStorage.getItem('blockcraft.bots') || 'null');
    if (saved && Number.isInteger(saved.count)) config.count = Math.max(0, Math.min(MAX_BOTS, saved.count));
    if (saved && SKILLS[saved.skill]) config.skill = saved.skill;
  } catch (e) { /* defaults */ }
  const param = new URLSearchParams(location.search).get('bots');
  if (param !== null && Number.isInteger(Number(param))) config.count = Math.max(0, Math.min(MAX_BOTS, Number(param)));

  const skill = () => SKILLS[config.skill];
  const modes = () => BC.api.modes;
  const modeDef = () => (modes() && modes().activeDef) || {};
  const worldBusy = () => !!(BC.api.world && BC.api.world.busy);
  const solid = (x, y, z) => bmSolidAt(Math.floor(x), Math.floor(y), Math.floor(z));

  function weaponFor(bot) {
    const def = modeDef();
    if (def.ladder) return def.ladder[Math.min(bot.kills, def.ladder.length - 1)];
    const pool = def.weapons ? [...def.weapons] : WEAPON_POOL;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function teamOf(bot) {
    if (!modeDef().teams) return '';
    return (modes() && modes().teamFor(bot.id)) || '';
  }

  // Open ground somewhere in the arena, away from the player and the other bots.
  function openSpot() {
    const arena = modes() && typeof modes().arena === 'function' ? modes().arena() : null;
    const radius = arena && arena.radius ? arena.radius - 3 : 46;
    const cx = arena && Number.isFinite(arena.x) ? arena.x : WORLD / 2, cz = arena && Number.isFinite(arena.z) ? arena.z : WORLD / 2;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
      const x = Math.floor(cx + Math.cos(a) * r) + 0.5, z = Math.floor(cz + Math.sin(a) * r) + 0.5;
      if (x < 2 || z < 2 || x > WORLD - 2 || z > WORLD - 2) continue;
      if (Math.hypot(x - player.pos.x, z - player.pos.z) < SPAWN_MIN_DIST) continue;
      let y = HEIGHT - 3;
      while (y > 0 && !solid(x, y, z)) y--;
      if (y <= 0 || bmLiquidAt(Math.floor(x), y + 1, Math.floor(z))) continue;
      let near = false;
      for (const other of bots.values()) if (other.hp > 0 && Math.hypot(other.x - x, other.z - z) < 6) near = true;
      if (!near) return { x, y: y + 1, z };
    }
    return null;
  }

  function spawnAt(bot) {
    let point = openSpot();
    if (!point) { try { point = modes().respawnPoint(teamOf(bot) || null); } catch (e) { /* use the default */ } }
    if (!point || !Number.isFinite(point.x)) point = findSpawn();
    bot.x = point.x; bot.y = point.y; bot.z = point.z;
    bot.vy = 0;
    bot.hp = MAX_HEALTH;
    bot.target = null;
    bot.seenAt = 0;
    bot.goal = null;
    bot.weapon = weaponFor(bot);
    bot.ammo = (WEAPON_BY_ID[bot.weapon] || {}).mag || 10;
    bot.reloadUntil = 0;
    bot.cool = 0.4;
  }

  function pose(bot) {
    const lookY = bot.target ? (targetPos(bot.target).y + 1.2 - bot.y - EYE) : 0;
    const flat = bot.target ? Math.hypot(targetPos(bot.target).x - bot.x, targetPos(bot.target).z - bot.z) : 1;
    addRemote({ id: bot.id, name: bot.name, character: bot.character, x: bot.x, y: bot.y, z: bot.z, yaw: bot.yaw,
      pitch: Math.max(-1.2, Math.min(1.2, Math.atan2(lookY, flat))), weapon: bot.weapon, hp: bot.hp, kills: bot.kills, deaths: bot.deaths,
      combat: 1, build: 0, onGround: bot.grounded ? 1 : 0, firing: bot.firingAt && performance.now() - bot.firingAt < 200 ? 1 : 0 });
  }

  function addBot(index) {
    const keys = Object.keys(CHARACTERS);
    const bot = { id: 'bot_' + index, name: NAMES[(index + serial) % NAMES.length], character: keys[index % keys.length],
      x: 0, y: 0, z: 0, vy: 0, yaw: 0, hp: MAX_HEALTH, kills: 0, deaths: 0, grounded: false, thinkAt: performance.now() + index * 37,
      strafe: 1, strafeAt: 0, stuck: 0, respawnAt: 0 };
    bots.set(bot.id, bot);
    return bot;
  }

  function fill() {
    while (bots.size < config.count) {
      let index = 1;
      while (bots.has('bot_' + index)) index++;
      addBot(index);
    }
    for (const id of [...bots.keys()].reverse()) {
      if (bots.size <= config.count) break;
      bots.delete(id);
      removeRemote(id);
    }
    // Teams come from the roster, so the bots must exist before they are asked for.
    for (const bot of bots.values()) { spawnAt(bot); pose(bot); }
    if (modes()) modes().assignTeams();
    for (const bot of bots.values()) { spawnAt(bot); pose(bot); }
  }

  function clear() {
    for (const id of bots.keys()) removeRemote(id);
    bots.clear();
    activeKey = '';
    if (modes()) modes().assignTeams();
  }

  /* ---------------- senses ---------------- */
  function targetPos(t) { return t === 'player' ? player.pos : t; }
  function targetAlive(t) { return t === 'player' ? alive && !spawnShieldActive() : !!t && t.hp > 0 && bots.get(t.id) === t; }
  function clearSight(a, b) {
    const dx = b.x - a.x, dy = (b.y + 1.2) - (a.y + EYE), dz = b.z - a.z, dist = Math.hypot(dx, dy, dz);
    const steps = Math.ceil(dist / 0.7);
    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      if (solid(a.x + dx * f, a.y + EYE + dy * f, a.z + dz * f)) return false;
    }
    return true;
  }

  function enemy(bot, other) {
    if (!modeDef().teams) return true;
    const mine = teamOf(bot);
    const theirs = other === 'player' ? modes().localTeam : teamOf(other);
    return !mine || !theirs || mine !== theirs;
  }

  function think(bot, now) {
    const s = skill();
    let best = null, bestDist = s.sight;
    const consider = (t) => {
      if (!targetAlive(t) || !enemy(bot, t)) return;
      const p = targetPos(t), d = Math.hypot(p.x - bot.x, p.y - bot.y, p.z - bot.z);
      if (d < bestDist && clearSight(bot, p)) { best = t; bestDist = d; }
    };
    consider('player');
    for (const other of bots.values()) if (other !== bot) consider(other);
    if (best !== bot.target) { bot.target = best; bot.seenAt = now; }
    if (now > bot.strafeAt) { bot.strafe = Math.random() < 0.5 ? -1 : 1; bot.strafeAt = now + 700 + Math.random() * 1400; }
    if (!bot.goal || Math.hypot(bot.goal.x - bot.x, bot.goal.z - bot.z) < 3 || bot.stuck > 0.6) pickGoal(bot);
  }

  function pickGoal(bot) {
    bot.stuck = 0;
    const arena = modes() && typeof modes().arena === 'function' ? modes().arena() : null;
    const cx = arena && Number.isFinite(arena.x) ? arena.x : player.pos.x, cz = arena && Number.isFinite(arena.z) ? arena.z : player.pos.z;
    // Mostly head for the action, so a match never turns into a long walk.
    const near = Math.random() < 0.6;
    const spread = arena && arena.radius ? arena.radius * 0.8 : 32;
    const ox = near ? player.pos.x : cx, oz = near ? player.pos.z : cz;
    bot.goal = {
      x: Math.max(2, Math.min(WORLD - 2, ox + (Math.random() - 0.5) * spread)),
      z: Math.max(2, Math.min(WORLD - 2, oz + (Math.random() - 0.5) * spread))
    };
  }

  /* ---------------- movement ---------------- */
  function blocked(x, y, z) {
    return solid(x, y + 0.3, z) || solid(x, y + 1.2, z) || solid(x, y + 1.75, z);
  }

  function move(bot, dt) {
    const s = skill();
    let dx = 0, dz = 0;
    if (bot.target) {
      const p = targetPos(bot.target), w = WEAPON_BY_ID[bot.weapon];
      const tx = p.x - bot.x, tz = p.z - bot.z, d = Math.hypot(tx, tz) || 1;
      const want = Math.min(w ? w.range * 0.45 : 25, 28);
      const push = d > want + 3 ? 1 : d < want - 6 ? -1 : 0;
      dx = tx / d * push - tz / d * bot.strafe * 0.8;
      dz = tz / d * push + tx / d * bot.strafe * 0.8;
      bot.yaw = Math.atan2(tx, tz) + Math.PI;
    } else if (bot.goal) {
      const tx = bot.goal.x - bot.x, tz = bot.goal.z - bot.z, d = Math.hypot(tx, tz) || 1;
      dx = tx / d; dz = tz / d;
      bot.yaw = Math.atan2(tx, tz) + Math.PI;
    }
    const len = Math.hypot(dx, dz) || 1;
    const step = s.speed * dt;
    const nx = bot.x + dx / len * step, nz = bot.z + dz / len * step;
    const reach = Math.sign(dx) * 0.32, reachZ = Math.sign(dz) * 0.32;
    let moved = false;
    if (!blocked(nx + reach, bot.y, bot.z)) { bot.x = nx; moved = true; }
    if (!blocked(bot.x, bot.y, nz + reachZ)) { bot.z = nz; moved = true; }
    const hitWall = blocked(nx + reach, bot.y, nz + reachZ);
    if (hitWall && bot.grounded && !solid(nx + reach, bot.y + 2.3, nz + reachZ) && !solid(bot.x, bot.y + 2.3, bot.z)) bot.vy = 8.4;
    bot.stuck = moved && !hitWall ? 0 : bot.stuck + dt;
    if (bot.stuck > 0.6 && bot.target) bot.strafe = -bot.strafe;

    bot.vy -= GRAVITY * (modeDef().gravity || 1) * dt;
    bot.y += bot.vy * dt;
    const feet = Math.floor(bot.y - 0.02);
    bot.grounded = false;
    if (bot.vy <= 0 && solid(bot.x, feet, bot.z)) {
      bot.y = feet + 1;
      bot.vy = 0;
      bot.grounded = true;
    } else if (bmLiquidAt(Math.floor(bot.x), Math.floor(bot.y + 0.4), Math.floor(bot.z))) {
      bot.vy = Math.max(bot.vy, 2.6);
      bot.grounded = true;
    } else if (bot.vy > 0 && solid(bot.x, bot.y + 1.9, bot.z)) bot.vy = 0;
    bot.x = Math.max(1, Math.min(WORLD - 1, bot.x));
    bot.z = Math.max(1, Math.min(WORLD - 1, bot.z));
    if (bot.y < -6) spawnAt(bot);
  }

  /* ---------------- fighting ---------------- */
  function fire(bot, now, dt) {
    bot.cool -= dt;
    const w = WEAPON_BY_ID[bot.weapon], t = bot.target, s = skill();
    if (!w || !t || !targetAlive(t) || bot.cool > 0 || now < bot.reloadUntil || now - bot.seenAt < s.reaction) return;
    const p = targetPos(t), dist = Math.hypot(p.x - bot.x, p.y - bot.y, p.z - bot.z);
    if (dist > w.range) return;
    // Short bursts, so bots read as people and don't out-damage the player on rate.
    bot.cool = Math.max(60 / w.rpm, 1 / MAX_SHOTS_PER_S) * (Math.random() < 0.2 ? 4 : 1);
    bot.ammo--;
    bot.firingAt = now;
    bot.shieldUntil = 0;
    if (net.players.has(bot.id)) net.players.get(bot.id).shieldUntil = 0;
    if (bot.ammo <= 0) { bot.reloadUntil = now + (w.reload || 2) * 1000; bot.ammo = w.mag; }
    handleNet({ t: 'shot', id: bot.id, weapon: bot.weapon, shotId: 'bot' + (++serial), x: bot.x, y: bot.y + EYE, z: bot.z,
      yaw: bot.yaw, combat: 1, build: 0, aim: 0, firing: 1 }, bot.id);
    let hits = 0, head = false;
    const chance = s.aim * (1 - 0.6 * dist / w.range);
    for (let i = 0; i < (w.pellets || 1); i++) if (Math.random() < chance) { hits++; if (Math.random() < s.head) head = true; }
    const from = new THREE.Vector3(bot.x, bot.y + EYE, bot.z);
    const miss = hits ? 0 : 1 + dist * 0.05;
    const to = new THREE.Vector3(p.x + (Math.random() - 0.5) * miss, p.y + 1.2 + (Math.random() - 0.5) * miss, p.z + (Math.random() - 0.5) * miss);
    if (typeof addTracer === 'function') addTracer(from, to);
    if (!hits) return;
    const dmg = Math.round(hits * combatDamageCap(w, head) * (dist > w.range * 0.65 ? 0.8 : 1) * (modeDef().damage || 1));
    if (t === 'player') {
      applyDamage(dmg, bot.name, head, bot.id, { weapon: w.id, pos: from, killerPos: from });
      if (!alive) bot.kills++;
    } else hurt(t, dmg, head, bot, w.id);
  }

  function hurt(bot, dmg, head, killer, weapon) {
    if (bot.hp <= 0 || performance.now() < (bot.shieldUntil || 0)) return false;
    bot.hp = Math.max(0, bot.hp - dmg);
    if (killer && killer !== 'player') bot.target = bot.target || killer;
    else if (killer === 'player' && enemy(bot, 'player')) { bot.target = 'player'; bot.seenAt = bot.seenAt || performance.now(); }
    if (bot.hp > 0) return true;
    bot.deaths++;
    bot.target = null;
    bot.respawnAt = performance.now() + (modeDef().respawnMs || 3200);
    const byPlayer = killer === 'player';
    if (killer && !byPlayer) killer.kills++;
    if (byPlayer) {
      kills++;
      setKd();
      toast('You eliminated ' + bot.name);
      playTone(880, 0.08, 'triangle', 0.08);
    }
    const msg = { t: 'died', id: bot.id, victimId: bot.id, victim: bot.name, by: byPlayer ? playerName : killer ? killer.name : '', weapon, head,
      killId: 'botkill' + (++serial), deaths: bot.deaths, kills: bot.kills, killerKills: byPlayer ? kills : killer ? killer.kills : 0 };
    if (killer && !byPlayer) { msg.byId = killer.id; msg.killerId = killer.id; }
    handleNet(msg, bot.id);
    return true;
  }

  // A shot from the local player landed on a bot.
  window.botTakeHit = function (id, dmg, head, weapon) {
    const bot = bots.get(id);
    return bot ? hurt(bot, dmg, head, 'player', weapon) || true : false;
  };

  /* ---------------- frame ---------------- */
  function frame(dt, now, playing) {
    if (typeof net === 'undefined') return;
    if (net.mode || net.online) { if (bots.size) clear(); return; }
    if (worldBusy()) return;
    const key = (modes() ? modes().active : '') + ':' + SEED + ':' + config.count;
    if (key !== activeKey) {
      if (!playing && !activeKey) return;     // nothing happens until the player starts
      activeKey = key;
      fill();
    }
    if (!bots.size) return;
    const match = modes() ? modes().matchState() : null;
    const score = match ? (match.red || 0) + (match.blue || 0) : 0;
    if (score < lastScore) for (const bot of bots.values()) { bot.kills = bot.deaths = 0; bot.weapon = weaponFor(bot); }
    lastScore = score;
    // The match carries on through the player's own respawn timer.
    const running = (playing || !alive) && !(match && match.winner);
    for (const bot of bots.values()) {
      if (!running) continue;
      if (bot.hp <= 0) {
        if (now >= bot.respawnAt) {
          spawnAt(bot);
          bot.shieldUntil = now + SPAWN_SHIELD_MS;
          handleNet({ t: 'respawn', id: bot.id, hp: MAX_HEALTH, x: bot.x, y: bot.y, z: bot.z }, bot.id);
        }
        continue;
      }
      if (now >= bot.thinkAt) { bot.thinkAt = now + THINK_MS; think(bot, now); }
      if (bot.target && !targetAlive(bot.target)) bot.target = null;
      move(bot, Math.min(dt, 0.05));
      if (modeDef().ladder) { const want = weaponFor(bot); if (want !== bot.weapon) { bot.weapon = want; bot.ammo = (WEAPON_BY_ID[want] || {}).mag || 10; } }
      fire(bot, now, dt);
    }
    if (now - poseAt >= POSE_MS) {
      poseAt = now;
      for (const bot of bots.values()) if (bot.hp > 0) pose(bot);
    }
  }
  BC.on('frame', frame);

  /* ---------------- home menu ---------------- */
  const css = `
  .ui-bots { display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; margin-top: 8px; font-size: 13px; color: var(--ui-ink-2); }
  .ui-bots.is-off { display: none; }
  .ui-bots-row { display: flex; gap: 4px; }
  .ui-bots-row button { flex: 1; min-height: 34px; padding: 4px 8px; font: 800 13px/1 var(--ui-font); color: var(--ui-ink-2); cursor: pointer;
    background: var(--ui-2); border: 0; border-bottom: 3px solid var(--ui-edge); border-radius: var(--ui-r); }
  .ui-bots-row button[aria-pressed="true"] { background: var(--ui-accent); border-bottom-color: var(--ui-accent-edge); color: var(--ui-ink); }`;

  function save() {
    try { localStorage.setItem('blockcraft.bots', JSON.stringify(config)); } catch (e) { /* ignore */ }
  }

  function row(root, label, options, read, write) {
    const name = document.createElement('span');
    name.textContent = label;
    const box = document.createElement('div');
    box.className = 'ui-bots-row';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', label);
    const buttons = options.map(([value, text]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', () => { write(value); paint(); save(); });
      box.appendChild(b);
      return [b, value];
    });
    const paint = () => { for (const [b, value] of buttons) b.setAttribute('aria-pressed', String(read() === value)); };
    paint();
    root.append(name, box);
  }

  function mountMenu() {
    const anchor = document.getElementById('homeModeDesc');
    if (!anchor) return false;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.className = 'ui-bots';
    row(root, 'Bots', [[0, 'Off'], [1, '1'], [3, '3'], [5, '5'], [7, '7']], () => config.count, (v) => { config.count = v; });
    row(root, 'Skill', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], () => config.skill, (v) => { config.skill = v; });
    anchor.after(root);
    setInterval(() => { root.classList.toggle('is-off', typeof net !== 'undefined' && !!net.mode); }, 500);
    return true;
  }

  BC.api.bots = { list: bots, config };
  const tryMount = setInterval(() => { if (mountMenu()) clearInterval(tryMount); }, 300);
})();
