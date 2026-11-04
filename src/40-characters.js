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
    name: 'Ashen One', skin: '#8b8681', hair: '#2a2a2e', shirt: '#3c3c44',
    sleeve: '#3c3c44', pants: '#2a2a30', shoe: '#1d1d21', style: 'knight',
    accent: '#ff8a2e', metal: '#6b6d78', trim: '#a9acb8', cape: '#33343d'
  },
  undead: {
    name: 'Chosen Undead', skin: '#9aa08a', hair: '#433d33', shirt: '#8e939c',
    sleeve: '#8e939c', pants: '#4c473d', shoe: '#2c2823', style: 'knight',
    accent: '#3f6fb5', metal: '#b9c1cc', trim: '#d8b85c', cape: '#34578f'
  },
  wolf: {
    name: 'Wolf', skin: '#caa27d', hair: '#2e2318', shirt: '#4a525e',
    sleeve: '#4a525e', pants: '#2e333a', shoe: '#1f2226', style: 'shinobi',
    accent: '#a83a3a'
  },
  tarnished: {
    name: 'Tarnished', skin: '#d6c6a4', hair: '#9a8a5e', shirt: '#7c6c46',
    sleeve: '#8d7c52', pants: '#57492f', shoe: '#2c2418', style: 'knight',
    accent: '#d8b85c', metal: '#9c8a5a', trim: '#e3c978', cape: '#454b34'
  },
  fayoum: {
    name: 'Fayoum', skin: '#a9744f', hair: '#2a1e14', shirt: '#e8e2d0',
    sleeve: '#e8e2d0', pants: '#8d7a5e', shoe: '#5a4632', style: 'fayoum',
    accent: '#c9a227'
  }
};

const CHAR_KEYS = ['steve', 'cj', 'mario', 'ashen', 'undead', 'wolf', 'tarnished'];

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
  const mesh = new THREE.Mesh(atlasBox(w, h, d), texMaterial('prop|' + id, paint));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/* ---------------- character pixel painters ---------------- */
