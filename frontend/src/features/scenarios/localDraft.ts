import type { Scenario } from '../../types/network'

export const DRAFT_KEY = 'smartflow.workspace.v1'
export function readDraft(): { scenarios: Scenario[]; active: number } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    if (saved?.version !== 1 || !Array.isArray(saved.scenarios) || saved.scenarios.length !== 2) return null
    for (const s of saved.scenarios) {
      if (typeof s.scenario_name !== 'string' || !Array.isArray(s.nodes) || !Array.isArray(s.roads)) return null
      if (!s.nodes.every((n: Scenario['nodes'][number]) => n && typeof n.id === 'string' && typeof n.label === 'string' && Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isSafeInteger(n.balance))) return null
      if (!s.roads.every((r: Scenario['roads'][number]) => r && typeof r.id === 'string' && typeof r.source === 'string' && typeof r.target === 'string' && typeof r.enabled === 'boolean' && Number.isSafeInteger(r.capacity) && Number.isSafeInteger(r.unit_cost))) return null
    }
    // Unbalanced drafts are intentional while editing. Results must be recalculated.
    return { scenarios: saved.scenarios, active: saved.active === 1 ? 1 : 0 }
  } catch { return null }
}
export function saveDraft(scenarios: Scenario[], active: number): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, scenarios, active }))
    return true
  } catch { return false }
}
