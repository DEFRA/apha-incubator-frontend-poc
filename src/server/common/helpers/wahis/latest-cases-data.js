import { config } from '#/config/config.js'
import { createLogger } from '../logging/logger.js'
import {
  buildSubmissionDateWindow,
  resolveAvianInfluenzaDiseaseIds,
  resolveEuropeCountryIds
} from './latest-cases-filters.js'
import { getFilteredEvents, getReportAllInformation } from './wahis-client.js'

const defaultLogger = createLogger()

const oneWeekMs = 7 * 24 * 60 * 60 * 1000
const pageSize = 100
const initialReportType = 'IN'

/**
 * `detail.outbreaks` (from report `all-information`) is the report's
 * cumulative outbreak list as of that report, not automatically narrowed to
 * "new only". `createdByReportId` on each outbreak identifies which report
 * first introduced it, so filtering on that (rather than the outbreak's
 * own historical `startDate`) gives the outbreaks newly reported by a
 * specific report submitted in the last seven days — an outbreak that
 * started a week ago but was reported today still counts as "new".
 */
function filterNewOutbreaksForReport(outbreaks, reportId) {
  return (outbreaks ?? []).filter(
    (outbreak) => outbreak.createdByReportId === reportId
  )
}

/**
 * An `IN` (initial) report introduces every outbreak it lists — there is
 * no prior report for that event. If the `createdByReportId` filter finds
 * no matches for an `IN` report (e.g. a missing/null `createdByReportId`
 * on some records, contrary to the documented contract), fall back to
 * treating all outbreaks in the report's response as new, and log a
 * warning since it signals the primary filter did not behave as expected.
 */
function resolveNewOutbreaksForRow(row, outbreaks, logger) {
  const filtered = filterNewOutbreaksForReport(outbreaks, row.reportId)

  if (filtered.length > 0 || row.reportType !== initialReportType) {
    return filtered
  }

  const allOutbreaks = outbreaks ?? []
  if (allOutbreaks.length === 0) {
    return filtered
  }

  logger.warn(
    { eventId: row.eventId, reportId: row.reportId },
    'IN report had no outbreaks matching createdByReportId; falling back to all outbreaks in the report'
  )
  return allOutbreaks
}

/**
 * A follow-up (or any non-`IN`) report can update outbreaks it did not
 * introduce — `lastUpdateReportId` identifies which outbreaks this
 * specific report actually touched, as opposed to the event's full
 * cumulative outbreak list.
 */
function filterUpdatedOutbreaksForReport(outbreaks, reportId) {
  return (outbreaks ?? []).filter(
    (outbreak) => outbreak.lastUpdateReportId === reportId
  )
}

/**
 * Follow-up categorisation is driven by the report row's `eventStatus`
 * (`"ongoing"`/`"resolved"` per `wahis-data-model.md`). Any other/missing
 * value, or a `reportType` that is neither `IN` nor `FUR`, is treated as
 * the visible-but-not-overstated `follow_up_active` fallback.
 */
function categoryForEventStatus(eventStatus) {
  return eventStatus === 'resolved' ? 'follow_up_resolved' : 'follow_up_active'
}

/**
 * Combines newly-introduced and updated outbreaks for a single report row
 * into one categorised list (`new_outbreak` / `follow_up_active` /
 * `follow_up_resolved`), used for both the map and the results table. An outbreak
 * that is both newly created and last-updated by the same report is
 * counted once, as `new_outbreak`, to avoid double-plotting it.
 */
function resolveCategorisedOutbreaksForRow(row, outbreaks, logger) {
  const newOutbreaks = resolveNewOutbreaksForRow(row, outbreaks, logger)
  const newOutbreakIds = new Set(
    newOutbreaks.map((outbreak) => outbreak.outbreakId)
  )

  const taggedNewOutbreaks = newOutbreaks.map((outbreak) => ({
    ...outbreak,
    category: 'new_outbreak'
  }))

  if (row.reportType === initialReportType) {
    return taggedNewOutbreaks
  }

  const category = categoryForEventStatus(row.eventStatus)
  const updatedOutbreaks = filterUpdatedOutbreaksForReport(
    outbreaks,
    row.reportId
  )
    .filter((outbreak) => !newOutbreakIds.has(outbreak.outbreakId))
    .map((outbreak) => ({ ...outbreak, category }))

  return [...taggedNewOutbreaks, ...updatedOutbreaks]
}

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
 * reported in the last seven days: filter → event list (step 1), then
 * per-report `all-information` detail (step 2), scoped to the exact
 * report that fell in the window rather than the event's current latest
 * state. Per-outbreak species detail (step 3) is out of scope — the
 * aggregated `quantitativeData` from step 2 is used instead.
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
  // Node-side cut for a true rolling seven-day window.
  const cutoff = now.getTime() - oneWeekMs
  const recentRows = rows.filter(
    (row) => new Date(row.submissionDate).getTime() >= cutoff
  )

  const truncated = recentRows.length > maxDetailEvents
  const detailEventRows = recentRows.slice(0, maxDetailEvents)

  const events = await mapWithConcurrency(
    detailEventRows,
    detailConcurrency,
    async (row) => {
      const detail = await getReportAllInformation(row.reportId, { logger })
      const outbreaks = resolveCategorisedOutbreaksForRow(
        row,
        detail?.outbreaks,
        logger
      )

      if (row.reportType === 'FUR' && outbreaks.length === 0) {
        logger.debug(
          { eventId: row.eventId, reportId: row.reportId },
          'FUR report introduced no new outbreaks (expected for count/status-only updates)'
        )
      }

      return {
        summary: row,
        detail: detail && {
          ...detail,
          outbreaks
        },
        detailError: false
      }
    },
    {
      onError(error, row) {
        logger.warn(
          { err: error, eventId: row.eventId, reportId: row.reportId },
          'Failed to fetch WAHIS report detail; showing summary only'
        )
        return { summary: row, detail: null, detailError: true }
      }
    }
  )

  const eventsWithNewOutbreaks = events.filter((event) =>
    event.detail?.outbreaks?.some(
      (outbreak) => outbreak.category === 'new_outbreak'
    )
  ).length
  const totalNewOutbreaks = events.reduce(
    (sum, event) =>
      sum +
      (event.detail?.outbreaks?.filter(
        (outbreak) => outbreak.category === 'new_outbreak'
      ).length ?? 0),
    0
  )
  const totalFollowUpOutbreaks = events.reduce(
    (sum, event) =>
      sum +
      (event.detail?.outbreaks?.filter(
        (outbreak) => outbreak.category !== 'new_outbreak'
      ).length ?? 0),
    0
  )

  logger.info(
    {
      totalMatchedEvents: recentRows.length,
      eventsWithNewOutbreaks,
      totalNewOutbreaks,
      totalFollowUpOutbreaks
    },
    'Latest cases: new outbreak counts for this window'
  )

  return {
    events,
    totalMatched: recentRows.length,
    truncated,
    generatedAt: now,
    partialFailures: events.some((event) => event.detailError)
  }
}
