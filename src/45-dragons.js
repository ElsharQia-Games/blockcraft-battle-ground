/* Blockcraft Battle Ground — Articulated, low-poly ambient dragons.
   45-dragons.js
   Classic script, loaded after characters. Spawn after terrain, before compile.
   Seeded sky poses retain their analytic clock. Live-voxel sweeps bound actual
   body movement; pooled colliders never include the cosmetic wingspan. */
'use strict';

const dragons = [];
const DRAGON_TAU = Math.PI * 2;
const DRAGON_PALETTES = [
  { name: 'Emberwing', skin: 0x8b3e32, dark: 0x562d32, belly: 0xe3b777,
    wing: 0xc97848, wingDark: 0x9a4b35, horn: 0xefdab1, spine: 0xe8af57, eye: 0xffe083,
    crest: 1, hornLength: 1, span: 1.03, fin: 0.9 },
  { name: 'Jadewing', skin: 0x2f6253, dark: 0x1d403c, belly: 0xb5c58b,
    wing: 0x76a77a, wingDark: 0x49785d, horn: 0xe5d9b4, spine: 0xb3bd79, eye: 0xf6d76b,
    crest: 0.65, hornLength: 0.78, span: 1.13, fin: 1.15 },
  { name: 'Stormcrest', skin: 0x394f7f, dark: 0x253450, belly: 0xc5d6db,
    wing: 0x8daec4, wingDark: 0x54759f, horn: 0xf0e8d5, spine: 0xb8d8df, eye: 0xbdeaf6,
    crest: 1.3, hornLength: 1.15, span: 0.99, fin: 0.85 },
  { name: 'Duskmantle', skin: 0x4e3d60, dark: 0x302637, belly: 0xbfa493,
    wing: 0xb4867b, wingDark: 0x855667, horn: 0xe4c9af, spine: 0xca9b73, eye: 0xffbe75,
    crest: 1.12, hornLength: 0.92, span: 1.07, fin: 1.2 },
  { name: 'Frostfang', skin: 0x6c8fb0, dark: 0x3f5874, belly: 0xe2eff5,
    wing: 0xb8d6e6, wingDark: 0x7fa4bf, horn: 0xf4f8fa, spine: 0xcfe9f4, eye: 0x9fe8ff,
    crest: 1.2, hornLength: 1.25, span: 1.05, fin: 1.0 },
  { name: 'Ashmaw', skin: 0x33302f, dark: 0x1e1c1c, belly: 0x8c5a3e,
    wing: 0x5a4a44, wingDark: 0x3a2f2c, horn: 0xc9bda8, spine: 0xd9622a, eye: 0xff7a2e,
    crest: 0.9, hornLength: 1.1, span: 1.12, fin: 1.1 }
];
const DRAGON_RULES = typeof window !== 'undefined' ? window.BCDragonRules : null;
// Retain the original inspection name, but shared rules own every route/scale.
// Active world populations use count(SEED), not this guardian-only legacy list.
const DRAGON_ROUTES = DRAGON_RULES ? Object.freeze([
  DRAGON_RULES.descriptor(0, 0), DRAGON_RULES.descriptor(0, 1),
  DRAGON_RULES.descriptor(0, 2), DRAGON_RULES.descriptor(0, 3)
]) : Object.freeze([]);
const DRAGON_TAIL_LENGTHS = [1.7, 1.6, 1.5, 1.35, 1.2, 1.05, 0.85];
// These resources are private, unlike the cached character/dragon materials.
// Keep old saddles reachable until the world owner removes the old dragon roots.
const DRAGON_SADDLES = new Set();

/* ---------------- rideable roll, saddle & mount points ---------------- */
/* All small mounts have saddles. Guardians can never be mounted, including
   under a legacy ?ride / forceRideable demo flag. Keep the old helper name for
   callers, but never duplicate eligibility or count RNG here. */
function dragonRideableRoll(index) {
  return !!DRAGON_RULES && DRAGON_RULES.isRideable(SEED, index);
}

function dragonSaddlePos(out) {
  this.group.updateWorldMatrix(true, false);
  return out.copy(this.saddleOffset).applyMatrix4(this.group.matrixWorld);
}

function dragonMouthPos(out) {
  // The head geometry's snout reaches z -2.1 locally; -2.0 sits just inside
  // the open jaws, so breath particles and rays start at the mouth, not the chest.
  this.parts.head.updateWorldMatrix(true, false);
  return out.set(0, -0.22, -2.0).applyMatrix4(this.parts.head.matrixWorld);
}

function dragonSaddleMarker() {
  const saddle = new THREE.Group();
  saddle.name = 'dragon-saddle';
  const builder = dragonGeometryBuilder();
  dragonBox(builder, 0x3b1f24, 0, 0, 0, 1.26, 0.18, 1.52);
  dragonBox(builder, 0x2a1418, 0, 0.2, -0.6, 1.02, 0.34, 0.2);
  dragonBox(builder, 0x2a1418, 0, 0.13, 0.66, 1.02, 0.24, 0.18);
  dragonBox(builder, 0xe8af57, 0, 0.28, -0.54, 0.2, 0.2, 0.2);
  dragonBox(builder, 0xff3556, -0.62, 0.11, 0, 0.1, 0.045, 1.42);
  dragonBox(builder, 0x3585ff, 0.62, 0.11, 0, 0.1, 0.045, 1.42);
  const geometry = dragonFinishGeometry(builder);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  dragonStaticMesh(saddle, geometry, material, 'dragon-saddle-seat');
  saddle.userData.geometry = geometry;
  saddle.userData.material = material;
  if (typeof makeNameTag === 'function') {
    const tag = makeNameTag('RIDE \u00b7 30s', '#eaf2fa');
    tag.name = 'dragon-ride-tag';
    tag.scale.set(1.25, 0.32, 1);
    tag.position.set(0, 1.12, 0.18);
    saddle.add(tag);
    // Unlike population name tags, this tag is disposed with its private seat.
    // Do not expose userData.tag to WORLD_releasePopulationRoot as well.
    saddle.userData.rideTag = tag;
  }
  DRAGON_SADDLES.add(saddle);
  return saddle;
}

function dragonAttachSaddle(dragon) {
  if (!dragon || dragon.saddle || !dragon.group || !dragonRideableRoll(dragon.index) || dragon.type === 'guardian') return;
  const saddle = dragonSaddleMarker();
  saddle.position.copy(dragon.saddleOffset);
  dragon.group.add(saddle);
  dragon.saddle = saddle;
  dragon.tag = saddle.userData.rideTag || null;
  dragon.group.userData.saddle = saddle;
}

function dragonDisposeSaddle(saddle) {
  if (!saddle || !DRAGON_SADDLES.has(saddle)) return;
  DRAGON_SADDLES.delete(saddle);
  if (saddle.parent) saddle.parent.remove(saddle);
  const owned = saddle.userData;
  if (owned.geometry) owned.geometry.dispose();
  if (owned.material) owned.material.dispose();
  if (owned.rideTag && owned.rideTag.material) {
    if (owned.rideTag.material.map) owned.rideTag.material.map.dispose();
    owned.rideTag.material.dispose();
  }
  saddle.clear();
  owned.geometry = owned.material = owned.rideTag = null;
}

function dragonPruneSaddles() {
  // worldReset is emitted AFTER the new dragons have spawned. Dispose only
  // retired roots, not the new world's markers, and never dispose shared rigs.
  for (const saddle of DRAGON_SADDLES) {
    let current = false;
    for (let i = 0; i < dragons.length; i++) {
      if (dragons[i].saddle === saddle && dragons[i].group.parent === scene) {
        current = true;
        break;
      }
    }
    if (!current) {
      const root = saddle.parent;
      if (root && root.userData.saddle === saddle) root.userData.saddle = null;
      dragonDisposeSaddle(saddle);
    }
  }
}

/* Keep the ride readable while 46-riding.js flies the body. Reuse the authored
   rig rather than rebuilding meshes; a breath opens the jaw a little wider. */
function poseRiddenDragon(dragon, seconds) {
  const parts = dragon.parts;
  const motion = DRAGON_MOTION_QUERY && DRAGON_MOTION_QUERY.matches ? 0.28 : 1;
  const riding = (typeof BC !== 'undefined' && BC.api) ? BC.api.riding : null;
  const firing = !!(riding && ((riding.active && riding.dragon === dragon &&
    riding.firing && !riding.overheated) ||
    (typeof riding.remoteFiring === 'function' && riding.remoteFiring(dragon))));
  const beat = seconds * 3.1 + dragon.phase;
  const stroke = Math.sin(beat);
  for (let wing = 0; wing < parts.wings.length; wing++) {
    const w = parts.wings[wing];
    w.upper.rotation.z = w.side * (0.16 + motion * 0.38 * stroke);
    w.upper.rotation.y = w.side * -0.06;
    w.outer.rotation.z = -0.04 + motion * 0.2 * Math.sin(beat - 0.68);
  }
  parts.hips.rotation.set(
    0.022 * Math.sin(seconds * 1.2),
    0.03 * Math.sin(seconds * 0.8),
    0
  );
  parts.neck[0].rotation.set(-0.05, 0, 0);
  parts.neck[1].rotation.set(0.06, 0, 0);
  parts.head.rotation.set(-0.12 + (firing ? -0.1 : 0), 0, 0);
  parts.jaw.rotation.x = firing ? -0.58 : -0.12 - 0.04 * Math.sin(seconds * 2.1);
  for (let joint = 0; joint < parts.tail.length; joint++) {
    const follow = seconds * 1.35 - joint * 0.52;
    parts.tail[joint].rotation.y = motion * 0.05 * Math.sin(follow);
    parts.tail[joint].rotation.x = -0.02 + motion * 0.022 * Math.sin(follow + 0.7);
  }
}

