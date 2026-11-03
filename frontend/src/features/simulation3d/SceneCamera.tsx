import { useEffect, useId, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { CameraControls } from '@react-three/drei'
import type { CameraControls as CameraControlsType } from '@react-three/drei'
import type { CityModel } from './cityModel'
import type { Selection } from '../scenarios/useWorkspace'
import type { CameraPreset, VisualClock } from './visualClock'
import type { CameraBus } from './CameraBus'
export function SceneCamera({
  model,
  camera,
  selection,
  focusTick,
  reduced,
  bus,
  zoom = 1,
  clock,
}: {
  model: CityModel
  camera: CameraPreset
  selection: Selection
  focusTick: number
  reduced: boolean
  bus?: CameraBus
  zoom?: number
  clock: VisualClock
}) {
  const controls = useRef<CameraControlsType>(null),
    id = useId()
  const selected = useRef(selection)
  const manual = useRef(false)
  const follow = useMemo(
    () => ({ point: new Vector3(), eye: new Vector3(), offset: new Vector3() }),
    [],
  )
  useEffect(() => {
    selected.current = selection
  }, [selection])
  const p = useMemo(() => new Vector3(), []),
    t = useMemo(() => new Vector3(), [])
  useEffect(() => {
    const c = controls.current
    if (!c) return
    manual.current = false
    const selectedId = selected.current?.id
    const r = model.radius
    let target = new Vector3(0, 0, 0)
    const position = new Vector3(r * 0.82, r * 0.92, r * 0.95)
    if (camera === 'aerial') position.set(0, r * 1.65, 0.05)
    if (camera === 'overview') position.set(-r * 1.15, r * 1.05, r * 1.2)
    if (camera === 'intersection') {
      target =
        model.nodes.find((n) => n.id === selectedId)?.position.clone() ??
        model.nodes[0]?.position.clone() ??
        target
      position.copy(target).add(new Vector3(5, 6, 8))
    }
    if (camera === 'corridor') {
      const road =
        model.roads.find((r) => r.id === selectedId) ?? model.roads[0]
      if (road) target = road.curve.getPointAt(0.5)
      position.copy(target).add(new Vector3(-5, 7, 9))
    }
    position
      .sub(target)
      .multiplyScalar(1 / zoom)
      .add(target)
    void c.setLookAt(
      position.x,
      position.y,
      position.z,
      target.x,
      target.y,
      target.z,
      !reduced,
    )
  }, [camera, model, focusTick, reduced, zoom])
  useEffect(
    () =>
      bus?.subscribe(id, (pose) => {
        manual.current = true
        void controls.current?.setLookAt(
          ...pose.position,
          ...pose.target,
          false,
        )
      }),
    [bus, id],
  )
  useFrame((_, delta) => {
    const c = controls.current
    if (!c || camera !== 'corridor' || manual.current || reduced) return
    const road =
      model.roads.find((r) => r.id === selected.current?.id) ?? model.roads[0]
    if (!road) return
    road.curve.getPointAt(
      0.15 + (0.7 * clock.time()) / clock.duration,
      follow.point,
    )
    follow.eye
      .copy(follow.point)
      .add(follow.offset.set(-5 / zoom, 7 / zoom, 9 / zoom))
    c.getPosition(p)
    c.getTarget(t)
    const factor = 1 - Math.exp(-delta * 3)
    p.lerp(follow.eye, factor)
    t.lerp(follow.point, factor)
    void c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false)
  })
  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={3}
      maxDistance={model.radius * 3}
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI * 0.48}
      smoothTime={reduced ? 0 : 0.6}
      onControlStart={() => {
        manual.current = true
      }}
      onControl={() => {
        if (!bus || !controls.current) return
        controls.current.getPosition(p)
        controls.current.getTarget(t)
        bus.publish(id, { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] })
      }}
    />
  )
}
