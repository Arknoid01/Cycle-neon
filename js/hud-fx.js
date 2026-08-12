import { COMBO_DECAY_TICKS } from './constants.js';

const COMBO_LABELS = {
  nearMiss: 'FRÔLEMENT !',
  wallNear: 'ESQUIVE !',
  kill: 'KILL !',
  survival: 'SURVIE !',
};

export class HudFx {
  constructor() {
    this.layer = document.getElementById('float-layer');
    this.comboEl = document.getElementById('combo-meter');
    this.comboValueEl = document.getElementById('combo-value');
    this.comboFillEl = document.getElementById('combo-fill');
    this.scoreEl = document.getElementById('score');
    this.scoreWrap = document.getElementById('score-wrap');
    this.lastScore = 0;
    this.maxCombo = 5;
  }

  reset() {
    this.lastScore = 0;
    this.updateCombo(1, 1, false);
    this.layer?.replaceChildren();
  }

  updateCombo(value, maxCombo = 5, pulse = false) {
    this.maxCombo = maxCombo;
    if (this.comboValueEl) {
      this.comboValueEl.textContent = '×' + value;
      this.comboValueEl.dataset.level = String(value);
    }
    if (this.comboEl) {
      this.comboEl.dataset.level = String(value);
      this.comboEl.classList.toggle('combo-idle', value <= 1);
      if (pulse) {
        this.comboEl.classList.remove('combo-pulse');
        void this.comboEl.offsetWidth;
        this.comboEl.classList.add('combo-pulse');
      }
    }
    if (this.comboFillEl) {
      const pct = maxCombo <= 1 ? 0 : ((value - 1) / (maxCombo - 1)) * 100;
      this.comboFillEl.style.width = pct + '%';
      this.comboFillEl.dataset.level = String(value);
    }
  }

  setComboDecay(ratio) {
    if (!this.comboFillEl) return;
    this.comboFillEl.style.setProperty('--decay', String(Math.max(0, Math.min(1, ratio))));
  }

  pulseScore() {
    if (!this.scoreWrap) return;
    this.scoreWrap.classList.remove('score-pop');
    void this.scoreWrap.offsetWidth;
    this.scoreWrap.classList.add('score-pop');
  }

  onScoreChange(score) {
    if (score > this.lastScore) this.pulseScore();
    this.lastScore = score;
  }

  spawnPopup(text, kind, opts = {}) {
    if (!this.layer || !text) return;
    const el = document.createElement('div');
    el.className = 'fx-pop fx-' + (kind || 'points');
    if (opts.sub) {
      el.innerHTML = `<span class="fx-main">${text}</span><span class="fx-sub">${opts.sub}</span>`;
    } else {
      el.textContent = text;
    }
    const x = 38 + Math.random() * 24;
    const y = 22 + Math.random() * 16;
    el.style.left = x + '%';
    el.style.top = y + '%';
    el.style.animationDelay = (opts.delay || 0) + 'ms';
    this.layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('fx-active'));
    setTimeout(() => el.remove(), opts.duration || 1100);
  }

  onGameEvent(event, sim) {
    const max = sim?.maxMultiplier ? 5 : 5;
    switch (event.type) {
      case 'nearMiss':
        this.spawnPopup(COMBO_LABELS.nearMiss, 'label');
        this.spawnPopup('+' + (event.points ?? 0), 'points', { delay: 40 });
        if (event.combo > 1) {
          this.spawnPopup('×' + event.combo, 'combo', { delay: 90 });
        }
        this.updateCombo(event.combo ?? sim.multiplier, max, true);
        break;
      case 'wallNear':
        this.spawnPopup(COMBO_LABELS.wallNear, 'label');
        this.spawnPopup('+' + (event.points ?? 0), 'points', { delay: 40 });
        if (event.combo > 1) {
          this.spawnPopup('×' + event.combo, 'combo', { delay: 90 });
        }
        this.updateCombo(event.combo ?? sim.multiplier, max, true);
        break;
      case 'kill':
        this.spawnPopup(COMBO_LABELS.kill, 'label');
        this.spawnPopup('+' + (event.points ?? 0), 'points', { delay: 50 });
        this.updateCombo(sim.multiplier, max, true);
        break;
      case 'multiplierUp':
        if (!['nearMiss', 'wallNear', 'kill'].includes(event.reason)) {
          if (event.reason === 'survival') {
            this.spawnPopup(COMBO_LABELS.survival, 'label');
          }
          this.spawnPopup('×' + event.value, 'combo-big', { duration: 900 });
        }
        this.updateCombo(event.value, max, true);
        break;
      case 'comboDecay':
        this.spawnPopup('×' + event.value, 'combo-fade', { duration: 700 });
        this.updateCombo(event.value, max, false);
        break;
      default:
        break;
    }
    if (sim) this.onScoreChange(sim.score);
  }

  tick(sim) {
    if (!sim?.playing) return;
    const decay = sim.comboDecay ?? 0;
    const ratio = decay / COMBO_DECAY_TICKS;
    this.setComboDecay(ratio);
    this.updateCombo(sim.multiplier, 5, false);
    this.onScoreChange(sim.score);
  }
}
