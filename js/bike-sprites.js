import * as THREE from 'three';
import { BIKE_DIR_ANGLES } from './constants.js';

export const BIKE_SHEET_PATH = 'assets/bikes/file_0000000078e88246abe35618d96bc1fb.png';

/** Atlas 2×2 — indices 0..3 (bas-gauche, haut-gauche, haut-droite, bas-droite). */
export const BIKE_FRAME_OFFSETS = [
  { x: 0, y: 0 },     // 0 arrière
  { x: 0, y: 0.5 },   // 1 profil droite
  { x: 0.5, y: 0.5 }, // 2 face
  { x: 0.5, y: 0 },   // 3 profil gauche
];

/** Direction jeu (0=haut…) → index frame dans BIKE_FRAME_OFFSETS. */
export const BIKE_FRAME_FOR_DIR = [0, 1, 2, 3];

/** Rotation extra par direction, en degrés (ajoutée à BIKE_DIR_ANGLES). */
export const BIKE_SPRITE_ROT_OFFSET_DEG = [0, 0, 0, 0];

/** Retournement π sur l’axe Y. */
export const BIKE_SPRITE_FLIP = [false, true, false, false];

/** Miroir horizontal du sprite (scale.x = -1). */
export const BIKE_SPRITE_FLIP_X = [false, false, false, false];

export const BIKE_SPRITE_W = 1.05;
export const BIKE_SPRITE_H = 0.72;
export const BIKE_SPRITE_Y = 0.36;
export const BIKE_REAR_OFFSET = 0.44;

export const BIKE_DIR_LABELS = ['↑ Haut', '→ Droite', '↓ Bas', '← Gauche'];
export const BIKE_FRAME_LABELS = ['0 Arrière', '1 Profil →', '2 Face', '3 Profil ←'];

/** Réglages runtime (debug) — initialisés depuis les constantes ci-dessus. */
export const bikeSpriteTuning = {
  frameForDir: [...BIKE_FRAME_FOR_DIR],
  rotOffsetDeg: [...BIKE_SPRITE_ROT_OFFSET_DEG],
  flipPi: [...BIKE_SPRITE_FLIP],
  flipX: [...BIKE_SPRITE_FLIP_X],
};

const TUNING_STORAGE_KEY = 'lc_bike_sprite_tuning';

export function loadBikeSpriteTuningFromStorage() {
  try {
    const raw = localStorage.getItem(TUNING_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.frameForDir) bikeSpriteTuning.frameForDir = data.frameForDir;
    if (data.rotOffsetDeg) bikeSpriteTuning.rotOffsetDeg = data.rotOffsetDeg;
    if (data.flipPi) bikeSpriteTuning.flipPi = data.flipPi;
    if (data.flipX) bikeSpriteTuning.flipX = data.flipX;
    return true;
  } catch {
    return false;
  }
}

export function saveBikeSpriteTuningToStorage() {
  try {
    localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(bikeSpriteTuning));
  } catch {}
}

export function resetBikeSpriteTuning() {
  bikeSpriteTuning.frameForDir = [...BIKE_FRAME_FOR_DIR];
  bikeSpriteTuning.rotOffsetDeg = [...BIKE_SPRITE_ROT_OFFSET_DEG];
  bikeSpriteTuning.flipPi = [...BIKE_SPRITE_FLIP];
  bikeSpriteTuning.flipX = [...BIKE_SPRITE_FLIP_X];
  saveBikeSpriteTuningToStorage();
}

export function getFrameIndexForDir(dir) {
  return bikeSpriteTuning.frameForDir[dir] ?? dir;
}

export function getBikeSpriteRotation(dir) {
  const flip = bikeSpriteTuning.flipPi[dir] ? Math.PI : 0;
  const extra = (bikeSpriteTuning.rotOffsetDeg[dir] || 0) * (Math.PI / 180);
  return BIKE_DIR_ANGLES[dir] + flip + extra;
}

export function getBikeSpriteScaleX(dir) {
  return bikeSpriteTuning.flipX[dir] ? -1 : 1;
}

export function exportBikeSpriteConfigCode() {
  const t = bikeSpriteTuning;
  const fmt = (arr) => JSON.stringify(arr);
  return [
    '/** Configuration sprite moto — coller dans js/bike-sprites.js */',
    `export const BIKE_FRAME_FOR_DIR = ${fmt(t.frameForDir)};`,
    `export const BIKE_SPRITE_ROT_OFFSET_DEG = ${fmt(t.rotOffsetDeg)};`,
    `export const BIKE_SPRITE_FLIP = ${fmt(t.flipPi)};`,
    `export const BIKE_SPRITE_FLIP_X = ${fmt(t.flipX)};`,
    '',
    '// Puis réinitialiser bikeSpriteTuning depuis ces constantes au chargement,',
    '// ou remplacer les valeurs par défaut de BIKE_FRAME_FOR_DIR etc.',
  ].join('\n');
}

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
