/**
 * Sección "Relaciones":
 *  - Mapa de relaciones: diagrama libre. Arrastra desde el borde de un
 *    personaje hasta otro para crear una relación; clic en una línea para
 *    editarla. Las posiciones se guardan en `project.relationLayout`.
 *  - Árbol genealógico: se construye solo a partir de las relaciones
 *    "Progenitor de" y "Pareja" (ver familyLayout.ts).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  type Connection,
  type Edge,
  type NodeChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { GitFork, Network, Shuffle, Users } from 'lucide-react'
import type { Id, Point, Project, Relationship, RelationshipKind } from '@shared/types'
import { RELATIONSHIP_KINDS } from '@shared/types'
import { useToast } from '@renderer/components/Toasts'
import { useDebouncedSave } from '@renderer/hooks/useDebouncedSave'
import { useLocalPreference } from '@renderer/hooks/useLocalPreference'
import { api, errorMessage } from '@renderer/lib/api'
import { useSettings } from '@renderer/lib/settings'
import { CharacterNode, type CharacterFlowNode } from './CharacterNode'
import { circleLayout, layoutFamily } from './familyLayout'
import { RelationshipPanel } from './RelationshipPanel'
import { RELATION_INFO } from './relationOptions'
import './relations.css'

const NODE_TYPES = { character: CharacterNode }

interface RelationsViewProps {
  project: Project
  onProjectChange: (project: Project) => void
}

export function RelationsView({ project, onProjectChange }: RelationsViewProps) {
  const [tab, setTab] = useLocalPreference<'map' | 'family'>('relations.tab', 'map')
  useSettings() // re-render al cambiar de tema
  const colorMode = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'

  if (project.characters.length === 0) {
    return (
      <div className="empty-state relations-empty">
        <Users size={44} />
        <h3>Primero, tu reparto</h3>
        <p>Crea personajes en la sección «Personajes» y aquí podrás dibujar cómo se relacionan y su árbol genealógico.</p>
      </div>
    )
  }

  return (
    <div className="relations">
      <header className="relations-header">
        <div className="segmented relations-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'map'} className={tab === 'map' ? 'is-active' : ''} onClick={() => setTab('map')}>
            <Network size={15} /> Mapa de relaciones
          </button>
          <button role="tab" aria-selected={tab === 'family'} className={tab === 'family' ? 'is-active' : ''} onClick={() => setTab('family')}>
            <GitFork size={15} /> Árbol genealógico
          </button>
        </div>
      </header>
      {tab === 'map' ? (
        <RelationMap project={project} onProjectChange={onProjectChange} colorMode={colorMode} />
      ) : (
        <FamilyTree project={project} colorMode={colorMode} />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Mapa de relaciones                                                         */
/* -------------------------------------------------------------------------- */