function skinBase(g, c, face) {
  const base = tone(c.skin, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  for (let i = 0; i < 80; i++) {
    const x = (rand2(i, 5, 21) * 32) | 0, y = (rand2(i, 9, 22) * 32) | 0;
    dot(g, x, y, tone(base, rand2(i, 3, 23) > 0.5 ? 0.93 : 1.05));
  }
  rect(g, 0, 29, 32, 3, tone(base, 0.92));
}

function clothBase(g, color, face, seed) {
  const base = tone(color, FACE_MUL[face] || 1);
  rect(g, 0, 0, 32, 32, base);
  for (let x = 0; x < 32; x += 3) rect(g, x, 0, 1, 32, tone(base, 0.95));
  for (let y = 0; y < 32; y += 5) rect(g, 0, y, 32, 1, tone(base, 0.97));
  for (let i = 0; i < 64; i++) {
    const x = (rand2(i, 4, seed) * 32) | 0, y = (rand2(i, 8, seed) * 32) | 0;
    dot(g, x, y, tone(base, rand2(i, 2, seed) > 0.55 ? 1.06 : 0.91));
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
  rect(g, 0, 30, 32, 2, tone(base, 0.78));
}

function rivet(g, x, y, color) {
  rect(g, x, y, 3, 3, tone(color, 0.6));
  rect(g, x + 1, y + 1, 2, 2, tone(color, 1.15));
  dot(g, x + 1, y + 1, '#f2f2f2');
}

function eye(g, x, y, glow) {
  rect(g, x, y, 5, 3, '#e9e3d4');
  rect(g, x + 1, y + 1, 3, 2, glow || '#241a14');
  if (glow) {
    rect(g, x + 2, y + 1, 2, 1, '#ffffff');
  } else {
    dot(g, x + 2, y + 1, '#4a3020');
    dot(g, x + 1, y + 1, '#5a3a26');
  }
}

function hairBase(g, face, c) {
  const base = tone(c.hair, FACE_MUL[face] || 1);
  const hi = tone(base, 1.14), lo = tone(base, 0.78);
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
    for (let x = 0; x < 32; x++) {
      const d = 17 + Math.round(rand2(x, 2, 7) * 7);
      rect(g, x, 0, 1, d, base);
      rect(g, x, d - 1, 1, 1, lo);
    }
    for (let x = 1; x < 32; x += 4) rect(g, x, 1, 1, 13, hi);
  } else {
    rect(g, 0, 0, 32, 12, base);
    for (let x = 1; x < 32; x += 4) rect(g, x, 1, 1, 10, hi);
    for (let i = 0; i < 8; i++) rect(g, 0, 11 + i, 12 - i, 1, base);
    rect(g, 0, 19, 4, 1, lo);
  }
}

function paintFace(g, c, key) {
  const skin = c.skin, hair = c.hair;
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
    rect(g, 4, 19, 24, 13, '#2b3038');
    rect(g, 4, 19, 24, 1, '#454d59');
    for (let x = 6; x < 28; x += 4) rect(g, x, 21, 1, 10, '#232830');
    rect(g, 11, 22, 10, 1, '#1c2027');
    rect(g, 4, 30, 24, 1, '#20242b');
  } else if (key === 'tarnished') {
    rect(g, 11, 24, 10, 2, '#6b5a3c');
    rect(g, 10, 26, 12, 5, tone(hair, 0.9));
    rect(g, 13, 28, 6, 3, tone(hair, 1.08));
    rect(g, 6, 21, 2, 2, tone(hair, 0.92));
    rect(g, 24, 21, 2, 2, tone(hair, 0.92));
  } else if (key === 'fayoum') {
    rect(g, 12, 24, 8, 1, '#3a2618');
    rect(g, 10, 25, 12, 6, tone(hair, 0.95));
    rect(g, 14, 27, 4, 4, tone(hair, 1.1));
    rect(g, 6, 14, 2, 1, '#1a1a1a');
    rect(g, 24, 14, 2, 1, '#1a1a1a');
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
  const m = c.metal, dark = tone(m, 0.52);
  metalBase(g, m, face, key === 'undead' ? 4 : 9);
  if (face === 'py') {
    rect(g, 8, 8, 16, 16, tone(m, 1.06));
    rect(g, 13, 13, 6, 6, tone(m, 1.14));
    rect(g, 0, 0, 32, 3, dark);
    for (let i = 0; i < 4; i++) rivet(g, 4 + i * 8, 4, c.trim || m);
    return;
  }
  rect(g, 0, 28, 32, 4, dark);
  rect(g, 0, 28, 32, 1, tone(m, 0.82));
  if (face === 'nz') {
    if (key === 'undead') {
      rect(g, 4, 12, 24, 5, '#0b0e13');
      rect(g, 15, 12, 3, 14, '#0b0e13');
      rect(g, 6, 13, 7, 3, c.accent);
      rect(g, 19, 13, 7, 3, c.accent);
      rect(g, 8, 13, 3, 1, '#eaf4ff');
      rect(g, 21, 13, 3, 1, '#eaf4ff');
      rect(g, 0, 7, 32, 3, c.trim);
      dot(g, 15, 8, tone(c.trim, 1.25));
      rivet(g, 4, 20, c.trim);
      rivet(g, 26, 20, c.trim);
      rect(g, 15, 5, 2, 7, tone(m, 1.2));
    } else {
      rect(g, 4, 11, 24, 7, '#08080a');
      rect(g, 5, 12, 22, 5, tone(c.accent, 0.45));
      rect(g, 6, 13, 8, 2, c.accent);
      rect(g, 18, 13, 8, 2, c.accent);
      rect(g, 8, 13, 4, 1, '#ffe0b4');
      rect(g, 20, 13, 4, 1, '#ffe0b4');
      rect(g, 15, 11, 2, 7, '#08080a');
      rect(g, 0, 6, 32, 2, tone(m, 1.22));
      rect(g, 15, 0, 2, 11, tone(m, 1.15));
      rect(g, 15, 18, 2, 10, dark);
      rivet(g, 3, 18, c.trim);
      rivet(g, 27, 18, c.trim);
    }
  } else if (face === 'pz') {
    rect(g, 15, 0, 2, 30, dark);
    rect(g, 0, 20, 32, 1, tone(m, 0.7));
    rivet(g, 5, 23, c.trim || m);
    rivet(g, 25, 23, c.trim || m);
  } else {
    rect(g, 12, 14, 8, 8, dark);
    rect(g, 13, 15, 6, 6, tone(m, 1.1));
    rect(g, 15, 17, 2, 2, '#1a1a1a');
    rect(g, 0, 22, 32, 2, tone(m, 0.72));
    rivet(g, 4, 7, c.trim || m);
  }
  rect(g, 0, 26, 4, 4, tone(m, 0.8));
  rect(g, 28, 26, 4, 4, tone(m, 0.8));
}

function paintHead(g, face, c, key) {
  if (c.style === 'knight') return paintHelm(g, face, c, key);
  skinBase(g, c, face);
  hairBase(g, face, c);
  if (face === 'nz') paintFace(g, c, key);
  if (face === 'px' || face === 'nx') paintEar(g, face, c, key);
}

/* ---- torsos ---- */
function torsoSteve(g, face, c) {
  clothBase(g, c.shirt, face, 11);
  const dark = tone(c.shirt, 0.78);
  if (face === 'nz') {
    rect(g, 12, 0, 8, 4, c.skin);
    rect(g, 13, 4, 6, 2, tone(c.skin, 0.85));
    rect(g, 10, 0, 2, 5, dark);
    rect(g, 20, 0, 2, 5, dark);
    rect(g, 0, 28, 32, 1, dark);
  } else if (face === 'pz') {
    rect(g, 0, 10, 32, 1, tone(c.shirt, 0.9));
  } else {
    rect(g, 0, 0, 32, 3, dark);
  }
}

function torsoCj(g, face, c) {
  skinBase(g, c, face);
  const white = tone(c.shirt, FACE_MUL[face] || 1);
  rect(g, 4, 2, 24, 30, white);
  if (face === 'nz') {
    rect(g, 10, 2, 12, 6, c.skin);
    rect(g, 11, 2, 10, 3, tone(c.skin, 1.04));
    for (let i = 0; i < 6; i++) {
      dot(g, 15 - i, 5 + i, c.accent);
      dot(g, 16 - i, 6 + i, tone(c.accent, 0.8));
      dot(g, 16 + i, 5 + i, c.accent);
      dot(g, 15 + i, 6 + i, tone(c.accent, 0.8));
    }
    rect(g, 14, 11, 4, 4, c.accent);
    rect(g, 15, 12, 2, 2, tone(c.accent, 1.25));
    rect(g, 8, 16, 1, 12, tone(white, 0.9));
    rect(g, 23, 16, 1, 12, tone(white, 0.9));
    rect(g, 12, 18, 1, 8, tone(white, 0.94));
  } else if (face === 'pz') {
    rect(g, 12, 2, 8, 3, c.skin);
    rect(g, 4, 10, 24, 1, tone(white, 0.9));
  }
  rect(g, 4, 30, 24, 2, tone(white, 0.85));
}

function torsoMario(g, face, c) {
  clothBase(g, c.shirt, face, 12);
  const blue = tone(c.pants, FACE_MUL[face] || 1);
  const gold = c.accent;
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
    rect(g, 15, 24, 2, 8, tone(blue, 0.88));
    rect(g, 3, 30, 26, 2, tone(blue, 0.8));
  } else if (face === 'pz') {
    rect(g, 3, 12, 26, 20, blue);
    rect(g, 5, 1, 5, 14, blue);
    rect(g, 22, 1, 5, 14, blue);
    rect(g, 8, 9, 16, 3, blue);
    rect(g, 4, 20, 24, 1, tone(blue, 0.85));
  } else {
    rect(g, 3, 12, 26, 20, blue);
    rect(g, 5, 0, 6, 13, blue);
  }
}

