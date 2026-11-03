import type { Workspace } from './useWorkspace'
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
      costDiff !== null
        ? (costDiff > 0 ? '+' : '') + costDiff.toFixed(1) + ' %'
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
          <span className="scenario-chip">● Escenario base</span>
          <b>vs</b>
          <span className="scenario-chip blue-chip">● Cierre de vía</span>
        </div>
      </section>
      <div className="comparison-top">
        {w.scenarios.map((s, i) => (
          <section className="panel comparison-map" key={s.scenario_name}>
            <h2 className={i ? 'blue-heading' : ''}>
              <Icon name="layers" />
              {i ? 'Cierre de vía' : 'Escenario base'}
              <span className="badge">
                {w.results[i]?.demo ? 'Demo' : i ? 'Alternativo' : 'Base'}
              </span>
            </h2>
            <NetworkCanvas scenario={s} compact result={w.results[i]} />
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
            La segunda red comienza con R1 cerrada. Las modificaciones
            permanecen independientes en cada escenario.
          </p>
          <p>
            {a?.demo || b?.demo
              ? 'DEMOSTRACIÓN: el escenario base tiene costo 500. Con R1 cerrada solo existe capacidad de salida de 50 vehículos para una oferta de 100.'
              : 'Ejecuta cada escenario desde el selector superior. Los resultados se descartan si modificas su red.'}
          </p>
        </section>
      </div>
    </>
  )
}
