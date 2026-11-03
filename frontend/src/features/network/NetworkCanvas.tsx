import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useNodesState,
} from '@xyflow/react'
import type {
  Connection,
  Edge,
  Node,
  NodeProps,
  ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { NetworkNode, Scenario } from '../../types/network'
import type { StoredResult } from '../../types/results'
import type { Selection } from '../scenarios/useWorkspace'
import { MapBackdrop } from '../../components/MapBackdrop'

type ZoneNode = Node<{ label: string; balance: number }, 'zone'>
const Zone = memo(function Zone({ id, data }: NodeProps<ZoneNode>) {
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
})
const nodeTypes = { zone: Zone }
const snapGrid: [number, number] = [20, 20]
const normalFitOptions = { padding: 0.2 }
const compactFitOptions = { padding: 0.12 }
const visualY = (id: string) => (id === 'B' ? 35 : id === 'C' ? 60 : 0)
type NodePosition = Pick<NetworkNode, 'id' | 'x' | 'y'>
function projectNodes(
  source: NetworkNode[],
  selection?: Selection,
): ZoneNode[] {
  return source.map((n) => ({
    id: n.id,
    type: 'zone',
    position: { x: n.x * 2.5, y: n.y + visualY(n.id) },
    data: { label: n.label, balance: n.balance },
    selected: selection?.type === 'node' && selection.id === n.id,
  }))
}
interface Props {
  scenario: Scenario
  selection?: Selection
  onSelect?: (s: Selection) => void
  onChange?: (s: Scenario) => void
  onPositionsChange?: (positions: NodePosition[]) => void
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
  onPositionsChange,
  editing = false,
  snap = false,
  grid = false,
  result,
  compact = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const fitFrame = useRef(0)
  const projectedNodes = useMemo(
    () => projectNodes(scenario.nodes, selection),
    [scenario.nodes, selection],
  )
  const [nodes, setNodes, onNodesChange] =
    useNodesState<ZoneNode>(projectedNodes)
  // Only reconcile external edits/selection. Pointer movement is owned by
  // onNodesChange, retaining React Flow's measured dimensions and drag flags.
  useEffect(() => {
    setNodes((current) => {
      const previous = new Map(current.map((node) => [node.id, node]))
      const next = projectedNodes.map((projected) => {
        const old = previous.get(projected.id)
        if (!old) return projected
        const position =
          old.dragging ||
          (old.position.x === projected.position.x &&
            old.position.y === projected.position.y)
            ? old.position
            : projected.position
        const data =
          old.data.label === projected.data.label &&
          old.data.balance === projected.data.balance
            ? old.data
            : projected.data
        if (
          position === old.position &&
          data === old.data &&
          old.selected === projected.selected
        )
          return old
        return { ...old, position, data, selected: projected.selected }
      })
      return next.length === current.length &&
        next.every((node, i) => node === current[i])
        ? current
        : next
    })
  }, [projectedNodes, setNodes])
  const [instance, setInstance] = useState<ReactFlowInstance<
    ZoneNode,
    Edge
  > | null>(null)
  useEffect(() => {
    if (!instance || !container.current) return
    const observer = new ResizeObserver(() => {
      // Selection can change panel/scrollbar dimensions. Never schedule a
      // viewport fit during a gesture, even if the frame runs after release.
      if (dragging.current) return
      cancelAnimationFrame(fitFrame.current)
      fitFrame.current = requestAnimationFrame(() => {
        if (dragging.current) return
        void instance.fitView({ padding: compact ? 0.12 : 0.2 })
      })
    })
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(fitFrame.current)
    }
  }, [instance, compact])
  const onDragStart = useCallback(
    (_: unknown, node: ZoneNode) => {
      dragging.current = true
      cancelAnimationFrame(fitFrame.current)
      onSelect?.({ type: 'node', id: node.id })
    },
    [onSelect],
  )
  const onDragStop = useCallback(
    (_: unknown, node: ZoneNode, moved: ZoneNode[]) => {
      dragging.current = false
      const positions = (moved.length ? moved : [node]).map((n) => ({
        id: n.id,
        x: n.position.x / 2.5,
        y: n.position.y - visualY(n.id),
      }))
      if (onPositionsChange) onPositionsChange(positions)
      else
        onChange?.({
          ...scenario,
          nodes: scenario.nodes.map((n) => {
            const position = positions.find((p) => p.id === n.id)
            return position ? { ...n, ...position } : n
          }),
        })
    },
    [scenario, onChange, onPositionsChange],
  )
  const selectNode = useCallback(
    (_: unknown, node: ZoneNode) => onSelect?.({ type: 'node', id: node.id }),
    [onSelect],
  )
  const selectEdge = useCallback(
    (_: unknown, edge: Edge) => onSelect?.({ type: 'road', id: edge.id }),
    [onSelect],
  )
  const clearSelection = useCallback(() => onSelect?.(null), [onSelect])
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
          className:
            flow !== undefined && flow > 0 && r.enabled
              ? 'has-flow'
              : undefined,
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
  const connect = useCallback(
    (c: Connection) => {
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
    },
    [scenario, onChange, onSelect],
  )
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
        onNodesChange={onNodesChange}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={compact ? compactFitOptions : normalFitOptions}
        onNodeClick={selectNode}
        onEdgeClick={selectEdge}
        onNodeDragStart={onDragStart}
        onNodeDragStop={onDragStop}
        onPaneClick={clearSelection}
        onConnect={connect}
        nodesDraggable={!compact}
        nodesConnectable={editing}
        edgesReconnectable={false}
        deleteKeyCode={null}
        snapToGrid={snap}
        snapGrid={snapGrid}
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
