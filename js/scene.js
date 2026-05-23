// ============================================================
// scene.js — World: terrain, buildings, trees, sky, lighting
//             Fixed: hitboxes match geometry, no floating objects
// ============================================================
import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js";

export class SceneManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.collidables = [];
    this._buildCamera();
    this._buildSky();
    this._buildLighting();
    this._buildTerrain();
    this._buildStructures();
    this._buildVegetation();
    this._buildBoundaryWalls();
  }

  _buildCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 2, 0);
  }

  _buildSky() {
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0xc9e8f0, 0.008);
    const skyGeo = new THREE.SphereGeometry(500, 16, 8);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      side: THREE.BackSide,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  _buildLighting() {
    this.scene.add(new THREE.AmbientLight(0xffeedd, 0.4));
    this.sun = new THREE.DirectionalLight(0xfff5cc, 1.2);
    this.sun.position.set(80, 120, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 2048;
    this.sun.shadow.mapSize.height = 2048;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 500;
    this.sun.shadow.camera.left = -150;
    this.sun.shadow.camera.right = 150;
    this.sun.shadow.camera.top = 150;
    this.sun.shadow.camera.bottom = -150;
    this.sun.shadow.bias = -0.001;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3d6e23, 0.5));
  }

  _buildTerrain() {
    const SIZE = 300,
      SEG = 80;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      const dist = Math.sqrt(x * x + z * z);
      let y = 0;
      if (dist > 30) {
        y = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 3;
        y += Math.sin(x * 0.08 + 1) * Math.cos(z * 0.06) * 2;
        y += (dist - 30) * 0.04;
      }
      if (dist < 15) y = 0;
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    this.terrainGeo = geo;

    this.terrain = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ color: 0x4a7c3f }),
    );
    this.terrain.receiveShadow = true;
    this.terrain.name = "terrain";
    this.scene.add(this.terrain);
    this.terrainMesh = this.terrain;
    this._buildTerrainRaycaster();

    const dirtMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
    for (let i = 0; i < 30; i++) {
      const r = 3 + Math.random() * 6;
      const pg = new THREE.CircleGeometry(r, 8);
      pg.rotateX(-Math.PI / 2);
      const pm = new THREE.Mesh(pg, dirtMat);
      pm.position.set(rand(-120, 120), 0.02, rand(-120, 120));
      pm.receiveShadow = true;
      this.scene.add(pm);
    }
  }

  _buildTerrainRaycaster() {
    this._terrainRay = new THREE.Raycaster();
    this._terrainRay.ray.direction.set(0, -1, 0);
  }

  getTerrainHeight(x, z) {
    this._terrainRay.ray.origin.set(x, 100, z);
    const hits = this._terrainRay.intersectObject(this.terrain);
    return hits.length ? hits[0].point.y : 0;
  }

  // ── Structures ─────────────────────────────────────────────
  _buildStructures() {
    // Central bunker — snapped to terrain
    this._addBuilding(0, 0, 12, 6, 10, 0.3);

    // Village cluster
    const villagePos = [
      [40, 20],
      [-40, 20],
      [40, -20],
      [-40, -20],
      [60, 0],
      [-60, 0],
      [20, 50],
      [-20, 50],
      [20, -50],
      [-20, -50],
    ];
    villagePos.forEach(([x, z]) => {
      const w = 6 + Math.random() * 6;
      const h = 4 + Math.random() * 4;
      const d = 6 + Math.random() * 6;
      this._addBuilding(x, z, w, h, d, Math.random() * 0.3);
    });

    const towers = [
      [80, 80],
      [-80, 80],
      [80, -80],
      [-80, -80],
    ];
    towers.forEach(([x, z]) => this._addTower(x, z));
    this._addBarriers();
  }

  _addBuilding(cx, cz, w, h, d, variation) {
    // Sample terrain at corners to find lowest point — embed into ground
    const gy = Math.min(
      this.getTerrainHeight(cx - w / 2, cz - d / 2),
      this.getTerrainHeight(cx + w / 2, cz - d / 2),
      this.getTerrainHeight(cx - w / 2, cz + d / 2),
      this.getTerrainHeight(cx + w / 2, cz + d / 2),
      this.getTerrainHeight(cx, cz),
    );

    const wallMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(
        0.6 + variation,
        0.55 + variation * 0.5,
        0.45 + variation * 0.3,
      ),
    });

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    mesh.position.set(cx, gy + h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isStatic = true;
    this.scene.add(mesh);

    // Roof flush on top
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b2c0f });
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.4, d + 0.6),
      roofMat,
    );
    roof.position.set(cx, gy + h + 0.2, cz);
    roof.castShadow = true;
    roof.userData.isStatic = true;
    this.scene.add(roof);

    // Collision box: starts at terrain level (gy), not floating
    const box = new THREE.Box3(
      new THREE.Vector3(cx - w / 2, gy, cz - d / 2),
      new THREE.Vector3(cx + w / 2, gy + h + 1, cz + d / 2),
    );
    this.collidables.push({ box, type: "building" });
  }

  _addTower(cx, cz) {
    const gy = Math.min(
      this.getTerrainHeight(cx - 2.5, cz - 2.5),
      this.getTerrainHeight(cx + 2.5, cz - 2.5),
      this.getTerrainHeight(cx - 2.5, cz + 2.5),
      this.getTerrainHeight(cx + 2.5, cz + 2.5),
      this.getTerrainHeight(cx, cz),
    );
    const mat = new THREE.MeshLambertMaterial({ color: 0x8c7355 });

    // Height reaches from terrain to top
    const towerH = 10;
    const base = new THREE.Mesh(new THREE.BoxGeometry(5, towerH, 5), mat);
    base.position.set(cx, gy + towerH / 2, cz);
    base.castShadow = true;
    base.userData.isStatic = true;
    this.scene.add(base);

    const top = new THREE.Mesh(new THREE.BoxGeometry(7, 1, 7), mat);
    top.position.set(cx, gy + towerH + 0.5, cz);
    top.castShadow = true;
    top.userData.isStatic = true;
    this.scene.add(top);

    const box = new THREE.Box3(
      new THREE.Vector3(cx - 3.5, gy, cz - 3.5),
      new THREE.Vector3(cx + 3.5, gy + towerH + 1, cz + 3.5),
    );
    this.collidables.push({ box, type: "building" });
  }

  _addBarriers() {
    const barrierMat = new THREE.MeshLambertMaterial({ color: 0x6b7280 });
    // [cx, cz, w, h, d, ry]
    const barriers = [
      [20, 5, 8, 1.2, 0.6, 0],
      [-20, 5, 8, 1.2, 0.6, 0],
      [0, 15, 0.6, 1.2, 8, 0],
      [15, -10, 5, 1.2, 0.6, 0], // removed rotation to keep AABB accurate
      [-15, -10, 5, 1.2, 0.6, 0],
      [30, 30, 6, 1.5, 0.6, 0],
      [-30, 30, 6, 1.5, 0.6, 0],
    ];

    barriers.forEach(([cx, cz, w, h, d]) => {
      const gy = this.getTerrainHeight(cx, cz);
      const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), barrierMat);
      // Place mesh so bottom sits on terrain
      g.position.set(cx, gy + h / 2, cz);
      g.castShadow = true;
      g.userData.isStatic = true;
      this.scene.add(g);

      // Collision box snapped to terrain
      const box = new THREE.Box3(
        new THREE.Vector3(cx - w / 2, gy, cz - d / 2),
        new THREE.Vector3(cx + w / 2, gy + h + 0.1, cz + d / 2),
      );
      this.collidables.push({ box, type: "barrier" });
    });
  }

  // ── Vegetation ─────────────────────────────────────────────
  _buildVegetation() {
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 3, 6);
    const leafGeo = new THREE.ConeGeometry(1.8, 4, 7);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3d1a });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2d6a1f });
    const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x3a8a27 });

    const TREE_COUNT = 200;
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_COUNT);
    const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, TREE_COUNT);
    const leaf2Inst = new THREE.InstancedMesh(leafGeo, leafMat2, TREE_COUNT);
    trunkInst.castShadow = true;
    leafInst.castShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0,
      attempts = 0;

    while (placed < TREE_COUNT && attempts < 2000) {
      attempts++;
      const x = rand(-130, 130),
        z = rand(-130, 130);
      const dist = Math.sqrt(x * x + z * z);
      if (dist < 20) continue;
      if (this._isInsideStructure(x, z)) continue;

      const gy = this.getTerrainHeight(x, z);
      const scale = 0.7 + Math.random() * 0.8;

      // Trunk: bottom at terrain level
      dummy.position.set(x, gy + 1.5 * scale, z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      trunkInst.setMatrixAt(placed, dummy.matrix);

      // Leaves: sitting above trunk
      dummy.position.set(x, gy + 3.0 * scale + 1.0, z);
      dummy.scale.set(scale, scale * 1.1, scale);
      dummy.updateMatrix();
      leafInst.setMatrixAt(placed, dummy.matrix);

      dummy.position.set(x, gy + 4.2 * scale + 1.0, z);
      dummy.scale.set(scale * 0.7, scale * 0.9, scale * 0.7);
      dummy.updateMatrix();
      leaf2Inst.setMatrixAt(placed, dummy.matrix);

      placed++;
    }

    trunkInst.instanceMatrix.needsUpdate = true;
    leafInst.instanceMatrix.needsUpdate = true;
    leaf2Inst.instanceMatrix.needsUpdate = true;
    this.scene.add(trunkInst, leafInst, leaf2Inst);

    // Rocks — sit on terrain
    const rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const ROCK_COUNT = 80;
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, ROCK_COUNT);
    for (let i = 0; i < ROCK_COUNT; i++) {
      const x = rand(-130, 130),
        z = rand(-130, 130);
      const gy = this.getTerrainHeight(x, z);
      const s = 0.4 + Math.random() * 0.8;
      // Place so rock rests on ground (radius * 0.6 is approx half-height for dodecahedron)
      dummy.position.set(x, gy + s * 0.5, z);
      dummy.scale.set(s, s * 0.6, s);
      dummy.rotation.set(Math.random(), Math.random(), Math.random());
      dummy.updateMatrix();
      rockInst.setMatrixAt(i, dummy.matrix);
    }
    rockInst.instanceMatrix.needsUpdate = true;
    rockInst.castShadow = true;
    this.scene.add(rockInst);

    this._buildGrass();
  }

  _buildGrass() {
    const grassMat = new THREE.MeshBasicMaterial({
      color: 0x4a8c30,
      side: THREE.DoubleSide,
    });
    const GRASS_COUNT = 500;
    const gGeo = new THREE.PlaneGeometry(0.6, 0.8);
    const inst = new THREE.InstancedMesh(gGeo, grassMat, GRASS_COUNT * 2);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < GRASS_COUNT; i++) {
      const x = rand(-130, 130),
        z = rand(-130, 130);
      const gy = this.getTerrainHeight(x, z);
      dummy.position.set(x, gy + 0.4, z);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.scale.setScalar(0.8 + Math.random() * 0.6);
      dummy.updateMatrix();
      inst.setMatrixAt(i * 2, dummy.matrix);
      dummy.rotation.y += Math.PI / 2;
      dummy.updateMatrix();
      inst.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);
  }

  _isInsideStructure(x, z) {
    for (const c of this.collidables) {
      if (
        c.box.min.x - 2 < x &&
        x < c.box.max.x + 2 &&
        c.box.min.z - 2 < z &&
        z < c.box.max.z + 2
      )
        return true;
    }
    return false;
  }

  _buildBoundaryWalls() {
    const BOUND = 148;
    const walls = [
      [0, BOUND, BOUND * 2, 1],
      [0, -BOUND, BOUND * 2, 1],
      [BOUND, 0, 1, BOUND * 2],
      [-BOUND, 0, 1, BOUND * 2],
    ];
    walls.forEach(([cx, cz, w, d]) => {
      const box = new THREE.Box3(
        new THREE.Vector3(cx - w / 2, -5, cz - d / 2),
        new THREE.Vector3(cx + w / 2, 50, cz + d / 2),
      );
      this.collidables.push({ box, type: "boundary" });
    });
  }

  update(delta) {}
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}
