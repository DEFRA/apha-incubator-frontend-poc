import { buildLatestCasesViewModel } from './latest-cases-view-model.js'

function baseEvent(overrides = {}) {
  return {
    summary: {
      eventId: 7750,
      country: 'Sweden',
      disease:
        'Influenza A viruses of high pathogenicity (Inf. with) (non-poultry including wild birds) (2017-)',
      eventStatus: 'On-going',
      reportType: 'FUR',
      submissionDate: '2026-09-02T14:39:03.630Z'
    },
    detail: null,
    detailError: false,
    ...overrides
  }
}

describe('#buildLatestCasesViewModel', () => {
  test('Should report hasEvents/empty state correctly', () => {
    expect(
      buildLatestCasesViewModel({
        events: [],
        totalMatched: 0,
        truncated: false,
        generatedAt: new Date(),
        partialFailures: false
      }).hasEvents
    ).toBe(false)
  })

  test('Should build a provenance link and heading from country/disease', () => {
    const model = buildLatestCasesViewModel({
      events: [baseEvent()],
      totalMatched: 1,
      truncated: false,
      generatedAt: new Date(),
      partialFailures: false
    })

    expect(model.events[0].heading).toBe(
      'Sweden — Influenza A viruses of high pathogenicity (Inf. with) (non-poultry including wild birds) (2017-)'
    )
    expect(model.events[0].provenanceUrl).toBe(
      'https://wahis.woah.org/#/in-review/7750'
    )
  })

  test('Should trim trailing whitespace from disease/country names', () => {
    const model = buildLatestCasesViewModel({
      events: [
        baseEvent({
          summary: {
            ...baseEvent().summary,
            country: 'Sweden ',
            disease: 'West Nile Fever '
          }
        })
      ],
      totalMatched: 1,
      truncated: false,
      generatedAt: new Date(),
      partialFailures: false
    })

    expect(model.events[0].heading).toBe('Sweden — West Nile Fever')
  })

  test('Should prefer catalog translation over keyValue', () => {
    const model = buildLatestCasesViewModel({
      events: [
        baseEvent({
          detail: {
            event: {
              reason: {
                keyValue: 'reccurence disease',
                translation: 'Recurrence of an eradicated disease'
              },
              eventStatus: { keyValue: 'ongoing', translation: 'On-going' },
              subType: { disease: { name: 'H5N1' } },
              causalAgent: { name: 'Highly pathogenic avian influenza virus' },
              startedOn: '2026-07-21T00:00:00.000Z',
              confirmOn: '2026-08-04T00:00:00.000Z',
              endedOn: null
            },
            report: {
              reportStatus: { keyValue: 'Validated', translation: 'Validated' },
              reportNumber: 4
            },
            outbreaks: [],
            quantitativeData: { totals: [], unit: null }
          }
        })
      ],
      totalMatched: 1,
      truncated: false,
      generatedAt: new Date(),
      partialFailures: false
    })

    expect(model.events[0].detail.reason).toBe(
      'Recurrence of an eradicated disease'
    )
    expect(model.events[0].detail.eventStatus).toBe('On-going')
  })

  test('Should render null species counts as "Not reported", never 0', () => {
    const model = buildLatestCasesViewModel({
      events: [
        baseEvent({
          detail: {
            event: {},
            report: {},
            outbreaks: [],
            quantitativeData: {
              unit: { translation: 'Animal' },
              totals: [
                {
                  speciesName: 'Canada Goose',
                  isWild: true,
                  susceptible: null,
                  cases: 1,
                  deaths: 0,
                  killed: null,
                  slaughtered: null,
                  vaccinated: null
                }
              ]
            }
          }
        })
      ],
      totalMatched: 1,
      truncated: false,
      generatedAt: new Date(),
      partialFailures: false
    })

    const species = model.events[0].detail.species[0]
    expect(species.susceptible).toBe('Not reported')
    expect(species.cases).toBe('1')
    expect(species.deaths).toBe('0')
    expect(species.killed).toBe('Not reported')
    expect(species.unit).toBe('Animal')
  })

  test('Should mark events with a detail fetch failure', () => {
    const model = buildLatestCasesViewModel({
      events: [baseEvent({ detail: null, detailError: true })],
      totalMatched: 1,
      truncated: false,
      generatedAt: new Date(),
      partialFailures: true
    })

    expect(model.events[0].detailError).toBe(true)
    expect(model.events[0].detail).toBeNull()
    expect(model.partialFailures).toBe(true)
  })
})
