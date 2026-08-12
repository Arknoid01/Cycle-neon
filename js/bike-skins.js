function _neonCoreSprites(colorId) {
  return {
    front: `assets/bikes/sprites/${colorId}-front.png`,
    back: `assets/bikes/sprites/${colorId}-back.png`,
    left: `assets/bikes/sprites/${colorId}-side-left.png`,
    right: `assets/bikes/sprites/${colorId}-side-right.png`,
  };
}

/** Les 6 motos de base — même châssis, couleur néon différente. */
const NEON_CORE_COLORS = [
  { colorId: 'cyan', name: 'Néon Core Cyan', body: 0xccaa33, glow: 0xcc9900, wheel: 0x00aacc, trail: 0x66b8cc, trailGlow: 0x00aacc },
  { colorId: 'magenta', name: 'Néon Core Magenta', body: 0xcc6699, glow: 0xcc4499, wheel: 0xcc3388, trail: 0x994466, trailGlow: 0xcc0066 },
  { colorId: 'orange', name: 'Néon Core Orange', body: 0xcc9944, glow: 0xcc8800, wheel: 0xcc6600, trail: 0x996633, trailGlow: 0xcc5500 },
  { colorId: 'lime', name: 'Néon Core Citron', body: 0x99cc44, glow: 0x77aa00, wheel: 0x44aa33, trail: 0x669944, trailGlow: 0x33aa00 },
  { colorId: 'violet', name: 'Néon Core Violet', body: 0x9966cc, glow: 0x7744cc, wheel: 0x6633cc, trail: 0x664499, trailGlow: 0x5500cc },
  { colorId: 'crimson', name: 'Néon Core Cramoisi', body: 0xcc6666, glow: 0xcc3333, wheel: 0xcc0022, trail: 0x994444, trailGlow: 0xcc0033 },
];

/** Catalogue des skins moto — prêt monétisation (free / premium / earn). */
export const BIKE_SKINS = [
  ...NEON_CORE_COLORS.map(c => ({
    id: `neon-core-${c.colorId}`,
    name: c.name,
    desc: 'Le classique du grid',
    tier: 'free',
    kit: 'sprite',
    sprites: _neonCoreSprites(c.colorId),
    fallbackKit: 'classic',
    chassisId: 'classic',
    body: c.body,
    glow: c.glow,
    wheel: c.wheel,
    trail: c.trail,
    trailGlow: c.trailGlow,
  })),
  {
    id: 'streak',
    name: 'Streak',
    desc: 'Profil de course affûté',
    tier: 'free',
    kit: 'classic',
    chassisId: 'racer',
  },
  {
    id: 'phantom',
    name: 'Phantom',
    desc: 'Anneaux lumineux · profil fantôme',
    tier: 'premium',
    kit: 'gltf',
    model: 'assets/bikes/phantom.glb',
    fallbackKit: 'phantom',
    chassisId: 'blade',
  },
  {
    id: 'vanguard',
    name: 'Vanguard',
    desc: 'Pylônes latéraux · présence lourde',
    tier: 'premium',
    kit: 'gltf',
    model: 'assets/bikes/vanguard.glb',
    fallbackKit: 'vanguard',
    chassisId: 'tank',
  },
  {
    id: 'specter',
    name: 'Specter',
    desc: 'Aileron dorsal · nez bifide',
    tier: 'premium',
    kit: 'gltf',
    model: 'assets/bikes/specter.glb',
    fallbackKit: 'specter',
    chassisId: 'blade',
  },
  {
    id: 'pulse',
    name: 'Pulse',
    desc: 'Cœur sphérique · lignes douces',
    tier: 'earn',
    kit: 'gltf',
    model: 'assets/bikes/pulse.glb',
    fallbackKit: 'pulse',
    chassisId: 'racer',
    unlockChallenge: 'win_classique',
  },
  {
    id: 'inferno',
    name: 'Inferno',
    desc: 'Avant agressif · éclats de feu',
    tier: 'premium',
    kit: 'gltf',
    model: 'assets/bikes/inferno.glb',
    fallbackKit: 'inferno',
    chassisId: 'tank',
  },
  {
    id: 'chrome',
    name: 'Chrome',
    desc: 'Carrosserie miroir · strips minimaux',
    tier: 'premium',
    kit: 'gltf',
    model: 'assets/bikes/chrome.glb',
    fallbackKit: 'chrome',
    chassisId: 'classic',
  },
  // — Véhicules de palier (aperçu 3D branché plus tard) —
  {
    id: 'tier-grid-rider',
    name: 'Grid Rider',
    desc: 'Châssis palier · Novice',
    tier: 'progression',
    kit: 'classic',
    chassisId: 'racer',
    unlockTier: 1,
  },
  {
    id: 'tier-neon-striker',
    name: 'Neon Striker',
    desc: 'Châssis palier · Initié',
    tier: 'progression',
    kit: 'classic',
    chassisId: 'blade',
    unlockTier: 2,
  },
  {
    id: 'tier-circuit-wolf',
    name: 'Circuit Wolf',
    desc: 'Châssis palier · Coureur',
    tier: 'progression',
    kit: 'classic',
    chassisId: 'tank',
    unlockTier: 3,
  },
  {
    id: 'tier-void-rider',
    name: 'Void Rider',
    desc: 'Châssis palier · Pilote',
    tier: 'progression',
    kit: 'classic',
    chassisId: 'classic',
    unlockTier: 4,
  },
  {
    id: 'tier-plasma-knight',
    name: 'Plasma Knight',
    desc: 'Châssis palier · As du Grid',
    tier: 'progression',
    kit: 'classic',
    chassisId: 'racer',
    unlockTier: 5,
  },
  {
    id: 'tier-grid-phantom',
    name: 'Grid Phantom',
    desc: 'Châssis palier · Néon Rider',
    tier: 'progression',
    kit: 'classic',
    chassisId: 'blade',
    unlockTier: 6,
  },
  {
    id: 'tier-neon-overlord',
    name: 'Neon Overlord',
    desc: 'Châssis palier · Grid Master',
    tier: 'progression',
    kit: 'classic',
    chassisId: 'tank',
    unlockTier: 7,
  },
  {
    id: 'tier-grid-legend',
    name: 'Grid Legend',
    desc: 'Châssis palier · Légende',
    tier: 'progression',
    kit: 'classic',
    chassisId: 'classic',
    unlockTier: 8,
  },
  {
    id: 'tier-neon-ascendant',
    name: 'Neon Ascendant',
    desc: 'Châssis palier · Mythique',
    tier: 'progression',
    kit: 'classic',
    chassisId: 'racer',
    unlockTier: 9,
  },
  {
    id: 'tier-grid-sovereign',
    name: 'Grid Sovereign',
    desc: 'Châssis palier · Champion',
    tier: 'progression',
    kit: 'classic',
    chassisId: 'blade',
    unlockTier: 10,
  },
];

export const SKIN_TIER_LABELS = {
  free: 'Gratuit',
  premium: 'Premium',
  earn: 'Trophée',
  progression: 'Palier',
};

export function getBikeSkin(id) {
  return BIKE_SKINS.find(s => s.id === id) || BIKE_SKINS[0];
}

export function getDefaultSkinId() {
  return (BIKE_SKINS.find(s => s.tier === 'free') || BIKE_SKINS[0]).id;
}

export function getGltfSkins() {
  return BIKE_SKINS.filter(s => s.model);
}
