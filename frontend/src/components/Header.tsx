import type { Workspace } from '../features/scenarios/useWorkspace'
import { Icon } from './Icon'
export function Header({ w }: { w: Workspace }) {
  return (
    <>
      <header className="app-header">
        <a href="#main" className="brand" onClick={() => w.setView('main')}>
          <span className="brand-mark">↗</span>SmartFlow
        </a>
        <div className="brand-description">
          Laboratorio de optimización de flujo vial
          <small>SIMULACIÓN · ANÁLISIS · OPTIMIZACIÓN</small>
        </div>
        <label className="scenario-select">
          Escenario
          <select
            value={w.active}
            onChange={(e) => w.selectScenario(Number(e.target.value))}
          >
            <option value={0}>▱ Escenario base</option>
            <option value={1}>▱ Cierre de vía</option>
          </select>
        </label>
        <button
          className="primary"
          onClick={() => void w.run()}
          disabled={w.loading}
        >
          <Icon name="play" size={16} />
          {w.loading ? 'Optimizando…' : 'Optimizar red'}
        </button>
        <button
          className={w.view === 'editor' ? 'active' : ''}
          onClick={() => w.setView(w.view === 'editor' ? 'main' : 'editor')}
        >
          <Icon name="network" />{' '}
          {w.view === 'editor' ? 'Volver al análisis' : 'Editar red'}
        </button>
        <button onClick={() => w.setMessage('CONFIRM_RESET')}>
          <Icon name="reset" />
          Restablecer
        </button>
        <div className="skyline" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </header>
      <nav className="view-nav" aria-label="Vistas de SmartFlow">
        {(
          [
            ['main', 'Red y análisis'],
            ['comparison', 'Comparar escenarios'],
            ['editor', 'Editor de red'],
          ] as const
        ).map(([view, label]) => (
          <button
            key={view}
            className={w.view === view ? 'selected' : ''}
            onClick={() => w.setView(view)}
          >
            {label}
          </button>
        ))}
        <span>Sesión local · cambios en memoria</span>
        <button className="demo-link" onClick={w.demo}>
          Cargar demostración
        </button>
      </nav>
    </>
  )
}
