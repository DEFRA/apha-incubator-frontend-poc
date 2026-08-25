import nunjucks from 'nunjucks'
import * as cheerio from 'cheerio'

import '#/config/nunjucks/nunjucks.js'
import {
  buildDashboardViewModel,
  buildExpandedViewModel
} from '#/server/common/helpers/dashboard-view-model.js'

function render(template, model) {
  return cheerio.load(
    nunjucks.renderString(template, {
      serviceName: 'apha-incubator-frontend-poc',
      serviceUrl: '/',
      navigation: [],
      getAssetPath: (asset) => `/public/${asset}`,
      ...model
    })
  )
}

const overviewTemplate = `
  {% extends 'partials/dashboard-overview.njk' %}
  {% block chartScript %}<script type="module" src="/public/dashboard-test.js"></script>{% endblock %}
`

const expandedTemplate = `
  {% extends 'partials/dashboard-expanded.njk' %}
  {% block chartScript %}<script type="module" src="/public/dashboard-test.js"></script>{% endblock %}
`

describe('#dashboardOverviewTemplate', () => {
  const model = buildDashboardViewModel('d3')
  const $ = render(overviewTemplate, model)

  test('Should render a card for each chart', () => {
    expect($('[data-testid^="chart-card-"]')).toHaveLength(4)

    for (const chart of model.charts) {
      expect($(`[data-testid="chart-mount-${chart.id}"]`)).toHaveLength(1)
    }
  })

  test('Should embed chart data as a JSON data block', () => {
    const payload = $('[data-chart-data="cases-by-region"]').text()

    expect(JSON.parse(payload)).toEqual(model.charts[1].data)
  })

  test('Should describe the mount point for the client module', () => {
    const mount = $('[data-testid="chart-mount-weekly-cases"]')

    expect(mount.attr('data-chart-type')).toBe('line')
    expect(mount.attr('data-label-type')).toBe('date')
    expect(mount.attr('data-clickable')).toBe('true')
    expect(mount.attr('data-chart-href')).toBe('/dashboard/d3/weekly-cases')
    expect(mount.attr('aria-label')).toEqual(
      expect.stringContaining('Weekly new cases')
    )
  })

  test('Should provide a keyboard accessible link for the clickable chart only', () => {
    expect($('[data-testid="chart-link-weekly-cases"]').attr('href')).toBe(
      '/dashboard/d3/weekly-cases'
    )
    expect($('[data-testid="chart-link-cases-by-region"]').attr('href')).toBe(
      '#'
    )
  })

  test('Should pair every chart with a data table in a details disclosure', () => {
    expect($('.govuk-details table')).toHaveLength(4)
  })

  test('Should show the synthetic data warning', () => {
    expect($('[data-testid="synthetic-data-warning"]').text()).toEqual(
      expect.stringContaining('synthetic sample data')
    )
  })

  test('Should let a library branch add its own chart script', () => {
    expect($('script[src="/public/dashboard-test.js"]')).toHaveLength(1)
    expect(
      $('script[src="/public/src/client/javascripts/application.js"]')
    ).toHaveLength(1)
  })
})

describe('#dashboardExpandedTemplate', () => {
  test('Should render the chart, filters and both summary panels', () => {
    const model = buildExpandedViewModel('d3', 'weekly-cases')
    const $ = render(expandedTemplate, model)

    expect($('[data-testid="chart-mount-weekly-cases"]').attr('class')).toEqual(
      expect.stringContaining('app-chart--large')
    )
    expect($('[data-testid="dashboard-filters"]').attr('action')).toBe(
      '/dashboard/d3/weekly-cases'
    )
    expect($('select#region option')).toHaveLength(6)
    expect($('select#disease option')).toHaveLength(4)
    expect($('[data-testid^="summary-panel-"]')).toHaveLength(2)
    expect($('[data-testid="back-to-dashboard"]').attr('href')).toBe(
      '/dashboard/d3'
    )
    expect($('[data-testid="no-records"]')).toHaveLength(0)
  })

  test('Should preselect the applied filters', () => {
    const model = buildExpandedViewModel('d3', 'weekly-cases', {
      region: 'Devon'
    })
    const $ = render(expandedTemplate, model)

    expect($('select#region option[selected]').attr('value')).toBe('Devon')
  })

  test('Should tell the user when no records match', () => {
    const model = buildExpandedViewModel('d3', 'weekly-cases')
    const $ = render(expandedTemplate, { ...model, hasRecords: false })

    expect($('[data-testid="no-records"]').text()).toEqual(
      expect.stringContaining('No records match')
    )
  })
})
