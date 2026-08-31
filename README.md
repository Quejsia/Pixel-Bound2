# Pixel Shooter RPG — Phase 1 / Step 2

A 2D pixel-art top-down shooter built with React + Canvas, designed for web and mobile (wrap with Capacitor later for native Android/iOS builds).

## What's playable
- Virtual joystick movement (touch + mouse)
- Auto-aim (fires at nearest enemy) or manual twin-stick aiming — toggle from the start screen or Settings
- Dodge roll with cooldown + brief invulnerability
- Four enemy types: slime, goblin, skeleton and archer
- Escalating waves, HP/score/wave HUD
- Five weapons: pistol, shotgun, rifle, bow and staff
- Burn, poison, bleed, freeze and stun status effects
- Combat VFX, floating damage numbers, hit combo and optional screen shake
- XP, gold, rarity-based item drops, equipment and Blacksmith shop/forge
- Nova Blast and Heal Burst skills
- Pause menu with inventory, Blacksmith and Settings
- Persistent local settings and run statistics via localStorage
- Procedural Web Audio SFX and lightweight background music with no external audio assets
- **Rogue-lite level-up choices:** every level-up pauses the run and presents 3 random upgrades
- Nine run-only upgrades covering fire rate, pickup range, attack, crit damage, crit chance, move speed, HP, mana and defense
- Crisp procedural pixel-art rendering at a low virtual resolution (320x180), scaled up without smoothing

## Run locally
```bash
npm install
npm run dev
```
Open the printed localhost URL. Use the browser device toolbar (or an actual phone on the same network) to test touch controls.

## Build for production
```bash
npm run build
```
Output goes to `dist/` — deployable to any static host (Vercel, Netlify, GitHub Pages).

## Wrapping for Android/iOS later
This is a plain web build, so once you're happy with it, wrap `dist/` with Capacitor:
```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add android
npx cap add ios
```

## Architecture
- `src/game/engine.js` — core game state and simulation loop; keeps the 60fps simulation outside React state.
- `src/game/phase1Engine.js` — weapon definitions, status ailments, combos, floating damage numbers, screen-shake state and crit scaling hooks.
- `src/game/phase1_5Engine.js` — combat VFX layer.
- `src/game/audioPhaseEngine.js` — thin audio-enabled engine adapter; keeps audio concerns out of the simulation.
- `src/game/rogueliteEngine.js` — run-only upgrade pool, level-up queue and upgrade application.
- `src/game/audioManager.js` — lightweight Web Audio SFX/BGM synthesis with volume controls.
- `src/game/saveSystem.js` — localStorage persistence for score/wave/meta currency and settings.
- `src/game/renderer.js` — Canvas renderer that reads engine state directly.
- `src/components/GameCanvas.jsx` — canvas lifecycle, engine lifecycle, input wiring and overlay flow.
- `src/components/LevelUpOverlay.jsx` — responsive 3-card level-up choice UI.
- `src/components/InventoryOverlay.jsx` — inventory, equipment and Blacksmith pause UI.
- `src/components/SettingsOverlay.jsx` — audio, screen-shake and aim settings.

## Current roadmap
### Completed
- Phase 1 core loop
- Combat expansion / Phase 1.5 VFX
- Audio + screen-shake toggle (Step 1)
- Persistent settings and local run stats
- **Rogue-lite 3-choice level-up upgrades (Step 2)**

### Next
1. PC mouse-look aiming
2. Tilemap + camera + biome/stage progression
3. Boss/miniboss encounters
4. Audio asset pass and final mobile polish

## Step 2 upgrade pool
| Upgrade | Effect |
|---|---|
| Rapid Fire | Fire rate +15% |
| Magnetic Core | Pickup range +50% |
| Power Surge | Attack +15% |
| Deadly Precision | Crit damage +25% |
| Keen Edge | Crit chance +6% |
| Fleet Foot | Move speed +12% |
| Vitality | Max HP +18% + small heal |
| Arcane Battery | Mana +20 and regen +25% |
| Resilience | Damage reduction +5% |

Upgrades are intentionally **run-only**. They reset when the player starts a new run, while the existing meta progression remains persistent.

## Mobile performance goals
The simulation and Canvas renderer are intentionally kept independent of React's render cycle. The game targets low-end phones by using a 320x180 virtual canvas, crisp nearest-neighbor scaling, lightweight entities, and no external audio dependency.
