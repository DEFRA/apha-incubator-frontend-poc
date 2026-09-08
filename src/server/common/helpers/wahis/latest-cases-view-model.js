const notReported = 'Not reported'

const CATEGORY_LABELS = {
  new_outbreak: 'New outbreak',
  follow_up_active: 'Follow-up — event ongoing',
  follow_up_resolved: 'Follow-up — event resolved'
}

function displayCount(value) {
  return value === null || value === undefined ? notReported : String(value)
}

/**
 * Trims trailing/leading whitespace WAHIS sometimes includes in disease
 * names (e.g. `"West Nile Fever "`), tolerating missing values.
 */
function clean(value) {
  return typeof value === 'string' ? value.trim() : value
}

/**
 * Prefers a catalog entry's human-readable `translation` over its internal
 * `keyValue`, per Workflow 4's documented pitfalls.
 */
function translationOf(catalogValue) {
  return (
    clean(catalogValue?.translation) ?? clean(catalogValue?.keyValue) ?? null
  )
}

function buildOutbreakRows(outbreaks = []) {
  return outbreaks.map((outbreak) => ({
    adminDivision: clean(outbreak.adminDivision) || notReported,
    location: clean(outbreak.location) || notReported,
    startDate: outbreak.startDate,
    endDate: outbreak.endDate,
    coordinates:
      outbreak.latitude != null && outbreak.longitude != null
        ? `${outbreak.latitude}, ${outbreak.longitude}`
        : 'Not plotted: coordinates not reported'
  }))
}

/**
 * Maps `quantitativeData.totals` (cumulative counts, not just this report's
 * new counts — labelled as such in the template) to display rows. `0` and
 * `null` are semantically different in WAHIS data ("none observed" vs.
 * "not reported"), so nulls must render as "Not reported", never "0".
 */
function buildSpeciesRows(quantitativeData) {
  const unit = translationOf(quantitativeData?.unit)
  const totals = quantitativeData?.totals ?? []

  return totals.map((total) => ({
    speciesName: clean(total.speciesName) || notReported,
    isWild: Boolean(total.isWild),
    susceptible: displayCount(total.susceptible),
    cases: displayCount(total.cases),
    deaths: displayCount(total.deaths),
    killed: displayCount(total.killed),
    slaughtered: displayCount(total.slaughtered),
    vaccinated: displayCount(total.vaccinated),
    unit
  }))
}

/**
 * Transforms raw events into a flat array of outbreak records. Each outbreak
 * carries its parent event's country, disease and eventId. Events without a
 * detail fetch result (detail === null) are skipped; they contribute no outbreaks.
 */
export function buildOutbreakList(events = []) {
  const outbreaks = []

  for (const event of events) {
    if (!event.detail) {
      continue
    }

    const eventOutbreaks = event.detail.outbreaks ?? []
    for (const outbreak of eventOutbreaks) {
      const category = CATEGORY_LABELS[outbreak.category]
        ? outbreak.category
        : 'follow_up_active'

      outbreaks.push({
        outbreakId: outbreak.outbreakId ?? null,
        eventId: event.summary.eventId ?? null,
        country: clean(event.summary.country) || notReported,
        disease: clean(event.summary.disease) || notReported,
        adminDivision: clean(outbreak.adminDivision) || notReported,
        location: clean(outbreak.location) || notReported,
        startDate: outbreak.startDate ?? null,
        endDate: outbreak.endDate ?? null,
        latitude: outbreak.latitude ?? null,
        longitude: outbreak.longitude ?? null,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        plotted: outbreak.latitude != null && outbreak.longitude != null,
        isCluster: outbreak.isCluster ?? null,
        clusterCount: outbreak.clusterCount ?? null,
        locationApprox: outbreak.locationApprox ?? null,
        provenanceUrl: `https://wahis.woah.org/#/in-review/${event.summary.eventId}`
      })
    }
  }

  return outbreaks
}

function buildEventSection({ summary, detail, detailError }) {
  const disease = clean(summary.disease) || notReported
  const country = clean(summary.country) || notReported
  const detailEvent = detail?.event
  const detailReport = detail?.report

  return {
    eventId: summary.eventId,
    heading: `${country} — ${disease}`,
    summaryLine: {
      eventStatus: clean(summary.eventStatus) || notReported,
      reportType: clean(summary.reportType) || notReported,
      submissionDate: summary.submissionDate
    },
    provenanceUrl: `https://wahis.woah.org/#/in-review/${summary.eventId}`,
    detailError,
    detail: detail
      ? {
          subType: translationOf(detailEvent?.subType?.disease) || notReported,
          causalAgent: clean(detailEvent?.causalAgent?.name) || notReported,
          reason: translationOf(detailEvent?.reason) || notReported,
          eventStatus: translationOf(detailEvent?.eventStatus) || notReported,
          startedOn: detailEvent?.startedOn ?? null,
          confirmOn: detailEvent?.confirmOn ?? null,
          endedOn: detailEvent?.endedOn ?? null,
          reportStatus:
            translationOf(detailReport?.reportStatus) || notReported,
          reportNumber: detailReport?.reportNumber ?? notReported,
          outbreaks: buildOutbreakRows(detail.outbreaks),
          species: buildSpeciesRows(detail.quantitativeData)
        }
      : null
  }
}

/**
 * Maps the raw `getLatestCases` payload to a view model the
 * `latest-cases/index.njk` template can render directly.
 */
export function buildLatestCasesViewModel({
  events,
  totalMatched,
  truncated,
  generatedAt,
  partialFailures
}) {
  const outbreaks = buildOutbreakList(events)
  const plottedCount = outbreaks.filter((o) => o.plotted).length
  const unplottedCount = outbreaks.length - plottedCount

  return {
    generatedAt,
    totalMatched,
    truncated,
    partialFailures,
    hasEvents: events.length > 0,
    events: events.map(buildEventSection),
    outbreaks,
    outbreakCount: outbreaks.length,
    plottedCount,
    unplottedCount,
    hasOutbreaks: outbreaks.length > 0
  }
}
