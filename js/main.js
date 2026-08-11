import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { pickArena, saveArenaPref } from './arenas.js';
import { Championship, loadChampBest, saveChampBest } from './championship.js';
import { getSettings } from './settings.js';
import {
  initAudio, unlockAudio, updateEngineSound, updateGameplayIntensity, stopEngine, setMasterVolume,
  playTurn, playWallShift, playWallWarn, playNearMissBonus, playCrash,
  playBotDeath, playKillBonus, playVictory, playMultiplierUp,
} from './audio.js';

const sim = new Simulation();
const renderer = new Renderer(document.getElementById('game'));
const ui = new UI();
const championship = new Championship();

let currentArena = null;
let introUntil = 0;
let menuVisible = true;
let gameMode = 'arcade';

function beginRun(arena, options = {}) {
  initAudio();
  unlockAudio(true);
  currentArena = arena;
  ui.hideMenu();
  menuVisible = false;
  renderer.clearAll(options.riderDefs);
  if (!renderer.scene) renderer.init();
  renderer.setBloomEnabled(getSettings().bloom);
  sim.reset(arena.id, options);
  renderer.syncGrid(sim.grid, sim.walls);
  introUntil = ui.showIntro(arena);
  ui.showControls();
  ui.updateHud(sim, currentArena, performance.now(), true, gameMode === 'championship' ? championship : null);
  updateEngineSound(sim.score, sim.getIntensity());
}

function startArena(id) {
  gameMode = 'arcade';
  saveArenaPref(id);
  beginRun(pickArena(id));
}

function startChampionship() {
  gameMode = 'championship';
  championship.start();
  beginChampionshipRound();
}

function beginChampionshipRound() {
  const arena = championship.nextArena();
  beginRun(arena, { mode: 'championship', riderDefs: championship.getRiderDefs() });
}

function showMenu() {
  stopEngine();
  menuVisible = true;
  gameMode = 'arcade';
  sim.playing = false;
  championship.active = false;
  ui.showMenu();
}

function onTurn(side) {
  if (menuVisible || !sim.playing) return;
  unlockAudio(true);
  const p = sim.getPlayer();
  if (side === 'left') { sim.setTurn((p.dir + 3) % 4); playTurn(); }
  else { sim.setTurn((p.dir + 1) % 4); playTurn(); }
}

function continueChampionship() {
  ui.overlay.classList.add('hidden');
  if (championship.isComplete()) {
    const p = championship.getSortedStandings().find(s => s.isPlayer);
    if (p?.points > loadChampBest()) saveChampBest(p.points);
    showMenu();
    return;
  }
  beginChampionshipRound();
}

function handleEvents(events, now) {
  for (const e of events) {
    switch (e.type) {
      case 'wallMove':
        playWallShift();
        renderer.triggerMobileBurst(now);
        break;
      case 'wallWarn': playWallWarn(); break;
      case 'turn': break;
      case 'scoreTick':
        updateEngineSound(sim.score, sim.getIntensity());
        updateGameplayIntensity(sim.multiplier);
        renderer.setBloomIntensity(sim.getIntensity());
        break;
      case 'nearMiss':
        playNearMissBonus();
        renderer.flashNearMiss();
        break;
      case 'wallNear':
        playNearMissBonus();
        break;
      case 'multiplierUp':
        playMultiplierUp();
        break;
      case 'kill': playBotDeath(); playKillBonus(); break;
      case 'roundEnd': {
        for (const r of sim.deadRiders) renderer.spawnExplosion(r);
        const results = championship.finishRound(e.rankings);
        if (championship.isComplete()) ui.showChampionshipFinal(championship);
        else ui.showChampionshipRoundResults(championship, results);
        break;
      }
      case 'death':
        playCrash();
        for (const r of sim.deadRiders) renderer.spawnExplosion(r);
        ui.showGameOver(sim, currentArena, false, now);
        break;
      case 'victory':
        playVictory();
        for (const r of sim.deadRiders) renderer.spawnExplosion(r);
        ui.showGameOver(sim, currentArena, true, now);
        break;
    }
  }
  if (sim.deadRiders.length) {
    for (const r of sim.deadRiders) renderer.spawnExplosion(r);
    sim.deadRiders.length = 0;
  }
}

function gameLoop(now) {
  if (renderer.scene) {
    sim.updateRenderPositions(now);
    renderer.syncRiders(sim.riders, sim.playing, now, sim.grid, sim.getRenderT(now));
    renderer.updateCamera(sim.getPlayer());
    renderer.syncMobileWarnings(sim.walls, now);
    if (sim.playing) {
      renderer.setBloomIntensity(sim.getIntensity());
      updateGameplayIntensity(sim.multiplier);
    }
  }

  if (sim.shouldSimTick(now, introUntil)) {
    const { events } = sim.simulationTick(now);
    renderer.syncGrid(sim.grid, sim.walls);
    handleEvents(events, now);
    if (sim.playing) {
      ui.updateHud(sim, currentArena, now, true, gameMode === 'championship' ? championship : null);
    }
  }

  renderer.updateExplosions();
  renderer.render();
  requestAnimationFrame(gameLoop);
}

ui.applyScoreColor();
ui.buildHomeMenu();
ui.showMenu();
ui.bind(startArena, showMenu, onTurn, (s) => renderer.setBloomEnabled(s.bloom), startChampionship, continueChampionship);
setMasterVolume(getSettings().volume);
window.addEventListener('resize', () => renderer.resize());
requestAnimationFrame(gameLoop);
