import { ARENAS, ARENA_DESC, ARENA_FAMILIES, loadArenaBest, loadHighScore, loadArenaPref, saveArenaBest, saveHighScore } from './arenas.js';
import { CHALLENGES, checkChallenges, loadChallenges, getChallengeLaunchConfig } from './challenges.js';
import { recordRunEnd, loadLifetimeStats } from './stats.js';
import { loadChampBest } from './championship.js';
import {
  BIKE_SKINS, SKIN_TIER_LABELS,
  loadSkin, saveSkin,
  getActiveSkin, hexCss, isSkinUnlocked, skinLockHint, syncEarnedSkins, applyTierUnlocks,
} from './cosmetics.js';
import { getSettings, saveSettings } from './settings.js';
import { setMasterVolume } from './audio.js';
import { BikePreview } from './bike-preview.js';
import { preloadBikeModels } from './bike-model-loader.js';
import { getBikeSkin } from './bike-skins.js';
import { HudFx } from './hud-fx.js';
import { getTierProgress, getNextRewardLabel, formatPoints } from './progression.js';

const SCREENS = ['home', 'play', 'custom', 'trophies', 'options'];

export class UI {
  constructor(renderer) {
    this.renderer = renderer;
    this.scoreEl = document.getElementById('score');
    this.arenaNameEl = document.getElementById('arena-name');
    this.timerEl = document.getElementById('timer');
    this.highScoreEl = document.getElementById('high-score');
    this.rivalsEl = document.getElementById('rivals');
    this.challengeHudEl = document.getElementById('challenge-hud');
    this.champHudEl = document.getElementById('champ-hud');
    this.scoreWrap = document.getElementById('score-wrap');
    this.overlay = document.getElementById('overlay');
    this.overlayBadge = document.getElementById('overlay-badge');
    this.overlayTitle = document.getElementById('overlay-title');
    this.overlayScore = document.getElementById('overlay-score');
    this.overlayStats = document.getElementById('overlay-stats');
    this.overlayBest = document.getElementById('overlay-best');
    this.overlayRecord = document.getElementById('overlay-record');
    this.overlayTrophies = document.getElementById('overlay-trophies');
    this.trophyUnlockList = document.getElementById('trophy-unlock-list');
    this.overlayNext = document.getElementById('overlay-next');
    this.overlayHint = document.getElementById('overlay-hint');
    this.overlayActions = document.getElementById('overlay-actions');
    this.overlayReplayBtn = document.getElementById('overlay-replay');
    this.overlayMenuBtn = document.getElementById('overlay-menu');
    this.homeMenu = document.getElementById('home-menu');
    this.homeBest = document.getElementById('home-best');
    this.homeChampBest = document.getElementById('home-champ-best');
    this.homeRankTitle = document.getElementById('home-rank-title');
    this.homeTotalPoints = document.getElementById('home-total-points');
    this.homeProgressFill = document.getElementById('home-progress-fill');
    this.homeProgressBubble = document.getElementById('home-progress-bubble');
    this.homeProgressReward = document.getElementById('home-progress-reward');
    this.homeProgressPts = document.getElementById('home-progress-pts');
    this.trophySummary = document.getElementById('trophy-summary');
    this.trophiesProgress = document.getElementById('trophies-progress');
    this.statsPanel = document.getElementById('stats-panel');
    this.launchChallengeBtn = document.getElementById('launch-challenge');
    this.arenaList = document.getElementById('arena-list');
    this.arenaRandomBtn = document.getElementById('arena-random');
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
    this.bikePreviewCanvas = document.getElementById('bike-preview-canvas');
    this.skinPicker = document.getElementById('skin-picker');
    this.skinPickerHint = document.getElementById('skin-picker-hint');
    this.gameHud = document.getElementById('game-hud');
    this.bikePreview = this.bikePreviewCanvas ? new BikePreview(this.bikePreviewCanvas) : null;

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
    this.onLaunchChallenge = null;
    this.onReplay = null;
    this.lastArcadeArenaId = 'classique';
    this.overlayMode = 'menu';
    this.onSettingsChange = null;
    this.hudFx = new HudFx();
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  applyScoreColor() {
    const glow = hexCss(getActiveSkin().trailGlow);
    if (this.scoreEl) {
      this.scoreEl.style.color = glow;
      this.scoreEl.style.textShadow = `0 0 16px ${glow}, 0 0 32px ${glow}66`;
    }
    if (this.scoreWrap) this.scoreWrap.style.setProperty('--score-glow', glow);
  }

  trophyStats() {
    const done = loadChallenges();
    const count = CHALLENGES.filter(ch => done[ch.id]).length;
    return { count, total: CHALLENGES.length };
  }

  updateHomeStats() {
    const { count, total } = this.trophyStats();
    const stats = loadLifetimeStats();
    const champBest = loadChampBest();
    syncEarnedSkins();
    this.homeBest.textContent = 'Record global : ' + this.highScore.toLocaleString('fr-FR');
    if (this.homeChampBest) {
      this.homeChampBest.textContent = champBest > 0
        ? 'Record championnat : ' + champBest.toLocaleString('fr-FR') + ' pts'
        : stats.runs > 0
          ? stats.wins + ' victoire' + (stats.wins > 1 ? 's' : '') + ' · ' + stats.runs + ' partie' + (stats.runs > 1 ? 's' : '')
          : '';
    }
    this.trophySummary.textContent = count + ' / ' + total + ' trophées';
    if (this.trophiesProgress) {
      this.trophiesProgress.textContent = count + ' sur ' + total + ' trophées débloqués';
    }
    this.updateHomeProgressBar();
  }

  updateHomeProgressBar() {
    const progress = getTierProgress();
    const { current, next, pct, totalPoints, maxed } = progress;
    if (this.homeRankTitle) this.homeRankTitle.textContent = current.title;
    if (this.homeTotalPoints) {
      this.homeTotalPoints.textContent = formatPoints(totalPoints) + ' pts cumulés';
    }
    const bubblePct = maxed ? 100 : Math.max(8, Math.min(92, pct));
    if (this.homeProgressFill) this.homeProgressFill.style.width = bubblePct + '%';
    if (this.homeProgressBubble) this.homeProgressBubble.style.left = bubblePct + '%';
    if (this.homeProgressReward) {
      this.homeProgressReward.textContent = maxed
        ? 'Champion · tous les paliers atteints'
        : getNextRewardLabel(totalPoints);
    }
    if (this.homeProgressPts) {
      this.homeProgressPts.textContent = maxed
        ? formatPoints(totalPoints) + ' pts'
        : `${formatPoints(totalPoints)} / ${formatPoints(next.threshold)}`;
    }
  }

  buildStatsPanel() {
    if (!this.statsPanel) return;
    const s = loadLifetimeStats();
    const champBest = loadChampBest();
    const rows = [
      ['Points cumulés', formatPoints(s.totalPoints || 0)],
      ['Rang actuel', getTierProgress(s.totalPoints || 0).current.title],
      ['Parties', s.runs],
      ['Victoires', s.wins],
      ['Éliminations', s.kills],
      ['Frôlements', s.nearMisses],
      ['Meilleur combo', '×' + s.bestMultiplier],
      ['Championnats gagnés', s.championshipsWon],
      ['Record championnat', champBest > 0 ? champBest + ' pts' : '—'],
    ];
    this.statsPanel.innerHTML = rows.map(([label, value]) =>
      `<div class="stats-row"><span class="stats-label">${label}</span><span class="stats-value">${value}</span></div>`
    ).join('');
  }

  updateLaunchChallengeBtn() {
    if (!this.launchChallengeBtn) return;
    const ch = this.activeChallengeId
      ? CHALLENGES.find(c => c.id === this.activeChallengeId) : null;
    const done = loadChallenges();
    const show = ch && !done[ch.id];
    this.launchChallengeBtn.classList.toggle('hidden', !show);
    if (show) {
      const cfg = getChallengeLaunchConfig(ch.id);
      const hint = cfg.mode === 'championship'
        ? 'Championnat'
        : (ARENAS.find(a => a.id === cfg.arenaId)?.name ?? cfg.arenaId);
      this.launchChallengeBtn.textContent = `▶ Lancer « ${ch.name} » (${hint})`;
    }
  }

  showScreen(id) {
    if (!SCREENS.includes(id)) return;
    this.currentScreen = id;
    for (const [key, el] of Object.entries(this.screenEls)) {
      el?.classList.toggle('hidden', key !== id);
    }
    if (id === 'home') this.updateHomeStats();
    if (id === 'custom') {
      this.buildSkinPicker();
      this.applyScoreColor();
      this.startBikePreview();
    } else {
      this.stopBikePreview();
    }
    if (id === 'trophies') {
      this.buildStatsPanel();
      this.buildChallengesList();
    }
    if (id === 'play') this.buildArenaList();
    if (id === 'options') this.syncOptionsUI();
  }

  buildSkinPicker() {
    if (!this.skinPicker) return;
    syncEarnedSkins();
    const current = loadSkin();
    this.skinPicker.innerHTML = '';
    BIKE_SKINS.forEach(skin => {
      const unlocked = isSkinUnlocked(skin.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skin-btn' +
        (skin.id === current ? ' selected' : '') +
        (!unlocked ? ' locked' : '') +
        (skin.tier === 'premium' ? ' tier-premium' : '') +
        (skin.tier === 'progression' ? ' tier-progression' : '');
      btn.innerHTML =
        `<span class="skin-tier">${SKIN_TIER_LABELS[skin.tier] || skin.tier}</span>` +
        `<span class="skin-name">${skin.name}</span>` +
        `<span class="skin-desc">${unlocked ? skin.desc : skinLockHint(skin)}</span>` +
        (!unlocked ? '<span class="skin-lock">🔒</span>' : '');
      btn.addEventListener('click', () => {
        if (!unlocked) {
          if (this.skinPickerHint) this.skinPickerHint.textContent = skinLockHint(skin);
          return;
        }
        saveSkin(skin.id);
        if (skin.model) preloadBikeModels([getBikeSkin(skin.id)]);
        if (this.skinPickerHint) this.skinPickerHint.textContent = '';
        this.buildSkinPicker();
        this.applyScoreColor();
        this.bikePreview?.refresh();
      });
      this.skinPicker.appendChild(btn);
    });
  }

  async startBikePreview() {
    if (!this.bikePreview) return;
    await this.bikePreview.init();
    this.bikePreview.resize();
    this.bikePreview.start();
  }

  stopBikePreview() {
    this.bikePreview?.stop();
  }

  resizeBikePreview() {
    this.bikePreview?.resize();
  }

  buildChallengesList() {
    if (!this.challengesList) return;
    syncEarnedSkins();
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
    this.updateLaunchChallengeBtn();
    this.updateHomeStats();
  }

  buildArenaList() {
    if (!this.arenaList) return;
    this.arenaList.innerHTML = '';
    const lastArena = loadArenaPref();
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
      btn.className = 'arena-btn' + (a.id === lastArena ? ' arena-recent' : '');
      btn.innerHTML =
        `<div class="arena-btn-name">${a.name}</div>` +
        `<div class="arena-btn-desc">${ARENA_DESC[a.id] || ''}</div>` +
        `<div class="arena-btn-best">Record : ${loadArenaBest(a.id).toLocaleString('fr-FR')}</div>`;
      btn.addEventListener('click', () => this.onStartArena?.(a.id));
      this.arenaList.appendChild(btn);
    });
  }

