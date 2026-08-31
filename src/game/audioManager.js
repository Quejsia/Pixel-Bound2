// Lightweight Web Audio manager: no external audio dependency required.
// Sounds are synthesized so the game stays tiny and works offline/mobile.

const DEFAULTS = { sfxVolume: 0.65, bgmVolume: 0.18 }

class AudioManager {
  constructor() {
    this.ctx = null
    this.master = null
    this.sfxVolume = DEFAULTS.sfxVolume
    this.bgmVolume = DEFAULTS.bgmVolume
    this.bgmTimer = null
    this.bgmStep = 0
    this.unlocked = false
  }

  _ensureContext() {
    if (typeof window === 'undefined') return false
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return false
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = 1
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    this.unlocked = true
    return true
  }

  unlock() { this._ensureContext() }

  setSfxVolume(value) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(value) || 0))
  }

  setBgmVolume(value) {
    this.bgmVolume = Math.max(0, Math.min(1, Number(value) || 0))
  }

  _tone({ frequency = 440, duration = 0.08, type = 'square', volume = 0.12, endFrequency = null } = {}) {
    if (!this._ensureContext() || this.sfxVolume <= 0) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, now)
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * this.sfxVolume), now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + duration + 0.01)
  }

  shoot() { this._tone({ frequency: 520, endFrequency: 260, duration: 0.055, volume: 0.09 }) }
  hit(crit = false) { this._tone({ frequency: crit ? 880 : 330, endFrequency: crit ? 440 : 180, duration: crit ? 0.13 : 0.07, volume: crit ? 0.16 : 0.08 }) }
  dodge() { this._tone({ frequency: 180, endFrequency: 620, duration: 0.14, type: 'sawtooth', volume: 0.1 }) }
  pickup(kind = 'xp') {
    const frequency = kind === 'gold' ? 660 : kind === 'item' ? 740 : 560
    this._tone({ frequency, endFrequency: frequency * 1.45, duration: 0.12, type: 'triangle', volume: 0.1 })
  }
  death() { this._tone({ frequency: 220, endFrequency: 70, duration: 0.28, type: 'sawtooth', volume: 0.12 }) }
  skill() { this._tone({ frequency: 240, endFrequency: 760, duration: 0.2, type: 'triangle', volume: 0.12 }) }

  startBgm() {
    if (!this._ensureContext() || this.bgmTimer || this.bgmVolume <= 0) return
    // Tiny procedural arpeggio: avoids shipping an audio asset while still providing ambience.
    const notes = [196, 247, 294, 330, 247, 220, 294, 370]
    this.bgmStep = 0
    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx || this.bgmVolume <= 0) return
      const note = notes[this.bgmStep++ % notes.length]
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = note
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.018 * this.bgmVolume, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(now)
      osc.stop(now + 0.3)
    }, 360)
  }

  stopBgm() {
    if (this.bgmTimer) window.clearInterval(this.bgmTimer)
    this.bgmTimer = null
  }
}

export const audioManager = new AudioManager()
export { DEFAULTS as DEFAULT_AUDIO_SETTINGS }
