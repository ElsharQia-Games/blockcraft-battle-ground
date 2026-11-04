'use strict';

function installBuildHelpers() {
  const k = window.__bcTest, { b, check } = k;
  const inventory = () => Object.fromEntries(Object.entries(b.inventory).filter(([, n]) => n > 0));
  const stock = (amount = 0) => {
    for (const id of Object.keys(b.inventory)) delete b.inventory[id];
    for (const id of k.api('BLOCK_IDS')) b.inventory[id] = amount;
  };
  const receipt = (before) => {
    const out = {};
    for (const id of new Set([...Object.keys(before), ...Object.keys(b.inventory)])) {
      const amount = (before[id] || 0) - (b.inventory[id] || 0);
      check(Number.isInteger(amount) && amount >= 0 && (b.inventory[id] || 0) >= 0, 'Build created/overdrew material', { id, amount });
      if (amount) out[id] = amount;
    }
    return out;
  };
  const prepare = (piece, site, rotations = 0) => {
    k.api('cancelQuickBuild')();
    b.setCombatMode(false);
    k.onPad(site);
    b.player.pitch = Math.atan2(-1.62, 4);
    b.updateCamera(1 / 60);
    b.camera.lookAt(site.x, site.y, site.z);
    b.camera.updateMatrixWorld(true);
    check(k.api('selectBuildPiece')(piece), 'Blueprint selection needs active gameplay', piece);
    k.api('setQuickBuildMaterial')(k.api('PLANKS'));
    for (let i = 0; i < rotations; i++) k.api('rotateBuildPiece')();
    k.api('updateBuilding')(1 / 60);
    return k.api('quickBuild').plan;
  };
  const place = () => {
    // Exercise commitment/revalidation independently of the 180ms input throttle.
    // In particular, a duplicate must fail as complete, not accidentally as cooldown.
    k.api('buildingHeld').nextActionAt = 0;
    return k.api('placeQuickBuild')();
  };
  const commit = (target) => k.api('commitBuildPiece')(target.kind, target.anchor, target.rotation, target.material);
  const footprint = (cells) => cells.map((c) => `${c.x},${c.y},${c.z},${c.to}`).sort();
  const shape = (piece, cells) => {
    check(cells.length >= 3, 'Placement produced no usable structure', { piece, cells });
    check(cells.every((c) => c.from === k.api('AIR') || c.from === k.api('WATER')), 'Quick build overwrote existing terrain', cells);
    const span = (axis) => Math.max(...cells.map((c) => c[axis])) - Math.min(...cells.map((c) => c[axis])) + 1;
    const dimensions = [span('x'), span('y'), span('z')];
    if (piece === 'wall') check(dimensions[1] > 1 && Math.min(dimensions[0], dimensions[2]) === 1, 'Wall is not upright and one voxel thick', dimensions);
    if (piece === 'floor') check(dimensions[1] === 1 && dimensions[0] > 1 && dimensions[2] > 1, 'Floor is not a horizontal surface', dimensions);
    if (piece === 'ramp') {
      const columns = new Map();
      for (const c of cells) columns.set(`${c.x},${c.z}`, Math.max(columns.get(`${c.x},${c.z}`) ?? -Infinity, c.y));
      check(dimensions[1] > 1 && new Set(columns.values()).size > 1, 'Ramp has no rising walkable steps', dimensions);
    }
    return dimensions;
  };
  // Capture published state without coupling assertions to provisional field names.
  const metadata = () => {
    const q = k.api('quickBuild');
    return Object.fromEntries(Object.entries(q).map(([key, value]) => [key,
      typeof value === 'number' ? Number.isFinite(value) ? value : String(value) :
        value === null || ['boolean', 'string'].includes(typeof value) ? value :
        Array.isArray(value) ? { length: value.length, sample: value.slice(0, 2).map((v) => v?.isObject3D ? v.type : v) } :
          { type: value?.type || typeof value, keys: value ? Object.keys(value).slice(0, 20) : [] }]));
  };
  window.__bcBuild = { inventory, stock, receipt, prepare, place, commit, footprint, shape, metadata };
  return metadata();
}