const DRAGON_GEOMETRIES = new Map();
const DRAGON_COLORS = new Map();
const DRAGON_MATERIALS = {
  solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
  // Opaque, double-sided membranes remain visible from below without sorting/overdraw.
  membrane: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  eyes: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
};
const DRAGON_MOTION_QUERY = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
// A monotonic epoch clock gives peers the same seeded sky, even if they join later.
const DRAGON_TIME_ORIGIN = Number.isFinite(performance.timeOrigin)
  ? performance.timeOrigin : Date.now() - performance.now();

/* ---------------- baked, vertex-colored geometry ---------------- */
/* Each articulated section is one mesh, regardless of its boxes, horns or ribs.
   Geometry is private to this file, cached by palette, and never edited by posing. */
function dragonGeometryBuilder() {
  return { positions: [], colors: [] };
}

function dragonTriangle(builder, a, b, c, color, shade = 1) {
  let rgb = DRAGON_COLORS.get(color);
  if (!rgb) { rgb = new THREE.Color(color); DRAGON_COLORS.set(color, rgb); }
  builder.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < 3; i++) builder.colors.push(rgb.r * shade, rgb.g * shade, rgb.b * shade);
}

function dragonQuad(builder, a, b, c, d, color, shade = 1) {
  dragonTriangle(builder, a, b, c, color, shade);
  dragonTriangle(builder, a, c, d, color, shade);
}

function dragonFinishGeometry(builder) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(builder.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(builder.colors, 3));
  // Non-indexed triangles intentionally retain the game's hard, faceted edges.
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function dragonBox(builder, color, x, y, z, w, h, d) {
  const v = [
    [x - w / 2, y - h / 2, z - d / 2], [x + w / 2, y - h / 2, z - d / 2],
    [x + w / 2, y + h / 2, z - d / 2], [x - w / 2, y + h / 2, z - d / 2],
    [x - w / 2, y - h / 2, z + d / 2], [x + w / 2, y - h / 2, z + d / 2],
    [x + w / 2, y + h / 2, z + d / 2], [x - w / 2, y + h / 2, z + d / 2]
  ];
  dragonQuad(builder, v[0], v[3], v[2], v[1], color);
  dragonQuad(builder, v[4], v[5], v[6], v[7], color);
  dragonQuad(builder, v[0], v[4], v[7], v[3], color, 0.9);
  dragonQuad(builder, v[1], v[2], v[6], v[5], color, 0.9);
  dragonQuad(builder, v[3], v[7], v[6], v[2], color, 1.06);
  dragonQuad(builder, v[0], v[1], v[5], v[4], color, 0.86);
}

// Rings are [z, half-width, half-height, center-y], front to back along +Z.
function dragonTaper(builder, rings, skin, belly = skin) {
  const cross = [[1, 0.5], [0.6, 1], [-0.6, 1], [-1, 0.5], [-1, -0.5], [-0.6, -1], [0.6, -1], [1, -0.5]];
  const vertices = rings.map(r => cross.map(c => [c[0] * r[1], r[3] + c[1] * r[2], r[0]]));
  for (let r = 0; r < vertices.length - 1; r++) {
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      dragonQuad(builder, vertices[r][i], vertices[r][j], vertices[r + 1][j], vertices[r + 1][i],
        i >= 4 && i <= 6 ? belly : skin, i === 3 || i === 7 ? 0.86 : 1);
    }
  }
  const last = rings.length - 1;
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    dragonTriangle(builder, [0, rings[0][3], rings[0][0]], vertices[0][j], vertices[0][i], skin);
    dragonTriangle(builder, [0, rings[last][3], rings[last][0]], vertices[last][i], vertices[last][j], skin);
  }
}

// Square-section tapered beams make angular bones, bent horns and talons.
function dragonBeam(builder, start, end, radiusA, radiusB, color) {
  const direction = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]).normalize();
  const up = Math.abs(direction.y) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(up, direction).normalize();
  const v = new THREE.Vector3().crossVectors(direction, u);
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const ring = (p, radius) => corners.map(c => [
    p[0] + (u.x * c[0] + v.x * c[1]) * radius,
    p[1] + (u.y * c[0] + v.y * c[1]) * radius,
    p[2] + (u.z * c[0] + v.z * c[1]) * radius
  ]);
  const a = ring(start, radiusA), b = ring(end, radiusB);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    dragonQuad(builder, a[i], a[j], b[j], b[i], color, i % 2 ? 0.9 : 1);
  }
  dragonQuad(builder, a[3], a[2], a[1], a[0], color);
  dragonQuad(builder, b[0], b[1], b[2], b[3], color);
}

