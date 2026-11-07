# Game audio: licences and provenance

Every sound the game ships is listed here. This file is generated from the build
manifest, so it records what is actually embedded.

**Licence rule:** CC0 1.0 or public domain only, verified on the source page or in a
bundled licence file. Local copy of CC0: `assets/audio/CC0-1.0.txt`. Credit is voluntary.

| Container | Contents | Size on disk |
| --- | --- | --- |
| `weapon-samples.js` | gunshot takes, base64 MP3 | 439 KB |
| `sfx-bank.js` | everything else, base64 MP3 | 1063 KB |

Embedded MP3 total: **1148225 bytes** in 181 clips. No raw audio or runtime download is needed,
and `file://` launches use the same embedded bytes.

## Sources

| Source | Author | Licence, and where it was verified |
| --- | --- | --- |
| [Firearm Sound Library](https://github.com/buddingmonkey/FreeFirearmsSFXLibrary), revision `beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b` | Ben Jaszczak and team | CC0 1.0: repository `LICENSE` at that revision. Each master track was checked against its git blob hash. |
| [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds), [Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds), [Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney | CC0 1.0: bundled `License.txt` and the asset page. |
| [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio), via the CC0 port [Boyquotes/kenney-rpg-audio-for-godot](https://github.com/Boyquotes/kenney-rpg-audio-for-godot) | Kenney | CC0 1.0: asset page and the repository licence. |
| [Yellowstone sound library](https://www.nps.gov/yell/learn/photosmultimedia/soundlibrary.htm) | U.S. National Park Service | Public domain. The page states the files "were recorded in the park and are in the public domain" and "may be downloaded and used without limitation". |
| [Bathtub water splashes](https://commons.wikimedia.org/wiki/File:Bathtub_water_splashes.ogg) | gradha, via pdsounds.org | Public domain: Wikimedia Commons file licence field. |

## Rejected during sourcing

- **OpenGameArt** (Dragon Flap, Large Wings Flap, Random SFX and others): its `robots.txt`
  disallows this kind of automated agent and pages returned HTTP 403, so nothing was taken
  from it and those licences were not verified. The wing and creature sounds were built from
  the Yellowstone library instead.
- **Fast UI Sounds** (itch.io): the page grants a non-exclusive licence with no right to
  remix, which is not CC0.
- **Freesound**: disallows Anthropic crawlers and requires a login to download.
- **Sonniss GDC bundles**: not CC0 or public domain.
- **Pixabay, LANDR**: their licences could not be verified.
- **Wikimedia Commons** CC BY and CC BY-SA files, including `Water on Rocks.ogg`,
  `Wav splash.wav` and the Gravity Sound glass recordings.

## Designed sounds, not plain recordings

- **Crossbow shot:** no verified CC0 crossbow recording was found. It layers a recorded
  trigger, a wood knock and a cloth sweep over a synthesized Karplus-Strong bowstring.
- **Dragon:** there is no recording of a dragon. Roars are bison rut calls lowered well below
  their natural range, with a sub octave and grizzly vocalisation for grain. Breath is the
  Black Growler steam vent under a wildfire. Wing beats are ruffed grouse drumming (real wing
  strokes) under slowed cloth sweeps. The death crash is lowered wood and plate impacts,
  a low explosion and thunder.
- **LMG, machine pistol, double barrel:** the library has no such guns. They are adapted from
  a .30-06 rifle, a PPSh and a pump shotgun; `weaponSource(id).adapted` says so at runtime.
- **Heartbeat:** the only sound that is always synthesized (`src/94-audio.js`).
- The other synthesized builders in `src/94-audio.js` run only if a clip is missing or fails
  to decode.

## Approved sounds kept unchanged

The owner kept the footsteps, the landing thud and the jetpack loop from the earlier pack.
Their bytes are copied unchanged into `sfx-bank.js`, and they keep their reduced levels. The
jetpack has no ignition sound.

## Preparation

Clips are downmixed to mono at 48 kHz, filtered, cut about 2 ms before the transient, faded and
levelled by category, then encoded with LAME at 44.1 kHz (distant shots 32 kHz) and about 90-150 kbit/s with no tag frames.
At decode the engine removes what precedes the first transient, including MP3 encoder delay.

## Clips

SHA-256 columns show the first 16 hex digits: the embedded MP3, then each source file.

| Key | Seconds | Bytes | Embedded SHA-256 | Sources |
| --- | ---: | ---: | --- | --- |
| `shot:pistol` | 0.4 | 7105 | `ea51e2bee7591bfd` | 1911/A_42.wav (CC0-1.0) `ee25a5bf6734b329` |
| `shot:pistol` | 0.4 | 7105 | `1f9462cb68116fd4` | 1911/A_42.wav (CC0-1.0) `ee25a5bf6734b329` |
| `shot:pistol` | 0.4 | 7105 | `f4d4b815416c71fa` | 1911/A_41.wav (CC0-1.0) `2a35d1c24f25f54d` |
| `shot:rifle` | 0.35 | 6269 | `ddc015e5ce5b1ce5` | AR-15/D_32.wav (CC0-1.0) `63e28f9b5144c557` |
| `shot:rifle` | 0.35 | 6269 | `bcfe4e5bdf870848` | AR-15/D_32.wav (CC0-1.0) `63e28f9b5144c557` |
| `shot:rifle` | 0.35 | 6269 | `bac5317c495509d0` | AR-15/D_31.wav (CC0-1.0) `448000e06cee112c` |
| `shot:rifle` | 0.35 | 6269 | `1bcf2096c2e75bea` | AR-15/D_31.wav (CC0-1.0) `448000e06cee112c` |
| `shot:shotgun` | 0.84 | 12434 | `dc479c2e51107fc3` | Nova/O_21.wav (CC0-1.0) `92088ad40a7f3d5b` |
| `shot:shotgun` | 0.84 | 12434 | `25753be1cf743f7e` | Nova/O_21.wav (CC0-1.0) `92088ad40a7f3d5b` |
| `shot:shotgun` | 0.84 | 12434 | `d0214db1e49b6a88` | Nova/O_19.wav (CC0-1.0) `1d86b0ffffbc7cb5` |
| `shot:smg` | 0.32 | 5851 | `d6c90453c5a6046b` | Carl Gustav M45_Swedish K/G_31.wav (CC0-1.0) `bf00453e3f3c9e70` |
| `shot:smg` | 0.32 | 5851 | `367f18e0d04d3e93` | Carl Gustav M45_Swedish K/G_31.wav (CC0-1.0) `bf00453e3f3c9e70` |
| `shot:smg` | 0.319 | 5851 | `0972f704085a3f58` | Carl Gustav M45_Swedish K/G_31.wav (CC0-1.0) `bf00453e3f3c9e70` |
| `shot:smg` | 0.321 | 5851 | `7608ee12302beca1` | Carl Gustav M45_Swedish K/G_25.wav (CC0-1.0) `85155c72ba34ad28` |
| `shot:sniper` | 1.21 | 17554 | `2e8d885361fc5714` | Mosin Nagant/M_19.wav (CC0-1.0) `f5cd0521f2fc7bc7` |
| `shot:sniper` | 1.21 | 17554 | `4f2cb1fe751ae003` | Mosin Nagant/M_19.wav (CC0-1.0) `f5cd0521f2fc7bc7` |
| `shot:sniper` | 1.21 | 17554 | `9347ac4048bd903d` | Mosin Nagant/M_21.wav (CC0-1.0) `4c793971e03ce2e1` |
| `shot:revolver` | 0.56 | 9613 | `6edcef711e9a1b24` | Smith & Wesson 642/V_27.wav (CC0-1.0) `f55045043056c597` |
| `shot:revolver` | 0.56 | 9613 | `f19f6cda50d37fe7` | Smith & Wesson 642/V_27.wav (CC0-1.0) `f55045043056c597` |
| `shot:revolver` | 0.56 | 9613 | `39c9d7030b4200a6` | Smith & Wesson 642/V_25.wav (CC0-1.0) `0133f668d5ffd0ee` |
| `shot:lmg` | 0.41 | 7105 | `aa38ca48f5830090` | 1917/B_24.wav (CC0-1.0) `7242478162833426` |
| `shot:lmg` | 0.41 | 7105 | `7a355ed5e2ab5116` | 1917/B_24.wav (CC0-1.0) `7242478162833426` |
| `shot:lmg` | 0.41 | 7105 | `1a326f206e60d315` | 1917/B_23.wav (CC0-1.0) `b5dd7005c24fb47b` |
| `shot:dmr` | 0.51 | 8777 | `735fb3498fadfed9` | SKS/U_12.wav (CC0-1.0) `68b6b884fccaf339` |
| `shot:dmr` | 0.51 | 8777 | `bc2086dc597c4b07` | SKS/U_14.wav (CC0-1.0) `529ea6776bd2c69c` |
| `shot:dmr` | 0.51 | 8777 | `80b472cc8ae34a77` | SKS/U_12.wav (CC0-1.0) `68b6b884fccaf339` |
| `shot:burst` | 0.344 | 6269 | `ded3843db024fac6` | AK-47/C_28.wav (CC0-1.0) `da2e211bf619e145` |
| `shot:burst` | 0.345 | 6269 | `d8d2440c9d961713` | AK-47/C_28.wav (CC0-1.0) `da2e211bf619e145` |
| `shot:burst` | 0.345 | 6269 | `55f661227bdbe2f4` | AK-47/C_27.wav (CC0-1.0) `b9f084a36905d03b` |
| `shot:machinepistol` | 0.216 | 4179 | `845c43851264d12f` | PPSh/P_30.wav (CC0-1.0) `c4d0d1e1ecd825a7` |
| `shot:machinepistol` | 0.215 | 4179 | `51f72245e2c2887b` | PPSh/P_24.wav (CC0-1.0) `75a88da3a0ba0043` |
| `shot:machinepistol` | 0.215 | 4179 | `2984132fd92fe309` | PPSh/P_30.wav (CC0-1.0) `c4d0d1e1ecd825a7` |
| `shot:machinepistol` | 0.216 | 4179 | `1f6714d72b700dee` | PPSh/P_24.wav (CC0-1.0) `75a88da3a0ba0043` |
| `shot:doublebarrel` | 0.98 | 14263 | `7a2d57a8431c9a8c` | Model 12/K_22.wav (CC0-1.0) `ef417da6a66c11e2` |
| `shot:doublebarrel` | 0.98 | 14263 | `2f57a0f8954673d7` | Model 12/K_20.wav (CC0-1.0) `8ada6e8e477ab5ce` |
| `shot:doublebarrel` | 0.98 | 14263 | `7f89f4e1e15ee929` | Model 12/K_22.wav (CC0-1.0) `ef417da6a66c11e2` |
| `shot:crossbow` | 0.39 | 6687 | `12926bc65b55a0d8` | AR-15/D_22.wav (CC0-1.0) `02e4b8d958e512a0`<br>impactWood_light_000.ogg (CC0-1.0) `eb45e35b4bed784d`<br>cloth_1.ogg (CC0-1.0) `ddb93a3671233f95` |
| `shot:crossbow` | 0.39 | 6687 | `7171d4691cfe6a71` | AR-15/D_22.wav (CC0-1.0) `02e4b8d958e512a0`<br>impactWood_light_001.ogg (CC0-1.0) `4b76bf3ccc8e60d1`<br>cloth_2.ogg (CC0-1.0) `8a7451193c38bc05` |
| `shot:crossbow` | 0.39 | 6687 | `2aa5cc1b4d9f39b8` | AR-15/D_22.wav (CC0-1.0) `02e4b8d958e512a0`<br>impactWood_light_002.ogg (CC0-1.0) `b183cf7a5bd78381`<br>cloth_3.ogg (CC0-1.0) `a48632d17a4f1416` |
| `shotFar:light` | 1.02 | 12960 | `5d9d9b7514cbd660` | 1911/A_39.wav (CC0-1.0) `151656e4d4ff8c40` |
| `shotFar:rifle` | 1.02 | 12960 | `feea96234cc22de3` | AK-47/C_17.wav (CC0-1.0) `325a353108dc987e` |
| `shotFar:heavy` | 1.02 | 12960 | `fd01cdca9edfe559` | Mosin Nagant/M_23.wav (CC0-1.0) `cd059ad7c0214d19` |
| `shotFar:shotgun` | 1.02 | 12960 | `c52c8624a681c029` | Model 12/K_16.wav (CC0-1.0) `2ea536d7cd8edd32` |
| `rl:pistol:out` | 0.32 | 5120 | `57db6191732910ae` | 1911/A_5.wav (CC0-1.0) `fedb6a77f9a8498e` |
| `rl:pistol:in` | 0.075 | 1463 | `b42e1497b2b5eb93` | 1911/A_4.wav (CC0-1.0) `ca37fc9d4d3287f0` |
| `rl:pistol:rack` | 0.285 | 4388 | `3daf78d66a617bbb` | 1911/A_24.wav (CC0-1.0) `71c917c01a7c6b92` |
| `rl:pistol:rack` | 0.085 | 1828 | `44bbe506781194ea` | 1911/A_17.wav (CC0-1.0) `f8efeaa34db613c1` |
| `rl:rifle:out` | 0.485 | 7314 | `4aed5ff03b538e35` | AR-15/D_5.wav (CC0-1.0) `62a5e9f9ab2a2459` |
| `rl:rifle:in` | 0.415 | 6217 | `97c7c1f3eb3e51a2` | AR-15/D_4.wav (CC0-1.0) `9e45a5131b9e40a3` |
| `rl:rifle:rack` | 0.24 | 4023 | `b39dccfbe08ce05c` | AR-15/D_14.wav (CC0-1.0) `ba74449533da8672` |
| `rl:rifle:rack` | 0.255 | 4023 | `56ad6595c6c49384` | AR-15/D_15.wav (CC0-1.0) `10b9aa2fb828c700` |
| `rl:shotgun:open` | 0.45 | 6948 | `de4da675c15418c8` | Nova/O_13.wav (CC0-1.0) `fcf941e422648c3e` |
| `rl:shotgun:shell` | 0.375 | 5851 | `bbaf29ecb16f9977` | Nova/O_7.wav (CC0-1.0) `0325a998b3662cb4` |
| `rl:shotgun:shell` | 0.375 | 5851 | `bbaf29ecb16f9977` | Nova/O_7.wav (CC0-1.0) `0325a998b3662cb4` |
| `rl:shotgun:rack` | 0.41 | 6217 | `70fcc86fd4904266` | Nova/O_6.wav (CC0-1.0) `99f8498b877fbf15` |
| `rl:smg:out` | 0.115 | 2194 | `c513a33fa2360d71` | Carl Gustav M45_Swedish K/G_9.wav (CC0-1.0) `eab6e91d75a17500` |
| `rl:smg:in` | 0.195 | 3291 | `2469cadaec8e3fc6` | Carl Gustav M45_Swedish K/G_8.wav (CC0-1.0) `12a1583d5c7e24bf` |
| `rl:smg:rack` | 0.285 | 4388 | `cc55898a50ebf313` | Carl Gustav M45_Swedish K/G_10.wav (CC0-1.0) `654fa0216dbb485b` |
| `rl:sniper:open` | 0.27 | 4388 | `7b67baf185967ffa` | Mosin Nagant/M_2.wav (CC0-1.0) `0d966c11d74084e1` |
| `rl:sniper:rack` | 0.22 | 3657 | `83a95ccafa1f77d0` | Mosin Nagant/M_4.wav (CC0-1.0) `cbfd642c9f45a0c5` |
| `rl:sniper:out` | 0.05 | 1097 | `1a2a171d534db46c` | Tikka/W_5.wav (CC0-1.0) `49e45e146d8610c0` |
| `rl:sniper:in` | 0.245 | 4023 | `3efa48767641e4ff` | Tikka/W_4.wav (CC0-1.0) `d729617d95f850ee` |
| `rl:sniper:close` | 0.21 | 3657 | `3225adf3662b3ef3` | Mosin Nagant/M_6.wav (CC0-1.0) `e07bf482c60ba4e6` |
| `rl:sniper:close` | 0.165 | 2925 | `6042f9ac0b24ced0` | Mosin Nagant/M_7.wav (CC0-1.0) `19b461b5ff7b6fe1` |
| `rl:revolver:open` | 0.29 | 4754 | `5d680f5ce095e58e` | Smith & Wesson 642/V_9.wav (CC0-1.0) `a7042943cdcee305` |
| `rl:revolver:out` | 0.41 | 6217 | `768ba5be40456b31` | Smith & Wesson 642/V_3.wav (CC0-1.0) `932abf13f3169b17` |
| `rl:revolver:in` | 0.135 | 2560 | `b2c16beb033965a2` | Smith & Wesson 642/V_18.wav (CC0-1.0) `f4a08774700592de` |
| `rl:revolver:close` | 0.125 | 2194 | `ef2a09386017778a` | Smith & Wesson 642/V_10.wav (CC0-1.0) `8322ac966250b2e0` |
| `rl:lmg:open` | 0.05 | 1097 | `b9cd10b693f4c1cc` | Model 12/K_12.wav (CC0-1.0) `8bb3f89a3c0847a5` |
| `rl:lmg:out` | 0.26 | 4023 | `cc3a77f4723c478e` | Mossberg/N_11.wav (CC0-1.0) `11483baf447a16b2` |
| `rl:lmg:in` | 0.09 | 1828 | `7a0babaad01b2a4d` | Mossberg/N_10.wav (CC0-1.0) `1ace8231d72defc0` |
| `rl:lmg:shell` | 0.34 | 5485 | `c4077ed15fc96501` | PPSh/P_10.wav (CC0-1.0) `6cddb771f3c0d9d3` |
| `rl:lmg:close` | 0.05 | 1097 | `aeddd4934e3bbc88` | Model 12/K_14.wav (CC0-1.0) `4a1774bf61a42e7b` |
| `rl:lmg:rack` | 0.34 | 5485 | `76b315bb1e198a6f` | AK-47/C_14.wav (CC0-1.0) `c749e112212b1fca` |
| `rl:dmr:rack` | 0.28 | 4388 | `9b98fec4cc916d97` | SKS/U_5.wav (CC0-1.0) `559699ef501024d1` |
| `rl:dmr:rack` | 0.06 | 1463 | `91f495b496844265` | SKS/U_2.wav (CC0-1.0) `61594936ccfeb9b0` |
| `rl:burst:out` | 0.205 | 3291 | `948d4da7d8ae6065` | AK-47/C_11.wav (CC0-1.0) `c40234bd04873c6d` |
| `rl:burst:in` | 0.135 | 2560 | `1712a00cac329aab` | AK-47/C_10.wav (CC0-1.0) `13657ef36e69f13b` |
| `rl:burst:rack` | 0.32 | 5120 | `fd3fbfec7050bbd5` | AK-47/C_14.wav (CC0-1.0) `c749e112212b1fca` |
| `rl:machinepistol:out` | 0.47 | 6948 | `f9ee0d694479d50a` | PPSh/P_7.wav (CC0-1.0) `4b242622a98e67df` |
| `rl:machinepistol:in` | 0.305 | 4754 | `729d0fd76ef1d02c` | PPSh/P_6.wav (CC0-1.0) `4c52b8362f8d7a1d` |
| `rl:machinepistol:rack` | 0.23 | 3657 | `b21d502dbe39ca17` | PPSh/P_8.wav (CC0-1.0) `a7847ce4bb40fd95` |
| `rl:doublebarrel:open` | 0.05 | 1097 | `b9cd10b693f4c1cc` | Model 12/K_12.wav (CC0-1.0) `8bb3f89a3c0847a5` |
| `rl:doublebarrel:out` | 0.11 | 2194 | `e3ecf4af882b2ea8` | Mossberg/N_12.wav (CC0-1.0) `a2dcffc6192c20f1` |
| `rl:doublebarrel:in` | 0.335 | 5120 | `c04d156c7934f628` | Model 12/K_13.wav (CC0-1.0) `aba1522a68bc5231` |
| `rl:doublebarrel:in` | 0.11 | 2194 | `e3ecf4af882b2ea8` | Mossberg/N_12.wav (CC0-1.0) `a2dcffc6192c20f1` |
| `rl:doublebarrel:close` | 0.19 | 3291 | `e4a889dcf7685485` | Model 12/K_5.wav (CC0-1.0) `8cf87a884a272a67` |
| `rl:crossbow:open` | 0.045 | 1097 | `28eb244f2d5642fe` | Smith & Wesson 642/V_6.wav (CC0-1.0) `e3e92fb480760194` |
| `rl:crossbow:open` | 0.04 | 1097 | `1df41329bbaef4ee` | Smith & Wesson 642/V_7.wav (CC0-1.0) `72190561985f64e8` |
| `rl:crossbow:in` | 0.085 | 1828 | `4ed2ee322c9407c2` | Walther PPQ/X_26.wav (CC0-1.0) `4dce361e634bb900` |
| `rl:crossbow:close` | 0.045 | 1097 | `e23bdd026ebe2c1d` | Smith & Wesson 642/V_8.wav (CC0-1.0) `63c89cc048cba381` |
| `pump` | 0.41 | 7105 | `784d1cccef17c182` | Nova/O_6.wav (CC0-1.0) `99f8498b877fbf15` |
| `pump` | 0.195 | 3761 | `0f6b1c9b7e1e5100` | Nova/O_5.wav (CC0-1.0) `51c1a930f80b4887` |
| `bolt` | 0.745 | 12538 | `a4e4f5882d345ae4` | Mosin Nagant/M_14.wav (CC0-1.0) `8c400580a1f65fe2` |
| `cylinder` | 0.045 | 1253 | `19466b7b74d2e26b` | Smith & Wesson 642/V_6.wav (CC0-1.0) `e3e92fb480760194` |
| `cylinder` | 0.04 | 1253 | `35a68ba7e017c263` | Smith & Wesson 642/V_7.wav (CC0-1.0) `72190561985f64e8` |
| `dryfire` | 0.05 | 1253 | `4484406bee5f0ad8` | Walther PPQ/X_18.wav (CC0-1.0) `5f517606bf41821b` |
| `dryfire` | 0.06 | 1671 | `e3596167da1e523b` | AR-15/D_16.wav (CC0-1.0) `30b2dbe251166e05` |
| `hit` | 0.24 | 5747 | `51b1292c1611e74d` | impactPunch_heavy_000.ogg (CC0-1.0) `b33a8f14068aec24`<br>impactSoft_heavy_001.ogg (CC0-1.0) `4d0096364ba9e461` |
| `hit` | 0.24 | 5747 | `48098c67c43eb10c` | impactPunch_heavy_002.ogg (CC0-1.0) `7993dd4c156b9979`<br>impactSoft_heavy_003.ogg (CC0-1.0) `d00286a2dc62ee5c` |
| `hitConfirm` | 0.075 | 2090 | `28bcd090889091b8` | impactMetal_light_001.ogg (CC0-1.0) `fba69c467ddd85da`<br>tick_002.ogg (CC0-1.0) `869442f54214be90` |
| `headshot` | 0.3 | 6792 | `6012dac47a09349a` | impactMetal_light_001.ogg (CC0-1.0) `fba69c467ddd85da`<br>tick_002.ogg (CC0-1.0) `869442f54214be90`<br>impactBell_heavy_001.ogg (CC0-1.0) `9df61e3ae9a83dc6`<br>glass_001.ogg (CC0-1.0) `183eebee20eb0a53` |
| `confirm` | 0.5 | 10971 | `f6b5405e223797ad` | impactMetal_light_001.ogg (CC0-1.0) `fba69c467ddd85da`<br>confirmation_002.ogg (CC0-1.0) `33b17a9a9a2397c6`<br>impactBell_heavy_000.ogg (CC0-1.0) `94b8bb5f2d43ab65` |
| `swap` | 0.16 | 4180 | `3d6b188f37f5b854` | AR-15/D_20.wav (CC0-1.0) `6f569716de8e616f`<br>cloth_2.ogg (CC0-1.0) `8a7451193c38bc05` |
| `swap` | 0.16 | 4180 | `5e278c541229a133` | 1911/A_31.wav (CC0-1.0) `9adff6e38d98053b`<br>cloth_3.ogg (CC0-1.0) `a48632d17a4f1416` |
| `combatMode` | 0.1 | 2612 | `934dae293d916325` | switch_004.ogg (CC0-1.0) `541c19cc1ab712a9`<br>AR-15/D_19.wav (CC0-1.0) `7b5d15953abab1ce` |
| `ui` | 0.08 | 2612 | `8b1accbc4c4d75ae` | click_002.ogg (CC0-1.0) `adcd1f4adc35f1b4` |
| `ui` | 0.11 | 3135 | `1d61e81b2ebede3c` | select_002.ogg (CC0-1.0) `4cc6ac5341b9b2c8` |
| `impact:stone` | 0.2 | 3024 | `c7e6d8d161ec61d4` | impactMining_000.ogg (CC0-1.0) `36b4ea107222d073`<br>impactMining_001.ogg (CC0-1.0) `61235a18de3f3d92` |
| `impact:stone` | 0.2 | 3024 | `f05d1240d730d0c1` | impactMining_002.ogg (CC0-1.0) `059558ec751115ca`<br>impactMining_003.ogg (CC0-1.0) `4237fa2cd80364ad` |
| `impact:stone` | 0.2 | 3024 | `6e7cc49f1989b5b5` | impactMining_004.ogg (CC0-1.0) `8ca3a99d85d84575`<br>impactPlate_light_000.ogg (CC0-1.0) `6e797cf8a5bfc52d` |
| `impact:wood` | 0.2 | 3024 | `09403e2597e4a14c` | impactWood_medium_000.ogg (CC0-1.0) `1723a9fd25103ed4`<br>impactPlank_medium_000.ogg (CC0-1.0) `8403cd7a043f0391` |
| `impact:wood` | 0.2 | 3024 | `8f0779d1c3330ed4` | impactWood_medium_001.ogg (CC0-1.0) `15271dbe8e2872db`<br>impactPlank_medium_001.ogg (CC0-1.0) `d7c304319f8beac6` |
| `impact:wood` | 0.2 | 3024 | `df94f4c9b5e3eb9a` | impactWood_medium_002.ogg (CC0-1.0) `3f3f1917428b828f`<br>impactPlank_medium_002.ogg (CC0-1.0) `f6a14da459942296` |
| `impact:metal` | 0.2 | 3024 | `eca8b8e000b1e2ad` | impactMetal_medium_000.ogg (CC0-1.0) `a96f879fec0864a8`<br>impactTin_medium_000.ogg (CC0-1.0) `f4bbee66ca191ec7` |
| `impact:metal` | 0.2 | 3024 | `52ee229fe778d51d` | impactMetal_medium_001.ogg (CC0-1.0) `e8a9eaba7c4d2742`<br>impactTin_medium_001.ogg (CC0-1.0) `84253095543c094d` |
| `impact:metal` | 0.2 | 3024 | `d67f167e75e0ac45` | impactMetal_medium_002.ogg (CC0-1.0) `7e89ce2ca0dbda95`<br>impactTin_medium_002.ogg (CC0-1.0) `c1d2c4f9910d4529` |
| `impact:glass` | 0.2 | 3024 | `a8cb3a996bddafb1` | impactGlass_light_000.ogg (CC0-1.0) `d750cf88097d0c3e`<br>impactGlass_medium_000.ogg (CC0-1.0) `9252d50bfb85edb1` |
| `impact:glass` | 0.2 | 3024 | `7872fcbf098b1ead` | impactGlass_light_001.ogg (CC0-1.0) `05e513fbd4282906`<br>impactGlass_medium_001.ogg (CC0-1.0) `d3d806cb3012c9dd` |
| `impact:glass` | 0.2 | 3024 | `5e305940bee611eb` | impactGlass_light_002.ogg (CC0-1.0) `710db7451bb7857b`<br>impactGlass_medium_002.ogg (CC0-1.0) `48616f22c95589ed` |
| `impact:soft` | 0.2 | 3024 | `54f72d6eb578a8b2` | impactSoft_medium_000.ogg (CC0-1.0) `7d3ba0bb5e60a11b`<br>footstep_grass_000.ogg (CC0-1.0) `9d49497777405d78` |
| `impact:soft` | 0.2 | 3024 | `7bee6c80fb47efb0` | impactSoft_medium_001.ogg (CC0-1.0) `7642a4fd43e547af`<br>footstep_grass_001.ogg (CC0-1.0) `fb28781bd22b2eef` |
| `impact:soft` | 0.2 | 3024 | `b03431f42c20043f` | impactSoft_medium_002.ogg (CC0-1.0) `5069e3571a77d7f7`<br>footstep_grass_002.ogg (CC0-1.0) `73a520139f5be716` |
| `impact:grass` | 0.2 | 3024 | `7a76191fb93da897` | impactSoft_medium_003.ogg (CC0-1.0) `5c4a1f35fde7e140`<br>footstep_grass_003.ogg (CC0-1.0) `0546e1d8ab2def71` |
| `impact:grass` | 0.2 | 3024 | `9ae8ced9a4db457b` | impactSoft_medium_004.ogg (CC0-1.0) `b0a4dea90eed47ac`<br>footstep_grass_001.ogg (CC0-1.0) `fb28781bd22b2eef` |
| `impact:snow` | 0.2 | 3024 | `1c43fcf8a02913c0` | impactSoft_medium_000.ogg (CC0-1.0) `7d3ba0bb5e60a11b`<br>footstep_snow_000.ogg (CC0-1.0) `c05fa4a9dc9a7aab` |
| `impact:snow` | 0.2 | 3024 | `5a6d0a5d0c6e01ec` | impactSoft_medium_002.ogg (CC0-1.0) `5069e3571a77d7f7`<br>footstep_snow_002.ogg (CC0-1.0) `db52bafdc66304f3` |
| `break:stone` | 0.48 | 7560 | `c77752e818ae3b39` | impactMining_001.ogg (CC0-1.0) `61235a18de3f3d92`<br>impactMining_003.ogg (CC0-1.0) `4237fa2cd80364ad`<br>impactPlate_heavy_001.ogg (CC0-1.0) `142fd6c77f13d25f` |
| `break:wood` | 0.48 | 7560 | `81993166ef20099e` | impactPlank_medium_003.ogg (CC0-1.0) `0602a7b3eab5f534`<br>impactWood_heavy_001.ogg (CC0-1.0) `f1b07a53ac10c615` |
| `break:snow` | 0.48 | 7560 | `f10d50d2c7cfbc16` | footstep_snow_001.ogg (CC0-1.0) `980fb9a1c9227aed`<br>impactSoft_heavy_002.ogg (CC0-1.0) `d130ae541951243d` |
| `break:grass` | 0.48 | 7560 | `84c57d1309a32997` | impactSoft_heavy_004.ogg (CC0-1.0) `e008f0b6b14f6233`<br>footstep_grass_004.ogg (CC0-1.0) `086fd4ab3546a507` |
| `break:glass` | 0.48 | 7560 | `09c3a2efbdd820dc` | impactGlass_heavy_000.ogg (CC0-1.0) `b44b39a940e8948e`<br>impactGlass_heavy_002.ogg (CC0-1.0) `4978654ac840ad51` |
| `death` | 0.56 | 8568 | `6a51f9d73e867458` | impactPunch_medium_001.ogg (CC0-1.0) `e71d23abcc3f10d9`<br>drop_leather.ogg (CC0-1.0) `097e1d3b74949b01`<br>impactSoft_heavy_001.ogg (CC0-1.0) `4d0096364ba9e461`<br>AR-15/D_3.wav (CC0-1.0) `c2fbf179ce53996c`<br>impactPlate_light_001.ogg (CC0-1.0) `947915c2eb6ac57e` |
| `death` | 0.56 | 8568 | `9b5ccb730a94cf61` | impactPunch_medium_003.ogg (CC0-1.0) `2d7c719c05999e05`<br>drop_leather.ogg (CC0-1.0) `097e1d3b74949b01`<br>impactSoft_heavy_001.ogg (CC0-1.0) `4d0096364ba9e461`<br>AK-47/C_11.wav (CC0-1.0) `c40234bd04873c6d`<br>impactPlate_light_003.ogg (CC0-1.0) `dbfb7c1d00257669` |
| `respawn` | 0.72 | 15151 | `267b0bc66a096ec3` | maximize_006.ogg (CC0-1.0) `f050b3bb77cb0b90`<br>maximize_008.ogg (CC0-1.0) `57c074e600e193a3`<br>forceField_001.ogg (CC0-1.0) `5574e69dd04e5f59` |
| `shield` | 0.95 | 12096 | `0bc7d023caea4f91` | forceField_000.ogg (CC0-1.0) `c2916f2a062c8ddd` |
| `shieldBlock` | 0.24 | 5747 | `a03fcd38d23a6d7d` | impactMetal_000.ogg (CC0-1.0) `956c6612a256aa1a`<br>glass_002.ogg (CC0-1.0) `08e972c73e53c91d` |
| `shieldBlock` | 0.24 | 5747 | `a1c75501e8113a48` | impactMetal_002.ogg (CC0-1.0) `0c1bb4db8a4d48b2`<br>glass_004.ogg (CC0-1.0) `2379b58f953e3d86` |
| `killcam` | 1.5 | 18576 | `8429b1c99ed8a681` | lowFrequency_explosion_000.ogg (CC0-1.0) `3cb48d86dab63140` |
| `splash` | 0.52 | 8064 | `facb4cb30a06af95` | Bathtub_water_splashes.ogg (Public domain) `471b9c2cc35a183d` |
| `splash` | 0.52 | 8064 | `f723735fe709dd02` | Bathtub_water_splashes.ogg (Public domain) `471b9c2cc35a183d` |
| `splash` | 0.5 | 7560 | `67c8417171fda197` | Bathtub_water_splashes.ogg (Public domain) `471b9c2cc35a183d` |
| `dragonRoar` | 1.95 | 24192 | `c11165580aa02e8a` | yell-YELLMM8K2005914Bison.mp3 (Public domain (U.S. NPS)) `a6bf74b683b9ec5f`<br>yell-YELLGrizzlyBearVocalizations20160520Android1.mp3 (Public domain (U.S. NPS)) `1ec17f7a35de22b2` |
| `dragonRoar` | 1.9 | 23328 | `fbe4ab74b94b1d79` | yell-YELLMM8K2005918Bison.mp3 (Public domain (U.S. NPS)) `238a3857b5088e05`<br>yell-YELLGrizzlyBearVocalizations20160520Android1.mp3 (Public domain (U.S. NPS)) `1ec17f7a35de22b2` |
| `dragonBreath` | 1.6 | 19872 | `82f072a5a013bdb2` | yell-NorrisBlackGrowler.mp3 (Public domain (U.S. NPS)) `91e3615e92c088e3`<br>yell-YELLMapleFire20160814T04ms3.mp3 (Public domain (U.S. NPS)) `15d698e6620f17e0` |
| `dragonBreath` | 1.6 | 19872 | `16f2503dc94f85cd` | yell-NorrisBlackGrowler.mp3 (Public domain (U.S. NPS)) `91e3615e92c088e3`<br>yell-YELLMapleFire20160814T04ms3.mp3 (Public domain (U.S. NPS)) `15d698e6620f17e0` |
| `dragonHit` | 0.2 | 3528 | `14ec1c9573c41d8f` | impactPlate_heavy_000.ogg (CC0-1.0) `112d4f93ddcc370b`<br>impactPunch_medium_000.ogg (CC0-1.0) `486988aa2d6440ff` |
| `dragonHit` | 0.2 | 3528 | `73d13c13e0c2c1a7` | impactPlate_heavy_002.ogg (CC0-1.0) `b0cab75d1befa32b`<br>impactPunch_medium_001.ogg (CC0-1.0) `e71d23abcc3f10d9` |
| `dragonHit` | 0.2 | 3528 | `078ecf01590ab1eb` | impactPlate_medium_001.ogg (CC0-1.0) `68ba7701b71ef620`<br>impactPunch_medium_002.ogg (CC0-1.0) `6492f9ccbc8d24dc` |
| `dragonDeath` | 5.2 | 63072 | `40b9816aab47921e` | yell-YELLMM8K2005918Bison.mp3 (Public domain (U.S. NPS)) `238a3857b5088e05`<br>yell-YELLMM8K2005914Bison.mp3 (Public domain (U.S. NPS)) `a6bf74b683b9ec5f`<br>yell-YELLGrizzlyBearVocalizations20160520Android1.mp3 (Public domain (U.S. NPS)) `1ec17f7a35de22b2`<br>yell-Thunderandbirds140704.mp3 (Public domain (U.S. NPS)) `e5d88deaa66591b4`<br>impactWood_heavy_000.ogg (CC0-1.0) `15ff82332f342c30`<br>impactPlate_heavy_003.ogg (CC0-1.0) `59775f8979a396c8`<br>lowFrequency_explosion_001.ogg (CC0-1.0) `cdda50600a4928f2` |
| `dragonSpawn` | 2.4 | 29376 | `cfe901bf261b3c99` | yell-YELLMM8K2005914Bison.mp3 (Public domain (U.S. NPS)) `a6bf74b683b9ec5f`<br>yell-YELLGrizzlyBearVocalizations20160520Android1.mp3 (Public domain (U.S. NPS)) `1ec17f7a35de22b2` |
| `wingFlap` | 0.62 | 8208 | `2795a9237b258401` | yell-RuffedGrouse.mp3 (Public domain (U.S. NPS)) `9f1ba763397e002d`<br>cloth_1.ogg (CC0-1.0) `ddb93a3671233f95` |
| `wingFlap` | 0.62 | 8208 | `e9e491a5e30be738` | yell-RuffedGrouse.mp3 (Public domain (U.S. NPS)) `9f1ba763397e002d`<br>cloth_3.ogg (CC0-1.0) `a48632d17a4f1416` |
| `wingFlap` | 0.62 | 8208 | `74d67a7f1d9202e3` | yell-RuffedGrouse.mp3 (Public domain (U.S. NPS)) `9f1ba763397e002d`<br>cloth_4.ogg (CC0-1.0) `e7ab9a6c4466dea8` |
| `knifeEquip` | 0.38 | 8359 | `ec9db210da8f002c` | draw_knife_1.ogg (CC0-1.0) `276403e72c3b71c4` |
| `knifeSlash` | 0.22 | 5225 | `d735e0581f7e6434` | cloth_1.ogg (CC0-1.0) `ddb93a3671233f95`<br>draw_knife_2.ogg (CC0-1.0) `d5df6a4130cbb016` |
| `knifeSlash` | 0.22 | 5225 | `9bdd0a4932860f59` | cloth_2.ogg (CC0-1.0) `8a7451193c38bc05`<br>draw_knife_3.ogg (CC0-1.0) `a11ae62fb1a62842` |
| `knifeSlash` | 0.22 | 5225 | `f0c7cdc7d13ff95b` | cloth_4.ogg (CC0-1.0) `e7ab9a6c4466dea8`<br>draw_knife_2.ogg (CC0-1.0) `d5df6a4130cbb016` |
| `knifeStab` | 0.32 | 7314 | `fec3a4d252fa022d` | draw_knife_1.ogg (CC0-1.0) `276403e72c3b71c4`<br>cloth_3.ogg (CC0-1.0) `a48632d17a4f1416`<br>chop.ogg (CC0-1.0) `d00c2b3c9fff07e3` |
| `knifeStab` | 0.32 | 7314 | `2ae1156fd59361ab` | draw_knife_3.ogg (CC0-1.0) `a11ae62fb1a62842`<br>cloth_3.ogg (CC0-1.0) `a48632d17a4f1416`<br>chop.ogg (CC0-1.0) `d00c2b3c9fff07e3` |
| `knifeHit` | 0.24 | 5747 | `c5183755e26ce3ec` | chop.ogg (CC0-1.0) `d00c2b3c9fff07e3`<br>impactPunch_medium_003.ogg (CC0-1.0) `2d7c719c05999e05` |
| `knifeHit` | 0.24 | 5747 | `ac570897dfd5d54f` | knife_slice.ogg (CC0-1.0) `4cd96dc630bed984`<br>impactPunch_medium_003.ogg (CC0-1.0) `2d7c719c05999e05` |
| `land` | 0.35 | 2024 | `b78ba1c481b9c344` | Earlier approved pack, Kenney CC0 (see the note below) |
| `land` | 0.35 | 2024 | `c41edb9f2e7b5e2c` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:grass` | 0.4 | 1916 | `2f214a9827356c07` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:grass` | 0.4 | 1916 | `5510515e2ac1e2bf` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:grass` | 0.4 | 1916 | `b900ac99c9314d85` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:grass` | 0.4 | 1916 | `6fa045214f751a7d` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:stone` | 0.103 | 620 | `3e90780d88b65503` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:stone` | 0.105 | 620 | `922cc5f0cec4ab6d` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:stone` | 0.11 | 764 | `9e23644c0bf63030` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:stone` | 0.108 | 620 | `61d14cb729902a1e` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:wood` | 0.271 | 1340 | `f1f7957134c32933` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:wood` | 0.249 | 1196 | `2726dc7870b1ed29` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:wood` | 0.248 | 1196 | `3eab5ea1d341797a` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:wood` | 0.249 | 1196 | `0292b730a191906e` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:snow` | 0.371 | 1772 | `cfe158145dde4be3` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:snow` | 0.371 | 1772 | `1c03fa189d1840d0` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:snow` | 0.371 | 1772 | `d1a3fbfaf2b05516` | Earlier approved pack, Kenney CC0 (see the note below) |
| `step:snow` | 0.371 | 1772 | `3264d5ea6c4fddbf` | Earlier approved pack, Kenney CC0 (see the note below) |
| `jetpackLoop` | 5.0 | 25244 | `d305f312b01d3773` | Earlier approved pack, Kenney CC0 (see the note below) |

The approved footsteps, landing and jetpack clips came from Kenney Impact Sounds
(`footstep_*`, `impactSoft_heavy_*`) and Sci-fi Sounds (`thrusterFire_000`), CC0 1.0.
