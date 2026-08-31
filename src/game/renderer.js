import { VIRTUAL_W, VIRTUAL_H, WORLD_W, WORLD_H } from './engine.js'
import { PHASE1_5_VFX_ATLAS } from './phase1_5_vfx_atlas.js'
import { drawPlayerSprite, drawEnemySprite } from './spriteRenderer.js'

const PALETTE = {
  bgTop: '#1b1330', bgBottom: '#0d0a1a', floorLine: '#2a2050', obstacle: '#3a3450', obstacleDark: '#26213a',
  xpOrb: '#7ce3ff', goldCoin: '#ffd166', bullet: '#ffe66d', enemyArrow: '#ff8866', hp: '#ff5c7a', particle: '#ffd166',
  bossBody: '#c23b4f', bossDark: '#7a1f2c', worldBounds: 'rgba(124, 227, 255, 0.15)',
}
const VFX_CELL = 32
const atlasImage = new Image()
atlasImage.src = PHASE1_5_VFX_ATLAS
const VFX_INDEX = { burn: 0, freeze: 1, stun: 2, poison: 3, hit: 4, crit: 5, death: 6, bleed: 7 }
const PROJECTILE_CELL = { pistol: 4, shotgun: 5, rifle: 2, bow: 7, staff: 1 }

export function render(ctx, engine) {
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H)

  const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_H)
  grad.addColorStop(0, PALETTE.bgTop)
  grad.addColorStop(1, PALETTE.bgBottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H)

  const camX = Math.round(engine.camera?.x || 0)
  const camY = Math.round(engine.camera?.y || 0)
  ctx.save()
  ctx.translate(-camX, -camY)

  ctx.strokeStyle = PALETTE.floorLine
  ctx.lineWidth = 1
  const startX = Math.floor(camX / 20) * 20
  const startY = Math.floor(camY / 20) * 20
  for (let x = startX; x <= camX + VIRTUAL_W + 20; x += 20) { ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, camY + VIRTUAL_H + 20); ctx.stroke() }
  for (let y = startY; y <= camY + VIRTUAL_H + 20; y += 20) { ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(camX + VIRTUAL_W + 20, y); ctx.stroke() }

  ctx.strokeStyle = PALETTE.worldBounds
  ctx.lineWidth = 2
  ctx.strokeRect(0, 0, WORLD_W, WORLD_H)

  for (const obs of engine.obstacles || []) {
    ctx.fillStyle = PALETTE.obstacleDark
    ctx.fillRect(obs.x - 1, obs.y - 1, obs.w + 2, obs.h + 2)
    ctx.fillStyle = PALETTE.obstacle
    ctx.fillRect(obs.x, obs.y, obs.w, obs.h)
  }

  for (const pt of engine.particles || []) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife)
    ctx.fillStyle = PALETTE.particle
    ctx.fillRect(Math.round(pt.x) - 1, Math.round(pt.y) - 1, 2, 2)
  }
  ctx.globalAlpha = 1

  for (const pk of engine.pickups || []) drawPickup(ctx, pk)

  for (const e of engine.enemies || []) {
    if (e.type === 'boss') drawBoss(ctx, e)
    else if (!drawEnemySprite(ctx, e, engine.player, performance.now())) drawFallbackEnemy(ctx, e)
  }

  for (const b of engine.bullets || []) drawProjectileFx(ctx, b, engine.player.weapon)
  ctx.fillStyle = PALETTE.bullet
  for (const b of engine.bullets || []) ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3)

  ctx.fillStyle = PALETTE.enemyArrow
  for (const b of engine.enemyBullets || []) {
    ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(Math.atan2(b.vy, b.vx))
    ctx.fillRect(-3, -0.7, 6, 1.4); ctx.restore()
  }

  if (!drawPlayerSprite(ctx, engine.player, engine, performance.now())) drawFallbackPlayer(ctx, engine.player)
  drawPhase15Vfx(ctx, engine)
  ctx.restore()
}

