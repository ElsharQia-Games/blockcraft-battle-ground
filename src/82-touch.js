/* Blockcraft Battle Ground — phone and tablet controls.
   82-touch.js (after 80-input.js, whose lockPointer/pause paths it plugs into)
   Phones have no pointer lock or keyboard. This module adds a touch "play"
   state and an on-screen layout for landscape play:
   - left half: floating move stick (push to the rim to sprint)
   - right half: drag anywhere to look
   - buttons: fire, aim, jump, crouch/slide, reload, swap weapon, build,
     jetpack, scoreboard and pause
   Actions go through the same functions as the keyboard and mouse handlers
   in 80-input.js, so gameplay rules stay in one place. */
'use strict';

const TOUCH_LOOK_GAIN = 0.0052;
const TOUCH_STICK_RADIUS = 56;
const TOUCH_SPRINT_AT = 0.92;

const touchState = {
  enabled: false,     // touch UI installed (coarse pointer / touch device)
  playing: false,     // gameplay owns the screen (the touch "pointer lock")
  stick: null,        // { id, x, y }
  look: null,         // { id, x, y }
  fireId: null,
  moveKeys: { KeyW: false, KeyA: false, KeyS: false, KeyD: false, ShiftLeft: false }
};

function touchDetected() {
  try {
    if (new URLSearchParams(location.search).get('touch') === '1') return true;
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  } catch (e) { return false; }
}

function touchGameplayActive() {
  return touchState.playing && typeof loading !== 'undefined' && !loading && alive &&
    !document.hidden && !BC.flags.worldBusy && !BC.flags.playerRepairBlocked;
}

/* ---------------- start / pause ---------------- */
function touchStartPlay() {
  if (typeof loading === 'undefined' || loading || BC.flags.worldBusy || !alive) return false;
  const menus = BC.api && BC.api.menus;
  if (menus && typeof menus.canPlay === 'function' && !menus.canPlay()) return false;
  touchState.playing = true;
  document.body.classList.add('touch-playing', 'started');
  // Fullscreen + landscape lock where the browser allows it (Android Chrome).
  try {
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) {
      Promise.resolve(root.requestFullscreen({ navigationUI: 'hide' })).then(() => {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      }, () => {});
    }
  } catch (e) { /* optional */ }
  BC.flags.hasPlayed = true;
  if (menus) {
    if (typeof menus.notifyGameplayStarted === 'function') menus.notifyGameplayStarted();
    if (typeof menus.hide === 'function') menus.hide();
  }
  if (typeof hintEl !== 'undefined') hintEl.classList.add('hidden');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  inputWindowFocused = true;
  inputWasActive = true;
  return true;
}

function touchPause() {
  if (!touchState.playing) return;
  touchReleaseAll();
  pauseGameplayInput(); // also clears touchState.playing and shows Pause
}

function touchReleaseAll() {
  touchState.stick = touchState.look = null;
  touchState.fireId = null;
  for (const code in touchState.moveKeys) { touchState.moveKeys[code] = false; keys[code] = false; }
  gun.trigger = false;
  if (typeof setBuildingHeld === 'function') { setBuildingHeld(0, false); setBuildingHeld(2, false); }
  if (touchUI.stickKnob) touchUI.stickKnob.style.transform = '';
  if (touchUI.stickBase) touchUI.stickBase.classList.remove('on');
}

/* ---------------- actions (mirror 80-input.js) ---------------- */
function touchPrimary(down) {
  if (!touchGameplayActive()) return;
  if (!down) {
    gun.trigger = false;
    setBuildingHeld(0, false);
    return;
  }
  if (quickBuild.active) { setBuildingHeld(0, true); return; }
  if (!combatMode) { setBuildingHeld(0, true); return; }
  gun.trigger = true;
  fireOnce();
}

