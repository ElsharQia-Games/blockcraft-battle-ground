'use strict';

const ROSTER = ['steve', 'cj', 'mario', 'ashen', 'undead', 'wolf', 'tarnished', 'seif', 'meedo', 'mko', 'hokage', 'kestrel', 'oren', 'kratos', 'leon', 'mj'];

function bootProbe() {
  const { b, check, population } = window.__bcTest;
  const scripts = [...document.scripts].filter((s) => /\/src\//.test(s.src));
  check(scripts.length >= 11, 'Classic source scripts did not load');
  check(scripts.every((s) => !s.type || s.type === 'text/javascript'), 'Game sources must remain classic scripts for file://');
  check(!b.renderer.getContext().isContextLost(), 'Lost WebGL context');
  check(b.renderer.info.render.triangles > 0, 'No world geometry rendered');
  check(b.player.pos.toArray().every(Number.isFinite), 'Invalid spawn coordinates');
  check(document.querySelectorAll('#hotbar .slot').length === b.HOTBAR.length, 'Incomplete hotbar');
  check(document.querySelectorAll('#chars button').length === 16, 'Incomplete character menu');
  check(getComputedStyle(document.getElementById('err')).display === 'none', 'Visible boot error');
  return {
    protocol: location.protocol, scripts: scripts.map((s) => new URL(s.src).pathname.split('/').pop()),
    population: population(), roster: [...b.CHAR_KEYS], render: { ...b.renderer.info.render },
    dragonClasses: { total: b.dragons.length, guardians: b.dragons.filter((d) => d.type === 'guardian').length,
      mounts: b.dragons.filter((d) => d.type === 'mount').length, expected: window.BCDragonRules.count(b.seed) },
    api: Object.keys(b).sort()
  };
}

function rosterProbe(expected) {
  const k = window.__bcTest, { b, check } = k;
  check(JSON.stringify([...b.CHAR_KEYS].sort()) === JSON.stringify([...expected].sort()), 'Playable roster changed', b.CHAR_KEYS);
  check(new Set(b.CHAR_KEYS).size === 16, 'Duplicate playable identities');
  // Existing custom identity landmarks: these are rendered attachments, not
  // assertions that a palette proves a likeness. The gallery supports human review.
  const landmarks = {
    seif: ['seiffolio', 'seifquiff'], meedo: ['meedocurl'], mko: ['mkowatchface'],
    hokage: ['hokagehair', 'hokageband'], kestrel: ['kestrellens', 'kestrelshaft'], oren: ['orenapron', 'orenhead']
  };
  const names = { seif: 'Seif', meedo: 'Meedo', mko: 'Mko', hokage: 'Hokage', kestrel: 'Kestrel', oren: 'Oren' };
  const hash = (image) => {
    const pixels = image.getContext('2d').getImageData(0, 0, image.width, image.height).data;
    let value = 2166136261;
    for (const byte of pixels) value = Math.imul(value ^ byte, 16777619);
    return value >>> 0;
  };
  return k.state(() => {
    const results = [];
    for (const key of expected) {
      const root = b.makeHumanoid(key, null);
      const parts = root.userData.parts;
      check(root.userData.key === key, 'Character fell back to another identity', key);
      for (const part of ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) {
        check(parts?.[part]?.parent === root && parts[part].children.length > 0, 'Detached/empty humanoid joint', { key, part });
      }
      check(parts.head.position.y > parts.torso.position.y && parts.armL.position.x < parts.armR.position.x, 'Incoherent skeleton', key);
      const measured = k.model(root);
      check(measured.textures >= 6 && measured.size[1] > 1.5 && measured.size[1] < 4, 'Invalid humanoid bounds/textures', { key, measured });
      const used = new Set();
      root.traverse((node) => { if (node.material) for (const m of Array.isArray(node.material) ? node.material : [node.material]) used.add(m); });
      for (const landmark of landmarks[key] || []) {
        check(used.has(k.api('TEX_MATS').get('prop|' + landmark)), 'Original custom attachment missing', { key, landmark });
      }
      if (names[key]) check(b.CHARACTERS[key].name === names[key], 'Original custom name changed', key);
      const skin = ['head', 'torso', 'legL', 'armR'].map((part) => hash(parts[part].children[0].material.map.image));
      results.push({ key, ...measured, skin });
    }
    check(new Set(results.map((r) => r.skin.join(','))).size === 16, 'Duplicate/fallback body textures in roster');
    b.setCharacter(b.CHAR_KEYS[0]);
    const visited = [];
    for (let i = 0; i < 16; i++) {
      visited.push(b.charKey);
      const old = b.localAvatar();
      b.cycleCharacter();
      check(old.parent === null && b.localAvatar().parent === b.scene, 'Character cycling leaked/detached an avatar');
      check(b.localAvatar().userData.key === b.charKey, 'Character cycling left stale model');
      k.model(b.localAvatar());
    }
    check(new Set(visited).size === 16 && b.charKey === b.CHAR_KEYS[0], 'Cycle does not cover and wrap the whole roster', visited);
    return results;
  });
}

function rosterGallery(expected) {
  const { b } = window.__bcTest;
  const scene = new b.THREE.Scene();
  scene.background = new b.THREE.Color('#17212d');
  scene.add(new b.THREE.HemisphereLight(0xffffff, 0x697b91, 2));
  const light = new b.THREE.DirectionalLight(0xffffff, 2);
  light.position.set(-4, 7, -9); scene.add(light);
  expected.forEach((key, i) => {
    const avatar = b.makeHumanoid(key, b.CHARACTERS[key].name);
    avatar.position.set((1.5 - i % 4) * 2.5, (1.5 - Math.floor(i / 4)) * 2.65, 0);
    scene.add(avatar);
  });
  const camera = new b.THREE.PerspectiveCamera(40, b.camera.aspect, 0.1, 100);
  camera.position.set(0, 1, -19);
  camera.lookAt(0, 1, 0);
  try {
    b.renderer.render(scene, camera);
    return b.renderer.domElement.toDataURL('image/png');
  } finally { b.renderer.render(b.scene, b.camera); }
}

function critterProbe() {
  const k = window.__bcTest, { b, check } = k;
  const before = k.population();
  const character = (c) => c.character || c.group.userData.character || c.group.userData.key;
  const pair = ['fayoum', 'mj'].map((key) => b.critters.find((c) => c.kind === 'villager' && character(c) === key));
  check(pair.every(Boolean), 'Both real Fayoum and MJ villagers must be spawned');
  check(before.counts.chicken > 0 && before.villages > 0, 'Chicken/village population missing', before);
  const result = k.state(() => {
    const originals = [...b.critters];
    const saved = pair.map((c) => ({ c, values: k.clone(c), restore: k.graph(c.group) }));
    const samples = [];
    try {
      b.critters.splice(0, b.critters.length, ...pair);
      b.player.pos.set(128, 60, 128);
      for (const yaw of [0, 0.73, 2.6, -2.2]) {
        for (const c of pair) {
          Object.assign(c, { x: 128, z: 128, y: b.terrainHeight(128, 128) + 1, yaw, phase: 0, timer: 10, walking: true, speed: 0,
            tx: 128 + Math.sin(yaw) * 8, tz: 128 + Math.cos(yaw) * 8 });
        }
        for (let i = 0; i < 20; i++) b.updateCritters(1 / 60);
        const row = pair.map((c) => {
          c.group.updateWorldMatrix(true, true);
          const travel = new b.THREE.Vector3(c.x - 128, 0, c.z - 128);
          const progress = 8 - Math.hypot(c.tx - c.x, c.tz - c.z);
          const forward = new b.THREE.Vector3(0, 0, -1).transformDirection(c.group.matrixWorld);
          const dot = travel.clone().normalize().dot(forward);
          check(travel.length() > 0.1 && progress > 0.1, 'NPC animation without actual target progress', { key: character(c), progress });
          check(character(c) === 'mj' ? dot < -0.9 : dot > 0.9, 'NPC facing/travel regression', { key: character(c), dot, yaw });
          return { key: character(c), dot, progress, phase: c.phase, speed: c.speed,
            metadata: { character: c.character, moonwalk: c.moonwalk, model: c.group.userData.key, modelMoonwalk: c.group.userData.moonwalk } };
        });
        check(row[1].phase > row[0].phase && row[1].phase < row[0].phase * 1.6, 'MJ phase must be slightly faster', row);
        check(row[1].progress > row[0].progress && row[1].progress < row[0].progress * 1.8, 'MJ travel speed regression', row);
        samples.push({ yaw, row });
      }
      return samples;
    } finally {
      b.critters.splice(0, b.critters.length, ...originals);
      for (const s of saved) { k.restoreObject(s.c, s.values); s.restore(); }
    }
  });
  check(JSON.stringify(k.population()) === JSON.stringify(before), 'Controlled NPC probe changed world population');
  return { population: before, samples: result };
}

function dragonProbe() {
  const k = window.__bcTest, { b, check } = k;
  const dragons = k.api('dragons');
  // 45-dragons.js publishes articulated upper/outer joints in parts.wings.
  const wingsOf = (d) => d.parts.wings.flatMap((wing) => [wing.upper, wing.outer]);
  check(dragons.length === window.BCDragonRules.count(b.seed), 'Seeded guardian/mount population is incomplete');
  const guardians = dragons.filter((d) => d.type === 'guardian'), mounts = dragons.filter((d) => d.type === 'mount');
  check(guardians.length === 4 && mounts.length >= 2 && mounts.length <= 3, 'Dragon classes do not meet the requested balance');
  check(guardians.every((d) => d.indestructible && d.invulnerable && !b.riding.rideable(d)) &&
    mounts.every((d) => b.riding.rideable(d) && d.group.scale.x < 0.46), 'Guardian immunity/mount eligibility is incorrect');
  check(Math.min(...guardians.map((d) => d.group.scale.x)) > Math.max(...mounts.map((d) => d.group.scale.x)) * 2.2,
    'Guardian and mount sizes are not visibly distinct');
  const count = dragons.length;
  const roots = dragons.map((d) => d.group);
  const resources = () => {
    const nodes = [], geometries = new Set(), materials = new Set();
    for (const root of roots) root.traverse((node) => {
      nodes.push(node.uuid);
      if (node.geometry) geometries.add(node.geometry.uuid);
      if (node.material) materials.add(node.material.uuid);
    });
    return { nodes, geometries: [...geometries], materials: [...materials], scene: b.scene.children.map((n) => n.uuid) };
  };
  const beforeResources = resources();
  for (let i = 0; i < 3; i++) {
    check(k.api('spawnDragons')() === dragons, 'Spawner did not return the existing dragon collection');
    check(dragons.length === count && dragons.every((d, i) => d.group === roots[i]), 'Repeated spawn duplicated/replaced dragons');
  }
  check(JSON.stringify(resources()) === JSON.stringify(beforeResources), 'Repeated spawning grew scene/GPU resources');
  const restores = roots.map(k.graph);
  const metadata = dragons.map((d, i) => ({ keys: Object.keys(d), userData: Object.keys(roots[i].userData), wingJoints: wingsOf(d).length }));
  const samples = [];
  try {
    const start = performance.now();
    for (const elapsed of [0, 250, 850, 2100, 12_500, 47_500]) {
      k.api('updateDragons')(1 / 60, start + elapsed);
      let visible = 0;
      const row = dragons.map((d, i) => {
        const root = roots[i], measured = k.model(root);
        const p = root.getWorldPosition(new b.THREE.Vector3());
        let shown = true;
        for (let n = root; n; n = n.parent) shown = shown && n.visible;
        if (shown && root.parent) visible++;
        check(p.y > b.terrainHeight(p.x, p.z), 'Dragon intersects terrain', p.toArray());
        const wings = wingsOf(d);
        check(wings.length === 4, 'Missing upper/outer articulated wing joints', metadata[i]);
        return { position: p.toArray(), size: measured.size, wings: wings.map((w) => [...w.position.toArray(), ...w.quaternion.toArray()]) };
      });
      check(visible >= 3 && dragons.length === count, 'Dragons disappeared or grew without bound', { visible, count: dragons.length });
      samples.push({ elapsed, row });
    }
    for (let i = 0; i < count; i++) {
      check(samples.some((s) => JSON.stringify(s.row[i].wings) !== JSON.stringify(samples[0].row[i].wings)), 'Static dragon wings', i);
      check(samples.some((s) => new b.THREE.Vector3(...s.row[i].position).distanceTo(new b.THREE.Vector3(...samples[0].row[i].position)) > 1), 'Static dragon path', i);
    }
    return { count, guardians: guardians.length, mounts: mounts.length, metadata, samples };
  } finally {
    restores.forEach((restore) => restore());
  }
}

module.exports = { ROSTER, bootProbe, rosterProbe, rosterGallery, critterProbe, dragonProbe };
