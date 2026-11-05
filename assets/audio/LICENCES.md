# Game audio: licences and provenance

**Current sound set (2026-11-05, bank v2).** Every sound comes from the real recordings in
`assets/audio/sfx-bank.js` and is mapped to how it is heard in the game:

- **Gunshots:** two or three close-mic takes per gun (the shooter's own position and the
  front near position), plus two far-mic takes. Shots more than 45 m away use the far
  recording. The LMG uses the AK-47's heavier takes, because the CC0 library has no
  belt-fed gun.
- **Reloads:** each gun's own recorded handling (magazine, slide, bolt, shell tube,
  cylinder), placed at that weapon's animation stages. Shot-cycle pump, bolt and cylinder
  sounds come from the same guns.
- **Impacts:** bullets sound like the block they hit (wood, stone, soft ground, glass,
  metal). Blocks shot apart shatter, splinter or crumble.
- **Players:** body hits, a metallic headshot ding, a hit tick and a kill-confirm chime.
- **Movement:** footsteps on grass, stone, wood and snow, and a soft landing thud.
- **Jetpack:** a seamless thruster loop.

**Processing.** The raw Firearm Sound Library takes are 192 kHz multi-shot recordings.
Each shot was located by its transient and cut 2 ms before it. Its natural tail and
outdoor echo are kept up to the next separate event, then faded. Every clip is
peak-normalised to -1 dBFS and encoded as mono 32 kHz MP3 (32-56 kbit/s). Loudness
is set per category in `src/94-audio.js`. Playback adds a small pitch and gain
variation so repeats never sound identical.

Procedural synthesis remains only for dragons, splash, and the death and respawn stingers.
`weapon-samples.js` is kept as a fallback for shots.

## Recorded effects bank

Sources (all CC0 1.0):

- Firearm Sound Library, by Ben Jaszczak and the Firearm Sound Library team.
  <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary>, LICENSE at commit beb2f40.
- Kenney Impact Sounds, Sci-fi Sounds and Interface Sounds. <https://kenney.nl>, with the
  bundled License.txt.
- "75 CC0 breaking / falling / hit sfx" on OpenGameArt.
  <https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx>, per the page's
  licence field.

Rejected during sourcing: clips whose material appeared to belong to someone else (ripped
from videos or games), "authentic" recordings with no stated recordist, and any CC-BY,
CC-BY-SA, OGA-BY or non-commercial files.

