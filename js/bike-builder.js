import * as THREE from 'three';
import { createElectricMaterial, AXIS_X, AXIS_Y, AXIS_Z } from './electric-shader.js';
import { getBikeSkin } from './bike-skins.js';

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

function _createBikeMats(def, chassis, track) {
  const si = chassis.stripIntensity;
  const mats = {
    roofStripMat: createElectricMaterial({
      color: def.glow, sparkColor: def.wheel, intensity: 0.95 * si, body: 0.48, acrossDir: AXIS_Y,
    }),
    sideStripMat: createElectricMaterial({
      color: def.glow, sparkColor: def.wheel, intensity: 0.95 * si, body: 0.48, acrossDir: AXIS_X,
    }),
    underglowMat: createElectricMaterial({
      color: def.trailGlow, sparkColor: def.wheel, intensity: 0.75 * si, body: 0.35, opacity: 0.85,
      acrossDir: AXIS_Z,
    }),
    bodyMat: new THREE.MeshStandardMaterial({
      color: def.body, emissive: def.glow, emissiveIntensity: 0.85,
      metalness: 0.55, roughness: 0.28,
    }),
    darkMat: new THREE.MeshStandardMaterial({
      color: 0x080818, emissive: def.glow, emissiveIntensity: 0.35,
      metalness: 0.4, roughness: 0.45,
    }),
    accentMat: new THREE.MeshStandardMaterial({
      color: def.wheel, emissive: def.wheel, emissiveIntensity: 1.2,
      metalness: 0.6, roughness: 0.2,
    }),
  };
  track(mats.roofStripMat);
  track(mats.sideStripMat);
  track(mats.underglowMat);
  return mats;
}

function _finishBike(g, emitterMat) {
  g.userData.emitterMat = emitterMat;
  g.userData.isSprite = false;
  return g;
}

function _addClassicCore(g, def, c, mats, track, opts = {}) {
  const { ringWheels = false, skipSideStrips = false, metalBody = false } = opts;
  if (metalBody) {
    mats.bodyMat.metalness = 0.92;
    mats.bodyMat.roughness = 0.08;
    mats.bodyMat.emissiveIntensity = 0.45;
  }

  const chassisMesh = new THREE.Mesh(
    new THREE.BoxGeometry(c.chassisW, c.chassisH, c.chassisZ), mats.darkMat
  );
  chassisMesh.position.y = 0.19;
  g.add(chassisMesh);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(c.noseW, c.noseH, c.noseZ), mats.bodyMat);
  nose.position.set(0, 0.24, -(c.chassisZ * 0.42 + c.noseZ * 0.08));
  g.add(nose);

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(c.canopyW, c.canopyH, c.canopyZ), mats.accentMat
  );
  canopy.position.set(0, 0.3, -0.08);
  g.add(canopy);

  const roofStrip = new THREE.Mesh(
    new THREE.BoxGeometry(c.chassisW + 0.06, 0.05, 0.14), mats.roofStripMat
  );
  roofStrip.position.set(0, 0.34, 0.02);
  g.add(roofStrip);

  const sideSpread = c.chassisW * 0.52;
  [-sideSpread, sideSpread].forEach(s => {
    if (!skipSideStrips) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, c.chassisZ * 0.8), mats.sideStripMat);
      side.position.set(s, 0.22, 0.04);
      g.add(side);
    }
    if (ringWheels) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(c.wheelR, 0.025, 8, 24), mats.accentMat
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.set(s, 0.14, c.chassisZ * 0.24);
      g.add(ring);
    } else {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(c.wheelR, c.wheelR, 0.04, 20), mats.accentMat
      );
      disc.rotation.z = Math.PI / 2;
      disc.position.set(s, 0.14, c.chassisZ * 0.24);
      g.add(disc);
    }
  });

  const underglow = new THREE.Mesh(
    new THREE.BoxGeometry(c.chassisW * 0.86, 0.02, c.chassisZ * 0.85), mats.underglowMat
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
  return emitterMat;
}

