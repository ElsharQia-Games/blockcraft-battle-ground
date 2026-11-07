/* Blockcraft Battle Ground — phone and tablet controls.
   82-touch.js (after 80-input.js, whose lockPointer/pause paths it plugs into)
   Landscape play built on what mobile shooters settled on:
   - a movement stick that appears wherever the left thumb lands, and a
     drag-to-look right side, never a second stick for the camera
   - one big fire button that also steers while held, plus an optional left fire
   - big, thumb-sized buttons with icons; only the ones that matter right now
     are shown (building, riding and the knife swap the set)
   - every button can be moved, resized and faded in the layout editor, and
     sensitivity is set there too, apart from the mouse setting
   Actions go through the same functions as the keyboard and mouse, so the
   gameplay rules stay in one place. */
'use strict';

const TOUCH_LOOK_GAIN = 0.0085;     // radians per pixel at sensitivity 1
const TOUCH_LOOK_BOOST = 0.6;       // extra turn for fast flicks
const TOUCH_STICK_RADIUS = 56;
const TOUCH_SPRINT_AT = 0.92;
const TOUCH_SPRINT_LOCK = 1.6;      // drag this far past the rim (in radii) to keep sprinting
const TOUCH_STORE = 'blockcraft.touch.v2';
const TOUCH_REF_W = 844, TOUCH_REF_H = 390;   // a typical phone held sideways

/* Each control: where it sits (pixels from the right/left and bottom of a
   reference phone, scaled to the screen) and when it shows. */
const TOUCH_CONTROLS = [
  { id: 'fire', label: 'Fire', size: 88, x: -64, y: 120, side: 'r', when: 'always', main: true },
  { id: 'aim', label: 'Aim', size: 60, x: -160, y: 196, side: 'r', when: 'gun' },
  { id: 'jump', label: 'Jump', size: 70, x: -150, y: 54, side: 'r', when: 'onfoot' },
  { id: 'crouch', label: 'Crouch', size: 58, x: -236, y: 44, side: 'r', when: 'onfoot' },
  { id: 'reload', label: 'Reload', size: 50, x: -40, y: 232, side: 'r', when: 'gun' },
  { id: 'swap', label: 'Next gun', size: 54, x: -250, y: 128, side: 'r', when: 'gun' },
  { id: 'knife', label: 'Knife', size: 46, x: -326, y: 52, side: 'r', when: 'gun' },
  { id: 'build', label: 'Build', size: 50, x: -40, y: 44, side: 'r', when: 'onfoot' },
  { id: 'rotate', label: 'Rotate', size: 48, x: -250, y: 128, side: 'r', when: 'building' },
  { id: 'ride', label: 'Ride', size: 60, x: -150, y: 290, side: 'r', when: 'mount' },
  { id: 'rise', label: 'Up', size: 62, x: -150, y: 54, side: 'r', when: 'riding' },
  { id: 'dive', label: 'Down', size: 56, x: -236, y: 44, side: 'r', when: 'riding' },
  { id: 'fireLeft', label: 'Fire', size: 58, x: 176, y: 250, side: 'l', when: 'gun' },
  { id: 'jetpack', label: 'Jetpack', size: 48, x: 48, y: 170, side: 'l', when: 'onfoot' }
];
const TOUCH_TOP = [['pause', 'Pause'], ['score', 'Scores'], ['view', 'Camera'], ['edit', 'Edit layout']];

/* Line icons, drawn at 24x24, so a button reads without text. */
const TOUCH_ICONS = {
  fire: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  fireLeft: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  aim: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
  jump: '<path d="M5 13l7-7 7 7M12 6v13"/>',
  crouch: '<path d="M5 11l7 7 7-7M12 18V5"/>',
  reload: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 4v4h-4"/>',
  swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  knife: '<path d="M4 20l5-5M9 15l9-9c1-1 2 0 1 1l-7 9z"/>',
  build: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M17 3v4h-4"/>',
  ride: '<path d="M3 15c3-6 7-8 9-8s6 2 9 8M8 11l-2-5M16 11l2-5M12 13v6"/>',
  rise: '<path d="M6 15l6-6 6 6"/>',
  dive: '<path d="M6 9l6 6 6-6"/>',
  jetpack: '<path d="M12 3c3 4 4 7 4 10a4 4 0 0 1-8 0c0-3 1-6 4-10z"/><path d="M10 21h4"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  score: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  view: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  breath: '<path d="M4 12h9M4 8h6M4 16h6"/><path d="M13 7l7 5-7 5z"/>'
};

