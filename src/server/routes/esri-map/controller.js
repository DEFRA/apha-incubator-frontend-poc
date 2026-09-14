/**
 * Renders a placeholder Esri map page (Workflow POC).
 * The map itself is not implemented yet; this route provides the page
 * skeleton only. It will display Esri map data rendered with the same
 * `@defra/interactive-map` component used by the other dashboards.
 */
export const esriMapController = {
  handler(_request, h) {
    return h.view('esri-map/index', {
      pageTitle: 'Esri map',
      heading: 'Esri map',
      breadcrumbs: [
        {
          text: 'Home',
          href: '/'
        },
        {
          text: 'Esri map'
        }
      ]
    })
  }
}
