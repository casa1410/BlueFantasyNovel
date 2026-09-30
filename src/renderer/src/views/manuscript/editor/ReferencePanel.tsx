/**
 * Panel lateral del editor:
 *  - Consulta rápida de fichas (personajes, linajes, razas, lore, glosario,
 *    criaturas) con inserción de su nombre en el texto.
 *  - Comentarios al margen del capítulo abierto.
 *
 * Para añadir una pestaña de fichas, añade su entrada en `TABS` con una
 * función que convierta cada ficha en un `ReferenceItem`.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BookA,
  Check,
  ChevronDown,
  CornerDownLeft,
  Crown,
  Dna,
  LocateFixed,
  MessageSquare,
  PawPrint,
  ScrollText,
  Search,
  Trash2,
  Users,
  X,
  type LucideIcon
} from 'lucide-react'
import type { Id, MarginComment, Project } from '@shared/types'
import { EntityThumb } from '@renderer/components/EntityThumb'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { api } from '@renderer/lib/api'
import { initials } from '@renderer/lib/covers'
import { relativeTime } from '@renderer/lib/format'
import { CREATURE_TYPE_LABELS, DANGER_LABELS } from '../../bestiary/bestiaryOptions'
import { ROLE_LABELS } from '../../characters/characterOptions'
import { LORE_CATEGORY_INFO } from '../../lore/loreOptions'

/** Forma común con la que el panel pinta cualquier tipo de ficha. */
interface ReferenceItem {
  id: Id
  name: string
  subtitle: string
  thumb: ReactNode
  details: { label: string; value: string }[]
}

export type ReferenceTabId = 'characters' | 'lineages' | 'races' | 'lore' | 'glossary' | 'creatures' | 'comments'

interface TabDefinition {
  id: Exclude<ReferenceTabId, 'comments'>
  label: string
  icon: LucideIcon
  items: (project: Project) => ReferenceItem[]
}

const nameOf = (list: { id: Id; name: string }[], id: Id | null) => list.find((x) => x.id === id)?.name ?? ''

const TABS: TabDefinition[] = [
  {
    id: 'characters',
    label: 'Personajes',
    icon: Users,
    items: (project) =>
      project.characters.map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: [ROLE_LABELS[c.role], nameOf(project.races, c.raceId), nameOf(project.lineages, c.lineageId)].filter(Boolean).join(' · '),
        thumb: <EntityThumb projectId={project.id} image={c.image} color={c.color} fallback={initials(c.name)} />,
        details: [
          { label: 'Edad', value: c.age },
          { label: 'Apariencia', value: c.appearance },
          { label: 'Personalidad', value: c.personality },
          { label: 'Motivación', value: c.motivation },
          { label: 'Miedos', value: c.fears },
          { label: 'Arco', value: c.arc },
          { label: 'Notas', value: c.notes }
        ]
      }))
  },
  {
    id: 'lineages',
    label: 'Linajes',
    icon: Crown,
    items: (project) =>
      project.lineages.map((l) => ({
        id: l.id,
        name: l.name,
        subtitle: l.motto ? `«${l.motto}»` : 'Linaje',
        thumb: <EntityThumb projectId={project.id} image={l.image} color={l.color} shape="rounded" fallback={<Crown size={16} />} />,
        details: [
          { label: 'Miembros', value: project.characters.filter((c) => c.lineageId === l.id).map((c) => c.name).join(', ') },
          { label: 'Historia', value: l.description }
        ]
      }))
  },
  {
    id: 'races',
    label: 'Razas',
    icon: Dna,
    items: (project) =>
      project.races.map((r) => ({
        id: r.id,
        name: r.name,
        subtitle: r.lifespan || 'Raza',
        thumb: <EntityThumb projectId={project.id} image={r.image} color={r.color} shape="rounded" fallback={initials(r.name)} />,
        details: [
          { label: 'Apariencia', value: r.appearance },
          { label: 'Dónde viven', value: r.homeland },
          { label: 'Cultura', value: r.culture },
          { label: 'Habilidades', value: r.abilities }
        ]
      }))
  },
  {
    id: 'lore',
    label: 'Lore',
    icon: ScrollText,
    items: (project) =>
      project.lore.map((entry) => {
        const { icon: Icon, color, label } = LORE_CATEGORY_INFO[entry.category]
        return {
          id: entry.id,
          name: entry.title,
          subtitle: label,
          thumb: <EntityThumb projectId={project.id} image={entry.image} shape="rounded" color={`${color}33`} fallback={<Icon size={16} color={color} />} />,
          details: [
            { label: 'Resumen', value: entry.summary },
            { label: 'Descripción', value: entry.body },
            { label: 'Etiquetas', value: entry.tags.map((t) => `#${t}`).join(' ') }
          ]
        }
      })
  },
  {
    id: 'glossary',
    label: 'Glosario',
    icon: BookA,
    items: (project) =>
      project.glossary.map((g) => ({
        id: g.id,
        name: g.term,
        subtitle: g.category || 'Término',
        thumb: <EntityThumb projectId={project.id} image="" shape="rounded" fallback={<BookA size={16} />} />,
        details: [{ label: 'Definición', value: g.definition }]
      }))
  },
  {
    id: 'creatures',
    label: 'Bestiario',
    icon: PawPrint,
    items: (project) =>
      project.creatures.map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: `${CREATURE_TYPE_LABELS[c.type]} · ${DANGER_LABELS[c.danger]}`,
        thumb: <EntityThumb projectId={project.id} image={c.image} shape="rounded" fallback={<PawPrint size={16} />} />,
        details: [
          { label: 'Hábitat', value: c.habitat },
          { label: 'Tamaño', value: c.size },
          { label: 'Apariencia', value: c.appearance },
          { label: 'Comportamiento', value: c.behavior },
          { label: 'Habilidades', value: c.abilities },
          { label: 'Debilidades', value: c.weaknesses }
        ]
      }))
  }
]

