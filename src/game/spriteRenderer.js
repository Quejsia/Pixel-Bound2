import { SpriteAnimator, SPRITE_MANIFESTS, getDirection8 } from './spriteAnimator.js'

const images = Object.fromEntries(Object.entries(SPRITE_MANIFESTS).map(([key, manifest]) => {
  const image = new Image()
  image.decoding = 'async'
  image.src = manifest.src
  return [key, image]
}))

const animatorByEntity = new WeakMap()
const lastSeen = new WeakMap()

function getAnimator(entity, key) {
  const manifest = SPRITE_MANIFESTS[key]
  const image = images[key]
  if (!manifest || !image?.complete || !image.naturalWidth || !entity) return null
  let animator = animatorByEntity.get(entity)
  if (!animator) {
    animator = new SpriteAnimator(image, manifest)
    animatorByEntity.set(entity, animator)
    lastSeen.set(entity, performance.now())
  }
  return animator
}

function updateAnimator(animator, entity, state, dx, dy, now) {
  const previousTime = lastSeen.get(entity) ?? now
  lastSeen.set(entity, now)
  const currentState = animator.animName
  const oneShot = ['attack', 'dodge', 'hurt', 'death']
  const locked = oneShot.includes(currentState) && !animator.finished
  if (!locked || currentState === state) {
    animator.setDirection(getDirection8(dx, dy))
    if (!locked || currentState !== state) animator.play(state, { restart: currentState !== state })
  }
  animator.update(now - previousTime)
}

export function drawPlayerSprite(ctx, p, engine, now = performance.now()) {
  const move = engine?.moveVec || { x: 0, y: 0 }
  const moving = Math.hypot(move.x, move.y) > 0.08
  let state = 'idle'
  if (p.dodgeDuration > 0) state = 'dodge'
  else if (p.hitFlash > 0) state = 'hurt'
  else if (p.shootCooldown > 0 && p.shootCooldown > p.shootInterval * 0.58) state = 'attack'
  else if (moving) state = 'walk'

  const animator = getAnimator(p, 'player')
  if (!animator) return false
  updateAnimator(animator, p, state, p.facing.x, p.facing.y, now)
  animator.draw(ctx, p.x, p.y, { scale: 0.23 })
  return true
}

export function drawEnemySprite(ctx, e, p, now = performance.now()) {
  const key = e.type === 'archer' ? 'archer' : e.type
  const animator = getAnimator(e, key)
  if (!animator) return false

  const dx = p.x - e.x
  const dy = p.y - e.y
  const distance = Math.hypot(dx, dy)
  let state = 'walk'
  if (e.hitFlash > 0) state = 'hurt'
  else if (e.type === 'archer' && e.shootCooldown > e.shootInterval * 0.72) state = 'attack'
  else if (e.type === 'skeleton' && distance < e.radius + p.radius + 8) state = 'attack'
  else if (e.type === 'goblin' && distance < e.radius + p.radius + 7) state = 'attack'
  else if (e.type === 'slime' && Math.abs(e.squish || 0) > 0.13) state = 'attack'

  updateAnimator(animator, e, state, dx, dy, now)
  animator.draw(ctx, e.x, e.y + (e.bob || 0), { scale: e.type === 'slime' ? 0.20 : 0.23 })
  return true
}
