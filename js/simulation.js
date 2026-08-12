import { Grid, gridDimensions } from './grid.js';
import { MovingWallSystem, createWallConfigs, getStaticWalls } from './moving-wall.js';
import { getRiderDefs } from './cosmetics.js';
import { chooseBotTurn } from './bots.js';
import {
  DX, DY, CAM_DIR_ANGLES, BIKE_DIR_ANGLES, trailVal, getTickInterval,
  ARENA_BORDER, CELL_WALL, KILL_BONUS, WIN_BONUS, NEAR_MISS_BONUS, MULTIPLIER_MAX, COMBO_DECAY_TICKS, isTrail,
  CHAMPIONSHIP_RIDERS,
} from './constants.js';

export class Simulation {
  constructor() {
    this.grid = null;
    this.walls = new MovingWallSystem();
    this.riders = [];
    this.score = 0;
    this.kills = 0;
    this.multiplier = 1;
    this.maxMultiplier = 1;
    this.nearMissCount = 0;
    this.simTick = 0;
    this.lastSimTime = 0;
    this.tickIntervalMs = 130;
    this.playing = false;
    this.turnQueue = null;
    this.gameStartTime = 0;
    this.arenaId = 'classique';
    this.mode = 'arcade';
    this.deadRiders = [];
    this.deathOrder = [];
    this.playerDied = false;
    this.playerWon = false;
    this.roundComplete = false;
    this.nearMissCooldown = 0;
    this.survivalBumpAt = 15;
    this.comboDecay = 0;
  }

  get gridW() { return this.grid?.w ?? 0; }
  get gridH() { return this.grid?.h ?? 0; }

  getPlayer() { return this.riders.find(r => r.isPlayer); }
  aliveRiders() { return this.riders.filter(r => r.alive); }
  aliveBots() { return this.riders.filter(r => !r.isPlayer && r.alive); }

  reset(arenaId, options = {}) {
    const { w, h } = gridDimensions();
    this.grid = new Grid(w, h);
    this.grid.buildPerimeter();
    for (const { x, y } of getStaticWalls(arenaId, w, h, ARENA_BORDER)) {
      if (!this.grid.isPerimeter(x, y)) this.grid.set(x, y, CELL_WALL);
    }
    this.arenaId = arenaId;
    this.mode = options.mode || 'arcade';
    this.walls.reset(createWallConfigs(arenaId, w, h, ARENA_BORDER), this.grid, w, h, ARENA_BORDER);
    const defs = options.riderDefs || getRiderDefs();
    this.riders = this._spawnRiders(w, h, defs, this.grid);
    this.score = 0;
    this.kills = 0;
    this.multiplier = 1;
    this.maxMultiplier = 1;
    this.nearMissCount = 0;
    this.simTick = 0;
    this.lastSimTime = 0;
    this.tickIntervalMs = getTickInterval(0);
    this.playing = true;
    this.turnQueue = null;
    this.gameStartTime = performance.now();
    this.deadRiders = [];
    this.deathOrder = [];
    this.playerDied = false;
    this.playerWon = false;
    this.roundComplete = false;
    this.nearMissCooldown = 0;
    this.survivalBumpAt = 15;
    this.comboDecay = 0;
  }

  _resetComboDecay() {
    this.comboDecay = COMBO_DECAY_TICKS;
  }

  _tickComboDecay(events) {
    const p = this.getPlayer();
    if (!p?.alive || this.multiplier <= 1) return;
    if (this.comboDecay > 0) {
      this.comboDecay--;
      return;
    }
    const prev = this.multiplier;
    this.multiplier = Math.max(1, this.multiplier - 1);
    if (this.multiplier < prev) {
      this._resetComboDecay();
      events.push({ type: 'comboDecay', value: this.multiplier });
    }
  }

  _spawnRiders(gridW, gridH, defs, grid) {
    const n = defs.length;
    const spawns = this._spawnPoints(gridW, gridH, n, this.arenaId)
      .map(s => this._resolveSpawn(grid, s));
    return defs.map((def, i) => {
      const s = spawns[i];
      return {
        id: i, key: def.key ?? ('r' + i), name: def.name, isPlayer: def.isPlayer, def,
        personality: def.personality, difficulty: def.difficulty,
        alive: true, x: s.x, y: s.y, dir: s.dir,
        prevX: s.x, prevY: s.y, renderX: s.x, renderY: s.y,
        smoothAngle: BIKE_DIR_ANGLES[s.dir],
      };
    });
  }

