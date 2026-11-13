/** Máximo de símbolos por tramo y en total para conservar los FPS. */
export const MAX_PER_ROAD = 12
export const MAX_TOTAL = 240
/** Velocidad VISUAL uniforme; no es una velocidad vial ni una predicción. */
export const VISUAL_SPEED_MPS = 30
export const MIN_PERIOD_S = 4

/**
 * Número de símbolos de un tramo: escala visual del flujo respecto al tramo
 * de mayor flujo. No son vehículos individuales rastreados.
 */
export function symbolCounts(flows: number[]): number[] {
  const maxFlow = Math.max(0, ...flows)
  const counts = flows.map((flow) =>
    flow <= 0 || maxFlow <= 0
      ? 0
      : Math.max(1, Math.round((flow / maxFlow) * MAX_PER_ROAD)),
  )
  const total = counts.reduce((s, n) => s + n, 0)
  if (total <= MAX_TOTAL) return counts
  const k = MAX_TOTAL / total
  return counts.map((n) => (n ? Math.max(1, Math.floor(n * k)) : 0))
}

/** Posición relativa (0..1) de un símbolo; avanza en el sentido del arco. */
export function symbolFraction(
  time: number,
  periodSeconds: number,
  index: number,
  count: number,
) {
  const f = (time / periodSeconds + index / count) % 1
  return f < 0 ? f + 1 : f
}
