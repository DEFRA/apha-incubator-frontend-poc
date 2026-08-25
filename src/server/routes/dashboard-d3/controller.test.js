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

  test('overview returns 200 and renders all four chart mounts', async () => {
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

  test('overview renders the synthetic-data warning', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/d3'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('synthetic'))
  })

  test('expanded view returns 200 for weekly-cases', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/d3/weekly-cases'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Weekly new cases'))
  })

  test('expanded view honours region and disease query params', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/d3/weekly-cases?region=Devon&disease=bramblewick-pox'
    })

    // Falls back to "all" for unknown values — should still return 200
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Weekly new cases'))
  })

  test('invalid filter values fall back to all rather than erroring', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/d3/weekly-cases?region=UNKNOWN_REGION&disease=UNKNOWN_DISEASE'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('unknown chartId returns 404', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/dashboard/d3/not-a-real-chart'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
