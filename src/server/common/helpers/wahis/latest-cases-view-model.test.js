import {
  buildLatestCasesViewModel,
  buildOutbreakList
} from './latest-cases-view-model.js'

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

  test('Should include new and follow-up outbreaks in the outbreaks table', () => {
    const model = buildLatestCasesViewModel({
      events: [
        baseEvent({
          detail: {
            event: {},
            report: {},
            outbreaks: [
              {
                category: 'new_outbreak',
                location: 'Orust',
                adminDivision: 'Västra Götaland'
              },
              {
                category: 'follow_up_active',
                location: 'Active follow-up',
                adminDivision: 'Västra Götaland'
              },
              {
                category: 'follow_up_resolved',
                location: 'Resolved follow-up',
                adminDivision: 'Västra Götaland'
              }
            ],
            quantitativeData: { totals: [], unit: null }
          }
        })
      ],
      totalMatched: 1,
      truncated: false,
      generatedAt: new Date(),
      partialFailures: false
    })

    expect(model.events[0].detail.outbreaks).toEqual([
      expect.objectContaining({ location: 'Orust' }),
      expect.objectContaining({ location: 'Active follow-up' }),
      expect.objectContaining({ location: 'Resolved follow-up' })
    ])
  })

  test('Should label outbreaks without coordinates as not plotted', () => {
    const model = buildLatestCasesViewModel({
      events: [
        baseEvent({
          detail: {
            event: {},
            report: {},
            outbreaks: [
              {
                category: 'follow_up_active',
                location: 'No coordinates',
                latitude: null,
                longitude: null
              }
            ],
            quantitativeData: { totals: [], unit: null }
          }
        })
      ],
      totalMatched: 1,
      truncated: false,
      generatedAt: new Date(),
      partialFailures: false
    })

    expect(model.events[0].detail.outbreaks[0].coordinates).toBe(
      'Not plotted: coordinates not reported'
    )
  })

  test('Should count plotted and unplotted outbreaks', () => {
    const model = buildLatestCasesViewModel({
      events: [
        baseEvent({
          detail: {
            event: {},
            report: {},
            outbreaks: [
              {
                outbreakId: 1,
                category: 'new_outbreak',
                location: 'Location 1',
                adminDivision: 'Admin 1',
                latitude: 52.5,
                longitude: 13.4
              },
              {
                outbreakId: 2,
                category: 'follow_up_active',
                location: 'Location 2',
                adminDivision: 'Admin 2',
                latitude: 51.5,
                longitude: 12.4
              },
              {
                outbreakId: 3,
                category: 'follow_up_resolved',
                location: 'Location 3',
                adminDivision: 'Admin 3',
                latitude: null,
                longitude: null
              }
            ],
            quantitativeData: { totals: [], unit: null }
          }
        })
      ],
      totalMatched: 1,
      truncated: false,
      generatedAt: new Date(),
      partialFailures: false
    })

    expect(model.outbreakCount).toBe(3)
    expect(model.plottedCount).toBe(2)
    expect(model.unplottedCount).toBe(1)
  })
})

