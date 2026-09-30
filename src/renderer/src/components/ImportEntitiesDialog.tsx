/**
 * Importar fichas desde otra historia (sagas que comparten mundo):
 * se elige la historia de origen y las fichas a copiar.
 */
import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import type { Id, Project, ProjectSummary } from '@shared/types'
import { api, errorMessage } from '@renderer/lib/api'
import { plural } from '@renderer/lib/format'
import { Modal } from './Modal'
import { useToast } from './Toasts'

type ImportableCollection = 'characters' | 'lore' | 'creatures' | 'races' | 'glossary' | 'lineages'

const NOUNS: Record<ImportableCollection, [string, string]> = {
  characters: ['personaje', 'personajes'],
  lore: ['entrada de lore', 'entradas de lore'],
  creatures: ['criatura', 'criaturas'],
  races: ['raza', 'razas'],
  glossary: ['término', 'términos'],
  lineages: ['linaje', 'linajes']
}

interface ImportEntitiesDialogProps {
  project: Project
  collection: ImportableCollection
  onClose: () => void
  onImported: (project: Project) => void
}

export function ImportEntitiesDialog({ project, collection, onClose, onImported }: ImportEntitiesDialogProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [sourceId, setSourceId] = useState<Id>('')
  const [source, setSource] = useState<Project | null>(null)
  const [selected, setSelected] = useState<Set<Id>>(new Set())
  const toast = useToast()
  const [singular, pluralNoun] = NOUNS[collection]

  useEffect(() => {
    api.projects.list().then((list) => setProjects(list.filter((p) => p.id !== project.id)))
  }, [project.id])

  useEffect(() => {
    setSource(null)
    setSelected(new Set())
    if (sourceId) api.projects.get(sourceId).then(setSource)
  }, [sourceId])

  const items = (source?.[collection] ?? []) as { id: Id; name?: string; title?: string; term?: string }[]
  const nameOf = (item: { name?: string; title?: string; term?: string }) => item.name ?? item.title ?? item.term ?? ''

  const toggle = (id: Id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const submit = async () => {
    try {
      onImported(await api.entities.import(project.id, sourceId, collection, [...selected]))
      toast.success(`Se han importado ${plural(selected.size, singular, pluralNoun)}`)
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Modal
      title={`Importar ${pluralNoun} de otra historia`}
      description="Se copian con su imagen. A partir de ahí, cada historia tiene su propia versión de la ficha."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={selected.size === 0} onClick={submit}>
            <Download size={15} /> Importar {selected.size > 0 ? selected.size : ''}
          </button>
        </>
      }
    >
      {projects.length === 0 ? (
        <p className="faint">No hay otras historias en la biblioteca.</p>
      ) : (
        <>
          <label className="field">
            <span className="field-label">Historia de origen</span>
            <select className="select" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Elige una historia…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          {source && (
            <div className="import-list">
              {items.length === 0 ? (
                <p className="faint">Esa historia no tiene {pluralNoun}.</p>
              ) : (
                items.map((item) => (
                  <label key={item.id} className="settings-check">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                    {nameOf(item) || 'Sin nombre'}
                  </label>
                ))
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
