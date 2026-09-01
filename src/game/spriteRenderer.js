import { SpriteAnimator, SPRITE_MANIFESTS, getDirection8 } from './spriteAnimator.js'

const sourceImages = {}
const renderImages = new Map()
const animators = new WeakMap()
const times = new WeakMap()

// The uploaded art is arranged on exact 8x8 atlas grids:
// player/archer = 1024x1024 / 128px cells
// enemies = 1536x1536 / 192px cells.
// Clean each native cell so the checkerboard never renders as part of a character.
function removeCheckerboard(image, manifest) {
  if (!image?.naturalWidth || !manifest?.frameWidth || !manifest?.frameHeight) return image

  const frameW = manifest.frameWidth
  const frameH = manifest.frameHeight
  const cols = Math.max(1, Math.floor(image.naturalWidth / frameW))
  const rows = Math.max(1, Math.floor(image.naturalHeight / frameH))
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, 0, 0)

  const full = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = full.data

  const isChecker = (di) => {
    const a = data[di + 3]
    if (a === 0) return true
    const r = data[di], g = data[di + 1], b = data[di + 2]
    // Background squares are neutral gray. Keep colored artwork and pure black/white details.
    return Math.max(r, g, b) - Math.min(r, g, b) <= 5 && r >= 75 && r <= 215
  }

  const clearCell = (cellX, cellY) => {
    const x0 = cellX * frameW
    const y0 = cellY * frameH
    const x1 = Math.min(canvas.width, x0 + frameW)
    const y1 = Math.min(canvas.height, y0 + frameH)
    const w = x1 - x0
    const h = y1 - y0
    const seen = new Uint8Array(w * h)
    const queue = new Int32Array(w * h)
    let head = 0
    let tail = 0

    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return
      const p = y * w + x
      if (seen[p]) return
      const di = (((y0 + y) * canvas.width) + (x0 + x)) * 4
      if (!isChecker(di)) return
      seen[p] = 1
      queue[tail++] = p
    }

    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }

    while (head < tail) {
      const p = queue[head++]
      const x = p % w
      const y = (p / w) | 0
      const di = (((y0 + y) * canvas.width) + (x0 + x)) * 4
      data[di + 3] = 0
      push(x - 1, y)
      push(x + 1, y)
      push(x, y - 1)
      push(x, y + 1)
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) clearCell(col, row)
  }

  ctx.putImageData(full, 0, 0)
  return canvas
}

for (const [key, manifest] of Object.entries(SPRITE_MANIFESTS)) {
  const image = new Image()
  image.decoding = 'async'
  image.loading = 'eager'
  const src = new URL(manifest.src, document.baseURI).href
  image.onload = () => {
    try {
      renderImages.set(key, removeCheckerboard(image, manifest))
    } catch (error) {
      console.error(`[Pixel-Bound] Sprite preprocessing failed for ${key}`, error)
      renderImages.set(key, image)
    }
  }
  image.onerror = () => console.error(`[Pixel-Bound] Failed to load sprite: ${src}`)
  image.src = src
  sourceImages[key] = image
}

function animatorFor(entity, key) {
  const manifest = SPRITE_MANIFESTS[key]
  const image = renderImages.get(key)
  if (!entity || !manifest || !image) return null
  if (!animators.has(entity)) {
    animators.set(entity, new SpriteAnimator(image, manifest))
    times.set(entity, performance.now())
  }
  return animators.get(entity)
}

function updateAnimator(animator, entity, state, dx, dy, now) {
  const last = times.get(entity) ?? now
  times.set(entity, now)
  const oneShot = ['attack', 'dodge', 'hurt', 'death']
  const locked = oneShot.includes(animator.animName) && !animator.finished
  animator.setDirection(getDirection8(dx, dy))
  if (!locked) animator.play(state)
  animator.update(now - last)
}

export function drawPlayerSprite(ctx, player, engine, now = performance.now()) {
  const moving = Math.hypot(engine?.moveVec?.x || 0, engine?.moveVec?.y || 0) > 0.08
  let state = 'idle'
  if (player.dodgeDuration > 0) state = 'dodge'
  else if (player.hitFlash > 0) state = 'hurt'
  else if (player.shootCooldown > 0 && player.shootCooldown > player.shootInterval * 0.58) state = 'attack'
  else if (moving) state = 'walk'

  const animator = animatorFor(player, 'player')
  if (!animator) return false
  updateAnimator(animator, player, state, player.facing?.x || 0, player.facing?.y || 1, now)

  const bob = moving && state === 'walk' ? Math.sin(now * 0.018) * 1.2 : 0
  animator.draw(ctx, player.x, player.y, { scale: animator.manifest.renderScale || 0.34, bob })
  return true
}

export function drawEnemySprite(ctx, enemy, player, now = performance.now()) {
  const key = enemy.type === 'archer' ? 'archer' : enemy.type
  const animator = animatorFor(enemy, key)
  if (!animator) return false
  const dx = player.x - enemy.x
  const dy = player.y - enemy.y
  const distance = Math.hypot(dx, dy)
  let state = 'walk'
  if (enemy.hitFlash > 0) state = 'hurt'
  else if (enemy.type === 'archer' && enemy.shootCooldown > enemy.shootInterval * 0.72) state = 'attack'
  else if ((enemy.type === 'goblin' || enemy.type === 'skeleton') && distance < enemy.radius + player.radius + 8) state = 'attack'
  updateAnimator(animator, enemy, state, dx, dy, now)

  const bob = state === 'walk' ? Math.sin(now * 0.016 + enemy.x * 0.02) * (enemy.type === 'slime' ? 1.1 : 0.7) : 0
  animator.draw(ctx, enemy.x, enemy.y, { scale: animator.manifest.renderScale || 0.22, bob })
  return true
}
