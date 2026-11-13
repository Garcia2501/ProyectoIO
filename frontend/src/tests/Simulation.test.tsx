import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { referenceScenario } from '../features/network/referenceScenario'
import { urbanRoads, vehicleCount } from '../features/simulation/urbanGeometry'
import App from '../App'

test('la proyección urbana conserva dirección y propiedades sin alterar el modelo', () => {
  const original = structuredClone(referenceScenario)
  const roads = urbanRoads(referenceScenario, null)
  expect(
    roads.map((r) => [r.id, r.source, r.target, r.capacity, r.unit_cost]),
  ).toEqual(
    referenceScenario.roads.map((r) => [
      r.id,
      r.source,
      r.target,
      r.capacity,
      r.unit_cost,
    ]),
  )
  expect(roads.every((r) => r.flow === 0)).toBe(true)
  expect(referenceScenario).toEqual(original)
  expect(vehicleCount(100, 100)).toBe(12)
  expect(vehicleCount(50, 100)).toBe(6)
  expect(vehicleCount(0, 100)).toBe(0)
})
test('una vía cerrada nunca representa vehículos aunque se reciba un flujo', () => {
  const s = structuredClone(referenceScenario)
  s.roads[0].enabled = false
  const roads = urbanRoads(s, {
    demo: true,
    data: {
      status: 'optimal',
      scenario_name: 'Base',
      total_cost: 500,
      total_supply: 100,
      roads: [{ id: 'R1', flow: 100, capacity: 100, utilization_pct: 100 }],
    },
  })
  expect(roads[0].flow).toBe(0)
})
test('las cinco secciones navegan por teclado y Resultados tiene tabla real', async () => {
  const user = userEvent.setup()
  render(<App />)
  const nav = screen.getByRole('navigation', { name: 'Vistas de SmartFlow' })
  within(nav).getByRole('button', { name: 'Red y análisis' }).focus()
  await user.keyboard('{ArrowRight}')
  expect(
    within(nav).getByRole('button', { name: 'Comparar escenarios' }),
  ).toHaveFocus()
  await user.click(within(nav).getByRole('button', { name: 'Resultados' }))
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: 'De la red a las decisiones.' }),
    ).toBeVisible(),
  )
  expect(
    screen.getByRole('button', { name: 'Exportar resultado JSON' }),
  ).toBeDisabled()
  expect(screen.getByRole('table')).toBeInTheDocument()
})
