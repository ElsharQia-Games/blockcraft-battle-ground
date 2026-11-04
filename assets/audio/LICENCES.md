# Weapon audio: licences and provenance

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
| `pistol` | 1911, .45 pistol, near-distance single discharge; `Prepared SFX/1911/A_42P.wav` | [WAV](https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/1911/A_42P.wav) |
| `rifle` | AR-15 / M4, .223 / 5.56x45 rifle, near-distance single discharge; `Prepared SFX/AR-15/D_32P.wav` | [WAV](https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/AR-15/D_32P.wav) |
| `shotgun` | Benelli Nova, 12 gauge pump-action shotgun, near-distance single discharge; `Prepared SFX/Nova/O_21P.wav` | [WAV](https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/Nova/O_21P.wav) |
| `smg` | Carl Gustav M45 / Swedish K, 9 mm SMG, near-distance single discharge; `Prepared SFX/Carl Gustav M45/G_31P.wav` | [WAV](https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/Carl%20Gustav%20M45/G_31P.wav) |
| `sniper` | Tikka T3, .30-06 bolt-action rifle, near-distance single discharge; `Prepared SFX/Tikka/W_29P.wav` | [WAV](https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/Tikka/W_29P.wav) |
| `revolver` | Smith & Wesson 642, .38 Special revolver, near-distance single discharge; `Prepared SFX/Smith & Wesson 642/V_27P.wav` | [WAV](https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/Smith%20%26%20Wesson%20642/V_27P.wav) |
| `lmg` | **AK-47**, 7.62x39 rifle, near-distance single discharge; `Prepared SFX/AK-47/C_28P.wav`. Processed with a lower body and procedural belt-like rattle for the game's LMG; **not an original LMG recording**. | [WAV](https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/AK-47/C_28P.wav) |

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
| `pistol` | 0.931750 | 0.32 | 5,489,450 | 3,387 |
| `rifle` | 0.697313 | 0.26 | 5,889,684 | 2,760 |
| `shotgun` | 0.420250 | 0.46 | 3,931,936 | 4,432 |
| `smg` | 0.299479 | 0.18 | 5,294,180 | 2,133 |
| `sniper` | 0.569437 | 0.56 | 5,593,406 | 5,268 |
| `revolver` | 0.796771 | 0.38 | 6,034,334 | 3,805 |
| `lmg` | 0.604958 | 0.34 | 7,188,780 | 3,596 |

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
| `pistol` | `8e84438e771c157155a6a1ff47a6a7a7d81b6f39b185d41e426c57337a82254a` | `fb52b1a4a6e480138db0a0a5b2c7048beeb6e93279a0734fd85beec17e9a5120` |
| `rifle` | `acee9d2106b68fe5956225a19d7aedf943d97793817f9bda9d486a2b74b0a812` | `1d4caa6269bf3acb12928ab8e3543a24510143c41f6a7b5d4322a838229b7e63` |
| `shotgun` | `5661d0625e4634f19e6e316c13693b80c8e28cd9f716cf9c75c465153ae40815` | `b51f77a0682dc98e8380d3a27fb7a15709a7f675534bb809b7a4192e53b97bc2` |
| `smg` | `5982c6c2fa44545b750ba6217ed57797a6a15c02f5c9943ac0e99e5f3ab2b158` | `c450151d6c70e33509f8afb4e222e39fcb349c688b1bf0521873ac081fba1481` |
| `sniper` | `b1ffe3c104391bf8ceb8337aa4d5a2ca47938fb88ccbd051cdd2b2e205d9e72b` | `0e6924ca44984d173cd4c6501e48f107fca41f0443708589ab2d52ff88ef981a` |
| `revolver` | `dc9a11f7e6544139f38cadccf3373fed733f2e000caca1b2328575293838fc58` | `2bc7d983d1d8f95b99b848780c4cd94f85b9b1642d73c4e9a165cfae1e812a40` |
| `lmg` | `e0934c1d79192d2216db62fdf6ab57bf9d5d585267af367a1cfb21f0972a537d` | `ab721c09da3337366467f5ddf5fe973c44889d834411886cc11855fae90cb359` |

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
