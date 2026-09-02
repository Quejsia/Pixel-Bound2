// Pixel-Bound sprite atlas definitions and frame selection.
// All currently uploaded sheets are 1536x1536: 8 direction columns x 8 rows,
// so every native cell is 192x192. The final row(s) that are blank/unused are
// never selected by the animation profiles below.

export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const DIRECTION_INDEX = Object.fromEntries(DIRECTIONS.map((name, index) => [name, index]))

export function getDirection8(dx, dy) {
  if (Math.abs(dx) + Math.abs(dy) < 0.001) return null
  const angle = Math.atan2(dy, dx)
  const index = Math.round(angle / (Math.PI / 4))
  const wrapped = ((index % 8) + 8) % 8
  // The supplied art uses N, NE, E, SE, S, SW, W, NW by column.
  return DIRECTIONS[(wrapped + 2) % 8]
}

const COMMON = { frameWidth: 192, frameHeight: 192, columns: 8, rows: 8 }

// Row inventory is based on visual inspection of the supplied sprite atlases.
// Warrior: idle(0), walk(1), attack poses(2-4), hurt(5), death(6), row 7 unused.
// Skeleton/archer: idle(0), walk cycle(1-3), attack(4), hurt/recovery(5-6), death(7).
// Goblin: idle(0), walk cycle(1-2), attack(3), hurt(4), death(5).
// Slime: idle(0), walk cycle(1-2), attack(3), hurt(4), death(5).
const PLAYER_WARRIOR = {
  ...COMMON,
  src: '/sprite/player.png',
  renderScale: 0.42,
  animations: {
    idle: { rows: [0], fps: 4, loop: true },
    walk: { rows: [1], fps: 9, loop: true },
    attack: { rows: [2, 3, 4], fps: 12, loop: false },
    // The supplied warrior atlas has no clearly dedicated roll row; use a
    // short directional movement sequence rather than falling back to vectors.
    dodge: { rows: [1, 2, 1], fps: 14, loop: false },
    hurt: { rows: [5], fps: 10, loop: false },
    death: { rows: [6], fps: 8, loop: false },
  },
}

const GOBLIN = {
  ...COMMON,
  src: '/sprite/goblin.png',
  renderScale: 0.31,
  animations: {
    idle: { rows: [0], fps: 4, loop: true },
    walk: { rows: [1, 2], fps: 8, loop: true },
    attack: { rows: [3], fps: 12, loop: false },
    hurt: { rows: [4], fps: 10, loop: false },
    death: { rows: [5], fps: 9, loop: false },
  },
}

const SKELETON = {
  ...COMMON,
  src: '/sprite/skeleton.png',
  renderScale: 0.30,
  animations: {
    idle: { rows: [0], fps: 4, loop: true },
    walk: { rows: [1, 2, 3], fps: 9, loop: true },
    attack: { rows: [4], fps: 12, loop: false },
    hurt: { rows: [5, 6], fps: 10, loop: false },
    death: { rows: [7], fps: 9, loop: false },
  },
}

const SLIME = {
  ...COMMON,
  src: '/sprite/slime.png',
  renderScale: 0.30,
  animations: {
    idle: { rows: [0], fps: 4, loop: true },
    walk: { rows: [1, 2], fps: 10, loop: true },
    attack: { rows: [3], fps: 12, loop: false },
    hurt: { rows: [4], fps: 12, loop: false },
    death: { rows: [5], fps: 10, loop: false },
  },
}

const ARCHER = {
  ...COMMON,
  src: '/sprite/archer.png',
  renderScale: 0.30,
  animations: {
    idle: { rows: [0], fps: 4, loop: true },
    walk: { rows: [1, 2, 3], fps: 9, loop: true },
    attack: { rows: [4], fps: 12, loop: false },
    hurt: { rows: [5, 6], fps: 10, loop: false },
    death: { rows: [7], fps: 9, loop: false },
  },
}

export const SPRITE_MANIFESTS = {
  player: PLAYER_WARRIOR,
  goblin: GOBLIN,
  skeleton: SKELETON,
  slime: SLIME,
  archer: ARCHER,
}

export function resolveSpriteProfile(manifest) {
  return manifest
}

export function getAnimationFrameRows(manifest, state) {
  return manifest?.animations?.[state]?.rows || manifest?.animations?.idle?.rows || [0]
}

export function getFrameRect(manifest, state, direction, frameIndex = 0) {
  const clip = manifest?.animations?.[state] || manifest?.animations?.idle
  if (!clip) return null
  const rows = clip.rows || [0]
  const row = rows[Math.max(0, Math.min(rows.length - 1, frameIndex))]
  const col = DIRECTION_INDEX[direction] ?? DIRECTION_INDEX.S
  return {
    x: col * manifest.frameWidth,
    y: row * manifest.frameHeight,
    w: manifest.frameWidth,
    h: manifest.frameHeight,
  }
}

export class SpriteAnimator {
  constructor(image, manifest) {
    this.image = image
    this.manifest = manifest
    this.direction = 'S'
    this.state = 'idle'
    this.frameIndex = 0
    this.elapsed = 0
    this.finished = false
  }

  play(state) {
    const next = this.manifest.animations?.[state] ? state : 'idle'
    if (this.state === next && !this.finished) return false
    this.state = next
    this.frameIndex = 0
    this.elapsed = 0
    this.finished = false
    return true
  }

  setDirection(direction) {
    if (direction && DIRECTION_INDEX[direction] !== undefined) this.direction = direction
  }

  update(dtMs) {
    const clip = this.manifest.animations?.[this.state]
    if (!clip || this.finished) return
    const fps = Math.max(1, clip.fps || 8)
    const frameDuration = 1000 / fps
    this.elapsed += Math.max(0, Math.min(dtMs, 100))

    while (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration
      const count = Math.max(1, clip.rows?.length || 1)
      if (this.frameIndex + 1 >= count) {
        if (clip.loop !== false) this.frameIndex = 0
        else {
          this.frameIndex = count - 1
          this.finished = true
        }
      } else {
        this.frameIndex += 1
      }
    }
  }

  currentSourceRect() {
    return getFrameRect(this.manifest, this.state, this.direction, this.frameIndex)
  }

  draw(ctx, x, y, { scale = 1, bob = 0, alpha = 1 } = {}) {
    if (!this.image) return false
    const rect = this.currentSourceRect()
    if (!rect) return false

    const dw = rect.w * scale
    const dh = rect.h * scale
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.globalAlpha = alpha
    // Entity x/y remain the logical gameplay/collision anchor; sprite size never
    // changes the existing hitbox or collision calculations.
    ctx.drawImage(this.image, rect.x, rect.y, rect.w, rect.h, x - dw / 2, y - dh / 2 + bob, dw, dh)
    ctx.restore()
    return true
  }
}
