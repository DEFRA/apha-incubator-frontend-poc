import {
  dashboardD3Controller,
  dashboardD3ExpandedController
} from './controller.js'

export const dashboardD3 = {
  plugin: {
    name: 'dashboardD3',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/dashboard/d3',
          ...dashboardD3Controller
        },
        {
          method: 'GET',
          path: '/dashboard/d3/{chartId}',
          ...dashboardD3ExpandedController
        }
      ])
    }
  }
}
