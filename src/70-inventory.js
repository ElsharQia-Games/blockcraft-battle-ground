/* Blockcraft Battle Ground — Building materials, hotbar and toasts.
   70-inventory.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
const UNLIMITED_BUILDING = true;
// Mutable compatibility flag for deferred gameplay guards and debug callers.
// Inventory/crafting no longer has a player-facing surface or an open action.
let craftOpen = false;
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

// Building availability is independent of legacy collected-item counts.
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
}

function takeItem(id, n = 1) {
  if (itemCount(id) < n) return false;
  inventory[id] = itemCount(id) - n;
  if (inventory[id] <= 0) delete inventory[id];
  refreshHotbar();
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

// Shift+wheel changes the selected slot's material without opening a menu.
// Keep every solid material available while the numbered hotbar stays compact.
function cycleHotbarMaterial(direction) {
  if (direction !== 1 && direction !== -1) return false;
  const materials = BLOCK_IDS.filter(isBuildMaterial);
  if (!materials.length) return false;
  const current = materials.indexOf(HOTBAR[selected]);
  const next = current < 0 ? (direction > 0 ? 0 : materials.length - 1)
    : (current + direction + materials.length) % materials.length;
  HOTBAR[selected] = materials[next];
  selectSlot(selected);
  return true;
}

refreshHotbar();
