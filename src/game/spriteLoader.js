export const SPRITE_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const DIRECTION_COUNT = SPRITE_DIRECTIONS.length

const loadedSheets = new Map()
const pendingSheets = new Map()

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function isNeutralGray(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b) <= 18
}

function isCheckerCandidate(r, g, b) {
  if (!isNeutralGray(r, g, b)) return false
  const luminance = (r + g + b) / 3
  return luminance >= 70 && luminance <= 245
}

// The supplied PNGs contain a gray checkerboard baked into the image. We only
// remove checkerboard-colored pixels that are connected to the cell boundary.
function cleanFrame(frame) {
  const ctx = frame.getContext('2d', { willReadFrequently: true })
  if (!ctx) return frame
  const w = frame.width
  const h = frame.height
  const imageData = ctx.getImageData(0, 0, w, h)
  const { data } = imageData
  const palette = new Map()

  const collectEdge = (x, y) => {
    const i = (y * w + x) * 4
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (!data[i + 3] || !isCheckerCandidate(r, g, b)) return
    const key = `${Math.round(r / 4) * 4},${Math.round(g / 4) * 4},${Math.round(b / 4) * 4}`
    palette.set(key, (palette.get(key) || 0) + 1)
  }

  for (let x = 0; x < w; x += 2) {
    collectEdge(x, 0)
    collectEdge(x, h - 1)
  }
  for (let y = 1; y < h - 1; y += 2) {
    collectEdge(0, y)
    collectEdge(w - 1, y)
  }

  const backgroundColors = [...palette.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key]) => key.split(',').map(Number))

  if (!backgroundColors.length) return frame

  const matchesBackground = (x, y) => {
    const i = (y * w + x) * 4
    if (!data[i + 3]) return true
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (!isCheckerCandidate(r, g, b)) return false
    return backgroundColors.some(([br, bg, bb]) => Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(b - bb)) <= 12)
  }

  const seen = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  let head = 0
  let tail = 0
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const p = y * w + x
    if (seen[p] || !matchesBackground(x, y)) return
    seen[p] = 1
    queue[tail++] = p
  }

  for (let x = 0; x < w; x += 1) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 1; y < h - 1; y += 1) {
    push(0, y)
    push(w - 1, y)
  }

  while (head < tail) {
    const p = queue[head++]
    const x = p % w
    const y = Math.floor(p / w)
    data[p * 4 + 3] = 0
    push(x - 1, y)
    push(x + 1, y)
    push(x, y - 1)
    push(x, y + 1)
  }

  ctx.putImageData(imageData, 0, 0)
  return frame
}

function resolveGrid(image, manifest) {
  const frameWidth = image.naturalWidth / DIRECTION_COUNT
  const declaredRows = manifest.atlasRows || manifest.rows
  const preferredHeight = declaredRows ? image.naturalHeight / declaredRows : frameWidth

  // Use the declared layout only when it is square. This matches the user's
  // 128x128 / 192x192 frame layouts. If an older 1536x1536 atlas is present
  // with only six or seven logical animation rows, its actual native cell is
  // still 192x192 and the extra physical rows simply remain unused.
  if (Number.isInteger(frameWidth) && Number.isInteger(preferredHeight) && preferredHeight === frameWidth) {
    return { frameWidth, frameHeight: preferredHeight, atlasRows: declaredRows }
  }

  const nativeRows = Math.floor(image.naturalHeight / frameWidth)
  return {
    frameWidth,
    frameHeight: frameWidth,
    atlasRows: nativeRows,
  }
}

function sliceAtlas(sheet, manifest, grid) {
  const frames = Array.from({ length: grid.atlasRows }, () => Array(DIRECTION_COUNT).fill(null))
  const usedRows = new Set()
  for (const clip of Object.values(manifest.animations || {})) {
    for (const row of clip.rows || []) usedRows.add(row)
  }

  for (const row of usedRows) {
    if (row < 0 || row >= grid.atlasRows) continue
    for (let col = 0; col < DIRECTION_COUNT; col += 1) {
      const frame = makeCanvas(grid.frameWidth, grid.frameHeight)
      const ctx = frame.getContext('2d')
      if (!ctx) continue
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, grid.frameWidth, grid.frameHeight)
      ctx.drawImage(
        sheet,
        col * grid.frameWidth,
        row * grid.frameHeight,
        grid.frameWidth,
        grid.frameHeight,
        0,
        0,
        grid.frameWidth,
        grid.frameHeight,
      )
      frames[row][col] = cleanFrame(frame)
    }
  }
  return frames
}

export function loadSpriteSheet(key, manifest) {
  if (loadedSheets.has(key)) return Promise.resolve(loadedSheets.get(key))
  if (pendingSheets.has(key)) return pendingSheets.get(key)

  const promise = new Promise((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight) {
          console.error(`[Pixel-Bound] Empty sprite sheet: ${key}`)
          resolve(null)
          return
        }
        if (image.naturalWidth % DIRECTION_COUNT !== 0) {
          console.error(`[Pixel-Bound] ${key} width ${image.naturalWidth} is not divisible by ${DIRECTION_COUNT}`)
          resolve(null)
          return
        }
        const grid = resolveGrid(image, manifest)
        const resolvedManifest = {
          ...manifest,
          frameWidth: grid.frameWidth,
          frameHeight: grid.frameHeight,
          atlasRows: grid.atlasRows,
        }
        const frames = sliceAtlas(image, manifest, grid)
        const result = { image, frames, manifest: resolvedManifest }
        loadedSheets.set(key, result)
        resolve(result)
      } catch (error) {
        console.error(`[Pixel-Bound] Failed to prepare sprite sheet ${key}`, error)
        resolve(null)
      }
    }
    image.onerror = () => {
      console.error(`[Pixel-Bound] Failed to load sprite sheet: ${manifest.src}`)
      resolve(null)
    }
    image.src = new URL(manifest.src, document.baseURI).href
  })

  pendingSheets.set(key, promise)
  return promise
}

export function getLoadedSpriteSheet(key) {
  return loadedSheets.get(key) || null
}

export async function preloadSpriteSheets(manifests) {
  await Promise.all(Object.entries(manifests).map(([key, manifest]) => loadSpriteSheet(key, manifest)))
  return Object.fromEntries([...loadedSheets.entries()])
}
