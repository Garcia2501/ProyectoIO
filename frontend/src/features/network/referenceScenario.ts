import type { Scenario } from '../../types/network'

export const referenceScenario: Scenario = {
  scenario_name: 'Base',
  nodes: [
    { id: 'A', label: 'Origen', x: 100, y: 150, balance: 100 },
    { id: 'B', label: 'Intermedio', x: 250, y: 150, balance: 0 },
    { id: 'C', label: 'Destino', x: 400, y: 150, balance: -100 },
  ],
  roads: [
    { id: 'R1', source: 'A', target: 'B', capacity: 100, unit_cost: 2, enabled: true },
    { id: 'R2', source: 'B', target: 'C', capacity: 100, unit_cost: 3, enabled: true },
    { id: 'R3', source: 'A', target: 'C', capacity: 50, unit_cost: 8, enabled: true },
  ],
}

