export const ARENA_DESC = {
  battement: 'Des murs oscillent — évite les adversaires.',
  compresseur: 'L\'arène se resserre — survive aux autres cycles.',
  piege: 'Des portes piègent — et les Spectres aussi.',
  classique: 'Affrontement classique — dernier en vie gagne.',
};

export const ARENAS = [
  { id: 'battement', name: 'Le Battement' },
  { id: 'compresseur', name: 'Le Compresseur' },
  { id: 'piege', name: 'Le Piège' },
  { id: 'classique', name: 'Le Classique' },
];

export function getArenaById(id) {
  return ARENAS.find(a => a.id === id);
}

export function loadArenaPref() {
  try { return localStorage.getItem('lc_arena_pref') || 'random'; } catch { return 'random'; }
}

export function saveArenaPref(id) {
  try { localStorage.setItem('lc_arena_pref', id); } catch {}
}

export function loadArenaBest(id) {
  try { return parseInt(localStorage.getItem('lc_best_' + id) || '0', 10); } catch { return 0; }
}

export function saveArenaBest(id, v) {
  try { localStorage.setItem('lc_best_' + id, String(v)); } catch {}
}

export function loadHighScore() {
  try { return parseInt(localStorage.getItem('lc_highscore') || '0', 10); } catch { return 0; }
}

export function saveHighScore(v) {
  try { localStorage.setItem('lc_highscore', String(v)); } catch {}
}

export function pickArena(id) {
  if (id === 'random') return ARENAS[Math.floor(Math.random() * ARENAS.length)];
  return getArenaById(id);
}
