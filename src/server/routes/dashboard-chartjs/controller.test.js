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
    test('returns 200', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/dashboard/chartjs'
      })
      expect(statusCode).toBe(statusCodes.ok)
    })

    test('renders all four chart mounts', async () => {
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

    test('renders synthetic-data warning', async () => {
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

  test('returns 200 for weekly-cases', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/chartjs/weekly-cases'
    })
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('honours region and disease query params', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/chartjs/weekly-cases?region=Devon&disease=bramblewick-pox'
    })
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Devon')
  })

  test('invalid filter values fall back gracefully (no 500)', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/chartjs/weekly-cases?region=NotARealRegion&disease=not-real'
    })
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('unknown chartId returns 404', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/chartjs/not-a-real-chart'
    })
    expect(statusCode).toBe(statusCodes.notFound)
  })
})