const touchState = {
  enabled: false,     // touch UI installed (coarse pointer / touch device)
  playing: false,     // gameplay owns the screen (the touch "pointer lock")
  editing: false,     // the layout editor is open
  stick: null,        // { id, x, y }
  look: null,         // { id, x, y, t }
  fireId: null,
  sprintLocked: false,
  moveKeys: { KeyW: false, KeyA: false, KeyS: false, KeyD: false, ShiftLeft: false }
};

/* ---------------- saved layout and sensitivity ---------------- */
const touchPrefs = { look: 1, aim: 0.7, opacity: 0.85, scale: 1, leftFire: true, haptics: true, controls: {} };

function touchLoadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(TOUCH_STORE) || 'null');
    if (saved && typeof saved === 'object') {
      for (const key of ['look', 'aim', 'opacity', 'scale']) if (Number.isFinite(saved[key])) touchPrefs[key] = saved[key];
      for (const key of ['leftFire', 'haptics']) if (typeof saved[key] === 'boolean') touchPrefs[key] = saved[key];
      if (saved.controls && typeof saved.controls === 'object') touchPrefs.controls = saved.controls;
    }
  } catch (e) { /* private mode: defaults */ }
}
function touchSavePrefs() {
  try { localStorage.setItem(TOUCH_STORE, JSON.stringify(touchPrefs)); } catch (e) { /* not saved */ }
}

function touchDetected() {
  try {
    if (new URLSearchParams(location.search).get('touch') === '1') return true;
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  } catch (e) { return false; }
}

function touchGameplayActive() {
  return touchState.playing && !touchState.editing && typeof loading !== 'undefined' && !loading && alive &&
    !document.hidden && !BC.flags.worldBusy && !BC.flags.playerRepairBlocked;
}

function touchBuzz(ms) {
  if (touchPrefs.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* unsupported */ } }
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
  touchLayout();
  return true;
}

function touchPause() {
  if (!touchState.playing) return;
  touchReleaseAll();
  pauseGameplayInput(); // also clears touchState.playing and shows Pause
}

function touchRiding() { const r = BC.api && BC.api.riding; return r && r.active ? r : null; }

function touchReleaseAll() {
  touchState.stick = touchState.look = null;
  touchState.fireId = null;
  touchState.sprintLocked = false;
  for (const code in touchState.moveKeys) { touchState.moveKeys[code] = false; keys[code] = false; }
  gun.trigger = false;
  const riding = BC.api && BC.api.riding;
  if (riding && typeof riding.setHeld === 'function') {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']) riding.setHeld(code, false);
    if (typeof riding.stopFire === 'function') riding.stopFire();
  }
  if (typeof setBuildingHeld === 'function') { setBuildingHeld(0, false); setBuildingHeld(2, false); }
  if (touchUI.stickKnob) touchUI.stickKnob.style.transform = '';
  if (touchUI.stickBase) touchUI.stickBase.classList.remove('on', 'locked');
  if (touchUI.buttons) for (const id in touchUI.buttons) touchUI.buttons[id].classList.remove('held');
}

/* ---------------- actions (mirror 80-input.js) ---------------- */
function touchPrimary(down) {
  if (!touchGameplayActive()) return;
  const riding = touchRiding();
  if (riding) {
    if (down && typeof riding.startFire === 'function') riding.startFire();
    if (!down && typeof riding.stopFire === 'function') riding.stopFire();
    return;
  }
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

function touchAction(name, down) {
  if (name === 'pause') { touchPause(); return; }
  if (name === 'edit') { touchOpenEditor(); return; }
  if (!touchGameplayActive()) return;
  const riding = touchRiding();
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
      if (currentWeapon().melee) knifeToggle();
      else cycleWeapon(1);
      break;
    case 'knife':
      resetBuildingInput();
      if (!combatMode) setCombatMode(true);
      knifeToggle();
      break;
    case 'build': inputToggleQuickBuild(); break;
    case 'rotate': if (quickBuild.active) rotateBuildPiece(); break;
    case 'jetpack': if (BC.api.jetpack) BC.api.jetpack.toggle(); break;
    case 'ride': {
      const api = BC.api.riding;
      if (!api) break;
      if (api.active) api.dismount('key');
      else api.mountNearest();
      break;
    }
    case 'rise': case 'dive':
      if (riding && typeof riding.setHeld === 'function') riding.setHeld(name === 'rise' ? 'Space' : 'ShiftLeft', down !== false);
      break;
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
  touchRefreshButtons(true);
}

/* ---------------- layout ---------------- */
const touchUI = { buttons: {} };

function touchIcon(id) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (TOUCH_ICONS[id] || '') + '</svg>';
}

