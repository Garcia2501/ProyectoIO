import { useCallback, useEffect, useRef, useState } from 'react'
import type { NetworkNode, Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
import { referenceScenario } from '../network/referenceScenario'
import { validateNetwork } from '../network/validation'
import { optimize } from '../../services/api'
import { metropolitanDemo } from '../simulation3d/metropolitanDemo'
import { readDraft, saveDraft } from './localDraft'
export type Selection = { type: 'node' | 'road'; id: string } | null
export type View = 'map' | 'main' | 'editor' | 'comparison' | 'results'
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
export interface WorkspaceOptions {
  /** Escenarios iniciales (p. ej. los de Huachi). Sin ellos se usa la referencia A-B-C. */
  initial?: Scenario[]
  view?: View
}
export function useWorkspace({
  initial,
  view: initialView,
}: WorkspaceOptions = {}) {
  // Copia para restablecer; se calcula una sola vez.
  const [baseline] = useState<Scenario[]>(() =>
    initial?.length ? structuredClone(initial) : freshScenarios(),
  )
  const external = !!initial?.length
  const [restored] = useState(() => external ? null : readDraft())
  const [replacement, setReplacement] = useState<'demo' | 'metro' | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [scenarios, setScenarios] = useState<Scenario[]>(() =>
    restored?.scenarios ?? structuredClone(baseline),
  )
  const [active, setActive] = useState(restored?.active ?? 0)
  const [view, setView] = useState<View>(initialView ?? 'main')
  const [selection, setSelection] = useState<Selection>(null)
  const [results, setResults] = useState<(StoredResult | null)[]>(() =>
    (restored?.scenarios ?? baseline).map(() => null),
  )
  const [message, setMessage] = useState(restored ? 'Red recuperada de este navegador. Optimiza para volver a calcular los resultados.' : '')
  useEffect(() => {
    if (external) return
    const saved = saveDraft(scenarios, active)
    let current = true
    queueMicrotask(() => { if (current) setDraftSaved(saved) })
    return () => { current = false }
  }, [scenarios, active, external])
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
  const run = async (replacement?: Scenario) => {
    const requested = replacement ?? scenarios[active]
    const errors = validateNetwork(requested)
    if (errors.length) {
      setMessage(errors.join(' '))
      return
    }
    cancel()
    const c = new AbortController()
    controller.current = c
    const timeout = window.setTimeout(() => {
      if (controller.current === c) {
        c.abort()
        controller.current = null
        setLoading(false)
        setMessage('El servidor tardó más de 20 segundos. Tu red se conserva; comprueba el backend y vuelve a intentarlo.')
      }
    }, 20000)
    setLoading(true)
    setMessage('')
    setResults((all) => all.map((r, i) => (i === active ? null : r)))
    const index = active
    try {
      const data = await optimize(requested, c.signal)
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
      window.clearTimeout(timeout)
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
    draftSaved,
    replacement,
    setReplacement,
    confirmReplacement: () => {
      if (replacement === 'demo') demo()
      else if (replacement === 'metro') {
        cancel()
        const fixture = metropolitanDemo()
        setScenarios(fixture.scenarios)
        setResults(fixture.results)
        setActive(0)
        setSelection(null)
        setMessage('DEMOSTRACIÓN METROPOLITANA: datos ilustrativos; no se ha ejecutado el servidor.')
      }
      setReplacement(null)
    },
    scenario: scenarios[active],
    external,
    setView,
    setSelection,
    setMessage,
    update,
    moveNodes,
    run,
    demo: () => setReplacement('demo'),
    metroDemo: () => {
      setReplacement('metro')
    },
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
        all.map((s, i) => (i === active ? structuredClone(baseline[active]) : s)),
      )
      setResults((all) => all.map((r, i) => (i === active ? null : r)))
      setSelection(null)
      setMessage('Escenario restablecido.')
    },
  }
}
export type Workspace = ReturnType<typeof useWorkspace>
