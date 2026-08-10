import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { pickArena, saveArenaPref } from './arenas.js';
import {
  initAudio, unlockAudio, updateEngineSound, stopEngine,
  playTurn, playWallShift, playWallWarn, playNearMiss, playCrash,
  playBotDeath, playKillBonus, playVictory,
} from './audio.js';
import { DIR_LEFT, DIR_RIGHT } from './constants.js';

const sim = new Simulation();
const renderer = new Renderer(document.getElementById('game'));
const ui = new UI();

let currentArena = null;
let introUntil = 0;
let menuVisible = true;

function startArena(id) {
  initAudio();
  unlockAudio(true);
  currentArena = pickArena(id);
  saveArenaPref(id);
  ui.hideMenu();
  menuVisible = false;
  renderer.clearAll();
  if (!renderer.scene) renderer.init();
  sim.reset(currentArena.id);
  renderer.syncGrid(sim.grid);
  introUntil = ui.showIntro(currentArena);
  ui.showControls();
  ui.updateHud(sim, currentArena, performance.now(), true);
  updateEngineSound(sim.score);
}

function showMenu() {
  stopEngine();
  menuVisible = true;
  sim.playing = false;
  ui.showMenu();
}

function onTurn(side) {
  if (menuVisible || !sim.playing) return;
  unlockAudio(true);
  if (side === 'left') { sim.setTurn((sim.getPlayer().dir + 3) % 4); playTurn(); }
  else { sim.setTurn((sim.getPlayer().dir + 1) % 4); playTurn(); }
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
      case 'scoreTick': updateEngineSound(sim.score); break;
      case 'kill': playBotDeath(); playKillBonus(); break;
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
  if (sim.checkNearMiss()) playNearMiss();
}

function gameLoop(now) {
  if (renderer.scene) {
    sim.updateRenderPositions(now);
    renderer.updateShaders(now);
    renderer.syncRiders(sim.riders, sim.playing, now);
    renderer.updateCamera(sim.getPlayer());
    renderer.syncMobileWarnings(sim.walls, now);
  }

  if (sim.shouldSimTick(now, introUntil)) {
    const { events } = sim.simulationTick(now);
    renderer.syncGrid(sim.grid, sim.walls);
    handleEvents(events, now);
    if (sim.playing) ui.updateHud(sim, currentArena, now, true);
  }

  renderer.updateExplosions();
  renderer.render();
  requestAnimationFrame(gameLoop);
}

ui.applyScoreColor();
ui.buildArenaMenu();
ui.showMenu();
ui.bind(startArena, showMenu, onTurn);
window.addEventListener('resize', () => renderer.resize());
requestAnimationFrame(gameLoop);