| Bank key | Recording | Author | Source page | Download | Licence | Source SHA-256 | Embedded |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `shot:pistol` | X_38.wav:  (X_38.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Walther%20PPQ/X_38.wav | CC0 1.0 | `175029b8bce507c6...` | 0.86 s, 6344 B |
| `shot:pistol` | X_38.wav:  (X_38.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Walther%20PPQ/X_38.wav | CC0 1.0 | `175029b8bce507c6...` | 0.76 s, 5840 B |
| `shot:pistol` | X_39.wav:  (X_39.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Walther%20PPQ/X_39.wav | CC0 1.0 | `5d13e71a119f9836...` | 0.68 s, 5084 B |
| `shotFar:pistol` | X_31.wav:  (X_31.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Walther%20PPQ/X_31.wav | CC0 1.0 | `125f40a55eb4c16f...` | 1.07 s, 5624 B |
| `shotFar:pistol` | X_33.wav:  (X_33.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Walther%20PPQ/X_33.wav | CC0 1.0 | `40197202e4529d0b...` | 0.91 s, 4904 B |
| `shot:rifle` | C_39.wav:  (C_39.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_39.wav | CC0 1.0 | `2109bd8c65c35ce4...` | 0.78 s, 5840 B |
| `shot:rifle` | C_42.wav:  (C_42.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_42.wav | CC0 1.0 | `a234a8817d6632f4...` | 0.93 s, 6848 B |
| `shot:rifle` | C_28.wav:  (C_28.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_28.wav | CC0 1.0 | `da2e211bf619e145...` | 1.00 s, 7352 B |
| `shotFar:rifle` | C_17.wav:  (C_17.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_17.wav | CC0 1.0 | `325a353108dc987e...` | 0.98 s, 5264 B |
| `shotFar:rifle` | C_23.wav:  (C_23.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_23.wav | CC0 1.0 | `3f4bd0fd77079b51...` | 1.01 s, 5444 B |
| `shot:shotgun` | K_19.wav:  (K_19.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Model%2012/K_19.wav | CC0 1.0 | `744887e3447ad4f0...` | 1.01 s, 7604 B |
| `shot:shotgun` | K_22.wav:  (K_22.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Model%2012/K_22.wav | CC0 1.0 | `ef417da6a66c11e2...` | 1.03 s, 7604 B |
| `shot:shotgun` | K_20.wav:  (K_20.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Model%2012/K_20.wav | CC0 1.0 | `8ada6e8e477ab5ce...` | 1.04 s, 7604 B |
| `shotFar:shotgun` | K_16.wav:  (K_16.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Model%2012/K_16.wav | CC0 1.0 | `2ea536d7cd8edd32...` | 1.51 s, 7784 B |
| `shotFar:shotgun` | K_18.wav:  (K_18.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Model%2012/K_18.wav | CC0 1.0 | `789d6e1580e305db...` | 1.45 s, 7604 B |
| `shot:smg` | P_25.wav:  (P_25.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/PPSh/P_25.wav | CC0 1.0 | `c64767aaa7e01b8a...` | 0.70 s, 5336 B |
| `shot:smg` | P_25.wav:  (P_25.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/PPSh/P_25.wav | CC0 1.0 | `c64767aaa7e01b8a...` | 0.64 s, 4832 B |
| `shot:smg` | P_30.wav:  (P_30.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/PPSh/P_30.wav | CC0 1.0 | `c4d0d1e1ecd825a7...` | 0.70 s, 5336 B |
| `shotFar:smg` | P_12.wav:  (P_12.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/PPSh/P_12.wav | CC0 1.0 | `940d486aa3da1241...` | 0.71 s, 3824 B |
| `shotFar:smg` | P_14.wav:  (P_14.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/PPSh/P_14.wav | CC0 1.0 | `2728ca5a2929b93e...` | 0.88 s, 4724 B |
| `shot:sniper` | M_20.wav:  (M_20.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Mosin%20Nagant/M_20.wav | CC0 1.0 | `5a270e6e2703b7c5...` | 1.34 s, 9872 B |
| `shot:sniper` | M_21.wav:  (M_21.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Mosin%20Nagant/M_21.wav | CC0 1.0 | `4c793971e03ce2e1...` | 1.60 s, 11636 B |
| `shot:sniper` | M_19.wav:  (M_19.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Mosin%20Nagant/M_19.wav | CC0 1.0 | `f5cd0521f2fc7bc7...` | 1.60 s, 11636 B |
| `shotFar:sniper` | M_23.wav:  (M_23.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Mosin%20Nagant/M_23.wav | CC0 1.0 | `cd059ad7c0214d19...` | 1.56 s, 8144 B |
| `shotFar:sniper` | M_25.wav:  (M_25.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Mosin%20Nagant/M_25.wav | CC0 1.0 | `d7945f8117299a67...` | 1.59 s, 8324 B |
| `shot:revolver` | V_24.wav:  (V_24.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Smith%20%26%20Wesson%20642/V_24.wav | CC0 1.0 | `0077e23fec7ac27a...` | 1.02 s, 7604 B |
| `shot:revolver` | V_27.wav:  (V_27.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Smith%20%26%20Wesson%20642/V_27.wav | CC0 1.0 | `f55045043056c597...` | 1.10 s, 8108 B |
| `shot:revolver` | V_25.wav:  (V_25.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Smith%20%26%20Wesson%20642/V_25.wav | CC0 1.0 | `0133f668d5ffd0ee...` | 1.00 s, 7352 B |
| `shotFar:revolver` | V_21.wav:  (V_21.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Smith%20%26%20Wesson%20642/V_21.wav | CC0 1.0 | `7f3e7162665aac88...` | 1.14 s, 5984 B |
| `shotFar:revolver` | V_23.wav:  (V_23.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Smith%20%26%20Wesson%20642/V_23.wav | CC0 1.0 | `b700d31ac6ca9381...` | 1.30 s, 6884 B |
| `shot:lmg` | C_25.wav:  (C_25.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_25.wav | CC0 1.0 | `17cf3e4589b344c5...` | 1.00 s, 7352 B |
| `shot:lmg` | C_25.wav:  (C_25.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_25.wav | CC0 1.0 | `17cf3e4589b344c5...` | 1.00 s, 7352 B |
| `shot:lmg` | C_28.wav:  (C_28.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_28.wav | CC0 1.0 | `da2e211bf619e145...` | 1.00 s, 7352 B |
| `shotFar:lmg` | C_17.wav:  (C_17.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_17.wav | CC0 1.0 | `325a353108dc987e...` | 1.30 s, 6884 B |
| `shotFar:lmg` | C_23.wav:  (C_23.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_23.wav | CC0 1.0 | `3f4bd0fd77079b51...` | 1.01 s, 5444 B |
| `rl:pistol:0` | X_5.wav:  (X_5.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Walther%20PPQ/X_5.wav | CC0 1.0 | `6abd03535fe5e194...` | 0.70 s, 3824 B |
| `rl:pistol:1` | X_4.wav:  (X_4.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Walther%20PPQ/X_4.wav | CC0 1.0 | `dff1bc49877c11c4...` | 0.70 s, 3824 B |
| `rl:pistol:2` | X_11.wav:  (X_11.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Walther%20PPQ/X_11.wav | CC0 1.0 | `ecdd5b1755c56ce4...` | 0.70 s, 3824 B |
| `rl:rifle:0` | C_11.wav:  (C_11.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_11.wav | CC0 1.0 | `c40234bd04873c6d...` | 0.70 s, 3824 B |
| `rl:rifle:1` | C_10.wav:  (C_10.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_10.wav | CC0 1.0 | `13657ef36e69f13b...` | 0.70 s, 3824 B |
| `rl:rifle:2` | C_12.wav:  (C_12.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_12.wav | CC0 1.0 | `6c5956e5adb3f5f2...` | 0.70 s, 3824 B |
| `rl:shotgun:0` | K_4.wav:  (K_4.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Model%2012/K_4.wav | CC0 1.0 | `55d6756dfc3aa17c...` | 0.58 s, 3284 B |
| `rl:shotgun:1` | K_3.wav:  (K_3.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Model%2012/K_3.wav | CC0 1.0 | `1aa07095e8931e6e...` | 0.67 s, 3644 B |
| `rl:shotgun:2` | K_6.wav:  (K_6.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Model%2012/K_6.wav | CC0 1.0 | `015b685a7d12a0d1...` | 0.70 s, 3824 B |
| `rl:smg:0` | P_7.wav:  (P_7.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/PPSh/P_7.wav | CC0 1.0 | `4b242622a98e67df...` | 0.70 s, 3824 B |
| `rl:smg:1` | P_6.wav:  (P_6.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/PPSh/P_6.wav | CC0 1.0 | `4c52b8362f8d7a1d...` | 0.62 s, 3464 B |
| `rl:smg:2` | P_8.wav:  (P_8.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/PPSh/P_8.wav | CC0 1.0 | `a7847ce4bb40fd95...` | 0.70 s, 3824 B |
| `rl:sniper:0` | M_2.wav:  (M_2.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Mosin%20Nagant/M_2.wav | CC0 1.0 | `0d966c11d74084e1...` | 0.57 s, 3104 B |
| `rl:sniper:1` | M_4.wav:  (M_4.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Mosin%20Nagant/M_4.wav | CC0 1.0 | `cbfd642c9f45a0c5...` | 0.55 s, 3104 B |
| `rl:sniper:2` | M_18.wav:  (M_18.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Mosin%20Nagant/M_18.wav | CC0 1.0 | `667bca02bd5f8d0b...` | 0.70 s, 3824 B |
| `rl:sniper:3` | M_18.wav:  (M_18.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Mosin%20Nagant/M_18.wav | CC0 1.0 | `667bca02bd5f8d0b...` | 0.70 s, 3824 B |
| `rl:sniper:4` | M_6.wav:  (M_6.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Mosin%20Nagant/M_6.wav | CC0 1.0 | `e07bf482c60ba4e6...` | 0.59 s, 3284 B |
| `rl:revolver:0` | V_9.wav:  (V_9.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Smith%20%26%20Wesson%20642/V_9.wav | CC0 1.0 | `a7042943cdcee305...` | 0.70 s, 3824 B |
| `rl:revolver:1` | V_3.wav:  (V_3.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Smith%20%26%20Wesson%20642/V_3.wav | CC0 1.0 | `932abf13f3169b17...` | 0.64 s, 3464 B |
| `rl:revolver:2` | V_2.wav:  (V_2.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Smith%20%26%20Wesson%20642/V_2.wav | CC0 1.0 | `a2fa4e7d8822bb4b...` | 0.56 s, 3104 B |
| `rl:revolver:3` | V_10.wav:  (V_10.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Smith%20%26%20Wesson%20642/V_10.wav | CC0 1.0 | `8322ac966250b2e0...` | 0.58 s, 3284 B |
| `rl:lmg:0` | C_13.wav:  (C_13.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_13.wav | CC0 1.0 | `f9382d1b612e28b3...` | 0.62 s, 3464 B |
| `rl:lmg:1` | C_11.wav:  (C_11.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_11.wav | CC0 1.0 | `c40234bd04873c6d...` | 0.70 s, 3824 B |
| `rl:lmg:2` | C_10.wav:  (C_10.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_10.wav | CC0 1.0 | `13657ef36e69f13b...` | 0.70 s, 3824 B |
| `rl:lmg:3` | C_13.wav:  (C_13.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_13.wav | CC0 1.0 | `f9382d1b612e28b3...` | 0.62 s, 3464 B |
| `rl:lmg:4` | C_12.wav:  (C_12.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_12.wav | CC0 1.0 | `6c5956e5adb3f5f2...` | 0.70 s, 3824 B |
| `rl:lmg:5` | C_12.wav:  (C_12.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_12.wav | CC0 1.0 | `6c5956e5adb3f5f2...` | 0.70 s, 3824 B |
| `pump` | K_6.wav:  (K_6.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Model%2012/K_6.wav | CC0 1.0 | `015b685a7d12a0d1...` | 0.75 s, 4004 B |
| `bolt` | M_14.wav:  (M_14.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Mosin%20Nagant/M_14.wav | CC0 1.0 | `8c400580a1f65fe2...` | 0.83 s, 4364 B |
| `cylinder` | V_10.wav:  (V_10.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/Smith%20%26%20Wesson%20642/V_10.wav | CC0 1.0 | `8322ac966250b2e0...` | 0.25 s, 1484 B |
| `dryfire` | C_7.wav:  (C_7.wav) | Ben Jaszczak and the Firearm Sound Library team | <https://github.com/buddingmonkey/FreeFirearmsSFXLibrary> | https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/Master%20Tracks/AK-47/C_7.wav | CC0 1.0 | `8220013b137bdc58...` | 0.30 s, 1844 B |
| `impact:wood` | Kenney kenney_impact-sounds: impactWood_medium_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `1723a9fd25103ed4...` | 0.33 s, 2024 B |
| `impact:stone` | Kenney kenney_impact-sounds: impactMining_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `36b4ea107222d073...` | 0.30 s, 1844 B |
| `impact:soft` | Kenney kenney_impact-sounds: impactSoft_medium_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `7d3ba0bb5e60a11b...` | 0.12 s, 944 B |
| `impact:metal` | Kenney kenney_impact-sounds: impactMetal_light_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `33b5e6e37c6e9d54...` | 0.37 s, 2204 B |
| `impact:glass` | Kenney kenney_impact-sounds: impactGlass_light_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `d750cf88097d0c3e...` | 0.23 s, 1484 B |
| `hit` | Kenney kenney_impact-sounds: impactPunch_medium_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `486988aa2d6440ff...` | 0.35 s, 2024 B |
| `impact:wood` | Kenney kenney_impact-sounds: impactWood_medium_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `15271dbe8e2872db...` | 0.33 s, 2024 B |
| `impact:stone` | Kenney kenney_impact-sounds: impactMining_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `61235a18de3f3d92...` | 0.40 s, 2384 B |
| `impact:soft` | Kenney kenney_impact-sounds: impactSoft_medium_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `7642a4fd43e547af...` | 0.18 s, 1304 B |
| `impact:metal` | Kenney kenney_impact-sounds: impactMetal_light_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `fba69c467ddd85da...` | 0.25 s, 1484 B |
| `impact:glass` | Kenney kenney_impact-sounds: impactGlass_light_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `05e513fbd4282906...` | 0.21 s, 1304 B |
| `hit` | Kenney kenney_impact-sounds: impactPunch_medium_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `e71d23abcc3f10d9...` | 0.35 s, 2024 B |
| `impact:wood` | Kenney kenney_impact-sounds: impactWood_medium_002.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `3f3f1917428b828f...` | 0.33 s, 2024 B |
| `impact:stone` | Kenney kenney_impact-sounds: impactMining_002.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `059558ec751115ca...` | 0.40 s, 2384 B |
| `impact:soft` | Kenney kenney_impact-sounds: impactSoft_medium_002.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `5069e3571a77d7f7...` | 0.13 s, 944 B |
| `impact:metal` | Kenney kenney_impact-sounds: impactMetal_light_002.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `25a96f90a9a1f88a...` | 0.23 s, 1484 B |
| `impact:glass` | Kenney kenney_impact-sounds: impactGlass_light_002.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `710db7451bb7857b...` | 0.21 s, 1304 B |
| `hit` | Kenney kenney_impact-sounds: impactPunch_medium_002.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `6492f9ccbc8d24dc...` | 0.35 s, 2024 B |
| `headshot` | Kenney kenney_impact-sounds: impactMetal_light_003.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `92d5db6bfc672d9d...` | 0.40 s, 2384 B |
| `land` | Kenney kenney_impact-sounds: impactSoft_heavy_000.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `49e7ca88743fca97...` | 0.35 s, 2024 B |
| `headshot` | Kenney kenney_impact-sounds: impactMetal_light_004.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `9b1c35820fba5070...` | 0.21 s, 1304 B |
| `land` | Kenney kenney_impact-sounds: impactSoft_heavy_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/impact-sounds> |  | CC0 1.0 | `4d0096364ba9e461...` | 0.35 s, 2024 B |
| `break:glass` | 75 CC0 breaking/falling/hit sfx: bfh1_glass_breaking_01.ogg | OpenGameArt contributor (CC0 pack) | <https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx> |  | CC0 1.0 | `438c45398ee77a40...` | 0.75 s, 4004 B |
| `break:glass` | 75 CC0 breaking/falling/hit sfx: bfh1_glass_breaking_03.ogg | OpenGameArt contributor (CC0 pack) | <https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx> |  | CC0 1.0 | `065edd6caeb5846f...` | 0.78 s, 4184 B |
| `break:wood` | 75 CC0 breaking/falling/hit sfx: bfh1_wood_breaking_01.ogg | OpenGameArt contributor (CC0 pack) | <https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx> |  | CC0 1.0 | `24e84b95c0fc94a1...` | 0.29 s, 1664 B |
| `break:wood` | 75 CC0 breaking/falling/hit sfx: bfh1_wood_breaking_02.ogg | OpenGameArt contributor (CC0 pack) | <https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx> |  | CC0 1.0 | `6ff0b54f0efd9e0c...` | 0.22 s, 1484 B |
| `break:stone` | 75 CC0 breaking/falling/hit sfx: bfh1_rock_breaking_01.ogg | OpenGameArt contributor (CC0 pack) | <https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx> |  | CC0 1.0 | `970cac3139e15300...` | 0.90 s, 4724 B |
| `break:stone` | 75 CC0 breaking/falling/hit sfx: bfh1_rock_breaking_02.ogg | OpenGameArt contributor (CC0 pack) | <https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx> |  | CC0 1.0 | `3e06b794511f693b...` | 0.86 s, 4724 B |
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
| `ui` | Kenney Interface Sounds: click_002.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/interface-sounds> |  | CC0 1.0 | `adcd1f4adc35f1b4...` | 0.01 s, 404 B |
| `confirm` | Kenney Interface Sounds: confirmation_001.ogg | Kenney (kenney.nl) | <https://kenney.nl/assets/interface-sounds> |  | CC0 1.0 | `063564703b6094d7...` | 0.29 s, 1844 B |

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
