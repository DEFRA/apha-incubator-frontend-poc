import Boom from '@hapi/boom'
import {
  buildDashboardViewModel,
  buildExpandedViewModel
} from '#/server/common/helpers/dashboard-view-model.js'

export const dashboardPlotlyController = {
  handler(_request, h) {
    return h.view('dashboard-plotly/index', buildDashboardViewModel('plotly'))
  }
}

export const dashboardPlotlyExpandedController = {
  handler(request, h) {
    const { chartId } = request.params
    const model = buildExpandedViewModel('plotly', chartId, request.query)

    if (!model) {
      return Boom.notFound()
    }

    return h.view('dashboard-plotly/expanded', model)
  }
}
