/**
 * Presets de skin néon — couche cosmétique riche, purement additive.
 *
 * Ne remplace PAS COLOR_PRESETS (cosmetics.js), qui reste la source de
 * couleurs active pour le rendu actuel (procédural + GLB via
 * bike-model-loader.js). Ce fichier prépare les paramètres nécessaires au
 * futur MotoSkinShader (pattern animé, intensité de glow, id de traînée)
 * sans toucher au pipeline de rendu existant.
 *
 * Aucune statistique de gameplay ici : purement cosmétique.
 *
 * @typedef {Object} NeonPreset
 * @property {string} id
 * @property {string} name
 * @property {string} bodyColor      - couleur carrosserie, format CSS hex ('#rrggbb')
 * @property {string} primaryColor   - couleur néon principale
 * @property {string} secondaryColor - couleur néon secondaire
 * @property {string} emissiveColor  - couleur d'émission (glow shader)
 * @property {string} pattern        - id de motif animé ('pulse' | 'scan' | 'flicker' | 'solid')
 * @property {number} patternScale   - échelle du motif (unités shader, >0)
 * @property {number} animationSpeed - vitesse d'animation du motif (cycles/s)
 * @property {number} glowIntensity  - intensité du bloom/émission (0–5 environ)
 * @property {string} trailId        - id de traînée associée (voir moving-wall.js / trail système)
 */

/** @type {NeonPreset[]} */
export const NEON_PRESETS = [
  {
    id: 'cyan_pulse',
    name: 'Cyan Pulse',
    bodyColor: '#02080a',
    primaryColor: '#00eaff',
    secondaryColor: '#007c91',
    emissiveColor: '#7fffff',
    pattern: 'pulse',
    patternScale: 1.0,
    animationSpeed: 1.0,
    glowIntensity: 2.5,
    trailId: 'electric_cyan',
  },
  {
    id: 'violet_void',
    name: 'Violet Void',
    bodyColor: '#07040d',
    primaryColor: '#8a2bff',
    secondaryColor: '#4b1a8f',
    emissiveColor: '#c199ff',
    pattern: 'scan',
    patternScale: 1.4,
    animationSpeed: 0.7,
    glowIntensity: 2.8,
    trailId: 'electric_violet',
  },
  {
    id: 'toxic_green',
    name: 'Toxic Green',
    bodyColor: '#050a04',
    primaryColor: '#39ff6a',
    secondaryColor: '#1c8f3a',
    emissiveColor: '#adffc2',
    pattern: 'flicker',
    patternScale: 0.8,
    animationSpeed: 1.6,
    glowIntensity: 2.2,
    trailId: 'electric_toxic',
  },
  {
    id: 'inferno',
    name: 'Inferno',
    bodyColor: '#0a0402',
    primaryColor: '#ff5a1f',
    secondaryColor: '#8f2a0f',
    emissiveColor: '#ffcf8a',
    pattern: 'pulse',
    patternScale: 1.2,
    animationSpeed: 1.3,
    glowIntensity: 3.0,
    trailId: 'electric_inferno',
  },
  {
    id: 'white_ghost',
    name: 'White Ghost',
    bodyColor: '#0a0a0c',
    primaryColor: '#f5f9ff',
    secondaryColor: '#9fb3c8',
    emissiveColor: '#ffffff',
    pattern: 'solid',
    patternScale: 1.0,
    animationSpeed: 0.5,
    glowIntensity: 1.8,
    trailId: 'electric_ghost',
  },
];

export function getNeonPreset(id) {
  return NEON_PRESETS.find(p => p.id === id) || NEON_PRESETS[0];
}