function touchButton(parent, id, label, cls) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tc-btn ' + (cls || '');
  b.dataset.action = id;
  b.setAttribute('aria-label', label);
  b.innerHTML = touchIcon(id) + '<span>' + label + '</span>';
  parent.appendChild(b);
  return b;
}

// Saved positions are fractions of the screen, so a layout made on one phone
// still fits another; sizes are pixels times the overall scale.
function touchPlacement(def) {
  const saved = touchPrefs.controls[def.id] || {};
  const w = window.innerWidth, h = window.innerHeight;
  const fit = Math.min(1.25, Math.max(0.7, Math.min(w / TOUCH_REF_W, h / TOUCH_REF_H)));
  const size = Math.round(def.size * fit * touchPrefs.scale * (Number.isFinite(saved.scale) ? saved.scale : 1));
  let cx, cy;
  if (Number.isFinite(saved.fx) && Number.isFinite(saved.fy)) { cx = saved.fx * w; cy = saved.fy * h; }
  else {
    cx = def.side === 'r' ? w + def.x * fit : def.x * fit;
    cy = h - def.y * fit;
  }
  const half = size / 2;
  cx = Math.max(half + 4, Math.min(w - half - 4, cx));
  cy = Math.max(half + 4, Math.min(h - half - 4, cy));
  return { cx, cy, size };
}

function touchLayout() {
  if (!touchUI.root) return;
  for (const def of TOUCH_CONTROLS) {
    const btn = touchUI.buttons[def.id], p = touchPlacement(def);
    btn.style.left = (p.cx - p.size / 2) + 'px';
    btn.style.top = (p.cy - p.size / 2) + 'px';
    btn.style.width = btn.style.height = p.size + 'px';
  }
  touchUI.root.style.setProperty('--tc-opacity', String(touchPrefs.opacity));
}

