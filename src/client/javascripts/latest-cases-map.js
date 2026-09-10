/**
 * Latest cases map — client-side rendering module.
 *
 * Reads the WAHIS outbreak `FeatureCollection` embedded server-side (see
 * `latest-cases/index.njk` and `buildOutbreaksGeoJSON`) and renders it with
 * `@defra/interactive-map`, following the same pattern demonstrated in
 * `apha-incubator-maps-poc`'s `map.js`.
 *
 * Coordinates come only from WAHIS; this module never invents or geocodes
 * a location.
 */

import InteractiveMap from '@defra/interactive-map'
import maplibreProvider from '@defra/interactive-map/providers/maplibre'
import createDatasetsPlugin from '@defra/interactive-map/plugins/datasets'
import createInteractPlugin from '@defra/interactive-map/plugins/interact'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

import '@defra/interactive-map/css'

const NEW_OUTBREAK_LAYER_ID = 'latest-cases-new-outbreaks'
const FOLLOW_UP_ACTIVE_LAYER_ID = 'latest-cases-follow-up-active'
const FOLLOW_UP_RESOLVED_LAYER_ID = 'latest-cases-follow-up-resolved'
const OUTBREAK_INFO_PANEL_ID = 'outbreak-info'
const notReported = 'Not reported'

// Built-in filled-triangle icon path (16x16 space, centred at 8,8), matching
// `graphics.triangle` from the library's symbol config, used as the
// foreground `symbolGraphic` on follow-up datasets to distinguish them from
// the (default dot) new-outbreak dataset.
const TRIANGLE_GRAPHIC = 'M8 2L14 14H2Z'

const CATEGORY_LABELS = {
  new_outbreak: 'New outbreak',
  follow_up_active: 'Follow-up — event ongoing',
  follow_up_resolved: 'Follow-up — event resolved'
}
const FALLBACK_CATEGORY = 'follow_up_active'

const geojsonEl = document.getElementById('outbreaks-geojson')
const outbreaksGeoJson = geojsonEl
  ? JSON.parse(geojsonEl.textContent)
  : { type: 'FeatureCollection', features: [] }

function toFeatureCollection(features) {
  return { type: 'FeatureCollection', features }
}

/**
 * Splits features into their 3 confirmed categories (`new_outbreak` /
 * `follow_up_active` / `follow_up_resolved`), one dataset each, since the
 * datasets plugin only supports whole-dataset (not per-feature) styling.
 * An unrecognised/missing `category` falls back to `follow_up_active` —
 * visible but not overstated, matching the server-side fallback.
 *
 * Known PoC limitation: the previous `isCluster`/`locationApprox` halo and
 * opacity modifiers are dropped here, since the datasets plugin has no
 * per-feature style override to combine them with the 3 category datasets
 * without multiplying into up to 9 separate layers.
 */
function featuresByCategory(features) {
  const grouped = {
    new_outbreak: [],
    follow_up_active: [],
    follow_up_resolved: []
  }

  features.forEach((feature) => {
    const category = feature.properties.category
    const bucket = grouped[category] ? category : FALLBACK_CATEGORY
    grouped[bucket].push(feature)
  })

  return grouped
}

const categorisedFeatures = featuresByCategory(outbreaksGeoJson.features)

const datasetsPlugin = createDatasetsPlugin({
  datasets: [
    {
      id: NEW_OUTBREAK_LAYER_ID,
      label: 'New outbreak',
      geojson: toFeatureCollection(categorisedFeatures.new_outbreak),
      minZoom: 0,
      showInKey: true,
      showInMenu: true,
      style: {
        symbol: 'circle',
        symbolBackgroundColor: '#d61c1c',
        symbolForegroundColor: '#ffffff'
      }
    },
    {
      id: FOLLOW_UP_ACTIVE_LAYER_ID,
      label: 'Follow-up — event ongoing',
      geojson: toFeatureCollection(categorisedFeatures.follow_up_active),
      minZoom: 0,
      showInKey: true,
      showInMenu: true,
      style: {
        symbol: 'circle',
        symbolGraphic: TRIANGLE_GRAPHIC,
        symbolBackgroundColor: '#e8a020',
        symbolForegroundColor: '#ffffff'
      }
    },
    {
      id: FOLLOW_UP_RESOLVED_LAYER_ID,
      label: 'Follow-up — event resolved',
      geojson: toFeatureCollection(categorisedFeatures.follow_up_resolved),
      minZoom: 0,
      showInKey: true,
      showInMenu: true,
      style: {
        symbol: 'circle',
        symbolGraphic: TRIANGLE_GRAPHIC,
        symbolBackgroundColor: '#6b7f99',
        symbolForegroundColor: '#ffffff'
      }
    }
  ]
})

