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
    expect(JSON.parse($('#outbreaks-geojson').text())).toEqual({
      type: 'FeatureCollection',
      features: []
    })
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
                longitude: 11.39947,
                category: 'new_outbreak'
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
    const geojson = JSON.parse($('#outbreaks-geojson').text())
    expect(geojson.type).toBe('FeatureCollection')
    expect(geojson.features).toHaveLength(1)
    expect(geojson.features[0].geometry.coordinates).toEqual([
      11.39947, 58.17464
    ])
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
    expect(JSON.parse($('#outbreaks-geojson').text())).toEqual({
      type: 'FeatureCollection',
      features: []
    })
  })

  test('Should pass the canonical outbreak list to the map GeoJSON', async () => {
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
                outbreakId: 100,
                adminDivision: 'Orust',
                location: 'Orust',
                startDate: '2026-07-31T00:00:00.000Z',
                endDate: '2026-07-31T00:00:00.000Z',
                latitude: 58.17464,
                longitude: 11.39947,
                category: 'new_outbreak'
              },
              {
                outbreakId: 101,
                adminDivision: 'Stockholm',
                location: 'Stockholm',
                startDate: '2026-08-01T00:00:00.000Z',
                endDate: null,
                latitude: null,
                longitude: null,
                category: 'follow_up_active'
              }
            ],
            quantitativeData: {
              unit: { translation: 'Animal' },
              totals: []
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
    const geojson = JSON.parse($('#outbreaks-geojson').text())

    expect(geojson.features).toHaveLength(1)
    expect(geojson.features[0].properties.outbreakId).toBe(100)
    expect(geojson.features[0].geometry.coordinates).toEqual([
      11.39947, 58.17464
    ])

    // The table must list both outbreaks while the map plots only one, and
    // the page must state that difference — this is the list/map parity
    // guarantee the whole canonical-list change exists to protect.
    const tableRows = $('[data-testid="outbreak-list-table"] tbody tr')
    expect(tableRows).toHaveLength(2)
    expect($(tableRows[0]).find('td').last().text().trim()).toBe('Yes')
    expect($(tableRows[1]).find('td').last().text().trim()).toBe(
      'No coordinates reported'
    )
    expect(
      $('[data-testid="map-coverage"]').text().replace(/\s+/g, ' ').trim()
    ).toBe(
      'Showing 1 of 2 outbreaks on the map. 1 outbreak(s) have no reported coordinates and appear in the table only.'
    )
  })

  test('Should use the same category labels in the table and the map data', async () => {
    getLatestCases.mockResolvedValueOnce({
      events: [
        {
          summary: {
            eventId: 7750,
            country: 'Sweden',
            disease: 'Influenza A viruses of high pathogenicity',
            eventStatus: 'On-going',
            reportType: 'FUR',
            submissionDate: '2026-09-02T14:39:03.630Z'
          },
          detail: {
            event: {},
            report: {},
            outbreaks: [
              {
                outbreakId: 100,
                adminDivision: 'Orust',
                location: 'Orust',
                latitude: 58.17464,
                longitude: 11.39947,
                category: 'new_outbreak'
              }
            ],
            quantitativeData: { unit: null, totals: [] }
          },
          detailError: false
        }
      ],
      totalMatched: 1,
      truncated: false,
      generatedAt: new Date('2026-09-02T15:00:00.000Z'),
      partialFailures: false
    })

    const { result } = await server.inject({
      method: 'GET',
      url: '/latest-cases'
    })

    const $ = cheerio.load(result)
    const geojson = JSON.parse($('#outbreaks-geojson').text())
    const tableLabel = $('[data-testid="outbreak-list-table"] tbody tr')
      .find('td')
      .eq(3)
      .text()
      .trim()

    expect(tableLabel).toBe('New outbreak')
    expect(geojson.features[0].properties.categoryLabel).toBe(tableLabel)
  })

  test('Should render an empty outbreak table when the upstream call fails', async () => {
    getLatestCases.mockRejectedValueOnce(new Error('WAHIS unreachable'))

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/latest-cases'
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $ = cheerio.load(result)
    expect($('[data-testid="upstream-error"]').length).toBe(1)
    expect($('[data-testid="outbreak-list-table"]').length).toBe(0)
    expect($('[data-testid="map-coverage"]').length).toBe(0)
    expect(JSON.parse($('#outbreaks-geojson').text())).toEqual({
      type: 'FeatureCollection',
      features: []
    })
  })
})