function dragonBuildGeometries(p) {
  const key = [p.skin, p.dark, p.belly, p.wing, p.wingDark, p.horn, p.spine, p.eye, p.crest, p.hornLength, p.fin].join('|');
  if (DRAGON_GEOMETRIES.has(key)) return DRAGON_GEOMETRIES.get(key);
  const geos = {};
  let b = dragonGeometryBuilder();
  dragonTaper(b, [[-2.5, 0.9, 1, 0.08], [-1.2, 1.32, 1.4, 0], [1, 1.08, 1.1, -0.1], [2.2, 0.79, 0.8, -0.05]], p.skin, p.belly);
  for (let i = 0; i < 4; i++) {
    const z = -1.85 + i * 1.1, y = 1.28 - Math.max(0, i - 1) * 0.2;
    dragonBeam(b, [0, y, z], [0, y + (0.8 - i * 0.09) * p.crest, z + 0.48], 0.23, 0.018, p.spine);
  }
  for (let i = 0; i < 3; i++) {
    dragonBox(b, p.belly, 0, -1.41 + i * 0.09, -0.95 + i * 0.72, 1.22 - i * 0.09, 0.12, 0.52);
  }
  for (const side of [-1, 1]) {
    dragonBeam(b, [side * 0.94, -0.4, -1.7], [side * 1.35, -1.58, -1.03], 0.31, 0.23, p.skin);
    dragonBeam(b, [side * 1.35, -1.58, -1.03], [side * 0.98, -1.83, -0.2], 0.24, 0.17, p.dark);
    dragonBox(b, p.skin, side * 0.98, -1.82, -0.12, 0.46, 0.3, 0.48);
    for (let claw = -1; claw <= 1; claw++) {
      const x = side * 0.98 + claw * 0.16;
      dragonBeam(b, [x, -1.85, 0.03], [x, -2.08, 0.43], 0.075, 0.014, p.horn);
    }
  }
  geos.body = dragonFinishGeometry(b);

  b = dragonGeometryBuilder();
  dragonTaper(b, [[-0.3, 0.99, 0.94, 0], [1.4, 0.68, 0.67, -0.02], [2, 0.53, 0.51, 0]], p.skin, p.belly);
  dragonBeam(b, [0, 0.8, 0.55], [0, 0.8 + 0.52 * p.crest, 1.03], 0.2, 0.018, p.spine);
  for (const side of [-1, 1]) {
    dragonBeam(b, [side * 0.63, -0.22, 0.7], [side * 1.23, -1.05, 1.44], 0.4, 0.28, p.skin);
    dragonBeam(b, [side * 1.23, -1.05, 1.44], [side * 0.94, -1.66, 0.87], 0.25, 0.17, p.dark);
    dragonBeam(b, [side * 0.94, -1.66, 0.87], [side * 0.96, -1.76, 1.57], 0.18, 0.15, p.skin);
    for (let claw = -1; claw <= 1; claw++) {
      const x = side * 0.96 + claw * 0.15;
      dragonBeam(b, [x, -1.74, 1.5], [x, -1.95, 1.92], 0.075, 0.012, p.horn);
    }
  }
  geos.hips = dragonFinishGeometry(b);

  geos.neck = [];
  for (let i = 0; i < 2; i++) {
    b = dragonGeometryBuilder();
    const rings = i === 0
      ? [[-1.6, 0.59, 0.62, 0.34], [-0.7, 0.72, 0.71, 0.1], [0.3, 0.93, 0.9, 0]]
      : [[-1.35, 0.43, 0.47, 0.15], [-0.5, 0.52, 0.55, 0.1], [0.18, 0.63, 0.65, 0]];
    dragonTaper(b, rings, p.skin, p.belly);
    dragonBeam(b, [0, i ? 0.68 : 0.88, -0.65], [0, (i ? 0.68 : 0.88) + 0.48 * p.crest, -0.27], 0.17, 0.014, p.spine);
    geos.neck.push(dragonFinishGeometry(b));
  }

  b = dragonGeometryBuilder();
  const eyes = dragonGeometryBuilder();
  dragonTaper(b, [[-1.05, 0.62, 0.51, 0], [0.12, 0.81, 0.59, 0], [0.68, 0.62, 0.46, 0]], p.skin, p.belly);
  dragonTaper(b, [[-2.13, 0.4, 0.23, -0.18], [-1.6, 0.52, 0.33, -0.12], [-0.8, 0.67, 0.4, -0.02]], p.skin, p.belly);
  for (const side of [-1, 1]) {
    dragonBox(b, p.dark, side * 0.75, 0.18, -0.6, 0.15, 0.35, 0.54);
    dragonBox(eyes, p.eye, side * 0.833, 0.18, -0.64, 0.032, 0.23, 0.39);
    dragonBox(eyes, 0x201b24, side * 0.855, 0.18, -0.69, 0.018, 0.2, 0.075);
    dragonBox(eyes, 0xfff3d2, side * 0.857, 0.24, -0.77, 0.018, 0.06, 0.06);
    dragonBeam(b, [side * 0.72, 0.39, -0.94], [side * 0.87, 0.47, -0.32], 0.13, 0.15, p.dark);
    dragonBox(b, p.dark, side * 0.28, -0.07, -2.145, 0.15, 0.11, 0.038);
    const hornElbow = [side * 0.9, 0.64 + 0.87 * p.hornLength, 0.53];
    dragonBeam(b, [side * 0.53, 0.49, 0.12], hornElbow, 0.23, 0.13, p.horn);
    dragonBeam(b, hornElbow, [side * 1.05, 0.64 + 1.18 * p.hornLength, 1.32], 0.13, 0.014, p.horn);
    dragonBeam(b, [side * 0.67, -0.12, 0.26], [side * 1.25, 0.13, 0.99], 0.16, 0.014, p.horn);
    dragonBeam(b, [side * 0.43, -0.34, -1.33], [side * 0.42, -0.67, -1.36], 0.078, 0.012, p.horn);
  }
  dragonBeam(b, [0, 0.5, -0.15], [0, 0.5 + 0.45 * p.crest, 0.29], 0.21, 0.014, p.spine);
  geos.head = dragonFinishGeometry(b);
  geos.eyes = dragonFinishGeometry(eyes);
  b = dragonGeometryBuilder();
  dragonTaper(b, [[-1.92, 0.38, 0.12, -0.05], [-1.45, 0.47, 0.14, 0], [0.22, 0.55, 0.18, 0]], p.belly, p.belly);
  dragonBox(b, p.dark, 0, 0.135, -0.86, 0.76, 0.055, 1.92);
  geos.jaw = dragonFinishGeometry(b);

  geos.tail = [];
  for (let i = 0; i < DRAGON_TAIL_LENGTHS.length; i++) {
    b = dragonGeometryBuilder();
    const length = DRAGON_TAIL_LENGTHS[i], radius = 0.54 * Math.pow(0.77, i);
    dragonTaper(b, [[-0.12, radius, radius * 0.92, 0], [length + 0.09, radius * 0.77, radius * 0.71, 0]], p.skin, p.belly);
    if (i < 5) dragonBeam(b, [0, radius * 0.85, length * 0.3], [0, radius + 0.32 * p.crest * (1 - i * 0.13), length * 0.65], radius * 0.38, 0.012, p.spine);
    if (i === DRAGON_TAIL_LENGTHS.length - 1) {
      dragonTaper(b, [[length - 0.2, 0.1, 0.1, 0], [length + 0.3, 0.57 * p.fin, 0.17, 0], [length + 1.15, 0.014, 0.014, 0]], p.spine, p.wing);
    }
    geos.tail.push(dragonFinishGeometry(b));
  }

  // A broad scalloped silhouette, not thin sticks: 22–27 blocks of wingspan.
  // The shared upper/outer seam lies on the outer pivot's Z hinge axis.
  b = dragonGeometryBuilder();
  const innerEdge = [[0, 0, 0], [3.65, 0, -0.15], [3.65, 0, 3.4], [1.85, -0.06, 3.05], [-0.36, 0, 3.9]];
  const innerCenter = [1.55, -0.22, 1.55];
  for (let i = 0; i < innerEdge.length; i++) {
    dragonTriangle(b, innerCenter, innerEdge[i], innerEdge[(i + 1) % innerEdge.length], i % 2 ? p.wingDark : p.wing);
  }
  geos.upperMembrane = dragonFinishGeometry(b);
  b = dragonGeometryBuilder();
  dragonBeam(b, [0, 0, 0], [1.95, 0.14, -0.43], 0.26, 0.2, p.skin);
  dragonBeam(b, [1.95, 0.14, -0.43], [3.65, 0, -0.15], 0.2, 0.15, p.skin);
  dragonBeam(b, [3.65, 0, -0.15], [3.65, 0, 3.4], 0.115, 0.038, p.dark);
  dragonBeam(b, [0, 0, 0], [-0.3, 0, 3.85], 0.13, 0.04, p.dark);
  geos.upperBones = dragonFinishGeometry(b);
  b = dragonGeometryBuilder();
  const outerEdge = [[3.3, 0.1, -0.95], [6.7, 0, -0.3], [4.7, -0.08, 1.35], [4.55, 0, 3.3],
    [3, -0.1, 2.45], [2.3, 0, 4.55], [1.1, -0.06, 3.2], [0, 0, 3.55]];
  for (let i = 0; i < outerEdge.length - 1; i++) {
    dragonTriangle(b, [0, 0, 0], outerEdge[i], outerEdge[i + 1], i % 2 ? p.wingDark : p.wing, i === 0 ? 1.08 : 1);
  }
  geos.outerMembrane = dragonFinishGeometry(b);
  b = dragonGeometryBuilder();
  dragonBeam(b, [0, 0, 0], outerEdge[0], 0.16, 0.11, p.skin);
  dragonBeam(b, outerEdge[0], outerEdge[1], 0.11, 0.018, p.dark);
  dragonBeam(b, [0, 0, 0], outerEdge[3], 0.11, 0.025, p.dark);
  dragonBeam(b, [0, 0, 0], outerEdge[5], 0.1, 0.018, p.dark);
  dragonBeam(b, [0, 0, 0], [0.3, 0.27, -0.78], 0.12, 0.07, p.horn);
  dragonBeam(b, [0.3, 0.27, -0.78], [0.47, 0.08, -1.25], 0.07, 0.012, p.horn);
  geos.outerBones = dragonFinishGeometry(b);
  DRAGON_GEOMETRIES.set(key, geos);
  return geos;
}

function dragonStaticMesh(parent, geometry, material, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  // All vertex transforms were baked above. Only joint groups need local updates.
  mesh.matrixAutoUpdate = false;
  parent.add(mesh);
  return mesh;
}

/* Optional inspection factory, like makeChicken(): returns an unattached Group.
   A palette may override DRAGON_PALETTES[0]; animated joints are in userData.parts. */
