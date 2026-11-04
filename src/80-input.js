/* Blockcraft Battle Ground — Pointer lock, mouse, keyboard and resize input.
   80-input.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ---------------- input ---------------- */
const hintEl = document.getElementById('hint');
const playBtn = document.getElementById('play');
const statsEl = document.getElementById('stats');

function lockPointer() {
  if (document.pointerLockElement !== renderer.domElement) {
    const p = renderer.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }
}

playBtn.addEventListener('click', lockPointer);
renderer.domElement.addEventListener('click', () => {
  if (!craftOpen && !hintEl.classList.contains('hidden')) lockPointer();
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    hintEl.classList.add('hidden');
    document.body.classList.add('started');
  } else {
    for (const k in keys) keys[k] = false;
    player.vel.set(0, 0, 0);
    gun.trigger = false;
    gun.aiming = false;
    document.body.classList.remove('started');
    if (!loading && !craftOpen) {
      hintEl.classList.remove('hidden');
      playBtn.textContent = 'Click to resume';
    }
  }
});
document.addEventListener('pointerlockerror', () => toast('Pointer lock unavailable — click the page again'));

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  const lim = Math.PI / 2 - 0.02;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
});

document.addEventListener('mousedown', (e) => {
  if (craftOpen) return;
  if (document.pointerLockElement !== renderer.domElement) return;
  if (!combatMode) {
    if (e.button === 0) breakBlock();
    else if (e.button === 2) placeBlock();
    return;
  }
  if (e.button === 0) {
    gun.trigger = true;
    fireOnce();
  } else if (e.button === 2) {
    gun.aiming = true;
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) gun.trigger = false;
  else if (e.button === 2) gun.aiming = false;
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('wheel', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  if (combatMode) cycleWeapon();
  else selectSlot(selected + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });

document.addEventListener('keydown', (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.code === 'Space') e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'Space') jumpQueued = true;

  if (e.code === 'KeyE') {
    e.preventDefault();
    toggleCraft();
    return;
  }
  if (e.code === 'Escape' && craftOpen) { closeCraft(); return; }
  if (e.code === 'KeyV') {
    thirdPerson = !thirdPerson;
    toast(thirdPerson ? 'Third person' : 'First person');
  }
  if (e.code === 'KeyC') cycleCharacter();
  if (e.code === 'KeyF') {
    player.fly = !player.fly;
    player.vel.y = 0;
    toast(player.fly ? 'Flying' : 'Walking');
  }
  if (e.code === 'KeyB') setCombatMode(!combatMode);
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyQ') cycleWeapon();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyP') copyRoom();
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= 9) {
      if (combatMode && n <= WEAPONS.length) selectWeapon(n - 1);
      else selectSlot(n - 1);
    }
  }
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  player.vel.set(0, 0, 0);
  gun.trigger = false;
  gun.aiming = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});
