import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { Workspace } from '../scenarios/useWorkspace'
import { CityViewport } from './CityViewport'
import type { PerformanceSample } from './CityScene'
import { PlaybackControls } from './PlaybackControls'
import { RoadInspector } from './RoadInspector'
import { CAMERA_LABELS, VisualClock, utilizationColor } from './visualClock'
import type { CameraPreset, Quality, Thresholds } from './visualClock'
import { Icon } from '../../components/Icon'
export function MegaSimulation({ w }: { w: Workspace }) {
  const root = useRef<HTMLElement>(null)
  const reduced = !!useReducedMotion()
  const [clock] = useState(() => new VisualClock())
  const [quality, setQuality] = useState<Quality>('medium'),
    [camera, setCamera] = useState<CameraPreset>('isometric')
  const [focusTick, setFocusTick] = useState(0),
    [zoom, setZoom] = useState(1),
    [dusk, setDusk] = useState(false),
    [presentation, setPresentation] = useState(false),
    [secondary, setSecondary] = useState(true)
  const [utilization, setUtilization] = useState(true),
    [thresholds, setThresholds] = useState<Thresholds>([60, 80, 95]),
    [settings, setSettings] = useState(false),
    [sample, setSample] = useState<PerformanceSample | null>(null)
  useEffect(() => {
    if (reduced) clock.pause()
  }, [clock, reduced])
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresentation(false)
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  useEffect(() => {
    if (!presentation || !root.current) return
    const element = root.current
    const background = [
      ...Array.from(element.parentElement?.children ?? []),
      document.querySelector('.premium-header'),
    ].filter(
      (item): item is HTMLElement =>
        item instanceof HTMLElement && item !== element,
    )
    const previous = background.map((el) => ({ el, inert: el.inert }))
    background.forEach((el) => {
      el.inert = true
    })
    element.focus()
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const controls = Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not([disabled]),select,input,a[href]',
        ),
      ).filter((el) => el.offsetParent !== null)
      const first = controls[0],
        last = controls[controls.length - 1]
      if (
        !element.contains(document.activeElement) ||
        document.activeElement === element
      ) {
        e.preventDefault()
        ;(e.shiftKey ? last : first)?.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener('keydown', trap)
    return () => {
      previous.forEach(({ el, inert }) => {
        el.inert = inert
      })
      window.removeEventListener('keydown', trap)
      if (element.isConnected)
        element
          .querySelector<HTMLElement>('[data-presentation-toggle]')
          ?.focus()
    }
  }, [presentation])
  const stored = w.results[w.active],
    data = stored?.data
  const flows = data?.status === 'optimal' ? data.roads : []
  const valid = flows.filter((r) => r.utilization_pct !== null)
  const mean = valid.length
    ? valid.reduce((s, r) => s + r.utilization_pct!, 0) / valid.length
    : null
  const closeRoad = () => {
    const sel = w.selection
    if (sel?.type !== 'road') return
    const next = {
      ...w.scenario,
      roads: w.scenario.roads.map((r) =>
        r.id === sel.id ? { ...r, enabled: !r.enabled } : r,
      ),
    }
    w.update(next)
    void w.run(next)
  }
  const focus = () => {
    setCamera(w.selection?.type === 'node' ? 'intersection' : 'corridor')
    setFocusTick((v) => v + 1)
  }
  return (
    <section
      ref={root}
      tabIndex={-1}
      className={
        'mega-experience ' +
        (presentation ? 'mega-presentation ' : '') +
        (dusk ? 'mega-dusk ' : '') +
        (w.selection ? 'has-selection' : '')
      }
      aria-label="Centro de simulación 3D"
    >
      <div className="mega-scene">
        <CityViewport
          scenario={w.scenario}
          result={stored}
          selection={w.selection}
          onSelect={w.setSelection}
          clock={clock}
          quality={quality}
          camera={camera}
          focusTick={focusTick}
          zoom={zoom}
          dusk={dusk}
          utilization={utilization}
          thresholds={thresholds}
          reduced={reduced}
          onMeasure={setSample}
        />
        {typeof window.WebGL2RenderingContext !== 'undefined' &&
        (!data || data.status === 'infeasible') ? (
          <div className="scene-data-state glass" role="status">
            {data
              ? 'Sin flujo factible. No hay vehículos que representar.'
              : 'Optimiza la red o carga la demostración para visualizar vehículos.'}
          </div>
        ) : null}
        <div className="scene-title glass">
          <span className="scene-icon">
            <Icon name="city" size={25} />
          </span>
          <div>
            <p className="eyebrow">SMARTFLOW / CIUDAD VIRTUAL</p>
            <h1>{w.scenario.scenario_name}</h1>
            <small>
              {w.scenario.nodes.length} intersecciones ·{' '}
              {w.scenario.roads.length} vías ·{' '}
              {stored?.demo
                ? 'DEMOSTRACIÓN'
                : data
                  ? 'Solución del servidor'
                  : 'Sin optimización'}
            </small>
          </div>
        </div>
        <div className="scene-top-actions">
          <button
            className="glass"
            data-presentation-toggle
            onClick={() => {
              setPresentation((v) => !v)
              if (!presentation) {
                setDusk(true)
                setSecondary(window.innerWidth > 760)
              }
            }}
          >
            {presentation ? 'Salir de presentación' : 'Modo presentación'}
          </button>
          {presentation && (
            <button className="glass" onClick={() => setSecondary((v) => !v)}>
              {secondary ? 'Ocultar paneles' : 'Mostrar paneles'}
            </button>
          )}
        </div>
        <div
          className="camera-rail glass"
          role="group"
          aria-label="Cámaras de la ciudad"
        >
          <label>
            Cámara
            <select
              aria-label="Perspectiva de cámara"
              value={camera}
              onChange={(e) => setCamera(e.target.value as CameraPreset)}
            >
              {Object.entries(CAMERA_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label="Acercar cámara"
            onClick={() => setZoom((v) => Math.min(3, v * 1.2))}
          >
            +
          </button>
          <button
            aria-label="Alejar cámara"
            onClick={() => setZoom((v) => Math.max(0.5, v / 1.2))}
          >
            −
          </button>
          <button
            aria-label="Cámara inicial"
            onClick={() => {
              setCamera('isometric')
              setZoom(1)
              setFocusTick((v) => v + 1)
            }}
          >
            ⌖
          </button>
        </div>
        {(!presentation || secondary) && (
          <div className="scene-layers glass">
            <label>
              <input
                type="checkbox"
                checked={utilization}
                onChange={(e) => setUtilization(e.target.checked)}
              />
              Utilización de capacidad
            </label>
            <div className="utilization-legend">
              {[0, thresholds[0], thresholds[1], thresholds[2]].map((v, i) => (
                <span key={i}>
                  <i
                    style={{
                      background: utilizationColor(v, true, thresholds),
                    }}
                  />
                  {i === 0
                    ? `< ${thresholds[0]}`
                    : i === 3
                      ? `≥ ${v}`
                      : `${v}–${thresholds[i]}`}{' '}
                  %
                </span>
              ))}
              <span>
                <i style={{ background: '#87939d' }} />
                Cerrada
              </span>
            </div>
            <button
              className="text-button"
              onClick={() => setSettings((v) => !v)}
              aria-expanded={settings}
            >
              Ajustar escena y umbrales
            </button>
            {settings && (
              <div className="scene-settings">
                <label>
                  Calidad
                  <select
                    aria-label="Calidad gráfica"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as Quality)}
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={dusk}
                    onChange={(e) => setDusk(e.target.checked)}
                  />
                  Atardecer
                </label>
                {thresholds.map((v, i) => (
                  <label key={i}>
                    Umbral {i + 1} (%)
                    <input
                      type="number"
                      min={i === 0 ? 1 : thresholds[i - 1] + 1}
                      max={i === 2 ? 100 : thresholds[i + 1] - 1}
                      value={v}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (
                          Number.isFinite(n) &&
                          n >= (i === 0 ? 1 : thresholds[i - 1] + 1) &&
                          n <= (i === 2 ? 100 : thresholds[i + 1] - 1)
                        )
                          setThresholds(
                            (t) =>
                              t.map((x, j) => (j === i ? n : x)) as Thresholds,
                          )
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <PlaybackControls clock={clock} />
        <div className="scene-footnote">
          Ciudad esquemática sin escala geográfica · vehículos escalados al
          flujo por tramo
        </div>
      </div>
      {(!presentation || secondary) && (
        <aside className="mega-side">
          <section className="glass scenario-control">
            <div className="mega-section-title">
              <Icon name="layers" />
              <h2>Escenario</h2>
              <span className="status-pill">EN MEMORIA</span>
            </div>
            <label>
              <span className="sr-only">Escenario de simulación</span>
              <select
                aria-label="Escenario de simulación"
                value={w.active}
                onChange={(e) => w.selectScenario(Number(e.target.value))}
              >
                {w.scenarios.map((s, i) => (
                  <option key={i} value={i}>
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
              <button onClick={() => w.setView('editor')}>
                <Icon name="edit" size={18} />
                Editar red
              </button>
            </div>
            <button className="text-button metro-load" onClick={w.metroDemo}>
              Explorar red metropolitana DEMO ↗
            </button>
          </section>
          <section className="glass mega-indicators">
            <div className="mega-section-title">
              <Icon name="activity" />
              <h2>Indicadores del escenario</h2>
            </div>
            <div className="indicator-grid">
              <div>
                <small>Oferta requerida</small>
                <strong>
                  {w.scenario.nodes.reduce(
                    (s, n) => s + Math.max(0, n.balance),
                    0,
                  )}
                  <em>veh./intervalo</em>
                </strong>
              </div>
              <div>
                <small>Utilización media*</small>
                <strong>{mean === null ? '—' : mean.toFixed(1) + ' %'}</strong>
              </div>
              <div>
                <small>Factibilidad</small>
                <strong
                  className={data?.status === 'infeasible' ? 'text-danger' : ''}
                >
                  {data
                    ? data.status === 'optimal'
                      ? 'Factible'
                      : 'Infactible'
                    : 'Pendiente'}
                </strong>
              </div>
              <div>
                <small>Costo total</small>
                <strong>
                  {data?.total_cost ?? '—'}
                  <em>unidades</em>
                </strong>
              </div>
            </div>
            <p className="help">
              *Media simple de vías con capacidad efectiva positiva.{' '}
              {data?.status === 'infeasible'
                ? data.message
                : 'No representa congestión ni velocidad física.'}
            </p>
          </section>
          <RoadInspector w={w} onFocus={focus} onCloseRoad={closeRoad} />
          <div className="scene-performance" role="status">
            {sample
              ? `${sample.fps} FPS · ${sample.calls} draw calls · ${sample.vehicles} vehículos · ${sample.buildings} edificios`
              : 'Rendimiento: esperando escena 3D'}
            <small>
              Medición de esta sesión · calidad{' '}
              {quality === 'low'
                ? 'baja'
                : quality === 'high'
                  ? 'alta'
                  : 'media'}
            </small>
          </div>
        </aside>
      )}
      {presentation && w.message && !w.message.startsWith('DEMOSTRACIÓN') && (
        <div className="presentation-notice glass" role="status">
          {w.message}
          <button
            aria-label="Cerrar aviso de presentación"
            onClick={() => w.setMessage('')}
          >
            ×
          </button>
        </div>
      )}
    </section>
  )
}
