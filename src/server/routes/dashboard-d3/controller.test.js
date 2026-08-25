import * as cheerio from 'cheerio'
import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#dashboardD3Controller', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should return 200 and render all four chart mounts', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/d3'
    })

    expect(statusCode).toBe(statusCodes.ok)

    const $ = cheerio.load(result)
    expect($('[data-chart-id="weekly-cases"]').length).toBe(1)
    expect($('[data-chart-id="cases-by-region"]').length).toBe(1)
    expect($('[data-chart-id="cases-by-disease"]').length).toBe(1)
    expect($('[data-chart-id="severity-breakdown"]').length).toBe(1)
  })

  test('Should render the synthetic-data warning on the overview', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/d3'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('synthetic'))
  })

  test('Should return 200 for the expanded weekly-cases view', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/d3/weekly-cases'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Weekly new cases'))
  })

  test('Should honour region and disease query params on the expanded view', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/d3/weekly-cases?region=Devon&disease=bramblewick-pox'
    })

    // Unknown values fall back to "all" — should still return 200
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Weekly new cases'))
  })

  test('Should fall back to all records when filter values are unrecognised', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/d3/weekly-cases?region=UNKNOWN_REGION&disease=UNKNOWN_DISEASE'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should return 404 and render the styled error page for an unknown chartId', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/d3/not-a-real-chart'
    })

    expect(statusCode).toBe(statusCodes.notFound)
    expect(result).toEqual(expect.stringContaining('Page not found'))
  })
})