function buildClassicKit(def, chassis, track) {
  const g = new THREE.Group();
  const mats = _createBikeMats(def, chassis, track);
  const emitterMat = _addClassicCore(g, def, chassis, mats, track);
  return _finishBike(g, emitterMat);
}

function buildPhantomKit(def, chassis, track) {
  const g = new THREE.Group();
  const c = { ...chassis, chassisH: chassis.chassisH * 0.88, canopyH: chassis.canopyH * 0.85 };
  const mats = _createBikeMats(def, c, track);
  mats.accentMat.emissiveIntensity = 1.55;
  const emitterMat = _addClassicCore(g, def, c, mats, track, { ringWheels: true, skipSideStrips: true });
  return _finishBike(g, emitterMat);
}

function buildVanguardKit(def, chassis, track) {
  const g = new THREE.Group();
  const mats = _createBikeMats(def, chassis, track);
  const emitterMat = _addClassicCore(g, def, chassis, mats, track);
  const spread = chassis.chassisW * 0.62;
  [-spread, spread].forEach(s => {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.08), mats.sideStripMat);
    pylon.position.set(s, 0.32, chassis.chassisZ * 0.08);
    g.add(pylon);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.1), mats.accentMat);
    cap.position.set(s, 0.5, chassis.chassisZ * 0.08);
    g.add(cap);
  });
  return _finishBike(g, emitterMat);
}

function buildSpecterKit(def, chassis, track) {
  const g = new THREE.Group();
  const mats = _createBikeMats(def, chassis, track);
  const c = chassis;

  const chassisMesh = new THREE.Mesh(
    new THREE.BoxGeometry(c.chassisW, c.chassisH, c.chassisZ), mats.darkMat
  );
  chassisMesh.position.y = 0.19;
  g.add(chassisMesh);

  const noseZ = -(c.chassisZ * 0.42 + c.noseZ * 0.08);
  const noseL = new THREE.Mesh(new THREE.BoxGeometry(c.noseW * 0.42, c.noseH, c.noseZ * 0.9), mats.bodyMat);
  noseL.position.set(-c.noseW * 0.26, 0.24, noseZ);
  g.add(noseL);
  const noseR = new THREE.Mesh(new THREE.BoxGeometry(c.noseW * 0.42, c.noseH, c.noseZ * 0.9), mats.bodyMat);
  noseR.position.set(c.noseW * 0.26, 0.24, noseZ);
  g.add(noseR);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(c.canopyW * 0.7, c.canopyH, c.canopyZ), mats.accentMat);
  canopy.position.set(0, 0.3, -0.08);
  g.add(canopy);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.34), mats.sideStripMat);
  fin.position.set(0, 0.4, c.chassisZ * 0.15);
  g.add(fin);

  const roofStrip = new THREE.Mesh(
    new THREE.BoxGeometry(c.chassisW + 0.04, 0.04, 0.12), mats.roofStripMat
  );
  roofStrip.position.set(0, 0.34, 0.02);
  g.add(roofStrip);

  const sideSpread = c.chassisW * 0.52;
  [-sideSpread, sideSpread].forEach(s => {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(c.wheelR, c.wheelR, 0.04, 20), mats.accentMat);
    disc.rotation.z = Math.PI / 2;
    disc.position.set(s, 0.14, c.chassisZ * 0.24);
    g.add(disc);
  });

  const underglow = new THREE.Mesh(
    new THREE.BoxGeometry(c.chassisW * 0.86, 0.02, c.chassisZ * 0.85), mats.underglowMat
  );
  underglow.position.set(0, 0.1, 0.04);
  g.add(underglow);

  const emitterMat = createElectricMaterial({
    color: def.trailGlow, sparkColor: def.wheel, intensity: 1.05 * c.stripIntensity, body: 0.52,
    acrossDir: AXIS_X,
  });
  track(emitterMat);
  const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.14), emitterMat);
  emitter.position.set(0, 0.28, c.chassisZ * 0.46);
  g.add(emitter);
  return _finishBike(g, emitterMat);
}

