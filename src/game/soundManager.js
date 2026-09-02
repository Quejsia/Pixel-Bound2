// Compatibility audio facade used by the combat layer.
// The project now uses the lightweight procedural audioManager, so we avoid
// shipping a large embedded audio asset bundle while preserving existing hooks.
import { audioManager } from './audioManager.js'

const map = {
  shoot: () => audioManager.shoot(),
  hit: () => audioManager.hit(false),
  crit: () => audioManager.hit(true),
  dodge: () => audioManager.dodge(),
  pickup: () => audioManager.pickup('xp'),
  skill: () => audioManager.skill(),
  death: () => audioManager.death(),
}

export const soundManager = {
  resume() { audioManager.unlock() },
  setVolume(v) { audioManager.setSfxVolume(Number(v) / 100) },
  play(name) { map[name]?.() },
}
