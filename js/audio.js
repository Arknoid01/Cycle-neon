let audioCtx, engineOsc, engineGain;
let masterVolume = 1;

export function setMasterVolume(v) {
  masterVolume = Math.max(0, Math.min(1, v));
}

export function getMasterVolume() {
  return masterVolume;
}

export function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 90;
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
  } catch {}
}

export function unlockAudio(playing) {
  if (!audioCtx) initAudio();
  if (audioCtx?.state === 'suspended') audioCtx.resume();
  if (engineGain && playing) engineGain.gain.value = 0.028 * masterVolume;
}

export function updateEngineSound(score, intensity = 0) {
  if (!engineOsc) return;
  const sp = Math.min(1, score / 120 + intensity * 0.4);
  engineOsc.frequency.setTargetAtTime(70 + sp * 160, audioCtx.currentTime, 0.05);
  engineGain.gain.setTargetAtTime((0.02 + sp * 0.04) * masterVolume, audioCtx.currentTime, 0.05);
}

export function updateGameplayIntensity(multiplier, maxMult = 5) {
  if (!engineOsc) return;
  const t = (multiplier - 1) / Math.max(1, maxMult - 1);
  engineOsc.frequency.setTargetAtTime(90 + t * 120, audioCtx.currentTime, 0.08);
}

export function playMultiplierUp() {
  playTone(680 + Math.random() * 80, .08, 'sine', .06);
  haptic(12);
}

export function playNearMissBonus() {
  playTone(560, .06, 'sine', .08);
  playTone(880, .05, 'sine', .05);
  haptic(15);
}

export function stopEngine() {
  if (engineGain) engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
}

function playTone(f, d, t, v) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = t || 'square';
  o.frequency.value = f;
  const vol = (v || 0.08) * masterVolume;
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + d);
}

import { getSettings } from './settings.js';

function haptic(pattern) {
  if (!getSettings().haptic) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

export const playTurn = () => { playTone(320, .06, 'square', .05); haptic(10); };
export const playWallShift = () => { playTone(180, .12, 'sawtooth', .06); haptic(18); };
export const playWallWarn = () => { playTone(260, .06, 'sine', .05); };
export const playNearMiss = () => { playTone(520, .08, 'sine', .07); haptic(25); };

export function playCrash() {
  haptic([60, 40, 100, 40, 140]);
  for (let i = 0; i < 5; i++) {
    setTimeout(() => playTone(80 + Math.random() * 200, .15, 'sawtooth', .12), i * 40);
  }
}

export function playBotDeath() {
  playTone(120, .08, 'sawtooth', .05);
}

export function playKillBonus() {
  playTone(640, .1, 'sine', .06);
}

export function playVictory() {
  haptic([20, 30, 20, 30, 40]);
  [440, 554, 659, 880].forEach((f, i) => setTimeout(() => playTone(f, .12, 'sine', .07), i * 80));
}
