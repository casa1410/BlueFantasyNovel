import { useState, type FormEvent } from 'react'
import type { Project } from '@shared/types'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toasts'
import { api, errorMessage } from '@renderer/lib/api'

/** Sugerencias para el campo "Género" (se puede escribir cualquier otro). */
const GENRE_SUGGESTIONS = [
  'Fantasía épica',
  'Fantasía urbana',
  'Ciencia ficción',
  'Romance',
  'Misterio',
  'Thriller',
  'Terror',
  'Aventura',
  'Histórica',
  'Juvenil'
]

interface NewProjectDialogProps {
  onClose: () => void
  onCreated: (project: Project) => void
}

export function NewProjectDialog({ onClose, onCreated }: NewProjectDialogProps) {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      onCreated(await api.projects.create({ title, genre, description }))
    } catch (error) {
      toast.error(`No se pudo crear la historia: ${errorMessage(error)}`)
      setBusy(false)
    }
  }

  return (
    <Modal title="Nueva historia" description="Podrás cambiar todo esto más adelante." onClose={onClose}>
      <form id="new-project-form" onSubmit={submit} className="modal-form">
        <label className="field">
          <span className="field-label">Título</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Las Crónicas del Mar Azul"
            autoFocus
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Género</span>
          <input
            className="input"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="Fantasía épica"
            list="genre-suggestions"
          />
          <datalist id="genre-suggestions">
            {GENRE_SUGGESTIONS.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span className="field-label">Sinopsis</span>
          <textarea
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Una frase o dos sobre de qué va tu historia…"
            rows={3}
          />
        </label>
      </form>

      <div className="modal-form-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" form="new-project-form" className="btn btn-primary" disabled={busy || !title.trim()}>
          Crear historia
        </button>
      </div>
    </Modal>
  )
}
