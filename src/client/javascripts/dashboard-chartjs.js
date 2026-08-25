/**
 * Chart.js dashboard prototype – client-side rendering module.
 *
 * Tree-shaken: only the controllers, elements, scales and plugins actually
 * used are registered, keeping the bundle smaller than importing from 'chart.js/auto'.
 *
 * Date labels: The date-type axes use CategoryScale with pre-formatted label
 * strings (ISO date strings from the data model). A time-scale adapter is not
 * installed to avoid an additional dependency; Chart.js' own date formatting
 * would require one.
 *
 * CSP note: Chart.js sets sizing styles directly on the <canvas> element via
 * canvas.style.width / canvas.style.height. Those are inline element styles,
 * NOT inline <style> blocks, so they are not covered by the `style-src` CSP
 * directive and do NOT require 'unsafe-inline'. The existing `style-src 'self'`
 * policy is sufficient.
 */

import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

Chart.register(
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
)

/** Shared base options applied to all charts */
const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  }
}

function buildLineChart(canvas, data) {
  const series = data.series[0]
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: series.name,
          data: series.values,
          borderColor: series.colour,
          backgroundColor: series.colour + '33',
          fill: true,
          tension: 0.3,
          pointRadius: 3
        }
      ]
    },
    options: {
      ...baseOptions,
      scales: {
        x: {
          ticks: { maxRotation: 45, maxTicksLimit: 8 }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Cases' }
        }
      }
    }
  })
}

function buildBarChart(canvas, data) {
  const series = data.series[0]
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: series.name,
          data: series.values,
          backgroundColor: series.colour
        }
      ]
    },
    options: {
      ...baseOptions,
      scales: {
        x: { title: { display: true, text: 'Region' } },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Cases' }
        }
      }
    }
  })
}

function buildStackedBarChart(canvas, data) {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: data.series.map((s) => ({
        label: s.name,
        data: s.values,
        backgroundColor: s.colour
      }))
    },
    options: {
      ...baseOptions,
      plugins: {
        legend: { display: true, position: 'bottom' }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { maxRotation: 45, maxTicksLimit: 8 }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: { display: true, text: 'Cases' }
        }
      }
    }
  })
}

function buildDoughnutChart(canvas, data) {
  const series = data.series[0]
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: data.labels,
      datasets: [
        {
          data: series.values,
          backgroundColor: data.sliceColours
        }
      ]
    },
    options: {
      ...baseOptions,
      plugins: {
        legend: { display: true, position: 'bottom' }
      }
    }
  })
}

const builders = {
  line: buildLineChart,
  bar: buildBarChart,
  'stacked-bar': buildStackedBarChart,
  doughnut: buildDoughnutChart
}

document.querySelectorAll('.app-chart[data-chart-id]').forEach((mount) => {
  const chartId = mount.dataset.chartId
  const chartType = mount.dataset.chartType
  const isClickable = mount.dataset.clickable === 'true'
  const chartHref = mount.dataset.chartHref

  const dataScript = document.querySelector(
    `script[type="application/json"][data-chart-data="${chartId}"]`
  )
  if (!dataScript) return

  let chartData
  try {
    chartData = JSON.parse(dataScript.textContent)
  } catch {
    return
  }

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  mount.appendChild(canvas)

  const builder = builders[chartType]
  if (builder) {
    builder(canvas, chartData)
  }

  if (isClickable && chartHref && chartHref !== '#') {
    mount.style.cursor = 'pointer'
    mount.addEventListener('click', () => {
      window.location.assign(chartHref)
    })
  }
})
