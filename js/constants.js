export const CELL_EMPTY = 0;
export const CELL_WALL = 2;
export const TRAIL_BASE = 10;

export const DIR_UP = 0;
export const DIR_RIGHT = 1;
export const DIR_DOWN = 2;
export const DIR_LEFT = 3;
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

export const ARENA_BORDER = 2;
export const ARENA_SCALE = 3;

export const SIM_BASE_INTERVAL = 130;
export const SIM_MIN_INTERVAL = 62;

export const CELL_SIZE = 1;
export const WALL_H = 1.5;
export const TRAIL_H = 1.1;
export const PERIM_H = 1.8;

export const CAM_DIR_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

export const KILL_BONUS = 300;
export const WIN_BONUS = 500;

export const WARNING_DIM_MS = 800;
export const WARNING_PULSE_MS = 400;
export const WARNING_IMMINENT_MS = 200;

export const PATTERN = {
  PINGPONG: 'pingpong',
  GATE: 'gate',
  CLOSING: 'closing',
};

export function trailVal(id) { return TRAIL_BASE + id; }
export function isTrail(v) { return v >= TRAIL_BASE; }
export function isBlocked(v) { return v !== CELL_EMPTY; }

export function getTickInterval(score) {
  return Math.max(SIM_MIN_INTERVAL, SIM_BASE_INTERVAL - Math.floor(score / 12) * 2);
}