interface ReferencePanelProps {
  project: Project
  chapterId: Id
  tab: ReferenceTabId
  onTabChange: (tab: ReferenceTabId) => void
  onInsertName: (name: string) => void
  onClose: () => void
  onProjectChange: (project: Project) => void
  /** Comentario resaltado (clic en el texto o recién creado). */
  activeCommentId: Id | null
  onSelectComment: (id: Id) => void
  onRemoveCommentMark: (id: Id) => void
}

export function ReferencePanel(props: ReferencePanelProps) {
  const { project, tab } = props
  const chapterComments = project.comments.filter((c) => c.chapterId === props.chapterId)
  const openComments = chapterComments.filter((c) => !c.resolved).length
  const current = TABS.find((t) => t.id === tab)

  return (
    <aside className="reference-panel">
      <header className="reference-header">
        <h3>{current?.label ?? 'Comentarios'}</h3>
        <button className="icon-btn" onClick={props.onClose} title="Cerrar panel">
          <X size={16} />
        </button>
      </header>

      <div className="reference-tabs is-icons" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={id === tab}
            aria-label={label}
            title={label}
            className={`reference-tab ${id === tab ? 'is-active' : ''}`}
            onClick={() => props.onTabChange(id)}
          >
            <Icon size={15} />
          </button>
        ))}
        <button
          role="tab"
          aria-selected={tab === 'comments'}
          aria-label="Comentarios"
          title="Comentarios al margen"
          className={`reference-tab ${tab === 'comments' ? 'is-active' : ''}`}
          onClick={() => props.onTabChange('comments')}
        >
          <MessageSquare size={15} />
          {openComments > 0 && <span className="reference-tab-badge">{openComments}</span>}
        </button>
      </div>

      {current ? (
        <EntityTab key={current.id} tab={current} project={project} onInsertName={props.onInsertName} />
      ) : (
        <CommentsTab {...props} comments={chapterComments} />
      )}
    </aside>
  )
}

