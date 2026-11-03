import type {
  CameraPreset,
  Quality,
  Thresholds,
  VisualClock,
} from './visualClock'
import type { CameraBus } from './CameraBus'
import type { Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
import type { Selection } from '../scenarios/useWorkspace'
export interface PerformanceSample {
  fps: number
  calls: number
  triangles: number
  vehicles: number
  buildings: number
}
export interface SceneProps {
  scenario: Scenario
  result: StoredResult | null
  selection: Selection
  onSelect: (s: Selection) => void
  clock: VisualClock
  quality: Quality
  camera: CameraPreset
  focusTick: number
  zoom?: number
  dusk: boolean
  utilization: boolean
  thresholds: Thresholds
  reduced: boolean
  bus?: CameraBus
  onMeasure?: (sample: PerformanceSample) => void
  onLost?: () => void
}
