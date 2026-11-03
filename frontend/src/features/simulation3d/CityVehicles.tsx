import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D, Vector3 } from 'three'
import { vehicleAllocation } from './cityModel'
import type { CityModel } from './cityModel'
import { QUALITY } from './visualClock'
import type { Quality, VisualClock } from './visualClock'
export function Vehicles({
  model,
  clock,
  quality,
}: {
  model: CityModel
  clock: VisualClock
  quality: Quality
}) {
  const vehicles = useMemo(() => {
    const list = vehicleAllocation(model, QUALITY[quality].vehicles)
    const counts = new Map<string, number>()
    list.forEach((v) => counts.set(v.road.id, (counts.get(v.road.id) ?? 0) + 1))
    return list.map((v) => ({
      ...v,
      phase: v.index / (counts.get(v.road.id) ?? 1),
      style: v.index % 5,
    }))
  }, [model, quality])
  const bodies = useRef<InstancedMesh>(null),
    cabins = useRef<InstancedMesh>(null),
    axles = useRef<InstancedMesh>(null)
  const temp = useMemo(
    () => ({
      o: new Object3D(),
      p: new Vector3(),
      t: new Vector3(),
      color: new Color(),
    }),
    [],
  )
  useLayoutEffect(() => {
    vehicles.forEach((v, i) =>
      bodies.current?.setColorAt(
        i,
        temp.color.set(
          ['#e8f0e9', '#ebcf9f', '#8eb9cc', '#d3948b', '#faf9ef'][v.style],
        ),
      ),
    )
    if (bodies.current?.instanceColor)
      bodies.current.instanceColor.needsUpdate = true
  }, [vehicles, temp])
  useFrame(() => {
    const time = clock.time()
    vehicles.forEach((v, i) => {
      const fraction =
        (v.phase + (time * 0.95) / Math.max(v.road.length, 1)) % 1
      v.road.curve.getPointAt(fraction, temp.p)
      v.road.curve.getTangentAt(fraction, temp.t)
      const o = temp.o,
        angle = Math.atan2(temp.t.x, temp.t.z)
      const lane = 0.24
      const x = temp.p.x + temp.t.z * lane,
        z = temp.p.z - temp.t.x * lane
      const fade = Math.min(1, fraction * 25, (1 - fraction) * 25)
      o.position.set(x, 0.18, z)
      o.rotation.set(0, angle, 0)
      o.scale.set(
        0.29 * fade,
        0.18 * fade,
        (v.style === 0 ? 0.64 : 0.46) * fade,
      )
      o.updateMatrix()
      bodies.current?.setMatrixAt(i, o.matrix)
      o.position.y = 0.32
      o.scale.set(0.235 * fade, 0.13 * fade, 0.25 * fade)
      o.updateMatrix()
      cabins.current?.setMatrixAt(i, o.matrix)
      for (let wheel = 0; wheel < 2; wheel++) {
        const offset = wheel === 0 ? -0.14 : 0.14
        o.position.set(
          x + Math.sin(angle) * offset,
          0.1,
          z + Math.cos(angle) * offset,
        )
        o.scale.set(0.34 * fade, 0.115 * fade, 0.075 * fade)
        o.updateMatrix()
        axles.current?.setMatrixAt(i * 2 + wheel, o.matrix)
      }
    })
    for (const ref of [bodies, cabins, axles])
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh
        ref={bodies}
        args={[undefined, undefined, vehicles.length]}
        castShadow
      >
        <boxGeometry />
        <meshStandardMaterial roughness={0.28} metalness={0.25} />
      </instancedMesh>
      <instancedMesh
        ref={cabins}
        args={[undefined, undefined, vehicles.length]}
      >
        <boxGeometry />
        <meshStandardMaterial color="#567a8a" metalness={0.5} roughness={0.2} />
      </instancedMesh>
      <instancedMesh
        ref={axles}
        args={[undefined, undefined, vehicles.length * 2]}
      >
        <boxGeometry />
        <meshStandardMaterial color="#253640" />
      </instancedMesh>
    </group>
  )
}
export function RouteArrows({
  model,
  clock,
}: {
  model: CityModel
  clock: VisualClock
}) {
  const mesh = useRef<InstancedMesh>(null)
  const arrows = useMemo(
    () =>
      model.roads
        .filter((r) => r.enabled && r.flow > 0)
        .flatMap((r) =>
          Array.from(
            { length: Math.max(1, Math.floor(r.length / 3)) },
            (_, i) => ({
              road: r,
              phase: (i + 0.5) / Math.max(1, Math.floor(r.length / 3)),
            }),
          ),
        )
        .slice(0, 100),
    [model],
  )
  const temp = useMemo(
    () => ({ o: new Object3D(), p: new Vector3(), t: new Vector3() }),
    [],
  )
  useFrame(() => {
    const time = clock.time()
    arrows.forEach((a, i) => {
      const f = (a.phase + (time * 0.65) / a.road.length) % 1
      a.road.curve.getPointAt(f, temp.p)
      a.road.curve.getTangentAt(f, temp.t)
      const yaw = Math.atan2(temp.t.x, temp.t.z)
      for (let k = 0; k < 2; k++) {
        const side = k === 0 ? -1 : 1
        temp.o.position.set(
          temp.p.x + temp.t.z * side * 0.075,
          0.078,
          temp.p.z - temp.t.x * side * 0.075,
        )
        temp.o.rotation.y = yaw - side * 0.7
        temp.o.updateMatrix()
        mesh.current?.setMatrixAt(i * 2 + k, temp.o.matrix)
      }
    })
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, arrows.length * 2]}>
      <boxGeometry args={[0.035, 0.012, 0.2]} />
      <meshBasicMaterial color="#e0fff1" />
    </instancedMesh>
  )
}
