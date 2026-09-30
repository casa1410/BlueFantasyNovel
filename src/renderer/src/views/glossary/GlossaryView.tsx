/**
 * Sección "Glosario": términos del mundo (palabras inventadas, títulos,
 * monedas, idiomas…). Se detectan en el texto como las menciones y, al pasar
 * el ratón, muestran su definición.
 */
import { BookA, Trash2 } from 'lucide-react'
import type { EntityInput, GlossaryEntry, Id, Project } from '@shared/types'
import { AppearancesPanel } from '@renderer/components/AppearancesPanel'
import { EntityBrowser } from '@renderer/components/EntityBrowser'
import { ListInput } from '@renderer/components/ListInput'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useEntityForm } from '@renderer/hooks/useEntityForm'

interface GlossaryViewProps {
  project: Project
  onProjectChange: (project: Project) => void
  onOpenChapter: (chapterId: Id) => void
}

/** Primera letra para agrupar alfabéticamente (sin tildes: "Á" va con "A"). */
const letterOf = (term: string) =>
  (term.trim()[0] ?? '#')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
const LETTERS = ['#', ...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ']

export function GlossaryView({ project, onProjectChange, onOpenChapter }: GlossaryViewProps) {
  return (
    <EntityBrowser
      project={project}
      collection="glossary"
      onProjectChange={onProjectChange}
      title="Glosario"
      deleteNoun="el término"
      importable
      nameOf={(g) => g.term}
      searchTextOf={(g) => `${g.definition} ${g.category} ${g.aliases.join(' ')}`}
      groups={{
        order: LETTERS,
        label: (key) => key,
        keyOf: (g) => (LETTERS.includes(letterOf(g.term)) ? letterOf(g.term) : '#')
      }}
      newEntity={(): EntityInput<'glossary'> => ({ term: 'Nuevo término', aliases: [], definition: '', category: '' })}
      renderListItem={(g) => (
        <span className="entity-item-text">
          <strong>{g.term || 'Sin término'}</strong>
          <small>{g.definition || g.category || 'Sin definición'}</small>
        </span>
      )}
      renderDetail={(g, { onDelete }) => (
        <GlossaryForm key={g.id} project={project} entry={g} onProjectChange={onProjectChange} onDelete={onDelete} onOpenChapter={onOpenChapter} />
      )}
      empty={{
        icon: BookA,
        title: 'Las palabras de tu mundo',
        text: 'Anota términos inventados, títulos, monedas o hechizos con su definición. Al escribirlos en el manuscrito se subrayarán y mostrarán su significado.',
        action: 'Añadir término'
      }}
    />
  )
}

interface GlossaryFormProps {
  project: Project
  entry: GlossaryEntry
  onProjectChange: (project: Project) => void
  onDelete: () => void
  onOpenChapter: (chapterId: Id) => void
}

function GlossaryForm({ project, entry, onProjectChange, onDelete, onOpenChapter }: GlossaryFormProps) {
  const { draft, update, status } = useEntityForm(project.id, 'glossary', entry, onProjectChange)
  const categories = [...new Set(project.glossary.map((g) => g.category).filter(Boolean))]

  return (
    <div className="entity-form">
      <header className="entity-form-header">
        <div className="entity-form-identity">
          <input className="entity-name-input" value={draft.term} onChange={(e) => update('term', e.target.value)} placeholder="Término" aria-label="Término" />
          <div className="entity-form-row">
            <input
              className="input input-inline wide"
              value={draft.category}
              list="glossary-categories"
              onChange={(e) => update('category', e.target.value)}
              placeholder="Categoría (idioma, moneda, título…)"
              aria-label="Categoría"
            />
            <datalist id="glossary-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <ListInput className="input entity-aliases" value={draft.aliases} onChange={(v) => update('aliases', v)} placeholder="Variantes (plural, otras grafías…)" aria-label="Variantes" />
        </div>
        <div className="entity-form-actions">
          <SaveBadge status={status} />
          <button className="icon-btn" onClick={onDelete} title="Eliminar término">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <AppearancesPanel projectId={project.id} entityId={entry.id} chapters={project.chapters} onOpenChapter={onOpenChapter} />

      <label className="field">
        <span className="field-label">Definición</span>
        <textarea
          className="textarea lore-body"
          value={draft.definition}
          onChange={(e) => update('definition', e.target.value)}
          placeholder="Qué significa, de dónde viene, cómo se usa…"
        />
      </label>
    </div>
  )
}
