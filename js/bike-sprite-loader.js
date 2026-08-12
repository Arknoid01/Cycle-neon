/** Skins moto en sprite 2D (billboard) — découpage pixel-art avant/arrière/profils. */
import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();
const texturePromises = new Map();

/** Hauteur fixe (unités grille) ; la largeur s'adapte au ratio de chaque vue. */
const SPRITE_HEIGHT = 0.52;
/** Longueur cible (bord à bord) visée pour la vue de profil, alignée sur BIKE_MODEL_TARGET_LENGTH des .glb. */
const SPRITE_SIDE_LENGTH = 0.95;

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

function _norm(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
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
  plane.position.y = SPRITE_HEIGHT / 2;

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
  wrapper.userData.trailBackOffset = SPRITE_SIDE_LENGTH * 0.42;

  _applyTexture(wrapper, texFront);
  plane.scale.set(wrapper.userData.targetPlaneWidth, SPRITE_HEIGHT, 1);
  return wrapper;
}

const _tmpTarget = new THREE.Vector3();
const _tmpWorldPos = new THREE.Vector3();

/**
 * À appeler chaque frame pour un rider en sprite : pivote le billboard vers la caméra
 * et choisit la texture (avant/arrière/profil) selon l'angle relatif moto/caméra.
 * `wrapper.rotation.y` doit déjà porter l'angle logique de la moto (comme les autres skins).
 */
export function updateSpriteBike(wrapper, cameraPos) {
  if (!wrapper?.userData?.isSpriteBike) return;
  const billboard = wrapper.userData.billboard;

  billboard.getWorldPosition(_tmpWorldPos);
  _tmpTarget.set(cameraPos.x, _tmpWorldPos.y, cameraPos.z);
  if (_tmpTarget.distanceToSquared(_tmpWorldPos) > 1e-6) {
    billboard.lookAt(_tmpTarget);
  }

  const wp = wrapper.position;
  const dx = cameraPos.x - wp.x;
  const dz = cameraPos.z - wp.z;
  if (dx * dx + dz * dz > 1e-6) {
    const toCamAngle = Math.atan2(dx, -dz);
    const facing = wrapper.rotation.y;
    const relative = _norm(facing - toCamAngle);
    const abs = Math.abs(relative);
    const tex = wrapper.userData.spriteTextures;
    let chosen;
    if (abs <= Math.PI / 4) chosen = tex.front;
    else if (abs >= (3 * Math.PI) / 4) chosen = tex.back;
    else if (relative > 0) chosen = tex.left;
    else chosen = tex.right;
    _applyTexture(wrapper, chosen);
  }

  const plane = wrapper.userData.spritePlane;
  plane.scale.x += (wrapper.userData.targetPlaneWidth - plane.scale.x) * WIDTH_LERP;
}