function torsoUndead(g, face, c) {
  metalBase(g, c.metal, face, 4);
  const trim = c.trim, tab = c.cape;
  if (face === 'nz') {
    rect(g, 10, 5, 12, 27, tab);
    rect(g, 10, 5, 12, 2, trim);
    rect(g, 10, 30, 12, 2, trim);
    rect(g, 9, 5, 1, 27, trim);
    rect(g, 22, 5, 1, 27, trim);
    rect(g, 13, 12, 6, 2, trim);
    rect(g, 12, 14, 8, 2, trim);
    rect(g, 14, 16, 4, 4, trim);
    rect(g, 15, 20, 2, 3, trim);
    for (let y = 8; y < 30; y += 2) {
      for (let x = 1; x < 8; x += 2) dot(g, x + (y % 4 ? 1 : 0), y, tone(c.metal, 0.8));
      for (let x = 24; x < 31; x += 2) dot(g, x + (y % 4 ? 1 : 0), y, tone(c.metal, 0.8));
    }
    rect(g, 2, 6, 6, 2, tone(c.metal, 1.12));
    rect(g, 24, 6, 6, 2, tone(c.metal, 1.12));
  } else if (face === 'pz') {
    rect(g, 10, 5, 12, 24, tab);
    rect(g, 10, 29, 12, 2, trim);
    rect(g, 15, 5, 2, 24, tone(tab, 0.8));
  }
  rect(g, 0, 26, 32, 3, '#4a3a26');
  rect(g, 13, 26, 6, 3, trim);
}

