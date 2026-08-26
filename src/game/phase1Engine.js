import { GameEngine, VIRTUAL_W, VIRTUAL_H } from './engine.js'

const WEAPONS = {
  pistol:  { label: 'PISTOL', damage: 9,  speed: 210, life: 1.2, interval: 0.28, pellets: 1, spread: 0,    critChance: 0.10, statuses: [] },
  shotgun: { label: 'SHOTGUN', damage: 5,  speed: 190, life: 0.35, interval: 0.62, pellets: 5, spread: 0.50, critChance: 0.08, statuses: ['bleed'] },
  rifle:   { label: 'RIFLE', damage: 7,  speed: 270, life: 1.5, interval: 0.12, pellets: 1, spread: 0,    critChance: 0.15, statuses: ['stun'] },
  bow:     { label: 'BOW', damage: 16, speed: 180, life: 1.8, interval: 0.55, pellets: 1, spread: 0,    critChance: 0.20, statuses: ['bleed'] },
  staff:   { label: 'STAFF', damage: 22, speed: 125, life: 2.0, interval: 0.80, pellets: 1, spread: 0,    critChance: 0.18, statuses: ['burn', 'poison', 'freeze'] },
}

const STATUS_INFO = {
  burn:   { duration: 3, tick: 0.5, damage: 2 },
  poison: { duration: 4, tick: 0.6, damage: 2 },
  bleed:  { duration: 3, tick: 0.45, damage: 2 },
  freeze: { duration: 1.25 },
  stun:   { duration: 0.8 },
}

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by) }

function installEnemy(engine, enemy) {
  if (!enemy || enemy.__phase1Installed) return
  enemy.__phase1Installed = true
  enemy.__phase1Status = { burn: null, poison: null, bleed: null, freeze: 0, stun: 0 }

  let hp = enemy.hp
  Object.defineProperty(enemy, 'hp', {
    configurable: true,
    enumerable: true,
    get: () => hp,
    set: (next) => {
      const previous = hp
      hp = next
      const hit = engine.__phase1PendingHit
      if (hit && next < previous) {
        engine.__phase1PendingHit = null
        const amount = Math.max(1, Math.round(previous - next))
        engine.__phase1Combo = Math.min(99, engine.__phase1Combo + 1)
        engine.__phase1ComboTimer = 1.25
        engine.__phase1DamageNumbers.push({ x: enemy.x, y: enemy.y - enemy.radius - 5, value: amount, crit: hit.crit, life: 0.65 })
        engine.__phase1ScreenShake = Math.min(7, engine.__phase1ScreenShake + (hit.crit ? 2.8 : 0.8))
        if (hit.status) applyStatus(enemy, hit.status)
      }
    },
  })

  const originalUpdate = enemy.update.bind(enemy)
  enemy.update = (dt, player, spawnEnemyBullet) => {
    tickStatuses(engine, enemy, dt)
    const status = enemy.__phase1Status
    if (status.stun > 0 || status.freeze > 0) {
      status.stun = Math.max(0, status.stun - dt)
      status.freeze = Math.max(0, status.freeze - dt)
      if (enemy.hitFlash > 0) enemy.hitFlash -= dt
      return
    }
    originalUpdate(dt, player, spawnEnemyBullet)
  }
}

function applyStatus(enemy, type) {
  const status = enemy.__phase1Status
  if (!status || !STATUS_INFO[type]) return
  const info = STATUS_INFO[type]
  if (type === 'freeze' || type === 'stun') status[type] = Math.max(status[type], info.duration)
  else status[type] = { time: info.duration, tick: info.tick, damage: info.damage }
}

function tickStatuses(engine, enemy, dt) {
  const status = enemy.__phase1Status
  for (const key of ['burn', 'poison', 'bleed']) {
    const active = status[key]
    if (!active) continue
    active.time -= dt
    active.tick -= dt
    if (active.tick <= 0) {
      active.tick += STATUS_INFO[key].tick
      engine.__phase1PendingStatusDamage = true
      enemy.hp -= active.damage
      engine.__phase1PendingStatusDamage = false
      engine.__phase1DamageNumbers.push({ x: enemy.x, y: enemy.y - enemy.radius - 4, value: active.damage, crit: false, status: key, life: 0.4 })
    }
    if (active.time <= 0) status[key] = null
  }
}

