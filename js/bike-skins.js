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

function _trophyGoldSprites(stage) {
  return {
    front: `assets/bikes/sprites/trophy-gold-${stage}-front.png`,
    back: `assets/bikes/sprites/trophy-gold-${stage}-back.png`,
    left: `assets/bikes/sprites/trophy-gold-${stage}-side-left.png`,
    right: `assets/bikes/sprites/trophy-gold-${stage}-side-right.png`,
  };
}

/**
 * La moto de palier : même moto « trophée » du début à la fin, mais de plus en
 * plus dorée à chaque rang franchi — jusqu'à l'or massif au palier Champion.
 * Les id/unlockTier correspondent 1:1 à PROGRESSION_TIERS (progression.js).
 */
const TROPHY_GOLD_STAGES = [
  { stage: 1, id: 'tier-grid-rider', name: 'Trophée Doré I', desc: 'Palier Novice · reflets dorés naissants', color: 0x00aacc, trail: 0x005e70 },
  { stage: 2, id: 'tier-neon-striker', name: 'Trophée Doré II', desc: 'Palier Initié · l’or gagne du terrain', color: 0x1cadbc, trail: 0x105f67 },
  { stage: 3, id: 'tier-circuit-wolf', name: 'Trophée Doré III', desc: 'Palier Coureur · les touches dorées se multiplient', color: 0x39b0ac, trail: 0x1f615f },
  { stage: 4, id: 'tier-void-rider', name: 'Trophée Doré IV', desc: 'Palier Pilote · carrosserie mi-dorée', color: 0x55b29c, trail: 0x2f6256 },
  { stage: 5, id: 'tier-plasma-knight', name: 'Trophée Doré V', desc: 'Palier As du Grid · plus qu’à moitié dorée', color: 0x71b58c, trail: 0x3e644d },
  { stage: 6, id: 'tier-grid-phantom', name: 'Trophée Doré VI', desc: 'Palier Néon Rider · l’or domine', color: 0x8eb87c, trail: 0x4e6544 },
  { stage: 7, id: 'tier-neon-overlord', name: 'Trophée Doré VII', desc: 'Palier Grid Master · à peine un reste de bleu', color: 0xaabb6c, trail: 0x5e673b },
  { stage: 8, id: 'tier-grid-legend', name: 'Trophée Doré VIII', desc: 'Palier Légende · presque tout en or', color: 0xc6bd5c, trail: 0x6d6833 },
  { stage: 9, id: 'tier-neon-ascendant', name: 'Trophée Doré IX', desc: 'Palier Mythique · or presque total', color: 0xe3c04c, trail: 0x7d6a2a },
  { stage: 10, id: 'tier-grid-sovereign', name: 'Trophée Doré X', desc: 'Palier Champion · or massif', color: 0xffc33c, trail: 0x8c6b21 },
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
  // — Moto de palier : la même moto « trophée », de plus en plus dorée à chaque rang —
  ...TROPHY_GOLD_STAGES.map(s => ({
    id: s.id,
    name: s.name,
    desc: s.desc,
    tier: 'progression',
    kit: 'sprite',
    sprites: _trophyGoldSprites(s.stage),
    fallbackKit: 'pulse',
    chassisId: 'racer',
    unlockTier: s.stage,
    body: s.color,
    glow: s.color,
    wheel: s.color,
    trail: s.trail,
    trailGlow: s.color,
  })),
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

/** Les 6 motos de base (Néon Core), utilisées pour l'attribution aléatoire aux bots. */
export function getBaseColorSkins() {
  return BIKE_SKINS.filter(s => s.id.startsWith('neon-core-'));
}
