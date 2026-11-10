import type { Road, Scenario } from '../../types/network'
import type { RoadResult, StoredResult } from '../../types/results'
import { utilizationColor } from '../simulation3d/visualClock'
import type { Thresholds } from '../simulation3d/visualClock'
import type { GeoNetwork, GeoRoad } from './geo'

export interface LayerState {
  roads: boolean
  nodes: boolean
  labels: boolean
  closures: boolean
  tiles: boolean
  vehicles: boolean
}

export const DEFAULT_LAYERS: LayerState = {
  roads: true,
  nodes: true,
  labels: false,
  closures: true,
  tiles: true,
  vehicles: true,
}

export const LAYER_LABELS: Record<keyof LayerState, string> = {
  roads: 'Calles',
  nodes: 'Nodos',
  labels: 'Etiquetas',
  closures: 'Cierres',
  tiles: 'Mapa base OSM',
  vehicles: 'Vehículos',
}

export const DEFAULT_THRESHOLDS: Thresholds = [60, 80, 95]

export type UtilizationClass =
  | 'closed'
  | 'pending'
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'limit'

export interface RoadStatus {
  geo: GeoRoad
  model: Road
  result: RoadResult | undefined
  /** Flujo del modelo; cero si la vía está cerrada o no hay solución óptima. */
  flow: number
  utilization: number | null
  cls: UtilizationClass
  color: string
}

export const CLASS_LABELS: Record<UtilizationClass, string> = {
  closed: 'Cerrada',
  pending: 'Sin resultado',
  none: 'Sin capacidad',
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  limit: 'Al límite',
}

export function classify(
  enabled: boolean,
  hasSolution: boolean,
  utilization: number | null,
  limits: Thresholds,
): UtilizationClass {
  if (!enabled) return 'closed'
  if (!hasSolution) return 'pending'
  if (utilization === null) return 'none'
  return utilization < limits[0]
    ? 'low'
    : utilization < limits[1]
      ? 'medium'
      : utilization < limits[2]
        ? 'high'
        : 'limit'
}

/** Combina geometría, parámetros del escenario y flujos del servidor. */
export function roadStatuses(
  network: GeoNetwork,
  scenario: Scenario,
  stored: StoredResult | null,
  limits: Thresholds = DEFAULT_THRESHOLDS,
): RoadStatus[] {
  const models = new Map(scenario.roads.map((r) => [r.id, r]))
  const optimal = stored?.data.status === 'optimal'
  const results = new Map(
    optimal ? stored!.data.roads.map((r) => [r.id, r]) : [],
  )
  return network.roads.flatMap((geo) => {
    const model = models.get(geo.id)
    if (!model) return []
    const result = results.get(geo.id)
    const utilization = model.enabled ? (result?.utilization_pct ?? null) : null
    const cls = classify(model.enabled, optimal, utilization, limits)
    return [
      {
        geo,
        model,
        result,
        flow: model.enabled && optimal ? (result?.flow ?? 0) : 0,
        utilization,
        cls,
        color:
          cls === 'pending'
            ? utilizationColor(null, true, limits)
            : cls === 'none'
              ? '#9fb0bd'
              : utilizationColor(utilization, model.enabled, limits),
      },
    ]
  })
}

export function legendItems(limits: Thresholds) {
  return (
    [
      ['low', `< ${limits[0]} %`],
      ['medium', `${limits[0]}–${limits[1]} %`],
      ['high', `${limits[1]}–${limits[2]} %`],
      ['limit', `≥ ${limits[2]} %`],
      ['closed', 'vía cerrada'],
      ['pending', 'sin optimizar'],
    ] as [UtilizationClass, string][]
  ).map(([cls, range]) => ({
    cls,
    label: CLASS_LABELS[cls],
    range,
    color:
      cls === 'closed'
        ? utilizationColor(0, false, limits)
        : cls === 'pending'
          ? utilizationColor(null, true, limits)
          : utilizationColor(
              cls === 'low'
                ? 0
                : cls === 'medium'
                  ? limits[0]
                  : cls === 'high'
                    ? limits[1]
                    : limits[2],
              true,
              limits,
            ),
  }))
}
