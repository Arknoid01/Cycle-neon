/** Skins moto en sprite 2D (billboard) — découpage pixel-art avant/arrière/profils. */
import * as THREE from 'three';
import { BIKE_DIR_ANGLES } from './constants.js';

const textureLoader = new THREE.TextureLoader();
const texturePromises = new Map();

/** Hauteur fixe (unités grille) ; la largeur s'adapte au ratio de chaque vue. */
const SPRITE_HEIGHT = 0.52;
/** Longueur cible (bord à bord) visée pour la vue de profil, alignée sur BIKE_MODEL_TARGET_LENGTH des .glb. */
const SPRITE_SIDE_LENGTH = 0.95;

/** Vue sprite figée par direction logique (évite les inversions caméra sur les bots). */
export const BIKE_SPRITE_VIEW_BY_DIR = ['back', 'right', 'front', 'left'];

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

/** Anime scale.x vers la largeur cible plutôt que de la caler d'un coup —
 * sans ça, passer d'une vue de profil (large) à avant/arrière (étroite)
 * fait "sauter" la taille de la moto pile au moment du changement de texture. */
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
  geo.rotateY(Math.PI); // aligne la face texturée sur la convention "nez = -Z" du moteur

  const mat = new THREE.MeshBasicMaterial({
    map: texFront, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, depthWrite: true,
  });

  const plane = new THREE.Mesh(geo, mat);
  // Légèrement sous le centre : compense le padding transparent bas des sprites.
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

/**
 * Pivot billboard vers la caméra ; texture choisie par direction logique
 * (ou forceView pour le joueur — toujours « back » en caméra de poursuite).
 */
export function updateSpriteBike(wrapper, cameraPos, options = {}) {
  if (!wrapper?.userData?.isSpriteBike) return;
  const { forceView, dir } = options;
  const billboard = wrapper.userData.billboard;

  billboard.getWorldPosition(_tmpWorldPos);
  _tmpTarget.set(cameraPos.x, _tmpWorldPos.y, cameraPos.z);
  if (_tmpTarget.distanceToSquared(_tmpWorldPos) > 1e-6) {
    billboard.lookAt(_tmpTarget);
  }

  const tex = wrapper.userData.spriteTextures;
  let viewKey = forceView;
  if (!viewKey && dir != null) {
    viewKey = BIKE_SPRITE_VIEW_BY_DIR[dir] || 'back';
  }
  if (viewKey && tex[viewKey]) {
    _applyTexture(wrapper, tex[viewKey]);
  } else if (dir != null) {
    // Secours : angle cible discret (pas l'angle lissé) si pas de forceView.
    const facing = BIKE_DIR_ANGLES[dir];
    const dx = cameraPos.x - wrapper.position.x;
    const dz = cameraPos.z - wrapper.position.z;
    if (dx * dx + dz * dz > 1e-6) {
      const toCamAngle = Math.atan2(dx, -dz);
      let relative = facing - toCamAngle;
      while (relative > Math.PI) relative -= Math.PI * 2;
      while (relative < -Math.PI) relative += Math.PI * 2;
      const abs = Math.abs(relative);
      let chosen;
      if (abs <= Math.PI / 4) chosen = tex.front;
      else if (abs >= (3 * Math.PI) / 4) chosen = tex.back;
      else if (relative > 0) chosen = tex.left;
      else chosen = tex.right;
      _applyTexture(wrapper, chosen);
    }
  }

  const plane = wrapper.userData.spritePlane;
  plane.scale.x += (wrapper.userData.targetPlaneWidth - plane.scale.x) * WIDTH_LERP;
}
