import { vi } from 'vitest'
// `vitest-fetch-mock` is a third-party npm package (not our code). It
// replaces the global `fetch` with a mock so we can control/assert on
// requests and responses without hitting the real Esri API.
import createFetchMock from 'vitest-fetch-mock'
import { fetchEsriFeatureCollection } from './esri-client.js'

const fetchMock = createFetchMock(vi)
fetchMock.enableMocks()

const PAGE_SIZE = 2

function buildFeature(id) {
  return {
    type: 'Feature',
    id,
    properties: { id },
    geometry: { type: 'Point', coordinates: [0, 0] }
  }
}

describe('fetchEsriFeatureCollection', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('returns a single page of features when the response is not truncated', async () => {
    const features = [buildFeature(1)]
    fetchMock.mockResponseOnce(
      JSON.stringify({
        type: 'FeatureCollection',
        properties: { exceededTransferLimit: false },
        features
      })
    )

    const result = await fetchEsriFeatureCollection(
      'https://example.test/layer',
      { pageSize: PAGE_SIZE }
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://example.test/layer/JJzESW51TqeY9uat/ArcGIS/rest/services/Positive_Wild_Birds_All_Seasons_(Public)/FeatureServer/0/query?where=1=1&outFields=*&returnGeometry=true&f=geojson&resultOffset=0&resultRecordCount=2'
    )
    expect(result).toEqual({ type: 'FeatureCollection', features })
  })

  // The Esri service caps responses at `maxRecordCount` records per page.
  // When a page is truncated, it returns `exceededTransferLimit: true`,
  // signalling there are more records beyond this page. The client must
  // re-request with `resultOffset` advanced by `pageSize` and keep doing
  // so until a page comes back not-truncated, then merge every page's
  // features together into the one result the caller receives. This test
  // simulates exactly that: a first, truncated page followed by a second,
  // complete page, and asserts both the re-fetch and the merge happen.
  test('paginates when a page exceeds the transfer limit and merges all features', async () => {
    const firstPageFeatures = [buildFeature(1), buildFeature(2)]
    const secondPageFeatures = [buildFeature(3)]

    fetchMock.mockResponseOnce(
      JSON.stringify({
        type: 'FeatureCollection',
        properties: { exceededTransferLimit: true },
        features: firstPageFeatures
      })
    )
    fetchMock.mockResponseOnce(
      JSON.stringify({
        type: 'FeatureCollection',
        properties: { exceededTransferLimit: false },
        features: secondPageFeatures
      })
    )

    const result = await fetchEsriFeatureCollection(
      'https://example.test/layer',
      { pageSize: PAGE_SIZE }
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondCallUrl = fetchMock.mock.calls[1][0]
    expect(secondCallUrl).toContain(`resultOffset=${PAGE_SIZE}`)
    expect(result).toEqual({
      type: 'FeatureCollection',
      features: [...firstPageFeatures, ...secondPageFeatures]
    })
  })

  test('returns an empty FeatureCollection when the fetch rejects', async () => {
    fetchMock.mockRejectOnce(new Error('network error'))

    const result = await fetchEsriFeatureCollection(
      'https://example.test/layer',
      { pageSize: PAGE_SIZE }
    )

    expect(result).toEqual({ type: 'FeatureCollection', features: [] })
  })

  test('returns an empty FeatureCollection when the response status is not ok', async () => {
    fetchMock.mockResponseOnce('', { status: 500 })

    const result = await fetchEsriFeatureCollection(
      'https://example.test/layer',
      { pageSize: PAGE_SIZE }
    )

    expect(result).toEqual({ type: 'FeatureCollection', features: [] })
  })

  test('returns an empty FeatureCollection when the response body is malformed JSON', async () => {
    fetchMock.mockResponseOnce('not valid json')

    const result = await fetchEsriFeatureCollection(
      'https://example.test/layer',
      { pageSize: PAGE_SIZE }
    )

    expect(result).toEqual({ type: 'FeatureCollection', features: [] })
  })
})
