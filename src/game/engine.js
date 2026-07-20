// Low-res virtual resolution — we render pixel art at this size then scale up
// with image-smoothing disabled, which gives a crisp retro look AND is cheap
// to render on low-end devices.
export const VIRTUAL_W = 320
export const VIRTUAL_H = 180

const ARENA_PAD = 10

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by)
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

class Bullet {
  constructor(x, y, vx, vy, damage, fromPlayer = true) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.damage = damage
    this.radius = 1.5
    this.life = 1.2 // seconds
    this.fromPlayer = fromPlayer
    this.dead = false
  }
  update(dt) {
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.life -= dt
    if (this.life <= 0) this.dead = true
    if (this.x < 0 || this.x > VIRTUAL_W || this.y < 0 || this.y > VIRTUAL_H) this.dead = true
  }
}

class Slime {
  constructor(x, y, wave) {
    this.type = 'slime'
    this.x = x
    this.y = y
    this.radius = 6
    this.maxHp = 12 + wave * 4
    this.hp = this.maxHp
    this.speed = 22 + Math.min(wave * 2.2, 40)
    this.contactDamage = 10 + Math.floor(wave / 3)
    this.hitFlash = 0
    this.squish = 0
    this.contactCooldown = 0
    this.dead = false
  }
  update(dt, player) {
    const d = dist(this.x, this.y, player.x, player.y)
    if (d > 0.001) {
      const nx = (player.x - this.x) / d
      const ny = (player.y - this.y) / d
      this.x += nx * this.speed * dt
      this.y += ny * this.speed * dt
    }
    if (this.hitFlash > 0) this.hitFlash -= dt
    if (this.contactCooldown > 0) this.contactCooldown -= dt
    this.squish = Math.sin(performance.now() / 150 + this.x) * 0.15
  }
}

class Goblin {
  constructor(x, y, wave) {
    this.type = 'goblin'
    this.x = x
    this.y = y
    this.radius = 5
    this.maxHp = 8 + wave * 2
    this.hp = this.maxHp
    this.speed = 34 + Math.min(wave * 2.5, 55)
    this.contactDamage = 8 + Math.floor(wave / 4)
    this.hitFlash = 0
    this.contactCooldown = 0
    this.facing = 1 // 1 = facing right, -1 = facing left (for sprite flip)
    this.bob = 0
    this.dead = false
  }
  update(dt, player) {
    const d = dist(this.x, this.y, player.x, player.y)
    if (d > 0.001) {
      const nx = (player.x - this.x) / d
      const ny = (player.y - this.y) / d
      this.x += nx * this.speed * dt
      this.y += ny * this.speed * dt
      this.facing = nx >= 0 ? 1 : -1
    }
    if (this.hitFlash > 0) this.hitFlash -= dt
    if (this.contactCooldown > 0) this.contactCooldown -= dt
    this.bob = Math.sin(performance.now() / 90 + this.x) * 1.2
  }
}

export class GameEngine {
  constructor({ onHud, onGameOver }) {
    this.onHud = onHud
    this.onGameOver = onGameOver

    this.player = {
      x: VIRTUAL_W / 2,
      y: VIRTUAL_H / 2,
      radius: 6,
      speed: 55,
      maxHp: 100,
      hp: 100,
      facing: { x: 1, y: 0 },
      weapon: 'pistol',
      shootCooldown: 0,
      shootInterval: 0.28,
      dodgeCooldown: 0,
      dodgeDuration: 0,
      invulnerable: 0,
      hitFlash: 0,
    }

    this.bullets = []
    this.enemies = []
    this.particles = []

    this.wave = 1
    this.enemiesToSpawn = 0
    this.spawnTimer = 0
    this.waveClearDelay = 0
    this.score = 0

    this.moveVec = { x: 0, y: 0 }
    this.aimVec = { x: 1, y: 0 }
    this.autoAim = true
    this.shootHeld = false
    this.dodgeRequested = false

    this.running = false
    this.gameOver = false
    this._lastT = 0
    this._raf = null

    this._startWave()
  }

