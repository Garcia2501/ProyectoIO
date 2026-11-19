import type { Scenario } from '../../types/network'
import { referenceScenario } from './referenceScenario'

/** Teaching inputs only: all optimization results come from the REST API. */
export function teachingScenarios(): Scenario[] {
  const base = structuredClone(referenceScenario)
  base.scenario_name = '1. Camino libre'
  return [base, {
    ...structuredClone(base), scenario_name: '2. Capacidad limitada',
    roads: base.roads.map(r => ({ ...r, capacity: r.id === 'R1' ? 60 : r.capacity })),
  }, {
    ...structuredClone(base), scenario_name: '3. Camino cerrado',
    roads: base.roads.map(r => ({ ...r, enabled: r.id !== 'R1' })),
  }]
}
