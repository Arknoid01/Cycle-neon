import { getRiderDefs, BOT_DEFS } from './cosmetics.js';
import { BIKE_DIR_ANGLES } from './constants.js';
import { gridDimensions } from './grid.js';

export class BikeSpriteSandbox {
  constructor(renderer, bikeDebug, ui) {
    this.renderer = renderer;
    this.bikeDebug = bikeDebug;
    this.ui = ui;
    this.active = false;
    this.selectedBikeId = 0;
    this.exitBtn = document.getElementById('sandbox-exit');
    this.exitBtn?.addEventListener('click', () => this.exit());
  }

  isActive() {
    return this.active;
  }

  getRiders() {
    return this.renderer.sandboxRiders ?? [];
  }

  getSelectedBikeId() {
    return this.selectedBikeId;
  }

  setSelectedBikeId(id) {
    this.selectedBikeId = id;
    this.bikeDebug?.onSandboxBikeSelected(id);
  }

  setBikeDir(bikeId, dir) {
    this.renderer.setSandboxBikeDir(bikeId, dir);
    this.bikeDebug?.onSandboxBikeDirChanged(bikeId, dir);
  }

  async enter() {
    if (this.active) return;
    if (!this.renderer.scene) await this.renderer.init();

    const defs = getRiderDefs();
    const playerDef = defs[0];
    const botDef = defs[1] ?? { key: 'bot0', ...BOT_DEFS[0] };
    const riderDefs = [playerDef, botDef];

    this.renderer.enterSpriteSandbox(riderDefs);
    this.active = true;
    this.selectedBikeId = 0;

    this.ui.hideMenu();
    this.ui.hideGameHud?.();
    document.getElementById('controls')?.classList.add('hidden');
    this.exitBtn?.classList.remove('hidden');
    this.bikeDebug?.enterSandbox(this);
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.renderer.exitSpriteSandbox();
    this.bikeDebug?.exitSandbox();
    this.exitBtn?.classList.add('hidden');
    this.ui.showMenu();
  }
}

export function makeSandboxRider(id, def, x, y, dir, isPlayer) {
  return {
    id,
    key: def.key ?? ('r' + id),
    name: def.name ?? (isPlayer ? 'Toi' : 'Bot'),
    isPlayer,
    def,
    personality: null,
    difficulty: 0,
    alive: true,
    x,
    y,
    dir,
    prevX: x,
    prevY: y,
    renderX: x,
    renderY: y,
    smoothAngle: BIKE_DIR_ANGLES[dir],
  };
}

export function createSandboxPair() {
  const { w, h } = gridDimensions();
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const gap = 5;
  return { cx, cy, gap };
}
