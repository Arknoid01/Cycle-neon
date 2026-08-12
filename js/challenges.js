/**
 * Trophées. `check(stats)` reçoit un objet flexible dont les champs
 * disponibles dépendent du contexte d'appel :
 *  - fin de run arcade : won, kills, score, time, arenaId, maxMultiplier,
 *    nearMisses, lifetime (stats cumulées, déjà mises à jour pour ce run)
 *  - fin de championnat : championshipWon, championshipPoints, lifetime
 * Un champ absent est simplement `undefined` (falsy) — chaque check() ne
 * doit lire que les champs qui le concernent.
 */
export const CHALLENGES = [
  // — Score —
  { id: 'score_100', name: 'Centurion', desc: 'Atteins 100 points',
    check: s => s.score >= 100 },
  { id: 'score_250', name: 'Élite', desc: 'Atteins 250 points',
    check: s => s.score >= 250 },
  { id: 'score_500', name: 'Légende', desc: 'Atteins 500 points',
    check: s => s.score >= 500 },
  { id: 'score_1000', name: 'Mythique', desc: 'Atteins 1000 points',
    check: s => s.score >= 1000 },

  // — Survie —
  { id: 'survive_30', name: 'Endurant', desc: 'Survis 30 secondes',
    check: s => s.time >= 30 },
  { id: 'survive_60', name: 'Increvable', desc: 'Survis 60 secondes',
    check: s => s.time >= 60 },
  { id: 'survive_120', name: 'Immortel', desc: 'Survis 120 secondes',
    check: s => s.time >= 120 },

  // — Arènes —
  { id: 'compresseur_30', name: 'Compressé', desc: '30 s dans Le Compresseur',
    check: s => s.arenaId === 'compresseur' && s.time >= 30 },
  { id: 'win_classique', name: 'Duel', desc: 'Gagne dans Le Classique',
    check: s => s.won && s.arenaId === 'classique' },
  { id: 'win_labyrinthe', name: 'Minotaure', desc: 'Gagne dans Le Labyrinthe',
    check: s => s.won && s.arenaId === 'labyrinthe' },
  { id: 'win_duel', name: 'Face à Face', desc: 'Gagne dans Le Duel',
    check: s => s.won && s.arenaId === 'duel' },
  { id: 'win_chaos', name: "Œil du Chaos", desc: 'Gagne dans Le Chaos',
    check: s => s.won && s.arenaId === 'chaos' },
  { id: 'vague_45', name: 'Surfeur', desc: '45 s dans La Vague',
    check: s => s.arenaId === 'vague' && s.time >= 45 },

  // — Style / élimination —
  { id: 'eliminate_all', name: 'Chasseur', desc: 'Élimine les 2 adversaires',
    check: s => s.won && s.kills >= 2 },
  { id: 'eclair_mortel', name: 'Éclair Mortel', desc: 'Élimine les 2 adversaires en moins de 25 s',
    check: s => s.won && s.kills >= 2 && s.time <= 25 },
  { id: 'multiplier_max', name: 'Combo Parfait', desc: 'Atteins le multiplicateur x5',
    check: s => s.maxMultiplier >= 5 },
  { id: 'near_miss_5', name: 'Funambule', desc: '5 frôlements en une seule partie',
    check: s => s.nearMisses >= 5 },

  // — Championnat —
  { id: 'champ_win', name: 'Couronné', desc: 'Remporte un championnat',
    check: s => s.championshipWon === true },

  // — Progression à long terme —
  { id: 'lifetime_kills_25', name: 'Faucheur en Série', desc: '25 éliminations au total',
    check: s => (s.lifetime?.kills ?? 0) >= 25 },
  { id: 'lifetime_wins_10', name: 'Habitué', desc: '10 victoires au total',
    check: s => (s.lifetime?.wins ?? 0) >= 10 },
  { id: 'lifetime_runs_50', name: 'Vétéran', desc: '50 parties jouées',
    check: s => (s.lifetime?.runs ?? 0) >= 50 },
];

export function loadChallenges() {
  try { return JSON.parse(localStorage.getItem('lc_challenges') || '{}'); } catch { return {}; }
}

export function saveChallengeDone(id) {
  const c = loadChallenges();
  c[id] = true;
  try { localStorage.setItem('lc_challenges', JSON.stringify(c)); } catch {}
}

export function checkChallenges(stats) {
  const done = loadChallenges();
  const unlocked = [];
  for (const ch of CHALLENGES) {
    if (!done[ch.id] && ch.check(stats)) {
      saveChallengeDone(ch.id);
      unlocked.push(ch);
    }
  }
  return unlocked;
}

/** Arène ou mode suggéré pour tenter un défi depuis l'écran Trophées. */
const CHALLENGE_LAUNCH = {
  compresseur_30: { mode: 'arcade', arenaId: 'compresseur' },
  win_classique: { mode: 'arcade', arenaId: 'classique' },
  win_labyrinthe: { mode: 'arcade', arenaId: 'labyrinthe' },
  win_duel: { mode: 'arcade', arenaId: 'duel' },
  win_chaos: { mode: 'arcade', arenaId: 'chaos' },
  vague_45: { mode: 'arcade', arenaId: 'vague' },
  champ_win: { mode: 'championship' },
};

export function getChallengeLaunchConfig(challengeId) {
  return CHALLENGE_LAUNCH[challengeId] ?? { mode: 'arcade', arenaId: 'classique' };
}
