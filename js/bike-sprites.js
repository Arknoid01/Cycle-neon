import * as THREE from 'three';

export const BIKE_SHEET_PATH = 'assets/bikes/file_0000000078e88246abe35618d96bc1fb.png';

/** Atlas 2×2 — offsets bas-gauche de chaque quadrant (repeat 0.5×0.5). */
export const BIKE_FRAME_OFFSETS = [
  { x: 0, y: 0 },     // 0 haut  → arrière (sheet bas-gauche)
  { x: 0, y: 0.5 },   // 1 droite → profil droite (sheet haut-gauche)
  { x: 0.5, y: 0.5 }, // 2 bas   → face (sheet haut-droite)
  { x: 0.5, y: 0 },   // 3 gauche → profil gauche (sheet bas-droite)
];

/** Plane default normal is +Z; flip π on profile dirs so the face points at the camera. */
export const BIKE_SPRITE_FLIP = [false, true, false, false];

export const BIKE_SPRITE_W = 1.05;
export const BIKE_SPRITE_H = 0.72;
export const BIKE_SPRITE_Y = 0.36;
export const BIKE_REAR_OFFSET = 0.44;

export function loadBikeSpriteSheet() {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      BIKE_SHEET_PATH,
      (tex) => {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.repeat.set(0.5, 0.5);
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

/** Teinte légère pour différencier joueur / bots sans dénaturer le pixel art. */
export function bikeSpriteTint(def) {
  const c = new THREE.Color(def.trailGlow);
  c.lerp(new THREE.Color(0xffffff), 0.5);
  return c;
}

export function createBikeFrameMaterials(baseTexture, tint) {
  return BIKE_FRAME_OFFSETS.map(({ x, y }) => {
    const map = baseTexture.clone();
    map.repeat.set(0.5, 0.5);
    map.offset.set(x, y);
    map.needsUpdate = true;
    return new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      alphaTest: 0.35,
      color: tint,
      depthWrite: true,
      side: THREE.FrontSide,
    });
  });
}
