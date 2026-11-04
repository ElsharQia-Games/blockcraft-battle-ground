/* Blockcraft Battle Ground — Characters, pixel-art skin painters, villagers, chickens and critters.
   40-characters.js
   Part of a split that loads as classic <script> tags (see index.html). */
'use strict';
/* ---------------- characters, villagers & chickens ---------------- */
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x6a7b8c, 1.5);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(40, 90, 25);
scene.add(sunLight);

const CHARACTERS = {
  steve: {
    name: 'Steve', skin: '#c99b6e', hair: '#3f2a1a', shirt: '#1ba8a0',
    sleeve: '#1ba8a0', pants: '#3d4d8c', shoe: '#4c4c4c', style: 'plain'
  },
  cj: {
    name: 'CJ', skin: '#6b4430', hair: '#141414', shirt: '#f2f2f2',
    sleeve: '#6b4430', pants: '#2f4a86', shoe: '#f0f0f0', style: 'cj',
    accent: '#e8c14a'
  },
  mario: {
    name: 'Mario', skin: '#f2b98c', hair: '#4a2a12', shirt: '#d92b2b',
    sleeve: '#d92b2b', pants: '#2b57b8', shoe: '#6b3a1f', style: 'mario',
    accent: '#f5d33a', glove: '#f5f5f5'
  },
  ashen: {
    name: 'Ashen One', skin: '#8b8681', hair: '#292622', shirt: '#403b35',
    sleeve: '#403b35', pants: '#332e29', shoe: '#272421', style: 'knight',
    accent: '#e87832', metal: '#615e58', trim: '#a49a88', cape: '#574539', leather: '#453327'
  },
  undead: {
    name: 'Chosen Undead', skin: '#9aa08a', hair: '#433d33', shirt: '#365783',
    sleeve: '#5f6265', pants: '#51493e', shoe: '#514c43', style: 'knight',
    accent: '#395e92', metal: '#a2a8aa', trim: '#b9a679', cape: '#365783', leather: '#604730'
  },
  wolf: {
    name: 'Wolf', skin: '#b99a80', hair: '#2d2925', shirt: '#a65d34',
    sleeve: '#a65d34', pants: '#49443c', shoe: '#41352a', style: 'shinobi',
    accent: '#b5a58c', wrap: '#9e9480', leather: '#49372b', metal: '#777771'
  },
  tarnished: {
    name: 'Tarnished', skin: '#d6c6a4', hair: '#d9d8cb', shirt: '#813c37',
    sleeve: '#5b5451', pants: '#514842', shoe: '#4a4541', style: 'knight',
    accent: '#903e39', metal: '#a0a5a3', trim: '#d0cec2', cape: '#4e5050', leather: '#49372d'
  },
  kratos: {
    name: 'Kratos', skin: '#c7c3b9', hair: '#35271f', shirt: '#68472f',
    sleeve: '#68472f', pants: '#40372c', shoe: '#352a21', style: 'plain',
    accent: '#b89959', tattoo: '#a52f2d', leather: '#68472f', fur: '#8c8270', metal: '#8b9599'
  },
  leon: {
    name: 'Leon Kennedy', skin: '#d4b19a', hair: '#776044', shirt: '#684937',
    sleeve: '#684937', pants: '#3e4142', shoe: '#202223', style: 'plain',
    accent: '#c7bfa6', leather: '#684937', fur: '#c9b99a', metal: '#8d9496', under: '#24282a', glove: '#252727'
  },
  fayoum: {
    name: 'Fayoum', skin: '#a9744f', hair: '#2a1e14', shirt: '#f2ead8',
    sleeve: '#f2ead8', pants: '#8d7a5e', shoe: '#5a4632', style: 'fayoum',
    accent: '#c9a227', trim: '#2e4a7a'
  },
  seif: {
    name: 'Seif', skin: '#c99672', hair: '#2e2018', shirt: '#15493f',
    sleeve: '#15493f', pants: '#8aa29c', shoe: '#d9d7cf', style: 'plain',
    accent: '#f2f0e6'
  },
  meedo: {
    name: 'Meedo', skin: '#cfa58c', hair: '#2a221d', shirt: '#434d6b',
    sleeve: '#434d6b', pants: '#34405c', shoe: '#2a2a2e', style: 'plain',
    accent: '#f5f5f2'
  },
  hokage: {
    name: 'Hokage', skin: '#c39472', hair: '#1f1712', shirt: '#59603a',
    sleeve: '#59603a', pants: '#26262b', shoe: '#1c1715', style: 'plain',
    accent: '#ff7a1f', ember: '#ff7a1f', hot: '#ffd35a', char: '#1c1715', cloak: '#35302d'
  },
  mko: {
    name: 'Mko', skin: '#d3a27a', hair: '#2b1c14', shirt: '#413c3d',
    sleeve: '#413c3d', pants: '#3b3633', shoe: '#17171a', style: 'plain',
    accent: '#c8ccd4'
  },
  mj: {
    name: 'Michael Jackson', skin: '#d9ad91', hair: '#111014', shirt: '#15161a',
    sleeve: '#15161a', pants: '#121318', shoe: '#07080a', style: 'plain',
    accent: '#f6f3e9', silver: '#c8cdd5', satin: '#343741', glove: '#faf9f2'
  },
  kestrel: {
    name: 'Kestrel', skin: '#b98259', hair: '#7b2f1f', shirt: '#1e7f7c',
    sleeve: '#1e7f7c', pants: '#cdb080', shoe: '#5b3a23', style: 'plain',
    accent: '#ea8b2c', leather: '#6b4226', brass: '#d2a84b'
  },
  oren: {
    name: 'Oren', skin: '#5e3b28', hair: '#e9e2d2', shirt: '#34393e',
    sleeve: '#34393e', pants: '#3b2d23', shoe: '#1f1b19', style: 'plain',
    accent: '#d97b2c', leather: '#6f4526', ember: '#ff9a3c'
  }
};

const CHAR_KEYS = ['steve', 'cj', 'mario', 'ashen', 'undead', 'wolf', 'tarnished', 'seif', 'meedo', 'mko', 'mj', 'hokage', 'kestrel', 'oren', 'kratos', 'leon'];

const charMaterialCache = new Map();
function charMaterial(color) {
  let m = charMaterialCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    charMaterialCache.set(color, m);
  }
  return m;
}

const BOX_CACHE = new Map();
function charBox(w, h, d) {
  const key = w + ',' + h + ',' + d;
  let g = BOX_CACHE.get(key);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); BOX_CACHE.set(key, g); }
  return g;
}

function addBox(parent, w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(charBox(w, h, d), charMaterial(color));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

const GLOW_MATS = new Map();
function glowBox(parent, w, h, d, color, x, y, z) {
  let m = GLOW_MATS.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    GLOW_MATS.set(color, m);
  }
  const mesh = new THREE.Mesh(charBox(w, h, d), m);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/* Pixel-art atlas: each part gets one 32x32 tile per box face, packed into a
   96x64 canvas so a six-sided textured box is still a single draw call. */
const TEX_S = 32;
const TEX_FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz']; // BoxGeometry material order
const FACE_MUL = { px: 0.9, nx: 0.9, py: 1.08, ny: 0.68, pz: 0.96, nz: 1.0 };
const TEX_MATS = new Map();
const ATLAS_GEOM = new Map();

const RGB_CACHE = new Map();
function rgbOf(hex) {
  let v = RGB_CACHE.get(hex);
  if (!v) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    RGB_CACHE.set(hex, v);
  }
  return v;
}
function toHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, v | 0));
  return '#' + ((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1);
}
function tone(hex, f) {
  const [r, g, b] = rgbOf(hex);
  return toHex(r * f, g * f, b * f);
}
function blendHex(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
function rand2(x, y, s) {
  let n = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
  n = (n ^ (n >>> 13)) | 0;
  n = (n * 1274126177) | 0;
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967296;
}

function dot(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

function texMaterial(id, paint) {
  let m = TEX_MATS.get(id);
  if (m) return m;
  const cv = document.createElement('canvas');
  cv.width = TEX_S * 3; cv.height = TEX_S * 2;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = (i / 3) | 0;
    g.save();
    g.beginPath();
    g.rect(col * TEX_S, row * TEX_S, TEX_S, TEX_S);
    g.clip();
    g.translate(col * TEX_S, row * TEX_S);
    paint(g, TEX_FACES[i], i);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshLambertMaterial({ map: tex });
  TEX_MATS.set(id, m);
  return m;
}

function atlasBox(w, h, d) {
  const key = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3);
  let g = ATLAS_GEOM.get(key);
  if (g) return g;
  g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const col = f % 3, row = (f / 3) | 0;
    const u0 = col / 3, v0 = 1 - (row + 1) / 2;
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, u0 + uv.getX(i) / 3, v0 + uv.getY(i) * 0.5);
    }
  }
  uv.needsUpdate = true;
  ATLAS_GEOM.set(key, g);
  return g;
}

const CHAR_LEG_SEGMENT = 0.36;
const CHAR_LEG_LENGTH = CHAR_LEG_SEGMENT * 2;
const CHAR_LEG_HALF_DEPTH = 0.12;

function charHumanoidLegGeometry(upper) {
  const key = 'humanoid-leg|' + (upper ? 'thigh' : 'shin');
  let g = ATLAS_GEOM.get(key);
  if (g) return g;
  g = new THREE.BoxGeometry(0.22, CHAR_LEG_SEGMENT, CHAR_LEG_HALF_DEPTH * 2);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const col = f % 3, row = (f / 3) | 0;
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      const u = uv.getX(i), y = uv.getY(i);
      if ((upper && f === 3) || (!upper && f === 2)) {
        // Newly exposed knee caps sample the adjacent mid-pant row, not a
        // second waistband/hem. The original outer top/bottom tiles stay intact.
        uv.setXY(i, (2 + u) / 3, 0.5 - (upper ? 15.5 : 16.5) / 64);
      } else {
        // Side faces use rows 0..15 on the thigh and 16..31 on the shin of
        // the SAME 96x64 atlas. No repainted material or stretched duplicate.
        const tileY = f === 2 || f === 3 ? y : y * 0.5 + (upper ? 0.5 : 0);
        uv.setXY(i, (col + u) / 3, 1 - (row + 1) / 2 + tileY * 0.5);
      }
    }
  }
  uv.needsUpdate = true;
  ATLAS_GEOM.set(key, g);
  return g;
}

function partMaterial(key, c, part) {
  return texMaterial('char|' + key + '|' + part, (g, face) => paintPart(g, face, c, key, part));
}

