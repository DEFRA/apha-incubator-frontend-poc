import { vi } from 'vitest'

import * as wahisClient from './wahis-client.js'
import * as latestCasesFilters from './latest-cases-filters.js'
import { getLatestCases } from './latest-cases-data.js'

vi.mock('./wahis-client.js', () => ({
  getFilteredEvents: vi.fn(),
  getEventAllInformation: vi.fn()
}))

vi.mock('./latest-cases-filters.js', () => ({
  resolveEuropeCountryIds: vi.fn().mockResolvedValue([16, 75]),
  resolveAvianInfluenzaDiseaseIds: vi.fn().mockResolvedValue([668, 671]),
  buildSubmissionDateWindow: vi
    .fn()
    .mockReturnValue({ from: '2026-09-01', to: '2026-09-03' })
}))

const now = new Date('2026-09-02T12:00:00.000Z')

function eventRow(overrides = {}) {
  return {
    eventId: 1,
    country: 'France',
    disease: 'High pathogenicity avian influenza viruses (Inf. with) (poultry)',
    submissionDate: '2026-09-02T10:00:00.000Z',
    ...overrides
  }
}

describe('#getLatestCases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    latestCasesFilters.resolveEuropeCountryIds.mockResolvedValue([16, 75])
    latestCasesFilters.resolveAvianInfluenzaDiseaseIds.mockResolvedValue([
      668, 671
    ])
    latestCasesFilters.buildSubmissionDateWindow.mockReturnValue({
      from: '2026-09-01',
      to: '2026-09-03'
    })
  })

  test('Should request the filtered list using the resolved scope', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({ list: [] })

    await getLatestCases({ now })

    expect(wahisClient.getFilteredEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        countries: [16, 75],
        firstDiseases: [668, 671],
        submissionDate: { from: '2026-09-01', to: '2026-09-03' },
        sortColumn: 'submissionDate',
        sortOrder: 'DESC'
      }),
      expect.objectContaining({ logger: expect.anything() })
    )
  })

  test('Should drop rows older than 24 hours (rolling window cut)', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [
        eventRow({ eventId: 1, submissionDate: '2026-09-02T10:00:00.000Z' }), // 2h old
        eventRow({ eventId: 2, submissionDate: '2026-09-01T09:00:00.000Z' }) // 27h old
      ]
    })
    wahisClient.getEventAllInformation.mockResolvedValue({ event: {} })

    const result = await getLatestCases({ now })

    expect(result.totalMatched).toBe(1)
    expect(result.events).toHaveLength(1)
    expect(result.events[0].summary.eventId).toBe(1)
  })

  test('Should truncate to maxDetailEvents and flag truncation', async () => {
    const rows = Array.from({ length: 30 }, (_, index) =>
      eventRow({ eventId: index, submissionDate: '2026-09-02T10:00:00.000Z' })
    )
    wahisClient.getFilteredEvents.mockResolvedValueOnce({ list: rows })
    wahisClient.getEventAllInformation.mockResolvedValue({ event: {} })

    const result = await getLatestCases({ now })

    expect(result.totalMatched).toBe(30)
    expect(result.truncated).toBe(true)
    expect(result.events).toHaveLength(25)
  })

  test('Should tolerate an individual event detail failure without failing the whole page', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [
        eventRow({ eventId: 1 }),
        eventRow({ eventId: 2, submissionDate: '2026-09-02T11:00:00.000Z' })
      ]
    })
    wahisClient.getEventAllInformation.mockImplementation((eventId) =>
      eventId === 1
        ? Promise.reject(new Error('upstream failure'))
        : Promise.resolve({ event: { eventId } })
    )

    const result = await getLatestCases({ now })

    expect(result.partialFailures).toBe(true)
    const failed = result.events.find((event) => event.summary.eventId === 1)
    const ok = result.events.find((event) => event.summary.eventId === 2)
    expect(failed.detailError).toBe(true)
    expect(failed.detail).toBeNull()
    expect(ok.detailError).toBe(false)
    expect(ok.detail).toEqual({ event: { eventId: 2 } })
  })

  test('Should report no partial failures and an empty event list when nothing matches', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({ list: [] })

    const result = await getLatestCases({ now })

    expect(result.events).toEqual([])
    expect(result.totalMatched).toBe(0)
    expect(result.truncated).toBe(false)
    expect(result.partialFailures).toBe(false)
  })
})
