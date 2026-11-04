'use strict';

function audioProbe() {
  const k = window.__bcTest, { b, check } = k, engine = b.audio;
  check(engine.stats().sampledWeapons === 7 && engine.stats().sampleFailures === 0, 'Recorded samples did not decode');
  const ctx = engine.getContext();
  check(ctx && ctx.state === 'running', 'Spatial audio does not share the running combat context');
  const oldSource = ctx.createBufferSource, oldPanner = ctx.createPanner;
  const sources = [], panners = [];
  ctx.createBufferSource = function () { const node = oldSource.call(this); sources.push(node); return node; };
  ctx.createPanner = function () { const node = oldPanner.call(this); panners.push(node); return node; };
  const oldMute = b.settings.muted, oldVolume = b.settings.volume;
  try {
    b.settings.set('muted', false); b.settings.set('volume', 0.8);
    b.thirdPerson = false; b.player.pitch = b.player.yaw = 0;
    b.updateCamera(0); b.camera.updateMatrixWorld(true); engine.setListener(b.camera);
    const position = b.camera.getWorldPosition(new b.THREE.Vector3());
    const right = new b.THREE.Vector3(1, 0, 0).applyQuaternion(b.camera.quaternion);
    const rows = [], signatures = [];
    for (let i = 0; i < b.WEAPONS.length; i++) {
      const id = b.WEAPONS[i].id, from = position.clone().addScaledVector(right, i % 2 ? -8 : 8);
      const before = sources.length;
      check(engine.play({ kind: 'shot', weapon: id, position: from, volume: 0.6 }), 'Recorded weapon report did not play', id);
      check(sources.length === before + 1, 'A shot creates duplicated sources instead of one layered voice', id);
      const buffer = sources.at(-1).buffer, samples = buffer.getChannelData(0);
      let hash = 2166136261, peak = 0;
      for (let j = 0; j < samples.length; j++) {
        peak = Math.max(peak, Math.abs(samples[j]));
        hash = Math.imul(hash ^ Math.round(samples[j] * 32767), 16777619);
      }
      check(peak > 0.01 && peak <= 1, 'Weapon sample is silent or clips', { id, peak });
      const source = engine.weaponSource(id);
      check(source.playback === 'recording + procedural layers' && source.licence === 'CC0-1.0',
        'Audio provenance does not reflect the played recording', source);
      signatures.push(`${buffer.length}:${hash >>> 0}`);
      rows.push({ id, duration: buffer.duration, peak, source, position: from.toArray() });
    }
    check(new Set(signatures).size === 7, 'Weapon reports reuse one indistinguishable sound buffer');
    check(panners.length > 0 && panners.every((p) => p.panningModel === 'HRTF' && p.distanceModel === 'inverse' &&
      p.refDistance === 6 && p.maxDistance === 90), 'Weapon reports lack directional/distance panners');
    const origins = panners.map((p) => [p.positionX.value, p.positionY.value, p.positionZ.value]);
    check(origins.some((p) => p[0] > position.x + 1) && origins.some((p) => p[0] < position.x - 1),
      'Left/right source positions are not retained', origins);
    check(!engine.play({ kind: 'shot', weapon: 'pistol', position: position.clone().addScaledVector(right, 100) }),
      'Out-of-proximity audio plays beyond the maximum distance');
    const beforeOcclusion = engine.stats().occluded;
    engine.play({ kind: 'shot', weapon: 'pistol', position: position.clone().addScaledVector(right, 5), occluded: true });
    check(engine.stats().occluded > beforeOcclusion, 'Occluded source does not use the muffled path');
    const beforeEvent = engine.stats().played;
    b.BC.emit('shot', { weapon: 'pistol', from: position });
    b.BC.emit('sfx', { kind: 'shot', weapon: 'pistol', position });
    check(engine.stats().played === beforeEvent + 1, 'Shot and SFX hooks double-play the same shot');
    b.settings.set('muted', true);
    check(!engine.play({ kind: 'shot', weapon: 'pistol', position }), 'Mute still plays a shot');
    b.settings.set('muted', false);
    for (let i = 0; i < 35; i++) engine.play({ kind: 'shot', weapon: 'smg', position, volume: 0.4 });
    const stats = engine.stats();
    check(stats.voices <= 24 && stats.pooled <= 20 && stats.maxVoices === 24, 'Audio voices/pool grow without bounds', stats);
    return { rows, panners: origins, uniqueReports: true, oneEventOneVoice: true, stats };
  } finally {
    ctx.createBufferSource = oldSource; ctx.createPanner = oldPanner;
    b.settings.set('volume', oldVolume); b.settings.set('muted', oldMute);
  }
}

function remoteJetpackProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const jet = b.jetpack, initial = jet.remoteRigCount, local = k.api('jetState').rig, localParent = local.parent;
    const a = b.makeHumanoid('steve', null), c = b.makeHumanoid('cj', null);
    const rigA = jet.createRemoteRig(a), rigB = jet.createRemoteRig(c);
    try {
      check(rigA && rigB && rigA !== rigB && rigA !== local && rigB !== local, 'Remotes share/steal the singleton local pack');
      check(jet.remoteRigCount === initial + 2 && local.parent === localParent, 'Remote factories reparent the local pack');
      const flying = { hp: 100, fly: 1, boost: 1, dash: 0, fuel: 100, team: 'blue' };
      jet.updateRemoteRig(rigA, flying, 1 / 60);
      jet.updateRemoteRig(rigB, { ...flying, fuel: 0, team: 'red' }, 1 / 60);
      const ownedA = rigA.userData.jetRemote, ownedB = rigB.userData.jetRemote;
      check(ownedA.flameMat !== ownedB.flameMat && ownedA.flameMat.opacity > 0 && ownedB.flameMat.opacity === 0,
        'One remote changes another pack’s flame material');
      check(rigA.visible && rigB.visible && !ownedB.flameL.visible, 'Remote fly/fuel state is not visible');
      jet.updateRemoteRig(rigB, flying, 1 / 60, true);
      check(!rigB.visible && rigA.visible, 'A rider/death gate hides the wrong remote pack');
      let sharedDisposed = 0;
      const geometries = new Set(); rigA.traverse((node) => { if (node.geometry) geometries.add(node.geometry); });
      const listener = () => sharedDisposed++;
      for (const geometry of geometries) geometry.addEventListener('dispose', listener);
      try {
        check(jet.disposeRemoteRig(rigA) && !jet.disposeRemoteRig(rigA), 'Remote pack disposal is not idempotent');
        check(sharedDisposed === 0 && local.parent === localParent, 'Remote disposal destroys shared/local pack resources');
      } finally { for (const geometry of geometries) geometry.removeEventListener('dispose', listener); }
      jet.updateRemoteRig(rigB, flying, 1 / 60);
      check(rigB.visible && jet.remoteRigCount === initial + 1, 'Disposing one peer breaks another pack');
      return { independentRigs: true, independentFlames: true, cachedGeometryPreserved: true };
    } finally {
      jet.disposeRemoteRig(rigA); jet.disposeRemoteRig(rigB);
      check(jet.remoteRigCount === initial, 'Remote pack factory leaks its retained count');
    }
  });
}

function weaponHandlingProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    b.setCombatMode(true); b.thirdPerson = false;
    b.player.pos.set(128.5, b.HEIGHT + 8, 128.5); b.player.pitch = b.player.yaw = 0;
    b.player.onGround = true; b.player.fly = b.player.swimming = false; b.player.groundSpeed = 0;
    let now = performance.now();
    const step = (seconds) => {
      for (let i = 0; i < Math.ceil(seconds * 120); i++) { now += 1000 / 120; b.updateCombat(1 / 120, now); }
    };
    const profiles = [], adsTimes = [];
    for (let index = 0; index < b.WEAPONS.length; index++) {
      const weapon = b.WEAPONS[index], profile = b.features.combat.getProfile(weapon.id);
      check(profile && profile.adsInMs > 0 && profile.bloomPerShot > 0 && profile.recoilReturn > 0 && profile.reloadStages.length >= 2,
        'Weapon has no distinct observable handling profile', weapon.id);
      b.selectWeapon(index); b.gun.ammo[index] = weapon.mag;
      b.gun.aiming = false; b.gun.cooldown = b.gun.reloading = 0; step(0.5);
      const before = b.gun.bloom[index]; b.fireOnce();
      check(b.gun.bloom[index] > before, 'Repeated-shot bloom does not affect the real gun state', weapon.id);
      const fired = b.gun.bloom[index]; step(1.8);
      check(b.gun.bloom[index] < fired, 'Weapon bloom never recovers', weapon.id);
      b.gun.aiming = true;
      const start = b.features.combat.getState().aimProgress;
      step(0.05);
      const entering = b.features.combat.getState().aimProgress;
      check(entering > start && entering < 0.999, 'ADS ignores its per-weapon transition time', { weapon: weapon.id, start, entering });
      step(profile.adsInMs / 1000 + 0.05);
      check(b.features.combat.getState().aimProgress > 0.99, 'ADS fails to settle', weapon.id);
      adsTimes.push(profile.adsInMs);
      profiles.push({ id: weapon.id, role: weapon.role, profile, initialADS: entering, bloom: { fired, recovered: b.gun.bloom[index] } });
    }
    check(new Set(adsTimes).size === 7 && new Set(profiles.map((p) => p.profile.mechanism)).size >= 5,
      'Weapons still have identical ADS/mechanism rhythms');
    const ranges = [];
    b.gun.aiming = false;
    for (const [weapon, distance] of [['rifle', 125], ['sniper', 145], ['lmg', 140]]) {
      b.health = 100;
      const accepted = b.applyDamage(10, 'Long-range fixture', false, null,
        { weapon, killerPos: b.player.pos.clone().add(new b.THREE.Vector3(distance, 0, 0)) });
      check(accepted && b.health === 90, 'Declared long-range damage is incorrectly rejected at 120m', { weapon, distance, accepted });
      ranges.push({ weapon, distance, accepted });
    }
    const sniper = b.WEAPONS.find((w) => w.id === 'sniper');
    check(!b.applyDamage(10, 'Out-of-range fixture', false, null,
      { weapon: 'sniper', killerPos: b.player.pos.clone().add(new b.THREE.Vector3(sniper.range + 10, 0, 0)) }),
    'Out-of-range damage bypasses the guard');
    return { profiles, ranges };
  });
}

module.exports = { audioProbe, remoteJetpackProbe, weaponHandlingProbe };
