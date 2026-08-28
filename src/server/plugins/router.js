import inert from '@hapi/inert'

import { home } from '../routes/home/index.js'
import { about } from '../routes/about/index.js'
import { dashboardPlotly } from '../routes/dashboard-plotly/index.js'
import { dashboardChartjs } from '../routes/dashboard-chartjs/index.js'
import { dashboardD3 } from '../routes/dashboard-d3/index.js'
import { playground } from '../routes/playground/index.js'
import { health } from '../routes/health/index.js'
import { serveStaticFiles } from './serve-static-files.js'
import { config } from '#/config/config.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([inert])

      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Application specific routes, add your own routes here
      await server.register([
        home,
        about,
        dashboardPlotly,
        dashboardChartjs,
        dashboardD3,
        playground
      ])

      // Static assets
      if (!config.get('isProduction') && !config.get('isTest')) {
        await (async () => {
          const createViteServer = (await import('vite')).createServer
          const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'custom'
          })

          await server.register({
            plugin: (await import('@defra/hapi-connect')).default,
            options: {
              path: '/public',
              middleware: [vite.middlewares]
            }
          })
        })()
      } else {
        server.register(serveStaticFiles)
      }
    }
  }
}
