import { vi } from 'vitest'
import config, { maplibreWorkerAssets } from './vite.config.js'

describe('vite config', () => {
  test('Should emit the expected maplibre worker vendor assets', () => {
    const plugin = config.plugins.find((p) => p.name === 'maplibre-worker-assets')
    const emitFile = vi.fn()

    plugin.generateBundle.call({ emitFile })

    expect(emitFile).toHaveBeenCalledTimes(4)
    expect(emitFile.mock.calls.map(([asset]) => asset.fileName)).toEqual([
      'vendor/maplibre-gl/maplibre-gl-worker.mjs',
      'vendor/maplibre-gl/maplibre-gl-worker.mjs.map',
      'vendor/maplibre-gl/maplibre-gl-shared.mjs',
      'vendor/maplibre-gl/maplibre-gl-shared.mjs.map'
    ])
  })

  test('Should only serve allowlisted maplibre files and set JSON content type for sourcemaps', () => {
    const createStream = vi.fn(() => ({ on: vi.fn(), pipe: vi.fn() }))
    const plugin = maplibreWorkerAssets({ createStream })
    const use = vi.fn()
    plugin.configureServer({ middlewares: { use } })
    const middleware = use.mock.calls[0][1]

    const setHeader = vi.fn()
    const next = vi.fn()

    middleware({}, { setHeader }, next)
    expect(createStream).not.toHaveBeenCalled()

    middleware({ url: '/../package.json' }, { setHeader }, next)
    expect(createStream).not.toHaveBeenCalled()

    middleware(
      { url: '/maplibre-gl-worker.mjs.map#sourceURL' },
      { setHeader },
      next
    )
    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
    expect(createStream).toHaveBeenCalledTimes(1)
  })

  test('Should forward file stream errors to next middleware', () => {
    let errorHandler = () => {}
    const createStream = vi.fn(() => ({
      on: vi.fn((event, handler) => {
        if (event === 'error') {
          errorHandler = handler
        }
      }),
      pipe: vi.fn()
    }))
    const plugin = maplibreWorkerAssets({ createStream })
    const use = vi.fn()
    plugin.configureServer({ middlewares: { use } })
    const middleware = use.mock.calls[0][1]

    const next = vi.fn()
    middleware({ url: '/maplibre-gl-worker.mjs' }, { setHeader: vi.fn() }, next)

    const streamError = new Error('read failed')
    errorHandler(streamError)

    expect(next).toHaveBeenCalledWith(streamError)
  })
})
