import type { Workspace } from './useWorkspace'
import { useEffect, useState } from 'react'
import { CityViewport } from '../simulation3d/CityViewport'
import { VisualClock, CAMERA_LABELS } from '../simulation3d/visualClock'
import type { CameraPreset } from '../simulation3d/visualClock'
import { CameraBus } from '../simulation3d/CameraBus'
import { PlaybackControls } from '../simulation3d/PlaybackControls'
import { useReducedMotion } from 'motion/react'
import { NetworkCanvas } from '../network/NetworkCanvas'
import { Icon } from '../../components/Icon'
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
export function Comparison({ w }: { w: Workspace }) {
  const reduced = useReducedMotion()
  const [clock] = useState(() => new VisualClock()),
    [bus] = useState(() => new CameraBus())
  const [city, setCity] = useState(true),
    [camera, setCamera] = useState<CameraPreset>('isometric')
  useEffect(() => {
    if (reduced) clock.pause()
  }, [clock, reduced])
  const [a, b] = w.results
  const comparable =
    !!a &&
    !!b &&
    a.demo === b.demo &&
    a.data.status === 'optimal' &&
    b.data.status === 'optimal' &&
    JSON.stringify(
      w.scenarios[0].nodes.map((n) => [n.id, n.balance]).sort(),
    ) ===
      JSON.stringify(w.scenarios[1].nodes.map((n) => [n.id, n.balance]).sort())
  const costDiff =
    comparable && a.data.total_cost !== null && a.data.total_cost !== 0
      ? ((b.data.total_cost! - a.data.total_cost) / a.data.total_cost) * 100
      : null
  const roadIds = [
    ...new Set(w.scenarios.flatMap((s) => s.roads.map((r) => r.id))),
  ]
  const chart = roadIds.map((id) => ({
    id,
    Base:
      a?.data.status === 'optimal'
        ? a.data.roads.find((x) => x.id === id)?.flow
        : undefined,
    Alternativo:
      b?.data.status === 'optimal'
        ? b.data.roads.find((x) => x.id === id)?.flow
        : undefined,
  }))
  const rows = [
    [
      'Costo total',
      a?.data.total_cost ?? '—',
      b?.data.total_cost ?? '—',
      comparable
        ? String(b.data.total_cost! - a.data.total_cost!) +
          ' u.' +
          (costDiff !== null
            ? ' (' + (costDiff > 0 ? '+' : '') + costDiff.toFixed(1) + ' %)'
            : '')
        : '—',
    ],
    [
      'Oferta (veh./intervalo)',
      w.scenarios[0].nodes.reduce((s, n) => s + Math.max(n.balance, 0), 0),
      w.scenarios[1].nodes.reduce((s, n) => s + Math.max(n.balance, 0), 0),
      '—',
    ],
    [
      'Vías habilitadas',
      w.scenarios[0].roads.filter((r) => r.enabled).length,
      w.scenarios[1].roads.filter((r) => r.enabled).length,
      '—',
    ],
    [
      'Factibilidad',
      a
        ? a.data.status === 'optimal'
          ? 'Factible'
          : 'Infactible'
        : 'Pendiente',
      b
        ? b.data.status === 'optimal'
          ? 'Factible'
          : 'Infactible'
        : 'Pendiente',
      '—',
    ],
  ]
  const utilization = (index: number) => {
    const r = w.results[index]
    if (r?.data.status !== 'optimal') return null
    const usable = r.data.roads.filter((x) => x.utilization_pct !== null)
    return usable.length
      ? usable.reduce((s, r) => s + r.utilization_pct!, 0) / usable.length
      : null
  }
  const saturated = (index: number) =>
    w.results[index]?.data.status === 'optimal'
      ? w.results[index]!.data.roads.filter(
          (r) => (r.utilization_pct ?? 0) >= 100,
        ).length
      : null
  const meanA = utilization(0),
    meanB = utilization(1),
    satA = saturated(0),
    satB = saturated(1)
  rows.push([
    'Utilización media',
    meanA === null ? '—' : meanA.toFixed(1) + ' %',
    meanB === null ? '—' : meanB.toFixed(1) + ' %',
    comparable && meanA !== null && meanB !== null
      ? (meanB - meanA).toFixed(1) + ' p.p.'
      : '—',
  ])
  rows.push([
    'Vías saturadas (100 %)',
    satA ?? '—',
    satB ?? '—',
    comparable && satA !== null && satB !== null ? String(satB - satA) : '—',
  ])
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
          <span className="scenario-chip">
            ● {w.scenarios[0].scenario_name}
          </span>
          <b>vs</b>
          <span className="scenario-chip blue-chip">
            ● {w.scenarios[1].scenario_name}
          </span>
        </div>
      </section>
      <div className="comparison-controls">
        <label>
          <input
            type="checkbox"
            checked={city}
            onChange={(e) => setCity(e.target.checked)}
          />
          Ciudades 3D · cámara y reproducción sincronizadas
        </label>
        {city && (
          <select
            aria-label="Cámara de comparación"
            value={camera}
            onChange={(e) => setCamera(e.target.value as CameraPreset)}
          >
            {Object.entries(CAMERA_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="comparison-top">
        {w.scenarios.map((s, i) => (
          <section className="panel comparison-map" key={s.scenario_name}>
            <h2 className={i ? 'blue-heading' : ''}>
              <Icon name="layers" />
              {s.scenario_name === 'Base' ? 'Escenario base' : s.scenario_name}
              <span className="badge">
                {w.results[i]?.demo ? 'Demo' : i ? 'Alternativo' : 'Base'}
              </span>
            </h2>
            {city ? (
              <div className="comparison-city">
                <CityViewport
                  scenario={s}
                  result={w.results[i]}
                  selection={w.active === i ? w.selection : null}
                  onSelect={(selection) => {
                    w.selectScenario(i)
                    w.setSelection(selection)
                  }}
                  clock={clock}
                  quality="low"
                  camera={camera}
                  focusTick={0}
                  dusk={false}
                  utilization
                  thresholds={[60, 80, 95]}
                  reduced={!!reduced}
                  bus={bus}
                />
              </div>
            ) : (
              <NetworkCanvas scenario={s} compact result={w.results[i]} />
            )}
            <button
              className="map-edit-link"
              onClick={() => {
                w.selectScenario(i)
                w.setView('editor')
              }}
            >
              Editar este escenario <Icon name="arrow" size={15} />
            </button>
          </section>
        ))}
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
                  <th>Base</th>
                  <th>Alternativo</th>
                  <th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((v, i) =>
                      i === 0 ? <th key={i}>{v}</th> : <td key={i}>{v}</td>,
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="help">
            Costo en unidades abstractas. Diferencia relativa al escenario base;
            solo se calcula entre resultados óptimos con los mismos balances y
            el mismo origen de datos.
          </p>
        </section>
      </div>
      {city && (
        <div className="comparison-playback">
          <PlaybackControls clock={clock} />
        </div>
      )}
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
                <th>Base: flujo / utilización</th>
                <th>Alternativo: flujo / utilización</th>
                <th>Δ flujo</th>
                <th>Δ utilización</th>
              </tr>
            </thead>
            <tbody>
              {roadIds.map((id) => {
                const x =
                    a?.data.status === 'optimal'
                      ? a.data.roads.find((r) => r.id === id)
                      : null,
                  y =
                    b?.data.status === 'optimal'
                      ? b.data.roads.find((r) => r.id === id)
                      : null
                const r = w.scenarios[0].roads.find((r) => r.id === id),
                  s = w.scenarios[1].roads.find((r) => r.id === id)
                const match =
                  r && s && r.source === s.source && r.target === s.target
                return (
                  <tr key={id}>
                    <th>{id}</th>
                    <td>
                      {x
                        ? `${x.flow} / ${x.utilization_pct === null ? 'No aplica' : x.utilization_pct + ' %'}`
                        : '—'}
                    </td>
                    <td>
                      {y
                        ? `${y.flow} / ${y.utilization_pct === null ? 'No aplica' : y.utilization_pct + ' %'}`
                        : '—'}
                    </td>
                    <td>
                      {comparable && match && x && y ? y.flow - x.flow : '—'}
                    </td>
                    <td>
                      {comparable &&
                      match &&
                      x?.utilization_pct != null &&
                      y?.utilization_pct != null
                        ? (y.utilization_pct - x.utilization_pct).toFixed(1) +
                          ' p.p.'
                        : '—'}
                    </td>
                  </tr>
                )
              })}
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
              <BarChart
                data={roadIds.map((id) => ({
                  id,
                  Base: (() => {
                    const r = w.scenarios[0].roads.find((x) => x.id === id)
                    return r?.enabled ? r.capacity : 0
                  })(),
                  Alternativo: (() => {
                    const t = w.scenarios[1].roads.find((x) => x.id === id)
                    return t?.enabled ? t.capacity : 0
                  })(),
                }))}
              >
                <CartesianGrid vertical={false} stroke="#e1e9ee" />
                <XAxis dataKey="id" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  isAnimationActive={!reduced}
                  dataKey="Base"
                  fill="#65c94e"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  isAnimationActive={!reduced}
                  dataKey="Alternativo"
                  fill="#56b0f4"
                  radius={[5, 5, 0, 0]}
                />
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
          {a?.data.status === 'optimal' || b?.data.status === 'optimal' ? (
            <div className="chart comparison-chart">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={1}
                minHeight={1}
              >
                <BarChart data={chart}>
                  <CartesianGrid vertical={false} stroke="#e1e9ee" />
                  <XAxis dataKey="id" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    isAnimationActive={!reduced}
                    dataKey="Base"
                    fill="#65c94e"
                  />
                  <Bar
                    isAnimationActive={!reduced}
                    dataKey="Alternativo"
                    fill="#56b0f4"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">
              <Icon name="activity" size={36} />
              <span>Optimiza ambos escenarios para comparar flujos.</span>
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
                {b?.data.status === 'infeasible'
                  ? 'El escenario alternativo no satisface la demanda con las capacidades actuales. No corresponde calcular un porcentaje de mejora.'
                  : comparable
                    ? 'Ambos resultados tienen balances comparables. La tabla muestra su diferencia de costo, sin inferir tiempos de viaje ni congestión.'
                    : 'No hay suficientes resultados comparables para recomendar un escenario.'}
              </p>
            </div>
          </div>
          <h3>¿Qué estamos comparando?</h3>
          <p>
            Vías cerradas en el escenario alternativo:{' '}
            {w.scenarios[1].roads
              .filter((r) => !r.enabled)
              .map((r) => r.id)
              .join(', ') || 'ninguna'}
            . Las modificaciones permanecen independientes en cada escenario.
          </p>
          <p>
            {a?.demo || b?.demo
              ? 'DEMOSTRACIÓN: soluciones estáticas identificadas. Consulta las capacidades y los balances antes de interpretar los resultados; no son respuestas del servidor.'
              : 'Ejecuta cada escenario desde el selector superior. Los resultados se descartan si modificas su red.'}
          </p>
        </section>
      </div>
    </>
  )
}
