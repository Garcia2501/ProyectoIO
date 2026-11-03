import { useState } from 'react'
import { useReducedMotion } from 'motion/react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
import { Icon } from '../../components/Icon'
export function Analysis({
  scenario,
  result,
}: {
  scenario: Scenario
  result: StoredResult | null
}) {
  const [tab, setTab] = useState<'flow' | 'utilization' | 'cost'>('flow')
  const reduced = useReducedMotion()
  const optimal = result?.data.status === 'optimal'
  const data = scenario.roads.map((r) => {
    const rr = result?.data.roads.find((a) => a.id === r.id)
    return {
      id: r.id,
      value: optimal
        ? tab === 'flow'
          ? rr?.flow
          : tab === 'utilization'
            ? rr?.utilization_pct
            : (rr?.flow ?? 0) * r.unit_cost
        : null,
    }
  })
  const utilizations =
    result?.data.roads.filter((r) => r.utilization_pct !== null) ?? []
  const avg =
    optimal && utilizations.length
      ? utilizations.reduce((s, r) => s + (r.utilization_pct ?? 0), 0) /
        utilizations.length
      : null
  return (
    <section className="panel analysis">
      <div className="section-heading">
        <h2>
          <Icon name="chart" />
          Análisis de la red
        </h2>
        <div className="segmented">
          {(
            [
              ['flow', 'Flujo en las vías'],
              ['utilization', 'Utilización'],
              ['cost', 'Costos'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'selected' : ''}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="analysis-grid">
        <article className="chart-card">
          <h3>
            {tab === 'flow'
              ? 'Flujo por tramo (vehículos / intervalo)'
              : tab === 'utilization'
                ? 'Utilización por tramo (%)'
                : 'Costo por tramo (unidades abstractas)'}
          </h3>
          {optimal ? (
            <div className="chart">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={1}
                minHeight={1}
              >
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="id" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    isAnimationActive={!reduced}
                    dataKey="value"
                    name={
                      tab === 'flow'
                        ? 'Vehículos'
                        : tab === 'cost'
                          ? 'Costo'
                          : 'Utilización %'
                    }
                    radius={[5, 5, 0, 0]}
                  >
                    {data.map((d, i) => (
                      <Cell
                        key={d.id}
                        fill={['#45b42d', '#39a3ee', '#42c9bb'][i % 3]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">
              <Icon name="chart" size={35} />
              <span>
                {result
                  ? 'Sin flujo factible para representar'
                  : 'Los resultados aparecerán al optimizar la red'}
              </span>
              <small>Sin series temporales ni iteraciones disponibles.</small>
            </div>
          )}
        </article>
        <article className="chart-card">
          <h3>Utilización de la red</h3>
          <div className="donut-wrap">
            {avg !== null ? (
              <>
                <div className="chart donut">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={1}
                    minHeight={1}
                  >
                    <PieChart>
                      <Pie
                        isAnimationActive={!reduced}
                        data={[{ value: avg }, { value: 100 - avg }]}
                        dataKey="value"
                        innerRadius="72%"
                        outerRadius="95%"
                        startAngle={90}
                        endAngle={-270}
                        stroke="none"
                      >
                        <Cell fill="#43b829" />
                        <Cell fill="#dcefe1" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-label">
                    <strong>{avg.toFixed(1)} %</strong>
                    <small>Utilización media</small>
                  </div>
                </div>
                <div className="donut-legend">
                  {result?.data.roads.map((r, i) => (
                    <span key={r.id}>
                      <i
                        className="dot"
                        style={{
                          background: ['#45b42d', '#39a3ee', '#42c9bb'][i % 3],
                        }}
                      />
                      {r.id}:{' '}
                      {r.utilization_pct === null
                        ? 'N/A'
                        : r.utilization_pct + ' %'}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="pending-ring">
                <strong>—</strong>
                <span>Sin resultado</span>
              </div>
            )}
          </div>
          <small className="help">
            Media de tramos con capacidad efectiva mayor que cero.
          </small>
        </article>
        <article className="chart-card conclusion">
          <div
            className={
              'callout ' +
              (result?.data.status === 'infeasible' ? 'warning' : '')
            }
          >
            <Icon name={optimal ? 'check' : 'info'} size={26} />
            <div>
              <h3>
                {result
                  ? optimal
                    ? 'Red optimizada'
                    : 'Sin solución factible'
                  : 'Lista para analizar'}
              </h3>
              <p>
                {result?.data.message ||
                  (optimal
                    ? 'El resultado distribuye la oferta respetando las capacidades.'
                    : 'Aún no se ha ejecutado ninguna optimización. Conecta el backend o carga la demostración.')}
              </p>
            </div>
          </div>
          <p className="help">
            {result?.demo
              ? 'DEMOSTRACIÓN · ejemplo estático, no calculado por el servidor.'
              : 'Los costos no representan tiempos reales de viaje.'}
          </p>
        </article>
      </div>
    </section>
  )
}
