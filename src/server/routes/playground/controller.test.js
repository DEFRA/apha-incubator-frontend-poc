import * as cheerio from 'cheerio'
import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#playgroundController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should return 200 and render the drawing surfaces', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/playground'
    })

    expect(statusCode).toBe(statusCodes.ok)

    const $ = cheerio.load(result)
    expect($('[data-playground-mount="main"]').length).toBe(1)
    expect($('[data-playground-mount="scratch-a"]').length).toBe(1)
    expect($('[data-playground-mount="scratch-b"]').length).toBe(1)
  })

  test('Should embed the dataset and aggregations as JSON', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/playground'
    })

    expect(statusCode).toBe(statusCodes.ok)

    const $ = cheerio.load(result)
    const payload = JSON.parse(
      $('script[type="application/json"][data-playground-data]').text()
    )

    expect(payload.records.length).toBeGreaterThan(0)
    expect(payload.regions.length).toBeGreaterThan(0)
    expect(payload.colours.length).toBeGreaterThan(0)
    expect(Object.keys(payload.aggregations)).toEqual([
      'weeklyCases',
      'casesByRegion',
      'casesByDiseaseOverTime',
      'casesBySeverity'
    ])
    expect(payload.aggregations.weeklyCases.labels.length).toBeGreaterThan(0)
  })

  test('Should render the synthetic-data warning', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/playground'
    })

    expect(result).toEqual(expect.stringContaining('synthetic'))
  })
})
