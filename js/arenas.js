import { ARENA_FAMILY, PATTERN } from './constants.js';

export const ARENA_FAMILIES = {
  [ARENA_FAMILY.CLASSIC]: { name: 'CLASSIC', desc: 'Arènes ouvertes, affrontement pur.' },
  [ARENA_FAMILY.MAZE]: { name: 'MAZE', desc: 'Couloirs serrés et murs fixes.' },
  [ARENA_FAMILY.DYNAMIC]: { name: 'DYNAMIC', desc: 'Murs mobiles et portes.' },
  [ARENA_FAMILY.CHAOS]: { name: 'CHAOS', desc: 'Tout bouge en même temps.' },
  [ARENA_FAMILY.ARENA]: { name: 'ARENA', desc: 'Petites arènes agressives.' },
};

export const ARENA_DESC = {
  classique: 'Affrontement classique — dernier en vie gagne.',
  battement: 'Sliders horizontaux — esquive et timing.',
  compresseur: 'Les murs se rapprochent — survive.',
  piege: 'Portes qui s\'ouvrent et se ferment.',
  vague: 'Vague de murs — lis le rythme.',
  labyrinthe: 'Couloirs étroits — pas de place pour l\'erreur.',
  chaos: 'Sliders + portes — enfer animé.',
  duel: 'Mini arène — action immédiate.',
};

export const ARENAS = [
  { id: 'classique', name: 'Le Classique', family: ARENA_FAMILY.CLASSIC },
  { id: 'battement', name: 'Le Battement', family: ARENA_FAMILY.DYNAMIC },
  { id: 'piege', name: 'Le Piège', family: ARENA_FAMILY.DYNAMIC },
  { id: 'vague', name: 'La Vague', family: ARENA_FAMILY.CHAOS },
  { id: 'compresseur', name: 'Le Compresseur', family: ARENA_FAMILY.ARENA },
  { id: 'labyrinthe', name: 'Le Labyrinthe', family: ARENA_FAMILY.MAZE },
  { id: 'chaos', name: 'Le Chaos', family: ARENA_FAMILY.CHAOS },
  { id: 'duel', name: 'Le Duel', family: ARENA_FAMILY.ARENA },
];

export function getArenaById(id) {
  return ARENAS.find(a => a.id === id);
}

export function getArenasByFamily(familyId) {
  return ARENAS.filter(a => a.family === familyId);
}

export function pickArenaByFamily(familyId) {
  const list = getArenasByFamily(familyId);
  if (!list.length) return ARENAS[0];
  return list[Math.floor(Math.random() * list.length)];
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
  if (id.startsWith('family:')) return pickArenaByFamily(id.slice(7));
  return getArenaById(id) ?? ARENAS[0];
}
