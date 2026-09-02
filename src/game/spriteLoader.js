// Pixel-Bound sprite-sheet loader and frame slicer.
//
// The loader is dimension-driven instead of hard-coding a single cell size:
//   frameWidth  = sheetWidth / columns
//   frameHeight = sheetHeight / atlasRows
// This supports both 1024px-wide (128px cells) and 1536px-wide (192px cells)
// atlases while keeping the runtime renderer independent of the source size.

export const SPRITE_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

const loadedSheets = new Map()
const pendingSheets = new Map()

function isNeutralGray(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b) <= 8
}

function colorDistance(a, b) {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
}

function removeCheckerboardFromCell(imageData, cellX, cellY, frameW, frameH) {
  const { data, width, height } = imageData
  const x0 = cellX * frameW
  const y0 = cellY * frameH
  if (x0 + frameW > width || y0 + frameH > height) return

  const read = (x, y) => {
    const i = (((y0 + y) * width) + (x0 + x)) * 4
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }
  }

  // The supplied sprite PNGs use a neutral-gray checkerboard. Only remove
  // neutral gray that is connected to the outer edge of a cell, preserving
  // internal gray/white sprite pixels such as skeleton bones and outlines.
  const cornerSamples = [
    read(0, 0),
    read(frameW - 1, 0),
    read(0, frameH - 1),
    read(frameW - 1, frameH - 1),
  ].filter((sample) => sample.a !== 0 && isNeutralGray(sample.r, sample.g, sample.b))

  if (!cornerSamples.length) return

  const isBackground = (x, y) => {
    const pixel = read(x, y)
    if (pixel.a === 0 || !isNeutralGray(pixel.r, pixel.g, pixel.b)) return false
    return cornerSamples.some((corner) => colorDistance(pixel, corner) <= 18)
  }

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
  for (let row = 0; row < manifest.atlasRows; row += 1) {
    for (let col = 0; col < manifest.columns; col += 1) {
      removeCheckerboardFromCell(imageData, col, row, manifest.frameWidth, manifest.frameHeight)
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Slice an atlas into frames[row][direction]. Each state chooses one or more
 * rows and cycles those rows as its animation frames.
 */
function sliceAtlas(sheet, manifest) {
  const frames = Array.from({ length: manifest.atlasRows }, () => Array(manifest.columns))

  for (let row = 0; row < manifest.atlasRows; row += 1) {
    for (let col = 0; col < manifest.columns; col += 1) {
      const frame = document.createElement('canvas')
      frame.width = manifest.frameWidth
      frame.height = manifest.frameHeight
      const frameCtx = frame.getContext('2d')
      if (!frameCtx) continue

      frameCtx.imageSmoothingEnabled = false
      frameCtx.drawImage(
        sheet,
        col * manifest.frameWidth,
        row * manifest.frameHeight,
        manifest.frameWidth,
        manifest.frameHeight,
        0,
        0,
        manifest.frameWidth,
        manifest.frameHeight,
      )
      frames[row][col] = frame
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
          console.error(`[Pixel-Bound] Sprite sheet has no usable dimensions: ${key}`)
          resolve(null)
          return
        }

        if (image.naturalWidth % manifest.columns !== 0) {
          console.error(`[Pixel-Bound] ${key} width ${image.naturalWidth} is not divisible by ${manifest.columns} columns`)
          resolve(null)
          return
        }

        if (image.naturalHeight % manifest.atlasRows !== 0) {
          console.error(`[Pixel-Bound] ${key} height ${image.naturalHeight} is not divisible by ${manifest.atlasRows} rows`)
          resolve(null)
          return
        }

        const resolvedManifest = {
          ...manifest,
          frameWidth: image.naturalWidth / manifest.columns,
          frameHeight: image.naturalHeight / manifest.atlasRows,
        }

        const cleanedSheet = cleanAtlas(image, resolvedManifest)
        const frames = sliceAtlas(cleanedSheet, resolvedManifest)
        const result = {
          image: cleanedSheet,
          frames,
          manifest: resolvedManifest,
        }

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
