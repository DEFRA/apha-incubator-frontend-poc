import {
  buildDashboardViewModel,
  buildExpandedViewModel
} from '#/server/common/helpers/dashboard-view-model.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

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
      return h.response().code(statusCodes.notFound)
    }

    return h.view('dashboard-d3/expanded', model)
  }
}
