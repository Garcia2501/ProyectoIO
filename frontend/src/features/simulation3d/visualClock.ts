export class VisualClock {
  readonly duration = 120
  private base = 0
  private anchor = performance.now()
  private running = true
  private rate = 1
  private listeners = new Set<() => void>()
  time(now = performance.now()) {
    return Math.min(
      this.duration,
      this.base + (this.running ? ((now - this.anchor) / 1000) * this.rate : 0),
    )
  }
  snapshot() {
    return {
      time: this.time(),
      playing: this.running && this.time() < this.duration,
      speed: this.rate,
    }
  }
  private emit() {
    for (const listener of this.listeners) listener()
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  seek(time: number) {
    this.base = Math.max(0, Math.min(this.duration, time))
    this.anchor = performance.now()
    this.emit()
  }
  pause() {
    this.base = this.time()
    this.running = false
    this.emit()
  }
  play() {
    if (this.time() >= this.duration) this.base = 0
    else this.base = this.time()
    this.anchor = performance.now()
    this.running = true
    this.emit()
  }
  restart() {
    this.base = 0
    this.anchor = performance.now()
    this.emit()
  }
  speed(value: number) {
    if (![0.5, 1, 2, 4].includes(value)) return
    this.base = this.time()
    this.anchor = performance.now()
    this.rate = value
    this.emit()
  }
}
export const QUALITY = {
  low: { buildings: 65, trees: 45, vehicles: 48, dpr: 1, shadows: false },
  medium: { buildings: 145, trees: 95, vehicles: 120, dpr: 1.3, shadows: true },
  high: { buildings: 240, trees: 160, vehicles: 240, dpr: 1.75, shadows: true },
} as const
export type Quality = keyof typeof QUALITY
export type CameraPreset =
  | 'isometric'
  | 'aerial'
  | 'intersection'
  | 'corridor'
  | 'overview'
export const CAMERA_LABELS: Record<CameraPreset, string> = {
  isometric: 'Isométrica',
  aerial: 'Aérea',
  intersection: 'Intersección',
  corridor: 'Corredor',
  overview: 'Ciudad completa',
}
export type Thresholds = [number, number, number]
export function utilizationColor(
  value: number | null,
  enabled: boolean,
  limits: Thresholds = [60, 80, 95],
) {
  if (!enabled) return '#87939d'
  if (value === null) return '#72bdd3'
  return value < limits[0]
    ? '#32d19a'
    : value < limits[1]
      ? '#e8d75c'
      : value < limits[2]
        ? '#f1a457'
        : '#f06c7e'
}
