import * as cheerio from 'cheerio'
import { vi } from 'vitest'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { getLatestCases } from '#/server/common/helpers/wahis/latest-cases-data.js'

vi.mock('#/server/common/helpers/wahis/latest-cases-data.js', () => ({
  getLatestCases: vi.fn()
}))

describe('#latestCasesController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render the empty state when no events match', async () => {
    getLatestCases.mockResolvedValueOnce({
      events: [],
      totalMatched: 0,
      truncated: false,
      generatedAt: new Date('2026-09-02T12:00:00.000Z'),
      partialFailures: false
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/latest-cases'
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $ = cheerio.load(result)
    expect($('[data-testid="empty-state"]').length).toBe(1)
    expect($('[data-testid="latest-cases-accordion"]').length).toBe(0)
  })

  test('Should render an accordion section per event', async () => {
    getLatestCases.mockResolvedValueOnce({
      events: [
        {
          summary: {
            eventId: 7750,
            country: 'Sweden',
            disease:
              'Influenza A viruses of high pathogenicity (Inf. with) (non-poultry including wild birds) (2017-)',
            eventStatus: 'On-going',
            reportType: 'FUR',
            submissionDate: '2026-09-02T14:39:03.630Z'
          },
          detail: {
            event: {
              subType: { disease: { name: 'H5N1' } },
              causalAgent: { name: 'Highly pathogenic avian influenza virus' },
              reason: { translation: 'Recurrence of an eradicated disease' },
              eventStatus: { translation: 'On-going' },
              startedOn: '2026-07-21T00:00:00.000Z',
              confirmOn: '2026-08-04T00:00:00.000Z',
              endedOn: null
            },
            report: {
              reportStatus: { translation: 'Validated' },
              reportNumber: 4
            },
            outbreaks: [
              {
                adminDivision: 'Orust',
                location: 'Orust',
                startDate: '2026-07-31T00:00:00.000Z',
                endDate: '2026-07-31T00:00:00.000Z',
                latitude: 58.17464,
                longitude: 11.39947
              }
            ],
            quantitativeData: {
              unit: { translation: 'Animal' },
              totals: [
                {
                  speciesName: 'Canada Goose',
                  isWild: true,
                  susceptible: null,
                  cases: 1,
                  deaths: 1,
                  killed: null,
                  slaughtered: null,
                  vaccinated: null
                }
              ]
            }
          },
          detailError: false
        }
      ],
      totalMatched: 1,
      truncated: false,
      generatedAt: new Date('2026-09-02T15:00:00.000Z'),
      partialFailures: false
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/latest-cases'
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $ = cheerio.load(result)
    expect($('[data-testid="latest-cases-accordion"]').length).toBe(1)
    expect($('.govuk-accordion__section').length).toBe(1)
    expect(result).toEqual(expect.stringContaining('Sweden'))
    expect($('[data-testid="species-table"]').length).toBe(1)
    expect($('[data-testid="outbreaks-table"]').length).toBe(1)
    expect($('[data-testid="provenance-link"]').attr('href')).toBe(
      'https://wahis.woah.org/#/in-review/7750'
    )
  })

  test('Should render a partial-failures notice when some event detail failed', async () => {
    getLatestCases.mockResolvedValueOnce({
      events: [
        {
          summary: {
            eventId: 1,
            country: 'France',
            disease:
              'High pathogenicity avian influenza viruses (Inf. with) (poultry)',
            eventStatus: 'On-going',
            reportType: 'IN',
            submissionDate: '2026-09-02T15:00:00.000Z'
          },
          detail: null,
          detailError: true
        }
      ],
      totalMatched: 1,
      truncated: false,
      generatedAt: new Date('2026-09-02T15:00:00.000Z'),
      partialFailures: true
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/latest-cases'
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $ = cheerio.load(result)
    expect($('[data-testid="partial-failures"]').length).toBe(1)
  })

  test('Should render an upstream-error banner rather than a 500 when WAHIS is unreachable', async () => {
    getLatestCases.mockRejectedValueOnce(new Error('WAHIS unreachable'))

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/latest-cases'
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $ = cheerio.load(result)
    expect($('[data-testid="upstream-error"]').length).toBe(1)
  })
})
