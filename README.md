# BLOODWAVE FPS

A browser-based wave survival FPS built with Three.js. Fight off endless zombie hordes across an open world with 4 weapons, terrain, structures, and a full HUD.

## Running the Game

Serve the project from a local HTTP server (required for ES modules):

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Then open `http://localhost:8080` in your browser.

## Controls

| Input | Action |
|---|---|
| `WASD` | Move |
| `Mouse` | Aim |
| `LMB` | Shoot |
| `RMB` | Aim down sights |
| `R` | Reload |
| `Shift` | Sprint |
| `Space` | Jump |
| `1 2 3 4` | Switch weapon |
| `Esc` | Pause |

## Weapons

| Key | Weapon | Mag | Notes |
|---|---|---|---|
| `1` | M4 Assault Rifle | 30 | Full-auto, balanced |
| `2` | MP5 SMG | 40 | Fast fire rate |
| `3` | SPAS-12 Shotgun | 8 | 6 pellets per shot |
| `4` | AWP Sniper | 5 | High damage, slow |

## Project Structure

```
index.html          — Main page & HUD layout
sounds/             — Audio files (.wav)
js/
  main.js           — Game loop & entry point
  scene.js          — World: terrain, buildings, trees, lighting
  player.js         — FPS controller: movement, camera, health
  enemies.js        — Zombie AI: spawn, pathfinding, animation, death
  shooting.js       — Weapon system: raycast, viewmodel, muzzle flash
  waves.js          — Wave progression, ammo packs
  hud.js            — Health bar, kill feed, score, damage vignette
  audio.js          — Web Audio API sound manager
```

## Sound Files

Place `.wav` files in the `sounds/` folder. The game runs without them — missing files are silently skipped.

| File | Event |
|---|---|
| `shoot_rifle.wav` | M4 fire |
| `shoot_smg.wav` | MP5 fire |
| `shoot_shotgun.wav` | SPAS-12 fire |
| `shoot_sniper.wav` | AWP fire |
| `reload.wav` | Reload |
| `empty_click.wav` | Empty mag |
| `hit_enemy.wav` | Enemy hit |
| `kill_enemy.wav` | Enemy killed |
| `player_hurt.wav` | Player takes damage |
| `player_death.wav` | Player death |
| `wave_start.wav` | Wave begins |
| `wave_clear.wav` | Wave completed |
| `ammo_pickup.wav` | Ammo pack collected |
| `footstep_walk.wav` | Walking footstep |
| `footstep_sprint.wav` | Sprint footstep |

## Dependencies

- [Three.js r128](https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js) — loaded via CDN, no install needed