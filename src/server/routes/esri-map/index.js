import { esriMapController } from './controller.js'

/**
 * Sets up the routes used in the Esri map page.
 * This route is registered in src/server/plugins/router.js.
 */
export const esriMap = {
  plugin: {
    name: 'esriMap',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/esri-map',
          ...esriMapController
        }
      ])
    }
  }
}
