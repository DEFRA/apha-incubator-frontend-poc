import { idmDashboardController } from './controller.js'

/**
 * Sets up the routes used in the IDM monitoring dashboard page.
 * This route is registered in src/server/plugins/router.js.
 */
export const idmDashboard = {
  plugin: {
    name: 'idmDashboard',
    register(server) {
      server.route({
        method: 'GET',
        path: '/idm-dashboard',
        ...idmDashboardController
      })
    }
  }
}
