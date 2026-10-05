/**
 * Ficha editable de una criatura. Debe montarse con `key={creature.id}`.
 */
import { PawPrint, Trash2 } from 'lucide-react'
import { CREATURE_TYPES, type ChapterMeta, type Creature, type CreatureType, type Id, type Project } from '@shared/types'
import { AppearancesPanel } from '@renderer/components/AppearancesPanel'
import { ImagePicker } from '@renderer/components/ImagePicker'
import { ListInput } from '@renderer/components/ListInput'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { CREATURE_TYPE_LABELS } from './bestiaryOptions'
import { DangerMeter } from './DangerMeter'

interface CreatureFormProps {
  projectId: Id
  creature: Creature
  chapters: ChapterMeta[]
  onProjectChange: (project: Project) => void
  onDelete: () => void
  onOpenChapter: (chapterId: Id) => void
}

type TextField = 'appearance' | 'behavior' | 'abilities' | 'weaknesses' | 'notes'

const TEXT_SECTIONS: { key: TextField; label: string; hint: string; wide?: boolean }[] = [
  { key: 'appearance', label: 'Apariencia', hint: 'Forma, color, olor, sonidos que emite…' },
  { key: 'behavior', label: 'Comportamiento', hint: '¿Caza en manada? ¿Es territorial? ¿Cuándo aparece?' },
  { key: 'abilities', label: 'Habilidades', hint: 'Poderes, ataques, sentidos especiales.' },
  { key: 'weaknesses', label: 'Debilidades', hint: 'Qué la hiere, qué teme, cómo evitarla.' },
  { key: 'notes', label: 'Leyendas y notas', hint: 'Mitos, avistamientos, relación con otras especies o pueblos…', wide: true }
]

export function CreatureForm({ projectId, creature, chapters, onProjectChange, onDelete, onOpenChapter }: CreatureFormProps) {
  const { draft, update, setImage, status } = useEntityForm(projectId, 'creatures', creature, onProjectChange)

  return (
    <div className="entity-form">
      <header className="entity-form-header">
        <ImagePicker
          projectId={projectId}
          image={draft.image}
          onChange={setImage}
          fullImage={draft.fullImage}
          onFullImageChange={(file) => update('fullImage', file)}
          variant="square"
          fallback={<PawPrint size={34} />}
        />

        <div className="entity-form-identity">
          <input
            className="entity-name-input"
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Nombre de la criatura"
            aria-label="Nombre"
          />
          <div className="entity-form-row">
            <select
              className="select select-inline"
              value={draft.type}
              onChange={(e) => update('type', e.target.value as CreatureType)}
              aria-label="Tipo"
            >
              {CREATURE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === 'otro' ? 'Otro (escribir…)' : CREATURE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            {draft.type === 'otro' && (
              <input
                className="input input-inline"
                value={draft.typeCustom}
                onChange={(e) => update('typeCustom', e.target.value)}
                placeholder="Escribe el tipo (p. ej. Elemental)"
                aria-label="Tipo personalizado"
              />
            )}
            <input
              className="input input-inline"
              value={draft.habitat}
              onChange={(e) => update('habitat', e.target.value)}
              placeholder="Hábitat"
              aria-label="Hábitat"
            />
            <input
              className="input input-inline"
              value={draft.size}
              onChange={(e) => update('size', e.target.value)}
              placeholder="Tamaño"
              aria-label="Tamaño"
            />
          </div>
          <ListInput
            className="input entity-aliases"
            value={draft.aliases}
            onChange={(aliases) => update('aliases', aliases)}
            placeholder="Otros nombres, separados por comas (p. ej. el Devorador)"
            aria-label="Alias"
          />
          <DangerMeter level={draft.danger} onChange={(danger) => update('danger', danger)} />
        </div>

        <div className="entity-form-actions">
          <SaveBadge status={status} />
          <button className="icon-btn" onClick={onDelete} title="Eliminar criatura">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <AppearancesPanel projectId={projectId} entityId={creature.id} chapters={chapters} onOpenChapter={onOpenChapter} />

      <div className="entity-sections">
        {TEXT_SECTIONS.map(({ key, label, hint, wide }) => (
          <label key={key} className={`field ${wide ? 'entity-section-wide' : ''}`}>
            <span className="field-label">{label}</span>
            <textarea
              className="textarea"
              value={draft[key]}
              onChange={(e) => update(key, e.target.value)}
              placeholder={hint}
              rows={4}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
