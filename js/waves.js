// ============================================================
// waves.js — Wave manager: progression, difficulty scaling
// ============================================================

const WAVE_CONFIGS = [
  { count: 5, hp: 40, speed: 3.5, spawnRadius: 40 },
  { count: 8, hp: 55, speed: 4.0, spawnRadius: 45 },
  { count: 12, hp: 70, speed: 4.5, spawnRadius: 50 },
  { count: 15, hp: 90, speed: 5.0, spawnRadius: 45 },
  { count: 20, hp: 110, speed: 5.5, spawnRadius: 50 },
  { count: 25, hp: 130, speed: 6.0, spawnRadius: 55 },
  { count: 30, hp: 160, speed: 6.5, spawnRadius: 55 },
  { count: 35, hp: 200, speed: 7.0, spawnRadius: 60 },
];

const BETWEEN_WAVE_DELAY = 6; // seconds

export class WaveManager {
  constructor(enemySystem, player) {
    this.enemySystem = enemySystem;
    this.player = player;
    this.currentWave = 0;
    this.state = "idle"; // idle | active | between
    this._timer = 0;
    this.audio = null; // set by main.js
    this._killsThisWave = 0;
    this._totalKillsExpected = 0;
  }

  start() {
    this.currentWave = 0;
    this._nextWave();
  }

  _nextWave() {
    this.currentWave++;
    this._killsThisWave = 0;

    const cfg = this._waveConfig(this.currentWave);
    this._totalKillsExpected = cfg.count;

    this.state = "active";
    this.enemySystem.spawn(cfg);

    this._showAnnouncement(this.currentWave);
    this._updateUI();
    this.audio?.play("wave_start");
  }

  _waveConfig(wave) {
    const base = WAVE_CONFIGS[Math.min(wave - 1, WAVE_CONFIGS.length - 1)];

    // Beyond preset waves: keep scaling
    const extra = Math.max(0, wave - WAVE_CONFIGS.length);
    return {
      count: base.count + extra * 5,
      hp: base.hp + extra * 30,
      speed: Math.min(base.speed + extra * 0.3, 10),
      spawnRadius: base.spawnRadius,
    };
  }

  onEnemyKilled() {
    this._killsThisWave++;
    this._updateUI();
  }

  update(delta) {
    if (this.state === "between") {
      this._timer -= delta;
      if (this._timer <= 0) {
        this._nextWave();
      }
    } else if (this.state === "active") {
      // Check if wave is cleared
      const alive = this.enemySystem.getAliveCount();
      if (alive === 0 && this._killsThisWave >= this._totalKillsExpected) {
        // Small buffer before declaring wave clear
        this._timer = this._timer || BETWEEN_WAVE_DELAY;
        this._timer -= delta;
        if (this._timer <= 0) {
          this.state = "between";
          this._timer = BETWEEN_WAVE_DELAY;
          this._showWaveClear();
          this.audio?.play("wave_clear");
          this._updateUI();
        }
      } else {
        this._timer = BETWEEN_WAVE_DELAY; // reset
      }
    }
  }

  _showAnnouncement(wave) {
    const el = document.getElementById("wave-announce");
    const txt = document.getElementById("wave-announce-text");
    const sub = document.getElementById("wave-announce-sub");
    txt.textContent = `WAVE ${wave}`;
    sub.textContent =
      wave === 1
        ? "PREPARE FOR BATTLE"
        : `${this._waveConfig(wave).count} ENEMIES INCOMING`;
    el.style.opacity = "1";
    setTimeout(() => {
      el.style.opacity = "0";
    }, 2500);
  }

  _showWaveClear() {
    const el = document.getElementById("wave-announce");
    const txt = document.getElementById("wave-announce-text");
    const sub = document.getElementById("wave-announce-sub");
    txt.textContent = "WAVE CLEARED!";
    txt.style.color = "#22c55e";
    sub.textContent = `NEXT WAVE IN ${BETWEEN_WAVE_DELAY}s`;
    el.style.opacity = "1";
    setTimeout(() => {
      el.style.opacity = "0";
      txt.style.color = "#f59e0b";
    }, 3000);
  }

  _updateUI() {
    document.getElementById("wave-number").textContent = this.currentWave;
    const alive = this.enemySystem.getAliveCount();
    document.getElementById("enemy-count").textContent =
      this.state === "between"
        ? `NEXT WAVE IN ${Math.ceil(this._timer)}s`
        : `${alive} enemies`;
  }
}
