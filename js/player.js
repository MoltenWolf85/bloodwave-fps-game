// ============================================================
// player.js — FPS player controller: mouse look, WASD, jump,
//              sprint, gravity, collision detection, health
// ============================================================
import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js";

const PLAYER_HEIGHT = 1.75;
const PLAYER_RADIUS = 0.4;
const WALK_SPEED = 7;
const SPRINT_SPEED = 13;
const JUMP_FORCE = 8;
const GRAVITY = -22;
const MAX_HEALTH = 100;

export class Player {
  constructor(camera, scene, collidables) {
    this.camera = camera;
    this.scene = scene;
    this.collidables = collidables;

    // State
    this.health = MAX_HEALTH;
    this.maxHealth = MAX_HEALTH;
    this.isDead = false;
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.isSprinting = false;

    // Callbacks
    this.onDamage = null;
    this.onDeath = null;

    // Input
    this._keys = {};
    this._yaw = 0;
    this._pitch = 0;

    // Bounding box (for enemy collision checks)
    this.boundingBox = new THREE.Box3();

    // Head bob
    this._bobTime = 0;
    this._bobY = 0;

    this._setupInput();
  }

  // ── Input ──────────────────────────────────────────────────
  _setupInput() {
    document.addEventListener("keydown", (e) => {
      this._keys[e.code] = true;
    });
    document.addEventListener("keyup", (e) => {
      this._keys[e.code] = false;
    });
    document.addEventListener("mousemove", (e) => this._onMouseMove(e));
  }

  _onMouseMove(e) {
    if (document.pointerLockElement !== document.getElementById("canvas"))
      return;
    const sens = 0.0018;
    this._yaw -= e.movementX * sens;
    this._pitch -= e.movementY * sens;
    this._pitch = Math.max(
      -Math.PI / 2.2,
      Math.min(Math.PI / 2.2, this._pitch),
    );
  }

  // ── Update ─────────────────────────────────────────────────
  update(delta, sceneManager) {
    if (this.isDead) return;
    this._updateMovement(delta, sceneManager);
    this._updateCamera();
  }

  _updateMovement(delta, sceneManager) {
    const k = this._keys;

    // Sprint
    this.isSprinting = k["ShiftLeft"] || k["ShiftRight"];
    const speed = this.isSprinting ? SPRINT_SPEED : WALK_SPEED;

    // Horizontal movement direction
    const forward = new THREE.Vector3(
      -Math.sin(this._yaw),
      0,
      -Math.cos(this._yaw),
    );
    const right = new THREE.Vector3(
      Math.cos(this._yaw),
      0,
      -Math.sin(this._yaw),
    );

    let moveDir = new THREE.Vector3();
    if (k["KeyW"] || k["ArrowUp"]) moveDir.addScaledVector(forward, 1);
    if (k["KeyS"] || k["ArrowDown"]) moveDir.addScaledVector(forward, -1);
    if (k["KeyD"] || k["ArrowRight"]) moveDir.addScaledVector(right, 1);
    if (k["KeyA"] || k["ArrowLeft"]) moveDir.addScaledVector(right, -1);

    if (moveDir.lengthSq() > 0) moveDir.normalize();

    this.velocity.x = moveDir.x * speed;
    this.velocity.z = moveDir.z * speed;

    // Jump
    if (k["Space"] && this.onGround) {
      this.velocity.y = JUMP_FORCE;
      this.onGround = false;
    }

    // Gravity
    this.velocity.y += GRAVITY * delta;

    // Integrate position
    const pos = this.camera.position;
    pos.x += this.velocity.x * delta;
    pos.z += this.velocity.z * delta;
    pos.y += this.velocity.y * delta;

    // ── Collision resolution ──────────────────────────────────
    this._resolveCollisions(pos);

    // ── Terrain floor ─────────────────────────────────────────
    // Get terrain height via scene manager (injected via global)
    let groundY = window._sceneManager
      ? window._sceneManager.getTerrainHeight(pos.x, pos.z)
      : 0;
    const minY = groundY + PLAYER_HEIGHT;

    if (pos.y <= minY) {
      pos.y = minY;
      this.velocity.y = 0;
      this.onGround = true;
    } else if (pos.y > minY + 0.05) {
      this.onGround = false;
    }

    // Head bob
    const isMoving = moveDir.lengthSq() > 0 && this.onGround;
    if (isMoving) {
      const bobSpeed = this.isSprinting ? 14 : 9;
      this._bobTime += delta * bobSpeed;
      this._bobY = Math.sin(this._bobTime) * 0.06;
    } else {
      this._bobTime = 0;
      this._bobY += (0 - this._bobY) * delta * 10;
    }
  }

  _resolveCollisions(pos) {
    // Simple AABB vs AABB push-out
    const half = PLAYER_RADIUS;
    const h = PLAYER_HEIGHT;

    for (const c of this.collidables) {
      const b = c.box;

      // Broad check
      if (pos.x + half < b.min.x || pos.x - half > b.max.x) continue;
      if (pos.z + half < b.min.z || pos.z - half > b.max.z) continue;
      if (pos.y < b.min.y || pos.y - h > b.max.y) continue;

      // Overlap on each axis
      const ox1 = pos.x + half - b.min.x;
      const ox2 = b.max.x - (pos.x - half);
      const oz1 = pos.z + half - b.min.z;
      const oz2 = b.max.z - (pos.z - half);

      const ox = Math.min(ox1, ox2);
      const oz = Math.min(oz1, oz2);

      // Push out on smallest overlap axis
      if (ox < oz) {
        if (ox1 < ox2) pos.x -= ox;
        else pos.x += ox;
        this.velocity.x = 0;
      } else {
        if (oz1 < oz2) pos.z -= oz;
        else pos.z += oz;
        this.velocity.z = 0;
      }
    }
  }

  _updateCamera() {
    // Apply yaw/pitch to camera quaternion
    const qYaw = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this._yaw,
    );
    const qPitch = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      this._pitch,
    );
    this.camera.quaternion.copy(qYaw).multiply(qPitch);

    // Head bob offset
    this.camera.position.y += this._bobY;
  }

  // ── Public API ─────────────────────────────────────────────
  getPosition() {
    return this.camera.position.clone();
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.onDamage) this.onDamage(amount);
    if (this.health <= 0) {
      this.isDead = true;
      if (this.onDeath) this.onDeath();
    }
  }

  getBoundingBox() {
    const p = this.camera.position;
    this.boundingBox.setFromCenterAndSize(
      new THREE.Vector3(p.x, p.y - PLAYER_HEIGHT / 2, p.z),
      new THREE.Vector3(PLAYER_RADIUS * 2, PLAYER_HEIGHT, PLAYER_RADIUS * 2),
    );
    return this.boundingBox;
  }
}

// Make scene manager available for terrain height sampling
// (set by main.js after init)
