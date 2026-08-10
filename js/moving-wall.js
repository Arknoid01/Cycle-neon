import {
  CELL_WALL, CELL_EMPTY, PATTERN,
  WARNING_DIM_MS, WARNING_PULSE_MS, WARNING_IMMINENT_MS,
} from './constants.js';

export class MovingWall {
  constructor(cfg) {
    this.id = cfg.id;
    this.pattern = cfg.pattern;
    this.x = cfg.x;
    this.y = cfg.y;
    this.axis = cfg.axis || 'x';
    this.range = cfg.range;
    this.interval = cfg.interval ?? 4000;
    this.speed = cfg.speed ?? 1;
    this.direction = cfg.direction ?? 1;
    this.open = cfg.open ?? true;
    this.yMin = cfg.yMin;
    this.yMax = cfg.yMax;
    this.waveIndex = cfg.waveIndex ?? 0;
    this.margin = 0;
    this.lastMove = 0;
    this.warningLevel = 0;
    this._occupied = [];
  }

  msUntilMove(now) {
    return Math.max(0, this.interval - (now - this.lastMove));
  }

  updateWarning(now) {
    const left = this.msUntilMove(now);
    if (left > WARNING_DIM_MS) { this.warningLevel = 0; return; }
    if (left > WARNING_PULSE_MS) { this.warningLevel = 1; return; }
    if (left > WARNING_IMMINENT_MS) { this.warningLevel = 2; return; }
    this.warningLevel = 3;
  }

  clearOccupied(grid) {
    for (const { x, y } of this._occupied) {
      if (grid.get(x, y) === CELL_WALL && !grid.isPerimeter(x, y)) {
        grid.set(x, y, CELL_EMPTY);
      }
    }
    this._occupied = [];
  }

  writeOccupied(grid) {
    for (const { x, y } of this._occupied) {
      if (!grid.isPerimeter(x, y)) grid.set(x, y, CELL_WALL);
    }
  }

  syncOccupied(grid) {
    this.clearOccupied(grid);
    this._occupied = this.computeCells();
    this.writeOccupied(grid);
  }

  computeCells() {
    if (this.pattern === PATTERN.GATE) {
      const cells = [];
      for (let y = this.yMin; y <= this.yMax; y++) {
        if (!this.open) cells.push({ x: this.x, y });
      }
      return cells;
    }
    if (this.pattern === PATTERN.PINGPONG || this.pattern === PATTERN.WAVE) {
      return [{ x: this.x, y: this.y }];
    }
    return [];
  }

  shouldMove(now) {
    return now - this.lastMove >= this.interval;
  }

  tick(grid, now, gridW, gridH, border) {
    this.updateWarning(now);
    const imminent = this.warningLevel === 3;
    if (!this.shouldMove(now)) return { moved: false, imminent };

    this.lastMove = now;
    if (this.pattern !== PATTERN.CLOSING) this.clearOccupied(grid);

    if (this.pattern === PATTERN.PINGPONG || this.pattern === PATTERN.WAVE) {
      const step = this.direction;
      if (this.axis === 'x') {
        let nx = this.x + step;
        if (nx < this.range[0] || nx > this.range[1]) {
          this.direction = -this.direction;
          nx = this.x + this.direction;
        }
        this.x = nx;
      } else {
        let ny = this.y + step;
        if (ny < this.range[0] || ny > this.range[1]) {
          this.direction = -this.direction;
          ny = this.y + this.direction;
        }
        this.y = ny;
      }
    } else if (this.pattern === PATTERN.GATE) {
      this.open = !this.open;
    } else if (this.pattern === PATTERN.CLOSING) {
      this.margin++;
      const m = this.margin;
      const lim = Math.floor(Math.min(gridW, gridH) / 2) - border - 4;
      if (m > lim) {
        this._occupied = [];
        return { moved: false, imminent };
      }
      for (let x = m; x < gridW - m; x++) {
        this._occupied.push({ x, y: m }, { x, y: gridH - 1 - m });
      }
      for (let y = m; y < gridH - m; y++) {
        this._occupied.push({ x: m, y }, { x: gridW - 1 - m, y });
      }
      this.writeOccupied(grid);
      return { moved: true, imminent: false };
    }

    this._occupied = this.computeCells();
    this.writeOccupied(grid);
    return { moved: true, imminent: false };
  }

