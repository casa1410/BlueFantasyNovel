/**
 * Sección "Linajes": casas nobles, dinastías y clanes. Los personajes se
 * asignan a un linaje desde su ficha; el árbol genealógico colorea a cada
 * miembro con el color de su linaje ("mapa de linajes").
 */
import { Crown, Trash2 } from 'lucide-react'
import type { EntityInput, Id, Lineage, Project } from '@shared/types'
import { AppearancesPanel } from '@renderer/components/AppearancesPanel'
import { EntityBrowser } from '@renderer/components/EntityBrowser'
import { EntityThumb } from '@renderer/components/EntityThumb'
import { ImagePicker } from '@renderer/components/ImagePicker'
import { ListInput } from '@renderer/components/ListInput'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { plural } from '@renderer/lib/format'
import { CHARACTER_COLORS } from '../characters/characterOptions'
import { MemberChips } from '../races/RacesView'

interface LineagesViewProps {
  project: Project
  onProjectChange: (project: Project) => void
  onOpenChapter: (chapterId: Id) => void
}

export function LineagesView({ project, onProjectChange, onOpenChapter }: LineagesViewProps) {
  return (
    <EntityBrowser
      project={project}
      collection="lineages"
      onProjectChange={onProjectChange}
      title="Linajes"
      deleteNoun="el linaje (sus miembros quedarán sin linaje)"
      importable
      nameOf={(l) => l.name}
      searchTextOf={(l) => `${l.motto} ${l.aliases.join(' ')}`}
      newEntity={(): EntityInput<'lineages'> => ({
        name: 'Nueva casa',
        aliases: [],
        motto: '',
        description: '',
        seatLoreId: null,
        color: CHARACTER_COLORS[(project.lineages.length + 3) % CHARACTER_COLORS.length],
        image: ''
      })}
      renderListItem={(l) => (
        <>
          <EntityThumb projectId={project.id} image={l.image} color={l.color} shape="rounded" fallback={<Crown size={16} />} />
          <span className="entity-item-text">
            <strong>{l.name || 'Sin nombre'}</strong>
            <small>{plural(project.characters.filter((c) => c.lineageId === l.id).length, 'miembro')}</small>
          </span>
        </>
      )}
      renderDetail={(l, { onDelete }) => (
        <LineageForm key={l.id} project={project} lineage={l} onProjectChange={onProjectChange} onDelete={onDelete} onOpenChapter={onOpenChapter} />
      )}
      empty={{
        icon: Crown,
        title: 'Casas, dinastías y clanes',
        text: 'Crea los linajes de tu mundo con su emblema, lema y sede. Asigna personajes a cada uno y verás el árbol genealógico coloreado por linaje.',
        action: 'Crear linaje'
      }}
    />
  )
}

interface LineageFormProps {
  project: Project
  lineage: Lineage
  onProjectChange: (project: Project) => void
  onDelete: () => void
  onOpenChapter: (chapterId: Id) => void
}

function LineageForm({ project, lineage, onProjectChange, onDelete, onOpenChapter }: LineageFormProps) {
  const { draft, update, setImage, status } = useEntityForm(project.id, 'lineages', lineage, onProjectChange)
  const members = project.characters.filter((c) => c.lineageId === lineage.id)
  const places = project.lore.filter((l) => l.category === 'lugar')

  return (
    <div className="entity-form">
      <header className="entity-form-header">
        <ImagePicker projectId={project.id} image={draft.image} onChange={setImage} variant="square" color={draft.color} fallback={<Crown size={34} />} />
        <div className="entity-form-identity">
          <input className="entity-name-input" value={draft.name} onChange={(e) => update('name', e.target.value)} placeholder="Nombre del linaje" aria-label="Nombre" />
          <input className="input lineage-motto" value={draft.motto} onChange={(e) => update('motto', e.target.value)} placeholder="Lema (p. ej. «El mar no olvida»)" aria-label="Lema" />
          <div className="entity-form-row">
            <select className="select select-inline" value={draft.seatLoreId ?? ''} onChange={(e) => update('seatLoreId', e.target.value || null)} aria-label="Sede">
              <option value="">Sin sede</option>
              {(places.length ? places : project.lore).map((l) => (
                <option key={l.id} value={l.id}>
                  Sede: {l.title}
                </option>
              ))}
            </select>
            <div className="color-swatches" role="radiogroup" aria-label="Color">
              {CHARACTER_COLORS.map((color) => (
                <button key={color} className={`color-swatch ${draft.color === color ? 'is-active' : ''}`} style={{ background: color }} onClick={() => update('color', color)} aria-label={color} />
              ))}
            </div>
          </div>
          <ListInput className="input entity-aliases" value={draft.aliases} onChange={(v) => update('aliases', v)} placeholder="Otros nombres (p. ej. los Varen, la casa del faro)" aria-label="Alias" />
        </div>
        <div className="entity-form-actions">
          <SaveBadge status={status} />
          <button className="icon-btn" onClick={onDelete} title="Eliminar linaje">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <MemberChips title="Miembros" members={members} empty="Asigna el linaje desde la ficha de cada personaje." />
      <AppearancesPanel projectId={project.id} entityId={lineage.id} chapters={project.chapters} onOpenChapter={onOpenChapter} />

      <label className="field">
        <span className="field-label">Historia del linaje</span>
        <textarea
          className="textarea lore-body"
          value={draft.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Origen, alianzas, enemistades, momentos de gloria y de caída…"
        />
      </label>
    </div>
  )
}
