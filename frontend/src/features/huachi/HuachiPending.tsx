import { Icon } from '../../components/Icon'
import { OPTIONAL_FILES, REQUIRED_FILES } from './data'
import type { HuachiData } from './data'

/** Estado mostrado mientras el dataset cartográfico no esté disponible. */
export function HuachiPending({
  data,
}: {
  data: Exclude<HuachiData, { status: 'ready' }>
}) {
  const invalid = data.status === 'invalid'
  return (
    <section
      className="huachi-pending glass"
      role="status"
      aria-labelledby="huachi-pending-title"
    >
      <span className="scene-icon">
        <Icon name={invalid ? 'info' : 'map'} size={30} />
      </span>
      <div>
        <p className="eyebrow">SMARTFLOW / MAPA HUACHI</p>
        <h1 id="huachi-pending-title">
          {invalid
            ? 'El dataset cartográfico no es válido'
            : 'Datos cartográficos pendientes'}
        </h1>
        {invalid ? (
          <>
            <p>
              Se encontraron archivos en <code>data/geography/</code>, pero no
              se pudo construir la red. No se dibuja ninguna geometría
              parcial.
            </p>
            <ul className="huachi-errors">
              {data.errors.slice(0, 12).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p>
              El mapa mostrará las calles reales alrededor del campus Huachi
              cuando el equipo GIS publique el dataset verificado. Hasta
              entonces no se dibujan calles ni se usan geometrías inventadas.
            </p>
            <p>
              Archivos esperados en <code>data/geography/</code>:
            </p>
            <ul>
              {REQUIRED_FILES.map((name) => (
                <li key={name}>
                  <code>{name}</code> · obligatorio
                </li>
              ))}
              {OPTIONAL_FILES.map((name) => (
                <li key={name}>
                  <code>{name}</code> · opcional
                  {name === 'huachi_scenario_seed.json'
                    ? ' (supuestos experimentales de oferta, capacidad y costo)'
                    : ''}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="help">
          El laboratorio matemático y la comparación siguen disponibles con
          la red de referencia.
        </p>
      </div>
    </section>
  )
}
