/** Statistiques cumulées sur toutes les parties — alimentent les trophées
 * de progression à long terme (js/challenges.js) et pourront servir à un
 * futur écran de stats. Purement informatif, aucun effet sur le gameplay. */

const KEY = 'lc_lifetime_stats';

const DEFAULTS = {
  runs: 0,
  wins: 0,
  kills: 0,
  nearMisses: 0,
  bestMultiplier: 1,
  championshipsWon: 0,
  bestChampPoints: 0,
};

export function loadLifetimeStats() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveLifetimeStats(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

/** À appeler à la fin de chaque run arcade (victoire ou mort). */
export function recordRunEnd({ won, kills = 0, nearMisses = 0, maxMultiplier = 1 }) {
  const s = loadLifetimeStats();
  s.runs++;
  if (won) s.wins++;
  s.kills += kills;
  s.nearMisses += nearMisses;
  if (maxMultiplier > s.bestMultiplier) s.bestMultiplier = maxMultiplier;
  saveLifetimeStats(s);
  return s;
}

/** À appeler à la fin d'un championnat complet. */
export function recordChampionshipEnd({ won, points = 0 }) {
  const s = loadLifetimeStats();
  if (won) s.championshipsWon++;
  if (points > s.bestChampPoints) s.bestChampPoints = points;
  saveLifetimeStats(s);
  return s;
}
