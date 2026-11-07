/* Blockcraft Battle Ground — Home, dedicated setup pages and in-game pause.
   88-menu.js
   Classic script: load after 87-minimap.js, before network and boot. Input owns
   trusted pointer/fullscreen capture; settings owns its store and native inputs.
   No navigation, background click or settings change starts gameplay. */
'use strict';

(function () {
  var BC = window.BC;
  if (!BC || !BC.api || !BC.flags) return;

  var roots = {
    home: document.getElementById('hint'),
    play: document.getElementById('playSetupScreen'),
    characters: document.getElementById('charactersScreen'),
    online: document.getElementById('onlineScreen'),
    settings: document.getElementById('settingsMenu'),
    pause: document.getElementById('pauseMenu')
  };
  var titles = {
    home: 'homeTitle', play: 'playSetupTitle', characters: 'charactersTitle',
    online: 'onlineTitle', settings: 'settingsTitle', pause: 'pauseTitle'
  };
  var play = document.getElementById('play');
  var resume = document.getElementById('pauseResume');
  if (!roots.home || !roots.pause || !roots.settings || !play || !resume) return;

  var screen = 'home';
  var settingsReturn = 'home';
  var settingsTab = 'aim';
  var pageOrigin = null;
  var settingsOrigin = null;
  var releaseDestination = null;
  var lastCharacter = '';
  var lastRefresh = 0;
  var captureDenied = false;
  var lastNetStatus = null;
  var enteredWorld = false;
  var copyBusy = false, copiedRoom = '', copiedUntil = 0;
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('[data-settings-tab]'));
  if (typeof BC.flags.hasPlayed !== 'boolean') BC.flags.hasPlayed = false;

  function text(id, value) {
    var el = document.getElementById(id);
    if (el && el.textContent !== String(value)) el.textContent = String(value);
  }

  function loadingWorld() {
    try { if (typeof loading !== 'undefined') return !!loading; } catch (err) { /* boot is a later script */ }
    return BC.flags.bootReady !== true;
  }

  function worldBusy() {
    if (BC.flags.worldBusy) return true;
    var world = BC.api.world;
    return !!(world && world.busy);
  }

  function captureStarting() {
    try { return typeof gameplayKeyboardCapture !== 'undefined' && !!gameplayKeyboardCapture.starting; }
    catch (err) { return false; }
  }

  function canPlay() {
    var settings = BC.api.settings;
    if (loadingWorld() || worldBusy() || (settings && settings.busy) || connectionPending(connectionStatus()) ||
        BC.flags.playerRepairBlocked || document.hidden) return false;
    try { if (typeof alive !== 'undefined' && !alive) return false; } catch (err) { /* reduced build */ }
    return true;
  }

  function connectionPending(status) {
    return !!(status.configPending || status.configError ||
      (status.mode === 'mqtt' && (!status.online || !status.authorityReady)));
  }

  function visible(el, on) {
    if (!el) return;
    if (!on && el.contains(document.activeElement) && document.activeElement.blur) document.activeElement.blur();
    el.hidden = !on;
    el.inert = !on;
    el.classList.toggle('hidden', !on);
    el.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function focus(el) {
    if (el && !el.disabled && !el.closest('[hidden], [inert]') && !document.hidden) el.focus({ preventScroll: true });
  }

  function activate(next, focusTarget) {
    if (next !== 'game' && !roots[next]) return false;
    var changed = screen !== next;
    screen = next;
    BC.flags.menuScreen = next;
    BC.flags.menuOpen = next !== 'game';
    Object.keys(roots).forEach(function (key) { visible(roots[key], key === next); });
    if (next !== 'game') document.body.classList.remove('started');
    if (changed) captureDenied = false;
    if (focusTarget !== false && next !== 'game') focus(focusTarget || document.getElementById(titles[next]));
    return true;
  }

  function releaseCapture() {
    var captured = !!document.pointerLockElement || !!document.fullscreenElement || captureStarting();
    try {
      if (typeof gameplayKeyboardCapture !== 'undefined') captured = captured || gameplayKeyboardCapture.requested;
    } catch (err) { /* reduced build */ }
    if (captured) {
      // 80-input's asynchronous unlock callbacks must not replace the page we
      // just opened (particularly Settings) with a new Home/Pause surface.
      releaseDestination = screen;
      if (typeof resetGameplayInput === 'function') resetGameplayInput();
      else if (typeof BC.emit === 'function') BC.emit('inputReset');
      if (document.pointerLockElement && typeof document.exitPointerLock === 'function') {
        try { document.exitPointerLock(); } catch (err) { /* already released */ }
      }
      if (typeof exitInputFullscreen === 'function') exitInputFullscreen();
    }
    document.body.classList.remove('started');
  }

  function showHome(force) {
    if (!force && releaseDestination === screen && screen !== 'home' && screen !== 'game' && screen !== 'pause') {
      refresh();
      return true;
    }
    BC.flags.hasPlayed = false;
    settingsReturn = 'home';
    releaseDestination = null;
    var changed = screen !== 'home';
    activate('home', false);
    releaseCapture();
    refresh();
    if (changed) focus(document.getElementById('homeTitle'));
    return true;
  }

  function showPause() {
    // Input also calls this after losing capture. Do not interrupt a player
    // editing Settings or a dedicated Home page with an unlock notification.
    if (screen === 'settings' || screen === 'characters' || screen === 'online' || screen === 'play') {
      refresh();
      return true;
    }
    if (!BC.flags.hasPlayed) return showHome();
    var changed = screen !== 'pause';
    activate('pause', false);
    releaseCapture();
    refresh();
    if (changed) focus(resume.disabled ? document.getElementById('pauseTitle') : resume);
    return true;
  }

  function hide() {
    releaseDestination = null;
    return activate('game', false);
  }

  function openSettings() {
    if (screen !== 'settings') {
      settingsReturn = screen === 'play' || screen === 'characters' || screen === 'online'
        ? screen : BC.flags.hasPlayed ? 'pause' : 'home';
      settingsOrigin = document.activeElement;
    }
    activate('settings');
    releaseCapture();
    refreshSettings();
    var label = settingsReturn === 'pause' ? 'Pause' : settingsReturn === 'play' ? 'Mode & map'
      : settingsReturn === 'characters' ? 'Characters' : settingsReturn === 'online' ? 'Connection help' : 'Home';
    text('settingsBackLabel', label);
    text('settingsDone', 'Back to ' + label);
    document.getElementById('settingsBack').setAttribute('aria-label', 'Back to ' + label + '; keep gameplay paused');
    document.getElementById('settingsBack').dataset.menuScreen = settingsReturn;
    document.getElementById('settingsDone').dataset.menuScreen = settingsReturn;
    var weaponSelect = document.getElementById('bcWeaponSelect');
    if (settingsReturn === 'pause' && weaponSelect && typeof currentWeapon === 'function') {
      weaponSelect.value = currentWeapon().id;
      weaponSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    refresh();
    return true;
  }

  function closeSettings() {
    if (screen !== 'settings') return false;
    releaseDestination = null;
    activate(settingsReturn, false);
    refresh();
    // Back only changes the screen; it never calls lockPointer().
    var fallback = document.getElementById(settingsReturn === 'pause' ? 'pauseSettings'
      : settingsReturn === 'home' ? 'menuSettings' : titles[settingsReturn]);
    focus(settingsOrigin && roots[settingsReturn].contains(settingsOrigin) ? settingsOrigin : fallback);
    return true;
  }

  function openPage(next, origin) {
    if (next === 'settings') return openSettings();
    if (next !== 'play' && next !== 'characters' && next !== 'online') return false;
    pageOrigin = origin || document.activeElement;
    activate(next);
    releaseCapture();
    refreshSettings();
    refresh();
    return true;
  }

  function pageBack() {
    var origin = pageOrigin;
    showHome(true);
    if (origin && roots.home.contains(origin)) focus(origin);
    return true;
  }

  function resumeGame() {
    if (screen !== 'pause' || !canPlay() || captureStarting()) return false;
    captureDenied = false;
    // Keep this direct and synchronous in the trusted button/key gesture.
    // Do not await, dispatch a synthetic click, or request capture from a timer.
    var requested = typeof lockPointer === 'function' && lockPointer();
    if (requested === false) captureDenied = true;
    refresh();
    return requested !== false;
  }

  function handleEscape(event) {
    if (screen === 'game') return false;
    if (event && event.code && event.code !== 'Escape' && event.key !== 'Escape') return false;
    if (event && (event.isComposing || event.repeat)) return true;
    if (screen === 'settings') return closeSettings();
    if (screen === 'play' || screen === 'characters' || screen === 'online') return pageBack();
    if (screen === 'pause') { resumeGame(); return true; }
    return true;
  }

  function notifyGameplayStarted() {
    BC.flags.hasPlayed = true;
    enteredWorld = true;
    captureDenied = false;
    hide();
    return true;
  }

  function refreshSettings() {
    var settings = BC.api.settings;
    if (settings && typeof settings.refresh === 'function') settings.refresh();
  }

  function setSettingsTab(id, moveFocus) {
    var found = false;
    tabButtons.forEach(function (button) { if (button.dataset.settingsTab === id) found = true; });
    if (!found) return;
    settingsTab = id;
    tabButtons.forEach(function (button) {
      var selected = button.dataset.settingsTab === id;
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.tabIndex = selected ? 0 : -1;
      var panel = document.getElementById(button.getAttribute('aria-controls'));
      if (panel) { panel.hidden = !selected; panel.inert = !selected; }
      if (selected && moveFocus) focus(button);
    });
    var scroller = roots.settings.querySelector('.bc-page-scroll');
    if (scroller) scroller.scrollTop = 0;
  }

  function paintPortrait(canvas, key) {
    if (!canvas || typeof paintHead !== 'function' || typeof CHARACTERS === 'undefined' || !CHARACTERS[key]) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 32, 32);
    ctx.imageSmoothingEnabled = false;
    paintHead(ctx, 'nz', CHARACTERS[key], key);
  }

  function buildPortraits() {
    if (typeof charButtons === 'undefined') return;
    charButtons.forEach(function (entry) {
      entry.btn.dataset.character = entry.key;
      entry.btn.setAttribute('aria-pressed', entry.btn.classList.contains('active') ? 'true' : 'false');
      if (entry.btn.querySelector('canvas')) return;
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = 32;
      canvas.setAttribute('aria-hidden', 'true');
      paintPortrait(canvas, entry.key);
      entry.btn.insertBefore(canvas, entry.btn.firstChild);
    });
  }

  function refreshProfile() {
    var key = typeof charKey !== 'undefined' ? charKey : 'cj';
    var name = typeof playerName !== 'undefined' ? playerName : 'Wanderer';
    var character = typeof CHARACTERS !== 'undefined' && CHARACTERS[key];
    var label = character ? character.name : key;
    text('homePlayerName', name);
    text('homeCharacter', label);
    text('characterSelected', label);
    if (key !== lastCharacter) {
      lastCharacter = key;
      paintPortrait(document.getElementById('homePortrait'), key);
      paintPortrait(document.getElementById('characterPortrait'), key);
    }
    if (roots.characters) roots.characters.querySelectorAll('.char').forEach(function (button) {
      button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
    });
  }

  function connectionStatus() {
    // Network registers after this script; read it lazily and never create a
    // second session or a shadow copy of room authority.
    if (typeof netStatusPayload === 'function') return netStatusPayload();
    return lastNetStatus || { online: false, mode: null, room: '', players: 1 };
  }

  function roomCode() {
    var input = document.getElementById('roomInput');
    if (typeof normalizeRoom === 'function') return normalizeRoom(input && input.value);
    return String(input ? input.value : '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }

  function refreshConnection() {
    var status = connectionStatus();
    var room = status.room || '';
    var online = !!status.online;
    var joining = status.mode === 'mqtt' && connectionPending(status);
    var players = Math.max(1, Number(status.players) || 1);
    var authority = status.canConfigure ? 'You control mode & map' : 'Host controls mode & map';
    var label = room ? 'Online room' : online ? 'LAN multiplayer' : 'Solo';
    var detail = status.configError ? 'World sync failed. Cancel and try again.'
      : joining ? online ? 'Preparing the shared world\u2026' : 'Connecting\u2026'
      : status.desync && online ? 'Resyncing world\u2026'
      : online ? players + (players === 1 ? ' player' : ' players') + ' \u00b7 ' + authority : 'Local world';
    text('homeConnectionLabel', label);
    text('homeConnectionDetail', detail);
    text('onlineSessionName', room ? 'Room ' + room : label);
    text('onlineSessionStatus', detail);
    text('onlineHomeNote', online || room
      ? 'Home keeps this connection and world. Online matches continue while menus are open.'
      : 'Create or join directly on Home. Play starts only when you choose it.');
    text('pauseSessionNote', online || room
      ? 'Online matches continue while you are paused. Home keeps this room, world and your settings.'
      : 'Home keeps this world and your settings. Only Play or Resume captures your mouse.');

    var blocked = loadingWorld() || worldBusy();
    var join = document.getElementById('onlineBtn');
    var create = document.getElementById('createBtn');
    var copy = document.getElementById('menuCopyRoom');
    var leave = document.getElementById('menuLeaveRoom');
    var connect = document.getElementById('homeRoomConnect');
    var invite = document.getElementById('homeRoomInvite');
    var hadJoinFocus = connect && connect.contains(document.activeElement);
    visible(connect, !room);
    visible(invite, !!room);
    text('homeRoomCode', room);
    if (join) {
      join.disabled = blocked || joining || !!room || !roomCode() || typeof startOnline !== 'function';
      join.setAttribute('aria-busy', joining ? 'true' : 'false');
      text('onlineBtn', joining ? 'Joining\u2026' : 'Join');
    }
    if (create) create.disabled = blocked || joining || !!room || typeof createRoom !== 'function';
    var input = document.getElementById('roomInput');
    if (input) input.disabled = joining || !!room;
    if (copy) {
      copy.disabled = !room || copyBusy || typeof copyRoom !== 'function';
      copy.setAttribute('aria-busy', copyBusy ? 'true' : 'false');
      text('menuCopyRoom', copyBusy ? 'Copying\u2026'
        : room === copiedRoom && performance.now() < copiedUntil ? 'Copied!' : 'Copy code');
      copy.setAttribute('aria-label', 'Copy invite code ' + room);
    }
    if (leave) {
      visible(leave, !!status.mode);
      leave.disabled = !status.mode || typeof leaveOnline !== 'function';
      text('menuLeaveRoom', joining ? 'Cancel connection' : room ? 'Leave room' : 'Disconnect LAN');
    }
    visible(document.getElementById('pauseRoom'), !!room);
    if (room && hadJoinFocus && screen === 'home') focus(copy && !copy.disabled ? copy : leave);
    text('onlineFlowHint', blocked ? 'World setup is in progress. You can join once it finishes.'
      : joining ? 'Waiting for the room and host world. You can leave if you want to cancel.'
      : 'Create, join and copy invite codes directly on Home.');
  }

  function refreshMatch() {
    var modes = BC.api.modes;
    var settings = BC.api.settings;
    var def = modes && modes.activeDef;
    var match = modes && typeof modes.matchState === 'function' ? modes.matchState() : null;
    var world = BC.api.world;
    var seed = world && typeof world.seed === 'function' ? world.seed() : settings ? settings.seed : null;
    var name = def ? def.name : 'Team Deathmatch';
    var team = match ? match.selfTeam : modes ? modes.localTeam : null;
    text('homeMapSeed', seed == null ? 'Loading\u2026' : String(seed >>> 0));
    text('pauseContext', name + (seed == null ? '' : ' \u00b7 Map ' + (seed >>> 0)));
    text('pauseTeam', team === 'red' ? 'Red team' : team === 'blue' ? 'Blue team' : def && def.teams === false ? 'Free for all' : 'Team unassigned');
    var teamEl = document.getElementById('pauseTeam');
    if (teamEl) teamEl.style.color = team === 'red' ? 'var(--bc-red)' : team === 'blue' ? 'var(--bc-blue)' : '';
    var red = match ? Math.max(0, Number(match.red) || 0) : 0;
    var blue = match ? Math.max(0, Number(match.blue) || 0) : 0;
    var score = def && def.teams === false
      ? (typeof kills !== 'undefined' ? kills : 0) + ' kills'
      : 'Red ' + red + ' \u2013 Blue ' + blue;
    text('pauseScore', score);
  }

  function refreshProgress() {
    var loading = loadingWorld();
    var status = connectionStatus();
    var linking = connectionPending(status);
    var settings = BC.api.settings;
    var busy = worldBusy() || !!(settings && settings.busy) || linking;
    var starting = captureStarting();
    var dead = typeof alive !== 'undefined' && !alive;
    var ready = canPlay() && !starting;
    var progress = document.getElementById('homeProgress');
    if (play.disabled === ready) play.disabled = !ready;
    play.setAttribute('aria-busy', loading || busy || starting ? 'true' : 'false');
    resume.disabled = !canPlay() || starting;
    resume.setAttribute('aria-busy', starting ? 'true' : 'false');
    text('pauseResume', starting ? 'Starting\u2026' : 'Resume');
    var setupStart = document.getElementById('playSetupStart');
    if (setupStart) {
      setupStart.disabled = !ready;
      setupStart.setAttribute('aria-busy', starting ? 'true' : 'false');
      text('playSetupStart', starting ? 'Starting\u2026' : 'Play this match');
    }
    if (progress) {
      progress.hidden = !loading && !busy;
      var percentage = /(?:Building|Rebuilding)\s+(\d+)%/i.exec(play.textContent);
      if (percentage) progress.value = Math.min(100, Number(percentage[1]));
      else progress.removeAttribute('value');
    }
    if (!loading && !busy) text('play', starting ? 'Starting\u2026' : dead ? 'Respawning\u2026'
      : BC.flags.playerRepairBlocked ? 'Waiting for clear space'
      : enteredWorld ? 'Return to match' : status.online ? 'Play online' : 'Play solo');
    else if (!loading && linking) text('play', status.configError ? 'Connection problem' : 'Connecting\u2026');
    text('homeLoadHint', loading ? 'Building your world. Character and personal settings are available now.'
      : linking ? status.configError ? 'Room setup failed. Cancel the connection and try again.'
        : 'Preparing your room. You can copy the invite code or cancel on the right.'
      : busy ? 'Updating the current world. Play is available when setup finishes.'
      : starting ? 'Starting mouse and keyboard capture\u2026'
      : dead ? 'Waiting to respawn. Your room and settings are unchanged.'
      : BC.flags.playerRepairBlocked ? 'Waiting for the obstruction around your character to clear.'
      : captureDenied ? 'Mouse capture did not start. Click Play again to retry.'
      : BC.api.touch && BC.api.touch.enabled ? 'Tap Play to start. Pause is the top-right button.'
      : 'Play captures your mouse. Esc opens the pause menu.');
    text('pauseInputHint', starting ? 'Starting mouse and keyboard capture\u2026'
      : !canPlay() ? 'Waiting for world setup or respawn. Your settings are still available.'
      : captureDenied ? 'Capture did not start. Click Resume to try again.'
      : BC.api.touch && BC.api.touch.enabled ? 'Tap Resume to continue.' : 'Click Resume or press Esc to continue.');
  }

  function refresh() {
    refreshProfile();
    refreshConnection();
    refreshMatch();
    refreshProgress();
    return true;
  }

  BC.api.menus = {
    showHome: showHome, showPause: showPause, hide: hide, canPlay: canPlay,
    openSettings: openSettings, closeSettings: closeSettings, handleEscape: handleEscape,
    notifyGameplayStarted: notifyGameplayStarted, refresh: refresh,
    get state() {
      return Object.freeze({
        screen: screen, hasPlayed: !!BC.flags.hasPlayed, settingsReturn: settingsReturn,
        settingsTab: settingsTab, open: screen !== 'game', ready: !loadingWorld(),
        busy: worldBusy() || play.disabled, capturePending: captureStarting()
      });
    }
  };

  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('button');
    if (!button || button.disabled || !button.closest('.bc-menu') || button.closest('[hidden], [inert]')) return;
    if (button.hasAttribute('data-menu-home')) showHome(true);
    else if (button.hasAttribute('data-settings-back')) closeSettings();
    else if (button.hasAttribute('data-menu-back')) pageBack();
    else if (button.hasAttribute('data-menu-play') && screen === 'play' && canPlay() && !captureStarting()) {
      captureDenied = typeof lockPointer !== 'function' || lockPointer() === false;
      refresh();
    }
    else if (button.dataset.menuOpen) openPage(button.dataset.menuOpen, button);
    else if (button.dataset.settingsTab) setSettingsTab(button.dataset.settingsTab, false);
  });
  resume.addEventListener('click', resumeGame);
  play.addEventListener('click', function () { captureDenied = false; refresh(); });
  document.getElementById('menuCopyRoom').addEventListener('click', function () {
    if (typeof copyRoom !== 'function' || copyBusy) return;
    var code = connectionStatus().room;
    copyBusy = true;
    var task = copyRoom();
    refreshConnection();
    Promise.resolve(task).then(function (success) {
      copyBusy = false;
      if (success) { copiedRoom = code; copiedUntil = performance.now() + 1600; }
      refreshConnection();
    }, function () { copyBusy = false; refreshConnection(); });
  });
  document.getElementById('menuLeaveRoom').addEventListener('click', function () {
    if (typeof leaveOnline === 'function') leaveOnline(false);
    refresh();
    focus(play);
  });
  var roomInput = document.getElementById('roomInput');
  if (roomInput) {
    roomInput.addEventListener('input', function () {
      roomInput.removeAttribute('aria-invalid');
      text('roomHint', 'Create a room to invite friends, or paste their code to join.');
      refreshConnection();
    });
    roomInput.addEventListener('paste', function (event) {
      if (!event.clipboardData || typeof normalizeRoom !== 'function') return;
      event.preventDefault();
      roomInput.value = normalizeRoom(event.clipboardData.getData('text'));
      roomInput.dispatchEvent(new Event('input', { bubbles: true }));
      if (!roomInput.value) {
        roomInput.setAttribute('aria-invalid', 'true');
        text('roomHint', 'Paste a room code or a link containing ?room=CODE.');
      }
    });
    roomInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && (event.isComposing || event.repeat)) { event.preventDefault(); return; }
      if (event.key === 'Enter' && document.getElementById('onlineBtn').disabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!roomCode()) {
          roomInput.setAttribute('aria-invalid', 'true');
          text('roomHint', 'Enter a room code, or use Create room.');
        }
      }
    });
  }
  var playerNameInput = document.getElementById('nameInput');
  if (playerNameInput) {
    playerNameInput.addEventListener('input', refreshProfile);
    playerNameInput.addEventListener('blur', function () {
      if (typeof playerName !== 'undefined') playerNameInput.value = playerName;
    });
  }

  document.addEventListener('keydown', function (event) {
    if (screen === 'game' || event.isComposing) return;
    var tab = event.target.closest && event.target.closest('[data-settings-tab]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key) >= 0) {
      var index = tabButtons.indexOf(tab);
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabButtons.length - 1;
      else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length;
      event.preventDefault();
      setSettingsTab(tabButtons[index].dataset.settingsTab, true);
      return;
    }
    if (event.key !== 'Tab') return;
    var root = roots[screen];
    if (!root) return;
    var controls = Array.prototype.slice.call(root.querySelectorAll('button, input, select, textarea, a[href], [tabindex]'))
      .filter(function (el) { return !el.disabled && el.tabIndex >= 0 && !el.closest('[hidden], [inert]'); });
    if (!controls.length) { event.preventDefault(); focus(document.getElementById(titles[screen])); return; }
    var first = controls[0], last = controls[controls.length - 1];
    var active = document.activeElement;
    if (controls.indexOf(active) < 0 || (!event.shiftKey && active === last) || (event.shiftKey && active === first)) {
      event.preventDefault();
      focus(event.shiftKey ? last : first);
    }
  }, true);

  function captureChanged() {
    if (!document.pointerLockElement && !document.fullscreenElement && !captureStarting()) releaseDestination = null;
    refresh();
  }
  document.addEventListener('pointerlockchange', captureChanged);
  document.addEventListener('fullscreenchange', captureChanged);
  document.addEventListener('pointerlockerror', function () { captureDenied = true; refresh(); });
  if (typeof MutationObserver === 'function') {
    new MutationObserver(function () { refreshProgress(); }).observe(play, {
      childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['disabled']
    });
    var roster = document.getElementById('chars');
    if (roster) new MutationObserver(refreshProfile).observe(roster, {
      subtree: true, attributes: true, attributeFilter: ['class']
    });
  }
  if (typeof BC.on === 'function') {
    BC.on('worldWillReset', function () { enteredWorld = false; });
    ['worldReady', 'worldReset', 'worldBusyChanged', 'modeChanged', 'settingsChanged', 'respawn', 'death'].forEach(function (name) {
      BC.on(name, refresh, 40);
    });
    BC.on('netStatus', function (status) { lastNetStatus = status; refresh(); }, 40);
    BC.on('frame', function (dt, now) {
      if (screen !== 'game' && now - lastRefresh >= 400) { lastRefresh = now; refresh(); }
    }, 40);
  }

  buildPortraits();
  setSettingsTab(settingsTab, false);
  activate('home', false);
  refresh();
})();
