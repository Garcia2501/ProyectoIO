import { Icon } from '../../components/Icon'
import type { Workspace } from '../scenarios/useWorkspace'
import { lengthMeters } from './geo'
import type { GeoNetwork } from './geo'
import { CLASS_LABELS } from './layers'
import type { RoadStatus } from './layers'

const ONEWAY: Record<string, string> = {
  true: 'Sentido único',
  false: 'Doble sentido',
  unknown: 'Sentido sin confirmar',
}

/**
 * Inspector de la selección sobre el mapa. Muestra solo lo que existe en los
 * datos: nombre, IDs, extremos, parámetros del modelo, resultado del servidor
 * y calidad de la fuente. Cerrar una vía exige optimizar de nuevo.
 */
export function GeoInspector({
  w,
  network,
  statuses,
  modelReady,
}: {
  w: Workspace
  network: GeoNetwork
  statuses: RoadStatus[]
  modelReady: boolean
}) {
  const sel = w.selection
  const nodeLabel = (id: string) =>
    network.nodes.find((n) => n.id === id)?.label ?? id
  if (!sel)
    return (
      <section className="huachi-inspector glass" aria-label="Inspector">
        <h2>Inspector</h2>
        <p className="help">
          Selecciona una calle o un nodo del mapa, o una vía de la lista, para
          ver sus datos.
        </p>
      </section>
    )
  if (sel.type === 'node') {
    const node = network.nodes.find((n) => n.id === sel.id)
    const model = w.scenario.nodes.find((n) => n.id === sel.id)
    if (!node) return null
    return (
      <section className="huachi-inspector glass" aria-label="Inspector">
        <p className="eyebrow">NODO</p>
        <h2>{node.label}</h2>
        <dl>
          <div>
            <dt>ID</dt>
            <dd>{node.id}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{node.kind ?? 'Sin dato'}</dd>
          </div>
          <div>
            <dt>Posición</dt>
            <dd>
              {node.lat.toFixed(5)}, {node.lon.toFixed(5)}
            </dd>
          </div>
          <div>
            <dt>Balance (supuesto)</dt>
            <dd>
              {modelReady && model
                ? model.balance > 0
                  ? `+${model.balance} oferta`
                  : model.balance < 0
                    ? `${model.balance} demanda`
                    : '0'
                : 'Pendiente'}
            </dd>
          </div>
        </dl>
      </section>
    )
  }
  const status = statuses.find((s) => s.geo.id === sel.id)
  if (!status) return null
  const { geo, model, result } = status
  const closed = !model.enabled
  const toggle = () => {
    const next = {
      ...w.scenario,
      roads: w.scenario.roads.map((r) =>
        r.id === geo.id ? { ...r, enabled: !r.enabled } : r,
      ),
    }
    w.update(next)
    void w.run(next)
  }
  return (
    <section className="huachi-inspector glass" aria-label="Inspector">
      <p className="eyebrow">VÍA</p>
      <h2>{geo.name ?? 'Sin nombre confirmado'}</h2>
      <p className="huachi-inspector-sub">
        <span className={'status-pill ' + (closed ? 'closed' : '')}>
          {closed ? 'CERRADA' : 'ABIERTA'}
        </span>{' '}
        {CLASS_LABELS[status.cls]}
      </p>
      <dl>
        <div>
          <dt>ID de la vía</dt>
          <dd>{geo.id}</dd>
        </div>
        <div>
          <dt>Extremos</dt>
          <dd>
            {nodeLabel(geo.source)} → {nodeLabel(geo.target)}
          </dd>
        </div>
        <div>
          <dt>Longitud geodésica</dt>
          <dd>{Math.round(lengthMeters(geo.coordinates))} m</dd>
        </div>
        <div>
          <dt>Capacidad (supuesto)</dt>
          <dd>
            {modelReady
              ? closed
                ? `0 efectiva (${model.capacity} nominal)`
                : `${model.capacity} veh.`
              : 'Pendiente'}
          </dd>
        </div>
        <div>
          <dt>Costo unitario (supuesto)</dt>
          <dd>{modelReady ? `${model.unit_cost} u.` : 'Pendiente'}</dd>
        </div>
        <div>
          <dt>Flujo</dt>
          <dd>{result && !closed ? `${result.flow} veh.` : '—'}</dd>
        </div>
        <div>
          <dt>Utilización</dt>
          <dd>
            {status.utilization === null ? '—' : `${status.utilization} %`}
          </dd>
        </div>
        <div>
          <dt>Sentido</dt>
          <dd>{ONEWAY[String(geo.oneway)]}</dd>
        </div>
        <div>
          <dt>Fuente y calidad</dt>
          <dd>
            {geo.sourceQuality} ·{' '}
            {geo.verified ? 'verificada' : 'sin verificar'}
          </dd>
        </div>
        {geo.osmWayIds.length > 0 && (
          <div>
            <dt>Vías OSM</dt>
            <dd>{geo.osmWayIds.join(', ')}</dd>
          </div>
        )}
      </dl>
      {geo.assumptions && (
        <p className="help">Supuesto: {geo.assumptions}</p>
      )}
      {geo.oneway === 'unknown' && (
        <p className="help">
          El sentido real de esta vía no está confirmado en los datos.
        </p>
      )}
      <button
        className="primary"
        disabled={!modelReady || w.loading}
        onClick={toggle}
      >
        <Icon name="sparkles" size={16} />
        {closed ? 'Reabrir vía y optimizar' : 'Cerrar vía y optimizar'}
      </button>
    </section>
  )
}
