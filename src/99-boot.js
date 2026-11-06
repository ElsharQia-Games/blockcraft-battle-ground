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
  if (BC.api.modes) BC.api.modes.prepareWorld();
  await nextFrame();

  // pick the spawn before meshing so any safety clearing is baked in
  const spawn = BC.api.modes && BC.api.modes.activeDef.locked
    ? BC.api.modes.respawnPoint(BC.api.modes.localTeam) : findSpawn();
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

  // handy for poking around in the console
  window.__blockcraft = {
    BC, features: BC.api, settings: BC.settings,
    modes: BC.api.modes, world: BC.api.world, physics: BC.api.physics,
    jetpack: BC.api.jetpack, riding: BC.api.riding, killcam: BC.api.killcam,
    combatFx: BC.api.combatFx, audio: BC.api.audio, hud: BC.api.hud, minimap: BC.api.minimap,
    menus: BC.api.menus, dragonBodies: BC.api.dragons,
    THREE, renderer, scene, camera, player, getBlock, setBlock,
    raycast: raycastVoxel, breakBlock, placeBlock, selectSlot, HOTBAR,
    hovered: () => hovered,
    inventory, addItem, takeItem, itemCount,
    UNLIMITED_BUILDING, buildItemCount, takeBuildItems,
    cycleHotbarMaterial, getInputMouseDiagnostics,
    CHARACTERS, CHAR_KEYS, setCharacter, cycleCharacter, localAvatar: () => localAvatar,
    makeHumanoid, makeChicken, poseHumanoidStance,
    critters, net, connectNet, updateCritters, updateCamera, updateAvatar, buildAvatar,
    updatePlayer, resetPlayerMotion, updateAvatarWeaponPose,
    playerBodyHeight: () => typeof playerBodyHeight === 'function' ? playerBodyHeight() : PH,
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
    get seed() { return SEED; },
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
  BC.flags.bootReady = true;
  BC.emit('worldReady');
  BC.markReady();
  refreshWorldSummary();

  // Compile after feature hooks have installed their reusable visual resources.
  renderer.compile(scene, camera);
  const bootNow = performance.now();
  updateCamera(0);
  updateDestruction(0, bootNow);
  updateScoreboard(0, bootNow);
  updateCharacterOutlines();
  BC.emit('lateFrame', 0, bootNow);
  renderer.render(scene, camera);

  loading = false;
  playBtn.disabled = false;
  playBtn.textContent = 'Click to play';
  if (BC.api.menus) BC.api.menus.refresh();
  document.body.classList.add('combat');
  if (onlineBtnEl) onlineBtnEl.disabled = false;
  if (createBtnEl) createBtnEl.disabled = false;
  if (location.search.includes('shot')) hintEl.classList.add('hidden');
  statsEl.textContent = 'ready';
  // A refresh in the middle of a match goes back to the same room.
  let activeRoom = '';
  try { activeRoom = sessionStorage.getItem('blockcraft.activeRoom') || ''; } catch (e) { /* ignore */ }
  const roomParam = normalizeRoom(new URLSearchParams(location.search).get('room') || activeRoom);
  if (roomParam) startOnline(roomParam);
  else connectNet();
  requestAnimationFrame(loop);
}

function refreshWorldSummary() {
  document.getElementById('tiny').textContent =
    CHAR_KEYS.length + ' characters · ' + dragons.length + ' dragons · ' +
    trees.length + ' trees · ' + villageSites.length + ' villages · ' +
    critters.length + ' critters · ' + WORLD + '×' + WORLD + ' blocks · seed ' + SEED;
}
BC.on('worldReset', refreshWorldSummary);

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
  // Keep the last complete frame while regeneration yields between chunk builds.
  // No physics, held fire, or stale state may read a half-generated world.
  if (BC.flags.worldBusy) { last = null; return; }
  const frameElapsed = last === null || document.hidden ? 0 : Math.max(0, (now - last) / 1000);
  const dt = Math.min(0.05, frameElapsed);
  last = document.hidden ? null : now;
  const playing = isGameplayInputActive();
  BC.flags.playing = playing;
  BC.emit('preFrame', dt, now, playing);

  if (playing) {
    updatePlayer(dt);
  } else {
    player.groundSpeed *= Math.max(0, 1 - dt * 10);
  }
  updateAvatar(dt);
  updateCamera(dt);
  updateCombat(dt, now);
  BC.emit('postPlayer', dt, now, playing);
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
  BC.emit('frame', dt, now, playing);

  updateDestruction(dt, now);
  updateScoreboard(dt, now);
  updateCharacterOutlines();
  BC.emit('lateFrame', dt, now);
  sendNetState(now);
  sky.position.set(camera.position.x, 0, camera.position.z);
  // Render-only effects (camera shake) wrap the draw and are undone at once,
  // so input, hit tests and outgoing poses never see them.
  BC.emit('preRender', dt, now);
  renderer.render(scene, camera);
  BC.emit('postRender', dt, now);

  // Physics caps long frames for stability; diagnostics must use the uncapped
  // wall clock or slow rendering would incorrectly report at least 20 FPS.
  if (frameElapsed > 0) { fpsAccum += frameElapsed; fpsFrames++; fpsTimer += frameElapsed; }
  if (fpsTimer >= 0.4) {
    shownFps = Math.round(fpsFrames / fpsAccum);
    fpsAccum = 0; fpsFrames = 0; fpsTimer = 0;
    if (BC.api.hud && typeof BC.api.hud.setDiagnostics === 'function') {
      BC.api.hud.setDiagnostics(shownFps);
    } else {
      statsEl.textContent = shownFps + ' FPS';
    }
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
