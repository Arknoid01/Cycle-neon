import { DX, DY } from './constants.js';

export const PERSONALITY = {
  PRUDENT: 'prudent',
  CHASSEUR: 'chasseur',
  RAPIDE: 'rapide',
  IMPREVISIBLE: 'imprevisible',
};

export const DIFFICULTY = { EASY: 1, NORMAL: 2, HARD: 3 };

export const CHAMPIONSHIP_BOTS = [
  {
    id: 'sage', name: 'Sage', personality: PERSONALITY.PRUDENT, difficulty: DIFFICULTY.NORMAL,
    body: 0x44aa66, glow: 0x22cc55, wheel: 0x55aa77, trail: 0x336644, trailGlow: 0x22aa55,
  },
  {
    id: 'reaper', name: 'Faucheur', personality: PERSONALITY.CHASSEUR, difficulty: DIFFICULTY.HARD,
    body: 0xcc5555, glow: 0xcc1111, wheel: 0xcc3333, trail: 0x883333, trailGlow: 0xcc0033,
  },
  {
    id: 'bolt', name: 'Éclair', personality: PERSONALITY.RAPIDE, difficulty: DIFFICULTY.HARD,
    body: 0xcc9944, glow: 0xcc8800, wheel: 0xccaa33, trail: 0x886622, trailGlow: 0xcc6600,
  },
  {
    id: 'myst', name: 'Mystère', personality: PERSONALITY.IMPREVISIBLE, difficulty: DIFFICULTY.NORMAL,
    body: 0x9966cc, glow: 0x7733cc, wheel: 0x8855cc, trail: 0x553366, trailGlow: 0x6600cc,
  },
  {
    id: 'ghost', name: 'Spectre', personality: PERSONALITY.CHASSEUR, difficulty: DIFFICULTY.EASY,
    body: 0xcc6699, glow: 0xcc3388, wheel: 0xcc5599, trail: 0x884466, trailGlow: 0xcc0066,
  },
];

function diffParams(d) {
  return {
    look: d === 3 ? 10 : d === 2 ? 7 : 5,
    panicLook: d === 3 ? 4 : d === 2 ? 3 : 2,
    randomTurn: d === 3 ? 0.008 : d === 2 ? 0.018 : 0.03,
  };
}

function canGo(sim, rider, dir) {
  const nx = rider.x + DX[dir], ny = rider.y + DY[dir];
  return !sim._willBeBlocked(nx, ny, rider);
}

function spaceInDir(sim, rider, dir, maxLook) {
  let x = rider.x, y = rider.y, n = 0;
  for (let i = 0; i < maxLook; i++) {
    x += DX[dir]; y += DY[dir];
    if (sim.grid.isBlocked(x, y)) return n;
    n++;
  }
  return n;
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

function prudentTurn(sim, rider, moves, p) {
  const fwd = rider.dir, left = (fwd + 3) % 4, right = (fwd + 1) % 4;
  if (!canGo(sim, rider, fwd)) {
    const opts = [left, right].filter(d => canGo(sim, rider, d));
    if (opts.length === 0) return fwd;
    return pickBestDir(sim, rider, opts, d => spaceInDir(sim, rider, d, p.look));
  }
  for (let look = 1; look <= p.panicLook; look++) {
    const tx = rider.x + DX[fwd] * look, ty = rider.y + DY[fwd] * look;
    if (sim.grid.isBlocked(tx, ty)) {
      const opts = [left, right].filter(d => canGo(sim, rider, d));
      if (opts.length === 0) return fwd;
      return pickBestDir(sim, rider, opts, d => spaceInDir(sim, rider, d, p.look));
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
    return pickBestDir(sim, rider, dirs, d =>
      cutOffScore(sim, rider, d, player) * 2 + spaceInDir(sim, rider, d, p.look)
    );
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
