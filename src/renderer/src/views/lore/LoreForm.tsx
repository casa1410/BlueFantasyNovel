/**
 * Ficha editable de una entrada de lore. Debe montarse con `key={entry.id}`.
 */
import { Trash2 } from 'lucide-react'
import { LORE_CATEGORIES, type ChapterMeta, type Id, type LoreCategory, type LoreEntry, type Project } from '@shared/types'
import { AppearancesPanel } from '@renderer/components/AppearancesPanel'
import { ImagePicker } from '@renderer/components/ImagePicker'
import { ListInput } from '@renderer/components/ListInput'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { LORE_CATEGORY_INFO, loreCategoryInfo } from './loreOptions'
import './lore.css'

interface LoreFormProps {
  projectId: Id
  entry: LoreEntry
  chapters: ChapterMeta[]
  onProjectChange: (project: Project) => void
  onDelete: () => void
  onOpenChapter: (chapterId: Id) => void
}

export function LoreForm({ projectId, entry, chapters, onProjectChange, onDelete, onOpenChapter }: LoreFormProps) {
  const { draft, update, setImage, status } = useEntityForm(projectId, 'lore', entry, onProjectChange)
  const { icon: CategoryIcon, color } = loreCategoryInfo(draft)

  return (
    <div className="entity-form">
      <ImagePicker projectId={projectId} image={draft.image} onChange={setImage} variant="banner" />

      <header className="entity-form-header">
        <span className="lore-category-icon" style={{ color, background: `${color}22` }}>
          <CategoryIcon size={26} />
        </span>
        <div className="entity-form-identity">
          <input
            className="entity-name-input"
            value={draft.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Nombre del lugar, orden, hechizo…"
            aria-label="Título"
          />
          <div className="entity-form-row">
            <select
              className="select select-inline"
              value={draft.category}
              onChange={(e) => update('category', e.target.value as LoreCategory)}
              aria-label="Categoría"
            >
              {LORE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category === 'otro' ? 'Otro (escribir…)' : LORE_CATEGORY_INFO[category].label}
                </option>
              ))}
            </select>
            {draft.category === 'otro' && (
              <input
                className="input input-inline"
                value={draft.categoryCustom}
                onChange={(e) => update('categoryCustom', e.target.value)}
                placeholder="Escribe la categoría (p. ej. Tecnología)"
                aria-label="Categoría personalizada"
              />
            )}
            <ListInput
              className="input lore-tags-input"
              value={draft.tags}
              onChange={(tags) => update('tags', tags)}
              placeholder="Etiquetas separadas por comas"
              aria-label="Etiquetas"
            />
          </div>
          <ListInput
            className="input entity-aliases"
            value={draft.aliases}
            onChange={(aliases) => update('aliases', aliases)}
            placeholder="Otros nombres con los que aparece en el texto, separados por comas"
            aria-label="Alias"
          />
          {draft.tags.length > 0 && (
            <div className="lore-tags">
              {draft.tags.map((tag) => (
                <span key={tag} className="lore-tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="entity-form-actions">
          <SaveBadge status={status} />
          <button className="icon-btn" onClick={onDelete} title="Eliminar entrada">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <AppearancesPanel projectId={projectId} entityId={entry.id} chapters={chapters} onOpenChapter={onOpenChapter} />

      <div className="entity-sections">
        <label className="field entity-section-wide">
          <span className="field-label">Resumen</span>
          <input
            className="input"
            value={draft.summary}
            onChange={(e) => update('summary', e.target.value)}
            placeholder="Una línea que lo resuma (aparece en la lista y en el panel de referencia)"
          />
        </label>
        <label className="field entity-section-wide">
          <span className="field-label">Descripción</span>
          <textarea
            className="textarea lore-body"
            value={draft.body}
            onChange={(e) => update('body', e.target.value)}
            placeholder="Historia, geografía, reglas, personajes relacionados, secretos…"
          />
        </label>
      </div>
    </div>
  )
}
