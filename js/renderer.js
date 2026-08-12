import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  CELL_WALL, TRAIL_BASE, isTrail, CELL_SIZE, WALL_H, TRAIL_H, TRAIL_THICK, TRAIL_PLATE_LEN, PERIM_H,
  CAM_DIR_ANGLES, BIKE_DIR_ANGLES, DX, DY, TRAIL_OPACITY, WALL_CUBE_SIZE,
  TRAIL_ARM_LEN, TRAIL_ARM_OFFSET, BIKE_SCALE,
} from './constants.js';
import { getRiderDefs } from './cosmetics.js';
import { gridDimensions } from './grid.js';
import { createElectricMaterial, AXIS_X, AXIS_Y, AXIS_Z } from './electric-shader.js';
import { buildBikeSkin } from './bike-builder.js';
import {
  skinUsesModel,
  buildFallbackBike,
  createBikeMesh,
  bikeTrailRearWorld,
  pulseBikeMaterials,
  disposeBikeMesh,
} from './bike-model-loader.js';
import { updateSpriteBike } from './bike-sprite-loader.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.bloomPass = null;
    this.cellMeshes = new Map();
    this.previewMeshes = new Map();
    this.riderMeshes = new Map();
    this.liveTrails = new Map();
    this.trailMats = [];
    this.electricMats = [];
    this.explosions = [];
    this.matWall = null;
    this.matMobile = null;
    this.matPreview = null;
    this.matPerimeter = null;
    this.wallCubeGeo = null;
    this.perimCubeGeo = null;
    this.trailPlateGeo = null;
    this.liveTrailGeo = null;
    this.mobileBurstUntil = 0;
    this.smoothCamX = 0;
    this.smoothCamZ = 0;
    this.smoothCamAngle = -Math.PI / 2;
    this.camReady = false;
    this._worldPos = new THREE.Vector3();
    this._worldPos2 = new THREE.Vector3();
  }

  async init() {
    const { w, h } = gridDimensions();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010108);
    this.scene.fog = new THREE.FogExp2(0x010108, 0.045);

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;

    this.scene.add(new THREE.AmbientLight(0x223355, 0.18));

    this.wallCubeGeo = new THREE.BoxGeometry(WALL_CUBE_SIZE, WALL_H, WALL_CUBE_SIZE);
    this.perimCubeGeo = new THREE.BoxGeometry(WALL_CUBE_SIZE, PERIM_H, WALL_CUBE_SIZE);
    this.trailPlateGeo = new THREE.BoxGeometry(TRAIL_THICK, TRAIL_H, TRAIL_PLATE_LEN);
    this.trailCornerArmGeo = new THREE.BoxGeometry(TRAIL_THICK, TRAIL_H, TRAIL_ARM_LEN);
    this.trailCornerCapGeo = new THREE.BoxGeometry(TRAIL_THICK * 1.5, TRAIL_H, TRAIL_THICK * 1.5);
    this.liveTrailGeo = new THREE.BoxGeometry(TRAIL_THICK, TRAIL_H, 1);

    this.matWall = this._createWallMat(0x3b0764, 0x7c3aed, 0.95);
    this.matMobile = this._createWallMat(0x7c2d12, 0xff6600, 1.0);
    this.matPerimeter = this._createWallMat(0x4c1d95, 0x9333ea, 1.0);
    this.matPreview = new THREE.MeshStandardMaterial({
      color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 0.9,
      metalness: 0.3, roughness: 0.4,
      transparent: true, opacity: 0, depthWrite: false,
    });
    this._rebuildTrailMats();

    const floorSize = Math.max(w, h);
    const floor = new THREE.GridHelper(floorSize, w, 0x006644, 0x002211);
    floor.position.y = 0.005;
    floor.material.transparent = true;
    floor.material.opacity = 0.26;
    this.scene.add(floor);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.34, 0.24, 0.78
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
        color: d.trailGlow, sparkColor: d.trail,
        intensity: 1.2, body: 0.55, opacity: TRAIL_OPACITY,
        acrossDir: AXIS_X,
      });
      this._trackElectric(mat);
      return mat;
    });
    this.electricMats = [...this.trailMats];
  }

  _createWallMat(color, emissive, emissiveIntensity) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity,
      metalness: 0.5,
      roughness: 0.32,
    });
    mat.userData.baseEmissive = emissiveIntensity;
    return mat;
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
    this.previewMeshes.forEach(m => this.scene.remove(m));
    this.previewMeshes.clear();
    this.riderMeshes.forEach(g => {
      if (g.userData.frameMats) {
        for (const m of g.userData.frameMats) {
          m.map?.dispose();
          m.dispose();
        }
      }
      disposeBikeMesh(g);
      this.scene.remove(g);
    });
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
        if (isTrail(val)) {
          const existing = this.cellMeshes.get(key);
          if (existing?.userData?.isTrail) {
            const inDir = grid.getTrailInDir(x, y);
            const outDir = grid.getTrailDir(x, y);
            if (existing.userData.trailIn !== inDir || existing.userData.trailOut !== outDir) {
              this._setCellMesh(x, y, val, grid, wallSystem);
            }
            continue;
          }
        }
        if (this.cellMeshes.has(key)) continue;
        this._setCellMesh(x, y, val, grid, wallSystem);
      }
    }
  }

  _createTrailCellGroup(x, y) {
    const g = new THREE.Group();
    const p = this.gridToWorld(x, y);
    g.position.set(p.x, 0, p.z);
    this.scene.add(g);
    return g;
  }

  _addWallCube(x, y, geo, mat) {
    const mesh = new THREE.Mesh(geo, mat);
    const p = this.gridToWorld(x, y);
    const h = geo.parameters.height;
    mesh.position.set(p.x, h / 2, p.z);
    this.scene.add(mesh);
    return mesh;
  }

  _addOrientedPlateLocal(geo, mat, height, dir, group) {
    const mesh = new THREE.Mesh(geo, mat);
    const shift = this._plateShiftBack(dir);
    mesh.position.set(shift.x, height / 2, shift.z);
    mesh.rotation.y = this._plateRotation(dir);
    group.add(mesh);
    return mesh;
  }

  _addTrailArmLocal(group, geoHalf, mat, height, dir, towardEdge) {
    const sign = towardEdge ? 1 : -1;
    const arm = new THREE.Mesh(geoHalf, mat);
    arm.position.set(
      DX[dir] * TRAIL_ARM_OFFSET * sign,
      height / 2,
      DY[dir] * TRAIL_ARM_OFFSET * sign,
    );
    arm.rotation.y = this._plateRotation(dir);
    group.add(arm);
    return arm;
  }

  _plateRotation(dir) {
    return BIKE_DIR_ANGLES[dir];
  }

  _plateShiftBack(dir) {
    return {
      x: -DX[dir] * CELL_SIZE * 0.5,
      z: -DY[dir] * CELL_SIZE * 0.5,
    };
  }

  _isPreCornerCell(grid, x, y, outDir) {
    const nx = x + DX[outDir];
    const ny = y + DY[outDir];
    if (!grid.inBounds(nx, ny) || !isTrail(grid.get(nx, ny))) return false;
    const nextOut = grid.getTrailDir(nx, ny);
    const nextIn = grid.getTrailInDir(nx, ny);
    return nextIn !== nextOut && nextIn === outDir;
  }

  _isPostCornerCell(grid, x, y, outDir) {
    const px = x - DX[outDir];
    const py = y - DY[outDir];
    if (!grid.inBounds(px, py) || !isTrail(grid.get(px, py))) return false;
    const prevOut = grid.getTrailDir(px, py);
    const prevIn = grid.getTrailInDir(px, py);
    return prevIn !== prevOut && prevOut === outDir;
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

  /** Front edge of a trail plate on (gx, gy), for linking live segments. */
  _plateFrontEdge(gx, gy, dir, out, grid = null) {
    const p = this.gridToWorld(gx, gy, out);
    if (grid) {
      const outDir = grid.getTrailDir(gx, gy);
      const inDir = grid.getTrailInDir(gx, gy);
      if (inDir !== outDir) {
        p.x += DX[outDir] * CELL_SIZE * 0.5;
        p.z += DY[outDir] * CELL_SIZE * 0.5;
        return p;
      }
      if (this._isPreCornerCell(grid, gx, gy, outDir) || this._isPostCornerCell(grid, gx, gy, outDir)) {
        p.x += DX[outDir] * CELL_SIZE * 0.5;
        p.z += DY[outDir] * CELL_SIZE * 0.5;
        return p;
      }
    }
    const shift = this._plateShiftBack(dir);
    const half = TRAIL_PLATE_LEN * 0.5;
    p.x += shift.x + DX[dir] * half;
    p.z += shift.z + DY[dir] * half;
    return p;
  }

  /** L-corner: each arm runs from a cell edge to the center (+ cap). */
  _addCornerPlate(x, y, geoHalf, mat, height, inDir, outDir) {
    const g = this._createTrailCellGroup(x, y);
    this._addTrailArmLocal(g, geoHalf, mat, height, inDir, false);
    this._addTrailArmLocal(g, geoHalf, mat, height, outDir, true);
    const cap = new THREE.Mesh(this.trailCornerCapGeo, mat);
    cap.position.y = height / 2;
    g.add(cap);
    return g;
  }

  /** Straight cell before a turn: extend from center to the corner cell. */
  _addPreCornerPlate(x, y, geo, geoHalf, mat, height, outDir) {
    const g = this._createTrailCellGroup(x, y);
    this._addOrientedPlateLocal(geo, mat, height, outDir, g);
    this._addTrailArmLocal(g, geoHalf, mat, height, outDir, true);
    return g;
  }

  /** Straight cell between two corners: arms toward both turns. */
  _addBridgeCornerPlate(x, y, geo, geoHalf, mat, height, outDir) {
    const g = this._createTrailCellGroup(x, y);
    this._addOrientedPlateLocal(geo, mat, height, outDir, g);
    this._addTrailArmLocal(g, geoHalf, mat, height, outDir, false);
    this._addTrailArmLocal(g, geoHalf, mat, height, outDir, true);
    return g;
  }

  /** Straight cell after a turn: extend back toward the corner cell. */
  _addPostCornerPlate(x, y, geo, geoHalf, mat, height, outDir) {
    const g = this._createTrailCellGroup(x, y);
    this._addOrientedPlateLocal(geo, mat, height, outDir, g);
    this._addTrailArmLocal(g, geoHalf, mat, height, outDir, false);
    return g;
  }

  _addStraightTrailPlate(x, y, geo, mat, height, outDir) {
    const g = this._createTrailCellGroup(x, y);
    this._addOrientedPlateLocal(geo, mat, height, outDir, g);
    return g;
  }

  _trailRotation(dir) {
    return this._plateRotation(dir);
  }

  _buildTrailMesh(x, y, grid, type) {
    const mat = this.trailMats[type - TRAIL_BASE];
    const outDir = grid.getTrailDir(x, y);
    const inDir = grid.getTrailInDir(x, y);
    if (inDir !== outDir) {
      return this._addCornerPlate(x, y, this.trailCornerArmGeo, mat, TRAIL_H, inDir, outDir);
    }
    const isPost = this._isPostCornerCell(grid, x, y, outDir);
    const isPre = this._isPreCornerCell(grid, x, y, outDir);
    if (isPost && isPre) {
      return this._addBridgeCornerPlate(x, y, this.trailPlateGeo, this.trailCornerArmGeo, mat, TRAIL_H, outDir);
    }
    if (isPost) {
      return this._addPostCornerPlate(x, y, this.trailPlateGeo, this.trailCornerArmGeo, mat, TRAIL_H, outDir);
    }
    if (isPre) {
      return this._addPreCornerPlate(x, y, this.trailPlateGeo, this.trailCornerArmGeo, mat, TRAIL_H, outDir);
    }
    return this._addStraightTrailPlate(x, y, this.trailPlateGeo, mat, TRAIL_H, outDir);
  }

  _refreshTrailNeighbors(x, y, grid, wallSystem) {
    const inDir = grid.getTrailInDir(x, y);
    const outDir = grid.getTrailDir(x, y);
    const px = x - DX[inDir];
    const py = y - DY[inDir];
    if (grid.inBounds(px, py) && isTrail(grid.get(px, py))) {
      this._setCellMesh(px, py, grid.get(px, py), grid, wallSystem, false);
    }
    const sx = x + DX[outDir];
    const sy = y + DY[outDir];
    if (grid.inBounds(sx, sy) && isTrail(grid.get(sx, sy))) {
      this._setCellMesh(sx, sy, grid.get(sx, sy), grid, wallSystem, false);
    }
  }

  _setCellMesh(x, y, type, grid, wallSystem, refreshNeighbors = true) {
    const key = this._cellKey(x, y);
    const existing = this.cellMeshes.get(key);
    if (existing) {
      this.scene.remove(existing);
      this.cellMeshes.delete(key);
    }

    if (isTrail(type)) {
      const outDir = grid.getTrailDir(x, y);
      const inDir = grid.getTrailInDir(x, y);
      const mesh = this._buildTrailMesh(x, y, grid, type);
      mesh.userData.isTrail = true;
      mesh.userData.trailIn = inDir;
      mesh.userData.trailOut = outDir;
      this.cellMeshes.set(key, mesh);
      if (refreshNeighbors) this._refreshTrailNeighbors(x, y, grid, wallSystem);
      return;
    }

    let mat, geo;
    if (type === CELL_WALL && grid.isPerimeter(x, y)) {
      mat = this.matPerimeter;
      geo = this.perimCubeGeo;
    } else if (type === CELL_WALL && this._isMobileCell(x, y, wallSystem)) {
      mat = this.matMobile;
      geo = this.wallCubeGeo;
    } else {
      mat = this.matWall;
      geo = this.wallCubeGeo;
    }

    const mesh = this._addWallCube(x, y, geo, mat);
    this.cellMeshes.set(key, mesh);
  }

  triggerMobileBurst(now) {
    this.mobileBurstUntil = now + 450;
  }

  syncMobileWarnings(wallSystem, now) {
    const lvl = Math.max(0, ...wallSystem.walls.map(w => w.warningLevel));
    let intensity = this.matMobile.userData.baseEmissive;

    if (lvl === 1) intensity = 0.95;
    else if (lvl === 2) {
      intensity = 1.1 + Math.sin(now / 45) * 0.2;
    }
    else if (lvl === 3) {
      intensity = 1.25 + Math.sin(now / 22) * 0.3;
    }

    if (now < this.mobileBurstUntil) intensity = 1.5;

    this.matMobile.emissiveIntensity = intensity;
  }

  /** Aperçu transparent et clignotant des cellules qui vont bientôt devenir un mur. */
  syncWallPreviews(wallSystem, grid, now) {
    const preview = wallSystem.previewCells(grid);
    const activeKeys = new Set();
    let maxLevel = 0;

    for (const c of preview) {
      const key = this._cellKey(c.x, c.y);
      activeKeys.add(key);
      if (c.level > maxLevel) maxLevel = c.level;
      if (!this.previewMeshes.has(key)) {
        const mesh = this._addWallCube(c.x, c.y, this.wallCubeGeo, this.matPreview);
        this.previewMeshes.set(key, mesh);
      }
    }

    this.previewMeshes.forEach((mesh, key) => {
      if (activeKeys.has(key)) return;
      this.scene.remove(mesh);
      this.previewMeshes.delete(key);
    });

    let opacity = 0;
    if (maxLevel === 1) opacity = 0.14 + Math.sin(now / 300) * 0.10;
    else if (maxLevel === 2) opacity = 0.22 + Math.sin(now / 150) * 0.16;
    else if (maxLevel === 3) opacity = 0.32 + Math.sin(now / 75) * 0.24;
    this.matPreview.opacity = Math.max(0, opacity);
  }

  _buildBike(def) {
    const mesh = buildFallbackBike(def, def.skin, m => this._trackElectric(m));
    mesh.scale.setScalar(BIKE_SCALE);
    return mesh;
  }

  _replaceRiderMesh(riderId, newMesh) {
    const old = this.riderMeshes.get(riderId);
    if (!old || old === newMesh) return;
    newMesh.position.copy(old.position);
    newMesh.rotation.copy(old.rotation);
    newMesh.visible = old.visible;
    this.scene.remove(old);
    disposeBikeMesh(old);
    this.scene.add(newMesh);
    this.riderMeshes.set(riderId, newMesh);
  }

  _loadGltfBike(rider) {
    const skin = rider.def.skin;
    if (!skinUsesModel(skin)) return;
    const loadId = `${rider.id}:${skin.id}:${rider.def.trailGlow}`;
    if (rider._gltfLoadId === loadId) return;
    rider._gltfLoadId = loadId;

    createBikeMesh(rider.def, skin, m => this._trackElectric(m)).then(mesh => {
      if (!this.riderMeshes.has(rider.id)) return;
      if (rider._gltfLoadId !== loadId) {
        disposeBikeMesh(mesh);
        return;
      }
      mesh.scale.setScalar(BIKE_SCALE);
      this._replaceRiderMesh(rider.id, mesh);
    });
  }

  _buildLiveTrail(mat) {
    const segment = new THREE.Mesh(this.liveTrailGeo, mat);
    segment.visible = false;
    const g = new THREE.Group();
    g.add(segment);
    g.userData.segment = segment;
    return g;
  }

  _bikeRearWorld(rider, bikeMesh, out) {
    const p = this.gridToWorld(rider.renderX, rider.renderY, out);
    const angle = bikeMesh?.rotation.y ?? rider.smoothAngle;
    return bikeTrailRearWorld(bikeMesh, p.x, p.z, angle);
  }

  _updateLiveTrail(lt, rider, bikeMesh, grid, renderT = 1) {
    const dir = grid?.getTrailDir(rider.prevX, rider.prevY) ?? rider.dir;
    const endJoin = this._plateFrontEdge(rider.prevX, rider.prevY, dir, this._worldPos2, grid);
    let join = endJoin;
    if (grid && renderT < 1 && (rider.prevX !== rider.x || rider.prevY !== rider.y)) {
      const bx = rider.prevX - DX[dir];
      const by = rider.prevY - DY[dir];
      if (grid.inBounds(bx, by) && isTrail(grid.get(bx, by))) {
        const backDir = grid.getTrailDir(bx, by);
        const startJoin = this._plateFrontEdge(bx, by, backDir, this._worldPos, grid);
        const st = renderT;
        join = {
          x: startJoin.x + (endJoin.x - startJoin.x) * st,
          z: startJoin.z + (endJoin.z - startJoin.z) * st,
        };
      }
    }
    const rear = this._bikeRearWorld(rider, bikeMesh, this._worldPos);
    const seg = lt.userData.segment;
    const dx = join.x - rear.x;
    const dz = join.z - rear.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.02) {
      seg.visible = true;
      seg.position.set((join.x + rear.x) / 2, TRAIL_H / 2, (join.z + rear.z) / 2);
      seg.rotation.y = bikeMesh?.rotation.y ?? this._trailRotation(dir);
      seg.scale.set(1, 1, dist);
    } else {
      seg.visible = false;
    }
  }

  ensureRiderMesh(rider) {
    if (!this.riderMeshes.has(rider.id)) {
      const mesh = this._buildBike(rider.def);
      this.scene.add(mesh);
      this.riderMeshes.set(rider.id, mesh);
      this._loadGltfBike(rider);
    }
    return this.riderMeshes.get(rider.id);
  }

  syncRiders(riders, playing, now = performance.now(), grid = null, renderT = 1) {
    for (const m of this.cellMeshes.values()) {
      if (m.userData?.isTrail) m.visible = true;
    }

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

      const targetAngle = BIKE_DIR_ANGLES[r.dir];
      let diff = targetAngle - r.smoothAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      r.smoothAngle += diff * 0.28;
      mesh.rotation.y = r.smoothAngle;

      if (mesh.userData.isSpriteBike) {
        // La caméra de poursuite reste toujours derrière le joueur une fois stabilisée :
        // pas besoin de faire varier sa vue, ça évite le clignotement pendant les virages.
        updateSpriteBike(mesh, this.camera.position, r.isPlayer ? 'back' : null);
      }

      const underKey = this._cellKey(r.x, r.y);
      const underMesh = this.cellMeshes.get(underKey);
      if (underMesh?.userData?.isTrail) underMesh.visible = false;

      if (playing) {
        let lt = this.liveTrails.get(r.id);
        if (!lt) {
          lt = this._buildLiveTrail(this.trailMats[r.id]);
          this.scene.add(lt);
          this.liveTrails.set(r.id, lt);
        }
        this._updateLiveTrail(lt, r, mesh, grid, renderT);
      }

      if (r.isPlayer) pulseBikeMaterials(mesh, now);
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
      color: rider.def.trailGlow, size: 0.2, transparent: true, opacity: 0.7,
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
    const dist = 17, height = 15, lookAhead = 5.3;

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
    this.bloomPass.strength = 0.28 + i * 0.18;
  }

  flashNearMiss() {
    if (!this.bloomPass) return;
    const prev = this.bloomPass.strength;
    this.bloomPass.strength = Math.min(0.65, prev + 0.18);
    setTimeout(() => {
      if (this.bloomPass) this.bloomPass.strength = prev;
    }, 120);
  }

  render() {
    if (this.composer) this.composer.render();
  }
}
