/**
 * Capítulos y borradores de la barra lateral.
 *  - Clic: abrir capítulo. Doble clic: renombrar. Arrastrar: reordenar.
 *  - Debajo del capítulo abierto se listan sus escenas; clic para saltar.
 *  - Borradores: capítulos fuera del manuscrito (ideas, escenas descartadas,
 *    versiones alternativas). Se pasan al manuscrito con un botón.
 */
import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react'
import type { ChapterMeta, Id } from '@shared/types'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { useLocalPreference } from '@renderer/hooks/useLocalPreference'

interface ChapterListProps {
  chapters: ChapterMeta[]
  activeChapterId: Id | null
  onSelect: (id: Id) => void
  onJumpToScene: (chapterId: Id, separatorsBefore: number) => void
  onCreate: (draft: boolean) => void
  onRename: (id: Id, title: string) => void
  onDelete: (id: Id) => void
  onReorder: (orderedIds: Id[]) => void
  onSetDraft: (id: Id, draft: boolean) => void
}

export function ChapterList(props: ChapterListProps) {
  const [pendingDelete, setPendingDelete] = useState<ChapterMeta | null>(null)
  const [draftsOpen, setDraftsOpen] = useLocalPreference('sidebar.draftsOpen', true)
  const manuscript = props.chapters.filter((c) => !c.draft)
  const drafts = props.chapters.filter((c) => c.draft)

  /** Reordena dentro de una lista y reconstruye el orden completo. */
  const reorderWithin = (list: ChapterMeta[], ids: Id[]) => {
    const other = props.chapters.filter((c) => !list.includes(c)).map((c) => c.id)
    props.onReorder(list === manuscript ? [...ids, ...other] : [...other, ...ids])
  }

  return (
    <section className="chapter-list">
      <header className="chapter-list-header">
        <span>Capítulos</span>
        <button className="icon-btn" onClick={() => props.onCreate(false)} title="Nuevo capítulo">
          <Plus size={16} />
        </button>
      </header>
      <div className="chapter-scroll">
        <ChapterItems {...props} items={manuscript} numbered onReorderList={(ids) => reorderWithin(manuscript, ids)} onAskDelete={setPendingDelete} />
        {manuscript.length === 0 && <p className="chapter-empty faint">Aún no hay capítulos.</p>}

        <header className="chapter-list-header is-drafts">
          <button className="drafts-toggle" onClick={() => setDraftsOpen(!draftsOpen)} aria-expanded={draftsOpen}>
            <ChevronDown size={13} className={draftsOpen ? '' : 'is-collapsed'} />
            Borradores {drafts.length > 0 && <span className="faint">({drafts.length})</span>}
          </button>
          <button className="icon-btn" onClick={() => props.onCreate(true)} title="Nuevo borrador">
            <Plus size={16} />
          </button>
        </header>
        {draftsOpen && (
          <>
            <ChapterItems {...props} items={drafts} numbered={false} onReorderList={(ids) => reorderWithin(drafts, ids)} onAskDelete={setPendingDelete} />
            {drafts.length === 0 && <p className="chapter-empty faint">Ideas y escenas sueltas que aún no van al libro.</p>}
          </>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={`¿Eliminar «${pendingDelete.title}»?`}
          message={`Se borrarán sus ${pendingDelete.wordCount.toLocaleString('es-ES')} palabras, su historial y sus comentarios. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          destructive
          onClose={() => setPendingDelete(null)}
          onConfirm={() => props.onDelete(pendingDelete.id)}
        />
      )}
    </section>
  )
}

interface ChapterItemsProps extends ChapterListProps {
  items: ChapterMeta[]
  numbered: boolean
  onReorderList: (ids: Id[]) => void
  onAskDelete: (chapter: ChapterMeta) => void
}

function ChapterItems({ items, numbered, activeChapterId, onReorderList, onAskDelete, ...props }: ChapterItemsProps) {
  const [renamingId, setRenamingId] = useState<Id | null>(null)
  const [dragId, setDragId] = useState<Id | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const handleDrop = () => {
    if (dragId === null || dropIndex === null) return
    const ids = items.map((c) => c.id)
    const from = ids.indexOf(dragId)
    if (from < 0) return // arrastrado desde la otra lista: se ignora
    ids.splice(from, 1)
    ids.splice(dropIndex > from ? dropIndex - 1 : dropIndex, 0, dragId)
    if (ids.some((id, i) => id !== items[i].id)) onReorderList(ids)
  }
  const resetDrag = () => {
    setDragId(null)
    setDropIndex(null)
  }

  return (
    <ol className="chapter-items">
      {items.map((chapter, index) => {
        const active = chapter.id === activeChapterId
        return (
          <li key={chapter.id}>
            <div
              className={[
                'chapter-item',
                active && 'is-active',
                chapter.draft && 'is-draft',
                chapter.id === dragId && 'is-dragging',
                dropIndex === index && 'drop-before',
                dropIndex === items.length && index === items.length - 1 && 'drop-after'
              ]
                .filter(Boolean)
                .join(' ')}
              draggable={renamingId !== chapter.id}
              onDragStart={(e) => {
                setDragId(chapter.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                setDropIndex(e.clientY > rect.top + rect.height / 2 ? index + 1 : index)
              }}
              onDrop={(e) => {
                e.preventDefault()
                handleDrop()
                resetDrag()
              }}
              onDragEnd={resetDrag}
              onClick={() => props.onSelect(chapter.id)}
              onDoubleClick={() => setRenamingId(chapter.id)}
            >
              <GripVertical size={14} className="chapter-grip" />
              <span className="chapter-number">{numbered ? index + 1 : '·'}</span>
              {renamingId === chapter.id ? (
                <input
                  className="input chapter-rename"
                  defaultValue={chapter.title}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    setRenamingId(null)
                    if (e.target.value.trim() && e.target.value !== chapter.title) props.onRename(chapter.id, e.target.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <span className="chapter-title" title="Doble clic para renombrar">
                  {chapter.title}
                </span>
              )}
              <span className="chapter-words">{chapter.wordCount.toLocaleString('es-ES')}</span>
              <button
                className="icon-btn chapter-action"
                title={chapter.draft ? 'Pasar al manuscrito' : 'Mover a borradores'}
                onClick={(e) => {
                  e.stopPropagation()
                  props.onSetDraft(chapter.id, !chapter.draft)
                }}
              >
                {chapter.draft ? <ArrowUpFromLine size={14} /> : <ArrowDownToLine size={14} />}
              </button>
              <button
                className="icon-btn chapter-action is-danger"
                title="Eliminar"
                onClick={(e) => {
                  e.stopPropagation()
                  onAskDelete(chapter)
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
            {active && chapter.scenes.length > 1 && (
              <ol className="scene-items">
                {chapter.scenes.map((scene, i) => (
                  <li key={i}>
                    <button className="scene-item" onClick={() => props.onJumpToScene(chapter.id, scene.separatorsBefore)} title={scene.title}>
                      <span className="scene-title">{scene.title}</span>
                      <span className="chapter-words">{scene.wordCount.toLocaleString('es-ES')}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </li>
        )
      })}
    </ol>
  )
}
