# Game audio: licences and provenance

**Current sound set (2026-11-05).** Gunshots, reloads, weapon handling, body hits,
bullet impacts, hit and kill confirmation ticks, footsteps and landings now come
from the real recordings in **Recorded effects bank** below
(`assets/audio/sfx-bank.js`). Each weapon's reload is assembled in the browser
from the recorded magazine, rack, slide, pump, bolt and cylinder clips, placed
at that weapon's reload stages. `weapon-samples.js` (described further down)
remains as a fallback for shots, and procedural synthesis remains for effects
without a recording (jetpack, dragons, splash, death and respawn stingers).

## Recorded effects bank

Downloaded 2026-11-05. Every file is CC0 1.0, verified on the file's own page or
in its pack's licence file. Each was converted to mono 22.05 kHz MP3 (32–56 kbit/s):
leading silence trimmed, cut to the listed length with a 60 ms fade-out, and
loudness-normalised (EBU R128, -16 LUFS integrated, -1.5 dBTP). The LMG report
is the AR-15 recording pitched down 14% and low-passed at 6.5 kHz for a heavier
sound. The hashes are of the downloaded source files. The embedded bytes have
their own `sha256` in the bank.

Rejected during sourcing: recordings whose source material appeared to belong
to someone else (clips ripped from videos or games), unverified "authentic"
recordings with no stated recordist, and any CC-BY, CC-BY-SA, OGA-BY or
non-commercial files.

