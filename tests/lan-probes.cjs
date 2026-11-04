'use strict';

const assert = require('node:assert/strict');
const { installBuildHelpers } = require('./building-probes.cjs');
const { waitFor } = require('./harness.cjs');

function online() {
  const b = window.__blockcraft;
  return b.net.online && b.net.mode === 'ws' && b.net.id ? { id: b.net.id, mode: b.net.mode } : false;
}

function peer({ id, character, weapon }) {
  const k = window.__bcTest, r = k.b.net.players.get(id);
  if (!r || (character && r.character !== character) || (weapon && r.weapon !== weapon)) return false;
  return { id: r.id, character: r.character, weapon: r.weapon, key: r.group.userData.key, model: k.model(r.group) };
}

function setIdentity({ name, character }) {
  const b = window.__blockcraft, input = document.getElementById('nameInput');
  input.value = name; input.dispatchEvent(new Event('input', { bubbles: true }));
  b.setCharacter(character);
}

function remoteReload(id) {
  const k = window.__bcTest, r = k.b.net.players.get(id);
  if (!r) return null;
  return { reload: r.reload, pose: k.pose(r.group.userData.gun), keys: Object.keys(r) };
}

function aimAndFire(id) {
  const k = window.__bcTest, { b, check } = k, r = b.net.players.get(id);
  check(r && r.hp > 0, 'No living real peer to aim at');
  b.updateCamera(1 / 60);
  const target = new b.THREE.Vector3(r.x, r.y + 1.05, r.z);
  const direction = target.sub(b.camera.position).normalize();
  b.player.yaw = Math.atan2(-direction.x, -direction.z);
  b.player.pitch = Math.asin(direction.y);
  b.gun.aiming = true;
  b.gun.trigger = false;
  b.updateCamera(1 / 60);
  for (let i = 0; i < 25; i++) b.updateAvatar(1 / 120);
  b.scene.updateMatrixWorld(true);
  const before = b.gun.ammo[b.gun.index];
  check(before > 0, 'Aiming test exhausted its real magazine');
  b.fireOnce(); // This invokes raycastVoxel -> raycastRemote -> netSend(hit).
  check(b.gun.ammo[b.gun.index] === before - 1, 'Aimed shot did not fire');
  return { ammo: b.gun.ammo[b.gun.index], direction: direction.toArray(), target: id, weapon: b.WEAPONS[b.gun.index].id };
}

function teamView(ids) {
  const api = window.__bcTest.b.BC.api.net;
  return { host: api.isHost, teams: ids.map((id) => api.teamFor(id)) };
}

function teamsMatch(args) {
  const view = window.__bcTest.b.BC.api.net;
  return args.ids.every((id, i) => view.teamFor(id) === args.expected[i]);
}

// Every client must agree on every team (they used to derive teams from their
// own roster views), a player can switch themself, and the host can move others.
async function teamSwitchProbe(pages, ids) {
  const views = await Promise.all(pages.map((p) => p.evaluate(teamView, ids)));
  const initial = views[0].teams;
  assert.ok(initial.every((team) => team === 'red' || team === 'blue'), 'A player has no team: ' + initial);
  for (const view of views) assert.deepEqual(view.teams, initial, 'Clients disagree about teams');
  assert.ok(initial.includes('red') && initial.includes('blue'), 'Teams were not balanced: ' + initial);
  const hostIndex = views.findIndex((v) => v.host);
  assert.ok(hostIndex >= 0, 'No client reports being the host');
  const mover = (hostIndex + 1) % pages.length;
  const flip = (team) => (team === 'red' ? 'blue' : 'red');
  const switched = initial.slice(); switched[mover] = flip(initial[mover]);
  await pages[mover].evaluate((target) => window.__bcTest.b.BC.api.net.requestTeam(null, target), switched[mover]);
  for (const p of pages) await p.wait('self team switch replicated', teamsMatch, { ids, expected: switched });
  const back = switched.slice(); back[mover] = initial[mover];
  await pages[hostIndex].evaluate((args) => window.__bcTest.b.BC.api.net.requestTeam(args.id, args.team),
    { id: ids[mover], team: back[mover] });
  for (const p of pages) await p.wait('host team move replicated', teamsMatch, { ids, expected: back });
  return { initial, switched, back, host: ids[hostIndex] };
}

