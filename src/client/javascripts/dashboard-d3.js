import * as d3 from 'd3'

const MARGIN = { top: 16, right: 16, bottom: 48, left: 52 }
const LEGEND_HEIGHT = 28

/**
 * Parse the JSON data block sibling to a chart mount.
 */
function readChartData(mount) {
  const id = mount.dataset.chartId
  const script = document.querySelector(
    `script[type="application/json"][data-chart-data="${id}"]`
  )
  if (!script) return null
  try {
    return JSON.parse(script.textContent)
  } catch {
    return null
  }
}

/**
 * Return the pixel dimensions available inside the mount element.
 */
function mountDims(el) {
  const { width, height } = el.getBoundingClientRect()
  return { width: width || el.offsetWidth, height: height || el.offsetHeight }
}

// ---------------------------------------------------------------------------
// Line chart
// ---------------------------------------------------------------------------

function renderLine(mount, data) {
  const { width, height } = mountDims(mount)
  const hasLegend = data.series.length > 1
  const chartH =
    height - MARGIN.top - MARGIN.bottom - (hasLegend ? LEGEND_HEIGHT : 0)
  const chartW = width - MARGIN.left - MARGIN.right

  mount.innerHTML = ''

  const svg = d3
    .select(mount)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('aria-hidden', 'true')
    .attr('focusable', 'false')

  const g = svg
    .append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  const labels = data.labels

  const x = d3.scalePoint().domain(labels).range([0, chartW])

  const allValues = data.series.flatMap((s) => s.values)
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(allValues) * 1.1])
    .nice()
    .range([chartH, 0])

  // Axes
  const tickCount = Math.min(labels.length, Math.floor(chartW / 80))
  const every = Math.ceil(labels.length / tickCount)
  const filteredLabels = labels.filter((_, i) => i % every === 0)

  g.append('g')
    .attr('transform', `translate(0,${chartH})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(filteredLabels)
        .tickFormat((d) => {
          const date = new Date(d)
          return isNaN(date) ? d : d3.timeFormat('%d %b')(date)
        })
    )
    .selectAll('text')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end')
    .attr('font-size', '11px')

  g.append('g').call(d3.axisLeft(y).ticks(5))

  // Series lines
  const line = d3
    .line()
    .x((_, i) => x(labels[i]))
    .y((d) => y(d))

  for (const series of data.series) {
    g.append('path')
      .datum(series.values)
      .attr('fill', 'none')
      .attr('stroke', series.colour)
      .attr('stroke-width', 2)
      .attr('d', line)
  }

  // Legend (if multiple series)
  if (hasLegend) {
    const legend = svg
      .append('g')
      .attr(
        'transform',
        `translate(${MARGIN.left},${MARGIN.top + chartH + MARGIN.bottom - 4})`
      )

    let xOffset = 0
    for (const series of data.series) {
      const entry = legend
        .append('g')
        .attr('transform', `translate(${xOffset},0)`)
      entry
        .append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', series.colour)
      entry
        .append('text')
        .attr('x', 16)
        .attr('y', 10)
        .attr('font-size', '12px')
        .text(series.name)
      xOffset += 16 + series.name.length * 7 + 8
    }
  }
}

// ---------------------------------------------------------------------------
// Bar chart
// ---------------------------------------------------------------------------

function renderBar(mount, data) {
  const { width, height } = mountDims(mount)
  const chartH = height - MARGIN.top - MARGIN.bottom
  const chartW = width - MARGIN.left - MARGIN.right

  mount.innerHTML = ''

  const svg = d3
    .select(mount)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('aria-hidden', 'true')
    .attr('focusable', 'false')

  const g = svg
    .append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  const labels = data.labels
  const values = data.series[0].values
  const colour = data.series[0].colour

  const x = d3.scaleBand().domain(labels).range([0, chartW]).padding(0.2)
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(values) * 1.1])
    .nice()
    .range([chartH, 0])

  g.append('g')
    .attr('transform', `translate(0,${chartH})`)
    .call(d3.axisBottom(x).tickFormat((d) => d))
    .selectAll('text')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end')
    .attr('font-size', '11px')

  g.append('g').call(d3.axisLeft(y).ticks(5))

  g.selectAll('rect')
    .data(values)
    .join('rect')
    .attr('x', (_, i) => x(labels[i]))
    .attr('y', (d) => y(d))
    .attr('width', x.bandwidth())
    .attr('height', (d) => chartH - y(d))
    .attr('fill', colour)
}

// ---------------------------------------------------------------------------
// Stacked-bar chart
// ---------------------------------------------------------------------------

function renderStackedBar(mount, data) {
  const { width, height } = mountDims(mount)
  const legendH = LEGEND_HEIGHT
  const chartH = height - MARGIN.top - MARGIN.bottom - legendH
  const chartW = width - MARGIN.left - MARGIN.right

  mount.innerHTML = ''

  const svg = d3
    .select(mount)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('aria-hidden', 'true')
    .attr('focusable', 'false')

  const g = svg
    .append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  const labels = data.labels

  // Build row objects { label, series0value, series1value, … }
  const keys = data.series.map((s) => s.name)
  const rows = labels.map((label, i) => {
    const row = { label }
    for (const s of data.series) row[s.name] = s.values[i]
    return row
  })

  const stack = d3.stack().keys(keys)
  const stacked = stack(rows)

  const totals = rows.map((row) => keys.reduce((sum, k) => sum + row[k], 0))
  const x = d3.scaleBand().domain(labels).range([0, chartW]).padding(0.2)
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(totals) * 1.1])
    .nice()
    .range([chartH, 0])

  const colourMap = Object.fromEntries(
    data.series.map((s) => [s.name, s.colour])
  )

  for (const layer of stacked) {
    g.selectAll(null)
      .data(layer)
      .join('rect')
      .attr('x', (d) => x(d.data.label))
      .attr('y', (d) => y(d[1]))
      .attr('height', (d) => y(d[0]) - y(d[1]))
      .attr('width', x.bandwidth())
      .attr('fill', colourMap[layer.key])
  }

  const tickCount = Math.min(labels.length, Math.floor(chartW / 80))
  const every = Math.ceil(labels.length / tickCount)
  const filteredLabels = labels.filter((_, i) => i % every === 0)

  g.append('g')
    .attr('transform', `translate(0,${chartH})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(filteredLabels)
        .tickFormat((d) => {
          const date = new Date(d)
          return isNaN(date) ? d : d3.timeFormat('%d %b')(date)
        })
    )
    .selectAll('text')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end')
    .attr('font-size', '11px')

  g.append('g').call(d3.axisLeft(y).ticks(5))

  // Legend
  const legend = svg
    .append('g')
    .attr(
      'transform',
      `translate(${MARGIN.left},${MARGIN.top + chartH + MARGIN.bottom - 4})`
    )

  let xOffset = 0
  for (const series of data.series) {
    const entry = legend
      .append('g')
      .attr('transform', `translate(${xOffset},0)`)
    entry
      .append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', series.colour)
    entry
      .append('text')
      .attr('x', 16)
      .attr('y', 10)
      .attr('font-size', '12px')
      .text(series.name)
    xOffset += 16 + series.name.length * 7 + 8
  }
}

