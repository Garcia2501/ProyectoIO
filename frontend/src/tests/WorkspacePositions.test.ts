import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
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
