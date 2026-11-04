/* Blockcraft Battle Ground — World constants, renderer, scene, camera and the sky dome.
   00-core.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ---------------- world constants ---------------- */
const CHUNK = 16;
const CHUNKS = 16;
const WORLD = CHUNK * CHUNKS;          // 256 blocks across
const HEIGHT = 80;
const SEA = 22;

/* The world seed is runtime data now: ?seed= wins, then the last seed saved by
   the lobby, then the original hand-authored world. 20-world.js reads SEED for
   every noise lookup, so assigning SEED before generateTerrain() re-rolls the
   whole map deterministically (including villages and dragon routes). */
function resolveWorldSeed() {
  const fallback = 20261104;
  try {
    const params = new URLSearchParams(location.search);
    const raw = params.has('seed') ? params.get('seed') : localStorage.getItem('blockcraft.seed');
    if (raw == null || String(raw).trim() === '') return fallback;
    const text = String(raw).trim();
    if (/^-?\d+$/.test(text)) {
      const n = Number(text);
      if (Number.isSafeInteger(n)) return n >>> 0;
    }
    return BC.hashSeed(text) || fallback;
  } catch (e) {
    return fallback;
  }
}
let SEED = resolveWorldSeed();

const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, LOG = 5,
      LEAVES = 6, PLANKS = 7, COBBLE = 8, BRICK = 9, WATER = 10,
      GLASS = 11, STONEBRICK = 12, MOSSY = 13, SNOW = 14, GRAVEL = 15,
      SANDSTONE = 16, GOLD_ORE = 17, GOLD_BLOCK = 18, DIAMOND_ORE = 19, DIAMOND_BLOCK = 20,
      MUD = 21, CACTUS = 22;

/* ---------------- renderer / scene ---------------- */
const canvasHost = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbdd9f2, 52, 118);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 1600);
camera.rotation.order = 'YXZ';

/* sky dome with a vertical gradient */
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    top:    { value: new THREE.Color(0x3d82cf) },
    mid:    { value: new THREE.Color(0x9ecbf0) },
    bottom: { value: new THREE.Color(0xdfeefb) }
  },
  vertexShader: `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
    varying vec3 vDir;
    void main() {
      float h = clamp(vDir.y, -1.0, 1.0);
      vec3 c = h > 0.0
        ? mix(mid, top, pow(h, 0.55))
        : mix(mid, bottom, pow(min(-h * 2.2, 1.0), 0.7));
      gl_FragColor = vec4(c, 1.0);
    }`,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 14), skyMat);
sky.position.set(WORLD / 2, 0, WORLD / 2);
sky.renderOrder = -1;
sky.frustumCulled = false;
scene.add(sky);
