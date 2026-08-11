import { CELL_EMPTY, CELL_WALL, ARENA_BORDER, ARENA_SCALE, isTrail } from './constants.js';

const NO_TRAIL_DIR = 255;

export class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.cells = new Uint8Array(w * h);
    this.trailDirs = new Uint8Array(w * h);
    this.trailInDirs = new Uint8Array(w * h);
    this.trailDirs.fill(NO_TRAIL_DIR);
    this.trailInDirs.fill(NO_TRAIL_DIR);
  }

  idx(x, y) { return y * this.w + x; }

  inBounds(x, y) {
    return x >= 0 && x < this.w && y >= 0 && y < this.h;
  }

  get(x, y) {
    if (!this.inBounds(x, y)) return CELL_WALL;
    return this.cells[this.idx(x, y)];
  }

  getTrailDir(x, y) {
    if (!this.inBounds(x, y)) return 0;
    const d = this.trailDirs[this.idx(x, y)];
    return d === NO_TRAIL_DIR ? 0 : d;
  }

  getTrailInDir(x, y) {
    if (!this.inBounds(x, y)) return 0;
    const i = this.idx(x, y);
    const d = this.trailInDirs[i];
    if (d !== NO_TRAIL_DIR) return d;
    const out = this.trailDirs[i];
    return out === NO_TRAIL_DIR ? 0 : out;
  }

  set(x, y, val) {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if (this.cells[i] === val) return false;
    this.cells[i] = val;
    if (!isTrail(val)) {
      this.trailDirs[i] = NO_TRAIL_DIR;
      this.trailInDirs[i] = NO_TRAIL_DIR;
    }
    return true;
  }

  setTrail(x, y, val, outDir, inDir = outDir) {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    this.cells[i] = val;
    this.trailDirs[i] = outDir;
    this.trailInDirs[i] = inDir;
    return true;
  }

  isPerimeter(x, y) {
    const b = ARENA_BORDER;
    return x < b || x >= this.w - b || y < b || y >= this.h - b;
  }

  isBlocked(x, y) {
    return this.get(x, y) !== CELL_EMPTY;
  }

  clear(x, y) {
    const v = this.get(x, y);
    if (v === CELL_WALL || isTrail(v)) {
      const i = this.idx(x, y);
      this.cells[i] = CELL_EMPTY;
      this.trailDirs[i] = NO_TRAIL_DIR;
      this.trailInDirs[i] = NO_TRAIL_DIR;
      return true;
    }
    return false;
  }

  buildPerimeter() {
    const b = ARENA_BORDER;
    for (let layer = 0; layer < b; layer++) {
      for (let x = 0; x < this.w; x++) {
        this.set(x, layer, CELL_WALL);
        this.set(x, this.h - 1 - layer, CELL_WALL);
      }
      for (let y = 0; y < this.h; y++) {
        this.set(layer, y, CELL_WALL);
        this.set(this.w - 1 - layer, y, CELL_WALL);
      }
    }
  }
}

export function gridDimensions() {
  return { w: 18 * ARENA_SCALE, h: 28 * ARENA_SCALE };
}
