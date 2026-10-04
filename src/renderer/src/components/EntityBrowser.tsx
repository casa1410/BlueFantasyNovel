/**
 * Explorador genérico de fichas: lista con búsqueda (y grupos opcionales) a
 * la izquierda, ficha editable a la derecha. Lo usan Personajes, Lore y
 * Bestiario; cada sección solo aporta cómo pintar un elemento y su formulario.
 *
 * Se encarga de: selección, crear, confirmar borrado, estado vacío y, si se
 * pide (`reorderable`), ordenar a mano arrastrando los elementos de la lista.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Download, GripVertical, Plus, Search, type LucideIcon } from 'lucide-react'
import type { EntityCollection, EntityInput, EntityMap, Id, Project } from '@shared/types'
import { api, errorMessage } from '@renderer/lib/api'
import { ConfirmDialog } from './ConfirmDialog'
import { ImportEntitiesDialog } from './ImportEntitiesDialog'
import { useToast } from './Toasts'
import './entityBrowser.css'

interface EntityBrowserProps<C extends EntityCollection> {
  project: Project
  collection: C
  onProjectChange: (project: Project) => void

  /** Título de la columna ("Personajes", "Lore"…). */
  title: string
  /** Valores iniciales de una ficha nueva. */
  newEntity: () => EntityInput<C>
  /** Nombre visible de una ficha (para búsqueda y confirmaciones). */
  nameOf: (entity: EntityMap[C]) => string
  /** Texto adicional en el que buscar (etiquetas, tipo…). */
  searchTextOf?: (entity: EntityMap[C]) => string
  /** Agrupación opcional de la lista: devuelve la clave del grupo. */
  groups?: { order: readonly string[]; label: (key: string) => string; keyOf: (entity: EntityMap[C]) => string }
  /** Cómo se ordena la lista dentro de cada grupo (por defecto, alfabético). */
  compare?: (a: EntityMap[C], b: EntityMap[C]) => number

  renderListItem: (entity: EntityMap[C]) => ReactNode
  renderDetail: (entity: EntityMap[C], actions: { onDelete: () => void }) => ReactNode

  empty: { icon: LucideIcon; title: string; text: string; action: string }
  /** Artículo para los mensajes: "el personaje", "la entrada"… */
  deleteNoun: string
  /** Muestra el botón "Importar de otra historia" (solo fichas mencionables). */
  importable?: boolean
  /**
   * La lista sigue el orden guardado (no el alfabético) y se puede reordenar
   * arrastrando. Mientras se busca no se arrastra: la lista está filtrada.
   */
  reorderable?: boolean
}

