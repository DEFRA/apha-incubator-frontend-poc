const dashboardTitle = 'IDM monitoring dashboard'

/**
 * Presenter for the IDM monitoring dashboard page.
 * Encapsulates the logic for building the page context data.
 *
 * This is a placeholder scaffold: it returns static card definitions with no
 * real data. Wiring the cards to live IDM data is out of scope for this
 * phase and will be added later.
 * @returns {object} view context for the IDM monitoring dashboard
 */
export const idmDashboardPresenter = () => ({
  pageTitle: dashboardTitle,
  heading: dashboardTitle,
  intro:
    'This is a proof of concept page. It will be expanded later and will ' +
    'only include data from the IDM (International Disease Monitoring) reports.',
  cards: [
    {
      id: 'cases-and-outbreaks',
      heading: 'Cases and outbreaks',
      description:
        'Will show total cases and outbreaks by disease, region and country.',
      size: 'two-thirds'
    },
    {
      id: 'cases-by-month',
      heading: 'Number of cases by month',
      description: 'Will show a trend of case and outbreak counts by month.',
      size: 'one-third'
    },
    {
      id: 'current-cases-to-date',
      heading: 'Current cases to date',
      description: 'Will show a running total of current cases to date.',
      size: 'one-third'
    }
  ]
})
