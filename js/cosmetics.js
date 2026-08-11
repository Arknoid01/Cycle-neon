import { getChassisPreset } from './bike-builder.js';
import { BIKE_SKINS, getBikeSkin, getDefaultSkinId } from './bike-skins.js';
import { isSkinUnlocked, syncEarnedSkins } from './skin-unlocks.js';

export { CHASSIS_PRESETS, getChassisPreset } from './bike-builder.js';
export { BIKE_SKINS, getBikeSkin, SKIN_TIER_LABELS } from './bike-skins.js';
export {
  isSkinUnlocked, grantSkin, purchaseSkin, syncEarnedSkins, skinLockHint, getUnlockedSkinIds,
} from './skin-unlocks.js';

export const COLOR_PRESETS = [
  { id: 'cyan', body: 0xccaa33, glow: 0xcc9900, wheel: 0x00aacc, trail: 0x66b8cc, trailGlow: 0x00aacc },
  { id: 'magenta', body: 0xcc6699, glow: 0xcc4499, wheel: 0xcc3388, trail: 0x994466, trailGlow: 0xcc0066 },
  { id: 'orange', body: 0xcc9944, glow: 0xcc8800, wheel: 0xcc6600, trail: 0x996633, trailGlow: 0xcc5500 },
  { id: 'lime', body: 0x99cc44, glow: 0x77aa00, wheel: 0x44aa33, trail: 0x669944, trailGlow: 0x33aa00 },
  { id: 'violet', body: 0x9966cc, glow: 0x7744cc, wheel: 0x6633cc, trail: 0x664499, trailGlow: 0x5500cc },
  { id: 'crimson', body: 0xcc6666, glow: 0xcc3333, wheel: 0xcc0022, trail: 0x994444, trailGlow: 0xcc0033 },
];

export const BOT_DEFS = [
  { name: 'Spectre', isPlayer: false, personality: 'chasseur', difficulty: 2, body: 0xcc4499, glow: 0xcc0066, wheel: 0xcc6699, trail: 0x994466, trailGlow: 0xcc3388, skinId: 'specter' },
  { name: 'Phantom', isPlayer: false, personality: 'prudent', difficulty: 2, body: 0x44aa66, glow: 0x00cc55, wheel: 0x55aa77, trail: 0x336644, trailGlow: 0x33aa66, skinId: 'phantom' },
];

export function loadCosmetic() {
  try { return localStorage.getItem('lc_cosmetic') || 'cyan'; } catch { return 'cyan'; }
}

export function saveCosmetic(id) {
  try { localStorage.setItem('lc_cosmetic', id); } catch {}
}

export function loadSkin() {
  try {
    const skin = localStorage.getItem('lc_skin');
    if (skin) return skin;
    const legacy = localStorage.getItem('lc_chassis');
    if (legacy) {
      const map = { classic: 'neon-core', racer: 'streak', tank: 'vanguard', blade: 'specter' };
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

export function getCosmeticPreset() {
  return COLOR_PRESETS.find(p => p.id === loadCosmetic()) || COLOR_PRESETS[0];
}

export function getActiveSkin() {
  syncEarnedSkins();
  const id = loadSkin();
  const skin = getBikeSkin(id);
  if (isSkinUnlocked(skin.id)) return skin;
  return getBikeSkin(getDefaultSkinId());
}

export function getRiderColorDef(preset = getCosmeticPreset()) {
  return {
    body: preset.body,
    glow: preset.glow,
    wheel: preset.wheel,
    trail: preset.trail,
    trailGlow: preset.trailGlow,
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
  const colors = getCosmeticPreset();
  const skin = getActiveSkin();
  return [
    buildRiderDef({
      key: 'player', name: 'Toi', isPlayer: true,
      ...getRiderColorDef(colors),
    }, skin.id),
    ...BOT_DEFS.map((b, i) => buildRiderDef({
      key: 'bot' + i,
      name: b.name,
      isPlayer: b.isPlayer,
      personality: b.personality,
      difficulty: b.difficulty,
      body: b.body, glow: b.glow, wheel: b.wheel, trail: b.trail, trailGlow: b.trailGlow,
    }, b.skinId ?? (i === 0 ? 'specter' : 'phantom'))),
  ];
}

export function hexCss(h) {
  return '#' + h.toString(16).padStart(6, '0');
}
