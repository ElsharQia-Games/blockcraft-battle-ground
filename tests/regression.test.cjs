'use strict';

// Preparation entry point. Run after integration, or select a group with
// Node's --test-name-pattern. Only test:syntax is used during preparation.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { Lab } = require('./harness.cjs');
const { ROSTER, bootProbe, rosterProbe, rosterGallery, critterProbe, dragonProbe } = require('./scene-probes.cjs');
const { WEAPONS, weaponProbe, hipfireProbe, scopeProbe } = require('./combat-probes.cjs');
const { movementProbe, inputReleaseProbe } = require('./movement-probes.cjs');
const { installBuildHelpers, buildingProbe, buildingInputProbe, singleBlockAndCraftProbe } = require('./building-probes.cjs');
const { menuProbe, hudProbe } = require('./ui-probes.cjs');
const { lanProbe } = require('./lan-probes.cjs');
const { outlineProbe, destructionProbe } = require('./upgrade-probes.cjs');
const { shortcutProbe, scoreboardRows } = require('./input-ui-probes.cjs');

let lab;
before(async () => { lab = new Lab(); await lab.start(); }, { timeout: 70_000 });
after(async () => { if (lab) await lab.close(); }, { timeout: 100_000 });

async function pageCase(t, label, run, options = {}) {
  const page = await lab.page(label, options);
  t.after(() => page.close());
  try {
    if (options.play) await page.play();
    const value = await run(page);
    lab.record(label, value);
    page.assertHealthy();
    return value;
  } catch (error) {
    lab.record(label, { error: error.stack });
    const screenshot = await page.screenshot(label + '-failure').catch(() => null);
    if (screenshot) t.diagnostic(`Failure screenshot: ${screenshot}`);
    throw error;
  } finally { await page.close(); }
}

test('boot: file:// and HTTP classic scripts, API surface and population parity', { timeout: 240_000 }, async (t) => {
  const file = await pageCase(t, 'boot-file', (page) => page.evaluate(bootProbe), { base: lab.fileURL });
  const http = await pageCase(t, 'boot-http', (page) => page.evaluate(bootProbe), { base: lab.httpURL });
  assert.equal(file.protocol, 'file:');
  assert.equal(http.protocol, 'http:');
  assert.deepEqual(file.population, http.population, 'Boot protocol changed village/chicken/tree population');
  assert.deepEqual(file.roster, http.roster, 'Boot protocol changed the roster');
  for (const result of [file, http]) {
    assert.deepEqual([...result.roster].sort(), [...ROSTER].sort());
    for (const api of ['updatePlayer', 'resetPlayerMotion', 'quickBuild', 'selectBuildPiece', 'rotateBuildPiece', 'placeQuickBuild',
      'cancelQuickBuild', 'updateBuilding', 'resetBuildingInput', 'dragons', 'spawnDragons', 'updateDragons']) {
      assert.ok(result.api.includes(api), `window.__blockcraft does not expose ${api}`);
    }
  }
  if (process.env.BC_BASE) await pageCase(t, 'boot-BC_BASE', (page) => page.evaluate(bootProbe), { base: lab.baseURL });
  t.diagnostic(`World population: ${JSON.stringify(http.population)}`);
});

test('roster: all sixteen skeletons, atlas tiles, custom attachments and cycling', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'roster', async (page) => {
    const result = await page.evaluate(rosterProbe, ROSTER);
    const gallery = await lab.image('roster-human-review', await page.evaluate(rosterGallery, ROSTER));
    t.diagnostic(`Character gallery (human review): ${gallery}`);
    return { result, gallery };
  });
});

test('NPC: actual Fayoum forward travel, MJ backwards travel, phase and restored counts', { timeout: 120_000 }, async (t) => {
  await pageCase(t, 'NPC', (page) => page.evaluate(critterProbe));
});

test('dragons: integrated spawn, moving wings/paths, finite models and idempotent resources', { timeout: 120_000 }, async (t) => {
  await pageCase(t, 'dragons', async (page) => {
    const result = await page.evaluate(dragonProbe);
    const screenshot = await page.screenshot('dragons-world');
    return { ...result, screenshot };
  });
});

test('outlines: character factories add depth-tested strokes without duplicate resource growth', { timeout: 120_000 }, async (t) => {
  await pageCase(t, 'outlines', (page) => page.evaluate(outlineProbe));
});

test('destruction: real bullets, material resistance, multiple hits and protected world floor', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'destruction', (page) => page.evaluate(destructionProbe), { play: true });
});

test('combat: seven weapons, real ammo consumption, reload articulation and clean interruptions', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'combat-weapons', (page) => page.evaluate(weaponProbe, WEAPONS), { play: true });
});

