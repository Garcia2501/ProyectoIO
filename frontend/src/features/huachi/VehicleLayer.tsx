import { useEffect } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import { pathSampler } from './geo'
import type { RoadStatus } from './layers'
import {
  MIN_PERIOD_S,
  VISUAL_SPEED_MPS,
  symbolCounts,
  symbolFraction,
} from './animation'
import type { VisualClock } from '../simulation3d/visualClock'

interface Props {
  statuses: RoadStatus[]
  clock: VisualClock
  reduced: boolean
}

/**
 * Símbolos de movimiento sobre las LineString reales. Se actualizan con
 * requestAnimationFrame directamente sobre Leaflet, sin renderizar React.
 */
export function VehicleLayer({ statuses, clock, reduced }: Props) {
  const map = useMap()
  useEffect(() => {
    const flowing = statuses.filter((s) => s.flow > 0)
    const counts = symbolCounts(flowing.map((s) => s.flow))
    const group = L.layerGroup().addTo(map)
    const items = flowing.flatMap((status, r) => {
      const sampler = pathSampler(status.geo.coordinates)
      const period = Math.max(MIN_PERIOD_S, sampler.total / VISUAL_SPEED_MPS)
      return Array.from({ length: counts[r] }, (_, i) => ({
        marker: L.circleMarker(sampler.at(i / counts[r]), {
          radius: 4,
          color: '#ffffff',
          weight: 1.5,
          fillColor: '#16324f',
          fillOpacity: 0.95,
          interactive: false,
          className: 'huachi-vehicle',
        }).addTo(group),
        sampler,
        period,
        i,
        n: counts[r],
      }))
    })
    const paint = () => {
      const t = clock.time()
      for (const item of items)
        item.marker.setLatLng(
          item.sampler.at(symbolFraction(t, item.period, item.i, item.n)),
        )
    }
    let frame = 0
    const tick = () => {
      paint()
      if (!reduced && clock.snapshot().playing)
        frame = requestAnimationFrame(tick)
    }
    const restart = () => {
      cancelAnimationFrame(frame)
      tick()
    }
    const unsubscribe = clock.subscribe(restart)
    restart()
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
      group.remove()
    }
  }, [map, statuses, clock, reduced])
  return null
}
