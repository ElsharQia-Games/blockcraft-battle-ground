# Game audio: licences and provenance

Every sound the game ships is listed here. This file is generated from the build
manifest, so it records what is actually embedded.

**Licence rule:** CC0 1.0 or public domain only, verified on the source page or in a
bundled licence file. Local copy of CC0: `assets/audio/CC0-1.0.txt`. Credit is voluntary.

| Container | Contents | Size on disk |
| --- | --- | --- |
| `weapon-samples.js` | gunshot takes, base64 MP3 | 196 KB |
| `sfx-bank.js` | everything else, base64 MP3 | 498 KB |

Embedded MP3 total: **527468 bytes** in 181 clips. No raw audio or runtime download is needed,
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
levelled by category, then encoded with LAME at 24-32 kHz and 40-64 kbit/s with no tag frames.
At decode the engine removes what precedes the first transient, including MP3 encoder delay.

## Clips

SHA-256 columns show the first 16 hex digits: the embedded MP3, then each source file.

| Key | Seconds | Bytes | Embedded SHA-256 | Sources |
| --- | ---: | ---: | --- | --- |
| `shot:pistol` | 0.4 | 3276 | `a3df06f17416c71d` | 1911/A_42.wav (CC0-1.0) `ee25a5bf6734b329` |
| `shot:pistol` | 0.4 | 3276 | `473aa604d8b7cb73` | 1911/A_42.wav (CC0-1.0) `ee25a5bf6734b329` |
| `shot:pistol` | 0.4 | 3276 | `3a1ed830cbe23604` | 1911/A_41.wav (CC0-1.0) `2a35d1c24f25f54d` |
| `shot:rifle` | 0.35 | 2772 | `4a9dc0f2b7a4746a` | AR-15/D_32.wav (CC0-1.0) `63e28f9b5144c557` |
| `shot:rifle` | 0.35 | 2772 | `531d3fc3b5f8625b` | AR-15/D_32.wav (CC0-1.0) `63e28f9b5144c557` |
| `shot:rifle` | 0.35 | 2772 | `d1f8ebae92adb03e` | AR-15/D_31.wav (CC0-1.0) `448000e06cee112c` |
| `shot:rifle` | 0.35 | 2772 | `4701e9ec8e7de66b` | AR-15/D_31.wav (CC0-1.0) `448000e06cee112c` |
| `shot:shotgun` | 0.84 | 5400 | `62cca2be2d9ca899` | Nova/O_21.wav (CC0-1.0) `92088ad40a7f3d5b` |
| `shot:shotgun` | 0.84 | 5400 | `7fcd117d0e0aee98` | Nova/O_21.wav (CC0-1.0) `92088ad40a7f3d5b` |
| `shot:shotgun` | 0.84 | 5400 | `93861676b1f5e4a8` | Nova/O_19.wav (CC0-1.0) `1d86b0ffffbc7cb5` |
| `shot:smg` | 0.32 | 2520 | `ce332320758186ee` | Carl Gustav M45_Swedish K/G_31.wav (CC0-1.0) `bf00453e3f3c9e70` |
| `shot:smg` | 0.32 | 2520 | `7547b176b6276238` | Carl Gustav M45_Swedish K/G_31.wav (CC0-1.0) `bf00453e3f3c9e70` |
| `shot:smg` | 0.319 | 2520 | `4b5d06630c20c557` | Carl Gustav M45_Swedish K/G_31.wav (CC0-1.0) `bf00453e3f3c9e70` |
| `shot:smg` | 0.321 | 2520 | `d9b177a4280b9097` | Carl Gustav M45_Swedish K/G_25.wav (CC0-1.0) `85155c72ba34ad28` |
| `shot:sniper` | 1.21 | 7560 | `5b9cdc20f5e8caa1` | Mosin Nagant/M_19.wav (CC0-1.0) `f5cd0521f2fc7bc7` |
| `shot:sniper` | 1.21 | 7560 | `e978bd254316dfc1` | Mosin Nagant/M_19.wav (CC0-1.0) `f5cd0521f2fc7bc7` |
| `shot:sniper` | 1.21 | 7560 | `8e4d549ae9917c86` | Mosin Nagant/M_21.wav (CC0-1.0) `4c793971e03ce2e1` |
| `shot:revolver` | 0.56 | 4284 | `da7defa012abd687` | Smith & Wesson 642/V_27.wav (CC0-1.0) `f55045043056c597` |
| `shot:revolver` | 0.56 | 4284 | `88a346a4cf59fa12` | Smith & Wesson 642/V_27.wav (CC0-1.0) `f55045043056c597` |
| `shot:revolver` | 0.56 | 4284 | `1ac021cd3ad606ad` | Smith & Wesson 642/V_25.wav (CC0-1.0) `0133f668d5ffd0ee` |
| `shot:lmg` | 0.41 | 3276 | `bca0ffa5d40d96de` | 1917/B_24.wav (CC0-1.0) `7242478162833426` |
| `shot:lmg` | 0.41 | 3276 | `9d487688d4311654` | 1917/B_24.wav (CC0-1.0) `7242478162833426` |
| `shot:lmg` | 0.41 | 3276 | `3019f444411fad1c` | 1917/B_23.wav (CC0-1.0) `b5dd7005c24fb47b` |
| `shot:dmr` | 0.51 | 4032 | `57ac638e028e1ee1` | SKS/U_12.wav (CC0-1.0) `68b6b884fccaf339` |
| `shot:dmr` | 0.51 | 4032 | `8424cccc31e8f071` | SKS/U_14.wav (CC0-1.0) `529ea6776bd2c69c` |
| `shot:dmr` | 0.51 | 4032 | `c41252f09b537d67` | SKS/U_12.wav (CC0-1.0) `68b6b884fccaf339` |
| `shot:burst` | 0.344 | 2772 | `d581c703398b5f82` | AK-47/C_28.wav (CC0-1.0) `da2e211bf619e145` |
| `shot:burst` | 0.345 | 2772 | `4ddfc10a66f060b3` | AK-47/C_28.wav (CC0-1.0) `da2e211bf619e145` |
| `shot:burst` | 0.345 | 2772 | `b0434481aa9523a7` | AK-47/C_27.wav (CC0-1.0) `b9f084a36905d03b` |
| `shot:machinepistol` | 0.216 | 1764 | `e5f1f60e2a84a429` | PPSh/P_30.wav (CC0-1.0) `c4d0d1e1ecd825a7` |
| `shot:machinepistol` | 0.215 | 1764 | `055ffa3eb6765da6` | PPSh/P_24.wav (CC0-1.0) `75a88da3a0ba0043` |
| `shot:machinepistol` | 0.215 | 1764 | `333032f6a38f4704` | PPSh/P_30.wav (CC0-1.0) `c4d0d1e1ecd825a7` |
| `shot:machinepistol` | 0.216 | 1764 | `b8edb218bfa4ef95` | PPSh/P_24.wav (CC0-1.0) `75a88da3a0ba0043` |
| `shot:doublebarrel` | 0.98 | 6264 | `3bdc84bf786ce0d6` | Model 12/K_22.wav (CC0-1.0) `ef417da6a66c11e2` |
| `shot:doublebarrel` | 0.98 | 6264 | `d5bcb38ab8fedcfd` | Model 12/K_20.wav (CC0-1.0) `8ada6e8e477ab5ce` |
| `shot:doublebarrel` | 0.98 | 6264 | `35a0f64c8898e142` | Model 12/K_22.wav (CC0-1.0) `ef417da6a66c11e2` |
| `shot:crossbow` | 0.39 | 3024 | `a9ae92574d56ae3c` | AR-15/D_22.wav (CC0-1.0) `02e4b8d958e512a0`<br>impactWood_light_000.ogg (CC0-1.0) `eb45e35b4bed784d`<br>cloth_1.ogg (CC0-1.0) `ddb93a3671233f95` |
| `shot:crossbow` | 0.39 | 3024 | `294938284b597306` | AR-15/D_22.wav (CC0-1.0) `02e4b8d958e512a0`<br>impactWood_light_001.ogg (CC0-1.0) `4b76bf3ccc8e60d1`<br>cloth_2.ogg (CC0-1.0) `8a7451193c38bc05` |
| `shot:crossbow` | 0.39 | 3024 | `d8cc38afc7c0f8f8` | AR-15/D_22.wav (CC0-1.0) `02e4b8d958e512a0`<br>impactWood_light_002.ogg (CC0-1.0) `b183cf7a5bd78381`<br>cloth_3.ogg (CC0-1.0) `a48632d17a4f1416` |
| `shotFar:light` | 1.02 | 5400 | `119bb9c94832a6e0` | 1911/A_39.wav (CC0-1.0) `151656e4d4ff8c40` |
| `shotFar:rifle` | 1.02 | 5400 | `a8a14124f1a3573f` | AK-47/C_17.wav (CC0-1.0) `325a353108dc987e` |
| `shotFar:heavy` | 1.02 | 5400 | `cb00ef3b4f8f09f9` | Mosin Nagant/M_23.wav (CC0-1.0) `cd059ad7c0214d19` |
| `shotFar:shotgun` | 1.02 | 5400 | `176eb5739db6a780` | Model 12/K_16.wav (CC0-1.0) `2ea536d7cd8edd32` |
| `rl:pistol:out` | 0.32 | 2160 | `809c1b40d186b126` | 1911/A_5.wav (CC0-1.0) `fedb6a77f9a8498e` |
| `rl:pistol:in` | 0.075 | 864 | `d1a015dfeff0f089` | 1911/A_4.wav (CC0-1.0) `ca37fc9d4d3287f0` |
| `rl:pistol:rack` | 0.285 | 1944 | `2c8693259023ef0e` | 1911/A_24.wav (CC0-1.0) `71c917c01a7c6b92` |
| `rl:pistol:rack` | 0.085 | 864 | `f40434c4cee03306` | 1911/A_17.wav (CC0-1.0) `f8efeaa34db613c1` |
| `rl:rifle:out` | 0.485 | 3240 | `006a8ee69829b927` | AR-15/D_5.wav (CC0-1.0) `62a5e9f9ab2a2459` |
| `rl:rifle:in` | 0.415 | 2808 | `516f05c56662c609` | AR-15/D_4.wav (CC0-1.0) `9e45a5131b9e40a3` |
| `rl:rifle:rack` | 0.24 | 1728 | `6cada2bf119523e4` | AR-15/D_14.wav (CC0-1.0) `ba74449533da8672` |
| `rl:rifle:rack` | 0.255 | 1944 | `52c3eef97126ba74` | AR-15/D_15.wav (CC0-1.0) `10b9aa2fb828c700` |
| `rl:shotgun:open` | 0.45 | 3024 | `ce24bdaaba7f02c6` | Nova/O_13.wav (CC0-1.0) `fcf941e422648c3e` |
| `rl:shotgun:shell` | 0.375 | 2592 | `dfa1ff6d02b8d127` | Nova/O_7.wav (CC0-1.0) `0325a998b3662cb4` |
| `rl:shotgun:shell` | 0.375 | 2592 | `dfa1ff6d02b8d127` | Nova/O_7.wav (CC0-1.0) `0325a998b3662cb4` |
| `rl:shotgun:rack` | 0.41 | 2808 | `1bc2b4cd406fa113` | Nova/O_6.wav (CC0-1.0) `99f8498b877fbf15` |
| `rl:smg:out` | 0.115 | 1080 | `395668bb8e405da5` | Carl Gustav M45_Swedish K/G_9.wav (CC0-1.0) `eab6e91d75a17500` |
| `rl:smg:in` | 0.195 | 1512 | `931721f27052dfdb` | Carl Gustav M45_Swedish K/G_8.wav (CC0-1.0) `12a1583d5c7e24bf` |
| `rl:smg:rack` | 0.285 | 1944 | `18dfaab9abb2ff87` | Carl Gustav M45_Swedish K/G_10.wav (CC0-1.0) `654fa0216dbb485b` |
| `rl:sniper:open` | 0.27 | 1944 | `2b8f0cd3bbaaead7` | Mosin Nagant/M_2.wav (CC0-1.0) `0d966c11d74084e1` |
| `rl:sniper:rack` | 0.22 | 1728 | `3f381b9ad632a0d3` | Mosin Nagant/M_4.wav (CC0-1.0) `cbfd642c9f45a0c5` |
| `rl:sniper:out` | 0.05 | 648 | `9a71a782c40ad36d` | Tikka/W_5.wav (CC0-1.0) `49e45e146d8610c0` |
| `rl:sniper:in` | 0.245 | 1728 | `e98abb4b5cc70ee8` | Tikka/W_4.wav (CC0-1.0) `d729617d95f850ee` |
| `rl:sniper:close` | 0.21 | 1512 | `4f8d3ec637551d45` | Mosin Nagant/M_6.wav (CC0-1.0) `e07bf482c60ba4e6` |
| `rl:sniper:close` | 0.165 | 1296 | `49366d3a08eb5568` | Mosin Nagant/M_7.wav (CC0-1.0) `19b461b5ff7b6fe1` |
| `rl:revolver:open` | 0.29 | 2160 | `0548b584d22ca3e2` | Smith & Wesson 642/V_9.wav (CC0-1.0) `a7042943cdcee305` |
| `rl:revolver:out` | 0.41 | 2808 | `fea26a4430067b4e` | Smith & Wesson 642/V_3.wav (CC0-1.0) `932abf13f3169b17` |
| `rl:revolver:in` | 0.135 | 1080 | `51fcb45119df2320` | Smith & Wesson 642/V_18.wav (CC0-1.0) `f4a08774700592de` |
| `rl:revolver:close` | 0.125 | 1080 | `2e62b059ea64968b` | Smith & Wesson 642/V_10.wav (CC0-1.0) `8322ac966250b2e0` |
| `rl:lmg:open` | 0.05 | 648 | `00f353266e1eefdc` | Model 12/K_12.wav (CC0-1.0) `8bb3f89a3c0847a5` |
| `rl:lmg:out` | 0.26 | 1944 | `9ea063fcda58177b` | Mossberg/N_11.wav (CC0-1.0) `11483baf447a16b2` |
| `rl:lmg:in` | 0.09 | 864 | `e9d0af26b7dfa580` | Mossberg/N_10.wav (CC0-1.0) `1ace8231d72defc0` |
| `rl:lmg:shell` | 0.34 | 2376 | `e7ef195c3185a21d` | PPSh/P_10.wav (CC0-1.0) `6cddb771f3c0d9d3` |
| `rl:lmg:close` | 0.05 | 648 | `f8755d21c006dd99` | Model 12/K_14.wav (CC0-1.0) `4a1774bf61a42e7b` |
| `rl:lmg:rack` | 0.34 | 2376 | `19b6f7f5a9ec0e7e` | AK-47/C_14.wav (CC0-1.0) `c749e112212b1fca` |
| `rl:dmr:rack` | 0.28 | 1944 | `6af1f536f0d6a1ec` | SKS/U_5.wav (CC0-1.0) `559699ef501024d1` |
| `rl:dmr:rack` | 0.06 | 648 | `79d15eac78b3dedc` | SKS/U_2.wav (CC0-1.0) `61594936ccfeb9b0` |
| `rl:burst:out` | 0.205 | 1512 | `0dcbdd36e00b49f2` | AK-47/C_11.wav (CC0-1.0) `c40234bd04873c6d` |
| `rl:burst:in` | 0.135 | 1080 | `bc91250145fff3ec` | AK-47/C_10.wav (CC0-1.0) `13657ef36e69f13b` |
| `rl:burst:rack` | 0.32 | 2160 | `f501953b1579788f` | AK-47/C_14.wav (CC0-1.0) `c749e112212b1fca` |
| `rl:machinepistol:out` | 0.47 | 3240 | `592bb289c8a68db9` | PPSh/P_7.wav (CC0-1.0) `4b242622a98e67df` |
| `rl:machinepistol:in` | 0.305 | 2160 | `171ffd2da582a366` | PPSh/P_6.wav (CC0-1.0) `4c52b8362f8d7a1d` |
| `rl:machinepistol:rack` | 0.23 | 1728 | `452899ed1e83407f` | PPSh/P_8.wav (CC0-1.0) `a7847ce4bb40fd95` |
| `rl:doublebarrel:open` | 0.05 | 648 | `00f353266e1eefdc` | Model 12/K_12.wav (CC0-1.0) `8bb3f89a3c0847a5` |
| `rl:doublebarrel:out` | 0.11 | 1080 | `ce2b8784a5546b2e` | Mossberg/N_12.wav (CC0-1.0) `a2dcffc6192c20f1` |
| `rl:doublebarrel:in` | 0.335 | 2376 | `837dc7a7429db041` | Model 12/K_13.wav (CC0-1.0) `aba1522a68bc5231` |
| `rl:doublebarrel:in` | 0.11 | 1080 | `ce2b8784a5546b2e` | Mossberg/N_12.wav (CC0-1.0) `a2dcffc6192c20f1` |
| `rl:doublebarrel:close` | 0.19 | 1512 | `a72f761ec3690de7` | Model 12/K_5.wav (CC0-1.0) `8cf87a884a272a67` |
| `rl:crossbow:open` | 0.045 | 648 | `34d43dd8c5c029b0` | Smith & Wesson 642/V_6.wav (CC0-1.0) `e3e92fb480760194` |
| `rl:crossbow:open` | 0.04 | 648 | `0ae868591b226ec5` | Smith & Wesson 642/V_7.wav (CC0-1.0) `72190561985f64e8` |
| `rl:crossbow:in` | 0.085 | 864 | `0727375ee3a83e7a` | Walther PPQ/X_26.wav (CC0-1.0) `4dce361e634bb900` |
| `rl:crossbow:close` | 0.045 | 648 | `e1306397d142bcda` | Smith & Wesson 642/V_8.wav (CC0-1.0) `63c89cc048cba381` |
| `pump` | 0.41 | 3276 | `922fa85b4c06982d` | Nova/O_6.wav (CC0-1.0) `99f8498b877fbf15` |
| `pump` | 0.195 | 1764 | `56621508f07d233c` | Nova/O_5.wav (CC0-1.0) `51c1a930f80b4887` |
| `bolt` | 0.745 | 5544 | `078b9a9ac168aa60` | Mosin Nagant/M_14.wav (CC0-1.0) `8c400580a1f65fe2` |
| `cylinder` | 0.045 | 756 | `baf021c0c1030812` | Smith & Wesson 642/V_6.wav (CC0-1.0) `e3e92fb480760194` |
| `cylinder` | 0.04 | 756 | `d9eef2cb68a4ee87` | Smith & Wesson 642/V_7.wav (CC0-1.0) `72190561985f64e8` |
| `dryfire` | 0.05 | 756 | `738f052cf86f677f` | Walther PPQ/X_18.wav (CC0-1.0) `5f517606bf41821b` |
| `dryfire` | 0.06 | 756 | `3a408aaf80e7748b` | AR-15/D_16.wav (CC0-1.0) `30b2dbe251166e05` |
| `hit` | 0.24 | 2304 | `d17b2991b26090d8` | impactPunch_heavy_000.ogg (CC0-1.0) `b33a8f14068aec24`<br>impactSoft_heavy_001.ogg (CC0-1.0) `4d0096364ba9e461` |
| `hit` | 0.24 | 2304 | `00f8566993da603c` | impactPunch_heavy_002.ogg (CC0-1.0) `7993dd4c156b9979`<br>impactSoft_heavy_003.ogg (CC0-1.0) `d00286a2dc62ee5c` |
| `hitConfirm` | 0.075 | 1152 | `1d123ccca9907877` | impactMetal_light_001.ogg (CC0-1.0) `fba69c467ddd85da`<br>tick_002.ogg (CC0-1.0) `869442f54214be90` |
| `headshot` | 0.3 | 2880 | `a190d77a69b3ef02` | impactMetal_light_001.ogg (CC0-1.0) `fba69c467ddd85da`<br>tick_002.ogg (CC0-1.0) `869442f54214be90`<br>impactBell_heavy_001.ogg (CC0-1.0) `9df61e3ae9a83dc6`<br>glass_001.ogg (CC0-1.0) `183eebee20eb0a53` |
| `confirm` | 0.5 | 4320 | `16f44054d2c86be6` | impactMetal_light_001.ogg (CC0-1.0) `fba69c467ddd85da`<br>confirmation_002.ogg (CC0-1.0) `33b17a9a9a2397c6`<br>impactBell_heavy_000.ogg (CC0-1.0) `94b8bb5f2d43ab65` |
| `swap` | 0.16 | 1728 | `4d2aba2bfb83e995` | AR-15/D_20.wav (CC0-1.0) `6f569716de8e616f`<br>cloth_2.ogg (CC0-1.0) `8a7451193c38bc05` |
| `swap` | 0.16 | 1728 | `c1d4eed91be35883` | 1911/A_31.wav (CC0-1.0) `9adff6e38d98053b`<br>cloth_3.ogg (CC0-1.0) `a48632d17a4f1416` |
| `combatMode` | 0.1 | 1152 | `ae742f1c665fed61` | switch_004.ogg (CC0-1.0) `541c19cc1ab712a9`<br>AR-15/D_19.wav (CC0-1.0) `7b5d15953abab1ce` |
| `ui` | 0.08 | 1152 | `e5c18b26592490c4` | click_002.ogg (CC0-1.0) `adcd1f4adc35f1b4` |
| `ui` | 0.11 | 1440 | `5773a475d1e95b65` | select_002.ogg (CC0-1.0) `4cc6ac5341b9b2c8` |
| `impact:stone` | 0.2 | 1320 | `585b7ce5519fbe49` | impactMining_000.ogg (CC0-1.0) `36b4ea107222d073`<br>impactMining_001.ogg (CC0-1.0) `61235a18de3f3d92` |
| `impact:stone` | 0.2 | 1320 | `9dcca8ed38c3ad04` | impactMining_002.ogg (CC0-1.0) `059558ec751115ca`<br>impactMining_003.ogg (CC0-1.0) `4237fa2cd80364ad` |
| `impact:stone` | 0.2 | 1320 | `5213898142f8ee62` | impactMining_004.ogg (CC0-1.0) `8ca3a99d85d84575`<br>impactPlate_light_000.ogg (CC0-1.0) `6e797cf8a5bfc52d` |
| `impact:wood` | 0.2 | 1320 | `c2ddae09425f1e0f` | impactWood_medium_000.ogg (CC0-1.0) `1723a9fd25103ed4`<br>impactPlank_medium_000.ogg (CC0-1.0) `8403cd7a043f0391` |
| `impact:wood` | 0.2 | 1320 | `bbb9b6ae455156e9` | impactWood_medium_001.ogg (CC0-1.0) `15271dbe8e2872db`<br>impactPlank_medium_001.ogg (CC0-1.0) `d7c304319f8beac6` |
| `impact:wood` | 0.2 | 1320 | `101d8e660a21163e` | impactWood_medium_002.ogg (CC0-1.0) `3f3f1917428b828f`<br>impactPlank_medium_002.ogg (CC0-1.0) `f6a14da459942296` |
| `impact:metal` | 0.2 | 1320 | `ba2bf9fcdb667187` | impactMetal_medium_000.ogg (CC0-1.0) `a96f879fec0864a8`<br>impactTin_medium_000.ogg (CC0-1.0) `f4bbee66ca191ec7` |
| `impact:metal` | 0.2 | 1320 | `62870edbcc7a8e50` | impactMetal_medium_001.ogg (CC0-1.0) `e8a9eaba7c4d2742`<br>impactTin_medium_001.ogg (CC0-1.0) `84253095543c094d` |
| `impact:metal` | 0.2 | 1320 | `054cf683dee9dfa4` | impactMetal_medium_002.ogg (CC0-1.0) `7e89ce2ca0dbda95`<br>impactTin_medium_002.ogg (CC0-1.0) `c1d2c4f9910d4529` |
| `impact:glass` | 0.2 | 1320 | `3e42b4cd4426f3b0` | impactGlass_light_000.ogg (CC0-1.0) `d750cf88097d0c3e`<br>impactGlass_medium_000.ogg (CC0-1.0) `9252d50bfb85edb1` |
| `impact:glass` | 0.2 | 1320 | `db8adea3ddbfadf8` | impactGlass_light_001.ogg (CC0-1.0) `05e513fbd4282906`<br>impactGlass_medium_001.ogg (CC0-1.0) `d3d806cb3012c9dd` |
| `impact:glass` | 0.2 | 1320 | `7345f06e2c59e123` | impactGlass_light_002.ogg (CC0-1.0) `710db7451bb7857b`<br>impactGlass_medium_002.ogg (CC0-1.0) `48616f22c95589ed` |
| `impact:soft` | 0.2 | 1320 | `452fce8342d8d601` | impactSoft_medium_000.ogg (CC0-1.0) `7d3ba0bb5e60a11b`<br>footstep_grass_000.ogg (CC0-1.0) `9d49497777405d78` |
| `impact:soft` | 0.2 | 1320 | `ee7f492cc4867430` | impactSoft_medium_001.ogg (CC0-1.0) `7642a4fd43e547af`<br>footstep_grass_001.ogg (CC0-1.0) `fb28781bd22b2eef` |
| `impact:soft` | 0.2 | 1320 | `04682a5c86dadb87` | impactSoft_medium_002.ogg (CC0-1.0) `5069e3571a77d7f7`<br>footstep_grass_002.ogg (CC0-1.0) `73a520139f5be716` |
| `impact:grass` | 0.2 | 1320 | `61c86b764455b98d` | impactSoft_medium_003.ogg (CC0-1.0) `5c4a1f35fde7e140`<br>footstep_grass_003.ogg (CC0-1.0) `0546e1d8ab2def71` |
| `impact:grass` | 0.2 | 1320 | `b6853c6bc46c1df2` | impactSoft_medium_004.ogg (CC0-1.0) `b0a4dea90eed47ac`<br>footstep_grass_001.ogg (CC0-1.0) `fb28781bd22b2eef` |
| `impact:snow` | 0.2 | 1320 | `e35e591776aae3ca` | impactSoft_medium_000.ogg (CC0-1.0) `7d3ba0bb5e60a11b`<br>footstep_snow_000.ogg (CC0-1.0) `c05fa4a9dc9a7aab` |
| `impact:snow` | 0.2 | 1320 | `07f04fd36f2e4c90` | impactSoft_medium_002.ogg (CC0-1.0) `5069e3571a77d7f7`<br>footstep_snow_002.ogg (CC0-1.0) `db52bafdc66304f3` |
| `break:stone` | 0.48 | 3168 | `a13c8ed7072c15e4` | impactMining_001.ogg (CC0-1.0) `61235a18de3f3d92`<br>impactMining_003.ogg (CC0-1.0) `4237fa2cd80364ad`<br>impactPlate_heavy_001.ogg (CC0-1.0) `142fd6c77f13d25f` |
| `break:wood` | 0.48 | 3168 | `f0a2bc9756de6165` | impactPlank_medium_003.ogg (CC0-1.0) `0602a7b3eab5f534`<br>impactWood_heavy_001.ogg (CC0-1.0) `f1b07a53ac10c615` |
| `break:snow` | 0.48 | 3168 | `8fb3a400d398bef9` | footstep_snow_001.ogg (CC0-1.0) `980fb9a1c9227aed`<br>impactSoft_heavy_002.ogg (CC0-1.0) `d130ae541951243d` |
| `break:grass` | 0.48 | 3168 | `0f54ab6b6bca84f3` | impactSoft_heavy_004.ogg (CC0-1.0) `e008f0b6b14f6233`<br>footstep_grass_004.ogg (CC0-1.0) `086fd4ab3546a507` |
| `break:glass` | 0.48 | 3168 | `246af762000907d8` | impactGlass_heavy_000.ogg (CC0-1.0) `b44b39a940e8948e`<br>impactGlass_heavy_002.ogg (CC0-1.0) `4978654ac840ad51` |
| `death` | 0.56 | 3744 | `c4bc9bbe85634d00` | impactPunch_medium_001.ogg (CC0-1.0) `e71d23abcc3f10d9`<br>drop_leather.ogg (CC0-1.0) `097e1d3b74949b01`<br>impactSoft_heavy_001.ogg (CC0-1.0) `4d0096364ba9e461`<br>AR-15/D_3.wav (CC0-1.0) `c2fbf179ce53996c`<br>impactPlate_light_001.ogg (CC0-1.0) `947915c2eb6ac57e` |
| `death` | 0.56 | 3744 | `5ab4cc8733a26248` | impactPunch_medium_003.ogg (CC0-1.0) `2d7c719c05999e05`<br>drop_leather.ogg (CC0-1.0) `097e1d3b74949b01`<br>impactSoft_heavy_001.ogg (CC0-1.0) `4d0096364ba9e461`<br>AK-47/C_11.wav (CC0-1.0) `c40234bd04873c6d`<br>impactPlate_light_003.ogg (CC0-1.0) `dbfb7c1d00257669` |
| `respawn` | 0.72 | 6048 | `6d9a379c582aa567` | maximize_006.ogg (CC0-1.0) `f050b3bb77cb0b90`<br>maximize_008.ogg (CC0-1.0) `57c074e600e193a3`<br>forceField_001.ogg (CC0-1.0) `5574e69dd04e5f59` |
| `shield` | 0.95 | 5040 | `f6a6c8157a7c8435` | forceField_000.ogg (CC0-1.0) `c2916f2a062c8ddd` |
| `shieldBlock` | 0.24 | 2304 | `5c89a06222b41a8c` | impactMetal_000.ogg (CC0-1.0) `956c6612a256aa1a`<br>glass_002.ogg (CC0-1.0) `08e972c73e53c91d` |
| `shieldBlock` | 0.24 | 2304 | `525c9371af8f1833` | impactMetal_002.ogg (CC0-1.0) `0c1bb4db8a4d48b2`<br>glass_004.ogg (CC0-1.0) `2379b58f953e3d86` |
| `killcam` | 1.5 | 7800 | `5227a2a47ef4f3ff` | lowFrequency_explosion_000.ogg (CC0-1.0) `3cb48d86dab63140` |
| `splash` | 0.52 | 3456 | `5dbe53d017bd692b` | Bathtub_water_splashes.ogg (Public domain) `471b9c2cc35a183d` |
| `splash` | 0.52 | 3456 | `c271d872aa1bcdc5` | Bathtub_water_splashes.ogg (Public domain) `471b9c2cc35a183d` |
| `splash` | 0.5 | 3312 | `b4cf958ddc5a2300` | Bathtub_water_splashes.ogg (Public domain) `471b9c2cc35a183d` |
| `dragonRoar` | 1.95 | 10080 | `30c62eac6bc4667d` | yell-YELLMM8K2005914Bison.mp3 (Public domain (U.S. NPS)) `a6bf74b683b9ec5f`<br>yell-YELLGrizzlyBearVocalizations20160520Android1.mp3 (Public domain (U.S. NPS)) `1ec17f7a35de22b2` |
| `dragonRoar` | 1.9 | 9840 | `564d21ba6e1cbc09` | yell-YELLMM8K2005918Bison.mp3 (Public domain (U.S. NPS)) `238a3857b5088e05`<br>yell-YELLGrizzlyBearVocalizations20160520Android1.mp3 (Public domain (U.S. NPS)) `1ec17f7a35de22b2` |
| `dragonBreath` | 1.6 | 8280 | `072167d1296b41bb` | yell-NorrisBlackGrowler.mp3 (Public domain (U.S. NPS)) `91e3615e92c088e3`<br>yell-YELLMapleFire20160814T04ms3.mp3 (Public domain (U.S. NPS)) `15d698e6620f17e0` |
| `dragonBreath` | 1.6 | 8280 | `f6543ccba725d5e8` | yell-NorrisBlackGrowler.mp3 (Public domain (U.S. NPS)) `91e3615e92c088e3`<br>yell-YELLMapleFire20160814T04ms3.mp3 (Public domain (U.S. NPS)) `15d698e6620f17e0` |
| `dragonHit` | 0.2 | 1584 | `5054d0f1df25c1dc` | impactPlate_heavy_000.ogg (CC0-1.0) `112d4f93ddcc370b`<br>impactPunch_medium_000.ogg (CC0-1.0) `486988aa2d6440ff` |
| `dragonHit` | 0.2 | 1584 | `f3c095c79a42ac13` | impactPlate_heavy_002.ogg (CC0-1.0) `b0cab75d1befa32b`<br>impactPunch_medium_001.ogg (CC0-1.0) `e71d23abcc3f10d9` |
| `dragonHit` | 0.2 | 1584 | `85536d8de5b4bb6d` | impactPlate_medium_001.ogg (CC0-1.0) `68ba7701b71ef620`<br>impactPunch_medium_002.ogg (CC0-1.0) `6492f9ccbc8d24dc` |
| `dragonDeath` | 5.2 | 26280 | `b2778d8460d0d323` | yell-YELLMM8K2005918Bison.mp3 (Public domain (U.S. NPS)) `238a3857b5088e05`<br>yell-YELLMM8K2005914Bison.mp3 (Public domain (U.S. NPS)) `a6bf74b683b9ec5f`<br>yell-YELLGrizzlyBearVocalizations20160520Android1.mp3 (Public domain (U.S. NPS)) `1ec17f7a35de22b2`<br>yell-Thunderandbirds140704.mp3 (Public domain (U.S. NPS)) `e5d88deaa66591b4`<br>impactWood_heavy_000.ogg (CC0-1.0) `15ff82332f342c30`<br>impactPlate_heavy_003.ogg (CC0-1.0) `59775f8979a396c8`<br>lowFrequency_explosion_001.ogg (CC0-1.0) `cdda50600a4928f2` |
| `dragonSpawn` | 2.4 | 12240 | `b8d5a9664c3b2872` | yell-YELLMM8K2005914Bison.mp3 (Public domain (U.S. NPS)) `a6bf74b683b9ec5f`<br>yell-YELLGrizzlyBearVocalizations20160520Android1.mp3 (Public domain (U.S. NPS)) `1ec17f7a35de22b2` |
| `wingFlap` | 0.62 | 3360 | `518e5d943ca055e8` | yell-RuffedGrouse.mp3 (Public domain (U.S. NPS)) `9f1ba763397e002d`<br>cloth_1.ogg (CC0-1.0) `ddb93a3671233f95` |
| `wingFlap` | 0.62 | 3360 | `88dc43d00b8ebb13` | yell-RuffedGrouse.mp3 (Public domain (U.S. NPS)) `9f1ba763397e002d`<br>cloth_3.ogg (CC0-1.0) `a48632d17a4f1416` |
| `wingFlap` | 0.62 | 3360 | `1a297827fcdf9876` | yell-RuffedGrouse.mp3 (Public domain (U.S. NPS)) `9f1ba763397e002d`<br>cloth_4.ogg (CC0-1.0) `e7ab9a6c4466dea8` |
| `knifeEquip` | 0.38 | 3456 | `ca74373bd130e131` | draw_knife_1.ogg (CC0-1.0) `276403e72c3b71c4` |
| `knifeSlash` | 0.22 | 2304 | `139fa06cfdd77547` | cloth_1.ogg (CC0-1.0) `ddb93a3671233f95`<br>draw_knife_2.ogg (CC0-1.0) `d5df6a4130cbb016` |
| `knifeSlash` | 0.22 | 2304 | `3892e68cf6bf3b25` | cloth_2.ogg (CC0-1.0) `8a7451193c38bc05`<br>draw_knife_3.ogg (CC0-1.0) `a11ae62fb1a62842` |
| `knifeSlash` | 0.22 | 2304 | `569094449b022e8a` | cloth_4.ogg (CC0-1.0) `e7ab9a6c4466dea8`<br>draw_knife_2.ogg (CC0-1.0) `d5df6a4130cbb016` |
| `knifeStab` | 0.32 | 2880 | `c2f9222573b45fd3` | draw_knife_1.ogg (CC0-1.0) `276403e72c3b71c4`<br>cloth_3.ogg (CC0-1.0) `a48632d17a4f1416`<br>chop.ogg (CC0-1.0) `d00c2b3c9fff07e3` |
| `knifeStab` | 0.32 | 2880 | `3284947f914cb3ff` | draw_knife_3.ogg (CC0-1.0) `a11ae62fb1a62842`<br>cloth_3.ogg (CC0-1.0) `a48632d17a4f1416`<br>chop.ogg (CC0-1.0) `d00c2b3c9fff07e3` |
| `knifeHit` | 0.24 | 2304 | `0a2f090b5bf1830e` | chop.ogg (CC0-1.0) `d00c2b3c9fff07e3`<br>impactPunch_medium_003.ogg (CC0-1.0) `2d7c719c05999e05` |
| `knifeHit` | 0.24 | 2304 | `b517e71ea80dc03a` | knife_slice.ogg (CC0-1.0) `4cd96dc630bed984`<br>impactPunch_medium_003.ogg (CC0-1.0) `2d7c719c05999e05` |
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
