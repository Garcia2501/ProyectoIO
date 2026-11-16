import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { UrbanCanvas } from '../features/simulation/UrbanCanvas'
import { referenceScenario } from '../features/network/referenceScenario'
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))
test('la ciudad respeta movimiento reducido y deshabilita la reproducción automática', () => {
  render(
    <UrbanCanvas
      scenario={referenceScenario}
      result={{
        demo: true,
        data: {
          status: 'optimal',
          scenario_name: 'Base',
          total_cost: 500,
          total_supply: 100,
          roads: [{ id: 'R1', flow: 100, capacity: 100, utilization_pct: 100 }],
        },
      }}
      selection={null}
      onSelect={() => {}}
      playback={{ playing: true, speed: 1 }}
      setPlayback={() => {}}
    />,
  )
  expect(screen.getByText('Movimiento reducido')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Pausar simulación' }),
  ).toBeDisabled()
})