  _isValidSpawn(grid, { x, y, dir }) {
    if (!grid.inBounds(x, y) || grid.isBlocked(x, y)) return false;
    const nx = x + DX[dir], ny = y + DY[dir];
    if (!grid.inBounds(nx, ny) || grid.isBlocked(nx, ny)) return false;
    return true;
  }

  _resolveSpawn(grid, spawn) {
    if (this._isValidSpawn(grid, spawn)) return spawn;
    for (let r = 0; r < 24; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dir = 0; dir < 4; dir++) {
            const cand = { x: spawn.x + dx, y: spawn.y + dy, dir };
            if (this._isValidSpawn(grid, cand)) return cand;
          }
        }
      }
    }
    return spawn;
  }

  _spawnPoints(gridW, gridH, n, arenaId) {
    const b = ARENA_BORDER;
    const cx = Math.floor(gridW / 2);
    if (arenaId === 'labyrinthe') {
      const bottomY = gridH - b - 9;
      const topY = b + 7;
      if (n >= CHAMPIONSHIP_RIDERS) {
        return [
          { x: cx, y: bottomY, dir: 0 },
          { x: cx - 12, y: topY, dir: 2 },
          { x: cx + 12, y: topY, dir: 2 },
          { x: cx - 20, y: bottomY, dir: 0 },
          { x: cx + 20, y: bottomY, dir: 0 },
          { x: cx, y: topY, dir: 2 },
        ];
      }
      return [
        { x: cx, y: bottomY, dir: 0 },
        { x: cx - 12, y: topY, dir: 2 },
        { x: cx + 12, y: topY, dir: 2 },
      ];
    }
    if (n >= CHAMPIONSHIP_RIDERS) {
      return [
        { x: Math.floor(gridW / 2), y: gridH - b - 6, dir: 0 },
        { x: Math.floor(gridW / 4), y: b + 6, dir: 2 },
        { x: Math.floor(3 * gridW / 4), y: b + 6, dir: 2 },
        { x: b + 6, y: Math.floor(gridH / 2), dir: 1 },
        { x: gridW - b - 7, y: Math.floor(gridH / 2), dir: 3 },
        { x: Math.floor(gridW / 2), y: b + 6, dir: 2 },
      ];
    }
    return [
      { x: Math.floor(gridW / 2), y: gridH - b - 6, dir: 0 },
      { x: Math.floor(gridW / 4), y: b + 6, dir: 2 },
      { x: Math.floor(3 * gridW / 4), y: b + 6, dir: 2 },
    ];
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
    this._checkRiskRewards(events, now);
    this._tickComboDecay(events);
    this.simTick++;
    this.tickIntervalMs = getTickInterval(this.score);

    if (this.mode === 'championship') {
      if (this.aliveRiders().length <= 1 && !this.roundComplete) {
        this.roundComplete = true;
        this.playing = false;
        events.push({ type: 'roundEnd', rankings: this.getRoundRankings() });
      }
    } else {
      if (this.playerDied) events.push({ type: 'death' });
      else if (this.playerWon) events.push({ type: 'victory' });
    }

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
        newDir = chooseBotTurn(this, r, moves);
      }
      moves.push({ rider: r, newDir, oldDir: r.dir, nx: r.x + DX[newDir], ny: r.y + DY[newDir] });
    }

    const targets = new Map();
    for (const m of moves) {
      const key = m.nx + ',' + m.ny;
      if (!targets.has(key)) targets.set(key, []);
      targets.get(key).push(m.rider);
    }

    const dead = new Set();
    for (const m of moves) {
      if (this._willBeBlocked(m.nx, m.ny, m.rider)) dead.add(m.rider);
      else if ((targets.get(m.nx + ',' + m.ny) || []).length > 1) dead.add(m.rider);
    }

    for (const m of moves) {
      if (dead.has(m.rider)) {
        m.rider.alive = false;
        this.deadRiders.push(m.rider);
        this.deathOrder.push({ key: m.rider.key, name: m.rider.name, isPlayer: m.rider.isPlayer });
        if (m.rider.isPlayer) {
          this.playerDied = true;
          this.multiplier = 1;
          if (this.mode !== 'championship') this.playing = false;
        } else if (this.getPlayer()?.alive) {
          this.kills++;
          const pts = KILL_BONUS * this.multiplier;
          this.score += pts;
          this._bumpMultiplier(events, 'kill');
          events.push({ type: 'kill', points: pts, multiplier: this.multiplier });
        }
        continue;
      }
      m.rider.prevX = m.rider.x;
      m.rider.prevY = m.rider.y;
      m.rider.dir = m.newDir;
    }

    for (const m of moves) {
      if (dead.has(m.rider)) continue;
      this.grid.setTrail(
        m.nx - DX[m.newDir], m.ny - DY[m.newDir],
        trailVal(m.rider.id), m.newDir, m.oldDir,
      );
      m.rider.x = m.nx;
      m.rider.y = m.ny;
      if (m.rider.isPlayer) {
        const pts = this.multiplier;
        this.score += pts;
        events.push({ type: 'scoreTick', points: pts, multiplier: this.multiplier });
      }
    }

    if (this.mode !== 'championship' && !this.playerDied && this.getPlayer()?.alive && this.aliveBots().length === 0) {
      this.playerWon = true;
      this.playing = false;
      this.score += WIN_BONUS * this.multiplier;
    }
  }

  _bumpMultiplier(events, reason) {
    const prev = this.multiplier;
    this.multiplier = Math.min(MULTIPLIER_MAX, this.multiplier + 1);
    if (this.multiplier > this.maxMultiplier) this.maxMultiplier = this.multiplier;
    this._resetComboDecay();
    if (this.multiplier > prev) events.push({ type: 'multiplierUp', value: this.multiplier, reason });
  }

  _checkRiskRewards(events, now) {
    const p = this.getPlayer();
    if (!p?.alive) return;

    const elapsed = this.getElapsedSeconds(now);
    if (elapsed >= this.survivalBumpAt) {
      this.survivalBumpAt += 15;
      this._bumpMultiplier(events, 'survival');
    }

    if (this.nearMissCooldown > 0) {
      this.nearMissCooldown--;
      return;
    }

    if (this._adjacentBlocked(p)) {
      this.nearMissCooldown = 10;
      this.nearMissCount++;
      const mult = this.multiplier;
      const pts = NEAR_MISS_BONUS * mult;
      this.score += pts;
      this._bumpMultiplier(events, 'nearMiss');
      events.push({ type: 'nearMiss', points: pts, multiplier: mult, combo: this.multiplier });
    } else if (this.walls.isPlayerNearMobile(p, this.gridW, this.gridH)) {
      this.nearMissCooldown = 14;
      this.nearMissCount++;
      const mult = this.multiplier;
      const pts = Math.floor(NEAR_MISS_BONUS * 0.5) * mult;
      this.score += pts;
      this._bumpMultiplier(events, 'wallNear');
      events.push({ type: 'wallNear', points: pts, multiplier: mult, combo: this.multiplier });
    }
  }

  _adjacentBlocked(rider) {
    const ownTrail = trailVal(rider.id);
    for (let d = 0; d < 4; d++) {
      const cell = this.grid.get(rider.x + DX[d], rider.y + DY[d]);
      if (cell === CELL_WALL) return true;
      if (isTrail(cell) && cell !== ownTrail) return true;
    }
    for (const r of this.riders) {
      if (!r.alive || r === rider) continue;
      if (Math.abs(r.x - rider.x) + Math.abs(r.y - rider.y) === 1) return true;
    }
    return false;
  }

  _willBeBlocked(x, y, rider) {
    if (this.grid.isBlocked(x, y)) return true;
    for (const r of this.riders) {
      if (!r.alive || r === rider) continue;
      if (r.x === x && r.y === y) return true;
    }
    return false;
  }

  getRoundRankings() {
    const rankings = [];
    for (const r of this.aliveRiders()) {
      rankings.push({ key: r.key, name: r.name, isPlayer: r.isPlayer });
    }
    for (let i = this.deathOrder.length - 1; i >= 0; i--) {
      const d = this.deathOrder[i];
      if (!rankings.some(x => x.key === d.key)) rankings.push(d);
    }
    return rankings;
  }

  getIntensity() {
    return Math.min(1, (this.multiplier - 1) / (MULTIPLIER_MAX - 1));
  }

  checkNearMiss() {
    return false;
  }

  getElapsedSeconds(now) {
    return (now - this.gameStartTime) / 1000;
  }

  getRenderT(now) {
    if (!this.playing || !this.lastSimTime) return 1;
    let t = Math.min(1, (now - this.lastSimTime) / this.tickIntervalMs);
    return t * t * (3 - 2 * t);
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
