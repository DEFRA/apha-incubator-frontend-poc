import { playgroundController } from './controller.js'

/**
 * Sets up the route used by the /playground D3 sandbox.
 * Registered in src/server/plugins/router.js.
 */
export const playground = {
  plugin: {
    name: 'playground',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/playground',
          ...playgroundController
        }
      ])
    }
  }
}
