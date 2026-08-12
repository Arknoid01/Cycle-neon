import { CHAMPIONSHIP_ROUNDS, CHAMP_POINTS } from './constants.js';
import { CHAMPIONSHIP_BOTS } from './bots.js';
import { getChassisPreset, getActiveSkin, getRiderColorDef, pickRandomBaseSkins } from './cosmetics.js';
import { pickArenaByFamily, ARENA_FAMILIES } from './arenas.js';

export class Championship {
  constructor() {
    this.active = false;
    this.round = 0;
    this.totalRounds = CHAMPIONSHIP_ROUNDS;
    this.standings = [];
    this.lastRoundResults = null;
    this.familyRotation = ['classic', 'dynamic', 'maze', 'chaos', 'arena'];
  }

  start() {
    this.active = true;
    this.round = 0;
    this.standings = [
      { key: 'player', name: 'Toi', isPlayer: true, points: 0 },
      ...CHAMPIONSHIP_BOTS.map(b => ({
        key: b.id, name: b.name, isPlayer: false, points: 0, personality: b.personality,
      })),
    ];
    this.lastRoundResults = null;
  }

  getRiderDefs() {
    const playerSkin = getActiveSkin();
    const botSkins = pickRandomBaseSkins(CHAMPIONSHIP_BOTS.length);
    return [
      {
        key: 'player', name: 'Toi', isPlayer: true,
        ...getRiderColorDef(playerSkin),
        skinId: playerSkin.id,
        skin: playerSkin,
        chassisId: playerSkin.chassisId,
        chassis: getChassisPreset(playerSkin.chassisId),
      },
      ...CHAMPIONSHIP_BOTS.map((b, i) => {
        const skinDef = botSkins[i];
        return {
          key: b.id, name: b.name, isPlayer: false,
          ...getRiderColorDef(skinDef),
          personality: b.personality, difficulty: b.difficulty,
          skinId: skinDef.id,
          skin: skinDef,
          chassisId: skinDef.chassisId,
          chassis: getChassisPreset(skinDef.chassisId),
        };
      }),
    ];
  }

  nextArena() {
    const familyId = this.familyRotation[(this.round) % this.familyRotation.length];
    return pickArenaByFamily(familyId);
  }

  finishRound(rankings) {
    this.round++;
    const results = rankings.map((r, i) => {
      const pts = CHAMP_POINTS[i] ?? 1;
      const row = this.standings.find(s => s.key === r.key);
      if (row) row.points += pts;
      return { ...r, place: i + 1, pointsEarned: pts };
    });
    this.lastRoundResults = results;
    return results;
  }

  isComplete() {
    return this.round >= this.totalRounds;
  }

  getSortedStandings() {
    return [...this.standings].sort((a, b) => b.points - a.points);
  }

  getWinner() {
    return this.getSortedStandings()[0];
  }
}

export function loadChampBest() {
  try { return parseInt(localStorage.getItem('lc_champ_best') || '0', 10); } catch { return 0; }
}

export function saveChampBest(v) {
  try { localStorage.setItem('lc_champ_best', String(v)); } catch {}
}

export function familyLabel(familyId) {
  return ARENA_FAMILIES[familyId]?.name ?? familyId;
}