function makeDragon(palette) {
  const p = Object.assign({}, DRAGON_PALETTES[0], palette);
  const geos = dragonBuildGeometries(p);
  const group = new THREE.Group();
  group.name = 'dragon-' + p.name;
  group.rotation.order = 'YXZ';
  const parts = { hips: new THREE.Group(), neck: [], head: new THREE.Group(), jaw: new THREE.Group(), tail: [], wings: [] };
  dragonStaticMesh(group, geos.body, DRAGON_MATERIALS.solid, 'chest-forelegs-spines');
  parts.hips.position.set(0, -0.1, 1.55);
  group.add(parts.hips);
  dragonStaticMesh(parts.hips, geos.hips, DRAGON_MATERIALS.solid, 'haunches-hindlegs');
  let parent = group;
  for (let i = 0; i < 2; i++) {
    const neck = new THREE.Group();
    neck.position.set(0, i ? 0.34 : 0.25, i ? -1.45 : -2.5);
    parent.add(neck);
    dragonStaticMesh(neck, geos.neck[i], DRAGON_MATERIALS.solid, 'neck-' + i);
    parts.neck.push(neck);
    parent = neck;
  }
  parts.head.position.set(0, 0.15, -1.2);
  parent.add(parts.head);
  dragonStaticMesh(parts.head, geos.head, DRAGON_MATERIALS.solid, 'head-snout-horns');
  dragonStaticMesh(parts.head, geos.eyes, DRAGON_MATERIALS.eyes, 'eyes');
  parts.jaw.position.set(0, -0.53, -0.28);
  parts.head.add(parts.jaw);
  dragonStaticMesh(parts.jaw, geos.jaw, DRAGON_MATERIALS.solid, 'jaw');
  parent = parts.hips;
  for (let i = 0; i < DRAGON_TAIL_LENGTHS.length; i++) {
    const tail = new THREE.Group();
    tail.position.set(0, i ? 0 : -0.03, i ? DRAGON_TAIL_LENGTHS[i - 1] : 1.78);
    parent.add(tail);
    dragonStaticMesh(tail, geos.tail[i], DRAGON_MATERIALS.solid, 'tail-' + i);
    parts.tail.push(tail);
    parent = tail;
  }
  for (const side of [-1, 1]) {
    const upper = new THREE.Group(), outer = new THREE.Group();
    upper.position.set(side * 1.1, 0.55, -1.5);
    upper.scale.x = side * p.span;
    outer.position.set(3.65, 0, -0.15);
    group.add(upper);
    upper.add(outer);
    dragonStaticMesh(upper, geos.upperMembrane, DRAGON_MATERIALS.membrane, 'upper-membrane');
    dragonStaticMesh(upper, geos.upperBones, DRAGON_MATERIALS.solid, 'upper-wing-bones');
    dragonStaticMesh(outer, geos.outerMembrane, DRAGON_MATERIALS.membrane, 'outer-membrane');
    dragonStaticMesh(outer, geos.outerBones, DRAGON_MATERIALS.solid, 'outer-wing-fingers');
    parts.wings.push({ upper, outer, side });
  }
  group.userData = { kind: 'dragon', ambient: true, palette: p.name, parts };
  // Keep node references private, not a cyclic root reference in userData.
  // Cached bounds describe only solid body sections, never wing/tail meshes.
  DRAGON_BODY_SHAPES.set(group, [
      { node: group, bounds: geos.body.boundingBox },
      { node: parts.hips, bounds: geos.hips.boundingBox },
      { node: parts.neck[0], bounds: geos.neck[0].boundingBox },
      { node: parts.neck[1], bounds: geos.neck[1].boundingBox },
      { node: parts.head, bounds: geos.head.boundingBox },
      { node: parts.jaw, bounds: geos.jaw.boundingBox }
    ]);
  return group;
}

/* ---------------- pooled solid-body queries ---------------- */
const DRAGON_COLLIDER_EPS = 0.00001;
const DRAGON_COLLIDERS = [];
const DRAGON_BODY_SHAPES = new WeakMap();
const DRAGON_SWEEP_BOX = { x: 0, y: 0, z: 0, w: 0, h: 0 };
const DRAGON_RAY_SCRATCH = { normalX: 0, normalY: 0, normalZ: 0 };
const DRAGON_RAY_HIT = { distance: 0, index: -1, dragon: null,
  point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 } };
const DRAGON_RIDER_BOUNDS = {
  min: { x: -0.65, y: -0.05, z: -0.95 },
  max: { x: 0.65, y: 2.65, z: 0.6 }
};

function dragonColliderRecord(index) {
  let record = DRAGON_COLLIDERS[index];
  if (record) return record;
  record = { index, dragon: null, active: false, revision: 0, notifiedRevision: 0,
    x: 0, y: 0, z: 0, w: 0, h: 0, halfX: 0, halfZ: 0,
    minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0,
    type: '', role: '', rideable: false, indestructible: false, invulnerable: false,
    rootX: 0, rootY: 0, rootZ: 0, rootQX: 0, rootQY: 0, rootQZ: 0, rootQW: 1,
    parts: [], partCount: 0, view: null, change: null };
  // Six articulated body sections, a private saddle and an unscaled rider.
  for (let i = 0; i < 8; i++) record.parts.push({ minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 });
  record.view = { index, dragon: null, active: false, revision: 0,
    x: 0, y: 0, z: 0, w: 0, h: 0, halfX: 0, halfZ: 0,
    minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0,
    type: '', role: '', rideable: false, indestructible: false, invulnerable: false };
  record.change = { index, dragon: null, collider: record.view, revision: 0 };
  DRAGON_COLLIDERS[index] = record;
  return record;
}

function dragonTransformBounds(node, bounds, out, rider) {
  const e = node.matrixWorld.elements;
  let cx = (bounds.min.x + bounds.max.x) * 0.5;
  let cy = (bounds.min.y + bounds.max.y) * 0.5;
  let cz = (bounds.min.z + bounds.max.z) * 0.5;
  const hx = (bounds.max.x - bounds.min.x) * 0.5;
  const hy = (bounds.max.y - bounds.min.y) * 0.5;
  const hz = (bounds.max.z - bounds.min.z) * 0.5;
  let sx = 1, sy = 1, sz = 1;
  if (rider) {
    // The saddle inherits dragon scale, the seated humanoid never does.
    sx = 1 / Math.abs(node.scale.x); sy = 1 / Math.abs(node.scale.y); sz = 1 / Math.abs(node.scale.z);
    cx += rider.saddleOffset.x * Math.abs(node.scale.x);
    cy += rider.saddleOffset.y * Math.abs(node.scale.y) - 0.64;
    cz += rider.saddleOffset.z * Math.abs(node.scale.z);
  }
  const m0 = e[0] * sx, m1 = e[1] * sx, m2 = e[2] * sx;
  const m4 = e[4] * sy, m5 = e[5] * sy, m6 = e[6] * sy;
  const m8 = e[8] * sz, m9 = e[9] * sz, m10 = e[10] * sz;
  const x = m0 * cx + m4 * cy + m8 * cz + e[12];
  const y = m1 * cx + m5 * cy + m9 * cz + e[13];
  const z = m2 * cx + m6 * cy + m10 * cz + e[14];
  const wx = Math.abs(m0) * hx + Math.abs(m4) * hy + Math.abs(m8) * hz;
  const wy = Math.abs(m1) * hx + Math.abs(m5) * hy + Math.abs(m9) * hz;
  const wz = Math.abs(m2) * hx + Math.abs(m6) * hy + Math.abs(m10) * hz;
  const changed = Math.abs(out.minX - (x - wx)) > DRAGON_COLLIDER_EPS || Math.abs(out.maxX - (x + wx)) > DRAGON_COLLIDER_EPS ||
    Math.abs(out.minY - (y - wy)) > DRAGON_COLLIDER_EPS || Math.abs(out.maxY - (y + wy)) > DRAGON_COLLIDER_EPS ||
    Math.abs(out.minZ - (z - wz)) > DRAGON_COLLIDER_EPS || Math.abs(out.maxZ - (z + wz)) > DRAGON_COLLIDER_EPS;
  out.minX = x - wx; out.maxX = x + wx;
  out.minY = y - wy; out.maxY = y + wy;
  out.minZ = z - wz; out.maxZ = z + wz;
  return changed;
}

