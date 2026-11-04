'use strict';

function movementProbe() {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const world = k.world();
    try {
      const site = k.pad({ radius: 12 });
      world.dirty(site.writes);
      const flat = world.snapshot();
      const update = k.api('updatePlayer');
      const keys = k.api('keys');
      const reset = () => {
        k.onPad(site);
        b.player.pos.z = site.z + 2;
      };
      const run = (fps, duration, sprint = false) => {
        reset();
        const start = b.player.pos.clone();
        keys.KeyW = true;
        keys.ShiftLeft = sprint;
        for (let i = 0; i < Math.round(fps * duration); i++) update(1 / fps);
        return { fps, speed: Math.hypot(b.player.vel.x, b.player.vel.z), distance: b.player.pos.distanceTo(start) };
      };
      const acceleration = [30, 60, 120].map((fps) => run(fps, 0.1));
      const travel = [30, 60, 120].map((fps) => run(fps, 0.5));
      for (const samples of [acceleration, travel]) {
        const speeds = samples.map((s) => s.speed), distances = samples.map((s) => s.distance);
        check(Math.min(...speeds) > 1, 'W did not accelerate the real player', samples);
        check(Math.max(...speeds) - Math.min(...speeds) < Math.max(...speeds) * 0.035, 'Frame-rate-dependent acceleration', samples);
        check(Math.max(...distances) - Math.min(...distances) < 0.075, 'Frame-rate-dependent travel', samples);
      }
      const walk = run(60, 0.5), sprint = run(60, 0.5, true);
      check(sprint.speed > walk.speed * 1.2 && sprint.distance > walk.distance * 1.2, 'Shift sprint has no meaningful effect', { walk, sprint });

      reset();
      k.key('Space');
      update(1 / 120);
      const jumpVelocity = b.player.vel.y;
      check(jumpVelocity > 1, 'Space failed to jump from grounded state', jumpVelocity);
      k.key('Space', false);

      // A one-voxel wall must stop even a large movement step.
      reset();
      const wallZ = Math.floor(site.z) - 1;
      for (let x = Math.floor(site.x) - 3; x <= Math.floor(site.x) + 3; x++) {
        for (let y = site.y; y <= site.y + 3; y++) b.setBlock(x, y, wallZ, k.api('STONE'));
      }
      b.player.vel.z = -90;
      keys.KeyW = true;
      for (let i = 0; i < 12; i++) update(1 / 30);
      k.api('moveAxis')('z', -12);
      check(b.player.pos.z - k.api('PW') >= wallZ + 1 - 0.025, 'Player tunneled through a one-block wall', b.player.pos.toArray());
      check(!k.api('collides')(...b.player.pos.toArray()), 'Collision resolution left player inside a block');
      const collision = b.player.pos.toArray();
      world.restore(flat);

      // Remove the near half of the platform. We detect actual loss of contact,
      // rather than setting a private coyote timer to the expected value.
      const edge = Math.floor(site.z);
      for (let x = Math.floor(site.x) - 12; x <= Math.floor(site.x) + 12; x++) {
        for (let z = edge - 12; z < edge; z++) b.setBlock(x, site.y - 1, z, k.api('AIR'));
      }
      const leaveEdge = () => {
        reset();
        b.player.pos.z = edge + 1;
        keys.KeyW = true;
        let frames = 0;
        do { update(1 / 120); frames++; } while (b.player.onGround && frames < 240);
        check(!b.player.onGround, 'Edge fixture never left the platform');
      };
      leaveEdge();
      k.key('Space'); update(1 / 120); k.key('Space', false);
      const coyote = b.player.vel.y;
      check(coyote > 1, 'Coyote jump immediately after leaving a ledge failed', coyote);
      leaveEdge();
      for (let i = 0; i < 40; i++) update(1 / 120);
      k.key('Space'); update(1 / 120); k.key('Space', false);
      check(b.player.vel.y < 0, 'Coyote jump never expires / permits an air jump', b.player.vel.y);

      let ledge = { covered: false };
      if (typeof k.optional('resetPlayerMotion') === 'function') {
        reset(); b.player.pos.z = edge + 1;
        keys.KeyW = keys.ControlLeft = true;
        for (let i = 0; i < 150; i++) update(1 / 120);
        check(b.player.onGround && b.player.pos.y >= site.y - 0.05, 'Ctrl walked off the unsupported ledge', b.player.pos.toArray());
        const held = b.player.pos.toArray();
        keys.ControlLeft = false;
        for (let i = 0; i < 120; i++) update(1 / 120);
        check(!b.player.onGround && b.player.pos.y < site.y - 0.1, 'Ledge safety remained stuck after Ctrl release');
        ledge = { covered: true, held };
      }
      world.restore(flat);

      // Queue the jump while still airborne, just before the feet contact the pad.
      reset();
      b.player.pos.y = site.y + 0.18;
      b.player.vel.y = -3;
      b.player.onGround = false;
      k.key('Space'); k.key('Space', false);
      let buffered = -Infinity;
      for (let i = 0; i < 18; i++) { update(1 / 120); buffered = Math.max(buffered, b.player.vel.y); }
      check(buffered > 1, 'Jump pressed before landing was lost', buffered);

      reset();
      b.player.pos.y += 4; // Leave enough air below to measure descent before landing.
      k.key('KeyF'); k.key('KeyF', true, true); k.key('KeyF', false);
      check(b.player.fly, 'F did not toggle flight once, or key-repeat toggled it back');
      keys.Space = true;
      for (let i = 0; i < 12; i++) update(1 / 60);
      check(b.player.vel.y > 0, 'Space did not ascend in flight');
      keys.Space = false; keys.ShiftLeft = true;
      for (let i = 0; i < 24; i++) update(1 / 60);
      check(b.player.vel.y < 0, 'Shift did not descend in flight');
      k.key('KeyF'); k.key('KeyF', false);
      check(!b.player.fly, 'F did not return to walking');
      const view = b.thirdPerson;
      k.key('KeyV'); k.key('KeyV', true, true); k.key('KeyV', false);
      check(b.thirdPerson !== view, 'V did not change camera once');
      k.key('KeyV'); k.key('KeyV', false);
      check(b.thirdPerson === view, 'V did not restore camera');
      return { acceleration, travel, walk, sprint, jumpVelocity, collision, coyote, buffered, ledge };
    } finally { world.restore(); }
  });
}

