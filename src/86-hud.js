/* Blockcraft Battle Ground — Compact Tactical HUD, Voxel Arcade skin.
   Approved compact geometry, 4px spacing and large tabular FPS/ping stay intact.
   Ink/navy panels, saturated red/blue, square bevels and bold system display type.
   87 owns genuine terrain; only its frame is styled here. No new aim chrome.
   Load after 85-scoreboard.js, before 87-minimap.js and 90-net.js.
   This module owns presentation and one 500ms score/ping poll, not gameplay,
   fuel/ride/reload clocks, kill confirmation, pointer lock, or camera hooks. */
'use strict';

(function () {
  var hudBC = window.BC;
  if (!hudBC || !hudBC.api || typeof hudBC.el !== 'function' || typeof hudBC.style !== 'function') return;
  if (hudBC.api.hud) return;

  var hudNodes = null;
  var hudPollTimer = 0;
  var hudReadAt = -Infinity;
  var hudMatchKey = '';
  var hudPingKey = '';
  var hudFpsText = '--';
  var hudReadoutKey = '';
  var hudState = {
    layout: 'combat', started: false, visible: false, busy: false, alive: null,
    scoped: false, riding: false, mode: null, team: null, teams: true,
    red: null, blue: null, ping: null, online: false, connected: false,
    networkStatus: 'solo', fps: null, health: null, ammo: null, fuel: null
  };
  var hudModeNames = {
    tdm: ['Team Deathmatch', 'TDM'], ffa: ['Free For All', 'FFA'],
    snipers: ['Snipers', 'SNP'], shotguns: ['Shotguns', 'SHG'], lockdown: ['Lockdown', 'LCK'],
    gungame: ['Gun Game', 'GUN'], moon: ['Low Gravity', 'LOW-G'], hardcore: ['Hardcore', 'HC'], sidearms: ['Sidearms', 'SIDE']
  };

  hudBC.style('bc-compact-hud-v2', `
    :root {
      --bc-red: #ff3b4a; --bc-blue: #338bff;
      --bc-red-fill: #ce2038; --bc-red-hover: #db263f;
      --bc-blue-fill: #165bd8; --bc-blue-hover: #236bea;
      --bc-accent: var(--bc-blue); --bc-accent-fill: var(--bc-blue-fill);
      --bc-ink: #f7faff; --bc-dim: #bdceed;
      --bc-line: #36537b; --bc-line-strong: #6584b1;
      --bc-panel: #101e3a; --bc-surface: #162b4b; --bc-surface-hover: #1c385f;
      --bc-glass: #101e3a; --bc-glass-deep: #09152b; --bc-edge: #060e1e;
      --bc-radius: 2px;
      --bc-panel-bevel: inset 0 1px 0 rgba(201,225,255,.16), 0 3px 0 var(--bc-edge);
      --bc-control-bevel: inset 0 2px 0 rgba(255,255,255,.17), inset 0 -2px 0 rgba(4,12,27,.28), 0 2px 0 var(--bc-edge);
      --bc-display-font: "Arial Black", Impact, "Segoe UI", Arial, sans-serif;
      --bc-ui-font: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
      --bc-hud-font: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }
    body.bc-compact-hud {
      --bc-hud-cards-bottom: max(16px, env(safe-area-inset-bottom, 0px));
      --bc-hud-strip-bottom: max(16px, env(safe-area-inset-bottom, 0px));
      --bc-map-left: 16px; --bc-map-top: 72px; --bc-map-size: 156px;
      --bc-hud-right-lane: 240px; --bc-hud-room-top: 72px; --bc-hud-feed-top: 108px;
    }
    body.bc-compact-hud :is(#hud, #stats, #teamScore, #pingChip, #roomBadge,
      #hotbar, #killfeed, #jetFuel, #dragonRideHud, #dragonRidePrompt,
      #killBanner, #killcamCard, #combatLoadout, #toast, #death) {
      font-family: var(--bc-hud-font); font-variant-numeric: tabular-nums lining-nums;
      color: var(--bc-ink); text-shadow: none;
    }
    body.bc-compact-hud :is(#hud, #hud *, #stats, #stats *, #teamScore, #teamScore *, #pingChip, #pingChip *,
      #hotbar, #hotbar *, #jetFuel, #jetFuel *, #dragonRideHud, #dragonRideHud *,
      #dragonRidePrompt, #killBanner, #killBanner *, #killcamCard, #killcamCard *) {
      box-sizing: border-box;
    }
    body.bc-compact-hud :is(#stats, #teamScore, #pingChip, #healthWrap, #weaponHud,
      #buildHud, #hotbar, #jetFuel, #dragonRideHud, #dragonRidePrompt, #toast) {
      background: var(--bc-panel); border: 1px solid var(--bc-line-strong);
      border-radius: var(--bc-radius); box-shadow: var(--bc-panel-bevel); backdrop-filter: none; -webkit-backdrop-filter: none;
    }
    body.bc-compact-hud #hud { transition: none; }
    body.bc-compact-hud.started.build #hud #weaponHud,
    body.bc-compact-hud.started.quick-build #weaponHud,
    body.bc-compact-hud.started.build #healthWrap { opacity: 1; }
    body.bc-compact-hud[data-bc-hud-visible="false"] :is(#hud, #stats, #teamScore,
      #pingChip, #killfeed, #hotbar, #jetFuel, #combatLoadout, #dragonRidePrompt,
      #dragonRideHud, #killBanner, #killcamCard) {
      visibility: hidden;
    }

    /* 05's three existing IDs become two surfaces: score/mode/team and ping. */
    body.bc-compact-hud #teamScore {
      position: fixed; left: 50%; right: auto; top: 16px; z-index: 5;
      width: 264px; height: 44px; transform: translateX(-50%);
      display: grid; grid-template-columns: 1fr 96px 1fr; overflow: hidden;
      font-size: 10px; line-height: 12px; letter-spacing: 0; pointer-events: none;
    }
    body.bc-compact-hud #teamScore .ts-side {
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      gap: 0; min-width: 0; padding: 2px 6px; box-shadow: none;
    }
    body.bc-compact-hud #teamScore .ts-side.red { border-top: 1px solid var(--bc-red); background: var(--bc-red-fill); }
    body.bc-compact-hud #teamScore .ts-side.blue { border-top: 1px solid var(--bc-blue); background: var(--bc-blue-fill); }
    body.bc-compact-hud #teamScore .ts-side b {
      order: 0; font-family: var(--bc-display-font); font-size: 24px; line-height: 24px; font-weight: 900;
      letter-spacing: -.04em; color: var(--bc-ink);
    }
    body.bc-compact-hud #teamScore .ts-tag {
      order: 1; font-size: 9px; line-height: 10px; letter-spacing: .08em; text-transform: uppercase;
    }
    body.bc-compact-hud #teamScore .red .ts-tag,
    body.bc-compact-hud #teamScore .blue .ts-tag { color: var(--bc-ink); }
    body.bc-compact-hud #matchChip {
      position: static; inset: auto; z-index: auto; width: auto; height: auto; max-width: none;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      gap: 2px; padding: 0 4px; min-width: 0; transform: none;
      background: transparent; border: 0; border-inline: 1px solid var(--bc-line);
      border-radius: 0; box-shadow: none; font-size: 11px; letter-spacing: 0; pointer-events: none;
    }
    body.bc-compact-hud #teamScoreMode { display: block; line-height: 14px; }
    body.bc-compact-hud #matchMode { font-size: 11px; line-height: 14px; font-weight: 600; }
    body.bc-compact-hud #matchTeam { font-size: 9px; line-height: 11px; color: var(--bc-dim); white-space: nowrap; }
    body.bc-compact-hud #matchTeam.red { color: var(--bc-red); }
    body.bc-compact-hud #matchTeam.blue { color: var(--bc-blue); }
    body.bc-compact-hud #teamScore .ts-meter,
    body.bc-compact-hud #matchChip .mc-bar,
    body.bc-compact-hud #matchChip .mc-sep,
    body.bc-compact-hud #pingChip .bc-bars { display: none; }
    body.bc-compact-hud #pingChip {
      position: fixed; right: 16px; top: 16px; z-index: 5; width: 184px; height: 48px;
      display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: 14px 22px;
      align-content: center; align-items: center; gap: 2px 8px;
      padding: 4px 10px; pointer-events: none; letter-spacing: 0;
      border-top-color: var(--bc-accent); box-shadow: inset 0 2px 0 var(--bc-accent), 0 3px 0 var(--bc-edge);
    }
    body.bc-compact-hud #pingLabel { grid-column: 1; grid-row: 1; }
    body.bc-compact-hud :is(#pingLabel, #fpsLabel) {
      font-size: 12px; line-height: 14px; font-weight: 600; color: var(--bc-dim); letter-spacing: .04em;
    }
    body.bc-compact-hud #pingMs {
      grid-column: 1 / -1; grid-row: 2; min-width: 0;
      font-size: 20px; line-height: 22px; font-weight: 700; white-space: nowrap; color: var(--bc-ink);
    }
    body.bc-compact-hud #pingNet {
      grid-column: 2; grid-row: 1; min-width: 0; max-width: 80px; padding: 0; border: 0;
      color: var(--bc-dim); font-size: 12px; line-height: 14px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right;
    }
    body.bc-compact-hud #pingChip.bad #pingMs { color: var(--bc-red); }
    body.bc-compact-hud #pingChip.offline #pingMs { color: var(--bc-dim); }

    /* FPS only. Room copying remains the network owner's existing click seam. */
    body.bc-compact-hud #stats {
      position: fixed; left: 16px; top: 16px; width: 156px; height: 48px; max-width: none;
      display: grid; grid-template-rows: 14px 22px; align-content: center; gap: 2px;
      padding: 4px 10px; letter-spacing: 0; white-space: nowrap; pointer-events: none;
      border-top-color: var(--bc-accent); box-shadow: inset 0 2px 0 var(--bc-accent), 0 3px 0 var(--bc-edge);
    }
    body.bc-compact-hud #fpsValue {
      display: block; font-size: 20px; line-height: 22px; font-weight: 700; color: var(--bc-ink);
    }
    body.bc-compact-hud #roomBadge {
      left: auto; right: 16px; top: var(--bc-hud-room-top); transform: none;
      width: var(--bc-hud-right-lane); height: 28px;
      padding: 0 8px; display: flex; align-items: center; gap: 4px; box-sizing: border-box;
      border: 1px solid var(--bc-line-strong); border-radius: var(--bc-radius); background: var(--bc-panel);
      box-shadow: var(--bc-panel-bevel); backdrop-filter: none; font-size: 0; letter-spacing: 0;
    }
    body.bc-compact-hud #roomBadge.hidden { display: none; }
    body.bc-compact-hud #roomBadge::before { content: "ROOM"; font-size: 11px; color: var(--bc-dim); }
    body.bc-compact-hud #roomBadge::after { content: "COPY"; margin-left: auto; font-size: 11px; color: var(--bc-dim); }
    body.bc-compact-hud #roomBadge b {
      min-width: 0; font-size: 12px; line-height: 18px; letter-spacing: 0; color: var(--bc-ink);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    body.bc-compact-hud #roomBadge .dot { display: none; box-shadow: none; }
    body.bc-compact-hud #roomBadge:focus-visible { outline: 2px solid var(--bc-ink); outline-offset: 2px; }

    /* Frame and labels only: never tint, filter or replace the terrain canvas. */
    body.bc-compact-hud #minimap {
      background: var(--bc-glass-deep); border-color: var(--bc-blue); border-radius: var(--bc-radius);
      color: var(--bc-ink); box-shadow: var(--bc-panel-bevel); font-family: var(--bc-hud-font);
    }
    body.bc-compact-hud #minimap :is(#minimapTitle, #minimapRange, #minimapNorth, #minimapSeed),
    body.bc-compact-hud #minimap .bc-mini-line > span,
    body.bc-compact-hud #minimapLegend > .bc-mini-legend-key { background: var(--bc-glass-deep); }
    body.bc-compact-hud #minimap #minimapTitle { background: var(--bc-blue-fill); color: var(--bc-ink); }

    body.bc-compact-hud #healthWrap {
      left: 16px; bottom: var(--bc-hud-cards-bottom); width: 176px; height: 100px;
      display: grid; grid-template-rows: 12px 32px 4px 12px;
      align-content: center; gap: 4px; padding: 10px;
      border-top-color: var(--bc-red); box-shadow: inset 0 2px 0 var(--bc-red), 0 3px 0 var(--bc-edge);
    }
    body.bc-compact-hud #healthWrap::before { content: none; }
    body.bc-compact-hud .bc-health-label { font-family: var(--bc-ui-font); font-size: 10px; line-height: 12px; font-weight: 800; color: var(--bc-ink); letter-spacing: .08em; }
    body.bc-compact-hud #healthNum {
      position: static; inset: auto; font-family: var(--bc-display-font); font-size: 32px; line-height: 32px; font-weight: 900;
      letter-spacing: -.04em; color: var(--bc-ink);
    }
    body.bc-compact-hud #healthBar { height: 4px; border: 0; border-radius: 0; background: var(--bc-line); }
    body.bc-compact-hud #healthBar i { border-radius: 0; background: var(--bc-blue); box-shadow: none; transition: none; }
    body.bc-compact-hud #healthBar i.low { background: var(--bc-red); box-shadow: none; }
    body.bc-compact-hud #kd { margin: 0; font-size: 10px; line-height: 12px; color: var(--bc-dim); letter-spacing: .02em; }
    body.bc-compact-hud #weaponHud {
      right: 16px; bottom: var(--bc-hud-cards-bottom); width: 176px; min-width: 0; max-width: 176px;
      height: 100px; display: grid; grid-template-rows: 12px 40px 2px 16px;
      align-content: center; gap: 4px; padding: 8px; text-align: right; transition: none;
      border-top-color: var(--bc-blue); box-shadow: inset 0 2px 0 var(--bc-blue), 0 3px 0 var(--bc-edge);
    }
    body.bc-compact-hud #weaponName {
      font-family: var(--bc-ui-font); font-size: 10px; line-height: 12px; font-weight: 800; color: var(--bc-ink); letter-spacing: .04em;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    body.bc-compact-hud #ammoLine {
      display: flex; align-items: baseline; justify-content: flex-end; gap: 6px;
      height: 40px; min-width: 0; margin: 0; font-size: 40px; line-height: 40px;
      font-family: var(--bc-display-font); font-weight: 900; letter-spacing: -.04em; text-shadow: none;
    }
    body.bc-compact-hud #ammoNow { font-size: 40px; line-height: 40px; }
    body.bc-compact-hud #ammoLine span { font-family: var(--bc-hud-font); font-size: 12px; line-height: 18px; color: var(--bc-dim); opacity: 1; letter-spacing: 0; }
    body.bc-compact-hud #ammoLine.low b { color: var(--bc-red); }
    body.bc-compact-hud #reloadBar { margin: 0; height: 2px; border-radius: 1px; background: var(--bc-line); opacity: 1; }
    body.bc-compact-hud #reloadFill { background: var(--bc-blue); box-shadow: none; }
    body.bc-compact-hud #reloadBar:not(.on) #reloadFill { visibility: hidden; }
    body.bc-compact-hud #weaponDots { height: 16px; margin: 0; gap: 4px; }
    body.bc-compact-hud #weaponDots > * {
      flex: 0 0 16px; width: 16px; min-width: 0; max-width: 16px; height: 16px;
      border: 1px solid var(--bc-line-strong); border-radius: 1px; background: var(--bc-surface);
      color: var(--bc-dim); font-size: 9px; line-height: 14px; font-style: normal;
      box-shadow: none; transition: none;
    }
    body.bc-compact-hud #weaponDots > .on { border-color: var(--bc-blue); color: var(--bc-ink); background: var(--bc-blue-fill); box-shadow: inset 0 1px 0 rgba(255,255,255,.2); }

    /* All nine blocks remain visible. Real blueprint hints may wrap to 2 lines
       instead of being truncated; narrow displays reserve 80px above the bar. */
    body.bc-compact-hud #hotbar {
      bottom: var(--bc-hud-strip-bottom); width: min(348px, calc(100vw - 32px)); height: 44px;
      align-items: center; gap: 4px; padding: 4px;
    }
    body.bc-compact-hud #hotbar .slot {
      flex: 1 1 0; min-width: 0; width: auto; height: 34px; border: 1px solid var(--bc-line);
      border-radius: 1px; background: var(--bc-surface); transform: none; transition: none;
      box-shadow: inset 0 1px 0 rgba(201,225,255,.12);
    }
    body.bc-compact-hud #hotbar .slot.active { border-color: var(--bc-blue); background: var(--bc-blue-fill); transform: none; box-shadow: inset 0 2px 0 rgba(255,255,255,.2); }
    body.bc-compact-hud #hotbar .slot canvas { width: 22px; height: 22px; }
    body.bc-compact-hud #hotbar .slot .num { left: 3px; top: 1px; font-size: 9px; color: var(--bc-dim); }
    body.bc-compact-hud #hotbar .slot.active .num { color: var(--bc-ink); }
    body.bc-compact-hud #hotbar .slot .count { font-size: 9px; text-shadow: none; }
    body.bc-compact-hud #buildHud {
      bottom: calc(var(--bc-hud-strip-bottom) + 52px); width: min(348px, calc(100vw - 32px));
      min-height: 44px; padding: 6px 8px; grid-template-columns: minmax(0, 1fr) minmax(0, 57%);
      grid-template-rows: auto auto; gap: 4px 8px; line-height: 12px;
    }
    body.bc-compact-hud #buildPiece { font-family: var(--bc-ui-font); font-size: 11px; line-height: 14px; font-weight: 800; letter-spacing: .02em; overflow-wrap: anywhere; }
    body.bc-compact-hud #buildCost { min-width: 0; font-size: 9px; line-height: 12px; color: var(--bc-dim); text-align: right; overflow-wrap: anywhere; }
    body.bc-compact-hud #buildHint { font-size: 9px; line-height: 12px; color: var(--bc-dim); letter-spacing: 0; text-wrap: pretty; overflow-wrap: anywhere; }
    body.bc-compact-hud #buildHud.ready, body.bc-compact-hud #buildHud.complete { border-color: var(--bc-blue); box-shadow: inset 3px 0 0 var(--bc-blue), 0 3px 0 var(--bc-edge); }
    body.bc-compact-hud #buildHud.blocked { border-color: var(--bc-red); box-shadow: inset 3px 0 0 var(--bc-red), 0 3px 0 var(--bc-edge); }
    body.bc-compact-hud #buildHud.blocked #buildHint,
    body.bc-compact-hud #buildHud.blocked[data-reason="materials"] #buildCost { color: var(--bc-ink); }

    /* 52 remains the only fuel writer. Keep its boost/dash/descent hints. */
    body.bc-compact-hud #jetFuel, body.bc-compact-hud.quick-build #jetFuel {
      left: 16px; bottom: calc(var(--bc-hud-cards-bottom) + 108px); transform: none;
      width: 176px; min-width: 0; max-width: 176px; min-height: 28px; height: auto;
      display: grid; grid-template-rows: auto 2px auto; gap: 4px; padding: 4px 8px;
      font-size: 9px; line-height: 12px; letter-spacing: .02em; transition: none;
    }
    body.bc-compact-hud #jetFuel .bc-jet-label { font-size: 9px; line-height: 12px; color: var(--bc-ink); letter-spacing: 0; }
    body.bc-compact-hud #jetFuel .bc-jet-bar { height: 2px; margin: 0; gap: 2px; }
    body.bc-compact-hud #jetFuel .bc-jet-seg { background: var(--bc-line); box-shadow: none; }
    body.bc-compact-hud #jetFuel .bc-jet-seg.on { background: var(--bc-blue); box-shadow: none; }
    body.bc-compact-hud #jetFuel.low .bc-jet-seg.on { background: var(--bc-red); box-shadow: none; }
    body.bc-compact-hud #jetFuel .bc-jet-hint { margin: 0; font-size: 8.5px; line-height: 10px; letter-spacing: 0; color: var(--bc-dim); text-wrap: pretty; }

    /* 46 owns visibility, heat and time. One rider strip replaces construction. */
    body.bc-compact-hud #dragonRideHud {
      --dr-ember: var(--bc-blue); bottom: var(--bc-hud-strip-bottom); z-index: 6;
      width: min(348px, calc(100vw - 32px)); height: 76px; gap: 4px; padding: 8px;
      transform: translateX(-50%); transition: none;
    }
    body.bc-compact-hud #dragonRideHud .dr-top { min-height: 14px; gap: 4px; }
    body.bc-compact-hud #dragonRideHud .dr-dot { display: none; animation: none; box-shadow: none; }
    body.bc-compact-hud #dragonRideName { min-width: 0; font-size: 11px; line-height: 14px; letter-spacing: .02em; color: var(--bc-ink); }
    body.bc-compact-hud #dragonRideSpeed { font-size: 9px; line-height: 12px; letter-spacing: 0; color: var(--bc-dim); white-space: nowrap; }
    body.bc-compact-hud #dragonRideTimer { min-width: 40px; font-size: 12px; line-height: 14px; letter-spacing: 0; color: var(--bc-blue); }
    body.bc-compact-hud #dragonRideTimer.low { color: var(--bc-red); animation: none; }
    body.bc-compact-hud #dragonRideHud .dr-heat-row { height: 10px; gap: 8px; }
    body.bc-compact-hud #dragonRideHud .dr-heat-label { font-size: 8px; line-height: 10px; letter-spacing: .04em; color: var(--bc-dim); }
    body.bc-compact-hud #dragonRideHud .dr-heat { height: 2px; border: 0; background: var(--bc-line); }
    body.bc-compact-hud #dragonRideHeatFill { background: var(--bc-blue); box-shadow: none; transition: none; }
    body.bc-compact-hud #dragonRideHeatFill.hot { background: var(--bc-red); }
    body.bc-compact-hud #dragonRideHeatText { min-width: 42px; font-size: 8px; line-height: 10px; letter-spacing: 0; color: var(--bc-dim); }
    body.bc-compact-hud #dragonRideOverheat { font-size: 8px; line-height: 10px; letter-spacing: .02em; color: var(--bc-red); }
    body.bc-compact-hud #dragonRideHud .dr-foot { font-size: 8px; line-height: 10px; letter-spacing: 0; gap: 4px; color: var(--bc-dim); }
    body.bc-compact-hud #dragonRideHud .dr-foot b { color: var(--bc-ink); }
    body.bc-compact-hud #dragonRidePrompt {
      --dr-ember: var(--bc-blue); top: auto; bottom: 132px; z-index: 6;
      max-width: min(300px, calc(100vw - 32px)); transform: translateX(-50%);
      padding: 6px 8px; gap: 6px; font-size: 10px; line-height: 14px; letter-spacing: .02em;
    }
    body.bc-compact-hud #dragonRidePrompt .dr-key { min-width: 20px; height: 20px; padding: 0 4px; font-size: 10px; border-radius: 1px; color: var(--bc-ink); background: var(--bc-blue-fill); box-shadow: inset 0 1px 0 rgba(255,255,255,.2); }
    body.bc-compact-hud #dragonRidePrompt .dr-pname { color: var(--bc-blue); font-size: 10px; letter-spacing: 0; }
    body.bc-compact-hud #combatLoadout {
      bottom: var(--bc-hud-strip-bottom); max-width: min(348px, calc(100vw - 32px));
      font-family: var(--bc-hud-font); font-size: 9px; letter-spacing: .02em;
    }
    body.bc-compact-hud #combatLoadout .lo-chip { background: var(--bc-panel); border-color: var(--bc-line-strong); border-radius: var(--bc-radius); box-shadow: var(--bc-panel-bevel); backdrop-filter: none; }
    body.bc-compact-hud[data-bc-hud-layout="build"] #combatLoadout,
    body.bc-compact-hud[data-bc-hud-layout="riding"] :is(#combatLoadout, #hotbar, #buildHud, #jetFuel) { display: none !important; }

    /* Confirmation is transient and still owned by 62. Nothing new at the aim. */
    body.bc-compact-hud #killBanner {
      top: max(72px, calc(50% - 176px)); width: min(480px, calc(100vw - 32px)); z-index: 7;
      font-family: var(--bc-hud-font);
    }
    body.bc-compact-hud #killBanner .kb-card {
      --kb-accent2: var(--bc-blue); padding: 12px 16px; background: var(--bc-panel);
      border: 1px solid var(--bc-line-strong); border-radius: var(--bc-radius); box-shadow: var(--bc-panel-bevel);
    }
    body.bc-compact-hud #killBanner.show .kb-card { animation: none; }
    body.bc-compact-hud #killBanner .kb-kicker { margin-bottom: 4px; font-size: 10px; line-height: 12px; letter-spacing: .1em; }
    body.bc-compact-hud #killBanner .kb-name,
    body.bc-compact-hud #killBanner[data-mode="death"] .kb-name {
      font-family: var(--bc-display-font); font-size: 44px; line-height: 46px; letter-spacing: -.04em; text-shadow: none;
    }
    body.bc-compact-hud #killBanner .kb-meta { gap: 4px; margin-top: 8px; }
    body.bc-compact-hud #killBanner .kb-tag { padding: 2px 5px; font-size: 9px; line-height: 12px; letter-spacing: .02em; border-radius: 1px; background: var(--bc-surface); border-color: var(--bc-line-strong); color: var(--bc-ink); }
    body.bc-compact-hud #killBanner .kb-tag.kb-hs { background: var(--bc-red-fill); color: var(--bc-ink); border-color: var(--bc-red); }
    body.bc-compact-hud #killBanner .kb-bar { height: 2px; background: var(--bc-line); }
    body.bc-compact-hud #killfeed {
      top: var(--bc-hud-feed-top); right: 16px; width: var(--bc-hud-right-lane);
      max-width: var(--bc-hud-right-lane); max-height: 112px; gap: 4px; overflow: hidden;
    }
    body.bc-compact-hud #killfeed .kf {
      min-width: 0; max-width: 100%; display: flex; align-items: center; gap: 4px; padding: 4px 6px;
      border: 1px solid var(--bc-line); border-radius: var(--bc-radius); background: var(--bc-panel);
      font-size: 14px; line-height: 18px; font-weight: 400; letter-spacing: 0; white-space: nowrap;
      box-shadow: var(--bc-panel-bevel); backdrop-filter: none; animation: none;
    }
    body.bc-compact-hud #killfeed .kf b { min-width: 0; font-weight: 600; }
    body.bc-compact-hud #killfeed :is(.kf-k, .kf-v) { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--bc-ink); }
    body.bc-compact-hud #killfeed :is(.kf-k.kf-red, .kf-v.kf-red) { color: var(--bc-red); }
    body.bc-compact-hud #killfeed :is(.kf-k.kf-blue, .kf-v.kf-blue) { color: var(--bc-blue); }
    body.bc-compact-hud #killfeed :is(.kf-x, .kf-hs) { flex: none; padding: 0 3px; font-size: 8px; line-height: 14px; letter-spacing: 0; border-radius: 3px; border-color: var(--bc-line); background: transparent; color: var(--bc-dim); }
    body.bc-compact-hud #killfeed .kf-hs { color: var(--bc-red); }
    body.bc-compact-hud #hitConfirm { font-family: var(--bc-hud-font); color: var(--bc-ink); font-size: 12px; letter-spacing: .04em; text-shadow: none; }
    body.bc-compact-hud #hitConfirm.hc-head { color: var(--bc-red); }
    body.bc-compact-hud #hitConfirm.hc-kill { color: var(--bc-blue); font-size: 12px; letter-spacing: .04em; }
    body.bc-compact-hud #damageDir .dd-arc { box-shadow: none; }
    body.bc-compact-hud #damageDir .dd-arc::after { filter: none; }

    body.bc-compact-hud #toast,
    body.bc-compact-hud.build #toast,
    body.bc-compact-hud.quick-build #toast { bottom: calc(var(--bc-hud-cards-bottom) + 108px); font-size: 11px; letter-spacing: .02em; }
    body.bc-compact-hud #killcamCard {
      bottom: calc(var(--bc-hud-cards-bottom) + 108px); width: min(480px, calc(100vw - 32px));
      padding: 12px 16px; background: var(--bc-panel); border: 1px solid var(--bc-line);
      border-radius: var(--bc-radius); box-shadow: var(--bc-panel-bevel); backdrop-filter: none; transition: none;
    }
    body.bc-compact-hud #killcamCard.show, body.bc-compact-hud #killcamCard.dismiss { transform: translateX(-50%); transition: none; }
    body.bc-compact-hud #killcamKiller { font-family: var(--bc-display-font); font-size: 44px; line-height: 46px; letter-spacing: -.04em; color: var(--bc-ink); text-shadow: none; overflow-wrap: anywhere; }
    body.bc-compact-hud #killcamCard :is(.killcam-eyebrow, .killcam-meta, .killcam-watch) { font-size: 10px; line-height: 12px; letter-spacing: .04em; color: var(--bc-dim); }
    body.bc-compact-hud #killcamCard .killcam-dot { background: var(--bc-blue); box-shadow: none; animation: none; }
    body.bc-compact-hud #killcamCard .killcam-progress i { background: var(--bc-blue); }
    body.bc-compact-hud #death h2 { font-family: var(--bc-display-font); font-size: 44px; letter-spacing: -.04em; color: var(--bc-ink); text-shadow: none; }
    body.bc-compact-hud #death p { color: var(--bc-dim); letter-spacing: .04em; }
    body.bc-compact-hud #death b { color: var(--bc-red); }
    body.bc-compact-hud .scoreboard-panel { background: var(--bc-panel); border: 1px solid var(--bc-line-strong); border-radius: var(--bc-radius); box-shadow: var(--bc-panel-bevel); }
    body.bc-compact-hud #scoreboard :is(th, td, .scoreboard-head, .scoreboard-foot) { border-color: var(--bc-line); }
    body.bc-compact-hud #scoreboard th { background: var(--bc-surface); color: var(--bc-dim); }
    body.bc-compact-hud #scoreboard .is-local { background: var(--bc-blue-fill); box-shadow: inset 3px 0 0 var(--bc-blue); }
    body.bc-compact-hud #scoreboard .is-local td { color: var(--bc-ink); }
    #hudAnnouncer { position: fixed; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; pointer-events: none; }

    @media (max-width: 860px) {
      body.bc-compact-hud[data-bc-hud-layout="build"] { --bc-hud-cards-bottom: calc(var(--bc-hud-strip-bottom) + 136px); }
      body.bc-compact-hud[data-bc-hud-layout="riding"] { --bc-hud-cards-bottom: calc(var(--bc-hud-strip-bottom) + 84px); }
      body.bc-compact-hud #healthWrap,
      body.bc-compact-hud #jetFuel, body.bc-compact-hud.quick-build #jetFuel { width: 144px; max-width: 144px; }
      body.bc-compact-hud #jetFuel .bc-jet-label { white-space: normal; }
    }
    /* The top row needs 680px to separate the larger readouts from the score.
       Below that, reserve a right-hand lane alongside the unchanged minimap. */
    @media (max-width: 700px) {
      body.bc-compact-hud {
        --bc-hud-right-lane: min(240px, calc(100vw - 196px));
        --bc-hud-room-top: 124px; --bc-hud-feed-top: 160px;
      }
      body.bc-compact-hud #teamScore {
        left: auto; right: 16px; top: 72px; width: var(--bc-hud-right-lane); transform: none;
        grid-template-columns: 1fr 82px 1fr;
      }
      body.bc-compact-hud #pingChip { width: var(--bc-hud-right-lane); }
    }
    @media (max-width: 560px) {
      body.bc-compact-hud { --bc-map-size: 112px; --bc-hud-right-lane: min(240px, calc(100vw - 152px)); }
      body.bc-compact-hud #stats { width: 112px; }
      body.bc-compact-hud :is(#pingMs, #fpsValue) { font-size: 18px; }
      body.bc-compact-hud #teamScore .ts-side { padding-inline: 2px; }
      body.bc-compact-hud #roomBadge { padding-inline: 8px; }
      body.bc-compact-hud #killfeed .kf { font-size: 14px; line-height: 18px; }
      body.bc-compact-hud #killBanner { top: max(196px, calc(50% - 168px)); }
      body.bc-compact-hud #killBanner .kb-name,
      body.bc-compact-hud #killBanner[data-mode="death"] .kb-name { font-size: 32px; line-height: 34px; }
      body.bc-compact-hud #killcamKiller { font-size: 32px; line-height: 34px; }
      body.bc-compact-hud #dragonRidePrompt { left: auto; right: 16px; bottom: calc(var(--bc-hud-cards-bottom) + 108px); width: 176px; max-width: 176px; transform: none; }
      body.bc-compact-hud #toast,
      body.bc-compact-hud.build #toast,
      body.bc-compact-hud.quick-build #toast { bottom: calc(var(--bc-hud-cards-bottom) + 168px); }
    }
    @media (max-width: 380px) {
      body.bc-compact-hud #teamScore { grid-template-columns: 1fr 70px 1fr; }
      body.bc-compact-hud #healthWrap,
      body.bc-compact-hud #jetFuel, body.bc-compact-hud.quick-build #jetFuel { width: min(144px, calc(50vw - 24px)); }
      body.bc-compact-hud #weaponHud { width: min(176px, calc(50vw - 24px)); }
      body.bc-compact-hud #weaponDots { gap: 2px; }
    }
    @media (prefers-reduced-motion: reduce) {
      body.bc-compact-hud :is(#hud, #weaponHud, #toast, #hitConfirm, #killcamCard, #dragonRideHud) { transition: none; }
      body.bc-compact-hud #killBanner .kb-bar i { animation: none !important; }
    }
  `);

  function hudText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }
  function hudNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  }
  function hudEnsureNode(id, tag, parent, attrs) {
    var node = document.getElementById(id);
    if (node) return node;
    attrs = attrs || {};
    attrs.id = id;
    node = hudBC.el(tag, attrs);
    parent.appendChild(node);
    return node;
  }
  function hudEnsureDOM() {
    if (hudNodes) return true;
    if (!document.body) return false;
    var body = document.body;
    var score = hudEnsureNode('teamScore', 'div', body, { role: 'group', 'aria-label': 'Match score' });
    var redSide = score.querySelector('.ts-side.red');
    var blueSide = score.querySelector('.ts-side.blue');
    if (!redSide) { redSide = hudBC.el('div', { className: 'ts-side red' }); score.appendChild(redSide); }
    if (!blueSide) { blueSide = hudBC.el('div', { className: 'ts-side blue' }); score.appendChild(blueSide); }
    var red = hudEnsureNode('teamScoreRed', 'b', redSide, { text: '--' });
    var blue = hudEnsureNode('teamScoreBlue', 'b', blueSide, { text: '--' });
    var redTag = redSide.querySelector('.ts-tag');
    var blueTag = blueSide.querySelector('.ts-tag');
    if (!redTag) { redTag = hudBC.el('span', { className: 'ts-tag', text: 'RED' }); redSide.appendChild(redTag); }
    if (!blueTag) { blueTag = hudBC.el('span', { className: 'ts-tag', text: 'BLUE' }); blueSide.appendChild(blueTag); }

    var chip = hudEnsureNode('matchChip', 'div', score, { role: 'group', 'aria-label': 'Mode and your team' });
    var mode = hudEnsureNode('matchMode', 'b', chip, { text: '--' });
    var team = hudEnsureNode('matchTeam', 'span', chip, { text: '--' });
    var modeWrap = hudEnsureNode('teamScoreMode', 'span', chip);
    var oldMid = modeWrap.parentElement;
    // Move existing nodes rather than cloning IDs or replacing owners' handles.
    if (!modeWrap.contains(mode)) {
      while (modeWrap.firstChild) modeWrap.removeChild(modeWrap.firstChild);
      modeWrap.appendChild(mode);
    }
    chip.insertBefore(modeWrap, chip.firstChild);
    chip.appendChild(team);
    chip.classList.add('ts-mid');
    score.insertBefore(chip, blueSide);
    if (oldMid && oldMid !== chip && oldMid.classList.contains('ts-mid') && !oldMid.firstChild) oldMid.remove();
    score.setAttribute('role', 'group');
    score.setAttribute('aria-live', 'off');
    chip.setAttribute('role', 'group');
    chip.setAttribute('aria-live', 'off');

    var ping = hudEnsureNode('pingChip', 'div', body, { role: 'status', 'aria-live': 'off' });
    var pingLabel = hudEnsureNode('pingLabel', 'span', ping, { text: 'PING' });
    var pingMs = hudEnsureNode('pingMs', 'span', ping, { text: '--' });
    var pingNet = hudEnsureNode('pingNet', 'span', ping, { text: 'solo' });
    var stats = hudEnsureNode('stats', 'div', body, { role: 'group', 'aria-label': 'Frames per second', 'aria-live': 'off' });
    var fpsLabel = hudEnsureNode('fpsLabel', 'span', stats, { text: 'FPS' });
    var fpsValue = hudEnsureNode('fpsValue', 'b', stats, { text: '--' });
    stats.setAttribute('role', 'group');
    stats.setAttribute('aria-label', 'Frames per second');
    stats.setAttribute('aria-live', 'off');
    // Remove the old boot / debug text once, retaining the one label and value.
    while (stats.firstChild) stats.removeChild(stats.firstChild);
    stats.appendChild(fpsLabel);
    stats.appendChild(fpsValue);
    var healthWrap = document.getElementById('healthWrap');
    var healthNum = document.getElementById('healthNum');
    var healthBar = document.getElementById('healthBar');
    var kd = document.getElementById('kd');
    if (healthWrap) {
      if (!healthWrap.querySelector('.bc-health-label')) {
        healthWrap.insertBefore(hudBC.el('span', { className: 'bc-health-label', text: 'HEALTH' }), healthWrap.firstChild);
      }
      if (healthNum) healthWrap.appendChild(healthNum);
      if (healthBar) healthWrap.appendChild(healthBar);
      if (kd) healthWrap.appendChild(kd);
      healthWrap.setAttribute('role', 'group');
      healthWrap.setAttribute('aria-label', 'Health and kill / death count');
    }
    var room = document.getElementById('roomBadge');
    // The required loader order is before 90 binds its clipboard listener.
    // Upgrade the old div to a native button without changing its ID/content.
    // A late/manual HUD load keeps a network owner's already-bound node intact.
    if (room && room.tagName !== 'BUTTON' && !hudBC.api.net) {
      var roomButton = hudBC.el('button', { type: 'button' });
      for (var a = 0; a < room.attributes.length; a++) {
        roomButton.setAttribute(room.attributes[a].name, room.attributes[a].value);
      }
      while (room.firstChild) roomButton.appendChild(room.firstChild);
      room.replaceWith(roomButton);
      room = roomButton;
    }
    if (room) {
      if (room.tagName === 'BUTTON') { room.type = 'button'; room.removeAttribute('role'); }
      else room.setAttribute('role', 'button');
      room.tabIndex = 0;
      room.setAttribute('aria-label', 'Copy room code');
      if (room.tagName !== 'BUTTON') room.addEventListener('keydown', function (event) {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat && !room.classList.contains('hidden')) {
          event.preventDefault();
          event.stopPropagation();
          room.click(); // 90-net.js retains the only clipboard implementation.
        }
      });
    }
    var announcer = hudEnsureNode('hudAnnouncer', 'div', body, {
      role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true'
    });
    hudNodes = {
      score: score, red: red, blue: blue, redSide: redSide, blueSide: blueSide,
      redTag: redTag, blueTag: blueTag, chip: chip, mode: mode, team: team,
      ping: ping, pingLabel: pingLabel, pingMs: pingMs, pingNet: pingNet,
      stats: stats, fpsLabel: fpsLabel, fpsValue: fpsValue, room: room,
      menu: document.getElementById('hint'), healthWrap: healthWrap,
      weaponHud: document.getElementById('weaponHud'), weaponName: document.getElementById('weaponName'),
      dots: document.getElementById('weaponDots'), announcer: announcer
    };
    body.classList.add('bc-compact-hud');
    return true;
  }

  function hudSyncContext() {
    if (!hudNodes) return;
    var body = document.body;
    var world = hudBC.api.world;
    var riding = hudBC.api.riding;
    var loadingNow = false;
    var building = body.classList.contains('build') || body.classList.contains('quick-build');
    var aliveNow = null;
    // All globals from 90/99 (and optional modules) are reached only lazily.
    try { if (typeof loading !== 'undefined') loadingNow = !!loading; } catch (err) { loadingNow = true; }
    try { if (typeof alive !== 'undefined') aliveNow = !!alive; } catch (err) { /* reduced build */ }
    try {
      if (typeof quickBuild !== 'undefined' && quickBuild && quickBuild.active) building = true;
      if (typeof combatMode !== 'undefined' && combatMode === false) building = true;
    } catch (err) { /* earlier classic-script initialization */ }
    hudState.riding = !!(riding && riding.active);
    hudState.layout = hudState.riding ? 'riding' : building ? 'build' : 'combat';
    hudState.started = body.classList.contains('started');
    hudState.alive = aliveNow;
    hudState.scoped = body.classList.contains('scoped');
    try { hudState.busy = !!((hudBC.flags && hudBC.flags.worldBusy) || (world && world.busy)); }
    catch (err) { hudState.busy = false; }
    var menuOpen = hudNodes.menu && !hudNodes.menu.hidden && !hudNodes.menu.classList.contains('hidden');
    hudState.visible = hudState.started && !menuOpen && !loadingNow && !document.hidden;
    if (body.dataset.bcHudLayout !== hudState.layout) body.dataset.bcHudLayout = hudState.layout;
    var visible = hudState.visible ? 'true' : 'false';
    if (body.dataset.bcHudVisible !== visible) body.dataset.bcHudVisible = visible;
  }

  function hudUpdateMatch(force) {
    if (!hudNodes) return;
    var modes = hudBC.api.modes;
    var match = null;
    var def = null;
    if (modes) {
      try {
        if (typeof modes.matchState === 'function') match = modes.matchState();
        def = modes.activeDef || null;
      } catch (err) { match = null; }
    }
    var id = match && match.mode || modes && modes.active || null;
    var names = id && hudModeNames[id];
    var name = match && match.name || def && def.name || names && names[0] || 'Mode unavailable';
    var short = match && match.short || def && def.short || names && names[1] || '--';
    var teams = match && typeof match.teams === 'boolean' ? match.teams : def ? def.teams !== false : true;
    var scores = match || modes && modes.scores;
    var red = scores ? hudNumber(scores.red) : null;
    var blue = scores ? hudNumber(scores.blue) : null;
    var team = match && match.selfTeam || modes && modes.localTeam || null;
    if (!teams || (team !== 'red' && team !== 'blue')) team = null;
    hudState.mode = id;
    hudState.team = team;
    hudState.teams = teams;
    hudState.red = red == null ? null : Math.floor(red);
    hudState.blue = blue == null ? null : Math.floor(blue);
    var key = id + '|' + red + '|' + blue + '|' + team + '|' + teams + '|' + short;
    if (!force && key === hudMatchKey) return;
    hudMatchKey = key;
    hudText(hudNodes.red, red == null ? '--' : String(Math.floor(red)));
    hudText(hudNodes.blue, blue == null ? '--' : String(Math.floor(blue)));
    hudText(hudNodes.redTag, teams ? 'RED' : 'YOU');
    hudText(hudNodes.blueTag, teams ? 'BLUE' : 'LEAD');
    hudText(hudNodes.mode, String(short));
    hudText(hudNodes.team, team ? team.toUpperCase() + ' TEAM' : teams ? 'UNASSIGNED' : 'NO TEAMS');
    hudNodes.team.classList.toggle('red', team === 'red');
    hudNodes.team.classList.toggle('blue', team === 'blue');
    hudNodes.redSide.classList.toggle('is-you', team === 'red');
    hudNodes.blueSide.classList.toggle('is-you', team === 'blue');
    hudNodes.chip.setAttribute('aria-label', name + ', ' + (team ? 'your team ' + team : teams ? 'team not assigned' : 'no teams'));
    hudNodes.score.setAttribute('aria-label', name + ', ' + (teams ? 'red ' : 'you ') + hudNodes.red.textContent +
      ', ' + (teams ? 'blue ' : 'leader ') + hudNodes.blue.textContent);
  }

  function hudUpdatePing(force) {
    if (!hudNodes) return;
    var connection = hudBC.api.net; // 92 registers after this script.
    var online = false;
    var connected = false;
    var status = 'solo';
    var ms = null;
    if (connection) {
      try {
        online = connection.online === true;
        connected = online && connection.connected !== false;
        if (online && typeof connection.statusText === 'function') {
          var reported = connection.statusText();
          if (typeof reported === 'string' && reported.trim()) status = reported.trim();
        } else if (online) status = 'online';
        if (connected && typeof connection.getPing === 'function') {
          // Null/undefined/empty strings are NOT a measured zero-millisecond RTT.
          var ping = hudNumber(connection.getPing());
          if (ping != null) ms = Math.round(ping);
        }
      } catch (err) { ms = null; }
    }
    if (!online) { status = 'solo'; ms = null; }
    var label = /resync/i.test(status) ? 'resync' : /^mqtt\b/i.test(status) ? 'MQTT'
      : /^lan\b/i.test(status) ? 'LAN' : status;
    hudState.ping = ms;
    hudState.online = online;
    hudState.connected = connected;
    hudState.networkStatus = status;
    var quality = ms == null ? 'offline' : ms < 70 ? 'good' : ms < 140 ? 'warn' : 'bad';
    var key = ms + '|' + status + '|' + connected;
    if (!force && key === hudPingKey) return;
    hudPingKey = key;
    hudText(hudNodes.pingMs, ms == null ? '--' : ms + ' ms');
    hudText(hudNodes.pingNet, label);
    hudNodes.ping.classList.toggle('good', quality === 'good');
    hudNodes.ping.classList.toggle('warn', quality === 'warn');
    hudNodes.ping.classList.toggle('bad', quality === 'bad');
    hudNodes.ping.classList.toggle('offline', quality === 'offline');
    var description = (ms == null ? 'Ping unavailable' : 'Live ping ' + ms + ' milliseconds') + ' · ' + status;
    hudNodes.ping.setAttribute('aria-label', description);
    hudNodes.ping.title = description;
  }

  function hudReadGameplay(force) {
    if (!hudNodes) return;
    var hp = null;
    var ammo = null;
    var jet = hudBC.api.jetpack;
    try { if (typeof health !== 'undefined') hp = hudNumber(health); } catch (err) { /* reduced build */ }
    try {
      if (typeof gun !== 'undefined' && gun && gun.ammo) ammo = hudNumber(gun.ammo[gun.index]);
    } catch (err) { /* reduced build */ }
    hudState.health = hp;
    hudState.ammo = ammo;
    hudState.fuel = jet ? hudNumber(jet.fuel) : null;
    var weapon = hudNodes.weaponName ? hudNodes.weaponName.textContent : '';
    var key = hp + '|' + ammo + '|' + weapon;
    if (force || key !== hudReadoutKey) {
      hudReadoutKey = key;
      if (hudNodes.healthWrap && hp != null) hudNodes.healthWrap.setAttribute('aria-label', 'Health ' + Math.ceil(hp) + ', kill / death count');
      if (hudNodes.weaponHud) hudNodes.weaponHud.setAttribute('aria-label', weapon + (ammo == null ? '' : ', ' + Math.floor(ammo) + ' rounds'));
    }
    // Combat owns the seven nodes and allowed-weapon display. Add their actual
    // key numbers once; do not rebuild dots or bypass mode loadout restrictions.
    if (hudNodes.dots) {
      for (var i = 0; i < hudNodes.dots.children.length; i++) {
        hudText(hudNodes.dots.children[i], String(i + 1));
      }
    }
    if (hudNodes.room) {
      var code = hudNodes.room.querySelector('b');
      var roomLabel = code ? 'Copy room code ' + code.textContent : 'Copy room code';
      if (hudNodes.room.getAttribute('aria-label') !== roomLabel) hudNodes.room.setAttribute('aria-label', roomLabel);
    }
  }

  function hudRefresh() {
    if (!hudEnsureDOM()) return hudApi;
    hudSyncContext();
    hudUpdateMatch(true);
    hudUpdatePing(true);
    hudReadGameplay(true);
    hudSetDiagnostics(hudState.fps);
    return hudApi;
  }
  function hudSetDiagnostics(fps) {
    var value = hudNumber(fps);
    var next = value == null || value === 0 ? null : Math.round(value);
    if (next !== hudState.fps) {
      hudState.fps = next;
      hudFpsText = next == null ? '--' : String(next);
    }
    if (hudNodes) {
      var stats = hudNodes.stats;
      // 99's one-time "ready" text can detach these nodes. Reattach the same
      // cached nodes, rather than allocating labels during ordinary refreshes.
      if (hudNodes.fpsLabel.parentNode !== stats || hudNodes.fpsValue.parentNode !== stats) {
        while (stats.firstChild) stats.removeChild(stats.firstChild);
        stats.appendChild(hudNodes.fpsLabel);
        stats.appendChild(hudNodes.fpsValue);
      }
      hudText(hudNodes.fpsValue, hudFpsText);
    }
    return hudState.fps;
  }
  function hudGetState() {
    // Snapshot on explicit API reads only, never a new object each frame.
    return {
      layout: hudState.layout, started: hudState.started, visible: hudState.visible,
      busy: hudState.busy, alive: hudState.alive, scoped: hudState.scoped, riding: hudState.riding,
      mode: hudState.mode, team: hudState.team, teams: hudState.teams,
      red: hudState.red, blue: hudState.blue, ping: hudState.ping,
      online: hudState.online, connected: hudState.connected, networkStatus: hudState.networkStatus,
      fps: hudState.fps, health: hudState.health, ammo: hudState.ammo, fuel: hudState.fuel
    };
  }
  function hudFrame(dt, now) {
    if (!hudNodes) return;
    hudSyncContext();
    if (document.hidden || now - hudReadAt < 100) return;
    hudReadAt = now;
    hudReadGameplay(false);
    // 99 writes a brief "ready" label at boot. Never let that turn this slot
    // back into a second debug strip before its first measured FPS sample.
    hudSetDiagnostics(hudState.fps);
  }
  function hudPoll() {
    if (!hudNodes) return;
    hudSyncContext();
    hudUpdatePing(false);
    hudUpdateMatch(false);
  }
  function hudOnDeath(victim, killer) {
    hudSyncContext();
    if (hudNodes) hudText(hudNodes.announcer, '');
    // Existing killcam/banner live regions already announce their own cards.
    var killcam = hudBC.api.killcam;
    var banner = document.getElementById('killBanner');
    if ((killcam && killcam.active) || (banner && banner.dataset.mode === 'death' && banner.classList.contains('show'))) return;
    if (hudNodes) hudText(hudNodes.announcer, 'Eliminated' + (killer ? ' by ' + String(killer) : '') + '. Respawn pending.');
  }
  function hudOnRespawn() {
    hudRefresh();
    if (hudNodes) hudText(hudNodes.announcer, 'Respawned.');
  }

  var hudApi = hudBC.api.hud = {
    refresh: hudRefresh,
    setDiagnostics: hudSetDiagnostics,
    getstate: hudGetState,
    getState: hudGetState,
    get state() { return hudGetState(); }
  };
  function hudInit() {
    if (!hudEnsureDOM()) return;
    hudRefresh();
    if (typeof hudBC.on === 'function') {
      hudBC.on('worldReady', hudRefresh, 80);
      hudBC.on('worldReset', hudRefresh, 80);
      hudBC.on('modeChanged', hudRefresh, 80);
      hudBC.on('netStatus', hudRefresh, 80);
      hudBC.on('settingsChanged', hudRefresh, 80);
      hudBC.on('worldBusyChanged', hudSyncContext, 80);
      hudBC.on('killfeed', function () { hudUpdateMatch(false); }, 80);
      hudBC.on('death', hudOnDeath, 80);
      hudBC.on('respawn', hudOnRespawn, 80);
      hudBC.on('frame', hudFrame, 60); // Before 87's layout/marker refresh at 80.
    }
    if (!hudPollTimer) hudPollTimer = window.setInterval(hudPoll, 500);
    document.addEventListener('visibilitychange', hudRefresh);
    if (typeof hudBC.whenReady === 'function') hudBC.whenReady(hudRefresh);
  }
  if (document.body) hudInit();
  else window.addEventListener('DOMContentLoaded', hudInit, { once: true });
})();