function dragonSyncCollider(dragon, notify = true) {
  if (!dragon || !dragon.group || !Number.isInteger(dragon.index) || dragons[dragon.index] !== dragon) return null;
  const group = dragon.group, record = dragonColliderRecord(dragon.index);
  if (group.parent !== scene || !Number.isFinite(group.position.x + group.position.y + group.position.z) ||
      !(group.scale.x > 0 && group.scale.y > 0 && group.scale.z > 0)) {
    record.active = false;
    record.view.active = false;
    return null;
  }
  const shapes = DRAGON_BODY_SHAPES.get(group);
  if (!shapes || !shapes.length) return null;
  group.updateWorldMatrix(true, false);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let count = shapes.length, partsChanged = false;
  for (let i = 0; i < count; i++) {
    const shape = shapes[i], part = record.parts[i];
    if (shape.node !== group) shape.node.updateWorldMatrix(false, false);
    partsChanged = dragonTransformBounds(shape.node, shape.bounds, part, null) || partsChanged;
  }
  if (dragon.saddle && dragon.saddle.userData.geometry) {
    dragon.saddle.updateWorldMatrix(false, false);
    partsChanged = dragonTransformBounds(dragon.saddle, dragon.saddle.userData.geometry.boundingBox, record.parts[count++], null) || partsChanged;
  }
  if (dragon.type === 'mount' && group.userData.riderId) {
    partsChanged = dragonTransformBounds(group, DRAGON_RIDER_BOUNDS, record.parts[count++], dragon) || partsChanged;
  }
  for (let i = 0; i < count; i++) {
    const part = record.parts[i];
    minX = Math.min(minX, part.minX); minY = Math.min(minY, part.minY); minZ = Math.min(minZ, part.minZ);
    maxX = Math.max(maxX, part.maxX); maxY = Math.max(maxY, part.maxY); maxZ = Math.max(maxZ, part.maxZ);
  }
  if (!Number.isFinite(minX + minY + minZ + maxX + maxY + maxZ)) {
    record.active = record.view.active = false;
    return null;
  }
  const changed = partsChanged || !record.active || record.dragon !== dragon || record.partCount !== count ||
    Math.abs(record.minX - minX) > DRAGON_COLLIDER_EPS || Math.abs(record.minY - minY) > DRAGON_COLLIDER_EPS ||
    Math.abs(record.minZ - minZ) > DRAGON_COLLIDER_EPS || Math.abs(record.maxX - maxX) > DRAGON_COLLIDER_EPS ||
    Math.abs(record.maxY - maxY) > DRAGON_COLLIDER_EPS || Math.abs(record.maxZ - maxZ) > DRAGON_COLLIDER_EPS;
  record.dragon = dragon; record.active = true; record.partCount = count;
  record.rootX = group.position.x; record.rootY = group.position.y; record.rootZ = group.position.z;
  record.rootQX = group.quaternion.x; record.rootQY = group.quaternion.y;
  record.rootQZ = group.quaternion.z; record.rootQW = group.quaternion.w;
  record.minX = minX; record.minY = minY; record.minZ = minZ;
  record.maxX = maxX; record.maxY = maxY; record.maxZ = maxZ;
  record.x = (minX + maxX) * 0.5; record.y = minY; record.z = (minZ + maxZ) * 0.5;
  record.halfX = (maxX - minX) * 0.5; record.halfZ = (maxZ - minZ) * 0.5;
  record.w = Math.max(record.halfX, record.halfZ); record.h = maxY - minY;
  record.type = dragon.type; record.role = dragon.role; record.rideable = dragon.rideable === true;
  record.indestructible = dragon.indestructible === true; record.invulnerable = dragon.invulnerable === true;
  if (changed) {
    record.revision++;
  }
  dragonCopyCollider(record, record.view);
  if (notify && record.notifiedRevision !== record.revision && typeof BC !== 'undefined' && typeof BC.emit === 'function') {
    record.notifiedRevision = record.revision;
    record.change.dragon = dragon; record.change.revision = record.revision;
    BC.emit('dragonCollidersChanged', record.change);
  }
  return record;
}

function dragonLiveCollider(index) {
  const record = DRAGON_COLLIDERS[index];
  if (!record || !record.active || record.dragon !== dragons[index] || record.dragon.group.parent !== scene || record.dragon.down) return null;
  const group = record.dragon.group, p = group.position, q = group.quaternion;
  if (record.rootX !== p.x || record.rootY !== p.y || record.rootZ !== p.z ||
      record.rootQX !== q.x || record.rootQY !== q.y || record.rootQZ !== q.z || record.rootQW !== q.w) {
    return dragonSyncCollider(record.dragon, false);
  }
  return record;
}

function dragonGetCollider(index, out) {
  if (!Number.isInteger(index) || index < 0) return null;
  const dragon = dragons[index];
  const record = dragon ? dragonSyncCollider(dragon, false) : null;
  if (!record) return null;
  return out ? dragonCopyCollider(record, out) : record.view;
}

function dragonCopyCollider(record, out) {
  out.index = record.index; out.dragon = record.dragon;
  out.x = record.x; out.y = record.y; out.z = record.z; out.w = record.w; out.h = record.h;
  out.halfX = record.halfX; out.halfZ = record.halfZ;
  out.minX = record.minX; out.minY = record.minY; out.minZ = record.minZ;
  out.maxX = record.maxX; out.maxY = record.maxY; out.maxZ = record.maxZ;
  out.type = record.type; out.role = record.role; out.rideable = record.rideable;
  out.indestructible = record.indestructible; out.invulnerable = record.invulnerable;
  out.active = record.active; out.revision = record.revision;
  return out;
}

function dragonValidBox(box) {
  return !!box && Number.isFinite(box.x) && Number.isFinite(box.y) && Number.isFinite(box.z) &&
    Number.isFinite(box.w) && Number.isFinite(box.h) && box.w > 0 && box.h > 0;
}

function dragonIgnoreIndex(box, ignoreIndex) {
  return Number.isInteger(ignoreIndex) ? ignoreIndex : box && Number.isInteger(box.ignoreDragonIndex) ? box.ignoreDragonIndex : -1;
}

function dragonBoxIntersects(box, part) {
  return box.x + box.w > part.minX + DRAGON_COLLIDER_EPS && box.x - box.w < part.maxX - DRAGON_COLLIDER_EPS &&
    box.y + box.h > part.minY + DRAGON_COLLIDER_EPS && box.y < part.maxY - DRAGON_COLLIDER_EPS &&
    box.z + box.w > part.minZ + DRAGON_COLLIDER_EPS && box.z - box.w < part.maxZ - DRAGON_COLLIDER_EPS;
}

function dragonOverlapsAabb(box, ignoreIndex) {
  if (!dragonValidBox(box)) return false;
  const ignored = dragonIgnoreIndex(box, ignoreIndex);
  for (let i = 0; i < dragons.length; i++) {
    if (i === ignored) continue;
    const record = dragonLiveCollider(i);
    if (!record || !dragonBoxIntersects(box, record)) continue;
    for (let p = 0; p < record.partCount; p++) if (dragonBoxIntersects(box, record.parts[p])) return true;
  }
  return false;
}

// Entirely independent of the physics wrapper. 22-physics composes this sweep
// with voxel sweeps; calling that wrapper from here would recurse.
function dragonSweepAxis(box, axis, amount, ignored) {
  if (!Number.isFinite(amount)) return true;
  if (!amount) return false;
  const positive = amount > 0;
  const edge = box[axis] + (axis === 'y' ? positive ? box.h : 0 : positive ? box.w : -box.w);
  let allowed = amount;
  for (let i = 0; i < dragons.length; i++) {
    if (i === ignored) continue;
    const record = dragonLiveCollider(i);
    if (!record) continue;
    for (let p = 0; p < record.partCount; p++) {
      const part = record.parts[p];
      if (axis !== 'x' && (box.x + box.w <= part.minX + DRAGON_COLLIDER_EPS || box.x - box.w >= part.maxX - DRAGON_COLLIDER_EPS) ||
          axis !== 'y' && (box.y + box.h <= part.minY + DRAGON_COLLIDER_EPS || box.y >= part.maxY - DRAGON_COLLIDER_EPS) ||
          axis !== 'z' && (box.z + box.w <= part.minZ + DRAGON_COLLIDER_EPS || box.z - box.w >= part.maxZ - DRAGON_COLLIDER_EPS)) continue;
      const face = axis === 'x' ? positive ? part.minX : part.maxX :
        axis === 'y' ? positive ? part.minY : part.maxY : positive ? part.minZ : part.maxZ;
      const gap = face - edge;
      if (positive && gap >= -DRAGON_COLLIDER_EPS && gap < allowed) allowed = Math.max(0, gap);
      else if (!positive && gap <= DRAGON_COLLIDER_EPS && gap > allowed) allowed = Math.min(0, gap);
    }
  }
  box[axis] += allowed;
  return Math.abs(allowed - amount) > DRAGON_COLLIDER_EPS;
}

function dragonSweepAabb(box, dx, dy, dz, out, ignoreIndex) {
  const result = out || {}, scratch = DRAGON_SWEEP_BOX;
  scratch.x = box && Number.isFinite(box.x) ? box.x : 0;
  scratch.y = box && Number.isFinite(box.y) ? box.y : 0;
  scratch.z = box && Number.isFinite(box.z) ? box.z : 0;
  scratch.w = dragonValidBox(box) ? box.w : 0;
  scratch.h = dragonValidBox(box) ? box.h : 0;
  const ignored = dragonIgnoreIndex(box, ignoreIndex), valid = dragonValidBox(box);
  const hitY = valid ? dragonSweepAxis(scratch, 'y', dy, ignored) : true;
  const hitX = valid ? dragonSweepAxis(scratch, 'x', dx, ignored) : true;
  const hitZ = valid ? dragonSweepAxis(scratch, 'z', dz, ignored) : true;
  result.x = scratch.x; result.y = scratch.y; result.z = scratch.z;
  result.hitX = hitX; result.hitY = hitY; result.hitZ = hitZ;
  return result;
}

function dragonRayBounds(origin, dx, dy, dz, maxDistance, part) {
  let near = 0, far = maxDistance, normalX = 0, normalY = 0, normalZ = 0;
  for (let axis = 0; axis < 3; axis++) {
    const position = axis === 0 ? origin.x : axis === 1 ? origin.y : origin.z;
    const direction = axis === 0 ? dx : axis === 1 ? dy : dz;
    const min = axis === 0 ? part.minX : axis === 1 ? part.minY : part.minZ;
    const max = axis === 0 ? part.maxX : axis === 1 ? part.maxY : part.maxZ;
    if (Math.abs(direction) < 1e-10) { if (position < min || position > max) return -1; continue; }
    let enter = (min - position) / direction, exit = (max - position) / direction;
    if (enter > exit) { const swap = enter; enter = exit; exit = swap; }
    if (enter > near) {
      near = enter;
      normalX = axis === 0 ? direction > 0 ? -1 : 1 : 0;
      normalY = axis === 1 ? direction > 0 ? -1 : 1 : 0;
      normalZ = axis === 2 ? direction > 0 ? -1 : 1 : 0;
    }
    far = Math.min(far, exit);
    if (near > far || far < 0) return -1;
  }
  DRAGON_RAY_SCRATCH.normalX = normalX; DRAGON_RAY_SCRATCH.normalY = normalY; DRAGON_RAY_SCRATCH.normalZ = normalZ;
  return near;
}

