import { vi } from 'vitest'

import * as wahisClient from './wahis-client.js'
import {
  FALLBACK_AVIAN_INFLUENZA_DISEASE_IDS,
  FALLBACK_EUROPE_AREA_IDS,
  buildSubmissionDateWindow,
  resetLatestCasesFilterCache,
  resolveAvianInfluenzaDiseaseIds,
  resolveEuropeCountryIds
} from './latest-cases-filters.js'

vi.mock('./wahis-client.js', () => ({
  getGeoRegions: vi.fn(),
  getFirstLevelDiseases: vi.fn()
}))

describe('#buildSubmissionDateWindow', () => {
  test('Should return the day before and the day after "now", per the exclusive-to boundary rule', () => {
    const now = new Date('2026-09-02T14:00:00.000Z')

    expect(buildSubmissionDateWindow(now)).toEqual({
      from: '2026-09-01',
      to: '2026-09-03'
    })
  })
})

describe('#resolveEuropeCountryIds', () => {
  beforeEach(() => {
    resetLatestCasesFilterCache()
    vi.clearAllMocks()
  })

  test('Should return the live Europe countryIds when list-geo-region resolves', async () => {
    wahisClient.getGeoRegions.mockResolvedValueOnce([
      { id: 4, name: 'Europe', countryIds: [16, 75] },
      { id: 2, name: 'Americas', countryIds: [1] }
    ])

    await expect(resolveEuropeCountryIds()).resolves.toEqual([16, 75])
  })

  test('Should fall back to the static list when the lookup fails', async () => {
    wahisClient.getGeoRegions.mockRejectedValueOnce(new Error('boom'))

    await expect(resolveEuropeCountryIds()).resolves.toEqual(
      FALLBACK_EUROPE_AREA_IDS
    )
  })

  test('Should fall back to the static list when no Europe entry is found', async () => {
    wahisClient.getGeoRegions.mockResolvedValueOnce([
      { id: 2, name: 'Americas', countryIds: [1] }
    ])

    await expect(resolveEuropeCountryIds()).resolves.toEqual(
      FALLBACK_EUROPE_AREA_IDS
    )
  })

  test('Should cache the result rather than re-fetching on every call', async () => {
    wahisClient.getGeoRegions.mockResolvedValueOnce([
      { id: 4, name: 'Europe', countryIds: [16] }
    ])

    await resolveEuropeCountryIds()
    await resolveEuropeCountryIds()

    expect(wahisClient.getGeoRegions).toHaveBeenCalledTimes(1)
  })
})

describe('#resolveAvianInfluenzaDiseaseIds', () => {
  beforeEach(() => {
    resetLatestCasesFilterCache()
    vi.clearAllMocks()
  })

  test('Should match live avian influenza entries by name', async () => {
    wahisClient.getFirstLevelDiseases.mockResolvedValueOnce([
      {
        ids: [668],
        name: 'High pathogenicity avian influenza viruses (Inf. with) (poultry)'
      },
      {
        ids: [671],
        name: 'Influenza A viruses of high pathogenicity (Inf. with) (non-poultry including wild birds) (2017-)'
      },
      { ids: [55], name: 'African swine fever virus (Inf. with) ' }
    ])

    await expect(resolveAvianInfluenzaDiseaseIds()).resolves.toEqual([668, 671])
  })

  test('Should fall back to the static ids when the lookup fails', async () => {
    wahisClient.getFirstLevelDiseases.mockRejectedValueOnce(new Error('boom'))

    await expect(resolveAvianInfluenzaDiseaseIds()).resolves.toEqual(
      FALLBACK_AVIAN_INFLUENZA_DISEASE_IDS
    )
  })

  test('Should fall back to the static ids when no match is found', async () => {
    wahisClient.getFirstLevelDiseases.mockResolvedValueOnce([
      { ids: [55], name: 'African swine fever virus (Inf. with) ' }
    ])

    await expect(resolveAvianInfluenzaDiseaseIds()).resolves.toEqual(
      FALLBACK_AVIAN_INFLUENZA_DISEASE_IDS
    )
  })
})