function RelationMap({
  project,
  onProjectChange,
  colorMode
}: RelationsViewProps & { colorMode: 'light' | 'dark' }) {
  const [selectedId, setSelectedId] = useState<Id | null>(null)
  const [hidden, setHidden] = useState<Set<RelationshipKind>>(new Set())
  const toast = useToast()

  const initialPositions = useCallback(
    (current: Map<Id, Point>) => {
      const fallback = circleLayout(project.characters.map((c) => c.id))
      return (id: Id) => current.get(id) ?? project.relationLayout[id] ?? fallback.get(id)!
    },
    [project.characters, project.relationLayout]
  )

  const [nodes, setNodes] = useState<CharacterFlowNode[]>([])
  // Reconstruye los nodos si cambian los personajes, conservando posiciones.
  useEffect(() => {
    setNodes((previous) => {
      const positionOf = initialPositions(new Map(previous.map((n) => [n.id, n.position])))
      return project.characters.map((character) => ({
        id: character.id,
        type: 'character' as const,
        position: positionOf(character.id),
        data: { character, projectId: project.id }
      }))
    })
  }, [project.characters, project.id, initialPositions])

  const { schedule: saveLayout } = useDebouncedSave(async (layout: Record<Id, Point>) => {
    onProjectChange(await api.projects.update(project.id, { relationLayout: layout }))
  }, 800)

  const persist = (list: CharacterFlowNode[]) =>
    saveLayout(Object.fromEntries(list.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }])))

  const onNodesChange = useCallback((changes: NodeChange<CharacterFlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current))
  }, [])

  const positions = useMemo(() => new Map(nodes.map((n) => [n.id, n.position])), [nodes])

  const edges: Edge[] = useMemo(
    () =>
      project.relationships
        .filter((r) => !hidden.has(r.kind))
        .map((r) => toEdge(r, positions, r.id === selectedId)),
    [project.relationships, hidden, positions, selectedId]
  )

  const onConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return
    try {
      const { project: updated, entity } = await api.entities.create(project.id, 'relationships', {
        sourceId: connection.source,
        targetId: connection.target,
        kind: 'amistad',
        label: '',
        notes: ''
      })
      onProjectChange(updated)
      setSelectedId(entity.id)
    } catch (error) {
      toast.error(`No se pudo crear la relación: ${errorMessage(error)}`)
    }
  }

  const selected = project.relationships.find((r) => r.id === selectedId) ?? null
  const usedKinds = RELATIONSHIP_KINDS.filter((k) => project.relationships.some((r) => r.kind === k))

  return (
    <div className="relations-body">
      <div className="relations-canvas">
        <div className="relations-toolbar">
          <div className="relations-legend">
            {usedKinds.map((kind) => (
              <button
                key={kind}
                className={`legend-chip ${hidden.has(kind) ? 'is-off' : ''}`}
                onClick={() => {
                  const next = new Set(hidden)
                  if (next.has(kind)) next.delete(kind)
                  else next.add(kind)
                  setHidden(next)
                }}
                title={hidden.has(kind) ? 'Mostrar' : 'Ocultar'}
              >
                <span style={{ background: RELATION_INFO[kind].color }} />
                {RELATION_INFO[kind].label}
              </button>
            ))}
            {usedKinds.length === 0 && (
              <span className="faint">Arrastra desde el borde de un personaje hasta otro para crear una relación.</span>
            )}
          </div>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              const circle = circleLayout(project.characters.map((c) => c.id))
              const next = nodes.map((n) => ({ ...n, position: circle.get(n.id)! }))
              setNodes(next)
              persist(next)
            }}
          >
            <Shuffle size={14} /> Organizar en círculo
          </button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeDragStop={(_event, _node, dragged) => {
            // `dragged` trae la posición final (el estado aún puede no reflejarla).
            const moved = new Map(dragged.map((d) => [d.id, d.position]))
            persist(nodes.map((n) => (moved.has(n.id) ? { ...n, position: moved.get(n.id)! } : n)))
          }}
          onConnect={onConnect}
          onEdgeClick={(_e, edge) => setSelectedId(edge.id)}
          onPaneClick={() => setSelectedId(null)}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={null}
          colorMode={colorMode}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {selected && (
        <RelationshipPanel
          key={selected.id}
          project={project}
          relationship={selected}
          onProjectChange={onProjectChange}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

/**
 * Convierte una relación en una línea del diagrama. Elige los lados de
 * conexión según la posición relativa de los personajes, para que las
 * líneas no crucen por encima de las tarjetas.
 */
function toEdge(r: Relationship, positions: Map<Id, Point>, selected: boolean): Edge {
  const info = RELATION_INFO[r.kind]
  const a = positions.get(r.sourceId)
  const b = positions.get(r.targetId)
  let sourceHandle = 'r'
  let targetHandle = 'l'
  if (a && b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.abs(dx) > Math.abs(dy)) [sourceHandle, targetHandle] = dx > 0 ? ['r', 'l'] : ['l', 'r']
    else [sourceHandle, targetHandle] = dy > 0 ? ['b', 't'] : ['t', 'b']
  }
  return {
    id: r.id,
    source: r.sourceId,
    target: r.targetId,
    sourceHandle,
    targetHandle,
    label: r.label || info.label,
    style: { stroke: info.color, strokeWidth: selected ? 3.5 : 2 },
    labelStyle: { fill: 'var(--text)', fontSize: 12, fontWeight: 500 },
    labelBgStyle: { fill: 'var(--surface-raised)' },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
    markerEnd: info.directed ? { type: MarkerType.ArrowClosed, color: info.color, width: 18, height: 18 } : undefined,
    interactionWidth: 18
  }
}

/* -------------------------------------------------------------------------- */
/* Árbol genealógico                                                          */
/* -------------------------------------------------------------------------- */

function FamilyTree({ project, colorMode }: { project: Project; colorMode: 'light' | 'dark' }) {
  const { nodes, edges, outside, lineagesShown } = useMemo(() => {
    const layout = layoutFamily(project.relationships)
    const lineageOf = (id: Id | null) => project.lineages.find((l) => l.id === id) ?? null
    const nodes: CharacterFlowNode[] = project.characters
      .filter((c) => layout.members.has(c.id))
      .map((character) => ({
        id: character.id,
        type: 'character' as const,
        position: layout.positions.get(character.id)!,
        data: { character, projectId: project.id, lineage: lineageOf(character.lineageId) },
        draggable: false,
        connectable: false
      }))
    const edges: Edge[] = project.relationships
      .filter((r) => r.kind === 'progenitor' || r.kind === 'pareja')
      .map((r) => {
        const isParent = r.kind === 'progenitor'
        // Pareja: de izquierda a derecha según su posición en la fila.
        const [left, right] =
          (layout.positions.get(r.sourceId)?.x ?? 0) <= (layout.positions.get(r.targetId)?.x ?? 0)
            ? [r.sourceId, r.targetId]
            : [r.targetId, r.sourceId]
        return {
          id: r.id,
          source: isParent ? r.sourceId : left,
          target: isParent ? r.targetId : right,
          sourceHandle: isParent ? 'b' : 'r',
          targetHandle: isParent ? 't' : 'l',
          type: isParent ? 'smoothstep' : 'straight',
          style: {
            stroke: RELATION_INFO[r.kind].color,
            strokeWidth: 2,
            strokeDasharray: isParent ? undefined : '6 4'
          }
        }
      })
    const outside = project.characters.filter((c) => !layout.members.has(c.id)).length
    const lineagesShown = project.lineages.filter((l) => nodes.some((n) => n.data.character.lineageId === l.id))
    return { nodes, edges, outside, lineagesShown }
  }, [project.relationships, project.characters, project.lineages, project.id])

  if (nodes.length === 0) {
    return (
      <div className="empty-state relations-empty">
        <GitFork size={44} />
        <h3>Aún no hay familias</h3>
        <p>
          En el «Mapa de relaciones», crea relaciones de tipo <strong>Progenitor de</strong> (de padre o madre a hijo/a) y{' '}
          <strong>Pareja</strong>. El árbol se dibujará solo.
        </p>
      </div>
    )
  }

  return (
    <div className="relations-body">
      <div className="relations-canvas">
        <div className="relations-toolbar">
          <div className="relations-legend">
            <span className="legend-chip is-static">
              <span style={{ background: RELATION_INFO.progenitor.color }} /> Progenitor → hijo/a
            </span>
            <span className="legend-chip is-static">
              <span className="is-dashed" style={{ borderColor: RELATION_INFO.pareja.color }} /> Pareja
            </span>
            {lineagesShown.map((l) => (
              <span key={l.id} className="legend-chip is-static" title="Linaje">
                <span className="is-box" style={{ borderColor: l.color }} /> {l.name}
              </span>
            ))}
          </div>
          {outside > 0 && <span className="faint">{outside} personajes sin relaciones familiares no se muestran</span>}
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          nodesConnectable={false}
          // Loose: los puntos de conexión son todos de tipo "source"; en modo
          // estricto xyflow descartaría las líneas entre ellos.
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={null}
          colorMode={colorMode}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
