/**
 * Sección "Relaciones":
 *  - Mapa de relaciones: diagrama libre. Arrastra desde el borde de un
 *    personaje hasta otro para crear una relación; clic en una línea para
 *    editarla. Los grupos se dibujan como un nodo unido a cada miembro.
 *    Las posiciones se guardan en `project.relationLayout`. Ctrl+Z deshace.
 *  - Árbol genealógico: se construye solo a partir de las relaciones
 *    "Progenitor de" y "Pareja" (ver familyLayout.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  SelectionMode,
  type Connection,
  type Edge,
  type NodeChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Eye, EyeOff, GitFork, Hand, Network, Redo2, Shuffle, SquareDashedMousePointer, Undo2, Users } from 'lucide-react'
import { groupWithCustom } from '@shared/labels'
import type { Id, Point, Project, RelationGroup, RelationMapState, Relationship } from '@shared/types'
import { RELATIONSHIP_KINDS } from '@shared/types'
import { useToast } from '@renderer/components/Toasts'
import { useLocalPreference } from '@renderer/hooks/useLocalPreference'
import { api, errorMessage } from '@renderer/lib/api'
import { useSettings } from '@renderer/lib/settings'
import { CharacterNode, type CharacterFlowNode } from './CharacterNode'
import { circleLayout, layoutFamily } from './familyLayout'
import { GroupDialog } from './GroupDialog'
import { GroupNode, type GroupFlowNode } from './GroupNode'
import { GroupPanel } from './GroupPanel'
import { RelationshipPanel } from './RelationshipPanel'
import { RELATION_INFO, relationColor, relationLegendKey, relationLegendLabel } from './relationOptions'
import './relations.css'

const NODE_TYPES = { character: CharacterNode, relationGroup: GroupNode }

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

/** Cambios del mapa que se pueden deshacer (los más antiguos se olvidan). */
const MAX_HISTORY = 100

type MapNode = CharacterFlowNode | GroupFlowNode
type Selection = { type: 'relationship' | 'group'; id: Id } | null

function mapStateOf(project: Project): RelationMapState {
  return { relationships: project.relationships, relationGroups: project.relationGroups, relationLayout: project.relationLayout }
}

function sameMapState(a: RelationMapState, b: RelationMapState): boolean {
  if (a.relationships === b.relationships && a.relationGroups === b.relationGroups && a.relationLayout === b.relationLayout) return true
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Historial del mapa para deshacer (Ctrl+Z) y rehacer (Ctrl+Y o Ctrl+Mayús+Z).
 *
 * Cada cambio que pasa por `record` (mover, crear, editar, borrar, agrupar)
 * guarda el estado anterior. Deshacer pide al disco que vuelva a ese estado
 * en un solo paso (`api.relations.apply`).
 */
function useRelationHistory(project: Project, onProjectChange: (project: Project) => void) {
  const past = useRef<RelationMapState[]>([])
  const future = useRef<RelationMapState[]>([])
  const current = useRef(mapStateOf(project))
  const [, refresh] = useState(0)
  /** Sube con cada deshacer/rehacer: los paneles abiertos se vuelven a montar con los datos restaurados. */
  const [restoreCount, setRestoreCount] = useState(0)
  const toast = useToast()

  // Cambios hechos fuera del mapa (p. ej. borrar un personaje): se toman como
  // punto de partida, sin guardarlos como paso que deshacer.
  useEffect(() => {
    const state = mapStateOf(project)
    if (!sameMapState(current.current, state)) current.current = state
  }, [project])

  /** Pasa un proyecto actualizado por el mapa, guardando el estado anterior. */
  const record = useCallback(
    (updated: Project) => {
      const state = mapStateOf(updated)
      if (!sameMapState(current.current, state)) {
        past.current = [...past.current, current.current].slice(-MAX_HISTORY)
        future.current = []
        current.current = state
        refresh((n) => n + 1)
      }
      onProjectChange(updated)
    },
    [onProjectChange]
  )

  const travel = async (from: typeof past, to: typeof past) => {
    const target = from.current.at(-1)
    if (!target) return
    try {
      const updated = await api.relations.apply(project.id, target)
      from.current = from.current.slice(0, -1)
      to.current = [...to.current, current.current]
      current.current = mapStateOf(updated)
      onProjectChange(updated)
      setRestoreCount((n) => n + 1)
    } catch (error) {
      toast.error(`No se pudo deshacer: ${errorMessage(error)}`)
    }
  }

  return {
    record,
    undo: () => travel(past, future),
    redo: () => travel(future, past),
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    restoreCount
  }
}

/** ¿El foco está en un campo de texto? Entonces Ctrl+Z es del campo, no del mapa. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)))
}

/** Punto medio de los miembros de un grupo (donde aparece su nodo la primera vez). */
function centroid(ids: Id[], positionOf: (id: Id) => Point | undefined): Point {
  const points = ids.map(positionOf).filter((p): p is Point => Boolean(p))
  if (points.length === 0) return { x: 0, y: 0 }
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length
  }
}

