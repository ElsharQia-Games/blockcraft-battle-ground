'use strict';

// Serialized into Runtime.evaluate after boot. Every stateful local probe runs
// synchronously: the game's RAF cannot interleave with fixture setup/restoration.
function installKit() {
  const b = window.__blockcraft;
  const check = (ok, message, detail) => {
    if (!ok) throw new Error(`${message}${detail === undefined ? '' : ': ' + JSON.stringify(detail)}`);
  };
  const optional = (name) => {
    if (name in b) return b[name];
    try { return (0, eval)(name); } catch (error) { if (error instanceof ReferenceError) return undefined; throw error; }
  };
  const api = (name) => {
    const value = optional(name);
    check(value !== undefined, `Integrated API unavailable: ${name}`);
    return value;
  };
  const clone = (value) => {
    if (value?.clone && (value.isVector2 || value.isVector3 || value.isQuaternion || value.isEuler)) return value.clone();
    if (Array.isArray(value)) return value.map(clone);
    if (value instanceof Set) return new Set([...value].map(clone));
    if (value && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
      return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, clone(v)]));
    }
    return value;
  };
  const restoreObject = (target, saved) => {
    for (const key of Object.keys(target)) if (!(key in saved)) delete target[key];
    for (const [key, value] of Object.entries(saved)) {
      if (target[key] === value) continue;
      if (target[key]?.copy && (value?.isVector2 || value?.isVector3 || value?.isQuaternion || value?.isEuler)) target[key].copy(value);
      else target[key] = clone(value);
    }
  };
  const resetKeys = () => {
    const keys = api('keys');
    for (const key of Object.keys(keys)) keys[key] = false;
    b.gun.trigger = b.gun.aiming = false;
    optional('resetPlayerMotion')?.();
  };
  const key = (code, down = true, repeat = false, target = document.activeElement || document) => {
    const names = { Space: ' ', ShiftLeft: 'Shift', ControlLeft: 'Control', Escape: 'Escape' };
    target.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {
      code, key: names[code] || code.replace(/^Key/, '').toLowerCase(), bubbles: true, cancelable: true, repeat
    }));
  };
  const focusField = () => {
    // The actual menu is deliberately inert while playing. Use a genuinely
    // focusable field to exercise focus-in cancellation instead of focusing it.
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-label', 'Regression text entry');
    input.style.cssText = 'position:fixed;top:12px;left:12px;z-index:1000';
    document.body.appendChild(input);
    input.focus();
    check(document.activeElement === input, 'Text-entry fixture did not receive focus');
    return input;
  };

  function state(run) {
    const saved = {
      player: clone(b.player), gun: clone(b.gun), inventory: clone(b.inventory), hotbar: [...b.HOTBAR], keys: clone(api('keys')),
      motion: clone(optional('playerMotion')), selected: optional('selected'),
      focused: optional('inputWindowFocused'), active: optional('inputWasActive'), buttons: clone(optional('inputButtonsDown')),
      heldAt: optional('buildingHeld')?.nextActionAt,
      building: optional('quickBuild') && { kind: optional('quickBuild').kind, rotation: optional('quickBuild').rotation, material: optional('quickBuild').material },
      char: b.charKey, third: b.thirdPerson, combat: b.combatMode,
      alive, health, kills, deaths, lastDamageAt, respawnAt, muted, craftOpen,
      camera: { position: b.camera.position.clone(), quaternion: b.camera.quaternion.clone(), fov: b.camera.fov },
      dom: ['hint', 'death', 'craft', 'hurt'].map((id) => {
        const el = document.getElementById(id);
        return [el, el?.className, el?.getAttribute('style')];
      }),
      bodyClass: document.body.className,
      feed: document.getElementById('killfeed').innerHTML
    };
    try {
      muted = true;
      resetKeys();
      const result = run();
      check(!result?.then, 'A controlled fixture must remain synchronous');
      return result;
    } finally {
      optional('cancelQuickBuild')?.();
      resetKeys();
      alive = saved.alive;
      health = saved.health;
      kills = saved.kills;
      deaths = saved.deaths;
      lastDamageAt = saved.lastDamageAt;
      respawnAt = saved.respawnAt;
      craftOpen = saved.craftOpen;
      restoreObject(b.player, saved.player);
      restoreObject(b.gun, saved.gun);
      restoreObject(b.inventory, saved.inventory);
      restoreObject(api('keys'), saved.keys);
      b.HOTBAR.splice(0, b.HOTBAR.length, ...saved.hotbar);
      b.thirdPerson = saved.third;
      b.setCombatMode(saved.combat);
      // setCombatMode intentionally releases inputs; restore the captured gun afterwards.
      restoreObject(b.gun, saved.gun);
      b.setCharacter(saved.char);
      optional('refreshGunModels')?.();
      b.updateAvatar(1);
      b.updateCamera();
      b.camera.position.copy(saved.camera.position);
      b.camera.quaternion.copy(saved.camera.quaternion);
      b.camera.fov = saved.camera.fov;
      b.camera.updateProjectionMatrix();
      b.camera.updateMatrixWorld(true);
      b.updateCombatHud();
      if (saved.motion) restoreObject(api('playerMotion'), saved.motion);
      if (typeof selected !== 'undefined') selected = saved.selected;
      if (typeof inputWindowFocused !== 'undefined') inputWindowFocused = saved.focused;
      if (typeof inputWasActive !== 'undefined') inputWasActive = saved.active;
      if (saved.buttons) { inputButtonsDown.clear(); for (const button of saved.buttons) inputButtonsDown.add(button); }
      if (saved.building) Object.assign(api('quickBuild'), saved.building);
      if (saved.heldAt !== undefined) api('buildingHeld').nextActionAt = saved.heldAt;
      optional('refreshHotbar')?.();
      for (const [el, className, style] of saved.dom) {
        if (!el) continue;
        el.className = className;
        if (style === null) el.removeAttribute('style'); else el.setAttribute('style', style);
      }
      document.body.className = saved.bodyClass;
      document.getElementById('killfeed').innerHTML = saved.feed;
      muted = saved.muted;
    }
  }

  function graph(root) {
    const saved = [];
    root.traverse((node) => saved.push([node, node.position.clone(), node.quaternion.clone(), node.scale.clone(), node.visible]));
    return () => {
      for (const [node, p, q, s, visible] of saved) {
        node.position.copy(p); node.quaternion.copy(q); node.scale.copy(s); node.visible = visible;
      }
      root.updateWorldMatrix(true, true);
    };
  }

  function model(root) {
    check(root?.isObject3D, 'Expected a real THREE.Object3D');
    root.updateWorldMatrix(true, true);
    let meshes = 0, textures = 0, nodes = 0;
    root.traverse((node) => {
      nodes++;
      for (const values of [node.position.toArray(), node.quaternion.toArray(), node.scale.toArray(), node.matrixWorld.elements]) {
        check(values.every(Number.isFinite), 'Non-finite model transform', { node: node.name, values });
      }
      if (!node.isMesh) return;
      meshes++;
      check(node.geometry?.attributes.position?.count > 0, 'Empty mesh geometry', node.name);
      for (const attr of Object.values(node.geometry.attributes)) {
        check(Array.from(attr.array).every(Number.isFinite), 'Non-finite vertex/UV attribute', node.name);
      }
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        check(!!material, 'Mesh has no material');
        if (!material.map) continue;
        textures++;
        const image = material.map.image;
        check(image && image.width > 0 && image.height > 0, 'Missing texture image');
        if ('naturalWidth' in image) check(image.complete && image.naturalWidth > 0, 'Unloaded image texture');
        if (image.getContext) {
          const rgba = image.getContext('2d').getImageData(0, 0, image.width, image.height).data;
          check(rgba.some((value, i) => i % 4 === 3 && value > 0), 'Completely absent texture');
          // The authored six-face atlas is 3x2. Validate all tiles, including backs/bottoms.
          if (image.width === 96 && image.height === 64 && !material.transparent) {
            for (let face = 0; face < 6; face++) {
              let painted = 0;
              for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
                const px = (face % 3) * 32 + x, py = Math.floor(face / 3) * 32 + y;
                if (rgba[(py * image.width + px) * 4 + 3] > 0) painted++;
              }
              check(painted >= 1000, 'Absent or incomplete opaque atlas face', { face, painted });
            }
          }
        }
      }
    });
    check(meshes > 0, 'Model has no visible geometry');
    const bounds = new b.THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new b.THREE.Vector3()).toArray();
    check(size.every((v) => Number.isFinite(v) && v > 0), 'Invalid model bounds', size);
    return { nodes, meshes, textures, size };
  }

  function pose(root) {
    const rows = [];
    const visit = (node, path) => {
      // Child-local transforms isolate reload articulation from camera sway/recoil.
      if (path) rows.push({ path, values: [...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray(), +node.visible] });
      node.children.forEach((child, i) => visit(child, path ? `${path}/${i}` : String(i)));
    };
    visit(root, '');
    return rows;
  }
  const poseDistance = (a, c) => a.length !== c.length ? Infinity : a.reduce((max, row, i) =>
    Math.max(max, ...row.values.map((value, j) => Math.abs(value - c[i].values[j]))), 0);

  function world() {
    const live = api('blocks');
    const saved = live.slice();
    const changes = (before = saved) => {
      const out = [], w = b.WORLD;
      for (let i = 0; i < live.length; i++) if (live[i] !== before[i]) {
        out.push({ x: i % w, y: Math.floor(i / (w * w)), z: Math.floor(i / w) % w, from: before[i], to: live[i] });
      }
      return out;
    };
    const dirty = (cells) => {
      const chunk = api('CHUNK'), chunks = new Set();
      for (const { x, z } of cells) {
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          chunks.add(`${Math.floor((x + dx) / chunk)},${Math.floor((z + dz) / chunk)}`);
        }
      }
      for (const key of chunks) {
        const [cx, cz] = key.split(',').map(Number);
        if (cx >= 0 && cz >= 0 && cx * chunk < b.WORLD && cz * chunk < b.WORLD) api('markDirty')(cx * chunk + 1, cz * chunk + 1);
      }
    };
    const restore = (before = saved) => {
      const changed = changes(before);
      for (const c of changed) b.setBlock(c.x, c.y, c.z, c.from);
      dirty(changed);
    };
    return { changes, dirty, restore, snapshot: () => live.slice() };
  }

  function pad({ x = 128, z = 128, y = b.HEIGHT - 12, radius = 10 } = {}) {
    const writes = [];
    for (let px = Math.max(0, x - radius); px <= Math.min(b.WORLD - 1, x + radius); px++) {
      for (let pz = Math.max(0, z - radius); pz <= Math.min(b.WORLD - 1, z + radius); pz++) {
        for (let py = y; py <= Math.min(b.HEIGHT - 1, y + 9); py++) {
          b.setBlock(px, py, pz, py === y ? api('STONE') : api('AIR'));
          writes.push({ x: px, y: py, z: pz });
        }
      }
    }
    return { x: x + 0.5, y: y + 1, z: z + 0.5, writes };
  }

  function onPad(site) {
    resetKeys();
    b.player.pos.set(site.x, site.y + 0.001, site.z + 4);
    b.player.vel.set(0, 0, 0);
    b.player.fly = false;
    b.player.onGround = true;
    b.player.yaw = 0;
    b.player.pitch = -0.4;
    b.player.groundSpeed = b.player.walkPhase = 0;
    b.thirdPerson = false;
    b.updateCamera();
    b.camera.updateMatrixWorld(true);
  }

  function population() {
    const counts = {};
    for (const c of b.critters) counts[c.kind] = (counts[c.kind] || 0) + 1;
    return { counts, villages: b.villageSites.length, trees: b.trees.length };
  }

  window.__bcTest = { b, check, optional, api, clone, restoreObject, resetKeys, key, focusField, state, graph, model, pose, poseDistance, world, pad, onPad, population };
  return { api: Object.keys(b), population: population() };
}

module.exports = { installKit };
