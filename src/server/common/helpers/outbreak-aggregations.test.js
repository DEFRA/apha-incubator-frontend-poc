import {
  casesByDiseaseOverTime,
  casesByRegion,
  casesBySeverity,
  filterRecords,
  govukChartColours,
  summariseRecords,
  toTableRows,
  weeklyCases
} from './outbreak-aggregations.js'

const records = [
  {
    weekStarting: '2024-01-08',
    region: 'Devon',
    diseaseId: 'bramblewick-pox',
    disease: 'Bramblewick Pox',
    severity: 'High',
    newCases: 5
  },
  {
    weekStarting: '2024-01-01',
    region: 'Devon',
    diseaseId: 'bramblewick-pox',
    disease: 'Bramblewick Pox',
    severity: 'Low',
    newCases: 3
  },
  {
    weekStarting: '2024-01-01',
    region: 'Powys',
    diseaseId: 'sparklefoot-fever',
    disease: 'Sparklefoot Fever',
    severity: 'Medium',
    newCases: 7
  },
  {
    weekStarting: '2024-01-08',
    region: 'Powys',
    diseaseId: 'sparklefoot-fever',
    disease: 'Sparklefoot Fever',
    severity: 'Low',
    newCases: 1
  }
]

describe('#weeklyCases', () => {
  test('Should total cases per week in date order', () => {
    expect(weeklyCases(records)).toEqual({
      labels: ['2024-01-01', '2024-01-08'],
      series: [
        {
          name: 'New cases',
          colour: govukChartColours[0],
          values: [10, 6]
        }
      ]
    })
  })

  test('Should handle an empty record set', () => {
    expect(weeklyCases([])).toEqual({
      labels: [],
      series: [{ name: 'New cases', colour: govukChartColours[0], values: [] }]
    })
  })
})

describe('#casesByRegion', () => {
  test('Should total cases per region, highest first', () => {
    const result = casesByRegion(records)

    expect(result.labels).toEqual(['Devon', 'Powys'])
    expect(result.series[0].values).toEqual([8, 8])
  })

  test('Should order by total cases before name', () => {
    const result = casesByRegion([
      ...records,
      {
        weekStarting: '2024-01-15',
        region: 'Powys',
        diseaseId: 'sparklefoot-fever',
        disease: 'Sparklefoot Fever',
        severity: 'Low',
        newCases: 20
      }
    ])

    expect(result.labels).toEqual(['Powys', 'Devon'])
    expect(result.series[0].values).toEqual([28, 8])
  })
})

describe('#casesByDiseaseOverTime', () => {
  test('Should return one series per disease aligned to the week labels', () => {
    expect(casesByDiseaseOverTime(records)).toEqual({
      labels: ['2024-01-01', '2024-01-08'],
      series: [
        {
          name: 'Bramblewick Pox',
          colour: govukChartColours[0],
          values: [3, 5]
        },
        {
          name: 'Sparklefoot Fever',
          colour: govukChartColours[1],
          values: [7, 1]
        }
      ]
    })
  })
})

describe('#casesBySeverity', () => {
  test('Should order severities from low to critical and colour each slice', () => {
    const result = casesBySeverity(records)

    expect(result.labels).toEqual(['Low', 'Medium', 'High'])
    expect(result.series[0].values).toEqual([4, 7, 5])
    expect(result.sliceColours).toEqual(govukChartColours.slice(0, 3))
  })

  test('Should omit severities that are not present', () => {
    expect(casesBySeverity([records[0]]).labels).toEqual(['High'])
  })
})

describe('#filterRecords', () => {
  test('Should return every record when no filters are set', () => {
    expect(filterRecords(records)).toHaveLength(4)
    expect(
      filterRecords(records, { region: 'all', disease: 'all' })
    ).toHaveLength(4)
  })

  test('Should filter by region', () => {
    expect(filterRecords(records, { region: 'Devon' })).toHaveLength(2)
  })

  test('Should filter by disease id', () => {
    expect(
      filterRecords(records, { disease: 'sparklefoot-fever' })
    ).toHaveLength(2)
  })

  test('Should filter by region and disease together', () => {
    expect(
      filterRecords(records, { region: 'Devon', disease: 'sparklefoot-fever' })
    ).toHaveLength(0)
  })
})

describe('#toTableRows', () => {
  test('Should build a govukTable head and rows from chart data', () => {
    expect(toTableRows(casesByRegion(records), 'Region')).toEqual({
      head: [{ text: 'Region' }, { text: 'Cases', format: 'numeric' }],
      rows: [
        [{ text: 'Devon' }, { text: '8', format: 'numeric' }],
        [{ text: 'Powys' }, { text: '8', format: 'numeric' }]
      ]
    })
  })

  test('Should include a column per series for multi-series data', () => {
    const { head, rows } = toTableRows(
      casesByDiseaseOverTime(records),
      'Week starting'
    )

    expect(head).toHaveLength(3)
    expect(rows[0]).toEqual([
      { text: '2024-01-01' },
      { text: '3', format: 'numeric' },
      { text: '7', format: 'numeric' }
    ])
  })
})

describe('#summariseRecords', () => {
  test('Should return headline figures', () => {
    expect(summariseRecords(records)).toEqual({
      totalCases: 16,
      recordCount: 4,
      weekCount: 2,
      averageWeeklyCases: 8,
      peakWeek: '2024-01-01',
      peakWeekCases: 10,
      topRegion: 'Devon',
      topRegionCases: 8,
      topDisease: 'Bramblewick Pox',
      topDiseaseCases: 8
    })
  })

  test('Should cope with no records', () => {
    expect(summariseRecords([])).toEqual({
      totalCases: 0,
      recordCount: 0,
      weekCount: 0,
      averageWeeklyCases: 0,
      peakWeek: null,
      peakWeekCases: 0,
      topRegion: null,
      topRegionCases: 0,
      topDisease: null,
      topDiseaseCases: 0
    })
  })
})