function torsoAshen(g, face, c) {
  metalBase(g, c.metal, face, 9);
  const ember = c.accent;
  const hot = '#ffd7a3';
  if (face === 'nz') {
    rect(g, 15, 2, 2, 27, tone(c.metal, 0.62));
    rect(g, 0, 10, 32, 1, tone(c.metal, 0.7));
    rect(g, 0, 20, 32, 1, tone(c.metal, 0.7));
    const cracks = [
      [6, 7], [7, 8], [8, 8], [8, 9], [9, 9], [10, 10], [10, 11],
      [22, 11], [21, 12], [20, 12], [20, 13], [19, 14], [18, 14],
      [10, 22], [11, 23], [12, 23], [13, 23], [13, 24],
      [23, 21], [24, 22], [25, 22], [25, 23],
      [15, 9], [15, 10], [16, 10], [16, 11]
    ];
    for (const p of cracks) dot(g, p[0], p[1], ember);
    for (const p of [[7, 8], [9, 9], [20, 12], [11, 23], [24, 22], [16, 10]]) dot(g, p[0], p[1], hot);
    rect(g, 6, 8, 4, 1, tone(ember, 0.8));
    rect(g, 13, 3, 6, 6, tone(c.metal, 1.15));
    rect(g, 14, 4, 4, 4, tone(ember, 0.55));
    rect(g, 15, 5, 2, 2, hot);
    rect(g, 4, 0, 3, 10, '#24242a');
    rect(g, 25, 0, 3, 10, '#24242a');
    rivet(g, 6, 14, c.trim);
    rivet(g, 24, 14, c.trim);
  } else if (face === 'pz') {
    rect(g, 10, 6, 12, 22, tone(c.metal, 0.8));
    rect(g, 15, 2, 2, 28, tone(c.metal, 0.62));
    for (const p of [[15, 10], [15, 11], [15, 12], [15, 21], [15, 22], [15, 23]]) dot(g, p[0], p[1], tone(ember, 0.75));
    rect(g, 14, 15, 4, 1, tone(ember, 0.5));
  } else if (face === 'px' || face === 'nx') {
    for (const p of [[20, 8], [21, 9], [21, 10], [22, 11]]) dot(g, p[0], p[1], tone(ember, 0.7));
  }
  rect(g, 0, 27, 32, 3, '#2a2a30');
  rect(g, 12, 27, 8, 3, '#3a3a42');
}

function torsoWolf(g, face, c) {
  clothBase(g, c.shirt, face, 9);
  const dark = tone(c.shirt, 0.75);
  if (face === 'nz') {
    for (let i = 0; i < 14; i++) {
      dot(g, 8 + i, 1 + i, tone(c.shirt, 1.22));
      dot(g, 23 - i, 1 + i, tone(c.shirt, 1.12));
    }
    rect(g, 15, 10, 2, 8, dark);
    rect(g, 0, 23, 32, 5, '#241d17');
    rect(g, 0, 23, 32, 1, '#3a2f22');
    rect(g, 13, 23, 6, 5, '#c9a227');
    rect(g, 15, 25, 2, 2, '#6b5216');
    rect(g, 3, 14, 1, 8, tone(c.shirt, 0.85));
    rect(g, 28, 14, 1, 8, tone(c.shirt, 0.85));
  } else if (face === 'pz') {
    rect(g, 0, 23, 32, 5, '#241d17');
    rect(g, 8, 6, 16, 1, tone(c.shirt, 1.1));
  }
  rect(g, 0, 29, 32, 2, dark);
}

function torsoFayoum(g, face, c) {
  clothBase(g, c.shirt, face, 6);
  if (face === 'nz') {
    rect(g, 12, 0, 8, 3, c.accent);
    rect(g, 15, 3, 2, 7, c.accent);
    rect(g, 0, 21, 32, 6, c.accent);
    rect(g, 0, 21, 32, 1, tone(c.accent, 1.18));
    rect(g, 0, 26, 32, 1, tone(c.accent, 0.75));
    for (let x = 2; x < 32; x += 4) dot(g, x, 24, tone(c.accent, 0.7));
    rect(g, 6, 8, 1, 10, tone(c.shirt, 0.9));
    rect(g, 25, 8, 1, 10, tone(c.shirt, 0.9));
  } else if (face === 'pz') {
    rect(g, 0, 21, 32, 6, c.accent);
    rect(g, 15, 4, 1, 17, tone(c.shirt, 0.9));
  }
  rect(g, 0, 30, 32, 2, tone(c.shirt, 0.84));
}

function torsoTarnished(g, face, c) {
  metalBase(g, c.metal, face, 13);
  const gold = c.accent;
  if (face === 'nz') {
    for (let i = 0; i < 9; i++) {
      dot(g, 5 + i, 9 - Math.round(Math.sin(i * 0.8) * 3), gold);
      dot(g, 26 - i, 9 + Math.round(Math.cos(i * 0.8) * 3), gold);
    }
    rect(g, 13, 13, 6, 6, gold);
    rect(g, 15, 15, 2, 2, tone(gold, 0.55));
    rect(g, 0, 24, 32, 2, tone(gold, 0.8));
    rect(g, 0, 27, 32, 4, c.cape);
    for (let x = 2; x < 32; x += 5) rect(g, x, 27, 1, 4, tone(c.cape, 1.15));
    rivet(g, 3, 5, gold);
    rivet(g, 26, 5, gold);
  } else if (face === 'pz') {
    rect(g, 0, 24, 32, 7, c.cape);
    rect(g, 0, 24, 32, 1, gold);
  } else {
    rect(g, 0, 24, 32, 2, tone(gold, 0.8));
  }
}