function drawAtlasCell(ctx, cell, x, y, scale = 1, alpha = 1, rotation = 0) {
  if (!atlasImage.complete || !atlasImage.naturalWidth) return
  const size = VFX_CELL * scale
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(Math.round(x), Math.round(y))
  if (rotation) ctx.rotate(rotation)
  ctx.drawImage(atlasImage, cell * VFX_CELL, 0, VFX_CELL, VFX_CELL, -size / 2, -size / 2, size, size)
  ctx.restore()
}
function drawProjectileFx(ctx, bullet, weapon) { drawAtlasCell(ctx, PROJECTILE_CELL[weapon] ?? 4, bullet.x, bullet.y, 0.28, 0.75, Math.atan2(bullet.vy, bullet.vx)) }
function drawPhase15Vfx(ctx, engine) {
  if (!engine.__phase15VfxEnabled || !engine.__phase15Vfx) return
  for (const fx of engine.__phase15Vfx) {
    const cell = VFX_INDEX[fx.type]
    if (cell === undefined) continue
    const progress = Math.max(0, fx.life / fx.maxLife)
    drawAtlasCell(ctx, cell, fx.x, fx.y, fx.scale * (1 + Math.sin((1 - progress) * Math.PI) * 0.12), Math.min(1, progress * 1.8), fx.rotation)
  }
}
function drawPickup(ctx, pk) {
  const bob = Math.sin((performance.now() - pk.bornAt) / 1000 * 4) * 1
  const x = Math.round(pk.x), y = Math.round(pk.y + bob)
  if (pk.kind === 'xp') { ctx.fillStyle = PALETTE.xpOrb; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill() }
  else if (pk.kind === 'gold') { ctx.fillStyle = PALETTE.goldCoin; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill() }
  else if (pk.kind === 'item') { ctx.fillStyle = pk.value.rarity === 'epic' ? '#e0894d' : pk.value.rarity === 'rare' ? '#7ca8ff' : pk.value.rarity === 'uncommon' ? '#5fe07a' : '#c9c9c9'; ctx.fillRect(x - 3, y - 3, 6, 6) }
}
function drawBoss(ctx, e) {
  const r = e.radius
  if (e.state === 'telegraph') {
    ctx.save(); ctx.globalAlpha = 0.75; ctx.strokeStyle = e.telegraphType === 'charge' ? '#ff5c7a' : '#c77dff'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(e.x, e.y, (r + 6) * (1 + Math.sin(performance.now() / 60) * 0.15), 0, Math.PI * 2); ctx.stroke(); ctx.restore()
  }
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y + (e.bob || 0))); ctx.scale(e.facing || 1, 1)
  ctx.fillStyle = e.hitFlash > 0 ? '#fff' : PALETTE.bossBody; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = e.hitFlash > 0 ? '#fff' : PALETTE.bossDark
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.1, -r * 0.9); ctx.lineTo(s * r * 0.5, -r * 1.6); ctx.lineTo(s * r * 0.75, -r * 0.7); ctx.fill() }
  ctx.fillStyle = '#ffd166'; ctx.fillRect(-r * 0.28, -r * 0.15, 2, 2); ctx.fillRect(r * 0.14, -r * 0.15, 2, 2)
  ctx.restore(); drawEnemyHp(ctx, e, r, 10)
}
function drawEnemyHp(ctx, e, r, offset) { if (e.hp < e.maxHp) { const w = Math.max(10, r * 2.4); ctx.fillStyle = '#000'; ctx.fillRect(e.x - w / 2, e.y - r - offset, w, 2); ctx.fillStyle = PALETTE.hp; ctx.fillRect(e.x - w / 2, e.y - r - offset, w * Math.max(0, e.hp / e.maxHp), 2) } }
function drawFallbackEnemy(ctx, e) { ctx.fillStyle = e.type === 'slime' ? '#5fe07a' : e.type === 'goblin' ? '#c9a15a' : e.type === 'archer' ? '#8a6fb8' : '#e8e4d8'; ctx.beginPath(); ctx.arc(Math.round(e.x), Math.round(e.y), e.radius, 0, Math.PI * 2); ctx.fill(); drawEnemyHp(ctx, e, e.radius, 6) }
function drawFallbackPlayer(ctx, p) { ctx.fillStyle = p.hitFlash > 0 ? '#fff' : '#7ce3ff'; ctx.beginPath(); ctx.arc(Math.round(p.x), Math.round(p.y), p.radius, 0, Math.PI * 2); ctx.fill() }
