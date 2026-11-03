import { useState } from 'react'
import { motion } from 'motion/react'
import type { Workspace } from '../scenarios/useWorkspace'
import { Icon } from '../../components/Icon'
export function RoadInspector({
  w,
  onFocus,
  onCloseRoad,
}: {
  w: Workspace
  onFocus: () => void
  onCloseRoad: () => void
}) {
  const [tab, setTab] = useState('Propiedades')
  const road = w.scenario.roads.find(
    (r) => w.selection?.type === 'road' && r.id === w.selection.id,
  )
  const node = w.scenario.nodes.find(
    (n) => w.selection?.type === 'node' && n.id === w.selection.id,
  )
  const stored = w.results[w.active],
    result = stored?.data
  const flow =
    result?.status === 'optimal'
      ? result.roads.find((r) => r.id === road?.id)
      : undefined
  const other = w.results[1 - w.active],
    otherScenario = w.scenarios[1 - w.active]
  const comparable =
    result?.status === 'optimal' &&
    other?.data.status === 'optimal' &&
    stored?.demo === other.demo &&
    JSON.stringify(w.scenario.nodes.map((n) => [n.id, n.balance]).sort()) ===
      JSON.stringify(otherScenario.nodes.map((n) => [n.id, n.balance]).sort())
  const otherRoad = comparable
    ? other?.data.roads.find((r) => r.id === road?.id)
    : undefined
  const sameRoad = otherScenario.roads.find((r) => r.id === road?.id)
  const matching =
    sameRoad?.source === road?.source && sameRoad?.target === road?.target
  const diff = (a: number | undefined, b: number | undefined) =>
    a === undefined || b === undefined ? '—' : `${a - b > 0 ? '+' : ''}${a - b}`
  return (
    <motion.section
      className="mega-inspector glass"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      key={road?.id ?? node?.id ?? 'none'}
    >
      <header>
        <span className="inspector-emblem">
          <Icon name={road ? 'road' : node ? 'node' : 'cursor'} size={24} />
        </span>
        <div>
          <p className="eyebrow">
            {road
              ? 'VÍA SELECCIONADA'
              : node
                ? 'INTERSECCIÓN'
                : 'EXPLORAR LA RED'}
          </p>
          <h2>
            {road
              ? `Vía ${road.id}`
              : node
                ? node.label
                : 'Cada vía, una decisión'}
          </h2>
        </div>
        {w.selection && (
          <button
            aria-label="Cerrar inspector urbano"
            onClick={() => w.setSelection(null)}
          >
            ×
          </button>
        )}
      </header>
      {road ? (
        <>
          <select
            className="road-selection"
            aria-label="Vía inspeccionada"
            value={road.id}
            onChange={(e) =>
              w.setSelection({ type: 'road', id: e.target.value })
            }
          >
            {w.scenario.roads.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} · {r.source} → {r.target}
              </option>
            ))}
          </select>
          <div
            className="inspector-tabs"
            role="group"
            aria-label="Detalle de la carretera"
          >
            {['Propiedades', 'Flujo', 'Impacto'].map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === 'Propiedades' ? (
            <dl className="mega-properties">
              <div>
                <dt>Origen → destino</dt>
                <dd>
                  {road.source} → {road.target}
                </dd>
              </div>
              <div>
                <dt>Capacidad</dt>
                <dd>{road.capacity} veh./intervalo</dd>
              </div>
              <div>
                <dt>Costo unitario</dt>
                <dd>{road.unit_cost} u.</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <span
                    className={'status-pill ' + (!road.enabled ? 'closed' : '')}
                  >
                    {road.enabled ? 'Habilitada' : 'Cerrada'}
                  </span>
                </dd>
              </div>
            </dl>
          ) : tab === 'Flujo' ? (
            <>
              <dl className="mega-properties">
                <div>
                  <dt>Flujo asignado</dt>
                  <dd>{flow ? `${flow.flow} veh./intervalo` : 'Pendiente'}</dd>
                </div>
                <div>
                  <dt>Utilización de capacidad</dt>
                  <dd>
                    {flow?.utilization_pct === null
                      ? 'No aplica'
                      : flow
                        ? `${flow.utilization_pct} %`
                        : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Flujo en el otro escenario</dt>
                  <dd>
                    {matching && otherRoad ? otherRoad.flow : 'No comparable'}
                  </dd>
                </div>
              </dl>
              {flow && flow.utilization_pct !== null && (
                <meter
                  aria-label="Utilización de capacidad"
                  min="0"
                  max="100"
                  value={flow.utilization_pct}
                />
              )}
              <p className="help">
                Solución estática {stored?.demo ? 'DEMO' : 'del servidor'}. La
                API no proporciona una evolución temporal.
              </p>
            </>
          ) : (
            <>
              <p>Comparación del escenario activo con el otro escenario.</p>
              <dl className="mega-properties">
                <div>
                  <dt>Diferencia de flujo de esta vía</dt>
                  <dd>
                    {matching && flow && otherRoad
                      ? diff(flow.flow, otherRoad.flow)
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Diferencia de costo total</dt>
                  <dd>
                    {comparable
                      ? diff(
                          result?.total_cost ?? undefined,
                          other?.data.total_cost ?? undefined,
                        )
                      : '—'}
                  </dd>
                </div>
              </dl>
              <p className="help">
                {comparable
                  ? 'Diferencias entre soluciones; no atribuyen causalidad a una sola modificación.'
                  : 'Optimiza ambos escenarios con los mismos balances y origen de datos. Un escenario infactible no tiene flujos ni costo comparable.'}
              </p>
            </>
          )}
          <div className="inspector-actions">
            <button onClick={onFocus}>
              <Icon name="focus" size={16} />
              Enfocar vía
            </button>
            <button
              className={road.enabled ? 'danger' : 'primary'}
              disabled={w.loading}
              onClick={onCloseRoad}
            >
              {road.enabled
                ? 'Cerrar vía y optimizar'
                : 'Habilitar y optimizar'}
            </button>
          </div>
        </>
      ) : node ? (
        <>
          <dl className="mega-properties">
            <div>
              <dt>Identificador</dt>
              <dd>{node.id}</dd>
            </div>
            <div>
              <dt>Balance</dt>
              <dd>{node.balance} veh./intervalo</dd>
            </div>
            <div>
              <dt>Conexiones</dt>
              <dd>
                {
                  w.scenario.roads.filter(
                    (r) => r.source === node.id || r.target === node.id,
                  ).length
                }
              </dd>
            </div>
          </dl>
          <button onClick={onFocus}>Enfocar intersección</button>
        </>
      ) : (
        <>
          <p>
            Selecciona una carretera en la ciudad o utiliza la lista para
            consultar sus propiedades y experimentar con cierres.
          </p>
          <div className="road-picker">
            {w.scenario.roads.map((r) => (
              <button
                key={r.id}
                onClick={() => w.setSelection({ type: 'road', id: r.id })}
              >
                <span>
                  {r.id}{' '}
                  <small>
                    {r.source} → {r.target}
                  </small>
                </span>
                <i className={'dot ' + (r.enabled ? 'green' : '')} />
              </button>
            ))}
          </div>
        </>
      )}
    </motion.section>
  )
}