function paintTorso(g, face, c, key) {
  if (key === 'steve') return torsoSteve(g, face, c);
  if (key === 'cj') return torsoCj(g, face, c);
  if (key === 'mario') return torsoMario(g, face, c);
  if (key === 'undead') return torsoUndead(g, face, c);
  if (key === 'ashen') return torsoAshen(g, face, c);
  if (key === 'wolf') return torsoWolf(g, face, c);
  if (key === 'tarnished') return torsoTarnished(g, face, c);
  return torsoFayoum(g, face, c);
}

/* ---- limbs ---- */
function paintArm(g, face, c, key, side) {
  if (key === 'cj') { skinBase(g, c, face); return; }
  if (key === 'mario') {
    clothBase(g, c.shirt, face, 15);
    const glove = c.glove;
    rect(g, 0, 17, 32, 15, tone(glove, FACE_MUL[face] || 1));
    rect(g, 0, 17, 32, 2, tone(glove, 0.8));
    rect(g, 0, 29, 32, 3, tone(glove, 0.88));
    for (let x = 3; x < 30; x += 6) rect(g, x, 22, 1, 6, tone(glove, 0.9));
    return;
  }
  if (c.style === 'knight') {
    metalBase(g, c.metal, face, 21);
    rect(g, 0, 14, 32, 2, tone(c.metal, 0.7));
    rect(g, 0, 25, 32, 3, c.trim || tone(c.metal, 1.1));
    rect(g, 0, 25, 32, 1, tone(c.metal, 1.2));
    rivet(g, 3, 4, c.trim || c.metal);
    return;
  }
  if (key === 'wolf') {
    if (side === 'R') {
      rect(g, 0, 0, 32, 32, '#6f4f36');
      for (let i = 0; i < 5; i++) {
        rect(g, 0, i * 6, 32, 5, tone('#8a6a48', 0.9 + i * 0.06));
        rect(g, 0, i * 6 + 5, 32, 1, '#2b2118');
        rect(g, 2, i * 6 + 1, 1, 3, '#c9a06a');
        rect(g, 29, i * 6 + 1, 1, 3, '#c9a06a');
        dot(g, 15, i * 6 + 2, '#2b2118');
      }
      rect(g, 0, 0, 32, 3, c.accent);
      return;
    }
    clothBase(g, c.shirt, face, 19);
    rect(g, 0, 2, 32, 2, c.accent);
    for (let y = 17; y < 30; y += 3) rect(g, 2, y, 28, 1, tone(c.shirt, 1.2));
    rect(g, 0, 30, 32, 2, tone(c.shirt, 0.8));
    return;
  }
  if (key === 'tarnished') {
    metalBase(g, c.metal, face, 17);
    rect(g, 0, 18, 32, 2, '#3a3428');
    rect(g, 0, 27, 32, 3, c.accent);
    return;
  }
  if (key === 'fayoum') {
    clothBase(g, c.shirt, face, 18);
    rect(g, 0, 25, 32, 3, c.accent);
    rect(g, 0, 28, 32, 4, tone(c.shirt, 0.85));
    return;
  }
  clothBase(g, c.shirt, face, 14);
  rect(g, 0, 26, 32, 2, tone(c.shirt, 0.82));
}

function paintLeg(g, face, c, key) {
  if (c.style === 'knight') {
    metalBase(g, c.metal, face, 31);
    rect(g, 0, 11, 32, 2, tone(c.metal, 0.7));
    rect(g, 0, 22, 32, 2, tone(c.metal, 0.75));
    rect(g, 6, 13, 2, 8, tone(c.metal, 1.12));
    if (key === 'undead') rect(g, 0, 18, 4, 2, c.trim);
    return;
  }
  if (key === 'mario') {
    clothBase(g, c.pants, face, 16);
    rect(g, 0, 8, 32, 2, tone(c.pants, 0.9));
    rect(g, 15, 10, 2, 20, tone(c.pants, 0.92));
    return;
  }
  if (key === 'cj') {
    clothBase(g, c.pants, face, 17);
    rect(g, 0, 0, 32, 3, '#6a5a44');
    rect(g, 0, 3, 32, 1, '#4a3e2e');
    rect(g, 13, 6, 2, 20, tone(c.pants, 1.15));
    return;
  }
  if (key === 'wolf') {
    clothBase(g, c.pants, face, 20);
    for (let y = 20; y < 30; y += 3) rect(g, 2, y, 28, 1, tone(c.pants, 1.18));
    return;
  }
  if (key === 'tarnished') {
    clothBase(g, c.pants, face, 23);
    rect(g, 0, 4, 32, 2, tone(c.pants, 0.85));
    rect(g, 0, 11, 32, 3, c.accent);
    return;
  }
  if (key === 'fayoum') {
    clothBase(g, c.pants, face, 24);
    rect(g, 0, 27, 32, 4, tone(c.pants, 0.8));
    return;
  }
  clothBase(g, c.pants, face, 25);
  rect(g, 0, 29, 32, 3, tone(c.pants, 0.82));
}

