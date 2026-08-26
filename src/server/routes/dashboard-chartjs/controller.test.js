import * as cheerio from 'cheerio'
import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#dashboardChartjsController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('GET /dashboard/chartjs', () => {
    test('Should return 200 for the overview page', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/dashboard/chartjs'
      })
      expect(statusCode).toBe(statusCodes.ok)
    })

    test('Should render all four chart mounts', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/dashboard/chartjs'
      })
      const $ = cheerio.load(result)
      expect($('[data-chart-id="weekly-cases"]').length).toBe(1)
      expect($('[data-chart-id="cases-by-region"]').length).toBe(1)
      expect($('[data-chart-id="cases-by-disease"]').length).toBe(1)
      expect($('[data-chart-id="severity-breakdown"]').length).toBe(1)
    })

    test('Should render the synthetic-data warning', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/dashboard/chartjs'
      })
      expect(result).toContain('synthetic')
    })
  })
})

describe('#dashboardChartjsExpandedController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should return 200 for the weekly-cases expanded view', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/chartjs/weekly-cases'
    })
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should honour region and disease query params', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/chartjs/weekly-cases?region=Devon&disease=bramblewick-pox'
    })
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Devon')
  })

  test('Should fall back to all records when filter values are invalid', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/chartjs/weekly-cases?region=NotARealRegion&disease=not-real'
    })
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should return 404 and render the error page for an unknown chartId', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/chartjs/not-a-real-chart'
    })
    expect(statusCode).toBe(statusCodes.notFound)
    expect(result).toContain('Page not found')
  })
})