function inputReleaseProbe(reason) {
  const k = window.__bcTest, { b, check } = k;
  return k.state(() => {
    const keys = k.api('keys');
    const focus = document.activeElement;
    let input;
    const arm = () => {
      k.key('KeyW');
      k.key('Space');
      check(keys.KeyW && keys.Space, 'Input-release fixture did not start in active gameplay');
      b.gun.trigger = b.gun.aiming = true;
      b.player.vel.set(2, 0, -2);
    };
    const released = (reason) => {
      const active = Object.keys(keys).filter((key) => keys[key]);
      check(active.length === 0 && !b.gun.trigger && !b.gun.aiming, 'Active controls survived ' + reason, { active, trigger: b.gun.trigger, aiming: b.gun.aiming });
      return { reason, active, velocity: b.player.vel.toArray() };
    };
    try {
      arm();
      if (reason === 'blur') window.dispatchEvent(new Event('blur'));
      if (reason === 'focus') {
        input = k.focusField();
        const prior = { fly: b.player.fly, view: b.thirdPerson, index: b.gun.index };
        for (const code of ['KeyF', 'KeyV', 'Space', 'Digit7']) { k.key(code); k.key(code, false); }
        check(b.player.fly === prior.fly && b.thirdPerson === prior.view && b.gun.index === prior.index, 'Typing in text field triggered gameplay');
      }
      if (reason === 'inventory') { b.openCraft(); k.api('updateBuilding')(1 / 60); }
      return released(reason);
    } finally { input?.remove(); focus?.focus({ preventScroll: true }); }
  });
}

module.exports = { movementProbe, inputReleaseProbe };
