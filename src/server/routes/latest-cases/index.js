import { latestCasesController } from './controller.js'

export const latestCases = {
  plugin: {
    name: 'latestCases',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/latest-cases',
          ...latestCasesController
        }
      ])
    }
  }
}
