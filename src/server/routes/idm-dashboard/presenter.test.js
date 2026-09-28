import { describe, it, expect } from 'vitest'
import { idmDashboardPresenter } from './presenter.js'

describe('idmDashboardPresenter', () => {
  const context = idmDashboardPresenter()

  it.each(['pageTitle', 'heading'])(
    'should return the expected %s',
    (field) => {
      expect(context[field]).toBe('IDM monitoring dashboard')
    }
  )

  it('should mention "proof of concept" in the intro', () => {
    expect(context.intro).toEqual(expect.stringContaining('proof of concept'))
  })

  it('should return exactly three cards', () => {
    expect(context.cards).toHaveLength(3)
  })

  it.each([
    ['cases-and-outbreaks', 'Cases and outbreaks', 'two-thirds'],
    ['cases-by-month', 'Number of cases by month', 'one-third'],
    ['current-cases-to-date', 'Current cases to date', 'one-third']
  ])(
    'should include card %s with heading %s and size %s',
    (id, heading, size) => {
      const card = context.cards.find((candidate) => candidate.id === id)

      expect(card).toBeDefined()
      expect(card.heading).toBe(heading)
      expect(card.size).toBe(size)
      expect(typeof card.description).toBe('string')
      expect(card.description.length).toBeGreaterThan(0)
    }
  )
})
