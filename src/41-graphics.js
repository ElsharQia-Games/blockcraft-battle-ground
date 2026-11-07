/* Blockcraft Battle Ground — lighting, shadows, reflections and quality.
   41-graphics.js (after 30-meshing.js and 40-characters.js, whose materials
   and lights it configures)
   - Quality: "high" on desktop, "low" on touch devices; ?gfx=low|high
     overrides and is remembered.
   - High: a soft sun shadow map that follows the player, so terrain, builds,
     players, villagers and dragons cast real shadows.
   - Water and glass reflect a sky environment map rendered from the sky dome,
     with a sun specular glint from the Phong materials in 30-meshing.js.
   - Filmic tone mapping and warmer sun / cooler sky light for depth. */
'use strict';

const GFX_SHADOW_SPAN = 54;     // half-size of the sun's shadow box, in blocks
const GFX_SHADOW_MAP = 2048;
const GFX_SUN_OFFSET = new THREE.Vector3(48, 96, 30);
// View distance per quality. The far plane sits just past full fog, so chunks
// the fog already hides are frustum-culled instead of drawn.
const GFX_VIEW = { high: { near: 56, far: 124, clip: 132 }, low: { near: 40, far: 92, clip: 100 } };

const gfx = {
  quality: 'high',
  shadows: false,
  envMap: null,
  tagged: new WeakSet(),
  scanAt: 0
};

function gfxPickQuality() {
  let q = null;
  try {
    const param = new URLSearchParams(location.search).get('gfx');
    if (param === 'low' || param === 'high') { q = param; localStorage.setItem('blockcraft.gfx', q); }
    else q = localStorage.getItem('blockcraft.gfx');
  } catch (e) { /* storage optional */ }
  if (q === 'low' || q === 'high') return q;
  const coarse = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
  return coarse ? 'low' : 'high';
}

function gfxBuildEnvMap() {
  // Render only the sky dome into a small cube map once; water and glass use
  // it for reflections without a second scene render every frame.
  const target = new THREE.WebGLCubeRenderTarget(128);
  const cubeCamera = new THREE.CubeCamera(1, 1000, target);
  const skyScene = new THREE.Scene();
  const dome = new THREE.Mesh(sky.geometry, sky.material);
  skyScene.add(dome);
  cubeCamera.update(renderer, skyScene);
  skyScene.remove(dome);
  return target.texture;
}

function gfxConfigureLights() {
  hemiLight.color.set(0xdfeeff);
  hemiLight.groundColor.set(0x6b6450);
  hemiLight.intensity = 1.35;
  sunLight.color.set(0xfff1d6);
  sunLight.intensity = 1.9;
  if (!sunLight.target.parent) scene.add(sunLight.target);
}

function gfxConfigureShadows(on) {
  gfx.shadows = on;
  renderer.shadowMap.enabled = on;
  // Refresh the shadow map every second frame (see gfxShadowTick): half the
  // shadow cost, and indistinguishable at this movement speed.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sunLight.castShadow = on;
  if (on) {
    const cam = sunLight.shadow.camera;
    cam.left = cam.bottom = -GFX_SHADOW_SPAN;
    cam.right = cam.top = GFX_SHADOW_SPAN;
    cam.near = 1; cam.far = 260;
    cam.updateProjectionMatrix();
    sunLight.shadow.mapSize.set(GFX_SHADOW_MAP, GFX_SHADOW_MAP);
    sunLight.shadow.bias = -0.0006;
    sunLight.shadow.normalBias = 0.045;
  }
  for (const m of [solidMaterial, glassMaterial, waterMaterial]) m.needsUpdate = true;
}

// Characters, NPCs, dragons and props are created by many modules; tag new
// opaque meshes as shadow casters with a cheap periodic sweep.
function gfxTagCasters(now) {
  if (!gfx.shadows || now < gfx.scanAt) return;
  gfx.scanAt = now + 1000;
  scene.traverse((o) => {
    if (!o.isMesh || gfx.tagged.has(o)) return;
    gfx.tagged.add(o);
    if (o.isInstancedMesh || (o.userData && o.userData.noShadow)) return; // particles, casings
    const m = o.material;
    if (!m || Array.isArray(m) || m.transparent || m.isShaderMaterial || m.isSpriteMaterial || o === sky) return;
    if (o.geometry && o.geometry.attributes && o.geometry.attributes.color && m === solidMaterial) return; // chunks set in 30-meshing
    o.castShadow = true;
    o.receiveShadow = true;
  });
}

function gfxFollowPlayer() {
  if (!gfx.shadows) return;
  // Snap to whole shadow texels so the shadow does not shimmer as you move.
  const texel = (GFX_SHADOW_SPAN * 2) / GFX_SHADOW_MAP;
  const cx = Math.round(player.pos.x / texel) * texel;
  const cz = Math.round(player.pos.z / texel) * texel;
  const cy = Math.max(SEA, player.pos.y);
  sunLight.target.position.set(cx, cy, cz);
  sunLight.position.set(cx + GFX_SUN_OFFSET.x, cy + GFX_SUN_OFFSET.y, cz + GFX_SUN_OFFSET.z);
  sunLight.target.updateMatrixWorld();
}

function gfxApplyView() {
  const v = GFX_VIEW[gfx.quality];
  scene.fog.near = v.near;
  scene.fog.far = v.far;
  camera.far = v.clip;
  camera.updateProjectionMatrix();
  // The sky dome must stay inside the far plane; it follows the camera.
  sky.scale.setScalar((v.clip * 0.9) / 700);
}

// Fast draws at about phone-screen size; a 3x phone at full density is 9x the pixels.
function gfxPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, gfx.quality === 'high' ? 2 : 1);
}

function gfxSetQuality(q) {
  gfx.quality = q === 'low' ? 'low' : 'high';
  gfxApplyView();
  try { localStorage.setItem('blockcraft.gfx', gfx.quality); } catch (e) { /* optional */ }
  gfxConfigureShadows(gfx.quality === 'high');
  renderer.setPixelRatio(gfxPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  return gfx.quality;
}

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
gfxConfigureLights();
try {
  gfx.envMap = gfxBuildEnvMap();
  waterMaterial.envMap = glassMaterial.envMap = gfx.envMap;
} catch (e) { /* reflections are optional */ }
gfxSetQuality(gfxPickQuality());

let gfxShadowFrame = 0;
function gfxShadowTick() {
  if (gfx.shadows && (++gfxShadowFrame & 1) === 0) renderer.shadowMap.needsUpdate = true;
}

BC.on('preFrame', () => gfxFollowPlayer(), 50);
BC.on('preRender', gfxShadowTick, 10);
BC.on('lateFrame', (dt, now) => gfxTagCasters(now || performance.now()), 200);

BC.api.graphics = {
  get quality() { return gfx.quality; },
  get shadows() { return gfx.shadows; },
  get envMap() { return gfx.envMap; },
  pixelRatio: gfxPixelRatio,
  setQuality: gfxSetQuality
};
