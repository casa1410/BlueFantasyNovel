/**
 * Sección "Notas": apuntes libres de la historia (ideas sueltas, cosas
 * pendientes, investigación…). Se ordenan arrastrándolas y no se comparten
 * con las otras historias de la saga.
 */
import { StickyNote, Trash2 } from 'lucide-react'
import type { EntityInput, Note, Project } from '@shared/types'
import { EntityBrowser } from '@renderer/components/EntityBrowser'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { relativeTime } from '@renderer/lib/format'

interface NotesViewProps {
  project: Project
  onProjectChange: (project: Project) => void
}

/** Primera línea con texto del cuerpo (para la lista). */
const firstLine = (body: string) => body.split('\n').find((line) => line.trim())?.trim() ?? ''

export function NotesView({ project, onProjectChange }: NotesViewProps) {
  return (
    <EntityBrowser
      project={project}
      collection="notes"
      onProjectChange={onProjectChange}
      title="Notas"
      deleteNoun="la nota"
      reorderable
      nameOf={(n) => n.title || firstLine(n.body) || 'Nota sin título'}
      searchTextOf={(n) => `${n.body} ${n.category}`}
      newEntity={(): EntityInput<'notes'> => ({ title: 'Nueva nota', body: '', category: '' })}
      renderListItem={(n) => (
        <span className="entity-item-text">
          <strong>{n.title || 'Nota sin título'}</strong>
          <small>
            {n.category && <span className="note-category">{n.category}</span>}
            {firstLine(n.body) || 'Vacía'}
          </small>
        </span>
      )}
      renderDetail={(n, { onDelete }) => <NoteForm key={n.id} project={project} note={n} onProjectChange={onProjectChange} onDelete={onDelete} />}
      empty={{
        icon: StickyNote,
        title: 'Tus apuntes',
        text: 'Guarda ideas sueltas, cosas que revisar, datos de investigación o lo que no encaje en otra sección. Ordénalas arrastrándolas en la lista.',
        action: 'Añadir nota'
      }}
    />
  )
}

interface NoteFormProps {
  project: Project
  note: Note
  onProjectChange: (project: Project) => void
  onDelete: () => void
}

function NoteForm({ project, note, onProjectChange, onDelete }: NoteFormProps) {
  const { draft, update, status } = useEntityForm(project.id, 'notes', note, onProjectChange)
  const categories = [...new Set(project.notes.map((n) => n.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))

  return (
    <div className="entity-form note-form">
      <header className="entity-form-header">
        <div className="entity-form-identity">
          <input className="entity-name-input" value={draft.title} onChange={(e) => update('title', e.target.value)} placeholder="Título" aria-label="Título" />
          <div className="entity-form-row">
            <input
              className="input input-inline wide"
              value={draft.category}
              list="note-categories"
              onChange={(e) => update('category', e.target.value)}
              placeholder="Categoría (ideas, pendiente, investigación…)"
              aria-label="Categoría"
            />
            <datalist id="note-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <small className="faint">Editada {relativeTime(note.updatedAt)}</small>
          </div>
        </div>
        <div className="entity-form-actions">
          <SaveBadge status={status} />
          <button className="icon-btn" onClick={onDelete} title="Eliminar nota">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <textarea
        className="textarea note-body"
        value={draft.body}
        onChange={(e) => update('body', e.target.value)}
        placeholder="Escribe aquí…"
        aria-label="Texto de la nota"
        spellCheck
      />
    </div>
  )
}
