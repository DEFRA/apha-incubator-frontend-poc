import { describe, expect, it } from 'vitest'
import { categoriseWildBirdFeatures } from './wild-birds-geojson.js'

/**
 * Build a minimal GeoJSON feature for test fixtures.
 * @param {string|null|undefined} [highPath] - The High_Path property value.
 * @param {object} [extraProperties] - Additional properties to merge in.
 * @returns {object} A GeoJSON feature.
 */
function makeFeature(highPath, extraProperties = {}) {
  const properties = { ...extraProperties }

  if (highPath !== undefined) {
    properties.High_Path = highPath
  }

  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-1.234, 51.234] },
    properties
  }
}

describe('categoriseWildBirdFeatures', () => {
  it('categorises features with mixed High_Path values', () => {
    const highFeature = makeFeature('yes', { id: 1 })
    const lowFeature = makeFeature('no', { id: 2 })
    const unknownFeature = makeFeature('maybe', { id: 3 })

    const result = categoriseWildBirdFeatures({
      type: 'FeatureCollection',
      features: [highFeature, lowFeature, unknownFeature]
    })

    expect(result.high_path).toEqual({
      type: 'FeatureCollection',
      features: [highFeature]
    })
    expect(result.low_path).toEqual({
      type: 'FeatureCollection',
      features: [lowFeature]
    })
    expect(result.unknown).toEqual({
      type: 'FeatureCollection',
      features: [unknownFeature]
    })
  })

  it('treats a missing High_Path property as unknown', () => {
    const featureWithoutProperty = makeFeature(undefined, { id: 1 })

    const result = categoriseWildBirdFeatures({
      type: 'FeatureCollection',
      features: [featureWithoutProperty]
    })

    expect(result.unknown.features).toEqual([featureWithoutProperty])
    expect(result.high_path.features).toEqual([])
    expect(result.low_path.features).toEqual([])
  })

  it('treats null and empty string High_Path as unknown', () => {
    const nullFeature = makeFeature(null, { id: 1 })
    const emptyFeature = makeFeature('', { id: 2 })

    const result = categoriseWildBirdFeatures({
      type: 'FeatureCollection',
      features: [nullFeature, emptyFeature]
    })

    expect(result.unknown.features).toEqual([nullFeature, emptyFeature])
    expect(result.high_path.features).toEqual([])
    expect(result.low_path.features).toEqual([])
  })

  it('matches High_Path case-insensitively', () => {
    const yesCapitalised = makeFeature('Yes', { id: 1 })
    const yesUpper = makeFeature('YES', { id: 2 })
    const noCapitalised = makeFeature('No', { id: 3 })
    const noUpper = makeFeature('NO', { id: 4 })

    const result = categoriseWildBirdFeatures({
      type: 'FeatureCollection',
      features: [yesCapitalised, yesUpper, noCapitalised, noUpper]
    })

    expect(result.high_path.features).toEqual([yesCapitalised, yesUpper])
    expect(result.low_path.features).toEqual([noCapitalised, noUpper])
    expect(result.unknown.features).toEqual([])
  })

  it('returns three empty feature collections for an empty features array', () => {
    const result = categoriseWildBirdFeatures({
      type: 'FeatureCollection',
      features: []
    })

    expect(result).toEqual({
      high_path: { type: 'FeatureCollection', features: [] },
      low_path: { type: 'FeatureCollection', features: [] },
      unknown: { type: 'FeatureCollection', features: [] }
    })
  })

  it('returns three empty feature collections for undefined input', () => {
    const result = categoriseWildBirdFeatures(undefined)

    expect(result).toEqual({
      high_path: { type: 'FeatureCollection', features: [] },
      low_path: { type: 'FeatureCollection', features: [] },
      unknown: { type: 'FeatureCollection', features: [] }
    })
  })

  it('returns three empty feature collections when features is missing', () => {
    const result = categoriseWildBirdFeatures({ type: 'FeatureCollection' })

    expect(result).toEqual({
      high_path: { type: 'FeatureCollection', features: [] },
      low_path: { type: 'FeatureCollection', features: [] },
      unknown: { type: 'FeatureCollection', features: [] }
    })
  })
})
