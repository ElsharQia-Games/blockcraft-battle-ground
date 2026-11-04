/* Blockcraft Battle Ground — Inventory, hotbar, crafting and toasts.
   70-inventory.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
const UNLIMITED_BUILDING = true;
const inventory = Object.create(null);
const STARTING_KIT = {
  [GRASS]: 24, [DIRT]: 64, [STONE]: 64, [SAND]: 32, [LOG]: 24, [LEAVES]: 24,
  [PLANKS]: 32, [COBBLE]: 48, [BRICK]: 24, [GLASS]: 8, [SANDSTONE]: 16, [MUD]: 16
};
for (const id in STARTING_KIT) inventory[id] = STARTING_KIT[id];

const HOTBAR = [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, COBBLE, BRICK];
const itemCount = (id) => inventory[id] || 0;
const blockName = (id) => (BLOCK_DEFS[id] ? BLOCK_DEFS[id].name : 'Block');
const blockTile = (id) => (BLOCK_DEFS[id] ? BLOCK_DEFS[id].side : 0);

function isBuildMaterial(id) {
  return Number.isInteger(id) && id > AIR && id <= 255 && id !== WATER &&
    Object.prototype.hasOwnProperty.call(BLOCK_DEFS, id);
}

// Building availability is independent of collected items and recipe ingredients.
function buildItemCount(id) {
  return UNLIMITED_BUILDING && isBuildMaterial(id) ? Infinity : itemCount(id);
}

function takeBuildItems(id, n = 1) {
  if (!isBuildMaterial(id) || !Number.isSafeInteger(n) || n <= 0) return false;
  return UNLIMITED_BUILDING || takeItem(id, n);
}

function addItem(id, n = 1) {
  inventory[id] = Math.min(999, itemCount(id) + n);
  refreshHotbar();
  if (craftOpen) refreshCraft();
}

function takeItem(id, n = 1) {
  if (itemCount(id) < n) return false;
  inventory[id] = itemCount(id) - n;
  if (inventory[id] <= 0) delete inventory[id];
  refreshHotbar();
  if (craftOpen) refreshCraft();
  return true;
}

let selected = 0;
const hotbarEl = document.getElementById('hotbar');
const slots = [];

function paintTile(cv, id) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = false;
  const [sx, sy] = tileOrigin(blockTile(id));
  ctx.drawImage(tileCanvas, sx, sy, TILE_PX, TILE_PX, 0, 0, cv.width, cv.height);
}

for (let i = 0; i < HOTBAR.length; i++) {
  const slot = document.createElement('div');
  slot.className = 'slot' + (i === 0 ? ' active' : '');

  const swatch = document.createElement('canvas');
  swatch.width = TILE_PX; swatch.height = TILE_PX;
  slot.appendChild(swatch);

  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = String(i + 1);
  slot.appendChild(num);

  const count = document.createElement('span');
  count.className = 'count';
  slot.appendChild(count);

  slot.dataset.canvas = slots.length;
  hotbarEl.appendChild(slot);
  slots.push({ el: slot, canvas: swatch, count });
}

function refreshHotbar() {
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const id = HOTBAR[i];
    const n = buildItemCount(id);
    paintTile(s.canvas, id);
    s.count.textContent = n === Infinity ? '∞' : n > 0 ? String(n) : '';
    s.el.classList.toggle('empty', n <= 0);
    s.el.title = blockName(id) + (n === Infinity ? ' · Unlimited building' : '');
  }
  document.getElementById('slotLabel').textContent = String(selected + 1);
}

const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1400);
}

function selectSlot(i) {
  selected = (i + HOTBAR.length) % HOTBAR.length;
  for (let k = 0; k < slots.length; k++) slots[k].el.classList.toggle('active', k === selected);
  refreshHotbar();
  const id = HOTBAR[selected], n = buildItemCount(id);
  toast(blockName(id) + (n === Infinity ? ' · Unlimited building' : n > 0 ? ' ×' + n : ' (none)'));
}

/* ---- crafting ---- */
const RECIPES = [
  { out: [PLANKS, 4],        req: [[LOG, 1]] },
  { out: [GLASS, 1],         req: [[SAND, 3]] },
  { out: [STONEBRICK, 4],    req: [[COBBLE, 4]] },
  { out: [MOSSY, 1],         req: [[STONEBRICK, 1], [LEAVES, 1]] },
  { out: [BRICK, 2],         req: [[DIRT, 4]] },
  { out: [SANDSTONE, 1],     req: [[SAND, 2], [STONE, 1]] },
  { out: [MUD, 4],           req: [[DIRT, 2], [SAND, 2]] },
  { out: [GOLD_BLOCK, 1],    req: [[GOLD_ORE, 4]] },
  { out: [DIAMOND_BLOCK, 1], req: [[DIAMOND_ORE, 4]] }
];

