/** Sincroniza centro y zoom entre varios mapas (comparación de escenarios). */
export interface MapView {
  lat: number
  lng: number
  zoom: number
}

export class MapSync {
  private listeners = new Map<string, (view: MapView) => void>()
  private last: MapView | null = null
  subscribe(id: string, listener: (view: MapView) => void) {
    this.listeners.set(id, listener)
    if (this.last) listener(this.last)
    return () => {
      this.listeners.delete(id)
    }
  }
  publish(from: string, view: MapView) {
    const same =
      this.last &&
      Math.abs(this.last.lat - view.lat) < 1e-7 &&
      Math.abs(this.last.lng - view.lng) < 1e-7 &&
      this.last.zoom === view.zoom
    if (same) return
    this.last = view
    for (const [id, listener] of this.listeners)
      if (id !== from) listener(view)
  }
}
