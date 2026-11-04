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
  'KeyV', 'KeyC', 'KeyF', 'KeyB', 'KeyR', 'KeyQ', 'KeyM', 'KeyP', 'KeyZ', 'KeyX', 'KeyG', 'KeyT', 'KeyK', 'Tab'
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
const INPUT_MOUSE_SETTLE_MS = 100, INPUT_MOUSE_CAPTURE_GRACE_MS = 600;
const inputMouseStream = {
  epoch: 0, epochAt: 0, settleUntil: 0, baselinePending: true, active: false,
  pointerLock: null, fullscreen: null, width: 0, height: 0, pixelRatio: 1,
  acceptedCount: 0, rejectedCount: 0, resetReason: 'startup', reason: 'idle', lastRejectReason: '', lastRejectEpoch: 0,
  lastDeltaX: 0, lastDeltaY: 0, lastTimeStamp: null, lastEventTime: null
};

function inputKeyboardAPI() {
  return typeof navigator !== 'undefined' && navigator.keyboard ? navigator.keyboard : null;
}

function updateKeyboardCaptureState() {
  const state = gameplayKeyboardCapture, wasStarting = state.starting;
  state.fullscreen = !!document.fullscreenElement;
  state.locked = state.granted && state.fullscreen && isGameplayInputActive();
  if (state.locked) state.status = 'locked';
  if (state.starting && !state.pending && !inputPointerPending && !inputFullscreenPending) {
    state.starting = false;
    clearTimeout(inputCaptureTimer);
    inputCaptureTimer = 0;
  }
  if (wasStarting && !state.starting) resetInputMouseStream('capture-ready');
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
  resetInputMouseStream('capture-release');
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
  if (typeof loading === 'undefined' || loading) return;
  const menus = BC.api && BC.api.menus;
  if (menus) {
    const show = BC.flags.hasPlayed ? menus.showPause : menus.showHome;
    if (typeof show === 'function') show.call(menus);
    return;
  }
  hintEl.classList.remove('hidden');
  playBtn.textContent = BC.flags.hasPlayed ? 'Click to resume' : 'Click to play';
}

function pauseGameplayInput(exitFullscreen = false) {
  if (inputTouchPlaying()) {
    touchState.playing = false;
    document.body.classList.remove('touch-playing');
  }
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
  return typeof loading !== 'undefined' && !loading && alive && !craftOpen && inputWindowFocused && !document.hidden &&
    !BC.flags.worldBusy && !BC.flags.playerRepairBlocked &&
    (document.pointerLockElement === renderer.domElement || inputTouchPlaying()) &&
    !isInputEditable(document.activeElement) && !isInputEditable(event && event.target);
}

// Phones/tablets have no pointer lock; 82-touch.js owns an equivalent
// "touch play" state that also counts as active gameplay.
function inputTouchPlaying() {
  return typeof touchState !== 'undefined' && touchState.playing === true;
}

function inputMouseNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

// Relative deltas can include a cursor warp while lock/fullscreen/focus changes.
// Discard that transition stream, not large turns: stable samples have NO size,
// speed or idle-gap cap, and sensitivity is still applied exactly once below.
function resetInputMouseStream(reason = 'input-reset', now = inputMouseNow()) {
  const s = inputMouseStream;
  s.epoch++;
  s.epochAt = now;
  s.settleUntil = now + INPUT_MOUSE_SETTLE_MS;
  s.baselinePending = true;
  s.lastEventTime = null;
  s.resetReason = reason;
  s.active = isGameplayInputActive();
  s.pointerLock = document.pointerLockElement;
  s.fullscreen = document.fullscreenElement;
  s.width = window.innerWidth;
  s.height = window.innerHeight;
  s.pixelRatio = window.devicePixelRatio || 1;
}

function inputMouseReject(reason) {
  inputMouseStream.rejectedCount++;
  inputMouseStream.reason = inputMouseStream.lastRejectReason = reason;
  inputMouseStream.lastRejectEpoch = inputMouseStream.epoch;
  return false;
}

// Bounded, on-demand QA snapshot; no console output or per-frame history.
// resetInputMouseStream() and inputMouseMove() are also callable classic-script
// functions, so controlled samples exercise the same single production handler.
function getInputMouseDiagnostics() {
  const s = inputMouseStream, now = inputMouseNow();
  return {
    epoch: s.epoch, epochAt: s.epochAt, resetReason: s.resetReason,
    acceptedCount: s.acceptedCount, rejectedCount: s.rejectedCount,
    reason: s.reason, lastRejectReason: s.lastRejectReason, lastRejectEpoch: s.lastRejectEpoch,
    lastDelta: { x: s.lastDeltaX, y: s.lastDeltaY }, lastTimeStamp: s.lastTimeStamp,
    lastEventTime: s.lastEventTime, baselinePending: s.baselinePending,
    settling: gameplayKeyboardCapture.starting || inputPointerPending || inputFullscreenPending ||
      s.baselinePending || now < s.settleUntil,
    settleUntil: s.settleUntil, captureStarting: gameplayKeyboardCapture.starting,
    active: isGameplayInputActive() && (typeof document.hasFocus !== 'function' || document.hasFocus())
  };
}

