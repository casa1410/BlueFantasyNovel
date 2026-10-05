import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Users } from 'lucide-react'
import type { RelationGroup } from '@shared/types'

export type GroupNodeData = { group: RelationGroup }
// Tipo 'relationGroup' y no 'group': React Flow ya tiene un nodo 'group' con estilos propios.
export type GroupFlowNode = Node<GroupNodeData, 'relationGroup'>

/**
 * Nodo de un grupo en el mapa de relaciones: de él sale una línea a cada
 * miembro. Sus puntos de conexión solo sirven para esas líneas (no se pueden
 * crear relaciones desde un grupo).
 */
export function GroupNode({ data, selected }: NodeProps<GroupFlowNode>) {
  const { group } = data
  const count = group.memberIds.length
  return (
    <div className={`group-node ${selected ? 'is-selected' : ''}`} style={{ borderColor: group.color }}>
      <span className="group-node-icon" style={{ background: group.color }}>
        <Users size={14} />
      </span>
      <div className="group-node-text">
        <strong>{group.name || 'Grupo sin nombre'}</strong>
        <small>
          {count} {count === 1 ? 'miembro' : 'miembros'}
        </small>
      </div>
      <Handle type="source" position={Position.Top} id="t" isConnectable={false} />
      <Handle type="source" position={Position.Right} id="r" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} id="b" isConnectable={false} />
      <Handle type="source" position={Position.Left} id="l" isConnectable={false} />
    </div>
  )
}
