import { idmDashboardPresenter } from './presenter.js'

export const idmDashboardController = {
  handler(_request, h) {
    const context = idmDashboardPresenter()
    const twoThirdsCard = context.cards.find(
      (card) => card.size === 'two-thirds'
    )
    const oneThirdCards = context.cards.filter(
      (card) => card.size === 'one-third'
    )

    return h.view('idm-dashboard/index', {
      ...context,
      twoThirdsCard,
      oneThirdCards
    })
  }
}
