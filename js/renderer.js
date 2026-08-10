import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  CELL_WALL, TRAIL_BASE, isTrail, CELL_SIZE, WALL_H, TRAIL_H, TRAIL_PANEL, PERIM_H,
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
    this.trailCoreMats = [];
    this.explosions = [];
    this.matWall = null;
    this.matWallCore = null;
    this.matMobile = null;
    this.matMobileCore = null;
    this.matPerimeter = null;
    this.matPerimeterCap = null;
    this.wallGeo = null;
    this.trailArmGeo = null;
    this.trailCoreGeo = null;
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
    this.scene.fog = new THREE.FogExp2(0x010108, 0.028);

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene.add(new THREE.AmbientLight(0x223355, 0.35));
    const dl = new THREE.DirectionalLight(0xaaccff, 0.28);
    dl.position.set(8, 22, 6);
    this.scene.add(dl);
    const rim = new THREE.DirectionalLight(0x6644aa, 0.18);
    rim.position.set(-6, 10, -8);
    this.scene.add(rim);

    this.wallGeo = new THREE.BoxGeometry(CELL_SIZE * 0.94, 1, CELL_SIZE * 0.94);
    this.trailArmGeo = new THREE.BoxGeometry(CELL_SIZE * 0.92, 1, TRAIL_PANEL);
    this.trailCoreGeo = new THREE.BoxGeometry(TRAIL_PANEL * 0.55, 1, TRAIL_PANEL * 0.55);

    this.matWall = this._makeGlassMat(0x9b7bff, 0x6d28d9, { opacity: 0.38, intensity: 1.35 });
    this.matWallCore = this._makeNeonMat(0xc4b5fd, 0xa855f7, { intensity: 2.2, opacity: 0.85 });
    this.matMobile = this._makeGlassMat(0xffbb66, 0xff6600, { opacity: 0.42, intensity: 1.5 });
    this.matMobileCore = this._makeNeonMat(0xffeeaa, 0xff8800, { intensity: 2.4, opacity: 0.9 });
    this.matPerimeter = this._makeGlassMat(0xd8ccff, 0x9333ea, { opacity: 0.52, intensity: 1.65 });
    this.matPerimeterCap = this._makeNeonMat(0xf5f0ff, 0xbb66ff, { intensity: 2.8, opacity: 0.95 });

    this._rebuildTrailMats();

    const floorSize = Math.max(w, h);
    const floor = new THREE.GridHelper(floorSize, floorSize, 0x00ff88, 0x002211);
    floor.position.y = 0.005;
    floor.material.transparent = true;
    floor.material.opacity = 0.55;
    this.scene.add(floor);

    const floorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(floorSize, floorSize),
      new THREE.MeshBasicMaterial({ color: 0x001a0a, transparent: true, opacity: 0.35 })
    );
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.y = 0.002;
    this.scene.add(floorGlow);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.72, 0.42, 0.08
    ));
  }

  _rebuildTrailMats() {
    this.trailMats = getRiderDefs().map(d =>
      this._makeGlassMat(d.trail, d.trailGlow, { opacity: 0.48, intensity: 1.55 })
    );
    this.trailCoreMats = getRiderDefs().map(d =>
      this._makeNeonMat(d.trailGlow, d.trailGlow, { intensity: 2.6, opacity: 0.92 })
    );
  }

  _makeNeonMat(color, emissive, { intensity = 1.4, opacity = 1 } = {}) {
    return new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: intensity,
      transparent: opacity < 1, opacity,
      metalness: 0.35, roughness: 0.25,
    });
  }

  _makeGlassMat(color, emissive, { opacity = 0.4, intensity = 1.2 } = {}) {
    return new THREE.MeshPhysicalMaterial({
      color, emissive, emissiveIntensity: intensity,
      transparent: true, opacity,
      metalness: 0.15, roughness: 0.12,
      transmission: 0.35, thickness: 0.4,
      clearcoat: 0.6, clearcoatRoughness: 0.15,
    });
  }

  _addEdges(parent, geo, color, opacity = 0.55, scaleY = 1) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending })
    );
    edges.scale.y = scaleY;
    parent.add(edges);
    return edges;
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
    this.explosions.forEach(e => this.scene.remove(e.points));
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
    if (!wallSystem) return null;
    for (const w of wallSystem.walls) {
      for (const c of w.renderPositions()) {
        if (c.x === x && c.y === y) return w;
      }
    }
    return null;
  }

  _buildTrailGroup(trailIdx) {
    const g = new THREE.Group();
    const shellMat = this.trailMats[trailIdx].clone();
    const coreMat = this.trailCoreMats[trailIdx].clone();

    const armX = new THREE.Mesh(this.trailArmGeo, shellMat);
    armX.scale.y = TRAIL_H;
    g.add(armX);

    const armZ = new THREE.Mesh(this.trailArmGeo, shellMat.clone());
    armZ.rotation.y = Math.PI / 2;
    armZ.scale.y = TRAIL_H;
    g.add(armZ);

    const core = new THREE.Mesh(this.trailCoreGeo, coreMat);
    core.scale.y = TRAIL_H * 1.02;
    g.add(core);

    this._addEdges(g, this.trailArmGeo, 0xffffff, 0.35, TRAIL_H);
    const edgeZ = this._addEdges(g, this.trailArmGeo, 0xffffff, 0.35, TRAIL_H);
    edgeZ.rotation.y = Math.PI / 2;

    g.userData.shellMats = [armX.material, armZ.material];
    g.userData.coreMat = coreMat;
    return g;
  }

  _buildWallGroup(glassMat, coreMat, h, edgeColor) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(this.wallGeo, glassMat.clone());
    shell.scale.y = h;
    g.add(shell);

    const core = new THREE.Mesh(
      new THREE.BoxGeometry(CELL_SIZE * 0.22, 1, CELL_SIZE * 0.22),
      coreMat.clone()
    );
    core.scale.y = h * 0.96;
    g.add(core);

    this._addEdges(g, this.wallGeo, edgeColor, 0.5, h);
    g.userData.shellMat = shell.material;
    g.userData.coreMat = core.material;
    return g;
  }

  _buildPerimeterGroup(h) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(this.wallGeo, this.matPerimeter.clone());
    shell.scale.y = h;
    g.add(shell);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(CELL_SIZE * 0.96, 0.06, CELL_SIZE * 0.96),
      this.matPerimeterCap.clone()
    );
    cap.position.y = h / 2 - 0.02;
    g.add(cap);

    const core = new THREE.Mesh(
      new THREE.BoxGeometry(CELL_SIZE * 0.18, 1, CELL_SIZE * 0.18),
      this._makeNeonMat(0xffffff, 0xcc99ff, { intensity: 2.5, opacity: 0.9 })
    );
    core.scale.y = h * 0.92;
    g.add(core);

    this._addEdges(g, this.wallGeo, 0xeeddff, 0.65, h);
    g.userData.shellMat = shell.material;
    return g;
  }

  _setCellMesh(x, y, type, grid, wallSystem) {
    const key = this._cellKey(x, y);
    const existing = this.cellMeshes.get(key);
    if (existing) { this.scene.remove(existing); this.cellMeshes.delete(key); }

    let group, h;
    const p = this.gridToWorld(x, y);

    if (isTrail(type)) {
      group = this._buildTrailGroup(type - TRAIL_BASE);
      h = TRAIL_H;
    } else if (type === CELL_WALL && grid.isPerimeter(x, y)) {
      group = this._buildPerimeterGroup(PERIM_H);
      h = PERIM_H;
    } else if (type === CELL_WALL && this._isMobileCell(x, y, wallSystem)) {
      group = this._buildWallGroup(this.matMobile, this.matMobileCore, WALL_H, 0xffcc66);
      h = WALL_H;
    } else {
      group = this._buildWallGroup(this.matWall, this.matWallCore, WALL_H, 0xbb99ff);
      h = WALL_H;
    }

    group.position.set(p.x, h / 2, p.z);
    this.scene.add(group);
    this.cellMeshes.set(key, group);
  }

  syncMobileWarnings(wallSystem, now) {
    for (const w of wallSystem.walls) {
      for (const { x, y } of w.renderPositions()) {
        const group = this.cellMeshes.get(this._cellKey(x, y));
        if (!group?.userData?.shellMat) continue;
        const lvl = w.warningLevel;
        let pulse = 1.05;
        if (lvl === 1) pulse = 0.75;
        else if (lvl === 2) pulse = 0.85 + Math.sin(now / 65) * 0.55;
        else if (lvl === 3) pulse = 1.5 + Math.sin(now / 35) * 0.45;
        group.userData.shellMat.emissiveIntensity = pulse;
        if (group.userData.coreMat) group.userData.coreMat.emissiveIntensity = pulse * 1.4;
      }
    }
  }

  _buildBike(def) {
    const g = new THREE.Group();
    const stripMat = this._makeNeonMat(def.glow, def.wheel, { intensity: 2.8, opacity: 0.95 });
    const bodyMat = this._makeNeonMat(def.body, def.glow, { intensity: 1.6, opacity: 0.92 });
    const darkMat = this._makeNeonMat(0x0a0a18, def.glow, { intensity: 0.35, opacity: 0.95 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.78), darkMat);
    chassis.position.y = 0.2;
    g.add(chassis);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.32), bodyMat);
    nose.position.set(0, 0.26, -0.28);
    g.add(nose);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.22), stripMat);
    canopy.position.set(0, 0.34, -0.18);
    g.add(canopy);

    const addStrip = (sx, sy, sz, w, ht, d) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), stripMat.clone());
      s.position.set(sx, sy, sz);
      g.add(s);
    };
    addStrip(-0.2, 0.22, 0.02, 0.035, 0.12, 0.62);
    addStrip(0.2, 0.22, 0.02, 0.035, 0.12, 0.62);
    addStrip(0, 0.3, 0.1, 0.5, 0.025, 0.035);

    const ringGeo = new THREE.TorusGeometry(0.13, 0.028, 10, 28);
    const wheelMat = this._makeNeonMat(def.wheel, def.wheel, { intensity: 3, opacity: 1 });
    [-0.24, 0.24].forEach(s => {
      const ring = new THREE.Mesh(ringGeo, wheelMat.clone());
      ring.rotation.y = Math.PI / 2;
      ring.position.set(s, 0.13, 0.22);
      g.add(ring);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), darkMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(s, 0.13, 0.22);
      g.add(hub);
    });

    const emitter = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      this._makeNeonMat(def.trailGlow, def.trailGlow, { intensity: 3.5, opacity: 1 })
    );
    emitter.position.set(0, 0.26, 0.36);
    g.add(emitter);

    const disc = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.38, 32),
      new THREE.MeshBasicMaterial({
        color: def.glow, transparent: true, opacity: 0.32,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.015;
    g.add(disc);

    const light = new THREE.PointLight(def.glow, 0.85, 5.5);
    light.position.set(0, 0.45, 0.1);
    g.add(light);

    g.userData.emitter = emitter;
    g.userData.disc = disc;
    g.userData.light = light;
    return g;
  }

  _buildLiveTrail(def) {
    const g = new THREE.Group();
    const shellMat = this._makeGlassMat(def.trail, def.trailGlow, { opacity: 0.55, intensity: 1.8 });
    const coreMat = this._makeNeonMat(def.trailGlow, def.trailGlow, { intensity: 3.2, opacity: 1 });

    const head = new THREE.Mesh(this.trailArmGeo, shellMat);
    head.scale.y = TRAIL_H;
    g.add(head);
    const headCore = new THREE.Mesh(this.trailCoreGeo, coreMat);
    headCore.scale.y = TRAIL_H;
    g.add(headCore);

    const segGeo = new THREE.BoxGeometry(1, 1, TRAIL_PANEL);
    const segment = new THREE.Mesh(segGeo, shellMat.clone());
    segment.scale.y = TRAIL_H;
    g.add(segment);
    const segCore = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, TRAIL_PANEL * 0.5),
      coreMat.clone()
    );
    segCore.scale.y = TRAIL_H;
    g.add(segCore);

    g.userData.head = head;
    g.userData.headCore = headCore;
    g.userData.segment = segment;
    g.userData.segCore = segCore;
    return g;
  }

  _updateLiveTrail(lt, rider) {
    const p = this.gridToWorld(rider.renderX, rider.renderY, this._worldPos);
    const prev = this.gridToWorld(rider.prevX, rider.prevY, this._worldPos2);

    lt.userData.head.position.set(p.x, TRAIL_H / 2, p.z);
    lt.userData.headCore.position.set(p.x, TRAIL_H / 2, p.z);

    const dx = p.x - prev.x;
    const dz = p.z - prev.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.02) {
      const midX = (p.x + prev.x) / 2;
      const midZ = (p.z + prev.z) / 2;
      const angle = Math.atan2(dz, dx);
      lt.userData.segment.visible = true;
      lt.userData.segCore.visible = true;
      lt.userData.segment.position.set(midX, TRAIL_H / 2, midZ);
      lt.userData.segCore.position.set(midX, TRAIL_H / 2, midZ);
      lt.userData.segment.rotation.y = -angle;
      lt.userData.segCore.rotation.y = -angle;
      lt.userData.segment.scale.set(dist, TRAIL_H, 1);
      lt.userData.segCore.scale.set(dist, TRAIL_H, 1);
    } else {
      lt.userData.segment.visible = false;
      lt.userData.segCore.visible = false;
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

      const pulse = 0.85 + Math.sin(now / 120 + r.id) * 0.15;
      if (mesh.userData.emitter) mesh.userData.emitter.scale.setScalar(pulse);
      if (mesh.userData.disc) mesh.userData.disc.material.opacity = 0.22 + Math.sin(now / 180) * 0.1;
      if (mesh.userData.light) mesh.userData.light.intensity = 0.7 + Math.sin(now / 140 + r.id) * 0.2;

      if (playing) {
        let lt = this.liveTrails.get(r.id);
        if (!lt) {
          lt = this._buildLiveTrail(r.def);
          this.scene.add(lt);
          this.liveTrails.set(r.id, lt);
        }
        this._updateLiveTrail(lt, r);
      }
    }
  }

  spawnExplosion(rider) {
    const p = this.gridToWorld(rider.x, rider.y, this._worldPos);
    const count = 48;
    const positions = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = TRAIL_H + 0.2;
      positions[i * 3 + 2] = p.z;
      vel.push({
        x: (Math.random() - 0.5) * 0.4,
        y: 0.06 + Math.random() * 0.25,
        z: (Math.random() - 0.5) * 0.4,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: rider.def.trailGlow, size: 0.35, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.scene.add(points);
    this.explosions.push({ points, vel, life: 1 });
  }

  updateExplosions() {
    this.explosions = this.explosions.filter(e => {
      e.life -= 0.026;
      const pos = e.points.geometry.attributes.position;
      for (let i = 0; i < e.vel.length; i++) {
        pos.array[i * 3] += e.vel[i].x;
        pos.array[i * 3 + 1] += e.vel[i].y;
        pos.array[i * 3 + 2] += e.vel[i].z;
        e.vel[i].y -= 0.012;
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
    this.camera.position.set(
      this.smoothCamX + offX, height, this.smoothCamZ + offZ
    );
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

  render() {
    if (this.composer) this.composer.render();
  }
}