async function lanProbe(lab, t) {
  const A = await lab.page('LAN-A', { base: lab.httpURL, solo: false, width: 1024, height: 600 });
  t.after(() => A.close());
  const B = await lab.page('LAN-B', { base: lab.httpURL, solo: false, width: 1024, height: 600 });
  t.after(() => B.close());
  const [a, b] = await Promise.all([A.wait('LAN welcome', online), B.wait('LAN welcome', online)]);
  await A.lock();
  assert.notEqual(a.id, b.id, 'Independent browser contexts received the same LAN identity');
  await Promise.all([A.evaluate(setIdentity, { name: 'BC-Alpha', character: 'kratos' }), B.evaluate(setIdentity, { name: 'BC-Bravo', character: 'mj' })]);
  await Promise.all([A.wait('sees Bravo', peer, { id: b.id, character: 'mj' }), B.wait('sees Alpha', peer, { id: a.id, character: 'kratos' })]);

  const identities = [];
  for (const character of ['kratos', 'leon', 'mj']) {
    await A.evaluate((key) => window.__blockcraft.setCharacter(key), character);
    const seen = await B.wait('new character replicated', peer, { id: a.id, character });
    assert.equal(seen.key, character, 'Remote identity label changed without rebuilding its actual avatar');
    identities.push(seen);
  }
  await A.evaluate(() => {
    const b = window.__blockcraft;
    b.setCharacter('kratos');
    b.setCombatMode(true);
    b.selectWeapon(b.WEAPONS.findIndex((w) => w.id === 'lmg'));
  });
  await B.wait('new weapon replicated', peer, { id: a.id, character: 'kratos', weapon: 'lmg' });

  const idle = await B.evaluate(remoteReload, a.id);
  await A.evaluate(() => {
    const b = window.__blockcraft;
    b.gun.ammo[b.gun.index] = b.WEAPONS[b.gun.index].mag - 2;
    b.startReload();
    window.__bcTest.check(b.gun.reloading > 0, 'LAN reload did not start');
  });
  const activeReload = await B.wait('reload state AND component motion replicated', ({ id, idle }) => {
    const k = window.__bcTest, r = k.b.net.players.get(id);
    if (!r) return false;
    const motion = k.poseDistance(idle.pose, k.pose(r.group.userData.gun));
    return r.reload >= 0 && motion > 0.002 ? { reload: r.reload, motion, keys: Object.keys(r) } : false;
  }, { id: a.id, idle });
  await B.wait('remote reload completed and components restored', ({ id, idle }) => {
    const k = window.__bcTest, r = k.b.net.players.get(id);
    if (!r) return false;
    // Receipt timestamps advance with state packets even when the reload is idle.
    return r.reload < 0 && k.poseDistance(idle.pose, k.pose(r.group.userData.gun)) < 0.002;
  }, { id: a.id, idle }, { timeout: 12_000 });
  await A.evaluate(() => window.__blockcraft.setCombatMode(false));
  await B.wait('remote build/combat state hides held gun', (id) => window.__blockcraft.net.players.get(id)?.group.userData.gun?.visible === false, a.id);
  await A.evaluate(() => window.__blockcraft.setCombatMode(true));
  await B.wait('remote combat state restores held gun', (id) => window.__blockcraft.net.players.get(id)?.group.userData.gun?.visible === true, a.id);

  // The hardened server no longer grants arbitrary teleports to `fly` poses.
  // Set up a supported arena while paused, then move in bounded, acknowledged
  // steps. Never disable server validation or depend on unlimited hover fuel.
  await A.evaluate(() => window.__blockcraft.menus.showPause());
  await A.wait('fight fixture paused before moving', () => !window.__bcTest.api('isGameplayInputActive')());
  const setupFighter = async (page, observer, id, z) => {
    const route = await page.evaluate((z) => {
      const k = window.__bcTest, { b } = k, site = k.pad({ radius: 8 });
      k.resetKeys(); b.setCombatMode(true); b.thirdPerson = false;
      b.player.fly = false; b.player.vel.set(0, 0, 0);
      return { start: b.player.pos.toArray(), target: [128, site.y + 0.001, z] };
    }, z);
    const distance = route.target.reduce((total, n, i) => total + Math.abs(n - route.start[i]), 0);
    const steps = Math.max(1, Math.ceil(distance / 12));
    for (let step = 1; step <= steps; step++) {
      const position = route.target.map((n, i) => route.start[i] + (n - route.start[i]) * step / steps);
      await page.evaluate(({ position, grounded }) => {
        const k = window.__bcTest, { b, check } = k;
        b.player.pos.fromArray(position); b.player.vel.set(0, 0, 0);
        b.player.fly = false; b.player.onGround = grounded;
        b.updateCamera(0);
        check(k.api('netSend')(k.api('combatNetState')('state')), 'Bounded fighter pose was not sent');
      }, { position, grounded: step === steps });
      await observer.wait('authority accepted bounded fighter position', ({ id, position }) => {
        const r = window.__blockcraft.net.players.get(id);
        return r && [r.tx, r.ty, r.tz].every((n, i) => Math.abs(n - position[i]) < 0.03);
      }, { id, position });
    }
    return page.evaluate(() => {
      const b = window.__blockcraft;
      b.health = 100; b.gun.reloading = b.gun.cooldown = 0;
      b.gun.ammo = b.WEAPONS.map((w) => w.mag);
      return { y: b.player.pos.y, kills: b.kills, deaths: b.deaths, health: b.health };
    });
  };
  const beforeA = await setupFighter(A, B, a.id, 132);
  const beforeB = await setupFighter(B, A, b.id, 127);
  await A.lock();
  await A.wait('real peer converged at shot target', ({ id, y }) => {
    const r = window.__blockcraft.net.players.get(id);
    return r && Math.abs(r.x - 128) < 0.03 && Math.abs(r.y - y) < 0.03 && Math.abs(r.z - 127) < 0.03;
  }, { id: b.id, y: beforeB.y });
  const fireAtPeer = async () => {
    await A.wait('weapon cooldown elapsed before aimed shot', () => {
      const b = window.__blockcraft;
      return b.alive && b.gun.cooldown <= 0 && b.gun.reloading <= 0;
    });
    return A.evaluate(aimAndFire, b.id);
  };
  const shots = [await fireAtPeer()];
  let victim = await B.wait('aimed ray caused end-to-end damage', () => {
    const b = window.__blockcraft;
    return b.health < 100 ? { health: b.health, alive: b.alive, deaths: b.deaths } : false;
  });
  assert.ok(victim.health > 0, 'First body shot should damage, not skip directly to the death assertion');
  for (let i = 0; i < 24 && victim.alive; i++) {
    const health = victim.health;
    shots.push(await fireAtPeer());
    victim = await B.wait('next aimed hit delivered', (before) => {
      const b = window.__blockcraft;
      return b.health < before ? { health: b.health, alive: b.alive, deaths: b.deaths } : false;
    }, health);
  }
  assert.equal(victim.alive, false, 'Real aimed shots never killed the target');
  assert.equal(victim.deaths, beforeB.deaths + 1, 'Death was not counted exactly once');
  await A.wait('shooter credited exactly one kill', (before) => window.__blockcraft.kills === before + 1, beforeA.kills);
  assert.match(await A.evaluate(() => document.getElementById('killfeed').textContent), /BC-Bravo/);
  const respawn = await B.wait('automatic respawn restores health and magazines', () => {
    const b = window.__blockcraft;
    return b.alive && b.health === 100 && b.gun.ammo.every((n, i) => n === b.WEAPONS[i].mag)
      ? { health: b.health, position: b.player.pos.toArray(), ammo: [...b.gun.ammo] } : false;
  }, undefined, { timeout: 12_000 });
  await A.wait('respawn replicated as a visible living avatar', (id) => {
    const r = window.__blockcraft.net.players.get(id);
    return r && r.hp === 100 && r.group.visible && (!r.deadUntil || r.deadUntil <= performance.now());
  }, b.id);

  const scoreRows = ({ kills, deaths }) => {
    const rows = [...document.getElementById('scoreboardRows').children].map((row) => [...row.children].map((cell) => cell.textContent.trim()));
    const alpha = rows.find((row) => row[0]?.includes('BC-Alpha'));
    const bravo = rows.find((row) => row[0]?.includes('BC-Bravo'));
    return alpha?.length === 6 && bravo?.length === 6 && rows[0][0].includes('BC-Alpha') &&
      parseInt(alpha[3], 10) === kills && parseInt(bravo[4], 10) === deaths ? rows : false;
  };
  const scores = [];
  for (const page of [A, B]) {
    // Scoreboard is intentionally gated to the client's own active gameplay.
    await page.lock();
    await page.evaluate(() => window.__bcTest.api('setScoreboardVisible')(true));
    scores.push(await page.wait('scoreboard agrees on actual LAN kill/death', scoreRows,
      { kills: beforeA.kills + 1, deaths: beforeB.deaths + 1 }));
    await page.screenshot('scoreboard-' + page.label);
    await page.evaluate(() => window.__bcTest.api('setScoreboardVisible')(false));
  }

  await A.lock();
  await A.evaluate(installBuildHelpers);
  await A.evaluate(() => {
    const k = window.__bcTest, h = window.__bcBuild;
    const world = k.world(), site = k.pad({ x: 128, z: 128 });
    world.dirty(site.writes); h.stock(); h.prepare('wall', site);
    window.__bcLanBuild = { world, before: world.snapshot(), inventory: h.inventory() };
  });
  // Exercise the real mouse handler as well as placement + per-voxel transport.
  await A.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: 512, y: 300 });
  await A.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: 512, y: 300 });
  const built = await A.evaluate(() => {
    const k = window.__bcTest, h = window.__bcBuild, fixture = window.__bcLanBuild;
    const cells = fixture.world.changes(fixture.before);
    const dimensions = h.shape('wall', cells), cost = h.receipt(fixture.inventory);
    k.check(Object.keys(cost).length === 0 && Object.keys(h.inventory()).length === 0, 'Unlimited LAN building consumed actual inventory');
    return { cells, dimensions, cost };
  });
  const hasCells = (cells) => cells.every((c) => window.__blockcraft.getBlock(c.x, c.y, c.z) === c.to);
  await B.wait('all quick-build voxels replicated', hasCells, built.cells, { timeout: 25_000 });

  const targetCell = built.cells.find((c) => c.y === Math.min(...built.cells.map((v) => v.y)) + 1);
  assert.ok(targetCell, 'No middle wall voxel to test bullet destruction');
  const initialDamage = await B.evaluate(() => window.__bcTest.api('voxelDamageMap').size);
  const destroyShots = [];
  await A.evaluate(() => {
    const b = window.__blockcraft;
    b.setCombatMode(true); b.thirdPerson = false; b.player.fly = false;
    b.selectWeapon(b.WEAPONS.findIndex((w) => w.id === 'pistol'));
    b.gun.aiming = true; b.gun.trigger = false;
  });
  for (let i = 0; i < 32; i++) {
    await A.evaluate(() => {
      const b = window.__blockcraft;
      if (b.gun.ammo[b.gun.index] === 0) b.startReload();
    });
    await A.wait('pistol magazine and legal fire cadence ready', () => {
      const b = window.__blockcraft;
      return b.gun.reloading <= 0 && b.gun.cooldown <= 0 && b.gun.ammo[b.gun.index] > 0;
    });
    const shot = await A.evaluate((cell) => {
      const k = window.__bcTest, { b } = k;
      const w = b.WEAPONS[b.gun.index];
      b.gun.aiming = true; b.gun.trigger = false;
      b.updateCamera(1 / 60);
      const direction = new b.THREE.Vector3(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5).sub(b.camera.position).normalize();
      b.player.yaw = Math.atan2(-direction.x, -direction.z); b.player.pitch = Math.asin(direction.y);
      b.updateCamera(1 / 60);
      const hit = k.api('raycastVoxel')(w.range, b.camera.position, b.camera.getWorldDirection(new b.THREE.Vector3()));
      k.check(hit && hit.x === cell.x && hit.y === cell.y && hit.z === cell.z, 'LAN destruction ray missed the intended built voxel', hit);
      const ammo = b.gun.ammo[b.gun.index];
      b.fireOnce();
      k.check(b.gun.ammo[b.gun.index] === ammo - 1, 'LAN destruction did not fire a real bullet');
      return { block: b.getBlock(cell.x, cell.y, cell.z), ammo: b.gun.ammo[b.gun.index], damageEntries: k.api('voxelDamageMap').size };
    }, targetCell);
    destroyShots.push(shot);
    if (shot.block === 0) break;
    if (i === 0) await B.wait('partial voxel damage replicated', (initial) => window.__bcTest.api('voxelDamageMap').size > initial, initialDamage);
  }
  assert.equal(destroyShots.at(-1).block, 0, 'Built wall resisted every real bullet');
  const historyCells = built.cells.map((c) => c === targetCell ? { ...c, to: 0 } : c);
  await B.wait('definitive AIR edit replicated', hasCells, historyCells);
  // Damage can predict AIR before the outbound edit batch is flushed. Wait
  // for the authoritative edit as well, so late-join history is really saved.
  await waitFor('LAN-B received the authoritative AIR edit', () => B.events.some((frame) => frame.direction === 'in' &&
    (frame.value.t === 'edits' ? frame.value.edits : frame.value.t === 'edit' ? [frame.value] : []).some((cell) =>
      cell.b === 0 && cell.x === targetCell.x && cell.y === targetCell.y && cell.z === targetCell.z)));
  await A.evaluate(() => {
    const b = window.__blockcraft;
    b.selectWeapon(b.WEAPONS.findIndex((w) => w.id === 'lmg'));
  });

  const C = await lab.page('LAN-late-join', { base: lab.httpURL, solo: false, width: 800, height: 600 });
  t.after(() => C.close());
  const c = await C.wait('late join welcome', online);
  await C.wait('late join received build and destruction edit history', hasCells, historyCells, { timeout: 25_000 });
  await C.wait('late join sees two independent existing players', () => window.__blockcraft.net.players.size === 2);
  await C.wait('late join gets new character/weapon', peer, { id: a.id, character: 'kratos', weapon: 'lmg' });
  const teams = await teamSwitchProbe([A, B, C], [a.id, b.id, c.id]);
  await A.lock();
  await A.evaluate(() => window.__bcTest.api('setScoreboardVisible')(true));
  await A.wait('scoreboard includes late joiner', () => document.getElementById('scoreboardRows').children.length === 3);
  await C.close();
  await A.wait('departed peer evicted from scoreboard DOM/cache', (id) => {
    const k = window.__bcTest, rows = [...document.getElementById('scoreboardRows').children];
    return rows.length === 2 && k.api('scoreboard').rows.size === 2 && rows.every((row) => row.dataset.playerId !== id);
  }, c.id);
  await A.evaluate(() => window.__bcTest.api('setScoreboardVisible')(false));
  await A.evaluate(() => { window.__bcTest.api('cancelQuickBuild')(); window.__bcLanBuild.world.restore(); delete window.__bcLanBuild; });
  for (const page of [A, B, C]) page.assertHealthy();
  return { players: [a, b, c], teams, identities, activeReload, shots, victim, respawn, scores, scoreboardEviction: true,
    built, destruction: { targetCell, shots: destroyShots }, historyCells };
}

module.exports = { lanProbe };
