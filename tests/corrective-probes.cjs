'use strict';

// Browser-side probes for the reported issues. Fixture values are controlled
// test inputs, not substitute FPS/ping readings in the shipped game.
function weaponSensitivityProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const settings = b.features.settings;
    check(typeof settings.getWeaponSensitivity === 'function' && typeof settings.setWeaponSensitivity === 'function',
      'Per-weapon sensitivity API is missing');
    const oldBase = settings.sensitivity;
    const oldWeapons = settings.read('weaponSensitivity');
    const storageKey = 'blockcraft.settings.v2';
    const oldStored = localStorage.getItem(storageKey);
    const mouse = (gain) => {
      k.primeMouse();
      b.player.yaw = b.player.pitch = 0;
      const event = new MouseEvent('mousemove', { bubbles: true, movementX: 32, movementY: 12 });
      // MouseEventInit support differs across Chromium versions; dispatch the
      // real document listener with explicit finite relative input either way.
      if (event.movementX !== 32) Object.defineProperty(event, 'movementX', { value: 32 });
      if (event.movementY !== 12) Object.defineProperty(event, 'movementY', { value: 12 });
      document.dispatchEvent(event);
      check(Math.abs(b.player.yaw + 32 * 0.0022 * gain) < 1e-7 &&
        Math.abs(b.player.pitch + 12 * 0.0022 * gain) < 1e-7,
      'Mouse input used the wrong weapon/phase multiplier', { gain, yaw: b.player.yaw, pitch: b.player.pitch });
      return { gain, yaw: b.player.yaw, pitch: b.player.pitch };
    };
    try {
      b.setCombatMode(true);
      check(k.api('isGameplayInputActive')(), 'Sensitivity fixture lacks gameplay pointer capture');
      settings.set('sensitivity', 1.2);
      const rows = [];
      for (let index = 0; index < b.WEAPONS.length; index++) {
        const id = b.WEAPONS[index].id, hip = 0.55 + index * 0.15, ads = 1.9 - index * 0.17;
        settings.setWeaponSensitivity(id, 'hip', hip);
        settings.setWeaponSensitivity(id, 'ads', ads);
        b.selectWeapon(index);
        b.gun.aiming = false;
        const hipInput = mouse(1.2 * hip);
        b.gun.aiming = true;
        const adsInput = mouse(1.2 * ads);
        check(Math.abs(settings.sensitivity - 1.2) < 1e-8, 'Weapon tuning overwrote base sensitivity', id);
        rows.push({ id, hip: settings.getWeaponSensitivity(id, false), ads: settings.getWeaponSensitivity(id, true), hipInput, adsInput });
      }
      const read = settings.read('weaponSensitivity');
      read.pistol.hip = 2.5;
      check(Math.abs(settings.getWeaponSensitivity('pistol', false) - rows[0].hip) < 1e-8,
        'Settings read leaked a mutable weapon profile');
      const getter = settings.weaponSensitivity;
      getter.rifle.ads = 0.35;
      check(Math.abs(settings.getWeaponSensitivity('rifle', true) - rows[1].ads) < 1e-8,
        'Settings getter leaked a mutable weapon profile');
      check(settings.getWeaponSensitivity('unknown', true) === 1, 'Unknown weapon has an unsafe fallback');
      const persisted = JSON.parse(localStorage.getItem(storageKey));
      for (const row of rows) {
        check(Math.abs(persisted.weaponSensitivity[row.id].hip - row.hip) < 1e-8 &&
          Math.abs(persisted.weaponSensitivity[row.id].ads - row.ads) < 1e-8,
        'Per-weapon sensitivity did not persist', row.id);
      }
      settings.setWeaponSensitivity('sniper', 'ads', 999);
      check(settings.getWeaponSensitivity('sniper', true) <= 2.5, 'Sensitivity upper bound is missing');
      settings.setWeaponSensitivity('sniper', 'ads', -50);
      check(settings.getWeaponSensitivity('sniper', true) >= 0.35, 'Sensitivity lower bound is missing');
      settings.setWeaponSensitivity('sniper', 'ads', NaN);
      check(Number.isFinite(settings.getWeaponSensitivity('sniper', true)), 'Non-finite sensitivity escaped sanitization');
      b.setCombatMode(false);
      const building = mouse(1.2);
      check(Math.abs(b.BC.mouseSensitivity() - 1.2) < 1e-8, 'Unarmed/riding look lost its base multiplier');
      return { rows, building, persisted: true, defensiveReads: true };
    } finally {
      settings.set('sensitivity', oldBase);
      settings.set('weaponSensitivity', oldWeapons);
      if (oldStored === null) localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, oldStored);
      settings.refresh();
    }
  });
}