function touchBuildUI() {
  const root = document.createElement('div');
  root.id = 'touchControls';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<div class="tc-zone tc-move"></div><div class="tc-zone tc-look"></div>' +
    '<div class="tc-stick"><i></i></div><div class="tc-top"></div>';
  document.body.appendChild(root);
  touchUI.root = root;
  touchUI.moveZone = root.querySelector('.tc-move');
  touchUI.lookZone = root.querySelector('.tc-look');
  touchUI.stickBase = root.querySelector('.tc-stick');
  touchUI.stickKnob = touchUI.stickBase.querySelector('i');
  for (const def of TOUCH_CONTROLS) {
    touchUI.buttons[def.id] = touchButton(root, def.id, def.label, 'tc-' + def.id + (def.main ? ' tc-main' : ''));
  }
  touchUI.fire = touchUI.buttons.fire;
  const top = root.querySelector('.tc-top');
  for (const [id, label] of TOUCH_TOP) touchButton(top, id, label, 'tc-small');

  const rotate = document.createElement('div');
  rotate.id = 'touchRotate';
  rotate.innerHTML = '<div><b>Turn your phone sideways</b><span>Blockcraft plays in landscape.</span></div>';
  document.body.appendChild(rotate);

  BC.style('bc-touch-controls', `
    #touchControls { position: fixed; inset: 0; z-index: 40; pointer-events: none; display: none;
      touch-action: none; user-select: none; -webkit-user-select: none; --tc-opacity: .85; }
    body.touch-playing #touchControls { display: block; }
    #touchControls .tc-zone { position: absolute; top: 0; bottom: 0; pointer-events: auto; touch-action: none; }
    #touchControls .tc-move { left: 0; width: 42%; }
    #touchControls .tc-look { right: 0; width: 58%; }
    #touchControls .tc-stick { position: absolute; left: 0; top: 0; width: ${TOUCH_STICK_RADIUS * 2}px;
      height: ${TOUCH_STICK_RADIUS * 2}px; margin: -${TOUCH_STICK_RADIUS}px 0 0 -${TOUCH_STICK_RADIUS}px;
      border-radius: 50%; border: 2px solid rgba(242, 241, 238, .35); background: rgba(16, 17, 19, .3);
      opacity: 0; transition: opacity .12s; pointer-events: none; }
    #touchControls .tc-stick.on { opacity: 1; }
    #touchControls .tc-stick.locked { border-color: #6fd08c; }
    #touchControls .tc-stick i { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px;
      border-radius: 50%; background: rgba(242, 241, 238, .85); }
    #touchControls .tc-btn { pointer-events: auto; touch-action: none; position: absolute; display: none;
      place-items: center; border-radius: 50%; border: 2px solid rgba(242, 241, 238, .22); padding: 0;
      background: rgba(14, 16, 19, .55); color: #f2f1ee; opacity: var(--tc-opacity); }
    #touchControls .tc-btn.show { display: grid; }
    #touchControls .tc-btn svg { width: 46%; height: 46%; fill: none; stroke: currentColor; stroke-width: 2.2;
      stroke-linecap: round; stroke-linejoin: round; }
    #touchControls .tc-btn span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    /* No backdrop-filter: a blur behind every button is re-composited each
       frame and is expensive on phone GPUs. */
    #touchControls .tc-btn.held { background: rgba(242, 241, 238, .4); }
    #touchControls .tc-btn.on { background: #f2f1ee; color: #101113; border-color: #f2f1ee; }
    #touchControls .tc-main { background: rgba(232, 64, 63, .78); border-color: rgba(255, 210, 205, .5); }
    #touchControls .tc-main.held { background: #e8403f; }
    #touchControls .tc-top { position: absolute; right: max(12px, env(safe-area-inset-right)); top: max(8px, env(safe-area-inset-top));
      display: flex; gap: 8px; }
    #touchControls .tc-top .tc-btn { position: static; display: grid; width: 44px; height: 44px; border-radius: 10px; }
    #touchRotate { display: none; }
    @media (orientation: portrait) {
      body.touch-ui #touchRotate { display: grid; place-items: center; position: fixed; inset: 0; z-index: 9000;
        background: #0b0f18; color: #fff; text-align: center; font: 600 18px/1.4 system-ui, sans-serif; }
      body.touch-ui #touchRotate span { display: block; font-weight: 400; opacity: .7; font-size: 14px; }
    }
    body.touch-ui #crosshair { transform: translate(-50%, -50%) scale(1.15); }
    body.touch-playing #hotbar { display: none !important; }
    body.touch-playing #minimap { transform: scale(.7); transform-origin: left top; }
    body.touch-playing #buildHud { top: 120px !important; bottom: auto !important; transform: scale(.8); }
    body.touch-playing #killfeed { top: 60px !important; transform: scale(.8); transform-origin: right top; }
    /* Keyboard hints mean nothing on a phone; the buttons say it instead. */
    body.touch-ui #dragonRideHud .dr-foot, body.touch-ui #dragonRidePrompt { display: none !important; }
    body.touch-playing #dragonRideHud { --bc-ride-bottom: calc(100vh - 190px); }

    /* Layout editor */
    body.touch-editing #touchControls { display: block; background: rgba(6, 9, 12, .55); }
    body.touch-editing #touchControls .tc-zone, body.touch-editing #touchControls .tc-top { display: none; }
    body.touch-editing #touchControls .tc-btn { display: none; outline: 2px dashed rgba(242, 241, 238, .5); outline-offset: 3px; }
    body.touch-editing #touchControls .tc-btn.edit-show { display: grid; }
    #touchEditor .te-sets { display: flex; gap: 6px; }
    #touchEditor .te-sets button { min-width: 0; flex: 1; min-height: 36px; }
    #touchEditor .te-sets button.on { background: #f2f1ee; color: #101113; }
    body.touch-editing #touchControls .tc-btn.picked { outline: 3px solid #6fd08c; }
    body.touch-editing #touchControls .tc-btn span { position: absolute; left: 50%; top: 100%; width: auto; height: auto;
      overflow: visible; clip-path: none; transform: translateX(-50%); margin-top: 4px; white-space: nowrap;
      font: 600 11px/1 system-ui, sans-serif; color: #f2f1ee; }
    #touchEditor { position: fixed; left: 50%; top: max(6px, env(safe-area-inset-top)); transform: translateX(-50%); z-index: 60;
      display: none; width: min(460px, calc(100vw - 280px)); min-width: 300px; padding: 8px 10px; border-radius: 12px;
      background: #14171b; color: #f2f1ee; font: 500 13px/1.3 system-ui, sans-serif; touch-action: manipulation; }
    body.touch-editing #touchEditor { display: block; }
    #touchEditor .te-more { display: none; max-height: calc(100vh - 140px); overflow: auto; }
    #touchEditor.open .te-more { display: block; }
    #touchEditor .te-row { display: flex; align-items: center; gap: 10px; margin: 4px 0; }
    #touchEditor label { flex: 0 0 120px; }
    #touchEditor input[type=range] { flex: 1; height: 32px; }
    #touchEditor output { flex: 0 0 40px; text-align: right; font-variant-numeric: tabular-nums; }
    #touchEditor .te-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; flex-wrap: wrap; }
    #touchEditor button { min-height: 44px; min-width: 88px; border: 0; border-radius: 8px; padding: 0 14px;
      background: #2a2f36; color: #f2f1ee; font: 600 14px system-ui, sans-serif; }
    #touchEditor button.te-done { background: #e8403f; }
    #touchEditor .te-picked { opacity: .8; min-height: 18px; }
  `);
  touchBuildEditor();
}