function dragonRaycast(origin, direction, maxDistance, ignoreIndex) {
  if (!origin || !direction || !Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z) ||
      !Number.isFinite(direction.x) || !Number.isFinite(direction.y) || !Number.isFinite(direction.z) ||
      !Number.isFinite(maxDistance) || maxDistance < 0) return null;
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (!Number.isFinite(length) || length < 1e-10) return null;
  const dx = direction.x / length, dy = direction.y / length, dz = direction.z / length;
  let closest = maxDistance, found = false;
  for (let i = 0; i < dragons.length; i++) {
    if (i === ignoreIndex) continue;
    const record = dragonLiveCollider(i);
    if (!record || dragonRayBounds(origin, dx, dy, dz, closest, record) < 0) continue;
    for (let p = 0; p < record.partCount; p++) {
      const distance = dragonRayBounds(origin, dx, dy, dz, closest, record.parts[p]);
      if (distance < 0 || found && distance >= closest) continue;
      found = true; closest = distance;
      DRAGON_RAY_HIT.distance = distance; DRAGON_RAY_HIT.index = i; DRAGON_RAY_HIT.dragon = record.dragon;
      DRAGON_RAY_HIT.normal.x = DRAGON_RAY_SCRATCH.normalX;
      DRAGON_RAY_HIT.normal.y = DRAGON_RAY_SCRATCH.normalY;
      DRAGON_RAY_HIT.normal.z = DRAGON_RAY_SCRATCH.normalZ;
    }
  }
  if (!found) return null;
  DRAGON_RAY_HIT.point.x = origin.x + dx * closest;
  DRAGON_RAY_HIT.point.y = origin.y + dy * closest;
  DRAGON_RAY_HIT.point.z = origin.z + dz * closest;
  return DRAGON_RAY_HIT;
}

if (typeof BC !== 'undefined' && BC.api) {
  BC.api.dragons = { getCollider: dragonGetCollider, overlapsAabb: dragonOverlapsAabb,
    sweepAabb: dragonSweepAabb, raycast: dragonRaycast };
}

/* ---------------- terrain-safe, deterministic flight ---------------- */
const DRAGON_MOTION_STEP = 0.4;
const DRAGON_MOTION_STEPS = 12;
const DRAGON_RETURN_SPEED = 12;
const DRAGON_MOUNT_TRIES = 16;

function dragonVoxelPhysics() {
  const physics = typeof BC !== 'undefined' && BC.api ? BC.api.physics : null;
  return physics && (typeof physics.sweepVoxels === 'function' || typeof physics.sweepAabb === 'function') ? physics : null;
}

function dragonPartBox(part, motion, box, index) {
  box.x = (part.minX + part.maxX) * 0.5 + motion.dx;
  box.y = part.minY + motion.dy;
  box.z = (part.minZ + part.maxZ) * 0.5 + motion.dz;
  box.w = Math.max(part.maxX - part.minX, part.maxZ - part.minZ) * 0.5;
  box.h = part.maxY - part.minY;
  box.ignoreDragonIndex = index;
  return box;
}

function dragonVoxelBoxClear(box, physics) {
  if (!dragonValidBox(box)) return false;
  if (physics && typeof physics.overlapsVoxels === 'function') return !physics.overlapsVoxels(box);
  // solidAt remains the physics API's voxel-only primitive. Never invoke the
  // dynamic overlaps wrapper while posing our own collider.
  if ((!physics || typeof physics.solidAt !== 'function') && typeof getBlock !== 'function') return false;
  for (let x = Math.floor(box.x - box.w + DRAGON_COLLIDER_EPS); x <= Math.floor(box.x + box.w - DRAGON_COLLIDER_EPS); x++) {
    for (let y = Math.floor(box.y + DRAGON_COLLIDER_EPS); y <= Math.floor(box.y + box.h - DRAGON_COLLIDER_EPS); y++) {
      for (let z = Math.floor(box.z - box.w + DRAGON_COLLIDER_EPS); z <= Math.floor(box.z + box.w - DRAGON_COLLIDER_EPS); z++) {
        if (physics && typeof physics.solidAt === 'function') { if (physics.solidAt(x, y, z)) return false; }
        else { const block = getBlock(x, y, z); if (block !== AIR && block !== WATER) return false; }
      }
    }
  }
  return true;
}

function dragonBodyVoxelsClear(dragon, record, physics) {
  const motion = dragon.motion;
  for (let i = 0; i < record.partCount; i++) {
    if (!dragonVoxelBoxClear(dragonPartBox(record.parts[i], motion, motion.box, dragon.index), physics)) return false;
  }
  return true;
}

function dragonSaveBodyPose(dragon) {
  const shapes = DRAGON_BODY_SHAPES.get(dragon.group), saved = dragon.motion.savedPose;
  for (let i = 0; i < shapes.length; i++) {
    const rotation = shapes[i].node.rotation;
    saved[i * 3] = rotation.x; saved[i * 3 + 1] = rotation.y; saved[i * 3 + 2] = rotation.z;
  }
}

function dragonRestoreBodyPose(dragon) {
  const shapes = DRAGON_BODY_SHAPES.get(dragon.group), saved = dragon.motion.savedPose;
  for (let i = 0; i < shapes.length; i++) {
    shapes[i].node.rotation.set(saved[i * 3], saved[i * 3 + 1], saved[i * 3 + 2]);
  }
}

function dragonAmbientAxis(dragon, record, physics, axis, amount) {
  if (!amount) return 0;
  const motion = dragon.motion, box = motion.box, out = motion.sweep;
  let allowed = amount;
  for (let i = 0; i < record.partCount; i++) {
    dragonPartBox(record.parts[i], motion, box, dragon.index);
    const sweep = typeof physics.sweepVoxels === 'function' ? physics.sweepVoxels : physics.sweepAabb;
    sweep.call(physics, box, axis === 'x' ? allowed : 0, axis === 'y' ? allowed : 0, axis === 'z' ? allowed : 0, out);
    const moved = out[axis] - box[axis];
    if (!Number.isFinite(moved)) { allowed = 0; break; }
    allowed = amount > 0 ? Math.max(0, Math.min(allowed, moved)) : Math.min(0, Math.max(allowed, moved));
    if (!allowed) break;
  }
  if (Math.abs(allowed - amount) > DRAGON_COLLIDER_EPS) motion.blocked = true;
  if (axis === 'x') motion.dx += allowed;
  else if (axis === 'y') motion.dy += allowed;
  else motion.dz += allowed;
  return allowed;
}

function dragonMoveAmbient(dragon, seconds) {
  const motion = dragon.motion, position = dragon.group.position, physics = dragonVoxelPhysics();
  const elapsed = Math.max(0, Math.min(0.05, seconds - motion.lastSeconds));
  motion.lastSeconds = seconds;
  if (!physics) { dragonRestoreBodyPose(dragon); dragonSyncCollider(dragon); return; }
  motion.dx = motion.dy = motion.dz = 0;
  motion.blocked = false;
  let record = dragonSyncCollider(dragon, false);
  if (!record) return;
  if (!dragonBodyVoxelsClear(dragon, record, physics)) {
    // Rotation/jaw/neck posing cannot grow the body into a builder's wall.
    dragonRestoreBodyPose(dragon);
    record = dragonSyncCollider(dragon, false);
    motion.blocked = true;
    if (!record || !dragonBodyVoxelsClear(dragon, record, physics)) {
      motion.perched = true; dragon.routeReady = false; dragonSyncCollider(dragon); return;
    }
  }
  const clockBucket = Math.floor(seconds / 2);
  if (motion.perched && clockBucket >= motion.retryBucket) motion.perched = false;
  if (motion.perched || motion.blocked) motion.wanted.copy(motion.home);
  else motion.wanted.copy(motion.target);
  let dx = motion.wanted.x - position.x, dy = motion.wanted.y - position.y, dz = motion.wanted.z - position.z;
  let distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance)) { dragonRestoreBodyPose(dragon); dragonSyncCollider(dragon); return; }
  // Normal analytic flight fits this envelope. A long tab pause, blocked loop
  // or expired distant lease cannot turn a capped frame into a sky teleport.
  const cap = Math.min(DRAGON_MOTION_STEP * DRAGON_MOTION_STEPS, DRAGON_RETURN_SPEED * elapsed);
  if (distance > cap) { const scale = cap / distance; dx *= scale; dy *= scale; dz *= scale; distance = cap; }
  const steps = distance > DRAGON_COLLIDER_EPS ? Math.min(DRAGON_MOTION_STEPS, Math.ceil(distance / DRAGON_MOTION_STEP)) : 0;
  for (let step = 0; step < steps; step++) {
    dragonAmbientAxis(dragon, record, physics, 'y', dy / steps);
    dragonAmbientAxis(dragon, record, physics, 'x', dx / steps);
    dragonAmbientAxis(dragon, record, physics, 'z', dz / steps);
  }
  if (!dragonBodyVoxelsClear(dragon, record, physics)) {
    // Raced live edits fail closed; never carve cover or jump to a clear sample.
    motion.dx = motion.dy = motion.dz = 0;
    dragonRestoreBodyPose(dragon);
    motion.blocked = true;
  }
  position.x += motion.dx; position.y += motion.dy; position.z += motion.dz;
  if (motion.blocked) {
    // A fixed, seed/terrain-defined home is the bounded fallback, not a new
    // per-peer orbit integrator. Retry against the common two-second clock.
    motion.perched = true; motion.retryBucket = clockBucket + 1;
  }
  // The tiny mount yard is always inside the authority's existing root range.
  // After a lease ends far away, suppress the prompt until the swept return is
  // back in that range; class eligibility itself never changes.
  dragon.routeReady = dragon.type !== 'mount' || position.distanceToSquared(motion.target) <= 81;
  dragonSyncCollider(dragon);
}

