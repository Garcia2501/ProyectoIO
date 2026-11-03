import {
  CatmullRomCurve3,
  Vector3,
  BufferGeometry,
  Float32BufferAttribute,
} from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { urbanRoads, cityPoint } from '../simulation/urbanGeometry'
import type { Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
export const ROAD_SEGMENTS = 150
// Visual projection only: solver assignments are read unchanged from StoredResult.
export function buildCity(scenario: Scenario, result: StoredResult | null) {
  const source = urbanRoads(scenario, result)
  const nodes = scenario.nodes.map((n) => ({ ...n, ...cityPoint(n) }))
  const xs = nodes.map((n) => n.x),
    zs = nodes.map((n) => n.y)
  const minX = Math.min(0, ...xs),
    maxX = Math.max(500, ...xs),
    minZ = Math.min(0, ...zs),
    maxZ = Math.max(300, ...zs)
  const scale = 32 / Math.max(maxX - minX, maxZ - minZ)
  const centerX = (minX + maxX) / 2,
    centerZ = (minZ + maxZ) / 2
  const point = (x: number, z: number) =>
    new Vector3((x - centerX) * scale, 0, (z - centerZ) * scale)
  const roads = source.map((r) => {
    const path = new SVGLoader().parse(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="' +
        r.path +
        '"/></svg>',
    ).paths[0]
    const aligned =
      Math.abs(r.from.x - r.to.x) < 0.01 || Math.abs(r.from.y - r.to.y) < 0.01
    const samples = aligned
      ? [
          point(r.from.x, r.from.y),
          point((r.from.x + r.to.x) / 2, (r.from.y + r.to.y) / 2),
          point(r.to.x, r.to.y),
        ]
      : path.subPaths[0].getPoints(12).map((p) => point(p.x, p.y))
    const curve = new CatmullRomCurve3(samples, false, 'centripetal')
    return {
      ...r,
      curve,
      length: curve.getLength(),
      points: curve.getSpacedPoints(140),
    }
  })
  const projected = nodes.map((n) => ({ ...n, position: point(n.x, n.y) }))
  const all = [
    ...roads.flatMap((r) => r.points),
    ...projected.map((n) => n.position),
  ]
  const bounds = {
    minX: Math.min(-16, ...all.map((p) => p.x)) - 9,
    maxX: Math.max(16, ...all.map((p) => p.x)) + 9,
    minZ: Math.min(-10, ...all.map((p) => p.z)) - 9,
    maxZ: Math.max(10, ...all.map((p) => p.z)) + 9,
  }
  const radius =
    Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 0.6
  return { roads, nodes: projected, bounds, radius }
}
export type CityModel = ReturnType<typeof buildCity>
export function ribbon(curve: CatmullRomCurve3, width: number, y: number) {
  const points = curve.getSpacedPoints(ROAD_SEGMENTS),
    vertices: number[] = [],
    indices: number[] = []
  points.forEach((p, i) => {
    const tangent = curve.getTangentAt(i / (points.length - 1))
    const nx = (tangent.z * width) / 2,
      nz = (-tangent.x * width) / 2
    vertices.push(p.x + nx, y, p.z + nz, p.x - nx, y, p.z - nz)
    if (i < points.length - 1) {
      const k = i * 2
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
    }
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
export function clearOfRoads(
  x: number,
  z: number,
  model: CityModel,
  margin = 1.75,
) {
  return (
    model.roads.every((r) =>
      r.points.every((p) => Math.hypot(p.x - x, p.z - z) > margin),
    ) &&
    model.nodes.every(
      (n) => Math.hypot(n.position.x - x, n.position.z - z) > margin + 0.4,
    )
  )
}
export function makeBuildings(model: CityModel, limit: number) {
  const cells: {
    x: number
    z: number
    w: number
    d: number
    h: number
    style: number
  }[] = []
  // Prefer actual blocks enclosed by four connected intersections. Decoration
  // stays outside the reserved road corridor; it never adds model roads.
  const faces: typeof cells = []
  const positions = new Map(model.nodes.map((n) => [n.id, n.position]))
  const outgoing = new Map(
    model.nodes.map((n) => [
      n.id,
      model.roads.filter((r) => r.source === n.id).map((r) => r.target),
    ]),
  )
  for (const node of model.nodes) {
    const neighbors = outgoing.get(node.id) ?? []
    for (let i = 0; i < neighbors.length; i++)
      for (let j = i + 1; j < neighbors.length; j++) {
        const common = (outgoing.get(neighbors[i]) ?? []).find((id) =>
          (outgoing.get(neighbors[j]) ?? []).includes(id),
        )
        if (
          !common ||
          new Set([node.id, neighbors[i], neighbors[j], common]).size < 4
        )
          continue
        const corners = [
          node.position,
          positions.get(neighbors[i])!,
          positions.get(neighbors[j])!,
          positions.get(common)!,
        ]
        const x = corners.reduce((s, p) => s + p.x, 0) / 4,
          z = corners.reduce((s, p) => s + p.z, 0) / 4
        if (
          !clearOfRoads(x, z, model, 1.8) ||
          faces.some((b) => Math.hypot(b.x - x, b.z - z) < 1.5)
        )
          continue
        const seed = Math.abs(Math.sin(x * 8.34 + z * 19.23))
        faces.push({
          x,
          z,
          w: 1.1 + seed * 0.35,
          d: 1.05 + seed * 0.4,
          h: 1.5 + seed * 3.5,
          style: Math.floor(seed * 5),
        })
      }
  }
  for (let z = model.bounds.minZ; z < model.bounds.maxZ; z += 1.85)
    for (let x = model.bounds.minX; x < model.bounds.maxX; x += 1.85) {
      const seed = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1
      const w = 0.95 + seed * 0.55,
        d = 1.05 + seed * 0.5
      if (
        clearOfRoads(x, z, model, 1.8) &&
        faces.every(
          (b) =>
            Math.abs(b.x - x) > (b.w + w) / 2 + 0.15 ||
            Math.abs(b.z - z) > (b.d + d) / 2 + 0.15,
        )
      )
        cells.push({
          x,
          z,
          w,
          d,
          h: 1.1 + seed ** 2 * 6.8,
          style: Math.floor(seed * 5),
        })
    }
  // Deterministic spatial sampling rather than filling only one corner.
  const reserved = faces.slice(0, limit),
    remaining = limit - reserved.length
  return [
    ...reserved,
    ...cells
      .filter(
        (_, i) =>
          i % Math.max(1, Math.ceil(cells.length / Math.max(1, remaining))) ===
          0,
      )
      .slice(0, remaining),
  ]
}
export function vehicleAllocation(model: CityModel, budget: number) {
  const active = model.roads.filter((r) => r.enabled && r.flow > 0),
    sum = active.reduce((s, r) => s + r.flow, 0)
  return active.flatMap((r) =>
    Array.from(
      {
        length: Math.min(
          Math.floor(r.length / 0.75),
          Math.floor((budget * r.flow) / sum),
        ),
      },
      (_, i) => ({ road: r, index: i }),
    ),
  )
}
