export interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
}
export class CameraBus {
  private listeners = new Map<string, (pose: CameraPose) => void>()
  latest: CameraPose | null = null
  publish(id: string, pose: CameraPose) {
    if (
      this.latest &&
      [...pose.position, ...pose.target].every(
        (v, i) =>
          Math.abs(v - [...this.latest!.position, ...this.latest!.target][i]) <
          0.001,
      )
    )
      return
    this.latest = pose
    for (const [key, listener] of this.listeners) if (key !== id) listener(pose)
  }
  subscribe(id: string, listener: (pose: CameraPose) => void) {
    this.listeners.set(id, listener)
    if (this.latest) listener(this.latest)
    return () => {
      this.listeners.delete(id)
    }
  }
}
