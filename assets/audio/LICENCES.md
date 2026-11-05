# Game audio: licences and provenance

**Current sound set (2026-11-05).** Gunshots use the original recordings in
`weapon-samples.js` (described under "Shot fallback" below, now the primary shot source).
Reloads, impacts, hits, UI and the other effects use the original synthesized sounds in
`src/94-audio.js`. Only the **footsteps** (grass, stone, wood, snow), the **landing thud**
and the **jetpack thruster loop** come from the recorded bank in `assets/audio/sfx-bank.js`.
Those clips were cut 2 ms before their transient, faded, peak-normalised to -1 dBFS and
encoded as mono 32 kHz MP3. The jetpack plays no ignition burst when switched on.

## Recorded effects bank

Sources (all CC0 1.0):

- Kenney Impact Sounds (footsteps, landing) and Sci-fi Sounds (jetpack loop). <https://kenney.nl>, with the
  bundled License.txt.

Rejected during sourcing: clips whose material appeared to belong to someone else (ripped
from videos or games), "authentic" recordings with no stated recordist, and any CC-BY,
CC-BY-SA, OGA-BY or non-commercial files.

| Bank key | Recording | Author | Source page | Download | Licence | Source SHA-256 | Embedded |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `land` | Kenney kenney_impact-sounds: impactSoft_heavy_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `49e7ca88743fca97...` | 0.35 s, 2024 B |
| `land` | Kenney kenney_impact-sounds: impactSoft_heavy_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `4d0096364ba9e461...` | 0.35 s, 2024 B |
| `step:grass` | Kenney kenney_impact-sounds: footstep_grass_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `9d49497777405d78...` | 0.40 s, 1916 B |
| `step:grass` | Kenney kenney_impact-sounds: footstep_grass_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `fb28781bd22b2eef...` | 0.40 s, 1916 B |
| `step:grass` | Kenney kenney_impact-sounds: footstep_grass_002.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `73a520139f5be716...` | 0.40 s, 1916 B |
| `step:grass` | Kenney kenney_impact-sounds: footstep_grass_003.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `0546e1d8ab2def71...` | 0.40 s, 1916 B |
| `step:stone` | Kenney kenney_impact-sounds: footstep_concrete_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `d7267e183067757c...` | 0.10 s, 620 B |
| `step:stone` | Kenney kenney_impact-sounds: footstep_concrete_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `507a75eb19b89708...` | 0.10 s, 620 B |
| `step:stone` | Kenney kenney_impact-sounds: footstep_concrete_002.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `b21fa546d7494119...` | 0.11 s, 764 B |
| `step:stone` | Kenney kenney_impact-sounds: footstep_concrete_003.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `8b513c2f03163240...` | 0.11 s, 620 B |
| `step:wood` | Kenney kenney_impact-sounds: footstep_wood_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `5f1c252942a220d6...` | 0.27 s, 1340 B |
| `step:wood` | Kenney kenney_impact-sounds: footstep_wood_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `e4f68e1c9fd55b4d...` | 0.25 s, 1196 B |
| `step:wood` | Kenney kenney_impact-sounds: footstep_wood_002.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `9ff095b05cee5eec...` | 0.25 s, 1196 B |
| `step:wood` | Kenney kenney_impact-sounds: footstep_wood_003.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `2a68a083daa9eda0...` | 0.25 s, 1196 B |
| `step:snow` | Kenney kenney_impact-sounds: footstep_snow_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `c05fa4a9dc9a7aab...` | 0.37 s, 1772 B |
| `step:snow` | Kenney kenney_impact-sounds: footstep_snow_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `980fb9a1c9227aed...` | 0.37 s, 1772 B |
| `step:snow` | Kenney kenney_impact-sounds: footstep_snow_002.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `db52bafdc66304f3...` | 0.37 s, 1772 B |
| `step:snow` | Kenney kenney_impact-sounds: footstep_snow_003.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `68272e3f1cabcabd...` | 0.37 s, 1772 B |
| `jetpackLoop` | Kenney kenney_sci-fi-sounds: thrusterFire_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/sci-fi-sounds> |  | CC0 1.0 | `0fdc474d93f209de...` | 5.00 s, 25244 B |

## Shot fallback: weapon-samples.js


Recorded excerpts were downloaded and prepared on **2026-11-04**. The seven
in-game weapon ids have different cached sound treatments; these are excerpts
and adaptations of existing recordings, **not seven newly authored recordings**.
Reload, pump, bolt, cylinder, supporting transient/body/ratchet layers, impacts,
hit sounds, and other game effects in `src/94-audio.js` are procedural.

## Supplied sources: inspected, not imported

- <https://pixabay.com/sound-effects/search/weapon/> — the listing was readable
  on this pass. <https://pixabay.com/service/license-summary/> returned HTTP 403.
  Search results describe a standalone-redistribution restriction, but indexed
  summaries were **not accepted as a verified licence for an individual asset**.
  No Pixabay sound was downloaded, embedded, or claimed as imported.
- <https://samples.landr.com/sfxs/weapons> — returned no usable page content;
  `https://samples.landr.com/license` likewise exposed no readable terms. The
  discovered `https://www.landr.com/en/terms-and-conditions` URL redirected to a
  404. No lawful public download plus verified redistribution grant was obtained.
  No subscription, login, purchase, preview, or watermarked LANDR audio was used.
