/**
 * Esri map controller.
 * Fetches wild bird avian influenza features from Esri API,
 * categorises by High_Path status, and renders with `@defra/interactive-map`.
 */
import { config } from '#/config/config.js'
import { esriMapPresenter } from './presenter.js'
import { fetchEsriFeatureCollection } from '#/server/common/helpers/esri/esri-client.js'
import { categoriseWildBirdFeatures } from '#/server/common/helpers/esri/wild-birds-geojson.js'
import { fetchWildBirdsHeatmapOverlay } from '#/server/common/helpers/raster/cog-raster.js'

export const esriMapController = {
  /**
   * Handler for GET /esri-map
   * Fetches and categorises wild bird features from Esri, and fetches the
   * wild birds heatmap raster overlay. Returns with empty collections/no
   * overlay on error.
   * @param {object} request Hapi request object
   * @param {object} h Hapi response toolkit
   * @returns {Promise<object>} View response
   */
  handler: async (request, h) => {
    // fetchWildBirdsHeatmapOverlay never throws — it logs and resolves to
    // `null` on failure, so the raster overlay is simply omitted rather
    // than needing its own try/catch here.
    const rasterOverlay = await fetchWildBirdsHeatmapOverlay()

    try {
      const esriApiUrl = config.get('esri.apiUrl')
      const featureCollection = await fetchEsriFeatureCollection(esriApiUrl)
      const categorisedFeatures = categoriseWildBirdFeatures(featureCollection)

      const context = {
        ...esriMapPresenter(),
        highPathGeoJson: categorisedFeatures.high_path,
        lowPathGeoJson: categorisedFeatures.low_path,
        unknownGeoJson: categorisedFeatures.unknown,
        rasterOverlay
      }
      return h.view('esri-map/index', context)
    } catch (error) {
      request.logger.error({ err: error }, 'Error fetching Esri features')
      const context = {
        ...esriMapPresenter(),
        highPathGeoJson: { type: 'FeatureCollection', features: [] },
        lowPathGeoJson: { type: 'FeatureCollection', features: [] },
        unknownGeoJson: { type: 'FeatureCollection', features: [] },
        rasterOverlay
      }
      return h.view('esri-map/index', context)
    }
  }
}
