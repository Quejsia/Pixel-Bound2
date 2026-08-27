import { VIRTUAL_W, VIRTUAL_H } from './engine.js'
import { PHASE1_5_VFX_ATLAS } from './phase1_5_vfx_atlas.js'

const PALETTE = {
  bgTop: '#1b1330', bgBottom: '#0d0a1a', floorLine: '#2a2050', player: '#7ce3ff', playerDark: '#2fb6d9',
  slime: '#5fe07a', slimeDark: '#289450', slimeHit: '#ffffff', goblin: '#c9a15a', goblinDark: '#7a5a2e',
  goblinWeapon: '#4a4a4a', skeleton: '#e8e4d8', skeletonDark: '#a8a396', archer: '#8a6fb8', archerDark: '#5c4a80',
  archerBow: '#3a2f1c', enemyArrow: '#ff8866', obstacle: '#3a3450', obstacleDark: '#26213a', xpOrb: '#7ce3ff',
  goldCoin: '#ffd166', itemCommon: '#c9c9c9', itemUncommon: '#5fe07a', itemRare: '#7ca8ff', itemEpic: '#e0894d',
  bullet: '#ffe66d', hp: '#ff5c7a', particle: '#ffd166',
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

  ctx.strokeStyle = PALETTE.floorLine
  ctx.lineWidth = 1
  for (let x = 0; x < VIRTUAL_W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIRTUAL_H); ctx.stroke() }
  for (let y = 0; y < VIRTUAL_H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIRTUAL_W, y); ctx.stroke() }

  for (const obs of engine.obstacles) {
    ctx.fillStyle = PALETTE.obstacleDark
    ctx.fillRect(obs.x - 1, obs.y - 1, obs.w + 2, obs.h + 2)
    ctx.fillStyle = PALETTE.obstacle
    ctx.fillRect(obs.x, obs.y, obs.w, obs.h)
  }

  for (const pt of engine.particles) {
    const a = Math.max(pt.life / pt.maxLife, 0)
    ctx.globalAlpha = a
    ctx.fillStyle = PALETTE.particle
    ctx.fillRect(Math.round(pt.x) - 1, Math.round(pt.y) - 1, 2, 2)
  }
  ctx.globalAlpha = 1

  for (const pk of engine.pickups) drawPickup(ctx, pk)

  for (const e of engine.enemies) {
    if (e.type === 'goblin') drawGoblin(ctx, e)
    else if (e.type === 'skeleton') drawSkeleton(ctx, e)
    else if (e.type === 'archer') drawArcher(ctx, e)
    else drawSlime(ctx, e)
  }

  for (const b of engine.bullets) {
    drawProjectileFx(ctx, b, engine.player.weapon)
  }

  ctx.fillStyle = PALETTE.bullet
  for (const b of engine.bullets) ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3)

  ctx.fillStyle = PALETTE.enemyArrow
  for (const b of engine.enemyBullets) {
    ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(Math.atan2(b.vy, b.vx))
    ctx.fillRect(-2.5, -0.75, 5, 1.5); ctx.restore()
  }

  drawPlayer(ctx, engine.player)

  if (engine._novaFx) {
    const fx = engine._novaFx
    const t = 1 - fx.life / fx.maxLife
    ctx.save(); ctx.globalAlpha = 1 - t; ctx.strokeStyle = '#7ce3ff'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.radius * t, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
  }

  drawPhase15Vfx(ctx, engine)
}

function drawAtlasCell(ctx, cell, x, y, scale = 1, alpha = 1, rotation = 0) {
  if (!atlasImage.complete || !atlasImage.naturalWidth) return
  const sx = cell * VFX_CELL
  const size = VFX_CELL * scale
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(Math.round(x), Math.round(y))
  if (rotation) ctx.rotate(rotation)
  ctx.drawImage(atlasImage, sx, 0, VFX_CELL, VFX_CELL, -size / 2, -size / 2, size, size)
  ctx.restore()
}

function drawProjectileFx(ctx, bullet, weapon) {
  const cell = PROJECTILE_CELL[weapon] ?? 4
  const angle = Math.atan2(bullet.vy, bullet.vx)
  drawAtlasCell(ctx, cell, bullet.x, bullet.y, 0.28, 0.75, angle)
}

function drawPhase15Vfx(ctx, engine) {
  if (!engine.__phase15VfxEnabled || !engine.__phase15Vfx) return
  for (const fx of engine.__phase15Vfx) {
    const cell = VFX_INDEX[fx.type]
    if (cell === undefined) continue
    const progress = Math.max(0, fx.life / fx.maxLife)
    const pulse = 1 + Math.sin((1 - progress) * Math.PI) * 0.12
    drawAtlasCell(ctx, cell, fx.x, fx.y, fx.scale * pulse, Math.min(1, progress * 1.8), fx.rotation)
  }
}