- An OpenGameArt candidate and the original Kickstarter description returned
  HTTP 403. These access controls were not bypassed. The independent, publicly
  accessible GitHub mirror below supplied both the files and its explicit licence.

## Imported alternative: Firearm Sound Library

- **Title:** Firearm Sound Library; prepared near-distance firearm discharges.
- **Creator:** Ben Jaszczak and the Firearm Sound Library team.
- **Public mirror:** buddingmonkey / FreeFirearmsSFXLibrary.
- **Source URL:** <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary>
- **Pinned source revision:** `beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b`.
- **Origin, credited by the mirror:**
  <https://www.kickstarter.com/projects/bjjaszcz/the-firearm-sound-library/description>
- **Verified declared licence:** CC0 1.0 Universal / public-domain dedication.
- **Licence URL, retrieved successfully:**
  <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/LICENSE>
- **Canonical deed:** <https://creativecommons.org/publicdomain/zero/1.0/>
- **Canonical legal code:** <https://creativecommons.org/publicdomain/zero/1.0/legalcode.en>
- **Local licence copy:** `assets/audio/CC0-1.0.txt`.
- **Weapon/title metadata, retrieved successfully:**
  <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20Master%20Sheet.csv>

The mirror's root licence explicitly applies CC0, and its README credits the
original project/creator. CC0 permits copying, modification and redistribution,
including commercial use and embedding in an open-source game's asset files.
No endorsement is implied; this records the published licence, not an independent
chain-of-title warranty. Attribution is retained voluntarily.

## Download-to-local mapping

All seven entries share the creator, licence URLs and download date above.
Each link below is the exact public, revision-pinned original download URL.
The shipped local container is **`assets/audio/weapon-samples.js`**; its
`BCWeaponSamples.entries.<id>.base64` fields contain the corresponding MP3 bytes.
No raw WAVs or separate runtime MP3 downloads are required by the game.

| Weapon id / local entry | Recording title / original source file | Original download |
| --- | --- | --- |

## Preparation and size

The original WAVs are 96 kHz stereo recordings; some include multiple takes
separated by long silences. Only the first discharge was excerpted at the
offsets below. Preparation: retain 6 ms before the detected onset, downmix to
mono, resample to 22,050 Hz PCM, scale peak to 0.68, apply a 12-sample entrance
fade and a 25 ms exit fade, then encode mono MP3 at 64 kbit/s with LAME.
Metadata was stripped; no provider preview or watermark was involved.

At activation, `94-audio.js` decodes each embedded MP3 once, aligns any encoder
delay, and bakes two cached variants with its documented procedural layers.
No second discharge or automatic delayed pump/bolt sound is scheduled from a
shot: the combat owner controls discrete mechanism events. Added layers and
clipping protection never change legal fire cadence, damage or network packets.

| Entry | Original excerpt start (s) | Excerpt length (s) | Original WAV bytes | Embedded MP3 bytes |
| --- | ---: | ---: | ---: | ---: |

Total downloaded source audio: **39,421,770 bytes** (temporary preparation files,
not shipped). Total embedded MP3 payload: **25,381 bytes**. The standalone
classic-JS asset is **41,507 bytes**, including base64, metadata and comments.
Offline conversion tools are not runtime dependencies.

Local container `assets/audio/weapon-samples.js` SHA-256:
`e034b896582cc94dfc4ca631a9e372320b707bf90a42f519770ff57fb82d7abd`.

## SHA-256 integrity record

The first digest identifies the downloaded original WAV. The second identifies
the exact MP3 bytes stored in the named local `.base64` field, before WebAudio
decoding or procedural layering. Base64 round-trip integrity was checked during
asset packaging; this is not a claim that gameplay/browser checks were run.

| Entry | Original WAV SHA-256 | Embedded MP3 SHA-256 |
| --- | --- | --- |

## Integration contract

Load `<script src="assets/audio/weapon-samples.js"></script>` **before**
`<script src="src/94-audio.js"></script>`. The latter still loads after combat
and network and adopts their existing `audio()` context. Both HTTP and direct
`file://` launches use the same embedded bytes, with no runtime fetch, XHR,
external dependency or local-media CORS exception.

- Existing `BC.api.audio` APIs remain. `stats()` additionally reports
  `sampleState`, `sampledWeapons`, `sampleFailures`, `sampleShots`,
  `proceduralShots` and `maxVoices`; `weaponSource(id)` reports the actual
  recording/procedural-fallback state and source metadata.
- Shots/reloads/hits/impacts consume one authoritative `BC.emit('sfx', info)`.
  No secondary shot/damage/feed audio or remote `firePose` polling is used.
- Mechanisms accept `{kind:'mechanism', action:'pump'|'bolt'|'cylinder', weapon,
  position}` (the current combat emitter), the equivalent `kind:'action'`, or
  direct `{kind:'pump'|'bolt'|'cylinder', weapon, position}`. These are
  procedural. Recognized `ui` mechanism actions work too.
- One cached layered buffer / one HRTF voice per event. At most **24 sources**,
  including the reserved jetpack loop; at most 20 recycled one-shot chains.
- Final listener update remains `lateFrame` priority **1000**, with camera
  world-matrix refresh before reading its position/orientation. Mute/volume,
  inverse-distance attenuation, occlusion and shared-context behavior remain.
- Missing assets, decoder failure or unavailable WebAudio are honest graceful
  fallbacks; they are exposed in `stats()` / `weaponSource()`, not described as
  successful sample playback. Gameplay/browser validation belongs to the parent.