function touchAction(name) {
  if (name === 'pause') { touchPause(); return; }
  if (!touchGameplayActive()) return;
  switch (name) {
    case 'aim':
      if (quickBuild.active) { cancelQuickBuild(); break; }
      if (!combatMode) { setBuildingHeld(2, true); setTimeout(() => setBuildingHeld(2, false), 120); break; }
      if (currentWeapon().melee) knifeAttack(true);
      else gun.aiming = !gun.aiming;
      break;
    case 'jump': jumpQueued = true; keys.Space = true; setTimeout(() => { keys.Space = false; }, 220); break;
    case 'crouch': {
      // Tap = slide while sprinting / toggle crouch otherwise.
      keys.KeyC = !keys.KeyC;
      if (keys.KeyC && player.sprinting) setTimeout(() => { keys.KeyC = false; }, 650);
      break;
    }
    case 'reload': if (combatMode && !quickBuild.active) startReload(); break;
    case 'swap':
      resetBuildingInput();
      if (!combatMode) setCombatMode(true);
      cycleWeapon(1);
      break;
    case 'build': inputToggleQuickBuild(); break;
    case 'piece': if (quickBuild.active) inputCycleBuildPiece(1); else inputToggleQuickBuild(); break;
    case 'rotate': if (quickBuild.active) rotateBuildPiece(); break;
    case 'jetpack': if (BC.api.jetpack) BC.api.jetpack.toggle(); break;
    case 'view':
      thirdPerson = !thirdPerson;
      if (typeof resetCamera === 'function') resetCamera();
      break;
    case 'score':
      if (typeof setScoreboardVisible === 'function') {
        keys.Tab = !keys.Tab;
        setScoreboardVisible(keys.Tab);
      }
      break;
  }
  touchRefreshButtons();
}

/* ---------------- layout ---------------- */
const touchUI = {};

function touchButton(parent, name, label, cls) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tc-btn ' + (cls || '');
  b.dataset.action = name;
  b.setAttribute('aria-label', label);
  b.textContent = label;
  parent.appendChild(b);
  return b;
}

function touchBuildUI() {
  const root = document.createElement('div');
  root.id = 'touchControls';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<div class="tc-zone tc-move"></div><div class="tc-zone tc-look"></div>' +
    '<div class="tc-stick"><i></i></div><div class="tc-cluster tc-right"></div><div class="tc-cluster tc-top"></div>';
  document.body.appendChild(root);
  touchUI.root = root;
  touchUI.moveZone = root.querySelector('.tc-move');
  touchUI.lookZone = root.querySelector('.tc-look');
  touchUI.stickBase = root.querySelector('.tc-stick');
  touchUI.stickKnob = touchUI.stickBase.querySelector('i');
  const right = root.querySelector('.tc-right');
  touchUI.fire = touchButton(right, 'fire', 'Fire', 'tc-fire');
  touchUI.aim = touchButton(right, 'aim', 'Aim', 'tc-aim');
  touchUI.jump = touchButton(right, 'jump', 'Jump', 'tc-jump');
  touchUI.crouch = touchButton(right, 'crouch', 'Slide', 'tc-crouch');
  touchUI.reload = touchButton(right, 'reload', 'R', 'tc-reload');
  touchUI.swap = touchButton(right, 'swap', 'Gun', 'tc-swap');
  touchUI.build = touchButton(right, 'piece', 'Build', 'tc-build');
  touchUI.rotate = touchButton(right, 'rotate', '⟳', 'tc-rotate');
  const top = root.querySelector('.tc-top');
  touchButton(top, 'pause', 'II', 'tc-small tc-pause');
  touchButton(top, 'score', 'Score', 'tc-small');
  touchButton(top, 'view', 'View', 'tc-small');
  touchButton(top, 'jetpack', 'Jet', 'tc-small');

  const rotate = document.createElement('div');
  rotate.id = 'touchRotate';
  rotate.innerHTML = '<div><b>Turn your phone sideways</b><span>Blockcraft plays in landscape.</span></div>';
  document.body.appendChild(rotate);

  BC.style('bc-touch-controls', `
    #touchControls { position: fixed; inset: 0; z-index: 40; pointer-events: none; display: none;
      touch-action: none; user-select: none; -webkit-user-select: none; }
    body.touch-playing #touchControls { display: block; }
    #touchControls .tc-zone { position: absolute; top: 0; bottom: 0; pointer-events: auto; touch-action: none; }
    #touchControls .tc-move { left: 0; width: 42%; }
    #touchControls .tc-look { right: 0; width: 58%; }
    #touchControls .tc-stick { position: absolute; left: 0; top: 0; width: ${TOUCH_STICK_RADIUS * 2}px;
      height: ${TOUCH_STICK_RADIUS * 2}px; margin: -${TOUCH_STICK_RADIUS}px 0 0 -${TOUCH_STICK_RADIUS}px;
      border-radius: 50%; border: 2px solid rgba(242, 241, 238, .3); background: rgba(16, 17, 19, .3);
      opacity: 0; transition: opacity .12s; pointer-events: none; }
    #touchControls .tc-stick.on { opacity: 1; }
    #touchControls .tc-stick i { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px;
      border-radius: 50%; background: rgba(242, 241, 238, .85); box-shadow: 0 3px 0 rgba(8, 9, 10, .6); }
    #touchControls .tc-cluster { position: absolute; pointer-events: none; }
    #touchControls .tc-right { right: max(14px, env(safe-area-inset-right)); bottom: max(14px, env(safe-area-inset-bottom));
      width: 250px; height: 230px; }
    #touchControls .tc-top { right: max(14px, env(safe-area-inset-right)); top: max(10px, env(safe-area-inset-top));
      display: flex; gap: 8px; }
    #touchControls .tc-btn { pointer-events: auto; touch-action: none; position: absolute; border-radius: 50%;
      border: 0; background: rgba(23, 24, 27, .62); box-shadow: 0 3px 0 rgba(8, 9, 10, .7); color: #f2f1ee;
      font: 700 13px/1 system-ui, sans-serif; letter-spacing: .02em; padding: 0; }
    /* No backdrop-filter here: a blur behind every button is re-composited
       each frame and is expensive on phone GPUs. */
    #touchControls .tc-btn.held { transform: translateY(3px); box-shadow: none; }
    #touchControls .tc-btn.on { background: #f2f1ee; color: #101113; }
    #touchControls .tc-top .tc-btn { position: static; width: 48px; height: 36px; border-radius: 3px; font-size: 12px; }
    #touchControls .tc-fire { width: 86px; height: 86px; right: 0; bottom: 64px; background: var(--ui-accent, #e8403f); box-shadow: 0 4px 0 var(--ui-accent-edge, #8f1f22); font-size: 15px; }
    #touchControls .tc-aim { width: 62px; height: 62px; right: 100px; bottom: 150px; }
    #touchControls .tc-jump { width: 70px; height: 70px; right: 96px; bottom: 0; }
    #touchControls .tc-crouch { width: 58px; height: 58px; right: 178px; bottom: 8px; }
    #touchControls .tc-reload { width: 48px; height: 48px; right: 14px; bottom: 164px; }
    #touchControls .tc-swap { width: 56px; height: 56px; right: 172px; bottom: 82px; }
    #touchControls .tc-build { width: 56px; height: 52px; right: 0; bottom: 0; border-radius: 3px; font-size: 12px; }
    #touchControls .tc-rotate { width: 44px; height: 44px; right: 112px; bottom: 82px; display: none; }
    body.touch-building #touchControls .tc-rotate { display: block; }
    #touchRotate { display: none; }
    @media (orientation: portrait) {
      body.touch-ui #touchRotate { display: grid; place-items: center; position: fixed; inset: 0; z-index: 9000;
        background: #0b0f18; color: #fff; text-align: center; font: 600 18px/1.4 system-ui, sans-serif; }
      body.touch-ui #touchRotate span { display: block; font-weight: 400; opacity: .7; font-size: 14px; }
    }
    body.touch-ui #crosshair { transform: translate(-50%, -50%) scale(1.15); }
    /* Phone placement of the HUD modules lives in 89-ui-system.js; these are
       the remaining legacy panels. */
    body.touch-playing #hotbar { display: none !important; }
    body.touch-playing #minimap { transform: scale(.62); transform-origin: left top; }
    body.touch-playing #buildHud { top: 120px !important; bottom: auto !important; transform: scale(.8); }
    body.touch-playing #killfeed { top: 120px !important; transform: scale(.8); transform-origin: right top; }
    @media (max-height: 420px) {
      #touchControls .tc-right { transform: scale(.86); transform-origin: right bottom; }
    }
  `);
}