test('combat: hipfire muzzle follows pitch and all yaw quadrants without aiming', { timeout: 120_000 }, async (t) => {
  await pageCase(t, 'combat-hipfire', (page) => page.evaluate(hipfireProbe), { play: true });
});

test('scope: revised shoulder/eye cameras, per-weapon optics and clearing transitions', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'scope', async (page) => {
    const result = await page.evaluate(scopeProbe);
    await page.evaluate(() => {
      const b = window.__blockcraft;
      b.gun.aiming = true;
      b.updateCombat(1 / 60, performance.now()); b.updateCamera(1 / 60);
    });
    await page.wait('scope active before actual pause', () => window.__bcTest.api('isScopeActive')());
    await page.evaluate(() => document.exitPointerLock());
    await page.wait('pause clears aiming and scope overlay', () => {
      const b = window.__blockcraft;
      return !document.pointerLockElement && !b.gun.aiming && !window.__bcTest.api('isScopeActive')() && !document.body.classList.contains('scoped');
    });
    return { ...result, pauseCleared: true };
  }, { play: true });
});

test('movement: integrated timestep, coyote/buffer, Ctrl edges, collisions and Space/Shift/F/V', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'movement', (page) => page.evaluate(movementProbe), { play: true });
});

test('building: unlimited placement, real crafting inventory, illegal transactions and rotation', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'building', async (page) => {
    await page.evaluate(installBuildHelpers);
    const quickBuild = await page.evaluate(buildingProbe);
    const singleBlockAndCraft = await page.evaluate(singleBlockAndCraftProbe);
    return { quickBuild, singleBlockAndCraft };
  }, { play: true });
});

test('input: text focus, inventory and blur release real gameplay/build holds', { timeout: 180_000 }, async (t) => {
  await pageCase(t, 'input-release', async (page) => {
    await page.evaluate(installBuildHelpers);
    const results = [];
    for (const reason of ['focus', 'inventory', 'blur']) {
      await page.lock();
      results.push(await page.evaluate(inputReleaseProbe, reason));
      await page.wait('input event unlocked pointer', () => !document.pointerLockElement);
      await page.lock();
      results.push(await page.evaluate(buildingInputProbe, reason));
      await page.wait('build release unlocked pointer', () => !document.pointerLockElement);
    }
    await page.lock();
    results.push(await page.evaluate(buildingInputProbe, 'reset'));
    return results;
  }, { play: true });
});

test('input UI: Tab scoreboard hold/release, focus safety and cancellable Ctrl shortcuts', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'input-UI', async (page) => {
    const activeShortcuts = await page.evaluate(shortcutProbe, 'game');
    await page.wait('text focus released pointer capture', () => !document.pointerLockElement);
    await page.lock();
    const focus = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
    await page.evaluate(() => {
      window.__tabMenuFallbacks = 0;
      document.addEventListener('keydown', (event) => {
        if (event.code === 'Tab') window.__tabMenuFallbacks++;
      }, true);
    });
    const tab = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 };
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...tab });
    await page.wait('Tab holds scoreboard open', () => document.getElementById('scoreboard').classList.contains('show'));
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', autoRepeat: true, ...tab });
    assert.equal(await page.evaluate(() => document.activeElement.id || document.activeElement.tagName), focus, 'Tab cycled focus during gameplay');
    assert.deepEqual(await page.evaluate(() => ({
      fallback: window.__tabMenuFallbacks,
      menuHidden: document.getElementById('hint').classList.contains('hidden'),
      menuInert: document.getElementById('hint').inert,
      crafting: window.__bcTest.api('craftOpen')
    })), { fallback: 0, menuHidden: true, menuInert: true, crafting: false }, 'Tab leaked into the settings/menu path');
    const scoreboard = await page.evaluate(scoreboardRows);
    const screenshot = await page.screenshot('scoreboard-local');
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...tab });
    await page.wait('Tab release hides scoreboard', () => !document.getElementById('scoreboard').classList.contains('show'));
    await page.evaluate(() => window.__bcTest.api('setScoreboardVisible')(true));
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.wait('blur unlocks and hides scoreboard', () => !document.pointerLockElement && !document.getElementById('scoreboard').classList.contains('show'));
    await page.lock();
    await page.evaluate(() => window.__bcTest.api('setScoreboardVisible')(true));
    await page.evaluate(() => document.exitPointerLock());
    await page.wait('unlock hides scoreboard', () => !document.pointerLockElement && !document.getElementById('scoreboard').classList.contains('show'));
    const pausedShortcuts = await page.evaluate(shortcutProbe, 'paused');
    return { activeShortcuts, pausedShortcuts, scoreboard, screenshot };
  }, { play: true });
});

