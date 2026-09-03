import Boom from '@hapi/boom'

import { config } from '#/config/config.js'
import { createLogger } from '../logging/logger.js'

const defaultLogger = createLogger()

/**
 * Thin fetch wrapper around the public, unofficial WAHIS (World Animal
 * Health Information System) API. It relies on a reverse-engineered
 * public WAHIS API contract.
 */
async function wahisRequest(
  path,
  { method = 'GET', body, logger = defaultLogger } = {}
) {
  const baseUrl = config.get('wahis.baseUrl')
  const language = config.get('wahis.language')
  const timeoutMs = config.get('wahis.timeoutMs')
  const separator = path.includes('?') ? '&' : '?'
  const url = `${baseUrl}${path}${separator}language=${language}`
  const requestOptions = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  }

  if (timeoutMs != null) {
    requestOptions.signal = AbortSignal.timeout(timeoutMs)
  }

  let response
  try {
    response = await fetch(url, requestOptions)
  } catch (error) {
    const timedOut =
      error?.name === 'TimeoutError' ||
      error?.cause?.name === 'TimeoutError' ||
      error?.code === 'ABORT_ERR' ||
      error?.cause?.code === 'ABORT_ERR'

    logger.error(
      { err: error, url, timeoutMs, timedOut },
      timedOut ? 'WAHIS request timed out' : 'WAHIS request failed'
    )
    throw Boom.badGateway(
      timedOut
        ? 'WAHIS API request timed out'
        : 'Unable to reach the WAHIS API',
      error
    )
  }

  if (!response.ok) {
    logger.error(
      { url, statusCode: response.status },
      'WAHIS API returned a non-2xx response'
    )
    throw Boom.badGateway(`WAHIS API responded with status ${response.status}`)
  }

  return response.json()
}

/**
 * `GET pi/country/list-geo-region` — continents/regions with member
 * `countryIds`. Used to resolve "Europe" to a list of `areaId`s.
 */
export function getGeoRegions(options) {
  return wahisRequest('/country/list-geo-region', options)
}

/**
 * `GET pi/disease/first-level-filters` — the top-level disease catalog used
 * to resolve avian influenza disease ids.
 */
export function getFirstLevelDiseases(options) {
  return wahisRequest('/disease/first-level-filters', options)
}

/**
 * `POST pi/event/filtered-list` — paginated, filterable event list
 * (Workflow 4, step 1).
 */
export function getFilteredEvents(body, options) {
  return wahisRequest('/event/filtered-list', {
    method: 'POST',
    body,
    ...options
  })
}

/**
 * `GET pi/review/event/{eventId}/all-information` — full validated event
 * detail (Workflow 4, step 2).
 */
export function getEventAllInformation(eventId, options) {
  return wahisRequest(`/review/event/${eventId}/all-information`, options)
}
