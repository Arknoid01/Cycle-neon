import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildBikeSkin } from './bike-builder.js';
import { updateElectricMaterial } from './electric-shader.js';

const loader = new GLTFLoader();
const templateCache = new Map();
const loadPromises = new Map();

/** Longueur cible du modèle sur la grille (unités Three.js). */
export const BIKE_MODEL_TARGET_LENGTH = 0.95;

const TINT_SLOTS = {
  body: ['body', 'carrosserie', 'paint', 'hull'],
  glow: ['glow', 'neon', 'emissive_glow', 'strip'],
  wheel: ['wheel', 'roue', 'roues', 'accent', 'canopy'],
  dark: ['dark', 'chassis', 'frame', 'base'],
  trail: ['trail', 'emitter', 'trail_glow', 'exhaust'],
};

const ANCHOR_TRAIL = ['trail_anchor', 'TrailAnchor', 'trail', 'Trail'];
const ANCHOR_EMITTER = ['emitter', 'Emitter', 'trail_emitter'];

export function skinUsesModel(skin) {
  return !!(skin?.model || skin?.kit === 'gltf');
}

export function buildFallbackBike(def, skin, trackElectric) {
  const kit = skin?.fallbackKit || skin?.kit || 'classic';
  const safeKit = kit === 'gltf' ? 'classic' : kit;
  return buildBikeSkin(def, { ...skin, kit: safeKit }, trackElectric);
}

function _slotForName(name) {
  const n = (name || '').toLowerCase();
  for (const [slot, aliases] of Object.entries(TINT_SLOTS)) {
    if (aliases.some(a => n.includes(a))) return slot;
  }
  return null;
}

function _normalizeRoot(group) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);
  group.updateMatrixWorld(true);
  const grounded = new THREE.Box3().setFromObject(group);
  group.position.y -= grounded.min.y;

  const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  const length = Math.max(size.x, size.y, size.z);
  const scale = BIKE_MODEL_TARGET_LENGTH / Math.max(length, 0.001);
  group.scale.setScalar(scale);
  group.updateMatrixWorld(true);
  return group;
}

function _cloneMaterial(mat) {
  const m = mat.clone();
  if (m.emissive && !m.emissive.isColor) m.emissive = new THREE.Color(m.emissive);
  return m;
}

function _tintMeshTree(root, def, trackElectric) {
  const pulseMats = [];
  const palette = {
    body: def.body,
    glow: def.glow,
    wheel: def.wheel,
    dark: 0x080818,
    trail: def.trailGlow,
  };

  root.traverse(child => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const cloned = materials.map(_cloneMaterial);
    child.material = cloned.length === 1 ? cloned[0] : cloned;

    cloned.forEach(mat => {
      const slot = _slotForName(mat.name) || _slotForName(child.name);
      if (!slot) return;
      const hex = palette[slot];

      if (slot === 'dark') {
        mat.color.setHex(hex);
        if (mat.emissive) {
          mat.emissive.setHex(def.glow);
          mat.emissiveIntensity = 0.35;
        }
        return;
      }

      mat.color.setHex(hex);
      if (mat.emissive) {
        mat.emissive.setHex(slot === 'body' ? def.glow : hex);
        mat.emissiveIntensity = slot === 'trail' ? 1.2 : slot === 'body' ? 0.85 : 1.0;
        mat.userData.baseEmissive = mat.emissiveIntensity;
        pulseMats.push(mat);
      }

      if (slot === 'trail' && mat.isShaderMaterial === false && trackElectric) {
        // Garder les MeshStandard émissifs pour le pulse ci-dessous
      }
    });
  });

  return pulseMats;
}

function _findByNames(root, names) {
  for (const name of names) {
    const obj = root.getObjectByName(name);
    if (obj) return obj;
  }
  return null;
}

function _applyAnchors(model, wrapper) {
  wrapper.updateMatrixWorld(true);
  const trail = _findByNames(model, ANCHOR_TRAIL);
  if (trail) {
    const pos = new THREE.Vector3();
    trail.getWorldPosition(pos);
    wrapper.worldToLocal(pos);
    wrapper.userData.trailAnchorLocal = pos;
  } else {
    wrapper.userData.trailBackOffset = 0.38;
  }

  const emitterObj = _findByNames(model, ANCHOR_EMITTER);
  if (emitterObj?.isMesh && emitterObj.material) {
    wrapper.userData.emitterMat = emitterObj.material;
  }

  wrapper.userData.isGltf = true;
  wrapper.userData.isSprite = false;
}

async function _loadTemplate(skin) {
  if (templateCache.has(skin.id)) return templateCache.get(skin.id);
  if (loadPromises.has(skin.id)) return loadPromises.get(skin.id);

  const promise = loader.loadAsync(skin.model).then(gltf => {
    const root = gltf.scene;
    _normalizeRoot(root);
    templateCache.set(skin.id, root);
    loadPromises.delete(skin.id);
    return root;
  }).catch(err => {
    loadPromises.delete(skin.id);
    console.warn('[bike-model] Échec chargement', skin.model, err);
    throw err;
  });

  loadPromises.set(skin.id, promise);
  return promise;
}

export async function createBikeMesh(def, skin, trackElectric) {
  if (!skinUsesModel(skin)) {
    return buildBikeSkin(def, skin, trackElectric);
  }

  try {
    const template = await _loadTemplate(skin);
    const wrapper = new THREE.Group();
    const model = template.clone(true);
    wrapper.add(model);
    const pulseMats = _tintMeshTree(model, def, trackElectric);
    _applyAnchors(model, wrapper);
    wrapper.userData.skinId = skin.id;
    wrapper.userData.pulseMats = pulseMats;
    return wrapper;
  } catch {
    return buildFallbackBike(def, skin, trackElectric);
  }
}

export async function preloadBikeModels(skins) {
  const jobs = skins.filter(skinUsesModel).map(s => _loadTemplate(s).catch(() => null));
  await Promise.all(jobs);
}

export function bikeTrailRearWorld(bikeMesh, worldX, worldZ, angle) {
  if (bikeMesh?.userData?.trailAnchorLocal) {
    const v = bikeMesh.userData.trailAnchorLocal.clone();
    v.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    return { x: worldX + v.x, z: worldZ + v.z };
  }
  const backOff = bikeMesh?.userData?.trailBackOffset ?? 0.38;
  const fx = Math.sin(angle);
  const fz = -Math.cos(angle);
  return { x: worldX - fx * backOff, z: worldZ - fz * backOff };
}

export function pulseBikeMaterials(mesh, now) {
  if (!mesh) return;
  const pulse = 0.92 + Math.sin(now / 120) * 0.08;

  if (mesh.userData.emitterMat?.uniforms) {
    updateElectricMaterial(mesh.userData.emitterMat, { intensity: pulse });
    return;
  }

  for (const mat of mesh.userData.pulseMats || []) {
    if (mat.emissiveIntensity !== undefined) {
      mat.emissiveIntensity = pulse * (mat.userData.baseEmissive ?? 1);
    }
  }
}

export function disposeBikeMesh(mesh) {
  if (!mesh) return;
  mesh.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => m.dispose?.());
    }
  });
}