function paintShoe(g, face, c, key) {
  if (c.style === 'knight') {
    metalBase(g, c.metal || c.shoe, face, 33);
    if (face === 'nz') {
      rect(g, 0, 22, 32, 4, '#2a2a30');
      rect(g, 4, 8, 24, 2, tone(c.metal, 1.15));
    }
    rect(g, 0, 28, 32, 4, tone(c.metal, 0.5));
    return;
  }
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
  if (key === 'mario') {
    rect(g, 0, 0, 32, 32, tone(c.glove, FACE_MUL[face] || 1));
    rect(g, 0, 0, 32, 3, tone(c.glove, 0.82));
    return;
  }
  if (c.style === 'knight') {
    metalBase(g, c.metal, face, 35);
    rect(g, 0, 0, 32, 3, tone(c.metal, 0.7));
    return;
  }
  if (key === 'wolf' && side === 'R') {
    rect(g, 0, 0, 32, 32, '#8a6a48');
    rect(g, 0, 0, 32, 4, '#6f4f36');
    rect(g, 0, 12, 32, 1, '#2b2118');
    rect(g, 0, 24, 32, 1, '#2b2118');
    return;
  }
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
    rect(g, 12, 12, 8, 8, tone(c.shirt, 0.86));
    rect(g, 14, 14, 4, 4, tone(c.shirt, 0.94));
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
  if (face === 'py') rect(g, 8, 8, 16, 16, tone(c.metal, 1.12));
  rect(g, 0, 26, 32, 4, tone(c.metal, 0.7));
  rect(g, 0, 3, 32, 1, c.trim || tone(c.metal, 1.2));
  rivet(g, 14, 10, c.trim || c.metal);
  if (key === 'undead') rect(g, 0, 4, 32, 1, c.accent);
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
  for (let y = 4; y < 30; y += 6) {
    rect(g, 0, y, 32, 2, tone(c.shirt, 0.9));
    rect(g, 0, y + 2, 32, 1, tone(c.shirt, 1.1));
  }
  if (face === 'nz') {
    rect(g, 0, 14, 32, 4, c.accent);
    for (let x = 2; x < 32; x += 4) dot(g, x, 15, tone(c.accent, 0.7));
  }
}

function paintShield(g, face, c) {
  rect(g, 0, 0, 32, 32, tone(c.metal, 0.85));
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
}

function paintPart(g, face, c, key, part) {
  if (part === 'head') return paintHead(g, face, c, key);
  if (part === 'torso') return paintTorso(g, face, c, key);
  if (part === 'armL') return paintArm(g, face, c, key, 'L');
  if (part === 'armR') return paintArm(g, face, c, key, 'R');
  if (part === 'legL' || part === 'legR') return paintLeg(g, face, c, key);
  if (part === 'shoe') return paintShoe(g, face, c, key);
  if (part === 'handL') return paintHand(g, face, c, key, 'L');
  if (part === 'handR') return paintHand(g, face, c, key, 'R');
}

