/* Blockcraft Battle Ground — Cached, joint-local character silhouettes.
   48-outline.js
   Two inverted hulls per rig joint: a 2 CSS-pixel ink edge and a thin pale
   teal inner edge. Ordinary scene depth hides both behind opaque geometry.
   Cache entries own only geometry/statistics, never avatars. */
'use strict';

const CHARACTER_OUTLINE_JOINTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR', 'kneeL', 'kneeR', 'shoeL', 'shoeR'];
const characterOutlineCache = new Map();
const characterOutlineViewport = new THREE.Vector4();
const characterOutlineUniforms = {
  outlineViewport: { value: new THREE.Vector2(1, 1) },
  outlineNear: { value: 0.08 }
};

const characterOutlineVertexShader = `
  uniform vec2 outlineViewport;
  uniform float outlineNear;
  uniform float outlineWidth;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 clipPosition = projectionMatrix * mvPosition;
    vec4 clipNormal = projectionMatrix * vec4(normalMatrix * normal, 0.0);

    // Perspective derivative, measured in pixels before normalization. This
    // also works off-axis, with different aspect ratios and an orthographic camera.
    vec2 viewport = max(outlineViewport, vec2(1.0));
    vec2 direction = (clipNormal.xy * clipPosition.w - clipPosition.xy * clipNormal.w) * viewport;
    float lengthSquared = dot(direction, direction);
    direction *= inversesqrt(max(lengthSquared, 0.00000001));

    // A zero projected normal stays zero. Never normalize(0), divide by clip.w,
    // expand behind the eye, or pull the hull forward through the depth buffer.
    float nearPlane = max(outlineNear, 0.0001);
    float nearFade = smoothstep(nearPlane * 1.5, nearPlane * 4.0, -mvPosition.z);
    float width = clamp(outlineWidth, 0.0, 2.0) * nearFade;
    clipPosition.xy += direction * (2.0 * width / viewport) * max(clipPosition.w, 0.0);
    gl_Position = clipPosition;
    #include <fog_vertex>
  }
`;