export function EntityBrowser<C extends EntityCollection>(props: EntityBrowserProps<C>) {
  const { project, collection, onProjectChange, nameOf } = props
  const items = project[collection] as EntityMap[C][]
  const [selectedId, setSelectedId] = useState<Id | null>(items[0]?.id ?? null)
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<EntityMap[C] | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragId, setDragId] = useState<Id | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const toast = useToast()
  const canDrag = Boolean(props.reorderable) && !props.groups && !query.trim()

  const selected = items.find((item) => item.id === selectedId) ?? null

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    const compare = props.compare ?? (props.reorderable ? undefined : (a: EntityMap[C], b: EntityMap[C]) => nameOf(a).localeCompare(nameOf(b), 'es'))
    const filtered = items.filter((item) => !q || `${nameOf(item)} ${props.searchTextOf?.(item) ?? ''}`.toLowerCase().includes(q))
    if (compare) filtered.sort(compare)

    if (!props.groups) return [{ key: '', label: '', items: filtered }]
    const { order, label, keyOf } = props.groups
    return order
      .map((key) => ({ key, label: label(key), items: filtered.filter((item) => keyOf(item) === key) }))
      .filter((section) => section.items.length > 0)
  }, [items, query, nameOf, props.compare, props.searchTextOf, props.groups, props.reorderable])

  const resetDrag = () => {
    setDragId(null)
    setDropIndex(null)
  }

  /** Suelta el elemento arrastrado en `dropIndex` y guarda el nuevo orden. */
  const drop = async () => {
    if (dragId === null || dropIndex === null) return
    const from = items.findIndex((item) => item.id === dragId)
    if (from < 0) return
    const reordered = [...items]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(dropIndex > from ? dropIndex - 1 : dropIndex, 0, moved)
    if (reordered.every((item, i) => item === items[i])) return
    // Se muestra ya el nuevo orden; si falla al guardar, se vuelve al anterior.
    onProjectChange({ ...project, [collection]: reordered })
    try {
      onProjectChange(await api.entities.reorder(project.id, collection, reordered.map((item) => item.id)))
    } catch (error) {
      onProjectChange(project)
      toast.error(`No se pudo cambiar el orden: ${errorMessage(error)}`)
    }
  }

  const create = async () => {
    try {
      const result = await api.entities.create(project.id, collection, props.newEntity())
      onProjectChange(result.project)
      setSelectedId(result.entity.id)
      setQuery('')
    } catch (error) {
      toast.error(`No se pudo crear: ${errorMessage(error)}`)
    }
  }

  const EmptyIcon = props.empty.icon

  return (
    <div className="entity-browser">
      <aside className="entity-list">
        <header className="entity-list-header">
          <h2>{props.title}</h2>
          <div className="entity-list-actions">
            {props.importable && (
              <button className="icon-btn" onClick={() => setImporting(true)} title="Importar de otra historia">
                <Download size={16} />
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={create}>
              <Plus size={15} />
              Nuevo
            </button>
          </div>
        </header>

        {items.length > 0 && (
          <label className="search-field entity-search">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" />
          </label>
        )}

        <div className="entity-items">
          {sections.map((section) => (
            <div key={section.key}>
              {section.label && (
                <div className="entity-group-label">
                  {section.label} <span>{section.items.length}</span>
                </div>
              )}
              {section.items.map((item, index) => (
                <button
                  key={item.id}
                  className={[
                    'entity-item',
                    item.id === selectedId && 'is-active',
                    canDrag && 'is-draggable',
                    item.id === dragId && 'is-dragging',
                    dropIndex === index && 'drop-before',
                    dropIndex === section.items.length && index === section.items.length - 1 && 'drop-after'
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelectedId(item.id)}
                  draggable={canDrag}
                  onDragStart={(e) => {
                    setDragId(item.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    if (dragId === null) return
                    e.preventDefault()
                    const rect = e.currentTarget.getBoundingClientRect()
                    setDropIndex(e.clientY > rect.top + rect.height / 2 ? index + 1 : index)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    void drop()
                    resetDrag()
                  }}
                  onDragEnd={resetDrag}
                  title={canDrag ? 'Arrastra para cambiar el orden' : undefined}
                >
                  {canDrag && <GripVertical size={14} className="entity-grip" />}
                  {props.renderListItem(item)}
                </button>
              ))}
            </div>
          ))}
          {items.length > 0 && sections.length === 0 && <p className="faint entity-no-results">Sin resultados.</p>}
        </div>
      </aside>

      <section className="entity-detail">
        {selected ? (
          props.renderDetail(selected, { onDelete: () => setPendingDelete(selected) })
        ) : (
          <div className="empty-state entity-empty">
            <EmptyIcon size={44} />
            <h3>{props.empty.title}</h3>
            <p>{props.empty.text}</p>
            <button className="btn btn-primary" onClick={create}>
              <Plus size={16} />
              {props.empty.action}
            </button>
          </div>
        )}
      </section>

      {importing && (
        <ImportEntitiesDialog
          project={project}
          collection={collection as 'characters' | 'lore' | 'creatures' | 'races' | 'glossary' | 'lineages'}
          onClose={() => setImporting(false)}
          onImported={onProjectChange}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`¿Eliminar «${nameOf(pendingDelete) || 'Sin nombre'}»?`}
          message={`Se borrará ${props.deleteNoun} con toda su información e imagen. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          destructive
          onClose={() => setPendingDelete(null)}
          onConfirm={async () => {
            try {
              const updated = await api.entities.delete(project.id, collection, pendingDelete.id)
              onProjectChange(updated)
              setSelectedId((updated[collection] as EntityMap[C][])[0]?.id ?? null)
            } catch (error) {
              toast.error(`No se pudo eliminar: ${errorMessage(error)}`)
            }
          }}
        />
      )}
    </div>
  )
}
