import { vi } from 'vitest'

import * as wahisClient from './wahis-client.js'
import * as latestCasesFilters from './latest-cases-filters.js'
import { getLatestCases } from './latest-cases-data.js'

vi.mock('./wahis-client.js', () => ({
  getFilteredEvents: vi.fn(),
  getReportAllInformation: vi.fn()
}))

vi.mock('./latest-cases-filters.js', () => ({
  resolveEuropeCountryIds: vi.fn().mockResolvedValue([16, 75]),
  resolveAvianInfluenzaDiseaseIds: vi.fn().mockResolvedValue([668, 671]),
  buildSubmissionDateWindow: vi
    .fn()
    .mockReturnValue({ from: '2026-08-26', to: '2026-09-03' })
}))

const now = new Date('2026-09-02T12:00:00.000Z')

function eventRow(overrides = {}) {
  return {
    eventId: 1,
    reportId: 1,
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
      from: '2026-08-26',
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
        submissionDate: { from: '2026-08-26', to: '2026-09-03' },
        sortColumn: 'submissionDate',
        sortOrder: 'DESC'
      }),
      expect.objectContaining({ logger: expect.anything() })
    )
  })

  test('Should drop rows older than seven days (rolling window cut)', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [
        eventRow({ eventId: 1, submissionDate: '2026-09-02T10:00:00.000Z' }), // 2h old
        eventRow({ eventId: 2, submissionDate: '2026-08-25T09:00:00.000Z' }) // 8d 3h old
      ]
    })
    wahisClient.getReportAllInformation.mockResolvedValue({ event: {} })

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
    wahisClient.getReportAllInformation.mockResolvedValue({ event: {} })

    const result = await getLatestCases({ now })

    expect(result.totalMatched).toBe(30)
    expect(result.truncated).toBe(true)
    expect(result.events).toHaveLength(25)
  })

  test('Should tolerate an individual report detail failure without failing the whole page', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [
        eventRow({ eventId: 1, reportId: 1 }),
        eventRow({
          eventId: 2,
          reportId: 2,
          submissionDate: '2026-09-02T11:00:00.000Z'
        })
      ]
    })
    wahisClient.getReportAllInformation.mockImplementation((reportId) =>
      reportId === 1
        ? Promise.reject(new Error('upstream failure'))
        : Promise.resolve({ event: { eventId: 2 } })
    )

    const result = await getLatestCases({ now })

    expect(result.partialFailures).toBe(true)
    const failed = result.events.find((event) => event.summary.eventId === 1)
    const ok = result.events.find((event) => event.summary.eventId === 2)
    expect(failed.detailError).toBe(true)
    expect(failed.detail).toBeNull()
    expect(ok.detailError).toBe(false)
    expect(ok.detail).toEqual({ event: { eventId: 2 }, outbreaks: [] })
  })

  test('Should call getReportAllInformation with row.reportId, not row.eventId', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [eventRow({ eventId: 1, reportId: 185574 })]
    })
    wahisClient.getReportAllInformation.mockResolvedValueOnce({
      event: {},
      outbreaks: []
    })

    await getLatestCases({ now })

    expect(wahisClient.getReportAllInformation).toHaveBeenCalledWith(
      185574,
      expect.objectContaining({ logger: expect.anything() })
    )
  })

  test('Should independently fetch and filter detail for two reports on the same event', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [
        eventRow({
          eventId: 1,
          reportId: 100,
          submissionDate: '2026-09-02T09:00:00.000Z'
        }),
        eventRow({
          eventId: 1,
          reportId: 200,
          submissionDate: '2026-09-02T11:00:00.000Z'
        })
      ]
    })
    wahisClient.getReportAllInformation.mockImplementation((reportId) =>
      Promise.resolve({
        event: {},
        outbreaks: [{ outbreakId: reportId, createdByReportId: reportId }]
      })
    )

    const result = await getLatestCases({ now })

    expect(wahisClient.getReportAllInformation).toHaveBeenCalledWith(
      100,
      expect.anything()
    )
    expect(wahisClient.getReportAllInformation).toHaveBeenCalledWith(
      200,
      expect.anything()
    )
    expect(result.events).toHaveLength(2)
    expect(result.events[0].detail.outbreaks).toEqual([
      { outbreakId: 100, createdByReportId: 100, category: 'new_outbreak' }
    ])
    expect(result.events[1].detail.outbreaks).toEqual([
      { outbreakId: 200, createdByReportId: 200, category: 'new_outbreak' }
    ])
  })

  test("Should only keep outbreaks introduced by the recent report, regardless of the outbreak's own historical startDate", async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [eventRow({ eventId: 1, reportId: 185574 })]
    })
    wahisClient.getReportAllInformation.mockResolvedValueOnce({
      event: {},
      outbreaks: [
        // Introduced by the report submitted in the last seven days.
        {
          outbreakId: 1,
          createdByReportId: 185574,
          startDate: '2020-01-01T00:00:00.000Z' // old outbreak, newly reported
        },
        // Introduced by an earlier report — must not appear.
        { outbreakId: 2, createdByReportId: 185500 }
      ]
    })

    const result = await getLatestCases({ now })

    expect(result.events[0].detail.outbreaks).toEqual([
      {
        outbreakId: 1,
        createdByReportId: 185574,
        startDate: '2020-01-01T00:00:00.000Z',
        category: 'new_outbreak'
      }
    ])
  })

  test('Should leave a FUR report with no matching createdByReportId as empty, no fallback', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [eventRow({ eventId: 1, reportId: 185574, reportType: 'FUR' })]
    })
    wahisClient.getReportAllInformation.mockResolvedValueOnce({
      event: {},
      outbreaks: [{ outbreakId: 2, createdByReportId: 185500 }]
    })

    const result = await getLatestCases({ now })

    expect(result.events[0].detail.outbreaks).toEqual([])
    expect(result.events[0].detailError).toBe(false)
  })

  test('Should fall back to all outbreaks for an IN report with no matching createdByReportId', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [eventRow({ eventId: 1, reportId: 185574, reportType: 'IN' })]
    })
    wahisClient.getReportAllInformation.mockResolvedValueOnce({
      event: {},
      outbreaks: [
        { outbreakId: 1, createdByReportId: null },
        { outbreakId: 2, createdByReportId: undefined }
      ]
    })

    const result = await getLatestCases({ now })

    expect(result.events[0].detail.outbreaks).toEqual([
      { outbreakId: 1, createdByReportId: null, category: 'new_outbreak' },
      { outbreakId: 2, createdByReportId: undefined, category: 'new_outbreak' }
    ])
  })

  test("Should tag an IN report's newly introduced outbreak as new_outbreak", async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [eventRow({ eventId: 1, reportId: 185574, reportType: 'IN' })]
    })
    wahisClient.getReportAllInformation.mockResolvedValueOnce({
      event: {},
      outbreaks: [{ outbreakId: 1, createdByReportId: 185574 }]
    })

    const result = await getLatestCases({ now })

    expect(result.events[0].detail.outbreaks).toEqual([
      { outbreakId: 1, createdByReportId: 185574, category: 'new_outbreak' }
    ])
  })

  test("Should tag a FUR report's updated outbreak as follow_up_active when the event is ongoing", async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [
        eventRow({
          eventId: 1,
          reportId: 185574,
          reportType: 'FUR',
          eventStatus: 'ongoing'
        })
      ]
    })
    wahisClient.getReportAllInformation.mockResolvedValueOnce({
      event: {},
      outbreaks: [{ outbreakId: 1, lastUpdateReportId: 185574 }]
    })

    const result = await getLatestCases({ now })

    expect(result.events[0].detail.outbreaks).toEqual([
      {
        outbreakId: 1,
        lastUpdateReportId: 185574,
        category: 'follow_up_active'
      }
    ])
  })

  test("Should tag a FUR report's updated outbreak as follow_up_resolved when the event is resolved", async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [
        eventRow({
          eventId: 1,
          reportId: 185574,
          reportType: 'FUR',
          eventStatus: 'resolved'
        })
      ]
    })
    wahisClient.getReportAllInformation.mockResolvedValueOnce({
      event: {},
      outbreaks: [{ outbreakId: 1, lastUpdateReportId: 185574 }]
    })

    const result = await getLatestCases({ now })

    expect(result.events[0].detail.outbreaks).toEqual([
      {
        outbreakId: 1,
        lastUpdateReportId: 185574,
        category: 'follow_up_resolved'
      }
    ])
  })

  test('Should fall back to follow_up_active when a FUR report has an unrecognised eventStatus', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [
        eventRow({
          eventId: 1,
          reportId: 185574,
          reportType: 'FUR',
          eventStatus: 'something-unexpected'
        })
      ]
    })
    wahisClient.getReportAllInformation.mockResolvedValueOnce({
      event: {},
      outbreaks: [{ outbreakId: 1, lastUpdateReportId: 185574 }]
    })

    const result = await getLatestCases({ now })

    expect(result.events[0].detail.outbreaks).toEqual([
      {
        outbreakId: 1,
        lastUpdateReportId: 185574,
        category: 'follow_up_active'
      }
    ])
  })

  test('Should fall back to follow_up_active for a report whose reportType is neither IN nor FUR', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [
        eventRow({
          eventId: 1,
          reportId: 185574,
          reportType: 'UNKNOWN_TYPE',
          eventStatus: 'ongoing'
        })
      ]
    })
    wahisClient.getReportAllInformation.mockResolvedValueOnce({
      event: {},
      outbreaks: [{ outbreakId: 1, lastUpdateReportId: 185574 }]
    })

    const result = await getLatestCases({ now })

    expect(result.events[0].detail.outbreaks).toEqual([
      {
        outbreakId: 1,
        lastUpdateReportId: 185574,
        category: 'follow_up_active'
      }
    ])
  })

  test('Should not double-count an outbreak that is both newly created and last-updated by the same report', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [
        eventRow({
          eventId: 1,
          reportId: 185574,
          reportType: 'FUR',
          eventStatus: 'ongoing'
        })
      ]
    })
    wahisClient.getReportAllInformation.mockResolvedValueOnce({
      event: {},
      outbreaks: [
        {
          outbreakId: 1,
          createdByReportId: 185574,
          lastUpdateReportId: 185574
        }
      ]
    })

    const result = await getLatestCases({ now })

    expect(result.events[0].detail.outbreaks).toEqual([
      {
        outbreakId: 1,
        createdByReportId: 185574,
        lastUpdateReportId: 185574,
        category: 'new_outbreak'
      }
    ])
  })

  test('Should log a follow-up outbreak count alongside the existing new outbreak counts', async () => {
    wahisClient.getFilteredEvents.mockResolvedValueOnce({
      list: [
        eventRow({
          eventId: 1,
          reportId: 185574,
          reportType: 'FUR',
          eventStatus: 'ongoing'
        })
      ]
    })
    wahisClient.getReportAllInformation.mockResolvedValueOnce({
      event: {},
      outbreaks: [{ outbreakId: 1, lastUpdateReportId: 185574 }]
    })

    const infoLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn()
    }
    await getLatestCases({ now, logger: infoLogger })

    expect(infoLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ totalFollowUpOutbreaks: 1 }),
      expect.any(String)
    )
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
