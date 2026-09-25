import * as cheerio from 'cheerio'
import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#idmDashboardController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('renders the dashboard cards in the expected grid columns', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/idm-dashboard'
    })
    const $ = cheerio.load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text()).toContain('IDM monitoring dashboard')
    expect($('[data-testid^="idm-dashboard-card-"]')).toHaveLength(3)
    expect(
      $(
        '.govuk-grid-column-two-thirds [data-testid="idm-dashboard-card-cases-and-outbreaks"]'
      )
    ).toHaveLength(1)
    expect(
      $('.govuk-grid-column-one-third [data-testid^="idm-dashboard-card-"]')
    ).toHaveLength(2)
  })

  test('is linked from the home page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })
    const $ = cheerio.load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('a[href="/idm-dashboard"]')).toHaveLength(1)
  })
})
