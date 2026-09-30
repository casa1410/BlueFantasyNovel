/**
 * Sección "Razas": pueblos y especies del mundo. Los personajes se asignan a
 * una raza desde su ficha.
 */
import { Dna, Trash2 } from 'lucide-react'
import type { EntityInput, Id, Project, Race } from '@shared/types'
import { AppearancesPanel } from '@renderer/components/AppearancesPanel'
import { EntityBrowser } from '@renderer/components/EntityBrowser'
import { EntityThumb } from '@renderer/components/EntityThumb'
import { ImagePicker } from '@renderer/components/ImagePicker'
import { ListInput } from '@renderer/components/ListInput'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { initials } from '@renderer/lib/covers'
import { plural } from '@renderer/lib/format'
import { CHARACTER_COLORS } from '../characters/characterOptions'

interface RacesViewProps {
  project: Project
  onProjectChange: (project: Project) => void
  onOpenChapter: (chapterId: Id) => void
}

export function RacesView({ project, onProjectChange, onOpenChapter }: RacesViewProps) {
  return (
    <EntityBrowser
      project={project}
      collection="races"
      onProjectChange={onProjectChange}
      title="Razas"
      deleteNoun="la raza (sus personajes quedarán sin raza)"
      importable
      nameOf={(r) => r.name}
      searchTextOf={(r) => r.aliases.join(' ')}
      newEntity={(): EntityInput<'races'> => ({
        name: 'Nueva raza',
        aliases: [],
        appearance: '',
        lifespan: '',
        homeland: '',
        culture: '',
        abilities: '',
        notes: '',
        color: CHARACTER_COLORS[(project.races.length + 4) % CHARACTER_COLORS.length],
        image: ''
      })}
      renderListItem={(r) => (
        <>
          <EntityThumb projectId={project.id} image={r.image} color={r.color} shape="rounded" fallback={initials(r.name)} />
          <span className="entity-item-text">
            <strong>{r.name || 'Sin nombre'}</strong>
            <small>{plural(project.characters.filter((c) => c.raceId === r.id).length, 'personaje')}</small>
          </span>
        </>
      )}
      renderDetail={(r, { onDelete }) => (
        <RaceForm key={r.id} project={project} race={r} onProjectChange={onProjectChange} onDelete={onDelete} onOpenChapter={onOpenChapter} />
      )}
      empty={{
        icon: Dna,
        title: 'Los pueblos de tu mundo',
        text: 'Elfos, enanos, humanos de las islas, espíritus del bosque… Describe su aspecto, cultura y habilidades, y asígnalos a tus personajes.',
        action: 'Crear raza'
      }}
    />
  )
}

type TextField = 'appearance' | 'culture' | 'abilities' | 'notes'
const TEXT_SECTIONS: { key: TextField; label: string; hint: string }[] = [
  { key: 'appearance', label: 'Apariencia', hint: 'Rasgos físicos, altura, color de piel, ojos…' },
  { key: 'culture', label: 'Cultura y sociedad', hint: 'Costumbres, gobierno, creencias, relación con otros pueblos.' },
  { key: 'abilities', label: 'Habilidades', hint: 'Dones, magia innata, debilidades.' },
  { key: 'notes', label: 'Notas', hint: 'Historia, idioma, secretos…' }
]

interface RaceFormProps {
  project: Project
  race: Race
  onProjectChange: (project: Project) => void
  onDelete: () => void
  onOpenChapter: (chapterId: Id) => void
}

function RaceForm({ project, race, onProjectChange, onDelete, onOpenChapter }: RaceFormProps) {
  const { draft, update, setImage, status } = useEntityForm(project.id, 'races', race, onProjectChange)
  const members = project.characters.filter((c) => c.raceId === race.id)

  return (
    <div className="entity-form">
      <header className="entity-form-header">
        <ImagePicker projectId={project.id} image={draft.image} onChange={setImage} variant="square" color={draft.color} fallback={initials(draft.name)} />
        <div className="entity-form-identity">
          <input className="entity-name-input" value={draft.name} onChange={(e) => update('name', e.target.value)} placeholder="Nombre de la raza" aria-label="Nombre" />
          <div className="entity-form-row">
            <input className="input input-inline" value={draft.lifespan} onChange={(e) => update('lifespan', e.target.value)} placeholder="Esperanza de vida" aria-label="Esperanza de vida" />
            <input className="input input-inline wide" value={draft.homeland} onChange={(e) => update('homeland', e.target.value)} placeholder="Dónde viven" aria-label="Dónde viven" />
          </div>
          <ListInput className="input entity-aliases" value={draft.aliases} onChange={(v) => update('aliases', v)} placeholder="Otros nombres (p. ej. los Altos, élfico)" aria-label="Alias" />
          <div className="color-swatches" role="radiogroup" aria-label="Color">
            {CHARACTER_COLORS.map((color) => (
              <button key={color} className={`color-swatch ${draft.color === color ? 'is-active' : ''}`} style={{ background: color }} onClick={() => update('color', color)} aria-label={color} />
            ))}
          </div>
        </div>
        <div className="entity-form-actions">
          <SaveBadge status={status} />
          <button className="icon-btn" onClick={onDelete} title="Eliminar raza">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <MemberChips title="Personajes de esta raza" members={members} empty="Asigna la raza desde la ficha de cada personaje." />
      <AppearancesPanel projectId={project.id} entityId={race.id} chapters={project.chapters} onOpenChapter={onOpenChapter} />

      <div className="entity-sections">
        {TEXT_SECTIONS.map(({ key, label, hint }) => (
          <label key={key} className="field">
            <span className="field-label">{label}</span>
            <textarea className="textarea" rows={4} value={draft[key]} onChange={(e) => update(key, e.target.value)} placeholder={hint} />
          </label>
        ))}
      </div>
    </div>
  )
}

/** Lista compacta de personajes (miembros de una raza o linaje). */
export function MemberChips({ title, members, empty }: { title: string; members: Project['characters']; empty: string }) {
  return (
    <section className="appearances">
      <h4>{title}</h4>
      {members.length === 0 ? (
        <p className="faint">{empty}</p>
      ) : (
        <div className="appearances-list">
          {members.map((c) => (
            <span key={c.id} className="appearance-chip is-static">
              <span className="chip-dot" style={{ background: c.color }} /> {c.name}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
