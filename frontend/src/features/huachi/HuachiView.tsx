import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Icon } from '../../components/Icon'
import type { Workspace } from '../scenarios/useWorkspace'
import { PlaybackControls } from '../simulation3d/PlaybackControls'
import { VisualClock } from '../simulation3d/visualClock'
import type { Thresholds } from '../simulation3d/visualClock'
import type { HuachiData } from './data'
import { lengthMeters } from './geo'
import { GeoInspector } from './GeoInspector'
import { HuachiMap } from './HuachiMap'
import { HuachiPending } from './HuachiPending'
import {
  CLASS_LABELS,
  DEFAULT_LAYERS,
  DEFAULT_THRESHOLDS,
  roadStatuses,
} from './layers'
import type { LayerState } from './layers'
import { Legend, LayerPanel } from './MapControls'
import { geometryScenario } from './scenarios'

export function HuachiView({ w, data }: { w: Workspace; data: HuachiData }) {
  if (data.status !== 'ready') return <HuachiPending data={data} />
  return <HuachiReady w={w} data={data} />
}

function HuachiReady({
  w,
  data,
}: {
  w: Workspace
  data: Extract<HuachiData, { status: 'ready' }>
}) {
  const reduced = !!useReducedMotion()
  const [clock] = useState(() => new VisualClock())
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS)
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS)
  useEffect(() => {
    if (reduced) clock.pause()
  }, [clock, reduced])
  const { network } = data
  const modelReady = w.external && data.scenarios !== null
  const placeholder = useMemo(() => geometryScenario(network), [network])
  const scenario = modelReady ? w.scenario : placeholder
  const stored = modelReady ? w.results[w.active] : null
  const result = stored?.data
  const statuses = useMemo(
    () => roadStatuses(network, scenario, stored, thresholds),
    [network, scenario, stored, thresholds],
  )
  const measured = statuses.filter((s) => s.utilization !== null)
  const mean = measured.length
    ? measured.reduce((sum, s) => sum + s.utilization!, 0) / measured.length
    : null
  const supply = scenario.nodes.reduce((s, n) => s + Math.max(0, n.balance), 0)
  const closed = statuses.filter((s) => s.cls === 'closed').length
  const km =
    network.roads.reduce((s, r) => s + lengthMeters(r.coordinates), 0) / 1000
  const origin = stored
    ? stored.demo
      ? 'DEMOSTRACIÓN'
      : 'Solución del servidor'
    : 'Sin optimización'
  return (
    <section className="huachi-experience" aria-label="Mapa de Huachi">
      <div className="huachi-stage">
        <div className="huachi-title glass">
          <span className="scene-icon">
            <Icon name="map" size={22} />
          </span>
          <div>
            <p className="eyebrow">SMARTFLOW / MAPA HUACHI</p>
            <h1>{modelReady ? scenario.scenario_name : 'Calles de Huachi'}</h1>
            <small>
              {network.nodes.length} nodos · {network.roads.length} vías ·{' '}
              {km.toFixed(2)} km · {origin}
            </small>
          </div>
        </div>
        <HuachiMap
          network={network}
          scenario={scenario}
          result={stored}
          selection={w.selection}
          onSelect={w.setSelection}
          layers={layers}
          thresholds={thresholds}
          clock={clock}
          reduced={reduced}
        />
        {result?.status === 'infeasible' && (
          <div className="huachi-state glass" role="status">
            <Icon name="info" />
            <span>
              <strong>Sin flujo factible.</strong>{' '}
              {result.message ??
                'Las capacidades no permiten satisfacer la demanda.'}{' '}
              No se muestran flujos ni vehículos.
            </span>
          </div>
        )}
        {modelReady && !result && (
          <div className="huachi-state glass" role="status">
            <Icon name="activity" />
            <span>Optimiza el escenario para colorear las calles y mover los símbolos.</span>
          </div>
        )}
        <div className="huachi-playback">
          <PlaybackControls clock={clock} />
        </div>
        <p className="huachi-footnote">
          Geografía: OpenStreetMap. Demanda, capacidad, costo y cierres son
          supuestos experimentales. Los símbolos son una escala visual del
          flujo del modelo, no vehículos medidos.
        </p>
      </div>
      <aside className="huachi-side">
        <section className="huachi-card glass">
          <div className="mega-section-title">
            <Icon name="layers" />
            <h2>Escenario</h2>
            <span className="status-pill">EN MEMORIA</span>
          </div>
          {modelReady ? (
            <>
              <label>
                <span className="sr-only">Escenario del mapa</span>
                <select
                  aria-label="Escenario del mapa"
                  value={w.active}
                  onChange={(e) => w.selectScenario(Number(e.target.value))}
                >
                  {w.scenarios.map((s, i) => (
                    <option key={s.scenario_name} value={i}>
                      {s.scenario_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="quick-actions">
                <button
                  className="primary"
                  disabled={w.loading}
                  onClick={() => void w.run()}
                >
                  <Icon name="sparkles" size={18} />
                  {w.loading ? 'Optimizando…' : 'Optimizar'}
                </button>
                <button onClick={() => w.setView('comparison')}>
                  <Icon name="layers" size={18} />
                  Comparar
                </button>
              </div>
            </>
          ) : (
            <p className="help" role="status">
              Escenario experimental pendiente: falta{' '}
              <code>huachi_scenario_seed.json</code>
              {data.seedErrors.length > 0
                ? ' válido (' + data.seedErrors[0] + ')'
                : ''}
              . Se muestra solo la geografía.
            </p>
          )}
        </section>
        <section className="huachi-card glass">
          <div className="mega-section-title">
            <Icon name="activity" />
            <h2>Indicadores</h2>
          </div>
          <div className="indicator-grid">
            <div>
              <small>Oferta requerida</small>
              <strong>
                {modelReady ? supply : '—'}
                <em>veh./intervalo</em>
              </strong>
            </div>
            <div>
              <small>Utilización media*</small>
              <strong>{mean === null ? '—' : mean.toFixed(1) + ' %'}</strong>
            </div>
            <div>
              <small>Factibilidad</small>
              <strong className={result?.status === 'infeasible' ? 'text-danger' : ''}>
                {result
                  ? result.status === 'optimal'
                    ? 'Factible'
                    : 'Infactible'
                  : 'Pendiente'}
              </strong>
            </div>
            <div>
              <small>Costo total</small>
              <strong>
                {result?.total_cost ?? '—'}
                <em>unidades</em>
              </strong>
            </div>
            <div>
              <small>Vías cerradas</small>
              <strong>{modelReady ? closed : '—'}</strong>
            </div>
          </div>
          <p className="help">
            *Media simple de vías con capacidad efectiva positiva. No
            representa congestión ni velocidad física.
          </p>
        </section>
        <GeoInspector
          w={w}
          network={network}
          statuses={statuses}
          modelReady={modelReady}
        />
        <section className="huachi-card glass">
          <h2>Vías</h2>
          <ul className="huachi-road-list" aria-label="Lista de vías">
            {statuses.map((s) => (
              <li key={s.geo.id}>
                <button
                  aria-pressed={
                    w.selection?.type === 'road' && w.selection.id === s.geo.id
                  }
                  onClick={() => w.setSelection({ type: 'road', id: s.geo.id })}
                >
                  <i style={{ background: s.color }} />
                  <span>
                    {s.geo.id}
                    {s.geo.name ? ' · ' + s.geo.name : ''}
                  </span>
                  <small>{CLASS_LABELS[s.cls]}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="huachi-card glass">
          <LayerPanel layers={layers} onChange={setLayers} />
          <Legend thresholds={thresholds} onChange={setThresholds} />
        </section>
        {(data.warnings.length > 0 || data.provenance) && (
          <section className="huachi-card glass">
            <h2>Origen de los datos</h2>
            {data.provenance && (
              <p className="help">
                {[
                  data.provenance.source,
                  data.provenance.extractedAt,
                  data.provenance.license,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            <ul className="huachi-warnings">
              {[...(data.provenance?.notes ?? []), ...data.warnings]
                .slice(0, 8)
                .map((note) => (
                  <li key={note}>{note}</li>
                ))}
            </ul>
          </section>
        )}
      </aside>
    </section>
  )
}
