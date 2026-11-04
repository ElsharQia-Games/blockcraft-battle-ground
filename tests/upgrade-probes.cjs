'use strict';

function outlineProbe() {
  const k = window.__bcTest, { b, check } = k;
  const add = k.api('addCharacterOutline');
  check(typeof k.api('updateCharacterOutlines') === 'function', 'Outline update is not integrated');
  return k.state(() => b.CHAR_KEYS.map((key) => {
    b.setCharacter(key);
    const root = b.localAvatar();
    const resources = () => {
      const nodes = [], geometry = new Set(), material = new Set();
      root.traverse((node) => {
        nodes.push(node.uuid);
        if (node.geometry) geometry.add(node.geometry.uuid);
        for (const m of node.material ? Array.isArray(node.material) ? node.material : [node.material] : []) material.add(m.uuid);
      });
      return { nodes, geometry: [...geometry], material: [...material] };
    };
    const before = resources();
    for (let i = 0; i < 8; i++) add(root);
    check(JSON.stringify(resources()) === JSON.stringify(before), 'Adding an outline repeatedly grew resources', key);
    const strokes = [];
    root.traverse((node) => {
      for (const material of node.material ? Array.isArray(node.material) ? node.material : [node.material] : []) {
        if (!node.isLineSegments && !(node.isMesh && material.side === b.THREE.BackSide)) continue;
        check(material.depthTest && material.opacity > 0 && node.visible, 'Outline is invisible or draws through foreground cover', { key, name: node.name });
        const color = material.color || Object.values(material.uniforms || {}).find((u) => u.value?.isColor)?.value;
        strokes.push({ name: node.name, type: node.type, material: material.type, depthTest: material.depthTest,
          opacity: material.opacity, color: color?.getHexString() || null });
      }
    });
    check(strokes.length > 0, 'Character factory produced no renderable outline', { key, userData: Object.keys(root.userData) });
    k.model(root);
    return { key, strokes, nodeCount: before.nodes.length, geometryCount: before.geometry.length, materialCount: before.material.length };
  }));
}

function destructionProbe() {
  const k = window.__bcTest, { b, check } = k;
  for (const name of ['damageVoxelFromShot', 'applyVoxelDamage', 'updateDestruction']) check(typeof k.api(name) === 'function', 'Missing destruction API ' + name);
  const damage = k.api('voxelDamageMap');
  return k.state(() => {
    const world = k.world(), savedDamage = new Map(damage);
    try {
      b.setCombatMode(true); b.thirdPerson = false; b.player.fly = true;
      b.selectWeapon(b.WEAPONS.findIndex((w) => w.id === 'pistol'));
      b.gun.trigger = b.gun.aiming = false;
      b.gun.reloading = 0;
      b.gun.ammo[b.gun.index] = b.WEAPONS[b.gun.index].mag;
      const y = b.HEIGHT - 8;
      const writes = [];
      for (let x = 124; x <= 132; x++) for (let z = 125; z <= 135; z++) for (let py = y - 3; py <= y + 3; py++) {
        b.setBlock(x, py, z, k.api('AIR')); writes.push({ x, y: py, z });
      }
      world.dirty(writes);
      b.player.pos.set(128.5, y + 0.5 - 1.62, 132.5);
      k.optional('resetPlayerMotion')?.();
      b.player.fly = true;
      const fireAt = (target) => {
        const w = b.WEAPONS[b.gun.index];
        if (b.gun.ammo[b.gun.index] === 0) {
          b.startReload();
          for (let i = 0; i < Math.ceil(w.reload * 120) + 2; i++) b.updateCombat(1 / 120, performance.now());
        }
        b.updateCamera(1 / 60);
        const direction = new b.THREE.Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5).sub(b.camera.position).normalize();
        b.player.yaw = Math.atan2(-direction.x, -direction.z); b.player.pitch = Math.asin(direction.y);
        b.updateCamera(1 / 60);
        const hit = k.api('raycastVoxel')(w.range, b.camera.position, b.camera.getWorldDirection(new b.THREE.Vector3()));
        check(hit, 'Destruction shot has no real voxel target');
        b.gun.cooldown = 0;
        const ammo = b.gun.ammo[b.gun.index];
        b.fireOnce();
        check(b.gun.ammo[b.gun.index] === ammo - 1, 'Destruction probe did not fire a real bullet');
        return hit;
      };
      const trials = [];
      for (const [name, type] of [['weak-planks', k.api('PLANKS')], ['strong-stone', k.api('STONE')]]) {
        const target = { x: 128, y, z: 128 };
        b.setBlock(target.x, target.y, target.z, type); k.api('markDirty')(target.x, target.z);
        let shots = 0, partial = false;
        while (shots < 32 && b.getBlock(target.x, target.y, target.z) !== k.api('AIR')) {
          const hit = fireAt(target); shots++;
          check(hit.x === target.x && hit.y === target.y && hit.z === target.z, 'Destruction shot hit a different block', hit);
          if (b.getBlock(target.x, target.y, target.z) !== k.api('AIR')) {
            partial = true;
            check(damage.size > savedDamage.size, 'Partial voxel damage was not tracked');
          }
        }
        check(b.getBlock(target.x, target.y, target.z) === k.api('AIR'), 'Repeated bullets never destroyed the voxel', { name, shots });
        trials.push({ name, type, shots, partial });
      }
      check(trials[1].partial && trials[1].shots > 1 && trials[1].shots > trials[0].shots, 'Weak/strong materials have no meaningful multi-hit resistance difference', trials);

      // Aim through an open corridor at the actual y=0 ray hit. Record that hit,
      // rather than claiming protection for a nearby block the bullet never reached.
      for (let x = 124; x <= 132; x++) for (let z = 125; z <= 135; z++) for (let py = 1; py <= 7; py++) b.setBlock(x, py, z, k.api('AIR'));
      b.player.pos.set(128.5, 2.2, 132.5); k.optional('resetPlayerMotion')?.(); b.player.fly = true;
      const protectedHits = [];
      for (let i = 0; i < 8; i++) {
        const hit = fireAt({ x: 128, y: 0, z: 128 });
        check(hit.y === 0 && b.getBlock(hit.x, hit.y, hit.z) !== k.api('AIR'), 'Bullet destroyed protected y=0 terrain', hit);
        protectedHits.push({ x: hit.x, y: hit.y, z: hit.z });
      }
      return { trials, protectedHits, trackedDamage: damage.size };
    } finally {
      world.restore();
      k.api('updateDestruction')(1, performance.now() + 120_000);
      damage.clear();
      for (const [key, value] of savedDamage) damage.set(key, value);
    }
  });
}

module.exports = { outlineProbe, destructionProbe };
