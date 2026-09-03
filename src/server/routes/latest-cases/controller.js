import { getLatestCases } from '#/server/common/helpers/wahis/latest-cases-data.js'
import { buildLatestCasesViewModel } from '#/server/common/helpers/wahis/latest-cases-view-model.js'

/**
 * Renders avian influenza events in Europe reported to WAHIS in the last
 * 24 hours (Workflow 4). Calls the live, unofficial WAHIS API server-side;
 * if that upstream call fails, the page still renders with a banner
 * instead of a 500 — a third party being unavailable shouldn't break this
 * page.
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
      return h.view('latest-cases/index', {
        ...pageContext,
        ...buildLatestCasesViewModel(latestCases)
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
        events: []
      })
    }
  }
}
