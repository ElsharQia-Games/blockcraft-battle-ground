'use strict';

function solidDragonProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const world = k.world(), restores = b.dragons.map((d) => k.graph(d.group));
    const guardian = b.dragons.find((d) => d.type === 'guardian'), mount = b.dragons.find((d) => d.type === 'mount');
    const sync = k.api('dragonSyncCollider'), bodies = b.dragonBodies, y = b.HEIGHT - 10;
    try {
      guardian.group.position.set(128, y, 128); guardian.group.rotation.set(0, 0, 0);
      sync(guardian);
      const inside = { x: 128, y: y - 0.3, z: 128, w: 0.3, h: 1.8 };
      check(bodies.overlapsAabb(inside) && b.physics.overlaps(inside), 'Dragon body is a diagnostic box but not a solid physics body');
      check(!bodies.overlapsAabb({ ...inside, ignoreDragonIndex: guardian.index }), 'Dragon sweep cannot exclude its own body');
      const start = { x: 128, y: y - 0.3, z: 150, w: 0.3, h: 1.8 };
      const moved = b.physics.sweepAabb(start, 0, 0, -40, {});
      check(moved.hitZ && !bodies.overlapsAabb({ ...start, x: moved.x, y: moved.y, z: moved.z }),
        'Swept actor tunnels through an indestructible guardian', moved);
      b.setCombatMode(true); b.thirdPerson = false;
      b.player.pos.set(128, y - 1.62, 146); b.player.pitch = b.player.yaw = 0;
      b.selectWeapon(b.WEAPONS.findIndex((w) => w.id === 'pistol'));
      b.gun.cooldown = b.gun.reloading = 0; b.gun.aiming = true;
      b.updateCamera(0); b.camera.updateMatrixWorld(true);
      const direction = b.camera.getWorldDirection(new b.THREE.Vector3());
      const hit = bodies.raycast(b.camera.position, direction, 90);
      check(hit && hit.index === guardian.index && hit.distance > 0, 'Bullet trace ignores guardian body');
      const before = world.snapshot(), kills = b.kills, ammo = b.gun.ammo[b.gun.index];
      b.fireOnce();
      check(b.gun.ammo[b.gun.index] === ammo - 1 && b.kills === kills && guardian.indestructible && guardian.invulnerable,
        'Guardian hit changes immunity/score or fails to consume the shot');
      check(world.changes(before).length === 0, 'Guardian shot damages cover behind its collision body');

      restores[guardian.index](); sync(guardian);
      mount.group.position.set(128, y, 128); mount.group.rotation.set(0, 0, 0); sync(mount);
      const bounds = bodies.getCollider(mount.index, {});
      const forward = new b.THREE.Vector3(0, 0, -1), origin = new b.THREE.Vector3(128, y, bounds.maxZ + 1);
      const intersection = bodies.raycast(origin, forward, 6.5);
      check(intersection && intersection.index === mount.index, 'Small mount has no body trace');
      const targetZ = Math.floor(bounds.minZ) - 1;
      check(origin.z - (targetZ + 1) < 6.5, 'Small-mount building fixture is beyond reach');
      b.setBlock(128, y, targetZ, k.api('STONE'));
      b.player.pos.set(origin.x, origin.y - 1.62, origin.z); b.player.pitch = b.player.yaw = 0;
      b.setCombatMode(false); b.updateCamera(0); b.camera.updateMatrixWorld(true);
      check(b.features.building.lineHitsSolidDragon(origin, new b.THREE.Vector3(128.5, y + 0.5, targetZ + 0.5)),
        'Building line-of-sight does not see a small mount');
      b.breakBlock();
      check(b.getBlock(128, y, targetZ) === k.api('STONE'), 'Mining reaches through a solid dragon');
      const snapshot = world.snapshot(); b.placeBlock();
      check(world.changes(snapshot).length === 0, 'Traditional placement reaches through a solid dragon');
      check(k.api('buildVoxelHitsSolidDragon')(128, y, 128), 'Construction cell checks ignore dragon bodies');
      return { sweptBody: true, guardianImmune: true, bulletsBlocked: true, buildAndMineBlocked: true,
        guardianIndex: guardian.index, mountIndex: mount.index };
    } finally {
      world.restore(); restores.forEach((restore) => restore()); b.dragons.forEach((d) => sync(d));
    }
  });
}

function ridingProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const world = k.world(), restores = b.dragons.map((d) => k.graph(d.group));
    const nowOriginal = b.BC.now, sync = k.api('dragonSyncCollider'), ride = b.riding;
    let now = performance.now(); b.BC.now = () => now;
    const step = (dt = 1 / 60, elapsed = dt * 1000) => { now += elapsed; ride.update(dt, now); };
    const rows = [];
    try {
      const mounts = b.dragons.filter((d) => d.type === 'mount');
      check(mounts.length >= 2 && mounts.every((d) => ride.rideable(d)), 'Not every spawned small mount is rideable');
      for (let index = 0; index < mounts.length; index++) {
        world.restore();
        const dragon = mounts[index];
        dragon.group.position.set(128, b.HEIGHT - 10, 136); dragon.group.rotation.set(0, 0, 0); sync(dragon);
        b.player.pos.set(132.5, b.HEIGHT - 10, 136); b.player.pitch = b.player.yaw = 0;
        b.player.vel.set(0, 0, 0); b.player.fly = false;
        check(ride.mountNearest(), 'Eligible small dragon could not be mounted by a player', dragon.index);
        check(ride.active && ride.dragon === dragon && ride.remaining <= 30 && ride.remaining > 29,
          'Ride lease/timer is not the requested 30-second mount', { active: ride.active, remaining: ride.remaining });
        step();
        const remaining = ride.remaining, position = dragon.group.position.clone();
        ride.update(1 / 60, now);
        check(dragon.group.position.distanceTo(position) < 1e-7 && Math.abs(ride.remaining - remaining) < 0.03,
          'Same frame advances a ride twice');
        check(!b.physics.overlapsVoxels(ride.collision.core) && ride.collision.camera.clear && ride.collision.camera.nearPlaneClear,
          'Mounted core/camera begins inside geometry', ride.collision);
        if (index === 0) {
          const wallZ = 128, rootY = b.HEIGHT - 10;
          for (let x = 122; x <= 134; x++) for (let y = rootY - 5; y <= rootY + 7; y++) b.setBlock(x, y, wallZ, k.api('STONE'));
          k.key('KeyW'); k.key('ShiftLeft');
          for (let i = 0; i < 90; i++) step();
          check(ride.active && ride.collision.hitZ && !b.physics.overlapsVoxels(ride.collision.core),
            'Boosted ride crosses a one-voxel wall or ends unexpectedly', ride.collision);
          k.key('KeyW', false); k.key('ShiftLeft', false);
          for (let x = 122; x <= 134; x++) for (let y = rootY - 5; y <= rootY + 7; y++) b.setBlock(x, y, wallZ, k.api('AIR'));
          const beforePass = dragon.group.position.z;
          for (let i = 0; i < 30; i++) step();
          check(dragon.group.position.z < beforePass - 2, 'Removing a wall does not release dragon movement');
          k.key('KeyC'); const beforeDown = dragon.group.position.y;
          for (let i = 0; i < 10; i++) step();
          check(dragon.group.position.y < beforeDown, 'C does not descend on a mount');
          k.key('Space'); k.key('ShiftLeft'); const beforeUp = dragon.group.position.y;
          for (let i = 0; i < 10; i++) step();
          check(dragon.group.position.y > beforeUp, 'C/boost cancels mounted Space ascent');
          k.key('Space', false); k.key('KeyC', false); k.key('ShiftLeft', false);
          b.renderer.domElement.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }));
          for (let i = 0; i < 21; i++) step(1 / 60, 200);
          check(ride.overheated && ride.heat >= 0.99 && !ride.fireBreath(), 'Held dragon fire bypasses its heat limit');
          b.renderer.domElement.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true, cancelable: true }));
          step(0, 4000);
          check(!ride.overheated && ride.heat <= 0.25, 'Released dragon fire does not cool');
        }
        const lease = { index: dragon.index, remaining: ride.remaining, coreHeight: ride.collision.core.h };
        step(0, 31_000);
        check(!ride.active && ride.remaining === 0 && !document.body.classList.contains('riding'), 'Dragon riding renews past its 30-second limit');
        rows.push(lease);
      }
      return { allMounts: rows, oneClock: true, collisions: true, heatLimit: true, higherAscent: true, timeout: true };
    } finally {
      if (ride.active || ride.pending) ride.dismount('test-cleanup');
      b.BC.now = nowOriginal; world.restore(); restores.forEach((restore) => restore()); b.dragons.forEach((d) => sync(d));
    }
  });
}

module.exports = { solidDragonProbe, ridingProbe };
