import { act, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useWorkspace } from '../features/scenarios/useWorkspace'

test('mover nodos conserva resultados, selección y datos matemáticos del escenario', () => {
  const { result } = renderHook(() => useWorkspace())
  act(() => result.current.demo())
  act(() => result.current.setSelection({ type: 'node', id: 'A' }))
  const optimized = result.current.results[0]
  const alternate = result.current.scenarios[1]
  const message = result.current.message
  act(() => result.current.moveNodes([{ id: 'A', x: 230, y: 200 }]))
  expect(result.current.scenario.nodes[0]).toEqual({
    id: 'A',
    label: 'Origen',
    balance: 100,
    x: 230,
    y: 200,
  })
  expect(result.current.results[0]).toBe(optimized)
  expect(result.current.scenarios[1]).toBe(alternate)
  expect(result.current.selection).toEqual({ type: 'node', id: 'A' })
  expect(result.current.message).toBe(message)
})

test('cambiar de escenario cancela la petición pendiente e ignora su resultado tardío', async () => {
  let resolve!: (r: unknown) => void
  const fetchMock = vi.fn(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  try {
    const { result } = renderHook(() => useWorkspace())
    let pending!: Promise<void>
    act(() => {
      pending = result.current.run()
    })
    const signal = fetchMock.mock.calls[0] as unknown as [
      string,
      { signal: AbortSignal },
    ]
    act(() => result.current.selectScenario(1))
    expect(signal[1].signal.aborted).toBe(true)
    expect(result.current.loading).toBe(false)
    await act(async () => {
      resolve({
        ok: true,
        json: async () => ({
          status: 'infeasible',
          scenario_name: 'Base',
          total_cost: null,
          total_supply: 100,
          roads: [],
        }),
      })
      await pending
    })
    expect(result.current.active).toBe(1)
    expect(result.current.results).toEqual([null, null])
    expect(result.current.message).toBe('')
  } finally {
    vi.unstubAllGlobals()
  }
})
