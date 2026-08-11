const DEFAULTS = { volume: 1, haptic: true, bloom: true, bikeDebug: false };

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('lc_settings') || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(partial) {
  const next = { ...getSettings(), ...partial };
  try { localStorage.setItem('lc_settings', JSON.stringify(next)); } catch {}
  return next;
}
