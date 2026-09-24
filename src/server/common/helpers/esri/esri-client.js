import { config } from '#/config/config.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'

const logger = createLogger()

const DEFAULT_PAGE_SIZE = 1000

// Fallback result returned on any fetch/parse failure. The map must still
// render with no data instead of crashing the page, so this is the safe
// "no data available" value handed back to the caller.
const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] }

/**
 * Build the query URL for a single page of Esri features.
 * @param {string} baseUrl - Base URL of the Esri feature service layer.
 * @param {number} offset - Result offset for pagination.
 * @param {number} pageSize - Number of records to request per page.
 * @returns {string} The fully qualified query URL.
 */
function buildQueryUrl(baseUrl, offset, pageSize) {
  return `${baseUrl}/query?where=1=1&outFields=*&returnGeometry=true&f=geojson&resultOffset=${offset}&resultRecordCount=${pageSize}`
}

/**
 * Fetch a single page of GeoJSON features from an Esri feature service.
 * @param {string} url - The query URL to fetch.
 * @returns {Promise<object>} The parsed GeoJSON page.
 */
async function fetchPage(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Esri API responded with status ${response.status}`)
  }

  return response.json()
}

/**
 * Fetch all features from an Esri feature service, paginating as needed.
 * Never throws - on any failure it logs the error and returns an empty
 * FeatureCollection so that the map can still render without data.
 * @param {string} [baseUrl] - Base URL (host) of the Esri ArcGIS service,
 *   e.g. https://services.arcgis.com — the wild birds layer path is
 *   prepended automatically. Defaults to the configured `esri.apiUrl`
 *   when not provided.
 * @param {object} [options] - Options.
 * @param {number} [options.pageSize] - Number of records to request per page.
 * @returns {Promise<object>} A merged GeoJSON FeatureCollection.
 */
export async function fetchEsriFeatureCollection(
  baseUrl,
  { pageSize = DEFAULT_PAGE_SIZE } = {}
) {
  const layerBaseUrl = `${baseUrl ?? config.get('esri.apiUrl')}/${config.get('esri.wildBirdsLayerPath')}`
  const features = []

  try {
    let offset = 0
    let hasMorePages = true

    // The Esri service caps each response at `maxRecordCount` (1000)
    // records. When a response is truncated it sets
    // `properties.exceededTransferLimit: true`, meaning more records exist
    // beyond this page. We loop, re-requesting with `resultOffset` moved on
    // by `pageSize` each time, until a page is not truncated (or returns
    // fewer than `pageSize` features), then stop and treat all fetched
    // pages together as the full dataset.
    while (hasMorePages) {
      const queryUrl = buildQueryUrl(layerBaseUrl, offset, pageSize)
      const page = await fetchPage(queryUrl)
      const pageFeatures = page?.features ?? []

      features.push(...pageFeatures)

      const exceededTransferLimit = Boolean(
        page?.properties?.exceededTransferLimit
      )

      hasMorePages = exceededTransferLimit && pageFeatures.length >= pageSize

      offset += pageSize
    }

    return { type: 'FeatureCollection', features }
  } catch (error) {
    logger.error(error, 'Failed to fetch Esri feature collection')
    return EMPTY_FEATURE_COLLECTION
  }
}
