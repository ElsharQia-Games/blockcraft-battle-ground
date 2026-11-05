'use strict';

function menuStateProbe(expected) {
  const k = window.__bcTest, { b, check } = k, state = b.menus.state;
  const roots = ['hint', 'playSetupScreen', 'charactersScreen', 'onlineScreen', 'settingsMenu', 'pauseMenu'];
  const shown = roots.filter((id) => {
    const el = document.getElementById(id), style = getComputedStyle(el);
    return !el.hidden && !el.inert && style.display !== 'none' && style.visibility !== 'hidden';
  });
  const ids = { home: 'hint', play: 'playSetupScreen', characters: 'charactersScreen', online: 'onlineScreen',
    settings: 'settingsMenu', pause: 'pauseMenu' };
  check(state.screen === expected, 'Unexpected menu screen', { expected, state });
  check(shown.length === (expected === 'game' ? 0 : 1) && (expected === 'game' || shown[0] === ids[expected]),
    'Home, pages and Pause are visible at the same time', { expected, shown });
  for (const id of roots) {
    const el = document.getElementById(id);
    if (!shown.includes(id)) check(el.hidden && el.inert && el.getAttribute('aria-hidden') === 'true', 'Inactive menu stays focusable', id);
  }
  if (expected !== 'game') {
    check(!document.pointerLockElement && !k.api('isGameplayInputActive')(), 'A menu silently resumes gameplay', state);
    const root = document.getElementById(ids[expected]), rect = root.getBoundingClientRect();
    check(rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
      'Menu extends beyond the actual viewport', { expected, rect: rect.toJSON() });
    check(document.documentElement.scrollWidth <= innerWidth + 1, 'Menu needs horizontal scrolling');
  }
  if (expected === 'home') {
    // The lobby dims the world behind Home for readable text, but the world
    // must stay visible (translucent stops) and unblurred.
    const style = getComputedStyle(document.getElementById('hint'));
    const alphas = [...style.backgroundImage.matchAll(/rgba\(([^)]+)\)/g)].map((m) => Number(m[1].split(',')[3]));
    check(alphas.length >= 2 && Math.min(...alphas) < 0.75 && style.backdropFilter === 'none',
      'Home must keep the world visible behind a translucent, unblurred dimming layer', style.backgroundImage);
    // One primary action: Play and the brand are on screen without scrolling.
    const r = document.getElementById('play').getBoundingClientRect();
    check(r.width > 0 && r.top >= -1 && r.bottom <= innerHeight + 1, 'Home needs scrolling to reach Play', r.toJSON());
    check(!!document.getElementById('homeTitle').textContent.trim(), 'Home lost its title');
    check(document.querySelector('.ui-publisher')?.textContent.trim() === 'ElsharQia Games', 'Publisher label changed');
  }
  return { viewport: [innerWidth, innerHeight], state, shown, active: document.activeElement.id || document.activeElement.tagName };
}

function editPauseSettingsProbe() {
  const k = window.__bcTest, { b, check } = k;
  const slider = document.getElementById('bcWeaponSens-pistol-ads');
  check(slider && !slider.disabled, 'Per-weapon settings disappeared from the redesigned screen');
  slider.value = '0.73'; slider.dispatchEvent(new Event('input', { bubbles: true }));
  check(b.settings.getWeaponSensitivity('pistol', true) === 0.73, 'Settings edits do not reach the persistent store');
  check(b.menus.state.screen === 'settings' && b.menus.state.settingsReturn === 'pause' && !document.pointerLockElement,
    'Saving settings changes the pause origin or resumes', b.menus.state);
  return { ads: b.settings.getWeaponSensitivity('pistol', true), state: b.menus.state };
}

async function menuFlowProbe(lab, page) {
  const evidence = [];
  const escape = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
  for (const [width, height] of [[1280, 720], [1024, 600], [390, 740]]) {
    await page.viewport(width, height);
    await page.evaluate(() => window.__blockcraft.menus.showHome(true));
    const home = await page.evaluate(menuStateProbe, 'home');
    const shots = [await page.screenshot(`home-${width}x${height}`)];
    await page.click('#menuCharacters');
    const characters = await page.evaluate(menuStateProbe, 'characters');
    shots.push(await page.screenshot(`characters-menu-${width}x${height}`));
    await page.click('#charactersBack');
    await page.click('#menuSettings');
    const settings = await page.evaluate(menuStateProbe, 'settings');
    shots.push(await page.screenshot(`home-settings-${width}x${height}`));
    await page.click('#settingsBack');
    await page.evaluate(menuStateProbe, 'home');
    await page.play();
    await page.evaluate(menuStateProbe, 'game');
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...escape });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...escape });
    await page.wait('Escape opens the distinct normal pause screen', () => !document.pointerLockElement &&
      window.__blockcraft.menus.state.screen === 'pause' && !document.getElementById('pauseResume').disabled);
    const pause = await page.evaluate(menuStateProbe, 'pause');
    shots.push(await page.screenshot(`pause-${width}x${height}`));
    await page.click('#pauseSettings');
    const edited = await page.evaluate(editPauseSettingsProbe);
    shots.push(await page.screenshot(`pause-settings-${width}x${height}`));
    await page.click('#settingsBack');
    await page.evaluate(menuStateProbe, 'pause');
    await page.click('#pauseResume');
    await page.wait('Resume reacquires real gameplay input', () => window.__bcTest.api('isGameplayInputActive')() &&
      window.__blockcraft.menus.state.screen === 'game' && !window.__bcTest.api('gameplayKeyboardCapture').starting);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...escape });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...escape });
    await page.wait('pause ready again', () => window.__blockcraft.menus.state.screen === 'pause' && !document.pointerLockElement);
    await page.click('#pauseHome');
    const returned = await page.evaluate(menuStateProbe, 'home');
    evidence.push({ home, characters, settings, pause, edited, returned, screenshots: shots });
  }
  return evidence;
}

module.exports = { menuStateProbe, editPauseSettingsProbe, menuFlowProbe };
