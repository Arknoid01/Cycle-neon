import { CELL_EMPTY, CELL_WALL, ARENA_BORDER, ARENA_SCALE, isTrail } from './constants.js';

export class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.cells = new Uint8Array(w * h);
  }

  idx(x, y) { return y * this.w + x; }

  inBounds(x, y) {
    return x >= 0 && x < this.w && y >= 0 && y < this.h;
  }

  get(x, y) {
    if (!this.inBounds(x, y)) return CELL_WALL;
    return this.cells[this.idx(x, y)];
  }

  set(x, y, val) {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if (this.cells[i] === val) return false;
    this.cells[i] = val;
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
      this.set(x, y, CELL_EMPTY);
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
