/**
 * Editor de un tablero: cuadrícula tipo mosaico, pie de foto por imagen y
 * visor a pantalla completa (flechas para pasar, Esc para cerrar).
 */
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Images, Trash2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { assetUrl } from '@shared/assets'
import type { BoardItem, Moodboard, Project } from '@shared/types'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useToast } from '@renderer/components/Toasts'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { api, errorMessage } from '@renderer/lib/api'

interface BoardEditorProps {
  project: Project
  board: Moodboard
  onProjectChange: (project: Project) => void
  onDelete: () => void
}

export function BoardEditor({ project, board, onProjectChange, onDelete }: BoardEditorProps) {
  const { draft, update, flush, status } = useEntityForm(project.id, 'boards', board, onProjectChange)
  const [viewing, setViewing] = useState<number | null>(null)
  const toast = useToast()
  const items = draft.items

  const addImages = async () => {
    try {
      const files = await api.assets.pickImages(project.id)
      if (files.length === 0) return
      const added: BoardItem[] = files.map((image) => ({ id: crypto.randomUUID(), image, caption: '' }))
      update('items', [...items, ...added])
      void flush()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const setItem = (id: string, patch: Partial<BoardItem>) => update('items', items.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  return (
    <div className="entity-form board-editor">
      <header className="entity-form-header">
        <div className="entity-form-identity">
          <input
            className="entity-name-input"
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Nombre del tablero"
            aria-label="Nombre"
          />
          <input
            className="input"
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Para qué es este tablero (p. ej. «La ciudad sumergida de Veloria»)"
            aria-label="Descripción"
          />
        </div>
        <div className="entity-form-actions">
          <SaveBadge status={status} />
          <button className="btn btn-primary btn-sm" onClick={addImages}>
            <ImagePlus size={15} /> Añadir imágenes
          </button>
          <button className="icon-btn" onClick={onDelete} title="Eliminar tablero">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="empty-state">
          <Images size={36} />
          <p>Este tablero está vacío. Puedes elegir varias imágenes a la vez.</p>
          <button className="btn" onClick={addImages}>
            <ImagePlus size={15} /> Añadir imágenes
          </button>
        </div>
      ) : (
        <div className="board-grid">
          {items.map((item, index) => (
            <figure key={item.id} className="board-item">
              <button className="board-image" onClick={() => setViewing(index)} title="Ver en grande">
                <img src={assetUrl(project.id, item.image)} alt={item.caption} loading="lazy" />
              </button>
              <button
                className="board-remove"
                title="Quitar imagen"
                onClick={() => {
                  update('items', items.filter((i) => i.id !== item.id))
                  void flush()
                }}
              >
                <X size={13} />
              </button>
              <input
                className="board-caption"
                value={item.caption}
                onChange={(e) => setItem(item.id, { caption: e.target.value })}
                placeholder="Pie de foto…"
              />
            </figure>
          ))}
        </div>
      )}

      {viewing !== null && items[viewing] && (
        <Lightbox projectId={project.id} items={items} index={viewing} onIndexChange={setViewing} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

interface LightboxProps {
  projectId: string
  items: BoardItem[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

function Lightbox({ projectId, items, index, onIndexChange, onClose }: LightboxProps) {
  const item = items[index]
  const go = (delta: number) => onIndexChange((index + delta + items.length) % items.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return createPortal(
    <div className="lightbox" onClick={onClose}>
      <img src={assetUrl(projectId, item.image)} alt={item.caption} onClick={(e) => e.stopPropagation()} />
      {item.caption && <p className="lightbox-caption">{item.caption}</p>}
      {items.length > 1 && (
        <>
          <button className="lightbox-nav is-prev" onClick={(e) => (e.stopPropagation(), go(-1))} aria-label="Anterior">
            <ChevronLeft size={28} />
          </button>
          <button className="lightbox-nav is-next" onClick={(e) => (e.stopPropagation(), go(1))} aria-label="Siguiente">
            <ChevronRight size={28} />
          </button>
        </>
      )}
      <button className="lightbox-close" onClick={onClose} aria-label="Cerrar">
        <X size={22} />
      </button>
    </div>,
    document.body
  )
}
