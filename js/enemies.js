// ============================================================
// enemies.js — Enemy AI: spawning, movement, attack, death
// ============================================================
import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js";

const ENEMY_RADIUS = 0.5;
const ENEMY_HEIGHT = 1.8;
const ATTACK_RANGE = 2.2;
const ATTACK_DAMAGE = 8;
const ATTACK_RATE = 1.2; // attacks per second

export class EnemySystem {
  constructor(scene, collidables) {
    this.scene = scene;
    this.collidables = collidables;
    this.enemies = [];
    this._raycaster = new THREE.Raycaster();

    // Shared geometry / materials for performance
    this._buildSharedAssets();
  }

  _buildSharedAssets() {
    // Body
    this.bodyGeo = new THREE.BoxGeometry(0.7, 1.1, 0.4);
    this.headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    this.limbGeo = new THREE.BoxGeometry(0.22, 0.85, 0.22);

    this.matBase = new THREE.MeshLambertMaterial({ color: 0x2d4a1e }); // dark green uniform
    this.matHead = new THREE.MeshLambertMaterial({ color: 0xc68642 }); // skin
    this.matHelm = new THREE.MeshLambertMaterial({ color: 0x3b3b3b }); // helmet
    this.matLimb = new THREE.MeshLambertMaterial({ color: 0x2d4a1e });

    // Health bar texture
    this.hbBgMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    this.hbFgMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  }

  // ── Spawn ──────────────────────────────────────────────────
  spawn(config) {
    // config: { hp, speed, count, spawnRadius }
    for (let i = 0; i < config.count; i++) {
      setTimeout(() => this._spawnOne(config), i * 300);
    }
  }