const interactPlugin = createInteractPlugin({
  interactionModes: ['selectFeature'],
  deselectOnClickOutside: true,
  layers: [
    {
      layerId: NEW_OUTBREAK_LAYER_ID,
      idProperty: 'outbreakId',
      labelProperty: 'location'
    },
    {
      layerId: FOLLOW_UP_ACTIVE_LAYER_ID,
      idProperty: 'outbreakId',
      labelProperty: 'location'
    },
    {
      layerId: FOLLOW_UP_RESOLVED_LAYER_ID,
      idProperty: 'outbreakId',
      labelProperty: 'location'
    }
  ]
})

const interactiveMap = new InteractiveMap('latest-cases-map', {
  mapProvider: maplibreProvider({ workerUrl: maplibreWorkerUrl }),
  behaviour: 'hybrid',
  mapLabel: 'Latest WAHIS cases',
  zoom: 3,
  center: [10, 50],
  containerHeight: '500px',
  enableFullscreen: true,
  plugins: [datasetsPlugin, interactPlugin],
  mapStyle: {
    url: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
    backgroundColor: '#f5f5f0'
  }
})

function formatDate(isoDate) {
  return isoDate ? new Date(isoDate).toLocaleDateString('en-GB') : notReported
}

function renderOutbreakInfo(properties) {
  const {
    disease,
    country,
    location,
    adminDivision,
    startDate,
    endDate,
    locationApprox,
    category,
    categoryLabel: serverCategoryLabel
  } = properties

  const place = location || adminDivision || notReported
  const categoryLabel =
    serverCategoryLabel ||
    CATEGORY_LABELS[category] ||
    CATEGORY_LABELS[FALLBACK_CATEGORY]

  return `
    <p class="govuk-body govuk-!-margin-bottom-1"><strong>${disease ?? notReported}</strong></p>
    <p class="govuk-body govuk-!-margin-bottom-1">${country ?? notReported} — ${place}</p>
    <p class="govuk-body govuk-!-margin-bottom-1">${categoryLabel}</p>
    <p class="govuk-body govuk-!-margin-bottom-1">Start: ${formatDate(startDate)}. End: ${formatDate(endDate)}.</p>
    ${locationApprox ? '<p class="govuk-body govuk-!-margin-bottom-1">Location is approximate</p>' : ''}
  `
}

interactiveMap.on('map:ready', () => {
  if (outbreaksGeoJson.features.length > 0) {
    interactiveMap.fitToBounds(outbreaksGeoJson)
  }

  interactPlugin.enable()
  interactiveMap.addPanel(OUTBREAK_INFO_PANEL_ID, {
    focus: false,
    label: 'Selected outbreak',
    html: `<div id="${OUTBREAK_INFO_PANEL_ID}-content"></div>`,
    mobile: { slot: 'drawer', dismissible: true },
    tablet: { slot: 'left-top', dismissible: true, width: '300px' },
    desktop: { slot: 'left-top', dismissible: true, width: '300px' }
  })
})

interactiveMap.on('interact:selectionchange', ({ selectedFeatures }) => {
  if (selectedFeatures.length > 0) {
    document.getElementById(`${OUTBREAK_INFO_PANEL_ID}-content`).innerHTML =
      renderOutbreakInfo(selectedFeatures[0].properties)
    interactiveMap.showPanel(OUTBREAK_INFO_PANEL_ID)
  } else {
    interactiveMap.hidePanel(OUTBREAK_INFO_PANEL_ID)
  }
})

interactiveMap.on('app:panelclosed', ({ panelId }) => {
  if (panelId === OUTBREAK_INFO_PANEL_ID) {
    interactPlugin.clear()
  }
})
