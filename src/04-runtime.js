/* Blockcraft Battle Ground — Shared runtime, feature hooks and module registry.
   04-runtime.js
   Loads before 00-core.js and every gameplay system. Feature modules
   register through BC.on()/BC.api instead of hard-wiring themselves into the
   boot loop, which keeps the classic-script split independently testable. */
'use strict';

var BC = window.BC = window.BC || {};

BC.version = 2;
BC.hooks = BC.hooks || Object.create(null);
BC.api = BC.api || Object.create(null);
BC.flags = BC.flags || Object.create(null);
BC.readyQueue = BC.readyQueue || [];
BC.readyFired = !!BC.readyFired;

/**
 * Register a hook. Lower priority runs first. Returns an unsubscribe function.
 * Hook names used by the core:
 *   worldReady()                      terrain + meshes + avatars exist
 *   preFrame(dt, now, playing)        before player physics
 *   postPlayer(dt, now, playing)      after player physics/camera
 *   frame(dt, now, playing)           after world/NPC/network updates
 *   lateFrame(dt, now)                after camera, before render
 *   worldReset(seed)                  terrain was regenerated
 *   death(victim, killer, info)       local player died
 *   respawn()                         local player respawned
 *   shot(info)                        local shot fired
 *   damage(info)                      local player took damage
 *   killfeed(killer, victim, info)    any kill feed row
 *   netPacket(msg)                    inbound network packet
 *   netStatus(status)                 net.online/mode changed
 *   sfx(info)                         positional sound event
 *   modeChanged(id, mode)             match mode changed
 *   settingsChanged(key, value)       lobby setting changed
 */
BC.on = function (name, fn, priority) {
  if (typeof fn !== 'function') return function () {};
  const list = BC.hooks[name] || (BC.hooks[name] = []);
  const entry = { fn, priority: Number(priority) || 0 };
  list.push(entry);
  list.sort(function (a, b) { return a.priority - b.priority; });
  return function () {
    const at = list.indexOf(entry);
    if (at >= 0) list.splice(at, 1);
  };
};

BC.off = function (name, fn) {
  const list = BC.hooks[name];
  if (!list) return;
  for (let i = list.length - 1; i >= 0; i--) {
    if (!fn || list[i].fn === fn) list.splice(i, 1);
  }
};

BC.emit = function (name) {
  const list = BC.hooks[name];
  if (!list || !list.length) return;
  const args = Array.prototype.slice.call(arguments, 1);
  // Copy so handlers can unsubscribe while an event is dispatching.
  const snapshot = list.slice();
  for (let i = 0; i < snapshot.length; i++) {
    try {
      snapshot[i].fn.apply(null, args);
    } catch (err) {
      console.error('[BC] hook "' + name + '" failed', err);
    }
  }
};

BC.whenReady = function (fn) {
  if (typeof fn !== 'function') return;
  if (BC.readyFired) fn();
  else BC.readyQueue.push(fn);
};

BC.markReady = function () {
  if (BC.readyFired) return;
  BC.readyFired = true;
  const queue = BC.readyQueue.slice();
  BC.readyQueue.length = 0;
  for (let i = 0; i < queue.length; i++) {
    try { queue[i](); } catch (err) { console.error('[BC] ready handler failed', err); }
  }
};

/* ---------------- small shared helpers ---------------- */
BC.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
BC.lerp = function (a, b, t) { return a + (b - a) * t; };
BC.damp = function (a, b, rate, dt) { return a + (b - a) * (1 - Math.exp(-rate * Math.max(0, dt))); };
BC.now = function () { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); };
BC.isFinite = Number.isFinite;

/** Stable 32-bit hash for room/seed strings. */
BC.hashSeed = function (value) {
  const text = String(value == null ? '' : value);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

BC.teamColor = function (team) {
  return team === 'red' ? '#ff3556' : team === 'blue' ? '#3585ff' : '#d8e6f2';
};

BC.teamName = function (team) {
  return team === 'red' ? 'Red' : team === 'blue' ? 'Blue' : 'Free';
};

/** Tiny DOM helper: BC.el('div', {id:'x', className:'y', text:'z'}, [child]) */
BC.el = function (tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const key of Object.keys(attrs)) {
      const value = attrs[key];
      if (value == null || value === false) continue;
      if (key === 'text') el.textContent = String(value);
      else if (key === 'className') el.className = String(value);
      else if (key === 'htmlFor') el.htmlFor = String(value);
      else if (key === 'html') el.innerHTML = String(value);
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
      else if (key === 'dataset' && typeof value === 'object') Object.assign(el.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, String(value));
    }
  }
  if (children) {
    for (const child of [].concat(children)) {
      if (child == null) continue;
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return el;
};

/** Inject a stylesheet exactly once. */
BC.style = function (id, css) {
  if (document.getElementById(id)) return document.getElementById(id);
  const tag = document.createElement('style');
  tag.id = id;
  tag.textContent = css;
  document.head.appendChild(tag);
  return tag;
};

/* ---------------- settings bridge ----------------
   The lobby module owns the real store; these defaults keep other systems safe
   when the lobby is disabled (tests, file:// probes, reduced builds). */
BC.settings = BC.settings || {
  get sensitivity() { return 1; },
  get crosshair() { return 'cross'; },
  get theme() { return 'redblue'; },
  get volume() { return 0.8; },
  get muted() { return false; },
  getWeaponSensitivity: function () { return 1; },
  get: function () { return undefined; },
  set: function () { return undefined; },
  onChange: function () { return function () {}; }
};

/** Base look × one selected weapon/phase multiplier. No FOV scaling is applied
    a second time here; ADS tuning remains an explicit personal setting. */
BC.mouseSensitivity = function (weaponId, aiming) {
  try {
    const settings = (BC.api && BC.api.settings) || BC.settings;
    const raw = Number(settings && settings.sensitivity);
    const base = BC.clamp(Number.isFinite(raw) && raw > 0 ? raw : 1, 0.25, 3);
    let multiplier = 1;
    if (weaponId && settings && typeof settings.getWeaponSensitivity === 'function') {
      const value = Number(settings.getWeaponSensitivity(weaponId, !!aiming));
      if (Number.isFinite(value) && value > 0) multiplier = BC.clamp(value, 0.35, 2.5);
    }
    return BC.clamp(base * multiplier, 0.0875, 7.5);
  } catch (e) { return 1; }
};
