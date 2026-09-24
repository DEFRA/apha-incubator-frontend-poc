import InteractiveMap from '@defra/interactive-map'
import maplibreProvider from '@defra/interactive-map/providers/maplibre'
import createDatasetsPlugin from '@defra/interactive-map/plugins/datasets'
import createMapKeyPlugin from '@defra/interactive-map/plugins/map-key'
import createInteractPlugin from '@defra/interactive-map/plugins/interact'
import '@defra/interactive-map/css'
import '@defra/interactive-map/plugins/map-key/css'

const maplibreWorkerUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/vendor/maplibre-gl/maplibre-gl-worker.mjs`

const ESRI_INFO_PANEL_ID = 'esri-feature-info'
const RASTER_SOURCE_ID = 'wild-birds-heatmap-source'
const RASTER_LAYER_ID = 'wild-birds-heatmap-layer'
const RASTER_TOGGLE_PANEL_ID = 'wild-birds-heatmap-toggle'
const notReported = 'Not reported'

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})

function formatDate(epochMs) {
  return typeof epochMs === 'number'
    ? dateFormatter.format(new Date(epochMs))
    : notReported
}

function parseFeatureCollection(scriptId) {
  const geojsonEl = document.getElementById(scriptId)

  return geojsonEl
    ? JSON.parse(geojsonEl.textContent)
    : { type: 'FeatureCollection', features: [] }
}

const highPathGeoJson = parseFeatureCollection('high-path-geojson')
const lowPathGeoJson = parseFeatureCollection('low-path-geojson')
const unknownGeoJson = parseFeatureCollection('unknown-geojson')

/**
 * Read the wild birds heatmap raster overlay payload
 * (`{ pngDataUrl, coordinates }`) embedded by the controller/template, or
 * `null` when the overlay could not be fetched/decoded server-side.
 * @returns {{pngDataUrl: string, coordinates: number[][]}|null} The raster
 *   overlay payload, or `null` when unavailable.
 */
function parseRasterOverlay() {
  const rasterEl = document.getElementById('raster-overlay')

  return rasterEl ? JSON.parse(rasterEl.textContent) : null
}

const rasterOverlay = parseRasterOverlay()

const combinedGeoJson = {
  type: 'FeatureCollection',
  features: [
    ...highPathGeoJson.features,
    ...lowPathGeoJson.features,
    ...unknownGeoJson.features
  ]
}

const datasetsPlugin = createDatasetsPlugin({
  datasets: [
    {
      id: 'esri-map-high-path',
      label: 'High path',
      geojson: highPathGeoJson,
      minZoom: 0,
      showInKey: true,
      showInMenu: true,
      style: {
        symbol: 'circle',
        symbolBackgroundColor: '#d61c1c'
      }
    },
    {
      id: 'esri-map-low-path',
      label: 'Low path',
      geojson: lowPathGeoJson,
      minZoom: 0,
      showInKey: true,
      showInMenu: true,
      style: {
        symbol: 'circle',
        symbolBackgroundColor: '#e8a020'
      }
    },
    {
      id: 'esri-map-unknown',
      label: 'Unknown',
      geojson: unknownGeoJson,
      minZoom: 0,
      showInKey: true,
      showInMenu: true,
      style: {
        symbol: 'circle',
        symbolBackgroundColor: '#6b7f99'
      }
    }
  ]
})

const mapKeyPlugin = createMapKeyPlugin()

const interactPlugin = createInteractPlugin({
  interactionModes: ['selectFeature'],
  layers: [
    { layerId: 'esri-map-high-path', idProperty: 'OBJECTID' },
    { layerId: 'esri-map-low-path', idProperty: 'OBJECTID' },
    { layerId: 'esri-map-unknown', idProperty: 'OBJECTID' }
  ]
})

const interactiveMap = new InteractiveMap('esri-map', {
  mapProvider: maplibreProvider({ workerUrl: maplibreWorkerUrl }),
  behaviour: 'hybrid',
  mapLabel: 'Esri map',
  zoom: 5,
  center: [-2, 54],
  containerHeight: '500px',
  enableFullscreen: true,
  plugins: [datasetsPlugin, mapKeyPlugin, interactPlugin],
  mapStyle: {
    url: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
    backgroundColor: '#f5f5f0'
  }
})

function renderFeatureInfo(properties) {
  const {
    Town,
    County,
    Country,
    Species,
    Virus_Isolated: virusIsolated,
    High_Path: highPath,
    Date_collected: dateCollected,
    Test_date: testDate
  } = properties

  return `
    <p class="govuk-body govuk-!-margin-bottom-1"><strong>${Town ?? notReported}</strong></p>
    <p class="govuk-body govuk-!-margin-bottom-1">${County ?? notReported}, ${Country ?? notReported}</p>
    <p class="govuk-body govuk-!-margin-bottom-1">Species: ${Species ?? notReported}</p>
    <p class="govuk-body govuk-!-margin-bottom-1">Virus isolated: ${virusIsolated ?? notReported}</p>
    <p class="govuk-body govuk-!-margin-bottom-1">High pathogenicity: ${highPath ?? notReported}</p>
    <p class="govuk-body govuk-!-margin-bottom-1">Date collected: ${formatDate(dateCollected)}</p>
    <p class="govuk-body govuk-!-margin-bottom-1">Test date: ${formatDate(testDate)}</p>
  `
}

/**
 * Run `callback` once the map's style has finished loading. MapLibre
 * throws if `addSource`/`addLayer` are called before the style is ready,
 * and `map:ready` can fire slightly before that point, so this guards
 * against the race by deferring to the next `styledata` event when
 * needed.
 * @param {object} map - The native MapLibre `Map` instance.
 * @param {Function} callback - Called once the style is loaded.
 */
function whenStyleLoaded(map, callback) {
  if (map.isStyleLoaded()) {
    callback()
  } else {
    map.once('styledata', () => whenStyleLoaded(map, callback))
  }
}

/**
 * Add the wild birds heatmap raster overlay to the map as a native
 * MapLibre `image` source + `raster` layer, with a manual visibility
 * toggle panel.
 *
 * This uses the native MapLibre `Map` instance passed in the `map:ready`
 * event payload (documented — see `EVENTS.MAP_READY` in
 * `@defra/interactive-map`). It still bypasses the Datasets plugin
 * entirely though, so there is no automatic legend/Map Key entry or
 * layer-menu item; both are built manually here.
 * @param {{pngDataUrl: string, coordinates: number[][]}} overlay - The
 *   raster overlay payload.
 * @param {object} map - The native MapLibre `Map` instance.
 */
function addRasterOverlay(overlay, map) {
  whenStyleLoaded(map, () => {
    map.addSource(RASTER_SOURCE_ID, {
      type: 'image',
      url: overlay.pngDataUrl,
      coordinates: overlay.coordinates
    })

    map.addLayer({
      id: RASTER_LAYER_ID,
      type: 'raster',
      source: RASTER_SOURCE_ID,
      paint: { 'raster-opacity': 0.75 }
    })
  })

  const checkboxId = `${RASTER_TOGGLE_PANEL_ID}-checkbox`

  interactiveMap.addPanel(RASTER_TOGGLE_PANEL_ID, {
    focus: false,
    label: 'Layers',
    html: `
      <div class="govuk-checkboxes__item">
        <input class="govuk-checkboxes__input" type="checkbox" id="${checkboxId}" checked>
        <label class="govuk-label govuk-checkboxes__label" for="${checkboxId}">
          Wild birds heatmap overlay
        </label>
      </div>
    `,
    mobile: { slot: 'drawer', dismissible: false },
    tablet: { slot: 'right-top', dismissible: false, width: '260px' },
    desktop: { slot: 'right-top', dismissible: false, width: '260px' }
  })

  // `addPanel` renders its HTML asynchronously (React), so the checkbox
  // may not exist in the DOM yet immediately after this call — listen via
  // delegation on `document` instead of looking the element up directly.
  document.addEventListener('change', (event) => {
    if (event.target.id !== checkboxId) {
      return
    }

    map.setLayoutProperty(
      RASTER_LAYER_ID,
      'visibility',
      event.target.checked ? 'visible' : 'none'
    )
  })
}

interactiveMap.on('map:ready', ({ map }) => {
  if (combinedGeoJson.features.length > 0) {
    interactiveMap.fitToBounds(combinedGeoJson)
  }

  if (rasterOverlay) {
    addRasterOverlay(rasterOverlay, map)
  }

  interactPlugin.enable()
  interactiveMap.addPanel(ESRI_INFO_PANEL_ID, {
    focus: false,
    label: 'Selected feature',
    html: `<div id="${ESRI_INFO_PANEL_ID}-content"></div>`,
    mobile: { slot: 'drawer', dismissible: true },
    tablet: { slot: 'left-top', dismissible: true, width: '300px' },
    desktop: { slot: 'left-top', dismissible: true, width: '300px' }
  })
})

interactiveMap.on('interact:selectionchange', ({ selectedFeatures }) => {
  if (selectedFeatures.length > 0) {
    document.getElementById(`${ESRI_INFO_PANEL_ID}-content`).innerHTML =
      renderFeatureInfo(selectedFeatures[0].properties)
    interactiveMap.showPanel(ESRI_INFO_PANEL_ID)
  } else {
    interactiveMap.hidePanel(ESRI_INFO_PANEL_ID)
  }
})

interactiveMap.on('app:panelclosed', ({ panelId }) => {
  if (panelId === ESRI_INFO_PANEL_ID) {
    interactPlugin.clear()
  }
})
