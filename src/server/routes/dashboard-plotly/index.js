import {
  dashboardPlotlyController,
  dashboardPlotlyExpandedController
} from './controller.js'

export const dashboardPlotly = {
  plugin: {
    name: 'dashboardPlotly',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/dashboard/plotly',
          ...dashboardPlotlyController
        },
        {
          method: 'GET',
          path: '/dashboard/plotly/{chartId}',
          ...dashboardPlotlyExpandedController
        }
      ])
    }
  }
}
