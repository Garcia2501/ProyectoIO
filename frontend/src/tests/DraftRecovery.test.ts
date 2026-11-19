import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useWorkspace, freshScenarios } from '../features/scenarios/useWorkspace'
import { DRAFT_KEY, readDraft, saveDraft } from '../features/scenarios/localDraft'

test('recupera nodos, vías y posiciones después de desmontar la aplicación', async () => {
  const first = renderHook(() => useWorkspace())
  const changed = structuredClone(first.result.current.scenario)
  changed.nodes.push({ id: 'N4', label: 'Mi zona', balance: 0, x: 250, y: 360 })
  changed.roads.push({ id: 'R4', source: 'A', target: 'N4', capacity: 70, unit_cost: 3, enabled: true })
  act(() => first.result.current.update(changed))
  first.unmount()
  const next = renderHook(() => useWorkspace())
  expect(next.result.current.scenario).toEqual(changed)
  expect(next.result.current.results).toEqual([null, null])
  await waitFor(() => expect(next.result.current.draftSaved).toBe(true))
})

test('conserva borradores desequilibrados y explica por qué no se optimizan', async () => {
  const scenarios = freshScenarios()
  scenarios[0].nodes[0].balance = 120
  saveDraft(scenarios, 0)
  const { result } = renderHook(() => useWorkspace())
  await act(() => result.current.run())
  expect(result.current.message).toContain('suma de balances')
  expect(result.current.scenario.nodes[0].balance).toBe(120)
})

test('una demostración no sustituye redes hasta confirmar y puede cancelarse', () => {
  const { result } = renderHook(() => useWorkspace())
  const previous = result.current.scenarios
  act(() => result.current.metroDemo())
  expect(result.current.scenarios).toBe(previous)
  act(() => result.current.setReplacement(null))
  expect(result.current.scenarios).toBe(previous)
  act(() => result.current.metroDemo())
  act(() => result.current.confirmReplacement())
  expect(result.current.scenario.nodes).toHaveLength(36)
})

test('un borrador corrupto o almacenamiento bloqueado no rompe la aplicación', () => {
  localStorage.setItem(DRAFT_KEY, '{bad json')
  expect(readDraft()).toBeNull()
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded') })
  try { expect(saveDraft(freshScenarios(), 0)).toBe(false) } finally { spy.mockRestore() }
})

test('libera la optimización bloqueada sin borrar la red', async () => {
  vi.useFakeTimers()
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  }))
  try {
    const { result } = renderHook(() => useWorkspace())
    const before = result.current.scenario
    let request: Promise<void>
    act(() => { request = result.current.run() })
    expect(result.current.loading).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); await request })
    expect(result.current.loading).toBe(false)
    expect(result.current.message).toContain('Tu red se conserva')
    expect(result.current.scenario).toBe(before)
  } finally { vi.useRealTimers(); fetchSpy.mockRestore() }
})