function drawSlime(ctx, e) {
  const r = e.radius, squish = e.squish
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(1 + squish, 1 - squish)
  ctx.fillStyle = e.hitFlash > 0 ? PALETTE.slimeHit : PALETTE.slime
  ctx.beginPath(); ctx.ellipse(0, 1, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = e.hitFlash > 0 ? PALETTE.slimeHit : PALETTE.slimeDark
  ctx.fillRect(-r * 0.5, -1, 1.5, 1.5); ctx.fillRect(r * 0.1, -1, 1.5, 1.5); ctx.restore()
  drawEnemyHp(ctx, e, r, 5)
}

function drawPickup(ctx, pk) {
  const t = (performance.now() - pk.bornAt) / 1000, bobY = Math.sin(t * 4) * 1, x = Math.round(pk.x), y = Math.round(pk.y + bobY)
  if (pk.kind === 'xp') { ctx.fillStyle = PALETTE.xpOrb; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill() }
  else if (pk.kind === 'gold') { ctx.fillStyle = PALETTE.goldCoin; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill() }
  else if (pk.kind === 'item') {
    const color = pk.value.rarity === 'epic' ? PALETTE.itemEpic : pk.value.rarity === 'rare' ? PALETTE.itemRare : pk.value.rarity === 'uncommon' ? PALETTE.itemUncommon : PALETTE.itemCommon
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = color; ctx.fillRect(-3, -3, 6, 6); ctx.restore()
    if (pk.value.rarity !== 'common') { ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1 }
  }
}

function drawGoblin(ctx, e) {
  const r = e.radius, bodyColor = e.hitFlash > 0 ? PALETTE.slimeHit : PALETTE.goblin, darkColor = e.hitFlash > 0 ? PALETTE.slimeHit : PALETTE.goblinDark
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y + e.bob)); ctx.scale(e.facing, 1)
  ctx.fillStyle = bodyColor; ctx.fillRect(-r * 0.55, -r * 0.6, r * 1.1, r * 1.2)
  ctx.beginPath(); ctx.arc(0, -r * 0.75, r * 0.55, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = darkColor; ctx.beginPath(); ctx.moveTo(r * 0.35, -r); ctx.lineTo(r * 0.75, -r * 1.15); ctx.lineTo(r * 0.4, -r * 0.7); ctx.fill()
  ctx.fillStyle = '#1a0f00'; ctx.fillRect(r * 0.05, -r * 0.85, 1.2, 1.2)
  ctx.strokeStyle = PALETTE.goblinWeapon; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.2); ctx.lineTo(r * 1.3, -r * 0.35); ctx.stroke(); ctx.restore()
  drawEnemyHp(ctx, e, r, 6)
}

function drawSkeleton(ctx, e) {
  const r = e.radius, bodyColor = e.hitFlash > 0 ? PALETTE.slimeHit : PALETTE.skeleton, darkColor = e.hitFlash > 0 ? PALETTE.slimeHit : PALETTE.skeletonDark
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y + e.bob)); ctx.scale(e.facing, 1)
  ctx.fillStyle = bodyColor; ctx.fillRect(-r * 0.5, -r * 0.7, r, r * 1.4); ctx.strokeStyle = darkColor; ctx.lineWidth = 0.8
  for (let i = -2; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.45, i * r * 0.3); ctx.lineTo(r * 0.45, i * r * 0.3); ctx.stroke() }
  ctx.fillStyle = bodyColor; ctx.beginPath(); ctx.arc(0, -r * 0.95, r * 0.5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a1520'; ctx.fillRect(-r * 0.28, -r, r * 0.2, r * 0.2); ctx.fillRect(r * 0.08, -r, r * 0.2, r * 0.2)
  ctx.strokeStyle = darkColor; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(r * 0.5, 0); ctx.lineTo(r * 1.4, -r * 0.15); ctx.stroke(); ctx.restore()
  drawEnemyHp(ctx, e, r, 7)
}

function drawArcher(ctx, e) {
  const r = e.radius, bodyColor = e.hitFlash > 0 ? PALETTE.slimeHit : PALETTE.archer, darkColor = e.hitFlash > 0 ? PALETTE.slimeHit : PALETTE.archerDark
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.facing, 1)
  ctx.fillStyle = bodyColor; ctx.fillRect(-r * 0.5, -r * 0.5, r, r); ctx.beginPath(); ctx.arc(0, -r * 0.65, r * 0.5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#0a0714'; ctx.fillRect(-r * 0.2, -r * 0.7, r * 0.4, r * 0.25)
  ctx.strokeStyle = PALETTE.archerBow; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(r * 0.6, 0, r * 0.6, -Math.PI * 0.4, Math.PI * 0.4); ctx.stroke(); ctx.restore()
  drawEnemyHp(ctx, e, r, 6)
}

function drawEnemyHp(ctx, e, r, offset) {
  if (e.hp < e.maxHp) {
    const w = r * 2
    ctx.fillStyle = '#000'; ctx.fillRect(e.x - w / 2, e.y - r - offset, w, 2)
    ctx.fillStyle = PALETTE.hp; ctx.fillRect(e.x - w / 2, e.y - r - offset, w * Math.max(0, e.hp / e.maxHp), 2)
  }
}

function drawPlayer(ctx, p) {
  ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y))
  const flashing = p.invulnerable > 0 && Math.floor(performance.now() / 80) % 2 === 0
  ctx.globalAlpha = flashing ? 0.4 : 1
  ctx.fillStyle = p.hitFlash > 0 ? '#fff' : PALETTE.player
  ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = p.hitFlash > 0 ? '#fff' : PALETTE.playerDark; ctx.fillRect(-2, -2, 1.5, 1.5); ctx.fillRect(1, -2, 1.5, 1.5)
  const fx = p.facing.x, fy = p.facing.y
  ctx.strokeStyle = PALETTE.playerDark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fx * p.radius, fy * p.radius); ctx.lineTo(fx * (p.radius + 5), fy * (p.radius + 5)); ctx.stroke()
  ctx.restore()
}
