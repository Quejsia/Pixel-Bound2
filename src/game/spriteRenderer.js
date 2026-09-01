import { SpriteAnimator, SPRITE_MANIFESTS, getDirection8 } from './spriteAnimator.js'

const sourceImages = {}
const renderImages = new Map()
const animators = new WeakMap()
const times = new WeakMap()

// Some supplied enemy sheets are RGB PNGs with a checkerboard baked into the image.
// Player/archer are already transparent. Enemy sheets are cleaned once, after load.
function removeCheckerboard(image, manifest) {
  if (!image?.naturalWidth || !manifest?.frameWidth || !manifest?.frameHeight) return null

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
  const bg = (di) => {
    if (data[di + 3] === 0) return true
    const r = data[di], g = data[di + 1], b = data[di + 2]
    return Math.max(r, g, b) - Math.min(r, g, b) <= 4 && r >= 85 && r <= 215
  }

  for (let fy = 0; fy < rows; fy++) {
    for (let fx = 0; fx < cols; fx++) {
      const x0 = fx * frameW, y0 = fy * frameH
      const x1 = Math.min(canvas.width, x0 + frameW), y1 = Math.min(canvas.height, y0 + frameH)
      const width = x1 - x0, height = y1 - y0
      const seen = new Uint8Array(width * height)
      const queue = new Int32Array(width * height)
      let head = 0, tail = 0
      const push = (x, y) => {
        const lx = x - x0, ly = y - y0
        if (lx < 0 || ly < 0 || lx >= width || ly >= height) return
        const p = ly * width + lx
        if (seen[p]) return
        const di = ((y * canvas.width) + x) * 4
        if (!bg(di)) return
        seen[p] = 1
        queue[tail++] = p
      }
      for (let x = x0; x < x1; x++) { push(x, y0); push(x, y1 - 1) }
      for (let y = y0; y < y1; y++) { push(x0, y); push(x1 - 1, y) }
      while (head < tail) {
        const p = queue[head++]
        const lx = p % width, ly = (p / width) | 0
        const x = x0 + lx, y = y0 + ly
        const di = ((y * canvas.width) + x) * 4
        data[di + 3] = 0
        if (lx > 0) push(x - 1, y)
        if (lx + 1 < width) push(x + 1, y)
        if (ly > 0) push(x, y - 1)
        if (ly + 1 < height) push(x, y + 1)
      }
    }
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
      const processed = ['goblin', 'slime', 'skeleton'].includes(key)
        ? removeCheckerboard(image, manifest)
        : image
      if (processed) renderImages.set(key, processed)
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
  animator.draw(ctx, player.x, player.y, { scale: 0.23 })
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
  animator.draw(ctx, enemy.x, enemy.y + (enemy.bob || 0), { scale: enemy.type === 'slime' ? 0.16 : 0.18 })
  return true
}
