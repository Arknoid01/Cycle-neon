import {
  CELL_WALL, CELL_EMPTY, DX, DY, PATTERN,
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
    if (this.pattern === PATTERN.PINGPONG) {
      return [{ x: this.x, y: this.y }];
    }
    return [];
  }

  shouldMove(now) {
    return now - this.lastMove >= this.interval;
  }

  /** @returns {{ moved: boolean, imminent: boolean }} */
  tick(grid, now, gridW, gridH, border) {
    this.updateWarning(now);
    const imminent = this.warningLevel === 3;
    if (!this.shouldMove(now)) return { moved: false, imminent: this.warningLevel === 3 };

    this.lastMove = now;
    if (this.pattern !== PATTERN.CLOSING) this.clearOccupied(grid);

    if (this.pattern === PATTERN.PINGPONG) {
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
      w.lastMove = now;
      w.syncOccupied(grid);
    }
  }

  /** @returns {{ moved: boolean, pulseSound: boolean, haptic: boolean }} */
  simulationTick(grid, now, gridW, gridH, border) {
    let moved = false;
    let pulseSound = false;
    let haptic = false;
    for (const w of this.walls) {
      const prevLevel = w.warningLevel;
      w.updateWarning(now);
      if (w.warningLevel === 2 && prevLevel < 2) pulseSound = true;
      const result = w.tick(grid, now, gridW, gridH, border);
      if (result.moved) { moved = true; haptic = true; }
    }
    return { moved, pulseSound, haptic };
  }

  allRenderCells() {
    const out = [];
    for (const w of this.walls) {
      for (const c of w.renderPositions()) out.push({ ...c, wall: w });
    }
    return out;
  }
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
    default:
      return [];
  }
}
