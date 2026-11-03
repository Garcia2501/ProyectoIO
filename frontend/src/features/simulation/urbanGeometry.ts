import { getSmoothStepPath, Position } from '@xyflow/react'
import type { Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
export function cityPoint(n: { id: string; x: number; y: number }) {
  return {
    x: n.x * 2.5 + 51.5,
    y: n.y + (n.id === 'B' ? 35 : n.id === 'C' ? 60 : 0) + 50,
  }
}
export function urbanRoads(scenario: Scenario, result: StoredResult | null) {
  return scenario.roads.flatMap((road, i) => {
    const source = scenario.nodes.find((n) => n.id === road.source),
      target = scenario.nodes.find((n) => n.id === road.target)
    if (!source || !target) return []
    const from = cityPoint(source),
      to = cityPoint(target)
    const bypass =
      road.source === scenario.nodes[0]?.id &&
      road.target === scenario.nodes[2]?.id
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX: from.x + (bypass ? 0 : 28),
      sourceY: from.y + (bypass ? 28 : 0),
      targetX: to.x - (bypass ? 0 : 28),
      targetY: to.y + (bypass ? 28 : 0),
      sourcePosition: bypass ? Position.Bottom : Position.Right,
      targetPosition: bypass ? Position.Bottom : Position.Left,
      borderRadius: 50,
      offset: bypass ? 130 : 35,
    })
    const rr =
      result?.data.status === 'optimal'
        ? result.data.roads.find((r) => r.id === road.id)
        : undefined
    const flow = road.enabled ? (rr?.flow ?? 0) : 0
    return [
      {
        ...road,
        path,
        labelX,
        labelY,
        from,
        to,
        flow,
        utilization: rr?.utilization_pct ?? null,
        color: !road.enabled
          ? '#e86b78'
          : i % 3 === 0
            ? '#19b67d'
            : i % 3 === 1
              ? '#4b9ef4'
              : '#8b7dec',
      },
    ]
  })
}
export function vehicleCount(flow: number, maxFlow: number) {
  if (flow <= 0 || maxFlow <= 0) return 0
  return Math.max(1, Math.round((flow / maxFlow) * 12))
}
