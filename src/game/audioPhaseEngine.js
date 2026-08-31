import { Phase1_5GameEngine } from './phase1_5Engine.js'
import { audioManager } from './audioManager.js'

// Audio hooks stay in a thin subclass so the simulation/rendering layers remain deterministic.
export class AudioPhaseGameEngine extends Phase1_5GameEngine {
  constructor(options) {
    super(options)
    this.__audioDamageCount = 0
  }

  _fireBullet() {
    const before = this.bullets.length
    super._fireBullet()
    if (this.bullets.length > before) audioManager.shoot()
  }

  requestDodge() {
    if (this.player.dodgeCooldown <= 0) audioManager.dodge()
    super.requestDodge()
  }

  useSkill(key) {
    const result = super.useSkill(key)
    if (result?.ok) audioManager.skill()
    return result
  }

  _collectPickup(pk) {
    audioManager.pickup(pk.kind)
    super._collectPickup(pk)
  }

  _update(dt) {
    const before = this.__phase1DamageNumbers?.length || 0
    super._update(dt)
    const after = this.__phase1DamageNumbers?.length || 0
    if (after > before) {
      const recent = this.__phase1DamageNumbers.slice(Math.max(0, before))
      if (recent.some((n) => n.crit)) audioManager.hit(true)
      else if (recent.length) audioManager.hit(false)
    }
  }

  _triggerGameOver() {
    audioManager.death()
    super._triggerGameOver()
  }
}
