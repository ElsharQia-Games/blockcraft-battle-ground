'use strict';

function menuProbe() {
  const { b, check } = window.__bcTest;
  const chars = [...document.querySelectorAll('#chars button')];
  check(chars.length === 16, 'Menu does not contain sixteen character choices');
  check(new Set(chars.map((el) => el.textContent)).size === 16, 'Duplicate character choices');
  const controls = [...chars, ...['play', 'nameInput', 'roomInput', 'onlineBtn', 'createBtn'].map((id) => document.getElementById(id))];
  const rows = [];
  for (const el of controls) {
    check(!!el && !el.disabled, 'Missing/disabled menu control', el?.id);
    const ancestors = [];
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      ancestors.push({ parent, top: parent.scrollTop, left: parent.scrollLeft, overflowY: getComputedStyle(parent).overflowY });
    }
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const label = el.id || el.textContent;
    check(r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1,
      'Control cannot fit/reach actual viewport after scrolling', { label, rect: r.toJSON(), width: innerWidth, height: innerHeight });
    check(el.contains(document.elementFromPoint(x, y)), 'Menu control is covered or clipped', label);
    for (const a of ancestors) {
      if (a.parent.scrollTop !== a.top) check(['auto', 'scroll'].includes(a.overflowY), 'Control requires scrolling a user-inaccessible hidden container', { label, parent: a.parent.id, overflow: a.overflowY });
      check(a.parent.scrollLeft === a.left, 'Menu requires horizontal scrolling', label);
    }
    rows.push({ label, rect: r.toJSON() });
  }
  for (const el of [document.documentElement, document.body, document.getElementById('hint'), document.getElementById('chars')]) {
    check(el.scrollWidth <= el.clientWidth + 1, 'Horizontal menu overflow', { id: el.id || el.tagName, scroll: el.scrollWidth, client: el.clientWidth });
  }
  return { viewport: [innerWidth, innerHeight], names: b.CHAR_KEYS.map((key) => b.CHARACTERS[key].name), controls: rows };
}

function hudProbe() {
  const { check } = window.__bcTest;
  const visible = (el) => {
    if (!el || el.getBoundingClientRect().width === 0) return false;
    let opacity = 1;
    for (let p = el; p; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      opacity *= Number(style.opacity);
    }
    return opacity > 0.025;
  };
  const build = document.getElementById('buildHud');
  check(visible(build), 'Active quick-building HUD is not visible');
  const rect = build.getBoundingClientRect();
  check(rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1, 'Build HUD extends outside viewport', rect.toJSON());
  const critical = ['healthWrap', 'weaponHud', 'hotbar', 'crosshair', 'roomBadge', 'stats', 'killfeed'];
  const rows = [];
  for (const id of critical) {
    const el = document.getElementById(id);
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const overlapX = Math.max(0, Math.min(rect.right, r.right) - Math.max(rect.left, r.left));
    const overlapY = Math.max(0, Math.min(rect.bottom, r.bottom) - Math.max(rect.top, r.top));
    check(overlapX * overlapY <= 1, 'Build HUD overlaps critical HUD', { id, build: rect.toJSON(), critical: r.toJSON(), overlapX, overlapY });
    rows.push({ id, rect: r.toJSON(), overlap: overlapX * overlapY });
  }
  check(document.documentElement.scrollWidth <= innerWidth + 1, 'Horizontal gameplay overflow');
  return { viewport: [innerWidth, innerHeight], build: rect.toJSON(), critical: rows };
}

module.exports = { menuProbe, hudProbe };
