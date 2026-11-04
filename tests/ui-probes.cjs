'use strict';

function menuProbe() {
  const { b, check } = window.__bcTest, menus = b.features.menus;
  check(menus, 'Dedicated Home/Pause controller is missing');
  const chars = [...document.querySelectorAll('#chars button')];
  check(chars.length === 16, 'Menu does not contain sixteen character choices');
  check(new Set(chars.map((el) => el.textContent)).size === 16, 'Duplicate character choices');
  const aimControls = [...document.querySelectorAll('#bcWeaponSensRows input[type="range"]')];
  check(aimControls.length === 14, 'Lobby does not offer hip/ADS controls for all seven weapons', aimControls.length);
  const rows = [];
  const measure = (el) => {
    check(!!el && !el.disabled, 'Missing/disabled menu control', el?.id);
    const ancestors = [];
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      ancestors.push({ parent, top: parent.scrollTop, left: parent.scrollLeft, overflowY: getComputedStyle(parent).overflowY });
    }
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const label = el.id || el.textContent;
    if (el.type === 'range') check(el.labels?.length > 0 && el.getAttribute('aria-label'), 'Weapon sensitivity slider has no readable label', label);
    check(r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1,
      'Control cannot fit/reach actual viewport after scrolling', { label, rect: r.toJSON(), width: innerWidth, height: innerHeight });
    check(el.contains(document.elementFromPoint(x, y)), 'Menu control is covered or clipped', label);
    for (const a of ancestors) {
      if (a.parent.scrollTop !== a.top) check(['auto', 'scroll'].includes(a.overflowY), 'Control requires scrolling a user-inaccessible hidden container', { label, parent: a.parent.id, overflow: a.overflowY });
      check(a.parent.scrollLeft === a.left, 'Menu requires horizontal scrolling', label);
    }
    rows.push({ screen: menus.state.screen, label, rect: r.toJSON() });
  };
  const open = (page) => {
    menus.showHome(true);
    const nav = document.querySelector('#hint [data-menu-open="' + page + '"]');
    check(nav, 'Missing Home navigation page', page);
    nav.click();
    check(menus.state.screen === page, 'Home navigation did not open its own screen', { page, state: menus.state });
  };
  const widthCheck = () => {
    const rootIds = { home: 'hint', play: 'playSetupScreen', characters: 'charactersScreen', online: 'onlineScreen', settings: 'settingsMenu' };
    const root = document.getElementById(rootIds[menus.state.screen]);
    for (const el of [document.documentElement, document.body, root]) {
      check(el && el.scrollWidth <= el.clientWidth + 1, 'Horizontal menu overflow',
        { id: el?.id || el?.tagName, scroll: el?.scrollWidth, client: el?.clientWidth });
    }
  };
  const room = document.getElementById('roomInput'), oldRoom = room.value;
  const weaponSelect = document.getElementById('bcWeaponSelect'), oldWeapon = weaponSelect?.value;
  try {
    menus.showHome(true);
    for (const id of ['play', 'menuPlaySetup', 'menuCharacters', 'menuOnline', 'menuSettings']) measure(document.getElementById(id));
    widthCheck();
    open('characters');
    for (const el of [...chars, document.getElementById('nameInput'), document.getElementById('charactersBack')]) measure(el);
    widthCheck();
    open('online');
    // Reach/validation fixture only; never click Join/Create or contact brokers.
    room.value = 'UI-CHECK'; room.dispatchEvent(new Event('input', { bubbles: true }));
    for (const id of ['roomInput', 'onlineBtn', 'createBtn', 'onlineBack']) measure(document.getElementById(id));
    widthCheck();
    open('play');
    for (const el of document.querySelectorAll('#playSetupScreen button:not([disabled])')) measure(el);
    widthCheck();
    open('settings');
    for (const tab of document.querySelectorAll('[data-settings-tab]')) {
      tab.click(); measure(tab);
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      check(!panel.hidden && !panel.inert && tab.getAttribute('aria-selected') === 'true', 'Settings tab is not accessible/selected', tab.id);
      for (const el of panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])')) {
        if (!el.closest('[hidden], [inert], #bcWeaponSensRows')) measure(el);
      }
      if (panel.id === 'settingsAim') {
        check(weaponSelect?.options.length === 7, 'Aim settings must offer all seven weapons');
        // Only the selected weapon's two sliders are displayed. Exercise the
        // actual selector rather than measuring fourteen intentionally hidden
        // controls as if they belonged to a single expanded panel.
        for (const option of weaponSelect.options) {
          weaponSelect.value = option.value;
          weaponSelect.dispatchEvent(new Event('change', { bubbles: true }));
          const groups = [...panel.querySelectorAll('.bcs-weapon-row')];
          const shown = groups.filter((group) => !group.hidden && !group.inert);
          check(shown.length === 1 && shown[0].dataset.weapon === option.value,
            'Weapon selector did not expose exactly the requested aim controls', option.value);
          for (const el of shown[0].querySelectorAll('input[type="range"]')) measure(el);
        }
      }
      widthCheck();
    }
    measure(document.getElementById('settingsBack')); measure(document.getElementById('settingsDone'));
    menus.closeSettings();
    check(menus.state.screen === 'home' && !document.pointerLockElement, 'Settings Back resumed gameplay or opened Pause from Home');
    return { viewport: [innerWidth, innerHeight], names: b.CHAR_KEYS.map((key) => b.CHARACTERS[key].name), controls: rows,
      separateScreens: true, settingsBackPaused: true };
  } finally {
    if (weaponSelect) {
      weaponSelect.value = oldWeapon;
      weaponSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    room.value = oldRoom; room.dispatchEvent(new Event('input', { bubbles: true })); menus.showHome(true);
  }
}

function hudProbe() {
  const { check } = window.__bcTest;
  const visible = (el) => {
    if (!el || el.getBoundingClientRect().width === 0) return false;
    let opacity = 1;
    for (let p = el; p; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      opacity *= Number(style.opacity);
    }
    return opacity > 0.025;
  };
  const build = document.getElementById('buildHud');
  check(visible(build), 'Active quick-building HUD is not visible');
  const rect = build.getBoundingClientRect();
  check(rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1, 'Build HUD extends outside viewport', rect.toJSON());
  const critical = ['healthWrap', 'weaponHud', 'hotbar', 'crosshair', 'roomBadge', 'stats', 'killfeed'];
  const rows = [];
  for (const id of critical) {
    const el = document.getElementById(id);
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const overlapX = Math.max(0, Math.min(rect.right, r.right) - Math.max(rect.left, r.left));
    const overlapY = Math.max(0, Math.min(rect.bottom, r.bottom) - Math.max(rect.top, r.top));
    check(overlapX * overlapY <= 1, 'Build HUD overlaps critical HUD', { id, build: rect.toJSON(), critical: r.toJSON(), overlapX, overlapY });
    rows.push({ id, rect: r.toJSON(), overlap: overlapX * overlapY });
  }
  check(document.documentElement.scrollWidth <= innerWidth + 1, 'Horizontal gameplay overflow');
  return { viewport: [innerWidth, innerHeight], build: rect.toJSON(), critical: rows };
}

module.exports = { menuProbe, hudProbe };
