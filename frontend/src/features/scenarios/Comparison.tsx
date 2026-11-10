import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Icon } from '../../components/Icon'
import type { Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
import type { HuachiData } from '../huachi/data'
import { HuachiMap } from '../huachi/HuachiMap'
import { DEFAULT_LAYERS } from '../huachi/layers'
import { MapSync } from '../huachi/mapSync'
import { NetworkCanvas } from '../network/NetworkCanvas'
import { PlaybackControls } from '../simulation3d/PlaybackControls'
import { VisualClock } from '../simulation3d/visualClock'
import type { Workspace } from './useWorkspace'

const COLORS = ['#65c94e', '#56b0f4', '#e8a13f', '#a78bfa']
const label = (s: Scenario) =>
  s.scenario_name === 'Base' ? 'Escenario base' : s.scenario_name
const sameBalances = (a: Scenario, b: Scenario) =>
  JSON.stringify(a.nodes.map((n) => [n.id, n.balance]).sort()) ===
  JSON.stringify(b.nodes.map((n) => [n.id, n.balance]).sort())

export function Comparison({
  w,
  data,
}: {
  w: Workspace
  data?: HuachiData
}) {
  const reduced = !!useReducedMotion()
  const [clock] = useState(() => new VisualClock())
  const [sync] = useState(() => new MapSync())
  const [left, setLeft] = useState(0)
  const [right, setRight] = useState(Math.min(1, w.scenarios.length - 1))
  useEffect(() => {
    if (reduced) clock.pause()
  }, [clock, reduced])
  const network = data?.status === 'ready' && w.external ? data.network : null
  const results = w.results
  const base = results[0]
  const comparable = (i: number) => {
    const r = results[i]
    return (
      i > 0 &&
      !!base &&
      !!r &&
      base.demo === r.demo &&
      base.data.status === 'optimal' &&
      r.data.status === 'optimal' &&
      sameBalances(w.scenarios[0], w.scenarios[i])
    )
  }
  const cost = (r: StoredResult | null) => r?.data.total_cost ?? null
  const diff = (i: number) => {
    if (!comparable(i)) return ''
    const a = cost(base),
      b = cost(results[i])
    if (a === null || b === null) return ''
    const abs = b - a
    const pct = a !== 0 ? ` (${abs > 0 ? '+' : ''}${((abs / a) * 100).toFixed(1)} %)` : ''
    return ` · Δ ${abs > 0 ? '+' : ''}${abs} u.${pct}`
  }
  const state = (r: StoredResult | null) =>
    r ? (r.data.status === 'optimal' ? 'Factible' : 'Infactible') : 'Pendiente'
  const meanUtilization = (r: StoredResult | null) => {
    if (r?.data.status !== 'optimal') return null
    const usable = r.data.roads.filter((x) => x.utilization_pct !== null)
    return usable.length
      ? usable.reduce((s, x) => s + x.utilization_pct!, 0) / usable.length
      : null
  }
  const atLimit = (r: StoredResult | null) =>
    r?.data.status === 'optimal'
      ? r.data.roads.filter((x) => (x.utilization_pct ?? 0) >= 100).length
      : null
  const rows: [string, (string | number)[]][] = [
    [
      'Costo total',
      w.scenarios.map((_, i) => {
        const c = cost(results[i])
        return c === null ? '—' : `${c}${diff(i)}`
      }),
    ],
    [
      'Oferta (veh./intervalo)',
      w.scenarios.map((s) =>
        s.nodes.reduce((sum, n) => sum + Math.max(n.balance, 0), 0),
      ),
    ],
    [
      'Vías habilitadas',
      w.scenarios.map((s) => s.roads.filter((r) => r.enabled).length),
    ],
    ['Factibilidad', results.map(state)],
    [
      'Utilización media',
      results.map((r) => {
        const m = meanUtilization(r)
        return m === null ? '—' : m.toFixed(1) + ' %'
      }),
    ],
    [
      'Vías saturadas (100 %)',
      results.map((r) => atLimit(r) ?? '—'),
    ],
  ]
  const roadIds = [
    ...new Set(w.scenarios.flatMap((s) => s.roads.map((r) => r.id))),
  ]
  const flowOf = (i: number, id: string) => {
    const r = results[i]
    return r?.data.status === 'optimal'
      ? r.data.roads.find((x) => x.id === id)
      : undefined
  }
  const capacityChart = roadIds.map((id) => ({
    id,
    ...Object.fromEntries(
      w.scenarios.map((s) => {
        const road = s.roads.find((x) => x.id === id)
        return [label(s), road?.enabled ? road.capacity : 0]
      }),
    ),
  }))
  const flowChart = roadIds.map((id) => ({
    id,
    ...Object.fromEntries(
      w.scenarios.map((s, i) => [label(s), flowOf(i, id)?.flow]),
    ),
  }))
  const anyOptimal = results.some((r) => r?.data.status === 'optimal')
  const infeasible = w.scenarios.filter(
    (_, i) => results[i]?.data.status === 'infeasible',
  )
  const closedRoads = (s: Scenario) =>
    s.roads
      .filter((r) => !r.enabled)
      .map((r) => r.id)
      .join(', ') || 'ninguna'
  const pane = (index: number, side: 'left' | 'right') => {
    const s = w.scenarios[index]
    return (
      <section className="panel comparison-map" key={side}>
        <h2 className={side === 'right' ? 'blue-heading' : ''}>
          <Icon name="layers" />
          {label(s)}
          <span className="badge">
            {results[index]?.demo ? 'Demo' : index ? 'Alternativo' : 'Base'}
          </span>
        </h2>
        {network ? (
          <HuachiMap
            network={network}
            scenario={s}
            result={results[index]}
            selection={w.selection}
            onSelect={w.setSelection}
            layers={DEFAULT_LAYERS}
            clock={clock}
            reduced={reduced}
            sync={sync}
            label={`Mapa de Huachi: ${label(s)}`}
          />
        ) : (
          <NetworkCanvas scenario={s} compact result={results[index]} />
        )}
        <button
          className="map-edit-link"
          onClick={() => {
            w.selectScenario(index)
            w.setView('editor')
          }}
        >
          Editar este escenario <Icon name="arrow" size={15} />
        </button>
      </section>
    )
  }
  return (
    <>
      <section className="panel comparison-heading">
        <div className="title-icon">
          <Icon name="chart" size={30} />
        </div>
        <div>
          <h1>Comparación de escenarios</h1>
          <p>Evalúa el impacto de diferentes condiciones en la red vial.</p>
        </div>
        <div className="versus">
          {w.scenarios.map((s, i) => (
            <span
              key={s.scenario_name}
              className={'scenario-chip ' + (i === 1 ? 'blue-chip' : '')}
            >
              ● {s.scenario_name}
            </span>
          ))}
        </div>
      </section>
      {w.scenarios.length > 2 && (
        <div className="comparison-pick">
          <label>
            Mapa izquierdo{' '}
            <select
              aria-label="Escenario del mapa izquierdo"
              value={left}
              onChange={(e) => setLeft(Number(e.target.value))}
            >
              {w.scenarios.map((s, i) => (
                <option key={s.scenario_name} value={i}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mapa derecho{' '}
            <select
              aria-label="Escenario del mapa derecho"
              value={right}
              onChange={(e) => setRight(Number(e.target.value))}
            >
              {w.scenarios.map((s, i) => (
                <option key={s.scenario_name} value={i}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className={network ? 'comparison-huachi' : 'comparison-top'}>
        {network ? (
          <>
            {pane(left, 'left')}
            {pane(right, 'right')}
          </>
        ) : (
          w.scenarios.map((_, i) => pane(i, i ? 'right' : 'left'))
        )}
      </div>
      {network && (
        <div className="comparison-playback">
          <PlaybackControls clock={clock} />
          <p className="help">
            Los mapas comparten encuadre y reloj visual. Los símbolos son una
            escala del flujo calculado, no vehículos medidos.
          </p>
        </div>
      )}
      <section className="panel comparison-table">
        <h2>
          <Icon name="chart" />
          Métricas comparativas
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Métrica</th>
                {w.scenarios.map((s) => (
                  <th key={s.scenario_name}>{label(s)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, cells]) => (
                <tr key={name}>
                  <th>{name}</th>
                  {cells.map((value, i) => (
                    <td key={i}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="help">
          Costo en unidades abstractas. La diferencia se calcula respecto al
          escenario base y solo entre resultados óptimos con los mismos
          balances y el mismo origen de datos.
        </p>
      </section>
      <details className="panel comparison-rows">
        <summary>
          Resultados por carretera · {roadIds.length} vías{' '}
          <span>Desplegar detalle</span>
        </summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vía</th>
                {w.scenarios.map((s) => (
                  <th key={s.scenario_name}>
                    {label(s)}: flujo / utilización
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roadIds.map((id) => (
                <tr key={id}>
                  <th>{id}</th>
                  {w.scenarios.map((s, i) => {
                    const r = flowOf(i, id)
                    return (
                      <td key={s.scenario_name}>
                        {r
                          ? `${r.flow} / ${r.utilization_pct === null ? 'No aplica' : r.utilization_pct + ' %'}`
                          : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="help">
          Flujos en vehículos por intervalo. Medias simples de utilizaciones
          válidas; no son mediciones de congestión. Las soluciones infactibles
          carecen de flujos calculados.
        </p>
      </details>
      <div className="comparison-bottom">
        <section className="panel">
          <h2>
            <Icon name="chart" />
            Capacidades de las redes
          </h2>
          <div className="chart comparison-chart">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={1}
              minHeight={1}
            >
              <BarChart data={capacityChart}>
                <CartesianGrid vertical={false} stroke="#e1e9ee" />
                <XAxis dataKey="id" />
                <YAxis />
                <Tooltip />
                <Legend />
                {w.scenarios.map((s, i) => (
                  <Bar
                    key={s.scenario_name}
                    isAnimationActive={!reduced}
                    dataKey={label(s)}
                    fill={COLORS[i % COLORS.length]}
                    radius={[5, 5, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="help">
            Capacidad efectiva · vehículos por intervalo. Datos actuales de las
            redes.
          </p>
        </section>
        <section className="panel">
          <h2>
            <Icon name="chart" />
            Flujo por tramo
          </h2>
          {anyOptimal ? (
            <div className="chart comparison-chart">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={1}
                minHeight={1}
              >
                <BarChart data={flowChart}>
                  <CartesianGrid vertical={false} stroke="#e1e9ee" />
                  <XAxis dataKey="id" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {w.scenarios.map((s, i) => (
                    <Bar
                      key={s.scenario_name}
                      isAnimationActive={!reduced}
                      dataKey={label(s)}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">
              <Icon name="activity" size={36} />
              <span>Optimiza los escenarios para comparar flujos.</span>
            </div>
          )}
          <p className="help">
            Vehículos por intervalo. Un escenario infactible no tiene serie de
            flujo.
          </p>
        </section>
        <section className="panel comparison-conclusion">
          <div className="callout">
            <Icon name="info" size={30} />
            <div>
              <h2>Conclusiones con fundamento</h2>
              <p>
                {infeasible.length
                  ? `${infeasible.map((s) => s.scenario_name).join(' y ')} no satisface${infeasible.length > 1 ? 'n' : ''} la demanda con las capacidades actuales. No corresponde calcular un porcentaje de mejora.`
                  : w.scenarios.some((_, i) => comparable(i))
                    ? 'Los resultados tienen balances comparables. La tabla muestra su diferencia de costo, sin inferir tiempos de viaje ni congestión.'
                    : 'No hay suficientes resultados comparables para recomendar un escenario.'}
              </p>
            </div>
          </div>
          <h3>¿Qué estamos comparando?</h3>
          <p>
            Vías cerradas por escenario:{' '}
            {w.scenarios
              .map((s) => `${s.scenario_name}: ${closedRoads(s)}`)
              .join(' · ')}
            . Las modificaciones permanecen independientes en cada escenario.
          </p>
          <p>
            {results.some((r) => r?.demo)
              ? 'DEMOSTRACIÓN: soluciones estáticas identificadas. Consulta las capacidades y los balances antes de interpretar los resultados; no son respuestas del servidor.'
              : 'Ejecuta cada escenario desde el selector superior. Los resultados se descartan si modificas su red.'}
          </p>
        </section>
      </div>
    </>
  )
}
