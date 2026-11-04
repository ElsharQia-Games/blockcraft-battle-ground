'use strict';

function jumpAndWaterProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const world = k.world(), site = k.pad({ radius: 12 }), flat = world.snapshot(), keys = k.api('keys');
    let now = performance.now();
    const step = (dt) => { now += dt * 1000; b.BC.emit('preFrame', dt, now, true); b.updatePlayer(dt); };
    const jump = (fps, held) => {
      k.onPad(site); b.player.pitch = 0;
      const y = b.player.pos.y;
      k.key('Space');
      let maximum = y, launches = 0, lastVy = 0;
      for (let i = 0; i < fps * 2; i++) {
        if (!held && i === Math.max(1, Math.round(fps * 0.035))) k.key('Space', false);
        step(1 / fps);
        maximum = Math.max(maximum, b.player.pos.y);
        if (b.player.vel.y > 1 && lastVy <= 0) launches++;
        lastVy = b.player.vel.y;
      }
      k.key('Space', false);
      check(launches === 1 && b.player.onGround, 'Held Space grants repeated/renewable ground jumps', { fps, held, launches });
      return { fps, held, height: maximum - y, launches };
    };
    try {
      const taps = [30, 60, 120].map((fps) => jump(fps, false));
      const holds = [30, 60, 120].map((fps) => jump(fps, true));
      check(taps.every((s) => s.height >= 1.6 && s.height < 2.25), 'Tap jump is not meaningfully higher', taps);
      check(holds.every((s) => s.height >= 2.6 && s.height <= 3.3), 'Holding jump does not provide a bounded higher jump', holds);
      for (let i = 0; i < taps.length; i++) check(holds[i].height > taps[i].height + 0.6, 'Tap/hold jump feels identical', { tap: taps[i], hold: holds[i] });
      for (const samples of [taps, holds]) check(Math.max(...samples.map((s) => s.height)) - Math.min(...samples.map((s) => s.height)) < 0.12,
        'Variable jump height depends on FPS', samples);

      k.onPad(site); k.key('Space');
      for (let i = 0; i < 36; i++) step(1 / 120);
      k.key('Space', false);
      const beforeAir = b.player.vel.y;
      k.key('Space'); step(1 / 120); k.key('Space', false);
      check(b.player.vel.y <= beforeAir + 0.02, 'Re-pressing Space renews jump force in the air');

      const bankZ = Math.floor(site.z) - 1, surface = site.y;
      const setupWater = (roof = false) => {
        world.restore(flat); k.onPad(site); b.player.pitch = 0;
        for (let x = Math.floor(site.x) - 2; x <= Math.floor(site.x) + 2; x++) {
          for (let z = bankZ + 1; z <= bankZ + 6; z++) {
            b.setBlock(x, surface - 4, z, k.api('STONE'));
            for (let y = surface - 3; y < surface; y++) b.setBlock(x, y, z, k.api('WATER'));
          }
          for (let z = bankZ - 3; z <= bankZ; z++) b.setBlock(x, surface, z, k.api('STONE'));
          if (roof) for (let z = bankZ - 3; z <= bankZ + 6; z++) b.setBlock(x, surface + 2, z, k.api('STONE'));
        }
        b.player.pos.set(site.x, surface - 1.2, bankZ + 4.5);
        b.player.vel.set(0, 0, 0); b.player.onGround = false; b.player.fly = false;
        k.api('resetPlayerMotion')(); keys.KeyW = true; k.key('Space');
      };
      setupWater(false);
      for (let i = 0; i < 240; i++) step(1 / 120);
      check(b.player.pos.z < bankZ + 1.05 && b.player.pos.y >= surface + 0.95 && !k.api('collides')(...b.player.pos.toArray()),
        'Held swim-up/movement remains trapped at a one-metre shoreline', { position: b.player.pos.toArray(), swimming: b.player.swimming, surface, bankZ });
      const shore = b.player.pos.toArray();
      setupWater(true);
      for (let i = 0; i < 240; i++) step(1 / 120);
      check(!k.api('collides')(...b.player.pos.toArray()) && b.player.pos.y < surface + 0.95,
        'Water escape tunnels through a low roof/bank', b.player.pos.toArray());
      const roof = b.player.pos.toArray();
      k.key('Space', false); keys.KeyW = false;
      k.key('KeyC');
      const diveStart = b.player.pos.y;
      for (let i = 0; i < 48; i++) step(1 / 120);
      k.key('KeyC', false);
      check(b.player.pos.y < diveStart - 0.15, 'C dive is still canceled by buoyancy', { diveStart, y: b.player.pos.y });
      return { taps, holds, airRenewalBlocked: true, shore, roof, diving: true };
    } finally { world.restore(); }
  });
}

function mouseStreamProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const move = k.api('inputMouseMove'), reset = k.api('resetInputMouseStream'), diagnostics = k.api('getInputMouseDiagnostics');
    const capture = k.api('gameplayKeyboardCapture'), starting = capture.starting;
    b.player.yaw = b.player.pitch = 0;
    const before = diagnostics();
    try {
      capture.starting = true;
      check(!move({ movementX: 1428, movementY: -1400, timeStamp: performance.now() }), 'Capture-starting cursor warp is applied');
      check(b.player.yaw === 0 && b.player.pitch === 0, 'Capture warp flips the view');
      capture.starting = false;
      reset('qa-resume');
      check(!move({ movementX: -1428, movementY: 900, timeStamp: performance.now() }), 'Resume settling warp is applied');
      check(b.player.yaw === 0 && b.player.pitch === 0, 'Resume warp flips the view');
      const epoch = diagnostics();
      check(!move({ movementX: 1428, movementY: 0, timeStamp: Math.max(0, epoch.epochAt - 100) }), 'Stale-epoch sample is applied');
      check(!move({ movementX: NaN, movementY: 0, timeStamp: performance.now() }), 'Nonfinite mouse delta is applied');
      check(!move({ movementX: 0, movementY: 0, timeStamp: Infinity }), 'Discontinuous timestamp is applied');
      k.primeMouse();
      b.player.yaw = b.player.pitch = 0;
      const gain = b.BC.mouseSensitivity(b.WEAPONS[b.gun.index].id, false);
      check(move({ movementX: 1428, movementY: 0, timeStamp: performance.now() }), 'Steady fast flick was blanket-capped');
      check(Math.abs(b.player.yaw + 1428 * 0.0022 * gain) < 1e-7, 'Steady flick changed personal sensitivity');
      const after = diagnostics();
      check(after.rejectedCount >= before.rejectedCount + 5 && after.acceptedCount > before.acceptedCount,
        'Mouse diagnostics do not record rejected transition samples and accepted steady motion', { before, after });
      return { before, after, transitionsRejected: true, steadyFlickPreserved: true };
    } finally { capture.starting = starting; }
  });
}

module.exports = { jumpAndWaterProbe, mouseStreamProbe };
