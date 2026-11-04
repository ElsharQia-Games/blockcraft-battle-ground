/* Blockcraft Battle Ground — Articulated, low-poly ambient dragons.
   45-dragons.js
   Classic script, loaded after characters. Spawn after terrain, before compile.
   Flight and posing are analytic: no physics catch-up, timers or frame allocations. */
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
    crest: 1.12, hornLength: 0.92, span: 1.07, fin: 1.2 }
];
const DRAGON_ROUTES = [
  { x: -7, z: -5, rx: 43, rz: 32, rotation: 0.25, altitude: 58, size: 1.15, period: 69, direction: 1, tiltX: 2.1, tiltZ: 1, flap: 2.6, glide: 17 },
  { x: 11, z: 9, rx: 57, rz: 41, rotation: 1.1, altitude: 64, size: 0.91, period: 83, direction: -1, tiltX: 1, tiltZ: -2.1, flap: 2.25, glide: 19 },
  { x: -12, z: 11, rx: 61, rz: 43, rotation: -0.62, altitude: 70, size: 1.02, period: 97, direction: 1, tiltX: 2.4, tiltZ: 0.3, flap: 2.8, glide: 21 },
  { x: 14, z: -11, rx: 46, rz: 57, rotation: 0.8, altitude: 63, size: 0.85, period: 79, direction: -1, tiltX: -1.2, tiltZ: 1.7, flap: 2.4, glide: 16 }
];
const DRAGON_TAIL_LENGTHS = [1.7, 1.6, 1.5, 1.35, 1.2, 1.05, 0.85];
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
  return group;
}

/* ---------------- terrain-safe, deterministic flight ---------------- */
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

function spawnDragons() {
  if (dragons.length) return dragons;
  // Shared only during spawning, then collectible. No terrain queries in updates.
  const heights = new Int16Array(WORLD * WORLD);
  heights.fill(-1);
  for (let i = 0; i < DRAGON_ROUTES.length; i++) {
    const route = DRAGON_ROUTES[i];
    const orbit = Object.assign({}, route, {
      cx: WORLD / 2 + route.x, cz: WORLD / 2 + route.z,
      cos: Math.cos(route.rotation), sin: Math.sin(route.rotation),
      omega: route.direction * DRAGON_TAU / route.period
    });
    // Gently bias loops toward generated villages while keeping them in the
    // central skyline and within the world's existing fog range.
    if (villageSites.length) {
      const site = villageSites[i % villageSites.length];
      orbit.cx += Math.max(-15, Math.min(15, (site.x - orbit.cx) * 0.22));
      orbit.cz += Math.max(-15, Math.min(15, (site.z - orbit.cz) * 0.22));
    }
    orbit.altitude = dragonOrbitAltitude(orbit, route.size, heights);
    const group = makeDragon(DRAGON_PALETTES[i]);
    group.scale.setScalar(route.size);
    const dragon = {
      group, parts: group.userData.parts, orbit,
      phase: hash2(771 + i * 41, 1553 - i * 67) * DRAGON_TAU,
      flapPeriod: route.flap, glidePeriod: route.glide, swayPeriod: 9.4 + i * 0.8
    };
    dragons.push(dragon);
    scene.add(group);
  }
  updateDragons(0, performance.now());
  return dragons;
}

function updateDragons(dt, now) {
  // dt is deliberately not integrated: seek, background-tab pauses and peers
  // with different frame rates all resolve directly to the same current pose.
  if (!Number.isFinite(now)) return;
  const seconds = DRAGON_TIME_ORIGIN * 0.001 + now * 0.001;
  const motion = DRAGON_MOTION_QUERY && DRAGON_MOTION_QUERY.matches ? 0.28 : 1;
  for (let i = 0; i < dragons.length; i++) {
    const dragon = dragons[i], o = dragon.orbit, parts = dragon.parts;
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
    dragon.group.position.set(o.cx + x * o.cos - z * o.sin, y, o.cz + x * o.sin + z * o.cos);
    // Authored facing -Z, matching humanoids. YXZ keeps roll around flight heading.
    dragon.group.rotation.set(pitch, Math.atan2(-worldVX, -worldVZ), bank * motion, 'YXZ');

    for (let wing = 0; wing < parts.wings.length; wing++) {
      const w = parts.wings[wing];
      w.upper.rotation.z = w.side * (0.1 + motion * drive * 0.5 * stroke);
      w.upper.rotation.y = w.side * (-0.08 - 0.05 * (1 - drive));
      // Delayed outer flex keeps the fingers following the shoulder stroke.
      // Rotating only around this hinge preserves the membrane seam exactly.
      w.outer.rotation.z = -0.06 + motion * drive * 0.26 * Math.sin(beat - 0.72);
    }
    parts.hips.rotation.y = -turnRate * 0.3 + motion * 0.025 * Math.sin(sway - 0.9);
    parts.hips.rotation.x = -0.015 + motion * 0.018 * Math.sin(sway);
    parts.neck[0].rotation.set(-0.035 + motion * 0.035 * Math.sin(sway + 0.8), turnRate * 0.38, -bank * motion * 0.16);
    parts.neck[1].rotation.x = 0.1 + motion * 0.035 * Math.sin(sway + 0.35);
    parts.neck[1].rotation.y = motion * 0.025 * Math.sin(sway);
    parts.head.rotation.x = -0.1 - pitch * 0.25 + motion * 0.026 * Math.sin(sway - 0.25);
    parts.head.rotation.y = motion * 0.04 * Math.sin(angle + dragon.phase);
    parts.jaw.rotation.x = -0.035 - motion * 0.055 * (0.5 + 0.5 * Math.sin(cruise + 0.6));
    for (let joint = 0; joint < parts.tail.length; joint++) {
      const tail = parts.tail[joint], follow = sway - joint * 0.55;
      tail.rotation.y = -turnRate * (0.16 + joint * 0.045) + motion * (0.045 + joint * 0.005) * Math.sin(follow);
      tail.rotation.x = -0.035 + motion * (0.025 * Math.sin(follow + 0.7) + drive * 0.012 * Math.sin(beat - joint * 0.5));
    }
  }
}