function buildingProbe() {
  const k = window.__bcTest, { b, check } = k, h = window.__bcBuild;
  check(k.api('UNLIMITED_BUILDING') === true, 'Unlimited building is not enabled');
  return k.state(() => {
    const world = k.world();
    const rows = [];
    try {
      // x=128 is a real chunk edge; changing these voxels also exercises dirty neighbors.
      const site = k.pad({ x: 128, z: 128, radius: 11 });
      world.dirty(site.writes);
      const flat = world.snapshot();
      const reset = (piece, rotations = 0) => { world.restore(flat); h.stock(); h.prepare(piece, site, rotations); };
      for (const piece of ['wall', 'ramp', 'floor']) {
        reset(piece);
        const preview = k.api('quickBuild').plan;
        check(preview.ok, 'Controlled pad did not produce a valid preview', h.metadata());
        const target = { kind: piece, anchor: { ...preview.anchor }, rotation: preview.rotation, material: preview.material };
        const originalInventory = h.inventory();
        const before = world.snapshot();
        const placed = h.place();
        check(placed.ok, 'Valid blueprint was not placed', placed);
        const cells = world.changes(before);
        const dimensions = h.shape(piece, cells);
        const cost = h.receipt(originalInventory);
        const expectedCost = piece === 'ramp' ? 18 : 9;
        check(cells.length === expectedCost && Object.keys(cost).length === 0 && Object.keys(h.inventory()).length === 0,
          'Unlimited build failed with zero actual inventory or deducted stock', { piece, cells: cells.length, cost, expectedCost });
        for (const c of cells) check(b.getBlock(c.x, c.y, c.z) === c.to, 'Incorrect boundary voxel data', c);
        const chunks = [...new Set(cells.map((c) => `${Math.floor(c.x / 16)},${Math.floor(c.z / 16)}`))];
        const first = world.snapshot(), paid = h.inventory();
        const duplicate = h.place();
        check(duplicate.code === 'complete', 'Duplicate probe was not revalidated at the same anchor', duplicate.code);
        check(world.changes(first).length === 0 && JSON.stringify(h.inventory()) === JSON.stringify(paid), 'Repeated placement at the same location charged/edited again', piece);

        const rejected = [];
        const reject = (reason, code, change) => {
          reset(piece);
          change();
          const before = world.snapshot(), inv = h.inventory();
          // Keep the selected world anchor fixed as inventory/bodies/cover change.
          // This is the same transaction called by the real mouse route below/in LAN.
          const result = h.commit(target);
          check(!result.ok && result.code === code, `Wrong rejection for ${reason}`, { piece, expected: code, actual: result.code });
          check(world.changes(before).length === 0, `Non-atomic ${reason} placement`, { piece, changes: world.changes(before), metadata: h.metadata() });
          check(JSON.stringify(h.inventory()) === JSON.stringify(inv), `Rejected ${reason} placement spent resources`, piece);
          rejected.push(reason);
        };
        // Put the obstruction away from the aim ray, keeping the original target.
        const obstruction = [...cells].sort((a, c) => Math.abs(c.x - site.x) + Math.abs(c.z - site.z) - Math.abs(a.x - site.x) - Math.abs(a.z - site.z))[0];
        reject('occupied cell', 'occupied', () => b.setBlock(obstruction.x, obstruction.y, obstruction.z, k.api('STONE')));
        reject('player body', 'self', () => b.player.pos.set(obstruction.x + 0.5, obstruction.y + 0.05, obstruction.z + 0.5));
        reject('out of reach after preview', 'reach', () => b.player.pos.x += 40);
        reject('new occluding cover', 'occluded', () => {
          for (let x = Math.floor(site.x) - 4; x <= Math.floor(site.x) + 4; x++) {
            for (let y = site.y; y <= site.y + 4; y++) b.setBlock(x, y, Math.floor(site.z) + 2, k.api('STONE'));
          }
        });

        const remoteID = '__regression_body__';
        const body = b.makeHumanoid('steve', null);
        body.position.set(obstruction.x + 0.5, obstruction.y, obstruction.z + 0.5);
        b.scene.add(body);
        try {
          reject('remote body', 'player', () => b.net.players.set(remoteID, {
            id: remoteID, group: body, x: body.position.x, y: body.position.y, z: body.position.z,
            tx: body.position.x, ty: body.position.y, tz: body.position.z, hp: 100, deadUntil: 0
          }));
        } finally { b.net.players.delete(remoteID); body.removeFromParent(); }

        // Unlimited placement must also preserve any finite, real crafting stock.
        reset(piece);
        b.inventory[target.material] = 1;
        check(h.commit(target).ok, 'Unlimited placement incorrectly required a full finite inventory');
        check(JSON.stringify(h.footprint(world.changes(flat))) === JSON.stringify(h.footprint(cells)), 'Finite crafting stock changed the built structure', piece);
        check(b.inventory[target.material] === 1, 'Unlimited building consumed actual crafting inventory', piece);

        reset(piece);
        const reused = cells.slice(0, 3);
        for (const c of reused) b.setBlock(c.x, c.y, c.z, target.material);
        const reuseBefore = world.snapshot(), reuseInventory = h.inventory();
        const reuseResult = h.commit(target);
        check(reuseResult.ok && world.changes(reuseBefore).length === expectedCost - 3 && Object.keys(h.receipt(reuseInventory)).length === 0,
          'Matching cells were rewritten/lost or actual stock was consumed', { piece, reuseResult });
        for (const c of reused) check(b.getBlock(c.x, c.y, c.z) === target.material, 'Existing matching cell was overwritten');

        reset(piece, 4); h.place();
        check(JSON.stringify(h.footprint(world.changes(flat))) === JSON.stringify(h.footprint(cells)), 'Four rotations did not return to the original footprint', piece);
        reset(piece, 1); h.place();
        const turned = world.changes(flat);
        h.shape(piece, turned);
        if (piece !== 'floor') check(JSON.stringify(h.footprint(turned)) !== JSON.stringify(h.footprint(cells)), 'Rotate command had no effect', piece);
        rows.push({ piece, dimensions, cells, actualDebit: cost, chunks, rejected });
      }

      const floating = [];
      for (const piece of ['wall', 'ramp', 'floor']) {
        world.restore(flat);
        for (const c of site.writes) if (c.y === site.y - 1) b.setBlock(c.x, c.y, c.z, k.api('AIR'));
        h.stock(); h.prepare(piece, site);
        b.player.fly = true; b.player.onGround = false;
        const before = world.snapshot();
        const result = h.place();
        check(result.ok, 'Floating blueprint was rejected for lacking support', { piece, result });
        const cells = world.changes(before);
        h.shape(piece, cells);
        check(Object.keys(h.inventory()).length === 0, 'Floating building consumed actual stock');
        floating.push({ piece, cells: cells.length });
      }
      world.restore(flat);
      h.stock(); h.prepare('wall', site);
      const edgeBefore = world.snapshot(), edgeInv = h.inventory();
      for (const x of [0, b.WORLD - 1]) {
        const result = h.commit({ kind: 'wall', anchor: { x, y: site.y, z: 128 }, rotation: 0, material: k.api('PLANKS') });
        check(result.code === 'bounds', 'Partially out-of-world footprint was not rejected', result.code);
        check(world.changes(edgeBefore).length === 0 && JSON.stringify(h.inventory()) === JSON.stringify(edgeInv), 'World-edge rejection was not atomic');
      }
      k.api('cancelQuickBuild')();
      const cancelled = world.snapshot();
      h.place();
      check(world.changes(cancelled).length === 0, 'Cancelled building still placed a structure');
      return { rows, floating, metadata: h.metadata(), worldEdge: true };
    } finally { k.api('cancelQuickBuild')(); world.restore(); }
  });
}

