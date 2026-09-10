import { vi } from 'vitest'
import config from './vite.config.js'

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
})
