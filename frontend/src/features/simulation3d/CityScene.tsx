import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { buildCity, makeBuildings, vehicleAllocation } from './cityModel'
import { QUALITY } from './visualClock'
import type { SceneProps } from './sceneTypes'
export type { SceneProps, PerformanceSample } from './sceneTypes'
import { RoadNetwork, Junctions } from './RoadNetwork'
import { Infrastructure, StreetFurniture } from './CityInfrastructure'
import { Vehicles, RouteArrows } from './CityVehicles'
import { SceneCamera } from './SceneCamera'
function SceneContents(props: SceneProps) {
  useEffect(() => {
    if (props.reduced) props.clock.pause()
  }, [props.reduced, props.clock])
  const model = useMemo(
    () => buildCity(props.scenario, props.result),
    [props.scenario, props.result],
  )
  const { gl } = useThree()
  const measurements = useRef({ seconds: 0, frames: 0 })
  const vehicles = useMemo(
    () => vehicleAllocation(model, QUALITY[props.quality].vehicles).length,
    [model, props.quality],
  )
  const buildings = useMemo(
    () => makeBuildings(model, QUALITY[props.quality].buildings).length,
    [model, props.quality],
  )
  useFrame((_, delta) => {
    const m = measurements.current
    m.seconds += delta
    m.frames++
    if (m.seconds >= 1) {
      props.onMeasure?.({
        fps: Math.round(m.frames / m.seconds),
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        vehicles,
        buildings,
      })
      m.seconds = 0
      m.frames = 0
    }
  })
  return (
    <>
      <Sky
        distance={450}
        sunPosition={props.dusk ? [-20, 3, -45] : [-20, 35, 15]}
        turbidity={props.dusk ? 8 : 5}
        rayleigh={props.dusk ? 2 : 1}
      />
      <color attach="background" args={[props.dusk ? '#202b48' : '#c5d5d5']} />
      <fog
        attach="fog"
        args={[
          props.dusk ? '#34354b' : '#c5d5d5',
          model.radius * 1.2,
          model.radius * 4,
        ]}
      />
      <hemisphereLight
        args={[
          props.dusk ? '#9fa7df' : '#ecf6ff',
          props.dusk ? '#57536d' : '#b5c3a4',
          props.dusk ? 1.2 : 2.2,
        ]}
      />
      <directionalLight
        position={[-18, 28, 12]}
        intensity={props.dusk ? 2 : 3}
        color={props.dusk ? '#ffc18f' : '#fff5df'}
        castShadow={QUALITY[props.quality].shadows}
        shadow-mapSize={props.quality === 'high' ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-bias={-0.0005}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.035, 0]}
        receiveShadow
      >
        <planeGeometry args={[model.radius * 5, model.radius * 5]} />
        <meshStandardMaterial
          color={props.dusk ? '#394c51' : '#9eb5a5'}
          roughness={1}
        />
      </mesh>
      <Infrastructure model={model} quality={props.quality} dusk={props.dusk} />
      <StreetFurniture model={model} dusk={props.dusk} />
      <RoadNetwork
        model={model}
        selection={props.selection}
        onSelect={props.onSelect}
        utilization={props.utilization}
        thresholds={props.thresholds}
        dusk={props.dusk}
        reduced={props.reduced}
      />
      <Junctions
        model={model}
        selection={props.selection}
        onSelect={props.onSelect}
      />
      <Vehicles model={model} clock={props.clock} quality={props.quality} />
      <RouteArrows model={model} clock={props.clock} />
      <SceneCamera
        clock={props.clock}
        model={model}
        camera={props.camera}
        selection={props.selection}
        focusTick={props.focusTick}
        zoom={props.zoom}
        reduced={props.reduced}
        bus={props.bus}
      />
    </>
  )
}
export default function CityScene(props: SceneProps) {
  return (
    <Canvas
      shadows={QUALITY[props.quality].shadows}
      dpr={QUALITY[props.quality].dpr}
      camera={{ position: [28, 30, 34], fov: 43, near: 0.1, far: 600 }}
      gl={{
        antialias: props.quality !== 'low',
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          'webglcontextlost',
          (e) => {
            e.preventDefault()
            props.onLost?.()
          },
          { once: true },
        )
      }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <SceneContents {...props} />
    </Canvas>
  )
}
