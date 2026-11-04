/* Blockcraft Battle Ground — Ground reference beneath the local player.
   53-ground-marker.js
   A small depth-tested contact shadow/ring, not a shadow-map pass or a promise
   of a future ballistic trajectory. The same surface query calibrates steep
   downward shoulder aim. Load after player/jetpack, before building/combat. */
'use strict';

(function () {
  const surface = { x: 0, y: 0, z: 0, water: false, block: 0 };
  let cacheX = -1, cacheY = -1, cacheZ = -1, cacheWater = true, cached = false, found = false;
  let groundHeight = 0, aboveGround = 0, onWater = false, lastTeam = '';
  const root = new THREE.Group();
  root.name = 'player-ground-reference';
  root.visible = false;
  root.rotation.x = -Math.PI / 2;
  root.userData = { noOutline: true, isFX: true };

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 3, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(3,7,12,.8)');
  gradient.addColorStop(0.55, 'rgba(3,7,12,.36)');
  gradient.addColorStop(1, 'rgba(3,7,12,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, opacity: 0.3,
    depthTest: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xd8e6f2, transparent: true, opacity: 0.2,
    depthTest: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), shadowMaterial);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.49, 0.525, 32), ringMaterial);
  function noRaycast() {}
  for (const mesh of [shadow, ring]) {
    mesh.raycast = noRaycast;
    mesh.userData = { noOutline: true, isFX: true };
  }
  shadow.renderOrder = 2;
  ring.renderOrder = 3;
  root.add(shadow, ring);
  scene.add(root);

  // Cached by the current voxel column/probe height. It starts at the player's
  // feet, never the top of the world, so a cave ceiling is not mistaken for the
  // floor beneath them. The returned object is reused; callers must not mutate it.
  function surfaceAt(x, feetY, z, includeWater = true) {
    if (!Number.isFinite(x + feetY + z) || x < 0 || z < 0 || x >= WORLD || z >= WORLD || feetY < 0) return null;
    const bx = Math.floor(x), bz = Math.floor(z), by = Math.min(HEIGHT - 1, Math.floor(feetY));
    if (!cached || bx !== cacheX || by !== cacheY || bz !== cacheZ || includeWater !== cacheWater) {
      cacheX = bx; cacheY = by; cacheZ = bz;
      cacheWater = includeWater;
      cached = true; found = false;
      for (let y = by; y >= 0; y--) {
        const block = getBlock(bx, y, bz);
        if (block === AIR || (block === WATER && !includeWater)) continue;
        let top = y + 1;
        if (block === WATER) {
          while (top < HEIGHT && getBlock(bx, top, bz) === WATER) top++;
        }
        surface.y = top;
        surface.water = block === WATER;
        surface.block = block;
        found = true;
        break;
      }
    }
    if (!found || (!surface.water && surface.y > feetY + 0.05)) return null;
    surface.x = x; surface.z = z;
    return surface;
  }

  function hide() { root.visible = false; }
  function reset() { cached = false; hide(); }
  function update() {
    if (!BC.flags.bootReady || !BC.flags.playing || BC.flags.menuOpen || BC.flags.worldBusy ||
        BC.flags.playerRepairBlocked || !alive || document.hidden) { hide(); return; }
    const hit = surfaceAt(player.pos.x, player.pos.y, player.pos.z);
    // Deep underwater, do not draw a "floor" above the player's head.
    if (!hit || hit.y > player.pos.y + playerEyeHeight()) { hide(); return; }
    groundHeight = hit.y;
    aboveGround = Math.max(0, player.pos.y - hit.y);
    onWater = hit.water;
    const grounded = player.onGround && aboveGround < 0.12;
    const modes = BC.api.modes;
    const team = modes && modes.localTeam || 'neutral';
    if (lastTeam !== team) {
      ringMaterial.color.set(BC.teamColor(team));
      lastTeam = team;
    }
    // A quiet contact shadow on foot; a clearer locator in the air. No extra
    // light, perpetual pulse, world scans or changes to collision/velocity.
    shadowMaterial.opacity = onWater ? 0.12 : grounded ? 0.38 : 0.2;
    ringMaterial.opacity = grounded ? 0.17 : 0.56;
    const scale = 1 + Math.min(0.35, aboveGround * 0.006);
    root.scale.setScalar(scale);
    root.position.set(player.pos.x, hit.y + 0.024, player.pos.z);
    root.visible = true;
  }

  BC.api.groundMarker = {
    surfaceAt,
    get state() {
      return { visible: root.visible, groundY: groundHeight, height: aboveGround, water: onWater, team: lastTeam };
    }
  };
  BC.on('lateFrame', update, 800);
  BC.on('voxelChanged', () => { cached = false; });
  BC.on('worldWillReset', reset);
  BC.on('worldReset', reset);
  BC.on('death', hide);
  BC.on('inputReset', hide);
})();
