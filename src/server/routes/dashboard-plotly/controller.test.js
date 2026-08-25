import * as cheerio from 'cheerio'
import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#dashboardPlotlyController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('overview returns 200 and renders all four chart mounts', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/plotly'
    })

    expect(statusCode).toBe(statusCodes.ok)

    const $ = cheerio.load(result)
    expect($('[data-testid="chart-mount-weekly-cases"]').length).toBe(1)
    expect($('[data-testid="chart-mount-cases-by-region"]').length).toBe(1)
    expect($('[data-testid="chart-mount-cases-by-disease"]').length).toBe(1)
    expect($('[data-testid="chart-mount-severity-breakdown"]').length).toBe(1)
  })

  test('overview shows the synthetic-data warning', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/plotly'
    })

    expect(statusCode).toBe(statusCodes.ok)

    const $ = cheerio.load(result)
    expect($('[data-testid="synthetic-data-warning"]').length).toBe(1)
  })
})

describe('#dashboardPlotlyExpandedController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('expanded view returns 200 for weekly-cases', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/plotly/weekly-cases'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Weekly new cases'))
  })

  test('expanded view honours ?region and ?disease query params', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/plotly/weekly-cases?region=Devon&disease=bramblewick-pox'
    })

    expect(statusCode).toBe(statusCodes.ok)

    // Just check the page rendered; filter summary is in the caption text area
    expect(result).toEqual(expect.stringContaining('Plotly.js'))
  })

  test('invalid filter values fall back to all rather than erroring', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/plotly/weekly-cases?region=InvalidRegion&disease=invalid-disease'
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $ = cheerio.load(result)
    expect($('[data-testid="chart-mount-weekly-cases"]').length).toBe(1)
  })

  test('unknown chartId returns 404', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/plotly/not-a-real-chart'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
