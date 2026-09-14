import * as cheerio from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#esriMapController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/esri-map'
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $ = cheerio.load(result)
    expect(
      $('[data-testid="esri-map-placeholder"]').text().trim()
    ).toBe('Esri map')
    expect($('[data-testid="home-link"]').attr('href')).toBe('/')
  })
})
