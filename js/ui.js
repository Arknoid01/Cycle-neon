import { ARENAS, ARENA_DESC, ARENA_FAMILIES, loadArenaBest, loadHighScore, saveArenaBest, saveHighScore } from './arenas.js';
import { CHALLENGES, checkChallenges, loadChallenges } from './challenges.js';
import { COLOR_PRESETS, loadCosmetic, saveCosmetic, getCosmeticPreset, hexCss } from './cosmetics.js';
import { getSettings, saveSettings } from './settings.js';
import { setMasterVolume } from './audio.js';
import { WIN_BONUS } from './constants.js';

const SCREENS = ['home', 'play', 'custom', 'trophies', 'options'];

export class UI {
  constructor() {
    this.scoreEl = document.getElementById('score');
    this.arenaNameEl = document.getElementById('arena-name');
    this.timerEl = document.getElementById('timer');
    this.highScoreEl = document.getElementById('high-score');
    this.rivalsEl = document.getElementById('rivals');
    this.challengeHudEl = document.getElementById('challenge-hud');
    this.multiplierEl = document.getElementById('multiplier-hud');
    this.champHudEl = document.getElementById('champ-hud');
    this.overlay = document.getElementById('overlay');
    this.overlayTitle = document.getElementById('overlay-title');
    this.overlayScore = document.getElementById('overlay-score');
    this.overlayBest = document.getElementById('overlay-best');
    this.overlayRecord = document.getElementById('overlay-record');
    this.overlayChallenge = document.getElementById('overlay-challenge');
    this.overlayNext = document.getElementById('overlay-next');
    this.overlayHint = document.getElementById('overlay-hint');
    this.homeMenu = document.getElementById('home-menu');
    this.homeBest = document.getElementById('home-best');
    this.trophySummary = document.getElementById('trophy-summary');
    this.trophiesProgress = document.getElementById('trophies-progress');
    this.arenaList = document.getElementById('arena-list');
    this.arenaRandomBtn = document.getElementById('arena-random');
    this.cosmeticPicker = document.getElementById('cosmetic-picker');
    this.cosmeticPreview = document.getElementById('cosmetic-preview');
    this.challengesList = document.getElementById('challenges-list');
    this.arenaIntro = document.getElementById('arena-intro');
    this.arenaIntroName = document.getElementById('arena-intro-name');
    this.arenaIntroDesc = document.getElementById('arena-intro-desc');
    this.controls = document.getElementById('controls');
    this.btnLeft = document.getElementById('btn-left');
    this.btnRight = document.getElementById('btn-right');
    this.optVolume = document.getElementById('opt-volume');
    this.optHaptic = document.getElementById('opt-haptic');
    this.optBloom = document.getElementById('opt-bloom');

    this.screenEls = {};
    for (const id of SCREENS) {
      this.screenEls[id] = document.getElementById(id + '-screen');
    }

    this.highScore = loadHighScore();
    this.activeChallengeId = null;
    this.currentScreen = 'home';
    this.onStartArena = null;
    this.onShowMenu = null;
    this.onStartChampionship = null;
    this.onContinueChampionship = null;
    this.overlayMode = 'menu';
    this.onSettingsChange = null;
  }

  applyScoreColor() {
    const c = getCosmeticPreset();
    this.scoreEl.style.color = hexCss(c.trailGlow);
    this.scoreEl.style.textShadow = `0 0 8px ${hexCss(c.trailGlow)}88`;
    if (this.cosmeticPreview) {
      this.cosmeticPreview.style.background =
        `linear-gradient(135deg, ${hexCss(c.body)} 0%, ${hexCss(c.trailGlow)} 100%)`;
      this.cosmeticPreview.style.boxShadow = `0 0 14px ${hexCss(c.trailGlow)}66`;
    }
  }

  trophyStats() {
    const done = loadChallenges();
    const count = CHALLENGES.filter(ch => done[ch.id]).length;
    return { count, total: CHALLENGES.length };
  }