// Shows only what can be used right now, so the screen stays clear.
let touchButtonsKey = '';
function touchRefreshButtons(force) {
  if (!touchUI.root) return;
  const riding = touchRiding();
  const building = !riding && (quickBuild.active || !combatMode);
  const gunOut = !riding && !building;
  const api = BC.api.riding;
  const canMount = !riding && api && typeof api.canMount === 'function' && api.canMount();
  const aimOn = gunOut && gun.aiming;
  const knifeOut = gunOut && currentWeapon().melee;
  const key = [!!riding, building, quickBuild.active, quickBuild.kind, combatMode, aimOn, !!keys.KeyC, canMount, knifeOut,
    touchPrefs.leftFire, touchState.editing].join('|');
  if (key === touchButtonsKey && !force) return;
  touchButtonsKey = key;
  document.body.classList.toggle('touch-building', building);
  const visible = {
    always: true, gun: gunOut, onfoot: !riding, building: !riding && quickBuild.active, mount: !!canMount || !!riding, riding: !!riding
  };
  for (const def of TOUCH_CONTROLS) {
    let show = visible[def.when];
    if (def.id === 'swap' && quickBuild.active) show = false;
    if (def.id === 'fireLeft' && !touchPrefs.leftFire) show = false;
    touchUI.buttons[def.id].classList.toggle('show', !!show);
  }
  const fire = touchUI.fire, fireIcon = riding ? 'breath' : building ? 'build' : 'fire';
  if (fire.dataset.icon !== fireIcon) { fire.dataset.icon = fireIcon; fire.querySelector('svg').innerHTML = TOUCH_ICONS[fireIcon]; }
  touchUI.buttons.aim.classList.toggle('on', !!aimOn);
  touchUI.buttons.crouch.classList.toggle('on', !!keys.KeyC);
  touchUI.buttons.knife.classList.toggle('on', !!knifeOut);
  touchUI.buttons.build.classList.toggle('on', !!quickBuild.active);
  touchUI.buttons.ride.classList.toggle('on', !!riding);
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
  // Pull well past the top of the stick and sprint stays on until you pull back.
  if (len > r * TOUCH_SPRINT_LOCK && ny < -0.7) touchState.sprintLocked = true;
  else if (dead || ny > -0.3) touchState.sprintLocked = false;
  if (touchUI.stickBase) touchUI.stickBase.classList.toggle('locked', touchState.sprintLocked);
  const m = touchState.moveKeys;
  m.KeyW = !dead && ny < -0.38;
  m.KeyS = !dead && ny > 0.38;
  m.KeyA = !dead && nx < -0.38;
  m.KeyD = !dead && nx > 0.38;
  m.ShiftLeft = !dead && (touchState.sprintLocked || (mag >= TOUCH_SPRINT_AT && ny < -0.5));
  for (const code in m) keys[code] = m[code];
  const riding = BC.api && BC.api.riding;
  if (riding && typeof riding.setHeld === 'function') {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) riding.setHeld(code, m[code]);
  }
}

