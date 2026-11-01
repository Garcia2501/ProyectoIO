import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../App'
import userEvent from '@testing-library/user-event'

test('identifica el laboratorio al abrir la aplicación', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Tu red, en perspectiva.' })).toBeVisible()
  expect(screen.getByText(/Aún no se ha ejecutado ninguna optimización/)).toBeVisible()
})

test('permite inspeccionar las tres vías sin confundir costo y capacidad', async () => {
  const user = userEvent.setup()
  render(<App />)
  for (const road of [{ id: 'R1', cost: 2 }, { id: 'R2', cost: 3 }, { id: 'R3', cost: 8 }]) {
    const button = screen.getByRole('button', { name: new RegExp(road.id) })
    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(`Tramo ${road.id}`)).toBeVisible()
    expect(screen.getByText(`${road.cost} u.`)).toBeVisible()
  }
  expect(screen.getByText('50 veh.')).toBeVisible()
})
