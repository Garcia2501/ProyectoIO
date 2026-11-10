import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import type { Workspace, View } from '../features/scenarios/useWorkspace'
import { Icon } from './Icon'
const sections: { view: View; label: string; name: string; icon: string }[] = [
  { view: 'map', label: 'Mapa Huachi', name: 'Mapa Huachi', icon: 'map' },
  {
    view: 'main',
    label: 'Laboratorio',
    name: 'Red y análisis',
    icon: 'network',
  },
  {
    view: 'comparison',
    label: 'Comparar',
    name: 'Comparar escenarios',
    icon: 'layers',
  },
  { view: 'editor', label: 'Editar red', name: 'Editar red', icon: 'edit' },
  { view: 'results', label: 'Resultados', name: 'Resultados', icon: 'chart' },
]
export function Header({ w }: { w: Workspace }) {
  const reduced = useReducedMotion()
  return (
    <header className="premium-header">
      <a
        href="#main"
        className="brand"
        onClick={() => w.setView('main')}
        aria-label="SmartFlow · Laboratorio"
      >
        <span className="brand-symbol">
          <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path
              d="M3 26C12 8 22 31 36 11M3 17C16 0 23 22 36 3"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span>
          SmartFlow<small>Laboratorio de optimización urbana</small>
        </span>
      </a>
      <LayoutGroup id="navigation">
        <nav
          className="premium-nav"
          aria-label="Vistas de SmartFlow"
          onKeyDown={(e) => {
            if (
              e.ctrlKey ||
              e.metaKey ||
              e.altKey ||
              !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)
            )
              return
            e.preventDefault()
            const buttons = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
            )
            const index = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            )
            const next =
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? buttons.length - 1
                  : (index +
                      (e.key === 'ArrowRight' ? 1 : -1) +
                      buttons.length) %
                    buttons.length
            buttons[next]?.focus()
          }}
        >
          {sections.map((s) => (
            <button
              key={s.view}
              aria-label={s.name}
              aria-current={w.view === s.view ? 'page' : undefined}
              onClick={() => w.setView(s.view)}
              className={w.view === s.view ? 'selected' : ''}
            >
              {w.view === s.view && (
                <motion.span
                  className="nav-indicator"
                  layoutId="active-section"
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 400, damping: 35 }
                  }
                />
              )}
              <Icon name={s.icon} size={18} />
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
      </LayoutGroup>
      <button
        className={'primary optimize-button ' + (w.loading ? 'is-loading' : '')}
        onClick={() => void w.run()}
        disabled={w.loading}
      >
        <Icon name={w.loading ? 'activity' : 'sparkles'} size={18} />
        {w.loading ? 'Optimizando…' : 'Optimizar red'}
      </button>
    </header>
  )
}
