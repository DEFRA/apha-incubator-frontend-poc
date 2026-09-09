import { buildOutbreaksGeoJSON } from './latest-cases-geojson.js'

describe('#buildOutbreaksGeoJSON', () => {
  test('Should map outbreaks with valid lat/long to features with [longitude, latitude] coordinate order', () => {
    const outbreaks = [
      {
        outbreakId: 1,
        eventId: 7750,
        country: 'Sweden',
        disease: 'Influenza A viruses of high pathogenicity',
        adminDivision: 'Västra Götaland',
        location: 'Orust',
        startDate: '2026-07-31T00:00:00.000Z',
        endDate: null,
        latitude: 58.17464,
        longitude: 11.39947,
        category: 'follow_up_active',
        categoryLabel: 'Follow-up — event ongoing',
        plotted: true,
        isCluster: false,
        clusterCount: null,
        locationApprox: false,
        provenanceUrl: 'https://wahis.woah.org/#/in-review/7750'
      }
    ]

    const result = buildOutbreaksGeoJSON(outbreaks)

    expect(result).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [11.39947, 58.17464] },
          properties: {
            eventId: 7750,
            outbreakId: 1,
            disease: 'Influenza A viruses of high pathogenicity',
            country: 'Sweden',
            location: 'Orust',
            adminDivision: 'Västra Götaland',
            startDate: '2026-07-31T00:00:00.000Z',
            endDate: null,
            isCluster: false,
            clusterCount: null,
            locationApprox: false,
            category: 'follow_up_active',
            categoryLabel: 'Follow-up — event ongoing'
          }
        }
      ]
    })
  })

  test('Should exclude outbreaks that are not plotted', () => {
    const outbreaks = [
      {
        outbreakId: 1,
        eventId: 1,
        country: 'France',
        disease: 'Disease',
        adminDivision: 'Admin',
        location: 'Location',
        startDate: null,
        endDate: null,
        latitude: null,
        longitude: 2.5,
        category: 'follow_up_active',
        categoryLabel: 'Follow-up — event ongoing',
        plotted: false,
        isCluster: null,
        clusterCount: null,
        locationApprox: null,
        provenanceUrl: 'https://wahis.woah.org/#/in-review/1'
      }
    ]

    expect(buildOutbreaksGeoJSON(outbreaks)).toEqual({
      type: 'FeatureCollection',
      features: []
    })
  })

  test('Should carry the category property through into feature properties for all 3 categories', () => {
    const outbreaks = [
      {
        outbreakId: 1,
        eventId: 100,
        country: 'France',
        disease: 'Disease',
        adminDivision: 'Admin',
        location: 'Location',
        startDate: null,
        endDate: null,
        latitude: 48.8,
        longitude: 2.5,
        category: 'new_outbreak',
        categoryLabel: 'New outbreak',
        plotted: true,
        isCluster: null,
        clusterCount: null,
        locationApprox: null,
        provenanceUrl: 'https://wahis.woah.org/#/in-review/100'
      },
      {
        outbreakId: 2,
        eventId: 100,
        country: 'France',
        disease: 'Disease',
        adminDivision: 'Admin',
        location: 'Location',
        startDate: null,
        endDate: null,
        latitude: 48.8,
        longitude: 2.5,
        category: 'follow_up_active',
        categoryLabel: 'Follow-up — event ongoing',
        plotted: true,
        isCluster: null,
        clusterCount: null,
        locationApprox: null,
        provenanceUrl: 'https://wahis.woah.org/#/in-review/100'
      },
      {
        outbreakId: 3,
        eventId: 100,
        country: 'France',
        disease: 'Disease',
        adminDivision: 'Admin',
        location: 'Location',
        startDate: null,
        endDate: null,
        latitude: 48.8,
        longitude: 2.5,
        category: 'follow_up_resolved',
        categoryLabel: 'Follow-up — event resolved',
        plotted: true,
        isCluster: null,
        clusterCount: null,
        locationApprox: null,
        provenanceUrl: 'https://wahis.woah.org/#/in-review/100'
      }
    ]

    const result = buildOutbreaksGeoJSON(outbreaks)

    expect(result.features.map((f) => f.properties.category)).toEqual([
      'new_outbreak',
      'follow_up_active',
      'follow_up_resolved'
    ])
  })

  test('Should include categoryLabel in feature properties', () => {
    const outbreaks = [
      {
        outbreakId: 1,
        eventId: 1,
        country: 'France',
        disease: 'Disease',
        adminDivision: 'Admin',
        location: 'Location',
        startDate: null,
        endDate: null,
        latitude: 48.8,
        longitude: 2.5,
        category: 'new_outbreak',
        categoryLabel: 'New outbreak',
        plotted: true,
        isCluster: null,
        clusterCount: null,
        locationApprox: null,
        provenanceUrl: 'https://wahis.woah.org/#/in-review/1'
      }
    ]

    const result = buildOutbreaksGeoJSON(outbreaks)

    expect(result.features[0].properties.categoryLabel).toBe('New outbreak')
  })

  test('Should return an empty FeatureCollection when there are no outbreaks at all', () => {
    expect(buildOutbreaksGeoJSON([])).toEqual({
      type: 'FeatureCollection',
      features: []
    })
  })
})
