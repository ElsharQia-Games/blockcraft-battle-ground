# Blockcraft Battle Ground

By **ElsharQia Games**.

A voxel arena shooter that runs in the browser on PC and phones. Every world is generated from
one seed: terrain, biomes, villages, battle sites, dragons and 16 characters. Fight with seven
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

Turn the phone sideways. The left thumb moves (push to the rim to sprint), the right thumb
looks. Fire, Aim, Jump, Slide, Reload, Gun, Build and Rotate sit under the right thumb; Pause,
Score, View and Jet are at the top. Phones default to **Fast** graphics (no shadows).

## Play with friends

1. On Home, press **Create room** and send the 5-letter code (or an `index.html?room=CODE` link).
2. Friends paste the code into **Join with a code**.
3. Everyone presses **Play**. In a match, `P` copies the code again.

Internet rooms find each other through public MQTT relays (`broker.emqx.io`, then
`broker.hivemq.com`), so there is no server to run, but rooms are not private. Once in a room,
each player opens a direct WebRTC link to the host and game traffic skips the relay. The HUD
shows `direct` next to ping, or `relay` when a strict network forces the fallback. One player is elected host; the host's tab
decides hits, deaths, scores and teams, and picks the mode and map. LAN play uses `server.js`
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
| `1`-`7` / wheel | Select / cycle weapons |
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
| Gun Game | Each kill moves you to the next gun, pistol to sniper; first through all seven wins |
| Low Gravity | Red vs Blue at 45% gravity, first to 30 |
| Hardcore | Red vs Blue, 1.5x damage, no health regeneration, first to 30 |
| Snipers Only | Snipers in a long arena, first to 15 |
| Shotguns Only | Shotguns in a tight arena, first to 15 |
| Sidearms | Pistols and revolvers in a compact arena, first to 15 |
| Lockdown | Red vs Blue in a tight arena with rifles, SMGs, shotguns and revolvers, first to 25 |

Arena modes build a walled ring with team spawn pads and mirror-symmetric cover, so neither
side is favoured.

## Weapons

Health is **150** and regenerates 14 HP/s after 6 seconds without damage (not in Hardcore).
Headshot multipliers differ per weapon; only a sniper headshot kills in one shot.

| Weapon | Damage | Head | Fire rate | Magazine | Body shots to kill |
| --- | --- | --- | --- | --- | --- |
| Pistol | 30 | 2.0x | 360 rpm | 14 | 5 |
| Rifle | 23 | 1.6x | 640 rpm | 30 | 7 |
| Shotgun | 14 x 9 pellets | 1.5x | 75 rpm | 6 | 2 at close range |
| SMG | 15 | 1.4x | 880 rpm | 32 | 10 |
| Sniper | 115 | 2.0x | 42 rpm | 5 | 2 |
| Revolver | 58 | 2.0x | 170 rpm | 6 | 3 |
| LMG | 21 | 1.4x | 600 rpm | 75 | 8 |

Damage drops 20% beyond 65% of a weapon's range. Bullets also wear down blocks; tougher
materials take more hits.

## What is in it

- **World:** a 256 x 256 x 80 voxel world with grass, forest, desert, snow and ocean biomes,
  villages with villagers and chickens, waterfalls, and eight seeded battle sites
  (watchtowers, walled compounds, ruins and trench lines, marked T, C, R and X on the minimap).
- **Movement:** fast acceleration, sprint slides that keep momentum into a jump, buffered
  jumps, crouching, swimming and a fuel-powered jetpack.
- **Building:** walls, floors and ramps placed with one click or held to build continuously,
  plus single-block mining and placing. Materials are unlimited.
- **Dragons:** four indestructible guardians circle the world; two or three small dragons can
  each be ridden by one player for 30 seconds, with fire breath.
- **Graphics:** lit terrain with sun shadows, reflective water and glass, and filmic tone
  mapping. **High** (desktop default) or **Fast** (phones; no shadows, shorter view
  distance), switchable in Pause or with `?gfx=low|high`.
- **Feel:** per-weapon camera shake, muzzle flash and smoke, ejected casings, impact dust,
  hit markers, floating damage numbers and a kill pulse. Shake respects reduced-motion.
- **Audio:** real CC0 recordings: several takes per gun, far-mic reports for distant shots,
  each gun's own reload, impacts and breaks that match the block, footsteps per surface. All
  positional, with distance falloff and muffling behind blocks. Sources and licences are in
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
src/44-46-*.js           dragon rules, dragons and riding
src/48-outline.js        character outlines
src/50-player.js         movement, cameras and avatar
src/52-jetpack.js        jetpack
src/53-ground-marker.js  ground shadow and ring under the player
src/55-building.js       quick build pieces and placement
src/58-killcam.js        death camera
src/60-combat.js         weapons, holds, shooting, damage, death and respawn
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
src/90-net.js            LAN WebSocket and MQTT transport, rooms and host authority
src/91-rtc.js            direct WebRTC links between players and the host
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