function buildingInputProbe(reason) {
  const k = window.__bcTest, { b, check } = k, h = window.__bcBuild;
  return k.state(() => {
    const world = k.world(), previousFocus = document.activeElement;
    let input;
    try {
      const site = k.pad();
      h.stock();
      document.activeElement?.blur();
      h.prepare('wall', site);
      k.key('KeyW');
      k.api('buildingHeld').nextActionAt = 0;
      k.api('setBuildingHeld')(0, true);
      check(k.api('buildingHeld').left, 'Held-build fixture never became active');
      if (reason === 'focus') input = k.focusField();
      if (reason === 'blur') window.dispatchEvent(new Event('blur'));
      if (reason === 'inventory') k.key('KeyE');
      if (reason === 'reset') k.api('resetBuildingInput')();
      check(!k.api('quickBuild').active && !k.api('buildingHeld').left && !k.api('buildingHeld').right, 'Held building survived input release', reason);
      const before = world.snapshot(), inv = h.inventory();
      for (let i = 0; i < 30; i++) { k.api('buildingHeld').nextActionAt = 0; k.api('updateBuilding')(1 / 60); }
      check(world.changes(before).length === 0 && JSON.stringify(h.inventory()) === JSON.stringify(inv), 'Building continued after input release', reason);
      return { reason, metadata: h.metadata() };
    } finally { input?.remove(); k.api('cancelQuickBuild')(); world.restore(); previousFocus?.focus({ preventScroll: true }); }
  });
}

