import {
  casesByDiseaseOverTime,
  casesByRegion,
  casesBySeverity,
  govukChartColours,
  weeklyCases
} from '#/server/common/helpers/outbreak-aggregations.js'
import { getOutbreakData } from '#/server/common/helpers/outbreak-data.js'

/**
 * D3 learning playground.
 *
 * The controller hands the client everything it might want to plot: the raw
 * synthetic outbreak records plus the same pre-built aggregations the dashboard
 * prototypes use. Nothing here needs changing to experiment with D3 — edit
 * src/client/javascripts/playground.js instead.
 */
export const playgroundController = {
  handler(_request, h) {
    const data = getOutbreakData()

    return h.view('playground/index', {
      pageTitle: 'D3 playground',
      heading: 'D3 playground',
      caption: 'A sandbox for experimenting with D3.js',
      disclaimer: data.meta.disclaimer,
      datasetTitle: data.meta.title,
      datasetDescription: data.meta.description,
      // Serialised into the page as JSON and read by the client-side module.
      playgroundData: {
        meta: data.meta,
        records: data.records,
        regions: data.regions,
        diseases: data.diseases,
        species: data.species,
        colours: govukChartColours,
        aggregations: {
          weeklyCases: weeklyCases(data.records),
          casesByRegion: casesByRegion(data.records),
          casesByDiseaseOverTime: casesByDiseaseOverTime(data.records),
          casesBySeverity: casesBySeverity(data.records)
        }
      },
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: 'D3 playground' }]
    })
  }
}
