/**
 * Panel lateral para editar el grupo seleccionado en el mapa de relaciones.
 * Debe montarse con `key` distinta para cada grupo.
 */
import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import type { Project, RelationGroup } from '@shared/types'
import { ColorPicker } from '@renderer/components/ColorPicker'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useToast } from '@renderer/components/Toasts'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { api, errorMessage } from '@renderer/lib/api'
import { CHARACTER_COLORS } from '../characters/characterOptions'
import { MemberPicker } from './GroupDialog'

interface GroupPanelProps {
  project: Project
  group: RelationGroup
  onProjectChange: (project: Project) => void
  onClose: () => void
}

export function GroupPanel({ project, group, onProjectChange, onClose }: GroupPanelProps) {
  const { draft, update, status } = useEntityForm(project.id, 'relationGroups', group, onProjectChange)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const toast = useToast()

  const remove = async () => {
    try {
      onProjectChange(await api.entities.delete(project.id, 'relationGroups', group.id))
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <aside className="relation-panel">
      <header>
        <h3>Grupo</h3>
        <SaveBadge status={status} />
        <button className="icon-btn" onClick={onClose} title="Cerrar">
          <X size={16} />
        </button>
      </header>

      <label className="field">
        <span className="field-label">Nombre</span>
        <input className="input" value={draft.name} onChange={(e) => update('name', e.target.value)} placeholder="p. ej. Amigos de la infancia" />
      </label>

      <div className="field">
        <span className="field-label">Color</span>
        <GroupColor value={draft.color} onChange={(color) => update('color', color)} />
      </div>

      <div className="field">
        <span className="field-label">Miembros</span>
        <MemberPicker characters={project.characters} value={draft.memberIds} onChange={(ids) => update('memberIds', ids)} />
      </div>

      <label className="field">
        <span className="field-label">Notas</span>
        <textarea
          className="textarea"
          rows={4}
          value={draft.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Qué les une, cuándo se formó el grupo, quién lo lidera…"
        />
      </label>

      <div className="relation-panel-footer">
        {confirmDelete ? (
          <>
            <span className="faint">¿Eliminar el grupo?</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)}>
              No
            </button>
            <button className="btn btn-sm btn-danger" onClick={remove}>
              Sí, eliminar
            </button>
          </>
        ) : (
          <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> Eliminar grupo
          </button>
        )}
      </div>
    </aside>
  )
}

/** Paleta + color libre. */
export function GroupColor({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="color-swatches group-colors" role="radiogroup" aria-label="Color">
      {CHARACTER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`color-swatch ${value === color ? 'is-active' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          role="radio"
          aria-checked={value === color}
          aria-label={color}
        />
      ))}
      <ColorPicker value={value} onChange={onChange} active={!CHARACTER_COLORS.includes(value)} />
    </div>
  )
}