function touchLook(t, l) {
  const riding = touchRiding();
  const useWeapon = combatMode && !quickBuild.active && !riding;
  const weaponId = useWeapon && typeof currentWeapon === 'function' ? currentWeapon().id : null;
  const aiming = useWeapon && gun.aiming;
  // Per-weapon tuning from Settings still applies, on top of the touch setting.
  const weapon = BC.mouseSensitivity ? BC.mouseSensitivity(weaponId, aiming) / BC.mouseSensitivity(null, false) : 1;
  const now = performance.now(), dx = t.clientX - l.x, dy = t.clientY - l.y;
  const speed = Math.hypot(dx, dy) / Math.max(4, now - l.t) * 1000;     // pixels per second
  const boost = 1 + TOUCH_LOOK_BOOST * Math.min(1, speed / 1800);
  const gain = TOUCH_LOOK_GAIN * touchPrefs.look * (aiming ? touchPrefs.aim : 1) * weapon * boost;
  const lim = Math.PI / 2 - 0.02;
  player.yaw -= dx * gain;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch - dy * gain));
  l.x = t.clientX; l.y = t.clientY; l.t = now;
}

function touchHoldable(id) { return id === 'rise' || id === 'dive'; }

function touchInstall() {
  touchLoadPrefs();
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
    touchState.look = { id: t.identifier, x: t.clientX, y: t.clientY, t: performance.now() };
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!touchState.playing || touchState.editing) return;
    const s = touchState.stick, l = touchState.look;
    if (s) {
      const t = touchFind(e.changedTouches, s.id);
      if (t) touchSetMove(t.clientX - s.x, t.clientY - s.y);
    }
    if (l) {
      const t = touchFind(e.changedTouches, l.id);
      if (t && touchGameplayActive()) touchLook(t, l);
    }
    if (s || l) e.preventDefault();
  }, { passive: false });

  const end = (e) => {
    const s = touchState.stick, l = touchState.look;
    if (s && touchFind(e.changedTouches, s.id)) {
      touchState.stick = null;
      touchState.sprintLocked = false;
      touchSetMove(0, 0);
      touchUI.stickBase.classList.remove('on', 'locked');
    }
    if (l && touchFind(e.changedTouches, l.id)) touchState.look = null;
    if (touchState.fireId !== null && touchFind(e.changedTouches, touchState.fireId)) {
      touchState.fireId = null;
      touchUI.fire.classList.remove('held');
      touchUI.buttons.fireLeft.classList.remove('held');
      touchPrimary(false);
    }
  };
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);

  // Both fire buttons hold to shoot, and the right one also steers while held.
  for (const btn of [touchUI.fire, touchUI.buttons.fireLeft]) {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (touchState.editing) { touchPick(btn, e.changedTouches[0]); return; }
      if (!touchGameplayActive()) return;
      const t = e.changedTouches[0];
      touchState.fireId = t.identifier;
      if (btn === touchUI.fire && !touchState.look) touchState.look = { id: t.identifier, x: t.clientX, y: t.clientY, t: performance.now() };
      btn.classList.add('held');
      touchPrimary(true);
    }, { passive: false });
  }

  for (const btn of touchUI.root.querySelectorAll('.tc-btn')) {
    if (btn === touchUI.fire || btn === touchUI.buttons.fireLeft) continue;
    const id = btn.dataset.action;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (touchState.editing) { touchPick(btn, e.changedTouches[0]); return; }
      btn.classList.add('held');
      touchAction(id, true);
    }, { passive: false });
    btn.addEventListener('touchend', () => {
      btn.classList.remove('held');
      if (touchHoldable(id) && !touchState.editing) touchAction(id, false);
    });
    btn.addEventListener('click', (e) => { e.preventDefault(); }); // desktop emulation
  }

  // A short buzz on Android when a shot lands or you are hit.
  BC.on('damage', () => touchBuzz(25), 50);
  BC.on('shot', (info) => { if (info && info.hit) touchBuzz(8); }, 50);

  window.addEventListener('resize', touchLayout);
  window.addEventListener('orientationchange', touchLayout);
  BC.on('death', () => touchReleaseAll(), -50);
  BC.on('worldWillReset', () => touchReleaseAll(), -50);
  BC.on('frame', () => { if (touchState.playing) touchRefreshButtons(); }, 90);
  touchLayout();
}

