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
  resetPlayerMotion();

  playBtn.textContent = 'Building 0%';
  await buildWorldMeshes();
  await nextFrame();

  buildAvatar();
  refreshGunModels();
  updateCamera(1 / 60);
  updateCombatHud();
  playBtn.textContent = 'Spawning dragons…';
  await nextFrame();
  spawnDragons();
  updateBuilding(0);

  // warm up the shader compiler before the first frame
  renderer.compile(scene, camera);
  const bootNow = performance.now();
  updateDestruction(0, bootNow);
  updateScoreboard(0, bootNow);
  updateCharacterOutlines();
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
    UNLIMITED_BUILDING, buildItemCount, takeBuildItems,
    openCraft, closeCraft, craftEl,
    CHARACTERS, CHAR_KEYS, setCharacter, cycleCharacter, localAvatar: () => localAvatar,
    makeHumanoid, makeChicken,
    critters, net, connectNet, updateCritters, updateCamera, updateAvatar, buildAvatar,
    updatePlayer, resetPlayerMotion, updateAvatarWeaponPose,
    addCharacterOutline, updateCharacterOutlines,
    dragons, spawnDragons, updateDragons, makeDragon,
    quickBuild, selectBuildPiece, cancelQuickBuild, rotateBuildPiece,
    placeQuickBuild, updateBuilding, resetBuildingInput,
    BUILD_PIECES, setQuickBuildMaterial, buildPieceCells, preflightBuildPiece, commitBuildPiece,
    setBuildingHeld, resetGameplayInput,
    terrainHeight, biomeAt, snowLineAt, villageSites, trees, WORLD, HEIGHT, SEA,
    WEAPONS, gun, fireOnce, startReload, selectWeapon, cycleWeapon, setCombatMode, isScopeActive,
    voxelDamageMap, damageVoxelFromShot, applyVoxelDamage, updateDestruction, resetVoxelDamage,
    VOXEL_DURABILITY, voxelDurability,
    applyDamage, doRespawn, attachAvatarGun, makeGunModel, startOnline, createRoom,
    leaveOnline, updateCombat, updateCombatHud, mqtt, roomInput: roomInputEl,
    scoreboard, setScoreboardVisible, updateScoreboard,
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
    CHAR_KEYS.length + ' characters · ' + dragons.length + ' dragons · ' +
    trees.length + ' trees · ' + villageSites.length + ' villages · ' +
    critters.length + ' critters · ' + WORLD + '×' + WORLD + ' blocks · seed ' + SEED;
  statsEl.textContent = 'ready';
  const roomParam = normalizeRoom(new URLSearchParams(location.search).get('room') || '');
  if (roomParam) startOnline(roomParam);
  else connectNet();
  requestAnimationFrame(loop);
}

/* ---------------- menu accessibility ---------------- */
function syncRosterAccessibility() {
  for (const button of charsEl.querySelectorAll('.char')) {
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
  }
}
syncRosterAccessibility();
const rosterSelectionObserver = new MutationObserver(syncRosterAccessibility);
rosterSelectionObserver.observe(charsEl, { attributes: true, attributeFilter: ['class'], subtree: true });

// The scoreboard stays pointer-transparent while its long roster can still scroll.
const scoreboardScroller = document.querySelector('#scoreboard .scoreboard-table-wrap');
document.addEventListener('wheel', (event) => {
  if (!scoreboard.visible) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scoreboardScroller.clientHeight : 1;
  scoreboardScroller.scrollTop += event.deltaY * unit;
  event.preventDefault();
  event.stopImmediatePropagation();
}, { capture: true, passive: false });

/* ---------------- main loop ---------------- */
let last = null;
let fpsAccum = 0, fpsFrames = 0, fpsTimer = 0;
let shownFps = 0;

function resetFrameClock() {
  last = null;
  fpsAccum = 0; fpsFrames = 0; fpsTimer = 0;
}
document.addEventListener('visibilitychange', resetFrameClock);
window.addEventListener('pageshow', resetFrameClock);
window.addEventListener('focus', resetFrameClock);

function loop(now) {
  requestAnimationFrame(loop);
  const dt = last === null || document.hidden ? 0 : Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = document.hidden ? null : now;
  const playing = !document.hidden && document.pointerLockElement === renderer.domElement && !craftOpen;

  if (playing) {
    updatePlayer(dt);
  } else {
    player.groundSpeed *= Math.max(0, 1 - dt * 10);
  }
  updateAvatar(dt);
  updateCamera(dt);
  updateCombat(dt, now);
  if (playing && alive && !combatMode && !quickBuild.active) {
    updateHover();
  } else {
    highlight.visible = false;
    hovered = null;
  }
  updateBuilding(dt);
  updateCritters(dt);
  updateDragons(dt, now);
  updateNetPlayers(dt);
  sendNetState(now);
  sky.position.set(camera.position.x, 0, camera.position.z);

  updateDestruction(dt, now);
  updateScoreboard(dt, now);
  updateCharacterOutlines();
  renderer.render(scene, camera);

  if (dt > 0) { fpsAccum += dt; fpsFrames++; fpsTimer += dt; }
  if (fpsTimer >= 0.4) {
    shownFps = Math.round(fpsFrames / fpsAccum);
    fpsAccum = 0; fpsFrames = 0; fpsTimer = 0;
    const p = player.pos;
    statsEl.textContent =
      shownFps + ' fps · x ' + p.x.toFixed(1) + ' y ' + p.y.toFixed(1) + ' z ' + p.z.toFixed(1) +
      ' · ' + CHARACTERS[charKey].name +
      ' · ' + Math.ceil(health) + 'hp · ' + currentWeapon().name +
      ' · ' + (isScopeActive() ? 'scope' : (thirdPerson ? 'shoulder' : '1st')) +
      ' · ' + (net.online ? (net.mode === 'mqtt' ? 'room ' + net.room : netPlayerCount() + ' online') : 'solo') +
      (quickBuild.active ? ' · quick ' + quickBuild.kind : (combatMode ? '' : ' · mine / build')) +
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
    el.textContent = 'Something went wrong while starting Blockcraft Battle Ground: ' + e.message;
  }
});
