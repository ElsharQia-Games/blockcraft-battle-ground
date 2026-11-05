'use strict';

const WEAPONS = ['pistol', 'rifle', 'shotgun', 'smg', 'sniper', 'revolver', 'lmg'];

function weaponProbe(expected) {
  const k = window.__bcTest, { b, check } = k;
  check(JSON.stringify(b.WEAPONS.map((w) => w.id).sort()) === JSON.stringify([...expected].sort()), 'Expected seven distinct weapons', b.WEAPONS.map((w) => w.id));
  return k.state(() => {
    b.setCombatMode(true);
    b.thirdPerson = false;
    b.player.pos.set(128, b.HEIGHT + 8, 128);
    b.player.pitch = 0;
    b.updateCamera(1 / 60);
    b.camera.updateMatrixWorld(true);
    let now = performance.now();
    const step = (seconds) => {
      let remaining = seconds;
      while (remaining > 1e-7) {
        const dt = Math.min(1 / 120, remaining);
        remaining -= dt; now += dt * 1000;
        b.updateCombat(dt, now); b.updateAvatar(dt);
      }
    };
    const guns = () => [k.api('viewGun'), b.localAvatar().userData.gun];
    const poses = () => guns().map(k.pose);
    const difference = (a, c) => Math.max(...a.map((p, i) => k.poseDistance(p, c[i])));
    const rows = [], signatures = [];
    for (let index = 0; index < b.WEAPONS.length; index++) {
      const w = b.WEAPONS[index];
      check([w.mag, w.rpm, w.range, w.reload, w.damage].every((n) => Number.isFinite(n) && n > 0), 'Invalid weapon configuration', w.id);
      b.selectWeapon(index);
      b.gun.trigger = b.gun.aiming = false;
      b.gun.cooldown = b.gun.reloading = 0;
      const models = guns().map(k.model);
      signatures.push(JSON.stringify({ pose: k.pose(guns()[0]), size: models[0].size }));
      for (const g of guns()) {
        check(g.userData.muzzle?.isObject3D, 'Gun has no muzzle', w.id);
        check(g.userData.muzzle.getWorldPosition(new b.THREE.Vector3()).toArray().every(Number.isFinite), 'Non-finite muzzle', w.id);
      }
      b.gun.ammo[index] = w.mag;
      // Compare reload recovery with the ready pose, not a shot mechanism
      // still cycling (the sniper bolt takes 1.08s; the cylinder indexes).
      const neutral = poses();
      b.fireOnce();
      check(b.gun.ammo[index] === w.mag - 1, 'Real fire did not consume one round', w.id);
      b.fireOnce();
      check(b.gun.ammo[index] === w.mag - 1, 'Cooldown allowed an immediate second shot', w.id);
      step(Math.max(0.7, w.handling.cycle + 0.05));
      const initialAmmo = b.gun.ammo[index];
      b.startReload();
      const duration = b.gun.reloading;
      check(duration > 0 && b.gun.ammo[index] === initialAmmo, 'Reload refilled immediately or did not start', w.id);
      b.gun.cooldown = 0;
      b.fireOnce();
      check(b.gun.ammo[index] === initialAmmo, 'Gun fired during reload', w.id);
      step(duration * 0.35);
      const first = poses();
      step(duration * 0.35);
      const second = poses();
      const articulation = Math.max(difference(neutral, first), difference(neutral, second));
      check(articulation > 0.002, 'Reload has no intermediate child/component motion', w.id);
      check(b.gun.reloading > 0 && b.gun.ammo[index] === initialAmmo, 'Reload completed prematurely', w.id);
      guns().forEach(k.model);
      step(duration * 0.35 + 0.3);
      check(b.gun.reloading === 0 && b.gun.ammo[index] === w.mag, 'Reload did not complete at magazine capacity', w.id);
      check(difference(neutral, poses()) < 0.002, 'Reload left an offset/hidden gun component', w.id);

      // Interrupt a partially played animation, then return to that weapon.
      b.gun.ammo[index] = Math.max(0, w.mag - 2);
      const interruptedAmmo = b.gun.ammo[index];
      b.startReload(); step(duration * 0.35);
      b.selectWeapon((index + 1) % b.WEAPONS.length);
      check(b.gun.reloading === 0, 'Switch did not cancel reload', w.id);
      b.selectWeapon(index); step(0.3);
      check(b.gun.ammo[index] === interruptedAmmo, 'Interrupted reload gave ammunition', w.id);
      check(difference(neutral, poses()) < 0.002, 'Switch kept stale reload component pose', w.id);

      b.startReload(); step(duration * 0.35);
      b.gun.trigger = b.gun.aiming = true;
      b.applyDamage(300, 'Regression');
      check(!b.alive && b.gun.reloading === 0 && !b.gun.trigger && !b.gun.aiming, 'Death did not release combat/reload state', w.id);
      check(difference(neutral, poses()) < 0.002, 'Death left reload components displaced', w.id);
      b.doRespawn();
      check(b.alive && b.health === 150 && b.gun.reloading === 0, 'Respawn did not reset combat state', w.id);
      check(b.gun.ammo.every((n, i) => n === b.WEAPONS[i].mag), 'Respawn did not refill every weapon');
      check(difference(neutral, poses()) < 0.002, 'Respawn kept stale reload component pose', w.id);
      rows.push({ weapon: w.id, duration, articulation, models });
      b.player.pos.set(128, b.HEIGHT + 8, 128); b.updateCamera(1 / 60);
    }
    check(new Set(signatures).size === 7, 'New weapon model silently falls back to an existing model');
    return rows;
  });
}

function hipfireProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    b.setCombatMode(true);
    b.thirdPerson = true;
    b.player.pos.set(128, b.HEIGHT + 8, 128);
    b.player.groundSpeed = 0;
    const rows = [];
    for (const id of ['pistol', 'rifle']) {
      b.selectWeapon(b.WEAPONS.findIndex((w) => w.id === id));
      for (const yaw of [-2.4, -0.6, 0.75, 2.6]) for (const pitch of [-0.45, 0.45]) {
        b.player.yaw = yaw; b.player.pitch = pitch;
        b.gun.aiming = false;
        b.gun.trigger = true;
        if ('firePose' in b.gun) b.gun.firePose = 0.35;
        for (let i = 0; i < 45; i++) b.updateAvatar(1 / 120);
        b.updateCamera(1 / 60);
        const avatar = b.localAvatar(), gun = avatar.userData.gun;
        avatar.updateWorldMatrix(true, true);
        b.camera.updateMatrixWorld(true);
        const direction = new b.THREE.Vector3(0, 0, -1).transformDirection(gun.userData.muzzle.matrixWorld);
        const cameraDirection = b.camera.getWorldDirection(new b.THREE.Vector3());
        const dot = direction.dot(cameraDirection);
        check(dot > 0.96, 'Hipfire muzzle points away from camera heading/pitch', { id, yaw, pitch, dot, muzzle: direction.toArray(), camera: cameraDirection.toArray() });
        k.model(gun);
        rows.push({ id, yaw, pitch, dot });
      }
    }
    return rows;
  });
}

function scopeProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const scope = k.api('isScopeActive');
    const optics = { pistol: 'reflex', rifle: 'holo', shotgun: 'spread', smg: 'chevron', sniper: 'mildot', revolver: 'precision', lmg: 'support' };
    const views = { pistol: 'pistol-irons', rifle: 'rifle-reflex', shotgun: 'shotgun-rib', smg: 'smg-hood',
      sniper: 'sniper-tube', revolver: 'revolver-notch', lmg: 'lmg-aperture' };
    for (const weapon of b.WEAPONS) check(weapon.optic === optics[weapon.id], 'Missing/distinct weapon optic mapping', { weapon: weapon.id, optic: weapon.optic });
    b.setCombatMode(true);
    k.resetKeys();
    b.player.pos.set(128, b.HEIGHT + 8, 128);
    b.player.pitch = 0;
    let now = performance.now();
    const settle = () => {
      for (let i = 0; i < 120; i++) {
        now += 1000 / 120;
        b.updateCombat(1 / 120, now); b.updateAvatar(1 / 120); b.updateCamera(1 / 120);
      }
    };
    const eye = () => b.player.pos.clone().add(new b.THREE.Vector3(0, 1.62, 0));
    const clear = (reason) => {
      settle();
      check(!scope() && !document.body.classList.contains('scoped'), 'Scope persisted after ' + reason);
    };
    const shoulder = [];
    b.thirdPerson = true;
    for (const yaw of [-2.1, -0.4, 1.4, 2.7]) {
      b.player.yaw = yaw; b.gun.aiming = false; settle();
      const offset = b.camera.position.clone().sub(eye());
      const right = offset.dot(new b.THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)));
      const back = -offset.dot(b.camera.getWorldDirection(new b.THREE.Vector3()));
      check(right > 0.9 && right < 1.35 && back > 2.8 && back < 3.8, 'Normal TP is not the revised right-shoulder view', { yaw, right, back });
      shoulder.push({ yaw, right, back });
    }
    const zoom = [];
    for (const thirdPerson of [false, true]) for (let index = 0; index < b.WEAPONS.length; index++) {
      b.thirdPerson = thirdPerson;
      b.selectWeapon(index);
      b.gun.aiming = false; settle();
      const normalFov = b.camera.fov;
      if (!thirdPerson) check(b.camera.position.distanceTo(eye()) < 0.03, 'Unscoped FP camera is not at the player eye');
      b.gun.aiming = true; settle();
      check(scope() && document.body.classList.contains('scoped'), 'Aim did not enter optical scope', { thirdPerson, weapon: b.WEAPONS[index].id });
      check(b.camera.position.distanceTo(eye()) < 0.04, 'Scoped camera did not move to eye plane', thirdPerson);
      const weapon = b.WEAPONS[index], view = k.api('viewGun');
      check(!b.localAvatar().visible, 'ADS eye view still shows the full local avatar');
      check(view.visible === (weapon.id !== 'sniper') && k.api('vmRoot').visible === (weapon.id !== 'sniper'),
        'Open ADS must show its actual model; only the sniper tube hides it', { weapon: weapon.id, visible: view.visible });
      const overlay = document.getElementById('scopeOverlay');
      check(overlay && getComputedStyle(overlay).display !== 'none' && overlay.getBoundingClientRect().width > 0, 'Scope overlay has no rendered layout');
      check(overlay.dataset.optic === b.WEAPONS[index].optic, 'Scope overlay kept the previous weapon optic', { weapon: b.WEAPONS[index].id, optic: overlay.dataset.optic });
      check(overlay.dataset.view === views[weapon.id] && view.userData.adsView === views[weapon.id],
        'Aiming view did not switch its physical sight geometry', { weapon: weapon.id, data: overlay.dataset.view, model: view.userData.adsView });
      if (weapon.id !== 'sniper') {
        const sight = view.userData.adsAimPoint;
        check(sight?.isObject3D && view.userData.adsRearPoint?.isObject3D && view.userData.opticBounds,
          'Open sight has no physical front/rear/housing geometry markers', weapon.id);
        view.updateWorldMatrix(true, true); b.camera.updateMatrixWorld(true);
        const projected = sight.getWorldPosition(new b.THREE.Vector3()).project(b.camera);
        check(Math.abs(projected.x) < 0.018 && Math.abs(projected.y) < 0.018,
          'Physical sight aim point is not centered on the camera ray', { weapon: weapon.id, projected: projected.toArray() });
      }
      for (const id of ['scopeWeapon', 'scopeZoom']) check(document.getElementById(id)?.textContent.trim(), 'Scope label missing: ' + id);
      check(b.camera.fov < normalFov && b.camera.fov > 1, 'ADS FOV is invalid or wider than hipfire');
      const frame = document.getElementById('scopeFrame'), style = getComputedStyle(frame), rect = frame.getBoundingClientRect();
      zoom.push({ thirdPerson, weapon: weapon.id, optic: overlay.dataset.optic, view: overlay.dataset.view,
        fov: b.camera.fov, normalFov, frame: { width: rect.width, height: rect.height, radius: style.borderRadius, display: style.display },
        mask: getComputedStyle(overlay).backgroundImage });
      b.gun.aiming = false; clear('aim release');
      b.gun.aiming = true; settle();
      b.selectWeapon((index + 1) % b.WEAPONS.length); clear('weapon change');
    }
    const fovs = zoom.filter((r) => r.thirdPerson).map((r) => r.fov);
    const sniper = zoom.find((r) => r.thirdPerson && r.weapon === 'sniper').fov;
    check(Math.abs(sniper - Math.min(...fovs)) < 0.1 && Math.max(...fovs) - sniper > 5, 'Sniper is not the strongest per-weapon optical zoom', zoom);
    check(new Set(zoom.filter((r) => r.thirdPerson).map((r) => r.view)).size === 7, 'Weapon aiming views are not distinct');
    check(new Set(zoom.filter((r) => r.thirdPerson).map((r) => JSON.stringify(r.frame))).size >= 4,
      'Weapon sights still reuse one identical circular housing', zoom);
    b.gun.aiming = true; settle(); b.setCombatMode(false); clear('build mode');
    b.setCombatMode(true); b.gun.aiming = true; settle(); b.applyDamage(300, 'Regression');
    b.updateCombat(0, performance.now()); b.updateAvatar(0); b.updateCamera(0);
    check(!b.alive && !scope() && !document.body.classList.contains('scoped'), 'Death did not clear scope before respawn');
    b.doRespawn(); clear('respawn');
    return { shoulder, zoom };
  });
}

module.exports = { WEAPONS, weaponProbe, hipfireProbe, scopeProbe };