describe('#buildOutbreakList', () => {
  test('Should return one entry per outbreak across multiple events', () => {
    const outbreaks = buildOutbreakList([
      baseEvent({
        detail: {
          outbreaks: [
            { outbreakId: 1, location: 'Location 1', adminDivision: 'Admin 1' },
            { outbreakId: 2, location: 'Location 2', adminDivision: 'Admin 2' }
          ]
        }
      }),
      baseEvent({
        summary: { ...baseEvent().summary, eventId: 7751 },
        detail: {
          outbreaks: [
            { outbreakId: 3, location: 'Location 3', adminDivision: 'Admin 3' }
          ]
        }
      })
    ])

    expect(outbreaks).toHaveLength(3)
    expect(outbreaks[0].outbreakId).toBe(1)
    expect(outbreaks[1].outbreakId).toBe(2)
    expect(outbreaks[2].outbreakId).toBe(3)
  })

  test('Should carry the event country, disease and eventId onto each outbreak', () => {
    const outbreaks = buildOutbreakList([
      baseEvent({
        summary: {
          ...baseEvent().summary,
          eventId: 7750,
          country: 'Sweden',
          disease: 'Avian Influenza'
        },
        detail: {
          outbreaks: [
            { outbreakId: 1, location: 'Location 1', adminDivision: 'Admin 1' }
          ]
        }
      })
    ])

    expect(outbreaks[0].eventId).toBe(7750)
    expect(outbreaks[0].country).toBe('Sweden')
    expect(outbreaks[0].disease).toBe('Avian Influenza')
  })

  test('Should set plotted to true only when both latitude and longitude are present', () => {
    const outbreaks = buildOutbreakList([
      baseEvent({
        detail: {
          outbreaks: [
            {
              outbreakId: 1,
              location: 'Location 1',
              adminDivision: 'Admin 1',
              latitude: 52.5,
              longitude: 13.4
            },
            {
              outbreakId: 2,
              location: 'Location 2',
              adminDivision: 'Admin 2',
              latitude: 52.5,
              longitude: null
            },
            {
              outbreakId: 3,
              location: 'Location 3',
              adminDivision: 'Admin 3',
              latitude: null,
              longitude: 13.4
            }
          ]
        }
      })
    ])

    expect(outbreaks[0].plotted).toBe(true)
    expect(outbreaks[1].plotted).toBe(false)
    expect(outbreaks[2].plotted).toBe(false)
  })

  test('Should set plotted to false for non-finite or out-of-range coordinates', () => {
    const outbreaks = buildOutbreakList([
      baseEvent({
        detail: {
          outbreaks: [
            {
              outbreakId: 1,
              location: 'NaN pair',
              latitude: 'not-a-number',
              longitude: 13.4
            },
            {
              outbreakId: 2,
              location: 'Infinite latitude',
              latitude: Infinity,
              longitude: 13.4
            },
            {
              outbreakId: 3,
              location: 'Out of range latitude',
              latitude: 152.5,
              longitude: 13.4
            },
            {
              outbreakId: 4,
              location: 'Out of range longitude',
              latitude: 52.5,
              longitude: 213.4
            }
          ]
        }
      })
    ])

    expect(outbreaks.every((outbreak) => outbreak.plotted === false)).toBe(
      true
    )
  })

  test('Should map each category to its display label', () => {
    const outbreaks = buildOutbreakList([
      baseEvent({
        detail: {
          outbreaks: [
            {
              outbreakId: 1,
              location: 'Location 1',
              adminDivision: 'Admin 1',
              category: 'new_outbreak'
            },
            {
              outbreakId: 2,
              location: 'Location 2',
              adminDivision: 'Admin 2',
              category: 'follow_up_active'
            },
            {
              outbreakId: 3,
              location: 'Location 3',
              adminDivision: 'Admin 3',
              category: 'follow_up_resolved'
            }
          ]
        }
      })
    ])

    expect(outbreaks[0].categoryLabel).toBe('New outbreak')
    expect(outbreaks[1].categoryLabel).toBe('Follow-up — event ongoing')
    expect(outbreaks[2].categoryLabel).toBe('Follow-up — event resolved')
  })

  test('Should fall back to follow_up_active for an unknown or missing category', () => {
    const outbreaks = buildOutbreakList([
      baseEvent({
        detail: {
          outbreaks: [
            {
              outbreakId: 1,
              location: 'Location 1',
              adminDivision: 'Admin 1',
              category: 'unknown_category'
            },
            {
              outbreakId: 2,
              location: 'Location 2',
              adminDivision: 'Admin 2'
            }
          ]
        }
      })
    ])

    expect(outbreaks[0].category).toBe('follow_up_active')
    expect(outbreaks[0].categoryLabel).toBe('Follow-up — event ongoing')
    expect(outbreaks[1].category).toBe('follow_up_active')
    expect(outbreaks[1].categoryLabel).toBe('Follow-up — event ongoing')
  })

  test('Should skip events whose detail is null without throwing', () => {
    const outbreaks = buildOutbreakList([
      baseEvent({ detail: null }),
      baseEvent({
        detail: {
          outbreaks: [
            { outbreakId: 1, location: 'Location 1', adminDivision: 'Admin 1' }
          ]
        }
      }),
      baseEvent({ detail: null })
    ])

    expect(outbreaks).toHaveLength(1)
    expect(outbreaks[0].outbreakId).toBe(1)
  })

  test('Should return an empty array when there are no events', () => {
    const outbreaks = buildOutbreakList([])

    expect(outbreaks).toEqual([])
  })
})
