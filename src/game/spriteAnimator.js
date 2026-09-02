// Pixel-Bound sprite animation core.
// The supplied player sheet is 1024x1024 (8x8, 128px cells).
// The supplied enemy sheets are 1536x1536 (8x8, 192px cells).
// Using the native atlas cells avoids cropping neighboring frames and preserves full bodies.
export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function getDirection8(dx, dy) {
  if (Math.abs(dx) + Math.abs(dy) < 0.001) return null
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const idx = Math.round(((angle + 360) % 360) / 45) % 8
  return ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][idx]
}

const PLAYER = {
  frameWidth: 128,
  frameHeight: 128,
  animations: {
    idle: { rows: [0], fps: 4 },
    walk: { rows: [1], fps: 10 },
    attack: { rows: [2], fps: 12, loop: false },
    dodge: { rows: [3], fps: 12, loop: false },
    hurt: { rows: [5], fps: 10, loop: false },
    death: { mode: 'sequential', row: 6, frameCount: 8, fps: 10, loop: false },
  },
}

const ENEMY = (src, kind) => ({
  src,
  frameWidth: 192,
  frameHeight: 192,
  animations: {
    idle: { rows: [0], fps: 5 },
    walk: { rows: [1, 2, 3], fps: kind === 'slime' ? 9 : 10 },
    attack: { rows: [4], fps: 12, loop: false },
    hurt: { rows: [5], fps: 10, loop: false },
    death: { mode: 'sequential', row: 6, frameCount: 8, fps: 10, loop: false },
  },
})

export const SPRITE_MANIFESTS = {
  player: { src: '/sprite/player.png', ...PLAYER, renderScale: 0.34 },
  goblin: { ...ENEMY('/sprite/goblin.png', 'goblin'), renderScale: 0.22 },
  slime: { ...ENEMY('/sprite/slime.png', 'slime'), renderScale: 0.21 },
  skeleton: { ...ENEMY('/sprite/skeleton.png', 'skeleton'), renderScale: 0.22 },
  archer: { ...ENEMY('/sprite/archer.png', 'archer'), renderScale: 0.22 },
}

// Kept as a public helper for spriteRenderer and future atlas-specific render logic.
// Current manifests use native cell grids, so no alternate profile is required.
export function resolveSpriteProfile(manifest) {
  return manifest
}

export class SpriteAnimator {
  constructor(image, manifest) {
    this.image = image
    this.manifest = manifest
    this.direction = 'S'
    this.animName = 'idle'
    this.frameIndex = 0
    this.elapsed = 0
    this.finished = false
  }

  play(name) {
    const clip = this.manifest.animations?.[name]
    if (!clip) return
    if (this.animName === name && !this.finished) return
    this.animName = name
    this.frameIndex = 0
    this.elapsed = 0
    this.finished = false
  }

  setDirection(dir) { if (dir) this.direction = dir }

  update(dtMs) {
    const c = this.manifest.animations?.[this.animName]
    if (!c || this.finished) return
    this.elapsed += Math.max(0, Math.min(dtMs, 80))
    const frameDuration = 1000 / Math.max(1, c.fps || 8)
    while (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration
      const count = c.mode === 'sequential' ? c.frameCount : c.rows.length
      if (this.frameIndex + 1 >= count) {
        if (c.loop !== false) this.frameIndex = 0
        else { this.frameIndex = Math.max(0, count - 1); this.finished = true }
      } else {
        this.frameIndex += 1
      }
    }
  }

  currentSourceRect() {
    const c = this.manifest.animations?.[this.animName]
    if (!c) return null
    const row = c.mode === 'sequential' ? c.row : (c.rows[this.frameIndex] ?? c.rows[0])
    const col = c.mode === 'sequential' ? this.frameIndex : Math.max(0, DIRECTIONS.indexOf(this.direction))
    return {
      x: col * this.manifest.frameWidth,
      y: row * this.manifest.frameHeight,
      w: this.manifest.frameWidth,
      h: this.manifest.frameHeight,
    }
  }

  draw(ctx, x, y, { scale = 1, bob = 0 } = {}) {
    const rect = this.currentSourceRect()
    if (!rect) return
    ctx.save()
    ctx.imageSmoothingEnabled = false
    const dw = rect.w * scale
    const dh = rect.h * scale
    ctx.drawImage(this.image, rect.x, rect.y, rect.w, rect.h, x - dw / 2, y - dh / 2 + bob, dw, dh)
    ctx.restore()
  }
}
