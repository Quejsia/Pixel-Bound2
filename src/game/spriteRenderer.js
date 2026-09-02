import { SpriteAnimator, SPRITE_MANIFESTS, getDirection8 } from './spriteAnimator.js'

const renderSheets = new Map()
const loadPromises = new Map()
const animators = new WeakMap()
const lastTimes = new WeakMap()

function colorDistance(a, b) {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
}

function isNeutralGray(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b) <= 8
}

function cleanCell(imageData, cellX, cellY, frameW, frameH) {
  const { data, width } = imageData
  const x0 = cellX * frameW
  const y0 = cellY * frameH

  const cornerOffsets = [
    ((y0 * width) + x0) * 4,
    ((y0 * width) + (x0 + frameW - 1)) * 4,
    (((y0 + frameH - 1) * width) + x0) * 4,
    (((y0 + frameH - 1) * width) + (x0 + frameW - 1)) * 4,
  ]
  const samples = cornerOffsets.map((i) => ({ r: data[i], g: data[i + 1], b: data[i + 2] }))

  const isBackground = (x, y) => {
    const i = (((y0 + y) * width) + (x0 + x)) * 4
    if (data[i + 3] === 0) return true
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (!isNeutralGray(r, g, b)) return false
    return samples.some((sample) => colorDistance({ r, g, b }, sample) <= 18)
  }

  // Remove only background that is connected to the edge of the frame.
  // Internal gray pixels remain intact, which is important for skeleton bones
  // and dark outlines.
  const size = frameW * frameH
  const seen = new Uint8Array(size)
  const queue = new Int32Array(size)
  let head = 0
  let tail = 0

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= frameW || y >= frameH) return
    const p = y * frameW + x
    if (seen[p] || !isBackground(x, y)) return
    seen[p] = 1
    queue[tail++] = p
  }

  for (let x = 0; x < frameW; x += 1) {
    push(x, 0)
    push(x, frameH - 1)
  }
  for (let y = 1; y < frameH - 1; y += 1) {
    push(0, y)
    push(frameW - 1, y)
  }

  while (head < tail) {
    const p = queue[head++]
    const x = p % frameW
    const y = (p / frameW) | 0
    const i = (((y0 + y) * width) + (x0 + x)) * 4
    data[i + 3] = 0
    push(x - 1, y)
    push(x + 1, y)
    push(x, y - 1)
    push(x, y + 1)
  }
}

function cleanAtlas(image, manifest) {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return image

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const cols = Math.floor(canvas.width / manifest.frameWidth)
  const rows = Math.floor(canvas.height / manifest.frameHeight)

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cleanCell(imageData, col, row, manifest.frameWidth, manifest.frameHeight)
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function loadSheet(key) {
  if (renderSheets.has(key)) return Promise.resolve(renderSheets.get(key))
  if (loadPromises.has(key)) return loadPromises.get(key)

  const manifest = SPRITE_MANIFESTS[key]
  const promise = new Promise((resolve) => {
    if (!manifest) {
      resolve(null)
      return
    }

    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      try {
        // Keep native 1536x1536 dimensions. Every logical frame remains a
        // 192x192 cell and is selected at draw time, avoiding dozens of large
        // per-frame canvases on low-end phones.
        const cleaned = cleanAtlas(image, manifest)
        renderSheets.set(key, cleaned)
        resolve(cleaned)
      } catch (error) {
        console.error(`[Pixel-Bound] Sprite preprocessing failed for ${key}`, error)
        renderSheets.set(key, image)
        resolve(image)
      }
    }
    image.onerror = () => {
      console.error(`[Pixel-Bound] Failed to load sprite sheet: ${manifest.src}`)
      resolve(null)
    }
    image.src = new URL(manifest.src, document.baseURI).href
  })

  loadPromises.set(key, promise)
  return promise
}

// Start loading all currently-used sheets as soon as this module is imported.
for (const key of Object.keys(SPRITE_MANIFESTS)) loadSheet(key)

function getAnimator(entity, key) {
  const manifest = SPRITE_MANIFESTS[key]
  const image = renderSheets.get(key)
  if (!entity || !manifest || !image) return null

  let animator = animators.get(entity)
  if (!animator || animator.image !== image) {
    animator = new SpriteAnimator(image, manifest)
    animators.set(entity, animator)
    lastTimes.set(entity, performance.now())
  }
  return animator
}

function tickAnimator(animator, entity, state, dx, dy, now) {
  const previous = lastTimes.get(entity) ?? now
  lastTimes.set(entity, now)

  const direction = getDirection8(dx, dy)
  if (direction) animator.setDirection(direction)

  const oneShot = state === 'attack' || state === 'dodge' || state === 'hurt' || state === 'death'
  if (!(oneShot && animator.state === state && !animator.finished)) animator.play(state)
  animator.update(now - previous)
}

export function drawPlayerSprite(ctx, player, engine, now = performance.now()) {
  const animator = getAnimator(player, 'player')
  if (!animator) return false

  const moving = Math.hypot(engine?.moveVec?.x || 0, engine?.moveVec?.y || 0) > 0.08
  let state = 'idle'
  if (player.dodgeDuration > 0) state = 'dodge'
  else if (player.hitFlash > 0) state = 'hurt'
  else if (player.shootCooldown > 0 && player.shootCooldown > player.shootInterval * 0.55) state = 'attack'
  else if (moving) state = 'walk'

  tickAnimator(animator, player, state, player.facing?.x || 0, player.facing?.y || 1, now)

  const flashing = player.invulnerable > 0 && Math.floor(now / 80) % 2 === 0
  animator.draw(ctx, player.x, player.y, {
    scale: animator.manifest.renderScale || 0.42,
    bob: moving && state === 'walk' ? Math.sin(now * 0.018) * 0.8 : 0,
    alpha: flashing ? 0.4 : 1,
  })
  return true
}

export function drawEnemySprite(ctx, enemy, player, now = performance.now()) {
  const key = enemy.type === 'archer' ? 'archer' : enemy.type
  const animator = getAnimator(enemy, key)
  if (!animator) return false

  const dx = player.x - enemy.x
  const dy = player.y - enemy.y
  const distance = Math.hypot(dx, dy)

  let state = 'idle'
  if (enemy.hitFlash > 0) state = 'hurt'
  else if (enemy.type === 'archer' && enemy.shootCooldown > enemy.shootInterval * 0.72) state = 'attack'
  else if ((enemy.type === 'goblin' || enemy.type === 'skeleton') && distance < enemy.radius + player.radius + 8) state = 'attack'
  else if (distance > 0.5) state = 'walk'

  tickAnimator(animator, enemy, state, dx, dy, now)

  const bob = animator.state === 'walk'
    ? Math.sin(now * 0.014 + enemy.x * 0.02) * (enemy.type === 'slime' ? 0.7 : 0.35)
    : 0

  animator.draw(ctx, enemy.x, enemy.y, {
    scale: animator.manifest.renderScale || 0.30,
    bob,
  })
  return true
}

export function preloadSprites() {
  return Promise.all(Object.keys(SPRITE_MANIFESTS).map(loadSheet))
}

export function getSpriteLoadState() {
  const result = {}
  for (const key of Object.keys(SPRITE_MANIFESTS)) {
    result[key] = renderSheets.has(key) ? 'ready' : loadPromises.has(key) ? 'loading' : 'idle'
  }
  return result
}