// Called every frame while playing: only touch the DOM when something
// changed, so the HUD does not force a style recalc each frame.
let touchButtonsKey = '';
function touchRefreshButtons() {
  if (!touchUI.root) return;
  const building = quickBuild.active || !combatMode;
  const aimOn = combatMode && !quickBuild.active && gun.aiming;
  const key = [building, quickBuild.active, quickBuild.kind, combatMode, aimOn, !!keys.KeyC].join('|');
  if (key === touchButtonsKey) return;
  touchButtonsKey = key;
  document.body.classList.toggle('touch-building', building);
  touchUI.fire.textContent = building ? 'Place' : 'Fire';
  touchUI.aim.textContent = quickBuild.active ? 'Cancel' : !combatMode ? 'Break' : 'Aim';
  touchUI.aim.classList.toggle('on', aimOn);
  touchUI.crouch.classList.toggle('on', !!keys.KeyC);
  touchUI.build.textContent = quickBuild.active && BUILD_PIECES[quickBuild.kind] ? quickBuild.kind : 'Build';
}

/* ---------------- touch input ---------------- */
function touchFind(list, id) {
  for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
  return null;
}

function touchSetMove(dx, dy) {
  const len = Math.hypot(dx, dy);
  const r = TOUCH_STICK_RADIUS;
  const clamped = Math.min(len, r);
  const nx = len > 0 ? dx / len : 0, ny = len > 0 ? dy / len : 0;
  if (touchUI.stickKnob) touchUI.stickKnob.style.transform = 'translate(' + (nx * clamped) + 'px,' + (ny * clamped) + 'px)';
  const mag = clamped / r;
  const dead = mag < 0.22;
  const m = touchState.moveKeys;
  m.KeyW = !dead && ny < -0.38;
  m.KeyS = !dead && ny > 0.38;
  m.KeyA = !dead && nx < -0.38;
  m.KeyD = !dead && nx > 0.38;
  m.ShiftLeft = !dead && mag >= TOUCH_SPRINT_AT && ny < -0.5;
  for (const code in m) keys[code] = m[code];
}

