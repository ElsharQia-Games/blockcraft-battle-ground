/* Blockcraft Battle Ground — Boot sequence, main loop and top-level error handling.
   99-boot.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
let loading = true;
const nextFrame = () => new Promise((r) => setTimeout(r, 0));
const clickBlock = (x, y, z) => setBlock(x, y, z, AIR);

async function buildWorldMeshes() {
  let done = 0;
  const total = CHUNKS * CHUNKS;
  for (let cx = 0; cx < CHUNKS; cx++) {
    for (let cz = 0; cz < CHUNKS; cz++) {
      rebuildChunk(cx, cz);
      done++;
      if (done % 4 === 0) {
        playBtn.textContent = 'Building ' + Math.round((done / total) * 100) + '%';
        await nextFrame();
      }
    }
  }
}

async function boot() {
  playBtn.textContent = 'Carving terrain…';
  await nextFrame();
  generateTerrain();
  await nextFrame();

  // pick the spawn before meshing so any safety clearing is baked in
  const spawn = findSpawn();
  player.pos.set(spawn.x, spawn.y, spawn.z);
  player.vel.set(0, 0, 0);

  playBtn.textContent = 'Building 0%';
  await buildWorldMeshes();
  await nextFrame();

  buildAvatar();
  refreshGunModels();
  updateCamera();
  updateCombatHud();

  // warm up the shader compiler before the first frame
  renderer.compile(scene, camera);
  renderer.render(scene, camera);

  loading = false;
  playBtn.disabled = false;
  playBtn.textContent = 'Click to play';
  document.body.classList.add('combat');
  if (onlineBtnEl) onlineBtnEl.disabled = false;
  if (createBtnEl) createBtnEl.disabled = false;
  if (location.search.includes('shot')) hintEl.classList.add('hidden');

  // handy for poking around in the console
  window.__blockcraft = {
    THREE, renderer, scene, camera, player, getBlock, setBlock,
    raycast: raycastVoxel, breakBlock, placeBlock, selectSlot, HOTBAR,
    hovered: () => hovered,
    inventory, addItem, takeItem, itemCount, RECIPES, doCraft, refreshCraft,
    openCraft, closeCraft, craftEl,
    CHARACTERS, CHAR_KEYS, setCharacter, cycleCharacter, localAvatar: () => localAvatar,
    makeHumanoid, makeChicken,
    critters, net, connectNet, updateCritters, updateCamera, updateAvatar, buildAvatar,
    terrainHeight, biomeAt, snowLineAt, villageSites, trees, WORLD, HEIGHT, SEA,
    WEAPONS, gun, fireOnce, startReload, selectWeapon, cycleWeapon, setCombatMode,
    applyDamage, doRespawn, attachAvatarGun, makeGunModel, startOnline, createRoom,
    leaveOnline, updateCombat, updateCombatHud, mqtt, roomInput: roomInputEl,
    get combatMode() { return combatMode; },
    set combatMode(v) { setCombatMode(!!v); },
    get alive() { return alive; },
    get health() { return health; },
    set health(v) { setHealth(v); },
    get kills() { return kills; },
    get deaths() { return deaths; },
    get thirdPerson() { return thirdPerson; },
    set thirdPerson(v) { thirdPerson = !!v; },
    get charKey() { return charKey; },
    get playerName() { return playerName; }
  };
  document.getElementById('tiny').textContent =
    trees.length + ' trees · ' + villageSites.length + ' villages · ' +
    critters.length + ' critters · ' + WORLD + '×' + WORLD + ' blocks · seed ' + SEED;
  statsEl.textContent = 'ready';
  const roomParam = normalizeRoom(new URLSearchParams(location.search).get('room') || '');
  if (roomParam) startOnline(roomParam);
  else connectNet();
  requestAnimationFrame(loop);
}

/* ---------------- main loop ---------------- */
let last = performance.now();
let fpsAccum = 0, fpsFrames = 0, fpsTimer = 0;
let shownFps = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (document.pointerLockElement === renderer.domElement && !craftOpen) {
    updatePlayer(dt);
  } else {
    player.groundSpeed *= Math.max(0, 1 - dt * 10);
  }
  updateAvatar(dt);
  updateCamera();
  updateCombat(dt, now);
  if (combatMode) { if (highlight) highlight.visible = false; }
  else updateHover();
  updateCritters(dt);
  updateNetPlayers(dt);
  sendNetState(now);
  sky.position.set(camera.position.x, 0, camera.position.z);

  renderer.render(scene, camera);

  fpsAccum += dt; fpsFrames++; fpsTimer += dt;
  if (fpsTimer >= 0.4) {
    shownFps = Math.round(fpsFrames / fpsAccum);
    fpsAccum = 0; fpsFrames = 0; fpsTimer = 0;
    const p = player.pos;
    statsEl.textContent =
      shownFps + ' fps · x ' + p.x.toFixed(1) + ' y ' + p.y.toFixed(1) + ' z ' + p.z.toFixed(1) +
      ' · ' + CHARACTERS[charKey].name +
      ' · ' + Math.ceil(health) + 'hp · ' + currentWeapon().name +
      ' · ' + (thirdPerson ? '3rd' : '1st') +
      ' · ' + (net.online ? (net.mode === 'mqtt' ? 'room ' + net.room : netPlayerCount() + ' online') : 'solo') +
      (combatMode ? '' : ' · build') +
      (player.fly ? ' · flying' : '');
  }
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('err');
  el.style.display = 'flex';
  el.textContent = 'Something went wrong while starting Blockcraft Battle Ground: ' + (err && err.message ? err.message : err);
});

window.addEventListener('error', (e) => {
  if (loading && e.message) {
    const el = document.getElementById('err');
    el.style.display = 'flex';
    el.innerHTML = 'Could not load three.js from the CDN.<br>Check your internet connection, then reload this page.';
  }
});
