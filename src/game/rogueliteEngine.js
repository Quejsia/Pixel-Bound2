import { AudioPhaseGameEngine } from './audioPhaseEngine.js'
import { audioManager } from './audioManager.js'
import { pickRandomPerks, PERKS } from './perks.js'

export class RogueliteGameEngine extends AudioPhaseGameEngine {
  constructor(options) {
    super(options)
    this.onLevelUp = options?.onLevelUp
    this.pendingLevelUps = 0
    this.awaitingUpgrade = false
    this.currentUpgradeChoices = null
    this.upgradeCounts = {}
    this.player.baseDefense = this.player.baseDefense || 0
    this.player.fireRateMultiplier = this.player.fireRateMultiplier || 1
    this.player.critBonus = this.player.critBonus || 0
    this.player.skillCooldownMultiplier = this.player.skillCooldownMultiplier || 1
  }

  _gainXp(amount) {
    const p = this.player
    p.xp += amount
    let leveled = false
    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext
      p.level += 1
      p.xpToNext = Math.round(p.xpToNext * 1.35)
      this.pendingLevelUps += 1
      leveled = true
    }
    if (leveled && !this.awaitingUpgrade) this._presentLevelUp()
  }

  _presentLevelUp() {
    if (this.pendingLevelUps <= 0) return
    this.awaitingUpgrade = true
    this.currentUpgradeChoices = pickRandomPerks(3).map(({ apply, ...choice }) => choice)
    audioManager.skill()
    this.stop()
    this.onLevelUp?.(this.currentUpgradeChoices)
  }

  chooseUpgrade(id) {
    if (!this.awaitingUpgrade || !this.currentUpgradeChoices) return { ok: false, reason: 'no-choice' }
    const choice = this.currentUpgradeChoices.find((item) => item.id === id)
    const definition = PERKS.find((item) => item.id === id)
    if (!choice || !definition) return { ok: false, reason: 'invalid-choice' }
    definition.apply(this)
    this.upgradeCounts[id] = (this.upgradeCounts[id] || 0) + 1
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1)
    this.currentUpgradeChoices = null
    this.awaitingUpgrade = false
    if (this.pendingLevelUps > 0) this._presentLevelUp()
    else this.start()
    return { ok: true, upgrade: id, count: this.upgradeCounts[id] }
  }

  getUpgradeChoices() { return this.currentUpgradeChoices ? this.currentUpgradeChoices.map((c) => ({ ...c })) : null }
  getUpgradeSummary() { return { ...this.upgradeCounts } }
}

export { PERKS }