function buildPulseKit(def, chassis, track) {
  const g = new THREE.Group();
  const mats = _createBikeMats(def, chassis, track);
  const c = chassis;

  const chassisMesh = new THREE.Mesh(
    new THREE.BoxGeometry(c.chassisW, c.chassisH, c.chassisZ), mats.darkMat
  );
  chassisMesh.position.y = 0.19;
  g.add(chassisMesh);

  const nose = new THREE.Mesh(new THREE.CylinderGeometry(c.noseW * 0.55, c.noseW * 0.7, c.noseZ, 10), mats.bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.24, -(c.chassisZ * 0.4 + c.noseZ * 0.15));
  g.add(nose);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(c.canopyW * 0.38, 12, 10), mats.accentMat);
  canopy.position.set(0, 0.32, -0.06);
  g.add(canopy);

  const sideSpread = c.chassisW * 0.48;
  [-sideSpread, sideSpread].forEach(s => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.1, c.chassisZ * 0.7), mats.sideStripMat);
    side.position.set(s, 0.22, 0.04);
    g.add(side);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(c.wheelR * 0.85, c.wheelR * 0.85, 0.035, 16), mats.accentMat
    );
    disc.rotation.z = Math.PI / 2;
    disc.position.set(s, 0.14, c.chassisZ * 0.22);
    g.add(disc);
  });

  const underglow = new THREE.Mesh(
    new THREE.BoxGeometry(c.chassisW * 0.8, 0.02, c.chassisZ * 0.8), mats.underglowMat
  );
  underglow.position.set(0, 0.1, 0.04);
  g.add(underglow);

  const emitterMat = createElectricMaterial({
    color: def.trailGlow, sparkColor: def.wheel, intensity: 1.2 * c.stripIntensity, body: 0.58,
    acrossDir: AXIS_X,
  });
  track(emitterMat);
  const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), emitterMat);
  emitter.position.set(0, 0.3, c.chassisZ * 0.44);
  g.add(emitter);
  return _finishBike(g, emitterMat);
}

function buildInfernoKit(def, chassis, track) {
  const g = new THREE.Group();
  const mats = _createBikeMats(def, chassis, track);
  const emitterMat = _addClassicCore(g, def, chassis, mats, track);
  const c = chassis;
  const noseZ = -(c.chassisZ * 0.42 + c.noseZ * 0.08);
  [-1, 1].forEach(sign => {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 6), mats.accentMat);
    spike.rotation.x = -Math.PI / 2;
    spike.rotation.z = sign * 0.35;
    spike.position.set(sign * c.noseW * 0.55, 0.28, noseZ - 0.06);
    g.add(spike);
  });
  return _finishBike(g, emitterMat);
}

function buildChromeKit(def, chassis, track) {
  const g = new THREE.Group();
  const mats = _createBikeMats(def, chassis, track);
  const emitterMat = _addClassicCore(g, def, chassis, mats, track, {
    skipSideStrips: true,
    metalBody: true,
  });
  return _finishBike(g, emitterMat);
}

const KIT_BUILDERS = {
  classic: buildClassicKit,
  phantom: buildPhantomKit,
  vanguard: buildVanguardKit,
  specter: buildSpecterKit,
  pulse: buildPulseKit,
  inferno: buildInfernoKit,
  chrome: buildChromeKit,
};

export function buildBikeSkin(def, skin, trackElectric) {
  const skinDef = typeof skin === 'string' ? getBikeSkin(skin) : skin;
  const chassis = getChassisPreset(skinDef?.chassisId || 'classic');
  const track = trackElectric || (() => {});
  const builder = KIT_BUILDERS[skinDef?.kit] || buildClassicKit;
  return builder(def, chassis, track);
}

export function buildProceduralBike(def, chassis, trackElectric) {
  return buildClassicKit(def, chassis || CHASSIS_PRESETS[0], trackElectric || (() => {}));
}
