import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  CELL_WALL, TRAIL_BASE, isTrail, CELL_SIZE, WALL_H, TRAIL_H, PERIM_H,
  CAM_DIR_ANGLES,
} from './constants.js';
import { getRiderDefs } from './cosmetics.js';
import { gridDimensions } from './grid.js';
import { createElectricMaterial, updateElectricMaterial } from './electric-shader.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.bloomPass = null;
    this.cellMeshes = new Map();
    this.riderMeshes = new Map();
    this.liveTrails = new Map();
    this.trailMats = [];
    this.electricMats = [];
    this.explosions = [];
    this.matWall = null;
    this.matMobile = null;
    this.matPerimeter = null;
    this.panelGeo = null;
    this.segGeo = null;
    this.mobileBurstUntil = 0;
    this.smoothCamX = 0;
    this.smoothCamZ = 0;
    this.smoothCamAngle = -Math.PI / 2;
    this.camReady = false;
    this._worldPos = new THREE.Vector3();
    this._worldPos2 = new THREE.Vector3();
  }

  init() {
    const { w, h } = gridDimensions();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010108);
    this.scene.fog = new THREE.FogExp2(0x010108, 0.03);

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene.add(new THREE.AmbientLight(0x223355, 0.25));

    this.panelGeo = new THREE.BoxGeometry(CELL_SIZE * 0.9, 1, CELL_SIZE * 0.14);
    this.segGeo = new THREE.BoxGeometry(1, 1, CELL_SIZE * 0.14);

    this.matWall = createElectricMaterial({
      color: 0x7c3aed, sparkColor: 0xe9d5ff, speed: 0.9, intensity: 1.8, scale: 1.0, body: 0.2,
    });
    this.matMobile = createElectricMaterial({
      color: 0xff6600, sparkColor: 0xffffee, speed: 1.4, intensity: 2.0, scale: 1.2, body: 0.22,
    });
    this.matPerimeter = createElectricMaterial({
      color: 0x9333ea, sparkColor: 0xfaf5ff, speed: 0.7, intensity: 1.7, scale: 0.85, body: 0.24,
    });
    this._rebuildTrailMats();

    const floorSize = Math.max(w, h);
    const floor = new THREE.GridHelper(floorSize, w, 0x00ff88, 0x002211);
    floor.position.y = 0.005;
    floor.material.transparent = true;
    floor.material.opacity = 0.4;
    this.scene.add(floor);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.52, 0.32, 0.58
    );
    this.composer.addPass(this.bloomPass);
  }

  _trackElectric(mat) {
    if (!this.electricMats.includes(mat)) this.electricMats.push(mat);
  }

  _rebuildTrailMats(defs) {
    const list = defs ?? getRiderDefs();
    this.trailMats = list.map(d => {
      const mat = createElectricMaterial({
        color: d.trailGlow, sparkColor: 0xccffff,
        speed: 2.0, intensity: 2.4, scale: 1.15, body: 0.2,
      });
      this._trackElectric(mat);
      return mat;
    });
    this.electricMats = [
      this.matWall, this.matMobile, this.matPerimeter, ...this.trailMats,
    ].filter(Boolean);
  }

  prepareRiders(riderDefs) {
    this._rebuildTrailMats(riderDefs);
  }

  _cellKey(x, y) { return x + ',' + y; }

  gridToWorld(gx, gy, out) {
    const { w, h } = gridDimensions();
    const v = out || this._worldPos;
    v.set((gx - w / 2 + 0.5) * CELL_SIZE, 0, (gy - h / 2 + 0.5) * CELL_SIZE);
    return v;
  }

  clearAll(riderDefs) {
    this.cellMeshes.forEach(m => this.scene.remove(m));
    this.cellMeshes.clear();
    this.riderMeshes.forEach(g => this.scene.remove(g));
    this.riderMeshes.clear();
    this.liveTrails.forEach(g => this.scene.remove(g));
    this.liveTrails.clear();
    this.explosions.forEach(e => {
      this.scene.remove(e.points);
      e.points.geometry.dispose();
      e.points.material.dispose();
    });
    this.explosions = [];
    this.mobileBurstUntil = 0;
    this.electricMats = [];
    this._rebuildTrailMats(riderDefs);
    this.camReady = false;
  }

  syncGrid(grid, wallSystem) {
    const toRemove = [];
    this.cellMeshes.forEach((mesh, key) => {
      const [x, y] = key.split(',').map(Number);
      if (grid.get(x, y) === 0) toRemove.push(key);
    });
    toRemove.forEach(key => {
      this.scene.remove(this.cellMeshes.get(key));
      this.cellMeshes.delete(key);
    });

    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const val = grid.get(x, y);
        const key = this._cellKey(x, y);
        if (val === 0) continue;
        if (this.cellMeshes.has(key) && !isTrail(val)) continue;
        this._setCellMesh(x, y, val, grid, wallSystem);
      }
    }
  }

  _isMobileCell(x, y, wallSystem) {
    if (!wallSystem) return false;
    for (const w of wallSystem.walls) {
      for (const c of w.renderPositions()) {
        if (c.x === x && c.y === y) return true;
      }
    }
    return false;
  }

  _setCellMesh(x, y, type, grid, wallSystem) {
    const key = this._cellKey(x, y);
    const existing = this.cellMeshes.get(key);
    if (existing) {
      this.scene.remove(existing);
      this.cellMeshes.delete(key);
    }

    let mat, h;
    if (isTrail(type)) {
      mat = this.trailMats[type - TRAIL_BASE];
      h = TRAIL_H;
    } else if (type === CELL_WALL && grid.isPerimeter(x, y)) {
      mat = this.matPerimeter;
      h = PERIM_H;
    } else if (type === CELL_WALL && this._isMobileCell(x, y, wallSystem)) {
      mat = this.matMobile;
      h = WALL_H;
    } else {
      mat = this.matWall;
      h = WALL_H;
    }

    const mesh = new THREE.Mesh(this.panelGeo, mat);
    const p = this.gridToWorld(x, y);
    mesh.position.set(p.x, h / 2, p.z);
    mesh.scale.y = h;
    this.scene.add(mesh);
    this.cellMeshes.set(key, mesh);
  }

  triggerMobileBurst(now) {
    this.mobileBurstUntil = now + 450;
  }

  syncMobileWarnings(wallSystem, now) {
    const lvl = Math.max(0, ...wallSystem.walls.map(w => w.warningLevel));
    let speed = this.matMobile.userData.baseSpeed;
    let intensity = this.matMobile.userData.baseIntensity;

    if (lvl === 1) { speed = 2.2; intensity = 1.1; }
    else if (lvl === 2) {
      speed = 3.5 + Math.sin(now / 60) * 1.2;
      intensity = 1.35 + Math.sin(now / 45) * 0.35;
    }
    else if (lvl === 3) {
      speed = 6.0 + Math.sin(now / 28) * 2.0;
      intensity = 1.7 + Math.sin(now / 22) * 0.5;
    }

    if (now < this.mobileBurstUntil) {
      speed = 10.0;
      intensity = 2.4;
    }

    updateElectricMaterial(this.matMobile, now * 0.001, { speed, intensity });
  }

  updateShaders(now) {
    const t = now * 0.001;
    for (const mat of this.electricMats) {
      if (mat === this.matMobile) continue;
      updateElectricMaterial(mat, t);
    }
  }

  _buildBike(def) {
    const g = new THREE.Group();
    const stripMat = createElectricMaterial({
      color: def.glow, sparkColor: def.wheel, speed: 3.5, intensity: 1.6, scale: 4, body: 0.35,
    });
    this._trackElectric(stripMat);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: def.body, emissive: def.glow, emissiveIntensity: 1.3,
      metalness: 0.3, roughness: 0.35,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a18, emissive: def.glow, emissiveIntensity: 0.25,
    });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.78), darkMat);
    chassis.position.y = 0.2;
    g.add(chassis);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.32), bodyMat);
    nose.position.set(0, 0.26, -0.28);
    g.add(nose);

    const stripGeo = new THREE.BoxGeometry(0.5, 0.06, 0.12);
    const roofStrip = new THREE.Mesh(stripGeo, stripMat);
    roofStrip.position.set(0, 0.32, 0);
    g.add(roofStrip);

    [-0.2, 0.2].forEach(s => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.62), stripMat);
      side.position.set(s, 0.22, 0.02);
      g.add(side);
    });

    const ringGeo = new THREE.TorusGeometry(0.13, 0.028, 8, 16);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: def.wheel, emissive: def.wheel, emissiveIntensity: 2.2,
    });
    [-0.24, 0.24].forEach(s => {
      const ring = new THREE.Mesh(ringGeo, wheelMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(s, 0.13, 0.22);
      g.add(ring);
    });

    const emitterMat = createElectricMaterial({
      color: def.trailGlow, sparkColor: 0xffffff, speed: 5, intensity: 2, scale: 6, body: 0.4,
    });
    this._trackElectric(emitterMat);
    const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.14), emitterMat);
    emitter.position.set(0, 0.28, 0.36);
    g.add(emitter);

    g.userData.emitterMat = emitterMat;
    return g;
  }

  _buildLiveTrail(mat) {
    const head = new THREE.Mesh(this.panelGeo, mat);
    head.scale.y = TRAIL_H;
    const segment = new THREE.Mesh(this.segGeo, mat);
    segment.scale.y = TRAIL_H;
    segment.visible = false;
    const g = new THREE.Group();
    g.add(head, segment);
    g.userData.head = head;
    g.userData.segment = segment;
    return g;
  }

  _updateLiveTrail(lt, rider) {
    const p = this.gridToWorld(rider.renderX, rider.renderY, this._worldPos);
    const prev = this.gridToWorld(rider.prevX, rider.prevY, this._worldPos2);
    lt.userData.head.position.set(p.x, TRAIL_H / 2, p.z);

    const dx = p.x - prev.x;
    const dz = p.z - prev.z;
    const dist = Math.hypot(dx, dz);
    const seg = lt.userData.segment;
    if (dist > 0.02) {
      seg.visible = true;
      seg.position.set((p.x + prev.x) / 2, TRAIL_H / 2, (p.z + prev.z) / 2);
      seg.rotation.y = -Math.atan2(dz, dx);
      seg.scale.set(dist, TRAIL_H, 1);
    } else {
      seg.visible = false;
    }
  }

  ensureRiderMesh(rider) {
    if (!this.riderMeshes.has(rider.id)) {
      const mesh = this._buildBike(rider.def);
      this.scene.add(mesh);
      this.riderMeshes.set(rider.id, mesh);
    }
    return this.riderMeshes.get(rider.id);
  }

  syncRiders(riders, playing, now = performance.now()) {
    for (const r of riders) {
      if (!r.alive) {
        const mesh = this.riderMeshes.get(r.id);
        if (mesh) mesh.visible = false;
        const lt = this.liveTrails.get(r.id);
        if (lt) { this.scene.remove(lt); this.liveTrails.delete(r.id); }
        continue;
      }
      const mesh = this.ensureRiderMesh(r);
      mesh.visible = true;
      const p = this.gridToWorld(r.renderX, r.renderY, this._worldPos);
      mesh.position.set(p.x, 0, p.z);
      const targetAngle = CAM_DIR_ANGLES[r.dir];
      let diff = targetAngle - r.smoothAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      r.smoothAngle += diff * 0.28;
      mesh.rotation.y = r.smoothAngle;

      if (playing) {
        let lt = this.liveTrails.get(r.id);
        if (!lt) {
          lt = this._buildLiveTrail(this.trailMats[r.id]);
          this.scene.add(lt);
          this.liveTrails.set(r.id, lt);
        }
        this._updateLiveTrail(lt, r);
      }
    }
  }

  spawnExplosion(rider) {
    const p = this.gridToWorld(rider.x, rider.y, this._worldPos);
    const count = 28;
    const positions = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = TRAIL_H + 0.2;
      positions[i * 3 + 2] = p.z;
      vel.push({
        x: (Math.random() - 0.5) * 0.35,
        y: 0.05 + Math.random() * 0.2,
        z: (Math.random() - 0.5) * 0.35,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: rider.def.trailGlow, size: 0.28, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.scene.add(points);
    this.explosions.push({ points, vel, life: 1 });
  }

  updateExplosions() {
    this.explosions = this.explosions.filter(e => {
      e.life -= 0.028;
      const pos = e.points.geometry.attributes.position;
      for (let i = 0; i < e.vel.length; i++) {
        pos.array[i * 3] += e.vel[i].x;
        pos.array[i * 3 + 1] += e.vel[i].y;
        pos.array[i * 3 + 2] += e.vel[i].z;
        e.vel[i].y -= 0.012;
      }
      pos.needsUpdate = true;
      e.points.material.opacity = Math.max(0, e.life);
      if (e.life <= 0) {
        this.scene.remove(e.points);
        e.points.geometry.dispose();
        e.points.material.dispose();
        return false;
      }
      return true;
    });
  }

  updateCamera(player) {
    if (!player?.alive) return;
    const p = this.gridToWorld(player.renderX, player.renderY, this._worldPos);
    const targetAngle = CAM_DIR_ANGLES[player.dir];
    const dist = 14, height = 12.5, lookAhead = 4.5;

    if (!this.camReady) {
      this.smoothCamX = p.x; this.smoothCamZ = p.z;
      this.smoothCamAngle = targetAngle; this.camReady = true;
    }
    this.smoothCamX += (p.x - this.smoothCamX) * 0.18;
    this.smoothCamZ += (p.z - this.smoothCamZ) * 0.18;
    let diff = targetAngle - this.smoothCamAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.smoothCamAngle += diff * 0.1;

    const offX = -Math.cos(this.smoothCamAngle) * dist;
    const offZ = -Math.sin(this.smoothCamAngle) * dist;
    this.camera.position.set(this.smoothCamX + offX, height, this.smoothCamZ + offZ);
    this.camera.lookAt(
      this.smoothCamX + Math.cos(this.smoothCamAngle) * lookAhead,
      TRAIL_H * 0.55,
      this.smoothCamZ + Math.sin(this.smoothCamAngle) * lookAhead
    );
  }

  resize() {
    if (!this.renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) this.composer.setSize(w, h);
  }

  setBloomEnabled(on) {
    if (this.bloomPass) this.bloomPass.enabled = on;
  }

  setBloomIntensity(intensity) {
    if (!this.bloomPass) return;
    const i = Math.max(0, Math.min(1, intensity));
    this.bloomPass.strength = 0.45 + i * 0.35;
  }

  flashNearMiss() {
    if (!this.bloomPass) return;
    const prev = this.bloomPass.strength;
    this.bloomPass.strength = Math.min(1.2, prev + 0.35);
    setTimeout(() => {
      if (this.bloomPass) this.bloomPass.strength = prev;
    }, 120);
  }

  render() {
    if (this.composer) this.composer.render();
  }
}
