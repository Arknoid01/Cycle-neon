import { BIKE_SKINS, getBikeSkin } from './bike-skins.js';
import { loadChallenges } from './challenges.js';
import { getTotalPoints, getTierForSkin, formatPoints, TIER_STEP, getUnlockedTierSkinIds, checkTierUnlocks } from './progression.js';

const STORAGE_KEY = 'lc_unlocked_skins';

/**
 * Bascule temporaire de développement : tous les skins sont déverrouillés,
 * quel que soit leur tier (premium/earn). Les tiers restent intacts dans
 * bike-skins.js — il suffira de repasser ce flag à false pour réactiver le
 * système de déblocage (boutique + trophées) avant la sortie.
 */
const ALL_UNLOCKED_DEV = true;

const FREE_SKIN_IDS = BIKE_SKINS.filter(s => s.tier === 'free').map(s => s.id);

export function loadGrantedSkins() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function grantSkin(skinId) {
  const skin = getBikeSkin(skinId);
  if (!skin || skin.tier === 'free') return;
  const set = new Set(loadGrantedSkins());
  if (set.has(skinId)) return;
  set.add(skinId);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); } catch {}
}

function isProgressionSkinUnlocked(skin) {
  if (!skin?.unlockTier) return false;
  return getTotalPoints() >= skin.unlockTier * TIER_STEP;
}

export function isSkinUnlocked(skinId) {
  const skin = getBikeSkin(skinId);
  if (!skin) return false;
  if (ALL_UNLOCKED_DEV) return true;
  if (skin.tier === 'free') return true;
  if (loadGrantedSkins().includes(skinId)) return true;
  if (skin.tier === 'progression' && isProgressionSkinUnlocked(skin)) return true;
  if (skin.tier === 'earn' && skin.unlockChallenge) {
    return !!loadChallenges()[skin.unlockChallenge];
  }
  return false;
}

/** Sync earn-tier skins from trophy progress (call after challenge unlock). */
export function syncEarnedSkins() {
  const done = loadChallenges();
  for (const skin of BIKE_SKINS) {
    if (skin.tier === 'earn' && skin.unlockChallenge && done[skin.unlockChallenge]) {
      grantSkin(skin.id);
    }
  }
  syncProgressionSkins();
}

/** Accorde les véhicules de palier déjà atteints (rattrapage au chargement). */
export function syncProgressionSkins() {
  for (const skinId of getUnlockedTierSkinIds()) grantSkin(skinId);
}

/** Détecte et accorde les paliers franchis depuis la dernière partie. */
export function applyTierUnlocks(prevTotal, newTotal) {
  const tiers = checkTierUnlocks(prevTotal, newTotal);
  for (const t of tiers) if (t.skinId) grantSkin(t.skinId);
  return tiers;
}

export function getUnlockedSkinIds() {
  syncEarnedSkins();
  return BIKE_SKINS.filter(s => isSkinUnlocked(s.id)).map(s => s.id);
}

export function skinLockHint(skin) {
  if (!skin) return '';
  if (skin.tier === 'premium') return 'Premium — bientôt en boutique';
  if (skin.tier === 'progression' && skin.unlockTier) {
    const tier = getTierForSkin(skin.id);
    const pts = skin.unlockTier * TIER_STEP;
    return tier
      ? `Palier ${tier.title} · ${formatPoints(pts)} pts cumulés`
      : `Palier · ${formatPoints(pts)} pts cumulés`;
  }
  if (skin.tier === 'earn' && skin.unlockChallenge) return 'Débloque le trophée associé';
  return 'Verrouillé';
}

/** Dev / future IAP hook — simule un achat premium. */
export function purchaseSkin(skinId) {
  const skin = getBikeSkin(skinId);
  if (!skin || skin.tier !== 'premium') return false;
  grantSkin(skinId);
  return true;
}

export { FREE_SKIN_IDS };
