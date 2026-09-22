/**
 * Esri map controller.
 * Fetches wild bird avian influenza features from Esri API,
 * categorises by High_Path status, and renders with `@defra/interactive-map`.
 */
import { config } from '#/config/config.js'
import { esriMapPresenter } from './presenter.js'
import { fetchEsriFeatureCollection } from '#/server/common/helpers/esri/esri-client.js'
import { categoriseWildBirdFeatures } from '#/server/common/helpers/esri/wild-birds-geojson.js'

export const esriMapController = {
  /**
   * Handler for GET /esri-map
   * Fetches and categorises wild bird features from Esri.
   * Returns with empty collections on error.
   * @param {object} request Hapi request object
   * @param {object} h Hapi response toolkit
   * @returns {Promise<object>} View response
   */
  handler: async (request, h) => {
    try {
      const esriApiUrl = config.get('esri.apiUrl')
      const featureCollection = await fetchEsriFeatureCollection(esriApiUrl)
      const categorisedFeatures = categoriseWildBirdFeatures(featureCollection)

      const context = {
        ...esriMapPresenter(),
        highPathGeoJson: categorisedFeatures.high_path,
        lowPathGeoJson: categorisedFeatures.low_path,
        unknownGeoJson: categorisedFeatures.unknown
      }
      return h.view('esri-map/index', context)
    } catch (error) {
      request.logger.error({ err: error }, 'Error fetching Esri features')
      const context = {
        ...esriMapPresenter(),
        highPathGeoJson: { type: 'FeatureCollection', features: [] },
        lowPathGeoJson: { type: 'FeatureCollection', features: [] },
        unknownGeoJson: { type: 'FeatureCollection', features: [] }
      }
      return h.view('esri-map/index', context)
    }
  }
}
