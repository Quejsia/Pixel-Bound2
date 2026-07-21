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

// Fixed arena obstacles (rocks) — simple axis-aligned rectangles.
// Kept sparse so basic push-out collision resolution behaves reasonably
// without needing real pathfinding for enemies.
function makeObstacles() {
  return [
    { x: 70, y: 50, w: 22, h: 16 },
    { x: 220, y: 40, w: 18, h: 20 },
    { x: 170, y: 115, w: 26, h: 18 },
    { x: 60, y: 130, w: 20, h: 16 },
    { x: 250, y: 120, w: 22, h: 18 },
  ]
}

// Push a circular entity out of a rectangle if it overlaps. Mutates x/y in place.
function resolveCircleRectCollision(entity, rect) {
  const closestX = clamp(entity.x, rect.x, rect.x + rect.w)
  const closestY = clamp(entity.y, rect.y, rect.y + rect.h)
  const dx = entity.x - closestX
  const dy = entity.y - closestY
  const distSq = dx * dx + dy * dy
  const r = entity.radius
  if (distSq < r * r) {
    const d = Math.sqrt(distSq) || 0.001
    const push = r - d
    entity.x += (dx / d) * push
    entity.y += (dy / d) * push
  }
}

function circleIntersectsRect(x, y, radius, rect) {
  const closestX = clamp(x, rect.x, rect.x + rect.w)
  const closestY = clamp(y, rect.y, rect.y + rect.h)
  const dx = x - closestX
  const dy = y - closestY
  return dx * dx + dy * dy < radius * radius
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

const RARITIES = ['common', 'uncommon', 'rare', 'epic']
const RARITY_WEIGHTS = [0.65, 0.23, 0.1, 0.02]
const RARITY_MULT = { common: 1, uncommon: 2, rare: 4, epic: 8 }
const RARITY_COLORS = { common: '#c9c9c9', uncommon: '#5fe07a', rare: '#7ca8ff', epic: '#e0894d' }

// Each equipment slot always grants a specific stat, item names are flavor
const SLOT_INFO = {
  armor: { statType: 'defense', baseValue: 0.05, names: ['Rusty Plate', 'Leather Vest', 'Scale Guard'] },
  trinket: { statType: 'maxHp', baseValue: 10, names: ['Cracked Gem', 'Bone Charm', 'Old Coin Pouch'] },
  charm: { statType: 'attack', baseValue: 0.08, names: ['Beast Fang', 'Ether Shard', 'Sharp Talon'] },
}
const SLOTS = Object.keys(SLOT_INFO)

function rollRarity() {
  const r = Math.random()
  let acc = 0
  for (let i = 0; i < RARITIES.length; i++) {
    acc += RARITY_WEIGHTS[i]
    if (r <= acc) return RARITIES[i]
  }
  return RARITIES[0]
}

function makeItem(rarity, slot) {
  const info = SLOT_INFO[slot]
  const name = info.names[Math.floor(Math.random() * info.names.length)]
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    rarity,
    slot,
    statType: info.statType,
    statValue: Math.round(info.baseValue * RARITY_MULT[rarity] * 100) / 100,
  }
}

function forgeCost(rarity) {
  const idx = RARITIES.indexOf(rarity)
  return 20 * (idx + 1) * (idx + 1)
}

const SHOP_PRICES = { common: 30, uncommon: 80, rare: 200, epic: 450 }
const SHOP_RARITY_WEIGHTS = [0.1, 0.45, 0.35, 0.1] // shop skews better than natural drops
const SHOP_REFRESH_SECONDS = 180

function rollShopRarity() {
  const r = Math.random()
  let acc = 0
  for (let i = 0; i < RARITIES.length; i++) {
    acc += SHOP_RARITY_WEIGHTS[i]
    if (r <= acc) return RARITIES[i]
  }
  return RARITIES[1]
}

function makeShopItem() {
  const rarity = rollShopRarity()
  const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)]
  const item = makeItem(rarity, slot)
  item.price = SHOP_PRICES[rarity]
  return item
}

