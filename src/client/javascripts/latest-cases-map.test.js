import { vi } from 'vitest'

const mockOn = vi.fn()
const mockFitToBounds = vi.fn()
const mockAddPanel = vi.fn()
const mockShowPanel = vi.fn()
const mockHidePanel = vi.fn()
const mockInteractiveMapConstructor = vi.fn()
const mockMaplibreProvider = vi.fn(() => 'maplibreProvider')
const mockCreateDatasetsPlugin = vi.fn(() => 'datasetsPlugin')
const mockCreateInteractPlugin = vi.fn(() => ({
  enable: vi.fn(),
  clear: vi.fn()
}))

const sampleFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [11.39947, 58.17464] },
      properties: {
        eventId: 7750,
        outbreakId: 1,
        disease: 'Avian influenza',
        country: 'Sweden',
        location: 'Orust',
        adminDivision: 'Västra Götaland',
        startDate: '2026-07-31T00:00:00.000Z',
        endDate: null,
        isCluster: false,
        clusterCount: null,
        locationApprox: false,
        category: 'new_outbreak'
      }
    }
  ]
}

vi.mock('@defra/interactive-map', () => ({
  default: class InteractiveMap {
    constructor(...args) {
      mockInteractiveMapConstructor(...args)
      this.on = mockOn
      this.fitToBounds = mockFitToBounds
      this.addPanel = mockAddPanel
      this.showPanel = mockShowPanel
      this.hidePanel = mockHidePanel
    }
  }
}))
vi.mock('@defra/interactive-map/providers/maplibre', () => ({
  default: (...args) => mockMaplibreProvider(...args)
}))
vi.mock('@defra/interactive-map/plugins/datasets', () => ({
  default: (...args) => mockCreateDatasetsPlugin(...args)
}))
vi.mock('@defra/interactive-map/plugins/interact', () => ({
  default: (...args) => mockCreateInteractPlugin(...args)
}))
vi.mock('@defra/interactive-map/css', () => ({}))

function stubGeojsonScript(featureCollection) {
  const el = { textContent: JSON.stringify(featureCollection) }
  vi.stubGlobal('document', {
    getElementById: vi.fn((id) =>
      id === 'outbreaks-geojson' ? el : { innerHTML: '' }
    )
  })
}

