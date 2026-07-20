import { VIRTUAL_W, VIRTUAL_H } from './engine.js'

const PALETTE = {
  bgTop: '#1b1330',
  bgBottom: '#0d0a1a',
  floorLine: '#2a2050',
  player: '#7ce3ff',
  playerDark: '#2fb6d9',
  slime: '#5fe07a',
  slimeDark: '#289450',
  slimeHit: '#ffffff',
  bullet: '#ffe66d',
  hp: '#ff5c7a',
  particle: '#ffd166',
}

export function render(ctx, engine) {
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H)

  // background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_H)
  grad.addColorStop(0, PALETTE.bgTop)
  grad.addColorStop(1, PALETTE.bgBottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H)

  // floor grid lines for depth
  ctx.strokeStyle = PALETTE.floorLine
  ctx.lineWidth = 1
  for (let x = 0; x < VIRTUAL_W; x += 20) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, VIRTUAL_H)
    ctx.stroke()
  }
  for (let y = 0; y < VIRTUAL_H; y += 20) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(VIRTUAL_W, y)
    ctx.stroke()
  }

  // particles (behind entities)
  for (const pt of engine.particles) {
    const a = Math.max(pt.life / pt.maxLife, 0)
    ctx.globalAlpha = a
    ctx.fillStyle = PALETTE.particle
    ctx.fillRect(Math.round(pt.x) - 1, Math.round(pt.y) - 1, 2, 2)
  }
  ctx.globalAlpha = 1

  // enemies
  for (const e of engine.enemies) {
    drawSlime(ctx, e)
  }

  // bullets
  ctx.fillStyle = PALETTE.bullet
  for (const b of engine.bullets) {
    ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3)
  }

  // player
  drawPlayer(ctx, engine.player)
}

function drawSlime(ctx, e) {
  const r = e.radius
  const squish = e.squish
  ctx.save()
  ctx.translate(Math.round(e.x), Math.round(e.y))
  ctx.scale(1 + squish, 1 - squish)
  ctx.fillStyle = e.hitFlash > 0 ? PALETTE.slimeHit : PALETTE.slime
  ctx.beginPath()
  ctx.ellipse(0, 1, r, r * 0.8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = e.hitFlash > 0 ? PALETTE.slimeHit : PALETTE.slimeDark
  ctx.fillRect(-r * 0.5, -1, 1.5, 1.5)
  ctx.fillRect(r * 0.1, -1, 1.5, 1.5)
  ctx.restore()

  // hp sliver above enemy
  if (e.hp < e.maxHp) {
    const w = r * 2
    ctx.fillStyle = '#000'
    ctx.fillRect(e.x - w / 2, e.y - r - 5, w, 2)
    ctx.fillStyle = PALETTE.hp
    ctx.fillRect(e.x - w / 2, e.y - r - 5, w * (e.hp / e.maxHp), 2)
  }
}

function drawPlayer(ctx, p) {
  ctx.save()
  ctx.translate(Math.round(p.x), Math.round(p.y))

  const flashing = p.invulnerable > 0 && Math.floor(performance.now() / 80) % 2 === 0
  ctx.globalAlpha = flashing ? 0.4 : 1

  // body
  ctx.fillStyle = p.hitFlash > 0 ? '#fff' : PALETTE.player
  ctx.beginPath()
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = p.hitFlash > 0 ? '#fff' : PALETTE.playerDark
  ctx.fillRect(-2, -2, 1.5, 1.5)
  ctx.fillRect(1, -2, 1.5, 1.5)

  // facing/aim indicator
  const fx = p.facing.x, fy = p.facing.y
  ctx.strokeStyle = PALETTE.playerDark
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(fx * p.radius, fy * p.radius)
  ctx.lineTo(fx * (p.radius + 5), fy * (p.radius + 5))
  ctx.stroke()

  ctx.restore()
}
