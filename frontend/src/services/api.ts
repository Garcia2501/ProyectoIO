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
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('El servidor no devolvió una respuesta JSON válida.')
  }
  if (
    !data ||
    !['optimal', 'infeasible'].includes(data.status) ||
    !Array.isArray(data.roads) ||
    !Number.isSafeInteger(data.total_supply) ||
    data.total_supply < 0 ||
    data.scenario_name !== scenario.scenario_name ||
    (data.status === 'optimal' &&
      (!Number.isSafeInteger(data.total_cost) || data.total_cost < 0)) ||
    (data.status === 'infeasible' &&
      (data.total_cost !== null || data.roads.length !== 0)) ||
    data.roads.some(
      (r: unknown) =>
        !r ||
        typeof r !== 'object' ||
        typeof (r as { id: unknown }).id !== 'string',
    )
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
            !Number.isSafeInteger(r.flow) ||
            r.flow < 0 ||
            r.flow > cap ||
            r.capacity !== cap ||
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
    data.status === 'optimal' &&
    data.roads.some(
      (r: { id: string }, i: number) => r.id !== scenario.roads[i].id,
    )
  )
    throw new Error('El orden de las vías no coincide con la solicitud.')
  if (
    data.total_supply !==
    scenario.nodes.reduce((sum, n) => sum + Math.max(0, n.balance), 0)
  )
    throw new Error('La oferta del resultado no coincide con el escenario.')
  if (data.status === 'optimal') {
    const flows = new Map<string, number>(
      data.roads.map((r: { id: string; flow: number }) => [r.id, r.flow]),
    )
    // Check arithmetic exactly, even when intermediate sums exceed Number's
    // integer precision. This verifies a response; it does not optimize.
    const cost = scenario.roads.reduce(
      (sum, r) => sum + BigInt(flows.get(r.id) ?? 0) * BigInt(r.unit_cost),
      0n,
    )
    const balanced = scenario.nodes.every(
      (n) =>
        scenario.roads.reduce(
          (sum, r) =>
            sum +
            (r.source === n.id ? BigInt(flows.get(r.id) ?? 0) : 0n) -
            (r.target === n.id ? BigInt(flows.get(r.id) ?? 0) : 0n),
          0n,
        ) === BigInt(n.balance),
    )
    if (cost !== BigInt(data.total_cost) || !balanced)
      throw new Error(
        'El resultado no coincide con los balances o el costo de la red.',
      )
  }
  return data
}
