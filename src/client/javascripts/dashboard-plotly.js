import Plotly from 'plotly.js-dist-min'

/**
 * Shared Plotly layout defaults aligned with GOV.UK typography.
 * displayModeBar is disabled — the toolbar (zoom, pan, download) is not
 * appropriate for a GOV.UK service where charts are illustrative, the data
 * table already gives the underlying numbers, and the toolbar injects inline
 * styles that break the strict CSP.
 */
const BASE_CONFIG = {
  responsive: true,
  displayModeBar: false
}

const FONT = { family: 'GDS Transport, Arial, sans-serif', size: 13 }

/**
 * Common layout properties shared across all chart types.
 */
function baseLayout(overrides = {}) {
  return {
    margin: { t: 8, r: 8, b: 48, l: 56 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: FONT,
    ...overrides
  }
}

function renderLine(mount, data) {
  const traces = data.series.map((s) => ({
    type: 'scatter',
    mode: 'lines+markers',
    name: s.name,
    x: data.labels,
    y: s.values,
    line: { color: s.colour, width: 2 },
    marker: { color: s.colour, size: 5 }
  }))

  const layout = baseLayout({
    xaxis: {
      type: 'date',
      tickformat: '%d %b %Y',
      tickangle: -45,
      title: { text: 'Week starting', font: FONT }
    },
    yaxis: {
      title: { text: 'Cases', font: FONT },
      rangemode: 'tozero'
    },
    showlegend: data.series.length > 1
  })

  Plotly.newPlot(mount, traces, layout, BASE_CONFIG)
}

function renderBar(mount, data) {
  const traces = data.series.map((s) => ({
    type: 'bar',
    name: s.name,
    x: data.labels,
    y: s.values,
    marker: { color: s.colour }
  }))

  const layout = baseLayout({
    xaxis: { title: { text: 'Region', font: FONT } },
    yaxis: {
      title: { text: 'Cases', font: FONT },
      rangemode: 'tozero'
    },
    showlegend: false
  })

  Plotly.newPlot(mount, traces, layout, BASE_CONFIG)
}

function renderStackedBar(mount, data) {
  const traces = data.series.map((s) => ({
    type: 'bar',
    name: s.name,
    x: data.labels,
    y: s.values,
    marker: { color: s.colour }
  }))

  const layout = baseLayout({
    barmode: 'stack',
    xaxis: {
      type: 'date',
      tickformat: '%d %b %Y',
      tickangle: -45,
      title: { text: 'Week starting', font: FONT }
    },
    yaxis: {
      title: { text: 'Cases', font: FONT },
      rangemode: 'tozero'
    },
    showlegend: true,
    legend: { orientation: 'h', y: -0.3 }
  })

  Plotly.newPlot(mount, traces, layout, BASE_CONFIG)
}

function renderDoughnut(mount, data) {
  const trace = {
    type: 'pie',
    hole: 0.4,
    labels: data.labels,
    values: data.series[0].values,
    marker: { colors: data.sliceColours },
    textinfo: 'none'
  }

  const layout = baseLayout({
    margin: { t: 8, r: 8, b: 8, l: 8 },
    showlegend: true,
    legend: { orientation: 'h', y: -0.2, font: FONT }
  })

  Plotly.newPlot(mount, [trace], layout, BASE_CONFIG)
}

/**
 * Attach a navigation click handler on clickable charts.
 * We listen on the mount element rather than Plotly's plotly_click event
 * because plotly_click only fires on data points, whereas clicking the chart
 * background or axes would be silently ignored. A click on the outer div is
 * more robust and matches user expectation of the whole card being a link.
 */
function attachClickHandler(mount) {
  mount.style.cursor = 'pointer'
  mount.addEventListener('click', () => {
    window.location.assign(mount.dataset.chartHref)
  })
}

function renderChart(mount) {
  const chartId = mount.dataset.chartId
  const chartType = mount.dataset.chartType
  const isClickable = mount.dataset.clickable === 'true'

  const dataScript = document.querySelector(
    `script[type="application/json"][data-chart-data="${chartId}"]`
  )
  if (!dataScript) return

  const data = JSON.parse(dataScript.textContent)

  // Mark Plotly internals as decorative: the mount already carries role="img"
  // and aria-label; the SVG inside is presentation-only.
  mount.setAttribute('aria-hidden', 'false') // mount itself is labelled
  // Plotly will append a child <div> containing an <svg>; we mark it after render
  const markInternalsAriaHidden = () => {
    const svg = mount.querySelector('svg')
    if (svg) svg.setAttribute('aria-hidden', 'true')
  }

  switch (chartType) {
    case 'line':
      renderLine(mount, data)
      break
    case 'bar':
      renderBar(mount, data)
      break
    case 'stacked-bar':
      renderStackedBar(mount, data)
      break
    case 'doughnut':
      renderDoughnut(mount, data)
      break
    default:
      return
  }

  markInternalsAriaHidden()

  if (isClickable) {
    attachClickHandler(mount)
  }
}

document.querySelectorAll('.app-chart[data-chart-id]').forEach(renderChart)
