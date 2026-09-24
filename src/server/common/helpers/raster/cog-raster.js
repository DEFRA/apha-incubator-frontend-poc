import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { fromArrayBuffer } from 'geotiff'
import { PNG } from 'pngjs'
import { config } from '#/config/config.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'

const logger = createLogger()

// Local dev/test fallback fixture, used whenever no remote raster URL is
// configured. Keeps `/esri-map` renderable without an S3 dependency locally.
const LOCAL_FIXTURE_URL = new URL(
  '../../../data/rasters/wild-birds-heatmap.tif',
  import.meta.url
)

/**
 * Load the raw bytes of the GeoTIFF raster, either from a remote URL
 * (S3 in production) or the local sample fixture (dev/test default).
 * @param {string} [sourceUrl] - URL to fetch the raster from.
 * @returns {Promise<ArrayBuffer>} The raw TIFF file bytes.
 */
async function loadTiffBytes(sourceUrl) {
  if (sourceUrl) {
    const response = await fetch(sourceUrl)

    if (!response.ok) {
      throw new Error(`Raster fetch responded with status ${response.status}`)
    }

    return response.arrayBuffer()
  }

  const buffer = await readFile(fileURLToPath(LOCAL_FIXTURE_URL))
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  )
}

/**
 * Encode decoded raster pixel samples as a PNG buffer. Handles RGBA
 * (4 samples/pixel), RGB (3) and greyscale (1) source rasters, always
 * producing an RGBA PNG (alpha defaults to fully opaque when the source
 * has no alpha channel).
 * @param {Uint8Array} rasterData - Interleaved pixel samples.
 * @param {number} width - Raster width in pixels.
 * @param {number} height - Raster height in pixels.
 * @returns {Buffer} PNG-encoded image bytes.
 */
function encodePng(rasterData, width, height) {
  const png = new PNG({ width, height })
  const samplesPerPixel = rasterData.length / (width * height)

  for (let pixel = 0; pixel < width * height; pixel++) {
    const srcOffset = pixel * samplesPerPixel
    const dstOffset = pixel * 4
    const isGreyscale = samplesPerPixel < 3

    png.data[dstOffset] = rasterData[srcOffset]
    png.data[dstOffset + 1] = isGreyscale
      ? rasterData[srcOffset]
      : rasterData[srcOffset + 1]
    png.data[dstOffset + 2] = isGreyscale
      ? rasterData[srcOffset]
      : rasterData[srcOffset + 2]
    png.data[dstOffset + 3] =
      samplesPerPixel >= 4 ? rasterData[srcOffset + 3] : 255
  }

  return PNG.sync.write(png)
}

/**
 * Convert a GeoTIFF bounding box into the 4 corner coordinates expected by
 * MapLibre's native `image` source, ordered
 * [top-left, top-right, bottom-right, bottom-left] as [lng, lat] pairs.
 * @param {number[]} boundingBox - `[west, south, east, north]`.
 * @returns {number[][]} The 4 corner coordinates.
 */
function boundingBoxToImageCorners([west, south, east, north]) {
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south]
  ]
}

/**
 * Fetch and decode the wild birds heatmap GeoTIFF raster overlay, returning
 * a browser-displayable PNG data URL plus its 4 geo corner coordinates for
 * MapLibre's `image` source. Never throws — on any failure it logs the
 * error and returns `null` so the map can still render without the overlay.
 *
 * NOTE: the CRS is assumed to be WGS84 (EPSG:4326), inferred from the
 * coordinate values in the sample file — the file has no explicit
 * GeoKeyDirectory tag declaring a CRS. Verify this against the real data
 * source before relying on it for anything precision-critical.
 * @param {string} [sourceUrl] - URL to fetch the raster from. Defaults to
 *   the configured `raster.wildBirdsHeatmapUrl`; when that is unset, falls
 *   back to the local sample fixture.
 * @returns {Promise<{pngDataUrl: string, coordinates: number[][]}|null>}
 *   The overlay payload, or `null` on failure.
 */
export async function fetchWildBirdsHeatmapOverlay(
  sourceUrl = config.get('raster.wildBirdsHeatmapUrl')
) {
  try {
    const arrayBuffer = await loadTiffBytes(sourceUrl || undefined)
    const tiff = await fromArrayBuffer(arrayBuffer)
    const image = await tiff.getImage()
    const width = image.getWidth()
    const height = image.getHeight()
    const boundingBox = image.getBoundingBox()
    const rasterData = await image.readRasters({ interleave: true })
    const pngBuffer = encodePng(rasterData, width, height)

    return {
      pngDataUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`,
      coordinates: boundingBoxToImageCorners(boundingBox)
    }
  } catch (error) {
    logger.error(
      error,
      'Failed to fetch/decode wild birds heatmap raster overlay'
    )
    return null
  }
}