function makeHumanoid(key, tagText) {
  const c = CHARACTERS[key] || CHARACTERS.steve;
  const root = new THREE.Group();
  const parts = {};

  const legL = new THREE.Group(); legL.position.set(-0.13, 0.72, 0);
  const legR = new THREE.Group(); legR.position.set(0.13, 0.72, 0);
  addPart(legL, 0.22, 0.72, 0.24, key, c, 'legL', 0, -0.36, 0);
  addPart(legR, 0.22, 0.72, 0.24, key, c, 'legR', 0, -0.36, 0);
  addPart(legL, 0.24, 0.12, 0.28, key, c, 'shoe', 0, -0.7, -0.02);
  addPart(legR, 0.24, 0.12, 0.28, key, c, 'shoe', 0, -0.7, -0.02);

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
    paintedBox(head, 0.2, 0.17, 0.04, 'emblem-' + key, (g, f) => paintEmblem(g, f, c), 0, 0.49, -0.265);
    addBox(head, 0.16, 0.13, 0.15, c.skin, 0, 0.14, -0.27);
  }

  if (c.style === 'knight') {
    paintedBox(torso, 0.56, 0.92, 0.05, 'cape-' + key, (g, f) => paintCape(g, f, c, key), 0, 0.14, 0.17).rotation.x = 0.06;
    paintedBox(armL, 0.3, 0.2, 0.36, 'pauldron-' + key, (g, f) => paintPauldron(g, f, c, key), 0, 0.03, 0);
    paintedBox(armR, 0.3, 0.2, 0.36, 'pauldron-' + key, (g, f) => paintPauldron(g, f, c, key), 0, 0.03, 0);
    addBox(torso, 0.34, 0.1, 0.3, tone(c.metal, 0.8), 0, 0.6, 0);

    if (key === 'undead') {
      const shield = paintedBox(armL, 0.46, 0.62, 0.07, 'shield-' + key, (g, f) => paintShield(g, f, c), -0.03, -0.3, -0.14);
      shield.rotation.y = 0.12;
      const sword = new THREE.Group();
      sword.position.set(0.26, 0.12, 0.12);
      sword.rotation.z = -0.35; sword.rotation.x = 0.2;
      paintedBox(sword, 0.05, 0.75, 0.05, 'scabbard', (g, f) => metalBase(g, '#3b4a6a', f, 5), 0, -0.2, 0);
      paintedBox(sword, 0.16, 0.06, 0.1, 'guard-u', (g, f) => metalBase(g, '#c9a227', f, 6), 0, 0.18, 0);
      paintedBox(sword, 0.06, 0.22, 0.06, 'grip-u', paintGrip, 0, 0.3, 0);
      torso.add(sword);
    }
    if (key === 'ashen') {
      addBox(head, 0.04, 0.1, 0.3, tone(c.metal, 1.15), 0, 0.53, 0.02);
      glowBox(head, 0.1, 0.028, 0.016, '#ffa24a', -0.086, 0.263, -0.238);
      glowBox(head, 0.1, 0.028, 0.016, '#ffa24a', 0.086, 0.263, -0.238);
      glowBox(torso, 0.05, 0.06, 0.014, '#ffb066', 0, 0.5, -0.147);
      const sword = new THREE.Group();
      sword.position.set(-0.06, 0.3, 0.22);
      sword.rotation.z = 0.55;
      paintedBox(sword, 0.09, 0.95, 0.04, 'ashenblade', paintBlade, 0, 0.36, 0);
      paintedBox(sword, 0.3, 0.06, 0.08, 'ashenguard', (g, f) => metalBase(g, '#a08a5a', f, 7), 0, -0.14, 0);
      paintedBox(sword, 0.07, 0.3, 0.07, 'ashengrip', paintGrip, 0, -0.3, 0);
      torso.add(sword);
    }
    if (key === 'tarnished') {
      paintedBox(head, 0.48, 0.06, 0.48, 'circlet', (g, f) => metalBase(g, c.accent, f, 8), 0, 0.4, 0);
      const sword = new THREE.Group();
      sword.position.set(0.3, 0.1, 0.05);
      sword.rotation.z = -0.25;
      paintedBox(sword, 0.05, 0.8, 0.04, 'tarnblade', paintBlade, 0, -0.25, 0);
      paintedBox(sword, 0.2, 0.05, 0.08, 'tarnguard', (g, f) => metalBase(g, '#c9a227', f, 9), 0, 0.16, 0);
      paintedBox(sword, 0.06, 0.2, 0.06, 'tarngrip', paintGrip, 0, 0.28, 0);
      torso.add(sword);
    }
  }

  if (key === 'wolf') {
    paintedBox(torso, 0.54, 0.16, 0.34, 'scarf', (g, f) => paintScarf(g, f, c), 0, 0.6, 0);
    paintedBox(torso, 0.1, 0.3, 0.04, 'scarftail', (g, f) => paintScarf(g, f, c), 0.16, 0.36, 0.22).rotation.z = 0.15;
    paintedBox(torso, 0.08, 0.24, 0.04, 'scarftail2', (g, f) => paintScarf(g, f, c), 0.05, 0.42, 0.23).rotation.z = -0.1;
    paintedBox(head, 0.48, 0.07, 0.48, 'band', (g, f) => paintScarf(g, f, c), 0, 0.34, 0);
    paintedBox(head, 0.09, 0.2, 0.04, 'bandtail', (g, f) => paintScarf(g, f, c), 0.2, 0.25, 0.24);
    const katana = new THREE.Group();
    katana.position.set(0.24, 0.16, 0.1);
    katana.rotation.z = -0.45; katana.rotation.x = 0.35;
    paintedBox(katana, 0.04, 1.0, 0.04, 'katana', paintBlade, 0, -0.2, 0);
    paintedBox(katana, 0.14, 0.04, 0.1, 'tsuba', (g, f) => metalBase(g, '#9c8a5a', f, 10), 0, 0.3, 0);
    paintedBox(katana, 0.05, 0.24, 0.05, 'tsuka', paintGrip, 0, 0.42, 0);
    torso.add(katana);
  }

  if (key === 'fayoum') {
    paintedBox(head, 0.54, 0.2, 0.54, 'turban', (g, f) => paintTurban(g, f, c), 0, 0.45, 0);
    paintedBox(head, 0.5, 0.07, 0.5, 'turbanband', (g, f) => paintTurban(g, f, c), 0, 0.35, 0);
    paintedBox(torso, 0.6, 0.4, 0.36, 'robe', (g, f) => torsoFayoum(g, f, c), 0, -0.18, 0);
  }

  root.add(legL, legR, torso, armL, armR, head);
  parts.legL = legL; parts.legR = legR; parts.armL = armL; parts.armR = armR;
  parts.torso = torso; parts.head = head;

  let tag = null;
  if (tagText) {
    tag = makeNameTag(tagText, c.style === 'fayoum' ? '#ffe6a8' : '#ffffff');
    tag.position.set(0, 2.18, 0);
    root.add(tag);
  }
  root.userData = { parts, tag, key, phase: 0 };
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
  critterGroup.add(group);
  critters.push({
    kind: 'chicken', group, x, y, z, vy: 0, yaw: Math.random() * Math.PI * 2,
    speed: 0, timer: Math.random() * 2, phase: Math.random() * 6, hop: 0
  });
}

