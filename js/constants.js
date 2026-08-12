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
/** Échelle globale appliquée à chaque moto (procédurale et GLB) après création. */
export const BIKE_SCALE = 1.4;
export const WALL_H = 1.45;
export const TRAIL_H = 1.25;
export const TRAIL_THICK = 0.06;
/** Plate length along travel axis — slight overlap to hide gaps between cells. */
export const TRAIL_PLATE_LEN = CELL_SIZE * 1.1;
export const TRAIL_ARM_LEN = CELL_SIZE * 0.54;
export const TRAIL_ARM_OFFSET = CELL_SIZE * 0.27;
export const TRAIL_OPACITY = 0.8;
export const WALL_CUBE_SIZE = CELL_SIZE * 1.02;
export const PERIM_H = 1.95;

export const CAM_DIR_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
/** Bike mesh forward is -Z at rotation 0; differs from camera bearing. */
export const BIKE_DIR_ANGLES = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

export const KILL_BONUS = 300;
export const WIN_BONUS = 500;
export const NEAR_MISS_BONUS = 50;
export const MULTIPLIER_MAX = 5;
/** Ticks sans action combo avant que le multiplicateur baisse d'un cran. */
export const COMBO_DECAY_TICKS = 38;
export const CHAMPIONSHIP_ROUNDS = 5;
export const CHAMPIONSHIP_RIDERS = 6;
export const CHAMP_POINTS = [10, 7, 5, 3, 2, 1];

export const WARNING_DIM_MS = 800;
export const WARNING_PULSE_MS = 400;
export const WARNING_IMMINENT_MS = 200;

export const PATTERN = {
  PINGPONG: 'pingpong',
  GATE: 'gate',
  CLOSING: 'closing',
  WAVE: 'wave',
};

export const ARENA_FAMILY = {
  CLASSIC: 'classic',
  MAZE: 'maze',
  DYNAMIC: 'dynamic',
  CHAOS: 'chaos',
  ARENA: 'arena',
};

export function trailVal(id) { return TRAIL_BASE + id; }
export function isTrail(v) { return v >= TRAIL_BASE; }
export function isBlocked(v) { return v !== CELL_EMPTY; }

export function getTickInterval(score) {
  return Math.max(SIM_MIN_INTERVAL, SIM_BASE_INTERVAL - Math.floor(score / 12) * 2);
}
