import InteractiveMap from '@defra/interactive-map'
import maplibreProvider from '@defra/interactive-map/providers/maplibre'
import createDatasetsPlugin from '@defra/interactive-map/plugins/datasets'
import createMapKeyPlugin from '@defra/interactive-map/plugins/map-key'
import createInteractPlugin from '@defra/interactive-map/plugins/interact'
import '@defra/interactive-map/css'
import '@defra/interactive-map/plugins/map-key/css'

const maplibreWorkerUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/vendor/maplibre-gl/maplibre-gl-worker.mjs`

const ESRI_INFO_PANEL_ID = 'esri-feature-info'
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

interactiveMap.on('map:ready', () => {
  if (combinedGeoJson.features.length > 0) {
    interactiveMap.fitToBounds(combinedGeoJson)
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