  renderPositions() {
    if (this.pattern === PATTERN.CLOSING) return this._occupied;
    return this.computeCells();
  }
}

export class MovingWallSystem {
  constructor() {
    this.walls = [];
  }

  reset(wallConfigs, grid, gridW, gridH, border) {
    this.walls = wallConfigs.map((cfg, i) => new MovingWall({ ...cfg, id: i }));
    const now = performance.now();
    for (const w of this.walls) {
      w.lastMove = now - (w.waveIndex ?? 0) * (w.interval ?? 4000) * 0.25;
      w.syncOccupied(grid);
    }
  }

  simulationTick(grid, now, gridW, gridH, border) {
    let moved = false;
    let pulseSound = false;
    for (const w of this.walls) {
      const prevLevel = w.warningLevel;
      w.updateWarning(now);
      if (w.warningLevel === 2 && prevLevel < 2) pulseSound = true;
      const result = w.tick(grid, now, gridW, gridH, border);
      if (result.moved) moved = true;
    }
    return { moved, pulseSound, haptic: moved };
  }

  maxWarningLevel() {
    return Math.max(0, ...this.walls.map(w => w.warningLevel));
  }

  isPlayerNearMobile(player, gridW, gridH) {
    if (!player?.alive) return false;
    for (const w of this.walls) {
      if (w.warningLevel < 1) continue;
      for (const c of w.renderPositions()) {
        if (Math.abs(c.x - player.x) + Math.abs(c.y - player.y) <= 2) return true;
      }
    }
    return false;
  }
}

export function getStaticWalls(arenaId, gridW, gridH, border) {
  const walls = [];
  const cx = Math.floor(gridW / 2);
  if (arenaId === 'labyrinthe') {
    for (let x = cx - 8; x <= cx + 8; x += 8) {
      for (let y = border + 3; y < gridH - border - 3; y++) {
        if ((x + y) % 5 !== 0) walls.push({ x, y });
      }
    }
  }
  if (arenaId === 'duel') {
    for (let y = border + 5; y < gridH - border - 5; y += 5) {
      walls.push({ x: cx - 3, y }, { x: cx + 3, y });
    }
  }
  return walls;
}

export function createWallConfigs(arenaId, gridW, gridH, border) {
  const cx = Math.floor(gridW / 2);
  const cy = Math.floor(gridH / 2);
  const minX = border + 3;
  const maxX = gridW - border - 4;
  const yMin = border + 2;
  const yMax = gridH - border - 3;

  switch (arenaId) {
    case 'battement':
      return [
        { pattern: PATTERN.PINGPONG, axis: 'x', x: cx, y: cy, range: [minX, maxX], direction: 1, interval: 4000 },
        { pattern: PATTERN.PINGPONG, axis: 'x', x: cx, y: Math.floor(gridH / 3), range: [minX, maxX], direction: -1, interval: 3000 },
      ];
    case 'compresseur':
      return [{ pattern: PATTERN.CLOSING, x: 0, y: 0, interval: 5000 }];
    case 'piege':
      return [
        { pattern: PATTERN.GATE, x: cx - 4, yMin, yMax, open: true, interval: 4500 },
        { pattern: PATTERN.GATE, x: cx + 4, yMin, yMax, open: true, interval: 3500 },
      ];
    case 'vague':
      return [0, 1, 2, 3].map(i => ({
        pattern: PATTERN.WAVE, axis: 'x', x: minX + i * 6, y: cy - 4 + i * 2,
        range: [minX, maxX], direction: i % 2 ? -1 : 1,
        interval: 3200, waveIndex: i,
      }));
    case 'chaos':
      return [
        { pattern: PATTERN.PINGPONG, axis: 'y', x: cx - 8, y: cy, range: [yMin, yMax], direction: 1, interval: 2800 },
        { pattern: PATTERN.PINGPONG, axis: 'y', x: cx + 8, y: cy, range: [yMin, yMax], direction: -1, interval: 2600 },
        { pattern: PATTERN.GATE, x: cx, yMin, yMax, open: true, interval: 3800 },
      ];
    default:
      return [];
  }
}
