import { Phase1GameEngine } from './phase1Engine.js'

const STATUS_VFX = {
  burn: 'burn',
  poison: 'poison',
  freeze: 'freeze',
  stun: 'stun',
  bleed: 'bleed',
}

export class Phase1_5GameEngine extends Phase1GameEngine {
  constructor(options) {
    super(options)

    this.__phase15Vfx = []
    this.__phase15EnemyState = new Map()
    this.__phase15VfxEnabled = true

    const originalUpdate = this._update.bind(this)
    this._update = (dt) => {
      const beforeEnemies = new Map()
      for (const enemy of this.enemies) {
        const status = enemy.__phase1Status || {}
        beforeEnemies.set(enemy, {
          x: enemy.x,
          y: enemy.y,
          hp: enemy.hp,
          dead: enemy.dead,
          burn: !!status.burn,
          poison: !!status.poison,
          freeze: status.freeze > 0,
          stun: status.stun > 0,
          bleed: !!status.bleed,
        })
      }

      const beforeNumbers = this.__phase1DamageNumbers.length
      originalUpdate(dt)

      if (this.__phase15VfxEnabled) {
        const newNumbers = this.__phase1DamageNumbers.slice(beforeNumbers)
        for (const n of newNumbers) {
          if (n.status) {
            this.spawnVfx(n.status, n.x, n.y, 0.35, 0.65)
          } else {
            this.spawnVfx(n.crit ? 'crit' : 'hit', n.x, n.y, n.28 || 0.28, n.crit ? 0.9 : 0.65)
          }
        }

        for (const enemy of this.enemies) {
          const before = beforeEnemies.get(enemy)
          if (!before) continue
          const status = enemy.__phase1Status || {}
          for (const key of Object.keys(STATUS_VFX)) {
            const nowActive = key === 'freeze' || key === 'stun' ? status[key] > 0 : !!status[key]
            if (nowActive && !before[key]) {
              this.spawnVfx(STATUS_VFX[key], enemy.x, enemy.y, 0.8, 0.9)
            }
          }
        }

        for (const [enemy, before] of beforeEnemies) {
          if (enemy.dead && !before.dead) {
            this.spawnVfx('death', before.x, before.y, 0.7, 1.0)
          }
        }
      }

      for (const fx of this.__phase15Vfx) {
        fx.life -= dt
        fx.y -= (fx.floatSpeed || 0) * dt
        fx.rotation += (fx.rotationSpeed || 0) * dt
      }
      this.__phase15Vfx = this.__phase15Vfx.filter((fx) => fx.life > 0)
    }
  }

  spawnVfx(type, x, y, life = 0.5, scale = 1) {
    this.__phase15Vfx.push({
      type,
      x,
      y,
      life,
      maxLife: life,
      scale,
      rotation: 0,
      rotationSpeed: type === 'freeze' ? 0.8 : 0,
      floatSpeed: type === 'burn' || type === 'poison' ? 2 : 0,
    })
  }

  setVfxEnabled(enabled) {
    this.__phase15VfxEnabled = !!enabled
  }
}