function touchInstall() {
  touchBuildUI();
  document.body.classList.add('touch-ui');

  touchUI.moveZone.addEventListener('touchstart', (e) => {
    if (!touchGameplayActive() || touchState.stick) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    touchState.stick = { id: t.identifier, x: t.clientX, y: t.clientY };
    touchUI.stickBase.style.left = t.clientX + 'px';
    touchUI.stickBase.style.top = t.clientY + 'px';
    touchUI.stickBase.classList.add('on');
    touchSetMove(0, 0);
  }, { passive: false });

  touchUI.lookZone.addEventListener('touchstart', (e) => {
    if (!touchGameplayActive() || touchState.look) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    touchState.look = { id: t.identifier, x: t.clientX, y: t.clientY };
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!touchState.playing) return;
    const s = touchState.stick, l = touchState.look;
    if (s) {
      const t = touchFind(e.changedTouches, s.id);
      if (t) touchSetMove(t.clientX - s.x, t.clientY - s.y);
    }
    if (l) {
      const t = touchFind(e.changedTouches, l.id);
      if (t && touchGameplayActive()) {
        const riding = BC.api && BC.api.riding;
        const useWeapon = combatMode && !quickBuild.active && !(riding && riding.active);
        const weaponId = useWeapon && typeof currentWeapon === 'function' ? currentWeapon().id : null;
        const sens = BC.mouseSensitivity ? BC.mouseSensitivity(weaponId, useWeapon && gun.aiming) : 1;
        const lim = Math.PI / 2 - 0.02;
        player.yaw -= (t.clientX - l.x) * TOUCH_LOOK_GAIN * sens;
        player.pitch = Math.max(-lim, Math.min(lim, player.pitch - (t.clientY - l.y) * TOUCH_LOOK_GAIN * sens));
        l.x = t.clientX; l.y = t.clientY;
      }
    }
    if (s || l) e.preventDefault();
  }, { passive: false });

  const end = (e) => {
    const s = touchState.stick, l = touchState.look;
    if (s && touchFind(e.changedTouches, s.id)) {
      touchState.stick = null;
      touchSetMove(0, 0);
      touchUI.stickBase.classList.remove('on');
    }
    if (l && touchFind(e.changedTouches, l.id)) touchState.look = null;
    if (touchState.fireId !== null && touchFind(e.changedTouches, touchState.fireId)) {
      touchState.fireId = null;
      touchUI.fire.classList.remove('held');
      touchPrimary(false);
    }
  };
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);

  // Fire is held (automatic weapons, held building) and can also aim by
  // dragging, like the look zone.
  touchUI.fire.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!touchGameplayActive()) return;
    const t = e.changedTouches[0];
    touchState.fireId = t.identifier;
    if (!touchState.look) touchState.look = { id: t.identifier, x: t.clientX, y: t.clientY };
    touchUI.fire.classList.add('held');
    touchPrimary(true);
  }, { passive: false });

  for (const btn of touchUI.root.querySelectorAll('.tc-btn')) {
    if (btn === touchUI.fire) continue;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      btn.classList.add('held');
      touchAction(btn.dataset.action);
    }, { passive: false });
    btn.addEventListener('touchend', () => btn.classList.remove('held'));
    btn.addEventListener('click', (e) => { e.preventDefault(); }); // desktop emulation
  }

  // Menu Play/Resume buttons call lockPointer(), which starts touch play here.
  BC.on('death', () => touchReleaseAll(), -50);
  BC.on('worldWillReset', () => touchReleaseAll(), -50);
  BC.on('frame', () => { if (touchState.playing) touchRefreshButtons(); }, 90);
}

touchState.enabled = touchDetected();
if (touchState.enabled) touchInstall();

BC.api.touch = {
  get enabled() { return touchState.enabled; },
  get playing() { return touchState.playing; },
  start: touchStartPlay,
  pause: touchPause,
  action: touchAction
};