// This is also the inputReset subscriber. It must never emit inputReset itself:
// riding/world/life owners can dispatch that hook without this file's pause path.
function inputClearGameplayHolds() {
  resetInputMouseStream();
  for (const k in keys) keys[k] = false;
  scoreboardTabHeld = false;
  jumpQueued = false;
  inputButtonsDown.clear();
  if (typeof setScoreboardVisible === 'function') setScoreboardVisible(false);
  if (typeof resetBuildingInput === 'function') resetBuildingInput();
  gun.trigger = false;
  gun.aiming = false;
  inputWasActive = false;
}

function resetGameplayInput(releaseCapture = true) {
  if (releaseCapture) releaseKeyboardCapture();
  inputClearGameplayHolds();
  if (typeof resetPlayerMotion === 'function') resetPlayerMotion();
  else { player.vel.set(0, 0, 0); player.groundSpeed = 0; }
  BC.emit('inputReset');
}

// Hold cleanup preserves capture. Only an actual pause/unlock cancels the
// fullscreen/keyboard request, so a mount or map change cannot break resume UX.
BC.on('inputReset', inputClearGameplayHolds, -100);
BC.on('worldWillReset', inputClearGameplayHolds, -100);
BC.on('worldReset', inputClearGameplayHolds, -100);
BC.on('modeChanged', inputClearGameplayHolds, -100);
BC.on('death', inputClearGameplayHolds, -100);
BC.on('respawn', inputClearGameplayHolds, -100);
BC.on('worldBusyChanged', (busy) => { if (busy) inputClearGameplayHolds(); }, -100);

// updateBuilding calls this after combat, catching death and gameplay state changes too.
function updateInputState() {
  const active = isGameplayInputActive();
  if (!active && inputWasActive) resetGameplayInput();
  inputWasActive = active;
  updateKeyboardCaptureState();
}

function lockPointer() {
  if (typeof touchState !== 'undefined' && touchState.enabled) return touchStartPlay();
  if (typeof loading === 'undefined' || loading || BC.flags.worldBusy || BC.flags.playerRepairBlocked || !alive || craftOpen || document.hidden || gameplayKeyboardCapture.starting) return false;
  const menus = BC.api && BC.api.menus;
  if (menus && typeof menus.canPlay === 'function' && !menus.canPlay()) return false;
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
  resetInputMouseStream('capture-request');
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
  // With 88-menu installed, only its real Play/Resume buttons may activate
  // capture. A click behind Home, Pause or Settings must never resume play.
  if (!(BC.api && BC.api.menus) && !craftOpen && !hintEl.classList.contains('hidden')) lockPointer();
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
  resetInputMouseStream(locked ? 'pointer-lock' : 'pointer-unlock');
  if (locked) {
    inputWindowFocused = true;
    // A focused Play button must not receive Space while it is also the jump key.
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) {
      document.activeElement.blur();
    }
    BC.flags.hasPlayed = true;
    const menus = BC.api && BC.api.menus;
    if (menus) {
      if (typeof menus.notifyGameplayStarted === 'function') menus.notifyGameplayStarted();
      if (typeof menus.hide === 'function') menus.hide();
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
  resetInputMouseStream('fullscreen-change');
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
  resetInputMouseStream('fullscreen-error');
  inputFullscreenPending = false;
  unlockGameplayKeyboard();
  gameplayKeyboardCapture.status = 'fullscreen-denied';
  updateKeyboardCaptureState();
});