function addPart(parent, w, h, d, key, c, part, x, y, z) {
  const mesh = new THREE.Mesh(atlasBox(w, h, d), partMaterial(key, c, part));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function paintedBox(parent, w, h, d, id, paint, x, y, z) {
  const finished = (g, face, i) => { paint(g, face, i); volumeShade(g, face); };
  const mesh = new THREE.Mesh(atlasBox(w, h, d), texMaterial('prop|' + id, finished));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/* ---------------- character pixel painters ---------------- */
/* Soft top-down light and darkened corners, laid over every finished tile so
   each box reads as a rounded form instead of a flat sticker. */
function volumeShade(g, face) {
  if (face === 'py' || face === 'ny') {
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 31, 32, 1);
    g.fillRect(0, 1, 1, 30);
    g.fillRect(31, 1, 1, 30);
    return;
  }
  for (let y = 0; y < 32; y++) {
    const t = y / 31;
    g.fillStyle = t < 0.38
      ? 'rgba(255,255,255,' + ((0.38 - t) * 0.16).toFixed(3) + ')'
      : 'rgba(0,0,0,' + ((t - 0.38) * 0.2).toFixed(3) + ')';
    g.fillRect(0, y, 32, 1);
  }
  const edge = [0.16, 0.09, 0.04];
  for (let i = 0; i < 3; i++) {
    g.fillStyle = 'rgba(0,0,0,' + edge[i] + ')';
    g.fillRect(i, 0, 1, 32);
    g.fillRect(31 - i, 0, 1, 32);
  }
}

function skinBase(g, c, face) {
  const base = tone(c.skin, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  for (let i = 0; i < 56; i++) {
    const x = (rand2(i, 5, 21) * 32) | 0, y = (rand2(i, 9, 22) * 32) | 0;
    dot(g, x, y, tone(base, rand2(i, 3, 23) > 0.5 ? 0.96 : 1.03));
  }
  rect(g, 0, 29, 32, 3, tone(base, 0.94));
}

function clothBase(g, color, face, seed) {
  const base = tone(color, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  for (let x = 0; x < 32; x += 3) rect(g, x, 0, 1, 32, tone(base, 0.96));
  for (let y = 0; y < 32; y += 5) rect(g, 0, y, 32, 1, tone(base, 0.98));
  for (let i = 0; i < 48; i++) {
    const x = (rand2(i, 4, seed) * 32) | 0, y = (rand2(i, 8, seed) * 32) | 0;
    dot(g, x, y, tone(base, rand2(i, 2, seed) > 0.55 ? 1.05 : 0.93));
  }
  for (let i = 0; i < 5; i++) {
    const x0 = (rand2(i, 14, seed) * 26) | 0, y0 = 4 + ((rand2(i, 16, seed) * 20) | 0);
    const len = 4 + ((rand2(i, 17, seed) * 5) | 0);
    const lean = rand2(i, 19, seed) > 0.5 ? 1 : 0;
    for (let k = 0; k < len; k++) {
      const y = y0 + (lean ? k : len - k);
      dot(g, x0 + k, y, tone(base, 0.9));
      dot(g, x0 + k, y + 1, tone(base, 1.05));
    }
  }
  rect(g, 0, 30, 32, 2, tone(base, 0.9));
}

function metalBase(g, color, face, seed) {
  const base = tone(color, FACE_MUL[face] || 1);
  for (let i = 0; i < 8; i++) {
    const f = 0.86 + (i / 7) * 0.22;
    rect(g, 0, i * 4, 32, 4, tone(base, f));
  }
  for (let i = 0; i < 42; i++) {
    const x = (rand2(i, 6, seed) * 32) | 0;
    const y = (rand2(i, 12, seed) * 32) | 0;
    const h = 1 + ((rand2(i, 15, seed) * 5) | 0);
    rect(g, x, y, 1, h, tone(base, rand2(i, 18, seed) > 0.5 ? 1.09 : 0.84));
  }
  for (let i = 0; i < 22; i++) {
    const x = (rand2(i, 31, seed) * 28) | 0, y = (rand2(i, 33, seed) * 26) | 0;
    rect(g, x, y, 2, 1, tone(base, 1.12));
  }
  rect(g, 0, 0, 32, 1, tone(base, 1.28));
  rect(g, 0, 9, 32, 2, tone(base, 1.16));
  rect(g, 0, 30, 32, 2, tone(base, 0.78));
}

function rivet(g, x, y, color) {
  rect(g, x, y, 3, 3, tone(color, 0.6));
  rect(g, x + 1, y + 1, 2, 2, tone(color, 1.15));
  dot(g, x + 1, y + 1, '#f2f2f2');
}

/* Small, atlas-only material details; props share the same cached painters. */
function charStitches(g, x, y, w, h, color) {
  for (let k = 1; k < w - 1; k += 3) {
    dot(g, x + k, y, color);
    if (h > 1) dot(g, x + k, y + h - 1, color);
  }
  for (let k = 2; k < h - 1; k += 3) {
    dot(g, x, y + k, color);
    if (w > 1) dot(g, x + w - 1, y + k, color);
  }
}

function charLeatherBase(g, color, face, seed) {
  const base = tone(color, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  rect(g, 3, 2, 3, 27, tone(base, 1.12));
  rect(g, 27, 1, 2, 30, tone(base, 0.72));
  for (let i = 0; i < 65; i++) {
    const x = (rand2(i, 3, seed) * 32) | 0, y = (rand2(i, 7, seed) * 32) | 0;
    rect(g, x, y, i % 5 === 0 ? 3 : 1, 1, tone(base, i % 3 === 0 ? 1.2 : 0.82));
  }
  charStitches(g, 1, 1, 30, 30, tone(base, 1.34));
}

function charFurBase(g, color, face, seed) {
  const base = tone(color, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  for (let y = 0; y < 32; y += 4) {
    for (let x = -2; x < 32; x += 4) {
      const dx = x + (y % 8 ? 2 : 0), len = 2 + ((rand2(x, y, seed) * 3) | 0);
      rect(g, dx, y, 1, len, tone(base, 0.7));
      rect(g, dx + 1, y, 1, Math.max(1, len - 1), tone(base, 1.18));
      dot(g, dx + 2, y + 1, tone(base, 1.08));
    }
  }
}

function charChainmail(g, face, color) {
  const base = tone(color, (FACE_MUL[face] || 1) * 0.52);
  rect(g, 0, 0, 32, 32, base);
  for (let y = 0; y < 32; y += 3) {
    for (let x = y % 2 ? -2 : 0; x < 32; x += 4) {
      rect(g, x, y, 3, 1, tone(base, 1.65));
      dot(g, x, y + 1, tone(base, 1.3));
      dot(g, x + 2, y + 1, tone(base, 0.68));
      rect(g, x + 1, y + 2, 2, 1, tone(base, 0.6));
    }
  }
}

function charArmorWear(g, face, c, seed) {
  for (let i = 0; i < 13; i++) {
    const x = 2 + ((rand2(i, TEX_FACES.indexOf(face) + 3, seed) * 27) | 0);
    const y = 2 + ((rand2(i, 7, seed) * 27) | 0);
    rect(g, x, y, 2 + i % 3, 1, tone(c.metal, 0.59));
    dot(g, x, y + 1, tone(c.metal, 1.23));
  }
}

function eye(g, x, y, glow) {
  rect(g, x, y, 5, 3, '#efe9dc');
  rect(g, x, y, 5, 1, '#2a1c14');
  rect(g, x + 1, y + 1, 3, 2, glow || '#4a2f1d');
  dot(g, x + 2, y + 1, glow ? '#ffffff' : '#120b07');
  dot(g, x + 2, y + 2, glow ? '#ffffff' : '#120b07');
  if (!glow) dot(g, x + 1, y + 1, '#d9c8b2');
}

function hairBase(g, face, c) {
  const base = tone(c.hair, FACE_MUL[face] || 1);
  const hi = tone(base, 1.14), lo = tone(base, 0.78);
  if (face === 'ny') {
    rect(g, 0, 0, 32, 3, lo);
    return;
  }
  if (face === 'py') {
    rect(g, 0, 0, 32, 32, base);
    for (let i = 0; i < 70; i++) {
      const x = (rand2(i, 3, 61) * 32) | 0, y = (rand2(i, 7, 62) * 32) | 0;
      dot(g, x, y, rand2(i, 5, 63) > 0.5 ? hi : lo);
    }
    return;
  }
  if (face === 'nz') {
    for (let x = 0; x < 32; x++) {
      const d = 6 + Math.round(rand2(x, 1, 7) * 5);
      rect(g, x, 0, 1, d, base);
      rect(g, x, d - 1, 1, 1, lo);
      if (x % 3 === 0) rect(g, x, 0, 1, d - 2, hi);
    }
    rect(g, 0, 0, 4, 16, base);
    rect(g, 28, 0, 4, 16, base);
    rect(g, 3, 0, 1, 14, lo);
    rect(g, 28, 0, 1, 14, lo);
  } else if (face === 'pz') {
    rect(g, 0, 0, 32, 32, base);
    for (let x = 0; x < 32; x++) {
      const d = 30 + Math.round(rand2(x, 2, 7) * 2);
      rect(g, x, 0, 1, d, base);
      rect(g, x, d - 1, 1, 1, lo);
    }
    for (let x = 1; x < 32; x += 4) rect(g, x, 1, 1, 27, hi);
    for (let x = 3; x < 32; x += 4) rect(g, x, 2, 1, 28, lo);
  } else {
    rect(g, 0, 0, 32, 12, base);
    for (let x = 1; x < 32; x += 4) rect(g, x, 1, 1, 10, hi);
    for (let x = 3; x < 32; x += 4) rect(g, x, 2, 1, 8, lo);
    for (let i = 0; i < 8; i++) rect(g, sideSpan(face, 0, 12 - i), 11 + i, 12 - i, 1, base);
    rect(g, sideSpan(face, 0, 4), 19, 4, 1, lo);
    charNapeSide(g, face, c, 12, base, lo, hi);
  }
}

/* Continue only the rear of side tiles down to the nape. Keep the ear and
   front/beard designs intact; nx/px have opposite horizontal UV directions. */
function charNapeSide(g, face, c, y0, base, fade, hi) {
  if (face !== 'px' && face !== 'nx') return;
  for (let d = 18; d < 32; d++) {
    const top = y0 + Math.max(0, 24 - d);
    const x = sideSpan(face, d, 1);
    rect(g, x, top, 1, 32 - top, d < 22 ? fade : base);
    if (d % 4 === 1) rect(g, x, top + 2, 1, Math.max(1, 27 - top), hi);
    dot(g, x, 31, fade);
  }
}

function hairCj(g, face, c) {
  const base = tone(c.hair, FACE_MUL[face] || 1), fade = blendHex(base, c.skin, 0.32);
  if (face === 'ny') return;
  if (face === 'py' || face === 'pz') {
    rect(g, 0, 0, 32, 32, base);
    hairSpeckle(g, 0, 0, 32, 32, tone(base, 1.5), tone(base, 0.75), 301, 100);
    if (face === 'pz') {
      rect(g, 0, 28, 32, 4, fade);
      hairSpeckle(g, 0, 28, 32, 4, base, fade, 302, 68);
    }
  } else if (face === 'nz') {
    rect(g, 0, 0, 32, 6, base);
    rect(g, 2, 6, 28, 1, fade);
    rect(g, 0, 5, 3, 12, base);
    rect(g, 29, 5, 3, 12, base);
    hairSpeckle(g, 0, 0, 32, 5, tone(base, 1.4), tone(base, 0.8), 303, 34);
  } else {
    rect(g, 0, 0, 32, 9, base);
    rect(g, 0, 9, 32, 4, fade);
    rect(g, sideSpan(face, 0, 3), 9, 3, 9, base);
    charNapeSide(g, face, c, 12, base, fade, tone(base, 1.3));
  }
}

function hairMario(g, face, c) {
  if (face === 'ny') return;
  const base = tone(c.hair, FACE_MUL[face] || 1);
  if (face === 'nz') {
    rect(g, 0, 0, 32, 5, tone(c.shirt, FACE_MUL[face]));
    for (const x of [0, 28]) {
      rect(g, x, 5, 4, 16, base);
      rect(g, x + 1, 8, 1, 11, tone(base, 1.18));
    }
    return;
  }
  hairBase(g, face, c);
  if (face !== 'py') rect(g, 0, 0, 32, 5, tone(c.shirt, FACE_MUL[face]));
}

function hairWolf(g, face, c) {
  const base = tone(c.hair, FACE_MUL[face] || 1), hi = tone(base, 1.6), lo = tone(base, 0.65);
  if (face === 'ny') { rect(g, 0, 0, 32, 3, base); return; }
  if (face === 'py' || face === 'pz') {
    rect(g, 0, 0, 32, 32, base);
    for (let x = 1; x < 32; x += 3) {
      for (let y = 0; y < 32; y++) {
        const pull = face === 'py' ? Math.round((16 - x) * y / 72) : Math.round((16 - x) * (31 - y) / 110);
        dot(g, x + pull, y, x % 2 ? hi : lo);
      }
    }
    if (face === 'pz') rect(g, 0, 31, 32, 1, lo);
  } else if (face === 'nz') {
    for (let x = 0; x < 32; x++) {
      const d = 3 + Math.round(Math.abs(x - 15) / 3.5);
      rect(g, x, 0, 1, d, base);
      if (x % 3 === 1) rect(g, x, 0, 1, d - 1, hi);
    }
    rect(g, 0, 6, 2, 15, base);
    rect(g, 30, 6, 2, 13, base);
    rect(g, 25, 6, 2, 6, base);
  } else {
    rect(g, 0, 0, 32, 9, base);
    rect(g, sideSpan(face, 0, 3), 8, 3, 14, base);
    charNapeSide(g, face, c, 8, base, lo, hi);
    for (let x = 2; x < 32; x += 4) rect(g, x, 0, 1, 7, hi);
  }
}

function paintFace(g, c, key) {
  const skin = c.skin, hair = c.hair;
  rect(g, 5, 14, 22, 1, tone(skin, 0.92));
  rect(g, 6, 18, 7, 1, tone(skin, 0.94));
  rect(g, 19, 18, 7, 1, tone(skin, 0.94));
  rect(g, 4, 20, 5, 3, blendHex(skin, '#c8574a', 0.1));
  rect(g, 23, 20, 5, 3, blendHex(skin, '#c8574a', 0.1));
  rect(g, 2, 18, 3, 4, tone(skin, 0.97));
  rect(g, 27, 18, 3, 4, tone(skin, 0.97));
  rect(g, 14, 18, 4, 4, tone(skin, 0.9));
  rect(g, 15, 18, 2, 2, tone(skin, 1.08));
  rect(g, 13, 21, 6, 2, tone(skin, 0.8));

  if (key === 'mario') {
    rect(g, 9, 21, 14, 3, tone(hair, 0.9));
    rect(g, 8, 22, 2, 3, tone(hair, 0.9));
    rect(g, 22, 22, 2, 3, tone(hair, 0.9));
    rect(g, 10, 24, 4, 2, tone(hair, 1.0));
    rect(g, 18, 24, 4, 2, tone(hair, 1.0));
    rect(g, 13, 26, 6, 2, '#5a2a1e');
    rect(g, 14, 27, 4, 1, '#f4efe4');
  } else if (key === 'cj') {
    rect(g, 13, 24, 6, 1, '#2a1a12');
    rect(g, 11, 26, 10, 5, tone(hair, 1.0));
    rect(g, 14, 26, 4, 2, '#3a2418');
    rect(g, 12, 29, 8, 2, tone(hair, 0.85));
  } else if (key === 'wolf') {
    rect(g, 12, 25, 9, 1, '#694a3c');
    rect(g, 14, 26, 5, 1, tone(skin, 0.82));
    rect(g, 11, 29, 10, 2, blendHex(skin, hair, 0.16));
    // Wolf's pallid Dragon's Heritage scar runs down his right cheek.
    for (let y = 11; y < 25; y++) {
      const x = 7 + Math.floor((y - 11) / 5);
      rect(g, x, y, 2, 1, blendHex(skin, '#e0dbcc', 0.68));
      dot(g, x - 1, y, tone(skin, 0.79));
    }
  } else if (key === 'steve') {
    rect(g, 7, 22, 18, 9, tone(hair, 1.1));
    rect(g, 10, 21, 12, 3, tone(skin, 0.8));
    rect(g, 11, 24, 10, 3, tone(skin, 0.94));
    rect(g, 13, 25, 6, 1, '#673e2a');
    rect(g, 10, 29, 12, 2, tone(hair, 0.82));
  } else if (key === 'tarnished') {
    rect(g, 11, 24, 10, 2, '#6b5a3c');
    rect(g, 10, 26, 12, 5, tone(hair, 0.9));
    rect(g, 13, 28, 6, 3, tone(hair, 1.08));
    rect(g, 6, 21, 2, 2, tone(hair, 0.92));
    rect(g, 24, 21, 2, 2, tone(hair, 0.92));
  } else if (key === 'fayoum') {
    rect(g, 3, 23, 26, 9, tone(hair, 0.95));
    rect(g, 9, 22, 14, 2, tone(hair, 0.85));
    rect(g, 12, 25, 8, 1, '#5a2f22');
    rect(g, 13, 26, 6, 1, tone(skin, 0.86));
    hairSpeckle(g, 3, 27, 26, 5, tone(hair, 2.4), tone(hair, 1.3), 163, 18);
    rect(g, 6, 14, 2, 1, '#1a1a1a');
    rect(g, 24, 14, 2, 1, '#1a1a1a');
    rect(g, 4, 18, 2, 1, tone(skin, 0.82));
    rect(g, 26, 18, 2, 1, tone(skin, 0.82));
  } else if (key === 'seif') {
    const beard = tone(hair, 1.12);
    rect(g, 0, 21, 3, 11, beard);
    rect(g, 29, 21, 3, 11, beard);
    rect(g, 3, 26, 26, 6, beard);
    rect(g, 3, 24, 3, 2, beard);
    rect(g, 26, 24, 3, 2, beard);
    rect(g, 10, 22, 12, 2, beard);
    rect(g, 9, 23, 3, 3, beard);
    rect(g, 20, 23, 3, 3, beard);
    hairSpeckle(g, 0, 22, 32, 10, tone(hair, 1.3), tone(hair, 0.84), 117, 44);
    rect(g, 11, 24, 10, 1, '#5e3024');
    rect(g, 11, 25, 10, 2, '#f5f1e6');
    rect(g, 12, 27, 8, 1, '#8b4638');
    dot(g, 10, 24, '#5a2e22');
    dot(g, 21, 24, '#5a2e22');
  } else if (key === 'meedo') {
    const stubble = blendHex(skin, hair, 0.55);
    for (let x = 12; x < 20; x++) if (x % 3 !== 2) dot(g, x, 23, stubble);
    rect(g, 12, 25, 8, 1, '#7a4a3f');
    rect(g, 13, 26, 6, 1, '#b47f6e');
    const goatee = blendHex(skin, hair, 0.62);
    rect(g, 14, 29, 4, 2, goatee);
    rect(g, 15, 28, 2, 1, stubble);
    rect(g, 15, 31, 2, 1, stubble);
    dot(g, 13, 30, stubble);
    dot(g, 18, 30, stubble);
    for (const x of [10, 11, 20, 21]) dot(g, x, 30, stubble);
    for (const x of [6, 8, 23, 25]) dot(g, x, 29, stubble);
  } else if (key === 'hokage') {
    const beard = tone(hair, 1.25);
    rect(g, 0, 21, 2, 11, beard);
    rect(g, 30, 21, 2, 11, beard);
    rect(g, 2, 25, 3, 7, beard);
    rect(g, 27, 25, 3, 7, beard);
    rect(g, 5, 28, 22, 4, beard);
    rect(g, 5, 26, 4, 2, beard);
    rect(g, 23, 26, 4, 2, beard);
    rect(g, 11, 22, 10, 2, beard);
    hairSpeckle(g, 5, 28, 22, 4, tone(hair, 1.6), tone(hair, 0.9), 189, 24);
    rect(g, 10, 25, 12, 1, '#5e3024');
    rect(g, 11, 26, 10, 1, '#f5f1e6');
    rect(g, 12, 27, 8, 1, '#8b4638');
    dot(g, 9, 24, '#5e3024');
    dot(g, 22, 24, '#5e3024');
  } else if (key === 'mko') {
    const beard = blendHex(skin, hair, 0.82), soft = blendHex(skin, hair, 0.5);
    rect(g, 0, 21, 2, 11, beard);
    rect(g, 30, 21, 2, 11, beard);
    rect(g, 2, 25, 2, 7, soft);
    rect(g, 28, 25, 2, 7, soft);
    rect(g, 4, 28, 24, 4, beard);
    rect(g, 7, 26, 18, 2, soft);
    rect(g, 11, 22, 10, 2, beard);
    rect(g, 11, 25, 10, 1, '#70392c');
    dot(g, 10, 24, '#70392c');
    dot(g, 21, 24, '#70392c');
    rect(g, 13, 26, 6, 1, '#c98f7a');
    rect(g, 14, 27, 4, 2, beard);
  } else if (key === 'mj') {
    const cheek = blendHex(skin, '#b66f68', 0.18), shadow = tone(skin, 0.82);
    rect(g, 4, 20, 6, 4, cheek);
    rect(g, 22, 20, 6, 4, cheek);
    rect(g, 14, 18, 4, 6, shadow);
    rect(g, 15, 18, 2, 4, tone(skin, 1.12));
    dot(g, 13, 23, tone(skin, 0.76));
    dot(g, 18, 23, tone(skin, 0.76));
    rect(g, 11, 25, 10, 1, '#7d3e3e');
    rect(g, 13, 26, 6, 1, '#bd7770');
    rect(g, 14, 27, 4, 1, tone(skin, 0.82));
    rect(g, 22, 5, 3, 8, hair);
    rect(g, 24, 8, 2, 8, tone(hair, 1.35));
    dot(g, 21, 7, tone(hair, 1.55));
    dot(g, 25, 16, tone(hair, 0.7));
  } else if (key === 'kestrel') {
    rect(g, 13, 24, 6, 1, '#8a4a3a');
    rect(g, 14, 25, 4, 1, '#a86454');
    for (const p of [[6, 20], [8, 21], [10, 20], [22, 20], [24, 21], [26, 20]]) dot(g, p[0], p[1], tone(skin, 0.74));
  } else if (key === 'oren') {
    rect(g, 12, 24, 8, 1, tone(skin, 0.52));
    rect(g, 13, 25, 6, 1, tone(skin, 0.84));
    rect(g, 4, 27, 24, 5, tone(skin, 0.9));
    rect(g, 22, 12, 1, 9, tone(skin, 1.28));
    rect(g, 4, 20, 5, 2, tone(skin, 0.68));
    dot(g, 9, 21, tone(skin, 0.68));
  } else {
    rect(g, 13, 24, 6, 1, tone(skin, 0.6));
    rect(g, 14, 25, 4, 1, tone(skin, 0.92));
  }

  eye(g, 7, 15, null);
  eye(g, 20, 15, null);
  rect(g, 6, 12, 6, 2, tone(hair, 0.92));
  rect(g, 20, 12, 6, 2, tone(hair, 0.92));
  if (key === 'cj') {
    rect(g, 5, 11, 8, 2, tone(hair, 0.9));
    rect(g, 19, 11, 8, 2, tone(hair, 0.9));
  }
  if (key === 'mario') {
    rect(g, 7, 14, 5, 1, tone(hair, 0.9));
    rect(g, 20, 14, 5, 1, tone(hair, 0.9));
    for (const x of [7, 20]) {
      rect(g, x, 15, 5, 4, '#fff8ed');
      rect(g, x + 1, 15, 3, 4, '#328fd0');
      rect(g, x + 2, 16, 1, 3, '#102b41');
      dot(g, x + 1, 15, '#ffffff');
    }
  }
  if (key === 'steve') {
    rect(g, 8, 16, 3, 2, '#6766aa');
    rect(g, 21, 16, 3, 2, '#6766aa');
  }
  if (key === 'seif') {
    dot(g, 5, 13, tone(hair, 0.92));
    dot(g, 26, 13, tone(hair, 0.92));
    rect(g, 7, 18, 5, 1, tone(skin, 0.82));
    rect(g, 20, 18, 5, 1, tone(skin, 0.82));
  }
  if (key === 'meedo') {
    const frame = '#0e0e10';
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(6, 15, 7, 4);
    g.fillRect(19, 15, 7, 4);
    for (const x of [5, 18]) {
      rect(g, x, 14, 9, 1, frame);
      rect(g, x, 19, 9, 1, frame);
      rect(g, x, 14, 1, 6, frame);
      rect(g, x + 8, 14, 1, 6, frame);
      rect(g, x + 5, 15, 2, 1, '#b9e6c4');
    }
    rect(g, 14, 15, 4, 1, frame);
    rect(g, 0, 15, 5, 1, frame);
    rect(g, 27, 15, 5, 1, frame);
  }
  if (key === 'hokage') {
    const frame = '#141416', rim = '#4a4a50';
    rect(g, 7, 18, 5, 1, tone(skin, 0.84));
    rect(g, 20, 18, 5, 1, tone(skin, 0.84));
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(6, 15, 7, 4);
    g.fillRect(19, 15, 7, 4);
    for (const x of [5, 18]) {
      rect(g, x, 14, 9, 1, frame);
      rect(g, x, 15, 1, 3, frame);
      rect(g, x + 8, 15, 1, 3, frame);
      rect(g, x + 1, 19, 7, 1, rim);
      dot(g, x, 18, rim);
      dot(g, x + 8, 18, rim);
    }
    rect(g, 14, 15, 4, 1, frame);
    rect(g, 0, 15, 5, 1, frame);
    rect(g, 27, 15, 5, 1, frame);
  }
  if (key === 'mko') {
    rect(g, 7, 18, 5, 1, tone(skin, 0.86));
    rect(g, 20, 18, 5, 1, tone(skin, 0.86));
  }
  if (key === 'mj') {
    rect(g, 6, 12, 7, 1, tone(hair, 1.15));
    rect(g, 19, 12, 7, 1, tone(hair, 1.15));
    dot(g, 9, 16, '#ffffff');
    dot(g, 22, 16, '#ffffff');
    rect(g, 4, 28, 5, 2, tone(skin, 0.88));
    rect(g, 23, 28, 5, 2, tone(skin, 0.88));
  }
  if (key === 'kestrel') {
    rect(g, 18, 7, 14, 3, hair);
    rect(g, 23, 10, 9, 2, hair);
    rect(g, 27, 12, 5, 2, tone(hair, 0.85));
  }
}

function paintEar(g, face, c, key) {
  rect(g, 12, 18, 5, 6, tone(c.skin, 0.9));
  rect(g, 13, 19, 3, 3, tone(c.skin, 0.78));
  if (key === 'cj' && face === 'nx') {
    dot(g, 13, 23, c.accent);
    dot(g, 14, 24, tone(c.accent, 0.85));
  }
}

function paintHelm(g, face, c, key) {
  if (key === 'ashen') return helmFirelink(g, face, c);
  if (key === 'tarnished') return helmRagingWolf(g, face, c);
  return helmEliteKnight(g, face, c);
}

function helmEliteKnight(g, face, c) {
  metalBase(g, c.metal, face, 310);
  const dark = tone(c.metal, 0.45), hi = tone(c.metal, 1.25);
  if (face === 'ny') { charChainmail(g, face, c.metal); return; }
  if (face === 'py') {
    rect(g, 14, 0, 4, 32, hi);
    rect(g, 0, 14, 32, 3, tone(c.metal, 0.74));
    rect(g, 15, 0, 1, 32, tone(c.metal, 1.4));
    for (const x of [4, 24]) rivet(g, x, 14, c.metal);
  } else if (face === 'nz') {
    // Astora's closed barrel visor: a narrow dark eye slit and two vent rows.
    rect(g, 2, 10, 28, 2, '#181c1d');
    rect(g, 2, 9, 28, 1, hi);
    rect(g, 14, 0, 4, 10, hi);
    for (const y of [15, 21]) for (let x = 4; x < 29; x += 5) rect(g, x, y, 2, 4, '#252b2d');
    rect(g, 15, 12, 2, 17, hi);
    rect(g, 0, 29, 32, 3, dark);
    rect(g, 3, 28, 26, 1, hi);
    rivet(g, 1, 12, c.metal);
    rivet(g, 28, 12, c.metal);
  } else if (face === 'pz') {
    for (let x = 5; x < 32; x += 7) {
      rect(g, x, 1, 1, 26, dark);
      rect(g, x + 1, 1, 1, 26, hi);
    }
    rect(g, 0, 27, 32, 3, tone(c.leather, 0.8));
  } else {
    rect(g, sideSpan(face, 0, 15), 10, 15, 2, '#1f2526');
    rect(g, sideSpan(face, 15, 2), 0, 2, 28, hi);
    rivet(g, sideSpan(face, 13, 3), 12, c.metal);
    for (let y = 16; y < 26; y += 5) rect(g, sideSpan(face, 3, 2), y, 2, 3, dark);
    rect(g, 0, 28, 32, 3, dark);
  }
  charArmorWear(g, face, c, 311);
}

function charFirelinkEmbers(g, face, part, c) {
  if (face === 'ny' || face === 'py') return;
  const seed = 312 + TEX_FACES.indexOf(face) + part.length;
  for (let i = 0; i < 3; i++) {
    const x = 3 + ((rand2(i, 5, seed) * 25) | 0), y = 7 + i * 7;
    dot(g, x, y, c.accent);
    dot(g, x + 1, y + 1, '#eea15d');
    dot(g, x + 1, y + 2, tone(c.accent, 0.65));
  }
}

function helmFirelink(g, face, c) {
  metalBase(g, c.metal, face, 316);
  const dark = tone(c.metal, 0.42), hi = tone(c.metal, 1.2);
  if (face === 'ny') { charChainmail(g, face, c.metal); return; }
  for (let x = 3; x < 32; x += 5) {
    for (let y = 0; y < 30; y++) {
      const bend = Math.round(Math.sin(y * 0.25 + x) * 2);
      dot(g, x + bend, y, dark);
      dot(g, x + bend + 1, y, hi);
    }
  }
  if (face === 'nz') {
    rect(g, 2, 12, 28, 3, '#121313');
    rect(g, 14, 7, 3, 22, dark);
    rect(g, 17, 8, 1, 21, hi);
    for (const x of [5, 10, 21, 26]) rect(g, x, 19, 2, 7, '#252423');
    rect(g, 1, 29, 30, 2, '#34312c');
  } else if (face === 'pz') {
    rect(g, 0, 24, 32, 4, '#35322e');
    for (let x = 2; x < 32; x += 7) rivet(g, x, 22, c.metal);
  } else if (face === 'px' || face === 'nx') {
    rect(g, sideSpan(face, 1, 18), 13, 18, 2, '#171818');
    rect(g, sideSpan(face, 18, 3), 12, 3, 10, dark);
    rivet(g, sideSpan(face, 17, 3), 10, c.metal);
  }
  charArmorWear(g, face, c, 317);
  charFirelinkEmbers(g, face, 'head', c);
}

function charWolfEngraving(g, x, y, w, h, c) {
  const dark = tone(c.metal, 0.53), hi = tone(c.trim, 1.08);
  for (let row = 0; row < h - 3; row += 7) {
    for (let col = 1; col < w - 3; col += 7) {
      for (const p of [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2], [3, 3], [2, 4]]) {
        dot(g, x + col + p[0], y + row + p[1], hi);
        dot(g, x + col + p[0] + 1, y + row + p[1] + 1, dark);
      }
    }
  }
}

function helmRagingWolf(g, face, c) {
  metalBase(g, c.metal, face, 320);
  const hi = tone(c.trim, 1.05), dark = tone(c.metal, 0.47);
  if (face === 'ny') { charChainmail(g, face, c.metal); return; }
  charWolfEngraving(g, 1, 1, 30, face === 'py' ? 30 : 15, c);
  if (face === 'py') {
    rect(g, 14, 0, 4, 32, hi);
    rect(g, 15, 0, 1, 32, tone(c.metal, 0.74));
  } else if (face === 'nz') {
    clipRect(g, 0, 24, 32, 8, () => charChainmail(g, face, c.metal));
    for (let x = 1; x < 31; x++) {
      const y = 13 + Math.round((15 - Math.abs(x - 15)) * 0.32);
      rect(g, x, y, 1, 3, '#1a1c1b');
      dot(g, x, y - 1, hi);
      dot(g, x, y + 3, dark);
    }
    for (let y = 0; y < 27; y++) {
      const w = y < 14 ? 4 : Math.max(1, 4 - ((y - 14) >> 2));
      rect(g, 16 - w, y, w * 2, 1, hi);
      dot(g, 15, y, tone(c.metal, 0.77));
    }
    rect(g, 0, 24, 3, 8, c.leather);
    rect(g, 29, 24, 3, 8, c.leather);
  } else if (face === 'pz') {
    clipRect(g, 0, 22, 32, 10, () => charChainmail(g, face, c.metal));
    rect(g, 0, 18, 32, 3, hi);
    rect(g, 15, 0, 2, 20, dark);
  } else {
    clipRect(g, 0, 23, 32, 9, () => charChainmail(g, face, c.metal));
    for (let d = 1; d < 24; d++) {
      const y = 17 - Math.floor(d / 6);
      rect(g, sideSpan(face, d, 1), y, 1, 3, '#1a1d1c');
      dot(g, sideSpan(face, d, 1), y - 1, hi);
    }
    rect(g, sideSpan(face, 24, 3), 15, 3, 17, c.leather);
    rivet(g, sideSpan(face, 23, 3), 20, c.trim);
  }
  charArmorWear(g, face, c, 321);
}

function paintHead(g, face, c, key) {
  if (key === 'kratos') return headKratos(g, face, c);
  if (key === 'leon') return headLeon(g, face, c);
  if (c.style === 'knight') return paintHelm(g, face, c, key);
  skinBase(g, c, face);
  if (key === 'seif') hairSeif(g, face, c);
  else if (key === 'meedo') hairMeedo(g, face, c);
  else if (key === 'mko') hairMko(g, face, c);
  else if (key === 'mj') hairMj(g, face, c);
  else if (key === 'hokage') hairHokage(g, face, c);
  else if (key === 'oren') hairOren(g, face, c);
  else if (key === 'cj') hairCj(g, face, c);
  else if (key === 'mario') hairMario(g, face, c);
  else if (key === 'wolf') hairWolf(g, face, c);
  else hairBase(g, face, c);
  if (face === 'nz') paintFace(g, c, key);
  if (face === 'px' || face === 'nx') paintEar(g, face, c, key);
  paintHeadDetail(g, face, c, key);
}

/* ---- torsos ---- */
function torsoSteve(g, face, c) {
  clothBase(g, c.shirt, face, 11);
  const dark = tone(c.shirt, 0.78);
  if (face === 'py') {
    rect(g, 10, 7, 12, 16, dark);
    rect(g, 12, 9, 8, 12, c.skin);
    charStitches(g, 1, 3, 30, 25, tone(c.shirt, 1.16));
    return;
  }
  if (face === 'ny') { rect(g, 2, 2, 28, 28, tone(c.shirt, 0.7)); return; }
  if (face === 'nz') {
    rect(g, 12, 0, 8, 4, c.skin);
    rect(g, 13, 4, 6, 2, tone(c.skin, 0.85));
    rect(g, 10, 0, 2, 5, dark);
    rect(g, 20, 0, 2, 5, dark);
    rect(g, 0, 28, 32, 1, dark);
    rect(g, 5, 12, 1, 12, tone(c.shirt, 0.86));
    rect(g, 26, 12, 1, 12, tone(c.shirt, 1.08));
  } else if (face === 'pz') {
    rect(g, 0, 10, 32, 1, tone(c.shirt, 0.9));
    rect(g, 15, 4, 1, 22, tone(c.shirt, 0.94));
  } else {
    rect(g, 15, 0, 1, 28, dark);
    charStitches(g, 17, 3, 1, 25, tone(c.shirt, 1.15));
  }
  charStitches(g, 0, 29, 32, 1, tone(c.shirt, 1.15));
}

function torsoCj(g, face, c) {
  skinBase(g, c, face);
  const white = tone(c.shirt, FACE_MUL[face] || 1);
  if (face === 'py') {
    rect(g, 2, 0, 7, 32, white);
    rect(g, 23, 0, 7, 32, white);
    charStitches(g, 3, 1, 5, 30, tone(white, 0.82));
    charStitches(g, 24, 1, 5, 30, tone(white, 0.82));
    return;
  }
  if (face === 'ny') { clothBase(g, c.shirt, face, 304); return; }
  if (face === 'px' || face === 'nx') {
    rect(g, 0, 8, 32, 24, white);
    rect(g, 0, 7, 32, 2, tone(white, 0.86));
    rect(g, 15, 9, 1, 21, tone(white, 0.86));
    charStitches(g, 17, 9, 1, 21, tone(white, 0.92));
    rect(g, 0, 30, 32, 2, tone(white, 0.8));
    return;
  }
  // Plain sleeveless tank: the white fabric wraps the entire lower torso.
  rect(g, 0, 8, 32, 24, white);
  rect(g, 2, 0, 8, 8, white);
  rect(g, 22, 0, 8, 8, white);
  rect(g, 10, 6, 12, 2, white);
  if (face === 'nz') {
    rect(g, 10, 2, 12, 6, c.skin);
    rect(g, 11, 2, 10, 3, tone(c.skin, 1.04));
    rect(g, 8, 16, 1, 12, tone(white, 0.9));
    rect(g, 23, 16, 1, 12, tone(white, 0.9));
    rect(g, 12, 18, 1, 8, tone(white, 0.94));
  } else if (face === 'pz') {
    rect(g, 12, 2, 8, 3, c.skin);
    rect(g, 4, 10, 24, 1, tone(white, 0.9));
    rect(g, 8, 17, 1, 11, tone(white, 0.9));
    rect(g, 24, 17, 1, 11, tone(white, 0.92));
  }
  charStitches(g, 0, 29, 32, 1, tone(white, 0.84));
  rect(g, 0, 30, 32, 2, tone(white, 0.85));
}

function torsoMario(g, face, c) {
  clothBase(g, c.shirt, face, 12);
  const blue = tone(c.pants, FACE_MUL[face] || 1);
  const gold = c.accent;
  if (face === 'py') {
    rect(g, 4, 0, 6, 32, blue);
    rect(g, 22, 0, 6, 32, blue);
    rect(g, 12, 8, 8, 15, tone(c.shirt, 0.78));
    charStitches(g, 5, 1, 4, 30, tone(blue, 1.28));
    charStitches(g, 23, 1, 4, 30, tone(blue, 1.28));
    return;
  }
  if (face === 'ny') { clothBase(g, c.pants, face, 305); return; }
  if (face === 'nz') {
    rect(g, 3, 12, 26, 20, blue);
    rect(g, 9, 8, 14, 8, blue);
    rect(g, 5, 1, 5, 13, blue);
    rect(g, 22, 1, 5, 13, blue);
    rect(g, 13, 0, 6, 3, tone(c.shirt, 0.85));
    rect(g, 8, 11, 3, 3, gold);
    rect(g, 21, 11, 3, 3, gold);
    dot(g, 9, 12, tone(gold, 1.25));
    dot(g, 22, 12, tone(gold, 1.25));
    rect(g, 12, 17, 8, 1, tone(blue, 0.82));
    rect(g, 12, 17, 1, 7, tone(blue, 0.82));
    rect(g, 19, 17, 1, 7, tone(blue, 0.82));
    rect(g, 15, 19, 2, 2, gold);
    charStitches(g, 11, 16, 10, 9, tone(blue, 1.32));
    for (const x of [5, 22]) charStitches(g, x, 1, 5, 12, tone(blue, 1.3));
    rect(g, 15, 24, 2, 8, tone(blue, 0.88));
    rect(g, 3, 30, 26, 2, tone(blue, 0.8));
  } else if (face === 'pz') {
    rect(g, 3, 12, 26, 20, blue);
    rect(g, 5, 1, 5, 14, blue);
    rect(g, 22, 1, 5, 14, blue);
    rect(g, 8, 9, 16, 3, blue);
    rect(g, 4, 20, 24, 1, tone(blue, 0.85));
    for (const x of [6, 19]) {
      rect(g, x, 20, 8, 8, tone(blue, 0.9));
      charStitches(g, x, 20, 8, 8, tone(blue, 1.26));
    }
  } else {
    rect(g, 0, 13, 32, 19, blue);
    rect(g, 0, 13, 32, 1, tone(blue, 1.22));
    rect(g, 15, 14, 1, 18, tone(blue, 0.68));
    charStitches(g, 17, 15, 1, 15, tone(blue, 1.28));
    for (let y = 15; y < 23; y += 5) rivet(g, sideSpan(face, 7, 3), y, gold);
  }
}

function torsoUndead(g, face, c) {
  clothBase(g, c.shirt, face, 370);
  const base = tone(c.shirt, FACE_MUL[face] || 1), trim = tone(c.trim, 0.87);
  if (face === 'ny') { charChainmail(g, face, c.metal); return; }
  if (face === 'py') {
    charChainmail(g, face, c.metal);
    rect(g, 7, 4, 18, 24, c.leather);
    rect(g, 11, 8, 10, 16, '#343534');
    return;
  }
  if (face === 'nz' || face === 'pz') {
    for (const x of [0, 27]) clipRect(g, x, 0, 5, 25, () => charChainmail(g, face, c.metal));
    rect(g, 5, 0, 1, 26, trim);
    rect(g, 26, 0, 1, 26, trim);
    if (face === 'nz') {
      // Gold Astoran heraldry on the blue Elite Knight surcoat.
      for (const p of [[14, 9, 6, 2], [12, 11, 7, 2], [15, 13, 3, 6], [10, 16, 10, 2],
        [11, 18, 3, 4], [19, 18, 3, 4], [21, 13, 2, 5], [23, 10, 2, 4], [21, 9, 3, 1]]) {
        rect(g, p[0], p[1], p[2], p[3], trim);
      }
      dot(g, 18, 10, '#d6c693');
      rect(g, 8, 23, 17, 1, trim);
    } else {
      rect(g, 15, 5, 1, 19, tone(base, 0.71));
      for (let y = 0; y < 26; y++) {
        const x = 25 - Math.floor(y * 0.72);
        rect(g, x, y, 3, 1, c.leather);
        if (y % 4 === 0) dot(g, x, y, c.metal);
      }
    }
  } else {
    charChainmail(g, face, c.metal);
    rect(g, 8, 0, 16, 26, base);
    charStitches(g, 8, 1, 16, 24, trim);
  }
  rect(g, 0, 26, 32, 4, c.leather);
  charStitches(g, 0, 26, 32, 4, tone(c.leather, 1.45));
  if (face === 'nz') {
    rect(g, 12, 25, 7, 6, c.metal);
    rect(g, 14, 27, 3, 2, tone(c.leather, 0.6));
  }
}

function torsoAshen(g, face, c) {
  metalBase(g, c.metal, face, 371);
  const dark = tone(c.metal, 0.43), hi = tone(c.trim, 0.94);
  if (face === 'ny') { charChainmail(g, face, c.metal); return; }
  if (face === 'py') {
    rect(g, 8, 5, 16, 22, dark);
    rect(g, 11, 8, 10, 16, '#232323');
    charArmorWear(g, face, c, 372);
    return;
  }
  if (face === 'nz' || face === 'pz') {
    rect(g, 14, 3, 4, 24, dark);
    rect(g, 16, 4, 1, 21, hi);
    // Firelink's warped ribcage plates, rather than a glowing chest emblem.
    for (let row = 0; row < 5; row++) {
      for (let x = 3; x < 29; x++) {
        const y = 6 + row * 4 + Math.round(Math.abs(x - 16) / 6);
        dot(g, x, y, dark);
        dot(g, x, y + 1, hi);
      }
    }
    for (const x of [3, 27]) rect(g, x, 5, 2, 20, tone(c.metal, 0.67));
  } else {
    for (let y = 6; y < 26; y += 5) {
      rect(g, 0, y, 32, 2, dark);
      rect(g, 0, y + 2, 32, 1, hi);
    }
    rect(g, 14, 0, 4, 26, c.leather);
    rivet(g, 14, 16, c.metal);
  }
  rect(g, 0, 27, 32, 5, c.leather);
  charStitches(g, 0, 27, 32, 4, tone(c.leather, 1.48));
  if (face === 'nz') {
    rect(g, 11, 26, 8, 5, tone(c.metal, 0.82));
    rect(g, 13, 27, 4, 3, '#302820');
  }
  charArmorWear(g, face, c, 373);
  charFirelinkEmbers(g, face, 'torso', c);
}

function torsoWolf(g, face, c) {
  clothBase(g, c.shirt, face, 374);
  const base = tone(c.shirt, FACE_MUL[face] || 1), dark = tone(base, 0.64);
  if (face === 'py') {
    rect(g, 9, 4, 14, 24, '#4b4a42');
    charStitches(g, 1, 2, 30, 28, tone(base, 1.24));
    return;
  }
  if (face === 'ny') { clothBase(g, c.pants, face, 375); return; }
  if (face === 'nz') {
    rect(g, 10, 0, 12, 26, '#4b4a42');
    for (let y = 0; y < 21; y++) {
      const x = 6 + Math.floor(y * 0.34);
      rect(g, x, y, 3, 1, tone(base, 1.24));
      rect(g, 29 - x, y, 2, 1, dark);
    }
    for (let y = 6; y < 20; y += 4) rect(g, 12, y, 9, 1, '#666359');
    charStitches(g, 2, 7, 5, 18, tone(base, 1.38));
    charStitches(g, 25, 7, 5, 18, tone(base, 1.38));
  } else if (face === 'pz') {
    rect(g, 15, 1, 1, 25, dark);
    rect(g, 16, 1, 1, 25, tone(base, 1.26));
    rect(g, 3, 8, 26, 1, dark);
    charStitches(g, 2, 9, 28, 1, tone(base, 1.26));
    rect(g, 20, 15, 5, 6, tone(base, 0.76));
    charStitches(g, 20, 15, 5, 6, c.wrap);
  } else {
    rect(g, 15, 0, 1, 26, dark);
    charStitches(g, 17, 1, 1, 24, tone(base, 1.2));
  }
  for (const y of [25, 28]) {
    rect(g, 0, y, 32, 2, c.leather);
    rect(g, 0, y, 32, 1, c.wrap);
  }
  rect(g, 0, 31, 32, 1, dark);
}

function torsoFayoum(g, face, c) {
  clothBase(g, c.shirt, face, 6);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  const ink = c.trim || tone(c.accent, 0.5), gold = c.accent;
  if (face === 'nz') {
    rect(g, 12, 0, 8, 3, c.skin);
    rect(g, 14, 3, 4, 2, c.skin);
    rect(g, 15, 5, 2, 5, tone(c.skin, 0.74));
    rect(g, 11, 0, 1, 11, ink);
    rect(g, 20, 0, 1, 11, ink);
    rect(g, 11, 11, 10, 2, ink);
    for (let y = 1; y < 11; y += 2) {
      dot(g, 11, y, gold);
      dot(g, 20, y, gold);
    }
    rect(g, 6, 8, 1, 12, tone(base, 0.88));
    rect(g, 25, 8, 1, 12, tone(base, 0.88));
    rect(g, 15, 13, 2, 8, tone(base, 0.9));
  } else if (face === 'pz') {
    rect(g, 10, 0, 12, 2, ink);
    rect(g, 15, 2, 1, 19, tone(base, 0.88));
  }
  rect(g, 0, 21, 32, 7, gold);
  rect(g, 0, 21, 32, 1, tone(gold, 1.2));
  rect(g, 0, 23, 32, 3, ink);
  for (let x = 2; x < 32; x += 4) rect(g, x, 24, 2, 1, gold);
  rect(g, 0, 27, 32, 1, tone(gold, 0.72));
  rect(g, 0, 30, 32, 2, tone(base, 0.84));
}

function torsoTarnished(g, face, c) {
  metalBase(g, c.metal, face, 376);
  const dark = tone(c.metal, 0.55), hi = tone(c.trim, 1.04);
  if (face === 'ny') { clothBase(g, c.accent, face, 377); return; }
  if (face === 'py') {
    charWolfEngraving(g, 1, 1, 30, 30, c);
    rect(g, 10, 7, 12, 18, dark);
    rect(g, 12, 9, 8, 14, '#303232');
    return;
  }
  if (face === 'nz' || face === 'pz') {
    charWolfEngraving(g, 1, 1, 30, 16, c);
    for (let y = 15; y < 25; y += 4) {
      rect(g, 0, y, 32, 1, dark);
      rect(g, 2, y + 1, 28, 1, hi);
    }
    rect(g, 15, 3, 2, 23, hi);
    for (let y = 0; y < 27; y++) {
      const x = face === 'nz' ? 26 - Math.floor(y * 0.7) : 3 + Math.floor(y * 0.7);
      rect(g, x, y, 3, 1, c.leather);
      if (y % 3 === 0) dot(g, x, y, tone(c.leather, 1.48));
    }
  } else {
    for (let y = 4; y < 25; y += 5) {
      rect(g, 0, y, 32, 2, dark);
      rect(g, 0, y + 2, 32, 1, hi);
    }
    rect(g, 12, 1, 5, 26, c.leather);
    rivet(g, 13, 13, c.trim);
  }
  charArmorWear(g, face, c, 378);
  rect(g, 0, 26, 32, 3, c.leather);
  rect(g, 0, 29, 32, 3, c.accent);
  charStitches(g, 0, 26, 32, 3, tone(c.leather, 1.5));
  if (face === 'nz') {
    rect(g, 11, 25, 7, 4, c.trim);
    rect(g, 13, 26, 3, 2, dark);
  }
}

/* ---------------- Norse Kratos / RE4 Leon ---------------- */
function headKratos(g, face, c) {
  skinBase(g, c, face);
  const skin = tone(c.skin, FACE_MUL[face] || 1), red = tone(c.tattoo, FACE_MUL[face] || 1);
  if (face === 'py') {
    rect(g, 10, 6, 15, 18, tone(skin, 1.04));
    for (let y = 0; y < 32; y++) rect(g, 2 + Math.floor(y / 8), y, 6, 1, red);
    return; // Intentionally bald: never run a shared hair painter here.
  }
  if (face === 'ny') {
    rect(g, 3, 19, 26, 13, tone(c.hair, 0.7));
    rect(g, 7, 24, 18, 8, c.hair);
    return;
  }
  if (face === 'nz') {
    rect(g, 4, 5, 24, 2, tone(skin, 0.95));
    rect(g, 10, 9, 12, 1, tone(skin, 0.84));
    for (let y = 0; y < 29; y++) rect(g, 25 - Math.floor(y * 0.24), y, 6, 1, red);
    rect(g, 3, 20, 26, 12, c.hair);
    rect(g, 7, 19, 18, 4, skin);
    rect(g, 10, 22, 12, 3, tone(c.hair, 0.75));
    rect(g, 12, 25, 8, 1, '#51382f');
    for (let x = 4; x < 29; x += 3) rect(g, x, 27 - x % 3, 1, 5 + x % 3, tone(c.hair, 1.42));
    eye(g, 7, 15, null);
    eye(g, 20, 15, null);
    rect(g, 6, 12, 7, 2, tone(c.hair, 0.83));
    rect(g, 19, 12, 7, 2, tone(c.hair, 0.83));
    rect(g, 14, 17, 4, 6, tone(skin, 0.82));
    rect(g, 15, 17, 2, 4, tone(skin, 1.1));
    rect(g, 12, 21, 2, 1, tone(skin, 0.68));
    rect(g, 18, 21, 2, 1, tone(skin, 0.68));
    rect(g, 8, 10, 1, 10, '#936f66');
    dot(g, 7, 17, tone(skin, 0.9));
  } else if (face === 'pz') {
    rect(g, 8, 7, 16, 15, tone(skin, 1.04));
    for (let y = 0; y < 32; y++) rect(g, 6 - Math.floor(y / 12), y, 6, 1, red);
    rect(g, 11, 27, 10, 2, tone(skin, 0.84));
  } else {
    rect(g, 20, 8, 8, 14, tone(skin, 1.04));
    if (face === 'nx') {
      for (let d = 0; d < 32; d++) rect(g, sideSpan(face, d, 1), 3 + Math.floor(d / 7), 1, 6, red);
    }
    rect(g, sideSpan(face, 0, 6), 20, 6, 12, c.hair);
    rect(g, sideSpan(face, 6, 7), 26, 7, 6, tone(c.hair, 0.86));
    paintEar(g, face, c, 'kratos');
  }
}

function torsoKratos(g, face, c) {
  skinBase(g, c, face);
  const m = FACE_MUL[face] || 1, skin = tone(c.skin, m), leather = tone(c.leather, m), red = tone(c.tattoo, m);
  if (face === 'py') {
    rect(g, 0, 0, 9, 32, leather);
    clipRect(g, 1, 0, 6, 32, () => charFurBase(g, c.fur, face, 331));
    rect(g, 11, 8, 10, 16, tone(skin, 0.85));
    return;
  }
  if (face === 'ny') { charLeatherBase(g, c.leather, face, 332); return; }
  if (face === 'nz') {
    rect(g, 4, 9, 10, 2, tone(skin, 0.79));
    rect(g, 18, 9, 10, 2, tone(skin, 0.79));
    rect(g, 15, 9, 2, 16, tone(skin, 0.82));
    for (const y of [17, 23]) {
      rect(g, 9, y, 5, 1, tone(skin, 0.84));
      rect(g, 18, y, 5, 1, tone(skin, 0.84));
    }
    for (let y = 0; y < 24; y++) rect(g, 22 - Math.floor(y * 0.24), y, 5, 1, red);
    for (let y = 0; y < 28; y++) {
      const x = 26 - Math.floor(y * 0.78);
      rect(g, x, y, 5, 1, leather);
      if (y % 3 === 0) dot(g, x + 1, y, tone(c.accent, 0.8));
    }
    rivet(g, 17, 11, c.accent);
    rect(g, 4, 18, 7, 1, '#937b72');
  } else if (face === 'pz') {
    rect(g, 15, 4, 2, 20, tone(skin, 0.82));
    for (let y = 0; y < 25; y++) {
      rect(g, 3 + Math.floor(y * 0.7), y, 5, 1, leather);
      rect(g, 5, y, 4, 1, red);
    }
    rect(g, 8, 9, 17, 4, leather);
    charStitches(g, 8, 9, 17, 4, c.accent);
  } else {
    if (face === 'nx') rect(g, 0, 3, 32, 5, red);
    rect(g, 4, 16, 1, 8, tone(skin, 0.81));
    rect(g, 25, 15, 1, 9, tone(skin, 0.81));
  }
  clipRect(g, 0, 26, 32, 6, () => charLeatherBase(g, c.leather, face, 333));
  rect(g, 0, 27, 32, 1, tone(c.accent, 0.68));
  if (face === 'nz') {
    rect(g, 13, 26, 7, 5, c.accent);
    rect(g, 15, 27, 3, 3, tone(leather, 0.58));
  }
}

function armKratos(g, face, c, side) {
  skinBase(g, c, face);
  const m = FACE_MUL[face] || 1;
  if (face === 'ny') { charLeatherBase(g, c.leather, face, 334); return; }
  if (face === 'py') {
    if (side === 'L') charFurBase(g, c.fur, face, 335);
    else rect(g, 5, 6, 22, 20, tone(c.skin, m * 1.04));
    return;
  }
  rect(g, 5, 8, 2, 10, tone(c.skin, m * 0.84));
  rect(g, 24, 6, 2, 11, tone(c.skin, m * 1.05));
  rect(g, 0, 17, 32, 1, tone(c.skin, m * 0.78));
  if (side === 'L') {
    for (let x = 0; x < 32; x++) rect(g, x, 5 + Math.floor(x / 12), 1, 5, tone(c.tattoo, m));
  }
  clipRect(g, 0, 20, 32, 12, () => charLeatherBase(g, c.leather, face, side === 'L' ? 336 : 337));
  for (const y of [21, 26, 30]) rect(g, 0, y, 32, 1, tone(c.accent, 0.72));
  if (face === (side === 'L' ? 'nx' : 'px')) {
    rect(g, 8, 21, 16, 8, tone(c.metal, 0.75));
    rivet(g, 10, 23, c.accent);
    rivet(g, 19, 23, c.accent);
  }
}

function handKratos(g, face, c) {
  skinBase(g, c, face);
  if (face === 'py') { charLeatherBase(g, c.leather, face, 338); return; }
  rect(g, 0, 0, 32, 8, tone(c.leather, FACE_MUL[face] || 1));
  rect(g, 0, 6, 32, 2, tone(c.accent, 0.65));
  if (face === 'nz' || face === 'pz') {
    for (let x = 6; x < 28; x += 6) {
      rect(g, x, 16, 1, 13, tone(c.skin, 0.76));
      rect(g, x - 3, 13, 3, 2, tone(c.skin, 1.08));
    }
  } else if (face !== 'ny') rect(g, 12, 13, 2, 14, tone(c.skin, 0.8));
}

function legKratos(g, face, c, side) {
  clothBase(g, c.pants, face, side === 'L' ? 339 : 340);
  const base = tone(c.pants, FACE_MUL[face] || 1);
  if (face === 'py') { charLeatherBase(g, c.leather, face, 341); return; }
  if (face === 'ny') { rect(g, 0, 0, 32, 32, tone(c.shoe, 0.72)); return; }
  rect(g, 15, 0, 1, 16, tone(base, 0.62));
  charStitches(g, 17, 0, 1, 16, tone(base, 1.3));
  clipRect(g, 0, 16, 32, 16, () => charLeatherBase(g, c.shoe, face, 342));
  for (let y = 16; y < 32; y += 4) {
    rect(g, 0, y, 32, 2, tone(c.leather, y % 8 ? 0.85 : 1.12));
    rect(g, 0, y + 2, 32, 1, tone(c.accent, 0.66));
  }
  if (face === 'nz') {
    rect(g, 6, 12, 20, 6, tone(c.leather, 1.08));
    rivet(g, side === 'L' ? 8 : 21, 13, c.accent);
  }
}

function shoeKratos(g, face, c) {
  charLeatherBase(g, c.shoe, face, 343);
  if (face === 'ny') {
    rect(g, 0, 0, 32, 32, '#231e19');
    for (let y = 3; y < 32; y += 6) rect(g, 3, y, 26, 2, '#3c3024');
    return;
  }
  if (face === 'py') {
    rect(g, 7, 6, 18, 17, tone(c.leather, 0.86));
    for (const y of [8, 15, 22]) rect(g, 4, y, 24, 3, c.leather);
    return;
  }
  rect(g, 0, 26, 32, 6, tone(c.shoe, 0.5));
  rect(g, 0, 26, 32, 1, tone(c.accent, 0.65));
  if (face === 'nz') rect(g, 5, 10, 22, 6, tone(c.leather, 1.12));
  else if (face === 'pz') rect(g, 12, 1, 8, 23, tone(c.leather, 0.68));
  else rect(g, 0, 9, 32, 3, tone(c.leather, 1.05));
}

function paintKratosAxe(g, face, c) {
  metalBase(g, c.metal, face, 344);
  const hi = '#d4e5e6', dark = '#384e55';
  if (face === 'nz' || face === 'pz') {
    rect(g, 3, 5, 24, 22, dark);
    for (let y = 2; y < 30; y++) {
      const x = 26 - Math.round(Math.sin(y / 29 * Math.PI) * 5);
      rect(g, x, y, 32 - x, 1, hi);
      dot(g, x - 1, y, '#7fb1be');
    }
    for (const p of [[7, 9], [10, 6], [13, 9], [10, 12], [7, 17], [10, 20], [13, 17], [10, 24]]) {
      rect(g, p[0], p[1], 1, 4, c.accent);
      dot(g, p[0] + 1, p[1] + 1, '#acd1d9');
    }
    rivet(g, 3, 14, c.accent);
  } else {
    rect(g, 13, 0, 6, 32, hi);
    rect(g, 12, 0, 1, 32, dark);
  }
}

function paintKratosHaft(g, face, c) {
  charLeatherBase(g, '#66492d', face, 345);
  for (let x = 3; x < 32; x += 6) rect(g, x, 0, 1, 32, '#3b2a1c');
  for (let y = 14; y < 31; y += 3) {
    rect(g, 0, y, 32, 2, '#352c24');
    rect(g, 0, y, 32, 1, tone(c.accent, 0.64));
  }
}

function hairLeon(g, face, c) {
  const base = tone(c.hair, FACE_MUL[face] || 1), hi = tone(base, 1.42), lo = tone(base, 0.65);
  if (face === 'ny') { rect(g, 0, 0, 32, 4, lo); return; }
  if (face === 'py' || face === 'pz') {
    rect(g, 0, 0, 32, 32, base);
    for (let y = 0; y < 32; y++) {
      for (let x = -12; x < 40; x += 4) {
        const dx = x + Math.floor(y * (face === 'py' ? 0.55 : 0.18));
        dot(g, dx, y, hi);
        dot(g, dx + 1, y, lo);
      }
    }
    if (face === 'py') rect(g, 8, 1, 2, 28, lo);
    else rect(g, 0, 31, 32, 1, lo);
  } else if (face === 'nz') {
    for (let x = 0; x < 32; x++) {
      const d = x < 23 ? 6 + Math.floor((23 - x) * 0.47) : 5 + Math.floor((x - 23) * 0.7);
      rect(g, x, 0, 1, d, base);
      dot(g, x, d - 1, lo);
      if (x % 3 === 0) rect(g, x, 0, 1, d - 2, hi);
    }
    rect(g, 22, 0, 2, 5, lo);
    rect(g, 0, 5, 3, 16, base);
    rect(g, 29, 5, 3, 14, base);
  } else {
    rect(g, 0, 0, 32, 10, base);
    rect(g, sideSpan(face, 0, 4), 7, 4, 14, base);
    charNapeSide(g, face, c, 9, base, lo, hi);
    for (let x = 2; x < 32; x += 4) rect(g, x, 0, 1, 9, hi);
  }
}

function headLeon(g, face, c) {
  skinBase(g, c, face);
  hairLeon(g, face, c);
  if (face === 'nz') {
    paintFace(g, c, 'leon');
    for (const x of [7, 20]) {
      rect(g, x + 1, 16, 3, 2, '#688b9b');
      dot(g, x + 2, 16, '#20333b');
      dot(g, x + 1, 16, '#eef1ee');
    }
    rect(g, 5, 22, 4, 1, tone(c.skin, 0.84));
    rect(g, 23, 22, 4, 1, tone(c.skin, 0.84));
    rect(g, 12, 25, 8, 1, '#865b50');
    rect(g, 14, 27, 4, 1, tone(c.skin, 1.05));
    // A loose swept lock overlaps the outer brow, rather than a buzz-cut edge.
    rect(g, 5, 9, 3, 8, c.hair);
    rect(g, 6, 10, 1, 6, tone(c.hair, 1.32));
    dot(g, 7, 17, tone(c.hair, 0.64));
  } else if (face === 'px' || face === 'nx') paintEar(g, face, c, 'leon');
}

function torsoLeon(g, face, c) {
  charLeatherBase(g, c.leather, face, 350);
  const m = FACE_MUL[face] || 1, base = tone(c.leather, m);
  if (face === 'py') {
    clipRect(g, 7, 3, 18, 25, () => charFurBase(g, c.fur, face, 351));
    rect(g, 11, 7, 10, 18, c.under);
    charStitches(g, 1, 2, 30, 28, tone(base, 1.28));
    return;
  }
  if (face === 'ny') { rect(g, 2, 2, 28, 28, c.under); return; }
  if (face === 'nz') {
    rect(g, 10, 0, 12, 29, tone(c.under, m));
    rect(g, 13, 0, 6, 3, c.skin);
    rect(g, 11, 4, 10, 1, tone(c.under, 0.62));
    rect(g, 12, 13, 1, 14, tone(c.under, 1.22));
    for (let y = 0; y < 13; y++) {
      const x = 5 + Math.floor(y * 0.36);
      clipRect(g, x, y, 4, 1, () => charFurBase(g, c.fur, face, 352));
      clipRect(g, 28 - x, y, 4, 1, () => charFurBase(g, c.fur, face, 352));
    }
    for (const x of [8, 23]) {
      rect(g, x, 13, 1, 15, tone(c.metal, 0.8));
      for (let y = 14; y < 28; y += 3) dot(g, x, y, tone(c.metal, 1.12));
    }
    for (let y = 19; y < 26; y++) {
      dot(g, 2 + Math.floor((y - 19) / 2), y, tone(base, 0.5));
      dot(g, 29 - Math.floor((y - 19) / 2), y, tone(base, 0.5));
    }
  } else if (face === 'pz') {
    rect(g, 0, 7, 32, 1, tone(base, 0.54));
    charStitches(g, 1, 8, 30, 1, tone(base, 1.32));
    rect(g, 6, 10, 1, 15, tone(base, 0.66));
    rect(g, 25, 10, 1, 15, tone(base, 0.66));
    rect(g, 15, 9, 2, 18, tone(base, 1.15));
  } else {
    rect(g, 15, 1, 1, 26, tone(base, 0.53));
    charStitches(g, 17, 2, 1, 25, tone(base, 1.36));
    rect(g, 2, 21, 28, 3, tone(base, 0.73));
    rivet(g, sideSpan(face, 4, 3), 21, c.metal);
  }
  clipRect(g, 0, 28, 32, 4, () => charFurBase(g, c.fur, face, 353));
}

function armLeon(g, face, c, side) {
  charLeatherBase(g, c.sleeve, face, side === 'L' ? 354 : 355);
  const base = tone(c.sleeve, FACE_MUL[face] || 1);
  if (face === 'py') { charStitches(g, 3, 3, 26, 26, tone(base, 1.4)); return; }
  if (face === 'ny') { charFurBase(g, c.fur, face, 356); return; }
  rect(g, 14, 2, 1, 23, tone(base, 0.56));
  charStitches(g, 16, 3, 1, 23, tone(base, 1.34));
  for (const y of [14, 18, 22]) {
    rect(g, 5, y, 22, 1, tone(base, 0.72));
    rect(g, 8, y + 1, 16, 1, tone(base, 1.2));
  }
  if (face === 'pz') rect(g, 5, 13, 22, 7, tone(base, 0.88));
  clipRect(g, 0, 26, 32, 6, () => charFurBase(g, c.fur, face, 357));
  rect(g, 0, 26, 32, 1, tone(base, 0.45));
}

function handLeon(g, face, c, side) {
  charLeatherBase(g, c.glove, face, side === 'L' ? 358 : 359);
  const base = tone(c.glove, FACE_MUL[face] || 1);
  if (face === 'py') { rect(g, 6, 6, 20, 20, tone(base, 0.62)); return; }
  if (face === 'ny') {
    skinBase(g, c, face);
    for (const x of [7, 14, 21]) rect(g, x, 0, 1, 32, tone(c.skin, 0.73));
    return;
  }
  rect(g, 0, 0, 32, 5, tone(base, 0.7));
  rect(g, 0, 23, 32, 9, tone(c.skin, FACE_MUL[face] || 1));
  for (let x = 6; x < 29; x += 6) rect(g, x, 17, 1, 15, tone(base, 0.7));
  if (face === 'pz') {
    rect(g, 5, 9, 22, 7, tone(base, 1.38));
    for (let x = 7; x < 27; x += 6) rect(g, x, 10, 3, 4, tone(base, 0.72));
  } else if (face === 'nz') rect(g, 6, 12, 20, 2, tone(base, 1.25));
}

function legLeon(g, face, c, side) {
  clothBase(g, c.pants, face, side === 'L' ? 360 : 361);
  const base = tone(c.pants, FACE_MUL[face] || 1);
  if (face === 'py') { rect(g, 0, 0, 32, 32, tone(base, 0.65)); return; }
  if (face === 'ny') { charLeatherBase(g, c.shoe, face, 362); return; }
  rect(g, 0, 0, 32, 3, c.under);
  if (face === 'nz') {
    rect(g, 7, 14, 18, 7, tone(base, 0.87));
    charStitches(g, 7, 14, 18, 7, tone(base, 1.24));
    rect(g, 15, 4, 1, 9, tone(base, 1.22));
  } else if (face === 'pz') {
    rect(g, 6, 4, 20, 7, tone(base, 0.76));
    charStitches(g, 6, 4, 20, 7, tone(base, 1.25));
    rect(g, 8, 4, 16, 2, tone(base, 1.07));
  } else {
    rect(g, 15, 2, 1, 25, tone(base, 0.65));
    charStitches(g, 17, 3, 1, 24, tone(base, 1.28));
    if (face === (side === 'L' ? 'nx' : 'px')) {
      rect(g, 4, 7, 24, 10, tone(base, 0.78));
      charStitches(g, 4, 7, 24, 10, tone(base, 1.24));
      rect(g, 4, 7, 24, 3, tone(base, 1.1));
    }
  }
  if (side === 'R') for (const y of [6, 13]) {
    rect(g, 0, y, 32, 2, '#222526');
    if (face === 'px') rect(g, 11, y - 1, 8, 4, c.metal);
  }
  rect(g, 0, 27, 32, 5, tone(c.shoe, FACE_MUL[face] || 1));
  rect(g, 0, 27, 32, 1, tone(base, 1.1));
}

function shoeLeon(g, face, c) {
  charLeatherBase(g, c.shoe, face, 363);
  const base = tone(c.shoe, FACE_MUL[face] || 1);
  if (face === 'ny') {
    rect(g, 0, 0, 32, 32, '#101213');
    for (let y = 2; y < 31; y += 5) for (const x of [3, 19]) rect(g, x, y, 10, 3, '#36393a');
    return;
  }
  if (face === 'py' || face === 'nz') {
    rect(g, 8, 3, 16, 18, tone(base, 0.68));
    for (let y = 5; y < 20; y += 4) {
      rect(g, 10, y, 12, 1, '#696a65');
      dot(g, 8, y, c.metal);
      dot(g, 23, y, c.metal);
    }
    rect(g, 4, 22, 24, 3, tone(base, 1.64));
  } else if (face === 'pz') {
    rect(g, 12, 1, 8, 22, tone(base, 1.38));
    charStitches(g, 11, 1, 10, 23, tone(base, 1.8));
  } else {
    rect(g, 0, 18, 32, 1, tone(base, 1.8));
    charStitches(g, 3, 6, 26, 17, tone(base, 1.4));
  }
  if (face !== 'py') {
    rect(g, 0, 27, 32, 5, '#101213');
    for (let x = 1; x < 32; x += 5) rect(g, x, 28, 3, 2, '#36393a');
  }
}

function paintLeonHolster(g, face, c) {
  charLeatherBase(g, '#30302b', face, 364);
  if (face === 'py') { rect(g, 6, 6, 20, 20, '#171b1c'); return; }
  if (face === 'ny') { rect(g, 4, 4, 24, 24, '#252824'); return; }
  rect(g, 12, 0, 8, 19, '#1e2423');
  rect(g, 10, 12, 12, 6, c.metal);
  rect(g, 12, 13, 8, 3, '#252a29');
  charStitches(g, 3, 2, 26, 27, '#827665');
}

/* ---------------- Seif, Meedo, Kestrel, Oren ---------------- */
const PIX_GLYPHS = {
  S: ['111', '100', '111', '001', '111'],
  E: ['111', '100', '110', '100', '111'],
  I: ['111', '010', '010', '010', '111'],
  F: ['111', '100', '110', '100', '100']
};

function pixelText(g, text, x, y, color) {
  for (let i = 0; i < text.length; i++) {
    const rows = PIX_GLYPHS[text[i]];
    if (!rows) continue;
    for (let r = 0; r < rows.length; r++) {
      for (let k = 0; k < 3; k++) {
        if (rows[r][k] === '1') dot(g, x + i * 4 + k, y + r, color);
      }
    }
  }
}

function clipRect(g, x, y, w, h, draw) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  draw();
  g.restore();
}

/* On the head's side tiles, nx runs front-to-back and px runs back-to-front. */
function sideSpan(face, fromFront, w) {
  return face === 'nx' ? fromFront : 32 - fromFront - w;
}

function hairSpeckle(g, x, y, w, h, hi, lo, seed, count) {
  for (let i = 0; i < count; i++) {
    const px = x + ((rand2(i, 3, seed) * w) | 0);
    const py = y + ((rand2(i, 7, seed) * h) | 0);
    dot(g, px, py, rand2(i, 5, seed) > 0.5 ? hi : lo);
  }
}

/* Small repeating arcs read as curls; random dots would read as static. */
function curlTexture(g, x, y, w, h, hi, lo) {
  for (let r = 0; r * 5 < h; r++) {
    for (let k = 0; k * 5 < w + 5; k++) {
      const cx = x + k * 5 + (r % 2 ? 2 : 0) - 2, cy = y + r * 5;
      rect(g, cx, cy, 2, 1, hi);
      dot(g, cx + 2, cy + 1, hi);
      rect(g, cx, cy + 2, 2, 1, lo);
      dot(g, cx - 1, cy + 1, lo);
    }
  }
}

/* ---- hair ---- */
function hairSeif(g, face, c) {
  const m = FACE_MUL[face] || 1;
  const base = tone(c.hair, m), hi = tone(base, 1.35), lo = tone(base, 0.76);
  const fade = blendHex(base, tone(c.skin, m), 0.5);
  if (face === 'py') {
    rect(g, 0, 0, 32, 32, base);
    hairSpeckle(g, 0, 0, 32, 32, hi, lo, 71, 60);
    return;
  }
  if (face === 'nz') {
    for (let x = 0; x < 32; x++) {
      const d = 6 + Math.round(Math.abs(x - 15.5) / 5) + Math.round(rand2(x, 1, 73) * 1.4);
      rect(g, x, 0, 1, d, base);
      rect(g, x, d - 1, 1, 1, lo);
    }
    rect(g, 0, 0, 2, 22, base);
    rect(g, 30, 0, 2, 22, base);
    hairSpeckle(g, 0, 0, 32, 6, hi, lo, 74, 34);
  } else if (face === 'pz') {
    rect(g, 0, 0, 32, 26, base);
    rect(g, 0, 26, 32, 6, fade);
    hairSpeckle(g, 0, 0, 32, 26, hi, lo, 75, 60);
    hairSpeckle(g, 0, 26, 32, 6, tone(base, 1.16), fade, 75, 48);
  } else {
    const beard = tone(c.hair, m * 1.12);
    rect(g, 0, 0, 32, 8, base);
    rect(g, 0, 8, 32, 5, fade);
    rect(g, sideSpan(face, 15, 17), 13, 17, 4, fade);
    rect(g, sideSpan(face, 0, 4), 8, 4, 14, base);
    rect(g, sideSpan(face, 0, 4), 21, 4, 5, beard);
    rect(g, sideSpan(face, 0, 12), 26, 12, 6, beard);
    hairSpeckle(g, 0, 0, 32, 8, hi, lo, 76, 18);
    charNapeSide(g, face, c, 12, base, fade, hi);
  }
}

function hairMeedo(g, face, c) {
  const m = FACE_MUL[face] || 1;
  const base = tone(c.hair, m), hi = tone(base, 1.5), lo = tone(base, 0.68);
  const fade = blendHex(base, tone(c.skin, m), 0.55);
  if (face === 'py') {
    rect(g, 0, 0, 32, 32, base);
    curlTexture(g, 0, 0, 32, 32, hi, lo);
    return;
  }
  if (face === 'nz') {
    for (let x = 0; x < 32; x++) {
      const d = 7 + Math.round(Math.abs(x - 15.5) / 7) + Math.round(rand2(x, 2, 83) * 2);
      rect(g, x, 0, 1, d, base);
    }
    rect(g, 0, 0, 3, 15, base);
    rect(g, 29, 0, 3, 15, base);
    curlTexture(g, 0, 0, 32, 6, hi, lo);
  } else if (face === 'pz') {
    rect(g, 0, 0, 32, 28, base);
    rect(g, 0, 28, 32, 4, fade);
    clipRect(g, 0, 0, 32, 28, () => curlTexture(g, 0, 0, 32, 28, hi, lo));
    hairSpeckle(g, 0, 28, 32, 4, base, fade, 84, 40);
  } else {
    rect(g, 0, 0, 32, 8, base);
    rect(g, 0, 8, 32, 5, fade);
    rect(g, sideSpan(face, 0, 3), 8, 3, 8, base);
    rect(g, sideSpan(face, 15, 17), 13, 17, 4, blendHex(fade, tone(c.skin, m), 0.45));
    curlTexture(g, 0, 0, 32, 6, hi, lo);
    charNapeSide(g, face, c, 12, base, fade, hi);
  }
}

function hairOren(g, face, c) {
  const m = FACE_MUL[face] || 1;
  const base = tone(c.hair, m), lo = tone(base, 0.76);
  const fade = blendHex(base, tone(c.skin, m), 0.55);
  if (face === 'py') {
    rect(g, 0, 0, 32, 32, base);
    hairSpeckle(g, 0, 0, 32, 32, tone(base, 1.08), lo, 91, 80);
    return;
  }
  if (face === 'nz') {
    for (let x = 0; x < 32; x++) {
      const d = 5 + Math.round(Math.abs(x - 15.5) / 8) + (rand2(x, 3, 92) > 0.6 ? 1 : 0);
      rect(g, x, 0, 1, d, base);
      dot(g, x, d - 1, lo);
    }
    hairSpeckle(g, 0, 0, 32, 5, tone(base, 1.06), tone(base, 0.8), 93, 30);
    rect(g, 0, 0, 2, 11, fade);
    rect(g, 30, 0, 2, 11, fade);
  } else if (face === 'pz') {
    rect(g, 0, 0, 32, 28, base);
    rect(g, 0, 28, 32, 4, fade);
    hairSpeckle(g, 0, 0, 32, 28, tone(base, 1.06), lo, 94, 120);
    hairSpeckle(g, 0, 28, 32, 4, base, fade, 94, 36);
  } else {
    rect(g, 0, 0, 32, 6, base);
    rect(g, 0, 6, 32, 4, fade);
    hairSpeckle(g, 0, 0, 32, 6, tone(base, 1.06), tone(base, 0.76), 95, 36);
    charNapeSide(g, face, c, 9, base, fade, tone(base, 1.06));
  }
}

function paintHeadDetail(g, face, c, key) {
  if (key === 'meedo' && (face === 'px' || face === 'nx')) {
    rect(g, sideSpan(face, 0, 13), 15, 13, 1, '#0e0e10');
    rect(g, 13, 19, 3, 3, c.accent);
    rect(g, 14, 22, 1, 10, c.accent);
  }
  if (key === 'hokage' && (face === 'px' || face === 'nx')) {
    rect(g, sideSpan(face, 0, 13), 15, 13, 1, '#141416');
  }
  if (key === 'hokage') emberDetail(g, 'head', face, c);
}

function paintHairCap(g, face, c, seed, curly) {
  const base = tone(c.hair, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  if (curly) curlTexture(g, 0, 0, 32, 32, tone(base, 1.5), tone(base, 0.68));
  else hairSpeckle(g, 0, 0, 32, 32, tone(base, 1.16), tone(base, 0.84), seed, 70);
}

/* ---- shared street clothes ---- */
function torsoTee(g, face, c, seed) {
  clothBase(g, c.shirt, face, seed);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  const dark = tone(base, 0.68);
  if (face === 'nz') {
    rect(g, 11, 0, 10, 3, c.skin);
    rect(g, 12, 3, 8, 1, tone(c.skin, 0.88));
    rect(g, 10, 0, 1, 4, dark);
    rect(g, 21, 0, 1, 4, dark);
    rect(g, 11, 4, 10, 1, dark);
    rect(g, 6, 22, 7, 1, tone(base, 0.86));
    rect(g, 8, 23, 6, 1, tone(base, 1.1));
    rect(g, 19, 24, 7, 1, tone(base, 0.86));
    rect(g, 17, 25, 6, 1, tone(base, 1.1));
  } else if (face === 'pz') {
    rect(g, 10, 0, 12, 2, dark);
    rect(g, 15, 2, 2, 24, tone(base, 0.93));
  }
  rect(g, 0, 28, 32, 1, tone(base, 1.28));
  rect(g, 0, 29, 32, 3, tone(base, 0.78));
}

function armTee(g, face, c, seed) {
  if (face === 'py') { clothBase(g, c.shirt, face, seed); return; }
  skinBase(g, c, face);
  const m = FACE_MUL[face] || 1;
  rect(g, 0, 17, 32, 1, tone(c.skin, m * 0.9));
  clipRect(g, 0, 0, 32, 13, () => clothBase(g, c.shirt, face, seed));
}

function paintTeeSleeve(g, face, c, seed) {
  clothBase(g, c.shirt, face, seed);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  rect(g, 0, 26, 32, 1, tone(base, 1.25));
  rect(g, 0, 27, 32, 5, tone(base, 0.72));
}

function addTeeSleeves(armL, armR, key, c) {
  const paint = (g, f) => paintTeeSleeve(g, f, c, 112);
  paintedBox(armL, 0.205, 0.27, 0.225, 'tee-' + key, paint, 0, -0.115, 0);
  paintedBox(armR, 0.205, 0.27, 0.225, 'tee-' + key, paint, 0, -0.115, 0);
}

function shoeSneaker(g, face, c) {
  const base = tone(c.shoe, FACE_MUL[face] || 1);
  const sole = '#f1efe6';
  rect(g, 0, 0, 32, 32, base);
  if (face === 'py') {
    rect(g, 7, 7, 18, 18, tone(base, 0.84));
    rect(g, 10, 10, 12, 12, tone(base, 0.68));
    return;
  }
  if (face === 'ny') {
    rect(g, 0, 0, 32, 32, tone(sole, 0.62));
    return;
  }
  rect(g, 0, 0, 32, 3, tone(base, 0.82));
  rect(g, 0, 25, 32, 7, sole);
  rect(g, 0, 25, 32, 1, tone(sole, 0.72));
  rect(g, 0, 30, 32, 2, tone(sole, 0.82));
  if (face === 'nz') {
    rect(g, 10, 4, 12, 15, tone(base, 0.9));
    for (let y = 6; y < 18; y += 4) rect(g, 10, y, 12, 2, sole);
    rect(g, 4, 19, 24, 6, tone(base, 1.06));
  } else if (face === 'pz') {
    rect(g, 12, 3, 8, 22, tone(base, 0.84));
  } else {
    rect(g, 3, 13, 26, 2, tone(base, 0.8));
    rect(g, 3, 19, 26, 1, tone(base, 0.86));
  }
}

/* ---- Seif ---- */
function torsoSeif(g, face, c) {
  torsoTee(g, face, c, 111);
  if (face === 'nz') {
    pixelText(g, 'SEIF', 9, 9, c.accent);
    for (let x = 10; x < 23; x += 2) dot(g, x, 16, tone(c.accent, 0.72));
  }
}

function armSeif(g, face, c, side) {
  armTee(g, face, c, 113);
  if (side === 'L') {
    rect(g, 0, 25, 32, 3, '#141416');
    if (face === 'nx' || face === 'nz') {
      rect(g, 11, 23, 10, 7, '#0b0b0d');
      rect(g, 12, 24, 8, 5, '#2b2e33');
      rect(g, 15, 25, 1, 2, '#d7dae0');
      rect(g, 16, 26, 2, 1, '#d7dae0');
    }
  }
}

function legSeif(g, face, c, side) {
  clothBase(g, c.pants, face, 114);
  const base = tone(c.pants, FACE_MUL[face] || 1);
  const thread = '#eef0e8';
  rect(g, 0, 0, 32, 2, tone(base, 0.68));
  for (let i = 0; i < 56; i++) {
    const x = (rand2(i, 2, 115) * 32) | 0, y = 2 + ((rand2(i, 6, 115) * 27) | 0);
    rect(g, x, y, 1 + ((rand2(i, 9, 115) * 3) | 0), 1, tone(base, rand2(i, 4, 115) > 0.5 ? 1.08 : 0.93));
  }
  if (face === 'nz') {
    const skin = tone(c.skin, 0.9);
    if (side === 'L') {
      rect(g, 8, 11, 12, 1, thread);
      rect(g, 9, 12, 10, 1, skin);
      rect(g, 8, 13, 12, 1, thread);
      rect(g, 11, 20, 8, 1, thread);
      rect(g, 12, 21, 5, 1, tone(base, 0.62));
    } else {
      rect(g, 13, 6, 10, 1, thread);
      rect(g, 14, 7, 7, 1, skin);
      rect(g, 13, 8, 10, 1, thread);
      rect(g, 8, 16, 9, 1, thread);
      rect(g, 9, 17, 6, 1, tone(base, 0.62));
    }
  } else if (face === 'px' || face === 'nx') {
    rect(g, 15, 2, 1, 27, tone(base, 1.2));
  }
  rect(g, 0, 29, 32, 3, tone(base, 0.76));
}

function paintFolio(g, face) {
  rect(g, 0, 0, 32, 32, tone('#17181c', FACE_MUL[face] || 1));
  rect(g, 2, 2, 28, 1, '#2d2f35');
  rect(g, 2, 29, 28, 1, '#2d2f35');
  rect(g, 2, 2, 1, 28, '#2d2f35');
  rect(g, 29, 2, 1, 28, '#2d2f35');
}

/* ---- Meedo ---- */
function torsoMeedo(g, face, c) {
  torsoTee(g, face, c, 121);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  for (let i = 0; i < 150; i++) {
    const x = (rand2(i, 3, 122) * 32) | 0, y = 5 + ((rand2(i, 7, 122) * 23) | 0);
    dot(g, x, y, tone(base, rand2(i, 5, 122) > 0.45 ? 1.14 : 0.9));
  }
  if (face === 'nz') {
    const wire = c.accent;
    for (let y = 0; y <= 15; y++) {
      dot(g, 9 + Math.round(y * 0.42), y, wire);
      dot(g, 23 - Math.round(y * 0.46), y, wire);
    }
    rect(g, 15, 15, 1, 12, wire);
    rect(g, 20, 5, 2, 4, wire);
  }
}

function legMeedo(g, face, c) {
  clothBase(g, c.pants, face, 123);
  const base = tone(c.pants, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 2, tone(base, 0.68));
  if (face === 'nz') {
    rect(g, 8, 10, 16, 8, tone(base, 1.1));
    rect(g, 15, 2, 1, 27, tone(base, 0.8));
  } else if (face === 'px' || face === 'nx') {
    rect(g, 15, 2, 1, 27, tone(base, 1.24));
  }
  rect(g, 0, 29, 32, 3, tone(base, 0.76));
}

/* ---- Mko ---- */
function hairMko(g, face, c) {
  const m = FACE_MUL[face] || 1;
  const base = tone(c.hair, m), hi = tone(base, 1.55), lo = tone(base, 0.68);
  const skin = tone(c.skin, m);
  const fade = blendHex(base, skin, 0.55), fade2 = blendHex(base, skin, 0.8);
  if (face === 'py') {
    rect(g, 0, 0, 32, 32, base);
    curlTexture(g, 0, 0, 32, 32, hi, lo);
    return;
  }
  if (face === 'nz') {
    for (let x = 0; x < 32; x++) {
      const d = 6 + Math.round(Math.abs(x - 15.5) / 6) + Math.round(rand2(x, 2, 171) * 2);
      rect(g, x, 0, 1, d, base);
    }
    rect(g, 0, 0, 2, 9, fade);
    rect(g, 30, 0, 2, 9, fade);
    rect(g, 0, 9, 2, 12, fade2);
    rect(g, 30, 9, 2, 12, fade2);
    curlTexture(g, 2, 0, 28, 6, hi, lo);
  } else if (face === 'pz') {
    rect(g, 0, 0, 32, 24, base);
    rect(g, 0, 24, 32, 5, fade);
    rect(g, 0, 29, 32, 3, fade2);
    clipRect(g, 0, 0, 32, 24, () => curlTexture(g, 0, 0, 32, 24, hi, lo));
    hairSpeckle(g, 0, 29, 32, 3, fade, base, 171, 34);
  } else {
    const beard = blendHex(skin, tone(c.hair, m), 0.8);
    rect(g, 0, 0, 32, 6, base);
    rect(g, 0, 6, 32, 4, fade);
    rect(g, 0, 10, 32, 3, fade2);
    rect(g, sideSpan(face, 0, 3), 13, 3, 9, fade2);
    rect(g, sideSpan(face, 0, 3), 22, 3, 5, beard);
    rect(g, sideSpan(face, 0, 9), 27, 9, 5, beard);
    curlTexture(g, 0, 0, 32, 4, hi, lo);
    charNapeSide(g, face, c, 12, base, fade, hi);
  }
}

function satinSheen(g, face, c) {
  if (face === 'py' || face === 'ny') return;
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  for (let i = 0; i < 2; i++) {
    const x0 = 4 + i * 16;
    for (let y = 0; y < 32; y++) {
      const x = x0 + Math.round(y * 0.3);
      rect(g, x, y, 5, 1, tone(base, 1.12));
      rect(g, x + 1, y, 2, 1, tone(base, 1.26));
    }
  }
}

function torsoMko(g, face, c) {
  clothBase(g, c.shirt, face, 172);
  satinSheen(g, face, c);
  const m = FACE_MUL[face] || 1;
  const base = tone(c.shirt, m), dark = tone(base, 0.55);
  if (face === 'nz') {
    for (let i = 0; i < 5; i++) rect(g, 11 + i, i * 2, 10 - i * 2, 2, i < 3 ? c.skin : tone(c.skin, 0.8));
    for (let y = 0; y < 10; y++) {
      dot(g, 10 + (y >> 1), y, dark);
      dot(g, 21 - (y >> 1), y, dark);
    }
    rect(g, 15, 10, 3, 17, tone(base, 0.84));
    rect(g, 15, 10, 1, 17, dark);
    for (let y = 12; y < 27; y += 5) {
      rect(g, 16, y, 2, 2, '#08080a');
      dot(g, 16, y, '#5a5a60');
    }
  } else if (face === 'pz') {
    rect(g, 0, 7, 32, 1, dark);
    rect(g, 15, 8, 2, 19, tone(base, 0.84));
  } else if (face === 'px' || face === 'nx') {
    rect(g, 15, 0, 1, 27, dark);
  }
  rect(g, 0, 27, 32, 3, '#0d0d0f');
  rect(g, 0, 27, 32, 1, '#2b2b30');
  rect(g, 0, 30, 32, 2, tone(c.pants, m));
  if (face === 'nz') {
    rect(g, 12, 26, 8, 5, '#c8ccd4');
    rect(g, 13, 27, 6, 3, '#232428');
  } else {
    for (let x = 5; x < 32; x += 11) rect(g, x, 27, 2, 3, '#232428');
  }
}

function armMko(g, face, c) {
  clothBase(g, c.shirt, face, 173);
  satinSheen(g, face, c);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  const dark = tone(base, 0.55);
  rect(g, 0, 16, 32, 1, tone(base, 0.8));
  rect(g, 0, 26, 32, 6, tone(base, 1.14));
  rect(g, 0, 26, 32, 1, dark);
  rect(g, 0, 31, 32, 1, dark);
  if (face === 'pz') rect(g, 15, 28, 2, 2, '#08080a');
}

function legMko(g, face, c) {
  clothBase(g, c.pants, face, 174);
  const base = tone(c.pants, FACE_MUL[face] || 1);
  if (face === 'nz') {
    rect(g, 15, 0, 1, 30, tone(base, 1.4));
    rect(g, 16, 0, 1, 30, tone(base, 0.74));
    for (let i = 0; i < 7; i++) {
      dot(g, 3 + i, 1 + i, tone(base, 0.68));
      dot(g, 28 - i, 1 + i, tone(base, 0.68));
    }
  } else if (face === 'px' || face === 'nx') {
    rect(g, 15, 0, 1, 30, tone(base, 0.72));
    rect(g, 16, 0, 1, 30, tone(base, 1.18));
  } else if (face === 'pz') {
    rect(g, 15, 0, 1, 30, tone(base, 1.26));
    rect(g, 7, 3, 18, 1, tone(base, 0.68));
  }
  rect(g, 0, 28, 32, 1, tone(base, 0.74));
}

function shoeDress(g, face, c) {
  const base = tone(c.shoe, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  if (face === 'py') {
    rect(g, 8, 4, 16, 24, tone(base, 0.72));
    rect(g, 10, 22, 12, 4, tone(base, 2.4));
    return;
  }
  if (face === 'ny') return;
  rect(g, 0, 27, 32, 5, '#08080a');
  rect(g, 0, 26, 32, 1, tone(base, 2.2));
  if (face === 'nz') {
    rect(g, 10, 2, 12, 7, tone(base, 0.68));
    for (let y = 3; y < 9; y += 2) rect(g, 11, y, 10, 1, tone(base, 2.6));
    rect(g, 7, 14, 18, 3, tone(base, 3.2));
    rect(g, 11, 15, 10, 1, tone(base, 4.6));
  } else if (face === 'px' || face === 'nx') {
    rect(g, sideSpan(face, 2, 14), 12, 14, 2, tone(base, 2.6));
  }
}

function paintWatchMetal(g, face) {
  metalBase(g, '#c4c8d0', face, 175);
  for (let x = 3; x < 32; x += 5) rect(g, x, 0, 1, 32, '#7c8089');
}

function paintWatchFace(g, face) {
  rect(g, 0, 0, 32, 32, '#b6bac3');
  if (face === 'nz') {
    rect(g, 4, 4, 24, 24, '#eceef2');
    rect(g, 15, 8, 2, 9, '#2a2c31');
    rect(g, 16, 15, 8, 2, '#2a2c31');
  }
}

/* ---- Michael Jackson: a sequined stage jacket, cropped trousers and fedora ---- */
function mjSparkles(g, face, c, seed, count, y0, y1) {
  const fi = TEX_FACES.indexOf(face);
  for (let i = 0; i < count; i++) {
    const x = (rand2(i, fi + 11, seed) * 32) | 0;
    const y = y0 + ((rand2(i, fi + 19, seed) * (y1 - y0)) | 0);
    const bright = rand2(i, fi + 23, seed);
    const color = bright > 0.84 ? '#f4f6f8' : bright > 0.38 ? c.silver : tone(c.silver, 0.58);
    dot(g, x, y, color);
    if (bright > 0.91 && x > 0 && x < 31 && y > y0 && y < y1 - 1) {
      dot(g, x - 1, y, tone(c.silver, 0.72));
      dot(g, x + 1, y, tone(c.silver, 0.72));
      dot(g, x, y - 1, '#ffffff');
      dot(g, x, y + 1, tone(c.silver, 0.72));
    }
  }
}

function mjSatinBase(g, color, face, seed) {
  const base = tone(color, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  if (face === 'py' || face === 'ny') {
    rect(g, 2, 2, 28, 1, tone(base, 1.65));
    rect(g, 2, 29, 28, 1, tone(base, 0.55));
    for (let i = 0; i < 28; i++) {
      const x = 2 + ((rand2(i, 3, seed) * 28) | 0);
      const y = 2 + ((rand2(i, 7, seed) * 28) | 0);
      dot(g, x, y, tone(base, rand2(i, 9, seed) > 0.55 ? 1.5 : 0.62));
    }
    return;
  }
  const lean = face === 'px' || face === 'pz' ? 1 : -1;
  for (let y = 0; y < 32; y++) {
    const x = 5 + ((y * lean + 64) % 19);
    rect(g, x, y, 3, 1, tone(base, 1.42));
    dot(g, x + 1, y, tone(base, 1.9));
  }
  for (let x = 3; x < 32; x += 9) rect(g, x, 0, 1, 32, tone(base, 0.7));
  for (let i = 0; i < 34; i++) {
    const x = (rand2(i, 5, seed) * 32) | 0, y = (rand2(i, 8, seed) * 32) | 0;
    dot(g, x, y, tone(base, rand2(i, 2, seed) > 0.5 ? 1.7 : 0.58));
  }
  rect(g, 0, 30, 32, 2, tone(base, 0.56));
}

function hairMj(g, face, c) {
  const m = FACE_MUL[face] || 1;
  const base = tone(c.hair, m), hi = tone(base, 2.0), lo = tone(base, 0.55);
  if (face === 'py') {
    rect(g, 0, 0, 32, 32, base);
    curlTexture(g, 0, 0, 32, 32, hi, lo);
    hairSpeckle(g, 0, 0, 32, 32, tone(base, 2.4), lo, 211, 34);
    return;
  }
  if (face === 'ny') {
    rect(g, 0, 0, 32, 7, base);
    clipRect(g, 0, 0, 32, 7, () => curlTexture(g, 0, 0, 32, 7, hi, lo));
    return;
  }
  if (face === 'nz') {
    for (let x = 0; x < 32; x++) {
      const d = 5 + Math.round(rand2(x, 3, 212) * 4) + (x > 20 ? Math.round((x - 20) * 0.45) : 0);
      rect(g, x, 0, 1, d, base);
      dot(g, x, d - 1, x % 2 ? hi : lo);
    }
    rect(g, 0, 0, 3, 19, base);
    rect(g, 29, 0, 3, 22, base);
    curlTexture(g, 0, 0, 32, 6, hi, lo);
    for (const p of [[2, 15], [1, 18], [29, 16], [30, 20], [24, 11], [25, 14]]) {
      rect(g, p[0], p[1], 2, 2, base);
      dot(g, p[0] + 1, p[1], hi);
      dot(g, p[0], p[1] + 2, lo);
    }
    return;
  }
  if (face === 'pz') {
    rect(g, 0, 0, 32, 32, base);
    for (let x = 0; x < 32; x++) {
      const d = 30 + Math.round(rand2(x, 4, 213) * 2);
      rect(g, x, 0, 1, d, base);
      dot(g, x, d - 1, x % 3 ? lo : hi);
    }
    clipRect(g, 0, 0, 32, 30, () => curlTexture(g, 0, 0, 32, 30, hi, lo));
    hairSpeckle(g, 0, 4, 32, 27, tone(base, 2.25), lo, 214, 46);
    return;
  }
  rect(g, 0, 0, 32, 8, base);
  const rear = sideSpan(face, 11, 21);
  rect(g, rear, 7, 21, 19, base);
  rect(g, sideSpan(face, 0, 4), 7, 4, 15, base);
  curlTexture(g, 0, 0, 32, 7, hi, lo);
  clipRect(g, rear, 8, 21, 18, () => curlTexture(g, rear, 8, 21, 18, hi, lo));
  const frontLock = sideSpan(face, 1, 4);
  rect(g, frontLock, 14, 4, 11, base);
  dot(g, frontLock + 1, 17, hi);
  dot(g, frontLock + 3, 23, lo);
  charNapeSide(g, face, c, 9, base, lo, hi);
}

function torsoMj(g, face, c) {
  mjSatinBase(g, c.shirt, face, 215);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  if (face === 'py') {
    rect(g, 10, 8, 12, 13, c.accent);
    rect(g, 12, 10, 8, 9, tone(c.skin, 0.94));
    rect(g, 8, 22, 16, 2, tone(base, 1.65));
    mjSparkles(g, face, c, 216, 9, 2, 30);
    return;
  }
  if (face === 'ny') {
    rect(g, 0, 0, 32, 4, tone(base, 0.5));
    rect(g, 4, 27, 24, 2, tone(c.silver, 0.36));
    return;
  }
  mjSparkles(g, face, c, 217, face === 'nz' || face === 'pz' ? 24 : 13, 2, 28);
  if (face === 'nz') {
    // Billie Jean's open sequined blazer frames a white shirt all the way to
    // the waist; it is not a buttoned black suit or a red-armband costume.
    rect(g, 10, 2, 12, 26, tone(c.accent, 0.98));
    rect(g, 12, 0, 8, 3, tone(c.skin, 0.96));
    rect(g, 11, 4, 10, 1, tone(c.accent, 0.82));
    rect(g, 13, 9, 1, 17, tone(c.accent, 0.9));
    rect(g, 19, 12, 1, 14, '#ffffff');
    for (let y = 0; y < 28; y++) {
      const lx = 5 + Math.floor(Math.min(y, 8) * 0.42), rx = 26 - Math.floor(Math.min(y, 8) * 0.42);
      rect(g, lx, y, 2, 1, tone(c.satin, 1.18));
      rect(g, rx, y, 2, 1, tone(c.satin, 0.78));
      if (y % 4 === 0) {
        dot(g, lx, y, c.silver);
        dot(g, rx + 1, y, tone(c.silver, 0.72));
      }
    }
    rect(g, 3, 5, 2, 22, tone(c.satin, 0.72));
    rect(g, 27, 5, 2, 22, tone(c.satin, 1.1));
  } else if (face === 'pz') {
    rect(g, 2, 5, 28, 2, tone(c.satin, 1.08));
    rect(g, 3, 7, 26, 1, tone(base, 0.55));
    rect(g, 15, 7, 2, 22, tone(base, 0.48));
    rect(g, 16, 8, 1, 20, tone(c.satin, 0.94));
    for (let x = 5; x < 29; x += 6) dot(g, x, 6, c.silver);
  } else {
    rect(g, 15, 2, 2, 27, tone(base, 0.48));
    rect(g, 17, 2, 1, 27, tone(c.satin, 0.98));
    rect(g, 3, 7, 2, 18, tone(c.satin, 0.64));
  }
  rect(g, 0, 28, 32, 4, tone(base, 0.5));
  rect(g, 0, 28, 32, 1, tone(c.satin, 1.05));
}

function armMj(g, face, c, side) {
  mjSatinBase(g, c.sleeve, face, side === 'R' ? 218 : 219);
  const base = tone(c.sleeve, FACE_MUL[face] || 1);
  if (face === 'py') {
    mjSparkles(g, face, c, side === 'R' ? 220 : 221, 8, 2, 30);
    return;
  }
  if (face === 'ny') {
    rect(g, 0, 0, 32, 32, tone(c.accent, 0.82));
    rect(g, 4, 4, 24, 24, tone(c.accent, 1.03));
    return;
  }
  mjSparkles(g, face, c, side === 'R' ? 222 : 223, 11, 2, 25);
  rect(g, 14, 2, 2, 24, tone(base, 0.45));
  rect(g, 16, 2, 1, 24, tone(c.satin, 1.08));
  rect(g, 0, 26, 32, 6, tone(c.accent, FACE_MUL[face] || 1));
  rect(g, 0, 26, 32, 1, tone(c.silver, 0.72));
  rect(g, 0, 30, 32, 2, tone(c.accent, 0.78));
}

function legMj(g, face, c) {
  mjSatinBase(g, c.pants, face, 224);
  const base = tone(c.pants, FACE_MUL[face] || 1), sock = tone(c.accent, FACE_MUL[face] || 1);
  if (face === 'py') {
    rect(g, 0, 0, 32, 4, tone(base, 0.5));
    rect(g, 4, 4, 24, 2, tone(c.satin, 0.8));
    return;
  }
  if (face === 'ny') {
    rect(g, 0, 0, 32, 32, tone(c.accent, 0.84));
    for (let x = 3; x < 32; x += 5) rect(g, x, 0, 1, 32, tone(c.accent, 0.7));
    return;
  }
  if (face === 'nz') {
    rect(g, 15, 1, 1, 21, tone(base, 2.0));
    rect(g, 16, 1, 1, 21, tone(base, 0.45));
    rect(g, 5, 5, 2, 15, tone(c.satin, 0.8));
  } else if (face === 'pz') {
    rect(g, 15, 1, 2, 21, tone(base, 0.48));
    rect(g, 16, 2, 1, 19, tone(c.satin, 0.95));
  } else {
    rect(g, 15, 1, 1, 21, tone(base, 0.44));
    rect(g, 16, 1, 1, 21, tone(c.satin, 1.05));
  }
  rect(g, 0, 21, 32, 3, tone(base, 0.46));
  rect(g, 0, 21, 32, 1, tone(c.satin, 1.12));
  rect(g, 0, 24, 32, 8, sock);
  rect(g, 0, 24, 32, 1, tone(c.silver, 0.62));
  for (let x = 2; x < 32; x += 4) rect(g, x, 25, 1, 7, tone(sock, 0.88));
  rect(g, 0, 30, 32, 2, tone(sock, 0.76));
}

function shoeMj(g, face, c) {
  const base = tone(c.shoe, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  if (face === 'py') {
    rect(g, 5, 3, 22, 26, tone(base, 1.65));
    rect(g, 8, 5, 16, 11, tone(base, 2.3));
    rect(g, 6, 16, 20, 5, tone(base, 1.15));
    rect(g, 7, 16, 18, 2, tone(c.satin, 0.9));
    rect(g, 10, 23, 12, 2, tone(base, 4.8));
    rect(g, 12, 22, 8, 1, tone(c.silver, 0.78));
    return;
  }
  if (face === 'ny') {
    rect(g, 0, 0, 32, 32, '#030304');
    rect(g, 3, 3, 26, 26, '#0d0e10');
    rect(g, 5, 27, 22, 2, '#25272c');
    return;
  }
  rect(g, 0, 27, 32, 5, '#020204');
  rect(g, 0, 26, 32, 1, tone(c.satin, 0.62));
  if (face === 'nz') {
    rect(g, 4, 8, 24, 14, tone(base, 1.72));
    rect(g, 7, 11, 18, 8, tone(base, 2.35));
    rect(g, 10, 12, 12, 2, tone(base, 5.0));
    rect(g, 12, 11, 8, 1, tone(c.silver, 0.76));
    rect(g, 7, 21, 18, 3, tone(base, 1.25));
  } else if (face === 'pz') {
    rect(g, 7, 4, 18, 17, tone(base, 1.35));
    rect(g, 8, 5, 16, 2, tone(base, 2.4));
    rect(g, 5, 21, 22, 5, tone(base, 0.72));
  } else {
    rect(g, sideSpan(face, 3, 24), 10, 24, 7, tone(base, 1.7));
    rect(g, sideSpan(face, 7, 16), 11, 16, 2, tone(base, 3.4));
    rect(g, sideSpan(face, 4, 22), 20, 22, 3, tone(base, 1.15));
  }
}

function handMj(g, face, c, side) {
  if (side === 'R') {
    const glove = tone(c.glove, FACE_MUL[face] || 1);
    rect(g, 0, 0, 32, 32, glove);
    rect(g, 0, 0, 32, 4, tone(glove, 0.72));
    rect(g, 0, 4, 32, 2, tone(c.silver, 0.65));
    if (face === 'nz' || face === 'pz') {
      for (let x = 5; x < 29; x += 6) rect(g, x, 11, 1, 16, tone(glove, 0.82));
      rect(g, 3, 26, 26, 2, tone(glove, 0.74));
      dot(g, 25, 8, '#ffffff');
    } else if (face === 'px' || face === 'nx') {
      rect(g, 11, 8, 2, 20, tone(glove, 0.8));
      rect(g, 18, 9, 1, 18, tone(glove, 1.05));
    } else if (face === 'py') {
      rect(g, 5, 5, 22, 22, tone(glove, 1.05));
      rect(g, 9, 9, 14, 14, tone(glove, 0.9));
    }
    return;
  }
  skinBase(g, c, face);
  rect(g, 0, 0, 32, 5, tone(c.shirt, FACE_MUL[face] || 1));
  rect(g, 0, 4, 32, 2, tone(c.silver, 0.46));
  if (face === 'nz') {
    for (let x = 5; x < 29; x += 6) rect(g, x, 16, 1, 12, tone(c.skin, 0.78));
    rect(g, 3, 27, 26, 1, tone(c.skin, 0.7));
  }
}

function paintMjHairProp(g, face, c) {
  const base = tone(c.hair, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  curlTexture(g, 0, 0, 32, 32, tone(base, 2.0), tone(base, 0.52));
  hairSpeckle(g, 0, 0, 32, 32, tone(base, 2.35), tone(base, 0.65), 225, 28);
}

function paintMjFedoraCrown(g, face, c) {
  mjSatinBase(g, '#0c0d10', face, 226);
  const base = tone('#0c0d10', FACE_MUL[face] || 1);
  if (face === 'py') {
    rect(g, 5, 7, 22, 18, tone(base, 1.55));
    rect(g, 9, 9, 14, 14, '#050507');
    rect(g, 11, 10, 10, 12, '#020203');
    rect(g, 8, 8, 1, 16, tone(c.satin, 0.82));
    rect(g, 23, 9, 1, 14, tone(c.satin, 0.55));
    return;
  }
  if (face === 'ny') {
    rect(g, 0, 0, 32, 32, '#030304');
    rect(g, 5, 5, 22, 22, '#0e0f12');
    return;
  }
  rect(g, 0, 23, 32, 7, tone(c.satin, face === 'nz' ? 0.74 : 0.55));
  rect(g, 0, 23, 32, 1, tone(c.satin, 1.05));
  rect(g, 0, 29, 32, 2, '#050507');
  rect(g, 5, 2, 2, 19, tone(base, 2.0));
  rect(g, 25, 3, 1, 18, tone(base, 0.5));
  if (face === 'nz') {
    rect(g, 3, 4, 26, 2, tone(base, 1.5));
    rect(g, 13, 3, 6, 2, '#020203');
    dot(g, 5, 26, c.silver);
    dot(g, 6, 26, '#ffffff');
  } else if (face === 'pz') {
    rect(g, 14, 2, 3, 20, tone(base, 0.48));
    rect(g, 17, 2, 1, 20, tone(base, 1.7));
  }
}

function paintMjFedoraBrim(g, face, c) {
  const base = tone('#0a0b0d', FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  if (face === 'py') {
    rect(g, 3, 7, 26, 19, tone(base, 1.55));
    rect(g, 7, 9, 18, 15, '#050507');
    rect(g, 9, 11, 14, 11, tone(c.satin, 0.42));
    rect(g, 2, 26, 28, 2, tone(base, 2.1));
  } else if (face === 'ny') {
    rect(g, 0, 0, 32, 32, '#020203');
    rect(g, 4, 5, 24, 22, '#08090b');
  } else {
    rect(g, 0, 0, 32, 10, tone(base, 1.5));
    rect(g, 0, 10, 32, 12, '#030304');
    rect(g, 0, 22, 32, 3, tone(c.satin, 0.55));
    rect(g, 0, 25, 32, 7, '#020203');
    if (face === 'nz') rect(g, 3, 8, 26, 2, tone(c.satin, 0.8));
  }
}

function paintMjFedoraBand(g, face, c) {
  rect(g, 0, 0, 32, 32, tone(c.satin, FACE_MUL[face] || 1));
  rect(g, 0, 0, 32, 3, tone(c.satin, 1.22));
  rect(g, 0, 27, 32, 5, tone(c.satin, 0.42));
  for (let x = 2; x < 32; x += 7) rect(g, x, 3, 1, 24, tone(c.satin, x % 3 ? 0.68 : 1.12));
  if (face === 'nz') {
    rect(g, 4, 11, 5, 10, '#121318');
    rect(g, 5, 12, 3, 8, tone(c.silver, 0.72));
    dot(g, 6, 13, '#ffffff');
  }
}

/* ---- Hokage, a smouldering ember fighter ---- */
/* Glowing seams, like coals split open. Deterministic, so the colour map and
   the emissive map line up pixel for pixel. */
function emberCracks(g, c, seed, count, y0, y1, spread) {
  for (let i = 0; i < count; i++) {
    let x = spread ? 5 + Math.round(i * 22 / (count - 1)) : 3 + ((rand2(i, 3, seed) * 26) | 0);
    for (let y = y0 + ((rand2(i, 5, seed) * 5) | 0); y < y1; y++) {
      const step = rand2(i, y, seed);
      if (step < 0.3) x = Math.max(1, x - 1);
      else if (step > 0.7) x = Math.min(30, x + 1);
      dot(g, x, y, y % 3 === 0 ? c.hot : c.ember);
      if (y % 4 === 1) dot(g, x + 1, y, c.ember);
    }
  }
}

function burnHole(g, x, y, w, h, c) {
  rect(g, x, y, w, h, '#120b08');
  for (let i = 0; i < w; i++) dot(g, x + i, i % 2 ? y + h : y - 1, c.ember);
  dot(g, x - 1, y + 1, c.ember);
  dot(g, x + w, y + h - 1, c.hot);
}

/* Everything that glows on Hokage. Runs once on the colour map and once on the
   emissive map, so these pixels stay bright at night and in shadow. */
function emberDetail(g, part, face, c) {
  const seed = 190 + TEX_FACES.indexOf(face) * 7;
  if (part === 'torso') {
    if (face === 'nz') {
      rect(g, 15, 7, 2, 2, c.ember);
      rect(g, 14, 9, 3, 2, c.ember);
      rect(g, 12, 11, 7, 2, c.ember);
      rect(g, 19, 10, 1, 3, c.ember);
      rect(g, 11, 13, 10, 5, c.ember);
      rect(g, 12, 18, 8, 2, c.ember);
      rect(g, 14, 20, 4, 1, c.ember);
      rect(g, 15, 12, 2, 2, c.hot);
      rect(g, 14, 14, 4, 3, c.hot);
      rect(g, 15, 17, 2, 2, c.hot);
      burnHole(g, 5, 22, 4, 3, c);
      burnHole(g, 24, 16, 3, 3, c);
    } else if (face === 'pz') {
      burnHole(g, 8, 11, 4, 3, c);
      burnHole(g, 21, 21, 3, 3, c);
    }
  } else if (part === 'armL' || part === 'armR') {
    if (face !== 'py' && face !== 'ny') emberCracks(g, c, seed + (part === 'armR' ? 3 : 0), 3, 18, 31);
  } else if (part === 'hand') {
    if (face !== 'py') emberCracks(g, c, seed + 40, 2, 12, 31);
  } else if (part === 'leg') {
    if (face === 'nz') burnHole(g, 9, 20, 5, 2, c);
  } else if (part === 'cloak') {
    if (face === 'nz' || face === 'pz') emberCracks(g, c, seed + 70, 3, 2, 27, true);
  } else if (part === 'shoe') {
    if (face !== 'py' && face !== 'ny') rect(g, 0, 26, 32, 1, c.ember);
  } else if (part === 'head') {
    if (face === 'nz') {
      rect(g, 6, 15, 2, 1, '#b5561a');
      rect(g, 19, 15, 2, 1, '#b5561a');
    } else if (face === 'py') {
      hairSpeckle(g, 0, 0, 32, 32, c.ember, c.hot, seed + 60, 12);
    }
  }
}

/* Adds a second, emissive canvas packed like texMaterial's atlas. */
function addEmberGlow(material, paintGlow) {
  if (material.emissiveMap) return;
  const cv = document.createElement('canvas');
  cv.width = TEX_S * 3; cv.height = TEX_S * 2;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#000000';
  g.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = (i / 3) | 0;
    g.save();
    g.beginPath();
    g.rect(col * TEX_S, row * TEX_S, TEX_S, TEX_S);
    g.clip();
    g.translate(col * TEX_S, row * TEX_S);
    paintGlow(g, TEX_FACES[i]);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  material.emissive = new THREE.Color(0xffffff);
  material.emissiveMap = tex;
  material.needsUpdate = true;
}

function charBase(g, c, face, seed) {
  const base = tone(c.char, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  for (let i = 0; i < 70; i++) {
    const x = (rand2(i, 3, seed) * 32) | 0, y = (rand2(i, 7, seed) * 32) | 0;
    dot(g, x, y, tone(base, rand2(i, 5, seed) > 0.5 ? 1.5 : 0.7));
  }
}

function armHokage(g, face, c, side) {
  armTee(g, face, c, 187);
  if (face === 'py') return;
  const m = FACE_MUL[face] || 1;
  clipRect(g, 0, 17, 32, 15, () => charBase(g, c, face, 191));
  for (let x = 0; x < 32; x++) {
    const h = 14 + Math.round(rand2(x, 2, 192) * 3);
    rect(g, x, h, 1, 17 - h, tone(c.char, m));
  }
  emberDetail(g, side === 'R' ? 'armR' : 'armL', face, c);
}

function handHokage(g, face, c) {
  charBase(g, c, face, 193);
  emberDetail(g, 'hand', face, c);
}

function legHokage(g, face, c) {
  legMeedo(g, face, c);
  const base = tone(c.pants, FACE_MUL[face] || 1);
  hairSpeckle(g, 0, 18, 32, 11, tone(base, 0.55), tone(base, 1.25), 194, 44);
  emberDetail(g, 'leg', face, c);
}

function shoeHokage(g, face, c) {
  charBase(g, c, face, 195);
  if (face === 'py' || face === 'ny') return;
  rect(g, 0, 27, 32, 5, '#0b0908');
  if (face === 'nz') {
    rect(g, 10, 3, 12, 15, tone(c.char, 1.5));
    for (let y = 5; y < 17; y += 4) rect(g, 10, y, 12, 1, tone(c.char, 2.6));
  }
  emberDetail(g, 'shoe', face, c);
}

function paintHokageHair(g, face, c) {
  paintHairCap(g, face, c, 188, false);
  hairSpeckle(g, 0, 0, 32, 32, c.ember, c.hot, 196, 8);
}

function paintEmberCloak(g, face, c) {
  clothBase(g, c.cloak, face, 198);
  const base = tone(c.cloak, FACE_MUL[face] || 1);
  for (let x = 3; x < 32; x += 7) {
    rect(g, x, 0, 1, 32, tone(base, 0.62));
    rect(g, x + 1, 0, 1, 32, tone(base, 1.35));
  }
  emberDetail(g, 'cloak', face, c);
}

function paintCloakCloth(g, face, c) {
  clothBase(g, c.cloak, face, 199);
  const base = tone(c.cloak, FACE_MUL[face] || 1);
  for (let x = 5; x < 32; x += 9) rect(g, x, 0, 1, 32, tone(base, 0.66));
  rect(g, 0, 0, 32, 2, tone(base, 1.3));
}

/* An original ragged cloak: a back panel, uneven strips below it, shoulder
   mantles and a bronze chain across the chest. It sways gently as it renders. */
function addEmberCloak(torso, armL, armR, c) {
  const cloth = (g, f) => paintCloakCloth(g, f, c);
  const cloak = new THREE.Group();
  cloak.position.set(0, 0.62, 0.17);
  cloak.rotation.x = -0.09;
  const panel = paintedBox(cloak, 0.6, 0.7, 0.035, 'hokagecloak', (g, f) => paintEmberCloak(g, f, c), 0, -0.35, 0);
  addEmberGlow(panel.material, (g, f) => emberDetail(g, 'cloak', f, c));
  for (const [x, w, len] of [[-0.245, 0.11, 0.22], [-0.125, 0.12, 0.33], [0, 0.11, 0.17], [0.12, 0.12, 0.37], [0.245, 0.11, 0.25]]) {
    paintedBox(cloak, w, len, 0.03, 'hokagerag', cloth, x, -0.7 - len / 2, 0);
  }
  const sway = () => { cloak.rotation.x = -0.09 + Math.sin(performance.now() * 0.0018) * 0.025; };
  sway();
  panel.onBeforeRender = sway;
  torso.add(cloak);
  paintedBox(armL, 0.25, 0.1, 0.27, 'hokagemantle', cloth, 0, 0.04, 0);
  paintedBox(armR, 0.25, 0.1, 0.27, 'hokagemantle', cloth, 0, 0.04, 0);
  paintedBox(torso, 0.44, 0.09, 0.05, 'hokagecollar', cloth, 0, 0.66, 0.14);
  paintedBox(torso, 0.07, 0.42, 0.03, 'hokagefront', cloth, -0.225, 0.41, -0.15);
  paintedBox(torso, 0.07, 0.42, 0.03, 'hokagefront', cloth, 0.225, 0.41, -0.15);
  addBox(torso, 0.07, 0.06, 0.02, '#b8863a', -0.225, 0.57, -0.17);
  addBox(torso, 0.07, 0.06, 0.02, '#b8863a', 0.225, 0.57, -0.17);
  addBox(torso, 0.38, 0.012, 0.012, '#8f6a2e', 0, 0.56, -0.17);
}

/* A live flame: onBeforeRender runs only while it is on screen, so it needs no
   entry in the game loop. */
function addFlameFx(parent, c, x, y, z) {
  const flame = new THREE.Group();
  flame.position.set(x, y, z);
  const tiers = [
    glowBox(flame, 0.13, 0.11, 0.13, c.hot, 0, 0.05, 0),
    glowBox(flame, 0.11, 0.12, 0.11, '#ffa62e', 0.005, 0.15, 0),
    glowBox(flame, 0.08, 0.11, 0.08, c.ember, 0.01, 0.25, 0),
    glowBox(flame, 0.045, 0.09, 0.045, '#e8421a', -0.01, 0.34, 0),
    glowBox(flame, 0.04, 0.08, 0.04, c.ember, 0.075, 0.13, 0.02),
    glowBox(flame, 0.035, 0.07, 0.035, '#ffa62e', -0.07, 0.1, -0.02)
  ];
  const sparks = [0, 1, 2].map(() => glowBox(flame, 0.018, 0.018, 0.018, c.hot, 0, 0, 0));
  const update = () => {
    const t = performance.now() * 0.001;
    flame.scale.set(1 + Math.sin(t * 9) * 0.08, 1 + Math.sin(t * 13) * 0.14, 1 + Math.cos(t * 11) * 0.08);
    tiers[2].position.x = 0.01 + Math.sin(t * 17) * 0.015;
    tiers[3].position.x = -0.01 + Math.sin(t * 21) * 0.025;
    tiers[3].position.z = Math.cos(t * 19) * 0.02;
    sparks.forEach((s, i) => {
      const k = (t * 0.7 + i / 3) % 1;
      s.position.set(Math.sin(t * 3 + i * 2) * (0.04 + k * 0.08), 0.1 + k * 0.62, Math.cos(t * 2.5 + i) * 0.06);
      s.scale.setScalar(1 - k * 0.7);
    });
  };
  update();
  tiers[0].onBeforeRender = update;
  parent.add(flame);
  return flame;
}

/* Puffs that rise, grow and fade on a loop. Each owns a material so it can fade alone. */
function addSmokeFx(parent, x, y, z, phase) {
  const count = 3;
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xd9d7cf, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(charBox(0.13, 0.13, 0.13), mat);
    parent.add(mesh);
    puffs.push(mesh);
  }
  const update = () => {
    const t = performance.now() * 0.001;
    puffs.forEach((p, i) => {
      const k = (t * 0.42 + phase + i / count) % 1;
      p.position.set(x + Math.sin(k * 5 + i * 2) * 0.05, y + k * 0.78, z + Math.cos(k * 4 + i) * 0.04);
      p.scale.setScalar(0.6 + k * 1.2);
      p.material.opacity = 0.28 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
    });
  };
  update();
  puffs[0].onBeforeRender = update;
}

function hairHokage(g, face, c) {
  const m = FACE_MUL[face] || 1;
  const base = tone(c.hair, m), hi = tone(base, 1.45), lo = tone(base, 0.72);
  const fade = blendHex(base, tone(c.skin, m), 0.55);
  if (face === 'py') {
    rect(g, 0, 0, 32, 32, base);
    hairSpeckle(g, 0, 0, 32, 32, hi, lo, 183, 80);
    return;
  }
  if (face === 'nz') {
    for (let x = 0; x < 32; x++) {
      const d = 6 + Math.round(rand2(x, 4, 184) * 5);
      rect(g, x, 0, 1, d, base);
      if (x % 3 === 0) rect(g, x, 1, 1, d - 2, hi);
    }
    rect(g, 0, 0, 2, 15, base);
    rect(g, 30, 0, 2, 15, base);
  } else if (face === 'pz') {
    for (let x = 0; x < 32; x++) {
      const d = 28 + Math.round(rand2(x, 6, 185) * 3);
      rect(g, x, 0, 1, d, base);
      if (x % 4 === 1) rect(g, x, 1, 1, d - 3, hi);
    }
    rect(g, 0, 30, 32, 2, fade);
  } else {
    rect(g, 0, 0, 32, 8, base);
    rect(g, 0, 8, 32, 4, fade);
    rect(g, sideSpan(face, 0, 3), 8, 3, 10, base);
    rect(g, sideSpan(face, 0, 3), 18, 3, 8, tone(c.hair, m * 1.25));
    rect(g, sideSpan(face, 0, 11), 26, 11, 6, tone(c.hair, m * 1.25));
    hairSpeckle(g, 0, 0, 32, 8, hi, lo, 186, 22);
    charNapeSide(g, face, c, 11, base, fade, hi);
  }
}

function torsoHokage(g, face, c) {
  torsoTee(g, face, c, 181);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  if (face === 'nz' || face === 'pz') {
    for (let i = 0; i < 8; i++) {
      dot(g, 9 - i, 1 + i, tone(base, 0.72));
      dot(g, 22 + i, 1 + i, tone(base, 0.72));
    }
  }
  hairSpeckle(g, 0, 19, 32, 9, tone(base, 0.58), tone(base, 0.74), 197, 46);
  emberDetail(g, 'torso', face, c);
}

/* ---- Kestrel, an original sky courier ---- */
function torsoKestrel(g, face, c) {
  clothBase(g, c.shirt, face, 141);
  const dark = tone(c.shirt, 0.72), lite = tone(c.shirt, 1.25);
  const sash = () => {
    rect(g, 0, 19, 32, 4, c.accent);
    rect(g, 0, 19, 32, 1, tone(c.accent, 1.2));
    rect(g, 0, 22, 32, 1, tone(c.accent, 0.72));
  };
  for (let x = 3; x < 32; x += 5) rect(g, x, 23, 1, 9, dark);
  if (face === 'nz') {
    for (let i = 0; i < 4; i++) rect(g, 12 + i, i, 8 - i * 2, 1, c.skin);
    for (let i = 0; i < 5; i++) {
      dot(g, 11 + i, i, lite);
      dot(g, 20 - i, i, lite);
    }
    for (let y = 0; y < 19; y++) rect(g, 3 + y, y, 4, 1, y % 5 ? c.leather : tone(c.leather, 0.72));
    rect(g, 12, 7, 5, 5, c.brass);
    rect(g, 13, 8, 3, 3, tone(c.brass, 0.6));
    sash();
    rect(g, 21, 18, 6, 6, tone(c.accent, 1.12));
    rect(g, 22, 24, 2, 7, tone(c.accent, 0.92));
    rect(g, 25, 24, 2, 5, tone(c.accent, 0.8));
  } else if (face === 'pz') {
    for (let y = 0; y < 19; y++) rect(g, 25 - y, y, 4, 1, y % 5 ? c.leather : tone(c.leather, 0.72));
    sash();
  } else {
    sash();
  }
}

function armKestrel(g, face, c) {
  clothBase(g, c.shirt, face, 142);
  rect(g, 0, 3, 32, 2, c.accent);
  rect(g, 0, 15, 32, 1, tone(c.shirt, 0.72));
  rect(g, 0, 18, 32, 11, tone(c.leather, FACE_MUL[face] || 1));
  rect(g, 0, 18, 32, 1, tone(c.leather, 1.3));
  rect(g, 0, 28, 32, 1, tone(c.leather, 0.68));
  for (let y = 20; y < 28; y += 3) rect(g, 12, y, 8, 1, c.brass);
  rect(g, 0, 29, 32, 3, tone(c.shirt, 0.8));
}

function legKestrel(g, face, c) {
  clothBase(g, c.pants, face, 143);
  const base = tone(c.pants, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 2, tone(base, 0.68));
  if (face === 'nz') {
    rect(g, 7, 8, 18, 7, tone(base, 0.82));
    for (let x = 8; x < 25; x += 2) {
      dot(g, x, 8, tone(base, 1.18));
      dot(g, x, 14, tone(base, 1.18));
    }
  } else if (face === 'px' || face === 'nx') {
    rect(g, 15, 2, 1, 16, tone(base, 0.8));
  }
  for (let y = 18; y < 31; y += 3) {
    rect(g, 0, y, 32, 2, tone(c.leather, FACE_MUL[face] || 1));
    rect(g, 0, y, 32, 1, tone(c.leather, 1.24));
  }
}

function shoeKestrel(g, face, c) {
  clothBase(g, c.shoe, face, 144);
  rect(g, 0, 27, 32, 5, tone(c.shoe, 0.42));
  rect(g, 0, 27, 32, 1, tone(c.shoe, 0.7));
  if (face === 'nz') {
    rect(g, 4, 8, 24, 4, tone(c.shoe, 0.7));
    rect(g, 13, 7, 6, 6, c.brass);
    rect(g, 15, 9, 2, 2, tone(c.brass, 0.55));
  }
}

function handKestrel(g, face, c) {
  skinBase(g, c, face);
  rect(g, 0, 0, 32, 17, tone(c.leather, FACE_MUL[face] || 1));
  rect(g, 0, 15, 32, 2, tone(c.leather, 0.7));
}

function paintBraid(g, face, c) {
  const base = tone(c.hair, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  for (let i = 0; i < 4; i++) {
    for (let x = 0; x < 32; x++) {
      const y = i * 8 + Math.round(Math.abs(x - 15.5) / 3);
      rect(g, x, y, 1, 2, tone(base, 0.7));
      dot(g, x, y + 2, tone(base, 1.28));
    }
  }
}

function paintLeather(g, face, c, seed) {
  clothBase(g, c.leather, face, seed);
  rect(g, 0, 0, 32, 2, tone(c.leather, 1.24));
  rect(g, 0, 29, 32, 3, tone(c.leather, 0.68));
}

function paintLens(g, face, c) {
  rect(g, 0, 0, 32, 32, tone(c.brass, FACE_MUL[face] || 1));
  if (face === 'nz') {
    rect(g, 5, 5, 22, 22, '#0f2a2c');
    rect(g, 7, 7, 18, 18, '#2fa9a4');
    rect(g, 9, 9, 7, 3, '#c9f4ee');
  }
}

function paintShaft(g, face) {
  rect(g, 0, 0, 32, 32, tone('#6f4a2b', FACE_MUL[face] || 1));
  for (let x = 3; x < 32; x += 6) rect(g, x, 0, 1, 32, tone('#6f4a2b', 0.78));
  for (let y = 4; y < 32; y += 9) rect(g, 0, y, 32, 2, '#d2a84b');
}

function paintPennant(g, face, c) {
  rect(g, 0, 0, 32, 32, tone(c.accent, FACE_MUL[face] || 1));
  rect(g, 0, 11, 32, 10, tone(c.shirt, 1.05));
}

/* ---- Oren, an original forge-keeper ---- */
function torsoOren(g, face, c) {
  clothBase(g, c.shirt, face, 151);
  const leather = tone(c.leather, FACE_MUL[face] || 1);
  const belt = () => {
    rect(g, 0, 17, 32, 3, '#231a13');
    rect(g, 0, 17, 32, 1, '#3d2d20');
  };
  if (face === 'nz') {
    for (let i = 0; i < 4; i++) rect(g, 12 + i, i, 8 - i * 2, 1, c.skin);
    rect(g, 7, 0, 3, 4, leather);
    rect(g, 22, 0, 3, 4, leather);
    rect(g, 6, 4, 20, 28, leather);
    rect(g, 6, 4, 20, 1, tone(leather, 1.28));
    for (let y = 6; y < 31; y += 2) {
      dot(g, 7, y, tone(leather, 1.3));
      dot(g, 24, y, tone(leather, 1.3));
    }
    rivet(g, 7, 5, c.accent);
    rivet(g, 22, 5, c.accent);
    belt();
    rect(g, 13, 16, 6, 5, c.accent);
    rect(g, 15, 18, 2, 1, tone(c.accent, 0.5));
    rect(g, 10, 22, 12, 8, tone(leather, 0.82));
    rect(g, 10, 22, 12, 1, tone(leather, 1.2));
    rect(g, 12, 10, 3, 1, '#2a1d14');
    dot(g, 19, 12, '#2a1d14');
  } else if (face === 'pz') {
    for (let y = 0; y < 17; y++) {
      rect(g, 3 + y * 1.4, y, 3, 1, leather);
      rect(g, 26 - y * 1.4, y, 3, 1, leather);
    }
    belt();
  } else {
    belt();
  }
  rect(g, 0, 30, 32, 2, tone(c.shirt, 0.74));
}

function armOren(g, face, c, side) {
  if (face === 'py') { clothBase(g, c.shirt, face, 152); return; }
  skinBase(g, c, face);
  const m = FACE_MUL[face] || 1;
  rect(g, 0, 19, 32, 1, tone(c.skin, m * 0.8));
  clipRect(g, 0, 0, 32, 10, () => clothBase(g, c.shirt, face, 152));
  rect(g, 0, 10, 32, 3, tone(c.shirt, m * 1.2));
  rect(g, 0, 12, 32, 1, tone(c.shirt, m * 0.72));
  if (side === 'R') {
    clipRect(g, 0, 21, 32, 11, () => metalBase(g, c.accent, face, 153));
    rect(g, 0, 21, 32, 1, tone(c.accent, 0.5));
    rect(g, 0, 26, 32, 1, c.ember);
  } else {
    rect(g, 0, 22, 32, 8, tone(c.leather, m));
    rect(g, 0, 22, 32, 1, tone(c.leather, 1.3));
    for (let x = 4; x < 30; x += 8) dot(g, x, 26, c.accent);
  }
}

function legOren(g, face, c) {
  clothBase(g, c.pants, face, 154);
  const base = tone(c.pants, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 2, tone(base, 0.68));
  if (face === 'nz') {
    rect(g, 6, 11, 20, 9, tone(c.leather, 1.02));
    rect(g, 6, 11, 20, 1, tone(c.leather, 1.3));
    rivet(g, 8, 14, c.accent);
    rivet(g, 21, 14, c.accent);
  } else if (face === 'px' || face === 'nx') {
    rect(g, 0, 14, 32, 2, tone(c.leather, 0.9));
  }
  rect(g, 0, 26, 32, 6, tone(c.shoe, FACE_MUL[face] || 1));
  rect(g, 0, 26, 32, 1, tone(c.shoe, 1.5));
}

function shoeOren(g, face, c) {
  clothBase(g, c.shoe, face, 155);
  rect(g, 0, 27, 32, 5, tone(c.shoe, 0.55));
  if (face === 'nz') {
    clipRect(g, 3, 12, 26, 15, () => metalBase(g, '#71757d', face, 156));
    rect(g, 3, 12, 26, 1, '#a3a8b1');
  } else if (face === 'py') {
    rect(g, 6, 2, 20, 9, '#71757d');
  }
}

function handOren(g, face, c, side) {
  if (side === 'R') {
    metalBase(g, c.accent, face, 157);
    rect(g, 0, 0, 32, 3, tone(c.accent, 0.5));
    if (face === 'nz') for (let x = 6; x < 28; x += 7) rect(g, x, 16, 2, 10, tone(c.accent, 0.62));
    return;
  }
  skinBase(g, c, face);
  if (face === 'nz') rect(g, 2, 21, 28, 1, tone(c.skin, 0.72));
}

function paintApronSkirt(g, face, c) {
  paintLeather(g, face, c, 158);
  if (face === 'nz') {
    for (let y = 2; y < 30; y += 2) {
      dot(g, 2, y, tone(c.leather, 1.35));
      dot(g, 29, y, tone(c.leather, 1.35));
    }
    rect(g, 10, 18, 3, 2, '#1b1410');
    dot(g, 22, 10, '#1b1410');
  }
}

function paintPadOren(g, face, c) {
  paintLeather(g, face, c, 159);
  rect(g, 0, 24, 32, 3, c.accent);
  if (face === 'py') rivet(g, 14, 14, c.accent);
}

/* ---- Fayoum villager: a galabeya, a wrapped turban and sandals ---- */
function paintFayoumRobe(g, face, c) {
  clothBase(g, c.shirt, face, 161);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  const ink = c.trim, gold = c.accent;
  for (let x = 3; x < 32; x += 7) {
    rect(g, x, 0, 1, 25, tone(base, 0.86));
    rect(g, x + 1, 0, 1, 25, tone(base, 1.06));
  }
  if (face === 'nz') {
    rect(g, 14, 0, 4, 25, ink);
    for (let y = 1; y < 25; y += 3) rect(g, 15, y, 2, 1, gold);
  }
  rect(g, 0, 25, 32, 5, ink);
  rect(g, 0, 25, 32, 1, gold);
  rect(g, 0, 29, 32, 1, gold);
  for (let x = 1; x < 32; x += 4) rect(g, x, 27, 2, 1, gold);
  rect(g, 0, 30, 32, 2, tone(base, 0.78));
}

function paintFayoumCuff(g, face, c) {
  clothBase(g, c.shirt, face, 162);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  for (let x = 4; x < 32; x += 8) rect(g, x, 0, 1, 24, tone(base, 0.88));
  rect(g, 0, 22, 32, 7, c.trim);
  rect(g, 0, 22, 32, 1, c.accent);
  rect(g, 0, 28, 32, 1, c.accent);
  for (let x = 2; x < 32; x += 4) dot(g, x, 25, c.accent);
  rect(g, 0, 29, 32, 3, tone(base, 0.74));
}

function shoeFayoum(g, face, c) {
  skinBase(g, c, face);
  const strap = tone(c.shoe, FACE_MUL[face] || 1);
  rect(g, 0, 27, 32, 5, tone(c.shoe, 0.62));
  rect(g, 0, 27, 32, 1, tone(c.shoe, 1.25));
  if (face === 'nz') {
    rect(g, 0, 10, 32, 4, strap);
    rect(g, 0, 18, 32, 4, strap);
    for (let x = 3; x < 32; x += 6) rect(g, x, 24, 3, 3, tone(c.skin, 0.9));
  } else if (face === 'py') {
    rect(g, 0, 8, 32, 4, strap);
    rect(g, 0, 18, 32, 4, strap);
  } else if (face !== 'ny') {
    rect(g, 0, 13, 32, 4, strap);
  }
}

function paintTorso(g, face, c, key) {
  if (key === 'kratos') return torsoKratos(g, face, c);
  if (key === 'leon') return torsoLeon(g, face, c);
  if (key === 'steve') return torsoSteve(g, face, c);
  if (key === 'cj') return torsoCj(g, face, c);
  if (key === 'mario') return torsoMario(g, face, c);
  if (key === 'undead') return torsoUndead(g, face, c);
  if (key === 'ashen') return torsoAshen(g, face, c);
  if (key === 'wolf') return torsoWolf(g, face, c);
  if (key === 'tarnished') return torsoTarnished(g, face, c);
  if (key === 'seif') return torsoSeif(g, face, c);
  if (key === 'meedo') return torsoMeedo(g, face, c);
  if (key === 'mko') return torsoMko(g, face, c);
  if (key === 'mj') return torsoMj(g, face, c);
  if (key === 'hokage') return torsoHokage(g, face, c);
  if (key === 'kestrel') return torsoKestrel(g, face, c);
  if (key === 'oren') return torsoOren(g, face, c);
  return torsoFayoum(g, face, c);
}

/* ---- limbs ---- */
function armClassic(g, face, c, key) {
  if (key === 'cj') {
    skinBase(g, c, face);
    if (face !== 'py' && face !== 'ny') {
      rect(g, 5, 7, 2, 10, tone(c.skin, 0.86));
      rect(g, 24, 6, 2, 9, tone(c.skin, 1.1));
      rect(g, 8, 18, 16, 1, tone(c.skin, 0.79));
      rect(g, 12, 21, 2, 9, tone(c.skin, 1.05));
    }
    return;
  }
  if (key === 'steve') {
    if (face === 'ny') { skinBase(g, c, face); return; }
    armTee(g, face, c, 380);
    if (face !== 'py') {
      rect(g, 0, 11, 32, 2, tone(c.shirt, 0.8));
      charStitches(g, 0, 10, 32, 1, tone(c.shirt, 1.15));
      rect(g, 8, 19, 16, 1, tone(c.skin, 0.88));
    }
    return;
  }
  clothBase(g, c.shirt, face, 381);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  if (face === 'py') { charStitches(g, 3, 3, 26, 26, tone(base, 1.2)); return; }
  if (face === 'ny') { rect(g, 0, 0, 32, 32, tone(c.glove, 0.85)); return; }
  rect(g, 15, 2, 1, 24, tone(base, 0.72));
  rect(g, 5, 18, 22, 1, tone(base, 0.82));
  rect(g, 8, 19, 16, 1, tone(base, 1.15));
  rect(g, 0, 29, 32, 3, tone(c.glove, FACE_MUL[face] || 1));
  rect(g, 0, 28, 32, 1, tone(base, 0.66));
}

function legDenim(g, face, c, key, side) {
  clothBase(g, c.pants, face, key === 'cj' ? 382 : key === 'mario' ? 383 : 384);
  const base = tone(c.pants, FACE_MUL[face] || 1), thread = tone(base, 1.4);
  if (face === 'py') {
    rect(g, 1, 1, 30, 30, tone(base, 0.75));
    charStitches(g, 2, 2, 28, 28, thread);
    return;
  }
  if (face === 'ny') { rect(g, 2, 2, 28, 28, tone(base, 0.61)); return; }
  rect(g, 0, 0, 32, 2, key === 'cj' ? '#554638' : tone(base, 0.7));
  if (face === 'nz') {
    const px = side === 'L' ? 5 : 22;
    for (let y = 3; y < 9; y++) {
      const x = px + (side === 'L' ? y - 3 : 3 - y);
      dot(g, x, y, tone(base, 0.61));
      dot(g, x + 1, y, thread);
    }
    rect(g, 14, 10, 3, 15, tone(base, 1.14));
    rect(g, 7, 17, 18, 1, tone(base, 0.89));
    if (key === 'cj') {
      rect(g, 5, 14, 22, 7, tone(base, 1.1));
      rect(g, 8, 21, 16, 1, tone(base, 1.18));
    }
  } else if (face === 'pz') {
    rect(g, 6, 4, 20, 8, tone(base, 0.83));
    charStitches(g, 6, 4, 20, 8, thread);
    for (let x = 8; x < 24; x++) dot(g, x, 7 + Math.round(Math.abs(16 - x) / 4), thread);
    rect(g, 8, 20, 16, 1, tone(base, 0.85));
  } else {
    rect(g, 14, 2, 1, 28, tone(base, 0.66));
    charStitches(g, 16, 2, 2, 28, thread);
  }
  rect(g, 0, 28, 32, 4, tone(base, 0.74));
  charStitches(g, 0, 28, 32, 1, thread);
}

function shoeClassic(g, face, c, key) {
  if (key === 'cj') {
    shoeSneaker(g, face, c);
    if (face === 'py') {
      rect(g, 8, 3, 16, 21, '#e1e0da');
      for (let y = 6; y < 22; y += 4) rect(g, 10, y, 12, 2, '#ffffff');
      rect(g, 5, 25, 22, 2, '#ffffff');
    } else if (face === 'ny') {
      for (let y = 3; y < 31; y += 5) rect(g, 4, y, 24, 2, '#8e908c');
    }
    return;
  }
  charLeatherBase(g, c.shoe, face, key === 'mario' ? 385 : 386);
  const base = tone(c.shoe, FACE_MUL[face] || 1);
  if (face === 'ny') {
    rect(g, 0, 0, 32, 32, tone(base, 0.55));
    for (let y = 4; y < 31; y += 7) rect(g, 4, y, 24, 2, tone(base, 0.78));
  } else if (face === 'py') {
    rect(g, 6, 5, 20, 18, tone(base, 0.74));
    rect(g, 6, 23, 20, 3, tone(base, 1.3));
    if (key === 'steve') for (let y = 8; y < 20; y += 4) rect(g, 10, y, 12, 1, '#72706b');
  } else {
    rect(g, 0, 27, 32, 5, tone(base, 0.45));
    rect(g, 0, 26, 32, 1, tone(base, 1.15));
    if (face === 'nz') {
      rect(g, 4, 11, 24, 8, tone(base, 1.14));
      rect(g, 8, 12, 16, 2, tone(base, 1.28));
    } else if (face === 'pz') rect(g, 12, 2, 8, 23, tone(base, 0.73));
  }
}

function armWolf(g, face, c, side) {
  if (side === 'L') {
    charLeatherBase(g, '#705c42', face, 390);
    if (face === 'py') { clothBase(g, c.shirt, face, 391); return; }
    if (face === 'ny') { metalBase(g, c.metal, face, 392); return; }
    // Sekiro's LEFT prosthetic: wooden splints, metal pivots and wrapped cords.
    rect(g, 5, 6, 5, 24, '#3d3a32');
    rect(g, 22, 6, 5, 24, '#3d3a32');
    for (let y = 8; y < 31; y += 5) {
      rect(g, 0, y, 32, 2, c.wrap);
      rect(g, 0, y + 2, 32, 1, tone(c.wrap, 0.65));
    }
    rect(g, 0, 0, 32, 5, tone(c.shirt, FACE_MUL[face] || 1));
    if (face === 'nx' || face === 'px') {
      rect(g, 11, 13, 10, 7, c.metal);
      rivet(g, 14, 15, '#b8a276');
      rect(g, 14, 22, 3, 9, '#353a39');
    } else {
      rect(g, 14, 5, 3, 27, '#65553d');
      for (let y = 7; y < 30; y += 6) dot(g, 15, y, '#c2ad83');
    }
    return;
  }
  clothBase(g, c.shirt, face, 393);
  if (face === 'py') return;
  if (face === 'ny') { clothBase(g, c.wrap, face, 394); return; }
  rect(g, 15, 1, 1, 16, tone(c.shirt, 0.64));
  charStitches(g, 17, 2, 1, 14, tone(c.shirt, 1.28));
  clipRect(g, 0, 17, 32, 15, () => clothBase(g, c.wrap, face, 395));
  for (let y = 18; y < 32; y += 3) {
    rect(g, 0, y, 32, 1, tone(c.wrap, 0.62));
    rect(g, 0, y + 1, 32, 1, tone(c.wrap, 1.12));
  }
}

function handWolf(g, face, c, side) {
  if (side === 'R') {
    skinBase(g, c, face);
    if (face === 'py') { clothBase(g, c.wrap, face, 396); return; }
    rect(g, 0, 0, 32, 10, tone(c.wrap, FACE_MUL[face] || 1));
    if (face === 'nz' || face === 'pz') for (const x of [7, 14, 21]) rect(g, x, 19, 1, 11, tone(c.skin, 0.75));
    return;
  }
  charLeatherBase(g, '#705c42', face, 397);
  if (face === 'py') { metalBase(g, c.metal, face, 398); return; }
  const hi = '#af9974', lo = '#383a34';
  for (let x = 3; x < 31; x += 7) {
    rect(g, x, 8, 5, 22, hi);
    rect(g, x + 4, 8, 1, 22, lo);
    for (const y of [15, 23]) rect(g, x, y, 5, 2, c.metal);
  }
  rect(g, 0, 0, 32, 5, c.wrap);
  if (face === 'nz' || face === 'pz') rivet(g, 13, 8, c.metal);
}

function legWolf(g, face, c, side) {
  clothBase(g, c.pants, face, side === 'L' ? 399 : 400);
  const base = tone(c.pants, FACE_MUL[face] || 1);
  if (face === 'py') { rect(g, 1, 1, 30, 30, tone(base, 0.72)); return; }
  if (face === 'ny') { clothBase(g, c.wrap, face, 401); return; }
  if (face === 'nz') {
    rect(g, 8, 3, 1, 15, tone(base, 0.74));
    rect(g, 23, 4, 1, 13, tone(base, 1.23));
    rect(g, 6, 13, 20, 5, tone(base, 0.86));
  } else if (face === 'pz') rect(g, 15, 2, 1, 17, tone(base, 0.69));
  else charStitches(g, 15, 1, 1, 17, tone(base, 1.23));
  clipRect(g, 0, 18, 32, 14, () => clothBase(g, c.wrap, face, 402));
  for (let y = 18; y < 32; y += 3) {
    rect(g, 0, y, 32, 1, tone(c.wrap, 0.61));
    rect(g, 0, y + 1, 32, 1, tone(c.wrap, 1.13));
  }
  if (face === 'nz') rect(g, side === 'L' ? 8 : 21, 18, 2, 14, c.leather);
}

function shoeWolf(g, face, c) {
  clothBase(g, c.wrap, face, 403);
  if (face === 'ny') {
    rect(g, 0, 0, 32, 32, tone(c.shoe, 0.8));
    for (let y = 0; y < 32; y += 3) rect(g, 1, y, 30, 1, '#8a7958');
    return;
  }
  if (face === 'py' || face === 'nz') {
    rect(g, 12, 14, 2, 16, tone(c.wrap, 0.43));
    for (let y = 5; y < 26; y++) {
      dot(g, 4 + Math.floor(y / 2), y, c.leather);
      dot(g, 27 - Math.floor(y / 2), y, c.leather);
    }
  } else {
    for (const y of [10, 20]) rect(g, 0, y, 32, 2, c.leather);
  }
  if (face !== 'py') {
    rect(g, 0, 27, 32, 5, c.shoe);
    charStitches(g, 0, 28, 32, 1, '#b29b6a');
  }
}

function armSouls(g, face, c, key, side) {
  charChainmail(g, face, c.metal);
  if (face === 'py') {
    if (key === 'tarnished') { metalBase(g, c.metal, face, 410); charWolfEngraving(g, 1, 1, 30, 30, c); }
    return;
  }
  if (face === 'ny') { charLeatherBase(g, c.leather, face, 411); return; }
  const top = key === 'undead' ? 8 : 4;
  for (const band of [[top, 7], [19, 12]]) {
    clipRect(g, 0, band[0], 32, band[1], () => metalBase(g, c.metal, face, 412 + top));
    rect(g, 0, band[0], 32, 1, tone(c.trim, 0.94));
    rect(g, 0, band[0] + band[1] - 1, 32, 1, tone(c.metal, 0.47));
  }
  if (face === 'pz') {
    rect(g, 7, 13, 18, 6, tone(c.metal, 0.73));
    rect(g, 11, 14, 10, 1, c.trim);
  } else if (face === 'nz') {
    for (const x of [7, 15, 23]) {
      rect(g, x, 20, 1, 10, tone(c.metal, 0.56));
      rect(g, x + 1, 20, 1, 10, tone(c.metal, 1.24));
    }
  } else {
    rect(g, 12, 3, 5, 26, c.leather);
    for (const y of [9, 24]) rivet(g, 13, y, c.metal);
  }
  if (key === 'tarnished') {
    charWolfEngraving(g, 1, 20, 30, 10, c);
    rect(g, 0, 16, 32, 2, tone(c.accent, 0.75));
  } else if (key === 'undead') {
    rect(g, 0, 4, 32, 2, tone(c.leather, 0.88));
  }
  charArmorWear(g, face, c, side === 'L' ? 417 : 418);
  if (key === 'ashen') charFirelinkEmbers(g, face, 'arm' + side, c);
}

function legSouls(g, face, c, key, side) {
  clothBase(g, c.pants, face, 419);
  if (face === 'py') { charChainmail(g, face, c.metal); return; }
  if (face === 'ny') { charLeatherBase(g, c.shoe, face, 420); return; }
  if (key === 'undead') clipRect(g, 0, 0, 32, 10, () => charChainmail(g, face, c.metal));
  else if (key === 'tarnished') {
    rect(g, 0, 0, 32, 7, tone(c.accent, FACE_MUL[face] || 1));
    charStitches(g, 1, 1, 30, 6, tone(c.accent, 1.4));
  }
  if (face === 'nz') {
    clipRect(g, 3, 12, 26, 20, () => metalBase(g, c.metal, face, 421));
    for (const x of [7, 15, 23]) {
      rect(g, x, 13, 1, 18, tone(c.metal, 0.6));
      rect(g, x + 1, 13, 1, 18, tone(c.metal, 1.21));
    }
    rect(g, 5, 12, 22, 1, c.trim);
    rect(g, 5, 17, 22, 1, tone(c.metal, 0.5));
    if (key === 'tarnished') charWolfEngraving(g, 3, 12, 26, 10, c);
  } else if (face === 'pz') {
    for (const y of [13, 20, 28]) {
      rect(g, 0, y, 32, 3, c.leather);
      rect(g, 2, y, 28, 1, tone(c.leather, 1.3));
    }
    rect(g, 14, 12, 3, 20, tone(c.pants, 0.62));
  } else {
    const x = sideSpan(face, 0, 13);
    clipRect(g, x, 12, 13, 20, () => metalBase(g, c.metal, face, 422));
    rect(g, sideSpan(face, 12, 1), 12, 1, 20, c.trim);
    for (const y of [14, 27]) {
      rect(g, sideSpan(face, 13, 19), y, 19, 2, c.leather);
      rivet(g, sideSpan(face, 16, 3), y - 1, c.metal);
    }
  }
  if (face !== 'pz') charArmorWear(g, face, c, side === 'L' ? 423 : 424);
  if (key === 'ashen') charFirelinkEmbers(g, face, 'leg' + side, c);
}

function shoeSouls(g, face, c, key) {
  metalBase(g, c.metal, face, 425);
  if (face === 'ny') {
    charLeatherBase(g, c.shoe, face, 426);
    for (let y = 3; y < 30; y += 6) rect(g, 3, y, 26, 2, tone(c.shoe, 0.6));
    return;
  }
  if (face === 'nz' || face === 'py') {
    for (let y = 5; y < 26; y += 6) {
      rect(g, 1, y, 30, 2, tone(c.metal, 0.55));
      rect(g, 3, y + 2, 26, 1, tone(c.metal, 1.25));
    }
    rect(g, 14, 2, 3, 24, tone(c.metal, 1.1));
  } else if (face === 'pz') {
    charLeatherBase(g, c.shoe, face, 427);
    rect(g, 8, 3, 16, 17, tone(c.metal, 0.77));
  } else {
    rect(g, 0, 19, 32, 2, tone(c.metal, 0.53));
    charStitches(g, 2, 23, 28, 1, c.trim);
  }
  if (face !== 'py') rect(g, 0, 28, 32, 4, tone(c.shoe, 0.56));
  charArmorWear(g, face, c, 428);
  if (key === 'ashen') charFirelinkEmbers(g, face, 'shoe', c);
}

function handSouls(g, face, c, key) {
  if (face === 'ny') { charLeatherBase(g, c.leather, face, 429); return; }
  metalBase(g, c.metal, face, 430);
  if (face === 'py') {
    rect(g, 5, 5, 22, 22, tone(c.metal, 0.74));
    if (key === 'tarnished') charWolfEngraving(g, 3, 3, 26, 26, c);
    return;
  }
  rect(g, 0, 0, 32, 3, tone(c.metal, 0.52));
  for (let x = 4; x < 30; x += 7) {
    rect(g, x, 11, 1, 19, tone(c.metal, 0.42));
    rect(g, x + 1, 12, 4, 3, tone(c.metal, 1.2));
    rect(g, x + 1, 22, 4, 1, tone(c.metal, 0.58));
  }
  charArmorWear(g, face, c, 431);
  if (key === 'ashen') charFirelinkEmbers(g, face, 'hand', c);
}

function paintArm(g, face, c, key, side) {
  if (key === 'kratos') { armKratos(g, face, c, side); return; }
  if (key === 'leon') { armLeon(g, face, c, side); return; }
  if (key === 'seif') { armSeif(g, face, c, side); return; }
  if (key === 'meedo') { armTee(g, face, c, 127); return; }
  if (key === 'mko') { armMko(g, face, c); return; }
  if (key === 'mj') { armMj(g, face, c, side); return; }
  if (key === 'hokage') { armHokage(g, face, c, side); return; }
  if (key === 'kestrel') { armKestrel(g, face, c); return; }
  if (key === 'oren') { armOren(g, face, c, side); return; }
  if (key === 'steve' || key === 'cj' || key === 'mario') { armClassic(g, face, c, key); return; }
  if (key === 'wolf') { armWolf(g, face, c, side); return; }
  if (c.style === 'knight') { armSouls(g, face, c, key, side); return; }
  if (key === 'fayoum') {
    clothBase(g, c.shirt, face, 18);
    rect(g, 0, 25, 32, 3, c.accent);
    rect(g, 0, 28, 32, 4, tone(c.shirt, 0.85));
    return;
  }
  clothBase(g, c.shirt, face, 14);
  rect(g, 0, 26, 32, 2, tone(c.shirt, 0.82));
}

function paintLeg(g, face, c, key, side) {
  if (key === 'kratos') { legKratos(g, face, c, side); return; }
  if (key === 'leon') { legLeon(g, face, c, side); return; }
  if (key === 'seif') { legSeif(g, face, c, side); return; }
  if (key === 'meedo') { legMeedo(g, face, c); return; }
  if (key === 'mko') { legMko(g, face, c); return; }
  if (key === 'mj') { legMj(g, face, c); return; }
  if (key === 'hokage') { legHokage(g, face, c); return; }
  if (key === 'kestrel') { legKestrel(g, face, c); return; }
  if (key === 'oren') { legOren(g, face, c); return; }
  // Set-aware routing includes Raging Wolf; no Tarnished branch can be hidden
  // behind a generic all-metal knight return.
  if (c.style === 'knight') { legSouls(g, face, c, key, side); return; }
  if (key === 'steve' || key === 'cj' || key === 'mario') { legDenim(g, face, c, key, side); return; }
  if (key === 'wolf') { legWolf(g, face, c, side); return; }
  if (key === 'fayoum') {
    clothBase(g, c.pants, face, 24);
    rect(g, 0, 27, 32, 4, tone(c.pants, 0.8));
    return;
  }
  clothBase(g, c.pants, face, 25);
  rect(g, 0, 29, 32, 3, tone(c.pants, 0.82));
}

function paintShoe(g, face, c, key) {
  if (key === 'kratos') { shoeKratos(g, face, c); return; }
  if (key === 'leon') { shoeLeon(g, face, c); return; }
  if (c.style === 'knight') { shoeSouls(g, face, c, key); return; }
  if (key === 'steve' || key === 'cj' || key === 'mario') { shoeClassic(g, face, c, key); return; }
  if (key === 'wolf') { shoeWolf(g, face, c); return; }
  if (key === 'seif' || key === 'meedo') { shoeSneaker(g, face, c); return; }
  if (key === 'hokage') { shoeHokage(g, face, c); return; }
  if (key === 'mko') { shoeDress(g, face, c); return; }
  if (key === 'mj') { shoeMj(g, face, c); return; }
  if (key === 'kestrel') { shoeKestrel(g, face, c); return; }
  if (key === 'oren') { shoeOren(g, face, c); return; }
  if (key === 'fayoum') { shoeFayoum(g, face, c); return; }
  clothBase(g, c.shoe, face, 26);
  const sole = tone(c.shoe, 0.55);
  rect(g, 0, 27, 32, 5, sole);
  rect(g, 0, 27, 32, 1, tone(c.shoe, 0.75));
  if (face === 'nz') {
    rect(g, 12, 6, 8, 1, tone(c.shoe, 1.2));
    rect(g, 12, 10, 8, 1, tone(c.shoe, 1.2));
    rect(g, 12, 14, 8, 1, tone(c.shoe, 1.2));
    if (key === 'mario') {
      rect(g, 10, 5, 12, 4, c.accent);
      rect(g, 12, 6, 8, 2, tone(c.accent, 0.6));
    }
  }
  if (face === 'py') {
    rect(g, 0, 0, 32, 32, tone(c.shoe, 0.9));
    rect(g, 6, 6, 20, 20, tone(c.shoe, 0.8));
  }
}

function paintHand(g, face, c, key, side) {
  if (key === 'kratos') { handKratos(g, face, c); return; }
  if (key === 'leon') { handLeon(g, face, c, side); return; }
  if (key === 'mj') { handMj(g, face, c, side); return; }
  if (key === 'hokage') { handHokage(g, face, c); return; }
  if (key === 'kestrel') { handKestrel(g, face, c); return; }
  if (key === 'oren') { handOren(g, face, c, side); return; }
  if (key === 'mario') {
    rect(g, 0, 0, 32, 32, tone(c.glove, FACE_MUL[face] || 1));
    rect(g, 0, 0, 32, 3, tone(c.glove, 0.82));
    if (face === 'nz' || face === 'pz') {
      for (const x of [8, 15, 22]) rect(g, x, 12, 1, 12, tone(c.glove, 0.75));
      rect(g, 4, 27, 24, 1, tone(c.glove, 0.88));
    } else if (face === 'ny') {
      for (const x of [8, 15, 22]) rect(g, x, 2, 1, 28, tone(c.glove, 0.86));
    }
    return;
  }
  if (c.style === 'knight') { handSouls(g, face, c, key); return; }
  if (key === 'wolf') { handWolf(g, face, c, side); return; }
  skinBase(g, c, face);
  if (face === 'nz') rect(g, 2, 21, 28, 1, tone(c.skin, 0.82));
}

/* ---- capes & props ---- */
function paintCape(g, face, c, key) {
  const cloth = c.cape || tone(c.shirt, 0.8);
  clothBase(g, cloth, face, 41);
  const trim = c.trim || c.accent;
  if (face === 'nz' || face === 'pz') {
    for (let x = 4; x < 32; x += 7) rect(g, x, 0, 1, 32, tone(cloth, 0.86));
    for (let x = 8; x < 32; x += 7) rect(g, x, 0, 1, 32, tone(cloth, 1.12));
    rect(g, 0, 27, 32, 5, tone(cloth, 0.8));
    if (key === 'undead') {
      rect(g, 0, 0, 32, 4, trim);
      rect(g, 0, 27, 32, 2, trim);
      rect(g, 13, 10, 6, 2, trim);
      rect(g, 12, 12, 8, 2, trim);
      rect(g, 14, 14, 4, 4, trim);
    } else if (key === 'ashen') {
      for (let x = 0; x < 32; x++) {
        const cut = 23 + Math.round(rand2(x, 3, 44) * 9);
        rect(g, x, cut, 1, 32 - cut, '#1b1b1f');
      }
      rect(g, 0, 0, 32, 3, tone(cloth, 0.7));
    } else if (key === 'tarnished') {
      rect(g, 0, 0, 32, 3, trim);
      rect(g, 0, 28, 32, 2, trim);
      for (let x = 2; x < 32; x += 6) dot(g, x, 6, trim);
    }
  }
  rect(g, 0, 0, 32, 2, tone(cloth, 1.1));
}

function paintCap(g, face, c) {
  clothBase(g, c.shirt, face, 51);
  if (face === 'py') {
    for (let x = 0; x < 32; x++) {
      dot(g, x, x, tone(c.shirt, 0.7));
      dot(g, 31 - x, x, tone(c.shirt, 0.7));
    }
    rect(g, 12, 12, 8, 8, tone(c.shirt, 0.86));
    rect(g, 14, 14, 4, 4, tone(c.shirt, 0.94));
  } else if (face === 'ny') {
    rect(g, 4, 4, 24, 24, tone(c.shirt, 0.64));
  } else {
    rect(g, 15, 1, 1, 25, tone(c.shirt, 0.8));
    charStitches(g, 17, 2, 1, 23, tone(c.shirt, 1.16));
    rect(g, 0, 27, 32, 3, tone(c.shirt, 0.72));
  }
  if (face === 'nz') rect(g, 0, 24, 32, 2, tone(c.shirt, 0.8));
}

function paintCapBrim(g, face, c) {
  clothBase(g, c.shirt, face, 52);
  rect(g, 0, 18, 32, 14, tone(c.shirt, 0.78));
  rect(g, 0, 18, 32, 2, tone(c.shirt, 0.66));
}

function paintEmblem(g, face, c) {
  if (face !== 'nz') {
    rect(g, 0, 0, 32, 32, tone(c.shirt, 0.9));
    return;
  }
  rect(g, 0, 0, 32, 32, '#f7f7f2');
  for (const p of [[0, 0], [27, 0], [0, 27], [27, 27]]) rect(g, p[0], p[1], 5, 5, c.shirt);
  rect(g, 7, 8, 5, 17, c.shirt);
  rect(g, 20, 8, 5, 17, c.shirt);
  for (let i = 0; i < 8; i++) {
    rect(g, 12 + i, 8 + i, 2, 2, c.shirt);
    rect(g, 19 - i, 8 + i, 2, 2, c.shirt);
  }
  rect(g, 14, 15, 4, 2, c.shirt);
}

function paintPauldron(g, face, c, key) {
  metalBase(g, c.metal, face, 61);
  if (face === 'ny') { charChainmail(g, face, c.metal); return; }
  if (key === 'tarnished') {
    charWolfEngraving(g, 1, 1, 30, 26, c);
    for (let x = 1; x < 32; x += 5) {
      rect(g, x, 23, 3, 7, tone(c.trim, 1.02));
      dot(g, x + 1, 30, c.metal);
    }
  } else {
    for (let x = 3; x < 32; x += 5) {
      rect(g, x, 2, 1, 24, tone(c.metal, 0.56));
      rect(g, x + 1, 2, 1, 24, tone(c.metal, 1.22));
    }
    rect(g, 0, 26, 32, 4, tone(c.metal, 0.6));
    rect(g, 0, 25, 32, 1, c.metal);
    for (const x of [4, 25]) rivet(g, x, 22, c.metal);
  }
  charArmorWear(g, face, c, 432);
  if (key === 'ashen') charFirelinkEmbers(g, face, 'shoulder', c);
}

function paintBlade(g, face) {
  rect(g, 0, 0, 32, 32, '#c9ced8');
  rect(g, 14, 0, 4, 32, '#eef1f6');
  rect(g, 13, 0, 1, 32, '#8d939e');
  rect(g, 18, 0, 1, 32, '#8d939e');
  rect(g, 0, 0, 32, 3, '#8d939e');
  rect(g, 15, 29, 2, 3, '#9aa1ad');
}

function paintGrip(g, face) {
  rect(g, 0, 0, 32, 32, '#2a2118');
  for (let y = 2; y < 32; y += 4) rect(g, 0, y, 32, 2, '#4a3826');
}

function paintScarf(g, face, c) {
  clothBase(g, c.accent, face, 71);
  for (let x = 2; x < 32; x += 5) rect(g, x, 0, 1, 32, tone(c.accent, 0.8));
  rect(g, 0, 26, 32, 3, tone(c.accent, 0.7));
  rect(g, 0, 0, 32, 1, tone(c.accent, 1.2));
}

function paintTurban(g, face, c) {
  clothBase(g, c.shirt, face, 81);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  if (face === 'py' || face === 'ny') {
    rect(g, 8, 8, 16, 16, tone(base, 0.9));
    rect(g, 12, 12, 8, 8, tone(base, 1.06));
    return;
  }
  for (let i = -1; i < 6; i++) {
    for (let x = 0; x < 32; x++) {
      const y = i * 7 + Math.round(x / 4);
      rect(g, x, y, 1, 2, tone(base, 0.8));
      dot(g, x, y + 2, tone(base, 1.08));
    }
  }
}

function paintShield(g, face, c) {
  metalBase(g, c.metal, face, 433);
  if (face === 'pz') {
    charLeatherBase(g, '#514535', face, 434);
    for (const x of [7, 15, 23]) rect(g, x, 0, 1, 32, '#302c26');
    for (const y of [8, 21]) {
      rect(g, 4, y, 24, 4, c.leather);
      rivet(g, 4, y, c.metal);
      rivet(g, 25, y, c.metal);
    }
    return;
  }
  if (face !== 'nz') { rect(g, 12, 0, 8, 32, tone(c.metal, 1.24)); return; }
  rect(g, 2, 2, 28, 28, c.cape);
  rect(g, 2, 2, 28, 2, c.trim);
  rect(g, 2, 28, 28, 2, c.trim);
  rect(g, 2, 2, 2, 28, c.trim);
  rect(g, 28, 2, 2, 28, c.trim);
  rect(g, 14, 8, 4, 14, c.trim);
  rect(g, 9, 12, 14, 3, c.trim);
  rect(g, 11, 17, 10, 2, c.trim);
  rect(g, 13, 22, 6, 3, c.trim);
  for (const p of [[5, 5], [24, 5], [5, 24], [24, 24]]) rect(g, p[0], p[1], 2, 2, tone(c.trim, 1.1));
  charArmorWear(g, face, c, 435);
}

function paintMarioNose(g, face, c) {
  skinBase(g, c, face);
  if (face === 'nz' || face === 'py') rect(g, 7, 6, 18, 14, tone(c.skin, 1.12));
  if (face === 'ny') {
    rect(g, 5, 12, 6, 4, tone(c.skin, 0.76));
    rect(g, 21, 12, 6, 4, tone(c.skin, 0.76));
  }
}

function paintMarioMoustache(g, face) {
  const base = tone('#2e211a', FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  for (let x = 2; x < 32; x += 5) {
    rect(g, x, 3, 1, 24, tone(base, 1.24));
    rect(g, x + 1, 6, 1, 23, tone(base, 0.72));
  }
  rect(g, 0, 28, 32, 4, tone(base, 0.75));
}

function paintSoulsSkirt(g, face, c, key) {
  const cloth = key === 'undead' ? c.shirt : key === 'ashen' ? c.cape : c.accent;
  clothBase(g, cloth, face, 436);
  const base = tone(cloth, FACE_MUL[face] || 1);
  for (let x = 3; x < 32; x += 7) {
    rect(g, x, 1, 1, 30, tone(base, 0.57));
    rect(g, x + 1, 2, 1, 27, tone(base, 1.24));
  }
  if (key === 'undead') {
    charStitches(g, 1, 1, 30, 28, c.trim);
    rect(g, 0, 26, 32, 1, c.trim);
    for (let x = 2; x < 32; x += 4) rect(g, x, 28, 2, 2, c.trim);
  } else {
    for (let x = 0; x < 32; x++) {
      const y = 25 + Math.floor(rand2(x, 3, 437) * 6);
      rect(g, x, y, 1, 32 - y, tone(base, 0.45));
      if (x % 3 === 1) dot(g, x, y - 1, tone(base, 1.5));
    }
    if (key === 'ashen') charFirelinkEmbers(g, face, 'skirt', c);
  }
}

function paintSoulsMantle(g, face, c, key) {
  const color = key === 'undead' ? c.leather : c.cape;
  clothBase(g, color, face, 438);
  for (let y = 4; y < 31; y += 5) {
    rect(g, 0, y, 32, 1, tone(color, 0.61));
    rect(g, 0, y + 1, 32, 1, tone(color, 1.2));
  }
  charStitches(g, 1, 2, 30, 28, tone(color, 1.4));
}

function paintRagingMane(g, face, c) {
  charFurBase(g, c.hair, face, 439);
  const base = tone(c.hair, FACE_MUL[face] || 1);
  for (let x = 1; x < 32; x += 3) {
    rect(g, x, 1, 1, 29, tone(base, 0.71));
    rect(g, x + 1, 2, 1, 27, tone(base, 1.1));
  }
}

function paintFirelinkBlade(g, face, c) {
  metalBase(g, tone(c.metal, 0.7), face, 440);
  for (let y = 0; y < 32; y++) {
    const x = 13 + Math.round(Math.sin(y * 0.6) * 7);
    rect(g, x, y, 4, 1, tone(c.metal, 0.35));
    dot(g, x + 4, y, y % 4 ? c.accent : '#eebd7e');
  }
}

function paintWolfCoat(g, face, c) {
  clothBase(g, c.shirt, face, 441);
  const base = tone(c.shirt, FACE_MUL[face] || 1);
  charStitches(g, 2, 2, 28, 28, tone(base, 1.4));
  for (const x of [8, 23]) rect(g, x, 0, 1, 31, tone(base, 0.65));
  for (let x = 0; x < 32; x++) {
    const y = 27 + Math.floor(rand2(x, 2, 442) * 4);
    rect(g, x, y, 1, 32 - y, tone(base, 0.56));
  }
}

function paintWolfKatanaGrip(g, face, c) {
  rect(g, 0, 0, 32, 32, '#252a27');
  for (let y = 0; y < 32; y += 8) {
    for (let x = 0; x < 32; x++) {
      const d = Math.round(Math.abs(x - 16) / 5);
      rect(g, x, y + d, 1, 2, c.wrap);
    }
  }
}

function paintLeonHairProp(g, face, c) {
  const base = tone(c.hair, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  for (let y = 0; y < 32; y++) for (let x = -12; x < 32; x += 4) {
    const dx = x + Math.floor(y * 0.42);
    dot(g, dx, y, tone(base, 1.36));
    dot(g, dx + 1, y, tone(base, 0.7));
  }
}

/* The three Souls sets have different silhouettes, not just different dyes.
   All equipment stays attached to the existing joints, leaving armR free for
   the shared firearm mount and poses. */
function addSoulsOutfit(head, torso, armL, armR, c, key) {
  const shoulder = (g, f) => paintPauldron(g, f, c, key);
  const skirt = (g, f) => paintSoulsSkirt(g, f, c, key);
  const mantle = (g, f) => paintSoulsMantle(g, f, c, key);
  const steel = (g, f) => { metalBase(g, c.metal, f, 443); charArmorWear(g, f, c, 444); };
  const leather = (g, f) => charLeatherBase(g, c.leather, f, 445);

  if (key === 'undead') {
    paintedBox(armL, 0.29, 0.21, 0.34, 'elite-shoulder', shoulder, 0, 0.035, 0);
    paintedBox(armR, 0.23, 0.11, 0.28, 'elite-shoulder', shoulder, 0, 0.025, 0);
    paintedBox(torso, 0.5, 0.13, 0.34, 'elite-mantle', mantle, 0, 0.6, 0.005);
    for (const x of [-0.15, 0.15]) {
      paintedBox(torso, 0.21, 0.43, 0.035, 'elite-tabard', skirt, x, -0.17, -0.16);
      paintedBox(torso, 0.21, 0.39, 0.035, 'elite-tabard', skirt, x, -0.15, 0.16);
    }
    paintedBox(torso, 0.17, 0.18, 0.095, 'elite-pouch', leather, 0.2, 0.035, 0.19);
    paintedBox(armL, 0.43, 0.57, 0.07, 'elite-shield', (g, f) => paintShield(g, f, c), -0.03, -0.31, -0.155).rotation.y = 0.12;
    paintedBox(head, 0.055, 0.025, 0.47, 'elite-helm-ridge', steel, 0, 0.492, 0);
  } else if (key === 'ashen') {
    paintedBox(armL, 0.28, 0.18, 0.32, 'firelink-shoulder', shoulder, 0, 0.025, 0);
    paintedBox(armR, 0.24, 0.12, 0.29, 'firelink-shoulder', shoulder, 0, 0.025, 0);
    paintedBox(torso, 0.48, 0.1, 0.33, 'firelink-mantle', mantle, 0, 0.62, 0);
    paintedBox(torso, 0.43, 0.42, 0.03, 'firelink-back-rag', skirt, 0.04, 0.39, 0.17);
    for (const p of [[-0.15, 0.38], [0.15, 0.46]]) {
      paintedBox(torso, 0.21, p[1], 0.035, 'firelink-skirt', skirt, p[0], -p[1] / 2 + 0.045, -0.165);
      paintedBox(torso, 0.2, p[1] - 0.06, 0.035, 'firelink-skirt', skirt, p[0], -p[1] / 2 + 0.075, 0.165);
    }
    // Firelink's burned, contorted crown grows from the rear of the helm.
    for (const p of [[-0.17, 0.08, -0.19], [-0.08, 0.13, -0.1], [0, 0.16, 0.04], [0.08, 0.11, 0.13], [0.17, 0.075, 0.25]]) {
      paintedBox(head, 0.055, p[1], 0.09, 'firelink-crown', steel, p[0], 0.47 + p[1] / 2, 0.16).rotation.z = p[2];
    }
    for (const part of ['head', 'torso', 'armL', 'armR', 'legL', 'legR', 'handL', 'handR', 'shoe']) {
      const detail = part.startsWith('hand') ? 'hand' : part;
      addEmberGlow(partMaterial(key, c, part), (g, f) => charFirelinkEmbers(g, f, detail, c));
    }
  } else {
    for (const [arm, sign] of [[armL, -1], [armR, 1]]) {
      paintedBox(arm, 0.29, 0.18, 0.33, 'raging-shoulder', shoulder, 0, 0.04, 0);
      paintedBox(arm, 0.1, 0.12, 0.27, 'raging-shoulder-feathers', shoulder, sign * 0.13, -0.055, 0).rotation.z = -sign * 0.22;
    }
    paintedBox(torso, 0.55, 0.91, 0.04, 'raging-cape', (g, f) => paintCape(g, f, c, key), 0, 0.17, 0.19).rotation.x = 0.06;
    for (const x of [-0.15, 0.15]) paintedBox(torso, 0.19, 0.41, 0.035, 'raging-red-tassets', skirt, x, -0.16, -0.16);
    paintedBox(torso, 0.17, 0.27, 0.035, 'raging-mail-skirt', (g, f) => charChainmail(g, f, c.metal), 0, -0.1, -0.18);
    paintedBox(torso, 0.16, 0.17, 0.085, 'raging-pouch', leather, -0.23, 0.06, 0.09);
    const mane = (g, f) => paintRagingMane(g, f, c);
    paintedBox(head, 0.3, 0.16, 0.1, 'raging-mane', mane, 0, 0.43, 0.255);
    paintedBox(head, 0.34, 0.27, 0.13, 'raging-mane', mane, 0, 0.245, 0.28);
    paintedBox(head, 0.25, 0.24, 0.13, 'raging-mane', mane, 0, 0.015, 0.305).rotation.x = -0.16;
    paintedBox(head, 0.13, 0.14, 0.1, 'raging-mane', mane, 0.02, -0.15, 0.32).rotation.z = -0.12;
    const engraved = (g, f) => { steel(g, f); charWolfEngraving(g, 1, 1, 30, 30, c); };
    paintedBox(head, 0.36, 0.065, 0.43, 'raging-helm-dome', engraved, 0, 0.502, 0);
    paintedBox(head, 0.05, 0.08, 0.49, 'raging-helm-keel', steel, 0, 0.52, -0.015);
    paintedBox(head, 0.065, 0.22, 0.045, 'raging-nasal', engraved, 0, 0.29, -0.245);
  }

  const sword = new THREE.Group();
  if (key === 'ashen') {
    sword.position.set(-0.055, 0.31, 0.24);
    sword.rotation.z = 0.42;
    paintedBox(sword, 0.085, 0.9, 0.045, 'firelink-coiled-blade', (g, f) => paintFirelinkBlade(g, f, c), 0, 0.31, 0);
    paintedBox(sword, 0.23, 0.045, 0.085, 'firelink-guard', steel, 0, -0.16, 0);
    paintedBox(sword, 0.065, 0.24, 0.065, 'firelink-grip', paintGrip, 0, -0.3, 0);
  } else {
    sword.position.set(-0.28, 0.13, 0.04);
    sword.rotation.z = -0.3;
    sword.rotation.x = -0.18;
    paintedBox(sword, 0.06, 0.78, 0.055, 'souls-scabbard-' + key, leather, 0, -0.25, 0);
    paintedBox(sword, 0.055, 0.045, 0.06, 'souls-chape-' + key, steel, 0, -0.65, 0);
    paintedBox(sword, 0.18, 0.045, 0.085, 'souls-guard-' + key, steel, 0, 0.16, 0);
    paintedBox(sword, 0.055, 0.2, 0.055, 'souls-grip-' + key, paintGrip, 0, 0.28, 0);
  }
  torso.add(sword);
}

function paintPart(g, face, c, key, part) {
  if (part === 'head') paintHead(g, face, c, key);
  else if (part === 'torso') paintTorso(g, face, c, key);
  else if (part === 'armL') paintArm(g, face, c, key, 'L');
  else if (part === 'armR') paintArm(g, face, c, key, 'R');
  else if (part === 'legL') paintLeg(g, face, c, key, 'L');
  else if (part === 'legR') paintLeg(g, face, c, key, 'R');
  else if (part === 'shoe') paintShoe(g, face, c, key);
  else if (part === 'handL') paintHand(g, face, c, key, 'L');
  else if (part === 'handR') paintHand(g, face, c, key, 'R');
  volumeShade(g, face);
}

function charMakeHumanoidLeg(key, c, side, x) {
  const hip = new THREE.Group();
  hip.name = 'leg' + side;
  hip.position.set(x, CHAR_LEG_LENGTH, 0);
  const thigh = new THREE.Mesh(charHumanoidLegGeometry(true), partMaterial(key, c, 'leg' + side));
  thigh.name = 'thigh' + side;
  thigh.position.y = -CHAR_LEG_SEGMENT / 2;
  hip.add(thigh);
  const knee = new THREE.Group();
  knee.name = 'knee' + side;
  knee.position.y = -CHAR_LEG_SEGMENT;
  hip.add(knee);
  const shin = new THREE.Mesh(charHumanoidLegGeometry(false), thigh.material);
  shin.name = 'shin' + side;
  shin.position.y = -CHAR_LEG_SEGMENT / 2;
  knee.add(shin);
  const ankle = new THREE.Group();
  ankle.name = 'ankle' + side;
  ankle.position.y = -CHAR_LEG_SEGMENT;
  knee.add(ankle);
  const shoe = addPart(ankle, 0.24, 0.12, 0.28, key, c, 'shoe', 0, 0.02, -0.02);
  shoe.name = 'shoe' + side;
  return { hip, thigh, knee, shin, ankle, shoe, x };
}

function charStance01(value) {
  if (value === true) return 1;
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function charStanceDamp(value, target, alpha) {
  const next = value + (target - value) * alpha;
  return Math.abs(next - target) < 0.0001 ? target : next;
}

function charHumanoidLegPose(leg, hipY, hipZ, footY, footZ, low) {
  const forward = hipZ - footZ;
  let ankleY = footY;
  let dy = hipY - ankleY;
  let beta = Math.acos(Math.min(1, Math.hypot(dy, forward) / CHAR_LEG_LENGTH));
  let base = Math.atan2(forward, dy);
  let shinAngle = base - beta;
  if (low > 0 && ankleY < CHAR_LEG_HALF_DEPTH &&
      ankleY < CHAR_LEG_HALF_DEPTH * Math.abs(Math.sin(shinAngle))) {
    // The rotated calf's bottom corners must also clear the floor. Raise the
    // ankle pivot only as far as needed; the level shoe compensates below it.
    let lo = ankleY, hi = CHAR_LEG_HALF_DEPTH;
    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) * 0.5;
      const y = hipY - mid;
      const b = Math.acos(Math.min(1, Math.hypot(y, forward) / CHAR_LEG_LENGTH));
      const shin = Math.atan2(forward, y) - b;
      if (mid >= CHAR_LEG_HALF_DEPTH * Math.abs(Math.sin(shin))) hi = mid;
      else lo = mid;
    }
    ankleY = hi;
    dy = hipY - ankleY;
    beta = Math.acos(Math.min(1, Math.hypot(dy, forward) / CHAR_LEG_LENGTH));
    base = Math.atan2(forward, dy);
    shinAngle = base - beta;
  }
  const hipAngle = base + beta;
  leg.hip.position.set(leg.x, hipY, hipZ);
  // A downward thigh rotates toward authored -Z at positive hip-X. Choose
  // the forward knee solution, then flex the shin in the opposite direction.
  leg.hip.rotation.set(hipAngle, 0, 0);
  leg.knee.position.set(0, -CHAR_LEG_SEGMENT, 0);
  leg.knee.rotation.set(-2 * beta, 0, 0);
  leg.ankle.position.set(0, -CHAR_LEG_SEGMENT, 0);
  leg.ankle.rotation.set(-shinAngle, 0, 0);
  const actualAnkleY = hipY - CHAR_LEG_SEGMENT * (Math.cos(hipAngle) + Math.cos(shinAngle));
  leg.shoe.position.set(0, footY + 0.02 - actualAnkleY, -0.02);
  leg.shoe.rotation.set(0, 0, 0);
}

/* Shared local/remote pose API. Input weights are targets; dt=0 applies them
   immediately. The root stays at collision feet; head/weapon rotation is owned
   by the caller. A null pose resets ONLY knees/ankles/shoes for the legacy
   46-riding seated hip pose (which is applied later in frame/lateFrame). */
function poseHumanoidStance(root, pose, dt) {
  const data = root && root.userData;
  const parts = data && data.parts;
  const state = data && data.humanoidStance;
  if (!parts || !state || !parts.legL || !parts.legR || !parts.kneeL ||
      !parts.kneeR || !parts.ankleL || !parts.ankleR) return false;
  if (!pose) {
    state.stance = state.slide = state.dash = state.swing = state.air = 0;
    for (let i = 0; i < state.legs.length; i++) {
      const leg = state.legs[i];
      leg.knee.position.set(0, -CHAR_LEG_SEGMENT, 0);
      leg.knee.rotation.set(0, 0, 0);
      leg.ankle.position.set(0, -CHAR_LEG_SEGMENT, 0);
      leg.ankle.rotation.set(0, 0, 0);
      leg.shoe.position.set(0, 0.02, -0.02);
      leg.shoe.rotation.set(0, 0, 0);
    }
    return true;
  }
  const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
  const alpha = step > 0 ? 1 - Math.exp(-15 * step) : 1;
  const slideTarget = charStance01(pose.slide), dashTarget = charStance01(pose.dash);
  const airTarget = charStance01(pose.air);
  state.stance = charStanceDamp(state.stance, Math.max(charStance01(pose.stance), slideTarget, dashTarget), alpha);
  state.slide = charStanceDamp(state.slide, slideTarget, alpha);
  state.dash = charStanceDamp(state.dash, dashTarget, alpha);
  state.air = charStanceDamp(state.air, airTarget, alpha);
  state.swing = charStanceDamp(state.swing, Number.isFinite(pose.swing) ? Math.max(-1, Math.min(1, pose.swing)) : 0, alpha);
  const low = state.stance, slide = state.slide, dash = state.dash * (1 - slide);
  const hipY = CHAR_LEG_LENGTH - Math.min(0.455, low * 0.42 + slide * 0.04 + dash * 0.025);
  const hipZ = low * 0.2 + slide * 0.02 - dash * 0.05;
  const lean = -Math.max(0, Math.min(0.56, low * 0.5 + dash * 0.18 - slide * 0.12));
  const gait = state.swing * (1 - slide) * (1 - dash);
  // Ground contact wins over the fading jump weight: no hovering low stance
  // for several frames after landing. Airborne lift itself still eases in.
  const airLift = airTarget > 0 ? state.air * (0.08 + dash * 0.08) : 0;
  for (let i = 0; i < state.legs.length; i++) {
    const walkHip = i === 0 ? gait : -gait;
    const walkKnee = -Math.max(0, -walkHip) * 0.32;
    const walkY = CHAR_LEG_LENGTH - CHAR_LEG_SEGMENT * (Math.cos(walkHip) + Math.cos(walkHip + walkKnee));
    const walkZ = -CHAR_LEG_SEGMENT * (Math.sin(walkHip) + Math.sin(walkHip + walkKnee));
    const footY = walkY * (1 - low) + low * 0.04 + airLift;
    const footZ = walkZ * (1 - low) + low * (-walkHip * 0.12 +
      slide * (i === 0 ? -0.2 : 0.1) + dash * (i === 0 ? 0.06 : 0.12));
    charHumanoidLegPose(state.legs[i], hipY, hipZ, footY, footZ, low);
  }
  if (parts.torso) {
    parts.torso.position.y = hipY;
    parts.torso.position.z = hipZ;
    parts.torso.rotation.set(lean, 0, 0);
  }
  const cp = Math.cos(lean), sp = Math.sin(lean);
  if (parts.head) {
    parts.head.position.y = hipY + 0.62 * cp;
    parts.head.position.z = hipZ + 0.62 * sp;
  }
  for (let i = 0; i < 2; i++) {
    const arm = i === 0 ? parts.armL : parts.armR;
    if (!arm) continue;
    arm.position.y = hipY + 0.58 * cp;
    arm.position.z = hipZ + 0.58 * sp;
  }
  return true;
}

const charNpcStancePose = { stance: 0, slide: 0, dash: 0, swing: 0, air: 0 };

function makeHumanoid(key, tagText) {
  const c = CHARACTERS[key] || CHARACTERS.steve;
  const root = new THREE.Group();
  const parts = {};

  const leftLeg = charMakeHumanoidLeg(key, c, 'L', -0.13);
  const rightLeg = charMakeHumanoidLeg(key, c, 'R', 0.13);
  const legL = leftLeg.hip, legR = rightLeg.hip;

  const torso = new THREE.Group(); torso.position.set(0, 0.72, 0);
  addPart(torso, 0.52, 0.62, 0.28, key, c, 'torso', 0, 0.31, 0);

  const armL = new THREE.Group(); armL.position.set(-0.36, 1.3, 0);
  const armR = new THREE.Group(); armR.position.set(0.36, 1.3, 0);
  addPart(armL, 0.18, 0.66, 0.2, key, c, 'armL', 0, -0.31, 0);
  addPart(armR, 0.18, 0.66, 0.2, key, c, 'armR', 0, -0.31, 0);
  addPart(armL, 0.17, 0.14, 0.19, key, c, 'handL', 0, -0.66, 0);
  addPart(armR, 0.17, 0.14, 0.19, key, c, 'handR', 0, -0.66, 0);

  const head = new THREE.Group(); head.position.set(0, 1.34, 0);
  addPart(head, 0.46, 0.48, 0.46, key, c, 'head', 0, 0.24, 0);

  if (key === 'mario') {
    paintedBox(head, 0.5, 0.14, 0.5, 'cap-' + key, (g, f) => paintCap(g, f, c), 0, 0.5, 0.01);
    paintedBox(head, 0.46, 0.07, 0.22, 'brim-' + key, (g, f) => paintCapBrim(g, f, c), 0, 0.46, -0.29);
    paintedBox(head, 0.18, 0.13, 0.025, 'emblem-' + key, (g, f) => paintEmblem(g, f, c), 0, 0.54, -0.261);
    paintedBox(head, 0.42, 0.045, 0.43, 'mario-cap-top', (g, f) => paintCap(g, f, c), 0, 0.588, 0.025);
    paintedBox(head, 0.145, 0.095, 0.14, 'mario-nose', (g, f) => paintMarioNose(g, f, c), 0, 0.205, -0.27);
    for (const x of [-0.049, 0.049]) paintedBox(head, 0.108, 0.05, 0.03, 'mario-moustache', paintMarioMoustache, x, 0.125, -0.246).rotation.z = x > 0 ? -0.09 : 0.09;
    for (const arm of [armL, armR]) paintedBox(arm, 0.205, 0.065, 0.225, 'mario-glove-cuff', (g, f) => paintHand(g, f, c, key, 'L'), 0, -0.615, 0);
  }

  if (c.style === 'knight') {
    addSoulsOutfit(head, torso, armL, armR, c, key);
  }

  if (key === 'wolf') {
    const scarf = (g, f) => paintScarf(g, f, c);
    paintedBox(torso, 0.51, 0.14, 0.34, 'wolf-scarf', scarf, 0, 0.61, 0);
    paintedBox(torso, 0.13, 0.27, 0.035, 'wolf-scarf-tail', scarf, 0.12, 0.41, -0.17).rotation.z = -0.12;
    paintedBox(torso, 0.1, 0.23, 0.035, 'wolf-scarf-tail', scarf, -0.08, 0.44, 0.19).rotation.z = 0.14;
    const coat = (g, f) => paintWolfCoat(g, f, c);
    for (const x of [-0.16, 0.16]) {
      paintedBox(torso, 0.2, 0.39, 0.04, 'wolf-coat-tail', coat, x, -0.155, -0.155).rotation.z = x > 0 ? 0.06 : -0.06;
      paintedBox(torso, 0.22, 0.42, 0.035, 'wolf-coat-tail', coat, x, -0.17, 0.165);
    }
    const hair = (g, f) => paintHairCap(g, f, c, 446, false);
    paintedBox(head, 0.44, 0.055, 0.44, 'wolf-hair', hair, 0, 0.49, 0.015);
    paintedBox(head, 0.16, 0.13, 0.18, 'wolf-topknot', hair, 0, 0.57, 0.12).rotation.x = 0.15;
    paintedBox(head, 0.09, 0.2, 0.08, 'wolf-knot-tail', hair, 0, 0.49, 0.22).rotation.x = 0.45;
    paintedBox(head, 0.17, 0.035, 0.14, 'wolf-hair-tie', (g, f) => clothBase(g, c.wrap, f, 447), 0, 0.533, 0.12);
    paintedBox(armL, 0.035, 0.26, 0.06, 'wolf-prosthetic-splint', (g, f) => charLeatherBase(g, '#705c42', f, 448), -0.097, -0.44, 0);
    paintedBox(armL, 0.065, 0.065, 0.025, 'wolf-prosthetic-pivot', (g, f) => { metalBase(g, c.metal, f, 449); rivet(g, 13, 13, '#b8a276'); }, 0, -0.35, -0.113);
    const katana = new THREE.Group();
    katana.position.set(-0.28, 0.13, 0.04);
    katana.rotation.z = -0.35; katana.rotation.x = -0.45;
    paintedBox(katana, 0.045, 0.88, 0.05, 'wolf-katana-sheath', (g, f) => charLeatherBase(g, '#33352f', f, 450), 0, -0.22, 0);
    paintedBox(katana, 0.11, 0.035, 0.1, 'wolf-tsuba', (g, f) => metalBase(g, '#968365', f, 451), 0, 0.24, 0);
    paintedBox(katana, 0.05, 0.23, 0.05, 'wolf-tsuka', (g, f) => paintWolfKatanaGrip(g, f, c), 0, 0.375, 0);
    torso.add(katana);
  }

  if (key === 'steve') addTeeSleeves(armL, armR, key, c);

  if (key === 'kratos') {
    const leather = (g, f) => charLeatherBase(g, c.leather, f, 346);
    const fur = (g, f) => charFurBase(g, c.fur, f, 347);
    paintedBox(head, 0.3, 0.16, 0.105, 'kratos-beard', (g, f) => charFurBase(g, c.hair, f, 348), 0, 0.01, -0.207);
    paintedBox(armL, 0.28, 0.17, 0.32, 'kratos-pauldron', leather, 0, 0.01, 0);
    paintedBox(armL, 0.29, 0.065, 0.33, 'kratos-shoulder-fur', fur, 0, -0.1, 0);
    for (const x of [-0.14, 0.14]) {
      paintedBox(torso, 0.22, 0.31, 0.04, 'kratos-kilt', leather, x, -0.105, -0.16).rotation.z = x > 0 ? 0.1 : -0.1;
    }
    paintedBox(torso, 0.48, 0.13, 0.04, 'kratos-belt-fur', fur, 0, -0.025, 0.17);
    const axe = new THREE.Group();
    axe.position.set(0, 0.28, 0.25);
    axe.rotation.z = -0.48;
    const haft = (g, f) => paintKratosHaft(g, f, c);
    const blade = (g, f) => paintKratosAxe(g, f, c);
    const steel = (g, f) => metalBase(g, c.metal, f, 349);
    paintedBox(axe, 0.055, 1.12, 0.055, 'leviathan-haft', haft, 0, 0.07, 0);
    paintedBox(axe, 0.12, 0.18, 0.085, 'leviathan-socket', steel, 0, 0.56, 0);
    paintedBox(axe, 0.2, 0.18, 0.065, 'leviathan-blade', blade, 0.15, 0.56, 0);
    paintedBox(axe, 0.075, 0.3, 0.06, 'leviathan-edge', blade, 0.265, 0.555, 0);
    paintedBox(axe, 0.12, 0.075, 0.06, 'leviathan-beard', blade, 0.215, 0.397, 0);
    paintedBox(axe, 0.08, 0.075, 0.08, 'leviathan-pommel', steel, 0, -0.5, 0);
    torso.add(axe);
  }

  if (key === 'leon') {
    const hair = (g, f) => paintLeonHairProp(g, f, c);
    paintedBox(head, 0.445, 0.07, 0.445, 'leon-hair-cap', hair, 0, 0.495, 0);
    paintedBox(head, 0.25, 0.07, 0.31, 'leon-swept-crown', hair, 0.075, 0.545, -0.045).rotation.z = -0.12;
    paintedBox(head, 0.23, 0.105, 0.075, 'leon-swept-fringe', hair, 0.1, 0.405, -0.235).rotation.z = -0.16;
    paintedBox(head, 0.065, 0.12, 0.05, 'leon-loose-lock', hair, 0.168, 0.335, -0.24).rotation.z = -0.12;
    paintedBox(head, 0.13, 0.065, 0.25, 'leon-side-part', hair, -0.16, 0.52, -0.09).rotation.z = 0.1;
    const fur = (g, f) => charFurBase(g, c.fur, f, 365);
    paintedBox(torso, 0.43, 0.09, 0.07, 'leon-shearling-collar', fur, 0, 0.645, 0.135);
    for (const x of [-0.13, 0.13]) paintedBox(torso, 0.075, 0.2, 0.045, 'leon-shearling-lapel', fur, x, 0.55, -0.165).rotation.z = x > 0 ? -0.28 : 0.28;
    paintedBox(legR, 0.1, 0.23, 0.145, 'leon-thigh-holster', (g, f) => paintLeonHolster(g, f, c), 0.135, -0.18, 0.01);
    paintedBox(torso, 0.18, 0.13, 0.08, 'leon-belt-pouch', (g, f) => paintLeonHolster(g, f, c), 0.17, 0.05, 0.175);
  }

  if (key === 'fayoum') {
    const wrap = (g, f) => paintTurban(g, f, c);
    paintedBox(head, 0.49, 0.12, 0.49, 'turbanband', wrap, 0, 0.4, 0);
    paintedBox(head, 0.53, 0.15, 0.53, 'turban', wrap, 0, 0.5, 0);
    paintedBox(head, 0.38, 0.08, 0.38, 'turbantop', wrap, 0, 0.6, 0);
    paintedBox(head, 0.11, 0.24, 0.04, 'turbantail', wrap, 0.13, 0.3, 0.26);
    paintedBox(torso, 0.58, 0.6, 0.34, 'robe', (g, f) => paintFayoumRobe(g, f, c), 0, -0.28, 0);
    const cuff = (g, f) => paintFayoumCuff(g, f, c);
    paintedBox(armL, 0.22, 0.2, 0.24, 'fayoumcuff', cuff, 0, -0.48, 0);
    paintedBox(armR, 0.22, 0.2, 0.24, 'fayoumcuff', cuff, 0, -0.48, 0);
  }

  if (key === 'seif') {
    addTeeSleeves(armL, armR, key, c);
    const cap = (g, f) => paintHairCap(g, f, c, 118, false);
    paintedBox(head, 0.47, 0.06, 0.47, 'seifhair', cap, 0, 0.495, 0);
    paintedBox(head, 0.4, 0.07, 0.26, 'seifquiff', cap, 0, 0.55, -0.09);
    paintedBox(armL, 0.05, 0.24, 0.16, 'seiffolio', paintFolio, 0.09, -0.66, -0.03);
  }

  if (key === 'meedo') {
    addTeeSleeves(armL, armR, key, c);
    const cap = (g, f) => paintHairCap(g, f, c, 128, true);
    paintedBox(head, 0.47, 0.09, 0.47, 'meedohair', cap, 0, 0.51, 0);
    for (const p of [[-0.12, -0.13, 0.17], [0.12, -0.14, 0.18], [0, -0.04, 0.2], [-0.12, 0.1, 0.18], [0.12, 0.1, 0.17], [0, 0.14, 0.16]]) {
      paintedBox(head, p[2], 0.09, p[2], 'meedocurl', cap, p[0], 0.57, p[1]);
    }
    addBox(head, 0.03, 0.045, 0.045, c.accent, -0.238, 0.165, 0);
    addBox(head, 0.03, 0.045, 0.045, c.accent, 0.238, 0.165, 0);
  }

  if (key === 'hokage') {
    addTeeSleeves(armL, armR, key, c);
    const cap = (g, f) => paintHokageHair(g, f, c);
    const capGlow = (g) => hairSpeckle(g, 0, 0, 32, 32, c.ember, c.hot, 196, 8);
    addEmberGlow(paintedBox(head, 0.47, 0.08, 0.47, 'hokagehair', cap, 0, 0.5, 0).material, capGlow);
    for (const p of [
      [-0.15, 0.56, -0.14, 0.15, 0.12, 0.3, -0.2], [0.02, 0.58, -0.16, 0.18, 0.13, -0.12, -0.25],
      [0.16, 0.56, -0.1, 0.14, 0.11, -0.35, -0.1], [-0.1, 0.56, 0.06, 0.17, 0.1, 0.2, 0.15],
      [0.11, 0.57, 0.1, 0.16, 0.12, -0.25, 0.2], [0, 0.6, -0.02, 0.2, 0.15, 0.06, 0.02],
      [-0.24, 0.47, -0.08, 0.07, 0.05, -0.5, 0]
    ]) {
      const tuft = paintedBox(head, p[3], p[4], p[3], 'hokagetuft', cap, p[0], p[1], p[2]);
      tuft.rotation.set(p[6], 0, p[5]);
      addEmberGlow(tuft.material, capGlow);
    }
    paintedBox(armL, 0.185, 0.03, 0.205, 'hokageband', paintWatchMetal, 0, -0.62, 0);
    for (const [part, group] of [['torso', 'torso'], ['head', 'head'], ['armL', 'armL'], ['armR', 'armR'],
      ['handL', 'hand'], ['handR', 'hand'], ['legL', 'leg'], ['legR', 'leg'], ['shoe', 'shoe']]) {
      addEmberGlow(partMaterial(key, c, part), (g, f) => emberDetail(g, group, f, c));
    }
    addFlameFx(armL, c, 0, -0.72, -0.17);
    addEmberCloak(torso, armL, armR, c);
    addSmokeFx(torso, -0.34, 0.68, 0.1, 0);
    addSmokeFx(torso, 0.34, 0.68, 0.1, 0.45);
  }

  if (key === 'mko') {
    const cap = (g, f) => paintHairCap(g, f, c, 176, true);
    paintedBox(head, 0.45, 0.07, 0.45, 'mkohair', cap, 0, 0.5, 0);
    paintedBox(head, 0.2, 0.06, 0.2, 'mkotop', cap, 0.05, 0.615, -0.05);
    paintedBox(head, 0.16, 0.05, 0.16, 'mkotop2', cap, -0.09, 0.61, 0.03);
    for (const p of [[-0.13, -0.12, 0.18, 0.1], [0.13, -0.13, 0.17, 0.09], [0, -0.1, 0.2, 0.12], [-0.12, 0.08, 0.17, 0.08], [0.12, 0.08, 0.18, 0.09], [0, 0.11, 0.17, 0.09]]) {
      paintedBox(head, p[2], p[3], p[2], 'mkocurl', cap, p[0], 0.55, p[1]);
    }
    const collar = (g, f) => { clothBase(g, c.shirt, f, 177); rect(g, 0, 28, 32, 4, tone(c.shirt, 0.6)); };
    paintedBox(torso, 0.13, 0.055, 0.025, 'mkocollar', collar, 0.09, 0.595, -0.15).rotation.z = 0.5;
    paintedBox(torso, 0.13, 0.055, 0.025, 'mkocollar', collar, -0.09, 0.595, -0.15).rotation.z = -0.5;
    paintedBox(armL, 0.185, 0.04, 0.205, 'mkowatch', paintWatchMetal, 0, -0.665, 0);
    paintedBox(armL, 0.08, 0.08, 0.014, 'mkowatchface', paintWatchFace, 0, -0.665, -0.108);
  }

  if (key === 'mj') {
    const curl = (g, f) => paintMjHairProp(g, f, c);
    paintedBox(head, 0.075, 0.24, 0.085, 'mjcurl-side', curl, -0.235, 0.29, -0.09).rotation.z = 0.08;
    paintedBox(head, 0.075, 0.28, 0.085, 'mjcurl-side', curl, 0.235, 0.27, -0.07).rotation.z = -0.1;
    paintedBox(head, 0.085, 0.23, 0.075, 'mjcurl-front', curl, 0.17, 0.3, -0.245).rotation.z = -0.2;
    paintedBox(head, 0.32, 0.27, 0.075, 'mjcurl-back', curl, 0, 0.175, 0.245);

    const fedora = new THREE.Group();
    fedora.position.set(0, 0.51, 0);
    fedora.rotation.x = -0.035;
    fedora.rotation.z = -0.045;
    paintedBox(fedora, 0.65, 0.055, 0.62, 'mjfedora-brim', (g, f) => paintMjFedoraBrim(g, f, c), 0, 0, -0.015);
    paintedBox(fedora, 0.45, 0.22, 0.43, 'mjfedora-crown', (g, f) => paintMjFedoraCrown(g, f, c), 0, 0.137, 0.015);
    paintedBox(fedora, 0.465, 0.075, 0.445, 'mjfedora-band', (g, f) => paintMjFedoraBand(g, f, c), 0, 0.055, 0.015);
    head.add(fedora);
  }

  if (key === 'kestrel') {
    const strap = (g, f) => paintLeather(g, f, c, 145);
    paintedBox(head, 0.48, 0.05, 0.48, 'kestrelstrap', strap, 0, 0.385, 0);
    const lens = (g, f) => paintLens(g, f, c);
    paintedBox(head, 0.13, 0.1, 0.04, 'kestrellens', lens, -0.09, 0.39, -0.25);
    paintedBox(head, 0.13, 0.1, 0.04, 'kestrellens', lens, 0.09, 0.39, -0.25);
    const braid = (g, f) => paintBraid(g, f, c);
    paintedBox(head, 0.13, 0.17, 0.1, 'kestrelbraid', braid, 0, 0.2, 0.26);
    paintedBox(head, 0.12, 0.17, 0.1, 'kestrelbraid2', braid, 0, 0.05, 0.25);
    paintedBox(head, 0.1, 0.17, 0.09, 'kestrelbraid3', braid, 0, -0.1, 0.23);
    addBox(head, 0.11, 0.035, 0.1, c.accent, 0, -0.2, 0.225);
    paintedBox(head, 0.07, 0.09, 0.06, 'kestrelbraid4', braid, 0, -0.26, 0.22);
    paintedBox(armR, 0.23, 0.1, 0.25, 'kestrelpad', strap, 0, 0.02, 0);
    paintedBox(torso, 0.2, 0.18, 0.09, 'kestrelbag', strap, 0.17, 0.08, 0.18);
    addBox(torso, 0.05, 0.04, 0.02, c.brass, 0.17, 0.11, 0.23);
    const lance = new THREE.Group();
    lance.position.set(0, 0.3, 0.22);
    lance.rotation.z = 0.5;
    paintedBox(lance, 0.045, 1.28, 0.045, 'kestrelshaft', paintShaft, 0, 0.1, 0);
    paintedBox(lance, 0.075, 0.22, 0.03, 'kestreltip', (g, f) => metalBase(g, '#b9c6c9', f, 146), 0, 0.84, 0);
    paintedBox(lance, 0.19, 0.14, 0.015, 'kestrelflag', (g, f) => paintPennant(g, f, c), 0.11, 0.62, 0);
    addBox(lance, 0.06, 0.05, 0.06, c.brass, 0, -0.55, 0);
    torso.add(lance);
  }

  if (key === 'oren') {
    const cap = (g, f) => paintHairCap(g, f, c, 164, false);
    addBox(head, 0.14, 0.03, 0.14, c.accent, 0, 0.495, 0.05);
    paintedBox(head, 0.2, 0.1, 0.2, 'orenknot', cap, 0, 0.555, 0.05);
    paintedBox(head, 0.12, 0.05, 0.12, 'orenknot2', cap, 0, 0.625, 0.05);
    paintedBox(torso, 0.44, 0.38, 0.03, 'orenapron', (g, f) => paintApronSkirt(g, f, c), 0, -0.18, -0.15);
    paintedBox(armR, 0.26, 0.13, 0.28, 'orenpad', (g, f) => paintPadOren(g, f, c), 0, 0.02, 0);
    const hammer = new THREE.Group();
    hammer.position.set(0, 0.32, 0.21);
    hammer.rotation.z = -0.42;
    paintedBox(hammer, 0.06, 1.06, 0.06, 'orenhaft', paintGrip, 0, 0, 0);
    paintedBox(hammer, 0.38, 0.22, 0.23, 'orenhead', (g, f) => metalBase(g, '#3f4349', f, 165), 0, 0.52, 0);
    const band = (g, f) => metalBase(g, c.accent, f, 166);
    paintedBox(hammer, 0.05, 0.24, 0.25, 'orenband', band, -0.1, 0.52, 0);
    paintedBox(hammer, 0.05, 0.24, 0.25, 'orenband', band, 0.1, 0.52, 0);
    glowBox(hammer, 0.1, 0.07, 0.012, c.ember, 0, 0.52, -0.12);
    glowBox(hammer, 0.1, 0.07, 0.012, c.ember, 0, 0.52, 0.12);
    addBox(hammer, 0.09, 0.07, 0.09, c.accent, 0, -0.55, 0);
    torso.add(hammer);
  }

  root.add(legL, legR, torso, armL, armR, head);
  parts.legL = legL; parts.legR = legR; parts.armL = armL; parts.armR = armR;
  parts.torso = torso; parts.head = head;
  parts.thighL = leftLeg.thigh; parts.thighR = rightLeg.thigh;
  parts.kneeL = leftLeg.knee; parts.kneeR = rightLeg.knee;
  parts.shinL = leftLeg.shin; parts.shinR = rightLeg.shin;
  parts.ankleL = leftLeg.ankle; parts.ankleR = rightLeg.ankle;
  parts.shoeL = leftLeg.shoe; parts.shoeR = rightLeg.shoe;

  let tag = null;
  if (tagText) {
    tag = makeNameTag(tagText, c.style === 'fayoum' ? '#ffe6a8' : '#ffffff');
    tag.position.set(0, 2.18, 0);
    root.add(tag);
  }
  root.userData = { parts, tag, key, phase: 0,
    humanoidStance: { stance: 0, slide: 0, dash: 0, swing: 0, air: 0, legs: [leftLeg, rightLeg] } };
  if (typeof addCharacterOutline === 'function') addCharacterOutline(root);
  return root;
}

function makeNameTag(text, color) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = 'bold 30px ui-monospace, Menlo, Consolas, monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.45)';
  const w = Math.min(250, g.measureText(text).width + 26);
  g.fillRect((256 - w) / 2, 12, w, 40);
  g.fillStyle = color;
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.scale.set(1.9, 0.48, 1);
  return spr;
}

function makeChicken() {
  const root = new THREE.Group();
  const white = '#f4f1e8', red = '#c8382f', orange = '#e09a26';
  addBox(root, 0.36, 0.34, 0.5, white, 0, 0.38, 0);
  addBox(root, 0.26, 0.26, 0.26, white, 0, 0.6, -0.24);
  addBox(root, 0.1, 0.1, 0.12, orange, 0, 0.57, -0.4);
  addBox(root, 0.08, 0.1, 0.06, red, 0, 0.67, -0.36);
  addBox(root, 0.3, 0.06, 0.02, red, 0, 0.75, -0.24);
  addBox(root, 0.04, 0.16, 0.04, orange, -0.1, 0.1, 0);
  addBox(root, 0.04, 0.16, 0.04, orange, 0.1, 0.1, 0);
  const wingL = addBox(root, 0.04, 0.2, 0.3, white, -0.2, 0.4, 0);
  const wingR = addBox(root, 0.04, 0.2, 0.3, white, 0.2, 0.4, 0);
  const tail = new THREE.Group();
  tail.position.set(0, 0.5, 0.24);
  tail.rotation.x = -0.5;
  addBox(tail, 0.2, 0.16, 0.18, white, 0, 0, 0);
  root.add(tail);
  root.userData = { wingL, wingR, head: root.children[1] };
  return root;
}

const critters = [];
const critterGroup = new THREE.Group();
scene.add(critterGroup);

function spawnChicken(x, y, z) {
  if (critters.length > 150) return;
  const group = makeChicken();
  const c = {
    kind: 'chicken', group, x, y, z, vx: 0, vy: 0, vz: 0,
    yaw: Math.random() * Math.PI * 2,
    speed: 0, wanderSpeed: 0, timer: Math.random() * 2, phase: Math.random() * 6, hop: 0,
    onGround: false, inWater: false, hitWall: false,
    halfW: 0.22, height: 0.55
  };
  const phys = BC.api && BC.api.physics;
  if (phys && typeof phys.placeCritter === 'function') phys.placeCritter(c);
  group.position.set(c.x, c.y, c.z);
  critterGroup.add(group);
  critters.push(c);
}

function spawnVillager(x, y, z, homeX, homeZ, name) {
  if (critters.length > 180) return;
  // A village's fourth resident is a visiting performer. Count by home rather
  // than global spawn order so even tiny/partly skipped villages keep Fayoum.
  const villageIndex = critters.reduce((n, c) => n + (c.kind === 'villager' && c.homeX === homeX && c.homeZ === homeZ ? 1 : 0), 0);
  const character = villageIndex % 5 === 3 ? 'mj' : 'fayoum';
  const moonwalk = character === 'mj';
  const group = makeHumanoid(character, name);
  group.userData.character = character;
  group.userData.moonwalk = moonwalk;
  const c = {
    kind: 'villager', character, moonwalk, group, x, y, z, vx: 0, vy: 0, vz: 0,
    yaw: Math.random() * Math.PI * 2,
    speed: 0, timer: Math.random() * 2, phase: Math.random() * 6,
    onGround: false, inWater: false, hitWall: false, stuck: 0,
    halfW: 0.28, height: 1.7,
    homeX, homeZ, tx: x, tz: z, walking: false
  };
  const phys = BC.api && BC.api.physics;
  if (phys && typeof phys.placeCritter === 'function') phys.placeCritter(c);
  c.tx = c.x; c.tz = c.z;
  group.position.set(c.x, c.y, c.z);
  group.rotation.y = c.yaw + (moonwalk ? 0 : Math.PI);
  critterGroup.add(group);
  critters.push(c);
}

function spawnCritters() {
  for (let i = 0; i < 90; i++) {
    const x = 8 + Math.floor(hash2(i * 17 + 5, i * 29 + 3) * (WORLD - 16));
    const z = 8 + Math.floor(hash2(i * 37 + 13, i * 19 + 7) * (WORLD - 16));
    const h = terrainHeight(x, z);
    if (h <= SEA + 1) continue;
    if (h >= snowLineAt(x, z)) continue;
    spawnChicken(x + 0.5, h + 1, z + 0.5);
  }
}

function groundNear(x, z) {
  return terrainHeight(Math.round(x), Math.round(z)) + 1;
}

const CRITTER_PHYS_STEP = 1 / 120;
const CRITTER_MAX_DT = 0.05;
const CRITTER_FAR = 70;

function critterPickVillagerTarget(c) {
  // Same two random draws as the original timer branch, so a given seed keeps
  // the same wander pattern while physics only changes how it is travelled.
  const a = Math.random() * Math.PI * 2;
  const r = 4 + Math.random() * 8;
  c.tx = c.homeX + Math.cos(a) * r;
  c.tz = c.homeZ + Math.sin(a) * r;
  c.walking = true;
  c.stuck = 0;
}

/** True when a critter should not walk toward this point (wall or open water). */
function critterTargetBlocked(phys, c, nx, nz) {
  if (!phys) return true;
  if (typeof phys.solidAt === 'function' && phys.solidAt(nx, c.y + 1.1, nz)) return true;
  if (typeof phys.waterDepthAt === 'function' && phys.waterDepthAt(nx, c.y + 0.2, nz) > 0) return true;
  // Use edited voxels, not the original noise height: bridges, dug holes and
  // village floors must count. This also avoids biome object allocations.
  return typeof phys.supportAt === 'function' &&
    !Number.isFinite(phys.supportAt(nx, c.y + 1.02, nz, c.halfW, 2.1));
}

function updateCritters(dt) {
  if (!Number.isFinite(dt) || !(dt > 0)) return;
  if ((BC.flags && BC.flags.worldBusy) || (BC.api.world && BC.api.world.busy)) return;
  dt = Math.min(CRITTER_MAX_DT, dt);
  const px = player.pos.x, pz = player.pos.z;
  const phys = BC.api && BC.api.physics;
  // Reduced builds can omit physics, but must not run the old noise-height
  // fallback that let NPCs ghost through houses or hover over removed floors.
  if (!phys || typeof phys.stepCritter !== 'function') return;
  const steps = Math.max(1, Math.ceil(dt / CRITTER_PHYS_STEP));
  const h = dt / steps;

  // Fast graphics (phones) hides and pauses NPCs sooner; fog hides them anyway.
  const reach = BC.api.graphics && BC.api.graphics.quality === 'low' ? 48 : CRITTER_FAR;
  const farSq = reach * reach;
  for (let i = 0; i < critters.length; i++) {
    const c = critters[i];
    const dx = c.x - px, dz = c.z - pz;
    const far = dx * dx + dz * dz > farSq;
    c.group.visible = !far;
    if (far) continue;

    if (!Number.isFinite(c.vx)) c.vx = 0;
    if (!Number.isFinite(c.vz)) c.vz = 0;
    if (!Number.isFinite(c.vy)) c.vy = 0;
    if (c.kind === 'chicken' && !Number.isFinite(c.wanderSpeed)) c.wanderSpeed = c.speed || 0;
    if (typeof phys.supportAt === 'function') {
      c.onGround = c.vy <= 0 && Number.isFinite(phys.supportAt(c.x, c.y, c.z, c.halfW, 0.05));
    }

    const startX = c.x, startZ = c.z;
    let speed = 0;
    let moving = false;

    c.timer -= dt;
    if (c.kind === 'chicken') {
      if (c.timer <= 0) {
        c.timer = 1.2 + Math.random() * 3;
        if (Math.random() < 0.45) {
          c.wanderSpeed = 0;
        } else {
          c.yaw = Math.random() * Math.PI * 2;
          c.wanderSpeed = 0.55 + Math.random() * 0.5;
          const nx = c.x + Math.sin(c.yaw) * 2.5;
          const nz = c.z + Math.cos(c.yaw) * 2.5;
          if (critterTargetBlocked(phys, c, nx, nz)) { c.wanderSpeed = 0; c.yaw += Math.PI; }
        }
        if (Math.random() < 0.3) c.hop = 1;
      }
      if (c.hop) {
        if (c.onGround && !c.inWater && !(typeof phys.liquidAt === 'function' && phys.liquidAt(c.x, c.y + 0.08, c.z))) {
          c.vy = 3.6; c.onGround = false;
        }
        c.hop = 0;
      }
      speed = c.wanderSpeed;
      moving = speed > 0 && (c.onGround || c.inWater || c.vy > 0);
    } else {
      const moonwalking = c.moonwalk === true;
      if (c.timer <= 0) {
        c.timer = 2 + Math.random() * 4;
        c.walking = Math.random() < 0.6;
        if (c.walking) critterPickVillagerTarget(c);
      }
      if (c.walking) {
        const dx2 = c.tx - c.x, dz2 = c.tz - c.z;
        const d = Math.hypot(dx2, dz2);
        if (d < 0.4) {
          c.walking = false;
          c.timer = 1 + Math.random() * 3;
          c.speed = 0;
          c.stuck = 0;
        } else {
          const want = Math.atan2(dx2, dz2);
          let diff = want - c.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          c.yaw += diff * Math.min(1, dt * 5);
          speed = moonwalking ? 1.2 : 0.95;
          moving = true;
        }
      }
    }

    // NPCs never collide with the player, so clear their path instead of
    // letting them stand in it. Chickens bolt; villagers drift to a new target.
    const pdx = c.x - px, pdz = c.z - pz;
    const pd2 = pdx * pdx + pdz * pdz;
    const clear = c.kind === 'chicken' ? 1.7 : 1.35;
    if (pd2 < clear * clear) {
      const inv = pd2 > 0.000001 ? 1 / Math.sqrt(pd2) : 0;
      const ax = inv ? pdx * inv : Math.sin(c.yaw);
      const az = inv ? pdz * inv : Math.cos(c.yaw);
      if (c.kind === 'chicken') {
        c.yaw = Math.atan2(ax, az);
        speed = Math.max(speed, 1.1);
        moving = true;
      } else {
        c.tx = c.x + ax * 2.6;
        c.tz = c.z + az * 2.6;
        c.yaw = Math.atan2(ax, az);
        c.walking = true;
        speed = Math.max(speed, 0.9);
        moving = true;
      }
    }

    c.speed = moving ? speed : 0;
    c.vx = moving ? Math.sin(c.yaw) * speed : 0;
    c.vz = moving ? Math.cos(c.yaw) * speed : 0;
    c.hitWall = false;

    for (let s = 0; s < steps; s++) {
      phys.stepCritter(c, h);
    }

    if (c.kind === 'villager') {
      if (c.walking && c.speed > 0.05) {
        const moved = Math.hypot(c.x - startX, c.z - startZ);
        if (moved < Math.max(0.0003, c.speed * dt * 0.3)) c.stuck += dt;
        else c.stuck = 0;
        if (c.stuck > 1.2) critterPickVillagerTarget(c);
      } else {
        c.stuck = 0;
      }
    }

    if (c.hitWall) {
      c.hitWall = false;
      if (c.kind === 'chicken') {
        c.yaw += Math.PI * 0.75 + Math.random() * 0.5;
        c.speed = 0;
        c.wanderSpeed = 0;
        c.timer = 0.6 + Math.random() * 1.1;
      }
    }

    if (c.kind === 'chicken') {
      if (moving && c.onGround && !c.inWater) c.phase += dt * 9;
      else if (moving && c.inWater) c.phase += dt * 4;
      c.group.position.set(c.x, c.y, c.z);
      c.group.rotation.y = c.yaw;
      c.group.rotation.z = Math.sin(c.phase) * 0.05;
    } else {
      const moonwalking = c.moonwalk === true;
      if (moving) c.phase += dt * (moonwalking ? 8.5 : 7);
      c.group.position.set(c.x, c.y, c.z);
      // Humanoids are authored facing -Z. Fayoum turns into travel; MJ keeps
      // the old away-from-travel pose while physics still advances at yaw.
      c.group.rotation.y = c.yaw + (moonwalking ? 0 : Math.PI);
      if (c.group.userData.tag) c.group.userData.tag.visible = (dx * dx + dz * dz) < 40 * 40;
    }

    // limb animation for humanoids
    const parts = c.group.userData.parts;
    if (parts) {
      const swing = Math.sin(c.phase) * (c.speed > 0 ? 0.7 : 0.05);
      charNpcStancePose.swing = swing;
      charNpcStancePose.air = !c.onGround && !c.inWater ? 1 : 0;
      if (!poseHumanoidStance(c.group, charNpcStancePose, dt)) {
        parts.legL.rotation.x = swing;
        parts.legR.rotation.x = -swing;
      }
      parts.armL.rotation.x = -swing * 0.8;
      parts.armR.rotation.x = swing * 0.8;
      parts.head.rotation.y = Math.sin(c.phase * 0.3) * 0.15;
    } else if (c.group.userData.wingL) {
      const flap = Math.sin(c.phase * 2) * 0.15;
      c.group.userData.wingL.rotation.z = flap;
      c.group.userData.wingR.rotation.z = -flap;
    }
  }
}