function makeBullet(engine, x, y, vx, vy, amount, meta, life) {
  return {
    x, y, vx, vy, radius: meta.crit ? 1.8 : 1.5, life, fromPlayer: true, dead: false,
    damage: {
      valueOf() { engine.__phase1PendingHit = meta; return amount },
    },
    update(dt) {
      this.x += this.vx * dt
      this.y += this.vy * dt
      this.life -= dt
      if (this.life <= 0 || this.x < 0 || this.x > VIRTUAL_W || this.y < 0 || this.y > VIRTUAL_H) this.dead = true
    },
  }
}

export class Phase1GameEngine extends GameEngine {
  constructor(options) {
    super(options)
    this.__phase1Installed = true
    this.__phase1Combo = 0
    this.__phase1ComboTimer = 0
    this.__phase1ScreenShake = 0
    this.__phase1ScreenShakeEnabled = true
    this.__phase1DamageNumbers = []
    this.__phase1PendingHit = null
    this.__phase1PendingStatusDamage = false

    const originalSpawn = this._spawnEnemy.bind(this)
    this._spawnEnemy = () => {
      const before = this.enemies.length
      originalSpawn()
      for (let i = before; i < this.enemies.length; i++) installEnemy(this, this.enemies[i])
    }

    for (const enemy of this.enemies) installEnemy(this, enemy)

    const originalSetWeapon = this.setWeapon.bind(this)
    this.setWeapon = (weapon) => {
      if (!WEAPONS[weapon]) return originalSetWeapon(weapon)
      this.player.weapon = weapon
      this.player.shootInterval = WEAPONS[weapon].interval
      this.player.shootCooldown = 0
    }

    this.getWeaponList = () => Object.keys(WEAPONS)
    this.getWeaponLabel = () => WEAPONS[this.player.weapon]?.label || this.player.weapon.toUpperCase()
    this.setScreenShakeEnabled = (enabled) => { this.__phase1ScreenShakeEnabled = !!enabled }

    this._fireBullet = () => {
      const p = this.player
      const weapon = WEAPONS[p.weapon] || WEAPONS.pistol
      let dx = this.aimVec.x
      let dy = this.aimVec.y
      if (this.autoAim) {
        const target = this._nearestEnemy()
        if (!target) return
        const d = dist(p.x, p.y, target.x, target.y) || 1
        dx = (target.x - p.x) / d
        dy = (target.y - p.y) / d
      } else {
        const len = Math.hypot(dx, dy)
        if (len < 0.2) return
        dx /= len; dy /= len
      }
      p.facing.x = dx; p.facing.y = dy
      const baseAngle = Math.atan2(dy, dx)
      for (let i = 0; i < weapon.pellets; i++) {
        const t = weapon.pellets === 1 ? 0 : i / (weapon.pellets - 1) - 0.5
        const angle = baseAngle + t * weapon.spread
        const crit = Math.random() < weapon.critChance
        let status = null
        if (weapon.statuses.length && Math.random() < 0.24) {
          status = weapon.statuses[Math.floor(Math.random() * weapon.statuses.length)]
        }
        const amount = weapon.damage * p.attackMultiplier * (crit ? 2 : 1)
        this.bullets.push(makeBullet(this, p.x, p.y, Math.cos(angle) * weapon.speed, Math.sin(angle) * weapon.speed, amount, { crit, status }, weapon.life))
      }
    }

    const originalUpdate = this._update.bind(this)
    this._update = (dt) => {
      this.__phase1ComboTimer -= dt
      if (this.__phase1ComboTimer <= 0) this.__phase1Combo = 0
      this.__phase1PendingHit = null
      originalUpdate(dt)
      for (const n of this.__phase1DamageNumbers) { n.life -= dt; n.y -= 10 * dt }
      this.__phase1DamageNumbers = this.__phase1DamageNumbers.filter((n) => n.life > 0)
      this.__phase1ScreenShake = Math.max(0, this.__phase1ScreenShake - dt * 10)
      if (this.onHud) this.onHud({
        hp: Math.ceil(this.player.hp), maxHp: this.player.maxHp, score: this.score, wave: this.wave,
        dodgeReady: this.player.dodgeCooldown <= 0, level: this.player.level, xp: this.player.xp,
        xpToNext: this.player.xpToNext, gold: this.player.gold, inventoryCount: this.inventory.length,
        mana: Math.floor(this.player.mana), maxMana: this.player.maxMana,
        skillCooldowns: { ...this.player.skillCooldowns }, weapon: this.getWeaponLabel(),
        combo: this.__phase1Combo, damageNumbers: this.__phase1DamageNumbers.map((n) => ({ ...n })),
      })
    }
  }
}

export { WEAPONS }