const craftEl = document.getElementById('craft');
const invGridEl = document.getElementById('invGrid');
const recipeListEl = document.getElementById('recipeList');
let craftOpen = false;

function makeMiniCanvas(id) {
  const cv = document.createElement('canvas');
  cv.width = TILE_PX; cv.height = TILE_PX;
  paintTile(cv, id);
  return cv;
}

function refreshCraft() {
  invGridEl.innerHTML = '';
  for (const id of BLOCK_IDS) {
    const available = buildItemCount(id);
    const btn = document.createElement('button');
    btn.className = 'inv-item' + (available > 0 ? '' : ' zero');
    btn.type = 'button';
    btn.title = blockName(id) + (available === Infinity
      ? ' · Unlimited building · ' + itemCount(id) + ' for crafting' : ' ×' + available);
    btn.appendChild(makeMiniCanvas(id));
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = available === Infinity ? '∞' : String(available);
    btn.appendChild(n);
    btn.addEventListener('click', () => {
      HOTBAR[selected] = id;
      refreshHotbar();
      toast(blockName(id) + ' → slot ' + (selected + 1) + (available === Infinity ? ' · Unlimited building' : ''));
    });
    invGridEl.appendChild(btn);
  }

  recipeListEl.innerHTML = '';
  for (const r of RECIPES) {
    const can = r.req.every(([id, n]) => itemCount(id) >= n);
    const row = document.createElement('div');
    row.className = 'recipe';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.appendChild(makeMiniCanvas(r.out[0]));
    const text = document.createElement('div');
    const outName = blockName(r.out[0]) + (r.out[1] > 1 ? ' ×' + r.out[1] : '');
    const reqText = r.req.map(([id, n]) => blockName(id) + ' ×' + n).join(' + ');
    text.innerHTML = '<div>' + outName + '</div><div class="req">' + reqText + '</div>';
    meta.appendChild(text);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Craft';
    btn.disabled = !can;
    btn.addEventListener('click', () => doCraft(r));

    row.appendChild(meta);
    row.appendChild(btn);
    recipeListEl.appendChild(row);
  }
  document.getElementById('slotLabel').textContent = String(selected + 1);
}

function doCraft(r) {
  if (!r.req.every(([id, n]) => itemCount(id) >= n)) { toast('Missing materials'); return; }
  for (const [id, n] of r.req) takeItem(id, n);
  addItem(r.out[0], r.out[1]);
  toast('Crafted ' + blockName(r.out[0]) + (r.out[1] > 1 ? ' ×' + r.out[1] : ''));
}

function openCraft() {
  craftOpen = true;
  craftEl.classList.add('open');
  hintEl.classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  refreshCraft();
}

function closeCraft() {
  craftOpen = false;
  craftEl.classList.remove('open');
  if (!document.pointerLockElement) {
    hintEl.classList.remove('hidden');
    playBtn.textContent = 'Click to resume';
  }
}

function toggleCraft() {
  if (craftOpen) closeCraft(); else openCraft();
}

document.getElementById('craftClose').addEventListener('click', closeCraft);
refreshHotbar();
