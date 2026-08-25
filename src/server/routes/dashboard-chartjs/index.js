import {
  dashboardChartjsController,
  dashboardChartjsExpandedController
} from './controller.js'

export const dashboardChartjs = {
  plugin: {
    name: 'dashboardChartjs',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/dashboard/chartjs',
          ...dashboardChartjsController
        },
        {
          method: 'GET',
          path: '/dashboard/chartjs/{chartId}',
          ...dashboardChartjsExpandedController
        }
      ])
    }
  }
}