function singleBlockAndCraftProbe() {
  const k = window.__bcTest, { b, check } = k, h = window.__bcBuild;
  return k.state(() => {
    const world = k.world();
    try {
      const site = k.pad();
      world.dirty(site.writes);
      h.stock(); k.onPad(site); b.setCombatMode(false);
      b.player.pitch = Math.atan2(-1.62, 4); b.updateCamera(1 / 60);
      b.selectSlot(b.HOTBAR.indexOf(k.api('PLANKS')));
      const before = world.snapshot(), inv = h.inventory();
      b.placeBlock();
      const cells = world.changes(before);
      check(cells.length === 1 && cells[0].from === k.api('AIR') && cells[0].to === k.api('PLANKS'), 'Single-block building failed with zero inventory', cells);
      check(JSON.stringify(h.inventory()) === JSON.stringify(inv), 'Single-block placement consumed actual stock');
      b.player.pos.set(128.5, b.HEIGHT + 2, 132.5);
      b.player.pitch = 0; b.player.yaw = 0; b.player.fly = true;
      k.optional('resetPlayerMotion')?.(); b.player.fly = true;
      // Use an in-bounds air corridor, above the pad, with no raycast surface.
      b.player.pos.y = b.HEIGHT - 5;
      b.updateCamera(1 / 60);
      check(!b.raycast(6.5), 'Floating single-block fixture still has a ray surface');
      const airBefore = world.snapshot();
      b.placeBlock();
      const airCells = world.changes(airBefore);
      check(airCells.length === 1 && airCells[0].from === k.api('AIR') && airCells[0].to === k.api('PLANKS'), 'Traditional RMB cannot place in open air', airCells);
      check(Object.keys(h.inventory()).length === 0, 'Floating single-block placement consumed actual stock');
      const recipe = b.RECIPES.find((r) => r.req.every(([id]) => id !== r.out[0]));
      check(recipe, 'No ordinary crafting recipe');
      b.doCraft(recipe);
      check(b.itemCount(recipe.out[0]) === 0, 'Unlimited building accidentally made crafting free');
      for (const [id, n] of recipe.req) b.addItem(id, n);
      b.doCraft(recipe);
      check(b.itemCount(recipe.out[0]) === recipe.out[1] && recipe.req.every(([id]) => b.itemCount(id) === 0), 'Crafting did not consume real inventory and produce its output', { recipe, inventory: h.inventory() });
      return { cells, airCells, recipe, inventory: h.inventory() };
    } finally { world.restore(); }
  });
}

module.exports = { installBuildHelpers, buildingProbe, buildingInputProbe, singleBlockAndCraftProbe };
