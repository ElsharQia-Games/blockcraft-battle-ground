/* Blockcraft Battle Ground — Spawn protection.
   61-spawn-shield.js
   Three seconds of immunity after every respawn, so nobody dies on arrival.
   Firing ends it early: a protected player can leave or fight, not both.
   The room authority enforces this. These timers only drive what players see
   and let offline bots and the shooter's own feedback agree with it. */
'use strict';

const SPAWN_SHIELD_MS = 3000;
let spawnShieldUntil = 0;

function spawnShieldActive() { return performance.now() < spawnShieldUntil; }
function spawnShieldPeerActive(peer) { return !!peer && performance.now() < (peer.shieldUntil || 0); }

(function () {
  const WARN_MS = 800;   // flickers out so its end is never a surprise
  const geometry = new THREE.BoxGeometry(1.05, 2.15, 1.05);
  const material = new THREE.MeshBasicMaterial({
    color: 0x9fe8ff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  });
  let badge = null, bar = null, shown = false;

  function ensureBadge() {
    if (badge) return;
    badge = document.createElement('div');
    badge.id = 'spawnShield';
    badge.style.cssText = 'position:fixed;left:50%;top:26%;transform:translateX(-50%);z-index:30;pointer-events:none;display:none;' +
      'font:700 13px/1 inherit;letter-spacing:.14em;color:#c9f3ff;text-shadow:0 1px 3px #000c;text-align:center';
    const label = document.createElement('div');
    label.textContent = 'PROTECTED';
    const track = document.createElement('div');
    track.style.cssText = 'margin-top:6px;width:120px;height:3px;background:#0006';
    bar = document.createElement('div');
    bar.style.cssText = 'height:100%;background:#9fe8ff;transform-origin:left';
    track.appendChild(bar);
    badge.append(label, track);
    document.body.appendChild(badge);
  }

  function showShield(holder, group, active) {
    if (!group) return;
    if (!active) { if (holder.shieldMesh) holder.shieldMesh.visible = false; return; }
    if (!holder.shieldMesh || holder.shieldMesh.parent !== group) {
      holder.shieldMesh = new THREE.Mesh(geometry, material);
      holder.shieldMesh.name = 'spawn-shield';
      holder.shieldMesh.position.y = 1;
      holder.shieldMesh.userData.noOutline = true;
      group.add(holder.shieldMesh);
    }
    holder.shieldMesh.visible = true;
  }

  BC.on('respawn', function () { spawnShieldUntil = performance.now() + SPAWN_SHIELD_MS; }, 0);
  BC.on('shot', function () { spawnShieldUntil = 0; }, 0);

  BC.on('frame', function () {
    const now = performance.now(), left = spawnShieldUntil - now;
    material.opacity = 0.2 + 0.1 * Math.sin(now * 0.012);
    if (typeof net !== 'undefined' && net && net.players) {
      for (const peer of net.players.values()) {
        const rest = (peer.shieldUntil || 0) - now;
        if (rest > 0 || peer.shieldMesh) showShield(peer, peer.group, rest > 0 && (rest > WARN_MS || Math.floor(now / 90) % 2 === 0));
      }
    }
    const on = left > 0 && alive;
    if (on) {
      ensureBadge();
      bar.style.transform = 'scaleX(' + Math.max(0, left / SPAWN_SHIELD_MS).toFixed(3) + ')';
    }
    if (on !== shown && badge) badge.style.display = on ? 'block' : 'none';
    shown = on;
  }, 45);

  BC.api.spawnShield = { get active() { return spawnShieldActive(); }, duration: SPAWN_SHIELD_MS };
})();
