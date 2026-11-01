import { Icon } from './Icon'
import type { Scenario } from '../types/network'
import type { StoredResult } from '../types/results'
export function Metrics({
  scenario,
  result,
}: {
  scenario: Scenario
  result: StoredResult | null
}) {
  const items = [
    [
      'network',
      'Nodos de la red',
      String(scenario.nodes.length).padStart(2, '0'),
      'zonas conectadas',
    ],
    [
      'road',
      'Vías dirigidas',
      String(scenario.roads.length).padStart(2, '0'),
      'tramos · ' +
        scenario.roads.filter((r) => r.enabled).length +
        ' habilitados',
    ],
    [
      'layers',
      'Oferta total',
      scenario.nodes.reduce((s, n) => s + Math.max(0, n.balance), 0),
      'vehículos / intervalo',
    ],
    [
      'activity',
      'Estado de optimización',
      result
        ? result.data.status === 'optimal'
          ? 'Óptima'
          : 'Infactible'
        : 'Pendiente',
      result?.demo ? 'Datos de demostración' : 'Resultado del optimizador',
    ],
    [
      'cost',
      'Costo total',
      result?.data.total_cost ?? '—',
      'unidades abstractas de costo',
    ],
  ]
  return (
    <section className="metrics" aria-label="Resumen del escenario">
      {items.map(([icon, label, value, sub]) => (
        <article className="metric panel" key={label}>
          <Icon name={String(icon)} size={25} />
          <div>
            <span>{label}</span>
            <strong className={icon === 'activity' ? 'status-value' : ''}>
              {value}
            </strong>
            <small>{sub}</small>
          </div>
        </article>
      ))}
    </section>
  )
}
