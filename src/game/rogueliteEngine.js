import { AudioPhaseGameEngine } from './audioPhaseEngine.js'
import { audioManager } from './audioManager.js'

// Run-only upgrades. They stack during a run and reset when a new run starts.
const UPGRADES = [
  { id: 'rapid-fire', icon: '⚡', name: 'Rapid Fire', description: 'Fire rate +15%', short: 'Shoot 15% faster.', apply: (e) => { e.player.shootInterval = Math.max(0.06, e.player.shootInterval * 0.85) } },
  { id: 'magnet', icon: '🧲', name: 'Magnetic Core', description: 'Pickup range +50%', short: 'Pull XP, gold and loot from farther away.', apply: (e) => { e.magnetRadius *= 1.5 } },
  { id: 'attack', icon: '⚔', name: 'Power Surge', description: 'Attack +15%', short: 'Increase weapon and skill damage.', apply: (e) => { e.player.baseAttackMultiplier *= 1.15; e._recalcStats() } },
  { id: 'crit-damage', icon: '💥', name: 'Deadly Precision', description: 'Crit damage +25%', short: 'Critical hits deal 25% more damage.', apply: (e) => { e.player.critDamageMultiplier *= 1.25 } },
  { id: 'crit-chance', icon: '🎯', name: 'Keen Edge', description: 'Crit chance +6%', short: 'More shots become critical hits.', apply: (e) => { e.player.critChanceBonus += 0.06 } },
  { id: 'swift', icon: '➤', name: 'Fleet Foot', description: 'Move speed +12%', short: 'Move and dodge faster.', apply: (e) => { e.player.baseSpeed *= 1.12; e._recalcStats() } },
  { id: 'vitality', icon: '♥', name: 'Vitality', description: 'Max HP +18%', short: 'Increase max HP and restore a little health.', apply: (e) => { e.player.baseMaxHp *= 1.18; e._recalcStats(); e.player.hp = Math.min(e.player.maxHp, e.player.hp + e.player.maxHp * 0.18) } },
  { id: 'arcane', icon: '✦', name: 'Arcane Battery', description: 'Mana +20 · Regen +25%', short: 'Cast more skills and recover mana faster.', apply: (e) => { e.player.maxMana += 20; e.player.manaRegenRate *= 1.25; e.player.mana = Math.min(e.player.maxMana, e.player.mana + 20) } },
  { id: 'resilience', icon: '◆', name: 'Resilience', description: 'Damage reduction +5%', short: 'Take less damage from enemies.', apply: (e) => { e.player.upgradeDefenseBonus += 0.05; e._recalcStats() } },
]

function pickChoices(count = 3) {
  const copy = [...UPGRADES]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

export class RogueliteGameEngine extends AudioPhaseGameEngine {
  constructor(options) {
    super(options)
    this.player.critDamageMultiplier = 1
    this.player.critChanceBonus = 0
    this.player.upgradeDefenseBonus = 0
    this.upgradeCounts = {}
    this.pendingLevelUps = 0
    this.awaitingUpgrade = false
    this.currentUpgradeChoices = null
  }

  // Replaces the old automatic +HP/+attack level reward with a choice queue.
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

    const definition = UPGRADES.find((item) => item.id === id)
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
}

export { UPGRADES }