class Pickup {
  constructor(x, y, kind, value) {
    this.x = x
    this.y = y
    this.kind = kind // 'xp' | 'gold' | 'item'
    this.value = value // xp amount, gold amount, or item object
    this.radius = kind === 'item' ? 3 : 2
    this.dead = false
    this.bornAt = performance.now()
  }
  update(dt, player, magnetRadius) {
    const d = dist(this.x, this.y, player.x, player.y)
    if (d < magnetRadius) {
      const speed = 140
      const nx = (player.x - this.x) / Math.max(d, 0.001)
      const ny = (player.y - this.y) / Math.max(d, 0.001)
      this.x += nx * speed * dt
      this.y += ny * speed * dt
    }
    if (d < player.radius + this.radius + 1) this.dead = true
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

class Skeleton {
  constructor(x, y, wave) {
    this.type = 'skeleton'
    this.x = x
    this.y = y
    this.radius = 6.5
    this.maxHp = 26 + wave * 6
    this.hp = this.maxHp
    this.speed = 16 + Math.min(wave * 1.2, 22)
    this.contactDamage = 14 + Math.floor(wave / 3)
    this.hitFlash = 0
    this.contactCooldown = 0
    this.facing = 1
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
    this.bob = Math.sin(performance.now() / 200 + this.x) * 0.8
  }
}

class Archer {
  constructor(x, y, wave) {
    this.type = 'archer'
    this.x = x
    this.y = y
    this.radius = 5
    this.maxHp = 10 + wave * 2
    this.hp = this.maxHp
    this.speed = 26 + Math.min(wave * 1.5, 20)
    this.contactDamage = 6
    this.idealRange = 65
    this.hitFlash = 0
    this.contactCooldown = 0
    this.shootCooldown = 1 + Math.random() // stagger initial shots
    this.shootInterval = Math.max(1.8 - wave * 0.06, 0.9)
    this.facing = 1
    this.dead = false
  }
  update(dt, player, spawnEnemyBullet) {
    const d = dist(this.x, this.y, player.x, player.y) || 0.001
    const nx = (player.x - this.x) / d
    const ny = (player.y - this.y) / d
    this.facing = nx >= 0 ? 1 : -1

    // keep distance: flee if too close, approach if too far, hold if in range
    if (d < this.idealRange - 12) {
      this.x -= nx * this.speed * dt
      this.y -= ny * this.speed * dt
    } else if (d > this.idealRange + 12) {
      this.x += nx * this.speed * dt
      this.y += ny * this.speed * dt
    }

    if (this.hitFlash > 0) this.hitFlash -= dt
    if (this.contactCooldown > 0) this.contactCooldown -= dt

    this.shootCooldown -= dt
    if (this.shootCooldown <= 0 && d < 140) {
      this.shootCooldown = this.shootInterval
      const speed = 95
      const arrow = new Bullet(this.x, this.y, nx * speed, ny * speed, this.contactDamage, false)
      arrow.life = 2
      spawnEnemyBullet(arrow)
    }
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
      baseSpeed: 55,
      speed: 55,
      baseMaxHp: 100,
      maxHp: 100,
      hp: 100,
      level: 1,
      xp: 0,
      xpToNext: 30,
      gold: 0,
      baseAttackMultiplier: 1,
      attackMultiplier: 1,
      defense: 0, // fraction of incoming contact damage reduced, from armor
      equipment: { armor: null, trinket: null, charm: null },
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
    this.enemyBullets = []
    this.enemies = []
    this.particles = []
    this.pickups = []
    this.inventory = []
    this.magnetRadius = 28
    this.obstacles = makeObstacles()
    this.shop = {
      stock: [makeShopItem(), makeShopItem()],
      timer: SHOP_REFRESH_SECONDS,
    }

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

    const wave = this.wave
    const goblinChance = wave >= 3 ? Math.min(0.15 + wave * 0.05, 0.35) : 0
    const skeletonChance = wave >= 4 ? Math.min(0.1 + wave * 0.03, 0.3) : 0
    const archerChance = wave >= 6 ? Math.min(0.08 + wave * 0.02, 0.25) : 0

    const r = Math.random()
    if (r < archerChance) {
      this.enemies.push(new Archer(x, y, wave))
    } else if (r < archerChance + skeletonChance) {
      this.enemies.push(new Skeleton(x, y, wave))
    } else if (r < archerChance + skeletonChance + goblinChance) {
      this.enemies.push(new Goblin(x, y, wave))
    } else {
      this.enemies.push(new Slime(x, y, wave))
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
        const b = new Bullet(p.x, p.y, bx * speed, by * speed, 5 * p.attackMultiplier)
        b.life = 0.35 // shorter range than pistol
        this.bullets.push(b)
      }
    } else {
      const speed = 210
      this.bullets.push(new Bullet(p.x, p.y, dx * speed, dy * speed, 9 * p.attackMultiplier))
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
    for (const obs of this.obstacles) resolveCircleRectCollision(p, obs)

    // Shooting
    if (p.shootCooldown > 0) p.shootCooldown -= dt
    const wantsToShoot = this.autoAim ? true : this.shootHeld
    if (wantsToShoot && p.shootCooldown <= 0) {
      this._fireBullet()
      p.shootCooldown = p.shootInterval
    }

    // Bullets
    for (const b of this.bullets) {
      b.update(dt)
      if (!b.dead) {
        for (const obs of this.obstacles) {
          if (circleIntersectsRect(b.x, b.y, b.radius, obs)) { b.dead = true; break }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead)

    // Enemy bullets (arrows etc.)
    for (const b of this.enemyBullets) {
      b.update(dt)
      if (!b.dead) {
        for (const obs of this.obstacles) {
          if (circleIntersectsRect(b.x, b.y, b.radius, obs)) { b.dead = true; break }
        }
      }
    }
    for (const b of this.enemyBullets) {
      if (b.dead) continue
      if (dist(b.x, b.y, p.x, p.y) < b.radius + p.radius) {
        if (p.invulnerable <= 0) {
          p.hp -= b.damage * (1 - p.defense)
          p.hitFlash = 0.2
          if (p.hp <= 0) {
            p.hp = 0
            this._triggerGameOver()
          }
        }
        b.dead = true
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => !b.dead)

    // Enemies
    const spawnEnemyBullet = (b) => this.enemyBullets.push(b)
    for (const e of this.enemies) {
      e.update(dt, p, spawnEnemyBullet)
      for (const obs of this.obstacles) resolveCircleRectCollision(e, obs)
    }

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
            this._dropLoot(e.x, e.y, e.type)
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
          p.hp -= e.contactDamage * (1 - p.defense)
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

    // Pickups
    for (const pk of this.pickups) {
      pk.update(dt, p, this.magnetRadius)
      if (pk.dead) this._collectPickup(pk)
    }
    this.pickups = this.pickups.filter((pk) => !pk.dead)

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

    // Blacksmith shop restock
    this.shop.timer -= dt
    if (this.shop.timer <= 0) {
      this.shop.stock = [makeShopItem(), makeShopItem()]
      this.shop.timer = SHOP_REFRESH_SECONDS
    }

    if (this.onHud) {
      this.onHud({
        hp: Math.ceil(p.hp),
        maxHp: p.maxHp,
        score: this.score,
        wave: this.wave,
        dodgeReady: p.dodgeCooldown <= 0,
        level: p.level,
        xp: p.xp,
        xpToNext: p.xpToNext,
        gold: p.gold,
        inventoryCount: this.inventory.length,
      })
    }
  }

  _dropLoot(x, y, enemyType) {
    // Always drop XP
    const xpAmount = enemyType === 'goblin' ? 4 : 3
    this.pickups.push(new Pickup(x, y, 'xp', xpAmount))

    // Chance for gold
    if (Math.random() < 0.5) {
      const goldAmount = 1 + Math.floor(Math.random() * 3)
      this.pickups.push(new Pickup(x + 2, y, 'gold', goldAmount))
    }

    // Small chance for an item
    if (Math.random() < 0.15) {
      const rarity = rollRarity()
      const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)]
      this.pickups.push(new Pickup(x - 2, y, 'item', makeItem(rarity, slot)))
    }
  }

  _collectPickup(pk) {
    const p = this.player
    if (pk.kind === 'xp') {
      this._gainXp(pk.value)
    } else if (pk.kind === 'gold') {
      p.gold += pk.value
    } else if (pk.kind === 'item') {
      this.inventory.push(pk.value)
    }
  }

  _gainXp(amount) {
    const p = this.player
    p.xp += amount
    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext
      p.level++
      p.xpToNext = Math.round(p.xpToNext * 1.35)
      p.baseMaxHp += 15
      p.baseAttackMultiplier += 0.12
      this._recalcStats()
      p.hp = Math.min(p.hp + p.maxHp * 0.4, p.maxHp)
    }
  }

  _recalcStats() {
    const p = this.player
    let maxHp = p.baseMaxHp
    let attack = p.baseAttackMultiplier
    let defense = 0
    let speed = p.baseSpeed
    for (const slot of SLOTS) {
      const item = p.equipment[slot]
      if (!item) continue
      if (item.statType === 'maxHp') maxHp += item.statValue
      if (item.statType === 'attack') attack += item.statValue
      if (item.statType === 'defense') defense += item.statValue
      if (item.statType === 'speed') speed += item.statValue
    }
    p.maxHp = maxHp
    p.attackMultiplier = attack
    p.defense = Math.min(defense, 0.75) // cap damage reduction at 75%
    p.speed = speed
    if (p.hp > p.maxHp) p.hp = p.maxHp
  }

  equipItem(itemId) {
    const p = this.player
    const idx = this.inventory.findIndex((i) => i.id === itemId)
    if (idx === -1) return
    const item = this.inventory[idx]
    const slot = item.slot
    const current = p.equipment[slot]
    // swap: remove new item from inventory, put old equipped item (if any) back
    this.inventory.splice(idx, 1)
    if (current) this.inventory.push(current)
    p.equipment[slot] = item
    this._recalcStats()
  }

  unequipItem(slot) {
    const p = this.player
    const item = p.equipment[slot]
    if (!item) return
    p.equipment[slot] = null
    this.inventory.push(item)
    this._recalcStats()
  }

  forgeItem(itemId) {
    const p = this.player
    // item may be in inventory or currently equipped
    let item = this.inventory.find((i) => i.id === itemId)
    let equippedSlot = null
    if (!item) {
      for (const slot of SLOTS) {
        if (p.equipment[slot] && p.equipment[slot].id === itemId) {
          item = p.equipment[slot]
          equippedSlot = slot
          break
        }
      }
    }
    if (!item) return { ok: false, reason: 'not-found' }
    const idx = RARITIES.indexOf(item.rarity)
    if (idx >= RARITIES.length - 1) return { ok: false, reason: 'max-rarity' }
    const cost = forgeCost(item.rarity)
    if (p.gold < cost) return { ok: false, reason: 'not-enough-gold', cost }

    p.gold -= cost
    const newRarity = RARITIES[idx + 1]
    item.rarity = newRarity
    const info = SLOT_INFO[item.slot]
    item.statValue = Math.round(info.baseValue * RARITY_MULT[newRarity] * 100) / 100
    if (equippedSlot) this._recalcStats()
    return { ok: true, cost, newRarity }
  }

  buyShopItem(slotIndex) {
    const p = this.player
    const item = this.shop.stock[slotIndex]
    if (!item) return { ok: false, reason: 'not-found' }
    if (p.gold < item.price) return { ok: false, reason: 'not-enough-gold', cost: item.price }
    p.gold -= item.price
    const { price, ...itemForInventory } = item
    this.inventory.push(itemForInventory)
    this.shop.stock[slotIndex] = null
    return { ok: true, item: itemForInventory }
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