function inputMouseMove(e) {
  const s = inputMouseStream, now = inputMouseNow();
  // Pointer lock already implies focus; some Linux window managers report
  // document.hasFocus() === false while the pointer is locked.
  if (!isGameplayInputActive(e)) {
    if (s.active) resetInputMouseStream('inactive', now);
    s.active = false;
    s.reason = 'inactive';
    return false;
  }
  // Observe changed DOM/viewport state too: mouse events can precede delivery of
  // the corresponding pointerlockchange/fullscreenchange/resize callback.
  if (!s.active) resetInputMouseStream('gameplay-active', now);
  else if (s.pointerLock !== document.pointerLockElement) resetInputMouseStream('pointer-lock-observed', now);
  else if (s.fullscreen !== document.fullscreenElement) resetInputMouseStream('fullscreen-observed', now);
  else if (s.width !== window.innerWidth || s.height !== window.innerHeight || s.pixelRatio !== (window.devicePixelRatio || 1)) {
    resetInputMouseStream('resize-observed', now);
  }
  s.lastDeltaX = e.movementX;
  s.lastDeltaY = e.movementY;
  s.lastTimeStamp = e.timeStamp;
  if (!Number.isFinite(e.movementX) || !Number.isFinite(e.movementY)) return inputMouseReject('non-finite-delta');
  // Only reject during the first moments of a capture transition. If a
  // browser never settles its fullscreen/keyboard request (seen on Firefox),
  // the mouse must not stay dead for the whole session.
  if ((gameplayKeyboardCapture.starting || inputPointerPending || inputFullscreenPending) &&
      now - s.epochAt < INPUT_MOUSE_CAPTURE_GRACE_MS) {
    s.baselinePending = true;
    return inputMouseReject('capture-starting');
  }
  // Timing uses ARRIVAL time, never e.timeStamp. Firefox on Linux can stamp
  // events with the X11/Wayland clock, which drifts from performance.now();
  // a 2 ms tolerance then rejected every sample and the camera never moved.
  s.lastEventTime = now;
  if (now < s.settleUntil) {
    s.baselinePending = false;
    return inputMouseReject('settling');
  }
  // If no mouse sample arrived during settling, discard the first relative
  // sample even when it arrives later; its origin may still be the old cursor.
  if (s.baselinePending) {
    s.baselinePending = false;
    return inputMouseReject('stream-baseline');
  }
  const riding = BC.api && BC.api.riding;
  const useWeapon = combatMode && !quickBuild.active && !(riding && riding.active);
  const weaponId = useWeapon && typeof currentWeapon === 'function' ? currentWeapon().id : null;
  const sens = (typeof BC !== 'undefined' && BC.mouseSensitivity)
    ? BC.mouseSensitivity(weaponId, useWeapon && gun.aiming) : 1;
  const yaw = player.yaw - e.movementX * 0.0022 * sens;
  const pitch = player.pitch - e.movementY * 0.0022 * sens;
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return inputMouseReject('non-finite-rotation');
  player.yaw = yaw;
  const lim = Math.PI / 2 - 0.02;
  player.pitch = Math.max(-lim, Math.min(lim, pitch));
  s.acceptedCount++;
  s.reason = 'accepted';
  return true;
}
document.addEventListener('mousemove', inputMouseMove);

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
  if (e.shiftKey && (quickBuild.active || !combatMode)) {
    cycleHotbarMaterial(direction);
    if (quickBuild.active) setQuickBuildMaterial(HOTBAR[selected]);
  } else if (quickBuild.active) {
    inputCycleBuildPiece(direction);
  } else if (combatMode) {
    resetBuildingInput();
    cycleWeapon(direction);
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
  // A held Tab's autorepeat cannot reopen a scoreboard reset by a new life/map.
  const show = e.type === 'keydown' && active && (!e.repeat || scoreboardTabHeld);
  scoreboardTabHeld = show;
  keys.Tab = show;
  if (show) inputWasActive = true;
  if (typeof setScoreboardVisible === 'function') setScoreboardVisible(show);
}
window.addEventListener('keydown', captureScoreboardTab, true);
window.addEventListener('keyup', captureScoreboardTab, true);

/* Build switching, Fortnite style: Q toggles quick build (last piece, wall by
   default) and back to the gun; inside build mode 1/2/3 pick wall, floor and
   ramp, the wheel cycles pieces and R rotates. B is the separate classic
   block mode for mining and placing single blocks. */
const INPUT_BUILD_ORDER = ['wall', 'floor', 'ramp'];

function inputToggleQuickBuild() {
  if (quickBuild.active) { cancelQuickBuild(); return false; }
  resetBuildingInput();
  gun.trigger = gun.aiming = false;
  return selectBuildPiece(INPUT_BUILD_ORDER.indexOf(quickBuild.kind) >= 0 ? quickBuild.kind : 'wall');
}

function inputSelectBuildPiece(kind) {
  if (quickBuild.active && quickBuild.kind === kind) return true; // stay in build mode
  return selectBuildPiece(kind);
}

function inputCycleBuildPiece(direction) {
  const i = Math.max(0, INPUT_BUILD_ORDER.indexOf(quickBuild.kind));
  const n = INPUT_BUILD_ORDER.length;
  return inputSelectBuildPiece(INPUT_BUILD_ORDER[(i + direction + n) % n]);
}

