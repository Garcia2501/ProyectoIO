import { expect, test } from 'vitest'
import { referenceScenario } from '../features/network/referenceScenario'
import { validateNetwork } from '../features/network/validation'
test('acepta exactamente el escenario acordado', () =>
  expect(validateNetwork(referenceScenario)).toEqual([]))
test('detecta desbalance y referencias inexistentes', () => {
  const s = structuredClone(referenceScenario)
  s.nodes[0].balance = 90
  s.roads[0].target = 'missing'
  expect(validateNetwork(s)).toHaveLength(2)
})
test('rechaza capacidades negativas y costos fraccionarios', () => {
  const s = structuredClone(referenceScenario)
  s.roads[0].capacity = -1
  s.roads[1].unit_cost = 1.5
  expect(validateNetwork(s)).toHaveLength(2)
})
