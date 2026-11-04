/* Blockcraft Battle Ground — Greedy-ish face meshing and chunk rebuilds.
   30-meshing.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ---------------- meshing ---------------- */
const FACES = [
  { dir: [ 1, 0, 0], nAxis: 0, corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], uvs: [[0,0],[0,1],[1,1],[1,0]], shade: 0.80 },
  { dir: [-1, 0, 0], nAxis: 0, corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], uvs: [[0,0],[0,1],[1,1],[1,0]], shade: 0.80 },
  { dir: [ 0, 1, 0], nAxis: 1, corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], uvs: [[0,0],[0,1],[1,1],[1,0]], shade: 1.00 },
  { dir: [ 0,-1, 0], nAxis: 1, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], uvs: [[0,0],[1,0],[1,1],[0,1]], shade: 0.58 },
  { dir: [ 0, 0, 1], nAxis: 2, corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], uvs: [[0,0],[1,0],[1,1],[0,1]], shade: 0.90 },
  { dir: [ 0, 0,-1], nAxis: 2, corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], uvs: [[0,0],[1,0],[1,1],[0,1]], shade: 0.90 }
];
const AO_LEVELS = [0.50, 0.67, 0.84, 1.0];

function buildChunkGeometry(cx, cz, pass) {
  const positions = [], uvs = [], colors = [], indices = [];
  let vc = 0;
  const X0 = cx * CHUNK, Z0 = cz * CHUNK;

  for (let x = X0; x < X0 + CHUNK; x++) {
    for (let z = Z0; z < Z0 + CHUNK; z++) {
      for (let y = 0; y < HEIGHT; y++) {
        const block = getBlock(x, y, z);
        if (block === AIR) continue;
        const isWater = block === WATER;
        const isGlass = block === GLASS;
        if (pass === 0 && (isWater || isGlass)) continue;
        if (pass === 1 && !isGlass) continue;
        if (pass === 2 && !isWater) continue;

        const def = BLOCK_DEFS[block];

        for (let fi = 0; fi < FACES.length; fi++) {
          const f = FACES[fi];
          const nb = getBlock(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
          if (isWater) { if (nb !== AIR) continue; }
          else if (isGlass) { if (nb !== AIR && nb !== WATER) continue; }
          else if (nb !== AIR && nb !== WATER && nb !== GLASS) continue;

          const tile = isWater ? 21 : (f.dir[1] === 1 ? def.top : f.dir[1] === -1 ? def.bottom : def.side);
          const tuv = TILE_UV[tile];
          const ta = (f.nAxis + 1) % 3, tb = (f.nAxis + 2) % 3;

          for (let c = 0; c < 4; c++) {
            const corner = f.corners[c];
            let py = y + corner[1];
            if (isWater && f.dir[1] !== -1 && corner[1] === 1) py = y + 0.88;
            positions.push(x + corner[0], py, z + corner[2]);

            const suv = f.uvs[c];
            uvs.push(tuv.u0 + suv[0] * (tuv.u1 - tuv.u0), tuv.v0 + suv[1] * (tuv.v1 - tuv.v0));

            let ao = 1;
            if (!isWater && !isGlass) {
              const o1 = [0, 0, 0], o2 = [0, 0, 0];
              o1[ta] = corner[ta] ? 1 : -1;
              o2[tb] = corner[tb] ? 1 : -1;
              const bx = x + f.dir[0], by = y + f.dir[1], bz = z + f.dir[2];
              const s1 = isOpaque(bx + o1[0], by + o1[1], bz + o1[2]) ? 1 : 0;
              const s2 = isOpaque(bx + o2[0], by + o2[1], bz + o2[2]) ? 1 : 0;
              const sc = isOpaque(bx + o1[0] + o2[0], by + o1[1] + o2[1], bz + o1[2] + o2[2]) ? 1 : 0;
              const lvl = (s1 && s2) ? 1 : 3 - (s1 + s2 + sc);
              ao = AO_LEVELS[lvl];
            }
            const sh = f.shade * ao;
            colors.push(sh, sh, sh);
          }
          indices.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
          vc += 4;
        }
      }
    }
  }

  if (vc === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

const solidMaterial = new THREE.MeshBasicMaterial({ map: atlasTexture, vertexColors: true });
const glassMaterial = new THREE.MeshBasicMaterial({
  map: atlasTexture, vertexColors: true, transparent: true,
  side: THREE.DoubleSide, depthWrite: false
});
const waterMaterial = new THREE.MeshBasicMaterial({
  map: atlasTexture, vertexColors: true, transparent: true, opacity: 0.78,
  side: THREE.DoubleSide, depthWrite: false
});

const chunkMeshes = new Map();

function disposeChunk(rec) {
  if (!rec) return;
  for (const key of ['solid', 'glass', 'water']) {
    const m = rec[key];
    if (m) { scene.remove(m); m.geometry.dispose(); }
  }
}
function rebuildChunk(cx, cz) {
  if (cx < 0 || cx >= CHUNKS || cz < 0 || cz >= CHUNKS) return;
  const key = cx + ',' + cz;
  disposeChunk(chunkMeshes.get(key));

  const rec = { solid: null, glass: null, water: null };
  const layers = [
    ['solid', 0, solidMaterial, 0],
    ['glass', 1, glassMaterial, 1],
    ['water', 2, waterMaterial, 2]
  ];
  for (const [slot, pass, material, order] of layers) {
    const geo = buildChunkGeometry(cx, cz, pass);
    if (geo) {
      const mesh = new THREE.Mesh(geo, material);
      mesh.renderOrder = order;
      scene.add(mesh);
      rec[slot] = mesh;
    }
  }
  chunkMeshes.set(key, rec);
}
