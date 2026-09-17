import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { esriMapPresenter } from './presenter.js'

describe('#esriMapController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('should return OK status and provide page context with correct title and breadcrumbs', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/esri-map'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  describe('#esriMapPresenter', () => {
    test('should return page title', () => {
      const context = esriMapPresenter()

      expect(context.pageTitle).toBe('Esri map')
    })

    test('should return heading', () => {
      const context = esriMapPresenter()

      expect(context.heading).toBe('Esri map')
    })

    test('should return breadcrumbs with home link', () => {
      const context = esriMapPresenter()

      expect(context.breadcrumbs).toEqual([
        {
          text: 'Home',
          href: '/'
        },
        {
          text: 'Esri map'
        }
      ])
    })
  })
})