function RelationMap({
  project,
  onProjectChange,
  colorMode
}: RelationsViewProps & { colorMode: 'light' | 'dark' }) {
  const [selection, setSelection] = useState<Selection>(null)
  /** Grupos de la leyenda ocultos (ver `relationLegendKey`; los grupos usan `group:<id>`). */
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showLabels, setShowLabels] = useLocalPreference('relations.showLabels', true)
  const [creatingGroup, setCreatingGroup] = useState(false)
  /** Arrastrar sobre el lienzo selecciona por área (si no, lo mueve; con Mayús siempre selecciona). */
  const [areaSelect, setAreaSelect] = useLocalPreference('relations.areaSelect', false)
  const toast = useToast()
  const history = useRelationHistory(project, onProjectChange)
  const { record, restoreCount } = history

  const [nodes, setNodes] = useState<MapNode[]>([])
  const restoredRef = useRef(restoreCount)
  // Reconstruye los nodos si cambian los personajes o los grupos, conservando
  // las posiciones en pantalla (salvo tras deshacer: entonces manda lo guardado).
  useEffect(() => {
    setNodes((previous) => {
      const restored = restoredRef.current !== restoreCount
      restoredRef.current = restoreCount
      const onScreen = restored ? new Map<Id, Point>() : new Map(previous.map((n) => [n.id, n.position]))
      const fallback = circleLayout(project.characters.map((c) => c.id))
      const positionOf = (id: Id) => onScreen.get(id) ?? project.relationLayout[id] ?? fallback.get(id)
      const characterNodes: MapNode[] = project.characters.map((character) => ({
        id: character.id,
        type: 'character' as const,
        position: positionOf(character.id)!,
        data: { character, projectId: project.id }
      }))
      const groupNodes: MapNode[] = project.relationGroups.map((group) => ({
        id: group.id,
        type: 'relationGroup' as const,
        position: positionOf(group.id) ?? centroid(group.memberIds, positionOf),
        data: { group },
        connectable: false
      }))
      return [...characterNodes, ...groupNodes]
    })
  }, [project.characters, project.relationGroups, project.relationLayout, project.id, restoreCount])

  // Guardar posiciones al soltar (sin esperar): así Ctrl+Z justo después ya
  // encuentra el movimiento en el historial.
  const layoutSave = useRef<Promise<void>>(Promise.resolve())
  const persist = (list: MapNode[]) => {
    const layout = Object.fromEntries(list.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }]))
    layoutSave.current = layoutSave.current
      .then(async () => record(await api.projects.update(project.id, { relationLayout: layout })))
      .catch((error) => toast.error(`No se pudo guardar la posición: ${errorMessage(error)}`))
  }

  const undo = async () => {
    await layoutSave.current
    await history.undo()
  }
  const redo = async () => {
    await layoutSave.current
    await history.redo()
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        void undo()
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault()
        void redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  /** Guarda tras arrastrar uno o varios nodos (`dragged` trae su posición final). */
  const persistMoved = (dragged: { id: Id; position: Point }[]) => {
    const moved = new Map(dragged.map((d) => [d.id, d.position]))
    persist(nodes.map((n) => (moved.has(n.id) ? { ...n, position: moved.get(n.id)! } : n)))
  }

  const onNodesChange = useCallback((changes: NodeChange<MapNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current))
  }, [])

  const positions = useMemo(() => new Map(nodes.map((n) => [n.id, n.position])), [nodes])
  const selectedEdge = (type: 'relationship' | 'group', id: Id) => selection?.type === type && selection.id === id

  const edges: Edge[] = useMemo(
    () => [
      ...project.relationships
        .filter((r) => !hidden.has(relationLegendKey(r)))
        .map((r) => toEdge(r, positions, selectedEdge('relationship', r.id), showLabels)),
      ...project.relationGroups
        .filter((g) => !hidden.has(`group:${g.id}`))
        .flatMap((g) => g.memberIds.map((memberId) => toGroupEdge(g, memberId, positions, selectedEdge('group', g.id))))
    ],
    [project.relationships, project.relationGroups, hidden, positions, selection, showLabels]
  )

  const onConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return
    const isCharacter = (id: Id) => project.characters.some((c) => c.id === id)
    if (!isCharacter(connection.source) || !isCharacter(connection.target)) return
    try {
      const { project: updated, entity } = await api.entities.create(project.id, 'relationships', {
        sourceId: connection.source,
        targetId: connection.target,
        kind: 'amistad',
        label: '',
        color: '',
        notes: ''
      })
      record(updated)
      setSelection({ type: 'relationship', id: entity.id })
    } catch (error) {
      toast.error(`No se pudo crear la relación: ${errorMessage(error)}`)
    }
  }

  const createGroup = async (group: Pick<RelationGroup, 'name' | 'color' | 'memberIds'>, removeIds: Id[]) => {
    const id = crypto.randomUUID()
    const remove = new Set(removeIds)
    const layout = Object.fromEntries(nodes.map((n) => [n.id, n.position]))
    try {
      const updated = await api.relations.apply(project.id, {
        relationships: project.relationships.filter((r) => !remove.has(r.id)),
        relationGroups: [...project.relationGroups, { ...group, id, notes: '', createdAt: '', updatedAt: '' }],
        relationLayout: { ...layout, [id]: centroid(group.memberIds, (m) => layout[m]) }
      })
      record(updated)
      setSelection({ type: 'group', id })
    } catch (error) {
      toast.error(`No se pudo crear el grupo: ${errorMessage(error)}`)
    }
  }

  const selectedRelationship =
    selection?.type === 'relationship' ? (project.relationships.find((r) => r.id === selection.id) ?? null) : null
  const selectedGroup = selection?.type === 'group' ? (project.relationGroups.find((g) => g.id === selection.id) ?? null) : null
  const legend = groupWithCustom(project.relationships, RELATIONSHIP_KINDS, relationLegendKey, relationLegendLabel)
  const toggleHidden = (key: string) => {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setHidden(next)
  }

  return (
    <div className="relations-body">
      <div className="relations-canvas">
        <div className="relations-toolbar">
          <div className="relations-legend">
            {legend.map(({ key, label, items }) => (
              <button
                key={key}
                className={`legend-chip ${hidden.has(key) ? 'is-off' : ''}`}
                onClick={() => toggleHidden(key)}
                title={hidden.has(key) ? 'Mostrar' : 'Ocultar'}
              >
                <span style={{ background: relationColor(items[0]) }} />
                {label}
              </button>
            ))}
            {project.relationGroups.map((g) => (
              <button
                key={g.id}
                className={`legend-chip ${hidden.has(`group:${g.id}`) ? 'is-off' : ''}`}
                onClick={() => toggleHidden(`group:${g.id}`)}
                title={hidden.has(`group:${g.id}`) ? 'Mostrar' : 'Ocultar'}
              >
                <Users size={12} style={{ color: g.color }} />
                {g.name || 'Grupo sin nombre'}
              </button>
            ))}
            {legend.length === 0 && project.relationGroups.length === 0 && (
              <span className="faint">Arrastra desde el borde de un personaje hasta otro para crear una relación.</span>
            )}
          </div>
          <div className="relations-actions">
            <button className="icon-btn" onClick={() => void undo()} disabled={!history.canUndo} title="Deshacer (Ctrl+Z)">
              <Undo2 size={16} />
            </button>
            <button className="icon-btn" onClick={() => void redo()} disabled={!history.canRedo} title="Rehacer (Ctrl+Y)">
              <Redo2 size={16} />
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setShowLabels(!showLabels)}
              title={showLabels ? 'Ocultar los nombres de las líneas (se ven solo los colores)' : 'Mostrar los nombres de las líneas'}
            >
              {showLabels ? <Eye size={14} /> : <EyeOff size={14} />} {showLabels ? 'Nombres' : 'Solo colores'}
            </button>
            <button
              className={`btn btn-sm btn-ghost ${areaSelect ? 'is-on' : ''}`}
              onClick={() => setAreaSelect(!areaSelect)}
              aria-pressed={areaSelect}
              title={
                areaSelect
                  ? 'Arrastrar selecciona varios. Para mover el lienzo, arrastra con el botón derecho o la rueda.'
                  : 'Arrastrar mueve el lienzo. Pulsa para seleccionar varios arrastrando (o mantén Mayús).'
              }
            >
              {areaSelect ? <SquareDashedMousePointer size={14} /> : <Hand size={14} />} {areaSelect ? 'Seleccionar área' : 'Mover lienzo'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setCreatingGroup(true)} title="Agrupar personajes en un solo nodo">
              <Users size={14} /> Agrupar
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const circle = circleLayout(project.characters.map((c) => c.id))
                const placed = nodes.map((n) => (n.type === 'character' ? { ...n, position: circle.get(n.id)! } : n))
                const next = placed.map((n) =>
                  n.type === 'relationGroup' ? { ...n, position: centroid(n.data.group.memberIds, (id) => circle.get(id)) } : n
                )
                setNodes(next)
                persist(next)
              }}
            >
              <Shuffle size={14} /> Organizar en círculo
            </button>
          </div>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeDragStop={(_event, _node, dragged) => persistMoved(dragged)}
          onSelectionDragStop={(_event, dragged) => persistMoved(dragged)}
          selectionOnDrag={areaSelect}
          panOnDrag={areaSelect ? [1, 2] : true}
          selectionMode={SelectionMode.Partial}
          onNodeClick={(_e, node) => setSelection(node.type === 'relationGroup' ? { type: 'group', id: node.id } : null)}
          onConnect={onConnect}
          onEdgeClick={(_e, edge) =>
            setSelection(edge.id.startsWith('group:') ? { type: 'group', id: edge.id.split(':')[1] } : { type: 'relationship', id: edge.id })
          }
          onPaneClick={() => setSelection(null)}
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

      {selectedRelationship && (
        <RelationshipPanel
          key={`${selectedRelationship.id}:${restoreCount}`}
          project={project}
          relationship={selectedRelationship}
          onProjectChange={record}
          onClose={() => setSelection(null)}
        />
      )}
      {selectedGroup && (
        <GroupPanel
          key={`${selectedGroup.id}:${restoreCount}`}
          project={project}
          group={selectedGroup}
          onProjectChange={record}
          onClose={() => setSelection(null)}
        />
      )}

      {creatingGroup && (
        <GroupDialog
          project={project}
          initialMembers={selectedRelationship ? [selectedRelationship.sourceId, selectedRelationship.targetId] : []}
          onClose={() => setCreatingGroup(false)}
          onCreate={createGroup}
        />
      )}
    </div>
  )
}

