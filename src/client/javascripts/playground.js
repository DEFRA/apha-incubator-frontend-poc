/**
 * =============================================================================
 * D3.js playground — this is the only file you need to edit
 * =============================================================================
 *
 * Served at: http://localhost:3000/playground
 *
 * What is already wired up for you:
 *   - The whole D3 library (v7) is imported below as `d3`.
 *   - The synthetic outbreak dataset and pre-built aggregations are embedded in
 *     the page by the server and read into `data` for you.
 *   - Three drawing surfaces (mount points) exist in the page:
 *       "main", "scratch-a", "scratch-b".
 *   - A worked example (a bar chart) is rendered into "main" so you have
 *     something to pull apart.
 *
 * Where to add your own code:
 *   - Jump to the "YOUR EXPERIMENTS" section near the bottom.
 *
 * Tip: `window.playground` is exposed at the end of this file, so in the browser
 * console you can poke at `playground.data`, `playground.d3` and re-run helpers.
 */

// Imports the entire D3 bundle. You could also import only what you need, e.g.
// `import { select, scaleLinear } from 'd3'` — but for learning, the full
// namespace keeps the official docs' `d3.something()` examples copy-pasteable.
import * as d3 from 'd3'

// -----------------------------------------------------------------------------
// 1. Data
// -----------------------------------------------------------------------------

/**
 * Reads the JSON payload the server rendered into the page.
 *
 * Shape of the returned object:
 *   meta          { title, description, disclaimer, weekRange, ... }
 *   records       [{ id, weekStarting, region, speciesId, species,
 *                    diseaseId, disease, severity, newCases }, ...]   (raw rows)
 *   regions       ['Yorkshire', 'Cumbria', ...]
 *   diseases      [{ id, name, note }, ...]
 *   species       [{ id, name, ... }, ...]
 *   colours       GOV.UK palette, e.g. ['#1d70b8', '#00703c', ...]
 *   aggregations  ready-made chart data, each shaped as
 *                 { labels: string[],
 *                   series: [{ name, colour, values: number[] }] }
 *                 keys: weeklyCases, casesByRegion,
 *                       casesByDiseaseOverTime, casesBySeverity
 *
 * @returns {object|null}
 */
function readPlaygroundData() {
  const script = document.querySelector(
    'script[type="application/json"][data-playground-data]'
  )

  if (!script) {
    return null
  }

  try {
    return JSON.parse(script.textContent)
  } catch {
    return null
  }
}

// -----------------------------------------------------------------------------
// 2. Small helpers — reuse these in your own charts
// -----------------------------------------------------------------------------

/** Standard padding around a chart so axes and labels have room. */
const MARGIN = { top: 16, right: 16, bottom: 56, left: 56 }

/**
 * Finds one of the drawing surfaces in the page.
 * @param {'main'|'scratch-a'|'scratch-b'} name
 * @returns {HTMLElement|null}
 */
function mount(name) {
  return document.querySelector(`[data-playground-mount="${name}"]`)
}

/**
 * Creates a fresh, correctly sized `<svg>` inside a mount point and returns
 * both the svg selection and an inner `<g>` already offset by the margins.
 *
 * This is the boilerplate almost every D3 chart starts with — the "margin
 * convention" (https://observablehq.com/@d3/margin-convention).
 *
 * @param {HTMLElement} el the mount element
 * @param {{top:number,right:number,bottom:number,left:number}} [margin]
 * @returns {{svg: object, g: object, width: number, height: number,
 *            innerWidth: number, innerHeight: number}}
 */
function createSvg(el, margin = MARGIN) {
  // Clear anything drawn previously, so re-running is always safe.
  el.innerHTML = ''

  const { width, height } = el.getBoundingClientRect()
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const svg = d3
    .select(el)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    // The charts here are decorative duplicates of accessible content, so hide
    // them from assistive tech. Remove this if your chart is the only source.
    .attr('aria-hidden', 'true')
    .attr('focusable', 'false')

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  return { svg, g, width, height, innerWidth, innerHeight }
}

/**
 * Turns a "2024-01-01" style label into a Date, useful for time scales.
 * @param {string} value
 * @returns {Date}
 */
const parseWeek = d3.timeParse('%Y-%m-%d')

/** Formats a Date as "01 Jan" for axis ticks. */
const formatWeek = d3.timeFormat('%d %b')

