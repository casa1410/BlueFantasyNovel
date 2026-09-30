/**
 * Ficha editable de un personaje. Se guarda sola mientras se escribe.
 * Debe montarse con `key={character.id}`.
 */
import { Trash2 } from 'lucide-react'
import { CHARACTER_ROLES, type ChapterMeta, type Character, type Id, type Lineage, type Project, type Race } from '@shared/types'
import { AppearancesPanel } from '@renderer/components/AppearancesPanel'
import { ImagePicker } from '@renderer/components/ImagePicker'
import { ListInput } from '@renderer/components/ListInput'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { initials } from '@renderer/lib/covers'
import { CHARACTER_COLORS, ROLE_LABELS } from './characterOptions'

interface CharacterFormProps {
  projectId: Id
  character: Character
  chapters: ChapterMeta[]
  races: Race[]
  lineages: Lineage[]
  onProjectChange: (project: Project) => void
  onDelete: () => void
  onOpenChapter: (chapterId: Id) => void
}

type TextField = 'appearance' | 'personality' | 'motivation' | 'fears' | 'arc' | 'notes'

/** Campos de texto largo de la ficha, con su ayuda para el escritor. */
const TEXT_SECTIONS: { key: TextField; label: string; hint: string }[] = [
  { key: 'appearance', label: 'Apariencia', hint: 'Rasgos físicos, forma de vestir, gestos reconocibles.' },
  { key: 'personality', label: 'Personalidad', hint: 'Carácter, virtudes, defectos, cómo habla.' },
  { key: 'motivation', label: 'Motivación', hint: '¿Qué quiere? ¿Qué necesita de verdad (aunque no lo sepa)?' },
  { key: 'fears', label: 'Miedos y heridas', hint: '¿Qué le aterra? ¿Qué pasado le pesa?' },
  { key: 'arc', label: 'Arco narrativo', hint: 'Cómo empieza, qué le cambia y cómo termina.' },
  { key: 'notes', label: 'Notas', hint: 'Cualquier otra cosa: relaciones, secretos, frases típicas…' }
]

export function CharacterForm({ projectId, character, chapters, races, lineages, onProjectChange, onDelete, onOpenChapter }: CharacterFormProps) {
  const { draft, update, setImage, status } = useEntityForm(projectId, 'characters', character, onProjectChange)

  return (
    <div className="entity-form">
      <header className="entity-form-header">
        <ImagePicker
          projectId={projectId}
          image={draft.image}
          onChange={setImage}
          variant="portrait"
          color={draft.color}
          fallback={initials(draft.name)}
        />

        <div className="entity-form-identity">
          <input
            className="entity-name-input"
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Nombre del personaje"
            aria-label="Nombre"
          />
          <div className="entity-form-row">
            <select
              className="select select-inline"
              value={draft.role}
              onChange={(e) => update('role', e.target.value as Character['role'])}
              aria-label="Rol"
            >
              {CHARACTER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <input
              className="input input-inline"
              value={draft.age}
              onChange={(e) => update('age', e.target.value)}
              placeholder="Edad"
              aria-label="Edad"
            />
            <select className="select select-inline" value={draft.raceId ?? ''} onChange={(e) => update('raceId', e.target.value || null)} aria-label="Raza">
              <option value="">Sin raza</option>
              {races.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              className="select select-inline"
              value={draft.lineageId ?? ''}
              onChange={(e) => update('lineageId', e.target.value || null)}
              aria-label="Linaje"
            >
              <option value="">Sin linaje</option>
              {lineages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="entity-form-row">
            <div className="color-swatches" role="radiogroup" aria-label="Color">
              {CHARACTER_COLORS.map((color) => (
                <button
                  key={color}
                  className={`color-swatch ${draft.color === color ? 'is-active' : ''}`}
                  style={{ background: color }}
                  onClick={() => update('color', color)}
                  role="radio"
                  aria-checked={draft.color === color}
                  aria-label={color}
                />
              ))}
            </div>
          </div>
          <ListInput
            className="input entity-aliases"
            value={draft.aliases}
            onChange={(aliases) => update('aliases', aliases)}
            placeholder="Alias o apodos, separados por comas (p. ej. Aelis, la cartógrafa)"
            aria-label="Alias"
          />
          {!draft.image && <p className="field-hint">Haz clic en el círculo para añadir un retrato.</p>}
        </div>

        <div className="entity-form-actions">
          <SaveBadge status={status} />
          <button className="icon-btn" onClick={onDelete} title="Eliminar personaje">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <AppearancesPanel projectId={projectId} entityId={character.id} chapters={chapters} onOpenChapter={onOpenChapter} />

      <div className="entity-sections">
        {TEXT_SECTIONS.map(({ key, label, hint }) => (
          <label key={key} className="field">
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
