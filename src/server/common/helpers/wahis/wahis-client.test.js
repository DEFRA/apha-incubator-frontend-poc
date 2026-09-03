import createFetchMock from 'vitest-fetch-mock'
import { vi } from 'vitest'

import { config } from '#/config/config.js'
import {
  getEventAllInformation,
  getFilteredEvents,
  getFirstLevelDiseases,
  getGeoRegions
} from './wahis-client.js'

const fetchMock = createFetchMock(vi)
fetchMock.enableMocks()

describe('#wahis-client', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
    config.set('wahis.timeoutMs', null)
  })

  test('getGeoRegions requests list-geo-region with the configured language', async () => {
    fetchMock.mockResponseOnce(JSON.stringify([{ id: 4, name: 'Europe' }]))

    const result = await getGeoRegions()

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.get('wahis.baseUrl')}/country/list-geo-region?language=en`,
      expect.objectContaining({ method: 'GET' })
    )
    expect(result).toEqual([{ id: 4, name: 'Europe' }])
  })

  test('getFirstLevelDiseases requests first-level-filters', async () => {
    fetchMock.mockResponseOnce(JSON.stringify([]))

    await getFirstLevelDiseases()

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.get('wahis.baseUrl')}/disease/first-level-filters?language=en`,
      expect.objectContaining({ method: 'GET' })
    )
  })

  test('getFilteredEvents POSTs the given body as JSON', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ list: [], totalSize: 0 }))
    const body = { pageNumber: 0, pageSize: 100 }

    const result = await getFilteredEvents(body)

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.get('wahis.baseUrl')}/event/filtered-list?language=en`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      })
    )
    expect(result).toEqual({ list: [], totalSize: 0 })
  })

  test('getEventAllInformation requests review/event/{id}/all-information', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ event: { eventId: 7750 } }))

    const result = await getEventAllInformation(7750)

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.get('wahis.baseUrl')}/review/event/7750/all-information?language=en`,
      expect.objectContaining({ method: 'GET' })
    )
    expect(result).toEqual({ event: { eventId: 7750 } })
  })

  test('Should throw a badGateway Boom error for a non-2xx response', async () => {
    fetchMock.mockResponseOnce('Server error', { status: 500 })

    await expect(getGeoRegions()).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 502 }
    })
  })

  test('Should throw a badGateway Boom error when the request itself fails', async () => {
    fetchMock.mockRejectOnce(new Error('network down'))
    const request = getGeoRegions()

    await expect(request).rejects.toThrow('Unable to reach the WAHIS API')
    await expect(request).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 502 }
    })
  })

  test('Should throw a timeout-specific Boom error when the request times out', async () => {
    fetchMock.mockRejectOnce(
      Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    )
    const request = getGeoRegions()

    await expect(request).rejects.toThrow('WAHIS API request timed out')
    await expect(request).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 502 }
    })
  })

  test('Should not set a fetch timeout signal when no timeout is configured', async () => {
    fetchMock.mockResponseOnce(JSON.stringify([{ id: 4, name: 'Europe' }]))

    await getGeoRegions()

    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('signal')
  })
})