const characterOutlineFragmentShader = `
  uniform vec3 outlineColor;
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(outlineColor, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function characterOutlineMaterial(name, color, width) {
  const material = new THREE.ShaderMaterial({
    name: 'character-outline-' + name,
    uniforms: Object.assign({}, THREE.UniformsUtils.clone(THREE.UniformsLib.fog), characterOutlineUniforms, {
      outlineColor: { value: new THREE.Color(color) },
      outlineWidth: { value: width }
    }),
    vertexShader: characterOutlineVertexShader,
    fragmentShader: characterOutlineFragmentShader,
    side: THREE.BackSide,
    depthTest: true,
    depthWrite: false,
    transparent: false,
    toneMapped: false,
    fog: true
  });
  material.userData.isCharacterOutline = true;
  material.userData.sharedCharacterOutline = true;
  return material;
}

const characterOutlineMaterials = [
  characterOutlineMaterial('ink', 0x0a1920, 2),
  characterOutlineMaterial('rim', 0xd1f3df, 0.8)
];

function characterOutlineOptOut(object) {
  const data = object.userData || {};
  return data.isCharacterOutline || data.noOutline || data.outline === false ||
    data.isFX || data.isFx || data.isVFX || data.isEffect || data.isParticle || data.isGlow;
}

function characterOutlineEffectName(name) {
  // Word boundaries preserve outfits such as Firelink armor and ember cloaks.
  return /(?:^|[\s_.:-])(fx|vfx|particles?|smoke|sparks?|flames?|glow|muzzle|flash|fire)(?:$|[\s_.:-])/i
    .test((name || '').replace(/([a-z])([A-Z])/g, '$1 $2'));
}

function characterOutlineSolidMaterial(material) {
  if (Array.isArray(material)) return material.length > 0 && material.every(characterOutlineSolidMaterial);
  if (!material || characterOutlineOptOut(material) || characterOutlineEffectName(material.name)) return false;
  // Emissive *maps on opaque clothing* remain eligible. glowBox's unlit,
  // toneMapped:false material, additive effects and cutout quads do not.
  return material.visible !== false && !material.transparent && material.opacity >= 1 &&
    material.depthTest !== false && material.depthWrite !== false && material.colorWrite !== false &&
    !material.alphaTest && !material.alphaMap && !material.wireframe &&
    !material.isShaderMaterial && !material.isShadowMaterial &&
    !(material.isMeshBasicMaterial && material.toneMapped === false) &&
    (material.blending === THREE.NormalBlending || material.blending === THREE.NoBlending);
}

function characterOutlineAnimated(object) {
  return object.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender;
}

/* Weld positions only within each source mesh (never across overlapping props).
   Angle-weighted normals close the split UV/flat-normal seams of box geometry
   without changing its actual corners, textures, or the source geometry. */
function characterOutlineAppendMesh(mesh, transform, merged) {
  const geometry = mesh.geometry;
  if (!geometry || !geometry.isBufferGeometry) return 'geometry';
  const attribute = geometry.getAttribute('position');
  if (!attribute || attribute.itemSize < 3 ||
      characterOutlineOptOut(geometry) ||
      (geometry.morphAttributes.position && geometry.morphAttributes.position.length)) return 'geometry';
  const determinant = transform.determinant();
  if (!transform.elements.every(Number.isFinite) || !Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return 'geometry';

  const positions = [], normals = [], indices = [], welded = new Map();
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  const index = geometry.getIndex();
  const count = index ? index.count : attribute.count;
  const drawStart = Math.max(0, Math.floor(geometry.drawRange.start));
  const drawEnd = Math.min(count, drawStart + geometry.drawRange.count);
  if (!Number.isFinite(drawStart) || !Number.isFinite(drawEnd)) return 'geometry';
  const groups = Array.isArray(mesh.material) ? geometry.groups : [{ start: 0, count }];

  function vertex(sourceIndex) {
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= attribute.count) return -1;
    point.fromBufferAttribute(attribute, sourceIndex);
    if (![point.x, point.y, point.z].every(Number.isFinite)) return -1;
    const key = Math.round(point.x * 1e6) + ',' + Math.round(point.y * 1e6) + ',' + Math.round(point.z * 1e6);
    if (welded.has(key)) return welded.get(key);
    point.applyMatrix4(transform);
    if (![point.x, point.y, point.z].every((n) => Number.isFinite(Math.fround(n)))) return -1;
    const result = positions.length / 3;
    welded.set(key, result);
    positions.push(point.x, point.y, point.z);
    normals.push(0, 0, 0);
    bounds.expandByPoint(point);
    return result;
  }

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), bc = new THREE.Vector3();
  const face = new THREE.Vector3();
  for (const group of groups) {
    if (Array.isArray(mesh.material) && !mesh.material[group.materialIndex]) continue;
    const start = Math.max(drawStart, Math.floor(group.start));
    const end = Math.min(drawEnd, group.start + group.count);
    for (let i = start; i + 2 < end; i += 3) {
      const ia = vertex(index ? index.getX(i) : i);
      const ib = vertex(index ? index.getX(i + 1) : i + 1);
      const ic = vertex(index ? index.getX(i + 2) : i + 2);
      if (ia < 0 || ib < 0 || ic < 0) return 'geometry';
      // Baking a reflected child transform must also reverse its winding.
      const ids = determinant < 0 ? [ia, ic, ib] : [ia, ib, ic];
      a.fromArray(positions, ids[0] * 3);
      b.fromArray(positions, ids[1] * 3);
      c.fromArray(positions, ids[2] * 3);
      ab.subVectors(b, a); ac.subVectors(c, a); bc.subVectors(c, b);
      face.crossVectors(ab, ac);
      const area = face.length();
      if (!Number.isFinite(area)) return 'geometry';
      if (area < 1e-12) continue;
      face.multiplyScalar(1 / area);
      const angles = [Math.atan2(area, ab.dot(ac)), Math.atan2(area, -ab.dot(bc)), Math.atan2(area, ac.dot(bc))];
      for (let corner = 0; corner < 3; corner++) {
        const offset = ids[corner] * 3, angle = angles[corner];
        normals[offset] += face.x * angle;
        normals[offset + 1] += face.y * angle;
        normals[offset + 2] += face.z * angle;
      }
      indices.push(ids[0], ids[1], ids[2]);
    }
  }
  if (!indices.length) return 'geometry';
  const size = bounds.getSize(point);
  if (Math.max(size.x, size.y, size.z) < 0.035) return 'tiny';
  if (Math.min(size.x, size.y, size.z) < 1e-6) return 'geometry';
  const center = bounds.getCenter(new THREE.Vector3());
  const offset = merged.positions.length / 3;
  for (let i = 0; i < positions.length; i += 3) {
    point.fromArray(normals, i);
    if (point.lengthSq() < 1e-12) point.fromArray(positions, i).sub(center);
    if (point.lengthSq() < 1e-12) point.set(0, 1, 0);
    point.normalize();
    merged.positions.push(positions[i], positions[i + 1], positions[i + 2]);
    merged.normals.push(point.x, point.y, point.z);
  }
  for (const i of indices) merged.indices.push(offset + i);
  return null;
}

function characterOutlineBakeJoint(joint, joints, key, name) {
  const merged = { positions: [], normals: [], indices: [] };
  const record = { geometry: null, sourceMeshes: 0, excluded: { fx: 0, animated: 0, material: 0, geometry: 0, tiny: 0 } };

  function visit(node, transform) {
    if (node !== joint && joints.has(node)) return;
    if (characterOutlineOptOut(node) || characterOutlineEffectName(node.name) ||
        node.isSprite || node.isPoints || node.isLine || node.isSkinnedMesh || node.isInstancedMesh ||
        node.isBatchedMesh || (node !== joint && node.visible === false)) {
      record.excluded.fx++;
      return;
    }
    // Non-rig procedural motion cannot be baked into a static joint hull. Skip
    // the whole affected branch, including the live cloak's companion strips.
    // Rig joints, including the articulated shins and level shoes, follow
    // their own movement/weapon poses instead of baking across a moving hinge.
    if (characterOutlineAnimated(node) || (node !== joint && node.isGroup && node.children.some((child) =>
      child.isMesh && characterOutlineAnimated(child) && characterOutlineSolidMaterial(child.material)))) {
      record.excluded.animated++;
      return;
    }
    if (node.isMesh) {
      if (!characterOutlineSolidMaterial(node.material)) record.excluded.material++;
      else {
        const reason = characterOutlineAppendMesh(node, transform, merged);
        if (reason) record.excluded[reason]++;
        else record.sourceMeshes++;
      }
    }
    for (const child of node.children) {
      if (child.matrixAutoUpdate) child.updateMatrix();
      visit(child, new THREE.Matrix4().multiplyMatrices(transform, child.matrix));
    }
  }

  // Start at identity, deliberately excluding the joint/root/world transform.
  visit(joint, new THREE.Matrix4());
  if (merged.indices.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.name = 'character-outline:' + key + ':' + name;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(merged.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(merged.normals, 3));
    geometry.setIndex(merged.indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    // A conservative margin keeps narrow screen-space edges from disappearing
    // prematurely at the frustum boundary, without disabling avatar culling.
    geometry.boundingBox.expandByScalar(0.25);
    geometry.boundingSphere.radius += 0.25;
    geometry.userData = { isCharacterOutline: true, sharedCharacterOutline: true, key, joint: name };
    record.geometry = geometry;
  }
  return record;
}

function characterOutlineNoRaycast() {}

/* Called at the end of makeHumanoid, after its userData/parts assignment and
   before equipment is attached. Repeated calls return the same metadata. */
function addCharacterOutline(root) {
  if (!root || !root.isObject3D || !root.userData || !root.userData.parts) return null;
  if (root.userData.outline && root.userData.outline.isCharacterOutline) return root.userData.outline;
  const parts = root.userData.parts;
  const key = root.userData.key;
  const joints = new Set(CHARACTER_OUTLINE_JOINTS.map((name) => parts[name]).filter((part) => part && part.isObject3D));
  if (!joints.size || typeof key !== 'string') return null;
  let cached = characterOutlineCache.get(key);
  if (!cached) { cached = new Map(); characterOutlineCache.set(key, cached); }
  const outline = { isCharacterOutline: true, key, joints: {}, meshes: [], sourceMeshes: 0, drawCalls: 0 };
  const attached = new Set();
  for (const name of CHARACTER_OUTLINE_JOINTS) {
    const joint = parts[name];
    if (!joints.has(joint) || attached.has(joint)) continue;
    attached.add(joint);
    let record = cached.get(name);
    if (!record) {
      record = characterOutlineBakeJoint(joint, joints, key, name);
      cached.set(name, record);
    }
    const info = { geometry: record.geometry, sourceMeshes: record.sourceMeshes, excluded: record.excluded, meshes: [] };
    outline.joints[name] = info;
    outline.sourceMeshes += record.sourceMeshes;
    if (!record.geometry) continue;
    for (let layer = 0; layer < characterOutlineMaterials.length; layer++) {
      const mesh = new THREE.Mesh(record.geometry, characterOutlineMaterials[layer]);
      mesh.name = 'character-outline:' + name + ':' + layer;
      mesh.userData = { isCharacterOutline: true, sharedCharacterOutline: true, joint: name, layer };
      // Opaque queue, after the original skins/world and before transparent water.
      mesh.renderOrder = layer + 1;
      mesh.matrixAutoUpdate = false;
      mesh.layers.mask = joint.layers.mask;
      mesh.raycast = characterOutlineNoRaycast;
      joint.add(mesh);
      info.meshes.push(mesh);
      outline.meshes.push(mesh);
    }
  }
  outline.drawCalls = outline.meshes.length;
  root.userData.outline = outline;
  return outline;
}

/* Once before each render, including the initial warm-up render. No avatar
   registry, traversal, per-mesh callbacks, allocations or geometry rebuilds.
   getViewport is in logical/CSS pixels; DPR therefore cannot thicken the edge. */
function updateCharacterOutlines() {
  renderer.getViewport(characterOutlineViewport);
  const width = characterOutlineViewport.z, height = characterOutlineViewport.w;
  characterOutlineUniforms.outlineViewport.value.set(
    Number.isFinite(width) && width > 0 ? width : 1,
    Number.isFinite(height) && height > 0 ? height : 1
  );
  characterOutlineUniforms.outlineNear.value = Number.isFinite(camera.near) && camera.near > 0 ? camera.near : 0.08;
}