function dragonResumeAmbient(dragon) {
  if (!dragon || !dragon.motion) return;
  dragon.motion.perched = false;
  dragon.motion.retryBucket = 0;
  dragon.routeReady = dragon.type !== 'mount' || dragon.group.position.distanceToSquared(dragon.motion.target) <= 81;
  dragonSyncCollider(dragon);
}

function dragonOrbitAltitude(orbit, size, heights) {
  // Cover the whole orbit AND the entire swept model, rather than merely its
  // centerline. One boot-time scan also covers hills between path samples.
  const reach = 16 * size;
  const extentX = Math.hypot(orbit.rx * orbit.cos, orbit.rz * orbit.sin) + reach;
  const extentZ = Math.hypot(orbit.rx * orbit.sin, orbit.rz * orbit.cos) + reach;
  const x0 = Math.max(0, Math.floor(orbit.cx - extentX)), x1 = Math.min(WORLD - 1, Math.ceil(orbit.cx + extentX));
  const z0 = Math.max(0, Math.floor(orbit.cz - extentZ)), z1 = Math.min(WORLD - 1, Math.ceil(orbit.cz + extentZ));
  let highest = SEA;
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const index = x * WORLD + z;
      if (heights[index] < 0) heights[index] = terrainHeight(x, z);
      highest = Math.max(highest, heights[index]);
    }
  }
  orbit.terrainTop = highest;
  // Allow tallest generated palms/roofs (11 blocks), two blocks of air,
  // full downward wing/pose reach, and every analytic altitude excursion.
  return Math.max(orbit.altitude, highest + 13 + 11.5 * size + Math.hypot(orbit.tiltX, orbit.tiltZ) + 0.78);
}

function dragonMountAltitude(orbit, size, heights) {
  const reach = 8 * size;
  const ex = Math.hypot(orbit.rx * orbit.cos, orbit.rz * orbit.sin) + reach;
  const ez = Math.hypot(orbit.rx * orbit.sin, orbit.rz * orbit.cos) + reach;
  let highest = SEA + 1, minGround = Infinity, maxGround = SEA + 1, excess = 0;
  for (let x = Math.max(0, Math.floor(orbit.cx - ex)); x <= Math.min(WORLD - 1, Math.ceil(orbit.cx + ex)); x++) {
    for (let z = Math.max(0, Math.floor(orbit.cz - ez)); z <= Math.min(WORLD - 1, Math.ceil(orbit.cz + ez)); z++) {
      const at = x * WORLD + z;
      if (heights[at] < 0) heights[at] = terrainHeight(x, z);
      const ground = heights[at] + 1;
      minGround = Math.min(minGround, ground); maxGround = Math.max(maxGround, ground);
      let live = SEA + 1;
      for (let y = HEIGHT - 1; y >= 0; y--) {
        const block = getBlock(x, y, z);
        if (block !== AIR && block !== WATER) { live = Math.max(live, y + 1); break; }
      }
      highest = Math.max(highest, live);
      excess = Math.max(excess, live - ground);
    }
  }
  // A low hover/perch, within E range from the yard. Natural canopy/roofs make
  // a candidate expensive instead of forcing every small dragon into the sky.
  orbit.mountScore = excess * 12 + (maxGround - minGround) * 2 + Math.max(0, SEA + 2 - minGround) * 5;
  return Math.max(orbit.altitude, highest + 4.35 * size + Math.hypot(orbit.tiltX, orbit.tiltZ) + 1.25);
}

function dragonMountCenter(orbit, route, heights) {
  const sites = typeof villageSites !== 'undefined' ? villageSites : null;
  const site = sites && sites.length ? sites[route.villageSlot % sites.length] : null;
  const baseX = site ? site.x : WORLD * 0.5 + route.x;
  const baseZ = site ? site.z : WORLD * 0.5 + route.z;
  const distance = site ? route.villageDistance : 0;
  let best = Infinity, bx = baseX, bz = baseZ, by = route.altitude;
  for (let candidate = 0; candidate < DRAGON_MOUNT_TRIES; candidate++) {
    const angle = route.villageAngle + candidate * DRAGON_TAU / DRAGON_MOUNT_TRIES;
    const radius = site ? distance + (candidate > 7 ? 6 : 0) : candidate === 0 ? 0 : 4 + candidate * 2;
    orbit.cx = Math.max(route.catalog.minCX, Math.min(route.catalog.maxCX, baseX + Math.cos(angle) * radius));
    orbit.cz = Math.max(route.catalog.minCZ, Math.min(route.catalog.maxCZ, baseZ + Math.sin(angle) * radius));
    const altitude = dragonMountAltitude(orbit, route.size, heights);
    let score = orbit.mountScore + candidate * 0.015;
    for (let i = 0; i < dragons.length; i++) {
      if (dragons[i].type === 'mount' && Math.hypot(orbit.cx - dragons[i].orbit.cx, orbit.cz - dragons[i].orbit.cz) < 24) score += 1000;
    }
    if (score < best) { best = score; bx = orbit.cx; bz = orbit.cz; by = altitude; }
    if (score < 2.1) break;
  }
  orbit.cx = bx; orbit.cz = bz;
  orbit.altitude = Math.min(route.catalog.maxAltitude, by);
}

function spawnDragons() {
  if (dragons.length) return dragons;
  if (!DRAGON_RULES || typeof getBlock !== 'function') return dragons;
  dragonPruneSaddles();
  // Shared only during spawning, then collectible. No terrain queries in updates.
  const heights = new Int16Array(WORLD * WORLD);
  heights.fill(-1);
  const count = DRAGON_RULES.count(SEED);
  DRAGON_RAY_HIT.dragon = null; DRAGON_RAY_HIT.index = -1;
  for (let i = 0; i < DRAGON_COLLIDERS.length; i++) {
    DRAGON_COLLIDERS[i].active = false;
    DRAGON_COLLIDERS[i].dragon = DRAGON_COLLIDERS[i].change.dragon = null;
    DRAGON_COLLIDERS[i].view.active = false; DRAGON_COLLIDERS[i].view.dragon = null;
  }
  for (let i = 0; i < count; i++) {
    const route = DRAGON_RULES.descriptor(SEED, i);
    const orbit = Object.assign({}, route, {
      cx: WORLD / 2 + route.x, cz: WORLD / 2 + route.z,
      cos: Math.cos(route.rotation), sin: Math.sin(route.rotation),
      omega: route.direction * DRAGON_TAU / route.period
    });
    // Gently bias loops toward generated villages while keeping them in the
    // central skyline and within the world's existing fog range.
    if (route.type === 'guardian' && villageSites.length) {
      const site = villageSites[i % villageSites.length];
      orbit.cx += Math.max(-15, Math.min(15, (site.x - orbit.cx) * 0.22));
      orbit.cz += Math.max(-15, Math.min(15, (site.z - orbit.cz) * 0.22));
    }
    if (route.type === 'guardian') orbit.altitude = Math.min(route.catalog.maxAltitude, dragonOrbitAltitude(orbit, route.size, heights));
    else dragonMountCenter(orbit, route, heights);
    const group = makeDragon(DRAGON_PALETTES[route.paletteIndex]);
    group.name = 'dragon-' + route.name;
    group.scale.setScalar(route.size);
    const rideable = dragonRideableRoll(i);
    const dragon = {
      group, parts: group.userData.parts, orbit,
      index: i, seed: SEED >>> 0, descriptor: route,
      name: route.name, type: route.type, role: route.role,
      indestructible: route.indestructible, invulnerable: route.invulnerable,
      // Finite metadata; guardians have no damage/death/despawn controller.
      health: 100, maxHealth: 100, damageable: false,
      rideable,
      saddleOffset: new THREE.Vector3(0, 1.36, 0.34),
      saddlePos: dragonSaddlePos,
      mouthPos: dragonMouthPos,
      saddle: null, tag: null,
      phase: route.phase,
      flapPeriod: route.flap, glidePeriod: route.glide, swayPeriod: route.swayPeriod,
      routeReady: true,
      motion: { target: new THREE.Vector3(), wanted: new THREE.Vector3(),
        home: new THREE.Vector3(orbit.cx, orbit.altitude, orbit.cz),
        box: { x: 0, y: 0, z: 0, w: 0, h: 0, ignoreDragonIndex: i },
        sweep: { x: 0, y: 0, z: 0, hitX: false, hitY: false, hitZ: false },
        savedPose: new Float64Array(18), dx: 0, dy: 0, dz: 0,
        ready: false, blocked: false, perched: false, retryBucket: 0, lastSeconds: 0 }
    };
    group.userData.palette = route.name;
    group.userData.type = route.type; group.userData.role = route.role;
    group.userData.guardian = route.type === 'guardian';
    group.userData.indestructible = route.indestructible; group.userData.invulnerable = route.invulnerable;
    group.userData.damageable = false; group.userData.health = group.userData.maxHealth = 100;
    group.userData.dragonIndex = i;
    group.userData.rideable = rideable;
    if (rideable) {
      dragonAttachSaddle(dragon);
    }
    dragons.push(dragon);
    scene.add(group);
  }
  updateDragons(0, performance.now());
  return dragons;
}

