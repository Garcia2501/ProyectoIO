import { useState } from 'react'
import type { Thresholds } from '../simulation3d/visualClock'
import { DEFAULT_THRESHOLDS, LAYER_LABELS, legendItems } from './layers'
import type { LayerState } from './layers'

export function LayerPanel({
  layers,
  onChange,
}: {
  layers: LayerState
  onChange: (layers: LayerState) => void
}) {
  return (
    <fieldset className="huachi-layers">
      <legend>Capas</legend>
      {(Object.keys(LAYER_LABELS) as (keyof LayerState)[]).map((key) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={layers[key]}
            onChange={(e) => onChange({ ...layers, [key]: e.target.checked })}
          />
          {LAYER_LABELS[key]}
        </label>
      ))}
    </fieldset>
  )
}

/** Leyenda de utilización con umbrales ordenados y editables. */
export function Legend({
  thresholds,
  onChange,
}: {
  thresholds: Thresholds
  onChange: (thresholds: Thresholds) => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="huachi-legend" role="group" aria-label="Leyenda">
      <h3>Utilización = flujo / capacidad</h3>
      <ul>
        {legendItems(thresholds).map((item) => (
          <li key={item.cls}>
            <i style={{ background: item.color }} />
            <b>{item.label}</b>
            <span>{item.range}</span>
          </li>
        ))}
      </ul>
      <button
        className="text-button"
        aria-expanded={editing}
        onClick={() => setEditing((v) => !v)}
      >
        Ajustar umbrales
      </button>
      {editing && (
        <div className="huachi-thresholds">
          {thresholds.map((value, i) => {
            const min = i === 0 ? 1 : thresholds[i - 1] + 1
            const max = i === 2 ? 100 : thresholds[i + 1] - 1
            return (
              <label key={i}>
                Umbral {i + 1} (%)
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={value}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isInteger(n) && n >= min && n <= max)
                      onChange(
                        thresholds.map((x, j) =>
                          j === i ? n : x,
                        ) as Thresholds,
                      )
                  }}
                />
              </label>
            )
          })}
          <button
            className="text-button"
            onClick={() => onChange(DEFAULT_THRESHOLDS)}
          >
            Restablecer umbrales
          </button>
        </div>
      )}
      <p className="help">
        Colores del modelo, no niveles medidos de congestión.
      </p>
    </div>
  )
}
