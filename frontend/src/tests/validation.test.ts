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

test('exige dos nodos y permite redes sin vías para que el solver determine factibilidad', () => {
  const s = structuredClone(referenceScenario)
  s.roads = []
  expect(validateNetwork(s)).toEqual([])
  s.nodes = [{ id: 'A', label: 'A', balance: 0, x: 0, y: 0 }]
  expect(validateNetwork(s)).toContain('Agrega al menos dos nodos.')
})
test('rechaza valores sin precisión, coordenadas no finitas y nombres vacíos', () => {
  const s = structuredClone(referenceScenario)
  s.scenario_name = ' '
  s.nodes[0].x = Infinity
  s.roads[0].capacity = Number.MAX_SAFE_INTEGER + 1
  expect(validateNetwork(s).length).toBeGreaterThanOrEqual(3)
})
