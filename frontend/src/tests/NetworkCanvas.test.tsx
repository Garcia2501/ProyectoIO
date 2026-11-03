import { act, render } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { Node, NodeChange } from '@xyflow/react'
import { NetworkCanvas } from '../features/network/NetworkCanvas'
import { referenceScenario } from '../features/network/referenceScenario'

interface FlowProps {
  onInit: (instance: { fitView: () => void }) => void
  nodes: Node[]
  edges: unknown[]
  onNodesChange: (changes: NodeChange[]) => void
  onNodeDragStart: (event: unknown, node: Node) => void
  onNodeDragStop: (event: unknown, node: Node, nodes: Node[]) => void
}
const flow = vi.hoisted(() => ({ current: null as FlowProps | null }))
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  // Keep real useNodesState/applyNodeChanges. Replace only the viewport, which
  // jsdom cannot lay out; mouse dragging is also verified in a real browser.
  ReactFlow: (props: FlowProps) => {
    flow.current = props
    return null
  },
}))
const current = () => flow.current!

describe.each([false, true])('arrastre con editing=%s', (editing) => {
  test('mantiene posiciones locales, dimensiones, otros nodos y conexiones estables hasta soltar', () => {
    const onChange = vi.fn(),
      onPositionsChange = vi.fn(),
      onSelect = vi.fn()
    const props = {
      scenario: referenceScenario,
      editing,
      onChange,
      onPositionsChange,
      onSelect,
    }
    const { rerender } = render(<NetworkCanvas {...props} />)
    const b = current().nodes[1]
    const edges = current().edges
    act(() =>
      current().onNodesChange([
        {
          id: 'A',
          type: 'dimensions',
          dimensions: { width: 103, height: 100 },
        },
      ]),
    )
    act(() => current().onNodeDragStart(null, current().nodes[0]))
    expect(onSelect).toHaveBeenCalledWith({ type: 'node', id: 'A' })
    for (const x of [270, 290, 310]) {
      act(() =>
        current().onNodesChange([
          {
            id: 'A',
            type: 'position',
            position: { x, y: 220 },
            dragging: true,
          },
        ]),
      )
      expect(current().nodes[0].position).toEqual({ x, y: 220 })
      expect(current().nodes[0].dragging).toBe(true)
      expect(current().nodes[0].measured).toEqual({ width: 103, height: 100 })
      expect(current().nodes[1]).toBe(b)
      expect(current().edges).toBe(edges)
    }
    // An unrelated parent render must not restore the old scenario position.
    rerender(<NetworkCanvas {...props} />)
    expect(current().nodes[0].position.x).toBe(310)
    expect(onChange).not.toHaveBeenCalled()
    expect(onPositionsChange).not.toHaveBeenCalled()
    act(() =>
      current().onNodesChange([
        {
          id: 'A',
          type: 'position',
          position: { x: 310, y: 220 },
          dragging: false,
        },
      ]),
    )
    act(() =>
      current().onNodeDragStop(null, current().nodes[0], [current().nodes[0]]),
    )
    expect(onPositionsChange).toHaveBeenCalledExactlyOnceWith([
      { id: 'A', x: 124, y: 220 },
    ])
    const updated = {
      ...referenceScenario,
      nodes: referenceScenario.nodes.map((n) =>
        n.id === 'A' ? { ...n, x: 124, y: 220 } : n,
      ),
    }
    rerender(
      <NetworkCanvas
        {...props}
        scenario={updated}
        selection={{ type: 'node', id: 'A' }}
      />,
    )
    expect(current().nodes[0].position).toEqual({ x: 310, y: 220 })
    expect(current().nodes[0].data).toEqual({ label: 'Origen', balance: 100 })
    expect(current().nodes[0].selected).toBe(true)
    expect(current().nodes[0].measured).toEqual({ width: 103, height: 100 })
  })
})

test('las ediciones externas actualizan propiedades y respetan las coordenadas del nodo B', () => {
  const save = vi.fn()
  const { rerender } = render(
    <NetworkCanvas scenario={referenceScenario} onPositionsChange={save} />,
  )
  const node = current().nodes[1]
  act(() => current().onNodeDragStart(null, node))
  act(() =>
    current().onNodesChange([
      {
        id: 'B',
        type: 'position',
        position: { x: 700, y: 260 },
        dragging: false,
      },
    ]),
  )
  act(() =>
    current().onNodeDragStop(null, current().nodes[1], [current().nodes[1]]),
  )
  expect(save).toHaveBeenCalledWith([{ id: 'B', x: 280, y: 225 }])
  const updated = {
    ...referenceScenario,
    nodes: referenceScenario.nodes.map((n) =>
      n.id === 'B'
        ? { ...n, label: 'Zona editada', balance: 10, x: 280, y: 225 }
        : n,
    ),
  }
  rerender(<NetworkCanvas scenario={updated} />)
  expect(current().nodes[1].position).toEqual({ x: 700, y: 260 })
  expect(current().nodes[1].data).toEqual({
    label: 'Zona editada',
    balance: 10,
  })
})

test('un cambio de tamaño durante el arrastre no agenda fitView para después de soltar', () => {
  const OriginalObserver = globalThis.ResizeObserver
  let resize = () => {}
  const fitView = vi.fn()
  const request = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
  const cancel = vi.spyOn(window, 'cancelAnimationFrame')
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe() {}
      disconnect() {}
    },
  )
  try {
    render(<NetworkCanvas scenario={referenceScenario} />)
    act(() => current().onInit({ fitView }))
    act(() => current().onNodeDragStart(null, current().nodes[0]))
    expect(cancel).toHaveBeenCalled()
    act(resize)
    expect(request).not.toHaveBeenCalled()
    act(() =>
      current().onNodeDragStop(null, current().nodes[0], [current().nodes[0]]),
    )
    expect(fitView).not.toHaveBeenCalled()
    act(resize)
    expect(request).toHaveBeenCalledOnce()
  } finally {
    vi.stubGlobal('ResizeObserver', OriginalObserver)
    vi.restoreAllMocks()
  }
})
