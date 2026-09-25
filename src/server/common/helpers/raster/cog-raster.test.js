import { vi } from 'vitest'
import { readFile } from 'node:fs/promises'
// `vitest-fetch-mock` is a third-party npm package (not our code). It
// replaces the global `fetch` with a mock so we can control/assert on
// requests and responses without hitting a real remote raster URL.
import createFetchMock from 'vitest-fetch-mock'
import { fetchWildBirdsHeatmapOverlay } from './cog-raster.js'

const fetchMock = createFetchMock(vi)
fetchMock.enableMocks()

const LOCAL_FIXTURE_URL = new URL(
  '../../../data/rasters/wild-birds-heatmap.tif',
  import.meta.url
)

describe('fetchWildBirdsHeatmapOverlay', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('decodes the local sample fixture when no source URL is provided', async () => {
    const result = await fetchWildBirdsHeatmapOverlay('')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).not.toBeNull()
    expect(result.pngDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(result.coordinates).toEqual([
      [expect.any(Number), expect.any(Number)],
      [expect.any(Number), expect.any(Number)],
      [expect.any(Number), expect.any(Number)],
      [expect.any(Number), expect.any(Number)]
    ])

    // Top-left corner should match the sample fixture's known tiepoint
    // (reprojected from the file's native EPSG:3857 to WGS84).
    const [topLeft] = result.coordinates
    expect(topLeft[0]).toBeCloseTo(-8.704, 2)
    expect(topLeft[1]).toBeCloseTo(60.856, 2)
  })

  test('fetches and decodes a raster from a remote source URL', async () => {
    const tiffBuffer = await readFile(LOCAL_FIXTURE_URL)
    fetchMock.mockResponseOnce(new Response(tiffBuffer))

    const result = await fetchWildBirdsHeatmapOverlay(
      'https://example.test/raster.tif'
    )

    expect(fetchMock).toHaveBeenCalledWith('https://example.test/raster.tif')
    expect(result).not.toBeNull()
    expect(result.pngDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(result.coordinates).toHaveLength(4)
  })

  test('returns null when the remote fetch responds with a non-OK status', async () => {
    fetchMock.mockResponseOnce('', { status: 500 })

    const result = await fetchWildBirdsHeatmapOverlay(
      'https://example.test/raster.tif'
    )

    expect(result).toBeNull()
  })

  test('returns null when the remote fetch throws', async () => {
    fetchMock.mockRejectOnce(new Error('network down'))

    const result = await fetchWildBirdsHeatmapOverlay(
      'https://example.test/raster.tif'
    )

    expect(result).toBeNull()
  })

  test('returns null when the fetched bytes are not a valid TIFF', async () => {
    fetchMock.mockResponseOnce('not a tiff file')

    const result = await fetchWildBirdsHeatmapOverlay(
      'https://example.test/raster.tif'
    )

    expect(result).toBeNull()
  })
})
