import { getOutbreakData } from './outbreak-data.js'

describe('#getOutbreakData', () => {
  test('Should return the synthetic dataset', () => {
    const data = getOutbreakData()

    expect(data.meta.isSyntheticData).toBe(true)
    expect(data.meta.disclaimer).toEqual(expect.stringContaining('synthetic'))
    expect(data.regions.length).toBeGreaterThan(0)
    expect(data.diseases.length).toBeGreaterThan(0)
    expect(data.records).toHaveLength(data.meta.recordCount)
  })

  test('Should return the same cached, frozen object each time', () => {
    expect(getOutbreakData()).toBe(getOutbreakData())
    expect(Object.isFrozen(getOutbreakData())).toBe(true)
  })

  test('Should provide the fields the aggregations rely on', () => {
    for (const record of getOutbreakData().records) {
      expect(record).toEqual(
        expect.objectContaining({
          weekStarting: expect.any(String),
          region: expect.any(String),
          diseaseId: expect.any(String),
          disease: expect.any(String),
          severity: expect.any(String),
          newCases: expect.any(Number)
        })
      )
    }
  })
})
