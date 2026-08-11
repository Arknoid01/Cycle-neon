import * as THREE from 'three';
import { createElectricMaterial, AXIS_X, AXIS_Y, AXIS_Z } from './electric-shader.js';

export const CHASSIS_PRESETS = [
  {
    id: 'classic',
    name: 'Classique',
    desc: 'Silhouette équilibrée',
    noseW: 0.26, noseH: 0.1, noseZ: 0.34,
    chassisW: 0.42, chassisH: 0.14, chassisZ: 0.82,
    canopyW: 0.34, canopyH: 0.08, canopyZ: 0.28,
    wheelR: 0.15, stripIntensity: 1.0,
  },
  {
    id: 'racer',
    name: 'Racer',
    desc: 'Nez allongé, profil bas',
    noseW: 0.22, noseH: 0.09, noseZ: 0.44,
    chassisW: 0.38, chassisH: 0.12, chassisZ: 0.88,
    canopyW: 0.28, canopyH: 0.07, canopyZ: 0.24,
    wheelR: 0.13, stripIntensity: 1.15,
  },
  {
    id: 'tank',
    name: 'Tank',
    desc: 'Large et imposant',
    noseW: 0.32, noseH: 0.12, noseZ: 0.28,
    chassisW: 0.48, chassisH: 0.18, chassisZ: 0.76,
    canopyW: 0.42, canopyH: 0.1, canopyZ: 0.3,
    wheelR: 0.17, stripIntensity: 0.85,
  },
  {
    id: 'blade',
    name: 'Lame',
    desc: 'Avant effilé, aérodynamique',
    noseW: 0.18, noseH: 0.08, noseZ: 0.5,
    chassisW: 0.36, chassisH: 0.11, chassisZ: 0.74,
    canopyW: 0.26, canopyH: 0.07, canopyZ: 0.22,
    wheelR: 0.12, stripIntensity: 1.25,
  },
];

export function getChassisPreset(id) {
  return CHASSIS_PRESETS.find(c => c.id === id) || CHASSIS_PRESETS[0];
}

export function buildProceduralBike(def, chassis, trackElectric) {
  const g = new THREE.Group();
  const c = chassis || CHASSIS_PRESETS[0];
  const track = trackElectric || (() => {});

  const roofStripMat = createElectricMaterial({
    color: def.glow, sparkColor: def.wheel, intensity: 0.95 * c.stripIntensity, body: 0.48,
    acrossDir: AXIS_Y,
  });
  const sideStripMat = createElectricMaterial({
    color: def.glow, sparkColor: def.wheel, intensity: 0.95 * c.stripIntensity, body: 0.48,
    acrossDir: AXIS_X,
  });
  const underglowMat = createElectricMaterial({
    color: def.trailGlow, sparkColor: def.wheel, intensity: 0.75 * c.stripIntensity, body: 0.35, opacity: 0.85,
    acrossDir: AXIS_Z,
  });
  track(roofStripMat);
  track(sideStripMat);
  track(underglowMat);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: def.body, emissive: def.glow, emissiveIntensity: 0.85,
    metalness: 0.55, roughness: 0.28,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x080818, emissive: def.glow, emissiveIntensity: 0.35,
    metalness: 0.4, roughness: 0.45,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: def.wheel, emissive: def.wheel, emissiveIntensity: 1.2,
    metalness: 0.6, roughness: 0.2,
  });

  const chassisMesh = new THREE.Mesh(
    new THREE.BoxGeometry(c.chassisW, c.chassisH, c.chassisZ), darkMat
  );
  chassisMesh.position.y = 0.19;
  g.add(chassisMesh);

  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(c.noseW, c.noseH, c.noseZ), bodyMat
  );
  nose.position.set(0, 0.24, -(c.chassisZ * 0.42 + c.noseZ * 0.08));
  g.add(nose);

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(c.canopyW, c.canopyH, c.canopyZ), accentMat
  );
  canopy.position.set(0, 0.3, -0.08);
  g.add(canopy);

  const roofStrip = new THREE.Mesh(
    new THREE.BoxGeometry(c.chassisW + 0.06, 0.05, 0.14), roofStripMat
  );
  roofStrip.position.set(0, 0.34, 0.02);
  g.add(roofStrip);

  const sideSpread = c.chassisW * 0.52;
  [-sideSpread, sideSpread].forEach(s => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, c.chassisZ * 0.8), sideStripMat);
    side.position.set(s, 0.22, 0.04);
    g.add(side);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(c.wheelR, c.wheelR, 0.04, 20), accentMat);
    disc.rotation.z = Math.PI / 2;
    disc.position.set(s, 0.14, c.chassisZ * 0.24);
    g.add(disc);
  });

  const underglow = new THREE.Mesh(
    new THREE.BoxGeometry(c.chassisW * 0.86, 0.02, c.chassisZ * 0.85), underglowMat
  );
  underglow.position.set(0, 0.1, 0.04);
  g.add(underglow);

  const emitterMat = createElectricMaterial({
    color: def.trailGlow, sparkColor: def.wheel, intensity: 1.05 * c.stripIntensity, body: 0.52,
    acrossDir: AXIS_X,
  });
  track(emitterMat);
  const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.16), emitterMat);
  emitter.position.set(0, 0.28, c.chassisZ * 0.46);
  g.add(emitter);

  g.userData.emitterMat = emitterMat;
  g.userData.isSprite = false;
  return g;
}
