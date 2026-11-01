import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import App from '../App'

test('guarda capacidad y cierre en memoria e invalida la demostración', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Cargar demostración' }))
  await user.click(screen.getByRole('button', { name: 'Editar red' }))
  await user.click(screen.getByRole('button', { name: /R1.*A/ }))
  await user.clear(screen.getByLabelText('Capacidad (vehículos)'))
  await user.type(screen.getByLabelText('Capacidad (vehículos)'), '70')
  await user.selectOptions(screen.getByLabelText('Estado'), 'false')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await user.click(screen.getByRole('button', { name: 'Red y análisis' }))
  await user.click(screen.getByRole('button', { name: /R1.*A/ }))
  expect(screen.getByText('70 veh.')).toBeVisible()
  expect(screen.getByText('× Cerrada')).toBeVisible()
  expect(screen.getByText('Pendiente')).toBeVisible()
})

test('agrega un nodo y requiere confirmación para eliminarlo', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Editar red' }))
  await user.click(screen.getByRole('button', { name: 'Agregar nodo' }))
  expect(screen.getByLabelText('Nombre del nodo')).toHaveValue('Nueva zona')
  await user.click(screen.getByRole('button', { name: 'Eliminar nodo' }))
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  expect(screen.getByLabelText('Nombre del nodo')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Eliminar nodo' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Eliminar',
    }),
  )
  expect(screen.queryByLabelText('Nombre del nodo')).not.toBeInTheDocument()
})

test('crea conexiones dirigidas mediante el formulario', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Editar red' }))
  await user.click(screen.getByRole('button', { name: 'Agregar vía' }))
  await user.type(screen.getByLabelText('Nombre de la vía'), 'R4')
  await user.selectOptions(screen.getByLabelText('Origen'), 'C')
  await user.selectOptions(screen.getByLabelText('Destino'), 'A')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(screen.getByRole('button', { name: /R4.*C/ })).toBeVisible()
})

test('la comparación no recomienda resultados infactibles ni inventa porcentajes', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Cargar demostración' }))
  await user.click(screen.getByRole('button', { name: 'Comparar escenarios' }))
  expect(
    screen.getByRole('heading', { name: 'Comparación de escenarios' }),
  ).toBeVisible()
  expect(screen.getByText('Infactible', { exact: true })).toBeVisible()
  expect(
    screen.getByText(/No corresponde calcular un porcentaje de mejora/),
  ).toBeVisible()
})

test('un fallo de red muestra el backend pendiente sin resultados ficticios', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  )
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Optimizar red' }))
  expect(await screen.findByText(/Backend no disponible/)).toBeVisible()
  expect(screen.getByText('Pendiente')).toBeVisible()
  vi.unstubAllGlobals()
})
