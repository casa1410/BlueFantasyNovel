/**
 * Panel lateral para editar la relación seleccionada en el mapa.
 * Debe montarse con `key={relationship.id}`.
 */
import { useState } from 'react'
import { ArrowLeftRight, Trash2, X } from 'lucide-react'
import { RELATIONSHIP_KINDS, type Project, type Relationship, type RelationshipKind } from '@shared/types'
import { ColorPicker } from '@renderer/components/ColorPicker'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useToast } from '@renderer/components/Toasts'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { api, errorMessage } from '@renderer/lib/api'
import { RELATION_INFO, relationColor } from './relationOptions'

interface RelationshipPanelProps {
  project: Project
  relationship: Relationship
  onProjectChange: (project: Project) => void
  onClose: () => void
}

export function RelationshipPanel({ project, relationship, onProjectChange, onClose }: RelationshipPanelProps) {
  const { draft, update, status } = useEntityForm(project.id, 'relationships', relationship, onProjectChange)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const toast = useToast()
  const nameOf = (id: string) => project.characters.find((c) => c.id === id)?.name ?? '¿?'
  const info = RELATION_INFO[draft.kind]
  const color = relationColor(draft)

  const remove = async () => {
    try {
      onProjectChange(await api.entities.delete(project.id, 'relationships', relationship.id))
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <aside className="relation-panel">
      <header>
        <h3>Relación</h3>
        <SaveBadge status={status} />
        <button className="icon-btn" onClick={onClose} title="Cerrar">
          <X size={16} />
        </button>
      </header>

      <div className="relation-summary">
        <strong>{nameOf(draft.sourceId)}</strong>
        <span style={{ color }}>{info.directed ? '→' : '↔'}</span>
        <strong>{nameOf(draft.targetId)}</strong>
        {info.directed && (
          <button
            className="icon-btn"
            title="Invertir sentido"
            onClick={() => {
              const { sourceId, targetId } = draft
              update('sourceId', targetId)
              update('targetId', sourceId)
            }}
          >
            <ArrowLeftRight size={15} />
          </button>
        )}
      </div>

      <label className="field">
        <span className="field-label">Tipo</span>
        <select className="select" value={draft.kind} onChange={(e) => update('kind', e.target.value as RelationshipKind)}>
          {RELATIONSHIP_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind === 'otro' ? 'Otra (escribir…)' : RELATION_INFO[kind].label}
            </option>
          ))}
        </select>
      </label>
      {draft.kind === 'progenitor' && (
        <p className="field-hint">
          {nameOf(draft.sourceId)} es padre o madre de {nameOf(draft.targetId)}. Aparecerá en el árbol genealógico.
        </p>
      )}

      <label className="field">
        <span className="field-label">{draft.kind === 'otro' ? '¿Qué relación es?' : 'Etiqueta (opcional)'}</span>
        <input
          className="input"
          value={draft.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder={draft.kind === 'otro' ? 'Escribe la relación (p. ej. Deuda de sangre)' : info.label}
        />
      </label>

      <div className="field">
        <span className="field-label">Color de la línea</span>
        <div className="relation-color-row">
          <button
            type="button"
            className={`color-swatch ${draft.color ? '' : 'is-active'}`}
            style={{ background: info.color }}
            onClick={() => update('color', '')}
            title={`Color del tipo (${info.label})`}
            aria-label="Color del tipo"
          />
          <ColorPicker value={color} onChange={(c) => update('color', c)} active={Boolean(draft.color)} />
          <span className="faint">{draft.color ? 'Color propio' : 'Color del tipo'}</span>
        </div>
      </div>

      <label className="field">
        <span className="field-label">Notas</span>
        <textarea
          className="textarea"
          rows={5}
          value={draft.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Cómo se conocieron, qué les une o les separa, cómo evoluciona…"
        />
      </label>

      <div className="relation-panel-footer">
        {confirmDelete ? (
          <>
            <span className="faint">¿Eliminar?</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)}>
              No
            </button>
            <button className="btn btn-sm btn-danger" onClick={remove}>
              Sí, eliminar
            </button>
          </>
        ) : (
          <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> Eliminar relación
          </button>
        )}
      </div>
    </aside>
  )
}