function kneeProbe(expected) {
  const k = window.__bcTest, { b, check } = k;
  const stance = k.api('poseHumanoidStance');
  const rows = [];
  const pose = { stance: 0, slide: 0, dash: 0, swing: 0, air: 0 };
  for (const key of expected) {
    const root = b.makeHumanoid(key, null), parts = root.userData.parts;
    for (const side of ['L', 'R']) {
      check(parts['knee' + side]?.parent === parts['leg' + side], 'Missing anatomical knee hierarchy', { key, side });
      check(parts['ankle' + side]?.parent === parts['knee' + side], 'Missing anatomical ankle hierarchy', { key, side });
    }
    const settle = () => {
      for (let i = 0; i < 90; i++) check(stance(root, pose, 1 / 120) !== false, 'Articulated stance helper rejected its own rig', key);
      root.updateWorldMatrix(true, true);
    };
    const feet = () => ['L', 'R'].map((side) => new b.THREE.Box3().setFromObject(parts['ankle' + side]).min.y);
    Object.assign(pose, { stance: 0, slide: 0, dash: 0, swing: 0, air: 0 });
    settle();
    const neutralFeet = feet();
    const headY = parts.head.getWorldPosition(new b.THREE.Vector3()).y;
    pose.stance = 1; settle();
    const crouchFeet = feet();
    const dropped = headY - parts.head.getWorldPosition(new b.THREE.Vector3()).y;
    check(dropped > 0.43 && dropped < 0.57, 'Crouch did not lower the character by about half a metre', { key, dropped });
    const knees = ['L', 'R'].map((side, i) => {
      const hip = parts['leg' + side].getWorldPosition(new b.THREE.Vector3());
      const knee = parts['knee' + side].getWorldPosition(new b.THREE.Vector3());
      check(knee.z < hip.z - 0.1, 'Knee bends behind the -Z-facing character', { key, side, hip: hip.toArray(), knee: knee.toArray() });
      check(parts['knee' + side].rotation.x < -0.45, 'The shin is not counter-articulated at the knee', { key, side });
      check(Math.abs(crouchFeet[i] - neutralFeet[i]) < 0.065, 'Crouch feet sink or float instead of staying planted',
        { key, side, neutral: neutralFeet[i], crouch: crouchFeet[i] });
      return { side, hip: hip.toArray(), knee: knee.toArray(), angle: parts['knee' + side].rotation.x };
    });
    pose.slide = 1; settle();
    const slideFeet = feet();
    check(slideFeet.every((y, i) => Math.abs(y - neutralFeet[i]) < 0.13), 'Slide feet lose the ground plane', { key, neutralFeet, slideFeet });
    Object.assign(pose, { stance: 0, slide: 0, dash: 0, swing: 0, air: 0 });
    settle();
    for (const side of ['L', 'R']) {
      check(Math.abs(parts['knee' + side].rotation.x) < 0.025 && Math.abs(parts['ankle' + side].rotation.x) < 0.025,
        'Standing kept a stale crouch knee/ankle pose', { key, side });
    }
    k.model(root);
    rows.push({ key, dropped, neutralFeet, crouchFeet, slideFeet, knees });
  }
  return { characters: rows, forwardKnees: true, plantedFeet: true };
}

