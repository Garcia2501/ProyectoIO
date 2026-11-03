import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, Object3D, Vector3 } from 'three'
import { clearOfRoads, makeBuildings } from './cityModel'
import type { CityModel } from './cityModel'
import { QUALITY } from './visualClock'
import type { Quality } from './visualClock'
export function Infrastructure({
  model,
  quality,
  dusk,
}: {
  model: CityModel
  quality: Quality
  dusk: boolean
}) {
  const blocks = useMemo(
    () => makeBuildings(model, QUALITY[quality].buildings),
    [model, quality],
  )
  const body = useRef<InstancedMesh>(null),
    roof = useRef<InstancedMesh>(null),
    windows = useRef<InstancedMesh>(null),
    crowns = useRef<InstancedMesh>(null),
    trunks = useRef<InstancedMesh>(null),
    plots = useRef<InstancedMesh>(null)
  const trees = useMemo(() => {
    const points: Vector3[] = []
    for (let z = model.bounds.minZ; z < model.bounds.maxZ; z += 1.5)
      for (let x = model.bounds.minX; x < model.bounds.maxX; x += 1.5) {
        if (
          clearOfRoads(x, z, model, 1.1) &&
          blocks.every(
            (b) =>
              Math.abs(b.x - x) > b.w / 2 + 0.4 ||
              Math.abs(b.z - z) > b.d / 2 + 0.4,
          )
        )
          points.push(new Vector3(x, 0, z))
      }
    return points
      .filter(
        (_, i) =>
          i % Math.max(1, Math.ceil(points.length / QUALITY[quality].trees)) ===
          0,
      )
      .slice(0, QUALITY[quality].trees)
  }, [model, blocks, quality])
  useLayoutEffect(() => {
    const o = new Object3D(),
      color = new Color()
    let index = 0
    blocks.forEach((b, i) => {
      o.position.set(b.x, b.h / 2 + 0.08, b.z)
      o.scale.set(b.w, b.h, b.d)
      o.rotation.set(0, 0, 0)
      o.updateMatrix()
      body.current!.setMatrixAt(i, o.matrix)
      body.current!.setColorAt(
        i,
        color.set(
          ['#d5dcd9', '#9eafb3', '#bacad1', '#b9b0a5', '#77969e'][b.style],
        ),
      )
      o.position.y = b.h + 0.14
      o.scale.set(b.w + 0.06, 0.16, b.d + 0.06)
      o.updateMatrix()
      roof.current!.setMatrixAt(i, o.matrix)
      o.position.y = 0.008
      o.scale.set(b.w + 0.45, 0.04, b.d + 0.45)
      o.updateMatrix()
      plots.current!.setMatrixAt(i, o.matrix)
      for (let floor = 0.5; floor < b.h - 0.1; floor += 0.5)
        for (const sign of [-1, 1]) {
          o.position.set(b.x, floor, b.z + sign * (b.d / 2 + 0.006))
          o.scale.set(b.w * 0.76, 0.12, 0.015)
          o.updateMatrix()
          windows.current!.setMatrixAt(index++, o.matrix)
        }
    })
    if (body.current) {
      body.current.instanceMatrix.needsUpdate = true
      body.current.instanceColor!.needsUpdate = true
    }
    roof.current!.instanceMatrix.needsUpdate = true
    plots.current!.instanceMatrix.needsUpdate = true
    windows.current!.count = index
    windows.current!.instanceMatrix.needsUpdate = true
    trees.forEach((p, i) => {
      o.position.set(p.x, 0.4, p.z)
      o.scale.set(0.08, 0.8, 0.08)
      o.updateMatrix()
      trunks.current!.setMatrixAt(i, o.matrix)
      o.position.y = 1.05
      o.scale.set(0.4, 0.65, 0.4)
      o.updateMatrix()
      crowns.current!.setMatrixAt(i, o.matrix)
      crowns.current!.setColorAt(i, color.set(i % 2 ? '#648e6b' : '#88ad7c'))
    })
    for (const ref of [trunks, crowns])
      ref.current!.instanceMatrix.needsUpdate = true
    if (crowns.current?.instanceColor)
      crowns.current.instanceColor.needsUpdate = true
  }, [blocks, trees])
  return (
    <group>
      <instancedMesh
        ref={plots}
        args={[undefined, undefined, blocks.length]}
        receiveShadow
      >
        <boxGeometry />
        <meshStandardMaterial color="#c4cebc" roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={body}
        args={[undefined, undefined, blocks.length]}
        castShadow
        receiveShadow
      >
        <boxGeometry />
        <meshStandardMaterial roughness={0.72} />
      </instancedMesh>
      <instancedMesh
        ref={roof}
        args={[undefined, undefined, blocks.length]}
        castShadow
      >
        <boxGeometry />
        <meshStandardMaterial color="#e5e9e5" roughness={0.8} />
      </instancedMesh>
      <instancedMesh
        ref={windows}
        args={[undefined, undefined, blocks.length * 34]}
      >
        <boxGeometry />
        <meshStandardMaterial
          color={dusk ? '#ffe9b6' : '#7195a5'}
          emissive={dusk ? '#ffc16e' : '#233641'}
          emissiveIntensity={dusk ? 1.3 : 0.08}
          metalness={0.35}
          roughness={0.3}
        />
      </instancedMesh>
      <instancedMesh
        ref={trunks}
        args={[undefined, undefined, trees.length]}
        castShadow
      >
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshStandardMaterial color="#756856" />
      </instancedMesh>
      <instancedMesh
        ref={crowns}
        args={[undefined, undefined, trees.length]}
        castShadow
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
    </group>
  )
}
export function StreetFurniture({
  model,
  dusk,
}: {
  model: CityModel
  dusk: boolean
}) {
  const poles = useRef<InstancedMesh>(null),
    lights = useRef<InstancedMesh>(null),
    crossings = useRef<InstancedMesh>(null)
  const lamps = useMemo(
    () =>
      model.roads.flatMap((r) =>
        Array.from({ length: Math.floor(r.length / 3.5) }, (_, i) => {
          const f = (i + 0.5) / Math.max(1, Math.floor(r.length / 3.5)),
            p = r.curve.getPointAt(f),
            t = r.curve.getTangentAt(f)
          return new Vector3(p.x + t.z * 0.86, 0, p.z - t.x * 0.86)
        }),
      ),
    [model],
  )
  useLayoutEffect(() => {
    const o = new Object3D()
    lamps.forEach((p, i) => {
      o.position.set(p.x, 0.65, p.z)
      o.scale.set(0.035, 1.3, 0.035)
      o.updateMatrix()
      poles.current!.setMatrixAt(i, o.matrix)
      o.position.y = 1.32
      o.scale.set(0.2, 0.05, 0.2)
      o.updateMatrix()
      lights.current!.setMatrixAt(i, o.matrix)
    })
    model.nodes.forEach((n, i) => {
      for (let k = 0; k < 6; k++) {
        o.position.set(
          n.position.x + (k - 2.5) * 0.15,
          0.09,
          n.position.z + 0.48,
        )
        o.scale.set(0.08, 0.01, 0.26)
        o.updateMatrix()
        crossings.current!.setMatrixAt(i * 6 + k, o.matrix)
      }
    })
    for (const ref of [poles, lights, crossings])
      ref.current!.instanceMatrix.needsUpdate = true
  }, [model, lamps])
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, lamps.length]}>
        <boxGeometry />
        <meshStandardMaterial color="#627575" />
      </instancedMesh>
      <instancedMesh ref={lights} args={[undefined, undefined, lamps.length]}>
        <boxGeometry />
        <meshStandardMaterial
          color="#ffefd3"
          emissive="#ffcf8d"
          emissiveIntensity={dusk ? 2 : 0.15}
        />
      </instancedMesh>
      <instancedMesh
        ref={crossings}
        args={[undefined, undefined, model.nodes.length * 6]}
      >
        <boxGeometry />
        <meshBasicMaterial color="#e1e6db" />
      </instancedMesh>
    </group>
  )
}
