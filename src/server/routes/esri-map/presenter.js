/**
 * Presenter for the Esri map page.
 * Encapsulates the logic for building the page context data.
 */
export const esriMapPresenter = () => {
  return {
    pageTitle: 'Esri map',
    heading: 'Esri map',
    breadcrumbs: [
      {
        text: 'Home',
        href: '/'
      },
      {
        text: 'Esri map'
      }
    ]
  }
}
