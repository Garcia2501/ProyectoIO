import { useCallback, useEffect, useRef, useState } from 'react'
import type { NetworkNode, Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
import { referenceScenario } from '../network/referenceScenario'
import { validateNetwork } from '../network/validation'
import { optimize } from '../../services/api'
export type Selection = { type: 'node' | 'road'; id: string } | null
export type View = 'main' | 'editor' | 'comparison' | 'simulation' | 'results'
export function freshScenarios(): Scenario[] {
  const base = structuredClone(referenceScenario)
  return [
    base,
    {
      ...structuredClone(base),
      scenario_name: 'Cierre de vía',
      roads: base.roads.map((r) => ({ ...r, enabled: r.id !== 'R1' })),
    },
  ]
}
export function useWorkspace() {
  const [scenarios, setScenarios] = useState(freshScenarios)
  const [active, setActive] = useState(0)
  const [view, setView] = useState<View>('main')
  const [selection, setSelection] = useState<Selection>(null)
  const [results, setResults] = useState<(StoredResult | null)[]>([null, null])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const cancel = () => {
    controller.current?.abort()
    controller.current = null
    setLoading(false)
  }
  const update = (scenario: Scenario) => {
    cancel()
    setScenarios((all) => all.map((s, i) => (i === active ? scenario : s)))
    setResults((all) => all.map((r, i) => (i === active ? null : r)))
    setMessage(
      'Cambios en memoria. Vuelve a optimizar para actualizar los resultados.',
    )
  }
  // Coordinates belong to the canvas, not to the optimization model.
  const moveNodes = useCallback(
    (positions: Pick<NetworkNode, 'id' | 'x' | 'y'>[]) => {
      const moved = new Map(
        positions.map((position) => [position.id, position]),
      )
      setScenarios((all) =>
        all.map((scenario, i) =>
          i !== active
            ? scenario
            : {
                ...scenario,
                nodes: scenario.nodes.map((node) => {
                  const position = moved.get(node.id)
                  return position
                    ? { ...node, x: position.x, y: position.y }
                    : node
                }),
              },
        ),
      )
    },
    [active],
  )
  const run = async () => {
    const errors = validateNetwork(scenarios[active])
    if (errors.length) {
      setMessage(errors.join(' '))
      return
    }
    cancel()
    const c = new AbortController()
    controller.current = c
    setLoading(true)
    setMessage('')
    setResults((all) => all.map((r, i) => (i === active ? null : r)))
    const index = active
    try {
      const data = await optimize(scenarios[index], c.signal)
      if (!c.signal.aborted) {
        setResults((all) =>
          all.map((r, i) => (i === index ? { data, demo: false } : r)),
        )
        setMessage(
          data.status === 'optimal'
            ? 'Optimización recibida del servidor.'
            : data.message || 'No existe flujo factible.',
        )
      }
    } catch (error) {
      if (!c.signal.aborted)
        setMessage(
          error instanceof TypeError
            ? 'Backend no disponible. Inicia FastAPI en localhost:8000 para optimizar.'
            : (error as Error).message,
        )
    } finally {
      if (controller.current === c) {
        controller.current = null
        setLoading(false)
      }
    }
  }
  const demo = () => {
    cancel()
    setScenarios(freshScenarios())
    setSelection(null)
    setResults([
      {
        demo: true,
        data: {
          status: 'optimal',
          scenario_name: 'Base',
          total_cost: 500,
          total_supply: 100,
          roads: [
            { id: 'R1', flow: 100, capacity: 100, utilization_pct: 100 },
            { id: 'R2', flow: 100, capacity: 100, utilization_pct: 100 },
            { id: 'R3', flow: 0, capacity: 50, utilization_pct: 0 },
          ],
        },
      },
      {
        demo: true,
        data: {
          status: 'infeasible',
          scenario_name: 'Cierre de vía',
          total_cost: null,
          total_supply: 100,
          roads: [],
          message:
            'Con R1 cerrada, R3 solo permite 50 de los 100 vehículos requeridos.',
        },
      },
    ])
    setMessage(
      'DEMOSTRACIÓN: ejemplos estáticos coherentes; no son respuestas del servidor. Se han restablecido ambas redes de referencia.',
    )
  }
  return {
    scenarios,
    active,
    view,
    selection,
    results,
    message,
    loading,
    scenario: scenarios[active],
    setView,
    setSelection,
    setMessage,
    update,
    moveNodes,
    run,
    demo,
    selectScenario: (i: number) => {
      if (i === active) return
      cancel()
      setActive(i)
      setSelection(null)
      setMessage('')
    },
    reset: () => {
      cancel()
      setScenarios((all) =>
        all.map((s, i) => (i === active ? freshScenarios()[active] : s)),
      )
      setResults((all) => all.map((r, i) => (i === active ? null : r)))
      setSelection(null)
      setMessage('Escenario restablecido.')
    },
  }
}
export type Workspace = ReturnType<typeof useWorkspace>
