/* Blockcraft Battle Ground — Pointer lock, mouse, keyboard and resize input.
   80-input.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ---------------- input ---------------- */
const hintEl = document.getElementById('hint');
const playBtn = document.getElementById('play');
const statsEl = document.getElementById('stats');
const inputButtonsDown = new Set();
let scoreboardTabHeld = false;
const GAMEPLAY_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'KeyE', 'KeyV', 'KeyC', 'KeyF', 'KeyB', 'KeyR', 'KeyQ', 'KeyM', 'KeyP', 'KeyZ', 'KeyX', 'KeyG', 'KeyT', 'Tab'
]);
let inputWindowFocused = typeof document.hasFocus !== 'function' || document.hasFocus();
let inputWasActive = false;
const gameplayKeyboardCapture = {
  supported: false, fullscreenSupported: false, fullscreen: false,
  requested: false, starting: false, pending: false, granted: false, locked: false,
  status: 'idle', error: ''
};
let inputCaptureGeneration = 0, inputCaptureTimer = 0;
let inputCaptureCancelled = false, inputPointerPending = false, inputFullscreenPending = false;
let inputPointerPromise = false, inputStaleFullscreen = false;

function inputKeyboardAPI() {
  return typeof navigator !== 'undefined' && navigator.keyboard ? navigator.keyboard : null;
}

function updateKeyboardCaptureState() {
  const state = gameplayKeyboardCapture;
  state.fullscreen = !!document.fullscreenElement;
  state.locked = state.granted && state.fullscreen && isGameplayInputActive();
  if (state.locked) state.status = 'locked';
  if (state.starting && !state.pending && !inputPointerPending && !inputFullscreenPending) {
    state.starting = false;
    clearTimeout(inputCaptureTimer);
    inputCaptureTimer = 0;
  }
}

function unlockGameplayKeyboard() {
  const keyboard = inputKeyboardAPI();
  if (keyboard && typeof keyboard.unlock === 'function') {
    try { keyboard.unlock(); } catch (e) { /* unsupported or already released */ }
  }
  gameplayKeyboardCapture.pending = false;
  gameplayKeyboardCapture.granted = false;
  gameplayKeyboardCapture.locked = false;
}

function releaseKeyboardCapture(reason = 'released') {
  inputCaptureGeneration++;
  inputCaptureCancelled = true;
  inputStaleFullscreen = inputStaleFullscreen || inputFullscreenPending;
  inputPointerPending = inputFullscreenPending = false;
  gameplayKeyboardCapture.requested = gameplayKeyboardCapture.starting = false;
  gameplayKeyboardCapture.status = reason;
  clearTimeout(inputCaptureTimer);
  inputCaptureTimer = 0;
  unlockGameplayKeyboard();
  gameplayKeyboardCapture.fullscreen = !!document.fullscreenElement;
}

function exitInputFullscreen() {
  if (!document.fullscreenElement || typeof document.exitFullscreen !== 'function') return;
  try {
    const pending = document.exitFullscreen();
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  } catch (e) { /* the browser may already be exiting fullscreen */ }
}

function showInputResumeHint() {
  document.body.classList.remove('started');
  if (!loading && !craftOpen) {
    hintEl.classList.remove('hidden');
    playBtn.textContent = 'Click to resume';
  }
}

function pauseGameplayInput(exitFullscreen = false) {
  resetGameplayInput();
  if (document.pointerLockElement === renderer.domElement && typeof document.exitPointerLock === 'function') {
    try { document.exitPointerLock(); } catch (e) { /* already unlocked */ }
  }
  if (exitFullscreen) exitInputFullscreen();
  showInputResumeHint();
}

