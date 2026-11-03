export interface NetworkNode {
  id: string
  label: string
  x: number
  y: number
  balance: number
}
export interface Road {
  id: string
  source: string
  target: string
  capacity: number
  unit_cost: number
  enabled: boolean
}
export interface Scenario {
  scenario_name: string
  nodes: NetworkNode[]
  roads: Road[]
}
