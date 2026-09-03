import { config } from '#/config/config.js'
import { createLogger } from '../logging/logger.js'
import {
  buildSubmissionDateWindow,
  resolveAvianInfluenzaDiseaseIds,
  resolveEuropeCountryIds
} from './latest-cases-filters.js'
import { getEventAllInformation, getFilteredEvents } from './wahis-client.js'

const defaultLogger = createLogger()

const oneDayMs = 24 * 60 * 60 * 1000
const pageSize = 100

/**
 * Runs a small number of async tasks with a concurrency cap. Callers can
 * provide `onError` when partial failure is acceptable for a given item.
 */
async function mapWithConcurrency(items, limit, mapFn, { onError } = {}) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      try {
        results[index] = await mapFn(items[index], index)
      } catch (error) {
        if (!onError) {
          throw error
        }

        results[index] = await onError(error, items[index], index)
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker)
  await Promise.all(workers)

  return results
}

/**
 * Workflow 4-style WAHIS fetch scoped to avian influenza events in Europe
 * reported in the last 24 hours: filter → event list (step 1), then
 * per-event `all-information` detail (step 2). Per-outbreak species
 * detail (step 3) is out of scope — the aggregated `quantitativeData`
 * from step 2 is used instead.
 */
export async function getLatestCases({
  now = new Date(),
  logger = defaultLogger
} = {}) {
  const { maxDetailEvents, detailConcurrency } = {
    maxDetailEvents: config.get('wahis.maxDetailEvents'),
    detailConcurrency: config.get('wahis.detailConcurrency')
  }

  const [countries, firstDiseases] = await Promise.all([
    resolveEuropeCountryIds({ logger }),
    resolveAvianInfluenzaDiseaseIds({ logger })
  ])

  const submissionDate = buildSubmissionDateWindow(now)
  // WAHIS only returns the required event slice when the geographic and
  // disease filters are applied together on the first list request.
  const fetchScope = { countries, firstDiseases }

  const response = await getFilteredEvents(
    {
      pageNumber: 0,
      pageSize,
      sortColumn: 'submissionDate',
      sortOrder: 'DESC',
      submissionDate,
      eventStartDate: null,
      ...fetchScope,
      eventIds: [],
      reportIds: [],
      secondDiseases: [],
      typeStatuses: [],
      reasons: [],
      eventStatuses: [],
      reportTypes: [],
      reportStatuses: [],
      animalTypes: []
    },
    { logger }
  )

  const rows = response?.list ?? []

  // The API's submissionDate filter is day-granularity only, so apply a
  // Node-side cut for a true rolling 24h window (see buildSubmissionDateWindow).
  const cutoff = now.getTime() - oneDayMs
  const recentRows = rows.filter(
    (row) => new Date(row.submissionDate).getTime() >= cutoff
  )

  const truncated = recentRows.length > maxDetailEvents
  const detailEventRows = recentRows.slice(0, maxDetailEvents)

  const events = await mapWithConcurrency(
    detailEventRows,
    detailConcurrency,
    async (row) => ({
      summary: row,
      detail: await getEventAllInformation(row.eventId, { logger }),
      detailError: false
    }),
    {
      onError(error, row) {
        logger.warn(
          { err: error, eventId: row.eventId },
          'Failed to fetch WAHIS event detail; showing summary only'
        )
        return { summary: row, detail: null, detailError: true }
      }
    }
  )

  return {
    events,
    totalMatched: recentRows.length,
    truncated,
    generatedAt: now,
    partialFailures: events.some((event) => event.detailError)
  }
}
