/** Skins moto en sprite 2D — textures avant/arrière/profils. */
import * as THREE from 'three';
import { BIKE_DIR_ANGLES } from './constants.js';

const textureLoader = new THREE.TextureLoader();
const texturePromises = new Map();

const SPRITE_HEIGHT = 0.52;
const SPRITE_SIDE_LENGTH = 0.95;

/** Vue de profil pour l'aperçu customisation (caméra sur +X). */
export const PREVIEW_SPRITE_VIEW = 'right';
export const PREVIEW_SPRITE_VIEW_FLIPPED = 'left';

function _loadTexture(path) {
  let p = texturePromises.get(path);
  if (p) return p;
  p = textureLoader.loadAsync(path).then(tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.aspect = tex.image.width / tex.image.height;
    return tex;
  });
  texturePromises.set(path, p);
  return p;
}

export function skinUsesSprite(skin) {
  return skin?.kit === 'sprite' && !!skin?.sprites;
}

const WIDTH_LERP = 0.22;

function _applyTexture(wrapper, tex) {
  const mat = wrapper.userData.spriteMat;
  const refAspect = wrapper.userData.sideAspect || tex.aspect;
  wrapper.userData.targetPlaneWidth = SPRITE_HEIGHT * (tex.aspect || refAspect);
  if (mat.map === tex) return;
  mat.map = tex;
  mat.needsUpdate = true;
}

function _normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Choisit la texture visible depuis la caméra pour un cap donné (angle discret). */
function _pickViewForFacing(textures, facing, cameraPos, bikePos) {
  const dx = cameraPos.x - bikePos.x;
  const dz = cameraPos.z - bikePos.z;
  if (dx * dx + dz * dz < 1e-6) return textures.back;
  const toCamAngle = Math.atan2(dx, -dz);
  const relative = _normAngle(facing - toCamAngle);
  const abs = Math.abs(relative);
  if (abs <= Math.PI / 4) return textures.front;
  if (abs >= (3 * Math.PI) / 4) return textures.back;
  return relative > 0 ? textures.left : textures.right;
}

const _tmpTarget = new THREE.Vector3();
const _tmpWorldPos = new THREE.Vector3();

function _billboardTowardCamera(billboard, cameraPos) {
  billboard.getWorldPosition(_tmpWorldPos);
  _tmpTarget.set(cameraPos.x, _tmpWorldPos.y, cameraPos.z);
  if (_tmpTarget.distanceToSquared(_tmpWorldPos) > 1e-6) {
    billboard.lookAt(_tmpTarget);
  }
}

export async function createSpriteBike(skin) {
  const { front, back, left, right } = skin.sprites;
  const [texFront, texBack, texLeft, texRight] = await Promise.all(
    [front, back, left, right].map(_loadTexture)
  );

  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateY(Math.PI);

  const mat = new THREE.MeshBasicMaterial({
    map: texFront, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, depthWrite: true,
  });

  const plane = new THREE.Mesh(geo, mat);
  plane.position.y = SPRITE_HEIGHT * 0.46;

  const billboard = new THREE.Group();
  billboard.add(plane);

  const wrapper = new THREE.Group();
  wrapper.add(billboard);
  wrapper.userData.isSpriteBike = true;
  wrapper.userData.isSprite = true;
  wrapper.userData.billboard = billboard;
  wrapper.userData.spriteMat = mat;
  wrapper.userData.spritePlane = plane;
  wrapper.userData.sideAspect = texLeft.aspect;
  wrapper.userData.spriteTextures = { front: texFront, back: texBack, left: texLeft, right: texRight };
  wrapper.userData.spritePreviewFlip = !!skin.spritePreviewFlip;
  wrapper.userData.trailBackOffset = SPRITE_SIDE_LENGTH * 0.5;
  wrapper.userData.trailAnchorLocal = new THREE.Vector3(0, plane.position.y, SPRITE_SIDE_LENGTH * 0.5);

  _applyTexture(wrapper, texFront);
  plane.scale.set(wrapper.userData.targetPlaneWidth, SPRITE_HEIGHT, 1);
  return wrapper;
}

/**
 * Billboards toujours face caméra (évite le côté plat en virage).
 * - preview : profil fixe, même sens pour toutes les motos
 * - forceView : joueur (toujours « back »)
 * - dir : adversaires — texture selon cap vs caméra
 */
export function updateSpriteBike(wrapper, cameraPos, options = {}) {
  if (!wrapper?.userData?.isSpriteBike) return;
  const { forceView, dir, preview } = options;
  const billboard = wrapper.userData.billboard;
  const tex = wrapper.userData.spriteTextures;
  const plane = wrapper.userData.spritePlane;

  if (preview) {
    const viewKey = wrapper.userData.spritePreviewFlip
      ? PREVIEW_SPRITE_VIEW_FLIPPED
      : PREVIEW_SPRITE_VIEW;
    if (tex[viewKey]) _applyTexture(wrapper, tex[viewKey]);
    _billboardTowardCamera(billboard, cameraPos);
    plane.scale.x = wrapper.userData.targetPlaneWidth;
    return;
  }

  _billboardTowardCamera(billboard, cameraPos);

  if (forceView && tex[forceView]) {
    _applyTexture(wrapper, tex[forceView]);
  } else if (dir != null) {
    const facing = BIKE_DIR_ANGLES[((dir % 4) + 4) % 4];
    const chosen = _pickViewForFacing(tex, facing, cameraPos, wrapper.position);
    _applyTexture(wrapper, chosen);
  }

  plane.scale.x += (wrapper.userData.targetPlaneWidth - plane.scale.x) * WIDTH_LERP;
}