/** Lados por los que se unen dos nodos, según su posición relativa (para que las líneas no crucen las tarjetas). */
function handlesBetween(a: Point | undefined, b: Point | undefined): [string, string] {
  if (!a || !b) return ['r', 'l']
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? ['r', 'l'] : ['l', 'r']
  return dy > 0 ? ['b', 't'] : ['t', 'b']
}

/** Convierte una relación en una línea del diagrama. */
function toEdge(r: Relationship, positions: Map<Id, Point>, selected: boolean, showLabel: boolean): Edge {
  const info = RELATION_INFO[r.kind] ?? RELATION_INFO.otro
  const color = relationColor(r)
  const [sourceHandle, targetHandle] = handlesBetween(positions.get(r.sourceId), positions.get(r.targetId))
  return {
    id: r.id,
    source: r.sourceId,
    target: r.targetId,
    sourceHandle,
    targetHandle,
    label: showLabel || selected ? r.label || info.label : undefined,
    style: { stroke: color, strokeWidth: selected ? 3.5 : 2 },
    labelStyle: { fill: 'var(--text)', fontSize: 12, fontWeight: 500 },
    labelBgStyle: { fill: 'var(--surface-raised)' },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
    markerEnd: info.directed ? { type: MarkerType.ArrowClosed, color, width: 18, height: 18 } : undefined,
    interactionWidth: 18
  }
}

/** Línea de un grupo a uno de sus miembros (id `group:<grupo>:<personaje>`). */
function toGroupEdge(g: RelationGroup, memberId: Id, positions: Map<Id, Point>, selected: boolean): Edge {
  const [sourceHandle, targetHandle] = handlesBetween(positions.get(g.id), positions.get(memberId))
  return {
    id: `group:${g.id}:${memberId}`,
    type: 'straight',
    source: g.id,
    target: memberId,
    sourceHandle,
    targetHandle,
    style: { stroke: g.color, strokeWidth: selected ? 3.5 : 2, strokeDasharray: '2 5', strokeLinecap: 'round' },
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
            stroke: relationColor(r),
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
