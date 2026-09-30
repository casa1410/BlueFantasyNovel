import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { Character, Id } from '@shared/types'
import { EntityThumb } from '@renderer/components/EntityThumb'
import { initials } from '@renderer/lib/covers'
import { ROLE_LABELS } from '../characters/characterOptions'

export type CharacterNodeData = {
  character: Character
  projectId: Id
  /** Linaje del personaje (el árbol genealógico colorea por linaje). */
  lineage?: { name: string; color: string } | null
}
export type CharacterFlowNode = Node<CharacterNodeData, 'character'>

/**
 * Nodo de personaje en los diagramas. Tiene un punto de conexión en cada
 * lado; en modo "Loose" cualquiera sirve de origen o destino.
 */
export function CharacterNode({ data, selected }: NodeProps<CharacterFlowNode>) {
  const { character: c, projectId, lineage } = data
  return (
    <div className={`character-node ${selected ? 'is-selected' : ''}`} style={{ borderColor: lineage?.color ?? c.color }}>
      <EntityThumb projectId={projectId} image={c.image} color={c.color} fallback={initials(c.name)} size={36} />
      <div className="character-node-text">
        <strong>{c.name || 'Sin nombre'}</strong>
        <small>{lineage ? lineage.name : ROLE_LABELS[c.role]}</small>
      </div>
      <Handle type="source" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
    </div>
  )
}
