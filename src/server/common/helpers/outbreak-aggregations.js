/**
 * Pure, library-agnostic aggregation helpers for the synthetic outbreak dataset.
 *
 * Every aggregation returns the same plain shape so that the D3, Plotly and
 * Chart.js prototypes can each render identical charts from identical data:
 *
 *   { labels: string[], series: [{ name: string, colour: string, values: number[] }] }
 */

/**
 * GOV.UK Design System colour palette, ordered for use as chart series colours.
 * https://design-system.service.gov.uk/styles/colour/
 */
export const govukChartColours = [
  '#1d70b8', // blue
  '#00703c', // green
  '#d4351c', // red
  '#f47738', // orange
  '#4c2c92', // purple
  '#28a197', // turquoise
  '#d53880', // pink
  '#b58840' // brown
]

const severityOrder = ['Low', 'Medium', 'High', 'Critical']

function colourAt(index) {
  return govukChartColours[index % govukChartColours.length]
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function totalsByKey(records, keyOf) {
  const totals = new Map()

  for (const record of records) {
    const key = keyOf(record)
    totals.set(key, (totals.get(key) ?? 0) + record.newCases)
  }

  return totals
}

/**
 * Weekly totals of new cases, ordered by week.
 */
export function weeklyCases(records) {
  const totals = totalsByKey(records, (record) => record.weekStarting)
  const labels = uniqueSorted([...totals.keys()])

  return {
    labels,
    series: [
      {
        name: 'New cases',
        colour: colourAt(0),
        values: labels.map((label) => totals.get(label) ?? 0)
      }
    ]
  }
}

/**
 * Total new cases per region, highest first.
 */
export function casesByRegion(records) {
  const totals = totalsByKey(records, (record) => record.region)
  const labels = [...totals.keys()].sort(
    (a, b) => totals.get(b) - totals.get(a) || a.localeCompare(b)
  )

  return {
    labels,
    series: [
      {
        name: 'Cases',
        colour: colourAt(0),
        values: labels.map((label) => totals.get(label))
      }
    ]
  }
}

/**
 * New cases per disease per week, as one series per disease. Suitable for a
 * stacked bar or stacked area chart.
 */
export function casesByDiseaseOverTime(records) {
  const labels = uniqueSorted(records.map((record) => record.weekStarting))
  const diseases = uniqueSorted(records.map((record) => record.disease))
  const labelIndex = new Map(labels.map((label, index) => [label, index]))

  const series = diseases.map((disease, index) => ({
    name: disease,
    colour: colourAt(index),
    values: labels.map(() => 0)
  }))
  const seriesIndex = new Map(series.map((entry, index) => [entry.name, index]))

  for (const record of records) {
    const entry = series[seriesIndex.get(record.disease)]
    entry.values[labelIndex.get(record.weekStarting)] += record.newCases
  }

  return { labels, series }
}

/**
 * Total new cases per severity band, in escalating severity order.
 */
export function casesBySeverity(records) {
  const totals = totalsByKey(records, (record) => record.severity)
  const present = [...totals.keys()]
  const labels = [
    ...severityOrder.filter((severity) => totals.has(severity)),
    ...present.filter((severity) => !severityOrder.includes(severity)).sort()
  ]

  return {
    labels,
    series: [
      {
        name: 'Cases',
        colour: colourAt(0),
        values: labels.map((label) => totals.get(label))
      }
    ],
    // A doughnut/pie needs one colour per slice rather than one per series
    sliceColours: labels.map((_label, index) => colourAt(index))
  }
}

/**
 * Filters records for the expanded view. Missing, "all" or unknown values are
 * treated as "no filter" rather than an error.
 */
export function filterRecords(records, { region, disease } = {}) {
  const isSet = (value) => Boolean(value) && value !== 'all'

  return records.filter((record) => {
    if (isSet(region) && record.region !== region) {
      return false
    }

    return !(isSet(disease) && record.diseaseId !== disease)
  })
}

/**
 * Turns chart data into a govukTable-compatible head/rows pair, so every chart
 * can be paired with an accessible data table.
 */
export function toTableRows(chartData, labelHeading = 'Category') {
  const head = [
    { text: labelHeading },
    ...chartData.series.map((entry) => ({
      text: entry.name,
      format: 'numeric'
    }))
  ]

  const rows = chartData.labels.map((label, index) => [
    { text: label },
    ...chartData.series.map((entry) => ({
      text: String(entry.values[index] ?? 0),
      format: 'numeric'
    }))
  ])

  return { head, rows }
}

/**
 * Headline figures used by the expanded view summary panels.
 */
export function summariseRecords(records) {
  const weekly = weeklyCases(records)
  const byRegion = casesByRegion(records)
  const byDisease = totalsByKey(records, (record) => record.disease)
  const totalCases = sum(records.map((record) => record.newCases))

  const peakIndex = weekly.series[0].values.reduce(
    (best, value, index, values) => (value > values[best] ? index : best),
    0
  )

  const topDisease = [...byDisease.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  )[0]

  return {
    totalCases,
    recordCount: records.length,
    weekCount: weekly.labels.length,
    averageWeeklyCases: weekly.labels.length
      ? Math.round(totalCases / weekly.labels.length)
      : 0,
    peakWeek: weekly.labels[peakIndex] ?? null,
    peakWeekCases: weekly.series[0].values[peakIndex] ?? 0,
    topRegion: byRegion.labels[0] ?? null,
    topRegionCases: byRegion.series[0].values[0] ?? 0,
    topDisease: topDisease?.[0] ?? null,
    topDiseaseCases: topDisease?.[1] ?? 0
  }
}
