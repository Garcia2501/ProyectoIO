import { Analysis } from './Analysis'
import { Metrics } from '../../components/Metrics'
import { Icon } from '../../components/Icon'
import type { Workspace } from '../scenarios/useWorkspace'
export function ResultsView({ w }: { w: Workspace }) {
  const result = w.results[w.active]
  const download = () => {
    if (!result) return
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              scenario: w.scenario,
              result: result.data,
              source: result.demo ? 'demonstration' : 'api',
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'smartflow-' + w.scenario.scenario_name + '.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <section className="results-view">
      <div className="experience-heading">
        <div>
          <p className="eyebrow">SMARTFLOW / RESULTADOS</p>
          <h1>De la red a las decisiones.</h1>
          <p className="experience-description">
            Resultados verificables, sin perder de vista el modelo.
          </p>
        </div>
        <button disabled={!result} onClick={download}>
          <Icon name="download" size={17} />
          Exportar resultado JSON
        </button>
      </div>
      <Metrics scenario={w.scenario} result={result} />
      <Analysis scenario={w.scenario} result={result} />
      <section className="panel result-table">
        <div className="section-heading">
          <h2>
            <Icon name="road" />
            Detalle por tramo
          </h2>
          <span className="source-tag">
            {result
              ? result.demo
                ? 'Demostración identificada'
                : 'Respuesta de la API'
              : 'Pendiente de optimización'}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vía</th>
                <th>Dirección</th>
                <th>Capacidad efectiva</th>
                <th>Costo unitario</th>
                <th>Flujo</th>
                <th>Utilización</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {w.scenario.roads.map((r) => {
                const rr =
                  result?.data.status === 'optimal'
                    ? result.data.roads.find((x) => x.id === r.id)
                    : undefined
                return (
                  <tr key={r.id}>
                    <th>{r.id}</th>
                    <td>
                      {r.source} → {r.target}
                    </td>
                    <td>{r.enabled ? r.capacity : 0}</td>
                    <td>{r.unit_cost}</td>
                    <td>{rr?.flow ?? '—'}</td>
                    <td>
                      {rr?.utilization_pct != null
                        ? rr.utilization_pct + ' %'
                        : '—'}
                    </td>
                    <td>
                      <span className={'badge ' + (!r.enabled ? 'closed' : '')}>
                        {r.enabled ? 'Operativa' : 'Cerrada'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="help">
          Flujos y capacidades en vehículos por intervalo. Costos en unidades
          abstractas por vehículo. No se suman flujos de tramos para contar
          vehículos únicos.
        </p>
      </section>
      <div className="result-actions">
        <button onClick={() => w.setView('comparison')}>
          <Icon name="layers" />
          Comparar escenarios
        </button>
        <button onClick={() => w.setView('map')}>
          <Icon name="map" />
          Ver en el mapa de Huachi
        </button>
      </div>
    </section>
  )
}