function spawnVillager(x, y, z, homeX, homeZ, name) {
  if (critters.length > 180) return;
  const group = makeHumanoid('fayoum', name);
  critterGroup.add(group);
  critters.push({
    kind: 'villager', group, x, y, z, vy: 0, yaw: Math.random() * Math.PI * 2,
    speed: 0, timer: Math.random() * 2, phase: Math.random() * 6,
    homeX, homeZ, tx: x, tz: z, walking: false
  });
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

function updateCritters(dt) {
  const px = player.pos.x, pz = player.pos.z;
  for (let i = 0; i < critters.length; i++) {
    const c = critters[i];
    const dx = c.x - px, dz = c.z - pz;
    const far = dx * dx + dz * dz > 70 * 70;
    c.group.visible = !far;
    if (far) continue;

    c.timer -= dt;
    if (c.kind === 'chicken') {
      if (c.timer <= 0) {
        c.timer = 1.2 + Math.random() * 3;
        if (Math.random() < 0.45) {
          c.speed = 0;
        } else {
          c.yaw = Math.random() * Math.PI * 2;
          c.speed = 0.55 + Math.random() * 0.5;
          const nx = c.x + Math.sin(c.yaw) * 2.5;
          const nz = c.z + Math.cos(c.yaw) * 2.5;
          if (terrainHeight(Math.round(nx), Math.round(nz)) <= SEA) { c.speed = 0; c.yaw += Math.PI; }
        }
        if (Math.random() < 0.3) c.hop = 1;
      }
      if (c.hop) {
        c.vy = 3.6; c.hop = 0;
      }
      c.vy -= 26 * dt;
      c.y += c.vy * dt;
      const gy = groundNear(c.x, c.z);
      if (c.y <= gy) { c.y = gy; c.vy = 0; }
      if (c.speed > 0 && c.y <= gy + 0.01) {
        c.x += Math.sin(c.yaw) * c.speed * dt;
        c.z += Math.cos(c.yaw) * c.speed * dt;
        c.phase += dt * 9;
      }
      c.group.position.set(c.x, c.y, c.z);
      c.group.rotation.y = c.yaw;
      c.group.rotation.z = Math.sin(c.phase) * 0.05;
    } else {
      if (c.timer <= 0) {
        c.timer = 2 + Math.random() * 4;
        c.walking = Math.random() < 0.6;
        if (c.walking) {
          const a = Math.random() * Math.PI * 2;
          const r = 4 + Math.random() * 8;
          c.tx = c.homeX + Math.cos(a) * r;
          c.tz = c.homeZ + Math.sin(a) * r;
        }
      }
      if (c.walking) {
        const dx2 = c.tx - c.x, dz2 = c.tz - c.z;
        const d = Math.hypot(dx2, dz2);
        if (d < 0.4) {
          c.walking = false;
          c.timer = 1 + Math.random() * 3;
          c.speed = 0;
        } else {
          const want = Math.atan2(dx2, dz2);
          let diff = want - c.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          c.yaw += diff * Math.min(1, dt * 5);
          c.speed = 0.95;
          c.x += Math.sin(c.yaw) * c.speed * dt;
          c.z += Math.cos(c.yaw) * c.speed * dt;
          c.phase += dt * 7;
        }
      } else {
        c.speed = 0;
      }
      const gy = groundNear(c.x, c.z);
      c.y += (gy - c.y) * Math.min(1, dt * 9);
      c.group.position.set(c.x, c.y, c.z);
      c.group.rotation.y = c.yaw;
      if (c.group.userData.tag) c.group.userData.tag.visible = (dx * dx + dz * dz) < 40 * 40;
    }

    // limb animation for humanoids
    const parts = c.group.userData.parts;
    if (parts) {
      const swing = Math.sin(c.phase) * (c.speed > 0 ? 0.7 : 0.05);
      parts.legL.rotation.x = swing;
      parts.legR.rotation.x = -swing;
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
