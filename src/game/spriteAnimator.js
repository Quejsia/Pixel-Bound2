// Pixel-Bound sprite animation core.
// 8-directional, 8x8 sheets, 128x128 frames, rendered with nearest-neighbor sampling.
export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function getDirection8(dx, dy) {
  if (Math.abs(dx) + Math.abs(dy) < 0.001) return null
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const idx = Math.round(((angle + 360) % 360) / 45) % 8
  return ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][idx]
}

function clip({ mode = 'directional', rows = [0], row = 0, frameCount, fps = 8, loop = true }) {
  return { mode, rows, row, frameCount: frameCount ?? rows.length, fps, loop }
}

export const SPRITE_MANIFESTS = {
  player: {
    src: '/sprites/player.png', frameWidth: 128, frameHeight: 128, columns: 8, rows: 8,
    animations: {
      idle: clip({ rows: [0], fps: 4 }), walk: clip({ rows: [1], fps: 8 }), attack: clip({ rows: [2], fps: 10, loop: false }),
      dodge: clip({ rows: [3, 4], fps: 10, loop: false }), hurt: clip({ rows: [5, 6], fps: 8, loop: false }),
      death: clip({ mode: 'sequential', row: 7, frameCount: 8, fps: 9, loop: false }),
    },
  },
  playerSwordsman: {
    src: '/sprites/player_swordsman.png', frameWidth: 128, frameHeight: 128, columns: 8, rows: 8,
    animations: {
      idle: clip({ rows: [0], fps: 4 }), walk: clip({ rows: [1, 2], fps: 8 }), attack: clip({ rows: [3], fps: 10, loop: false }),
      block: clip({ rows: [4], fps: 7, loop: false }), hurt: clip({ rows: [5, 6], fps: 8, loop: false }), death: clip({ mode: 'sequential', row: 7, frameCount: 8, fps: 9, loop: false }),
    },
  },
  goblin: {
    src: '/sprites/goblin.png', frameWidth: 128, frameHeight: 128, columns: 8, rows: 8,
    animations: {
      idle: clip({ rows: [0], fps: 4 }), walk: clip({ rows: [1, 2], fps: 9 }), attack: clip({ rows: [3], fps: 10, loop: false }),
      hurt: clip({ rows: [6], fps: 8, loop: false }), death: clip({ mode: 'sequential', row: 7, frameCount: 8, fps: 9, loop: false }),
    },
  },
  slime: {
    src: '/sprites/slime.png', frameWidth: 128, frameHeight: 128, columns: 8, rows: 8,
    animations: {
      idle: clip({ rows: [0], fps: 4 }), walk: clip({ rows: [1, 2], fps: 8 }), attack: clip({ rows: [3], fps: 9, loop: false }),
      hurt: clip({ rows: [5, 6], fps: 8, loop: false }), death: clip({ mode: 'sequential', row: 7, frameCount: 8, fps: 9, loop: false }),
    },
  },
  skeleton: {
    src: '/sprites/skeleton.png', frameWidth: 128, frameHeight: 128, columns: 8, rows: 8,
    animations: {
      idle: clip({ rows: [0], fps: 4 }), walk: clip({ rows: [1, 2, 3], fps: 9 }), attack: clip({ rows: [4], fps: 10, loop: false }),
      hurt: clip({ rows: [5, 6], fps: 8, loop: false }), death: clip({ mode: 'sequential', row: 7, frameCount: 8, fps: 9, loop: false }),
    },
  },
  archer: {
    src: '/sprites/archer.png', frameWidth: 128, frameHeight: 128, columns: 8, rows: 8,
    animations: {
      idle: clip({ rows: [0], fps: 4 }), walk: clip({ rows: [1, 2, 3], fps: 9 }), attack: clip({ rows: [4], fps: 10, loop: false }),
      hurt: clip({ rows: [5, 6], fps: 8, loop: false }), death: clip({ mode: 'sequential', row: 7, frameCount: 8, fps: 9, loop: false }),
    },
  },
}

export class SpriteAnimator {
  constructor(image, manifest) { this.image = image; this.manifest = manifest; this.direction = 'S'; this.animName = 'idle'; this.frameIndex = 0; this.elapsed = 0; this.finished = false }
  play(name, { restart = false } = {}) { if (!this.manifest.animations[name]) return; if (this.animName === name && !restart) return; this.animName = name; this.frameIndex = 0; this.elapsed = 0; this.finished = false }
  setDirection(dir) { if (dir) this.direction = dir }
  update(dtMs) { const c = this.manifest.animations[this.animName]; if (!c || this.finished) return; this.elapsed += Math.max(0, Math.min(dtMs, 100)); const fd = 1000 / Math.max(1, c.fps); while (this.elapsed >= fd) { this.elapsed -= fd; const count = c.mode === 'sequential' ? c.frameCount : c.rows.length; const next = this.frameIndex + 1; if (next >= count) { if (c.loop) this.frameIndex = 0; else { this.frameIndex = Math.max(0, count - 1); this.finished = true } } else this.frameIndex = next; if (this.finished) break } }
  currentCell() { const c = this.manifest.animations[this.animName]; if (!c) return { row: 0, col: 0 }; if (c.mode === 'sequential') return { row: c.row, col: this.frameIndex }; return { row: c.rows[this.frameIndex], col: Math.max(0, DIRECTIONS.indexOf(this.direction)) } }
  draw(ctx, x, y, { scale = 1 } = {}) { const { frameWidth, frameHeight } = this.manifest; const { row, col } = this.currentCell(); const sx = col * frameWidth; const sy = row * frameHeight; const dw = frameWidth * scale; const dh = frameHeight * scale; ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(this.image, sx, sy, frameWidth, frameHeight, x - dw / 2, y - dh / 2, dw, dh); ctx.restore() }
}
