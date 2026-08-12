import { loadLifetimeStats } from './stats.js';
import { getBikeSkin } from './bike-skins.js';

/** Points cumulés requis entre chaque palier de rang. */
export const TIER_STEP = 20000;

/** 10 paliers joueur + rang de départ (Recrue). Chaque palier débloque un véhicule. */
export const PROGRESSION_TIERS = [
  { level: 0, threshold: 0, title: 'Recrue', skinId: null },
  { level: 1, threshold: TIER_STEP * 1, title: 'Novice', skinId: 'tier-grid-rider' },
  { level: 2, threshold: TIER_STEP * 2, title: 'Initié', skinId: 'tier-neon-striker' },
  { level: 3, threshold: TIER_STEP * 3, title: 'Coureur', skinId: 'tier-circuit-wolf' },
  { level: 4, threshold: TIER_STEP * 4, title: 'Pilote', skinId: 'tier-void-rider' },
  { level: 5, threshold: TIER_STEP * 5, title: 'As du Grid', skinId: 'tier-plasma-knight' },
  { level: 6, threshold: TIER_STEP * 6, title: 'Néon Rider', skinId: 'tier-grid-phantom' },
  { level: 7, threshold: TIER_STEP * 7, title: 'Grid Master', skinId: 'tier-neon-overlord' },
  { level: 8, threshold: TIER_STEP * 8, title: 'Légende', skinId: 'tier-grid-legend' },
  { level: 9, threshold: TIER_STEP * 9, title: 'Mythique', skinId: 'tier-neon-ascendant' },
  { level: 10, threshold: TIER_STEP * 10, title: 'Champion', skinId: 'tier-grid-sovereign' },
];

export function formatPoints(n) {
  return (n ?? 0).toLocaleString('fr-FR');
}

export function getTotalPoints() {
  return loadLifetimeStats().totalPoints || 0;
}

export function getCurrentTier(totalPoints = getTotalPoints()) {
  let current = PROGRESSION_TIERS[0];
  for (const tier of PROGRESSION_TIERS) {
    if (totalPoints >= tier.threshold) current = tier;
    else break;
  }
  return current;
}

export function getNextTier(totalPoints = getTotalPoints()) {
  const current = getCurrentTier(totalPoints);
  return PROGRESSION_TIERS.find(t => t.level === current.level + 1) || null;
}

export function getTierProgress(totalPoints = getTotalPoints()) {
  const current = getCurrentTier(totalPoints);
  const next = getNextTier(totalPoints);
  if (!next) {
    return {
      pct: 100,
      current,
      next: null,
      inTier: 0,
      needed: 0,
      totalPoints,
      maxed: true,
    };
  }
  const inTier = totalPoints - current.threshold;
  const needed = next.threshold - current.threshold;
  return {
    pct: Math.min(100, (inTier / needed) * 100),
    current,
    next,
    inTier,
    needed,
    totalPoints,
    maxed: false,
  };
}

export function getTierForSkin(skinId) {
  return PROGRESSION_TIERS.find(t => t.skinId === skinId) || null;
}

export function getNextRewardLabel(totalPoints = getTotalPoints()) {
  const { next, maxed } = getTierProgress(totalPoints);
  if (maxed || !next?.skinId) return 'Rang max atteint';
  const skin = getBikeSkin(next.skinId);
  return `${next.title} · ${skin.name}`;
}

/** Retourne les paliers nouvellement franchis entre deux totaux. */
export function checkTierUnlocks(prevTotal, newTotal) {
  const unlocked = [];
  for (const tier of PROGRESSION_TIERS) {
    if (!tier.skinId) continue;
    if (prevTotal < tier.threshold && newTotal >= tier.threshold) unlocked.push(tier);
  }
  return unlocked;
}

export function getUnlockedTierSkinIds(totalPoints = getTotalPoints()) {
  return PROGRESSION_TIERS
    .filter(t => t.skinId && totalPoints >= t.threshold)
    .map(t => t.skinId);
}
