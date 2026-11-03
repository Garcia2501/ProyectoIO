import type { Scenario } from '../../types/network'
export function validateNetwork(s: Scenario): string[] {
  const errors: string[] = []
  if (!s.scenario_name.trim()) errors.push('El escenario debe tener nombre.')
  if (s.nodes.length < 2) errors.push('Agrega al menos dos nodos.')
  if (
    !Number.isSafeInteger(
      s.nodes.reduce((sum, n) => sum + Math.max(0, n.balance), 0),
    )
  )
    errors.push(
      'La oferta total supera la precisión entera soportada por el navegador.',
    )
  if (s.nodes.reduce((sum, n) => sum + n.balance, 0) !== 0)
    errors.push('La suma de balances debe ser cero.')
  if (
    new Set(s.nodes.map((n) => n.id)).size !== s.nodes.length ||
    new Set(s.roads.map((r) => r.id)).size !== s.roads.length
  )
    errors.push('Los identificadores deben ser únicos.')
  for (const n of s.nodes)
    if (
      !n.id.trim() ||
      !n.label.trim() ||
      !Number.isSafeInteger(n.balance) ||
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y)
    )
      errors.push('Nodo ' + n.id + ': revisa nombre, balance y coordenadas.')
  for (const r of s.roads) {
    if (
      !r.id.trim() ||
      !s.nodes.some((n) => n.id === r.source) ||
      !s.nodes.some((n) => n.id === r.target)
    )
      errors.push('Vía ' + r.id + ': referencias inválidas.')
    if (
      !Number.isSafeInteger(r.capacity) ||
      r.capacity < 0 ||
      !Number.isSafeInteger(r.unit_cost) ||
      r.unit_cost < 0
    )
      errors.push(
        'Vía ' +
          r.id +
          ': capacidad y costo deben ser enteros no negativos representables exactamente.',
      )
  }
  return errors
}
