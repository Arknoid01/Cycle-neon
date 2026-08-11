import { BIKE_SKINS, getBikeSkin } from './bike-skins.js';
import { loadChallenges } from './challenges.js';

const STORAGE_KEY = 'lc_unlocked_skins';

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

export function isSkinUnlocked(skinId) {
  const skin = getBikeSkin(skinId);
  if (!skin) return false;
  if (skin.tier === 'free') return true;
  if (loadGrantedSkins().includes(skinId)) return true;
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
}

export function getUnlockedSkinIds() {
  syncEarnedSkins();
  return BIKE_SKINS.filter(s => isSkinUnlocked(s.id)).map(s => s.id);
}

export function skinLockHint(skin) {
  if (!skin) return '';
  if (skin.tier === 'premium') return 'Premium — bientôt en boutique';
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
