// Pixel-Bound sprite animation core.
// The supplied art is arranged as a contact-sheet style atlas rather than perfectly
// aligned to the nominal 128/192 cell grid. We use measured frame centers so the
// renderer captures the full character instead of pieces of neighboring frames.
export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function getDirection8(dx, dy) {
  if (Math.abs(dx) + Math.abs(dy) < 0.001) return null
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const idx = Math.round(((angle + 360) % 360) / 45) % 8
  return ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][idx]
}

const PLAYER_1024 = {
  sourceFrameWidth: 112,
  sourceFrameHeight: 112,
  xCenters: [137, 250, 359, 459, 562, 663, 769, 878],
  yCenters: [72, 217, 357, 508, 650, 799, 960],
  animations: {
    idle: { rows: [0], fps: 5 },
    walk: { rows: [1], fps: 10 },
    attack: { rows: [2], fps: 12, loop: false },
    dodge: { rows: [3], fps: 12, loop: false },
    hurt: { rows: [5], fps: 10, loop: false },
    death: { mode: 'sequential', row: 6, frameCount: 8, fps: 10, loop: false },
  },
}

const SHEET_1536 = {
  sourceFrameWidth: 156,
  sourceFrameHeight: 166,
  xCenters: [210, 371, 532, 688, 844, 999, 1155, 1313],
  yCenters: [108, 325, 542, 737, 968, 1185, 1450],
}

const makeEnemy = (src, kind) => ({
  ...SHEET_1536,
  src,
  animations: {
    idle: { rows: [0], fps: 5 },
    walk: { rows: [1, 2, 3], fps: 10 },
    attack: { rows: [4], fps: 12, loop: false },
    hurt: { rows: [5], fps: 10, loop: false },
    death: { mode: 'sequential', row: 6, frameCount: 8, fps: 10, loop: false },
  },
  renderScale: kind === 'slime' ? 0.23 : 0.21,
})

export const SPRITE_MANIFESTS = {
  player: {
    src: '/sprite/player.png',
    frameWidth: 128,
    frameHeight: 128,
    dynamicProfiles: [PLAYER_1024, { ...SHEET_1536, animations: PLAYER_1024.animations }],
    animations: PLAYER_1024.animations,
    renderScale: 0.29,
  },
  goblin: makeEnemy('/sprite/goblin.png', 'goblin'),
  slime: makeEnemy('/sprite/slime.png', 'slime'),
  skeleton: makeEnemy('/sprite/skeleton.png', 'skeleton'),
  archer: makeEnemy('/sprite/archer.png', 'archer'),
}

export function resolveSpriteProfile(manifest, image) {
  if (!manifest?.dynamicProfiles) return manifest
  const profile = image?.naturalWidth >= 1400 ? manifest.dynamicProfiles[1] : manifest.dynamicProfiles[0]
  return { ...manifest, ...profile }
}

export class SpriteAnimator {
  constructor(image, manifest) {
    this.image = image
    this.manifest = resolveSpriteProfile(manifest, image)
    this.direction = 'S'
    this.animName = 'idle'
    this.frameIndex = 0
    this.elapsed = 0
    this.finished = false
  }

  refreshManifest() { this.manifest = resolveSpriteProfile(this.manifest, this.image) }

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
      } else this.frameIndex += 1
      if (this.finished) break
    }
  }

  currentSourceRect() {
    const c = this.manifest.animations?.[this.animName]
    if (!c) return null
    const row = c.mode === 'sequential' ? c.row : (c.rows[this.frameIndex] ?? c.rows[0])
    const col = c.mode === 'sequential' ? this.frameIndex : Math.max(0, DIRECTIONS.indexOf(this.direction))
    const xCenters = this.manifest.xCenters || []
    const yCenters = this.manifest.yCenters || []
    if (!xCenters.length || !yCenters.length) {
      return { x: col * this.manifest.frameWidth, y: row * this.manifest.frameHeight, w: this.manifest.frameWidth, h: this.manifest.frameHeight }
    }
    const cx = xCenters[Math.min(col, xCenters.length - 1)]
    const cy = yCenters[Math.min(row, yCenters.length - 1)]
    return {
      x: Math.max(0, Math.round(cx - this.manifest.sourceFrameWidth / 2)),
      y: Math.max(0, Math.round(cy - this.manifest.sourceFrameHeight / 2)),
      w: this.manifest.sourceFrameWidth,
      h: this.manifest.sourceFrameHeight,
    }
  }

  draw(ctx, x, y, { scale = 1 } = {}) {
    const rect = this.currentSourceRect()
    if (!rect) return
    ctx.save()
    ctx.imageSmoothingEnabled = false
    const dw = rect.w * scale
    const dh = rect.h * scale
    ctx.drawImage(this.image, rect.x, rect.y, rect.w, rect.h, x - dw / 2, y - dh / 2, dw, dh)
    ctx.restore()
  }
}
