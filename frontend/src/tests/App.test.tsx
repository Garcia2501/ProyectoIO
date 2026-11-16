import { render, screen, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../App'
import { loadHuachiData } from '../features/huachi/data'

import userEvent from '@testing-library/user-event'

// Red de referencia A-B-C: no depende del dataset real de Huachi, que de
// estar presente abre la aplicación con sus propios escenarios.
const noDataset = loadHuachiData({})

test('identifica el laboratorio al abrir la aplicación', async () => {
  render(<App data={noDataset} />)
  expect(
    screen.getByRole('heading', {
      name: 'Laboratorio de optimización de flujo vial',
      level: 1,
    }),
  ).toBeInTheDocument()
  await waitFor(() =>
    expect(
      screen.getByText(/Aún no se ha ejecutado ninguna optimización/),
    ).toBeVisible(),
  )
})

test('permite inspeccionar las tres vías sin confundir costo y capacidad', async () => {
  const user = userEvent.setup()
  render(<App data={noDataset} />)
  for (const road of [
    { id: 'R1', cost: 2 },
    { id: 'R2', cost: 3 },
    { id: 'R3', cost: 8 },
  ]) {
    const button = screen.getByRole('button', { name: new RegExp(road.id) })
    await user.click(button)
    expect(
      screen.getByRole('button', { name: new RegExp(road.id) }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('heading', {
        name: new RegExp('Detalle de la vía seleccionada.*' + road.id),
      }),
    ).toBeVisible()
    expect(screen.getByText(`${road.cost} u.`)).toBeVisible()
  }
  expect(screen.getByText('50 veh.')).toBeVisible()
})
