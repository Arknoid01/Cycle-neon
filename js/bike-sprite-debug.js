import {
  bikeSpriteTuning,
  BIKE_DIR_LABELS,
  BIKE_FRAME_LABELS,
  exportBikeSpriteConfigCode,
  resetBikeSpriteTuning,
  saveBikeSpriteTuningToStorage,
} from './bike-sprites.js';

export class BikeSpriteDebug {
  constructor(renderer) {
    this.renderer = renderer;
    this.panel = document.getElementById('bike-sprite-debug');
    this.dirLabel = document.getElementById('bsd-dir-label');
    this.frameLabel = document.getElementById('bsd-frame-label');
    this.rotLabel = document.getElementById('bsd-rot-label');
    this.bikeLabel = document.getElementById('bsd-bike-label');
    this.exportOut = document.getElementById('bsd-export');
    this.copyStatus = document.getElementById('bsd-copy-status');
    this.selectedDir = 0;
    this.sandbox = null;
    this.selectedBikeId = 0;
    this.visible = false;

    if (!this.panel) return;
    this._bindControls();
  }

  enterSandbox(sandbox) {
    this.sandbox = sandbox;
    this.selectedBikeId = 0;
    this.setVisible(true);
    this._syncDirFromSandbox();
  }

  exitSandbox() {
    this.sandbox = null;
    this.setVisible(false);
  }

  onSandboxBikeSelected(bikeId) {
    this.selectedBikeId = bikeId;
    this._syncDirFromSandbox();
    this._refreshLabels();
    this._highlightBikeButtons();
  }

  onSandboxBikeDirChanged(bikeId, dir) {
    if (bikeId === this.selectedBikeId) {
      this.selectedDir = dir;
      this._refreshLabels();
    }
  }

  _syncDirFromSandbox() {
    if (!this.sandbox) return;
    const riders = this.sandbox.getRiders();
    const r = riders.find(x => x.id === this.selectedBikeId);
    if (r) {
      this.selectedDir = this.renderer.sandboxDisplayDirs?.get(r.id) ?? r.dir;
    }
  }

  setVisible(on) {
    this.visible = !!on;
    this.panel?.classList.toggle('hidden', !this.visible);
    if (this.visible) {
      this._refreshLabels();
      this._updateExport();
    }
  }

  isVisible() {
    return this.visible;
  }

  _bindControls() {
    this.panel.querySelectorAll('[data-bsd-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = Number(btn.dataset.bsdDir);
        this.selectedDir = dir;
        if (this.sandbox) {
          this.sandbox.setBikeDir(this.selectedBikeId, dir);
        }
        this._refreshLabels();
        this._highlightDirButtons();
      });
    });

    this.panel.querySelectorAll('[data-bsd-bike]').forEach(btn => {
      btn.addEventListener('click', () => {
        const bikeId = Number(btn.dataset.bsdBike);
        this.selectedBikeId = bikeId;
        this.sandbox?.setSelectedBikeId(bikeId);
        this._syncDirFromSandbox();
        this._refreshLabels();
        this._highlightBikeButtons();
      });
    });

    document.getElementById('bsd-rot-minus')?.addEventListener('click', () => this._nudgeRot(-15));
    document.getElementById('bsd-rot-plus')?.addEventListener('click', () => this._nudgeRot(15));
    document.getElementById('bsd-rot-minus-fine')?.addEventListener('click', () => this._nudgeRot(-5));
    document.getElementById('bsd-rot-plus-fine')?.addEventListener('click', () => this._nudgeRot(5));

    document.getElementById('bsd-frame-prev')?.addEventListener('click', () => this._cycleFrame(-1));
    document.getElementById('bsd-frame-next')?.addEventListener('click', () => this._cycleFrame(1));

    document.getElementById('bsd-flip-pi')?.addEventListener('click', () => {
      const d = this.selectedDir;
      bikeSpriteTuning.flipPi[d] = !bikeSpriteTuning.flipPi[d];
      this._persistAndRefresh();
    });

    document.getElementById('bsd-flip-x')?.addEventListener('click', () => {
      const d = this.selectedDir;
      bikeSpriteTuning.flipX[d] = !bikeSpriteTuning.flipX[d];
      this._persistAndRefresh();
    });

    document.getElementById('bsd-apply-all-rot')?.addEventListener('click', () => {
      const rot = bikeSpriteTuning.rotOffsetDeg[this.selectedDir];
      for (let i = 0; i < 4; i++) bikeSpriteTuning.rotOffsetDeg[i] = rot;
      this._persistAndRefresh();
    });

    document.getElementById('bsd-reset')?.addEventListener('click', () => {
      resetBikeSpriteTuning();
      this._refreshLabels();
      this._updateExport();
      this.renderer.invalidateBikeSpriteFrames();
    });

    document.getElementById('bsd-export-btn')?.addEventListener('click', () => this._updateExport());

    document.getElementById('bsd-copy')?.addEventListener('click', async () => {
      this._updateExport();
      const text = this.exportOut.value;
      try {
        await navigator.clipboard.writeText(text);
        this.copyStatus.textContent = 'Copié !';
      } catch {
        this.exportOut.select();
        document.execCommand('copy');
        this.copyStatus.textContent = 'Copié (fallback)';
      }
      setTimeout(() => { this.copyStatus.textContent = ''; }, 2000);
    });
  }

  _nudgeRot(delta) {
    const d = this.selectedDir;
    bikeSpriteTuning.rotOffsetDeg[d] = (bikeSpriteTuning.rotOffsetDeg[d] || 0) + delta;
    this._persistAndRefresh();
  }

  _cycleFrame(delta) {
    const d = this.selectedDir;
    const cur = bikeSpriteTuning.frameForDir[d];
    bikeSpriteTuning.frameForDir[d] = (cur + delta + 4) % 4;
    this._persistAndRefresh();
    this.renderer.invalidateBikeSpriteFrames();
  }

  _persistAndRefresh() {
    saveBikeSpriteTuningToStorage();
    this._refreshLabels();
    this._updateExport();
  }

  _highlightDirButtons() {
    this.panel.querySelectorAll('[data-bsd-dir]').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.bsdDir) === this.selectedDir);
    });
  }

  _highlightBikeButtons() {
    this.panel.querySelectorAll('[data-bsd-bike]').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.bsdBike) === this.selectedBikeId);
    });
  }

  _refreshLabels() {
    const d = this.selectedDir;
    if (this.bikeLabel) {
      this.bikeLabel.textContent = this.selectedBikeId === 0 ? 'Ma moto' : 'Adversaire';
    }
    if (this.dirLabel) {
      this.dirLabel.textContent = BIKE_DIR_LABELS[d];
    }
    if (this.frameLabel) {
      const fi = bikeSpriteTuning.frameForDir[d];
      this.frameLabel.textContent = BIKE_FRAME_LABELS[fi] ?? String(fi);
    }
    if (this.rotLabel) {
      const parts = [`${bikeSpriteTuning.rotOffsetDeg[d]}°`];
      if (bikeSpriteTuning.flipPi[d]) parts.push('flip π');
      if (bikeSpriteTuning.flipX[d]) parts.push('flip X');
      this.rotLabel.textContent = parts.join(' · ');
    }
    this._highlightDirButtons();
    this._highlightBikeButtons();
  }

  _updateExport() {
    if (this.exportOut) {
      this.exportOut.value = exportBikeSpriteConfigCode();
    }
  }
}
