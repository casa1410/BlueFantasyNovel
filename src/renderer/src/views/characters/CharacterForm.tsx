/**
 * Ficha editable de un personaje. Se guarda sola mientras se escribe.
 * Debe montarse con `key={character.id}`.
 */
import { useState } from 'react'
import { Replace, Trash2 } from 'lucide-react'
import { CHARACTER_ROLES, type ChapterMeta, type Character, type Id, type Lineage, type Project, type Race } from '@shared/types'
import { AppearancesPanel } from '@renderer/components/AppearancesPanel'
import { ColorPicker } from '@renderer/components/ColorPicker'
import { ImagePicker } from '@renderer/components/ImagePicker'
import { ListInput } from '@renderer/components/ListInput'
import { SheetSections } from '@renderer/components/SheetSections'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { initials } from '@renderer/lib/covers'
import { CHARACTER_COLORS, ROLE_LABELS } from './characterOptions'
import { RenameDialog } from '@renderer/components/RenameDialog'

interface CharacterFormProps {
  project: Project
  projectId: Id
  character: Character
  chapters: ChapterMeta[]
  races: Race[]
  lineages: Lineage[]
  onProjectChange: (project: Project) => void
  onDelete: () => void
  onOpenChapter: (chapterId: Id) => void
}

export function CharacterForm({ project, projectId, character, chapters, races, lineages, onProjectChange, onDelete, onOpenChapter }: CharacterFormProps) {
  const { draft, update, setImage, flush, status } = useEntityForm(projectId, 'characters', character, onProjectChange)
  const [renaming, setRenaming] = useState(false)

  return (
    <div className="entity-form">
      <header className="entity-form-header">
        <ImagePicker
          projectId={projectId}
          image={draft.image}
          onChange={setImage}
          fullImage={draft.fullImage}
          onFullImageChange={(file) => update('fullImage', file)}
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
                  {role === 'otro' ? 'Otro (escribir…)' : ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            {draft.role === 'otro' && (
              <input
                className="input input-inline"
                value={draft.roleCustom}
                onChange={(e) => update('roleCustom', e.target.value)}
                placeholder="Escribe el rol (p. ej. Narrador)"
                aria-label="Rol personalizado"
              />
            )}
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
              <ColorPicker
                value={draft.color}
                onChange={(color) => update('color', color)}
                active={!CHARACTER_COLORS.includes(draft.color)}
              />
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
          <button className="icon-btn is-neutral" onClick={() => setRenaming(true)} title="Cambiar el nombre en toda la historia">
            <Replace size={16} />
          </button>
          <button className="icon-btn" onClick={onDelete} title="Eliminar personaje">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <AppearancesPanel projectId={projectId} entityId={character.id} chapters={chapters} onOpenChapter={onOpenChapter} />

      <SheetSections
        project={project}
        collection="characters"
        draft={draft}
        onChange={update as (key: string, value: unknown) => void}
        onProjectChange={onProjectChange}
      />

      {renaming && (
        <RenameDialog
          projectId={projectId}
          entity={{ name: character.name, aliases: draft.aliases }}
          onClose={() => setRenaming(false)}
          onRenamed={(project, card) => {
            onProjectChange(project)
            update('name', card.name)
            update('aliases', card.aliases)
            void flush()
          }}
        />
      )}
    </div>
  )
}
