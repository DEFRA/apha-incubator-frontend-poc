import { createServer } from '#/server/server.js'

describe('#contentSecurityPolicy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should set the CSP policy header', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(resp.headers['content-security-policy']).toBeDefined()
  })

  test('Should allow inline styles in style-src for Plotly.js and MapLibre GL compatibility', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(resp.headers['content-security-policy']).toMatch(
      /style-src[^;]*'unsafe-inline'/
    )
  })

  test('Should allow MapLibre GL to fetch tiles from OpenFreeMap and run its worker', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).toContain('connect-src')
    expect(csp).toContain('https://tiles.openfreemap.org')
    expect(csp).toContain('img-src')
    expect(csp).toMatch(/worker-src[^;]*'self'/)
    expect(csp).toMatch(/worker-src[^;]*blob:/)
  })
})
