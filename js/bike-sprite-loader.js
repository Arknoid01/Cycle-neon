/**
 * Skins moto en sprite 2D — 4 vues (avant/arrière/profil gauche/profil droit).
 *
 * Important : les bots ne font PAS tourner le PNG. Le plan est un billboard
 * qui regarde toujours la caméra et on choisit la vue du PNG en fonction de
 * l'orientation réelle de la moto dans le monde + de la position de la caméra.
 */
import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();
const texturePromises = new Map();

const SPRITE_HEIGHT = 0.52;
const SPRITE_SIDE_LENGTH = 0.95;

/** Vue de profil pour l'aperçu customisation (caméra sur +X). */
export const PREVIEW_SPRITE_VIEW = 'right';
export const PREVIEW_SPRITE_VIEW_FLIPPED = 'left';

// 7° d'hystérésis : évite que la texture saute gauche/droite quand la caméra
// ou la moto est exactement sur une frontière entre deux vues.
const VIEW_HYSTERESIS = THREE.MathUtils.degToRad(7);

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

function _applyTexture(wrapper, tex) {
  const mat = wrapper.userData.spriteMat;
  if (!tex) return;

  // Chaque PNG garde son ratio. On modifie uniquement la largeur du plan :
  // le billboard conserve donc la même hauteur physique quelle que soit la vue.
  const targetWidth = SPRITE_HEIGHT * (tex.aspect || 1);
  wrapper.userData.targetPlaneWidth = targetWidth;

  if (mat.map !== tex) {
    mat.map = tex;
    mat.needsUpdate = true;
  }
}

function _normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Vue brute : angle relatif de la moto par rapport à la caméra.
 *
 * facing = direction de l'avant de la moto dans le monde.
 * toCam  = direction allant de la moto vers la caméra.
 *
 * relative = 0       => caméra devant la moto  => front
 * relative = +PI/2   => caméra à gauche       => side-left
 * relative = -PI/2   => caméra à droite       => side-right
 * relative = PI      => caméra derrière       => back
 */
function _pickRawView(textures, relative) {
  const abs = Math.abs(relative);
  if (abs <= Math.PI / 4) return 'front';
  if (abs >= (3 * Math.PI) / 4) return 'back';
  return relative > 0 ? 'left' : 'right';
}

// Ordre du cycle des vues quand l'angle augmente : front(0°) -> left(90°) ->
// back(180°) -> right(-90°/270°) -> front. Utilisé pour avancer d'un cran à
// la fois plutôt que de sauter directement à la vue "brute".
const VIEW_CYCLE = ['front', 'left', 'back', 'right'];
const VIEW_CENTER = { front: 0, left: Math.PI / 2, back: Math.PI, right: -Math.PI / 2 };

function _nextView(current, step) {
  const idx = VIEW_CYCLE.indexOf(current);
  return VIEW_CYCLE[(idx + step + VIEW_CYCLE.length) % VIEW_CYCLE.length];
}

/**
 * Conserve la vue courante tant que l'angle n'a pas suffisamment franchi la
 * frontière. C'est volontairement fait sur la vue, pas sur la position :
 * déplacer la caméra ne fait donc pas « trembler » le sprite à la frontière.
 *
 * L'écart est mesuré par rapport au centre de la vue COURANTE (via _normAngle,
 * donc toujours le chemin le plus court) plutôt que par des seuils bruts sur
 * `relative` : ça évite les faux sauts quand l'angle passe par ±180°, où une
 * moto strictement alignée avec la caméra peut faire osciller `relative`
 * entre tout juste sous +180° et tout juste sous -180° d'une frame à l'autre.
 */
function _pickStableView(wrapper, textures, relative) {
  const current = wrapper.userData.spriteView;
  const raw = _pickRawView(textures, relative);

  if (!current || !textures[current]) {
    wrapper.userData.spriteView = raw;
    return raw;
  }

  if (raw === current) return current;

  const offset = _normAngle(relative - VIEW_CENTER[current]);
  let next = current;
  if (offset > Math.PI / 4 + VIEW_HYSTERESIS) next = _nextView(current, 1);
  else if (offset < -Math.PI / 4 - VIEW_HYSTERESIS) next = _nextView(current, -1);

  if (next !== current && textures[next]) {
    wrapper.userData.spriteView = next;
  }
  return wrapper.userData.spriteView;
}

function _pickViewForFacing(textures, facing, cameraPos, bikePos, wrapper) {
  const dx = cameraPos.x - bikePos.x;
  const dz = cameraPos.z - bikePos.z;
  if (dx * dx + dz * dz < 1e-6) return wrapper.userData.spriteView || 'back';

  // Même convention que BIKE_DIR_ANGLES : 0 rad = -Z.
  const toCamAngle = Math.atan2(dx, -dz);
  const relative = _normAngle(facing - toCamAngle);
  return _pickStableView(wrapper, textures, relative);
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
  // Les PNG sont dessinés avec leur face utile vers l'écran ; cette rotation
  // conserve la convention utilisée par les sprites existants.
  geo.rotateY(Math.PI);

  const mat = new THREE.MeshBasicMaterial({
    map: texFront,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    depthWrite: true,
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
  wrapper.userData.spriteTextures = {
    front: texFront,
    back: texBack,
    left: texLeft,
    right: texRight,
  };
  wrapper.userData.spriteView = 'front';
  wrapper.userData.spritePreviewFlip = !!skin.spritePreviewFlip;
  wrapper.userData.trailBackOffset = SPRITE_SIDE_LENGTH * 0.5;
  wrapper.userData.trailAnchorLocal = new THREE.Vector3(0, plane.position.y, SPRITE_SIDE_LENGTH * 0.5);

  _applyTexture(wrapper, texFront);
  plane.scale.set(wrapper.userData.targetPlaneWidth, SPRITE_HEIGHT, 1);
  return wrapper;
}

/**
 * Met à jour un sprite.
 *
 * Pour un adversaire, passer facingAngle. Le calcul est fait à CHAQUE frame,
 * après la mise à jour de la caméra, donc il n'y a plus de décalage d'un tick
 * entre la trajectoire du bot et la vue affichée.
 */
export function updateSpriteBike(wrapper, cameraPos, options = {}) {
  if (!wrapper?.userData?.isSpriteBike) return;

  const { forceView, preview, facingAngle } = options;
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
  } else if (facingAngle != null) {
    const viewKey = _pickViewForFacing(
      tex,
      facingAngle,
      cameraPos,
      wrapper.position,
      wrapper,
    );
    _applyTexture(wrapper, tex[viewKey]);
  }

  // Pas de lerp de largeur : lors d'un changement de vue, le plan prend
  // immédiatement le bon ratio. Cela supprime l'effet de texture qui « glisse »
  // ou se déforme pendant quelques frames.
  plane.scale.x = wrapper.userData.targetPlaneWidth;
  plane.scale.y = SPRITE_HEIGHT;
}