// -----------------------------------------------------------------------------
// 3. Worked example — a simple bar chart
// -----------------------------------------------------------------------------

/**
 * Renders total cases per region as a bar chart.
 *
 * Read this top to bottom to see the five steps every D3 chart follows:
 *   1. get the data              2. create scales (data -> pixels)
 *   3. draw the axes             4. join data to elements ("data join")
 *   5. set attributes from data
 *
 * @param {HTMLElement} el mount element to draw into
 * @param {object} data the playground data payload
 */
function exampleBarChart(el, data) {
  // 1. Data: use the ready-made aggregation { labels, series }.
  const { labels, series } = data.aggregations.casesByRegion
  const values = series[0].values

  const { g, innerWidth, innerHeight } = createSvg(el)

  // 2. Scales map data values to pixel positions.
  //    scaleBand   -> evenly spaced categories along the x axis
  //    scaleLinear -> continuous numbers along the y axis
  const x = d3.scaleBand().domain(labels).range([0, innerWidth]).padding(0.2)

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(values)])
    .nice() // round the top of the axis up to a friendly number
    .range([innerHeight, 0]) // note: inverted, because SVG y grows downwards

  // 3. Axes are generators that draw themselves into a `<g>`.
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('font-size', '12px')

  g.append('g').call(d3.axisLeft(y).ticks(5))

  // 4 + 5. The data join: bind one array entry to one `<rect>`, then set each
  // rect's position and size from its datum.
  g.selectAll('rect.bar')
    .data(values)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', (_value, index) => x(labels[index]))
    .attr('y', (value) => y(value))
    .attr('width', x.bandwidth())
    .attr('height', (value) => innerHeight - y(value))
    .attr('fill', data.colours[0])
}

/**
 * A second example: a line chart over time, showing how to use a time scale
 * and `d3.line()`. Not rendered by default — call it from your experiments.
 *
 * @param {HTMLElement} el mount element to draw into
 * @param {object} data the playground data payload
 */
function exampleLineChart(el, data) {
  const { labels, series } = data.aggregations.weeklyCases
  const points = labels.map((label, index) => ({
    date: parseWeek(label),
    value: series[0].values[index]
  }))

  const { g, innerWidth, innerHeight } = createSvg(el)

  const x = d3
    .scaleTime()
    .domain(d3.extent(points, (point) => point.date))
    .range([0, innerWidth])

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(points, (point) => point.value)])
    .nice()
    .range([innerHeight, 0])

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(formatWeek))

  g.append('g').call(d3.axisLeft(y).ticks(4))

  const line = d3
    .line()
    .x((point) => x(point.date))
    .y((point) => y(point.value))

  g.append('path')
    .datum(points)
    .attr('fill', 'none')
    .attr('stroke', data.colours[1])
    .attr('stroke-width', 2)
    .attr('d', line)
}

// -----------------------------------------------------------------------------
// 4. YOUR EXPERIMENTS — add your D3 code here
// -----------------------------------------------------------------------------

/**
 * Write whatever you like in here. It runs once the page and data are ready.
 *
 * Handy starting points:
 *   const el = mount('scratch-a')            // pick a drawing surface
 *   const { g, innerWidth, innerHeight } = createSvg(el)
 *   const rows = data.records                // raw data, 124 weekly records
 *   const byRegion = d3.rollup(              // group + summarise with D3
 *     rows,
 *     (group) => d3.sum(group, (row) => row.newCases),
 *     (row) => row.region
 *   )
 *
 * @param {object} data the playground data payload
 */
function myExperiments(data) {
  // Example: uncomment to draw the line chart into the first scratch canvas.
  // exampleLineChart(mount('scratch-a'), data)
  // --- your code below ---
}

// -----------------------------------------------------------------------------
// 5. Bootstrap — you shouldn't need to change anything below this line
// -----------------------------------------------------------------------------

function render() {
  const data = readPlaygroundData()

  if (!data) {
    return
  }

  const main = mount('main')

  if (main) {
    exampleBarChart(main, data)
  }

  myExperiments(data)

  // Exposed for tinkering from the browser console, e.g.
  //   playground.d3.max(playground.data.records, (r) => r.newCases)
  window.playground = {
    d3,
    data,
    mount,
    createSvg,
    render,
    examples: { exampleBarChart, exampleLineChart }
  }
}

render()

// Redraw on resize so charts stay the right size. Debounced to avoid redrawing
// on every single resize event.
let resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(render, 150)
})
