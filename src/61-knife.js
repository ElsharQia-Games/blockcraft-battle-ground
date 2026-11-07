/* Blockcraft Battle Ground — Knife.
   61-knife.js (after 60-combat.js)
   Left mouse is a fast three-swing combo, right mouse a slow heavy stab that
   kills from behind. Y draws it and puts it away. You move faster with it out.
   A swing reaches the host as an ordinary shot and hit, so the same fire rate,
   range, team and spawn-protection checks apply. */
'use strict';

const KNIFE_RANGE = 3.2;
const KNIFE_CONE = 0.72;              // cosine: about 44 degrees either side
const KNIFE_COMBO_GAP_MS = 900;
const KNIFE_SLASH = { damage: [40, 40, 55], cool: 0.42, hitAfterMs: 90 };
const KNIFE_STAB = { damage: 90, backstab: 150, cool: 1.0, hitAfterMs: 220 };
const KNIFE_SPEED = 1.12;
const KNIFE_BLOCK_DAMAGE = 40;

let knifeChain = 0, knifeSwingAt = -Infinity, knifeReturnIndex = -1;
const knifeOut = { distance: 0, block: null, dragon: null, dragonIndex: -1, kind: 'none' };

function knifeMoveScale() {
  return alive && combatMode && !combatQuickBuilding() && currentWeapon().melee ? KNIFE_SPEED : 1;
}

function knifeSource() {
  return { x: player.pos.x, y: player.pos.y + combatBodyHeight(player) * 0.8, z: player.pos.z };
}

// True when the attacker stands behind the target.
function knifeBehind(r, dx, dz) {
  const yaw = Number.isFinite(r.yaw) ? r.yaw : r.group.rotation.y;
  return -Math.sin(yaw) * dx - Math.cos(yaw) * dz > 0.5;
}

function knifeFindTarget(from, dir) {
  let best = null, bestDist = Infinity;
  const now = performance.now();
  for (const r of net.players.values()) {
    if (!combatPeerEligible(r, now)) continue;
    const pos = r.group.position;
    const dx = pos.x - from.x, dy = pos.y + 1 - from.y, dz = pos.z - from.z, dist = Math.hypot(dx, dy, dz);
    if (dist > KNIFE_RANGE || dist >= bestDist || dist < 0.001) continue;
    if ((dx * dir.x + dy * dir.y + dz * dir.z) / dist < KNIFE_CONE) continue;
    if (!MODES_clearSight(from.x, from.y, from.z, pos.x, pos.y + 1, pos.z)) continue;
    best = { r, dx, dz, dist, pos };
    bestDist = dist;
  }
  return best;
}

function knifeImpact(heavy, swing) {
  if (!alive || !combatMode || combatActionBlocked() || !currentWeapon().melee) return;
  const w = currentWeapon(), source = knifeSource();
  const from = new THREE.Vector3(source.x, source.y, source.z);
  const dir = camera.getWorldDirection(new THREE.Vector3()).normalize();
  netSend({ ...combatNetState('shot'), x: from.x, y: from.y, z: from.z });
  const target = knifeFindTarget(from, dir);
  let hit = false;
  if (target && spawnShieldPeerActive(target.r)) {
    combatEmit('sfx', { kind: 'shieldBlock', position: target.pos.clone(), volume: 0.5 });
    addImpact(target.pos.clone().addScaledVector(combatWorldUp, 1), '#9fe8ff', { weapon: w.id, silent: true });
  } else if (target) {
    const back = heavy && knifeBehind(target.r, target.dx / target.dist, target.dz / target.dist);
    const dmg = heavy ? (back ? KNIFE_STAB.backstab : KNIFE_STAB.damage) : KNIFE_SLASH.damage[swing];
    if (!(typeof window.botTakeHit === 'function' && window.botTakeHit(target.r.id, dmg, false, w.id))) {
      netSend({ t: 'hit', target: target.r.id, dmg, head: false, weapon: w.id, byId: net.id, by: playerName });
    }
    hit = true;
    addImpact(target.pos.clone().addScaledVector(combatWorldUp, 1), '#b83030', { weapon: w.id, silent: true });
    combatEmit('sfx', { kind: 'knifeHit', position: target.pos.clone(), volume: 0.8 });
    flashHitmarker(back);
    const fx = combatApi('combatFx');
    if (fx && typeof fx.hitFeedback === 'function') { try { fx.hitFeedback(back, target.r.name || ''); } catch (e) { /* optional */ } }
    if (back) toast('Backstab');
  } else {
    const solid = combatRaycastSolid(from, dir, KNIFE_RANGE, knifeOut);
    const end = from.clone().addScaledVector(dir, solid.distance);
    if (solid.kind === 'dragon') {
      if (dragonLifeShot(solid.dragonIndex, KNIFE_BLOCK_DAMAGE, w.id)) combatEmit('sfx', { kind: 'dragonHit', position: end.clone(), volume: 0.7 });
      addImpact(end, '#e8af57', { weapon: w.id, silent: true });
    } else if (solid.block) {
      addImpact(end, '#cbb593', { weapon: w.id, silent: true });
      combatEmit('sfx', { kind: 'knifeHit', position: end.clone(), volume: 0.35 });
      if (typeof damageVoxelFromShot === 'function') damageVoxelFromShot(solid.block, w.id, KNIFE_BLOCK_DAMAGE);
    }
  }
  combatEmit('shot', { weapon: w.id, from: from.clone(), to: from.clone().addScaledVector(dir, KNIFE_RANGE), hit: true, head: false, targetId: target ? target.r.id : null });
  if (hit && BC.api.vfx) BC.api.vfx.addTrauma(heavy ? 0.4 : 0.22);
}

function knifeAttack(heavy) {
  if (!alive || !combatMode || combatQuickBuilding() || combatActionBlocked()) { combatReleaseGun(); return; }
  const w = currentWeapon();
  if (!w.melee || gun.cooldown > 0) return;
  const now = performance.now();
  if (now - knifeSwingAt > KNIFE_COMBO_GAP_MS) knifeChain = 0;
  knifeSwingAt = now;
  const swing = heavy ? 3 : knifeChain;
  if (!heavy) knifeChain = (knifeChain + 1) % 3;
  const move = heavy ? KNIFE_STAB : KNIFE_SLASH;
  gun.cooldown = move.cool;
  gun.firePose = gun.kick = 1;
  gun.shotAge = 0;
  gun.shots[gun.index]++;
  const model = localAvatar && localAvatar.userData.gun;
  if (model) model.userData.knifeSwing = swing;
  combatEmit('sfx', { kind: heavy ? 'knifeStab' : 'knifeSlash', position: combatSourcePosition(), volume: 0.8 });
  setTimeout(knifeImpact, move.hitAfterMs, heavy, swing);
}

// Y: out with the knife, and back to the gun you were holding.
function knifeToggle() {
  const index = WEAPONS.findIndex((w) => w.melee);
  if (index < 0 || !combatMode) return;
  if (gun.index === index) { if (knifeReturnIndex >= 0) selectWeapon(knifeReturnIndex); return; }
  if (!combatWeaponAllowed(WEAPONS[index])) return;
  knifeReturnIndex = gun.index;
  selectWeapon(index);
}
