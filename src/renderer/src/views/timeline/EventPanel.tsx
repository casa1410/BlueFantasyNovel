/**
 * Panel lateral para editar un evento de la línea temporal.
 * Debe montarse con `key={event.id}`.
 */
import { useState } from 'react'
import { BookOpenText, Trash2, X } from 'lucide-react'
import { formatWorldDate } from '@shared/calendar'
import type { Id, Project, TimelineEvent } from '@shared/types'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useToast } from '@renderer/components/Toasts'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { api, errorMessage } from '@renderer/lib/api'

interface EventPanelProps {
  project: Project
  event: TimelineEvent
  colors: string[]
  onProjectChange: (project: Project) => void
  onOpenChapter: (chapterId: Id) => void
  onClose: () => void
}

export function EventPanel({ project, event, colors, onProjectChange, onOpenChapter, onClose }: EventPanelProps) {
  const { draft, update, status } = useEntityForm(project.id, 'events', event, onProjectChange)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const toast = useToast()
  const { months } = project.calendar
  const maxDay = draft.month !== null ? (months[draft.month]?.days ?? 31) : 31

  const toggle = (key: 'characterIds' | 'loreIds', id: Id) => {
    const list = draft[key]
    update(key, list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  const remove = async () => {
    try {
      onProjectChange(await api.entities.delete(project.id, 'events', event.id))
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <aside className="side-panel">
      <header>
        <h3>Evento</h3>
        <SaveBadge status={status} />
        <button className="icon-btn" onClick={onClose} title="Cerrar">
          <X size={16} />
        </button>
      </header>

      <input
        className="side-panel-title"
        value={draft.title}
        onChange={(e) => update('title', e.target.value)}
        placeholder="Qué ocurrió"
        aria-label="Título"
      />
      <p className="faint">{formatWorldDate(draft, project.calendar)}</p>

      <div className="event-date">
        <label className="field">
          <span className="field-label">Año</span>
          <input
            className="input"
            type="number"
            value={draft.year}
            onChange={(e) => update('year', Math.trunc(Number(e.target.value) || 0))}
          />
        </label>
        <label className="field">
          <span className="field-label">Mes</span>
          <select
            className="select"
            value={draft.month ?? ''}
            onChange={(e) => {
              const month = e.target.value === '' ? null : Number(e.target.value)
              update('month', month)
              if (month === null) update('day', null)
            }}
          >
            <option value="">—</option>
            {months.map((m, i) => (
              <option key={i} value={i}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Día</span>
          <input
            className="input"
            type="number"
            min={1}
            max={maxDay}
            disabled={draft.month === null}
            value={draft.day ?? ''}
            onChange={(e) => update('day', e.target.value === '' ? null : Math.min(maxDay, Math.max(1, Math.trunc(Number(e.target.value)))))}
          />
        </label>
      </div>

      <div className="color-swatches" role="radiogroup" aria-label="Color">
        {colors.map((color) => (
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

      <label className="field">
        <span className="field-label">Descripción</span>
        <textarea className="textarea" rows={4} value={draft.description} onChange={(e) => update('description', e.target.value)} />
      </label>

      <label className="field">
        <span className="field-label">Capítulo</span>
        <div className="event-chapter">
          <select className="select" value={draft.chapterId ?? ''} onChange={(e) => update('chapterId', e.target.value || null)}>
            <option value="">Ninguno</option>
            {project.chapters.map((c, i) => (
              <option key={c.id} value={c.id}>
                {i + 1}. {c.title}
              </option>
            ))}
          </select>
          {draft.chapterId && (
            <button className="icon-btn" title="Abrir capítulo" onClick={() => onOpenChapter(draft.chapterId!)}>
              <BookOpenText size={15} />
            </button>
          )}
        </div>
      </label>

      <ChipPicker
        label="Personajes implicados"
        items={project.characters.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        selected={draft.characterIds}
        onToggle={(id) => toggle('characterIds', id)}
      />
      <ChipPicker
        label="Lore relacionado"
        items={project.lore.map((l) => ({ id: l.id, name: l.title }))}
        selected={draft.loreIds}
        onToggle={(id) => toggle('loreIds', id)}
      />

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
            <Trash2 size={14} /> Eliminar evento
          </button>
        )}
      </div>
    </aside>
  )
}

interface ChipPickerProps {
  label: string
  items: { id: Id; name: string; color?: string }[]
  selected: Id[]
  onToggle: (id: Id) => void
}

/** Lista de fichas seleccionables como "chips". */
export function ChipPicker({ label, items, selected, onToggle }: ChipPickerProps) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {items.length === 0 ? (
        <span className="faint">Nada que vincular todavía.</span>
      ) : (
        <div className="chips">
          {items.map((item) => (
            <button
              key={item.id}
              className={`chip ${selected.includes(item.id) ? 'is-active' : ''}`}
              onClick={() => onToggle(item.id)}
              aria-pressed={selected.includes(item.id)}
            >
              {item.color && <span className="chip-dot" style={{ background: item.color }} />}
              {item.name || 'Sin nombre'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
