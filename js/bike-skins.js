/** Catalogue des skins moto — prêt monétisation (free / premium / earn). */
export const BIKE_SKINS = [
  {
    id: 'neon-core',
    name: 'Néon Core',
    desc: 'Le classique du grid',
    tier: 'free',
    kit: 'classic',
    chassisId: 'classic',
  },
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
    kit: 'phantom',
    chassisId: 'blade',
  },
  {
    id: 'vanguard',
    name: 'Vanguard',
    desc: 'Pylônes latéraux · présence lourde',
    tier: 'premium',
    kit: 'vanguard',
    chassisId: 'tank',
  },
  {
    id: 'specter',
    name: 'Specter',
    desc: 'Aileron dorsal · nez bifide',
    tier: 'premium',
    kit: 'specter',
    chassisId: 'blade',
  },
  {
    id: 'pulse',
    name: 'Pulse',
    desc: 'Cœur sphérique · lignes douces',
    tier: 'earn',
    kit: 'pulse',
    chassisId: 'racer',
    unlockChallenge: 'win_classique',
  },
  {
    id: 'inferno',
    name: 'Inferno',
    desc: 'Avant agressif · éclats de feu',
    tier: 'premium',
    kit: 'inferno',
    chassisId: 'tank',
  },
  {
    id: 'chrome',
    name: 'Chrome',
    desc: 'Carrosserie miroir · strips minimaux',
    tier: 'premium',
    kit: 'chrome',
    chassisId: 'classic',
  },
];

export const SKIN_TIER_LABELS = {
  free: 'Gratuit',
  premium: 'Premium',
  earn: 'Trophée',
};

export function getBikeSkin(id) {
  return BIKE_SKINS.find(s => s.id === id) || BIKE_SKINS[0];
}

export function getDefaultSkinId() {
  return BIKE_SKINS[0].id;
}
