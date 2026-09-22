import InteractiveMap from '@defra/interactive-map'
import maplibreProvider from '@defra/interactive-map/providers/maplibre'
import createDatasetsPlugin from '@defra/interactive-map/plugins/datasets'
import createMapKeyPlugin from '@defra/interactive-map/plugins/map-key'
import '@defra/interactive-map/css'
import '@defra/interactive-map/plugins/map-key/css'

const maplibreWorkerUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/vendor/maplibre-gl/maplibre-gl-worker.mjs`

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

const interactiveMap = new InteractiveMap('esri-map', {
  mapProvider: maplibreProvider({ workerUrl: maplibreWorkerUrl }),
  behaviour: 'hybrid',
  mapLabel: 'Esri map',
  zoom: 5,
  center: [-2, 54],
  containerHeight: '500px',
  enableFullscreen: true,
  plugins: [datasetsPlugin, mapKeyPlugin],
  mapStyle: {
    url: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
    backgroundColor: '#f5f5f0'
  }
})

interactiveMap.on('map:ready', () => {
  if (combinedGeoJson.features.length > 0) {
    interactiveMap.fitToBounds(combinedGeoJson)
  }
})
