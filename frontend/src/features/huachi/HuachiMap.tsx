import { Fragment, memo, useEffect, useId, useMemo } from 'react'
import L from 'leaflet'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
import type { Selection } from '../scenarios/useWorkspace'
import type { VisualClock } from '../simulation3d/visualClock'
import type { Thresholds } from '../simulation3d/visualClock'
import { boundsOf, pathSampler } from './geo'
import type { GeoNetwork } from './geo'
import { CLASS_LABELS, DEFAULT_THRESHOLDS, roadStatuses } from './layers'
import type { LayerState, RoadStatus } from './layers'
import type { MapSync } from './mapSync'
import { VehicleLayer } from './VehicleLayer'

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export interface HuachiMapProps {
  network: GeoNetwork
  scenario: Scenario
  result: StoredResult | null
  selection: Selection
  onSelect?: (selection: Selection) => void
  layers: LayerState
  thresholds?: Thresholds
  clock: VisualClock
  reduced: boolean
  sync?: MapSync
  /** Nombre accesible del mapa. */
  label?: string
}

/** Rumbo aproximado (grados, 0 = norte) del tramo medio de la línea. */
function bearing(from: [number, number], to: [number, number]) {
  const dx = (to[1] - from[1]) * Math.cos(((from[0] + to[0]) / 2) * (Math.PI / 180))
  const dy = to[0] - from[0]
  return (Math.atan2(dx, dy) * 180) / Math.PI
}

function arrowIcon(angle: number, color: string) {
  return L.divIcon({
    className: 'huachi-arrow',
    html: `<span style="transform:rotate(${angle.toFixed(1)}deg);border-bottom-color:${color}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function SyncController({ sync, id }: { sync: MapSync; id: string }) {
  const map = useMap()
  useEffect(() => {
    const unsubscribe = sync.subscribe(id, (view) => {
      const center = map.getCenter()
      if (
        map.getZoom() !== view.zoom ||
        Math.abs(center.lat - view.lat) > 1e-7 ||
        Math.abs(center.lng - view.lng) > 1e-7
      )
        map.setView([view.lat, view.lng], view.zoom, { animate: false })
    })
    const publish = () => {
      const c = map.getCenter()
      sync.publish(id, { lat: c.lat, lng: c.lng, zoom: map.getZoom() })
    }
    map.on('moveend', publish)
    return () => {
      map.off('moveend', publish)
      unsubscribe()
    }
  }, [map, sync, id])
  return null
}

const RoadLines = memo(function RoadLines({
  statuses,
  layers,
  selectedId,
  onSelect,
}: {
  statuses: RoadStatus[]
  layers: LayerState
  selectedId: string | null
  onSelect?: (selection: Selection) => void
}) {
  return (
    <>
      {statuses.map((s) => {
        const positions = s.geo.coordinates.map(
          ([lon, lat]) => [lat, lon] as [number, number],
        )
        const selected = s.geo.id === selectedId
        const closed = s.cls === 'closed'
        const pick = () => onSelect?.({ type: 'road', id: s.geo.id })
        const mid = pathSampler(s.geo.coordinates)
        const a = mid.at(0.47),
          b = mid.at(0.53)
        return (
          <Fragment key={s.geo.id}>
            {selected && (
              <Polyline
                positions={positions}
                interactive={false}
                pathOptions={{ color: '#ffffff', weight: 11, opacity: 0.95 }}
              />
            )}
            <Polyline
              key={s.geo.id + s.cls + (selected ? '-sel' : '')}
              positions={positions}
              bubblingMouseEvents={false}
              // className debe pasarse como opción de creación; setStyle no lo aplica.
              className={'huachi-road huachi-road-' + s.cls}
              eventHandlers={{ click: pick }}
              pathOptions={{
                color: s.color,
                weight: selected ? 7 : 5,
                opacity: closed ? 0.9 : 0.95,
                dashArray: closed ? '3 9' : undefined,
                lineCap: 'round',
              }}
            >
              <Tooltip sticky>
                {s.geo.id}
                {s.geo.name ? ' · ' + s.geo.name : ''} · {CLASS_LABELS[s.cls]}
                {s.utilization !== null ? ` (${s.utilization} %)` : ''}
              </Tooltip>
              {layers.labels && s.geo.name && (
                <Tooltip permanent direction="center" className="huachi-label">
                  {s.geo.name}
                </Tooltip>
              )}
            </Polyline>
            {!closed && (
              <Marker
                position={a}
                keyboard={false}
                interactive={false}
                icon={arrowIcon(bearing(a, b), '#16324f')}
              />
            )}
            {closed && layers.closures && (
              <Marker
                position={mid.at(0.5)}
                keyboard={false}
                interactive={false}
                icon={L.divIcon({
                  className: 'huachi-closure',
                  html: '<span>✕</span>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                })}
              />
            )}
          </Fragment>
        )
      })}
    </>
  )
})

export const HuachiMap = memo(function HuachiMap({
  network,
  scenario,
  result,
  selection,
  onSelect,
  layers,
  thresholds = DEFAULT_THRESHOLDS,
  clock,
  reduced,
  sync,
  label = 'Mapa de las calles de Huachi',
}: HuachiMapProps) {
  const id = useId()
  const statuses = useMemo(
    () => roadStatuses(network, scenario, result, thresholds),
    [network, scenario, result, thresholds],
  )
  const bounds = useMemo(
    () =>
      boundsOf([
        ...network.roads.flatMap((r) => r.coordinates),
        ...network.nodes.map((n) => [n.lon, n.lat] as [number, number]),
      ]),
    [network],
  )
  const selectedRoad = selection?.type === 'road' ? selection.id : null
  const selectedNode = selection?.type === 'node' ? selection.id : null
  return (
    <div className="huachi-map" role="region" aria-label={label}>
      <MapContainer
        bounds={bounds ?? undefined}
        boundsOptions={{ padding: [28, 28] }}
        attributionControl={false}
        className="huachi-leaflet"
        zoomControl
        keyboard
        minZoom={3}
        maxZoom={19}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        {layers.tiles && (
          <TileLayer url={OSM_TILES} maxZoom={19} crossOrigin="anonymous" />
        )}
        {layers.roads && (
          <RoadLines
            statuses={statuses}
            layers={layers}
            selectedId={selectedRoad}
            onSelect={onSelect}
          />
        )}
        {layers.nodes &&
          network.nodes.map((n) => (
            <CircleMarker
              key={n.id}
              center={[n.lat, n.lon]}
              radius={selectedNode === n.id ? 9 : 6}
              bubblingMouseEvents={false}
              eventHandlers={{
                click: () => onSelect?.({ type: 'node', id: n.id }),
              }}
              pathOptions={{
                color: selectedNode === n.id ? '#0b7a56' : '#16324f',
                weight: 2.5,
                fillColor: '#ffffff',
                fillOpacity: 1,
              }}
            >
              <Tooltip
                permanent={layers.labels}
                direction="top"
                offset={[0, -6]}
                className={layers.labels ? 'huachi-label' : undefined}
              >
                {n.label}
              </Tooltip>
            </CircleMarker>
          ))}
        {layers.vehicles && (
          <VehicleLayer statuses={statuses} clock={clock} reduced={reduced} />
        )}
        {sync && <SyncController sync={sync} id={id} />}
      </MapContainer>
      <p className="huachi-attribution">
        Calles y mapa base: ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>{' '}
        (
        <a
          href="https://opendatacommons.org/licenses/odbl/"
          target="_blank"
          rel="noreferrer"
        >
          ODbL
        </a>
        ) · Leaflet
      </p>
    </div>
  )
})