  updateHomeStats() {
    const { count, total } = this.trophyStats();
    this.homeBest.textContent = 'Record global : ' + this.highScore.toLocaleString('fr-FR');
    this.trophySummary.textContent = count + ' / ' + total + ' trophées';
    if (this.trophiesProgress) {
      this.trophiesProgress.textContent = count + ' sur ' + total + ' trophées débloqués';
    }
  }

  showScreen(id) {
    if (!SCREENS.includes(id)) return;
    this.currentScreen = id;
    for (const [key, el] of Object.entries(this.screenEls)) {
      el?.classList.toggle('hidden', key !== id);
    }
    if (id === 'home') this.updateHomeStats();
    if (id === 'custom') this.buildCosmeticPicker();
    if (id === 'trophies') this.buildChallengesList();
    if (id === 'play') this.buildArenaList();
    if (id === 'options') this.syncOptionsUI();
  }

  buildCosmeticPicker() {
    const current = loadCosmetic();
    this.cosmeticPicker.innerHTML = '';
    COLOR_PRESETS.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-swatch' + (p.id === current ? ' selected' : '');
      btn.style.background = `linear-gradient(135deg, ${hexCss(p.body)}, ${hexCss(p.trailGlow)})`;
      btn.style.setProperty('--swatch-glow', hexCss(p.trailGlow));
      btn.setAttribute('aria-label', p.id);
      btn.addEventListener('click', () => {
        saveCosmetic(p.id);
        this.buildCosmeticPicker();
        this.applyScoreColor();
      });
      this.cosmeticPicker.appendChild(btn);
    });
    this.applyScoreColor();
  }

  buildChallengesList() {
    const done = loadChallenges();
    this.challengesList.innerHTML = '';
    CHALLENGES.forEach(ch => {
      const el = document.createElement('div');
      const isDone = !!done[ch.id];
      el.className = 'challenge-item' + (isDone ? ' done' : '') +
        (!isDone && this.activeChallengeId === ch.id ? ' active' : '');
      el.innerHTML =
        `<span class="challenge-check">${isDone ? '★' : '○'}</span>` +
        `<div><div class="challenge-name">${ch.name}</div><div class="challenge-desc">${ch.desc}</div></div>`;
      if (!isDone) {
        el.addEventListener('click', () => {
          this.activeChallengeId = this.activeChallengeId === ch.id ? null : ch.id;
          this.buildChallengesList();
        });
      }
      this.challengesList.appendChild(el);
    });
    this.updateHomeStats();
  }

  buildArenaList() {
    this.arenaList.innerHTML = '';
    let lastFamily = null;
    ARENAS.forEach(a => {
      if (a.family !== lastFamily) {
        lastFamily = a.family;
        const label = document.createElement('div');
        label.className = 'family-label';
        label.textContent = ARENA_FAMILIES[a.family]?.name ?? a.family;
        this.arenaList.appendChild(label);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'arena-btn';
      btn.innerHTML =
        `<div class="arena-btn-name">${a.name}</div>` +
        `<div class="arena-btn-desc">${ARENA_DESC[a.id] || ''}</div>` +
        `<div class="arena-btn-best">Record : ${loadArenaBest(a.id).toLocaleString('fr-FR')}</div>`;
      btn.addEventListener('click', () => this.onStartArena?.(a.id));
      this.arenaList.appendChild(btn);
    });
  }

  buildHomeMenu() {
    this.buildCosmeticPicker();
    this.buildChallengesList();
    this.buildArenaList();
    this.syncOptionsUI();
    this.updateHomeStats();
    this.showScreen('home');
  }

  syncOptionsUI() {
    const s = getSettings();
    if (this.optVolume) this.optVolume.value = Math.round(s.volume * 100);
    if (this.optHaptic) this.optHaptic.checked = s.haptic;
    if (this.optBloom) this.optBloom.checked = s.bloom;
  }

  applySettings() {
    const s = getSettings();
    setMasterVolume(s.volume);
    this.onSettingsChange?.(s);
  }

  bindOptions() {
    this.optVolume?.addEventListener('input', () => {
      const v = parseInt(this.optVolume.value, 10) / 100;
      saveSettings({ volume: v });
      setMasterVolume(v);
    });
    this.optHaptic?.addEventListener('change', () => {
      saveSettings({ haptic: this.optHaptic.checked });
    });
    this.optBloom?.addEventListener('change', () => {
      const s = saveSettings({ bloom: this.optBloom.checked });
      this.onSettingsChange?.(s);
    });
    this.applySettings();
  }

  showMenu() {
    this.buildHomeMenu();
    if (this.challengeHudEl) this.challengeHudEl.textContent = '';
    this.multiplierEl?.classList.add('hidden');
    this.champHudEl?.classList.add('hidden');
    this.homeMenu.classList.remove('hidden');
    this.overlay.classList.add('hidden');
    this.controls.classList.add('hidden');
  }

  showIntro(arena) {
    this.arenaIntroName.textContent = arena.name;
    this.arenaIntroDesc.textContent = ARENA_DESC[arena.id] || '';
    this.arenaIntro.classList.remove('hidden');
    setTimeout(() => this.arenaIntro.classList.add('hidden'), 1100);
    return performance.now() + 1300;
  }

  hideMenu() {
    this.homeMenu.classList.add('hidden');
  }

  showControls() {
    this.controls.classList.remove('hidden');
  }

  updateHud(sim, arena, now, playing, championship = null) {
    this.arenaNameEl.textContent = arena.name;
    this.highScoreEl.textContent = 'BEST ' + this.highScore.toLocaleString('fr-FR');
    this.scoreEl.textContent = sim.score.toLocaleString('fr-FR');
    const rivals = sim.aliveRiders().length - (sim.getPlayer()?.alive ? 1 : 0);
    this.rivalsEl.textContent = rivals > 0
      ? rivals + ' en course'
      : 'DERNIER EN VIE !';
    if (playing) this.timerEl.textContent = 'T : ' + sim.getElapsedSeconds(now).toFixed(2);
    const ch = this.activeChallengeId
      ? CHALLENGES.find(c => c.id === this.activeChallengeId) : null;
    if (this.challengeHudEl) this.challengeHudEl.textContent = ch ? 'Défi : ' + ch.name : '';

    if (sim.multiplier > 1 && this.multiplierEl) {
      this.multiplierEl.classList.remove('hidden');
      this.multiplierEl.textContent = '×' + sim.multiplier;
      this.multiplierEl.dataset.level = String(sim.multiplier);
    } else if (this.multiplierEl) {
      this.multiplierEl.classList.add('hidden');
    }

    if (championship?.active && this.champHudEl) {
      const p = championship.standings.find(s => s.isPlayer);
      this.champHudEl.classList.remove('hidden');
      this.champHudEl.textContent =
        `Manche ${Math.min(championship.round + 1, championship.totalRounds)}/${championship.totalRounds} · ${p?.points ?? 0} pts`;
    }
  }

  showChampionshipRoundResults(championship, roundResults) {
    this.overlayMode = 'champRound';
    const lines = roundResults.map(r =>
      `${r.place}. ${r.name} +${r.pointsEarned}`
    ).join(' · ');
    this.overlayTitle.textContent = `Manche ${championship.round}/${championship.totalRounds}`;
    this.overlayScore.textContent = lines;
    const p = championship.standings.find(s => s.isPlayer);
    this.overlayBest.textContent = 'Total : ' + (p?.points ?? 0) + ' pts';
    this.overlayRecord.classList.add('hidden');
    this.overlayChallenge.classList.add('hidden');
    this.overlayNext.textContent = championship.isComplete()
      ? 'Toucher pour voir le classement final'
      : 'Toucher pour la manche suivante';
    this.overlayHint.textContent = this.overlayNext.textContent;
    this.overlay.classList.remove('hidden');
    this.controls.classList.add('hidden');
  }

  showChampionshipFinal(championship) {
    this.overlayMode = 'champFinal';
    const sorted = championship.getSortedStandings();
    const winner = sorted[0];
    const p = sorted.find(s => s.isPlayer);
    this.overlayTitle.textContent = winner.isPlayer ? 'CHAMPION !' : winner.name + ' gagne';
    this.overlayScore.textContent = sorted.map((s, i) =>
      `${i + 1}. ${s.name} — ${s.points} pts`
    ).join('\n');
    this.overlayBest.textContent = p ? `Ta place : ${sorted.indexOf(p) + 1}e · ${p.points} pts` : '';
    this.overlayRecord.classList.add('hidden');
    this.overlayChallenge.classList.add('hidden');
    this.overlayNext.textContent = 'Toucher pour revenir au menu';
    this.overlayHint.textContent = 'Toucher pour revenir au menu';
    this.overlay.classList.remove('hidden');
  }

  showGameOver(sim, arena, won, now) {
    const time = sim.getElapsedSeconds(now);
    const rank = won ? 1 : 1 + sim.aliveBots().length;
    const rec = sim.score > this.highScore;
    if (rec) { this.highScore = sim.score; saveHighScore(this.highScore); }
    const arenaRec = sim.score > loadArenaBest(arena.id);
    if (arenaRec) saveArenaBest(arena.id, sim.score);
    const unlocked = checkChallenges({
      won, kills: sim.kills, score: sim.score, time, arenaId: arena.id,
    });
    this.buildChallengesList();

    this.overlayTitle.textContent = won ? 'VICTOIRE !' : arena.name;
    this.overlayScore.textContent = sim.score.toLocaleString('fr-FR');
    const rankTxt = won ? '1er — dernier en vie !' : rank + 'e place';
    const killTxt = sim.kills > 0 ? ' · ' + sim.kills + ' kill' + (sim.kills > 1 ? 's' : '') : '';
    const winTxt = won ? ' · +' + WIN_BONUS + ' bonus' : '';
    this.overlayBest.textContent = arenaRec
      ? 'Record arène : ' + sim.score.toLocaleString('fr-FR') + ' · ' + rankTxt + killTxt + winTxt
      : 'Record : ' + this.highScore.toLocaleString('fr-FR') + ' · ' + rankTxt + killTxt + winTxt;
    this.overlayRecord.classList.toggle('hidden', !rec);
    if (unlocked.length) {
      this.overlayChallenge.textContent = 'Trophée débloqué : ' + unlocked.map(c => c.name).join(', ');
      this.overlayChallenge.classList.remove('hidden');
    } else {
      this.overlayChallenge.classList.add('hidden');
    }
    this.overlayNext.textContent = 'Arène : ' + arena.name;
    this.overlayMode = 'menu';
    this.overlayHint.textContent = 'Toucher pour revenir au menu';
    this.overlay.classList.remove('hidden');
    this.controls.classList.add('hidden');
    if (this.challengeHudEl) this.challengeHudEl.textContent = '';
    this.multiplierEl?.classList.add('hidden');
  }

  bind(onStartArena, onShowMenu, onTurn, onSettingsChange, onStartChampionship, onContinueChampionship) {
    this.onStartArena = onStartArena;
    this.onShowMenu = onShowMenu;
    this.onSettingsChange = onSettingsChange;
    this.onStartChampionship = onStartChampionship;
    this.onContinueChampionship = onContinueChampionship;

    document.querySelectorAll('.menu-tile[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => this.showScreen(btn.dataset.screen));
    });
    document.querySelectorAll('[data-back]').forEach(btn => {
      btn.addEventListener('click', () => this.showScreen('home'));
    });

    this.bindOptions();

    const bindBtn = (btn, dir) => {
      const press = e => { e.preventDefault(); btn.classList.add('pressed'); onTurn(dir); };
      const release = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
    };
    bindBtn(this.btnLeft, 'left');
    bindBtn(this.btnRight, 'right');

    this.overlay.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (this.overlayMode === 'champRound' || this.overlayMode === 'champFinal') {
        onContinueChampionship?.();
      } else {
        onShowMenu();
      }
    });
    this.arenaRandomBtn.addEventListener('click', () => onStartArena('random'));
    document.getElementById('start-championship')?.addEventListener('click', () => onStartChampionship?.());
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') onTurn('left');
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') onTurn('right');
    });
  }
}
