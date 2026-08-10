export const COLOR_PRESETS = [
  { id: 'cyan', body: 0xffe566, glow: 0xffcc00, wheel: 0x00eeff, trail: 0xb8f8ff, trailGlow: 0x00eeff },
  { id: 'magenta', body: 0xffaacc, glow: 0xff66bb, wheel: 0xff44aa, trail: 0xffb8e8, trailGlow: 0xff0088 },
  { id: 'orange', body: 0xffee88, glow: 0xffaa00, wheel: 0xff8800, trail: 0xffd8a8, trailGlow: 0xff6600 },
  { id: 'lime', body: 0xeeff88, glow: 0xaaff00, wheel: 0x66ff44, trail: 0xd8ffb8, trailGlow: 0x44ff00 },
  { id: 'violet', body: 0xddaaff, glow: 0xaa66ff, wheel: 0x8844ff, trail: 0xe8ccff, trailGlow: 0x6600ff },
  { id: 'crimson', body: 0xffaaaa, glow: 0xff4444, wheel: 0xff0022, trail: 0xffc8c8, trailGlow: 0xff0044 },
];

export const BOT_DEFS = [
  { name: 'Spectre', isPlayer: false, personality: 'chasseur', difficulty: 2, body: 0xff66cc, glow: 0xff0088, wheel: 0xff88cc, trail: 0xffb8e8, trailGlow: 0xff44aa },
  { name: 'Phantom', isPlayer: false, personality: 'prudent', difficulty: 2, body: 0x66ff88, glow: 0x00ff66, wheel: 0x88ffaa, trail: 0xb8ffd8, trailGlow: 0x44ff88 },
];

export function loadCosmetic() {
  try { return localStorage.getItem('lc_cosmetic') || 'cyan'; } catch { return 'cyan'; }
}

export function saveCosmetic(id) {
  try { localStorage.setItem('lc_cosmetic', id); } catch {}
}

export function getCosmeticPreset() {
  return COLOR_PRESETS.find(p => p.id === loadCosmetic()) || COLOR_PRESETS[0];
}

export function getRiderDefs() {
  const c = getCosmeticPreset();
  return [
    { key: 'player', name: 'Toi', isPlayer: true, body: c.body, glow: c.glow, wheel: c.wheel, trail: c.trail, trailGlow: c.trailGlow },
    ...BOT_DEFS.map((b, i) => ({ key: 'bot' + i, ...b })),
  ];
}

export function hexCss(h) {
  return '#' + h.toString(16).padStart(6, '0');
}
