import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { useReducedMotion } from 'motion/react'
import type { Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
import type { Selection } from '../scenarios/useWorkspace'
import { cityPoint, urbanRoads, vehicleCount } from './urbanGeometry'
import { Icon } from '../../components/Icon'
import type { VisualClock } from '../simulation3d/visualClock'
import { utilizationColor } from '../simulation3d/visualClock'
import type { Thresholds } from '../simulation3d/visualClock'

const CityBlocks = memo(function CityBlocks() {
  return (
    <g className="city-blocks" aria-hidden="true">
      {Array.from({ length: 66 }, (_, i) => {
        const col = i % 11,
          row = Math.floor(i / 11),
          x = col * 125 + 15,
          y = row * 125 - 90
        // Keep a clear urban corridor around the reference network.
        if (y > 80 && y < 460 && x > 180 && x < 1150) return null
        const h = 16 + ((i * 17) % 35),
          w = 58 + ((i * 13) % 24)
        return (
          <g key={i} transform={`translate(${x},${y})`}>
            <rect
              x="-4"
              y="4"
              width={w + 10}
              height="69"
              rx="12"
              fill="#cfddd4"
            />
            <path d={`M0 14L${w} 14L${w + 12} 0L12 0Z`} fill="#f5fbfa" />
            <path
              d={`M0 14v${h}h${w}V14Z`}
              fill={i % 3 === 0 ? '#b7c9d4' : '#c3d3dc'}
            />
            <path d={`M${w} 14l12-14v${h}l-12 14Z`} fill="#a5becb" />
            <path
              d={`M7 22h${w - 14}M7 30h${w - 14}M7 38h${w - 14}`}
              stroke="#e9f5f6"
              strokeWidth="3"
            />
            <circle cx={w + 29} cy="55" r="13" fill="#a0c9b1" />
            <circle cx={w + 25} cy="51" r="10" fill="#bcddbb" />
          </g>
        )
      })}
    </g>
  )
})
export interface Playback {
  playing: boolean
  speed: number
}
interface Props {
  scenario: Scenario
  result: StoredResult | null
  selection: Selection
  onSelect: (s: Selection) => void
  playback: Playback
  setPlayback: (p: Playback) => void
  clock?: VisualClock
  utilization?: boolean
  thresholds?: Thresholds
}
export function UrbanCanvas({
  scenario,
  result,
  selection,
  onSelect,
  playback,
  setPlayback,
  clock,
  utilization,
  thresholds,
}: Props) {
  const reduced = useReducedMotion()
  const svg = useRef<SVGSVGElement>(null)
  const roads = useMemo(
    () =>
      urbanRoads(scenario, result).map((road) =>
        utilization === undefined
          ? road
          : {
              ...road,
              color: utilization
                ? utilizationColor(road.utilization, road.enabled, thresholds)
                : road.enabled
                  ? '#38d1b0'
                  : '#87939d',
            },
      ),
    [scenario, result, utilization, thresholds],
  )
  const maxFlow = Math.max(0, ...roads.map((r) => r.flow))
  const points = scenario.nodes.map(cityPoint)
  const xMin = Math.min(120, ...points.map((p) => p.x)) - 140,
    yMin = Math.min(0, ...points.map((p) => p.y)) - 120
  const width = Math.max(
    1200,
    Math.max(1050, ...points.map((p) => p.x)) + 150 - xMin,
  )
  const height = Math.max(
    650,
    Math.max(450, ...points.map((p) => p.y)) + 180 - yMin,
  )
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 })
  const gesture = useRef<{
    x: number
    y: number
    panX: number
    panY: number
  } | null>(null)
  const patternId = useId()
  const budget = roads.reduce((s, r) => s + vehicleCount(r.flow, maxFlow), 0)
  // Browser-managed animation; no React renders on animation frames.
  useEffect(() => {
    const animations = Array.from(
      svg.current?.querySelectorAll('[data-vehicle]') ?? [],
    ).flatMap((el) => el.getAnimations?.() ?? [])
    const synchronize = () => {
      const current = clock?.snapshot()
      for (const animation of animations) {
        if (current) animation.currentTime = current.time * 1000
        animation.updatePlaybackRate(playback.speed)
        if ((current?.playing ?? playback.playing) && !reduced) animation.play()
        else animation.pause()
      }
    }
    synchronize()
    const unsubscribe = clock?.subscribe(synchronize)
    const timer = clock
      ? setInterval(() => {
          if (clock.time() >= clock.duration) synchronize()
        }, 250)
      : undefined
    return () => {
      unsubscribe?.()
      if (timer) clearInterval(timer)
    }
  }, [playback.speed, playback.playing, reduced, roads, clock])
  const pointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('[data-interactive]'))
      return
    gesture.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const pointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g) return
    const rect = e.currentTarget.getBoundingClientRect()
    setPan({
      x: g.panX - (((e.clientX - g.x) / rect.width) * width) / zoom,
      y: g.panY - (((e.clientY - g.y) / rect.height) * height) / zoom,
    })
  }
  const source = result
    ? result.demo
      ? 'Demostración'
      : 'Resultado API'
    : 'Sin resultado de flujo'
  return (
    <div className="urban-canvas" aria-label="Vista urbana de la red">
      <svg
        ref={svg}
        className="city-scene"
        viewBox={`${xMin + pan.x + (width - width / zoom) / 2} ${yMin + pan.y + (height - height / zoom) / 2} ${width / zoom} ${height / zoom}`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={() => {
          gesture.current = null
        }}
        onPointerCancel={() => {
          gesture.current = null
        }}
        aria-label="Ciudad ilustrativa: mismas vías y nodos del escenario"
      >
        <defs>
          <pattern
            id={patternId}
            width="70"
            height="70"
            patternUnits="userSpaceOnUse"
          >
            <rect width="70" height="70" fill="#e5eee9" />
            <path d="M0 0H70V70" fill="none" stroke="#f6faf6" strokeWidth="4" />
          </pattern>
          <filter id={patternId + 'shadow'}>
            <feDropShadow
              dx="0"
              dy="5"
              stdDeviation="4"
              floodColor="#2d5563"
              floodOpacity=".18"
            />
          </filter>
        </defs>
        <rect
          x={xMin - 1200}
          y={yMin - 1000}
          width={width + 2400}
          height={height + 2000}
          fill={`url(#${patternId})`}
        />
        <path
          d="M-200 60C120 40 170 450 470 450S1000 560 1550 450"
          stroke="#b2dce2"
          strokeWidth="75"
          fill="none"
        />
        <path
          d="M-200 60C120 40 170 450 470 450S1000 560 1550 450"
          stroke="#e0f2f1"
          strokeWidth="85"
          opacity=".35"
          fill="none"
        />
        <CityBlocks />
        <g className="city-park" aria-hidden="true">
          <rect x="500" y="25" width="230" height="95" rx="35" fill="#c6dec8" />
          <path
            d="M530 72Q600 20 695 79"
            fill="none"
            stroke="#edf5dc"
            strokeWidth="10"
          />
          {[535, 570, 610, 660, 700].map((x, i) => (
            <circle key={x} cx={x} cy={i % 2 ? 85 : 55} r="16" fill="#9bc4ab" />
          ))}
        </g>
        {roads.map((road) => (
          <g
            key={road.id}
            className={'city-road ' + (!road.enabled ? 'is-closed' : '')}
            data-road={road.id}
          >
            <path
              d={road.path}
              fill="none"
              stroke="#f8fcfa"
              strokeWidth="48"
              strokeLinecap="round"
            />
            <path
              d={road.path}
              fill="none"
              stroke="#a4b5bd"
              strokeWidth="35"
              strokeLinecap="round"
            />
            <path
              d={road.path}
              fill="none"
              stroke="#738b98"
              strokeWidth="29"
              strokeLinecap="round"
            />
            <path
              d={road.path}
              fill="none"
              stroke="#e8f3ee"
              strokeWidth="1.2"
              strokeDasharray="12 14"
              opacity=".8"
            />
            {road.enabled && (
              <path
                d={road.path}
                className="route-halo"
                fill="none"
                stroke={road.color}
                strokeWidth={
                  selection?.type === 'road' && selection.id === road.id
                    ? 13
                    : 7
                }
                opacity=".6"
              />
            )}
            <path
              data-interactive="true"
              d={road.path}
              fill="none"
              stroke="transparent"
              strokeWidth="45"
              role="button"
              tabIndex={0}
              aria-label={
                'Vía urbana ' +
                road.id +
                ', ' +
                road.source +
                ' a ' +
                road.target
              }
              onClick={() => onSelect({ type: 'road', id: road.id })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect({ type: 'road', id: road.id })
                }
              }}
            />
            <g
              className="city-road-label"
              transform={`translate(${road.labelX},${road.labelY - 31})`}
              pointerEvents="none"
            >
              <rect x="-67" y="-16" width="134" height="30" rx="14" />
              <text textAnchor="middle" y="4">
                {road.id} ·{' '}
                {road.enabled
                  ? road.utilization !== null
                    ? road.utilization.toFixed(0) + ' %'
                    : 'cap. ' + road.capacity
                  : 'CERRADA'}
              </text>
            </g>
            {!road.enabled && (
              <g
                transform={`translate(${road.labelX},${road.labelY})`}
                pointerEvents="none"
              >
                <circle r="14" fill="#ea6574" />
                <path
                  d="m-6-6 12 12m-12 0 12-12"
                  stroke="white"
                  strokeWidth="3"
                />
              </g>
            )}
            {road.enabled &&
              Array.from(
                { length: vehicleCount(road.flow, maxFlow) },
                (_, i) => (
                  <g
                    key={i}
                    data-vehicle="true"
                    aria-hidden="true"
                    className="urban-vehicle"
                    style={
                      {
                        offsetPath: `path("${road.path}")`,
                        offsetDistance: `${(i / vehicleCount(road.flow, maxFlow)) * 100}%`,
                        animationDelay: `-${(i / vehicleCount(road.flow, maxFlow)) * 16}s`,
                      } as CSSProperties
                    }
                  >
                    <rect
                      x="-9"
                      y="-4.5"
                      width="18"
                      height="9"
                      rx="3"
                      fill={i % 3 ? '#fbffff' : '#eaffc6'}
                      stroke={road.color}
                      strokeWidth="1.5"
                    />
                    <rect
                      x="-3"
                      y="-3.2"
                      width="7"
                      height="6.4"
                      rx="1.5"
                      fill="#5a8494"
                    />
                    <path d="M7-3v1M7 3V2" stroke="#f8ffb1" strokeWidth="1.5" />
                  </g>
                ),
              )}
          </g>
        ))}
        {scenario.nodes.map((n) => {
          const p = cityPoint(n)
          return (
            <g
              key={n.id}
              data-interactive="true"
              role="button"
              tabIndex={0}
              aria-label={'Nodo urbano ' + n.id + ' ' + n.label}
              onClick={() => onSelect({ type: 'node', id: n.id })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect({ type: 'node', id: n.id })
                }
              }}
              transform={`translate(${p.x},${p.y})`}
              className={
                'city-junction ' +
                (selection?.type === 'node' && selection.id === n.id
                  ? 'selected'
                  : '')
              }
            >
              <circle r="26" fill="#eef6ee" stroke="#a8c7b6" strokeWidth="4" />
              <circle
                r="17"
                fill={
                  n.balance < 0
                    ? '#57a5e4'
                    : n.balance > 0
                      ? '#29b877'
                      : '#93aab5'
                }
              />
              <text
                y="5"
                textAnchor="middle"
                fill="white"
                fontSize="14"
                fontWeight="700"
              >
                {n.id}
              </text>
              <g transform="translate(0,-48)">
                <rect
                  x="-60"
                  y="-14"
                  width="120"
                  height="28"
                  rx="14"
                  fill="#ffffffef"
                />
                <text y="4" textAnchor="middle" fontSize="11" fill="#35515f">
                  {n.label}
                </text>
              </g>
            </g>
          )
        })}
      </svg>
      <div className="city-title glass">
        <span className="city-icon">
          <Icon name="city" size={27} />
        </span>
        <div>
          <h2>Simulación de ciudad</h2>
          <p>
            <i className={'dot ' + (result ? 'green' : 'gray')} />
            {source} · {scenario.scenario_name}
          </p>
        </div>
      </div>
      <div className="city-tools glass">
        <button
          aria-label="Acercar ciudad"
          disabled={zoom >= 2}
          onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
        >
          <Icon name="plus" />
        </button>
        <button
          aria-label="Alejar ciudad"
          disabled={zoom <= 0.6}
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
        >
          −
        </button>
        <button
          aria-label="Centrar ciudad"
          onClick={() => {
            setZoom(1)
            setPan({ x: 0, y: 0 })
          }}
        >
          <Icon name="target" />
        </button>
      </div>
      {!result || result.data.status === 'infeasible' ? (
        <div className="city-empty glass">
          <Icon name="info" />
          <p>
            {result
              ? 'Sin flujo factible. No hay vehículos que representar.'
              : 'Optimiza la red o carga la demostración para visualizar vehículos.'}
          </p>
        </div>
      ) : (
        <div className="city-flow-pill glass">
          <i className="dot green" />
          {budget} símbolos móviles · densidad relativa al flujo
        </div>
      )}
      <div className="playback-dock glass" aria-label="Controles de simulación">
        <button
          className={'playback-main ' + (playback.playing ? 'playing' : '')}
          disabled={!budget || !!reduced}
          aria-label={
            playback.playing ? 'Pausar simulación' : 'Reproducir simulación'
          }
          onClick={() =>
            setPlayback({ ...playback, playing: !playback.playing })
          }
        >
          <Icon name={playback.playing ? 'pause' : 'play'} size={21} />
        </button>
        <div>
          <strong>
            {reduced
              ? 'Movimiento reducido'
              : !budget
                ? 'En espera'
                : playback.playing
                  ? 'En circulación'
                  : 'En pausa'}
          </strong>
          <small>Animación ilustrativa · sin tiempo físico</small>
        </div>
        <label>
          Velocidad
          <select
            aria-label="Velocidad de reproducción"
            value={playback.speed}
            onChange={(e) =>
              setPlayback({ ...playback, speed: Number(e.target.value) })
            }
          >
            <option value={0.5}>0,5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </label>
      </div>
    </div>
  )
}
