// Rogue-lite perk pool merged from the alternate Pixel-Bound build.
// Effects are adapted to the current engine fields so the working level-up
// card flow remains intact while adding a broader 10-perk build system.
const PERKS = [
  { id: 'vitality', icon: '♥', name: 'Vitality', description: 'Max HP +20', short: 'Increase max health and heal for 20.', apply: (e) => { const p = e.player; p.baseMaxHp += 20; e._recalcStats(); p.hp = Math.min(p.maxHp, p.hp + 20) } },
  { id: 'power', icon: '⚔', name: 'Power', description: 'Attack +12%', short: 'Increase weapon and skill damage.', apply: (e) => { e.player.baseAttackMultiplier *= 1.12; e._recalcStats() } },
  { id: 'iron-skin', icon: '◆', name: 'Iron Skin', description: 'Damage reduction +5%', short: 'Take less damage from enemies.', apply: (e) => { e.player.upgradeDefenseBonus += 0.05; e._recalcStats() } },
  { id: 'swift-feet', icon: '➤', name: 'Swift Feet', description: 'Move speed +8%', short: 'Move and dodge faster.', apply: (e) => { e.player.baseSpeed *= 1.08; e._recalcStats() } },
  { id: 'rapid-fire', icon: '⚡', name: 'Rapid Fire', description: 'Fire rate +12%', short: 'Shoot 12% faster with every weapon.', apply: (e) => { e.fireRateMultiplier *= 0.88; e.player.shootInterval = Math.max(0.06, e.player.shootInterval * 0.88) } },
  { id: 'deep-well', icon: '◈', name: 'Deep Well', description: 'Max Mana +20', short: 'Increase mana capacity and restore 20 mana.', apply: (e) => { e.player.maxMana += 20; e.player.mana = Math.min(e.player.maxMana, e.player.mana + 20) } },
  { id: 'focus', icon: '✦', name: 'Focus', description: 'Mana regen +1.5/s', short: 'Recover mana faster between casts.', apply: (e) => { e.player.manaRegenRate += 1.5 } },
  { id: 'lodestone', icon: '🧲', name: 'Lodestone', description: 'Pickup range +40%', short: 'Pull XP, gold and loot from farther away.', apply: (e) => { e.magnetRadius *= 1.4 } },
  { id: 'precision', icon: '🎯', name: 'Precision', description: 'Crit chance +6%', short: 'Increase critical-hit chance.', apply: (e) => { e.player.critChanceBonus += 0.06 } },
  { id: 'momentum', icon: '⏱', name: 'Momentum', description: 'Skill cooldowns -12%', short: 'Nova and Heal recover faster.', apply: (e) => { e.player.skillCooldownMultiplier = Math.max(0.4, e.player.skillCooldownMultiplier * 0.88) } },
]

export function pickRandomPerks(count = 3) {
  const pool = [...PERKS]
  const picks = []
  while (picks.length < count && pool.length) {
    const index = Math.floor(Math.random() * pool.length)
    picks.push(pool.splice(index, 1)[0])
  }
  return picks
}

export { PERKS }