  buildHomeMenu() {
    this.applyScoreColor();
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
    this.champHudEl?.classList.add('hidden');
    this.homeMenu.classList.remove('hidden');
    this.overlay.classList.add('hidden');
    this.controls.classList.add('hidden');
    this.hideGameHud();
    this.hudFx.reset();
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

  hideGameHud() {
    this.gameHud?.classList.add('hidden');
  }

  showGameHud() {
    this.gameHud?.classList.remove('hidden');
    this.hudFx.reset();
    this.applyScoreColor();
  }

  showControls() {
    this.controls.classList.remove('hidden');
  }

  updateHud(sim, arena, now, playing, championship = null) {
    this.arenaNameEl.textContent = arena.name;
    this.highScoreEl.textContent = 'REC ' + this.highScore.toLocaleString('fr-FR');
    this.scoreEl.textContent = sim.score.toLocaleString('fr-FR');
    const rivals = sim.aliveRiders().length - (sim.getPlayer()?.alive ? 1 : 0);
    this.rivalsEl.textContent = rivals > 0
      ? rivals + ' rival' + (rivals > 1 ? 's' : '')
      : 'DERNIER EN VIE !';
    if (playing) this.timerEl.textContent = this.formatTime(sim.getElapsedSeconds(now));
    const ch = this.activeChallengeId
      ? CHALLENGES.find(c => c.id === this.activeChallengeId) : null;
    if (this.challengeHudEl) {
      this.challengeHudEl.textContent = ch ? '★ ' + ch.name : '';
      this.challengeHudEl.classList.toggle('hidden', !ch);
    }

    this.hudFx.tick(sim);

    if (championship?.active && this.champHudEl) {
      const p = championship.standings.find(s => s.isPlayer);
      this.champHudEl.classList.remove('hidden');
      this.champHudEl.textContent =
        `M${Math.min(championship.round + 1, championship.totalRounds)}/${championship.totalRounds} · ${p?.points ?? 0} pts`;
    } else {
      this.champHudEl?.classList.add('hidden');
    }
  }

  setOverlayActions(mode) {
    const showActions = mode === 'arcadeEnd';
    this.overlayActions?.classList.toggle('hidden', !showActions);
    this.overlayHint?.classList.toggle('hidden', showActions);
  }

  resetOverlayCard() {
    this.overlayTrophies?.classList.add('hidden');
    this.trophyUnlockList && (this.trophyUnlockList.innerHTML = '');
    this.overlayStats && (this.overlayStats.innerHTML = '');
    this.overlayBadge?.classList.add('hidden');
    this.overlayRecord?.classList.add('hidden');
    this.overlay.querySelector('.overlay-card')?.classList.remove('compact');
  }

  showUnlockCelebration(challenges = [], tiers = []) {
    if (!this.overlayTrophies || !this.trophyUnlockList) return;
    const cards = [
      ...challenges.map(c => ({
        star: '★',
        name: c.name,
        desc: c.desc,
      })),
      ...tiers.map(t => {
        const skin = t.skinId ? getBikeSkin(t.skinId) : null;
        return {
          star: '◈',
          name: `Palier ${t.title}`,
          desc: skin ? `Véhicule débloqué · ${skin.name}` : t.title,
        };
      }),
    ];
    if (!cards.length) {
      this.overlayTrophies.classList.add('hidden');
      this.trophyUnlockList.innerHTML = '';
      return;
    }
    this.overlayTrophies.classList.remove('hidden');
    const head = this.overlayTrophies.querySelector('.trophy-celebrate-head span:nth-child(2)');
    if (head) {
      head.textContent = tiers.length && !challenges.length
        ? 'PALIER ATTEINT'
        : tiers.length
          ? 'RÉCOMPENSES DÉBLOQUÉES'
          : 'TROPHÉES DÉBLOQUÉS';
    }
    this.trophyUnlockList.innerHTML = cards.map((c, i) =>
      `<div class="trophy-unlock-card" style="animation-delay:${i * 130}ms">` +
      `<span class="trophy-unlock-star">${c.star}</span>` +
      `<div><div class="trophy-unlock-name">${c.name}</div>` +
      `<div class="trophy-unlock-desc">${c.desc}</div></div></div>`
    ).join('');
  }

  showTrophyCelebration(unlocked) {
    this.showUnlockCelebration(unlocked, []);
  }

  showChampionshipRoundResults(championship, roundResults) {
    this.resetOverlayCard();
    this.overlayMode = 'champRound';
    this.setOverlayActions('champ');
    const lines = roundResults.map(r =>
      `${r.place}. ${r.name}  +${r.pointsEarned}`
    ).join('\n');
    this.overlayBadge.textContent = 'MANCHE';
    this.overlayBadge.classList.remove('hidden');
    this.overlayTitle.textContent = `${championship.round}/${championship.totalRounds}`;
    this.overlayScore.textContent = lines;
    const p = championship.standings.find(s => s.isPlayer);
    this.overlayBest.textContent = 'Total : ' + (p?.points ?? 0) + ' pts';
    this.overlayNext.textContent = championship.isComplete()
      ? 'Classement final'
      : 'Manche suivante';
    this.overlayHint.textContent = 'Toucher pour continuer';
    this.overlay.classList.remove('hidden');
    this.controls.classList.add('hidden');
    this.overlay.querySelector('.overlay-card')?.classList.add('compact');
  }

  showChampionshipFinal(championship) {
    this.resetOverlayCard();
    this.overlayMode = 'champFinal';
    this.setOverlayActions('champ');
    this.overlay.querySelector('.overlay-card')?.classList.add('compact');
    const sorted = championship.getSortedStandings();
    const winner = sorted[0];
    const p = sorted.find(s => s.isPlayer);
    this.overlayBadge.textContent = winner.isPlayer ? 'CHAMPION' : 'FINAL';
    this.overlayBadge.classList.remove('hidden');
    this.overlayTitle.textContent = winner.isPlayer ? 'TU GAGNES !' : winner.name + ' gagne';
    this.overlayScore.textContent = sorted.map((s, i) =>
      `${i + 1}. ${s.name}  —  ${s.points} pts`
    ).join('\n');
    this.overlayBest.textContent = p ? `${sorted.indexOf(p) + 1}e place · ${p.points} pts` : '';
    this.overlayNext.textContent = '';
    this.overlayHint.textContent = 'Toucher pour revenir au menu';
    this.overlay.classList.remove('hidden');
  }

  showGameOver(sim, arena, won, now) {
    this.lastArcadeArenaId = arena.id;
    this.resetOverlayCard();
    const time = sim.getElapsedSeconds(now);
    const rank = won ? 1 : 1 + sim.aliveBots().length;
    const rec = sim.score > this.highScore;
    if (rec) { this.highScore = sim.score; saveHighScore(this.highScore); }
    const arenaRec = sim.score > loadArenaBest(arena.id);
    if (arenaRec) saveArenaBest(arena.id, sim.score);
    const prevTotal = loadLifetimeStats().totalPoints || 0;
    const lifetime = recordRunEnd({
      won, kills: sim.kills, nearMisses: sim.nearMissCount, maxMultiplier: sim.maxMultiplier,
      score: sim.score,
    });
    const tierUnlocks = applyTierUnlocks(prevTotal, lifetime.totalPoints || 0);
    const unlocked = checkChallenges({
      won, kills: sim.kills, score: sim.score, time, arenaId: arena.id,
      maxMultiplier: sim.maxMultiplier, nearMisses: sim.nearMissCount, lifetime,
    });
    this.buildChallengesList();
    this.updateHomeProgressBar();

    this.overlayBadge.textContent = won ? 'VICTOIRE' : 'GAME OVER';
    this.overlayBadge.classList.remove('hidden');
    this.overlayTitle.textContent = won ? 'DERNIER EN VIE !' : arena.name;
    this.overlayScore.textContent = sim.score.toLocaleString('fr-FR');
    this.overlayStats.innerHTML =
      `<span>${won ? '1er' : rank + 'e'}</span>` +
      `<span>×${sim.maxMultiplier} combo</span>` +
      `<span>${sim.nearMissCount} frôlements</span>` +
      (sim.kills ? `<span>${sim.kills} kill${sim.kills > 1 ? 's' : ''}</span>` : '') +
      `<span>${this.formatTime(time)}</span>`;
    const winTxt = won ? ' · bonus victoire' : '';
    this.overlayBest.textContent = arenaRec
      ? 'Record arène !' + winTxt
      : 'Record global : ' + this.highScore.toLocaleString('fr-FR') + winTxt;
    if (lifetime.totalPoints != null) {
      const gained = Math.max(0, (lifetime.totalPoints || 0) - prevTotal);
      if (gained > 0) {
        this.overlayBest.textContent += ` · +${formatPoints(gained)} cumulés`;
      }
    }
    this.overlayRecord.classList.toggle('hidden', !rec);
    this.showUnlockCelebration(unlocked, tierUnlocks);
    this.overlayNext.textContent = arena.name;
    this.overlayMode = 'arcadeEnd';
    this.overlayHint.textContent = '';
    this.setOverlayActions('arcadeEnd');
    this.overlay.classList.remove('hidden');
    this.controls.classList.add('hidden');
    if (this.challengeHudEl) this.challengeHudEl.textContent = '';
  }

  onGameEvent(event, sim) {
    this.hudFx.onGameEvent(event, sim);
  }

  bindMenuNavigation() {
    if (this._menuNavBound) return;
    this._menuNavBound = true;
    window.addEventListener('lc-menu-nav', (e) => {
      const id = e.detail?.id;
      if (id) this.showScreen(id);
    });
  }

  bind(onStartArena, onShowMenu, onTurn, onSettingsChange, onStartChampionship, onContinueChampionship, onLaunchChallenge, onReplay) {
    this.bindMenuNavigation();
    this.onStartArena = onStartArena;
    this.onShowMenu = onShowMenu;
    this.onSettingsChange = onSettingsChange;
    this.onStartChampionship = onStartChampionship;
    this.onContinueChampionship = onContinueChampionship;
    this.onLaunchChallenge = onLaunchChallenge;
    this.onReplay = onReplay;

    this.bindOptions();

    const bindBtn = (btn, dir) => {
      if (!btn) return;
      const press = e => { e.preventDefault(); btn.classList.add('pressed'); onTurn(dir); };
      const release = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
    };
    bindBtn(this.btnLeft, 'left');
    bindBtn(this.btnRight, 'right');

    this.overlay?.addEventListener('pointerdown', e => {
      if (e.target.closest('#overlay-actions')) return;
      e.preventDefault();
      if (this.overlayMode === 'champRound' || this.overlayMode === 'champFinal') {
        onContinueChampionship?.();
      } else if (this.overlayMode !== 'arcadeEnd') {
        onShowMenu();
      }
    });
    this.overlayReplayBtn?.addEventListener('click', e => {
      e.stopPropagation();
      onReplay?.();
    });
    this.overlayMenuBtn?.addEventListener('click', e => {
      e.stopPropagation();
      onShowMenu();
    });
    this.launchChallengeBtn?.addEventListener('click', () => {
      if (!this.activeChallengeId) return;
      onLaunchChallenge?.(this.activeChallengeId);
    });
    this.arenaRandomBtn?.addEventListener('click', () => onStartArena('random'));
    document.getElementById('start-championship')?.addEventListener('click', () => onStartChampionship?.());
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') onTurn('left');
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') onTurn('right');
    });
  }
}
