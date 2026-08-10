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
  }

  init() {
    const { w, h } = gridDimensions();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020208);
    this.scene.fog = new THREE.Fog(0x020208, 40, 90);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene.add(new THREE.AmbientLight(0x334466, 0.45));
    const dl = new THREE.DirectionalLight(0xffffff, 0.35);
    dl.position.set(10, 20, 5);
    this.scene.add(dl);

    this.matWall = this._makeMat(0xb794f6, 0x7c3aed, 0.82, false);
    this.matMobile = this._makeMat(0xffaa44, 0xff6600, 0.85, false);
    this.matPerimeter = this._makeMat(0xc4b5fd, 0x9333ea, 0.92, true);
    this.boxGeo = new THREE.BoxGeometry(CELL_SIZE * 0.92, 1, CELL_SIZE * 0.92);
    this.trailMats = getRiderDefs().map(d => this._makeMat(d.trail, d.trailGlow, 0.55, false));

    const floor = new THREE.GridHelper(Math.max(w, h), Math.max(w, h), 0x00ff66, 0x003318);
    floor.position.y = 0.01;
    this.scene.add(floor);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.38, 0.1
    ));
  }

  _makeMat(color, emissive, opacity, tall) {
    return new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: tall ? 1.5 : 1.05,
      transparent: true, opacity, metalness: 0.1, roughness: 0.4,
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
    this.liveTrails.forEach(m => this.scene.remove(m));
    this.liveTrails.clear();
    this.explosions.forEach(e => this.scene.remove(e.points));
    this.explosions = [];
    this.trailMats = getRiderDefs().map(d => this._makeMat(d.trail, d.trailGlow, 0.55, false));
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
        if (c.x === x && c.y === y) return w;
      }
    }
    return null;
  }

  _setCellMesh(x, y, type, grid, wallSystem) {
    const key = this._cellKey(x, y);
    const existing = this.cellMeshes.get(key);
    if (existing) { this.scene.remove(existing); this.cellMeshes.delete(key); }

    const perimeter = type === CELL_WALL && grid.isPerimeter(x, y);
    let mat, h;
    if (isTrail(type)) { mat = this.trailMats[type - TRAIL_BASE]; h = TRAIL_H; }
    else if (perimeter) { mat = this.matPerimeter; h = PERIM_H; }
    else if (type === CELL_WALL && this._isMobileCell(x, y, wallSystem)) {
      mat = this.matMobile.clone(); h = WALL_H;
    }
    else { mat = this.matWall; h = WALL_H; }

    const mesh = new THREE.Mesh(this.boxGeo, mat);
    const p = this.gridToWorld(x, y);
    mesh.position.set(p.x, h / 2, p.z);
    mesh.scale.y = h;
    this.scene.add(mesh);
    this.cellMeshes.set(key, mesh);
  }

  syncMobileWarnings(wallSystem, now) {
    for (const w of wallSystem.walls) {
      for (const { x, y } of w.renderPositions()) {
        const mesh = this.cellMeshes.get(this._cellKey(x, y));
        if (!mesh?.material) continue;
        const lvl = w.warningLevel;
        if (lvl === 0) mesh.material.emissiveIntensity = 1.05;
        else if (lvl === 1) mesh.material.emissiveIntensity = 0.85;
        else if (lvl === 2) mesh.material.emissiveIntensity = 0.8 + Math.sin(now / 70) * 0.6;
        else mesh.material.emissiveIntensity = 1.4 + Math.sin(now / 40) * 0.4;
      }
    }
  }

  _buildBike(def) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.85), this._makeMat(def.body, def.glow, 1, true));
    body.position.y = 0.25; g.add(body);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.35), this._makeMat(0xffffee, 0xffffaa, 1, true));
    cockpit.position.set(0, 0.38, -0.15); g.add(cockpit);
    const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
    const wMat = this._makeMat(0xffffff, def.wheel, 1, true);
    [-0.28, 0.28].forEach(s => {
      const w = new THREE.Mesh(wheelGeo, wMat);
      w.rotation.z = Math.PI / 2; w.position.set(s, 0.12, 0.28); g.add(w);
    });
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), this._makeMat(def.wheel, def.wheel, 1, true));
    emitter.position.set(0, 0.3, 0.45); g.add(emitter);
    return g;
  }

  ensureRiderMesh(rider) {
    if (!this.riderMeshes.has(rider.id)) {
      const mesh = this._buildBike(rider.def);
      this.scene.add(mesh);
      this.riderMeshes.set(rider.id, mesh);
    }
    return this.riderMeshes.get(rider.id);
  }

  syncRiders(riders, playing) {
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
          lt = new THREE.Mesh(this.boxGeo, this._makeMat(r.def.trail, r.def.trailGlow, 0.35, false));
          this.scene.add(lt);
          this.liveTrails.set(r.id, lt);
        }
        const lp = this.gridToWorld(r.renderX, r.renderY);
        lt.position.set(lp.x, TRAIL_H / 2, lp.z);
        lt.scale.y = TRAIL_H;
      }
    }
  }

  spawnExplosion(rider) {
    const p = this.gridToWorld(rider.x, rider.y, this._worldPos);
    const count = 40;
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
      color: rider.def.body, size: 0.3, transparent: true, opacity: 1,
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
        e.vel[i].y -= 0.01;
      }
      pos.needsUpdate = true;
      e.points.material.opacity = Math.max(0, e.life);
      if (e.life <= 0) { this.scene.remove(e.points); return false; }
      return true;
    });
  }

  updateCamera(player) {
    if (!player?.alive) return;
    const p = this.gridToWorld(player.renderX, player.renderY, this._worldPos);
    const targetAngle = CAM_DIR_ANGLES[player.dir];
    const dist = 14, height = 12, lookAhead = 4;

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
    this.camera.position.set(
      this.smoothCamX + offX, height, this.smoothCamZ + offZ
    );
    this.camera.lookAt(
      this.smoothCamX + Math.cos(this.smoothCamAngle) * lookAhead,
      TRAIL_H,
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

  render() {
    if (this.composer) this.composer.render();
  }
}
