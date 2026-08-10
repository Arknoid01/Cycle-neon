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
    this.explosions = [];
    this.matWall = null;
    this.matMobile = null;
    this.matPerimeter = null;
    this.boxGeo = null;
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
    this.renderer.toneMappingExposure = 1.12;

    this.scene.add(new THREE.AmbientLight(0x223355, 0.4));
    const dl = new THREE.DirectionalLight(0xaaccff, 0.3);
    dl.position.set(8, 22, 6);
    this.scene.add(dl);

    this.boxGeo = new THREE.BoxGeometry(CELL_SIZE * 0.92, 1, CELL_SIZE * 0.92);

    this.matWall = this._makeNeonMat(0x9b7bff, 0x6d28d9, { opacity: 0.72, intensity: 1.2 });
    this.matMobile = this._makeNeonMat(0xffbb66, 0xff6600, { opacity: 0.78, intensity: 1.35 });
    this.matPerimeter = this._makeNeonMat(0xd8ccff, 0x9333ea, { opacity: 0.82, intensity: 1.5 });
    this._rebuildTrailMats();

    const floorSize = Math.max(w, h);
    const floor = new THREE.GridHelper(floorSize, w, 0x00ff88, 0x002211);
    floor.position.y = 0.005;
    floor.material.transparent = true;
    floor.material.opacity = 0.45;
    this.scene.add(floor);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.62, 0.38, 0.12
    );
    this.composer.addPass(this.bloomPass);
  }

  _rebuildTrailMats() {
    this.trailMats = getRiderDefs().map(d =>
      this._makeNeonMat(d.trail, d.trailGlow, { opacity: 0.68, intensity: 1.65 })
    );
  }

  _makeNeonMat(color, emissive, { intensity = 1.3, opacity = 0.75 } = {}) {
    return new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: intensity,
      transparent: opacity < 1, opacity,
      metalness: 0.2, roughness: 0.35,
    });
  }

  _cellKey(x, y) { return x + ',' + y; }

  gridToWorld(gx, gy, out) {
    const { w, h } = gridDimensions();
    const v = out || this._worldPos;
    v.set((gx - w / 2 + 0.5) * CELL_SIZE, 0, (gy - h / 2 + 0.5) * CELL_SIZE);
    return v;
  }

  clearAll() {
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
    this._rebuildTrailMats();
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

    let mat, geo, h;
    if (isTrail(type)) {
      mat = this.trailMats[type - TRAIL_BASE];
      geo = this.boxGeo;
      h = TRAIL_H;
    } else if (type === CELL_WALL && grid.isPerimeter(x, y)) {
      mat = this.matPerimeter;
      geo = this.boxGeo;
      h = PERIM_H;
    } else if (type === CELL_WALL && this._isMobileCell(x, y, wallSystem)) {
      mat = this.matMobile;
      geo = this.boxGeo;
      h = WALL_H;
    } else {
      mat = this.matWall;
      geo = this.boxGeo;
      h = WALL_H;
    }

    const mesh = new THREE.Mesh(geo, mat);
    const p = this.gridToWorld(x, y);
    mesh.position.set(p.x, h / 2, p.z);
    mesh.scale.y = h;
    if (isTrail(type)) mesh.userData.trailIdx = type - TRAIL_BASE;
    this.scene.add(mesh);
    this.cellMeshes.set(key, mesh);
  }

  syncMobileWarnings(wallSystem, now) {
    const lvl = Math.max(0, ...wallSystem.walls.map(w => w.warningLevel));
    let pulse = 1.2;
    if (lvl === 1) pulse = 0.8;
    else if (lvl === 2) pulse = 0.9 + Math.sin(now / 65) * 0.45;
    else if (lvl === 3) pulse = 1.45 + Math.sin(now / 35) * 0.35;
    this.matMobile.emissiveIntensity = pulse;
  }

  _buildBike(def) {
    const g = new THREE.Group();
    const stripMat = this._makeNeonMat(def.glow, def.wheel, { intensity: 2.2, opacity: 0.95 });
    const bodyMat = this._makeNeonMat(def.body, def.glow, { intensity: 1.4, opacity: 0.92 });
    const darkMat = this._makeNeonMat(0x0a0a18, def.glow, { intensity: 0.3, opacity: 0.95 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.78), darkMat);
    chassis.position.y = 0.2;
    g.add(chassis);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.32), bodyMat);
    nose.position.set(0, 0.26, -0.28);
    g.add(nose);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.22), stripMat);
    canopy.position.set(0, 0.34, -0.18);
    g.add(canopy);

    const sideGeo = new THREE.BoxGeometry(0.035, 0.12, 0.62);
    [-0.2, 0.2].forEach(s => {
      const side = new THREE.Mesh(sideGeo, stripMat);
      side.position.set(s, 0.22, 0.02);
      g.add(side);
    });

    const ringGeo = new THREE.TorusGeometry(0.13, 0.028, 8, 20);
    const wheelMat = this._makeNeonMat(def.wheel, def.wheel, { intensity: 2.4, opacity: 1 });
    [-0.24, 0.24].forEach(s => {
      const ring = new THREE.Mesh(ringGeo, wheelMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(s, 0.13, 0.22);
      g.add(ring);
    });

    const emitter = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      this._makeNeonMat(def.trailGlow, def.trailGlow, { intensity: 2.8, opacity: 1 })
    );
    emitter.position.set(0, 0.26, 0.36);
    g.add(emitter);

    g.userData.emitter = emitter;
    return g;
  }

  _buildLiveTrail(mat) {
    const head = new THREE.Mesh(this.boxGeo, mat);
    head.scale.y = TRAIL_H;
    const segGeo = new THREE.BoxGeometry(1, 1, CELL_SIZE * 0.92);
    const segment = new THREE.Mesh(segGeo, mat);
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

      if (mesh.userData.emitter) {
        mesh.userData.emitter.scale.setScalar(0.9 + Math.sin(now / 120 + r.id) * 0.1);
      }

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

  render() {
    if (this.composer) this.composer.render();
  }
}
