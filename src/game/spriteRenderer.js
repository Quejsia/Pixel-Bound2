import { SpriteAnimator, SPRITE_MANIFESTS, getDirection8, preloadSprites, getOrCreateSpriteAnimator } from './spriteAnimator.js'

const animators = new WeakMap()
const animatorPromises = new WeakMap()
const lastTimes = new WeakMap()

// Begin loading all sprite atlases as soon as the renderer module is evaluated.
// The old vector renderer remains available as a temporary fallback while images load.
preloadSprites().catch((error) => console.error('[Pixel-Bound] Sprite preload failed', error))

function getAnimator(entity, key) {
  return animators.get(entity) || null
}

function requestAnimator(entity, key) {
  if (animators.has(entity)) return
  if (animatorPromises.has(entity)) return

  const promise = getOrCreateSpriteAnimator(entity, key)
    .then((animator) => {
      if (animator) {
        animators.set(entity, animator)
        lastTimes.set(entity, performance.now())
      }
      animatorPromises.delete(entity)
      return animator
    })
    .catch((error) => {
      animatorPromises.delete(entity)
      console.error(`[Pixel-Bound] Failed to create ${key} animator`, error)
      return null
    })

  animatorPromises.set(entity, promise)
}

function updateAnimator(animator, entity, state, dx, dy, now) {
  const previous = lastTimes.get(entity) ?? now
  lastTimes.set(entity, now)

  const direction = getDirection8(dx, dy)
  if (direction) animator.setDirection(direction)

  const oneShot = state === 'attack' || state === 'dodge' || state === 'hurt' || state === 'death'
  if (!(oneShot && animator.state === state && !animator.finished)) animator.play(state)
  animator.update(now - previous)
}

export function drawPlayerSprite(ctx, player, engine, now = performance.now()) {
  const key = 'player'
  const animator = getAnimator(player, key)
  if (!animator) {
    requestAnimator(player, key)
    return false
  }

  const moving = Math.hypot(engine?.moveVec?.x || 0, engine?.moveVec?.y || 0) > 0.08
  let state = 'idle'
  if (player.dodgeDuration > 0) state = 'dodge'
  else if (player.hitFlash > 0) state = 'hurt'
  else if (player.shootCooldown > 0 && player.shootInterval > 0 && player.shootCooldown > player.shootInterval * 0.55) state = 'attack'
  else if (moving) state = 'walk'

  updateAnimator(animator, player, state, player.facing?.x || 0, player.facing?.y || 1, now)

  const flashing = player.invulnerable > 0 && Math.floor(now / 80) % 2 === 0
  const bob = moving && state === 'walk' ? Math.sin(now * 0.018) * 0.6 : 0
  animator.draw(ctx, player.x, player.y, { bob, alpha: flashing ? 0.45 : 1 })
  return true
}

export function drawEnemySprite(ctx, enemy, player, now = performance.now()) {
  const key = enemy.type === 'archer' ? 'archer' : enemy.type
  if (!SPRITE_MANIFESTS[key]) return false

  const animator = getAnimator(enemy, key)
  if (!animator) {
    requestAnimator(enemy, key)
    return false
  }

  const dx = player.x - enemy.x
  const dy = player.y - enemy.y
  const distance = Math.hypot(dx, dy)

  let state = 'idle'
  if (enemy.hitFlash > 0) state = 'hurt'
  else if (enemy.type === 'archer' && enemy.shootCooldown > enemy.shootInterval * 0.72) state = 'attack'
  else if ((enemy.type === 'goblin' || enemy.type === 'skeleton') && distance < enemy.radius + player.radius + 8) state = 'attack'
  else if (distance > 0.5) state = 'walk'

  updateAnimator(animator, enemy, state, dx, dy, now)

  const bob = animator.state === 'walk'
    ? Math.sin(now * 0.014 + enemy.x * 0.02) * (enemy.type === 'slime' ? 0.7 : 0.35)
    : 0

  animator.draw(ctx, enemy.x, enemy.y, { bob })
  return true
}

export { SpriteAnimator }
