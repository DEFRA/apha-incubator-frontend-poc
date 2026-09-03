const notReported = 'Not reported'

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
        : notReported
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
  return {
    generatedAt,
    totalMatched,
    truncated,
    partialFailures,
    hasEvents: events.length > 0,
    events: events.map(buildEventSection)
  }
}
