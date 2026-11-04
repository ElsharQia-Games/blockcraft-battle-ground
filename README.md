# Blockcraft Battle Ground

A procedurally generated voxel world with online gunfights, quick combat construction and dragons.

Everything is generated in the browser from one seed — terrain, biomes, trees, waterfalls,
mudbrick Fayoum villages, chickens, villagers, dragons and 16 selectable characters. Bring
seven weapons, build unlimited cover with a few clicks, and explore with your friends. No build step
or external art assets: just HTML, CSS and JavaScript on top of [three.js](https://threejs.org).

![Blockcraft Battle Ground](screenshot.png)

## Play

**Hosted:** <https://elsharqia-games.github.io/blockcraft-battle-ground/>

**Local / double-click:** open `index.html`. It runs straight from `file://` and still
loads three.js from a CDN, so you need an internet connection the first time (or a cached copy).
There is no install or bundling step. Keep `index.html` and the `src/` folder together.

Click **Play** to enter. The game requests fullscreen and keyboard capture where supported
so gameplay key combinations take priority. **Esc** pauses and releases the mouse; keyboard
handling returns to normal outside gameplay.

**LAN server (also serves the files):**

```bash
npm start          # or: node server.js
# then open http://localhost:8080
```

On Windows you can also double-click `start.bat`.

## Play with a friend

### Internet (no server needed)

1. Both of you open the same page (`index.html` or the hosted link).
2. One player clicks **Create room** — a 5-character code is generated and copied.
3. Send the code to your friend. They type it into the room box and click **Join room**.
4. You are in the same gunfight. `P` copies the room code again, `M` mutes sound.

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
| `B` | Toggle traditional mining/building mode (combat ↔ individual blocks) |
| `E` | Inventory & crafting |
| `Space` | Jump / swim / rise while flying; jump presses are buffered for landing |
| `Shift` | Sprint / descend while flying |
| `Ctrl` | Crouch / sneak / descend while flying |
| `Shift` + `Ctrl` | Press `Ctrl` while already sprinting to start a short slide |
| `V` | Toggle normal right-over-shoulder third-person / first-person view |
| `C` | Swap character |
| `F` | Toggle flying |
| `Tab` (hold) | Show the match scoreboard; wheel scrolls long rosters, release `Tab` to return |
| `M` | Mute sound |
| `P` | Copy room code |
| `Esc` | Cancel a quick-build piece / close crafting / pause and release the mouse |

The character menu supports **Tab** to move between buttons and **Enter** or **Space** to
select. On smaller or shorter screens, scroll the menu to reach every character and the
play/room controls.

### Movement

Hold `Ctrl` to sneak at 1.8 blocks/second with a ledge guard. Crouching lowers the visible
stance while keeping the full 1.8-block collision height. Press `Ctrl` while sprinting
above 5.7 blocks/second to slide for up to 0.55 seconds, with a 1-second cooldown. Releasing
`Ctrl`, jumping, colliding or losing ground support ends the slide.

A jump press is buffered for 120 ms before landing, with 90 ms of grace after leaving a
ledge. In flight, `Space` rises and either `Shift` or `Ctrl` descends.

### Camera and weapon optics

Normal third person places the camera over the **right shoulder**; `V` switches between
that view and first person. The shoulder camera pulls in around nearby blocks and hides
the avatar when too close. Both normal views keep a clear, dark-edged **hip-fire crosshair**.

**Hold right mouse to enter an optical scope** from either camera view. A circular optic,
etched reticle and weapon/magnification readout appear; release right mouse to return to
your chosen normal view. All seven weapons have scopes, with the strongest magnification
on the sniper. Health, ammo, hit markers and damage feedback stay visible while scoped.

| Weapon | Scoped reticle |
| --- | --- |
| Pistol | Reflex dot with a compact ring |
| Rifle | Holographic circle-dot with side bars |
| Shotgun | Wide, segmented spread ring |
| SMG | Pointed chevron |
| Sniper | Fine mil-dot cross and range hashes |
| Revolver | Precision cross with an open diamond |
| LMG | Support reticle with a BDC-style ladder |

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

### Traditional blocks and crafting

Press `B` to switch to individual-block building. **Left-click** breaks a block and collects
it; **right-click** places the selected hotbar block with unlimited materials. Use **`1`–`9`** or the
**mouse wheel** to select a slot. Hold either mouse button to keep mining or placing.
Aim into empty space to place a floating block within reach. Press `B` again to return to combat.

Press `E` to open inventory and crafting. Clicking an inventory block assigns it to the
selected hotbar slot; recipe buttons show the required ingredients. **Crafting uses your
actual collected inventory:** it consumes ingredients and adds the result to your inventory.
Press `E`, **Esc**, or **Close** to exit.

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
  swimming and flight, with a collision-aware right-over-shoulder camera, a first-person
  view, and a dedicated scope-eye view when aiming.
- **Dragons** — four ambient procedural dragons (Emberwing, Jadewing, Stormcrest and Duskmantle)
  circle the overworld with articulated wings, necks and tails. Their terrain-safe flight
  paths use a shared clock and are initialized after terrain generation.
- **Combat** — seven weapons (pistol, rifle, shotgun, SMG, sniper, revolver and LMG) with
  distinct damage, rate of fire, spread, recoil, range and per-weapon reload sequences.
  Seven optics pair distinct reticles with weapon-specific magnification; the sniper zooms furthest.
  Hip-fire works in both normal camera views. Hitscan with headshot
  multipliers, tracers, muzzle flash, impact particles, synthesized WebAudio gunshots,
  health with regeneration, kill feed, K/D, death and respawn. Bullets chip away at
  material-dependent block durability until cover breaks.
- **Building** — quick walls, stair-ramps and floors for combat cover, with rotation,
  placement previews, floating air builds and unlimited building materials. Traditional mining/placing, 21 block types,
  nine hotbar slots, inventory and nine crafting recipes remain available.
- **Networking** — one transport interface with two back ends: the LAN WebSocket server
  (`server.js`) and internet MQTT rooms. Remote players are interpolated with name tags and
  held weapons, block edits sync both ways, and late joiners get retained edits. Hold `Tab`
  for the live scoreboard: player, character, weapon, kills, deaths and health.

## Project layout

```
index.html          markup, styles and the boot loader (imports three.js, loads src/*.js)
src/00-core.js      world constants, renderer, scene, camera, sky
src/10-textures.js  procedural block atlas, block definitions, voxel storage
src/20-world.js     noise, biomes, terrain, trees, villages, waterfalls
src/30-meshing.js   face meshing and chunk rebuilds
src/40-characters.js characters, pixel-art painters, villagers, chickens
src/45-dragons.js   procedural dragons, spawning and flight animation
src/48-outline.js   character silhouette outlines and viewport synchronization
src/50-player.js    player motion, shoulder/scope camera, avatar, block picking, spawn
src/55-building.js  quick construction, previews, rotation and voxel placement
src/60-combat.js    weapons, scope state/FOV, models, audio, effects, hit tests, health, death
src/65-destruction.js material durability, bullet damage and block destruction feedback
src/70-inventory.js inventory, hotbar, crafting
src/80-input.js     pointer lock, mouse, keyboard, resize
src/85-scoreboard.js hold-Tab scoreboard, roster and match statistics
src/90-net.js       LAN WebSocket + MQTT transport, rooms, remote players
src/99-boot.js      boot sequence and main loop
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

## Notes

- three.js r160 is loaded from jsDelivr (unpkg as fallback).
- The internet mode needs a WebSocket-capable network; restrictive firewalls can block the
  public brokers, in which case use the LAN server.
- Deployed with GitHub Pages from the repository root.

## License

MIT — see [LICENSE](LICENSE).
