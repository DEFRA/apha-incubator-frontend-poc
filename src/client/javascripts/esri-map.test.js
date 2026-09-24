import { vi } from 'vitest'

const mockOn = vi.fn()
const mockFitToBounds = vi.fn()
const mockAddPanel = vi.fn()
const mockShowPanel = vi.fn()
const mockHidePanel = vi.fn()
const mockInteractiveMapConstructor = vi.fn()
const mockMaplibreProvider = vi.fn(() => 'maplibreProvider')
const mockCreateDatasetsPlugin = vi.fn((options) => ({
  id: 'datasetsPlugin',
  datasets: options.datasets
}))
const mockCreateMapKeyPlugin = vi.fn(() => ({
  id: 'mapKeyPlugin'
}))
const mockCreateInteractPlugin = vi.fn(() => ({
  id: 'interactPlugin',
  enable: vi.fn(),
  clear: vi.fn()
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

const sampleFeatureProperties = {
  OBJECTID: 42,
  Town: 'Wrexham',
  District: 'Wrexham',
  County: 'Wrexham County Borough Council',
  Country: 'Wales',
  Date_collected: 1634428800000,
  Species: 'Pheasant',
  Test_date: 1635379200000,
  Virus_Isolated: 'H5N1',
  High_Path: 'yes',
  Season: 21
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
vi.mock('@defra/interactive-map/plugins/interact', () => ({
  default: (...args) => mockCreateInteractPlugin(...args)
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
      this.addPanel = mockAddPanel
      this.showPanel = mockShowPanel
      this.hidePanel = mockHidePanel
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
          expect.objectContaining({ id: 'mapKeyPlugin' }),
          expect.objectContaining({ id: 'interactPlugin' })
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

  test('Should construct the interact plugin with selectFeature mode, OBJECTID idProperty, over all 3 layers', async () => {
    stubGeojsonScripts()

    await import('./esri-map.js')

    expect(mockCreateInteractPlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionModes: ['selectFeature'],
        layers: [
          expect.objectContaining({
            layerId: 'esri-map-high-path',
            idProperty: 'OBJECTID'
          }),
          expect.objectContaining({
            layerId: 'esri-map-low-path',
            idProperty: 'OBJECTID'
          }),
          expect.objectContaining({
            layerId: 'esri-map-unknown',
            idProperty: 'OBJECTID'
          })
        ]
      })
    )
  })

  test('Should enable the interact plugin and add the info panel when the map is ready', async () => {
    stubGeojsonScripts()

    await import('./esri-map.js')

    const [, mapReadyHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'map:ready'
    )
    const interactPlugin = mockCreateInteractPlugin.mock.results[0].value

    mapReadyHandler()

    expect(interactPlugin.enable).toHaveBeenCalled()
    expect(mockAddPanel).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ label: expect.any(String) })
    )
  })

  test('Should render the feature info panel with all fields and show the panel on selection', async () => {
    stubGeojsonScripts()

    await import('./esri-map.js')

    const [, selectionChangeHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'interact:selectionchange'
    )
    const panelContent = { innerHTML: '' }
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => panelContent)
    })

    selectionChangeHandler({
      selectedFeatures: [{ properties: sampleFeatureProperties }]
    })

    expect(panelContent.innerHTML).toContain('Wrexham')
    expect(panelContent.innerHTML).toContain('Wrexham County Borough Council')
    expect(panelContent.innerHTML).toContain('Wales')
    expect(panelContent.innerHTML).toContain('Pheasant')
    expect(panelContent.innerHTML).toContain('H5N1')
    expect(panelContent.innerHTML).toContain('yes')
    expect(panelContent.innerHTML).toContain('17 October 2021')
    expect(panelContent.innerHTML).toContain('28 October 2021')
    expect(mockShowPanel).toHaveBeenCalledWith(expect.any(String))
  })

  test('Should render "Not reported" fallback text for missing properties', async () => {
    stubGeojsonScripts()

    await import('./esri-map.js')

    const [, selectionChangeHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'interact:selectionchange'
    )
    const panelContent = { innerHTML: '' }
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => panelContent)
    })

    selectionChangeHandler({
      selectedFeatures: [{ properties: { OBJECTID: 1 } }]
    })

    expect(panelContent.innerHTML.match(/Not reported/g)).toHaveLength(8)
  })

  test('Should hide the panel when the selection is cleared', async () => {
    stubGeojsonScripts()

    await import('./esri-map.js')

    const [, selectionChangeHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'interact:selectionchange'
    )

    selectionChangeHandler({ selectedFeatures: [] })

    expect(mockHidePanel).toHaveBeenCalledWith(expect.any(String))
  })

  test('Should clear the interact plugin selection when this panel is closed', async () => {
    stubGeojsonScripts()

    await import('./esri-map.js')

    const [, mapReadyHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'map:ready'
    )
    const [, panelClosedHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'app:panelclosed'
    )
    const interactPlugin = mockCreateInteractPlugin.mock.results[0].value

    // map:ready registers the panel, so we know the real panel ID used.
    mapReadyHandler()
    const [registeredPanelId] = mockAddPanel.mock.calls[0]

    panelClosedHandler({ panelId: registeredPanelId })

    expect(interactPlugin.clear).toHaveBeenCalled()
  })
})
