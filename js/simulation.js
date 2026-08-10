import { Grid, gridDimensions } from './grid.js';
import { MovingWallSystem, createWallConfigs } from './moving-wall.js';
import { getRiderDefs } from './cosmetics.js';
import {
  DX, DY, CAM_DIR_ANGLES, trailVal, getTickInterval,
  ARENA_BORDER, KILL_BONUS, WIN_BONUS,
} from './constants.js';

export class Simulation {
  constructor() {
    this.grid = null;
    this.walls = new MovingWallSystem();
    this.riders = [];
    this.score = 0;
    this.kills = 0;
    this.simTick = 0;
    this.lastSimTime = 0;
    this.tickIntervalMs = 130;
    this.playing = false;
    this.turnQueue = null;
    this.gameStartTime = 0;
    this.arenaId = 'classique';
    this.deadRiders = [];
    this.playerDied = false;
    this.playerWon = false;
  }

  get gridW() { return this.grid?.w ?? 0; }
  get gridH() { return this.grid?.h ?? 0; }

  getPlayer() { return this.riders.find(r => r.isPlayer); }
  aliveBots() { return this.riders.filter(r => !r.isPlayer && r.alive); }

  reset(arenaId) {
    const { w, h } = gridDimensions();
    this.grid = new Grid(w, h);
    this.grid.buildPerimeter();
    this.arenaId = arenaId;
    this.walls.reset(createWallConfigs(arenaId, w, h, ARENA_BORDER), this.grid, w, h, ARENA_BORDER);
    this.riders = this._spawnRiders(w, h);
    this.score = 0;
    this.kills = 0;
    this.simTick = 0;
    this.lastSimTime = 0;
    this.tickIntervalMs = getTickInterval(0);
    this.playing = true;
    this.turnQueue = null;
    this.gameStartTime = performance.now();
    this.deadRiders = [];
    this.playerDied = false;
    this.playerWon = false;
  }

  _spawnRiders(gridW, gridH) {
    const defs = getRiderDefs();
    const spawns = [
      { x: Math.floor(gridW / 2), y: gridH - ARENA_BORDER - 6, dir: 0 },
      { x: Math.floor(gridW / 4), y: ARENA_BORDER + 6, dir: 2 },
      { x: Math.floor(3 * gridW / 4), y: ARENA_BORDER + 6, dir: 2 },
    ];
    return defs.map((def, i) => {
      const s = spawns[i];
      return {
        id: i, name: def.name, isPlayer: def.isPlayer, def, alive: true,
        x: s.x, y: s.y, dir: s.dir,
        prevX: s.x, prevY: s.y, renderX: s.x, renderY: s.y,
        smoothAngle: CAM_DIR_ANGLES[s.dir],
      };
    });
  }

  setTurn(dir) {
    if (!this.playing) return;
    const p = this.getPlayer();
    if (!p?.alive) return;
    if (dir !== (p.dir + 2) % 4) this.turnQueue = dir;
  }

  simulationTick(now) {
    if (!this.playing) return { events: [] };
    const events = [];

    const wallFx = this.walls.simulationTick(this.grid, now, this.gridW, this.gridH, ARENA_BORDER);
    if (wallFx.moved) events.push({ type: 'wallMove' });
    if (wallFx.pulseSound) events.push({ type: 'wallWarn' });

    this._tickRiders(events);
    this.simTick++;
    this.tickIntervalMs = getTickInterval(this.score);

    if (this.playerDied) events.push({ type: 'death' });
    else if (this.playerWon) events.push({ type: 'victory' });

    return { events };
  }

