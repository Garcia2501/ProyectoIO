import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
} from '@xyflow/react'
import type {
  Connection,
  Edge,
  Node,
  NodeProps,
  ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
import type { Selection } from '../scenarios/useWorkspace'
import { MapBackdrop } from '../../components/MapBackdrop'

type ZoneNode = Node<{ label: string; balance: number }, 'zone'>
function Zone({ id, data }: NodeProps<ZoneNode>) {
  const kind =
    data.balance > 0 ? 'supply' : data.balance < 0 ? 'demand' : 'transit'
  return (
    <div className={'zone zone--' + kind}>
      <Handle type="target" position={Position.Left} />
      <span className="zone-id">{id}</span>
      <strong>{data.label}</strong>
      <span className="zone-balance">
        {data.balance > 0 ? '+' : ''}
        {data.balance} veh.
      </span>
      <Handle type="source" position={Position.Right} />
      <Handle id="bypass-out" type="source" position={Position.Bottom} />
      <Handle id="bypass-in" type="target" position={Position.Bottom} />
    </div>
  )
}
const nodeTypes = { zone: Zone }
interface Props {
  scenario: Scenario
  selection?: Selection
  onSelect?: (s: Selection) => void
  onChange?: (s: Scenario) => void
  editing?: boolean
  snap?: boolean
  grid?: boolean
  result?: StoredResult | null
  compact?: boolean
}
export function NetworkCanvas({
  scenario,
  selection,
  onSelect,
  onChange,
  editing = false,
  snap = false,
  grid = false,
  result,
  compact = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const [instance, setInstance] = useState<ReactFlowInstance<
    ZoneNode,
    Edge
  > | null>(null)
  useEffect(() => {
    if (!instance || !container.current) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        void instance.fitView({ padding: compact ? 0.12 : 0.2 })
      })
    })
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [instance, compact])
  const nodes = useMemo<ZoneNode[]>(
    () =>
      scenario.nodes.map((n) => ({
        id: n.id,
        type: 'zone',
        position: {
          x: n.x * 2.5,
          y: n.y + (n.id === 'B' ? 35 : n.id === 'C' ? 60 : 0),
        },
        data: { label: n.label, balance: n.balance },
        selected: selection?.type === 'node' && selection.id === n.id,
      })),
    [scenario.nodes, selection],
  )
  const edges = useMemo<Edge[]>(
    () =>
      scenario.roads.map((r, i) => {
        const color = !r.enabled
          ? '#e0444e'
          : i % 3 === 2
            ? '#239d96'
            : '#198d18'
        const selected = selection?.type === 'road' && selection.id === r.id
        const flow =
          result?.data.status === 'optimal'
            ? result.data.roads.find((a) => a.id === r.id)?.flow
            : undefined
        return {
          id: r.id,
          source: r.source,
          target: r.target,
          type: 'smoothstep',
          ...(r.source === scenario.nodes[0]?.id &&
          r.target === scenario.nodes[2]?.id
            ? {
                sourceHandle: 'bypass-out',
                targetHandle: 'bypass-in',
                pathOptions: { offset: 85, borderRadius: 45 },
              }
            : { pathOptions: { borderRadius: 32 } }),
          label: r.enabled
            ? r.id +
              ' · c:' +
              r.unit_cost +
              ' / cap:' +
              r.capacity +
              (flow !== undefined ? ' · f:' + flow : '')
            : r.id + ' · CERRADA',
          selected,
          style: {
            stroke: color,
            strokeWidth: selected ? 4 : 3,
            strokeDasharray: r.enabled ? undefined : '8 6',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 18,
            height: 18,
          },
          labelStyle: {
            fontSize: 11,
            fontWeight: 650,
            fill: r.enabled ? '#173a35' : '#bc2533',
          },
          labelBgStyle: {
            fill: '#ffffff',
            stroke: selected ? '#2f9feb' : r.enabled ? '#9ccdb0' : '#ef9ca2',
            strokeWidth: 1,
          },
          labelBgPadding: [10, 5] as [number, number],
          labelBgBorderRadius: 10,
          interactionWidth: 30,
          ariaLabel: 'Vía ' + r.id + ', de ' + r.source + ' a ' + r.target,
        }
      }),
    [scenario, result, selection],
  )
  const connect = (c: Connection) => {
    if (c.source && c.target && c.source !== c.target && onChange) {
      let id = 'R' + (scenario.roads.length + 1)
      while (scenario.roads.some((r) => r.id === id)) id += 'n'
      onChange({
        ...scenario,
        roads: [
          ...scenario.roads,
          {
            id,
            source: c.source,
            target: c.target,
            capacity: 100,
            unit_cost: 1,
            enabled: true,
          },
        ],
      })
      onSelect?.({ type: 'road', id })
    }
  }
  return (
    <div
      className={'network-canvas ' + (compact ? 'compact' : '')}
      aria-label="Lienzo de red vial"
      ref={container}
    >
      <MapBackdrop />
      <ReactFlow
        onInit={setInstance}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: compact ? 0.12 : 0.2 }}
        onNodeClick={(_, n) => onSelect?.({ type: 'node', id: n.id })}
        onEdgeClick={(_, e) => onSelect?.({ type: 'road', id: e.id })}
        onNodeDrag={(_, n) =>
          onChange?.({
            ...scenario,
            nodes: scenario.nodes.map((item) =>
              item.id === n.id
                ? {
                    ...item,
                    x: n.position.x / 2.5,
                    y:
                      n.position.y -
                      (n.id === 'B' ? 35 : n.id === 'C' ? 60 : 0),
                  }
                : item,
            ),
          })
        }
        onPaneClick={() => onSelect?.(null)}
        onConnect={connect}
        nodesDraggable={!compact}
        nodesConnectable={editing}
        edgesReconnectable={false}
        deleteKeyCode={null}
        snapToGrid={snap}
        snapGrid={[20, 20]}
        minZoom={0.15}
        maxZoom={2.5}
        id={compact ? 'map-' + scenario.scenario_name : undefined}
      >
        {grid && <Background gap={20} color="#adc3c5" />}
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="map-legend">
        <span>
          <i className="dot green" />
          Origen
        </span>
        <span>
          <i className="dot gray" />
          Tránsito
        </span>
        <span>
          <i className="dot blue" />
          Destino
        </span>
        {scenario.roads.some((r) => !r.enabled) && (
          <span>
            <i className="dot red" />
            Vía cerrada
          </span>
        )}
      </div>
      <span className="map-caption">
        Fondo ilustrativo · sin escala geográfica
      </span>
    </div>
  )
}