/* ---------------- layout editor ---------------- */
let touchPicked = null, touchDrag = null;

function touchBuildEditor() {
  const panel = document.createElement('div');
  panel.id = 'touchEditor';
  const slider = (id, label, min, max, step, value, fmt) =>
    '<div class="te-row"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="range" min="' + min +
    '" max="' + max + '" step="' + step + '" value="' + value + '"><output id="' + id + 'Out">' + fmt(value) + '</output></div>';
  const pct = (v) => Math.round(v * 100) + '%';
  panel.innerHTML =
    '<div class="te-sets"><button type="button" data-set="foot" class="on">On foot</button><button type="button" data-set="build">Building</button>' +
    '<button type="button" data-set="dragon">Dragon</button></div>' +
    '<div class="te-picked" id="tePicked">Drag a button to move it. Tap one to resize it.</div>' +
    slider('teSize', 'Button size', 0.6, 1.6, 0.05, 1, pct) +
    '<div class="te-more">' +
    slider('teLook', 'Look speed', 0.3, 3, 0.05, touchPrefs.look, pct) +
    slider('teAim', 'Aiming speed', 0.2, 1.5, 0.05, touchPrefs.aim, pct) +
    slider('teOpacity', 'Opacity', 0.25, 1, 0.05, touchPrefs.opacity, pct) +
    slider('teScale', 'All buttons', 0.7, 1.4, 0.05, touchPrefs.scale, pct) +
    '<div class="te-row"><label for="teLeft">Left fire button</label><input id="teLeft" type="checkbox"' + (touchPrefs.leftFire ? ' checked' : '') + '></div>' +
    '<div class="te-row"><label for="teHaptic">Vibration</label><input id="teHaptic" type="checkbox"' + (touchPrefs.haptics ? ' checked' : '') + '></div>' +
    '</div>' +
    '<div class="te-actions"><button type="button" id="teMore">Settings</button><button type="button" id="teReset">Reset layout</button>' +
    '<button type="button" class="te-done" id="teDone">Done</button></div>';
  document.body.appendChild(panel);
  touchUI.editor = panel;
  const bind = (id, apply) => {
    const input = panel.querySelector('#' + id), out = panel.querySelector('#' + id + 'Out');
    input.addEventListener('input', () => { const v = Number(input.value); if (out) out.textContent = pct(v); apply(v); touchLayout(); touchSavePrefs(); });
  };
  bind('teSize', (v) => {
    if (!touchPicked) return;
    const c = touchPrefs.controls[touchPicked] = touchPrefs.controls[touchPicked] || {};
    c.scale = v;
  });
  bind('teLook', (v) => { touchPrefs.look = v; });
  bind('teAim', (v) => { touchPrefs.aim = v; });
  bind('teOpacity', (v) => { touchPrefs.opacity = v; });
  bind('teScale', (v) => { touchPrefs.scale = v; });
  panel.querySelector('#teLeft').addEventListener('change', (e) => { touchPrefs.leftFire = e.target.checked; touchSavePrefs(); });
  panel.querySelector('#teHaptic').addEventListener('change', (e) => { touchPrefs.haptics = e.target.checked; touchSavePrefs(); });
  panel.querySelector('#teReset').addEventListener('click', () => { touchPrefs.controls = {}; touchSavePrefs(); touchLayout(); touchSelect(null); });
  panel.querySelector('#teDone').addEventListener('click', touchCloseEditor);
  panel.querySelector('#teMore').addEventListener('click', () => panel.classList.toggle('open'));
  for (const b of panel.querySelectorAll('[data-set]')) b.addEventListener('click', () => touchEditSet(b.dataset.set));

  window.addEventListener('touchmove', (e) => {
    if (!touchDrag) return;
    const t = touchFind(e.changedTouches, touchDrag.id);
    if (!t) return;
    e.preventDefault();
    const c = touchPrefs.controls[touchDrag.control] = touchPrefs.controls[touchDrag.control] || {};
    c.fx = (t.clientX - touchDrag.ox) / window.innerWidth;
    c.fy = (t.clientY - touchDrag.oy) / window.innerHeight;
    touchLayout();
  }, { passive: false });
  const stop = (e) => { if (touchDrag && touchFind(e.changedTouches, touchDrag.id)) { touchDrag = null; touchSavePrefs(); } };
  window.addEventListener('touchend', stop);
  window.addEventListener('touchcancel', stop);
}

