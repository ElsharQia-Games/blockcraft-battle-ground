/* Blockcraft Battle Ground — Shared, seed-only dragon classes and routes.
   Classic browser script / Node UMD. Load before 45-dragons.js; the room
   authority requires this same file. No terrain, clocks, random draws or DOM.

   descriptor() returns immutable flat orbit fields plus catalog bounds. Only
   cx/cz/altitude are terrain-dependent: the host fills those within catalog.
   phase preserves the existing hash2 orbit clock, including late joiners. */
(function (drRulesRoot, drRulesFactory) {
  'use strict';
  var drRulesAPI = drRulesFactory();
  if (typeof module === 'object' && module.exports) module.exports = drRulesAPI;
  if (drRulesRoot) drRulesRoot.BCDragonRules = drRulesAPI;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var drRulesTAU = Math.PI * 2;
  var drRulesGuardianCount = 6;
  var drRulesRespawnMs = 60000;
  var drRulesGuardians = [
    { name: 'Emberwing', x: -7, z: -5, rx: 43, rz: 32, rotation: 0.25, altitude: 58, size: 1.38, period: 69, direction: 1, tiltX: 2.1, tiltZ: 1, flap: 2.6, glide: 17 },
    { name: 'Jadewing', x: 11, z: 9, rx: 57, rz: 41, rotation: 1.1, altitude: 64, size: 1.092, period: 83, direction: -1, tiltX: 1, tiltZ: -2.1, flap: 2.25, glide: 19 },
    { name: 'Stormcrest', x: -12, z: 11, rx: 61, rz: 43, rotation: -0.62, altitude: 70, size: 1.224, period: 97, direction: 1, tiltX: 2.4, tiltZ: 0.3, flap: 2.8, glide: 21 },
    { name: 'Duskmantle', x: 14, z: -11, rx: 46, rz: 57, rotation: 0.8, altitude: 63, size: 1.02, period: 79, direction: -1, tiltX: -1.2, tiltZ: 1.7, flap: 2.4, glide: 16 },
    { name: 'Frostfang', x: 9, z: 13, rx: 72, rz: 50, rotation: 1.9, altitude: 74, size: 1.14, period: 103, direction: 1, tiltX: 1.6, tiltZ: -1.1, flap: 2.5, glide: 18 },
    { name: 'Ashmaw', x: -13, z: -9, rx: 52, rz: 68, rotation: -1.4, altitude: 67, size: 1.3, period: 91, direction: -1, tiltX: -1.8, tiltZ: 0.9, flap: 2.9, glide: 20 }
  ];
  var drRulesMountNames = ['Emberglide', 'Jadeglide', 'Stormglide', 'Duskglide', 'Frostglide', 'Ashglide'];

  function drRulesSeed(seed) {
    return Number.isFinite(seed) ? seed >>> 0 : 0;
  }

  function drRulesHash(text) {
    var hash = 2166136261 >>> 0;
    for (var i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    return hash;
  }

  function drRulesUnit(seed, slot, field) {
    return drRulesHash(seed + ':mount-dragon:' + slot + ':' + field) / 4294967296;
  }

  function drRulesPhase(seed, index) {
    var hash = Math.imul(771 + index * 41, 374761393) + Math.imul(1553 - index * 67, 668265263) + seed;
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296 * drRulesTAU;
  }

  function drRulesCount(seed) {
    return drRulesGuardianCount + 3 + (drRulesHash(drRulesSeed(seed) + ':mount-dragon-count') & 1);
  }

  function drRulesRideable(seed, index) {
    return Number.isInteger(index) && index >= drRulesGuardianCount && index < drRulesCount(seed);
  }

  function drRulesDescriptor(seed, index) {
    seed = drRulesSeed(seed);
    if (!Number.isInteger(index) || index < 0 || index >= drRulesCount(seed)) return null;
    var guardian = index < drRulesGuardianCount;
    var result, slot = index - drRulesGuardianCount;
    if (guardian) {
      result = Object.assign({}, drRulesGuardians[index]);
      result.paletteIndex = index;
      result.centerMode = 'central-village-bias';
      result.catalog = Object.freeze({
        minCX: 128 + result.x - 15.01, maxCX: 128 + result.x + 15.01,
        minCZ: 128 + result.z - 15.01, maxCZ: 128 + result.z + 15.01,
        minAltitude: result.altitude, maxAltitude: 112
      });
    } else {
      // Tiny, slow circuits stay within ten metres of every possible perch on
      // the loop. A live-voxel stop therefore remains inside mount validation's
      // existing 7m + 3m root allowance; it never invents a high sky orbit.
      var angle = slot * drRulesTAU / (drRulesCount(seed) - drRulesGuardianCount) +
        drRulesUnit(seed, 0, 'spread') * drRulesTAU;
      var distance = 42 + drRulesUnit(seed, slot, 'distance') * 18;
      var palette = Math.floor(drRulesUnit(seed, slot, 'palette') * drRulesMountNames.length);
      result = {
        name: drRulesMountNames[palette] + ' ' + (slot + 1), paletteIndex: palette,
        x: Math.cos(angle) * distance, z: Math.sin(angle) * distance,
        rx: 3.25 + drRulesUnit(seed, slot, 'rx') * 0.75,
        rz: 3 + drRulesUnit(seed, slot, 'rz') * 0.75,
        rotation: drRulesUnit(seed, slot, 'rotation') * drRulesTAU,
        altitude: 24, size: 0.35 + drRulesUnit(seed, slot, 'size') * 0.1,
        period: 32 + drRulesUnit(seed, slot, 'period') * 20,
        direction: drRulesUnit(seed, slot, 'direction') < 0.5 ? -1 : 1,
        tiltX: 0.18 + drRulesUnit(seed, slot, 'tiltX') * 0.17,
        tiltZ: (drRulesUnit(seed, slot, 'tiltZ') - 0.5) * 0.36,
        flap: 2.3 + drRulesUnit(seed, slot, 'flap') * 0.5,
        glide: 13 + drRulesUnit(seed, slot, 'glide') * 5,
        centerMode: 'village-outskirts',
        villageSlot: slot + Math.floor(drRulesUnit(seed, 0, 'village') * 65536),
        villageAngle: angle,
        villageDistance: 16 + drRulesUnit(seed, slot, 'yard') * 8,
        catalog: Object.freeze({ minCX: 24, maxCX: 232, minCZ: 24, maxCZ: 232,
          minAltitude: 24, maxAltitude: 88 })
      };
    }
    result.index = index;
    result.seed = seed;
    result.kind = 'dragon';
    result.type = guardian ? 'guardian' : 'mount';
    result.role = guardian ? 'world-watcher' : 'riding-mount';
    result.routeFamily = guardian ? 'guardian-orbit' : 'mount-yard';
    result.ambient = true;
    result.rideable = !guardian;
    result.indestructible = false;
    result.invulnerable = false;
    result.maxHp = guardian ? 900 : 500;
    result.phase = drRulesPhase(seed, index);
    result.swayPeriod = 9.4 + index * 0.8;
    return Object.freeze(result);
  }

  return Object.freeze({
    guardianCount: drRulesGuardianCount, minMounts: 3, maxMounts: 4, respawnMs: drRulesRespawnMs,
    count: drRulesCount, isRideable: drRulesRideable, descriptor: drRulesDescriptor
  });
});
