import { DX, DY } from './constants.js';

export const PERSONALITY = {
  PRUDENT: 'prudent',
  CHASSEUR: 'chasseur',
  RAPIDE: 'rapide',
  IMPREVISIBLE: 'imprevisible',
};

export const DIFFICULTY = { EASY: 1, NORMAL: 2, HARD: 3 };

/**
 * Roster de rivaux nommés — partagé entre le mode Championnat (les 5 s'y
 * affrontent) et le mode Arcade (2 tirés au sort à chaque partie, voir
 * getRiderDefs() dans cosmetics.js). skinId fixe l'apparence GLB associée
 * à chaque personnalité.
 */
export const CHAMPIONSHIP_BOTS = [
  {
    id: 'sage', name: 'Sage', personality: PERSONALITY.PRUDENT, difficulty: DIFFICULTY.NORMAL,
    skinId: 'vanguard',
    body: 0x44aa66, glow: 0x22cc55, wheel: 0x55aa77, trail: 0x336644, trailGlow: 0x22aa55,
  },
  {
    id: 'reaper', name: 'Faucheur', personality: PERSONALITY.CHASSEUR, difficulty: DIFFICULTY.HARD,
    skinId: 'inferno',
    body: 0xcc5555, glow: 0xcc1111, wheel: 0xcc3333, trail: 0x883333, trailGlow: 0xcc0033,
  },
  {
    id: 'bolt', name: 'Éclair', personality: PERSONALITY.RAPIDE, difficulty: DIFFICULTY.HARD,
    skinId: 'pulse',
    body: 0xcc9944, glow: 0xcc8800, wheel: 0xccaa33, trail: 0x886622, trailGlow: 0xcc6600,
  },
  {
    id: 'myst', name: 'Mystère', personality: PERSONALITY.IMPREVISIBLE, difficulty: DIFFICULTY.NORMAL,
    skinId: 'phantom',
    body: 0x9966cc, glow: 0x7733cc, wheel: 0x8855cc, trail: 0x553366, trailGlow: 0x6600cc,
  },
  {
    id: 'ghost', name: 'Spectre', personality: PERSONALITY.CHASSEUR, difficulty: DIFFICULTY.EASY,
    skinId: 'specter',
    body: 0xcc6699, glow: 0xcc3388, wheel: 0xcc5599, trail: 0x884466, trailGlow: 0xcc0066,
  },
];

function diffParams(d) {
  return {
    look: d === 3 ? 10 : d === 2 ? 7 : 5,
    panicLook: d === 3 ? 4 : d === 2 ? 3 : 2,
    randomTurn: d === 3 ? 0.008 : d === 2 ? 0.018 : 0.03,
    // Budget de remplissage (flood-fill) : combien de cases un bot explore
    // pour juger si une direction mène à une vraie zone ouverte ou à un
    // cul-de-sac. Plus le budget est grand, plus le bot voit loin.
    floodBudget: d === 3 ? 160 : d === 2 ? 100 : 55,
  };
}

function canGo(sim, rider, dir) {
  const nx = rider.x + DX[dir], ny = rider.y + DY[dir];
  return !sim._willBeBlocked(nx, ny, rider);
}

/**
 * Compte les cases atteignables depuis (startX, startY) par remplissage en
 * largeur (BFS), plafonné à `budget` cases. Contrairement à un simple
 * regard en ligne droite, ça détecte les culs-de-sac : une case peut
 * "avoir l'air" ouverte à 5 pas mais mener à une poche fermée de 8 cases —
 * le flood-fill le voit, un regard en ligne droite non.
 * Les autres coureurs vivants comptent comme obstacles temporaires (on ne
 * fonce pas dans une case qu'un adversaire occupe déjà).
 */
function floodFillSpace(sim, startX, startY, selfRider, budget) {
  if (sim.grid.isBlocked(startX, startY)) return 0;
  const w = sim.gridW;
  const startIdx = startY * w + startX;
  const seen = new Set([startIdx]);
  const blocked = new Set();
  for (const r of sim.riders) {
    if (r.alive && r !== selfRider) blocked.add(r.y * w + r.x);
  }

  const queue = [startX, startY];
  let qHead = 0;
  let count = 0;
  while (qHead < queue.length && count < budget) {
    const x = queue[qHead++], y = queue[qHead++];
    count++;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || nx >= w || ny < 0 || ny >= sim.gridH) continue;
      const idx = ny * w + nx;
      if (seen.has(idx)) continue;
      seen.add(idx);
      if (blocked.has(idx) || sim.grid.isBlocked(nx, ny)) continue;
      queue.push(nx, ny);
    }
  }
  return count;
}

function pickBestDir(sim, rider, dirs, scoreFn) {
  let best = dirs[0], bestScore = -Infinity;
  for (const d of dirs) {
    if (!canGo(sim, rider, d)) continue;
    const s = scoreFn(d);
    if (s > bestScore) { bestScore = s; best = d; }
  }
  return best;
}

