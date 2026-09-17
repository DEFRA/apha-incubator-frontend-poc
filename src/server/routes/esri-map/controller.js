/**
 * Renders a placeholder Esri map page (Workflow POC).
 * The map itself is not implemented yet; this route provides the page
 * skeleton only. It will display Esri map data rendered with the same
 * `@defra/interactive-map` component used by the other dashboards.
 */
import { esriMapPresenter } from './presenter.js'

export const esriMapController = {
  handler(_request, h) {
    const context = esriMapPresenter()
    return h.view('esri-map/index', context)
  }
}
