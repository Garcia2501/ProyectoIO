import { Background, Controls, Handle, MarkerType, Position, ReactFlow, useNodesState } from '@xyflow/react'
import type { Edge, Node, NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { referenceScenario } from './referenceScenario'
import { useMemo } from 'react'

type ZoneNode = Node<{ label: string; balance: number }, 'zone'>

function Zone({ id, data }: NodeProps<ZoneNode>) {
  const kind = data.balance > 0 ? 'supply' : data.balance < 0 ? 'demand' : 'transit'
  return (
    <div className={`zone zone--${kind}`}>
      <Handle type="target" position={Position.Left} />
      <span className="zone-id">{id}</span>
      <strong>{data.label}</strong>
      <span className="zone-balance">{data.balance > 0 ? '+' : ''}{data.balance} veh.</span>
      <Handle type="source" position={Position.Right} />
      <Handle id="bypass-out" type="source" position={Position.Bottom} style={{ left: '65%' }} />
      <Handle id="bypass-in" type="target" position={Position.Bottom} style={{ left: '35%' }} />
    </div>
  )
}
const nodeTypes = { zone: Zone }
const initialNodes: ZoneNode[] = referenceScenario.nodes.map(node => ({
  // Spread the reference coordinates visually so road labels remain readable.
  id: node.id, type: 'zone', position: { x: node.x * 1.6, y: node.y },
  data: { label: node.label, balance: node.balance },
}))
interface Props { selectedRoadId: string | null; onSelectRoad: (id: string | null) => void }

export function NetworkCanvas({ selectedRoadId, onSelectRoad }: Props) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const edges = useMemo<Edge[]>(() => referenceScenario.roads.map(road => ({
    id: road.id, source: road.source, target: road.target,
    type: 'smoothstep',
    ...(road.id === 'R3' ? { sourceHandle: 'bypass-out', targetHandle: 'bypass-in', pathOptions: { offset: 85, borderRadius: 16 } } : {}),
    label: `${road.id} · c ${road.unit_cost} / cap ${road.capacity}`,
    selected: selectedRoadId === road.id,
    markerEnd: { type: MarkerType.ArrowClosed, color: selectedRoadId === road.id ? '#0d9488' : '#718581' },
    style: { stroke: selectedRoadId === road.id ? '#0d9488' : '#718581', strokeWidth: selectedRoadId === road.id ? 3 : 2 },
    labelStyle: { fill: '#29433e', fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: '#fff' }, labelBgPadding: [6, 5], interactionWidth: 28,
    ariaLabel: `Vía ${road.id}, de ${road.source} a ${road.target}`,
  })), [selectedRoadId])
  return (
    <div className="network-canvas" aria-label="Lienzo de red vial">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
        onEdgeClick={(_, edge) => onSelectRoad(edge.id)}
        onPaneClick={() => onSelectRoad(null)}
        nodesConnectable={false} edgesReconnectable={false} fitView fitViewOptions={{ padding: 0.28 }}
        minZoom={0.4} maxZoom={2} proOptions={{ hideAttribution: false }}>
        <Background color="#ccd7d3" gap={22} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

