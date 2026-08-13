/** Skins moto en sprite 2D — textures avant/arrière/profils. */
import * as THREE from 'three';
import { BIKE_DIR_ANGLES } from './constants.js';

const textureLoader = new THREE.TextureLoader();
const texturePromises = new Map();

/** Hauteur fixe (unités grille) ; la largeur s'adapte au ratio de chaque vue. */
const SPRITE_HEIGHT = 0.52;
/** Longueur cible (bord à bord) visée pour la vue de profil. */
const SPRITE_SIDE_LENGTH = 0.95;

/** Texture par direction de déplacement (0=haut, 1=droite, 2=bas, 3=gauche). */
export const BIKE_SPRITE_VIEW_BY_DIR = ['back', 'right', 'front', 'left'];

/** Rotation extra du plan pour que la face soit visible (profil droit). */
export const BIKE_SPRITE_FLIP = [false, true, false, false];

/** Aperçu customisation : profil droit, nez vers la gauche de l'écran. */
export const PREVIEW_SPRITE_VIEW = 'right';
export const PREVIEW_SPRITE_Y = BIKE_DIR_ANGLES[1] + Math.PI;

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
  wrapper.userData.trailBackOffset = SPRITE_SIDE_LENGTH * 0.5;
  wrapper.userData.trailAnchorLocal = new THREE.Vector3(0, plane.position.y, SPRITE_SIDE_LENGTH * 0.5);

  _applyTexture(wrapper, texFront);
  plane.scale.set(wrapper.userData.targetPlaneWidth, SPRITE_HEIGHT, 1);
  return wrapper;
}

const _tmpTarget = new THREE.Vector3();
const _tmpWorldPos = new THREE.Vector3();

function _spriteAngleForDir(dir) {
  const d = ((dir % 4) + 4) % 4;
  return BIKE_DIR_ANGLES[d] + (BIKE_SPRITE_FLIP[d] ? Math.PI : 0);
}

/**
 * - preview : profil fixe (customisation)
 * - forceView + billboard : joueur (toujours « back », face caméra)
 * - dir sans billboard : adversaires alignés sur leur cap
 */
export function updateSpriteBike(wrapper, cameraPos, options = {}) {
  if (!wrapper?.userData?.isSpriteBike) return;
  const { forceView, dir, preview } = options;
  const billboard = wrapper.userData.billboard;
  const tex = wrapper.userData.spriteTextures;
  const plane = wrapper.userData.spritePlane;

  if (preview) {
    if (tex[PREVIEW_SPRITE_VIEW]) _applyTexture(wrapper, tex[PREVIEW_SPRITE_VIEW]);
    billboard.rotation.set(0, PREVIEW_SPRITE_Y, 0);
    plane.scale.x = wrapper.userData.targetPlaneWidth;
    return;
  }

  if (forceView && tex[forceView]) {
    _applyTexture(wrapper, tex[forceView]);
    billboard.getWorldPosition(_tmpWorldPos);
    _tmpTarget.set(cameraPos.x, _tmpWorldPos.y, cameraPos.z);
    if (_tmpTarget.distanceToSquared(_tmpWorldPos) > 1e-6) {
      billboard.lookAt(_tmpTarget);
    }
  } else if (dir != null) {
    const d = ((dir % 4) + 4) % 4;
    const viewKey = BIKE_SPRITE_VIEW_BY_DIR[d] || 'back';
    if (tex[viewKey]) _applyTexture(wrapper, tex[viewKey]);
    billboard.rotation.set(0, _spriteAngleForDir(d), 0);
  }

  plane.scale.x += (wrapper.userData.targetPlaneWidth - plane.scale.x) * WIDTH_LERP;
}