  _tickRiders(events) {
    const moves = [];
    for (const r of this.riders) {
      if (!r.alive) continue;
      let newDir = r.dir;
      if (r.isPlayer && this.turnQueue !== null) {
        newDir = this.turnQueue;
        this.turnQueue = null;
        events.push({ type: 'turn' });
      } else if (!r.isPlayer) {
        newDir = this._chooseAiTurn(r, moves);
      }
      moves.push({ rider: r, newDir, nx: r.x + DX[newDir], ny: r.y + DY[newDir] });
    }

    const targets = new Map();
    for (const m of moves) {
      const key = m.nx + ',' + m.ny;
      if (!targets.has(key)) targets.set(key, []);
      targets.get(key).push(m.rider);
    }

    const dead = new Set();
    for (const m of moves) {
      if (this._isMoveBlocked(m.nx, m.ny, m.rider, moves)) dead.add(m.rider);
      else if ((targets.get(m.nx + ',' + m.ny) || []).length > 1) dead.add(m.rider);
    }

    for (const m of moves) {
      if (dead.has(m.rider)) {
        m.rider.alive = false;
        this.deadRiders.push(m.rider);
        if (m.rider.isPlayer) {
          this.playerDied = true;
          this.playing = false;
        } else if (this.getPlayer()?.alive) {
          this.kills++;
          this.score += KILL_BONUS;
          events.push({ type: 'kill' });
        }
        continue;
      }
      m.rider.prevX = m.rider.x;
      m.rider.prevY = m.rider.y;
      m.rider.dir = m.newDir;
      this.grid.set(m.rider.x, m.rider.y, trailVal(m.rider.id));
      m.rider.x = m.nx;
      m.rider.y = m.ny;
      if (m.rider.isPlayer) events.push({ type: 'scoreTick' });
    }

    if (!this.playerDied && this.getPlayer()?.alive && this.aliveBots().length === 0) {
      this.playerWon = true;
      this.playing = false;
      this.score += WIN_BONUS;
    }
  }

  _isMoveBlocked(x, y, rider, moves) {
    if (this.grid.isBlocked(x, y)) return true;
    for (const r of this.riders) {
      if (!r.alive || r === rider) continue;
      if (r.x !== x || r.y !== y) continue;
      const mv = moves.find(m => m.rider === r);
      if (mv && (mv.nx !== r.x || mv.ny !== r.y)) continue;
      return true;
    }
    return false;
  }

  _chooseAiTurn(rider, moves) {
    const fwd = rider.dir;
    const left = (rider.dir + 3) % 4;
    const right = (rider.dir + 1) % 4;

    const canGo = (dir) => {
      const nx = rider.x + DX[dir], ny = rider.y + DY[dir];
      return !this._isMoveBlocked(nx, ny, rider, moves);
    };

    const spaceInDir = (dir, maxLook = 8) => {
      let x = rider.x, y = rider.y, n = 0;
      for (let i = 0; i < maxLook; i++) {
        x += DX[dir]; y += DY[dir];
        if (this.grid.isBlocked(x, y)) return n;
        n++;
      }
      return n;
    };

    if (!canGo(fwd)) {
      const lOk = canGo(left), rOk = canGo(right);
      if (lOk && rOk) return spaceInDir(left) >= spaceInDir(right) ? left : right;
      if (lOk) return left;
      if (rOk) return right;
      return fwd;
    }
    for (let look = 1; look <= 3; look++) {
      const tx = rider.x + DX[fwd] * look, ty = rider.y + DY[fwd] * look;
      if (this.grid.isBlocked(tx, ty)) {
        const lOk = canGo(left), rOk = canGo(right);
        if (lOk && rOk) {
          if (Math.random() < 0.12) return Math.random() < 0.5 ? left : right;
          return spaceInDir(left) >= spaceInDir(right) ? left : right;
        }
        if (lOk) return left;
        if (rOk) return right;
        break;
      }
    }
    if (Math.random() < 0.018 && canGo(left)) return left;
    if (Math.random() < 0.018 && canGo(right)) return right;
    return fwd;
  }

  checkNearMiss() {
    const p = this.getPlayer();
    if (!p?.alive) return false;
    for (let d = 0; d < 4; d++) {
      if (this.grid.isBlocked(p.x + DX[d], p.y + DY[d])) return true;
    }
    return false;
  }

  getElapsedSeconds(now) {
    return (now - this.gameStartTime) / 1000;
  }

  updateRenderPositions(now) {
    for (const r of this.riders) {
      if (!r.alive) continue;
      if (!this.playing || !this.lastSimTime) {
        r.renderX = r.x;
        r.renderY = r.y;
        continue;
      }
      let t = Math.min(1, (now - this.lastSimTime) / this.tickIntervalMs);
      t = t * t * (3 - 2 * t);
      r.renderX = r.prevX + (r.x - r.prevX) * t;
      r.renderY = r.prevY + (r.y - r.prevY) * t;
    }
  }

  shouldSimTick(now, introUntil) {
    if (!this.playing || now < introUntil) return false;
    if (!this.lastSimTime) { this.lastSimTime = now; return true; }
    if (now - this.lastSimTime >= this.tickIntervalMs) {
      this.lastSimTime = now;
      return true;
    }
    return false;
  }
}

export function snapshotGrid(grid) {
  return new Uint8Array(grid.cells);
}