const TOUCH_EDIT_SETS = {
  foot: ['always', 'gun', 'onfoot', 'mount'],
  build: ['always', 'onfoot', 'building'],
  dragon: ['always', 'riding', 'mount']
};
function touchEditSet(set) {
  touchSelect(null);
  for (const b of touchUI.editor.querySelectorAll('[data-set]')) b.classList.toggle('on', b.dataset.set === set);
  for (const def of TOUCH_CONTROLS) {
    let show = TOUCH_EDIT_SETS[set].indexOf(def.when) >= 0;
    if (set === 'build' && (def.id === 'swap' || def.id === 'fireLeft')) show = false;
    touchUI.buttons[def.id].classList.toggle('edit-show', show);
  }
}

function touchSelect(id) {
  touchPicked = id;
  for (const key in touchUI.buttons) touchUI.buttons[key].classList.toggle('picked', key === id);
  const def = TOUCH_CONTROLS.find((d) => d.id === id);
  const saved = id && touchPrefs.controls[id];
  touchUI.editor.querySelector('#tePicked').textContent = def ? 'Selected: ' + def.label + '. Drag to move it.' : 'Drag a button to move it. Tap one to resize it.';
  const size = touchUI.editor.querySelector('#teSize');
  size.disabled = !def;
  size.value = saved && Number.isFinite(saved.scale) ? saved.scale : 1;
  touchUI.editor.querySelector('#teSizeOut').textContent = Math.round(size.value * 100) + '%';
  size.closest('.te-row').style.display = def ? '' : 'none';
}

function touchPick(btn, t) {
  const id = btn.dataset.action;
  if (!TOUCH_CONTROLS.some((d) => d.id === id)) return;
  touchSelect(id);
  const rect = btn.getBoundingClientRect();
  touchDrag = { id: t.identifier, control: id, ox: t.clientX - (rect.left + rect.width / 2), oy: t.clientY - (rect.top + rect.height / 2) };
}

let touchEditorFromPause = false;
function touchOpenEditor() {
  if (!touchUI.root) return;
  touchReleaseAll();
  const menus = BC.api.menus;
  touchEditorFromPause = !!(menus && menus.state && menus.state.screen === 'pause');
  if (touchEditorFromPause && typeof menus.hide === 'function') menus.hide();
  touchState.editing = true;
  document.body.classList.add('touch-editing');
  touchUI.editor.classList.remove('open');
  touchEditSet('foot');
  touchLayout();
}

function touchCloseEditor() {
  touchState.editing = false;
  touchDrag = null;
  document.body.classList.remove('touch-editing');
  touchSelect(null);
  touchSavePrefs();
  touchRefreshButtons(true);
  const menus = BC.api.menus;
  if (touchEditorFromPause && menus && typeof menus.showPause === 'function') menus.showPause();
  touchEditorFromPause = false;
}

touchState.enabled = touchDetected();
if (touchState.enabled) touchInstall();
document.addEventListener('click', (e) => {
  if (e.target && e.target.closest && e.target.closest('#pauseTouchLayout')) touchOpenEditor();
});

BC.api.touch = {
  get enabled() { return touchState.enabled; },
  get playing() { return touchState.playing; },
  get editing() { return touchState.editing; },
  prefs: touchPrefs,
  start: touchStartPlay,
  pause: touchPause,
  action: touchAction,
  edit: touchOpenEditor,
  closeEditor: touchCloseEditor,
  layout: touchLayout
};
