import {
  buildDashboardViewModel,
  buildExpandedViewModel
} from '#/server/common/helpers/dashboard-view-model.js'
import Boom from '@hapi/boom'

export const dashboardChartjsController = {
  handler(_request, h) {
    return h.view('dashboard-chartjs/index', buildDashboardViewModel('chartjs'))
  }
}

export const dashboardChartjsExpandedController = {
  handler(request, h) {
    const { chartId } = request.params
    const viewModel = buildExpandedViewModel('chartjs', chartId, request.query)

    if (!viewModel) {
      return Boom.notFound()
    }

    return h.view('dashboard-chartjs/expanded', viewModel)
  }
}
