// ============================================================
// main.js — Game entry point & loop
// ============================================================
import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js";
import { SceneManager } from "./scene.js";
import { Player } from "./player.js";
import { EnemySystem } from "./enemies.js";
import { WaveManager } from "./waves.js";
import { ShootingSystem } from "./shooting.js";
import { HUD } from "./hud.js";
import { AudioManager } from "./audio.js";

let renderer,
  sceneManager,
  player,
  enemySystem,
  waveManager,
  shootingSystem,
  hud,
  audio;
let gameRunning = false,
  gamePaused = false,
  clock;

window.startGame = startGame;
window.restartGame = restartGame;
window.resumeGame = resumeGame;

function init() {
  const canvas = document.getElementById("canvas");

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.autoClear = false;

  clock = new THREE.Clock();

  audio = new AudioManager();
  sceneManager = new SceneManager(renderer);
  player = new Player(
    sceneManager.camera,
    sceneManager.scene,
    sceneManager.collidables,
  );
  enemySystem = new EnemySystem(sceneManager.scene, sceneManager.collidables);
  shootingSystem = new ShootingSystem(sceneManager.scene, player, enemySystem);
  waveManager = new WaveManager(enemySystem, player);
  hud = new HUD(player, waveManager, shootingSystem);

  // Wire audio
  shootingSystem.audio = audio;
  player.audio = audio;
  waveManager.audio = audio;

  // Wire scene to wave manager (for ammo drops)
  waveManager.scene = sceneManager.scene;

  // Globals used by systems
  window._sceneManager = sceneManager;
  window._player = player;
  window._enemySystem = enemySystem;
  window._shootingSystem = shootingSystem;

  shootingSystem.onHit = () => hud.showHitIndicator();
  shootingSystem.onKill = () => {
    hud.addKill();
    waveManager.onEnemyKilled();
  };
  player.onDamage = (amt) => {
    hud.showDamage(amt);
    audio.play("player_hurt");
  };
  player.onDeath = () => {
    audio.play("player_death");
    showGameOver();
  };

  sceneManager.camera.position.set(0, 10, 5);

  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);
}

function startGame() {
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("hud").style.display = "block";
  document.getElementById("canvas").requestPointerLock();
  document.addEventListener("pointerlockchange", onPointerLock);
  gameRunning = true;
  waveManager.start();
  clock.start();
  animate();
}

function restartGame() {
  location.reload();
}

function resumeGame() {
  document.getElementById("paused-screen").style.display = "none";
  document.getElementById("canvas").requestPointerLock();
  gamePaused = false;
}

function showGameOver() {
  gameRunning = false;
  document.exitPointerLock();
  document.getElementById("gameover-screen").style.display = "flex";
  document.getElementById("go-wave").textContent = waveManager.currentWave;
  document.getElementById("go-kills").textContent = hud.totalKills;
  document.getElementById("go-score").textContent = hud.score;
}

function onPointerLock() {
  if (document.pointerLockElement === document.getElementById("canvas")) {
    gamePaused = false;
    if (document.getElementById("paused-screen").style.display !== "none") {
      document.getElementById("paused-screen").style.display = "none";
    }
  }
}

function onKeyDown(e) {
  if (e.code === "Escape" && gameRunning && !player.isDead) {
    if (!gamePaused) {
      gamePaused = true;
      document.exitPointerLock();
      document.getElementById("paused-screen").style.display = "flex";
    }
  }
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  sceneManager.camera.aspect = window.innerWidth / window.innerHeight;
  sceneManager.camera.updateProjectionMatrix();
}

let fpsFrames = 0,
  fpsClock = 0;

function animate() {
  requestAnimationFrame(animate);
  if (!gameRunning || gamePaused) return;

  const delta = Math.min(clock.getDelta(), 0.05);

  fpsFrames++;
  fpsClock += delta;
  if (fpsClock >= 0.5) {
    document.getElementById("fps").textContent =
      `FPS: ${Math.round(fpsFrames / fpsClock)}`;
    fpsFrames = 0;
    fpsClock = 0;
  }

  player.update(delta);
  enemySystem.update(delta, player.getPosition());
  shootingSystem.update(delta);
  waveManager.update(delta);
  sceneManager.update(delta);
  hud.update(delta);

  renderer.clear();
  renderer.render(sceneManager.scene, sceneManager.camera);
  shootingSystem.renderWeapon(renderer);
}

init();
