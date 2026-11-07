# Blockcraft Battle Ground

By **ElsharQia Games**.

A voxel arena shooter that runs in the browser on PC and phones. Every world is generated from
one seed: terrain, biomes, villages, battle sites, dragons and 16 characters. Fight with twelve
weapons, throw up cover with one key, fly a jetpack, ride small dragons and play with friends
over the internet or LAN. No build step: plain HTML, CSS and JavaScript on top of
[three.js](https://threejs.org).

![Blockcraft Battle Ground](screenshot.png)

## Play

- **Hosted:** <https://elsharqia-games.github.io/blockcraft-battle-ground/>
- **Local:** open `index.html` (works from `file://`; three.js loads from a CDN the first time).
- **LAN server:** `npm start` (or `node server.js`, or double-click `start.bat`), then open
  `http://localhost:8080`. Friends on the same network open `http://YOUR-IP:8080`.

On **Home**, pick a mode with the arrows and press **Play**. Your character, Settings and Help
are in the menu below Play. **Esc** pauses.

### Phones

Turn the phone sideways. The movement stick appears wherever your left thumb lands: push to
the rim to sprint, or pull well past the top to lock sprint on. Drag anywhere on the right to
look; the fire button also steers while held, and there is a second fire button for the left
thumb. Buttons are icons and only show when they do something: building swaps in Rotate, and
near a dragon a Ride button appears; on a dragon you get Up, Down and fire breath.

The pencil at the top right (or **Edit touch controls** in Pause) opens the layout editor:
drag any button to move it, tap one to resize it, and set look speed, aiming speed, opacity,
overall size, the left fire button and vibration. It is saved on the phone. Phones default
to **Fast** graphics (no shadows).

## Play with friends

1. On Home, press **Create room** and send the 5-letter code (or an `index.html?room=CODE` link).
2. Friends paste the code into **Join with a code**.
3. Everyone presses **Play**. In a match, `P` copies the code again.

**How internet rooms work.** There is no game server: the player who creates the room hosts it
in their browser, and their tab decides hits, deaths, scores and teams, and picks the mode and
map. Everyone else holds one WebRTC link to the host, and all game traffic runs on it: events
(shots, deaths, edits) on a reliable channel, positions and ping on an unreliable one, so a lost
packet never holds up the ones behind it.

Public MQTT brokers (`broker.emqx.io` and `broker.hivemq.com`, both at once) are used only so
players can find the host, so rooms are not private. Once linked, a room does not need them. A
network change repairs the link in place, a dropped link reconnects by itself, and retries back off. If the host leaves, the next player
takes over and keeps the world and scores. A banner shows what the connection is doing, and if
it can't recover you get **Retry** and **Leave**. The bars next to ping show connection quality.

A link tries every route at once and keeps the fastest. Direct is the only low-ping route, so
a TURN relay is just the backup for players who can't connect directly. The HUD shows the route
next to ping: `direct` or `TURN`. Add `?relay=1` to force TURN or `?direct=1` to never use it.

**Strict networks.** Corporate or school firewalls, symmetric NAT and some mobile carriers block
direct links, and those players need TURN. Free public TURN no longer exists, so add one in
[`net-config.js`](net-config.js): a free [Metered](https://www.metered.ca) app or your own coturn
server. The hosted site gets its TURN credentials from GitHub repository secrets when it deploys.
Anything in `net-config.js` is public on a Pages site, so never commit a real credential there.

LAN play uses `server.js`
as the authority instead.

**Teams.** Each player is put on the smaller team when they join and keeps that team until it
is changed. The **Players** list on Home and in Pause shows both teams: anyone can switch their
own side, and the host can move anybody. A switched player respawns at full health on the new
side.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Move |
| Mouse | Look |
| `Space` | Jump; hold for a higher jump |
| `Shift` | Sprint |
| `Ctrl` or `C` | Crouch; press while sprinting to slide |
| Left click | Shoot / place |
| Right click | Aim down sights |
| `R` | Reload (rotates the piece in build mode) |
| `1`-`0` / wheel | Select weapons (the last ones by wheel) |
| `Y` | Knife out, and back to your gun |
| `Q` | Build mode on / off |
| `1` `2` `3` / wheel (build mode) | Wall, floor, ramp |
| `Shift` + wheel (build mode) | Change material |
| `B` | Block mode: left click mines, right click places single blocks |
| `F` | Jetpack on / off (`Space` rise, `Ctrl` descend, `Shift` boost, `C` air dash) |
| `E` | Mount / dismount a small dragon |
| `V` | First / third person |
| `K` | Change character |
| `Tab` (hold) | Scoreboard |
| `M` / `P` / `Esc` | Mute / copy room code / pause |

## Modes

| Mode | Rules |
| --- | --- |
| Team Deathmatch | Red vs Blue, all weapons, first to 40 |
| Free For All | Everyone for themselves, first to 20 |
| Gun Game | Each kill moves you to the next gun, strongest first and the pistol last; first through all twelve wins |
| Low Gravity | Red vs Blue at 45% gravity, first to 30 |
| Hardcore | Red vs Blue, 1.5x damage, no health regeneration, first to 30 |
| Snipers Only | Snipers in a long arena, first to 15 |
| Shotguns Only | Shotguns in a tight arena, first to 15 |
| Sidearms | Pistols and revolvers in a compact arena, first to 15 |
| Lockdown | Red vs Blue in a tight arena with rifles, SMGs, shotguns and revolvers, first to 25 |

Arena modes clear a walled ring and build three mirrored lanes: long in the north, tight in the
south, blocked in the middle so the two spawn pads can't see each other.

Every respawn gives **3 seconds of protection**; firing ends it early. When a side reaches the
score the match ends, shows the result for eight seconds and the next one starts.

## Weapons

Health is **150** and regenerates 14 HP/s after 6 seconds without damage (not in Hardcore).
Headshot multipliers differ per weapon; only sniper and crossbow headshots kill in one shot.

| Weapon | Damage | Head | Fire rate | Magazine | Body shots to kill |
| --- | --- | --- | --- | --- | --- |
| Pistol | 30 | 2.0x | 360 rpm | 14 | 5 |
| Rifle | 23 | 1.6x | 640 rpm | 30 | 7 |
| Shotgun | 14 x 9 pellets | 1.5x | 75 rpm | 6 | 2 at close range |
| SMG | 15 | 1.4x | 880 rpm | 32 | 10 |
| Sniper | 115 | 2.0x | 42 rpm | 5 | 2 |
| Revolver | 58 | 2.0x | 170 rpm | 6 | 3 |
| LMG | 21 | 1.4x | 600 rpm | 75 | 8 |
| Marksman | 44 | 1.8x | 240 rpm | 12 | 4 |
| Burst Rifle | 30 | 1.5x | 3 rounds, 800 rpm | 30 | 5 |
| Machine Pistol | 13 | 1.3x | 1050 rpm | 28 | 12 |
| Double Barrel | 18 x 8 pellets | 1.3x | 300 rpm | 2 | 2 at close range |
| Crossbow | 120 | 2.0x | 60 rpm | 1 | 2 |
| Knife | Combo 40, 40, 55; stab 90 | none | Stab 1 s | - | Backstab kills |

Damage drops 20% beyond 65% of a weapon's range. Bullets also wear down blocks; tougher
materials take more hits.

## What is in it

- **World:** a 256 x 256 x 80 voxel world with grass, forest, desert, snow and ocean biomes,
  villages with villagers and chickens, waterfalls, and a planned battlefield: a citadel in the
  middle and two rings of sites (watchtowers, walled compounds, ruins and trench lines) joined by roads into loops, with cover in the open ground.
  Respawns pick a spot out of enemy sight, close enough to get back into the fight.
- **Movement:** fast acceleration, sprint slides that keep momentum into a jump, buffered
  jumps, crouching, swimming and a fuel-powered jetpack.
- **Building:** walls, floors and ramps placed with one click or held to build continuously,
  plus single-block mining and placing. Materials are unlimited.
- **Dragons:** six guardians circle the world; three or four small dragons can each be ridden
  by one player for 30 seconds, with fire breath. Any dragon can be shot down and returns after
  60 seconds, and riders can be shot off their mounts.
- **Graphics:** lit terrain with sun shadows, reflective water and glass, and filmic tone
  mapping. **High** (desktop default) or **Fast** (phones; no shadows, shorter view
  distance), switchable in Pause or with `?gfx=low|high`.
- **Feel:** per-weapon camera shake, muzzle flash and smoke, ejected casings, impact dust,
  hit markers, floating damage numbers and a kill pulse. Shake respects reduced-motion.
- **Audio:** CC0 firearm recordings for gunshots, synthesized reloads, impacts and UI, and
  recorded footsteps per surface, landing thuds and a jetpack thruster loop. All positional,
  with distance falloff and muffling behind blocks. Sources and licences are in
  [assets/audio/LICENCES.md](assets/audio/LICENCES.md).
- **UI:** a console-style Home with the world visible behind it, a Players list with team
  switching, and a minimal HUD (score, health, ammo, FPS and ping) that adapts to phones.

## Project layout

The game is a set of classic scripts loaded in order by `index.html`, which is what lets it run
from `file://`. Top-level names are shared between files through the global scope.

```
index.html               markup, base styles and the script loader
server.js                zero-dependency static + WebSocket LAN server (room authority)
assets/audio/            embedded CC0 sound banks and their licence record
src/00-core.js           world constants, renderer, scene, camera, sky
src/04-runtime.js        shared event hooks and feature registry (BC)
src/05-settings.js       personal settings, match setup and crosshair
src/10-textures.js       procedural block atlas and voxel storage
src/15-modes.js          match modes, teams, arenas and seeded regeneration
src/20-world.js          terrain, biomes, trees, villages, waterfalls
src/21-structures.js     battle sites and arena cover
src/22-physics.js        swept voxel collisions and water physics
src/30-meshing.js        chunk meshing and lit world materials
src/40-characters.js     characters, skins, villagers and chickens
src/41-graphics.js       shadows, reflections, view distance and quality levels
src/44-47-*.js           dragon rules, dragons, riding and dragon health
src/48-outline.js        character outlines
src/50-player.js         movement, cameras and avatar
src/52-jetpack.js        jetpack
src/53-ground-marker.js  ground shadow and ring under the player
src/55-building.js       quick build pieces and placement
src/58-killcam.js        death camera
src/60-combat.js         weapons, holds, shooting, damage, death and respawn
src/61-spawn-shield.js   spawn protection
src/62-combat-fx.js      aim assist, damage direction and kill banners
src/63-player-feedback.js damage numbers and overhead health
src/64-feedback-vfx.js   camera shake, flashes, casings and puffs
src/65-destruction.js    block durability
src/70-inventory.js      hotbar and materials
src/80-input.js          keyboard, mouse and pointer lock
src/82-touch.js          phone and tablet controls
src/85-scoreboard.js     hold-Tab scoreboard
src/86-hud.js            HUD data owners (kill feed, build, jetpack panels)
src/87-minimap.js        minimap
src/88-menu.js           screen flow, focus and Escape handling
src/89-ui-system.js      menu and HUD design system, players and teams panel, icons
src/90-net.js            LAN WebSocket, game protocol and host authority
src/91-room.js           internet rooms: finding the host, WebRTC links, reconnects, host takeover
src/93-connection.js     connection banner: status, Retry and Leave
src/95-bots.js           offline bots, which join as ordinary remote players
src/92-sync.js           ping and connection diagnostics
src/94-audio.js          positional audio engine
src/99-boot.js           boot sequence and main loop
```

`window.__blockcraft` exposes the world, player, combat and network objects, and
`window.__blockcraft.features` (also `BC.api`) exposes each system's API, for example
`net.requestTeam(id, team)`, `graphics.setQuality('low')` and `modes.setActive('gungame')`.

## Tests

- `npm run test:syntax`: syntax, loader order and shared-scope checks, with no browser.
- `npm test`: the browser regression suite (Node 24+ and Chromium or Edge). It covers boot,
  movement, combat, building, menus at three viewport sizes, audio, and two-to-three player LAN
  matches including kills, team switching and late joins.

## License

Code: MIT, see [LICENSE](LICENSE). Sounds: CC0 1.0 or public domain, see
[assets/audio/LICENCES.md](assets/audio/LICENCES.md).
