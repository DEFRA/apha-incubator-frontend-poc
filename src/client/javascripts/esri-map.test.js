import { vi } from 'vitest'

const mockOn = vi.fn()
const mockFitToBounds = vi.fn()
const mockInteractiveMapConstructor = vi.fn()
const mockMaplibreProvider = vi.fn(() => 'maplibreProvider')
const mockCreateDatasetsPlugin = vi.fn((options) => ({
  id: 'datasetsPlugin',
  datasets: options.datasets
}))
const mockCreateMapKeyPlugin = vi.fn(() => ({
  id: 'mapKeyPlugin'
}))

const highPathGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-1.1, 52.1] },
      properties: { High_Path: 'yes', id: 'high-1' }
    }
  ]
}

const lowPathGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-1.2, 52.2] },
      properties: { High_Path: 'no', id: 'low-1' }
    }
  ]
}

const unknownGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-1.3, 52.3] },
      properties: { id: 'unknown-1' }
    }
  ]
}

vi.mock('@defra/interactive-map/providers/maplibre', () => ({
  default: (...args) => mockMaplibreProvider(...args)
}))
vi.mock('@defra/interactive-map/plugins/datasets', () => ({
  default: (...args) => mockCreateDatasetsPlugin(...args)
}))
vi.mock('@defra/interactive-map/plugins/map-key', () => ({
  default: (...args) => mockCreateMapKeyPlugin(...args)
}))
vi.mock('@defra/interactive-map/css', () => ({}))
vi.mock('@defra/interactive-map/plugins/map-key/css', () => ({}))

function createTestElement(tagName, id = null) {
  return {
    tagName,
    id,
    className: '',
    textContent: '',
    style: {},
    children: [],
    appendChild(child) {
      this.children.push(child)
      return child
    }
  }
}

function stubGeojsonScripts({
  highPath = highPathGeoJson,
  lowPath = lowPathGeoJson,
  unknown = unknownGeoJson
} = {}) {
  const mapContainer = createTestElement('div', 'esri-map')
  const nodes = {
    'esri-map': mapContainer,
    'high-path-geojson': { textContent: JSON.stringify(highPath) },
    'low-path-geojson': { textContent: JSON.stringify(lowPath) },
    'unknown-geojson': { textContent: JSON.stringify(unknown) }
  }

  vi.stubGlobal('document', {
    createElement: vi.fn((tagName) => createTestElement(tagName)),
    getElementById: vi.fn((id) => nodes[id] ?? null)
  })

  return { mapContainer }
}

function renderLegendFromPlugins(plugins) {
  const mapContainer = document.getElementById('esri-map')
  const datasetsPlugin = plugins.find(
    (plugin) => plugin?.id === 'datasetsPlugin'
  )
  const mapKeyPlugin = plugins.find((plugin) => plugin?.id === 'mapKeyPlugin')

  if (!mapContainer || !datasetsPlugin || !mapKeyPlugin) {
    return
  }

  const legend = document.createElement('section')
  legend.className = 'map-key'

  datasetsPlugin.datasets
    .filter((dataset) => dataset.showInKey)
    .forEach((dataset) => {
      const item = document.createElement('div')
      const swatch = document.createElement('span')
      const label = document.createElement('span')

      item.className = 'map-key-item'
      swatch.className = 'map-key-swatch'
      swatch.style.backgroundColor = dataset.style.symbolBackgroundColor
      label.className = 'map-key-label'
      label.textContent = dataset.label

      item.appendChild(swatch)
      item.appendChild(label)
      legend.appendChild(item)
    })

  mapContainer.appendChild(legend)
}

vi.mock('@defra/interactive-map', () => ({
  default: class InteractiveMap {
    constructor(...args) {
      const [, options] = args

      mockInteractiveMapConstructor(...args)
      renderLegendFromPlugins(options.plugins)
      this.on = mockOn
      this.fitToBounds = mockFitToBounds
    }
  }
}))

describe('#esriMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('Should construct the interactive map with 3 datasets built from the embedded GeoJSON collections', async () => {
    stubGeojsonScripts()

    await import('./esri-map.js')

    const datasetsPlugin = mockCreateDatasetsPlugin.mock.results[0].value

    expect(mockInteractiveMapConstructor).toHaveBeenCalledWith(
      'esri-map',
      expect.objectContaining({
        plugins: [
          datasetsPlugin,
          expect.objectContaining({ id: 'mapKeyPlugin' })
        ]
      })
    )

    const { datasets } = mockCreateDatasetsPlugin.mock.calls[0][0]
    const byId = Object.fromEntries(
      datasets.map((dataset) => [dataset.id, dataset])
    )

    expect(datasets).toHaveLength(3)
    expect(byId['esri-map-high-path']).toEqual(
      expect.objectContaining({
        label: 'High path',
        geojson: highPathGeoJson,
        showInKey: true,
        showInMenu: true,
        style: expect.objectContaining({
          symbol: 'circle',
          symbolBackgroundColor: '#d61c1c'
        })
      })
    )
    expect(byId['esri-map-low-path']).toEqual(
      expect.objectContaining({
        label: 'Low path',
        geojson: lowPathGeoJson,
        showInKey: true,
        showInMenu: true,
        style: expect.objectContaining({
          symbol: 'circle',
          symbolBackgroundColor: '#e8a020'
        })
      })
    )
    expect(byId['esri-map-unknown']).toEqual(
      expect.objectContaining({
        label: 'Unknown',
        geojson: unknownGeoJson,
        showInKey: true,
        showInMenu: true,
        style: expect.objectContaining({
          symbol: 'circle',
          symbolBackgroundColor: '#6b7f99'
        })
      })
    )
  })

  test('Should add a labels-only map key with 3 legend entries and the correct colours', async () => {
    const { mapContainer } = stubGeojsonScripts()

    await import('./esri-map.js')

    expect(mockCreateMapKeyPlugin).toHaveBeenCalledWith()

    const [legend] = mapContainer.children
    const legendEntries = legend.children.map((item) => ({
      colour: item.children[0].style.backgroundColor,
      label: item.children[1].textContent,
      childCount: item.children.length
    }))

    expect(legendEntries).toEqual([
      { label: 'High path', colour: '#d61c1c', childCount: 2 },
      { label: 'Low path', colour: '#e8a020', childCount: 2 },
      { label: 'Unknown', colour: '#6b7f99', childCount: 2 }
    ])
  })

  test('Should not call fitToBounds when all 3 embedded collections are empty', async () => {
    stubGeojsonScripts({
      highPath: { type: 'FeatureCollection', features: [] },
      lowPath: { type: 'FeatureCollection', features: [] },
      unknown: { type: 'FeatureCollection', features: [] }
    })

    await import('./esri-map.js')

    const [, mapReadyHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'map:ready'
    )

    mapReadyHandler()

    expect(mockFitToBounds).not.toHaveBeenCalled()
  })

  test('Should call fitToBounds with the combined features when at least one collection has data', async () => {
    stubGeojsonScripts()

    await import('./esri-map.js')

    const [, mapReadyHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'map:ready'
    )

    mapReadyHandler()

    expect(mockFitToBounds).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [
        ...highPathGeoJson.features,
        ...lowPathGeoJson.features,
        ...unknownGeoJson.features
      ]
    })
  })
})
