// ============================================================
// hud.js — HUD: health bar, damage vignette, kill feed,
//           score, hit indicators, ammo pickup notification
// ============================================================

export class HUD {
  constructor(player, waveManager, shootingSystem) {
    this.player = player;
    this.waveManager = waveManager;
    this.shootingSystem = shootingSystem;

    this.totalKills = 0;
    this.score = 0;
    this._damageTimer = 0;
    this._hitTimer = 0;
  }

  update(delta) {
    const hp = this.player.health;
    const pct = hp / this.player.maxHealth;
    const bar = document.getElementById("health-bar");
    bar.style.width = `${pct * 100}%`;

    if (pct > 0.5)
      bar.style.background = "linear-gradient(90deg,#22c55e,#86efac)";
    else if (pct > 0.25)
      bar.style.background = "linear-gradient(90deg,#f59e0b,#fcd34d)";
    else bar.style.background = "linear-gradient(90deg,#ef4444,#f87171)";

    document.getElementById("health-value").textContent =
      `${Math.ceil(hp)} / ${this.player.maxHealth}`;

    const vig = document.getElementById("damage-vignette");
    if (this._damageTimer > 0) {
      this._damageTimer -= delta;
      vig.style.opacity = Math.min(1, this._damageTimer * 2).toFixed(2);
    } else {
      vig.style.opacity = "0";
    }

    if (pct < 0.3) {
      const pulse = (Math.sin(Date.now() * 0.003) * 0.5 + 0.5) * 0.4;
      vig.style.opacity = Math.max(
        parseFloat(vig.style.opacity),
        pulse,
      ).toFixed(2);
    }

    const hitEl = document.getElementById("hit-indicator");
    if (this._hitTimer > 0) {
      this._hitTimer -= delta;
      hitEl.style.opacity = this._hitTimer > 0 ? "1" : "0";
    }

    document.getElementById("score-value").textContent = this.score;

    const alive = window._enemySystem?.getAliveCount() ?? 0;
    if (this.waveManager.state === "active") {
      document.getElementById("enemy-count").textContent = `${alive} zombies`;
    } else if (this.waveManager.state === "between") {
      const t = Math.ceil(this.waveManager._timer);
      document.getElementById("enemy-count").textContent = `Next wave in ${t}s`;
    }
  }

  showDamage(amount) {
    this._damageTimer = 0.8;
    document.getElementById("damage-vignette").style.opacity = "0.7";
  }

  showHitIndicator() {
    this._hitTimer = 0.15;
    document.getElementById("hit-indicator").style.opacity = "1";
  }

  addKill() {
    this.totalKills++;
    this.score += 100 * this.waveManager.currentWave;
    this._addKillNotification();
  }

  _addKillNotification() {
    const feed = document.getElementById("kill-feed");
    const el = document.createElement("div");
    el.className = "kill-notification";
    el.textContent = `✕ ZOMBIE DOWN  +${100 * this.waveManager.currentWave}`;
    feed.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2100);
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);
  }
}
