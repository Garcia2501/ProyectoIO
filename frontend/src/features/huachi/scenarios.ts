/**
 * Escenarios experimentales de Huachi.
 *
 * La semilla (`huachi_scenario_seed.json`) contiene SUPUESTOS del estudio:
 * oferta/demanda, capacidades y costos son experimentales, no mediciones. La
 * geografía proviene de los GeoJSON; aquí solo se combinan para producir el
 * contrato de optimización heredado (x/y son coordenadas de lienzo, no
 * latitud/longitud).
 *
 * Forma esperada de la semilla (adaptador único; si el equipo acuerda otro
 * esquema solo debe cambiar `parseSeed`):
 * {
 *   "balances": { "<node_id>": <entero> },
 *   "roads": { "<road_id>": { "capacity": <entero>, "unit_cost": <entero>, "enabled"?: <bool> } },
 *   "closure_road_ids"?: ["<road_id>"],
 *   "limit_capacity_factor"?: <0..1>
 * }
 */
import type { Scenario } from '../../types/network'
import type { GeoNetwork } from './geo'

export interface SeedRoad {
  capacity: number
  unit_cost: number
  enabled: boolean
}

export interface ScenarioSeed {
  balances: Record<string, number>
  roads: Record<string, SeedRoad>
  closureRoadIds: string[]
  limitCapacityFactor: number
}

export interface SeedParseResult {
  seed: ScenarioSeed | null
  errors: string[]
}

export const DEFAULT_LIMIT_FACTOR = 0.5

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

export function parseSeed(json: unknown, network: GeoNetwork): SeedParseResult {
  const errors: string[] = []
  if (!isRecord(json))
    return { seed: null, errors: ['huachi_scenario_seed.json: objeto inválido.'] }
  const nodeIds = new Set(network.nodes.map((n) => n.id))
  const roadIds = new Set(network.roads.map((r) => r.id))
  const balances: Record<string, number> = {}
  if (!isRecord(json.balances)) errors.push('Falta "balances".')
  else
    for (const [id, value] of Object.entries(json.balances)) {
      if (!nodeIds.has(id)) errors.push(`balances: el nodo "${id}" no existe.`)
      else if (typeof value !== 'number' || !Number.isSafeInteger(value))
        errors.push(`balances.${id}: debe ser un entero.`)
      else balances[id] = value
    }
  const total = Object.values(balances).reduce((s, v) => s + v, 0)
  if (!errors.length && total !== 0)
    errors.push(`Los balances deben sumar 0 (suman ${total}).`)
  const roads: Record<string, SeedRoad> = {}
  if (!isRecord(json.roads)) errors.push('Falta "roads".')
  else {
    for (const [id, value] of Object.entries(json.roads)) {
      if (!roadIds.has(id)) {
        errors.push(`roads: la vía "${id}" no existe.`)
        continue
      }
      if (
        !isRecord(value) ||
        !isCount(value.capacity) ||
        !isCount(value.unit_cost)
      )
        errors.push(
          `roads.${id}: capacity y unit_cost deben ser enteros no negativos.`,
        )
      else
        roads[id] = {
          capacity: value.capacity,
          unit_cost: value.unit_cost,
          enabled: value.enabled !== false,
        }
    }
    const missing = [...roadIds].filter((id) => !(id in roads))
    if (!errors.length && missing.length)
      errors.push(
        `Faltan capacidad y costo para ${missing.length} vía(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}.`,
      )
  }
  const closure = Array.isArray(json.closure_road_ids)
    ? json.closure_road_ids.map(String)
    : []
  for (const id of closure)
    if (!roadIds.has(id))
      errors.push(`closure_road_ids: la vía "${id}" no existe.`)
  const factor =
    typeof json.limit_capacity_factor === 'number' &&
    json.limit_capacity_factor > 0 &&
    json.limit_capacity_factor < 1
      ? json.limit_capacity_factor
      : DEFAULT_LIMIT_FACTOR
  if (errors.length) return { seed: null, errors }
  return {
    seed: {
      balances,
      roads,
      closureRoadIds: closure,
      limitCapacityFactor: factor,
    },
    errors,
  }
}

/**
 * Posiciones de lienzo (proyección equirectangular local) para el editor
 * matemático. Son solo coordenadas visuales del contrato heredado.
 */
export function canvasPositions(network: GeoNetwork) {
  const lat0 =
    network.nodes.reduce((s, n) => s + n.lat, 0) / network.nodes.length
  const k = Math.cos((lat0 * Math.PI) / 180)
  const raw = network.nodes.map((n) => ({
    id: n.id,
    x: n.lon * k,
    y: -n.lat,
  }))
  const minX = Math.min(...raw.map((p) => p.x)),
    minY = Math.min(...raw.map((p) => p.y))
  const span = Math.max(
    1e-9,
    Math.max(...raw.map((p) => p.x)) - minX,
    Math.max(...raw.map((p) => p.y)) - minY,
  )
  const scale = 900 / span
  return new Map(
    raw.map((p) => [
      p.id,
      {
        x: Math.round(80 + (p.x - minX) * scale),
        y: Math.round(80 + (p.y - minY) * scale),
      },
    ]),
  )
}

export function baseScenario(network: GeoNetwork, seed: ScenarioSeed): Scenario {
  const positions = canvasPositions(network)
  return {
    scenario_name: 'Base',
    nodes: network.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      x: positions.get(n.id)!.x,
      y: positions.get(n.id)!.y,
      balance: seed.balances[n.id] ?? 0,
    })),
    roads: network.roads.map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      capacity: seed.roads[r.id].capacity,
      unit_cost: seed.roads[r.id].unit_cost,
      enabled: seed.roads[r.id].enabled,
    })),
  }
}

/** Base, cierre de vía y caso límite. Todos comparten nodos y balances. */
export function huachiScenarios(
  network: GeoNetwork,
  seed: ScenarioSeed,
): Scenario[] {
  const base = baseScenario(network, seed)
  const closed = new Set(seed.closureRoadIds)
  return [
    base,
    {
      ...structuredClone(base),
      scenario_name: 'Cierre de vía',
      roads: base.roads.map((r) => ({
        ...r,
        enabled: r.enabled && !closed.has(r.id),
      })),
    },
    {
      ...structuredClone(base),
      scenario_name: 'Caso límite',
      roads: base.roads.map((r) => ({
        ...r,
        capacity: Math.floor(r.capacity * seed.limitCapacityFactor),
      })),
    },
  ]
}
