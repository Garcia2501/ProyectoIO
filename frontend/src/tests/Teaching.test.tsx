import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import App from '../App'
import { loadHuachiData } from '../features/huachi/data'
import { fixtureFiles } from './huachiFixture'

test('el ejemplo tiene tres casos y conserva la selección al volver de Huachi', async () => {
  const user = userEvent.setup()
  render(<App data={loadHuachiData(fixtureFiles())} />)
  await user.click(screen.getByRole('button', { name: 'Grafica' }))
  expect(screen.queryByRole('button', { name: 'Editar red' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Resultados' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Red y análisis' })).not.toBeInTheDocument()
  const selector = screen.getByRole('combobox', { name: 'Escenario' })
  expect(selector).toHaveTextContent('1. Camino libre')
  expect(selector).toHaveTextContent('2. Capacidad limitada')
  expect(selector).toHaveTextContent('3. Camino cerrado')
  await user.selectOptions(selector, '1')
  await user.click(screen.getByRole('button', { name: 'Mapa de Huachi' }))
  await user.click(screen.getByRole('button', { name: 'Grafica' }))
  expect(screen.getByRole('combobox', { name: 'Escenario' })).toHaveValue('1')
})