  _spawnOne(config) {
    const angle = Math.random() * Math.PI * 2;
    const r = config.spawnRadius + Math.random() * 15;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y =
      (window._sceneManager?.getTerrainHeight(x, z) ?? 0) + ENEMY_HEIGHT / 2;

    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Body
    const body = new THREE.Mesh(this.bodyGeo, this.matBase.clone());
    body.position.y = 0;
    body.castShadow = true;
    group.add(body);

    // Head
    const head = new THREE.Mesh(this.headGeo, this.matHead.clone());
    head.position.y = 0.8;
    head.castShadow = true;
    group.add(head);

    // Helmet
    const helm = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.28, 0.55),
      this.matHelm.clone(),
    );
    helm.position.y = 1.0;
    group.add(helm);

    // Arms
    const armL = new THREE.Mesh(this.limbGeo, this.matLimb.clone());
    armL.position.set(-0.46, -0.05, 0);
    armL.castShadow = true;
    group.add(armL);

    const armR = armL.clone();
    armR.position.set(0.46, -0.05, 0);
    group.add(armR);

    // Legs
    const legL = new THREE.Mesh(this.limbGeo, this.matLimb.clone());
    legL.position.set(-0.2, -0.97, 0);
    legL.castShadow = true;
    group.add(legL);

    const legR = legL.clone();
    legR.position.set(0.2, -0.97, 0);
    group.add(legR);

    // Health bar (billboard)
    const hbBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.1),
      this.hbBgMat.clone(),
    );
    const hbFg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    );
    hbBg.position.set(0, 1.5, 0);
    hbFg.position.set(0, 1.5, 0.001);
    hbFg.scale.x = 1;
    group.add(hbBg, hbFg);

    this.scene.add(group);

    const enemy = {
      group,
      body,
      head,
      armL,
      armR,
      legL,
      legR,
      hbFg,
      hp: config.hp,
      maxHp: config.hp,
      speed: config.speed,
      velocity: new THREE.Vector3(),
      onGround: true,
      attackTimer: Math.random() * ATTACK_RATE,
      animTime: Math.random() * Math.PI * 2,
      isAlive: true,
      deathTimer: 0,
      isDying: false,
      flashTimer: 0,
    };

    this.enemies.push(enemy);
    return enemy;
  }

  // ── Update ─────────────────────────────────────────────────
  update(delta, playerPos) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.isAlive) {
        this._updateDeath(e, delta);
        if (e.deathTimer > 1.5) {
          this.scene.remove(e.group);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      this._updateAI(e, delta, playerPos);
      this._updateAnimation(e, delta);
      this._updateHealthBar(e, playerPos);
      this._updateFlash(e, delta);
    }
  }

  _updateAI(e, delta, playerPos) {
    const pos = e.group.position;

    // Direction to player
    const toPlayer = new THREE.Vector3(
      playerPos.x - pos.x,
      0,
      playerPos.z - pos.z,
    );
    const dist = toPlayer.length();

    if (dist < 0.1) return;
    toPlayer.normalize();

    // Face player
    e.group.lookAt(playerPos.x, pos.y, playerPos.z);

    // Gravity
    e.velocity.y += -22 * delta;

    // Move toward player (stop at attack range)
    if (dist > ATTACK_RANGE - 0.3) {
      // Obstacle avoidance: try slight angles if directly blocked
      const moveVec = toPlayer.clone().multiplyScalar(e.speed * delta);
      pos.x += moveVec.x;
      pos.z += moveVec.z;
      this._resolveEnemyCollisions(e, pos);
    }

    // Vertical
    pos.y += e.velocity.y * delta;
    const gy =
      (window._sceneManager?.getTerrainHeight(pos.x, pos.z) ?? 0) +
      ENEMY_HEIGHT / 2;
    if (pos.y <= gy) {
      pos.y = gy;
      e.velocity.y = 0;
      e.onGround = true;
    }

    // Attack
    if (dist <= ATTACK_RANGE) {
      e.attackTimer -= delta;
      if (e.attackTimer <= 0) {
        e.attackTimer = 1 / ATTACK_RATE;
        // Notify player (handled externally via reference)
        if (window._player && !window._player.isDead) {
          window._player.takeDamage(ATTACK_DAMAGE);
        }
      }
    }
  }

  _resolveEnemyCollisions(e, pos) {
    const half = ENEMY_RADIUS;
    for (const c of this.collidables) {
      const b = c.box;
      if (pos.x + half < b.min.x || pos.x - half > b.max.x) continue;
      if (pos.z + half < b.min.z || pos.z - half > b.max.z) continue;
      if (pos.y < b.min.y - ENEMY_HEIGHT || pos.y > b.max.y + 1) continue;

      const ox1 = pos.x + half - b.min.x;
      const ox2 = b.max.x - (pos.x - half);
      const oz1 = pos.z + half - b.min.z;
      const oz2 = b.max.z - (pos.z - half);
      const ox = Math.min(ox1, ox2);
      const oz = Math.min(oz1, oz2);

      if (ox < oz) {
        pos.x += ox1 < ox2 ? -ox : ox;
      } else {
        pos.z += oz1 < oz2 ? -oz : oz;
      }
    }
  }

  _updateAnimation(e, delta) {
    const pos = e.group.position;
    const playerPos = window._player?.getPosition();
    if (!playerPos) return;
    const dist = pos.distanceTo(playerPos);
    const moving = dist > ATTACK_RANGE;

    if (moving) {
      e.animTime += delta * e.speed * 2.5;
      const swing = Math.sin(e.animTime) * 0.5;
      e.armL.rotation.x = swing;
      e.armR.rotation.x = -swing;
      e.legL.rotation.x = -swing;
      e.legR.rotation.x = swing;
    } else {
      // Attack animation
      e.animTime += delta * 8;
      const swing = Math.sin(e.animTime) * 0.3;
      e.armL.rotation.x = swing - 0.3;
      e.armR.rotation.x = swing - 0.3;
      e.legL.rotation.x = 0;
      e.legR.rotation.x = 0;
    }
  }

  _updateHealthBar(e, playerPos) {
    // Billboard toward camera
    const pos = e.group.position;
    e.group.children.forEach((c) => {
      if (c === e.hbFg || c.material === this.hbBgMat) {
        if (window._sceneManager) {
          const cam = window._sceneManager.camera ?? window._player?.camera;
          if (cam) {
            c.lookAt(cam.position);
          }
        }
      }
    });

    // Update health bar width
    const frac = e.hp / e.maxHp;
    e.hbFg.scale.x = Math.max(0, frac);
    e.hbFg.position.x = (frac - 1) * 0.45;

    // Color based on HP
    if (frac > 0.5) e.hbFg.material.color.setHex(0x22c55e);
    else if (frac > 0.25) e.hbFg.material.color.setHex(0xf59e0b);
    else e.hbFg.material.color.setHex(0xef4444);
  }

  _updateFlash(e, delta) {
    if (e.flashTimer > 0) {
      e.flashTimer -= delta;
      const c = e.flashTimer > 0 ? 0xffffff : 0x2d4a1e;
      e.body.material.color.setHex(c);
      e.head.material.color.setHex(e.flashTimer > 0 ? 0xffffff : 0xc68642);
    }
  }

  _updateDeath(e, delta) {
    e.deathTimer += delta;
    // Fall over
    e.group.rotation.x = Math.min(e.group.rotation.x + delta * 3, Math.PI / 2);
    e.group.position.y -= delta * 1.5;
    // Fade
    const opacity = Math.max(0, 1 - e.deathTimer);
    e.group.traverse((c) => {
      if (c.material) {
        c.material.transparent = true;
        c.material.opacity = opacity;
      }
    });
  }

  // ── Damage ─────────────────────────────────────────────────
  hitEnemy(enemy, damage) {
    if (!enemy.isAlive) return false;
    enemy.hp -= damage;
    enemy.flashTimer = 0.1;
    if (enemy.hp <= 0) {
      enemy.isAlive = false;
      enemy.isDying = true;
      return true; // killed
    }
    return false;
  }

  // ── Raycasting (for shooting) ──────────────────────────────
  raycastEnemies(origin, direction) {
    // Returns { enemy, point, distance } or null
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    let best = null;
    let bestDist = Infinity;

    for (const e of this.enemies) {
      if (!e.isAlive) continue;
      const pos = e.group.position;

      // Sphere test (fast)
      const toCenter = pos.clone().sub(origin);
      const tca = toCenter.dot(direction);
      if (tca < 0) continue;
      const d2 = toCenter.lengthSq() - tca * tca;
      const r2 = 0.9 * 0.9; // enemy hit radius
      if (d2 > r2) continue;

      const dist = tca - Math.sqrt(r2 - d2);
      if (dist < bestDist) {
        bestDist = dist;
        best = {
          enemy: e,
          point: origin.clone().addScaledVector(direction, dist),
          distance: dist,
        };
      }
    }
    return best;
  }

  getAliveCount() {
    return this.enemies.filter((e) => e.isAlive).length;
  }

  clearAll() {
    for (const e of this.enemies) {
      this.scene.remove(e.group);
    }
    this.enemies = [];
  }
}
