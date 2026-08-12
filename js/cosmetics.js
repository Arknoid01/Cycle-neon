import { getChassisPreset } from './bike-builder.js';
import { BIKE_SKINS, getBikeSkin, getDefaultSkinId } from './bike-skins.js';
import { isSkinUnlocked, syncEarnedSkins } from './skin-unlocks.js';
import { CHAMPIONSHIP_BOTS } from './bots.js';

export { CHASSIS_PRESETS, getChassisPreset } from './bike-builder.js';
export { BIKE_SKINS, getBikeSkin, SKIN_TIER_LABELS } from './bike-skins.js';
export {
  isSkinUnlocked, grantSkin, purchaseSkin, syncEarnedSkins, skinLockHint, getUnlockedSkinIds,
  applyTierUnlocks,
} from './skin-unlocks.js';

/** Tire `n` rivaux distincts parmi le roster nommé — un nouveau duo (ou
 * trio) à chaque partie plutôt que toujours les deux mêmes adversaires. */
export function pickRandomBots(n) {
  const pool = [...CHAMPIONSHIP_BOTS];
  const picked = [];
  while (picked.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

export function loadSkin() {
  try {
    const skin = localStorage.getItem('lc_skin');
    if (skin) return skin;
    const legacy = localStorage.getItem('lc_chassis');
    if (legacy) {
      const map = { classic: 'neon-core-cyan', racer: 'streak', tank: 'vanguard', blade: 'specter' };
      return map[legacy] || getDefaultSkinId();
    }
    return getDefaultSkinId();
  } catch { return getDefaultSkinId(); }
}

export function saveSkin(id) {
  try { localStorage.setItem('lc_skin', id); } catch {}
}

/** @deprecated use loadSkin */
export function loadChassis() {
  const skin = getActiveSkin();
  return skin.chassisId;
}

/** @deprecated */
export function saveChassis() {}

export function getActiveSkin() {
  syncEarnedSkins();
  const id = loadSkin();
  const skin = getBikeSkin(id);
  if (isSkinUnlocked(skin.id)) return skin;
  return getBikeSkin(getDefaultSkinId());
}

/** Couleur portée par le skin lui-même (plus de sélecteur de couleur séparé). */
export function getRiderColorDef(skin = getActiveSkin()) {
  return {
    body: skin.body,
    glow: skin.glow,
    wheel: skin.wheel,
    trail: skin.trail,
    trailGlow: skin.trailGlow,
  };
}

export function buildRiderDef(base, skinId) {
  const skin = getBikeSkin(skinId);
  return {
    ...base,
    skinId: skin.id,
    skin,
    chassisId: skin.chassisId,
    chassis: getChassisPreset(skin.chassisId),
  };
}

export function getRiderDefs() {
  const skin = getActiveSkin();
  return [
    buildRiderDef({
      key: 'player', name: 'Toi', isPlayer: true,
      ...getRiderColorDef(skin),
    }, skin.id),
    ...pickRandomBots(2).map((b, i) => buildRiderDef({
      key: 'bot' + i,
      name: b.name,
      isPlayer: false,
      personality: b.personality,
      difficulty: b.difficulty,
      body: b.body, glow: b.glow, wheel: b.wheel, trail: b.trail, trailGlow: b.trailGlow,
    }, b.skinId)),
  ];
}

export function hexCss(h) {
  return '#' + h.toString(16).padStart(6, '0');
}
