import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { getActiveSkin, getRiderColorDef } from './cosmetics.js';
import { createBikeMesh, pulseBikeMaterials, disposeBikeMesh } from './bike-model-loader.js';
import { updateSpriteBike } from './bike-sprite-loader.js';
import { BIKE_SCALE } from './constants.js';

export class BikePreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.bike = null;
    this.electricMats = [];
    this.active = false;
    this.raf = 0;
    this._buildGen = 0;
  }

  _disposeBike() {
    if (!this.bike) return;
    this.scene.remove(this.bike);
    disposeBikeMesh(this.bike);
    this.bike = null;
    this.electricMats = [];
  }

  async _rebuildBike() {
    if (!this.scene) return;
    const gen = ++this._buildGen;
    this._disposeBike();
    const skin = getActiveSkin();
    const def = { ...getRiderColorDef(skin), skinId: skin.id, skin };
    const bike = await createBikeMesh(def, skin, m => this.electricMats.push(m));
    if (gen !== this._buildGen) {
      disposeBikeMesh(bike);
      return;
    }
    this.bike = bike;
    this.bike.position.y = 0.05;
    this.bike.rotation.y = 0;
    this.bike.scale.setScalar(BIKE_SCALE);
    this.scene.add(this.bike);
    if (this.bike.userData.isSpriteBike) {
      updateSpriteBike(this.bike, this.camera.position, { forceView: 'back', dir: 0 });
      // Aperçu statique (pas de boucle par frame ici) : caler la largeur
      // directement plutôt que de laisser l'animation à mi-chemin pour toujours.
      const plane = this.bike.userData.spritePlane;
      plane.scale.x = this.bike.userData.targetPlaneWidth;
    }
  }

  async init() {
    if (!this.canvas || this.scene) return;
    const w = this.canvas.clientWidth || 320;
    const h = this.canvas.clientHeight || 160;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040c);

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 50);
    this.camera.position.set(1.7 * BIKE_SCALE, 0.55 * BIKE_SCALE, 0);
    this.camera.lookAt(0, 0.32 * BIKE_SCALE, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;

    this.scene.add(new THREE.AmbientLight(0x223355, 0.35));
    const key = new THREE.DirectionalLight(0x7df9ff, 0.45);
    key.position.set(2, 4, 3);
    this.scene.add(key);

    const grid = new THREE.GridHelper(4, 8, 0x006644, 0x002211);
    grid.position.y = -0.01;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    this.scene.add(grid);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.3, 0.75));

    await this._rebuildBike();
  }

  refresh() {
    this._rebuildBike();
  }

  start() {
    if (this.active) return;
    this.active = true;
    const tick = (now) => {
      if (!this.active) return;
      this.raf = requestAnimationFrame(tick);
      if (this.bike) {
        pulseBikeMaterials(this.bike, now);
      }
      this.composer?.render();
    };
    tick(performance.now());
  }

  stop() {
    this.active = false;
    cancelAnimationFrame(this.raf);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const w = this.canvas.clientWidth || 320;
    const h = this.canvas.clientHeight || 160;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
  }
}
