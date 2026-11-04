'use strict';

const assert = require('node:assert/strict');

function roomState() {
  const b = window.__blockcraft, n = b.net;
  if (!n.online || n.mode !== 'ws' || !n.id || !n.hostId || b.world.busy) return false;
  return { id: n.id, hostId: n.hostId, generation: n.generation, seed: b.seed, mode: b.modes.active,
    hostControls: b.modes.canConfigure(), ping: b.features.net.getPing() };
}

function hasCells(cells) {
  const b = window.__blockcraft;
  return cells.every((c) => b.getBlock(c.x, c.y, c.z) === c.b);
}

function seedFingerprint() {
  const b = window.__blockcraft, values = [];
  for (const [x, z] of [[8, 9], [32, 77], [63, 190], [92, 25], [128, 128], [177, 69], [222, 202]]) {
    values.push(b.terrainHeight(x, z));
    for (const y of [0, 6, 16, 28, 42, b.HEIGHT - 1]) values.push(b.getBlock(x, y, z));
  }
  return { seed: b.seed, values, population: window.__bcTest.population() };
}

async function multiplayerUpgradeProbe(lab, t) {
  const A = await lab.page('LAN-upgrade-A', { base: lab.httpURL, solo: false });
  t.after(() => A.close());
  const B = await lab.page('LAN-upgrade-B', { base: lab.httpURL, solo: false });
  t.after(() => B.close());
  const [a, b] = await Promise.all([A.wait('room authority ready', roomState), B.wait('room authority ready', roomState)]);
  const host = a.hostId === a.id ? A : B, guest = host === A ? B : A;
  assert.equal(a.hostId, b.hostId, 'LAN peers disagree about host identity');
  assert.notEqual(a.hostControls, b.hostControls, 'Host-only configuration is not enforced');

  await host.evaluate(async () => { await window.__blockcraft.modes.setActive('ffa'); }, undefined, { timeout: 100_000 });
  const ffa = await Promise.all([A, B].map((page) => page.wait('host mode propagated', () => {
    const b = window.__blockcraft;
    return !b.world.busy && b.modes.active === 'ffa' ? { mode: b.modes.active, generation: b.net.generation } : false;
  }, undefined, { timeout: 100_000, interval: 200 })));
  const denied = await guest.evaluate(async () => {
    const b = window.__blockcraft, before = { seed: b.seed, mode: b.modes.active, generation: b.net.generation };
    let rejected = false;
    try { await b.modes.setActive('snipers'); } catch { rejected = true; }
    return { before, after: { seed: b.seed, mode: b.modes.active, generation: b.net.generation }, rejected, canConfigure: b.modes.canConfigure() };
  });
  assert.equal(denied.canConfigure, false);
  assert.deepEqual(denied.after, denied.before, 'A non-host configuration request changed the shared match locally');

  await host.evaluate(async () => { await window.__blockcraft.world.regenerate(0); }, undefined, { timeout: 100_000 });
  const zero = await Promise.all([A, B].map((page) => page.wait('seed zero propagated and regeneration completed', () => {
    const b = window.__blockcraft;
    return !b.world.busy && b.seed === 0 && b.net.seed === 0 ? { seed: b.seed, generation: b.net.generation } : false;
  }, undefined, { timeout: 100_000, interval: 200 })));
  const fingerprint = await host.evaluate(seedFingerprint);
  const beforeReset = zero[0].generation;
  await host.evaluate(() => window.__blockcraft.modes.resetMatch());
  const reset = await Promise.all([A, B].map((page) => page.wait('same-seed round reset advances generation', (before) => {
    const b = window.__blockcraft;
    return !b.world.busy && b.seed === 0 && b.net.generation > before ? { seed: b.seed, generation: b.net.generation } : false;
  }, beforeReset, { timeout: 100_000, interval: 200 })));
  assert.equal(reset[0].generation, reset[1].generation, 'Same-seed reset left different room generations');
  assert.deepEqual(await host.evaluate(seedFingerprint), fingerprint, 'Same seed did not reproduce terrain/population');
  assert.deepEqual(await guest.evaluate(seedFingerprint), fingerprint, 'Peers did not regenerate the same seeded map');

  // A legal 100-cell construction burst must be coalesced rather than dropped
  // by a per-message rate guard. Keep all cells near the host, off its body.
  const burst = await host.evaluate(() => {
    const k = window.__bcTest, { b } = k, cells = [];
    const x0 = Math.floor(b.player.pos.x) + 1, z0 = Math.floor(b.player.pos.z) + 1, y0 = Math.floor(b.player.pos.y);
    for (let x = x0; x < x0 + 4; x++) for (let z = z0; z < z0 + 5; z++) for (let y = y0; y < y0 + 5; y++) {
      k.check(x < b.WORLD && z < b.WORLD && y < b.HEIGHT, 'Construction fixture exceeds world bounds');
      const c = { x, y, z, b: k.api('STONE') }; cells.push(c);
      b.setBlock(x, y, z, c.b); k.api('netSend')({ t: 'edit', ...c });
    }
    return cells;
  });
  assert.equal(burst.length, 100);
  await guest.wait('all 100 legal construction cells replicated', hasCells, burst, { timeout: 30_000 });
  await host.wait('origin receives the accepted construction values', hasCells, burst, { timeout: 30_000 });

  const cell = await host.evaluate(() => {
    const k = window.__bcTest, { b } = k;
    const cell = { x: Math.floor(b.player.pos.x) + 2, y: Math.floor(b.player.pos.y) + 3, z: Math.floor(b.player.pos.z) - 2 };
    b.setBlock(cell.x, cell.y, cell.z, k.api('AIR'));
    k.api('netSend')({ t: 'edit', ...cell, b: k.api('AIR') });
    return { ...cell, air: k.api('AIR'), first: k.api('PLANKS'), second: k.api('STONE') };
  });
  await guest.wait('empty conflict cell synchronized', hasCells, [{ ...cell, b: cell.air }]);
  // Simulate B's optimistic edit waiting in an outbound queue. A's accepted
  // value then reaches B before B's pending value reaches the authority.
  await guest.evaluate((c) => window.__blockcraft.setBlock(c.x, c.y, c.z, c.second), cell);
  await host.evaluate((c) => {
    const k = window.__bcTest;
    k.b.setBlock(c.x, c.y, c.z, c.first);
    k.api('netSend')({ t: 'edit', x: c.x, y: c.y, z: c.z, b: c.first });
  }, cell);
  await guest.wait('first accepted edit overwrites the queued optimistic value', hasCells, [{ ...cell, b: cell.first }]);
  await guest.evaluate((c) => window.__bcTest.api('netSend')({ t: 'edit', x: c.x, y: c.y, z: c.z, b: c.second }), cell);
  const final = [{ ...cell, b: cell.second }];
  await Promise.all([host, guest].map((page) => page.wait('authoritative echo reconciles the final value on both senders', hasCells, final)));

  const C = await lab.page('LAN-upgrade-late-join', { base: lab.httpURL, solo: false });
  t.after(() => C.close());
  await C.wait('late join adopts seed zero, mode and current generation', (expected) => {
    const b = window.__blockcraft;
    return !b.world.busy && b.seed === 0 && b.modes.active === 'ffa' && b.net.generation === expected;
  }, reset[0].generation, { timeout: 100_000, interval: 200 });
  await C.wait('late join receives accepted edit history including the contested cell', hasCells, [...burst, ...final], { timeout: 30_000 });
  const ping = await Promise.all([A, B].map((page) => page.wait('real measured LAN RTT', () => {
    const b = window.__blockcraft, value = b.features.net.getPing();
    return Number.isFinite(value) && value > 0 ? { ping: value, status: b.features.net.statusText() } : false;
  }, undefined, { timeout: 20_000 })));
  for (const page of [A, B, C]) page.assertHealthy();
  return { players: [a, b], ffa, denied, zero, reset, fingerprint, burstCells: burst.length, concurrentEdit: cell, reconciled: true, ping };
}

module.exports = { multiplayerUpgradeProbe };
