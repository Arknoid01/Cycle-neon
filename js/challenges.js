export const CHALLENGES = [
  { id: 'eliminate_all', name: 'Chasseur', desc: 'Élimine les 2 adversaires',
    check: s => s.won && s.kills >= 2 },
  { id: 'survive_30', name: 'Endurant', desc: 'Survis 30 secondes',
    check: s => s.time >= 30 },
  { id: 'compresseur_30', name: 'Compressé', desc: '30 s dans Le Compresseur',
    check: s => s.arenaId === 'compresseur' && s.time >= 30 },
  { id: 'win_classique', name: 'Duel', desc: 'Gagne dans Le Classique',
    check: s => s.won && s.arenaId === 'classique' },
  { id: 'score_100', name: 'Centurion', desc: 'Atteins 100 points',
    check: s => s.score >= 100 },
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
