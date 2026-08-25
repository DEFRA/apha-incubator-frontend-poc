import { libraryNames } from '#/server/common/helpers/dashboard-view-model.js'

const prototypes = [
  {
    library: 'd3',
    description:
      'Low-level, fully composable visualisation primitives built directly on SVG.'
  },
  {
    library: 'plotly',
    description:
      'Batteries-included scientific charting with interactive tooling out of the box.'
  },
  {
    library: 'chartjs',
    description:
      'Lightweight canvas-based charting with a small, declarative configuration API.'
  }
].map((prototype) => ({
  ...prototype,
  name: libraryNames[prototype.library],
  href: `/dashboard/${prototype.library}`
}))

/**
 * A GDS styled example home page controller.
 * Provided as an example, remove or modify as required.
 */
export const homeController = {
  handler(_request, h) {
    return h.view('home/index', {
      pageTitle: 'Home',
      heading: 'Home',
      prototypes
    })
  }
}
