'use strict';

// Isolated gameplay verification. Node's --test-name-pattern selects a group;
// the user has approved browser/server checks for the corrective upgrade.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { before, after, test } = require('node:test');
const { Lab } = require('./harness.cjs');
const { ROSTER, bootProbe, rosterProbe, rosterGallery, critterProbe, dragonProbe } = require('./scene-probes.cjs');
const { WEAPONS, weaponProbe, hipfireProbe, scopeProbe } = require('./combat-probes.cjs');
const { movementProbe, inputReleaseProbe } = require('./movement-probes.cjs');
const { installBuildHelpers, buildingProbe, buildingInputProbe, singleBlockProbe } = require('./building-probes.cjs');
const { menuProbe, hudProbe } = require('./ui-probes.cjs');
const { lanProbe } = require('./lan-probes.cjs');
const { multiplayerUpgradeProbe } = require('./multiplayer-upgrade.cjs');
const { outlineProbe, destructionProbe } = require('./upgrade-probes.cjs');
const { shortcutProbe, scoreboardRows } = require('./input-ui-probes.cjs');
const { weaponSensitivityProbe, kneeProbe, stanceGallery, diagnosticsProbe, npcPhysicsProbe, minimapProbe,
  resetHoldProbe, remotePlacementProbe, lifecycleCleanupProbe, fpsClockProbe } = require('./corrective-probes.cjs');
const { audioProbe, remoteJetpackProbe, weaponHandlingProbe } = require('./media-motion-probes.cjs');
const { menuFlowProbe } = require('./menu-probes.cjs');
const { jumpAndWaterProbe, mouseStreamProbe } = require('./movement-corrections.cjs');
const { solidDragonProbe, ridingProbe } = require('./dragon-probes.cjs');

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
    const state = await page.evaluate(() => {
      const b = window.__blockcraft;
      return b ? { player: { position: b.player.pos.toArray(), yaw: b.player.yaw, pitch: b.player.pitch },
        camera: { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray(), fov: b.camera.fov },
        avatarVisible: b.localAvatar()?.visible, mode: b.modes.active, seed: b.seed,
        online: b.net.online, generation: b.net.generation, hud: b.hud.state, minimap: b.minimap.state } : null;
    }).catch(() => null);
    lab.record(label, { error: error.stack, state });
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
    assert.equal(result.dragonClasses.total, result.dragonClasses.expected);
    assert.equal(result.dragonClasses.guardians, 4);
    assert.ok(result.dragonClasses.mounts >= 2 && result.dragonClasses.mounts <= 3);
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

test('corrective anatomy: all sixteen forward knee joints, planted crouch/slide feet and neutral recovery', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'corrective-knees', async (page) => {
    const result = await page.evaluate(kneeProbe, ROSTER);
    const galleries = [];
    for (const phase of ['standing', 'crouch', 'slide']) {
      galleries.push(await lab.image(`knees-${phase}-human-review`, await page.evaluate(stanceGallery, { keys: ROSTER, phase })));
    }
    t.diagnostic(`Stance galleries (human review): ${galleries.join(', ')}`);
    return { result, galleries };
  });
});

test('corrective settings: per-weapon hip/ADS mouse gains, defensive settings and persistence after reload', { timeout: 240_000 }, async (t) => {
  await pageCase(t, 'corrective-sensitivity', async (page) => {
    const result = await page.evaluate(weaponSensitivityProbe);
    await page.evaluate(() => {
      const settings = window.__blockcraft.settings;
      settings.setWeaponSensitivity('pistol', 'hip', 0.71);
      settings.setWeaponSensitivity('pistol', 'ads', 1.33);
    });
    await page.send('Page.reload');
    const persisted = await page.wait('per-weapon settings survive an actual page reload', () => {
      const b = window.__blockcraft;
      if (!b || document.getElementById('play').disabled) return false;
      const settings = b.settings;
      return settings.getWeaponSensitivity('pistol', false) === 0.71 && settings.getWeaponSensitivity('pistol', true) === 1.33
        ? { hip: settings.getWeaponSensitivity('pistol', false), ads: settings.getWeaponSensitivity('pistol', true) } : false;
    }, undefined, { timeout: 90_000, interval: 200 });
    return { ...result, reloaded: persisted };
  }, { play: true });
});

test('corrective HUD: measured FPS/live ping readability and separation at desktop and narrow sizes', { timeout: 180_000 }, async (t) => {
  await pageCase(t, 'corrective-readouts', async (page) => {
    await page.wait('measured FPS ready', () => window.__blockcraft.hud.state.fps > 0);
    const rows = [];
    for (const [width, height] of [[1280, 720], [1024, 600], [390, 740]]) {
      await page.viewport(width, height);
      const result = await page.evaluate(diagnosticsProbe);
      const screenshot = await page.screenshot(`readable-HUD-${width}x${height}`);
      rows.push({ ...result, screenshot });
    }
    return rows;
  }, { play: true });
});

test('corrective mechanics: NPC swept walls/gravity/water and genuinely cached topographic minimap', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'corrective-physics-map', async (page) => {
    const minimap = await page.evaluate(minimapProbe);
    const physics = await page.evaluate(npcPhysicsProbe);
    return { minimap, physics };
  }, { play: true });
});

