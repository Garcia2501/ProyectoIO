import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import App from '../App'

test('el resultado real no se anuncia como DEMO aunque el otro escenario sea de ejemplo', async () => {
  const user = userEvent.setup()
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 'optimal',
      scenario_name: 'Base',
      total_cost: 500,
      total_supply: 100,
      roads: [
        { id: 'R1', flow: 100, capacity: 100, utilization_pct: 100 },
        { id: 'R2', flow: 100, capacity: 100, utilization_pct: 100 },
        { id: 'R3', flow: 0, capacity: 50, utilization_pct: 0 },
      ],
    }),
  } as Response)
  try {
    const { container } = render(<App />)
    await user.click(
      screen.getByRole('button', { name: 'Cargar demostración' }),
    )
    expect(container.querySelector('.demo-banner')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Optimizar red' }))
    await waitFor(() =>
      expect(
        screen.getByText('Optimización recibida del servidor.'),
      ).toBeVisible(),
    )
    expect(container.querySelector('.demo-banner')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Comparar escenarios' }),
    )
    expect(container.querySelector('.demo-banner')).toBeInTheDocument()
    expect(container.querySelector('.demo-banner')).toHaveTextContent(
      'Esta vista incluye resultados estáticos de ejemplo',
    )
  } finally {
    fetchSpy.mockRestore()
  }
})
