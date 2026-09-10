import { existsSync, readFileSync, createReadStream } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { NodePackageImporter } from 'sass-embedded'

/**
 * MapLibre GL JS ships its worker (`maplibre-gl-worker.mjs`) and a shared
 * chunk (`maplibre-gl-shared.mjs`) as siblings that import one another by a
 * hardcoded relative path. Vite's asset pipeline hashes/copies files
 * individually, which breaks that relative import. This plugin copies both
 * files (and their sourcemaps) verbatim, unhashed, to a fixed vendor path so
 * the pair keeps working together in both dev and production builds.
 */
const maplibreDistDir = fileURLToPath(
  new URL('./node_modules/maplibre-gl/dist/', import.meta.url)
)
const maplibreWorkerVendorPath = 'vendor/maplibre-gl'
const maplibreWorkerFiles = [
  'maplibre-gl-worker.mjs',
  'maplibre-gl-worker.mjs.map',
  'maplibre-gl-shared.mjs',
  'maplibre-gl-shared.mjs.map'
]

export function maplibreWorkerAssets({ createStream = createReadStream } = {}) {
  return {
    name: 'maplibre-worker-assets',
    configureServer(server) {
      server.middlewares.use(`/${maplibreWorkerVendorPath}`, (req, res, next) => {
        const fileName = req.url.split('?')[0].replace(/^\//, '')
        if (!maplibreWorkerFiles.includes(fileName)) {
          next()
          return
        }
        const filePath = join(maplibreDistDir, fileName)
        if (!existsSync(filePath)) {
          next()
          return
        }
        res.setHeader(
          'Content-Type',
          fileName.endsWith('.map') ? 'application/json' : 'text/javascript'
        )
        const stream = createStream(filePath)
        stream.on('error', (err) => next(err))
        stream.pipe(res)
      })
    },
    generateBundle() {
      for (const file of maplibreWorkerFiles) {
        this.emitFile({
          type: 'asset',
          fileName: `${maplibreWorkerVendorPath}/${file}`,
          source: readFileSync(join(maplibreDistDir, file))
        })
      }
    }
  }
}

export default defineConfig({
  plugins: [maplibreWorkerAssets()],
  base: '/public',
  build: {
    outDir: '.public',
    manifest: true,
    rolldownOptions: {
      input: {
        htmlAssets: 'src/client/assets.html',
        application: 'src/client/javascripts/application.js',
        applicationCss: 'src/client/stylesheets/application.scss',
        dashboardPlotly: 'src/client/javascripts/dashboard-plotly.js',
        dashboardChartjs: 'src/client/javascripts/dashboard-chartjs.js',
        dashboardD3: 'src/client/javascripts/dashboard-d3.js',
        latestCasesMap: 'src/client/javascripts/latest-cases-map.js'
      }
    },
    sourcemap: true
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        importers: [new NodePackageImporter()],
        loadPaths: [
          'node_modules',
          'src/client/stylesheets',
          'src/server',
          'src/server/common/components',
          'src/server/common/templates/partials'
        ],
        quietDeps: true,
        sourceMapIncludeSources: true,
        style: 'expanded'
      }
    },
    lightningcss: { errorRecovery: true }
  },
  optimizeDeps: {
    exclude: ['maplibre-gl']
  },
  // Dev server
  server: {}
})
