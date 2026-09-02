import { SPRITE_DIRECTIONS, loadSpriteSheet, getLoadedSpriteSheet } from './spriteLoader.js'

// Sprite animation profiles.
// The loader derives frameWidth/frameHeight from the real sheet dimensions:
// frameWidth = sheetWidth / 8
// frameHeight = sheetHeight / atlasRows
//
// This is important for Pixel-Bound because the current uploaded PNGs are
// 1536x1536 (192px cells), while a 1024x1024 replacement would naturally be
// 128px cells. No runtime code has to change when the art is replaced.
export const DIRECTIONS = SPRITE_DIRECTIONS
const DIRECTION_INDEX = Object.fromEntries(DIRECTIONS.map((name, index) => [name, index]))

export function getDirection8(dx, dy) {
  if (Math.abs(dx) + Math.abs(dy) < 0.001) return null
  const angle = Math.atan2(dy, dx)
  const octant = Math.round(angle / (Math.PI / 4))
  return DIRECTIONS[((octant + 2) % 8 + 8) % 8]
}

const clip = (rows, fps = 8, loop = true) => ({ rows, fps, loop })

// All currently uploaded sheets are eight-column atlases. The final physical
// row may be unused on sheets that have fewer logical animation states.
const BASE = (src, animations, renderScale = 0.22) => ({
  src,
  columns: 8,
  atlasRows: 8,
  animations,
  renderScale,
})

export const SPRITE_MANIFESTS = {
  // Current player.png is the warrior sheet. Logical states use rows 0-6;
  // physical row 7 is intentionally unused.
  player: BASE('/sprite/player.png', {
    idle: clip([0], 4),
    walk: clip([1, 2, 3], 9),
    attack: clip([4], 12, false),
    dodge: clip([1, 2, 1], 14, false),
    hurt: clip([5], 10, false),
    death: clip([6], 9, false),
  }, 0.23),

  goblin: BASE('/sprite/goblin.png', {
    idle: clip([0], 4),
    walk: clip([1, 2], 9),
    attack: clip([3], 12, false),
    hurt: clip([4], 10, false),
    death: clip([5], 9, false),
  }, 0.22),

  skeleton: BASE('/sprite/skeleton.png', {
    idle: clip([0], 4),
    walk: clip([1, 2, 3], 9),
    attack: clip([4], 12, false),
    hurt: clip([5, 6], 10, false),
    death: clip([7], 9, false),
  }, 0.22),

  slime: BASE('/sprite/slime.png', {
    idle: clip([0], 4),
    walk: clip([1, 2], 10),
    attack: clip([3], 12, false),
    hurt: clip([4], 12, false),
    death: clip([5], 10, false),
  }, 0.22),

  // archer.png is currently used by the existing Archer enemy. Its atlas is
  // also compatible with the same eight-direction, row-based system.
  archer: BASE('/sprite/archer.png', {
    idle: clip([0], 4),
    walk: clip([1, 2, 3], 9),
    attack: clip([4], 12, false),
    hurt: clip([5], 10, false),
    death: clip([6], 9, false),
  }, 0.22),
}

export function getAnimationRows(manifest, state) {
  return manifest?.animations?.[state]?.rows || manifest?.animations?.idle?.rows || [0]
}

export function getFrameCell(manifest, state, direction, frameIndex = 0) {
  const animation = manifest?.animations?.[state] || manifest?.animations?.idle
  if (!animation) return { row: 0, col: DIRECTION_INDEX.S }
  const row = animation.rows[Math.max(0, Math.min(animation.rows.length - 1, frameIndex))] ?? animation.rows[0] ?? 0
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
    if (this.state === next && !this.finished && !restart) return false
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
    const animation = this.manifest.animations?.[this.state]
    if (!animation || this.finished) return

    const frameDuration = 1000 / Math.max(1, animation.fps || 8)
    this.elapsed += Math.max(0, Math.min(dtMs, 100))

    while (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration
      const count = Math.max(1, animation.rows?.length || 1)
      const next = this.frameIndex + 1

      if (next >= count) {
        if (animation.loop !== false) this.frameIndex = 0
        else {
          this.frameIndex = count - 1
          this.finished = true
        }
      } else {
        this.frameIndex = next
      }

      if (this.finished) break
    }
  }

  getFrame() {
    const { row, col } = getFrameCell(this.manifest, this.state, this.direction, this.frameIndex)
    return this.sheet.frames[row]?.[col] || this.sheet.frames[0]?.[DIRECTION_INDEX.S] || null
  }

  draw(ctx, x, y, { scale = this.manifest.renderScale || 0.22, bob = 0, alpha = 1 } = {}) {
    const frame = this.getFrame()
    if (!frame) return false

    const width = this.manifest.frameWidth * scale
    const height = this.manifest.frameHeight * scale

    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.globalAlpha = alpha
    // x/y are the entity's logical gameplay anchor. The sprite dimensions do
    // not participate in collision or hitbox calculations.
    ctx.drawImage(frame, Math.round(x - width / 2), Math.round(y - height / 2 + bob), width, height)
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
  for (const key of Object.keys(SPRITE_MANIFESTS)) {
    result[key] = getLoadedSpriteSheet(key) ? 'ready' : loading.has(key) ? 'loading' : 'idle'
  }
  return result
}

export async function getOrCreateSpriteAnimator(entity, key) {
  if (!entity || !SPRITE_MANIFESTS[key]) return null
  const sheet = await loadForKey(key)
  return sheet ? new SpriteAnimator(await sheet) : null
}
