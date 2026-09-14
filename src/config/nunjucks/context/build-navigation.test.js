import { buildNavigation } from './build-navigation.js'

function mockRequest(options) {
  return { ...options }
}

describe('#buildNavigation', () => {
  test('Should provide expected navigation details', () => {
    expect(
      buildNavigation(mockRequest({ path: '/non-existent-path' }))
    ).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      },
      {
        current: false,
        text: 'Latest cases',
        href: '/latest-cases'
      },
      {
        current: false,
        text: 'Esri map',
        href: '/esri-map'
      }
    ])
  })

  test('Should provide expected highlighted navigation details', () => {
    expect(buildNavigation(mockRequest({ path: '/' }))).toEqual([
      {
        current: true,
        text: 'Home',
        href: '/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      },
      {
        current: false,
        text: 'Latest cases',
        href: '/latest-cases'
      },
      {
        current: false,
        text: 'Esri map',
        href: '/esri-map'
      }
    ])
  })

  test('Should highlight the Esri map link on the Esri map page', () => {
    expect(buildNavigation(mockRequest({ path: '/esri-map' }))).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      },
      {
        current: false,
        text: 'Latest cases',
        href: '/latest-cases'
      },
      {
        current: true,
        text: 'Esri map',
        href: '/esri-map'
      }
    ])
  })
})
