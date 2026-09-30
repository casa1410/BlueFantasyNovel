/**
 * Gestión de sagas: varias historias que comparten mundo (personajes, lore,
 * bestiario, razas, glosario, linajes y relaciones). Un cambio en una ficha
 * del mundo se aplica en todos los libros de la saga.
 */
import { useCallback, useEffect, useState } from 'react'
import { Library, Plus, Trash2, X } from 'lucide-react'
import type { Id, ProjectSummary, Saga } from '@shared/types'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toasts'
import { api, errorMessage } from '@renderer/lib/api'

interface SagasDialogProps {
  projects: ProjectSummary[]
  onClose: () => void
  /** Tras cualquier cambio (para recargar la biblioteca). */
  onChanged: () => void
}

export function SagasDialog({ projects, onClose, onChanged }: SagasDialogProps) {
  const [sagas, setSagas] = useState<Saga[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<Id>>(new Set())
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const reload = useCallback(async () => {
    setSagas(await api.sagas.list())
    onChanged()
  }, [onChanged])

  useEffect(() => {
    api.sagas.list().then(setSagas)
  }, [])

  const titleOf = (id: Id) => projects.find((p) => p.id === id)?.title ?? 'Historia eliminada'
  const inSaga = new Set(sagas.flatMap((s) => s.projectIds))

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true)
    try {
      await action()
      await reload()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      size="lg"
      title="Sagas y universos"
      description="Las historias de una saga comparten mundo: personajes, relaciones, linajes, razas, lore, glosario y bestiario. Si cambias una raza en un libro, cambia en todos. Los capítulos, tramas, mapas y línea temporal siguen siendo de cada libro."
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <div className="sagas">
        {sagas.map((saga) => (
          <section key={saga.id} className="saga-card">
            <header>
              <Library size={18} />
              <input
                className="saga-name"
                defaultValue={saga.name}
                onBlur={(e) => e.target.value.trim() !== saga.name && run(() => api.sagas.rename(saga.id, e.target.value))}
                aria-label="Nombre de la saga"
              />
              <button className="icon-btn" title="Disolver la saga (las historias conservan sus fichas)" onClick={() => run(() => api.sagas.delete(saga.id), 'Saga disuelta')}>
                <Trash2 size={15} />
              </button>
            </header>
            <ol className="saga-members">
              {saga.projectIds.map((id) => (
                <li key={id}>
                  {titleOf(id)}
                  <button className="icon-btn" title="Sacar de la saga" onClick={() => run(() => api.sagas.removeProject(id))}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ol>
            <select
              className="select select-inline"
              value=""
              disabled={busy}
              onChange={(e) => e.target.value && run(() => api.sagas.addProject(saga.id, e.target.value), 'Historia añadida: su mundo se ha unido al de la saga')}
            >
              <option value="">+ Añadir una historia a esta saga…</option>
              {projects
                .filter((p) => !inSaga.has(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </section>
        ))}

        {creating ? (
          <section className="saga-card is-new">
            <input className="input" autoFocus placeholder="Nombre de la saga (p. ej. Las Crónicas del Mar Azul)" value={name} onChange={(e) => setName(e.target.value)} />
            <p className="field-hint">Elige las historias que comparten mundo. Sus fichas se unirán (si una misma ficha difiere, gana la editada más recientemente).</p>
            <div className="import-list">
              {projects.map((p) => (
                <label key={p.id} className="settings-check">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => {
                      const next = new Set(selected)
                      if (next.has(p.id)) next.delete(p.id)
                      else next.add(p.id)
                      setSelected(next)
                    }}
                  />
                  {p.title}
                  {inSaga.has(p.id) && <span className="faint"> (saldrá de su saga actual)</span>}
                </label>
              ))}
            </div>
            <div className="backup-actions">
              <button className="btn btn-sm btn-ghost" onClick={() => setCreating(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-sm btn-primary"
                disabled={busy || selected.size < 2 || !name.trim()}
                onClick={() =>
                  run(async () => {
                    await api.sagas.create(name, [...selected])
                    setCreating(false)
                    setName('')
                    setSelected(new Set())
                  }, 'Saga creada: las historias ya comparten mundo')
                }
              >
                {busy ? 'Uniendo mundos…' : 'Crear saga'}
              </button>
            </div>
          </section>
        ) : (
          <button className="btn" onClick={() => setCreating(true)} disabled={projects.length < 2}>
            <Plus size={15} /> {projects.length < 2 ? 'Necesitas al menos dos historias para crear una saga' : 'Nueva saga'}
          </button>
        )}
      </div>
    </Modal>
  )
}
