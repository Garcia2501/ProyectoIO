import { describe, expect, it } from 'vitest'
import {
  boundsOf,
  haversine,
  lengthMeters,
  parseGeoNetwork,
  pathSampler,
} from '../features/huachi/geo'
import { loadHuachiData } from '../features/huachi/data'
import { huachiScenarios, parseSeed } from '../features/huachi/scenarios'
import {
  fixtureFiles,
  fixtureNodes,
  fixtureRoads,
  fixtureSeed,
} from './huachiFixture'

const clone = <T,>(value: T): T => structuredClone(value)

describe('geometría geodésica', () => {
  it('calcula la distancia geodésica y no la de lat/lon crudos', () => {
    // 1 grado de latitud ≈ 111,2 km; 1 grado de longitud a 60° ≈ 55,7 km.
    expect(haversine([0, 0], [0, 1])).toBeGreaterThan(111000)
    expect(haversine([0, 0], [0, 1])).toBeLessThan(111500)
    expect(haversine([0, 60], [1, 60])).toBeGreaterThan(55000)
    expect(haversine([0, 60], [1, 60])).toBeLessThan(56000)
  })
  it('suma tramos de una polilínea y obtiene la extensión', () => {
    const line: [number, number][] = [
      [10, 20],
      [10.001, 20],
      [10.001, 20.001],
    ]
    expect(lengthMeters(line)).toBeCloseTo(
      haversine(line[0], line[1]) + haversine(line[1], line[2]),
      6,
    )
    expect(boundsOf(line)).toEqual([
      [20, 10],
      [20.001, 10.001],
    ])
    expect(boundsOf([])).toBeNull()
  })
  it('interpola posiciones a lo largo de la línea', () => {
    const sampler = pathSampler([
      [10, 20],
      [10.002, 20],
    ])
    expect(sampler.at(0)).toEqual([20, 10])
    expect(sampler.at(1)).toEqual([20, 10.002])
    expect(sampler.at(0.5)[1]).toBeCloseTo(10.001, 6)
    expect(sampler.at(2)).toEqual([20, 10.002])
  })
})

describe('validación del GeoJSON', () => {
  it('acepta un dataset coherente y conserva el sentido de los arcos', () => {
    const { network, errors, warnings } = parseGeoNetwork(
      fixtureNodes,
      fixtureRoads,
    )
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(network?.nodes).toHaveLength(3)
    expect(network?.roads.map((r) => r.id)).toEqual(['V1', 'V2', 'V3'])
    expect(network?.roads[0].oneway).toBe(true)
  })
  it('orienta la geometría de source a target y lo advierte', () => {
    const roads = clone(fixtureRoads)
    roads.features[1].geometry.coordinates.reverse()
    const { network, warnings } = parseGeoNetwork(fixtureNodes, roads)
    expect(network?.roads[1].reversed).toBe(true)
    expect(network?.roads[1].coordinates[0]).toEqual([10.002, 20.0])
    expect(warnings[0]).toContain('V2')
  })
  it('rechaza arcos huérfanos, IDs duplicados y coordenadas inválidas', () => {
    const roads = clone(fixtureRoads)
    roads.features[0].properties.target = 'NX'
    roads.features[1].properties.road_id = 'V1'
    roads.features[2].geometry.coordinates = [[10, 95]]
    const { network, errors } = parseGeoNetwork(fixtureNodes, roads)
    expect(network).toBeNull()
    expect(errors.join(' ')).toMatch(/huérfano/)
    expect(errors.join(' ')).toMatch(/duplicado/)
    expect(errors.join(' ')).toMatch(/al menos dos coordenadas/)
  })
  it('no acepta datos que no son FeatureCollection', () => {
    const { network, errors } = parseGeoNetwork({}, 'nada')
    expect(network).toBeNull()
    expect(errors).toHaveLength(2)
  })
  it('trata el sentido desconocido como desconocido, no como doble sentido', () => {
    const roads = clone(fixtureRoads)
    delete (roads.features[0].properties as Record<string, unknown>).oneway
    const { network } = parseGeoNetwork(fixtureNodes, roads)
    expect(network?.roads[0].oneway).toBe('unknown')
  })
})

describe('semilla y escenarios experimentales', () => {
  const network = parseGeoNetwork(fixtureNodes, fixtureRoads).network!
  it('genera base, cierre y caso límite con los mismos balances', () => {
    const { seed, errors } = parseSeed(fixtureSeed, network)
    expect(errors).toEqual([])
    const [base, closure, limit] = huachiScenarios(network, seed!)
    expect([base, closure, limit].map((s) => s.scenario_name)).toEqual([
      'Base',
      'Cierre de vía',
      'Caso límite',
    ])
    expect(closure.roads.find((r) => r.id === 'V1')?.enabled).toBe(false)
    expect(base.roads.every((r) => r.enabled)).toBe(true)
    expect(limit.roads.map((r) => r.capacity)).toEqual([25, 25, 12])
    expect(limit.nodes.map((n) => n.balance)).toEqual(
      base.nodes.map((n) => n.balance),
    )
    expect(base.nodes.reduce((s, n) => s + n.balance, 0)).toBe(0)
  })
  it('usa coordenadas de lienzo enteras, no latitud/longitud', () => {
    const { seed } = parseSeed(fixtureSeed, network)
    const [base] = huachiScenarios(network, seed!)
    for (const n of base.nodes) {
      expect(Number.isInteger(n.x)).toBe(true)
      expect(Number.isInteger(n.y)).toBe(true)
      expect(n.x).toBeGreaterThanOrEqual(80)
      expect(n.y).toBeGreaterThanOrEqual(80)
    }
  })
  it('rechaza balances que no suman cero y vías faltantes', () => {
    const seed = clone(fixtureSeed)
    seed.balances.N3 = -90
    expect(parseSeed(seed, network).errors.join(' ')).toMatch(/sumar 0/)
    const partial = clone(fixtureSeed) as Record<string, unknown>
    partial.roads = { V1: { capacity: 1, unit_cost: 1 } }
    expect(parseSeed(partial, network).errors.join(' ')).toMatch(/Faltan/)
  })
})

describe('carga de data/geography', () => {
  it('queda pendiente cuando todavía no existen los archivos', () => {
    const data = loadHuachiData({})
    expect(data.status).toBe('pending')
    if (data.status === 'pending')
      expect(data.missing).toEqual([
        'huachi_roads.geojson',
        'huachi_nodes.geojson',
      ])
  })
  it('informa un dataset incompleto o con JSON dañado', () => {
    const files = fixtureFiles()
    delete (files as Record<string, string>)['huachi_nodes.geojson']
    expect(loadHuachiData(files).status).toBe('invalid')
    expect(
      loadHuachiData({ ...fixtureFiles(), 'huachi_roads.geojson': '{' }),
    ).toEqual({
      status: 'invalid',
      errors: ['huachi_roads.geojson: JSON inválido.'],
    })
  })
  it('queda listo con red y escenarios; sin semilla no hay escenarios', () => {
    const ready = loadHuachiData(fixtureFiles())
    expect(ready.status).toBe('ready')
    if (ready.status === 'ready') expect(ready.scenarios).toHaveLength(3)
    const files = fixtureFiles()
    delete (files as Record<string, string>)['huachi_scenario_seed.json']
    const withoutSeed = loadHuachiData(files)
    expect(withoutSeed.status === 'ready' && withoutSeed.scenarios).toBeNull()
  })
})
