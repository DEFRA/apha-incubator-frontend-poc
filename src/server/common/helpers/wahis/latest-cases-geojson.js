/**
 * Builds a GeoJSON `FeatureCollection` of WAHIS outbreak locations from a
 * flat array of outbreak records. Latitude and longitude are only ever
 * sourced from `outbreak.latitude` / `outbreak.longitude` (the
 * `OutbreakSummary` schema in `wahis-openapi.yaml`) — never invented,
 * hardcoded, or geocoded.
 *
 * Outbreaks with `plotted === false` (missing latitude or longitude) are
 * excluded from the map rather than plotted at a guessed location.
 * @param {Array<object>} outbreaks - Flat array from `buildOutbreakList`
 * @returns {{type: 'FeatureCollection', features: object[]}}
 */
export function buildOutbreaksGeoJSON(outbreaks = []) {
  const features = outbreaks
    .filter((outbreak) => outbreak.plotted === true)
    .map((outbreak) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        // GeoJSON coordinate order is [longitude, latitude] — do not swap.
        coordinates: [outbreak.longitude, outbreak.latitude]
      },
      properties: {
        eventId: outbreak.eventId,
        outbreakId: outbreak.outbreakId,
        disease: outbreak.disease,
        country: outbreak.country,
        location: outbreak.location,
        adminDivision: outbreak.adminDivision,
        startDate: outbreak.startDate,
        endDate: outbreak.endDate,
        isCluster: outbreak.isCluster,
        clusterCount: outbreak.clusterCount,
        locationApprox: outbreak.locationApprox,
        category: outbreak.category,
        categoryLabel: outbreak.categoryLabel
      }
    }))

  return { type: 'FeatureCollection', features }
}
