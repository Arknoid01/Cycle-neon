import * as THREE from 'three';

const NEUTRAL_BODY = 0x7d8791;

/** Désature une couleur de carrosserie vers un gris neutre — évite l'aplat "tout en une couleur". */
export function neutralizeBodyColor(hex, amount = 0.68) {
  return new THREE.Color(hex).lerp(new THREE.Color(NEUTRAL_BODY), amount).getHex();
}