function isInputEditable(target) {
  if (!target) return false;
  if (target.nodeType === 3) target = target.parentElement;
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable ||
    !!(target.closest && target.closest('[contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
}

function isGameplayInputActive(event) {
  return !loading && alive && !craftOpen && inputWindowFocused && !document.hidden &&
    document.pointerLockElement === renderer.domElement &&
    !isInputEditable(document.activeElement) && !isInputEditable(event && event.target);
}

function resetGameplayInput(releaseCapture = true) {
  if (releaseCapture) releaseKeyboardCapture();
  for (const k in keys) keys[k] = false;
  scoreboardTabHeld = false;
  jumpQueued = false;
  inputButtonsDown.clear();
  if (typeof setScoreboardVisible === 'function') setScoreboardVisible(false);
  resetBuildingInput();
  gun.trigger = false;
  gun.aiming = false;
  if (typeof resetPlayerMotion === 'function') resetPlayerMotion();
  else { player.vel.set(0, 0, 0); player.groundSpeed = 0; }
  inputWasActive = false;
}

// updateBuilding calls this after combat, catching death and programmatic inventory changes too.
function updateInputState() {
  const active = isGameplayInputActive();
  if (!active && inputWasActive) resetGameplayInput();
  inputWasActive = active;
  updateKeyboardCaptureState();
}

function lockPointer() {
  if (loading || !alive || craftOpen || document.hidden || gameplayKeyboardCapture.starting) return false;
  const state = gameplayKeyboardCapture, keyboard = inputKeyboardAPI();
  const fullscreenTarget = document.documentElement;
  state.supported = !!(keyboard && typeof keyboard.lock === 'function' && typeof keyboard.unlock === 'function');
  state.fullscreenSupported = !!(fullscreenTarget && typeof fullscreenTarget.requestFullscreen === 'function' &&
    document.fullscreenEnabled !== false);
  const requestFullscreen = !document.fullscreenElement && state.fullscreenSupported;
  const requestKeyboard = state.supported && (!!document.fullscreenElement || requestFullscreen);
  const generation = ++inputCaptureGeneration;
  inputCaptureCancelled = inputStaleFullscreen = inputPointerPromise = false;
  state.requested = state.starting = true;
  state.pending = requestKeyboard;
  state.granted = state.locked = false;
  state.error = '';
  state.status = requestKeyboard ? 'requesting' : state.supported ? 'fullscreen-unavailable' : 'unsupported';
  inputPointerPending = document.pointerLockElement !== renderer.domElement;
  inputFullscreenPending = requestFullscreen;
  clearTimeout(inputCaptureTimer);
  inputCaptureTimer = setTimeout(() => {
    if (generation === inputCaptureGeneration && state.starting) releaseKeyboardCapture('timeout');
  }, 8000);

  // Pointer lock must be requested before fullscreen consumes transient user activation.
  // Start keyboard lock in this same gesture too; Chromium activates it in fullscreen.
  // No await before these requests, so file:// and legacy void-returning pointer APIs work.
  if (inputPointerPending) {
    try {
      if (typeof renderer.domElement.requestPointerLock !== 'function') throw new Error('Pointer lock unavailable');
      const pending = renderer.domElement.requestPointerLock();
      inputPointerPromise = !!(pending && typeof pending.then === 'function');
      if (inputPointerPromise) pending.then(() => {
        if (generation !== inputCaptureGeneration) {
          if (!state.requested && document.pointerLockElement === renderer.domElement) pauseGameplayInput();
          return;
        }
        inputPointerPending = false;
        updateKeyboardCaptureState();
      }, () => {
        if (generation !== inputCaptureGeneration) return;
        pauseGameplayInput();
        toast('Pointer lock unavailable — click the page again');
      });
    } catch (e) {
      pauseGameplayInput();
      toast('Pointer lock unavailable — click the page again');
      return false;
    }
  }
  if (generation !== inputCaptureGeneration) return false;
  if (requestKeyboard) {
    try {
      Promise.resolve(keyboard.lock()).then(() => {
        if (generation !== inputCaptureGeneration) {
          if (!state.requested) unlockGameplayKeyboard();
          return;
        }
        state.pending = false;
        if (!document.fullscreenElement && !inputFullscreenPending) {
          unlockGameplayKeyboard();
          state.status = 'fullscreen-unavailable';
        } else state.granted = true;
        updateKeyboardCaptureState();
      }, (error) => {
        if (generation !== inputCaptureGeneration) return;
        unlockGameplayKeyboard();
        state.status = 'denied';
        state.error = error && error.name ? error.name : 'Keyboard lock denied';
        updateKeyboardCaptureState();
      });
    } catch (error) {
      unlockGameplayKeyboard();
      state.status = 'denied';
      state.error = error && error.name ? error.name : 'Keyboard lock unavailable';
    }
  }
  if (requestFullscreen) {
    const denied = (error) => {
      if (generation !== inputCaptureGeneration) return;
      inputFullscreenPending = false;
      unlockGameplayKeyboard();
      state.status = 'fullscreen-denied';
      state.error = error && error.name ? error.name : 'Fullscreen unavailable';
      updateKeyboardCaptureState();
    };
    try {
      Promise.resolve(fullscreenTarget.requestFullscreen({ navigationUI: 'hide' })).then(() => {
        if (generation !== inputCaptureGeneration) {
          if (!state.requested && document.fullscreenElement === fullscreenTarget) exitInputFullscreen();
          return;
        }
        inputFullscreenPending = false;
        if (!document.fullscreenElement) { unlockGameplayKeyboard(); state.status = 'fullscreen-unavailable'; }
        updateKeyboardCaptureState();
      }, denied);
    } catch (error) { denied(error); }
  }
  updateKeyboardCaptureState();
  return true;
}

playBtn.addEventListener('click', lockPointer);
renderer.domElement.addEventListener('click', () => {
  if (!craftOpen && !hintEl.classList.contains('hidden')) lockPointer();
});

// Opacity/pointer-events alone leave menu controls in the keyboard focus order.
// Keep every way of hiding the menu in sync, including resume and mode changes.
function syncHintFocusability() {
  const hidden = hintEl.classList.contains('hidden');
  if (hidden && hintEl.contains(document.activeElement) && document.activeElement.blur) {
    document.activeElement.blur();
  }
  hintEl.inert = hidden;
  hintEl.setAttribute('aria-hidden', String(hidden));
}
const hintFocusObserver = new MutationObserver(syncHintFocusability);
hintFocusObserver.observe(hintEl, { attributes: true, attributeFilter: ['class'] });
syncHintFocusability();

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked && inputCaptureCancelled) { pauseGameplayInput(); return; }
  inputPointerPending = false;
  resetGameplayInput(!locked);
  if (locked) {
    inputWindowFocused = true;
    // A focused Play button must not receive Space while it is also the jump key.
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) {
      document.activeElement.blur();
    }
    hintEl.classList.add('hidden');
    document.body.classList.add('started');
    inputWasActive = isGameplayInputActive();
  } else showInputResumeHint();
  updateKeyboardCaptureState();
});
document.addEventListener('pointerlockerror', () => {
  if (inputPointerPromise || document.pointerLockElement === renderer.domElement) return;
  pauseGameplayInput();
  toast('Pointer lock unavailable — click the page again');
});
document.addEventListener('fullscreenchange', () => {
  const wasFullscreen = gameplayKeyboardCapture.fullscreen;
  gameplayKeyboardCapture.fullscreen = !!document.fullscreenElement;
  if (inputCaptureCancelled && inputStaleFullscreen && document.fullscreenElement === document.documentElement) {
    inputStaleFullscreen = false;
    exitInputFullscreen();
    return;
  }
  if (!document.fullscreenElement && wasFullscreen) pauseGameplayInput();
  else updateKeyboardCaptureState();
});
document.addEventListener('fullscreenerror', () => {
  if (!inputFullscreenPending) return;
  inputFullscreenPending = false;
  unlockGameplayKeyboard();
  gameplayKeyboardCapture.status = 'fullscreen-denied';
  updateKeyboardCaptureState();
});

