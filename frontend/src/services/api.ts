import type { Scenario } from '../types/network'
import type { OptimizationResult } from '../types/results'
export async function optimize(
  scenario: Scenario,
  signal?: AbortSignal,
): Promise<OptimizationResult> {
  const response = await fetch(
    (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1') +
      '/optimize',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
      signal,
    },
  )
  if (!response.ok) {
    if (response.status === 422)
      throw new Error(
        'El servidor rechazó el escenario (422). Revisa balances, identificadores y propiedades.',
      )
    throw new Error(
      'No se pudo optimizar la red (HTTP ' + response.status + ').',
    )
  }
  const data = await response.json()
  if (
    !data ||
    !['optimal', 'infeasible'].includes(data.status) ||
    !Array.isArray(data.roads) ||
    !Number.isInteger(data.total_supply) ||
    data.total_supply < 0 ||
    data.scenario_name !== scenario.scenario_name ||
    (data.status === 'optimal' &&
      (!Number.isFinite(data.total_cost) || data.total_cost < 0)) ||
    (data.status === 'infeasible' && data.total_cost !== null)
  )
    throw new Error('La respuesta del servidor no cumple el contrato.')
  if (
    data.status === 'optimal' &&
    (data.roads.length !== scenario.roads.length ||
      new Set(data.roads.map((r: { id: string }) => r.id)).size !==
        scenario.roads.length ||
      data.roads.some(
        (r: {
          id: string
          flow: number
          capacity: number
          utilization_pct: number | null
        }) => {
          const road = scenario.roads.find((a) => a.id === r.id)
          const cap = road?.enabled ? road.capacity : 0
          return (
            !road ||
            !Number.isInteger(r.flow) ||
            r.flow < 0 ||
            r.flow > cap ||
            (r.capacity !== cap && r.capacity !== road.capacity) ||
            (cap === 0
              ? r.utilization_pct !== null
              : !Number.isFinite(r.utilization_pct) ||
                Math.abs((r.utilization_pct ?? 0) - (r.flow / cap) * 100) > 0.1)
          )
        },
      ))
  )
    throw new Error('El servidor devolvió datos de vías inconsistentes.')
  if (
    data.total_supply !==
    scenario.nodes.reduce((sum, n) => sum + Math.max(0, n.balance), 0)
  )
    throw new Error('La oferta del resultado no coincide con el escenario.')
  if (data.status === 'optimal') {
    const flows = new Map<string, number>(
      data.roads.map((r: { id: string; flow: number }) => [r.id, r.flow]),
    )
    const cost = scenario.roads.reduce(
      (sum, r) => sum + (flows.get(r.id) ?? 0) * r.unit_cost,
      0,
    )
    const balanced = scenario.nodes.every(
      (n) =>
        scenario.roads.reduce(
          (sum, r) =>
            sum +
            (r.source === n.id ? (flows.get(r.id) ?? 0) : 0) -
            (r.target === n.id ? (flows.get(r.id) ?? 0) : 0),
          0,
        ) === n.balance,
    )
    if (cost !== data.total_cost || !balanced)
      throw new Error(
        'El resultado no coincide con los balances o el costo de la red.',
      )
  }
  return data
}
