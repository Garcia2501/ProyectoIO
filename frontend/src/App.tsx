import { useState } from 'react'
import { MotionConfig, motion, useReducedMotion } from 'motion/react'
import { UrbanCanvas } from './features/simulation/UrbanCanvas'
import { ResultsView } from './features/results/ResultsView'
import './premium.css'
import { Header } from './components/Header'
import { Icon } from './components/Icon'
import { Inspector } from './components/Inspector'
import { Metrics } from './components/Metrics'
import { NetworkCanvas } from './features/network/NetworkCanvas'
import { validateNetwork } from './features/network/validation'
import { Analysis } from './features/results/Analysis'
import { Comparison } from './features/scenarios/Comparison'
import { useWorkspace } from './features/scenarios/useWorkspace'
export default function App() {
  const w = useWorkspace()
  const reduced = useReducedMotion()
  const [urban, setUrban] = useState(false)
  const [playback, setPlayback] = useState({ playing: true, speed: 1 })
  const [snap, setSnap] = useState(true),
    [grid, setGrid] = useState(false),
    [deleting, setDeleting] = useState(false)
  const [validationShown, setValidationShown] = useState(false)
  const errors = validateNetwork(w.scenario)
  const addNode = () => {
    let id = 'N' + (w.scenario.nodes.length + 1)
    while (w.scenario.nodes.some((n) => n.id === id)) id += 'n'
    w.update({
      ...w.scenario,
      nodes: [
        ...w.scenario.nodes,
        {
          id,
          label: 'Nueva zona',
          balance: 0,
          x: 180 + w.scenario.nodes.length * 30,
          y: 300,
        },
      ],
    })
    w.setSelection({ type: 'node', id })
  }
  const remove = () => {
    const sel = w.selection
    if (!sel) return
    w.update({
      ...w.scenario,
      nodes:
        sel.type === 'node'
          ? w.scenario.nodes.filter((n) => n.id !== sel.id)
          : w.scenario.nodes,
      roads: w.scenario.roads.filter((r) =>
        sel.type === 'road'
          ? r.id !== sel.id
          : r.source !== sel.id && r.target !== sel.id,
      ),
    })
    w.setSelection(null)
    setDeleting(false)
  }
  return (
    <MotionConfig reducedMotion="user">
      <Header w={w} />
      <motion.main
        id="main"
        className={'workspace view-' + w.view}
        key={w.view}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22 }}
      >
        <section className="workspace-bar" aria-label="Controles del escenario">
          <label className="workspace-scenario">
            <Icon name="layers" size={18} />
            <span>Escenario</span>
            <select
              aria-label="Escenario"
              value={w.active}
              onChange={(e) => w.selectScenario(Number(e.target.value))}
            >
              <option value={0}>Escenario base</option>
              <option value={1}>Cierre de vía</option>
            </select>
          </label>
          <span className="session-indicator">
            <i className="dot green" />
            Sesión en memoria
          </span>
          <button className="quiet-button" onClick={w.demo}>
            <Icon name="play" size={15} />
            Cargar demostración
          </button>
          <button
            className="quiet-button"
            onClick={() => w.setMessage('CONFIRM_RESET')}
          >
            <Icon name="reset" size={16} />
            Restablecer
          </button>
        </section>
        {w.message && w.message !== 'CONFIRM_RESET' && (
          <div className="notice" role="status">
            <Icon name="info" />
            <span>{w.message}</span>
            <button aria-label="Cerrar aviso" onClick={() => w.setMessage('')}>
              <Icon name="close" size={15} />
            </button>
          </div>
        )}
        {w.results.some((r) => r?.demo) && (
          <div className="demo-banner">
            DEMOSTRACIÓN · Resultados estáticos etiquetados. No se ha ejecutado
            el optimizador del servidor.
          </div>
        )}
        {w.view === 'results' ? (
          <ResultsView w={w} />
        ) : w.view === 'comparison' ? (
          <Comparison w={w} />
        ) : (
          <>
            {w.view === 'main' || w.view === 'simulation' ? (
              <>
                <div className="experience-heading">
                  <div>
                    <p className="eyebrow">
                      SMARTFLOW /{' '}
                      {w.view === 'simulation'
                        ? 'CIUDAD VIRTUAL'
                        : 'LABORATORIO'}
                    </p>
                    <h1>Laboratorio de optimización de flujo vial</h1>
                    <p className="experience-description">
                      {w.view === 'simulation'
                        ? 'Una ciudad, las mismas decisiones. Explora el flujo de tu red.'
                        : 'Cada conexión cuenta. Explora tu red desde una nueva perspectiva.'}
                    </p>
                  </div>
                  <div
                    className="representation-switch"
                    role="group"
                    aria-label="Representación de la red"
                  >
                    <button
                      aria-pressed={w.view === 'main' && !urban}
                      onClick={() => {
                        setUrban(false)
                        w.setView('main')
                      }}
                    >
                      <Icon name="network" size={16} />
                      Vista matemática
                    </button>
                    <button
                      aria-pressed={w.view === 'simulation' || urban}
                      onClick={() => setUrban(true)}
                    >
                      <Icon name="city" size={17} />
                      Vista urbana
                    </button>
                  </div>
                </div>
                <Metrics scenario={w.scenario} result={w.results[w.active]} />
              </>
            ) : (
              <section className="editor-heading">
                <div className="editor-title">
                  <Icon name="network" size={32} />
                  <div>
                    <h1>Editar red</h1>
                    <p>Diseña, modifica y valida la red vial del escenario.</p>
                  </div>
                </div>
                <div className="mini-stat">
                  <Icon name="network" />
                  <span>
                    Nodos totales
                    <strong>
                      {String(w.scenario.nodes.length).padStart(2, '0')}
                    </strong>
                  </span>
                </div>
                <div className="mini-stat">
                  <Icon name="road" />
                  <span>
                    Vías totales
                    <strong>
                      {String(w.scenario.roads.length).padStart(2, '0')}
                    </strong>
                  </span>
                </div>
                <button onClick={addNode}>
                  <Icon name="plus" />
                  Agregar nodo
                </button>
                <button
                  disabled={w.scenario.nodes.length < 2}
                  onClick={() => w.setSelection({ type: 'road', id: 'new' })}
                >
                  <Icon name="road" />
                  Agregar vía
                </button>
                <label className="toggle">
                  <Icon name="grid" size={17} />
                  Ajuste (snap)
                  <input
                    type="checkbox"
                    checked={snap}
                    onChange={(e) => setSnap(e.target.checked)}
                  />
                </label>
                <label className="toggle">
                  Cuadrícula
                  <input
                    type="checkbox"
                    checked={grid}
                    onChange={(e) => setGrid(e.target.checked)}
                  />
                </label>
                <button
                  className="validate-button"
                  onClick={() => {
                    setValidationShown(true)
                    w.setMessage(
                      errors.length
                        ? errors.join(' ')
                        : 'Estructura válida. La factibilidad y la optimización deben verificarse con el backend.',
                    )
                  }}
                >
                  <Icon name="check" />
                  Validar red
                </button>
              </section>
            )}
            <div
              className={
                'main-grid ' +
                (w.view === 'simulation' ? 'city-experience' : '')
              }
            >
              <div className="map-column">
                <section className="map-panel panel">
                  {w.view === 'editor' && (
                    <div className="map-toolbar">
                      <span className="tool-selected">
                        <Icon name="cursor" size={16} />
                        Seleccionar / mover
                      </span>
                      <button onClick={addNode}>
                        <Icon name="node" size={16} />
                        Nodo
                      </button>
                      <button
                        onClick={() =>
                          w.setSelection({ type: 'road', id: 'new' })
                        }
                        disabled={w.scenario.nodes.length < 2}
                      >
                        <Icon name="network" size={16} />
                        Vía
                      </button>
                      <span className="toolbar-tip">
                        Conecta los puntos de salida y entrada
                      </span>
                      <button
                        className="delete-tool"
                        disabled={!w.selection || w.selection.id === 'new'}
                        onClick={() => setDeleting(true)}
                      >
                        <Icon name="trash" size={16} />
                        Eliminar
                      </button>
                    </div>
                  )}
                  {w.view === 'simulation' || (w.view === 'main' && urban) ? (
                    <UrbanCanvas
                      key={w.active}
                      scenario={w.scenario}
                      result={w.results[w.active]}
                      selection={w.selection}
                      onSelect={w.setSelection}
                      playback={playback}
                      setPlayback={setPlayback}
                    />
                  ) : (
                    <NetworkCanvas
                      key={w.active + '-' + w.view}
                      scenario={w.scenario}
                      selection={w.selection}
                      onSelect={w.setSelection}
                      onChange={w.update}
                      onPositionsChange={w.moveNodes}
                      editing={w.view === 'editor'}
                      grid={grid}
                      snap={w.view === 'editor' && snap}
                      result={w.results[w.active]}
                    />
                  )}
                </section>
                {w.view === 'editor' && (
                  <section className="editor-bottom">
                    <article className="panel">
                      <h3>
                        <Icon name="edit" size={17} />
                        Herramientas de edición
                      </h3>
                      <div className="shortcuts">
                        <span>Arrastrar: mover nodo</span>
                        <span>Conectar: arrastrar entre puntos</span>
                        <span>Seleccionar: inspeccionar elemento</span>
                        <span>Guardar: aplicar propiedades</span>
                      </div>
                    </article>
                    <article className="panel">
                      <h3>
                        <Icon name="check" size={17} />
                        Validación de la red
                      </h3>
                      <div
                        className={
                          'callout ' + (errors.length ? 'warning' : '')
                        }
                      >
                        <Icon name={errors.length ? 'info' : 'check'} />
                        <div>
                          <strong>
                            {errors.length
                              ? 'Revisar estructura'
                              : 'Estructura válida'}
                          </strong>
                          <p>
                            {errors.length
                              ? validationShown
                                ? errors.join(' ')
                                : errors.length + ' observaciones pendientes.'
                              : 'Balances equilibrados y propiedades válidas. No implica factibilidad del flujo.'}
                          </p>
                        </div>
                      </div>
                    </article>
                    <article className="panel">
                      <h3>
                        <Icon name="layers" size={17} />
                        Resumen de la red
                      </h3>
                      <dl>
                        <div>
                          <dt>Nodos</dt>
                          <dd>{w.scenario.nodes.length}</dd>
                        </div>
                        <div>
                          <dt>Vías</dt>
                          <dd>{w.scenario.roads.length}</dd>
                        </div>
                        <div>
                          <dt>Capacidad efectiva total*</dt>
                          <dd>
                            {w.scenario.roads.reduce(
                              (s, r) => s + (r.enabled ? r.capacity : 0),
                              0,
                            )}
                          </dd>
                        </div>
                      </dl>
                      <small className="help">
                        *Suma de capacidades por tramo; no es flujo total.
                      </small>
                    </article>
                  </section>
                )}
              </div>
              <Inspector
                key={
                  w.active +
                  '-' +
                  w.view +
                  '-' +
                  w.selection?.type +
                  '-' +
                  w.selection?.id
                }
                w={w}
                onDelete={() => setDeleting(true)}
              />
            </div>
            {(w.view === 'main' || w.view === 'simulation') && (
              <Analysis scenario={w.scenario} result={w.results[w.active]} />
            )}
          </>
        )}
        <footer className="page-footer">
          <span>SmartFlow · Investigación Operativa</span>
          <span>
            Modelo ilustrativo · vehículos por intervalo · costos abstractos
          </span>
        </footer>
      </motion.main>
      {(deleting || w.message === 'CONFIRM_RESET') && (
        <div className="modal-backdrop">
          <section
            className="dialog panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setDeleting(false)
                if (w.message === 'CONFIRM_RESET') w.setMessage('')
              }
              if (event.key === 'Tab') {
                const buttons = event.currentTarget.querySelectorAll('button')
                const first = buttons[0]
                const last = buttons[buttons.length - 1]
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault()
                  last?.focus()
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault()
                  first?.focus()
                }
              }
            }}
          >
            <Icon name={deleting ? 'trash' : 'reset'} size={30} />
            <h2 id="confirm-title">
              {deleting
                ? '¿Eliminar ' +
                  (w.selection?.type === 'node' ? 'el nodo' : 'la vía') +
                  ' ' +
                  w.selection?.id +
                  '?'
                : '¿Restablecer este escenario?'}
            </h2>
            <p>
              {deleting
                ? 'Se eliminará de la sesión. Al eliminar un nodo también se eliminan sus conexiones.'
                : 'Se restaurará la red de referencia y se descartará su resultado actual.'}
            </p>
            <div>
              <button
                autoFocus
                onClick={() => {
                  setDeleting(false)
                  if (w.message === 'CONFIRM_RESET') w.setMessage('')
                }}
              >
                Cancelar
              </button>
              <button
                className={deleting ? 'danger' : 'primary'}
                onClick={deleting ? remove : w.reset}
              >
                {deleting ? 'Eliminar' : 'Restablecer'}
              </button>
            </div>
          </section>
        </div>
      )}
    </MotionConfig>
  )
}