describe('#latestCasesMap', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('Should construct the interactive map with the outbreaks dataset built from the embedded GeoJSON', async () => {
    stubGeojsonScript(sampleFeatureCollection)

    await import('./latest-cases-map.js')

    expect(mockInteractiveMapConstructor).toHaveBeenCalledWith(
      'latest-cases-map',
      expect.objectContaining({
        enableFullscreen: true,
        plugins: [
          'datasetsPlugin',
          expect.objectContaining({
            enable: expect.any(Function),
            clear: expect.any(Function)
          })
        ]
      })
    )
    expect(mockMaplibreProvider).toHaveBeenCalledWith({
      workerUrl: expect.stringContaining('maplibre-gl-worker')
    })
    expect(mockCreateDatasetsPlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        datasets: expect.arrayContaining([
          expect.objectContaining({
            id: 'latest-cases-new-outbreaks',
            geojson: sampleFeatureCollection
          })
        ])
      })
    )
  })

  test('Should fit bounds to the outbreaks and enable interaction when the underlying map is ready', async () => {
    stubGeojsonScript(sampleFeatureCollection)

    await import('./latest-cases-map.js')

    const [, mapReadyHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'map:ready'
    )
    const interactPlugin = mockCreateInteractPlugin.mock.results[0].value

    mapReadyHandler()

    expect(mockFitToBounds).toHaveBeenCalledWith(sampleFeatureCollection)
    expect(interactPlugin.enable).toHaveBeenCalled()
    expect(mockAddPanel).toHaveBeenCalledWith(
      'outbreak-info',
      expect.objectContaining({ label: 'Selected outbreak' })
    )
  })

  test('Should not call fitToBounds when there are no outbreak features', async () => {
    stubGeojsonScript({ type: 'FeatureCollection', features: [] })

    await import('./latest-cases-map.js')

    const [, mapReadyHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'map:ready'
    )

    mapReadyHandler()

    expect(mockFitToBounds).not.toHaveBeenCalled()
  })

  test('Should build 3 category datasets with distinct shape/colour styles, all shown in the legend', async () => {
    stubGeojsonScript(sampleFeatureCollection)

    await import('./latest-cases-map.js')

    const { datasets } = mockCreateDatasetsPlugin.mock.calls[0][0]

    expect(datasets).toHaveLength(3)
    const byId = Object.fromEntries(datasets.map((d) => [d.id, d]))

    expect(byId['latest-cases-new-outbreaks'].style).toEqual(
      expect.objectContaining({
        symbol: 'circle',
        symbolBackgroundColor: '#d61c1c'
      })
    )
    expect(byId['latest-cases-follow-up-active'].style).toEqual(
      expect.objectContaining({
        symbolBackgroundColor: '#e8a020'
      })
    )
    expect(byId['latest-cases-follow-up-resolved'].style).toEqual(
      expect.objectContaining({
        symbolBackgroundColor: '#6b7f99'
      })
    )
    datasets.forEach((dataset) => {
      expect(dataset.showInKey).toBe(true)
    })
  })

  test('Should place a follow-up feature with an unrecognised category into the follow-up-active dataset without crashing', async () => {
    stubGeojsonScript({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [1, 2] },
          properties: { outbreakId: 99, category: 'something_unexpected' }
        }
      ]
    })

    await expect(import('./latest-cases-map.js')).resolves.toBeDefined()

    const { datasets } = mockCreateDatasetsPlugin.mock.calls[0][0]
    const activeDataset = datasets.find(
      (d) => d.id === 'latest-cases-follow-up-active'
    )

    expect(activeDataset.geojson.features).toHaveLength(1)
    expect(activeDataset.geojson.features[0].properties.outbreakId).toBe(99)
  })

  test('Should show the panel with outbreak details on selection change, noting approximate locations', async () => {
    stubGeojsonScript(sampleFeatureCollection)

    await import('./latest-cases-map.js')

    const [, selectionChangeHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'interact:selectionchange'
    )
    const outbreakInfoContent = { innerHTML: '' }
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => outbreakInfoContent)
    })

    selectionChangeHandler({
      selectedFeatures: [
        {
          properties: {
            disease: 'Avian influenza',
            country: 'Sweden',
            location: 'Orust',
            locationApprox: true,
            category: 'new_outbreak'
          }
        }
      ]
    })

    expect(outbreakInfoContent.innerHTML).toContain('Avian influenza')
    expect(outbreakInfoContent.innerHTML).toContain('Location is approximate')
    expect(mockShowPanel).toHaveBeenCalledWith('outbreak-info')
  })

  test.each([
    ['new_outbreak', 'New outbreak'],
    ['follow_up_active', 'Follow-up — event ongoing'],
    ['follow_up_resolved', 'Follow-up — event resolved'],
    ['something_unexpected', 'Follow-up — event ongoing']
  ])(
    'Should show the category label "%s" -> "%s" in the info panel',
    async (category, expectedLabel) => {
      stubGeojsonScript(sampleFeatureCollection)

      await import('./latest-cases-map.js')

      const [, selectionChangeHandler] = mockOn.mock.calls.find(
        ([eventName]) => eventName === 'interact:selectionchange'
      )
      const outbreakInfoContent = { innerHTML: '' }
      vi.stubGlobal('document', {
        getElementById: vi.fn(() => outbreakInfoContent)
      })

      selectionChangeHandler({
        selectedFeatures: [{ properties: { category } }]
      })

      expect(outbreakInfoContent.innerHTML).toContain(expectedLabel)
    }
  )

  test('Should prefer the server-supplied categoryLabel when present', async () => {
    stubGeojsonScript(sampleFeatureCollection)

    await import('./latest-cases-map.js')

    const [, selectionChangeHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'interact:selectionchange'
    )
    const outbreakInfoContent = { innerHTML: '' }
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => outbreakInfoContent)
    })

    selectionChangeHandler({
      selectedFeatures: [
        {
          properties: {
            category: 'new_outbreak',
            categoryLabel: 'Custom server label'
          }
        }
      ]
    })

    expect(outbreakInfoContent.innerHTML).toContain('Custom server label')
  })

  test('Should fall back to the local category label when categoryLabel is absent', async () => {
    stubGeojsonScript(sampleFeatureCollection)

    await import('./latest-cases-map.js')

    const [, selectionChangeHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'interact:selectionchange'
    )
    const outbreakInfoContent = { innerHTML: '' }
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => outbreakInfoContent)
    })

    selectionChangeHandler({
      selectedFeatures: [
        {
          properties: {
            category: 'follow_up_active'
          }
        }
      ]
    })

    expect(outbreakInfoContent.innerHTML).toContain('Follow-up — event ongoing')
  })

  test('Should hide the panel when there is no selected feature', async () => {
    stubGeojsonScript(sampleFeatureCollection)

    await import('./latest-cases-map.js')

    const [, selectionChangeHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'interact:selectionchange'
    )

    selectionChangeHandler({ selectedFeatures: [] })

    expect(mockHidePanel).toHaveBeenCalledWith('outbreak-info')
  })

  test('Should clear the interact plugin selection when the outbreak info panel is closed', async () => {
    stubGeojsonScript(sampleFeatureCollection)

    await import('./latest-cases-map.js')

    const [, panelClosedHandler] = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'app:panelclosed'
    )
    const interactPlugin = mockCreateInteractPlugin.mock.results[0].value

    panelClosedHandler({ panelId: 'outbreak-info' })

    expect(interactPlugin.clear).toHaveBeenCalled()
  })
})
