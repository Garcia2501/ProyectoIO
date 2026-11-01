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
