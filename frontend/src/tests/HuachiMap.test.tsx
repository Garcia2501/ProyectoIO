import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../App'
import { loadHuachiData } from '../features/huachi/data'
import { classify, roadStatuses } from '../features/huachi/layers'
import {
  MAX_PER_ROAD,
  MAX_TOTAL,
  symbolCounts,
  symbolFraction,
} from '../features/huachi/animation'
import { huachiScenarios } from '../features/huachi/scenarios'
import { fixtureFiles } from './huachiFixture'

const ready = () => loadHuachiData(fixtureFiles())

const optimal = {
  status: 'optimal',
  scenario_name: 'Base',
  total_cost: 500,
  total_supply: 100,
  roads: [
    { id: 'V1', flow: 100, capacity: 100, utilization_pct: 100 },
    { id: 'V2', flow: 100, capacity: 100, utilization_pct: 100 },
    { id: 'V3', flow: 0, capacity: 50, utilization_pct: 0 },
  ],
}

const respond = (body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => body,
  } as Response)

afterEach(() => vi.restoreAllMocks())

test('sin dataset muestra datos pendientes y no dibuja calles', async () => {
  const user = userEvent.setup()
  const { container } = render(<App data={loadHuachiData({})} />)
  await user.click(screen.getByRole('button', { name: 'Mapa Huachi' }))
  expect(
    screen.getByRole('heading', { name: 'Datos cartográficos pendientes' }),
  ).toBeVisible()
  expect(screen.getByText('huachi_roads.geojson')).toBeVisible()
  expect(container.querySelector('.leaflet-container')).toBeNull()
})

test('un dataset inválido se informa y no se dibuja parcialmente', async () => {
  const user = userEvent.setup()
  const { container } = render(
    <App
      data={loadHuachiData({
        ...fixtureFiles(),
        'huachi_roads.geojson': '{"type":"FeatureCollection","features":[{}]}',
      })}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Mapa Huachi' }))
  expect(
    screen.getByRole('heading', { name: 'El dataset cartográfico no es válido' }),
  ).toBeVisible()
  expect(container.querySelector('.leaflet-container')).toBeNull()
})

test('con dataset abre el mapa real con atribución OSM, capas y vías', () => {
  const { container } = render(<App data={ready()} />)
  expect(container.querySelector('.leaflet-container')).not.toBeNull()
  const map = screen.getByRole('region', { name: 'Mapa de las calles de Huachi' })
  expect(within(map).getByText('OpenStreetMap contributors')).toBeInTheDocument()
  expect(within(map).getByRole('link', { name: 'ODbL' })).toBeInTheDocument()
  expect(container.querySelectorAll('.huachi-road')).toHaveLength(3)
  const list = screen.getByRole('list', { name: 'Lista de vías' })
  expect(within(list).getAllByRole('button')).toHaveLength(3)
  expect(screen.getByRole('combobox', { name: 'Escenario del mapa' })).toHaveValue(
    '0',
  )
  expect(
    screen.queryByRole('button', { name: 'Cargar demostración' }),
  ).toBeNull()
})

test('la capa de calles y los vehículos se pueden ocultar', async () => {
  const user = userEvent.setup()
  const { container } = render(<App data={ready()} />)
  await user.click(screen.getByRole('checkbox', { name: 'Calles' }))
  expect(container.querySelectorAll('.huachi-road')).toHaveLength(0)
  await user.click(screen.getByRole('checkbox', { name: 'Calles' }))
  expect(container.querySelectorAll('.huachi-road')).toHaveLength(3)
})

test('el inspector muestra extremos, supuestos y calidad de la fuente', async () => {
  const user = userEvent.setup()
  render(<App data={ready()} />)
  await user.click(screen.getByRole('button', { name: /V2/ }))
  const inspector = screen.getByRole('region', { name: 'Inspector' })
  expect(within(inspector).getByRole('heading', { name: 'Calle V2' })).toBeVisible()
  expect(within(inspector).getByText('Nodo N2 → Nodo N3')).toBeVisible()
  expect(within(inspector).getByText('Capacidad (supuesto)')).toBeVisible()
  expect(within(inspector).getByText('100 veh.')).toBeVisible()
  expect(within(inspector).getByText('prueba · sin verificar')).toBeVisible()
})

test('tras optimizar colorea por utilización y mueve símbolos solo con flujo', async () => {
  const user = userEvent.setup()
  const fetchSpy = respond(optimal)
  const { container } = render(<App data={ready()} />)
  expect(container.querySelectorAll('.huachi-vehicle')).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Optimizar' }))
  await waitFor(() =>
    expect(container.querySelectorAll('.huachi-road-limit')).toHaveLength(2),
  )
  const sent = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
  expect(sent.roads.map((r: { id: string }) => r.id)).toEqual(['V1', 'V2', 'V3'])
  expect(sent.nodes.reduce((s: number, n: { balance: number }) => s + n.balance, 0)).toBe(0)
  expect(sent.nodes[0]).not.toHaveProperty('lat')
  expect(container.querySelectorAll('.huachi-road-low')).toHaveLength(1)
  // V1 y V2 con flujo 100 → 12 símbolos cada una; V3 sin flujo → ninguno.
  expect(container.querySelectorAll('.huachi-vehicle')).toHaveLength(24)
  expect(screen.getByText('Factible')).toBeVisible()
})

test('un escenario infactible no muestra flujos ni vehículos inventados', async () => {
  const user = userEvent.setup()
  respond({
    status: 'infeasible',
    scenario_name: 'Cierre de vía',
    total_cost: null,
    total_supply: 100,
    roads: [],
    message: 'Con V1 cerrada, V3 solo permite 50 de 100 vehículos.',
  })
  const { container } = render(<App data={ready()} />)
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Escenario del mapa' }),
    '1',
  )
  await user.click(screen.getByRole('button', { name: 'Optimizar' }))
  expect(await screen.findByText(/Sin flujo factible/)).toBeVisible()
  expect(container.querySelectorAll('.huachi-vehicle')).toHaveLength(0)
  expect(container.querySelectorAll('.huachi-road-closed')).toHaveLength(1)
  expect(container.querySelectorAll('.huachi-road-low, .huachi-road-limit')).toHaveLength(0)
  expect(screen.getByText('Infactible')).toBeVisible()
})