function stanceGallery({ keys, phase = 'crouch' }) {
  const k = window.__bcTest, { b } = k;
  const scene = new b.THREE.Scene();
  scene.background = new b.THREE.Color('#17212d');
  scene.add(new b.THREE.HemisphereLight(0xffffff, 0x697b91, 2));
  const light = new b.THREE.DirectionalLight(0xffffff, 2);
  light.position.set(-5, 7, -9); scene.add(light);
  keys.forEach((key, index) => {
    const root = b.makeHumanoid(key, b.CHARACTERS[key].name);
    const pose = { stance: phase === 'standing' ? 0 : 1, slide: phase === 'slide' ? 1 : 0, dash: 0, swing: 0, air: 0 };
    for (let i = 0; i < 90; i++) k.api('poseHumanoidStance')(root, pose, 1 / 120);
    root.position.set((1.5 - index % 4) * 2.5, (1.5 - Math.floor(index / 4)) * 2.3, 0);
    root.rotation.y = -0.65;
    scene.add(root);
  });
  const camera = new b.THREE.PerspectiveCamera(40, b.camera.aspect, 0.1, 100);
  camera.position.set(0, 1, -18); camera.lookAt(0, 1, 0);
  try {
    b.renderer.render(scene, camera);
    return b.renderer.domElement.toDataURL('image/png');
  } finally { b.renderer.render(b.scene, b.camera); }
}

function diagnosticsProbe() {
  const k = window.__bcTest, { b, check } = k;
  b.hud.refresh();
  const state = b.hud.getState ? b.hud.getState() : b.hud.getstate();
  const ping = document.getElementById('pingMs'), fps = document.getElementById('stats');
  const numeric = [...fps.querySelectorAll('*'), fps].find((el) => /\d/.test(el.textContent) && parseFloat(getComputedStyle(el).fontSize) >= (innerWidth < 560 ? 16 : 18));
  check(parseFloat(getComputedStyle(ping).fontSize) >= (innerWidth < 560 ? 16 : 18), 'Ping is still too small to read');
  check(numeric, 'FPS is still too small to read');
  check(state.fps > 0 && fps.textContent.includes(String(state.fps)), 'FPS does not reflect the measured frame diagnostics', state);
  const net = b.features.net, actualPing = net.getPing();
  if (!Number.isFinite(actualPing)) check(/--/.test(ping.textContent), 'Offline ping is fabricated', ping.textContent);
  else check(Math.abs(parseFloat(ping.textContent) - actualPing) <= 1, 'Ping is not the real RTT', { actualPing, shown: ping.textContent });
  const ids = ['teamScore', 'pingChip', 'stats', 'roomBadge', 'minimap', 'healthWrap', 'weaponHud', 'hotbar', 'buildHud'];
  const visible = (el) => {
    if (!el || el.getBoundingClientRect().width <= 0 || el.getBoundingClientRect().height <= 0) return false;
    let opacity = 1;
    for (let p = el; p; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      opacity *= Number(style.opacity);
    }
    return opacity > 0.2;
  };
  const panels = ids.map((id) => document.getElementById(id)).filter(visible);
  const rects = panels.map((el) => ({ id: el.id, rect: el.getBoundingClientRect().toJSON() }));
  for (const row of rects) {
    check(row.rect.x >= -1 && row.rect.y >= -1 && row.rect.right <= innerWidth + 1 && row.rect.bottom <= innerHeight + 1,
      'Readable HUD panel is clipped by the viewport', row);
  }
  for (let a = 0; a < panels.length; a++) for (let c = a + 1; c < panels.length; c++) {
    if (panels[a].contains(panels[c]) || panels[c].contains(panels[a])) continue;
    const r = panels[a].getBoundingClientRect(), s = panels[c].getBoundingClientRect();
    const overlap = Math.max(0, Math.min(r.right, s.right) - Math.max(r.left, s.left)) *
      Math.max(0, Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top));
    check(overlap <= 1, 'Enlarged readouts overlap another critical HUD panel', { a: panels[a].id, b: panels[c].id, overlap });
  }
  return { viewport: [innerWidth, innerHeight], fps: state.fps, ping: actualPing, rects,
    sizes: { fps: parseFloat(getComputedStyle(numeric).fontSize), ping: parseFloat(getComputedStyle(ping).fontSize) } };
}

function npcPhysicsProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const world = k.world(), phys = b.physics;
    const site = k.pad({ radius: 9 });
    const flat = world.snapshot();
    const actor = (kind, x = site.x, y = site.y, z = site.z) => ({ kind, x, y, z, vx: 0, vy: 0, vz: 0,
      halfW: phys.bodyFor(kind).w, height: phys.bodyFor(kind).h, onGround: false });
    const step = (c, seconds, vx = 0) => {
      for (let i = 0; i < Math.ceil(seconds * 120); i++) { c.vx = vx; phys.stepCritter(c, 1 / 120); }
      check(!phys.overlaps({ x: c.x, y: c.y, z: c.z, w: c.halfW, h: c.height }), 'NPC ended inside solid voxels', c);
    };
    try {
      const wallX = Math.floor(site.x) + 3;
      for (let z = Math.floor(site.z) - 3; z <= Math.floor(site.z) + 3; z++) {
        for (let y = site.y; y < site.y + 3; y++) b.setBlock(wallX, y, z, k.api('STONE'));
      }
      const collision = [];
      for (const kind of ['villager', 'chicken']) {
        const c = actor(kind); step(c, 1.2, 12);
        check(c.x + c.halfW <= wallX + 0.001 && c.onGround, 'NPC walked through a three-voxel wall or lost grounding', c);
        collision.push({ kind, x: c.x, y: c.y, onGround: c.onGround });
      }
      world.restore(flat);
      const falling = actor('villager', site.x, site.y + 3, site.z);
      step(falling, 1);
      check(falling.onGround && Math.abs(falling.y - site.y) < 0.015, 'Gravity did not land an NPC on the actual floor', falling);
      const oldY = falling.y;
      for (let x = Math.floor(site.x) - 2; x <= Math.floor(site.x) + 2; x++) for (let z = Math.floor(site.z) - 2; z <= Math.floor(site.z) + 2; z++) {
        for (let y = site.y - 3; y < site.y; y++) b.setBlock(x, y, z, k.api('AIR'));
      }
      step(falling, 0.3);
      check(falling.y < oldY - 1 && !falling.onGround, 'NPC floats after its support is removed', falling);
      world.restore(flat);
      for (let x = Math.floor(site.x) - 2; x <= Math.floor(site.x) + 2; x++) for (let z = Math.floor(site.z) - 2; z <= Math.floor(site.z) + 2; z++) {
        b.setBlock(x, site.y - 4, z, k.api('STONE'));
        for (let y = site.y - 3; y < site.y; y++) b.setBlock(x, y, z, k.api('WATER'));
      }
      const water = [];
      for (const kind of ['villager', 'chicken']) {
        const c = actor(kind, site.x, site.y - 2, site.z); step(c, 3);
        check(c.inWater && c.y > site.y - 2.1 && c.y + c.height > site.y + 0.15,
          'Water behavior does not keep the NPC afloat/head above water', c);
        water.push({ kind, y: c.y, head: c.y + c.height, surface: site.y, vy: c.vy });
      }
      return { collision, gravity: true, removedSupport: true, water };
    } finally { world.restore(); }
  });
}

function minimapProbe() {
  const k = window.__bcTest, { b, check } = k, map = b.minimap;
  map.setVisible(true);
  map.update(0, performance.now() + 200, true);
  const before = map.state;
  check(before.ready && before.terrainSource === 'voxels' && before.contourSegments > 0,
    'Minimap lacks real cached topography', before);
  check(before.contourMinor === 2 && before.contourMajor === 5 && before.elevationMax > before.elevationMin,
    'Minimap contour/elevation data is invalid', before);
  check(before.seed === b.seed && before.terrainResolution === 128, 'Minimap is not using the current seeded world', before);
  const center = map.project(b.player.pos.x, b.player.pos.z), north = map.project(b.player.pos.x, b.player.pos.z - 15);
  check(center && north && north.y < center.y, 'North-up minimap projection is reversed', { center, north });
  const start = performance.now() + 300;
  let draws = 0, prevDraw = before.lastDraw;
  for (let i = 0; i < 100; i++) {
    map.update(0.01, start + i * 10, true);
    const cur = map.state.lastDraw;
    if (cur !== prevDraw) { draws++; prevDraw = cur; }
  }
  const after = map.state;
  check(after.terrainSamples === before.terrainSamples && after.terrainRevision === before.terrainRevision,
    'Minimap rescans terrain on moving-overlay frames', { before, after });
  // drawRevision identifies the terrain revision drawn, not an overlay counter.
  check(draws >= 8 && draws <= 13 && after.lastDraw > before.lastDraw,
    'Minimap overlay cadence is not bounded near 10 Hz', { draws, before: before.lastDraw, after: after.lastDraw });
  return { before, after, center, north, draws, cached: true };
}

function resetHoldProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const world = k.world(), wasBusy = b.BC.flags.worldBusy;
    try {
      const site = k.pad({ radius: 9 });
      k.onPad(site);
      const rows = [];
      for (const variant of ['traditional-left', 'traditional-right', 'quick']) {
        k.api('cancelQuickBuild')(); b.setCombatMode(false);
        if (variant === 'quick') check(b.selectBuildPiece('wall'), 'Could not enter quick-build fixture');
        const button = variant === 'traditional-right' ? 2 : 0;
        b.setBuildingHeld(button, true);
        const held = k.api('buildingHeld'), buttons = k.api('inputButtonsDown');
        buttons.add(button);
        k.api('keys').KeyW = true;
        b.gun.trigger = b.gun.aiming = true;
        check(held.left || held.right, 'Building hold fixture did not start', variant);
        b.BC.flags.worldBusy = true;
        b.BC.emit('inputReset');
        check(!held.left && !held.right && buttons.size === 0 && !k.api('keys').KeyW && !b.gun.trigger && !b.gun.aiming,
          'Externally emitted inputReset leaves a held action behind', { variant, left: held.left, right: held.right, buttons: buttons.size });
        b.BC.flags.worldBusy = false;
        const resetWorld = world.snapshot();
        held.nextActionAt = 0;
        for (let i = 0; i < 8; i++) b.updateBuilding(1 / 60);
        check(world.changes(resetWorld).length === 0, 'Old building hold resumed without a fresh press after reset', variant);
        rows.push({ variant, released: true, freshPressRequired: true });
      }
      return rows;
    } finally { b.BC.flags.worldBusy = wasBusy; world.restore(); }
  });
}

function remotePlacementProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const world = k.world(), peerId = 'fixture-remote-body';
    check(!b.net.players.has(peerId), 'Remote body fixture id already exists');
    try {
      const site = k.pad({ radius: 9 }); k.onPad(site);
      b.setCombatMode(false); b.player.pitch = 0; b.updateCamera(1 / 60); b.camera.updateMatrixWorld(true);
      const x = Math.floor(site.x), y = site.y + 1, z = Math.floor(b.player.pos.z) - 2;
      b.setBlock(x, y, z - 1, k.api('STONE'));
      const group = b.makeHumanoid('cj', null);
      group.position.set(x + 0.5, site.y + 0.3, z + 0.5);
      const remote = { id: peerId, group, x: group.position.x, y: group.position.y, z: group.position.z,
        tx: group.position.x, ty: group.position.y, tz: group.position.z, hp: 100, health: 100,
        bodyHeight: 1.8, height: 1.8, crouch: 0, slide: 0, deadUntil: 0, lastSeen: performance.now(), lastAt: performance.now() };
      b.net.players.set(peerId, remote);
      const intersects = k.api('buildVoxelHitsLivingRemote');
      check(intersects(x, y, z), 'Shared building body check missed a living peer');
      check(!k.api('canPlacePlayerBlock')(x, y, z), 'Traditional placement still ignores remote bodies');
      const before = world.snapshot(), inventory = k.clone(b.inventory);
      b.placeBlock();
      check(world.changes(before).length === 0 && JSON.stringify(b.inventory) === JSON.stringify(inventory),
        'Blocked traditional placement wrote a voxel or debited inventory');
      remote.hp = remote.health = 0;
      check(!intersects(x, y, z) && k.api('canPlacePlayerBlock')(x, y, z), 'Dead peer unnecessarily blocks building');
      b.placeBlock();
      check(b.getBlock(x, y, z) === b.HOTBAR[k.api('selected')], 'Traditional placement did not work after the peer died');
      b.setBlock(x, y, z, k.api('AIR'));
      remote.hp = remote.health = 100;
      const above = site.y + 2;
      check(intersects(x, above, z), 'Standing body fixture does not occupy its upper voxel');
      remote.height = remote.bodyHeight = 1.2; remote.crouch = 1; group.userData.bodyHeight = 1.2;
      check(!intersects(x, above, z) && k.api('canPlacePlayerBlock')(x, above, z),
        'Space above the real crouched height is incorrectly blocked');

      // Accepted world edits must not be discarded to solve a movement race.
      // The same voxelChanged path schedules bounded local depenetration.
      b.net.players.delete(peerId);
      const initial = b.player.pos.clone();
      const raced = { x: Math.floor(initial.x), y: Math.floor(initial.y + 1), z: Math.floor(initial.z) };
      b.setBlock(raced.x, raced.y, raced.z, k.api('STONE'));
      check(k.api('collides')(...b.player.pos.toArray()), 'Raced edit fixture did not overlap the local body');
      b.BC.emit('preFrame', 1 / 60, performance.now() + 100, true);
      check(!k.api('collides')(...b.player.pos.toArray()), 'Authoritative edit left the local player trapped in geometry');
      check(b.getBlock(raced.x, raced.y, raced.z) === k.api('STONE'), 'Depenetration discarded an authoritative voxel');
      const displacement = initial.distanceTo(b.player.pos);
      check(displacement > 0 && displacement <= 3.6, 'Player repair is an unbounded teleport', displacement);
      return { livingRejected: true, deadAllowed: true, crouchClearance: true, authoritativeEditPreserved: true, displacement };
    } finally { b.net.players.delete(peerId); world.restore(); }
  });
}

function lifecycleCleanupProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    b.setCombatMode(true);
    const clean = () => {
      check(b.alive && !b.killcam.active && !b.BC.flags.killcamActive && !document.body.classList.contains('killcam') &&
        !document.getElementById('killcamCard'), 'Fixture cleanup leaks a death-camera lifecycle');
    };
    k.state(() => b.applyDamage(120, 'Fixture killer'));
    clean();
    let caught = false;
    try {
      k.state(() => { b.applyDamage(120, 'Fixture killer'); throw new Error('Expected fixture failure'); });
    } catch (error) { caught = error.message === 'Expected fixture failure'; }
    check(caught, 'Throwing fixture did not propagate its error'); clean();
    b.gun.cooldown = b.gun.reloading = 0;
    const ammo = b.gun.ammo[b.gun.index];
    b.fireOnce();
    check(b.gun.ammo[b.gun.index] === ammo - 1, 'A firing probe is blocked immediately after fixture cleanup');
    return { successCleanup: true, errorCleanup: true, immediateFire: true };
  });
}

function fpsClockProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const saved = { last, fpsAccum, fpsFrames, fpsTimer, shownFps, raf: window.requestAnimationFrame, render: b.renderer.render };
    try {
      window.requestAnimationFrame = () => 0;
      b.renderer.render = () => {};
      last = null; fpsAccum = fpsFrames = fpsTimer = 0;
      const start = performance.now();
      for (let i = 0; i < 7; i++) k.api('loop')(start + i * 200);
      check(shownFps === 5, 'FPS is measured from the capped physics timestep instead of the wall clock', shownFps);
      return { controlledFrameMs: 200, expectedFPS: 5, shownFPS: shownFps, physicsStillCapped: true };
    } finally {
      window.requestAnimationFrame = saved.raf; b.renderer.render = saved.render;
      last = saved.last; fpsAccum = saved.fpsAccum; fpsFrames = saved.fpsFrames; fpsTimer = saved.fpsTimer; shownFps = saved.shownFps;
      b.hud.setDiagnostics(saved.shownFps);
    }
  });
}

module.exports = { weaponSensitivityProbe, kneeProbe, stanceGallery, diagnosticsProbe, npcPhysicsProbe, minimapProbe,
  resetHoldProbe, remotePlacementProbe, lifecycleCleanupProbe, fpsClockProbe };
