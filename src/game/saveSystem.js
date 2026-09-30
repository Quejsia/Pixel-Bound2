const SAVE_KEY = 'pixel-bound-save-v2'
const LEGACY_SAVE_KEY = 'pixel-bound-save-v1'

export const WEAPON_ORDER = ['pistol', 'shotgun', 'rifle', 'bow', 'staff']
export const WEAPON_COSTS = { shotgun: 120, rifle: 200, bow: 280, staff: 400 }

export const DEFAULT_SAVE = {
  highScore: 0,
  highestWave: 1,
  bankedGold: 0,
  unlockedWeapons: ['pistol'],
  settings: {
    autoAim: true,
    controlMode: 'mobile',
    sfxVolume: 0.65,
    bgmVolume: 0.18,
    screenShake: true,
  },
}

function cloneDefaults() { return JSON.parse(JSON.stringify(DEFAULT_SAVE)) }

export function loadSave() {
  if (typeof window === 'undefined') return cloneDefaults()
  try {
    let raw = window.localStorage.getItem(SAVE_KEY)
    let migrated = false
    if (!raw) {
      raw = window.localStorage.getItem(LEGACY_SAVE_KEY)
      migrated = Boolean(raw)
    }
    if (!raw) return cloneDefaults()
    const parsed = JSON.parse(raw)
    const next = {
      ...cloneDefaults(),
      ...parsed,
      unlockedWeapons: Array.isArray(parsed.unlockedWeapons) && parsed.unlockedWeapons.length ? parsed.unlockedWeapons : ['pistol'],
      settings: { ...DEFAULT_SAVE.settings, ...(parsed.settings || {}) },
    }
    if (migrated) {
      try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(next)) } catch { /* migration may be unavailable */ }
    }
    return next
  } catch {
    return cloneDefaults()
  }
}

export function saveGame(patch = {}) {
  if (typeof window === 'undefined') return loadSave()
  const current = loadSave()
  const next = { ...current, ...patch }
  if (patch.settings) next.settings = { ...current.settings, ...patch.settings }
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(next)) } catch { /* storage may be unavailable */ }
  return next
}

export function updateSettings(patch) {
  const current = loadSave()
  return saveGame({ settings: { ...current.settings, ...patch } })
}

export function recordRun({ score = 0, wave = 1, gold = 0 } = {}) {
  const current = loadSave()
  return saveGame({
    highScore: Math.max(current.highScore, score),
    highestWave: Math.max(current.highestWave, wave),
    bankedGold: current.bankedGold + Math.max(0, gold),
  })
}

export const loadSaveData = loadSave
export const saveSaveData = saveGame
export { SAVE_KEY }
