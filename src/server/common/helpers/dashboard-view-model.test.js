import {
  buildDashboardViewModel,
  buildExpandedViewModel,
  dashboardChartIds,
  resolveFilters
} from './dashboard-view-model.js'
import { getOutbreakData } from './outbreak-data.js'

describe('#buildDashboardViewModel', () => {
  const model = buildDashboardViewModel('chartjs')

  test('Should describe the page for the chosen library', () => {
    expect(model).toEqual(
      expect.objectContaining({
        library: 'chartjs',
        libraryName: 'Chart.js',
        basePath: '/dashboard/chartjs',
        pageTitle: 'Chart.js dashboard',
        heading: 'Chart.js dashboard'
      })
    )
  })

  test('Should surface the synthetic data disclaimer', () => {
    expect(model.disclaimer).toBe(getOutbreakData().meta.disclaimer)
  })

  test('Should build the same four charts for every library', () => {
    expect(model.charts.map((chart) => chart.id)).toEqual([
      'weekly-cases',
      'cases-by-region',
      'cases-by-disease',
      'severity-breakdown'
    ])
    expect(dashboardChartIds).toEqual(model.charts.map((chart) => chart.id))
    expect(
      buildDashboardViewModel('d3').charts.map((chart) => chart.data)
    ).toEqual(model.charts.map((chart) => chart.data))
  })

  test('Should only make the first chart clickable', () => {
    const [first, ...rest] = model.charts

    expect(first.isClickable).toBe(true)
    expect(first.href).toBe('/dashboard/chartjs/weekly-cases')
    expect(rest.every((chart) => chart.isClickable === false)).toBe(true)
    expect(rest.every((chart) => chart.href === '#')).toBe(true)
  })

  test('Should pair every chart with table data', () => {
    for (const chart of model.charts) {
      expect(chart.table.head.length).toBe(chart.data.series.length + 1)
      expect(chart.table.rows).toHaveLength(chart.data.labels.length)
    }
  })
})

describe('#resolveFilters', () => {
  test('Should keep known values', () => {
    expect(
      resolveFilters({ region: 'Devon', disease: 'bramblewick-pox' })
    ).toEqual({ region: 'Devon', disease: 'bramblewick-pox' })
  })

  test('Should fall back to all for unknown or missing values', () => {
    expect(resolveFilters({ region: 'Atlantis', disease: 'nope' })).toEqual({
      region: 'all',
      disease: 'all'
    })
    expect(resolveFilters()).toEqual({ region: 'all', disease: 'all' })
  })
})

describe('#buildExpandedViewModel', () => {
  test('Should return null for an unknown chart', () => {
    expect(buildExpandedViewModel('d3', 'not-a-chart')).toBeNull()
  })

  test('Should build an unfiltered model by default', () => {
    const model = buildExpandedViewModel('d3', 'weekly-cases')

    expect(model.chart.id).toBe('weekly-cases')
    expect(model.filters).toEqual({ region: 'all', disease: 'all' })
    expect(model.filterSummary).toBe('All regions and diseases')
    expect(model.hasRecords).toBe(true)
    expect(model.panels).toHaveLength(2)
    expect(model.panels[0].rows[0]).toEqual({
      key: { text: 'Total new cases' },
      value: { text: expect.any(String) }
    })
  })

  test('Should filter the chart data by query params', () => {
    const all = buildExpandedViewModel('d3', 'cases-by-region')
    const filtered = buildExpandedViewModel('d3', 'cases-by-region', {
      region: 'Devon'
    })

    expect(filtered.filters.region).toBe('Devon')
    expect(filtered.chart.data.labels).toEqual(['Devon'])
    expect(filtered.filterSummary).toBe('Devon')
    expect(all.chart.data.labels.length).toBeGreaterThan(1)
  })

  test('Should describe both filters when set', () => {
    const model = buildExpandedViewModel('plotly', 'weekly-cases', {
      region: 'Devon',
      disease: 'bramblewick-pox'
    })

    expect(model.filterSummary).toBe('Devon · Bramblewick Pox')
    expect(model.caption).toBe('Plotly.js · Devon · Bramblewick Pox')
  })

  test('Should mark selected filter options', () => {
    const { filterOptions } = buildExpandedViewModel('d3', 'weekly-cases', {
      region: 'Devon'
    })

    expect(filterOptions.region[0]).toEqual({
      value: 'all',
      text: 'All regions',
      selected: false
    })
    expect(
      filterOptions.region.find((option) => option.value === 'Devon').selected
    ).toBe(true)
    expect(filterOptions.disease[0].selected).toBe(true)
  })

  test('Should ignore unknown filter values rather than erroring', () => {
    const model = buildExpandedViewModel('d3', 'weekly-cases', {
      region: 'Atlantis'
    })

    expect(model.filters).toEqual({ region: 'all', disease: 'all' })
    expect(model.hasRecords).toBe(true)
  })

  test('Should build breadcrumbs back to the dashboard', () => {
    const model = buildExpandedViewModel('chartjs', 'weekly-cases')

    expect(model.breadcrumbs).toEqual([
      { text: 'Home', href: '/' },
      { text: 'Chart.js dashboard', href: '/dashboard/chartjs' },
      { text: 'Weekly new cases' }
    ])
  })
})
