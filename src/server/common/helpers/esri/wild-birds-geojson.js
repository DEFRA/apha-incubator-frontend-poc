/**
 * Helpers for categorising wild bird GeoJSON features by High Pathogenicity
 * Avian Influenza (HPAI) status, ready for use with the `datasets` plugin.
 */

/**
 * Build an empty GeoJSON FeatureCollection.
 * @returns {{type: 'FeatureCollection', features: Array}} An empty feature collection.
 */
function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] }
}

/**
 * Determine which category a feature's `High_Path` property belongs to.
 * Matching is case-insensitive: only case-insensitive equality to "yes" or
 * "no" is recognised — any other value (including missing, null, undefined
 * or empty string) is categorised as "unknown".
 * @param {object} feature - A GeoJSON feature.
 * @returns {'high_path'|'low_path'|'unknown'} The category key.
 */
function categoriseFeature(feature) {
  const highPath = feature?.properties?.High_Path

  if (typeof highPath === 'string') {
    const normalised = highPath.toLowerCase()

    if (normalised === 'yes') {
      return 'high_path'
    }

    if (normalised === 'no') {
      return 'low_path'
    }
  }

  return 'unknown'
}

/**
 * Categorise wild bird GeoJSON features into high pathogenicity, low
 * pathogenicity and unknown groups, based on the `High_Path` property.
 * Handles missing/undefined input gracefully, returning empty feature
 * collections rather than throwing.
 * @param {{type: string, features: Array}} [featureCollection] - A GeoJSON FeatureCollection.
 * @returns {{
 *   high_path: {type: 'FeatureCollection', features: Array},
 *   low_path: {type: 'FeatureCollection', features: Array},
 *   unknown: {type: 'FeatureCollection', features: Array}
 * }} The categorised feature collections.
 */
export function categoriseWildBirdFeatures(featureCollection) {
  const groups = {
    high_path: emptyFeatureCollection(),
    low_path: emptyFeatureCollection(),
    unknown: emptyFeatureCollection()
  }

  const features = featureCollection?.features

  if (!Array.isArray(features)) {
    return groups
  }

  for (const feature of features) {
    const category = categoriseFeature(feature)
    groups[category].features.push(feature)
  }

  return groups
}