test('corrective lifecycle: external resets release held building, remote bodies are protected and death fixtures clean up', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'corrective-lifecycle', async (page) => {
    const holds = await page.evaluate(resetHoldProbe);
    const placement = await page.evaluate(remotePlacementProbe);
    const lifecycle = await page.evaluate(lifecycleCleanupProbe);
    const fpsClock = await page.evaluate(fpsClockProbe);
    return { holds, placement, lifecycle, fpsClock };
  }, { play: true });
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

test('dragon bodies: solid swept guardians/mounts, invulnerability and blocked bullet/build/mining rays', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'solid-dragons', (page) => page.evaluate(solidDragonProbe), { play: true });
});

test('dragon riding: every small mount, core/camera collisions, C/Space/boost, heat and 30-second limit', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'riding', (page) => page.evaluate(ridingProbe), { play: true });
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

test('weapon identity: real ADS transitions, bloom/recovery, mechanisms and legal long-range damage', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'weapon-handling', (page) => page.evaluate(weaponHandlingProbe), { play: true });
});

test('audio: seven verified CC0 payloads, file-safe decode, unique reports and bounded directional voices', { timeout: 150_000 }, async (t) => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'audio', 'weapon-samples.js'), 'utf8'), context);
  const entries = context.window.BCWeaponSamples.entries;
  assert.deepEqual(Object.keys(entries).sort(), [...WEAPONS].sort());
  for (const [id, entry] of Object.entries(entries)) {
    assert.equal(crypto.createHash('sha256').update(Buffer.from(entry.base64, 'base64')).digest('hex'), entry.sha256, `${id} embedded payload hash`);
  }
  await pageCase(t, 'audio-file', async (page) => {
    await page.evaluate(async () => {
      const b = window.__blockcraft;
      b.settings.set('muted', false); await b.audio.resume();
    });
    await page.wait('all seven embedded samples decoded once', () => window.__blockcraft.audio.stats().sampledWeapons === 7,
      undefined, { timeout: 20_000 });
    return page.evaluate(audioProbe);
  }, { base: lab.fileURL, play: true });
});

test('jetpack: independent remote visuals, private flames and safe shared-resource disposal', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'remote-jetpacks', (page) => page.evaluate(remoteJetpackProbe));
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

test('movement: integrated timestep, C or Ctrl crouch/slide, K character change, collisions and jetpack controls', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'movement', (page) => page.evaluate(movementProbe), { play: true });
});

test('movement corrections: higher tap/hold jump at 30/60/120 FPS, shore escape, roof clearance and diving', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'jump-water', (page) => page.evaluate(jumpAndWaterProbe), { play: true });
});

test('mouse: capture/resume warp rejection, finite input, epoch resets and unrestricted steady flicks', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'mouse-stream', (page) => page.evaluate(mouseStreamProbe), { play: true });
});

test('building: unlimited placement, material cycling, removed crafting, illegal transactions and rotation', { timeout: 150_000 }, async (t) => {
  await pageCase(t, 'building', async (page) => {
    await page.evaluate(installBuildHelpers);
    const quickBuild = await page.evaluate(buildingProbe);
    const singleBlock = await page.evaluate(singleBlockProbe);
    return { quickBuild, singleBlock };
  }, { play: true });
});

test('input: text focus, normal Pause and blur release real gameplay/build holds', { timeout: 180_000 }, async (t) => {
  await pageCase(t, 'input-release', async (page) => {
    await page.evaluate(installBuildHelpers);
    const results = [];
    for (const reason of ['focus', 'pause', 'blur']) {
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
      await page.evaluate(() => window.__blockcraft.menus.showHome(true));
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
      await page.wait('build HUD context and transition visible', () =>
        window.__blockcraft.hud.state.layout === 'build' &&
        Number(getComputedStyle(document.getElementById('hud')).opacity) > 0.95);
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
      await page.wait('return to normal pause menu', () => !document.pointerLockElement &&
        window.__blockcraft.menus.state.screen === 'pause' && !document.getElementById('pauseMenu').hidden);
    }
    return results;
  });
});

test('menus: separate Home/pages/Pause, persistent settings Back, Escape and trusted Resume at three sizes', { timeout: 180_000 }, async (t) => {
  await pageCase(t, 'menu-flows', (page) => menuFlowProbe(lab, page));
});

test('LAN: state sync, aimed kill/respawn, scores and late-join build/destruction history', { timeout: 300_000 }, async (t) => {
  try { lab.record('LAN', await lanProbe(lab, t)); }
  catch (error) { lab.record('LAN', { error: error.stack }); throw error; }
});

test('LAN upgrade: host-only modes/seed zero, same-seed generations, legal edit bursts and concurrent reconciliation', { timeout: 480_000 }, async (t) => {
  try { lab.record('LAN-upgrade', await multiplayerUpgradeProbe(lab, t)); }
  catch (error) { lab.record('LAN-upgrade', { error: error.stack }); throw error; }
});