document.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.code === 'Escape') {
    const menus = BC.api && BC.api.menus;
    if (e.repeat) {
      if (menus || document.pointerLockElement === renderer.domElement || gameplayKeyboardCapture.requested) consumeGameplayKey(e);
      return;
    }
    // Settings needs Escape even while its slider/text field owns focus.
    // Closed menus return false so gameplay keeps the existing unlock route.
    if (menus && typeof menus.handleEscape === 'function' && menus.handleEscape(e)) {
      consumeGameplayKey(e);
      return;
    }
    if (isInputEditable(e.target) || isInputEditable(document.activeElement)) return;
    if (document.pointerLockElement === renderer.domElement || gameplayKeyboardCapture.requested) {
      consumeGameplayKey(e);
      pauseGameplayInput(true);
    }
    return;
  }
  if (isInputEditable(e.target) || isInputEditable(document.activeElement)) return;
  const active = isGameplayInputActive(e);
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  const handled = GAMEPLAY_KEYS.has(e.code) || !!digit;
  // DOM cancellation is best-effort for reserved browser shortcuts; fullscreen
  // Keyboard Lock delivers supported Ctrl/Meta combinations to these handlers.
  if (active && (handled || e.ctrlKey || e.metaKey)) consumeGameplayKey(e);
  // Keyup is unconditional below. An autorepeating held key never becomes a fresh action
  // after closing a menu, regaining focus, changing mode or respawning.
  if (e.repeat || keys[e.code]) return;
  if (!active || !handled) return;
  keys[e.code] = true;
  inputWasActive = true;
  if (digit) {
    const index = Number(digit[1]) - 1;
    if (quickBuild.active) {
      if (index < INPUT_BUILD_ORDER.length) inputSelectBuildPiece(INPUT_BUILD_ORDER[index]);
    } else if (combatMode) {
      if (index < WEAPONS.length) equipInputWeapon(index);
    } else if (index < HOTBAR.length) selectSlot(index);
    return;
  }
  switch (e.code) {
    case 'Tab': if (typeof setScoreboardVisible === 'function') setScoreboardVisible(true); break;
    case 'Space': jumpQueued = true; break;
    case 'KeyZ': inputSelectBuildPiece('wall'); break;
    case 'KeyX': inputSelectBuildPiece('ramp'); break;
    case 'KeyG': inputSelectBuildPiece('floor'); break;
    case 'KeyT': if (quickBuild.active) rotateBuildPiece(); break;
    case 'KeyV':
      thirdPerson = !thirdPerson;
      if (typeof resetCamera === 'function') resetCamera();
      toast(thirdPerson ? 'Over-shoulder' : 'First person');
      break;
    case 'KeyK':
      // Character change has its own key; Ctrl is crouch on foot and
      // descent in flight (read as a held key by 50-player.js).
      if (!player.fly && !(BC.api.jetpack && BC.api.jetpack.active) && !(BC.api.riding && BC.api.riding.active)) cycleCharacter();
      break;
    case 'KeyF':
      if (BC.api.jetpack) BC.api.jetpack.toggle();
      break;
    case 'KeyB': {
      const nextCombatMode = quickBuild.active ? false : !combatMode;
      resetBuildingInput();
      setCombatMode(nextCombatMode);
      break;
    }
    case 'KeyR':
      if (quickBuild.active) rotateBuildPiece();
      else if (combatMode) startReload();
      break;
    case 'KeyQ': inputToggleQuickBuild(); break;
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
function inputPauseForFocusLoss() {
  const capturing = document.pointerLockElement === renderer.domElement ||
    gameplayKeyboardCapture.requested || gameplayKeyboardCapture.starting;
  // A keyup can be lost outside the browser. Repeat events remain blocked on
  // refocus, but a genuinely new Ctrl press must not inherit a stale hold.
  // Losing focus while already editing a paused menu still releases every
  // control/capture, but must not replace Settings with a new resume surface.
  if (capturing || !(BC.api && BC.api.menus)) pauseGameplayInput();
  else resetGameplayInput();
}
window.addEventListener('blur', () => {
  inputWindowFocused = false;
  inputPauseForFocusLoss();
  resetInputMouseStream('blur');
});
window.addEventListener('focus', () => {
  inputWindowFocused = true;
  resetInputMouseStream('focus');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) inputPauseForFocusLoss();
  resetInputMouseStream('visibility-change');
});
document.addEventListener('focusin', (e) => {
  resetInputMouseStream('focus-change');
  if (!isInputEditable(e.target)) return;
  if (document.pointerLockElement === renderer.domElement || gameplayKeyboardCapture.requested || gameplayKeyboardCapture.starting) {
    pauseGameplayInput();
  } else resetGameplayInput(); // Already-paused settings edits must not replace their menu.
});

window.addEventListener('resize', () => {
  resetInputMouseStream('resize');
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});