function cutOffScore(sim, rider, dir, target) {
  if (!target?.alive) return 0;
  const nx = rider.x + DX[dir], ny = rider.y + DY[dir];
  const tx = target.x + DX[target.dir], ty = target.y + DY[target.dir];
  const dist = Math.abs(nx - tx) + Math.abs(ny - ty);
  return Math.max(0, 14 - dist);
}

function bestEscapeDir(sim, rider, opts, p) {
  return pickBestDir(sim, rider, opts, d =>
    floodFillSpace(sim, rider.x + DX[d], rider.y + DY[d], rider, p.floodBudget)
  );
}

function prudentTurn(sim, rider, moves, p) {
  const fwd = rider.dir, left = (fwd + 3) % 4, right = (fwd + 1) % 4;
  if (!canGo(sim, rider, fwd)) {
    const opts = [left, right].filter(d => canGo(sim, rider, d));
    if (opts.length === 0) return fwd;
    return bestEscapeDir(sim, rider, opts, p);
  }
  for (let look = 1; look <= p.panicLook; look++) {
    const tx = rider.x + DX[fwd] * look, ty = rider.y + DY[fwd] * look;
    if (sim.grid.isBlocked(tx, ty)) {
      const opts = [left, right].filter(d => canGo(sim, rider, d));
      if (opts.length === 0) return fwd;
      return bestEscapeDir(sim, rider, opts, p);
    }
  }
  // La route est libre à vue — mais si elle mène en réalité à une poche
  // fermée (couloir de labyrinthe par ex.), mieux vaut bifurquer maintenant
  // que d'être coincé plus tard sans échappatoire.
  const aheadSpace = floodFillSpace(sim, rider.x + DX[fwd], rider.y + DY[fwd], rider, p.floodBudget);
  if (aheadSpace < p.floodBudget * 0.35) {
    const opts = [left, right].filter(d => canGo(sim, rider, d));
    if (opts.length) {
      const alt = bestEscapeDir(sim, rider, opts, p);
      const altSpace = floodFillSpace(sim, rider.x + DX[alt], rider.y + DY[alt], rider, p.floodBudget);
      if (altSpace > aheadSpace * 1.3) return alt;
    }
  }
  return fwd;
}

function chasseurTurn(sim, rider, moves, p) {
  const player = sim.getPlayer();
  const fwd = rider.dir, left = (fwd + 3) % 4, right = (fwd + 1) % 4;
  const dirs = [fwd, left, right].filter(d => canGo(sim, rider, d));
  if (dirs.length === 0) return fwd;
  if (player?.alive) {
    return pickBestDir(sim, rider, dirs, d => {
      const nx = rider.x + DX[d], ny = rider.y + DY[d];
      // Chasse la cible, mais jamais au prix de se coincer soi-même : un
      // prédateur qui fonce dans une impasse pour gagner un pas perd la
      // course. floodFillSpace évite ce piège.
      return cutOffScore(sim, rider, d, player) * 2.2
        + Math.min(floodFillSpace(sim, nx, ny, rider, p.floodBudget), 25) * 0.4;
    });
  }
  return prudentTurn(sim, rider, moves, p);
}

function rapideTurn(sim, rider, moves, p) {
  const fwd = rider.dir, left = (fwd + 3) % 4, right = (fwd + 1) % 4;
  if (!canGo(sim, rider, fwd)) {
    const opts = [left, right].filter(d => canGo(sim, rider, d));
    if (opts.length === 0) return fwd;
    return opts[Math.floor(Math.random() * opts.length)];
  }
  for (let look = 1; look <= 2; look++) {
    if (sim.grid.isBlocked(rider.x + DX[fwd] * look, rider.y + DY[fwd] * look)) {
      const opts = [left, right].filter(d => canGo(sim, rider, d));
      if (opts.length) return opts[Math.floor(Math.random() * opts.length)];
      break;
    }
  }
  if (Math.random() < p.randomTurn * 2 && canGo(sim, rider, left)) return left;
  if (Math.random() < p.randomTurn * 2 && canGo(sim, rider, right)) return right;
  return fwd;
}

function imprevisibleTurn(sim, rider, moves, p) {
  const mode = (sim.simTick + rider.id * 17) % 40;
  if (mode < 12) return prudentTurn(sim, rider, moves, p);
  if (mode < 24) return chasseurTurn(sim, rider, moves, p);
  if (mode < 32) return rapideTurn(sim, rider, moves, p);
  const fwd = rider.dir;
  const opts = [fwd, (fwd + 3) % 4, (fwd + 1) % 4].filter(d => canGo(sim, rider, d));
  return opts[Math.floor(Math.random() * opts.length)] || fwd;
}

export function chooseBotTurn(sim, rider, moves) {
  const p = diffParams(rider.difficulty ?? DIFFICULTY.NORMAL);
  switch (rider.personality) {
    case PERSONALITY.CHASSEUR: return chasseurTurn(sim, rider, moves, p);
    case PERSONALITY.RAPIDE: return rapideTurn(sim, rider, moves, p);
    case PERSONALITY.IMPREVISIBLE: return imprevisibleTurn(sim, rider, moves, p);
    default: return prudentTurn(sim, rider, moves, p);
  }
}
