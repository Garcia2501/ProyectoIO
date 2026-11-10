/**
 * Capa geográfica de Huachi.
 *
 * Lee los GeoJSON versionados (RFC 7946, [longitud, latitud] en WGS84) que
 * entrega el equipo GIS y los convierte en estructuras tipadas. No inventa
 * geometrías: si el contenido es inválido se devuelven los errores y no se
 * dibuja nada parcial.
 */

export type LonLat = [number, number]

export interface GeoNode {
  id: string
  label: string
  lat: number
  lon: number
  kind?: string
}

export type OneWay = boolean | 'unknown'

export interface GeoRoad {
  id: string
  source: string
  target: string
  name?: string
  /** Vértices ordenados en el sentido del arco (source → target). */
  coordinates: LonLat[]
  oneway: OneWay
  sourceQuality: string
  verified: boolean
  osmWayIds: string[]
  assumptions?: string
  /** Verdadero si la geometría original venía en sentido contrario al arco. */
  reversed: boolean
}

export interface GeoNetwork {
  nodes: GeoNode[]
  roads: GeoRoad[]
}

export interface GeoParseResult {
  network: GeoNetwork | null
  errors: string[]
  warnings: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isLonLat = (value: unknown): value is LonLat =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === 'number' &&
  typeof value[1] === 'number' &&
  Number.isFinite(value[0]) &&
  Number.isFinite(value[1]) &&
  Math.abs(value[0]) <= 180 &&
  Math.abs(value[1]) <= 90

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

/** Distancia geodésica (haversine) en metros entre dos puntos [lon, lat]. */
export function haversine(a: LonLat, b: LonLat): number {
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLon = (b[0] - a[0]) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Longitud de una polilínea en metros (suma de tramos geodésicos). */
export function lengthMeters(coordinates: LonLat[]): number {
  let total = 0
  for (let i = 1; i < coordinates.length; i++)
    total += haversine(coordinates[i - 1], coordinates[i])
  return total
}

/** Extensión [[sur, oeste], [norte, este]] de un conjunto de puntos. */
export function boundsOf(points: LonLat[]): [[number, number], [number, number]] | null {
  if (!points.length) return null
  let south = Infinity,
    west = Infinity,
    north = -Infinity,
    east = -Infinity
  for (const [lon, lat] of points) {
    south = Math.min(south, lat)
    north = Math.max(north, lat)
    west = Math.min(west, lon)
    east = Math.max(east, lon)
  }
  return [
    [south, west],
    [north, east],
  ]
}

/**
 * Devuelve una función que, dada una fracción 0..1 del recorrido, entrega la
 * posición [lat, lon] sobre la polilínea según su longitud geodésica.
 */
export function pathSampler(coordinates: LonLat[]) {
  const cumulative = [0]
  for (let i = 1; i < coordinates.length; i++)
    cumulative.push(
      cumulative[i - 1] + haversine(coordinates[i - 1], coordinates[i]),
    )
  const total = cumulative[cumulative.length - 1]
  const at = (fraction: number): [number, number] => {
    if (coordinates.length === 1 || total === 0)
      return [coordinates[0][1], coordinates[0][0]]
    const target = Math.min(1, Math.max(0, fraction)) * total
    let i = 1
    while (i < cumulative.length - 1 && cumulative[i] < target) i++
    const span = cumulative[i] - cumulative[i - 1]
    const t = span === 0 ? 0 : (target - cumulative[i - 1]) / span
    const a = coordinates[i - 1],
      b = coordinates[i]
    return [a[1] + (b[1] - a[1]) * t, a[0] + (b[0] - a[0]) * t]
  }
  return { total, at }
}

function features(
  json: unknown,
  label: string,
  errors: string[],
): Record<string, unknown>[] {
  if (!isRecord(json) || json.type !== 'FeatureCollection') {
    errors.push(`${label}: debe ser un FeatureCollection de GeoJSON.`)
    return []
  }
  if (!Array.isArray(json.features)) {
    errors.push(`${label}: falta la lista "features".`)
    return []
  }
  return json.features.filter(isRecord)
}

export function parseNodes(json: unknown, errors: string[]): GeoNode[] {
  const nodes: GeoNode[] = []
  const seen = new Set<string>()
  features(json, 'huachi_nodes.geojson', errors).forEach((feature, i) => {
    const where = `huachi_nodes.geojson #${i + 1}`
    const geometry = feature.geometry
    const props = isRecord(feature.properties) ? feature.properties : {}
    const id = text(props.node_id)
    if (!isRecord(geometry) || geometry.type !== 'Point')
      return void errors.push(`${where}: la geometría debe ser Point.`)
    if (!isLonLat(geometry.coordinates))
      return void errors.push(
        `${where}: coordenadas [longitud, latitud] inválidas.`,
      )
    if (!id) return void errors.push(`${where}: falta properties.node_id.`)
    if (seen.has(id)) return void errors.push(`${where}: node_id "${id}" duplicado.`)
    seen.add(id)
    nodes.push({
      id,
      label: text(props.label) ?? id,
      lon: geometry.coordinates[0],
      lat: geometry.coordinates[1],
      kind: text(props.node_kind),
    })
  })
  return nodes
}

export function parseRoads(
  json: unknown,
  nodes: GeoNode[],
  errors: string[],
  warnings: string[],
): GeoRoad[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const roads: GeoRoad[] = []
  const seen = new Set<string>()
  features(json, 'huachi_roads.geojson', errors).forEach((feature, i) => {
    const where = `huachi_roads.geojson #${i + 1}`
    const geometry = feature.geometry
    const props = isRecord(feature.properties) ? feature.properties : {}
    const id = text(props.road_id)
    const source = text(props.source)
    const target = text(props.target)
    if (!isRecord(geometry) || geometry.type !== 'LineString')
      return void errors.push(`${where}: la geometría debe ser LineString.`)
    const line = geometry.coordinates
    if (!Array.isArray(line) || line.length < 2 || !line.every(isLonLat))
      return void errors.push(
        `${where}: la línea necesita al menos dos coordenadas [longitud, latitud] válidas.`,
      )
    if (!id) return void errors.push(`${where}: falta properties.road_id.`)
    if (seen.has(id)) return void errors.push(`${where}: road_id "${id}" duplicado.`)
    seen.add(id)
    if (!source || !target)
      return void errors.push(`${where} (${id}): faltan source o target.`)
    const from = byId.get(source),
      to = byId.get(target)
    if (!from || !to)
      return void errors.push(
        `${where} (${id}): arco huérfano; ${!from ? source : target} no existe en huachi_nodes.geojson.`,
      )
    let coordinates = (line as LonLat[]).map(
      (c) => [c[0], c[1]] as LonLat,
    )
    // La animación sigue el sentido del arco: se orienta la línea de
    // source a target sin modificar el sentido del grafo.
    const start = coordinates[0],
      end = coordinates[coordinates.length - 1]
    const here = (n: GeoNode) => [n.lon, n.lat] as LonLat
    const forward = haversine(start, here(from)) + haversine(end, here(to))
    const backward = haversine(start, here(to)) + haversine(end, here(from))
    const reversed = backward < forward
    if (reversed) {
      coordinates = [...coordinates].reverse()
      warnings.push(
        `${id}: la geometría venía en sentido contrario al arco y se orientó de ${source} a ${target}.`,
      )
    }
    const oneway = props.oneway
    roads.push({
      id,
      source,
      target,
      name: text(props.name),
      coordinates,
      oneway: oneway === true || oneway === false ? oneway : 'unknown',
      sourceQuality: text(props.source_quality) ?? 'sin dato',
      verified: props.verified === true,
      osmWayIds: Array.isArray(props.osm_way_ids)
        ? props.osm_way_ids.map(String)
        : [],
      assumptions: text(props.assumptions),
      reversed,
    })
  })
  return roads
}

export function parseGeoNetwork(
  nodesJson: unknown,
  roadsJson: unknown,
): GeoParseResult {
  const errors: string[] = [],
    warnings: string[] = []
  const nodes = parseNodes(nodesJson, errors)
  const roads = parseRoads(roadsJson, nodes, errors, warnings)
  if (!errors.length && !nodes.length) errors.push('No hay nodos en el dataset.')
  if (!errors.length && !roads.length) errors.push('No hay vías en el dataset.')
  return {
    network: errors.length ? null : { nodes, roads },
    errors,
    warnings,
  }
}
