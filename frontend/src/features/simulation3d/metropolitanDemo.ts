import type { Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
// Static, explicitly labelled teaching fixture. This is not a frontend solver.
// Every source-to-sink path has ten unit-cost arcs: feasible cost 1200 is optimal.
export function metropolitanDemo(): {
  scenarios: Scenario[]
  results: StoredResult[]
} {
  const id = (x: number, y: number) => `N${y * 6 + x + 1}`
  const nodes = Array.from({ length: 36 }, (_, i) => ({
    id: id(i % 6, Math.floor(i / 6)),
    label:
      i === 0
        ? 'Origen metropolitano'
        : i === 35
          ? 'Destino metropolitano'
          : `Intersección ${i + 1}`,
    balance: i === 0 ? 120 : i === 35 ? -120 : 0,
    x: 60 + (i % 6) * 80,
    y: 60 + Math.floor(i / 6) * 160,
  }))
  const roads: Scenario['roads'] = []
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 6; x++)
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ])
        if (x + dx < 6 && y + dy < 6)
          roads.push({
            id: `M${roads.length + 1}`,
            source: id(x, y),
            target: id(x + dx, y + dy),
            capacity: 100,
            unit_cost: 1,
            enabled: true,
          })
  const closed = roads.find(
    (r) => r.source === id(1, 0) && r.target === id(2, 0),
  )!.id
  const path = (moves: number[]) => {
    let x = 0,
      y = 0
    return moves.map((move) => {
      const from = id(x, y)
      if (move === 0) x++
      else y++
      return roads.find((r) => r.source === from && r.target === id(x, y))!.id
    })
  }
  const top = path([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]),
    bottom = path([1, 1, 1, 1, 1, 0, 0, 0, 0, 0]),
    diagonal = path([0, 1, 0, 1, 0, 1, 0, 1, 0, 1])
  const base: Scenario = {
    scenario_name: 'Centro metropolitano · DEMO',
    nodes,
    roads,
  }
  const alternative: Scenario = {
    ...structuredClone(base),
    scenario_name: 'Cierre metropolitano · DEMO',
    roads: roads.map((r) => ({ ...r, enabled: r.id !== closed })),
  }
  const scenarios = [base, alternative]
  const results = scenarios.map((scenario, index): StoredResult => {
    const assignment = new Map<string, number>()
    const routes = index
      ? ([
          [bottom, 40],
          [diagonal, 80],
        ] as const)
      : ([
          [top, 40],
          [bottom, 40],
          [diagonal, 40],
        ] as const)
    for (const [route, quantity] of routes)
      for (const arc of route)
        assignment.set(arc, (assignment.get(arc) ?? 0) + quantity)
    return {
      demo: true,
      data: {
        status: 'optimal',
        scenario_name: scenario.scenario_name,
        total_supply: 120,
        total_cost: 1200,
        roads: scenario.roads.map((r) => ({
          id: r.id,
          flow: assignment.get(r.id) ?? 0,
          capacity: r.enabled ? r.capacity : 0,
          utilization_pct: r.enabled ? (assignment.get(r.id) ?? 0) : null,
        })),
      },
    }
  })
  return { scenarios, results }
}
