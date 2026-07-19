# Pixel Shooter RPG — Phase 1 (Core Loop)

A 2D pixel-art top-down shooter built with React + Canvas, designed for web and mobile (wrap with Capacitor later for native Android/iOS builds).

## What's in Phase 1
- Virtual joystick movement (touch + mouse)
- Auto-aim (fires at nearest enemy) or manual twin-stick aiming — toggle on start screen
- Dodge roll with cooldown + brief invulnerability
- One enemy type (slime) spawning in escalating waves
- HP bar, score, wave counter
- Procedural pixel-art rendering at a low virtual resolution (320x180), scaled up crisply — cheap to render on low-end phones

## Run locally
```
npm install
npm run dev
```
Open the printed localhost URL. Use your browser's device toolbar (or an actual phone on the same network) to test touch controls.

## Build for production
```
npm run build
```
Output goes to `dist/` — deployable to any static host (Vercel, Netlify, GitHub Pages).

## Wrapping for Android/iOS later
This is a plain web build, so once you're happy with it, wrap `dist/` with [Capacitor](https://capacitorjs.com/) to ship to app stores:
```
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add android
npx cap add ios
```

## Architecture notes
- `src/game/engine.js` — game state and simulation loop, runs its own `requestAnimationFrame` independent of React (this is deliberate — updating React state 60x/sec for every bullet position would be slow; only HUD numbers go through React state, throttled to ~10/sec).
- `src/game/renderer.js` — draws everything to the canvas each frame by reading engine state directly.
- `src/components/GameCanvas.jsx` — wires it all together: owns the canvas, creates/destroys the engine, and connects touch controls to engine input methods.
- `src/components/Joystick.jsx` — touch/mouse joystick that reports a normalized vector; visual knob position is updated via a ref (not React state) to avoid re-renders on every drag frame.

## Next phases (not yet built)
See the project plan — Phase 2 adds more weapons/status effects, Phase 3 adds XP/inventory/loot, Phase 4+ adds world content, crafting/blacksmith, and polish.
