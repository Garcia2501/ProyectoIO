/**
 * DATOS SOLO PARA PRUEBAS. La geometría es sintética (no corresponde a Huachi
 * ni a ningún lugar real) y nunca se incluye en la aplicación: sirve para
 * verificar el adaptador mientras el equipo GIS publica el dataset verificado.
 */
const node = (id: string, lon: number, lat: number) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { node_id: id, label: 'Nodo ' + id, node_kind: 'cruce' },
})
const road = (
  id: string,
  source: string,
  target: string,
  coordinates: number[][],
  extra: Record<string, unknown> = {},
) => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates },
  properties: {
    road_id: id,
    source,
    target,
    name: 'Calle ' + id,
    oneway: true,
    source_quality: 'prueba',
    verified: false,
    ...extra,
  },
})

export const fixtureNodes = {
  type: 'FeatureCollection',
  features: [
    node('N1', 10.0, 20.0),
    node('N2', 10.002, 20.0),
    node('N3', 10.004, 20.001),
  ],
}

export const fixtureRoads = {
  type: 'FeatureCollection',
  features: [
    road('V1', 'N1', 'N2', [
      [10.0, 20.0],
      [10.001, 20.0005],
      [10.002, 20.0],
    ]),
    road('V2', 'N2', 'N3', [
      [10.002, 20.0],
      [10.004, 20.001],
    ]),
    road('V3', 'N1', 'N3', [
      [10.0, 20.0],
      [10.004, 20.001],
    ]),
  ],
}

export const fixtureSeed = {
  balances: { N1: 100, N2: 0, N3: -100 },
  roads: {
    V1: { capacity: 100, unit_cost: 2 },
    V2: { capacity: 100, unit_cost: 3 },
    V3: { capacity: 50, unit_cost: 8 },
  },
  closure_road_ids: ['V1'],
  limit_capacity_factor: 0.25,
}

export const fixtureFiles = (): Record<string, string> => ({
  'huachi_nodes.geojson': JSON.stringify(fixtureNodes),
  'huachi_roads.geojson': JSON.stringify(fixtureRoads),
  'huachi_scenario_seed.json': JSON.stringify(fixtureSeed),
})
