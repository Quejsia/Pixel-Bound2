import { SpriteAnimator, SPRITE_MANIFESTS, getDirection8 } from './spriteAnimator.js'

const images = Object.fromEntries(Object.entries(SPRITE_MANIFESTS).map(([key, manifest]) => {
  const image = new Image()
  image.decoding = 'async'
  image.src = manifest.src
  return [key, image]
}))
const animators = new WeakMap()
const times = new WeakMap()

function animatorFor(entity, key) {
  const manifest = SPRITE_MANIFESTS[key]
  const image = images[key]
  if (!entity || !manifest || !image?.complete || !image.naturalWidth) return null
  if (!animators.has(entity)) { animators.set(entity, new SpriteAnimator(image, manifest)); times.set(entity, performance.now()) }
  return animators.get(entity)
}

function updateAnimator(animator, entity, state, dx, dy, now) {
  const last = times.get(entity) ?? now
  times.set(entity, now)
  const oneShot = ['attack','dodge','hurt','death']
  const locked = oneShot.includes(animator.animName) && !animator.finished
  animator.setDirection(getDirection8(dx, dy))
  if (!locked) animator.play(state)
  animator.update(now-last)
}

export function drawPlayerSprite(ctx, player, engine, now=performance.now()) {
  const moving = Math.hypot(engine?.moveVec?.x || 0, engine?.moveVec?.y || 0) > 0.08
  let state='idle'
  if (player.dodgeDuration>0) state='dodge'
  else if (player.hitFlash>0) state='hurt'
  else if (player.shootCooldown>0 && player.shootCooldown>player.shootInterval*0.58) state='attack'
  else if (moving) state='walk'
  const animator=animatorFor(player,'player')
  if(!animator)return false
  updateAnimator(animator,player,state,player.facing.x,player.facing.y,now)
  animator.draw(ctx,player.x,player.y,{scale:0.23})
  return true
}

export function drawEnemySprite(ctx, enemy, player, now=performance.now()) {
  const key=enemy.type==='archer'?'archer':enemy.type
  const animator=animatorFor(enemy,key)
  if(!animator)return false
  const dx=player.x-enemy.x,dy=player.y-enemy.y,distance=Math.hypot(dx,dy)
  let state='walk'
  if(enemy.hitFlash>0)state='hurt'
  else if(enemy.type==='archer' && enemy.shootCooldown>enemy.shootInterval*0.72)state='attack'
  else if((enemy.type==='goblin'||enemy.type==='skeleton') && distance<enemy.radius+player.radius+8)state='attack'
  updateAnimator(animator,enemy,state,dx,dy,now)
  animator.draw(ctx,enemy.x,enemy.y+(enemy.bob||0),{scale:enemy.type==='slime'?0.20:0.23})
  return true
}
