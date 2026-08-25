import Boom from '@hapi/boom'
import {
  buildDashboardViewModel,
  buildExpandedViewModel
} from '#/server/common/helpers/dashboard-view-model.js'

export const dashboardD3Controller = {
  handler(_request, h) {
    return h.view('dashboard-d3/index', buildDashboardViewModel('d3'))
  }
}

export const dashboardD3ExpandedController = {
  handler(request, h) {
    const { chartId } = request.params
    const model = buildExpandedViewModel('d3', chartId, request.query)

    if (!model) {
      return Boom.notFound()
    }

    return h.view('dashboard-d3/expanded', model)
  }
}
