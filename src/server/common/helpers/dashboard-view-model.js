import {
  casesByDiseaseOverTime,
  casesByRegion,
  casesBySeverity,
  filterRecords,
  summariseRecords,
  toTableRows,
  weeklyCases
} from './outbreak-aggregations.js'
import { getOutbreakData } from './outbreak-data.js'

export const libraryNames = {
  d3: 'D3.js',
  plotly: 'Plotly.js',
  chartjs: 'Chart.js'
}

const chartDefinitions = [
  {
    id: 'weekly-cases',
    heading: 'Weekly new cases',
    caption: 'Total new cases reported each week',
    chartType: 'line',
    labelType: 'date',
    labelHeading: 'Week starting',
    isClickable: true,
    aggregate: weeklyCases
  },
  {
    id: 'cases-by-region',
    heading: 'Cases by region',
    caption: 'Total new cases reported for each region',
    chartType: 'bar',
    labelType: 'category',
    labelHeading: 'Region',
    isClickable: false,
    aggregate: casesByRegion
  },
  {
    id: 'cases-by-disease',
    heading: 'Cases by disease',
    caption: 'Weekly new cases broken down by disease',
    chartType: 'stacked-bar',
    labelType: 'date',
    labelHeading: 'Week starting',
    isClickable: false,
    aggregate: casesByDiseaseOverTime
  },
  {
    id: 'severity-breakdown',
    heading: 'Severity breakdown',
    caption: 'Share of new cases by reported severity',
    chartType: 'doughnut',
    labelType: 'category',
    labelHeading: 'Severity',
    isClickable: false,
    aggregate: casesBySeverity
  }
]

export const dashboardChartIds = chartDefinitions.map((chart) => chart.id)

function buildChart(definition, records, basePath) {
  const { aggregate, labelHeading, isClickable, ...rest } = definition
  const data = aggregate(records)

  return {
    ...rest,
    labelHeading,
    isClickable,
    href: isClickable ? `${basePath}/${definition.id}` : '#',
    data,
    table: toTableRows(data, labelHeading)
  }
}

function toOptions(values, selected, allText) {
  return [
    { value: 'all', text: allText, selected: !selected || selected === 'all' },
    ...values.map((option) => ({
      value: option.value,
      text: option.text,
      selected: option.value === selected
    }))
  ]
}

/**
 * Resolves query params against the dataset. Unknown values fall back to "all"
 * rather than returning an error.
 */
export function resolveFilters(
  { region, disease } = {},
  data = getOutbreakData()
) {
  const knownRegion = data.regions.includes(region) ? region : 'all'
  const knownDisease = data.diseases.some((entry) => entry.id === disease)
    ? disease
    : 'all'

  return { region: knownRegion, disease: knownDisease }
}

function filterOptions(data, filters) {
  return {
    region: toOptions(
      data.regions.map((region) => ({ value: region, text: region })),
      filters.region,
      'All regions'
    ),
    disease: toOptions(
      data.diseases.map((disease) => ({
        value: disease.id,
        text: disease.name
      })),
      filters.disease,
      'All diseases'
    )
  }
}

function describeFilters(data, filters) {
  const parts = []

  if (filters.region !== 'all') {
    parts.push(filters.region)
  }

  if (filters.disease !== 'all') {
    parts.push(
      data.diseases.find((disease) => disease.id === filters.disease).name
    )
  }

  return parts.length ? parts.join(' · ') : 'All regions and diseases'
}

function toSummaryRows(entries) {
  return entries.map(([key, value]) => ({
    key: { text: key },
    value: { text: String(value) }
  }))
}

function describeTop(label, cases) {
  return label ? `${label} (${cases} cases)` : 'No data'
}

/**
 * Overview page view model: the four chart cards plus page furniture. Every
 * library branch renders from this identical structure.
 */
export function buildDashboardViewModel(library, data = getOutbreakData()) {
  const basePath = `/dashboard/${library}`
  const libraryName = libraryNames[library]

  return {
    library,
    libraryName,
    basePath,
    pageTitle: `${libraryName} dashboard`,
    heading: `${libraryName} dashboard`,
    caption: 'Animal disease outbreak prototype',
    disclaimer: data.meta.disclaimer,
    datasetTitle: data.meta.title,
    datasetDescription: data.meta.description,
    charts: chartDefinitions.map((definition) =>
      buildChart(definition, data.records, basePath)
    ),
    breadcrumbs: [
      { text: 'Home', href: '/' },
      { text: `${libraryName} dashboard` }
    ]
  }
}

/**
 * Expanded page view model: one larger chart, the filter controls and two
 * summary panels.
 */
export function buildExpandedViewModel(
  library,
  chartId,
  query = {},
  data = getOutbreakData()
) {
  const definition = chartDefinitions.find((chart) => chart.id === chartId)

  if (!definition) {
    return null
  }

  const basePath = `/dashboard/${library}`
  const libraryName = libraryNames[library]
  const filters = resolveFilters(query, data)
  const records = filterRecords(data.records, filters)
  const chart = buildChart(definition, records, basePath)
  const summary = summariseRecords(records)

  return {
    library,
    libraryName,
    basePath,
    chart,
    filters,
    filterOptions: filterOptions(data, filters),
    filterSummary: describeFilters(data, filters),
    hasRecords: records.length > 0,
    pageTitle: `${definition.heading} – ${libraryName}`,
    heading: definition.heading,
    caption: `${libraryName} · ${describeFilters(data, filters)}`,
    disclaimer: data.meta.disclaimer,
    panels: [
      {
        heading: 'Key figures',
        rows: toSummaryRows([
          ['Total new cases', summary.totalCases],
          ['Records included', summary.recordCount],
          ['Weeks covered', summary.weekCount],
          ['Average cases per week', summary.averageWeeklyCases]
        ])
      },
      {
        heading: 'Highlights',
        rows: toSummaryRows([
          ['Peak week', describeTop(summary.peakWeek, summary.peakWeekCases)],
          [
            'Highest region',
            describeTop(summary.topRegion, summary.topRegionCases)
          ],
          [
            'Most reported disease',
            describeTop(summary.topDisease, summary.topDiseaseCases)
          ]
        ])
      }
    ],
    breadcrumbs: [
      { text: 'Home', href: '/' },
      { text: `${libraryName} dashboard`, href: basePath },
      { text: definition.heading }
    ]
  }
}
