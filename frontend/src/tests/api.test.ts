import { afterEach, expect, test, vi } from 'vitest'
import { optimize } from '../services/api'
import { referenceScenario } from '../features/network/referenceScenario'
const response = {
  status: 'optimal',
  scenario_name: 'Base',
  total_cost: 500,
  total_supply: 100,
  roads: [
    { id: 'R1', flow: 100, capacity: 100, utilization_pct: 100 },
    { id: 'R2', flow: 100, capacity: 100, utilization_pct: 100 },
    { id: 'R3', flow: 0, capacity: 50, utilization_pct: 0 },
  ],
}
afterEach(() => vi.unstubAllGlobals())

test('conservación exacta: no oculta un vehículo por redondeo de sumas intermedias', async () => {
  const m = Number.MAX_SAFE_INTEGER
  const roads = [
    {
      id: '1',
      source: 'A',
      target: 'B',
      capacity: m,
      unit_cost: 0,
      enabled: true,
    },
    {
      id: '2',
      source: 'A',
      target: 'B',
      capacity: 2,
      unit_cost: 0,
      enabled: true,
    },
    {
      id: '3',
      source: 'B',
      target: 'A',
      capacity: m,
      unit_cost: 0,
      enabled: true,
    },
    {
      id: '4',
      source: 'B',
      target: 'A',
      capacity: 1,
      unit_cost: 0,
      enabled: true,
    },
  ]
  const scenario = {
    scenario_name: 'Exactitud',
    nodes: [
      { id: 'A', label: 'A', x: 0, y: 0, balance: 0 },
      { id: 'B', label: 'B', x: 1, y: 1, balance: 0 },
    ],
    roads,
  }
  const data = {
    status: 'optimal',
    scenario_name: 'Exactitud',
    total_cost: 0,
    total_supply: 0,
    roads: roads.map((r) => ({
      id: r.id,
      flow: r.capacity,
      capacity: r.capacity,
      utilization_pct: 100,
    })),
  }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => data }),
  )
  await expect(optimize(scenario)).rejects.toThrow('balances')
})
test('envía el contrato exacto por fetch y acepta el resultado coherente', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => response })
  vi.stubGlobal('fetch', fetchMock)
  expect(await optimize(referenceScenario)).toEqual(response)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(referenceScenario)
})
test('interpreta una respuesta infactible como resultado válido', async () => {
  const data = {
    status: 'infeasible',
    scenario_name: 'Base',
    total_cost: null,
    total_supply: 100,
    roads: [],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => data }),
  )
  expect((await optimize(referenceScenario)).status).toBe('infeasible')
})
test('maneja 422 y 500 sin fabricar resultados', async () => {
  for (const status of [422, 500]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }))
    await expect(optimize(referenceScenario)).rejects.toThrow(String(status))
  }
})

test.each([
  {
    detail: 'Reduce el tamaño de la red',
    expected: 'Reduce el tamaño de la red',
  },
  {
    detail: [{ msg: 'Value error, vía R: reduce el costo para esta red' }],
    expected: 'vía R: reduce el costo para esta red',
  },
])(
  'muestra la explicación útil de validación del backend %#',
  async ({ detail, expected }) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 422,
          json: async () => ({ detail }),
        }),
    )
    await expect(optimize(referenceScenario)).rejects.toThrow(expected)
  },
)
test('rechaza costo inconsistente y porcentajes inválidos', async () => {
  for (const data of [
    { ...response, total_cost: 350 },
    {
      ...response,
      roads: response.roads.map((r) => ({ ...r, utilization_pct: 300 })),
    },
  ]) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => data }),
    )
    await expect(optimize(referenceScenario)).rejects.toThrow()
  }
})

test.each([
  { ...response, total_cost: Number.MAX_SAFE_INTEGER + 1 },
  { ...response, total_cost: 500.5 },
  { ...response, roads: [null] },
  { ...response, roads: [...response.roads].reverse() },
  { ...response, status: 'infeasible', total_cost: null },
])('rechaza respuestas corruptas o fuera del contrato %#', async (data) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => data }),
  )
  await expect(optimize(referenceScenario)).rejects.toThrow()
})
test('el JSON inválido tiene un error específico, no se confunde con desconexión', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('bad json')
      },
    }),
  )
  await expect(optimize(referenceScenario)).rejects.toThrow('JSON válida')
})
test('exige capacidad efectiva cero en vías deshabilitadas', async () => {
  const s = structuredClone(referenceScenario)
  s.roads[2].enabled = false
  const data = {
    ...response,
    roads: response.roads.map((r) =>
      r.id === 'R3' ? { ...r, utilization_pct: null } : r,
    ),
  }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => data }),
  )
  await expect(optimize(s)).rejects.toThrow('inconsistentes')
  data.roads[2].capacity = 0
  expect((await optimize(s)).total_cost).toBe(500)
})