| Bank key | Recording | Author | Source page | Download | Licence | Source SHA-256 | Embedded |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `shot:pistol` | Walther PPQ 9mm, near distance | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/Walther%20PPQ/X_39P.wav> | CC0-1.0 | `797a2fba98b2be0df97b234c4f63457f1dac5d1b3b999c2862b0a4465401b55d` | 0.35 s, 3151 B |
| `shot:rifle` | AK-47 7.62x39 single shot, near | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/AK-47/C_28P.wav> | CC0-1.0 | `efee164b09ed7665eb87215a13c8fe716ead4cc5ec6ba1482016b93416e8a2e2` | 0.45 s, 3883 B |
| `shot:shotgun` | Winchester Model 12, 12 gauge, near | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/Model%2012/K_22P.wav> | CC0-1.0 | `98c5f9f47f7761421a26ef54dc3ad2cdde08323e8300ab1896fd02c007f9bfd3` | 0.7 s, 5528 B |
| `shot:smg` | PPSh 7.62x25, near | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/PPSh/P_30P.wav> | CC0-1.0 | `3c47507f5e85e0ecdf28192853986045e5480efe6bc53c6bd8d3344bb2cfb63a` | 0.4 s, 3517 B |
| `shot:sniper` | Mosin Nagant 7.62x54R, near | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/Mosin%20Nagant/M_21P.wav> | CC0-1.0 | `6018bdaea677df04511314871f76b0bb07e223381797ea02d15f5e2b0d2b4ed8` | 0.35 s, 3151 B |
| `shot:revolver` | snub_nose_357_magnum_noisegate-17.80.wav (recorded by the author) | DarkShroom | <https://freesound.org/people/DarkShroom/sounds/645316/> | <https://cdn.freesound.org/previews/645/645316_3139426-hq.mp3> | CC0-1.0 | `59dd43cf8df01da3f2fd23178f75fb7b55db3ae4a2313c49b7f37522942b6673` | 0.33 s, 2968 B |
| `shot:lmg` | AR-15 near (pitched down 14% for the LMG) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Prepared%20SFX/AR-15/D_32P.wav> | CC0-1.0 | `92572b4c9bea7eed7985a19410f2e1c90b2554962a73e2f0be97b2de98e14226` | 0.49 s, 4066 B |
| `magOut` | AR-15 detach loaded magazine | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AR-15/D_5.wav> | CC0-1.0 | `a09fd97938bdf1ee0e9b3e100820156d494ea4bda8a4607821074cd42c4f4acc` | 0.9 s, 5059 B |
| `magIn` | AR-15 insert loaded magazine | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AR-15/D_4.wav> | CC0-1.0 | `85454c3562ccfcdf5972f5d6e784daab11f7db65d9abda14f70048c495ee3be0` | 0.9 s, 5059 B |
| `rack` | AR-15 full rack | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AR-15/D_14.wav> | CC0-1.0 | `fa0e671120757be05d4a57bdbd473ea7393b0a624098775f338adb62c398ff19` | 0.5 s, 3099 B |
| `slide` | 1911 full slide rack | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/1911/A_24.wav> | CC0-1.0 | `3c38a85f55089bafb4b1e86f0177735860ef1afae3df85f8a5e8b6f7f172f8cd` | 0.32 s, 2185 B |
| `bolt` | Tikka T3 full bolt cycle | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Tikka/W_16.wav> | CC0-1.0 | `9b8fb4f5c4f1acefc2c466f255928f0a4cfd81f047364f7a3971c8f0c67ff664` | 1.2 s, 6495 B |
| `pump` | Benelli Nova full pump cycle | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Nova/O_6.wav> | CC0-1.0 | `e164c884433c99f2cddcdb3cf77aeb12280bcd89747cc491e9b73c654ee69426` | 0.7 s, 4014 B |
| `cylinder` | S&W 642 flip cylinder closed | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | <https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Smith%20%26%20Wesson%20642/V_10.wav> | CC0-1.0 | `022e620d8ad3aa4086034be215b2ab4e4e064504b4f98a6d0e81fb5188d6ec25` | 0.6 s, 3491 B |
| `hit` | Impact pack, meat01 | qubodup | <https://opengameart.org/content/impact> | <https://opengameart.org/sites/default/files/qubodupImpact.7z> | CC0-1.0 | `366c9a37e90a19980ef8f2dec02bbf964ed02d0b683ee6f5472b354a50e7ee0e` | 0.35 s, 2316 B |
| `hit` | Impact pack, meat02 | qubodup | <https://opengameart.org/content/impact> | <https://opengameart.org/sites/default/files/qubodupImpact.7z> | CC0-1.0 | `c97ec34ab509cff9c43d8a5a43306e500ba235d9cc3d6be021cbc7b25218b3fe` | 0.35 s, 2316 B |
| `impact` | Impact pack, stone | qubodup | <https://opengameart.org/content/impact> | <https://opengameart.org/sites/default/files/qubodupImpact.7z> | CC0-1.0 | `c882a6cff88a297099928a0c46e7146b311342d14319a17eca9c19719d5b237d` | 0.35 s, 2316 B |
| `impact` | Single Rock hit dirt 2 | worthahep88 | <https://freesound.org/people/worthahep88/sounds/319229/> | <https://cdn.freesound.org/previews/319/319229_3443504-hq.mp3> | CC0-1.0 | `c1c978d57b9fcb1c3b09a055dfea2616395364daefa83e4681ed08527a5915cf` | 0.45 s, 2838 B |
| `ui` | Interface Sounds 1.0, click_002 | Kenney | <https://opengameart.org/content/interface-sounds> | <https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip> | CC0-1.0 | `adcd1f4adc35f1b41bc1b5bbefeff7aa44f2f3f0d96d3199b544140c7c1e761c` | 0.01 s, 618 B |
| `confirm` | Interface Sounds 1.0, confirmation_001 | Kenney | <https://opengameart.org/content/interface-sounds> | <https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip> | CC0-1.0 | `063564703b6094d70718a3e787a55cc9141611e4ecd6b6637f8828f79b4a8c3a` | 0.29 s, 2054 B |
| `step:soft` | Fantozzi's Footsteps, SandL1 | Fantozzi (posted by qubodup) | <https://opengameart.org/content/fantozzis-footsteps-grasssand-stone> | <https://opengameart.org/sites/default/files/Fantozzi-footsteps.7z> | CC0-1.0 | `93a2630579a82507e3c6ceab9b012f71a50cf8922f4beadb14057dcc0636b099` | 0.3 s, 1689 B |
| `step:soft` | Fantozzi's Footsteps, SandR1 | Fantozzi (posted by qubodup) | <https://opengameart.org/content/fantozzis-footsteps-grasssand-stone> | <https://opengameart.org/sites/default/files/Fantozzi-footsteps.7z> | CC0-1.0 | `3514d12f3369297233e915814364ed02902003d4103b010371c2ac15c2aa48fe` | 0.3 s, 1689 B |
| `step:soft` | Fantozzi's Footsteps, SandL2 | Fantozzi (posted by qubodup) | <https://opengameart.org/content/fantozzis-footsteps-grasssand-stone> | <https://opengameart.org/sites/default/files/Fantozzi-footsteps.7z> | CC0-1.0 | `9bb57478cc96e1410cae27d926aa8d77d5f2d368d9776822f63cf0b37c6d2faf` | 0.3 s, 1689 B |
| `step:soft` | Fantozzi's Footsteps, SandR2 | Fantozzi (posted by qubodup) | <https://opengameart.org/content/fantozzis-footsteps-grasssand-stone> | <https://opengameart.org/sites/default/files/Fantozzi-footsteps.7z> | CC0-1.0 | `0356f659313887f01a9f21fd5bedf57a77073d0d74d57b5621279ee453a80f3c` | 0.3 s, 1689 B |
| `step:hard` | Fantozzi's Footsteps, StoneL1 | Fantozzi (posted by qubodup) | <https://opengameart.org/content/fantozzis-footsteps-grasssand-stone> | <https://opengameart.org/sites/default/files/Fantozzi-footsteps.7z> | CC0-1.0 | `7cfa4a2f500ae2bd19a961022296611d837c34ca2e556fe68deb692388f49971` | 0.3 s, 1689 B |
| `step:hard` | Fantozzi's Footsteps, StoneR1 | Fantozzi (posted by qubodup) | <https://opengameart.org/content/fantozzis-footsteps-grasssand-stone> | <https://opengameart.org/sites/default/files/Fantozzi-footsteps.7z> | CC0-1.0 | `7073bddd2e3ba432e15a83844180c0ebc52835c2c6bab0fa902ee5952499c729` | 0.3 s, 1689 B |
| `step:hard` | Fantozzi's Footsteps, StoneL2 | Fantozzi (posted by qubodup) | <https://opengameart.org/content/fantozzis-footsteps-grasssand-stone> | <https://opengameart.org/sites/default/files/Fantozzi-footsteps.7z> | CC0-1.0 | `dcbd6be44af4b3206daa36c5398035ca527bb057c51ce00482b9ca6356be2468` | 0.3 s, 1689 B |
| `step:hard` | Fantozzi's Footsteps, StoneR2 | Fantozzi (posted by qubodup) | <https://opengameart.org/content/fantozzis-footsteps-grasssand-stone> | <https://opengameart.org/sites/default/files/Fantozzi-footsteps.7z> | CC0-1.0 | `d66330b4a32e93b0dfdcb8c53667654de8702a0fa48b2d06c48d94dc66b3e1cc` | 0.3 s, 1689 B |
| `land` | Jump Landing 1 | macro | <https://opengameart.org/content/jump-landing> | <https://opengameart.org/sites/default/files/Jump%201.wav> | CC0-1.0 | `19a56499a8b46bdea815eb9aa7554e7aa5f4d3cd1f7f49f403c327d77fecc6c4` | 0.45 s, 2316 B |
| `land` | Jump Landing 2 | macro | <https://opengameart.org/content/jump-landing> | <https://opengameart.org/sites/default/files/Jump%202.wav> | CC0-1.0 | `e7de86bd7f37918832849c1d4e8cff5e1db447e9e89949b0d9031cae67d6272f` | 0.45 s, 2316 B |

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
