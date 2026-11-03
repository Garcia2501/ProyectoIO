import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { FormEvent } from 'react'
import type { Workspace } from '../features/scenarios/useWorkspace'
import type { NetworkNode, Road } from '../types/network'
import { Icon } from './Icon'
export function Inspector({
  w,
  onDelete,
}: {
  w: Workspace
  onDelete: () => void
}) {
  const { scenario, selection } = w
  const [collapsed, setCollapsed] = useState(false)
  const reduced = useReducedMotion()
  const node =
    selection?.type === 'node'
      ? scenario.nodes.find((n) => n.id === selection.id)
      : undefined
  const road =
    selection?.type === 'road'
      ? scenario.roads.find((r) => r.id === selection.id)
      : undefined
  const editing = w.view === 'editor'
  const [draftNode, setNode] = useState<NetworkNode | undefined>(node)
  const [draftRoad, setRoad] = useState<Road | undefined>(
    road ||
      (selection?.id === 'new'
        ? {
            id: '',
            source: scenario.nodes[0]?.id || '',
            target: scenario.nodes[1]?.id || '',
            capacity: 100,
            unit_cost: 1,
            enabled: true,
          }
        : undefined),
  )
  const [error, setError] = useState('')
  const save = (event: FormEvent) => {
    event.preventDefault()
    if (draftRoad) {
      if (draftRoad.source === draftRoad.target) {
        setError('Elige dos nodos diferentes.')
        return
      }
      if (
        !draftRoad.id.trim() ||
        scenario.roads.some((r) => r.id === draftRoad.id && r.id !== road?.id)
      ) {
        setError('El identificador de la vía debe ser único.')
        return
      }
      w.update({
        ...scenario,
        roads: road
          ? scenario.roads.map((r) => (r.id === road.id ? draftRoad : r))
          : [...scenario.roads, draftRoad],
      })
      w.setSelection({ type: 'road', id: draftRoad.id })
    } else if (draftNode)
      w.update({
        ...scenario,
        nodes: scenario.nodes.map((n) =>
          n.id === draftNode.id ? { ...draftNode, x: n.x, y: n.y } : n,
        ),
      })
    setError('')
    w.setMessage(
      'Propiedades guardadas en memoria. Los resultados anteriores se han descartado.',
    )
  }
  const result = w.results[w.active]
  const rr =
    road && result?.data.status === 'optimal'
      ? result.data.roads.find((r) => r.id === road.id)
      : undefined
  const source = scenario.nodes.find((n) => n.id === road?.source),
    target = scenario.nodes.find((n) => n.id === road?.target)
  return (
    <motion.aside
      className="panel inspector"
      initial={reduced ? false : { opacity: 0.6, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
    >
      <h2>
        <Icon name={node ? 'network' : 'road'} />
        {editing
          ? node
            ? 'Editar nodo'
            : 'Editar vía'
          : node
            ? 'Detalle del nodo'
            : 'Detalle de la vía seleccionada'}
        <span className="badge">{node?.id || road?.id || '—'}</span>
        <button
          type="button"
          className="inspector-toggle"
          aria-label={collapsed ? 'Expandir inspector' : 'Contraer inspector'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          <Icon name={collapsed ? 'plus' : 'close'} size={16} />
        </button>
      </h2>
      <motion.div
        className="inspector-body"
        initial={false}
        animate={{ height: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        style={{ overflow: 'hidden' }}
        inert={collapsed}
      >
        {editing && (draftNode || draftRoad) ? (
          <form onSubmit={save}>
            <fieldset>
              <legend>
                Propiedades {draftNode ? 'del nodo' : 'de la vía'}
              </legend>
              {draftNode ? (
                <>
                  <label>
                    Identificador
                    <input value={draftNode.id} readOnly />
                  </label>
                  <label>
                    Nombre del nodo
                    <input
                      required
                      value={draftNode.label}
                      onChange={(e) =>
                        setNode({ ...draftNode, label: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Balance (vehículos)
                    <input
                      type="number"
                      step="1"
                      required
                      value={draftNode.balance}
                      onChange={(e) =>
                        setNode({
                          ...draftNode,
                          balance: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <p className="help">
                    Positivo: oferta · negativo: demanda · cero: tránsito.
                  </p>
                </>
              ) : (
                draftRoad && (
                  <>
                    <label>
                      Nombre de la vía
                      <input
                        required
                        readOnly={!!road}
                        placeholder="Ej. R4"
                        value={draftRoad.id}
                        onChange={(e) =>
                          setRoad({ ...draftRoad, id: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Origen
                      <select
                        required
                        value={draftRoad.source}
                        onChange={(e) =>
                          setRoad({ ...draftRoad, source: e.target.value })
                        }
                      >
                        {scenario.nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.id} ({n.label})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Destino
                      <select
                        required
                        value={draftRoad.target}
                        onChange={(e) =>
                          setRoad({ ...draftRoad, target: e.target.value })
                        }
                      >
                        {scenario.nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.id} ({n.label})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Capacidad (vehículos)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={draftRoad.capacity}
                        onChange={(e) =>
                          setRoad({
                            ...draftRoad,
                            capacity: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Costo por vehículo (u.)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={draftRoad.unit_cost}
                        onChange={(e) =>
                          setRoad({
                            ...draftRoad,
                            unit_cost: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Estado
                      <select
                        value={String(draftRoad.enabled)}
                        onChange={(e) =>
                          setRoad({
                            ...draftRoad,
                            enabled: e.target.value === 'true',
                          })
                        }
                      >
                        <option value="true">● Operativa</option>
                        <option value="false">× Cerrada</option>
                      </select>
                    </label>
                  </>
                )
              )}
            </fieldset>
            <div className="preview">
              <strong>
                Vista previa {draftNode ? 'del nodo' : 'de la vía'}
              </strong>
              <div>
                {draftRoad ? (
                  <>
                    <b className="mini-node">{draftRoad.source}</b>
                    <span
                      className={
                        'preview-line ' + (!draftRoad.enabled ? 'closed' : '')
                      }
                    >
                      {draftRoad.enabled
                        ? 'c:' +
                          draftRoad.unit_cost +
                          ' / cap:' +
                          draftRoad.capacity
                        : 'CERRADA'}{' '}
                      →
                    </span>
                    <b className="mini-node blue-bg">{draftRoad.target}</b>
                  </>
                ) : (
                  <>
                    <b className="mini-node">{draftNode?.id}</b>
                    <span>
                      {draftNode?.label} · {draftNode?.balance} veh.
                    </span>
                  </>
                )}
              </div>
            </div>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <div className="form-actions">
              {(road || node) && (
                <button type="button" className="danger" onClick={onDelete}>
                  <Icon name="trash" size={16} />
                  Eliminar {node ? 'nodo' : 'vía'}
                </button>
              )}
              <button type="submit" className="primary">
                <Icon name="check" size={17} />
                Guardar cambios
              </button>
            </div>
          </form>
        ) : node ? (
          <>
            <div className="route-strip">
              <b className="mini-node">{node.id}</b>
              <strong>{node.label}</strong>
            </div>
            <dl>
              <div>
                <dt>Balance</dt>
                <dd>{node.balance} veh.</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>
                  {node.balance > 0
                    ? 'Origen'
                    : node.balance < 0
                      ? 'Destino'
                      : 'Tránsito'}
                </dd>
              </div>
              <div>
                <dt>Conexiones</dt>
                <dd>
                  {
                    scenario.roads.filter(
                      (r) => r.source === node.id || r.target === node.id,
                    ).length
                  }
                </dd>
              </div>
            </dl>
            <button className="wide" onClick={() => w.setView('editor')}>
              <Icon name="edit" />
              Editar propiedades
            </button>
          </>
        ) : road ? (
          <>
            <div className="route-strip">
              <b className="mini-node">{source?.id}</b>
              <strong>{source?.label}</strong>
              <Icon name="arrow" />
              <b className="mini-node blue-bg">{target?.id}</b>
              <strong>{target?.label}</strong>
            </div>
            <dl>
              <div>
                <dt>Origen</dt>
                <dd>
                  {road.source} ({source?.label})
                </dd>
              </div>
              <div>
                <dt>Destino</dt>
                <dd>
                  {road.target} ({target?.label})
                </dd>
              </div>
              <div>
                <dt>Capacidad</dt>
                <dd>{road.capacity} veh.</dd>
              </div>
              <div>
                <dt>Costo (c)</dt>
                <dd>{road.unit_cost} u.</dd>
              </div>
              <div>
                <dt>Flujo actual</dt>
                <dd>{rr ? rr.flow + ' veh.' : 'Sin resultado'}</dd>
              </div>
              <div>
                <dt>Utilización</dt>
                <dd>
                  {rr?.utilization_pct != null
                    ? rr.utilization_pct + ' %'
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <span className={'badge ' + (!road.enabled ? 'closed' : '')}>
                    {road.enabled ? '● Operativa' : '× Cerrada'}
                  </span>
                </dd>
              </div>
            </dl>
            {rr?.utilization_pct != null && (
              <progress
                max="100"
                value={rr.utilization_pct}
                aria-label="Utilización de la vía"
              />
            )}
            <p className="help">
              {result?.demo ? 'Datos de demostración. ' : ''}Capacidad efectiva:{' '}
              {road.enabled ? road.capacity : 0} vehículos por intervalo.
            </p>
          </>
        ) : (
          <div className="empty-inspector">
            <Icon name="cursor" size={34} />
            <h3>Explora tu red</h3>
            <p>
              Selecciona un nodo o una vía en el mapa para ver sus propiedades.
            </p>
          </div>
        )}
        <div className="element-list" aria-label="Seleccionar elementos">
          {scenario.roads.map((r) => (
            <button
              key={r.id}
              aria-pressed={selection?.type === 'road' && selection.id === r.id}
              onClick={() => w.setSelection({ type: 'road', id: r.id })}
            >
              {r.id}
              <span>
                {r.source} → {r.target}
              </span>
              <i className={'dot ' + (r.enabled ? 'green' : 'red')} />
            </button>
          ))}
        </div>
      </motion.div>
    </motion.aside>
  )
}