// ---------------------------------------------------------------------------
// Doughnut chart
// ---------------------------------------------------------------------------

function renderDoughnut(mount, data) {
  const { width, height } = mountDims(mount)
  const legendH = LEGEND_HEIGHT
  const drawH = height - legendH
  const radius = Math.min(width, drawH) / 2 - 8

  mount.innerHTML = ''

  const svg = d3
    .select(mount)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('aria-hidden', 'true')
    .attr('focusable', 'false')

  const g = svg
    .append('g')
    .attr('transform', `translate(${width / 2},${drawH / 2})`)

  const labels = data.labels
  const values = data.series[0].values
  const colours = data.sliceColours || data.series.map((s) => s.colour)

  const pie = d3.pie().sort(null)
  const arc = d3
    .arc()
    .innerRadius(radius * 0.55)
    .outerRadius(radius)

  const arcs = pie(values)

  g.selectAll('path')
    .data(arcs)
    .join('path')
    .attr('d', arc)
    .attr('fill', (_, i) => colours[i])
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)

  // Legend
  const legend = svg.append('g').attr('transform', `translate(8,${drawH + 4})`)

  let xOffset = 0
  for (let i = 0; i < labels.length; i++) {
    const entry = legend
      .append('g')
      .attr('transform', `translate(${xOffset},0)`)
    entry
      .append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', colours[i])
    entry
      .append('text')
      .attr('x', 16)
      .attr('y', 10)
      .attr('font-size', '12px')
      .text(labels[i])
    xOffset += 16 + labels[i].length * 7 + 8
    // Wrap legend to next row if needed
    if (xOffset > width - 40) {
      xOffset = 0
    }
  }
}

// ---------------------------------------------------------------------------
// Render dispatch + responsive wiring
// ---------------------------------------------------------------------------

function renderChart(mount) {
  const data = readChartData(mount)
  if (!data) return

  const type = mount.dataset.chartType

  switch (type) {
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
  }

  if (mount.dataset.clickable === 'true') {
    mount.style.cursor = 'pointer'
    mount.addEventListener('click', () => {
      window.location.assign(mount.dataset.chartHref)
    })
  }
}

// Re-render on resize using ResizeObserver
function observeMount(mount) {
  let rafId = null
  const ro = new window.ResizeObserver(() => {
    window.cancelAnimationFrame(rafId)
    rafId = window.requestAnimationFrame(() => renderChart(mount))
  })
  ro.observe(mount)
}

document.querySelectorAll('.app-chart').forEach((mount) => {
  renderChart(mount)
  observeMount(mount)
})