// A shot-down dragon tumbles out of the sky, then is gone until it respawns.
function dragonPoseDown(dragon, dt) {
  const group = dragon.group;
  if (!group.visible) return;
  dragon.fall += dt;
  group.position.y -= dragon.fall * 26 * dt;
  group.rotation.x += dt * 0.9;
  group.rotation.z += dt * 0.5;
  const ground = terrainHeight(Math.floor(group.position.x), Math.floor(group.position.z)) + 1;
  if (group.position.y > ground && dragon.fall < 5) return;
  group.visible = false;
  BC.emit('sfx', { kind: 'land', position: group.position.clone(), volume: 0.9 });
}

function updateDragons(dt, now) {
  // Clock/route/phase stay absolute and seeded. Only bounded collision response
  // can delay a body; there is no free-running per-peer velocity/random route.
  if (!Number.isFinite(now)) return;
  const seconds = DRAGON_TIME_ORIGIN * 0.001 + now * 0.001;
  const motion = DRAGON_MOTION_QUERY && DRAGON_MOTION_QUERY.matches ? 0.28 : 1;
  for (let i = 0; i < dragons.length; i++) {
    const dragon = dragons[i], o = dragon.orbit, parts = dragon.parts;
    if (dragon.down) { dragonPoseDown(dragon, dt); continue; }
    const ridingApi = (typeof BC !== 'undefined' && BC.api) ? BC.api.riding : null;
    if (ridingApi && ((ridingApi.active && ridingApi.dragon === dragon) ||
        (typeof ridingApi.occupied === 'function' && ridingApi.occupied(dragon)))) {
      // An exclusive local/remote lease pauses this dragon's ambient orbit.
      // 46-riding.js applies the actual ride transform once in lateFrame.
      poseRiddenDragon(dragon, seconds);
      dragon.motion.lastSeconds = seconds;
      dragonSyncCollider(dragon);
      if (dragon.tag) dragon.tag.visible = false;
      continue;
    }
    const angle = (seconds % o.period) / o.period * DRAGON_TAU * o.direction + dragon.phase;
    const c = Math.cos(angle), s = Math.sin(angle);
    const x = o.rx * c, z = o.rz * s;
    const vx = -o.rx * s * o.omega, vz = o.rz * c * o.omega;
    const speed = Math.hypot(vx, vz);
    const worldVX = vx * o.cos - vz * o.sin, worldVZ = vx * o.sin + vz * o.cos;
    const turnRate = -o.rx * o.rz * o.omega / (o.rx * o.rx * s * s + o.rz * o.rz * c * c);
    const bank = Math.max(-0.32, Math.min(0.32, Math.atan2(speed * turnRate, 8)));

    const beat = (seconds % dragon.flapPeriod) / dragon.flapPeriod * DRAGON_TAU + dragon.phase;
    const cruise = (seconds % dragon.glidePeriod) / dragon.glidePeriod * DRAGON_TAU + dragon.phase;
    const sway = (seconds % dragon.swayPeriod) / dragon.swayPeriod * DRAGON_TAU + dragon.phase;
    let drive = Math.max(0, Math.min(1, (0.5 + 0.5 * Math.sin(cruise) - 0.28) / 0.44));
    drive = drive * drive * drive * (drive * (drive * 6 - 15) + 10);
    const stroke = Math.sin(beat + 0.18 * Math.sin(beat));
    const altitudeWave = 2 * angle + dragon.phase;
    const y = o.altitude + o.tiltX * c + o.tiltZ * s + 0.6 * Math.sin(altitudeWave) + 0.18 * drive * Math.cos(beat);
    const vy = o.omega * (-o.tiltX * s + o.tiltZ * c + 1.2 * Math.cos(altitudeWave));
    const pitch = Math.atan2(vy, speed);
    if (dragon.motion.ready) dragonSaveBodyPose(dragon);
    dragon.motion.target.set(o.cx + x * o.cos - z * o.sin, y, o.cz + x * o.sin + z * o.cos);
    // Authored facing -Z, matching humanoids. YXZ keeps roll around flight heading.
    // Collision-bearing poses are shared across peers. Reduced motion affects
    // cosmetic wings/tail, never the route or a builder's solid-body clearance.
    dragon.group.rotation.set(pitch, Math.atan2(-worldVX, -worldVZ), bank, 'YXZ');

    for (let wing = 0; wing < parts.wings.length; wing++) {
      const w = parts.wings[wing];
      w.upper.rotation.z = w.side * (0.1 + motion * drive * 0.5 * stroke);
      w.upper.rotation.y = w.side * (-0.08 - 0.05 * (1 - drive));
      // Delayed outer flex keeps the fingers following the shoulder stroke.
      // Rotating only around this hinge preserves the membrane seam exactly.
      w.outer.rotation.z = -0.06 + motion * drive * 0.26 * Math.sin(beat - 0.72);
    }
    parts.hips.rotation.y = -turnRate * 0.3 + 0.025 * Math.sin(sway - 0.9);
    parts.hips.rotation.x = -0.015 + 0.018 * Math.sin(sway);
    parts.neck[0].rotation.set(-0.035 + 0.035 * Math.sin(sway + 0.8), turnRate * 0.38, -bank * 0.16);
    parts.neck[1].rotation.x = 0.1 + 0.035 * Math.sin(sway + 0.35);
    parts.neck[1].rotation.y = 0.025 * Math.sin(sway);
    parts.head.rotation.x = -0.1 - pitch * 0.25 + 0.026 * Math.sin(sway - 0.25);
    parts.head.rotation.y = 0.04 * Math.sin(angle + dragon.phase);
    parts.jaw.rotation.x = -0.035 - 0.055 * (0.5 + 0.5 * Math.sin(cruise + 0.6));
    for (let joint = 0; joint < parts.tail.length; joint++) {
      const tail = parts.tail[joint], follow = sway - joint * 0.55;
      tail.rotation.y = -turnRate * (0.16 + joint * 0.045) + motion * (0.045 + joint * 0.005) * Math.sin(follow);
      tail.rotation.x = -0.035 + motion * (0.025 * Math.sin(follow + 0.7) + drive * 0.012 * Math.sin(beat - joint * 0.5));
    }
    if (!dragon.motion.ready) {
      // Cold spawn only: the terrain/yard scan covers this entire body/route.
      // All subsequent motion, including lease returns and tab resumes, sweeps.
      dragon.group.position.copy(dragon.motion.target);
      dragon.motion.ready = true;
      dragon.motion.lastSeconds = seconds;
      dragonSyncCollider(dragon);
    } else dragonMoveAmbient(dragon, seconds);
    if (dragon.tag && typeof camera !== 'undefined') {
      const dx = camera.position.x - dragon.group.position.x;
      const dy = camera.position.y - dragon.group.position.y;
      const dz = camera.position.z - dragon.group.position.z;
      dragon.tag.visible = !!dragon.rideable && dx * dx + dy * dy + dz * dz < 3600;
    }
  }
}

if (typeof BC !== 'undefined' && typeof BC.on === 'function') {
  BC.on('worldReset', dragonPruneSaddles, -30);
}