document.addEventListener('mousemove', (e) => {
  if (!isGameplayInputActive(e)) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  const lim = Math.PI / 2 - 0.02;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
});

document.addEventListener('mousedown', (e) => {
  if (!isGameplayInputActive(e) || (e.button !== 0 && e.button !== 2)) return;
  e.preventDefault();
  if (inputButtonsDown.has(e.button)) return;
  inputButtonsDown.add(e.button);
  inputWasActive = true;
  if (quickBuild.active) {
    if (e.button === 2) cancelQuickBuild();
    else setBuildingHeld(0, true);
    return;
  }
  if (!combatMode) {
    setBuildingHeld(e.button, true);
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
  inputButtonsDown.delete(e.button);
  setBuildingHeld(e.button, false);
  if (e.button === 0) gun.trigger = false;
  else if (e.button === 2) gun.aiming = false;
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('wheel', (e) => {
  if (!isGameplayInputActive(e) || e.deltaY === 0) return;
  e.preventDefault();
  const direction = e.deltaY > 0 ? 1 : -1;
  if (quickBuild.active) {
    selectSlot(selected + direction);
    setQuickBuildMaterial(HOTBAR[selected]);
  } else if (combatMode) {
    equipInputWeapon((gun.index + direction + WEAPONS.length) % WEAPONS.length);
  } else selectSlot(selected + direction);
}, { passive: false });

function equipInputWeapon(index) {
  if (index < 0 || index >= WEAPONS.length) return;
  resetBuildingInput();
  if (!combatMode) setCombatMode(true);
  gun.trigger = false;
  gun.aiming = false;
  selectWeapon(index);
}

function consumeGameplayKey(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Tab belongs exclusively to the scoreboard while playing. Capture on window
// before document/menu listeners and stop same-target handlers as well as focus
// traversal. Paused menus keep normal Tab navigation.
function captureScoreboardTab(e) {
  const tab = e.code === 'Tab' || (!e.code && (e.key === 'Tab' || e.keyCode === 9));
  if (!tab) return;
  const active = isGameplayInputActive(e);
  if (!active && !scoreboardTabHeld) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const show = e.type === 'keydown' && active;
  scoreboardTabHeld = show;
  keys.Tab = show;
  if (show) inputWasActive = true;
  if (typeof setScoreboardVisible === 'function') setScoreboardVisible(show);
}
window.addEventListener('keydown', captureScoreboardTab, true);
window.addEventListener('keyup', captureScoreboardTab, true);

document.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229 || isInputEditable(e.target) ||
      isInputEditable(document.activeElement)) return;
  const active = isGameplayInputActive(e);
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  const handled = GAMEPLAY_KEYS.has(e.code) || !!digit;
  // DOM cancellation is best-effort for reserved browser shortcuts; fullscreen
  // Keyboard Lock delivers supported Ctrl/Meta combinations to these handlers.
  if (active && (handled || e.ctrlKey || e.metaKey)) consumeGameplayKey(e);
  if (e.code === 'Escape') {
    if (craftOpen || document.pointerLockElement === renderer.domElement || gameplayKeyboardCapture.requested) {
      consumeGameplayKey(e);
      if (craftOpen) closeCraft();
      pauseGameplayInput(true);
    }
    return;
  }
  // Keyup is unconditional below. An autorepeating held key never becomes a fresh action
  // after closing a menu, regaining focus, changing mode or respawning.
  if (e.repeat || keys[e.code]) return;
  if (e.code === 'KeyE') {
    if (!active && (e.ctrlKey || e.metaKey || e.altKey)) return;
    if (loading || !alive || !inputWindowFocused || document.hidden) return;
    consumeGameplayKey(e);
    resetGameplayInput();
    toggleCraft();
    return;
  }
  if (!active || !handled) return;
  keys[e.code] = true;
  inputWasActive = true;
  if (digit) {
    const index = Number(digit[1]) - 1;
    if (quickBuild.active && index < HOTBAR.length) {
      selectSlot(index);
      setQuickBuildMaterial(HOTBAR[selected]);
    } else if (combatMode) {
      if (index < WEAPONS.length) equipInputWeapon(index);
    } else if (index < HOTBAR.length) selectSlot(index);
    return;
  }
  switch (e.code) {
    case 'Tab': if (typeof setScoreboardVisible === 'function') setScoreboardVisible(true); break;
    case 'Space': jumpQueued = true; break;
    case 'KeyZ': selectBuildPiece('wall'); break;
    case 'KeyX': selectBuildPiece('ramp'); break;
    case 'KeyG': selectBuildPiece('floor'); break;
    case 'KeyT': if (quickBuild.active) rotateBuildPiece(); break;
    case 'KeyV':
      thirdPerson = !thirdPerson;
      if (typeof resetCamera === 'function') resetCamera();
      toast(thirdPerson ? 'Over-shoulder' : 'First person');
      break;
    case 'KeyC': cycleCharacter(); break;
    case 'KeyF':
      player.fly = !player.fly;
      player.vel.y = 0;
      jumpQueued = false;
      toast(player.fly ? 'Flying' : 'Walking');
      break;
    case 'KeyB': {
      const nextCombatMode = quickBuild.active ? false : !combatMode;
      resetBuildingInput();
      setCombatMode(nextCombatMode);
      break;
    }
    case 'KeyR': if (combatMode && !quickBuild.active) startReload(); break;
    case 'KeyQ': equipInputWeapon((gun.index + 1) % WEAPONS.length); break;
    case 'KeyM': toggleMute(); break;
    case 'KeyP': copyRoom(); break;
  }
}, true);
document.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'Tab' && typeof setScoreboardVisible === 'function') setScoreboardVisible(false);
  if (isGameplayInputActive(e) && !e.isComposing &&
      (GAMEPLAY_KEYS.has(e.code) || /^(?:Digit|Numpad)[1-9]$/.test(e.code) || e.ctrlKey || e.metaKey)) consumeGameplayKey(e);
}, true);
window.addEventListener('blur', () => {
  inputWindowFocused = false;
  pauseGameplayInput();
});
window.addEventListener('focus', () => { inputWindowFocused = true; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGameplayInput();
});
document.addEventListener('focusin', (e) => {
  if (isInputEditable(e.target)) pauseGameplayInput();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});
