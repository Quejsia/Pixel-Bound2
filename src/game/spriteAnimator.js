import { SPRITE_DIRECTIONS, loadSpriteSheet, getLoadedSpriteSheet } from './spriteLoader.js'

export const DIRECTIONS = SPRITE_DIRECTIONS
const DIRECTION_INDEX = Object.fromEntries(DIRECTIONS.map((name, index) => [name, index]))

const makeManifest = (src, rows, animations, renderScale) => ({
  src,
  columns: 8,
  atlasRows: rows,
  animations,
  renderScale,
})

const clip = (rows, fps, loop = true) => ({ rows, fps, loop })

// The requested layout is used when the PNG dimensions match it. The loader
// falls back to the native square cell height when an older 1536x1536 atlas is
// supplied, while keeping these logical animation rows unchanged.
export const SPRITE_MANIFESTS = {
  player: makeManifest('/sprite/player.png', 7, {
    idle: clip([0], 4),
    walk: clip([1, 2, 3], 10),
    attack: clip([4], 12, false),
    dodge: clip([1, 2, 1], 14, false),
    hurt: clip([5], 10, false),
    death: clip([6], 10, false),
  }, 0.30),
  archer: makeManifest('/sprite/archer.png', 7, {
    idle: clip([0], 4),
    walk: clip([1, 2, 3], 10),
    attack: clip([4], 12, false),
    hurt: clip([5], 10, false),
    death: clip([6], 10, false),
  }, 0.30),
  goblin: makeManifest('/sprite/goblin.png', 6, {
    idle: clip([0], 4),
    walk: clip([1, 2], 9),
    attack: clip([3], 12, false),
    hurt: clip([4], 10, false),
    death: clip([5], 10, false),
  }, 0.27),
  skeleton: makeManifest('/sprite/skeleton.png', 6, {
    idle: clip([0], 4),
    walk: clip([1, 2], 9),
    attack: clip([3], 12, false),
    hurt: clip([4], 10, false),
    death: clip([5], 10, false),
  }, 0.27),
  slime: makeManifest('/sprite/slime.png', 6, {
    idle: clip([0], 5),
    walk: clip([1, 2], 10),
    attack: clip([3], 12, false),
    hurt: clip([4], 12, false),
    death: clip([5], 10, false),
  }, 0.27),
}

export function getDirection8(dx, dy) {
  if (Math.hypot(dx, dy) < 0.001) return null
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4))
  const wrapped = ((octant % 8) + 8) % 8
  return ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'][wrapped]
}

export function resolveSpriteProfile(manifest) {
  return manifest
}

export function getAnimationRows(manifest, state) {
  return manifest?.animations?.[state]?.rows || manifest?.animations?.idle?.rows || [0]
}

export function getFrameCell(manifest, state, direction, frameIndex = 0) {
  const animation = manifest?.animations?.[state] || manifest?.animations?.idle
  const rows = animation?.rows || [0]
  const row = rows[Math.min(frameIndex, rows.length - 1)] ?? 0
  const col = DIRECTION_INDEX[direction] ?? DIRECTION_INDEX.S
  return { row, col }
}

export class SpriteAnimator {
  constructor(sheet) {
    this.sheet = sheet
    this.manifest = sheet.manifest
    this.direction = 'S'
    this.state = 'idle'
    this.frameIndex = 0
    this.elapsed = 0
    this.finished = false
  }

  play(state, { restart = false } = {}) {
    const next = this.manifest.animations?.[state] ? state : 'idle'
    if (next === this.state && !this.finished && !restart) return false
    this.state = next
    this.frameIndex = 0
    this.elapsed = 0
    this.finished = false
    return true
  }

  setDirection(direction) {
    if (DIRECTION_INDEX[direction] !== undefined) this.direction = direction
  }

  update(dtMs) {
    const animation = this.manifest.animations?.[this.state]
    if (!animation || this.finished) return
    const frameDuration = 1000 / Math.max(1, animation.fps || 8)
    this.elapsed += Math.min(Math.max(dtMs, 0), 100)
    while (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration
      const count = Math.max(1, animation.rows?.length || 1)
      if (this.frameIndex + 1 >= count) {
        if (animation.loop !== false) this.frameIndex = 0
        else { this.frameIndex = count - 1; this.finished = true }
      } else {
        this.frameIndex += 1
      }
    }
  }

  getFrame() {
    const { row, col } = getFrameCell(this.manifest, this.state, this.direction, this.frameIndex)
    return this.sheet.frames?.[row]?.[col] || null
  }

  draw(ctx, x, y, { scale = this.manifest.renderScale || 0.27, bob = 0, alpha = 1 } = {}) {
    const frame = this.getFrame()
    if (!frame) return false
    const dw = this.manifest.frameWidth * scale
    const dh = this.manifest.frameHeight * scale
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.globalAlpha = alpha
    ctx.drawImage(frame, Math.round(x - dw / 2), Math.round(y - dh / 2 + bob), dw, dh)
    ctx.restore()
    return true
  }
}

const loading = new Map()
async function loadForKey(key) {
  if (!SPRITE_MANIFESTS[key]) return null
  if (!loading.has(key)) loading.set(key, loadSpriteSheet(key, SPRITE_MANIFESTS[key]))
  return loading.get(key)
}

export async function preloadSprites() {
  await Promise.all(Object.keys(SPRITE_MANIFESTS).map(loadForKey))
}

export function getSpriteLoadState() {
  const result = {}
  for (const key of Object.keys(SPRITE_MANIFESTS)) result[key] = getLoadedSpriteSheet(key) ? 'ready' : loading.has(key) ? 'loading' : 'idle'
  return result
}

export async function getOrCreateSpriteAnimator(entity, key) {
  if (!entity || !SPRITE_MANIFESTS[key]) return null
  const sheet = await loadForKey(key)
  return sheet ? new SpriteAnimator(sheet) : null
}

void preloadSprites()
