# Blockcraft Battle Ground

By **ElsharQia Games**.

A procedurally generated voxel world with online gunfights, selectable match modes,
quick combat construction, fuel-powered jetpacks and small rideable dragons.

Everything is generated in the browser from one seed — terrain, biomes, trees, waterfalls,
mudbrick Fayoum villages, chickens, villagers, dragons and 16 selectable characters. Bring
seven weapons, build unlimited cover with a few clicks, and explore with your friends. No build step
or downloaded character art: just HTML, CSS and JavaScript on top of [three.js](https://threejs.org),
with embedded CC0 firearm recordings for weapon audio.

![Blockcraft Battle Ground](screenshot.png)

## Play

**Hosted:** <https://elsharqia-games.github.io/blockcraft-battle-ground/>

**Local / double-click:** open `index.html`. It runs straight from `file://` and still
loads three.js from a CDN, so you need an internet connection the first time (or a cached copy).
There is no install or bundling step. Keep `index.html`, `src/` and `assets/` together.

The **Home** screen puts **Play, Create room and Join by code** together. Mode & map,
Characters and Settings have their own pages; connection help stays secondary.
Click **Play** to enter. Mode & map also has **Play this match**, so setup does not require a trip back.
**Esc** opens a separate **Pause** menu with Resume, Settings, room invites and Home;
Back from Settings never resumes the game. Settings apply immediately and persist locally.
The game requests fullscreen and keyboard capture where supported so gameplay key combinations
take priority. Pausing releases the mouse; keyboard handling returns to normal outside gameplay.

**LAN server (also serves the files):**

```bash
npm start          # or: node server.js
# then open http://localhost:8080
```

On Windows you can also double-click `start.bat`.

## Play with a friend

### Internet (no server needed)

1. Both of you open the same page (`index.html` or the hosted link).
2. On **Home**, one player clicks **Create room** — a 5-character invite code appears beside **Copy code**.
3. Send the code or an `index.html?room=CODE` link to your friend. They paste it into the Home room field and press **Join** or **Enter**.
4. Both click **Play online** when the shared world is ready. `P` copies the active code again, `M` mutes sound.

Joining keeps the menu open while connecting; **Cancel connection** is available if it stalls.
The active invite code is separate from the join field, so Copy never shares an unsubmitted edit.
Leaving from Home disconnects without silently joining another session. Home does not end your
current match; **Return to match** takes you back. Settings save immediately and Back returns
to the screen you came from, never straight into gameplay.

Rooms travel over public MQTT-over-WebSocket relays (`broker.emqx.io`, then
`broker.hivemq.com` as a fallback), so there is no server to host — but the relay is public,
so do not treat rooms as private. Room codes match sessions; both players need this game.
Block edits are retained per room, so a friend who joins later still sees the world you
changed.

You can also link straight into a room: `index.html?room=CODE`.

### LAN / same machine

Run `node server.js` and open `http://localhost:8080`; the built-in zero-dependency
WebSocket server relays positions, shots, damage and edits. Friends on the same network open
`http://YOUR-LOCAL-IP:8080` (or pass `?server=ws://YOUR-LOCAL-IP:8080`).

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Move |
| Mouse | Look |
| Left click | Shoot in combat; place the selected quick-build piece |
| Right click | Hold to look through the weapon's optical scope in combat; click to cancel a quick-build piece |
| `R` | Reload the current weapon |
| `1`–`7` | In combat, select pistol, rifle, shotgun, SMG, sniper, revolver or LMG, in that order |
| `Q` / wheel | Cycle weapons in combat; `Q` also leaves a blueprint and equips the next gun |
| `Z` / `X` / `G` | Select a quick-build wall / stair-ramp / floor |
| `T` | Rotate the quick-build piece |
| `1`–`9` / wheel, with a blueprint active | Choose the construction material from the hotbar |
| `Shift` + wheel, in building mode or with a blueprint active | Cycle all solid materials through the selected hotbar slot |
| `B` | Toggle traditional mining/building mode (combat ↔ individual blocks) |
| `E` | Mount a nearby small dragon / dismount; no inventory or crafting menu |
| `Space` | Jump / swim up / ascend; hold for a higher ground jump; jump-cancel crouch or slide with headroom |
| `Shift` | Sprint on foot / boost the jetpack |
| `C` | Crouch / sneak on foot; fuel-gated air dash with the jetpack; descend while riding |
| `Shift` + `C` | Start a stronger sprint slide on the ground |
| `V` | Toggle normal right-over-shoulder third-person / first-person view |
| `Ctrl` | Change character once per press on foot; hold to descend with the jetpack |
| `F` | Toggle the fuel-powered jetpack |
| `Tab` (hold) | Show the match scoreboard; wheel scrolls long rosters, release `Tab` to return |
| `M` | Mute sound |
| `P` | Copy room code |
| `Esc` | Cancel a quick-build piece / pause and release the mouse / go Back in menu pages |

The character menu supports **Tab** to move between buttons and **Enter** or **Space** to
select. On smaller or shorter screens, scroll the menu to reach every character and the
play/room controls.

### Movement

Hold `C` to crouch at 3.1 blocks/second with a ledge guard. Crouch lowers both
the stance/camera and the collision body: standing is 1.8 blocks tall, crouched
is 1.2. A low ceiling prevents standing up until there is space.

Press `C` while sprinting to slide for up to 0.8 seconds at approximately
11–12 blocks/second, with a 1.35-second cooldown. `Space` jump-cancels the slide
or crouch when standing/jump clearance is available. Walls and arena boundaries
stop the slide; leaving the ground retains bounded momentum rather than flight.

A jump press is buffered for 120 ms before landing, with 90 ms of grace after leaving a
ledge. A short tap rises roughly 1.8–2 metres; holding Space during the bounded rising window
raises that to about 2.9 metres. Re-pressing Space in mid-air cannot renew the jump.
Water movement is about 92% of normal walking speed. Hold Space to swim up; near the
surface it uses the same regular jump and bounded hold as land, without requiring a bank.
Release before another surface jump. `C` dives, and Space takes priority if both are held.
A blocked bank or low roof still prevents passage.

`F` activates a visible jetpack with a 100-point fuel tank. Hovering drains
fuel; boosting and air dashes cost more. Fuel recharges on the ground after a
short delay, and an empty tank turns the pack off.

In jetpack flight, `Shift` boosts, `C` triggers a short air dash, and `Space`
ascends—including `Shift` + `Space` and `Ctrl` + `Space`. Only held `Ctrl` descends, so
boosting never cancels ascent. Pausing, death, and map regeneration release held
movement/fire inputs.

A small contact shadow and team-colored ground ring mark the surface directly
below your feet, including while jumping or using the jetpack. The ring is clearer
in the air and quieter on the ground. It marks the ground beneath you, not a guaranteed
future trajectory, and does not shine through solid terrain.

### Settings and match modes

Personal settings persist locally: global sensitivity, independent hipfire/ADS multipliers
for each of the seven weapons, crosshair design, red/blue accent, volume and mute.
Each weapon multiplier ranges from 0.35× to 2.5× and does not affect building or riding.
Crosshair choices are cross, dot, circle, brackets,
chevron, T-cross and off; optical weapon reticles remain separate.

| Mode | Rules |
| --- | --- |
| Team Deathmatch | Red versus blue, all weapons |
| Free For All | Every player is an opponent, all weapons |
| Snipers Only | Sniper loadout in a locked, smaller arena |
| Shotguns Only | Shotgun loadout in a locked, smaller arena |
| Lockdown | Red versus blue in a tight arena with a restricted loadout |

Play setup's map randomizer regenerates terrain from a numeric seed. The room
host controls shared mode/map changes; other players keep their personal aim
and audio settings. A shared seed selects the same terrain, villages and arena.

### Camera and weapon optics

Normal third person places the camera over the **right shoulder**; `V` switches between
that view and first person. The shoulder camera pulls in around nearby blocks and hides
the avatar when too close. Both normal views keep a clear, dark-edged **hip-fire crosshair**.
When looking steeply downward, the centre aim ray converges directly beneath your feet
without moving the camera off the shoulder. Shooting and building use that same corrected
ray; normal forward viewing and first-person/ADS aiming are unchanged.

**Hold right mouse to aim down sights** from either camera view. Each weapon has a different
physical sight and housing, not just a reticle change. The open sights keep the actual gun
visible and align its sight to the camera ray; the sniper uses an enclosed tube and the
strongest magnification. Release right mouse to return to your chosen normal view.
Health, ammo, hit markers and damage feedback stay visible while aiming.

| Weapon | Aiming view |
| --- | --- |
| Pistol | Front/rear iron sights |
| Rifle | Reflex sight window |
| Shotgun | Raised rib and front bead |
| SMG | Hooded compact sight |
| Sniper | Enclosed scope tube with mil-dot cross and range hashes |
| Revolver | Rear notch and front blade |
| LMG | Aperture sight and protective wings |

### Hit feedback and teams

Confirmed hits show floating damage numbers and a short-lived health bar above the
target. Shotgun pellets from one shot combine into one number. Bars follow the current
health/stance, hide behind cover and expire after a few seconds; rejected shots do not
invent damage or HP changes. Player outlines and health borders use the actual red/blue
team, even when teammates and opponents wear the same character skin. Non-team modes
and ambient villagers keep a neutral outline.

### Shooting cover

Bullets damage voxel blocks. Keep firing to break cover: durability depends on the
material, so tougher blocks take more hits. Built structures use the same material rules.

### Quick combat construction

1. Press `Z` for a wall, `X` for a stair-ramp, or `G` for a floor. Aim to position the preview.
2. Use **`1`–`9`** or the **wheel** to choose a hotbar material; planks are the starting material.
   Press `T` to rotate. The build HUD shows direction, voxel count, unlimited supply (`∞`) and placement feedback.
3. **Left-click** to place it, or **hold left click** to keep building as you move and aim.
4. **Right-click**, **Esc**, or the same blueprint key cancels the preview. Select another piece
   with `Z`, `X` or `G`; `Q` returns to a gun, and `B` switches to traditional block building.

Walls and floors are 3×3 (9 voxels); ramps have three solid steps (18 voxels). These counts
describe structure sizes. **Building materials are unlimited**, and matching blocks are
reused. A green preview is ready, red explains a blocked placement, and blue marks an
already-complete piece.

**Use `Space` to jump up the ramp's one-block risers.** Chained ramps share the previous
top step. Held building repeats every 180 ms as you move or aim at a new placement.

Quick pieces can **float in open air** within building reach. Leave room for the full
piece and aim at a clear placement. Completed structures can be mined again and synchronize
through the normal room block-edit system. While a blueprint is active, **right-click cancels it**; optical scopes
are available when firing a weapon in combat.

### Traditional blocks and unlimited materials

Press `B` to switch to individual-block building. **Left-click** breaks a block;
**right-click** places the selected hotbar block with unlimited materials. Use **`1`–`9`** or the
**mouse wheel** to select a slot. Hold either mouse button to keep mining or placing.
Aim into empty space to place a floating block within reach. Press `B` again to return to combat.

Use **Shift + wheel** to cycle every solid material through the selected slot.
There are no resource counts, pickup requirements, recipes or crafting popup.
Both traditional and quick building reject occupied player/dragon bodies and blocked sight lines.

## What is in it

- **World** — 256×256×80 voxel world from a seeded value-noise heightmap, with grass,
  forest, desert, snow and ocean biomes, 880 trees, cacti, waterfalls, and 5 mudbrick
  villages inspired by El Fayoum, each with houses, palms and villagers.
- **Characters** — 16 selectable, animated humanoids: Steve, CJ, Mario, Ashen One, Chosen
  Undead, Wolf, Tarnished, Seif, Meedo, Mko, Michael Jackson, Hokage, Kestrel, Oren, Kratos
  and Leon Kennedy. Procedural pixel-art skins combine detailed canon-inspired outfits
  with layered hair, longer back/nape coverage where appropriate, and character-specific
  accessories. Silhouette outlines help characters stand out against the terrain.
  Mko and Michael Jackson have separate roster entries and appearances.
  Village NPCs mix Fayoum villagers with Michael Jackson and his own moonwalk animation.
- **Movement** — smooth acceleration, buffered jumps, crouching/sneaking, short sprint slides,
  swimming and fuel-powered boost/dash flight, with a collision-aware right-over-shoulder camera, a first-person
  view, and a dedicated scope-eye view when aiming.
- **Physics** — players, animals and villagers use swept voxel contacts rather
  than walking through buildings or floating over removed terrain. Water adds
  drag and buoyancy; villagers wade or paddle and chickens float.
- **Dragons** — four larger, indestructible solid guardians (Emberwing, Jadewing, Stormcrest and Duskmantle)
  circle the overworld with articulated wings, necks and tails. Their terrain-safe flight
  paths use a shared clock and are initialized after terrain generation.
  Each seed adds two or three much smaller mounts, all rideable by any player.
  Guardians cannot be ridden. Each mount admits one rider at a time for at most 30 seconds,
  with fire breath, a heat limit and voxel-aware core/camera collisions. Dismounts step off
  at the dragon's current height and fall naturally, with bounded carried momentum rather
  than a teleport to the ground. `F` can activate the jetpack during the fall if fuel remains.
- **Combat** — seven weapons (pistol, rifle, shotgun, SMG, sniper, revolver and LMG) with
  distinct damage, rate of fire, spread, recoil, range and per-weapon reload sequences.
  Seven physical sight views pair distinct housings with weapon-specific magnification; the sniper zooms furthest.
  Hip-fire works in both normal camera views. Hitscan with headshot
  multipliers, tracers, muzzle flash, impact particles, sampled/procedural WebAudio gunshots,
  health with regeneration, kill feed, K/D, death and respawn. Bullets chip away at
  material-dependent block durability until cover breaks.
  Tiny, line-of-sight aim assistance excludes teammates. Confirmed eliminations
  trigger large messages; the death camera follows the killer until respawn.
- **HUD** — compact red/blue scores, health, ammunition, enlarged measured FPS and live ping. The
  topographic minimap caches terrain contours and water, overlays heading,
  landmarks and arena boundaries, and briefly marks relevant nearby gunfire.
- **Audio** — seven embedded CC0 firearm recordings are layered with procedural handling sounds.
  Spatial WebAudio sources provide directional, distance-attenuated shots and impacts,
  with muffling behind geometry, bounded voices and independent volume/mute.
- **Building** — quick walls, stair-ramps and floors for combat cover, with rotation,
  placement previews, floating air builds and unlimited building materials. Traditional mining/placing, 21 block types,
  nine hotbar slots and direct material cycling, without crafting or resource management.
- **Networking** — one transport interface with two back ends: the LAN WebSocket server
  (`server.js`) and internet MQTT rooms. Remote players are interpolated with name tags and
  held weapons, block edits sync both ways, and late joiners get retained edits. Hold `Tab`
  for the live scoreboard: player, character, weapon, kills, deaths and health.

## Project layout

```
index.html          markup, styles and the boot loader (imports three.js, loads src/*.js)
src/04-runtime.js   shared hooks and feature APIs (loads before core)
src/00-core.js      runtime seed, world constants, renderer, scene, camera, sky
src/05-settings.js  persistent lobby controls, sensitivity, crosshair and audio settings
src/10-textures.js  procedural block atlas, block definitions, voxel storage
src/20-world.js     noise, biomes, terrain, trees, villages, waterfalls
src/15-modes.js     match rules, teams, locked arenas and seeded regeneration (after world)
src/22-physics.js   shared swept voxel collisions, NPC grounding and water physics
src/30-meshing.js   face meshing and chunk rebuilds
src/40-characters.js characters, pixel-art painters, villagers, chickens
src/44-dragon-rules.js shared browser/server guardian and mount descriptors
src/45-dragons.js   procedural dragons, solid articulated bodies, spawning and flight
src/46-riding.js    exclusive 30-second mount rides, fire breath, heat and ride camera
src/48-outline.js   character silhouette outlines and viewport synchronization
src/50-player.js    player motion, shoulder/scope camera, avatar, block picking, spawn
src/52-jetpack.js   fuel, boost, air dash, reusable pack/flame visuals and fuel meter
src/53-ground-marker.js ground shadow/ring and cached surface query for downward aim
src/55-building.js  quick construction, previews, rotation and voxel placement
src/58-killcam.js   death camera that follows the killer until respawn
src/60-combat.js    weapons, scope state/FOV, models, audio, effects, hit tests, health, death
src/62-combat-fx.js bounded aim assistance, direction feedback and elimination messages
src/63-player-feedback.js confirmed floating damage and occlusion-aware overhead health
src/65-destruction.js material durability, bullet damage and block destruction feedback
src/70-inventory.js unlimited building materials, hotbar, material cycling and toasts
src/80-input.js     pointer lock, lifecycle-guarded mouse stream, keyboard and resize
src/85-scoreboard.js hold-Tab scoreboard, roster and match statistics
src/86-hud.js       compact red/blue HUD, live ping and consolidated match/weapon readouts
src/87-minimap.js   cached topographic contours, heading, landmarks and arena boundary
src/88-menu.js      Home room actions, dedicated pages/Pause, contextual Back and trusted Play/Resume
src/90-net.js       LAN WebSocket + MQTT transport, rooms, remote players
src/92-sync.js      ping/jitter metrics and connection/watchdog bridge
src/94-audio.js     directional, distance-attenuated sampled/procedural WebAudio SFX
src/99-boot.js      boot sequence and main loop
assets/audio/      embedded CC0 recordings and their licence/provenance record
server.js           zero-dependency static + WebSocket LAN server
```

The `src/` files are plain classic scripts loaded in order, which is what lets the game run
by double-clicking `index.html` — no bundler, no dev server, no modules over `file://`.
Top-level `const`/`let` are shared between them through the global lexical scope. See
`index.html` for the loader. Dragons and outlines load before player code, quick building
before combat, and destruction before inventory/input. Keep that order when adding systems.

After the world is ready, `window.__blockcraft` exposes the existing world, inventory,
character, combat and network tools alongside `quickBuild`, `selectBuildPiece`,
`cancelQuickBuild`, `rotateBuildPiece`, `placeQuickBuild`, `updateBuilding`,
`resetBuildingInput`, `dragons`, `spawnDragons`, `updateDragons`, `updatePlayer`,
`resetPlayerMotion`, `updateAvatarWeaponPose` and `isScopeActive` for console experiments and verification.
Additional helpers include `makeDragon`, `BUILD_PIECES`, `setQuickBuildMaterial`,
`buildPieceCells`, `preflightBuildPiece`, `commitBuildPiece`, `setBuildingHeld` and `resetGameplayInput`.
Unlimited-building access is available through `UNLIMITED_BUILDING`, `buildItemCount` and
`takeBuildItems`. Outline helpers are `addCharacterOutline` and `updateCharacterOutlines`.
Destruction exposes `voxelDamageMap`, `damageVoxelFromShot`, `applyVoxelDamage`,
`updateDestruction`, `resetVoxelDamage`, `VOXEL_DURABILITY` and `voxelDurability`.
Scoreboard tools are `scoreboard`, `setScoreboardVisible` and `updateScoreboard`.
The boot sequence spawns dragons before shader warm-up; the main loop updates motion,
camera, combat and building in order, with a capped timestep and a fresh clock after tab resume.
Destruction, scoreboard state and outline viewport uniforms update before every render.

New systems are available through `window.__blockcraft.features` (also `BC.api`):
`settings`, `modes`, `world`, `physics`, `jetpack`, `riding`, `killcam`, `combatFx`,
`hud`, `minimap`, `menus`, `dragons`, `outlines`, `groundMarker`, `playerFeedback`, `net` and `audio`.
The current numeric seed is exposed as
`window.__blockcraft.seed`; `?seed=12345` overrides the saved map seed.

Feature hooks run in this order: `preFrame`, player/camera/combat,
`postPlayer`, world/remote updates, `frame`, `lateFrame`, rendering. The final
camera override runs before the spatial listener update. Map regeneration pauses
the frame loop so no physics or outgoing pose reads a partially built world.

### Validation commands

`npm run test:syntax` checks every game script, the server, inline scripts,
classic-loader dependencies and shared-scope declarations **without starting a
server or browser**. `npm test` runs the separate browser regression suite and
requires Node 24+ and Chromium/Edge; it is not part of a syntax-only check.

## Notes

- three.js r160 is loaded from jsDelivr (unpkg as fallback).
- The internet mode needs a WebSocket-capable network; restrictive firewalls can block the
  public brokers, in which case use the LAN server.
- Deployed with GitHub Pages from the repository root.

## License

Code: MIT — see [LICENSE](LICENSE).
Embedded firearm recordings: CC0-1.0 — see [assets/audio/LICENCES.md](assets/audio/LICENCES.md)
for the original creator, source files and adaptations.