function EntityTab({ tab, project, onInsertName }: { tab: TabDefinition; project: Project; onInsertName: (name: string) => void }) {
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<Id | null>(null)
  const allItems = useMemo(() => tab.items(project), [tab, project])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...allItems].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return q ? sorted.filter((item) => `${item.name} ${item.subtitle}`.toLowerCase().includes(q)) : sorted
  }, [allItems, query])

  return (
    <>
      <label className="search-field reference-search">
        <Search size={15} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Buscar en ${tab.label.toLowerCase()}…`} />
      </label>
      <div className="reference-list">
        {allItems.length === 0 ? (
          <div className="empty-state reference-empty">
            <tab.icon size={28} />
            <p>Aún no hay nada en «{tab.label}». Créalo en su sección de la barra lateral.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="faint reference-no-results">Sin resultados para «{query}».</p>
        ) : (
          filtered.map((item) => {
            const expanded = expandedId === item.id
            const details = item.details.filter((d) => d.value.trim())
            return (
              <div key={item.id} className={`reference-card ${expanded ? 'is-expanded' : ''}`}>
                <button className="reference-card-head" onClick={() => setExpandedId(expanded ? null : item.id)}>
                  {item.thumb}
                  <span className="reference-card-name">
                    <strong>{item.name || 'Sin nombre'}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <ChevronDown size={15} className="reference-chevron" />
                </button>
                {expanded && (
                  <div className="reference-card-body">
                    {details.length === 0 && <p className="faint">Ficha vacía.</p>}
                    {details.map(({ label, value }) => (
                      <div key={label} className="reference-detail">
                        <span>{label}</span>
                        <p>{value}</p>
                      </div>
                    ))}
                    <button className="btn btn-sm reference-insert" onClick={() => onInsertName(item.name)}>
                      <CornerDownLeft size={14} />
                      Insertar nombre en el texto
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Comentarios                                                                */
/* -------------------------------------------------------------------------- */

function CommentsTab(props: ReferencePanelProps & { comments: MarginComment[] }) {
  const [showResolved, setShowResolved] = useState(false)
  const open = props.comments.filter((c) => !c.resolved)
  const resolved = props.comments.filter((c) => c.resolved)

  return (
    <div className="reference-list comments-list">
      {props.comments.length === 0 ? (
        <div className="empty-state reference-empty">
          <MessageSquare size={28} />
          <p>
            Selecciona un fragmento del texto y pulsa <strong>Comentar</strong> en la barra de herramientas para dejar una nota al
            margen.
          </p>
        </div>
      ) : (
        <>
          {open.length === 0 && <p className="faint reference-no-results">No hay comentarios pendientes en este capítulo.</p>}
          {open.map((comment) => (
            <CommentCard key={comment.id} {...props} comment={comment} />
          ))}
          {resolved.length > 0 && (
            <button className="btn btn-sm btn-ghost comments-toggle" onClick={() => setShowResolved(!showResolved)}>
              {showResolved ? 'Ocultar' : 'Ver'} resueltos ({resolved.length})
            </button>
          )}
          {showResolved && resolved.map((comment) => <CommentCard key={comment.id} {...props} comment={comment} />)}
        </>
      )}
    </div>
  )
}

function CommentCard(props: ReferencePanelProps & { comment: MarginComment }) {
  const { comment, project } = props
  const { draft, update, status } = useEntityForm(project.id, 'comments', comment, props.onProjectChange)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const active = props.activeCommentId === comment.id

  // Al activarse (clic en el texto o recién creado), el foco va a la nota.
  useEffect(() => {
    if (active && !comment.resolved) {
      textRef.current?.focus()
      textRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [active, comment.resolved])

  const resolve = async () => {
    props.onRemoveCommentMark(comment.id)
    props.onProjectChange(await api.entities.update(project.id, 'comments', comment.id, { resolved: true }))
  }
  const remove = async () => {
    props.onRemoveCommentMark(comment.id)
    props.onProjectChange(await api.entities.delete(project.id, 'comments', comment.id))
  }

  return (
    <div className={`comment-card ${active ? 'is-active' : ''} ${comment.resolved ? 'is-resolved' : ''}`}>
      <button className="comment-quote" onClick={() => props.onSelectComment(comment.id)} title="Ir al fragmento" disabled={comment.resolved}>
        «{comment.quote}»
      </button>
      <textarea
        ref={textRef}
        className="comment-text"
        rows={2}
        value={draft.text}
        onChange={(e) => update('text', e.target.value)}
        placeholder="Escribe tu comentario…"
        readOnly={comment.resolved}
      />
      <div className="comment-actions">
        <small className="faint">{relativeTime(comment.createdAt)}</small>
        {status !== 'saved' && <SaveBadge status={status} />}
        <div className="spacer" />
        {!comment.resolved && (
          <>
            <button className="icon-btn" onClick={() => props.onSelectComment(comment.id)} title="Ir al fragmento">
              <LocateFixed size={14} />
            </button>
            <button className="icon-btn" onClick={resolve} title="Marcar como resuelto">
              <Check size={14} />
            </button>
          </>
        )}
        <button className="icon-btn" onClick={remove} title="Eliminar comentario">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
