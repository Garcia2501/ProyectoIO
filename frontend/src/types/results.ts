export interface RoadResult {
  id: string
  flow: number
  capacity: number
  utilization_pct: number | null
}
export interface OptimizationResult {
  status: 'optimal' | 'infeasible'
  scenario_name: string
  total_cost: number | null
  total_supply: number
  roads: RoadResult[]
  message?: string
}
export interface StoredResult {
  data: OptimizationResult
  demo: boolean
}
