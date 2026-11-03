import { Component, lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { UrbanCanvas } from '../simulation/UrbanCanvas'
import type { SceneProps } from './CityScene'
const Scene = lazy(() => import('./CityScene'))
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
export function CityViewport(props: SceneProps) {
  const [lost, setLost] = useState(false)
  const [playback, setPlayback] = useState(() => props.clock.snapshot())
  useEffect(
    () => props.clock.subscribe(() => setPlayback(props.clock.snapshot())),
    [props.clock],
  )
  const fallback = (
    <div className="city-fallback">
      <span className="fallback-notice">
        WebGL 2 no disponible · representación vectorial alternativa
      </span>
      <UrbanCanvas
        scenario={props.scenario}
        result={props.result}
        selection={props.selection}
        onSelect={props.onSelect}
        playback={playback}
        clock={props.clock}
        utilization={props.utilization}
        thresholds={props.thresholds}
        setPlayback={(p) => {
          props.clock.speed(p.speed)
          if (p.playing) props.clock.play()
          else props.clock.pause()
        }}
      />
    </div>
  )
  if (lost || typeof window.WebGL2RenderingContext === 'undefined')
    return fallback
  return (
    <SceneBoundary fallback={fallback}>
      <Suspense
        fallback={
          <div className="scene-loading" role="status">
            <span />
            Preparando la ciudad tridimensional…
          </div>
        }
      >
        <Scene {...props} onLost={() => setLost(true)} />
      </Suspense>
    </SceneBoundary>
  )
}
