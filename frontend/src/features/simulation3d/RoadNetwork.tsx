import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Object3D,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ribbon, ROAD_SEGMENTS } from './cityModel'
import type { CityModel } from './cityModel'
import type { SceneProps } from './sceneTypes'
import type { Selection } from '../scenarios/useWorkspace'
import { utilizationColor } from './visualClock'
function SceneLabel({
  text,
  detail,
  position,
  small = false,
}: {
  text: string
  detail?: string
  position: [number, number, number]
  small?: boolean
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = detail ? 192 : 128
    const c = canvas.getContext('2d')!
    c.fillStyle = '#f0fff9'
    c.beginPath()
    c.roundRect(4, 4, 504, canvas.height - 8, 36)
    c.fill()
    c.strokeStyle = '#ffffff'
    c.lineWidth = 6
    c.stroke()
    c.fillStyle = '#155b51'
    c.textAlign = 'center'
    c.font = 'bold 65px system-ui'
    c.fillText(text, 256, detail ? 85 : 87)
    if (detail) {
      c.font = '30px system-ui'
      c.fillText(detail, 256, 149)
    }
    return new CanvasTexture(canvas)
  }, [text, detail])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite
      position={position}
      scale={small ? [0.9, 0.225, 1] : [3, detail ? 1.125 : 0.75, 1]}
    >
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  )
}
export function RoadNetwork({
  model,
  selection,
  utilization,
  thresholds,
  onSelect,
  dusk,
  reduced,
}: Pick<
  SceneProps,
  'selection' | 'utilization' | 'thresholds' | 'onSelect' | 'dusk' | 'reduced'
> & { model: CityModel }) {
  const markers = useRef<InstancedMesh>(null),
    barriers = useRef<InstancedMesh>(null)
  const selectedId = selection?.type === 'road' ? selection.id : null
  const transition = useRef<{ target: Float32Array | null; remaining: number }>(
    { target: null, remaining: 0 },
  )
  const resources = useMemo(() => {
    const enabled = model.roads.filter((r) => r.enabled)
    const merge = (roads: CityModel['roads'], width: number, y: number) => {
      const pieces = roads.map((r) => ribbon(r.curve, width, y))
      const merged = pieces.length ? mergeGeometries(pieces) : null
      pieces.forEach((g) => g.dispose())
      return merged
    }
    const asphalt = merge(model.roads, 1.2, 0.035),
      sidewalk = merge(model.roads, 1.8, 0.012),
      routes = merge(enabled, 1.35, 0.045)
    if (asphalt)
      asphalt.setAttribute(
        'color',
        new Float32BufferAttribute(
          new Float32Array(asphalt.getAttribute('position').count * 3),
          3,
        ),
      )
    if (routes)
      routes.setAttribute(
        'color',
        new Float32BufferAttribute(
          new Float32Array(routes.getAttribute('position').count * 4),
          4,
        ),
      )
    const marks = model.roads.flatMap((r) =>
      Array.from({ length: Math.floor(r.length / 0.85) }, (_, i) => {
        const f = i / Math.max(1, Math.floor(r.length / 0.85)),
          p = r.curve.getPointAt(f),
          t = r.curve.getTangentAt(f)
        return { p, angle: Math.atan2(t.x, t.z) }
      }),
    )
    return {
      asphalt,
      sidewalk,
      routes,
      enabled,
      marks,
      closed: model.roads.filter((r) => !r.enabled),
    }
  }, [model])
  useEffect(
    () => () => {
      resources.asphalt?.dispose()
      resources.sidewalk?.dispose()
      resources.routes?.dispose()
    },
    [resources],
  )
  useLayoutEffect(() => {
    const o = new Object3D(),
      c = new Color()
    resources.marks.forEach((m, i) => {
      o.position.set(m.p.x, 0.05, m.p.z)
      o.rotation.y = m.angle
      o.updateMatrix()
      markers.current!.setMatrixAt(i, o.matrix)
    })
    markers.current!.instanceMatrix.needsUpdate = true
    resources.closed.forEach((r, i) => {
      const p = r.curve.getPointAt(0.5)
      for (let k = 0; k < 2; k++) {
        o.position.set(p.x, 0.15, p.z)
        o.rotation.y = Math.PI / 4 + (k * Math.PI) / 2
        o.updateMatrix()
        barriers.current!.setMatrixAt(i * 2 + k, o.matrix)
      }
    })
    barriers.current!.instanceMatrix.needsUpdate = true
    const verticesPerRoad = (ROAD_SEGMENTS + 1) * 2
    const asphalt = resources.asphalt?.getAttribute('color')
    if (asphalt) {
      model.roads.forEach((r, i) => {
        c.set(
          !r.enabled
            ? '#76818a'
            : selectedId && r.id !== selectedId
              ? '#617075'
              : '#374b55',
        )
        for (let k = 0; k < verticesPerRoad; k++)
          asphalt.setXYZ(i * verticesPerRoad + k, c.r, c.g, c.b)
      })
      asphalt.needsUpdate = true
    }
    const route = resources.routes?.getAttribute('color')
    if (route) {
      const target = new Float32Array(route.count * 4)
      resources.enabled.forEach((r, i) => {
        c.set(
          utilization
            ? utilizationColor(r.utilization, true, thresholds)
            : '#38d1b0',
        )
        const alpha = selectedId
          ? selectedId === r.id
            ? 0.85
            : 0.12
          : dusk
            ? 0.68
            : 0.58
        for (let k = 0; k < verticesPerRoad; k++) {
          const offset = (i * verticesPerRoad + k) * 4
          target.set([c.r, c.g, c.b, alpha], offset)
        }
      })
      transition.current = { target, remaining: reduced ? 0 : 0.35 }
      if (reduced) {
        route.array.set(target)
        route.needsUpdate = true
      }
    }
  }, [model, resources, selectedId, utilization, thresholds, dusk, reduced])
  useFrame((_, delta) => {
    const state = transition.current,
      attribute = resources.routes?.getAttribute('color')
    if (!attribute || !state.target || state.remaining <= 0) return
    state.remaining -= delta
    if (state.remaining <= 0) attribute.array.set(state.target)
    else
      for (let i = 0; i < attribute.array.length; i++)
        attribute.array[i] +=
          (state.target[i] - attribute.array[i]) * Math.min(1, delta * 15)
    attribute.needsUpdate = true
  })
  const selected = model.roads.find((r) => r.id === selectedId),
    mid = selected?.curve.getPointAt(0.5)
  return (
    <group>
      {resources.sidewalk && (
        <mesh geometry={resources.sidewalk} receiveShadow>
          <meshStandardMaterial color="#c6c8be" />
        </mesh>
      )}
      {resources.asphalt && (
        <mesh
          geometry={resources.asphalt}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation()
            const r =
              model.roads[Math.floor((e.faceIndex ?? 0) / (ROAD_SEGMENTS * 2))]
            if (r) onSelect({ type: 'road', id: r.id })
          }}
        >
          <meshStandardMaterial vertexColors roughness={0.98} />
        </mesh>
      )}
      {resources.routes && (
        <mesh geometry={resources.routes}>
          <meshBasicMaterial
            vertexColors
            transparent
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}
      <instancedMesh
        ref={markers}
        args={[undefined, undefined, resources.marks.length]}
      >
        <boxGeometry args={[0.025, 0.012, 0.3]} />
        <meshBasicMaterial color="#e0ded0" />
      </instancedMesh>
      <instancedMesh
        ref={barriers}
        args={[undefined, undefined, resources.closed.length * 2]}
      >
        <boxGeometry args={[1.12, 0.22, 0.12]} />
        <meshStandardMaterial color="#ed986c" />
      </instancedMesh>
      {selected && mid && (
        <SceneLabel
          position={[mid.x, 1.1, mid.z]}
          text={selected.id}
          detail={
            selected.enabled
              ? selected.utilization === null
                ? 'Sin flujo calculado'
                : selected.utilization.toFixed(1) + ' % utilización'
              : 'Vía cerrada'
          }
        />
      )}
    </group>
  )
}
export function Junctions({
  model,
  selection,
  onSelect,
}: {
  model: CityModel
  selection: Selection
  onSelect: SceneProps['onSelect']
}) {
  const circles = useRef<InstancedMesh>(null),
    rings = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const o = new Object3D()
    model.nodes.forEach((n, i) => {
      o.position.copy(n.position)
      o.position.y = 0.04
      o.updateMatrix()
      circles.current!.setMatrixAt(i, o.matrix)
      o.position.y = 0.07
      o.rotation.x = -Math.PI / 2
      o.updateMatrix()
      rings.current!.setMatrixAt(i, o.matrix)
      o.rotation.x = 0
    })
    circles.current!.instanceMatrix.needsUpdate = true
    rings.current!.instanceMatrix.needsUpdate = true
  }, [model])
  return (
    <group>
      <instancedMesh
        ref={circles}
        args={[undefined, undefined, model.nodes.length]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          const n = model.nodes[e.instanceId ?? 0]
          if (n) onSelect({ type: 'node', id: n.id })
        }}
      >
        <cylinderGeometry args={[0.85, 0.85, 0.03, 24]} />
        <meshStandardMaterial color="#536773" />
      </instancedMesh>
      <instancedMesh
        ref={rings}
        args={[undefined, undefined, model.nodes.length]}
      >
        <ringGeometry args={[0.57, 0.62, 24]} />
        <meshBasicMaterial color="#ced5c6" />
      </instancedMesh>
      {model.nodes
        .filter(
          (n) =>
            n.balance !== 0 ||
            (selection?.type === 'node' && selection.id === n.id),
        )
        .map((n) => (
          <SceneLabel
            key={n.id}
            position={[n.position.x, 0.8, n.position.z]}
            text={n.id}
            small
          />
        ))}
    </group>
  )
}
