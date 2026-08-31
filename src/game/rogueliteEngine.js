import { AudioPhaseGameEngine } from './audioPhaseEngine.js'
import { audioManager } from './audioManager.js'
import { pickRandomPerks, PERKS } from './perks.js'

// Run-only upgrades. The perk definitions live in perks.js so the pool can be
// expanded without growing the engine into a large switch statement.
function pickChoices(count = 3) {
  return pickRandomPerks(count)
}

export class RogueliteGameEngine extends AudioPhaseGameEngine {
  constructor(options) {
    super(options)
    // GameEngine does not retain arbitrary callbacks, so explicitly retain the
    // level-up callback used by this derived engine. Without this, _presentLevelUp
    // stops the simulation but the UI never receives the three choices.
    this.onLevelUp = options?.onLevelUp

    this.player.critDamageMultiplier = 1
    this.player.critChanceBonus = 0
    this.player.upgradeDefenseBonus = 0
    this.player.skillCooldownMultiplier = 1
    this.fireRateMultiplier = 1
    this.upgradeCounts = {}
    this.pendingLevelUps = 0
    this.awaitingUpgrade = false
    this.currentUpgradeChoices = null

    const originalSetWeapon = this.setWeapon.bind(this)
    this.setWeapon = (weapon) => {
      originalSetWeapon(weapon)
      this.player.shootInterval = Math.max(0.06, this.player.shootInterval * this.fireRateMultiplier)
    }
  }

  // Collect every crossed XP threshold. The UI then presents one choice at a
  // time, so a large pickup can never strand the player in a frozen state.
  _gainXp(amount) {
    const p = this.player
    p.xp += amount

    let leveled = false
    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext
      p.level++
      p.xpToNext = Math.round(p.xpToNext * 1.35)
      this.pendingLevelUps++
      leveled = true
    }

    if (leveled && !this.awaitingUpgrade) this._presentLevelUp()
  }

  _presentLevelUp() {
    if (this.pendingLevelUps <= 0) return
    this.awaitingUpgrade = true
    this.currentUpgradeChoices = pickChoices(3).map(({ apply, ...choice }) => choice)
    audioManager.skill()
    this.stop()
    if (this.onLevelUp) this.onLevelUp(this.currentUpgradeChoices)
  }

  chooseUpgrade(id) {
    if (!this.awaitingUpgrade || !this.currentUpgradeChoices) return { ok: false, reason: 'no-choice' }
    const choice = this.currentUpgradeChoices.find((item) => item.id === id)
    if (!choice) return { ok: false, reason: 'invalid-choice' }

    const definition = PERKS.find((item) => item.id === id)
    if (!definition) return { ok: false, reason: 'unknown-upgrade' }

    definition.apply(this)
    this.upgradeCounts[id] = (this.upgradeCounts[id] || 0) + 1
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1)
    this.currentUpgradeChoices = null
    this.awaitingUpgrade = false

    if (this.pendingLevelUps > 0) this._presentLevelUp()
    else this.start()

    return { ok: true, upgrade: id, count: this.upgradeCounts[id] }
  }

  _recalcStats() {
    super._recalcStats()
    this.player.defense = Math.min(this.player.defense + this.player.upgradeDefenseBonus, 0.75)
  }

  getUpgradeSummary() {
    return { ...this.upgradeCounts }
  }

  getUpgradeChoices() {
    return this.currentUpgradeChoices ? this.currentUpgradeChoices.map((choice) => ({ ...choice })) : null
  }
}

export { PERKS }