  _startWave() {
    this.enemiesToSpawn = 4 + this.wave * 3
    this.spawnTimer = 0
    this.waveClearDelay = 0
  }

  setMove(x, y) {
    this.moveVec.x = x
    this.moveVec.y = y
  }

  setAim(x, y) {
    this.aimVec.x = x
    this.aimVec.y = y
  }

  setAutoAim(v) {
    this.autoAim = v
  }

  setShootHeld(v) {
    this.shootHeld = v
  }

  setWeapon(w) {
    this.player.weapon = w
    this.player.shootInterval = w === 'shotgun' ? 0.62 : 0.28
    this.player.shootCooldown = 0
  }

  requestDodge() {
    this.dodgeRequested = true
  }

  start() {
    this.running = true
    this._lastT = performance.now()
    const loop = (t) => {
      if (!this.running) return
      const dt = Math.min((t - this._lastT) / 1000, 0.05)
      this._lastT = t
      this._update(dt)
      this._raf = requestAnimationFrame(loop)
    }
    this._raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    if (this._raf) cancelAnimationFrame(this._raf)
  }

  _nearestEnemy() {
    let best = null
    let bestD = Infinity
    for (const e of this.enemies) {
      const d = dist(this.player.x, this.player.y, e.x, e.y)
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    return best
  }

  _spawnEnemy() {
    // Spawn just outside the visible arena edge, random side
    const side = Math.floor(Math.random() * 4)
    let x, y
    if (side === 0) { x = -8; y = Math.random() * VIRTUAL_H }
    else if (side === 1) { x = VIRTUAL_W + 8; y = Math.random() * VIRTUAL_H }
    else if (side === 2) { x = Math.random() * VIRTUAL_W; y = -8 }
    else { x = Math.random() * VIRTUAL_W; y = VIRTUAL_H + 8 }

    const goblinChance = this.wave >= 3 ? Math.min(0.15 + this.wave * 0.05, 0.5) : 0
    if (Math.random() < goblinChance) {
      this.enemies.push(new Goblin(x, y, this.wave))
    } else {
      this.enemies.push(new Slime(x, y, this.wave))
    }
  }

  _fireBullet() {
    const p = this.player
    let dx = this.aimVec.x
    let dy = this.aimVec.y

    if (this.autoAim) {
      const target = this._nearestEnemy()
      if (target) {
        const d = dist(p.x, p.y, target.x, target.y) || 1
        dx = (target.x - p.x) / d
        dy = (target.y - p.y) / d
      } else {
        return // nothing to shoot at
      }
    } else {
      const len = Math.hypot(dx, dy)
      if (len < 0.2) return // no aim direction given
      dx /= len
      dy /= len
    }

    p.facing.x = dx
    p.facing.y = dy
    const baseAngle = Math.atan2(dy, dx)

    if (p.weapon === 'shotgun') {
      const pelletCount = 5
      const spread = 0.5 // radians, full cone width
      const speed = 190
      for (let i = 0; i < pelletCount; i++) {
        const t = pelletCount === 1 ? 0 : i / (pelletCount - 1) - 0.5
        const angle = baseAngle + t * spread
        const bx = Math.cos(angle)
        const by = Math.sin(angle)
        const b = new Bullet(p.x, p.y, bx * speed, by * speed, 5)
        b.life = 0.35 // shorter range than pistol
        this.bullets.push(b)
      }
    } else {
      const speed = 210
      this.bullets.push(new Bullet(p.x, p.y, dx * speed, dy * speed, 9))
    }
  }

  _update(dt) {
    if (this.gameOver) return
    const p = this.player

    // Movement
    const mvLen = Math.hypot(this.moveVec.x, this.moveVec.y)
    let mx = 0, my = 0
    if (mvLen > 0.05) {
      mx = this.moveVec.x / Math.max(mvLen, 1)
      my = this.moveVec.y / Math.max(mvLen, 1)
      if (mvLen <= 1) { mx = this.moveVec.x; my = this.moveVec.y }
      if (this.autoAim) {
        p.facing.x = mx || p.facing.x
        p.facing.y = my || p.facing.y
      }
    }

    if (!this.autoAim) {
      const aimLen = Math.hypot(this.aimVec.x, this.aimVec.y)
      if (aimLen > 0.2) {
        p.facing.x = this.aimVec.x / aimLen
        p.facing.y = this.aimVec.y / aimLen
      }
    }

    let speed = p.speed
    if (p.dodgeDuration > 0) {
      speed = p.speed * 2.6
      p.dodgeDuration -= dt
    }

    if (this.dodgeRequested && p.dodgeCooldown <= 0) {
      p.dodgeDuration = 0.18
      p.invulnerable = 0.4
      p.dodgeCooldown = 1.1
    }
    this.dodgeRequested = false
    if (p.dodgeCooldown > 0) p.dodgeCooldown -= dt
    if (p.invulnerable > 0) p.invulnerable -= dt
    if (p.hitFlash > 0) p.hitFlash -= dt

    p.x = clamp(p.x + mx * speed * dt, ARENA_PAD, VIRTUAL_W - ARENA_PAD)
    p.y = clamp(p.y + my * speed * dt, ARENA_PAD, VIRTUAL_H - ARENA_PAD)

    // Shooting
    if (p.shootCooldown > 0) p.shootCooldown -= dt
    const wantsToShoot = this.autoAim ? true : this.shootHeld
    if (wantsToShoot && p.shootCooldown <= 0) {
      this._fireBullet()
      p.shootCooldown = p.shootInterval
    }

    // Bullets
    for (const b of this.bullets) b.update(dt)
    this.bullets = this.bullets.filter((b) => !b.dead)

    // Enemies
    for (const e of this.enemies) e.update(dt, p)

    // Bullet-enemy collisions
    for (const b of this.bullets) {
      if (b.dead) continue
      for (const e of this.enemies) {
        if (e.dead) continue
        if (dist(b.x, b.y, e.x, e.y) < b.radius + e.radius) {
          e.hp -= b.damage
          e.hitFlash = 0.12
          b.dead = true
          if (e.hp <= 0) {
            e.dead = true
            this.score += 10
            this._spawnHitParticles(e.x, e.y)
          }
          break
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead)

    // Enemy-player collisions
    for (const e of this.enemies) {
      if (e.dead) continue
      if (e.contactCooldown > 0) continue
      if (dist(e.x, e.y, p.x, p.y) < e.radius + p.radius) {
        if (p.invulnerable <= 0) {
          p.hp -= e.contactDamage
          p.hitFlash = 0.2
          e.contactCooldown = 0.6
          if (p.hp <= 0) {
            p.hp = 0
            this._triggerGameOver()
          }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead)

    // Particles
    for (const pt of this.particles) {
      pt.x += pt.vx * dt
      pt.y += pt.vy * dt
      pt.life -= dt
    }
    this.particles = this.particles.filter((pt) => pt.life > 0)

    // Wave spawning
    if (this.enemiesToSpawn > 0) {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0) {
        this._spawnEnemy()
        this.enemiesToSpawn--
        this.spawnTimer = Math.max(0.55 - this.wave * 0.03, 0.18)
      }
    } else if (this.enemies.length === 0) {
      this.waveClearDelay += dt
      if (this.waveClearDelay > 1.5) {
        this.wave++
        this._startWave()
      }
    }

    if (this.onHud) {
      this.onHud({
        hp: Math.ceil(p.hp),
        maxHp: p.maxHp,
        score: this.score,
        wave: this.wave,
        dodgeReady: p.dodgeCooldown <= 0,
      })
    }
  }

  _spawnHitParticles(x, y) {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2
      const spd = 20 + Math.random() * 30
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.3,
        maxLife: 0.3,
      })
    }
  }

  _triggerGameOver() {
    this.gameOver = true
    this.stop()
    if (this.onGameOver) this.onGameOver({ score: this.score, wave: this.wave })
  }
}
