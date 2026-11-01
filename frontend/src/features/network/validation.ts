import type { Scenario } from '../../types/network'
export function validateNetwork(s: Scenario): string[] {
  const errors: string[] = []
  if (!s.nodes.length) errors.push('Agrega al menos un nodo.')
  if (!s.roads.length) errors.push('Agrega al menos una vía.')
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
      !Number.isInteger(n.balance) ||
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
      !Number.isInteger(r.capacity) ||
      r.capacity < 0 ||
      !Number.isInteger(r.unit_cost) ||
      r.unit_cost < 0
    )
      errors.push(
        'Vía ' + r.id + ': capacidad y costo deben ser enteros no negativos.',
      )
  }
  return errors
}
