import { getLatestCases } from '#/server/common/helpers/wahis/latest-cases-data.js'
import { buildLatestCasesViewModel } from '#/server/common/helpers/wahis/latest-cases-view-model.js'
import { buildOutbreaksGeoJSON } from '#/server/common/helpers/wahis/latest-cases-geojson.js'

const emptyOutbreaksGeoJson = { type: 'FeatureCollection', features: [] }

/**
 * Renders avian influenza events in Europe reported to WAHIS in the last
 * seven days (Workflow 4). Calls the live, unofficial WAHIS API server-side;
 * if that upstream call fails, the page still renders with a banner
 * instead of a 500 — a third party being unavailable shouldn't break this
 * page. The map and table are rendered from the same canonical outbreak list.
 */
export const latestCasesController = {
  async handler(request, h) {
    const pageContext = {
      pageTitle: 'Latest cases',
      heading: 'Latest cases',
      breadcrumbs: [
        {
          text: 'Home',
          href: '/'
        },
        {
          text: 'Latest cases'
        }
      ]
    }

    try {
      const latestCases = await getLatestCases({ logger: request.logger })
      const viewModel = buildLatestCasesViewModel(latestCases)
      return h.view('latest-cases/index', {
        ...pageContext,
        ...viewModel,
        outbreaksGeoJson: buildOutbreaksGeoJSON(viewModel.outbreaks)
      })
    } catch (error) {
      request.logger.error(
        { err: error },
        'Failed to load latest cases from WAHIS'
      )
      return h.view('latest-cases/index', {
        ...pageContext,
        upstreamError: true,
        hasEvents: false,
        events: [],
        outbreaks: [],
        hasOutbreaks: false,
        outbreakCount: 0,
        plottedCount: 0,
        unplottedCount: 0,
        outbreaksGeoJson: emptyOutbreaksGeoJson
      })
    }
  }
}