test('UI: real 1024×600 / 1280×720 / 390×740 viewports, reachable controls and HUD separation', { timeout: 180_000 }, async (t) => {
  await pageCase(t, 'UI', async (page) => {
    const results = [];
    for (const [width, height] of [[1024, 600], [1280, 720], [390, 740]]) {
      await page.viewport(width, height);
      const menu = await page.evaluate(menuProbe);
      await page.evaluate(() => document.querySelector('#hint h1').scrollIntoView({ block: 'start', behavior: 'instant' }));
      const top = await page.screenshot(`menu-${width}x${height}-top`);
      await page.evaluate(() => document.getElementById('play').scrollIntoView({ block: 'center', behavior: 'instant' }));
      const bottom = await page.screenshot(`menu-${width}x${height}-bottom`);
      await page.play();
      await page.evaluate(() => {
        const k = window.__bcTest;
        k.b.setCombatMode(true);
        k.check(k.api('selectBuildPiece')('wall'), 'Blueprint input was not ready after entering play');
        k.api('updateBuilding')(1 / 60);
      });
      await page.wait('HUD transition visible', () => Number(getComputedStyle(document.getElementById('hud')).opacity) > 0.95);
      const hud = await page.evaluate(hudProbe);
      const hudImage = await page.screenshot(`build-HUD-${width}x${height}`);
      await page.evaluate(() => window.__bcTest.api('cancelQuickBuild')());
      const optics = [], images = [top, bottom, hudImage];
      // All seven real optics at desktop; representative optics also at both
      // constrained viewports. Each normal/scope image remains available for review.
      for (const index of width === 1280 ? [0, 1, 2, 3, 4, 5, 6] : [0]) {
        const weapon = await page.evaluate((index) => {
          const b = window.__blockcraft;
          b.selectWeapon(index); b.thirdPerson = false;
          return { id: b.WEAPONS[index].id, optic: b.WEAPONS[index].optic };
        }, index);
        await page.wait('normal hip crosshair visible', () => {
          const k = window.__bcTest, b = k.b;
          const s = getComputedStyle(document.getElementById('crosshair'));
          return !k.api('isScopeActive')() && k.api('viewGun').visible && b.camera.position.distanceTo(b.player.pos.clone().add(new b.THREE.Vector3(0, 1.62, 0))) < 0.06 &&
            s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.1;
        });
        images.push(await page.screenshot(`normal-${weapon.id}-${width}x${height}`));
        // Real RMB exercises the input route into optics, not just a DOM class.
        await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'right', clickCount: 1, x: width / 2, y: height / 2 });
        await page.wait('RMB optics visibly rendered', (optic) => {
          const el = document.getElementById('scopeOverlay');
          return window.__bcTest.api('isScopeActive')() && el?.dataset.optic === optic && getComputedStyle(el).display !== 'none' && Number(getComputedStyle(el).opacity) > 0.95;
        }, weapon.optic);
        const measured = await page.evaluate(() => {
          const k = window.__bcTest, el = document.getElementById('scopeOverlay'), rect = el.getBoundingClientRect();
          k.check(Math.abs(rect.x + rect.width / 2 - innerWidth / 2) < 1 && Math.abs(rect.y + rect.height / 2 - innerHeight / 2) < 1,
            'Optics overlay is not viewport-centered', rect.toJSON());
          const hip = getComputedStyle(document.getElementById('crosshair'));
          k.check(hip.display === 'none' || hip.visibility === 'hidden' || Number(hip.opacity) < 0.01, 'Hip crosshair doubles over the scoped reticle');
          return { rect: rect.toJSON(), optic: el.dataset.optic, weapon: document.getElementById('scopeWeapon').textContent, zoom: document.getElementById('scopeZoom').textContent };
        });
        optics.push(measured);
        images.push(await page.screenshot(`scope-${weapon.id}-${width}x${height}`));
        await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'right', clickCount: 1, x: width / 2, y: height / 2 });
        await page.wait('RMB release clears optics', () => !window.__bcTest.api('isScopeActive')() && !document.body.classList.contains('scoped'));
      }
      results.push({ menu, hud, optics, screenshots: images });
      await page.evaluate(() => document.exitPointerLock());
      await page.wait('return to menu', () => !document.pointerLockElement && !document.getElementById('hint').classList.contains('hidden'));
    }
    return results;
  });
});

test('LAN: state sync, aimed kill/respawn, scores and late-join build/destruction history', { timeout: 300_000 }, async (t) => {
  try { lab.record('LAN', await lanProbe(lab, t)); }
  catch (error) { lab.record('LAN', { error: error.stack }); throw error; }
});
