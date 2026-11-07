/* Blockcraft Battle Ground — Dragon health, death and respawn.
   47-dragon-life.js (after 45-dragons.js and 46-riding.js)
   Any dragon can be shot down and comes back on a timer. Offline this runs
   locally; in a room the host or LAN server owns health and every peer applies
   what it reports. The respawn timer runs on each peer, so a dragon still comes
   back when the host changes. */
'use strict';

const DRAGON_RESPAWN_MS = DRAGON_RULES ? DRAGON_RULES.respawnMs : 60000;
const DRAGON_BAR_MS = 4000;

let dragonBarEl = null, dragonBarFill = null, dragonBarName = null, dragonBarUntil = 0;

function dragonLifeOf(index) {
  const dragon = typeof dragons !== 'undefined' ? dragons[index] : null;
  if (!dragon) return null;
  if (!Number.isFinite(dragon.hp)) {
    const rules = DRAGON_RULES && DRAGON_RULES.descriptor(SEED, index);
    dragon.maxHp = rules && rules.maxHp ? rules.maxHp : 500;
    dragon.hp = dragon.maxHp;
  }
  return dragon;
}

function dragonLifeBar(dragon) {
  if (!dragonBarEl) {
    dragonBarEl = document.createElement('div');
    dragonBarEl.id = 'dragonBar';
    dragonBarEl.style.cssText = 'position:fixed;left:50%;top:68px;transform:translateX(-50%);z-index:30;pointer-events:none;display:none;' +
      'width:min(320px,70vw);text-align:center;font:700 12px/1 inherit;letter-spacing:.08em;color:#ffe9c9;text-shadow:0 1px 3px #000c';
    dragonBarName = document.createElement('div');
    const track = document.createElement('div');
    track.style.cssText = 'margin-top:5px;height:6px;background:#0008;border:1px solid #0009';
    dragonBarFill = document.createElement('div');
    dragonBarFill.style.cssText = 'height:100%;background:#e8622a;transform-origin:left';
    track.appendChild(dragonBarFill);
    dragonBarEl.append(dragonBarName, track);
    document.body.appendChild(dragonBarEl);
  }
  dragonBarName.textContent = dragon.name || 'Dragon';
  dragonBarFill.style.transform = 'scaleX(' + Math.max(0, dragon.hp / dragon.maxHp).toFixed(3) + ')';
  dragonBarEl.style.display = 'block';
  dragonBarUntil = performance.now() + DRAGON_BAR_MS;
}

function dragonLifeFall(dragon, index, rest, by, instant) {
  dragon.down = true;
  dragon.fall = 0;
  dragon.downUntil = performance.now() + rest;
  if (dragon.tag) dragon.tag.visible = false;
  if (instant) { dragon.group.visible = false; return; }
  const riding = BC.api.riding;
  if (riding && riding.active && riding.dragon === dragon && typeof riding.dismount === 'function') riding.dismount('lease');
  BC.emit('sfx', { kind: 'dragonDeath', position: dragon.group.position.clone(), volume: 1 });
  if (by && typeof addKillFeed === 'function') addKillFeed(by, dragon.name || 'a dragon', { weapon: 'slain' });
}

function dragonLifeRevive(dragon) {
  dragon.down = false;
  dragon.hp = dragon.maxHp;
  dragon.fall = 0;
  dragon.group.visible = true;
  dragon.group.rotation.set(0, 0, 0, 'YXZ');
  if (dragon.motion) dragon.motion.ready = false;
  if (typeof dragonResumeAmbient === 'function') dragonResumeAmbient(dragon);
  BC.emit('sfx', { kind: 'dragonSpawn', position: dragon.group.position.clone(), volume: 0.6 });
}

// Applies what the authority decided, on every peer.
function dragonLifeReceive(msg) {
  if (!msg || !Array.isArray(msg.list)) return;
  for (const entry of msg.list) {
    if (!Array.isArray(entry) || entry.length !== 3) continue;
    const dragon = dragonLifeOf(entry[0]), hp = entry[1], rest = entry[2];
    if (!dragon || !Number.isFinite(hp) || !Number.isFinite(rest)) continue;
    dragon.hp = Math.max(0, Math.min(dragon.maxHp, hp));
    if (rest > 0) { if (!dragon.down) dragonLifeFall(dragon, entry[0], Math.min(rest, DRAGON_RESPAWN_MS), msg.by, !!msg.snapshot); }
    else if (!msg.snapshot) dragonLifeBar(dragon);
  }
}

// Authority side: offline, or the room host.
function dragonLifeDamage(index, dmg, byId, byName) {
  const dragon = dragonLifeOf(index);
  if (!dragon || dragon.down) return false;
  const hp = Math.max(0, dragon.hp - dmg), packet = { t: 'dragonLife', list: [[index, hp, hp <= 0 ? DRAGON_RESPAWN_MS : 0]], by: hp <= 0 ? byName : undefined, byId };
  if (typeof net !== 'undefined' && net.online && typeof netMqttAuthority === 'function') netMqttAuthority(packet);
  else dragonLifeReceive(packet);
  return hp <= 0;
}

// What a newcomer needs to see the same dragons.
function dragonLifeSnapshot() {
  const list = [], now = performance.now();
  for (let i = 0; i < dragons.length; i++) {
    const d = dragons[i];
    if (Number.isFinite(d.hp) && (d.down || d.hp < d.maxHp)) list.push([i, d.hp, d.down ? Math.max(1, d.downUntil - now) : 0]);
  }
  return list.length ? { t: 'dragonLife', list, snapshot: 1 } : null;
}

// The local player's shot landed on a dragon.
function dragonLifeShot(index, dmg, weaponId) {
  const dragon = dragonLifeOf(index);
  if (!dragon || dragon.down) return false;
  dragonLifeBar(dragon);
  const offline = typeof net === 'undefined' || (!net.online && !net.mode);
  if (offline) dragonLifeDamage(index, dmg, '', typeof playerName === 'string' ? playerName : 'You');
  else netSend({ t: 'dragonHit', dragon: index, dmg, weapon: weaponId, byId: net.id, by: playerName });
  return true;
}

BC.on('frame', function () {
  const now = performance.now();
  if (typeof dragons !== 'undefined') {
    for (let i = 0; i < dragons.length; i++) {
      if (dragons[i].down && now >= dragons[i].downUntil) dragonLifeRevive(dragons[i]);
    }
  }
  if (dragonBarEl && dragonBarUntil && now >= dragonBarUntil) { dragonBarEl.style.display = 'none'; dragonBarUntil = 0; }
}, 46);