test('cerrar una vía desde el inspector envía la red modificada a optimizar', async () => {
  const user = userEvent.setup()
  const fetchSpy = respond({
    status: 'infeasible',
    scenario_name: 'Base',
    total_cost: null,
    total_supply: 100,
    roads: [],
    message: 'Sin capacidad suficiente.',
  })
  render(<App data={ready()} />)
  await user.click(screen.getByRole('button', { name: /V1/ }))
  await user.click(screen.getByRole('button', { name: 'Cerrar vía y optimizar' }))
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
  const sent = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
  expect(sent.roads.find((r: { id: string }) => r.id === 'V1').enabled).toBe(false)
  expect(
    await screen.findByRole('button', { name: 'Reabrir vía y optimizar' }),
  ).toBeVisible()
})

test('sin semilla muestra solo la geografía y no permite optimizar', () => {
  const files = fixtureFiles()
  delete (files as Record<string, string>)['huachi_scenario_seed.json']
  render(<App data={loadHuachiData(files)} />)
  expect(screen.getByText(/Optimización deshabilitada/)).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Escenario del mapa' })).toBeNull()
})

test('la comparación muestra tres escenarios y dos mapas sincronizados', async () => {
  const user = userEvent.setup()
  const { container } = render(<App data={ready()} />)
  await user.click(screen.getByRole('button', { name: 'Comparar escenarios' }))
  expect(
    screen.getByRole('heading', { name: 'Comparación de escenarios' }),
  ).toBeVisible()
  expect(container.querySelectorAll('.leaflet-container')).toHaveLength(2)
  const table = screen.getAllByRole('table')[0]
  for (const name of ['Escenario base', 'Cierre de vía', 'Caso límite'])
    expect(within(table).getByRole('columnheader', { name })).toBeVisible()
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Escenario del mapa derecho' }),
    '2',
  )
  expect(
    screen.getByRole('region', { name: 'Mapa de Huachi: Caso límite' }),
  ).toBeVisible()
})

test('los tres escenarios comparten balances que suman cero', () => {
  const data = ready()
  if (data.status !== 'ready' || !data.scenarios) throw new Error('fixture')
  for (const s of data.scenarios) {
    expect(s.nodes.reduce((sum, n) => sum + n.balance, 0)).toBe(0)
  }
  expect(huachiScenarios(data.network, data.seed!)).toHaveLength(3)
})

test('la clasificación respeta cierres, ausencia de solución y umbrales', () => {
  const t: [number, number, number] = [60, 80, 95]
  expect(classify(false, true, 50, t)).toBe('closed')
  expect(classify(true, false, null, t)).toBe('pending')
  expect(classify(true, true, null, t)).toBe('none')
  expect(classify(true, true, 59, t)).toBe('low')
  expect(classify(true, true, 60, t)).toBe('medium')
  expect(classify(true, true, 80, t)).toBe('high')
  expect(classify(true, true, 95, t)).toBe('limit')
  const data = ready()
  if (data.status !== 'ready' || !data.scenarios) throw new Error('fixture')
  const statuses = roadStatuses(
    data.network,
    data.scenarios[1],
    { demo: false, data: optimal as never },
  )
  expect(statuses.find((s) => s.geo.id === 'V1')?.flow).toBe(0)
})

test('los símbolos escalan con el flujo y respetan el presupuesto', () => {
  expect(symbolCounts([0, 50, 100])).toEqual([0, 6, MAX_PER_ROAD])
  expect(symbolCounts([])).toEqual([])
  const many = symbolCounts(Array.from({ length: 60 }, () => 10))
  expect(many.reduce((s, n) => s + n, 0)).toBeLessThanOrEqual(MAX_TOTAL)
  expect(many.every((n) => n >= 1)).toBe(true)
  expect(symbolFraction(0, 10, 0, 4)).toBe(0)
  expect(symbolFraction(5, 10, 0, 4)).toBeCloseTo(0.5)
  expect(symbolFraction(10, 10, 1, 4)).toBeCloseTo(0.25)
})
