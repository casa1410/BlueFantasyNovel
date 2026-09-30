/**
 * Editor del calendario del mundo: nombre de la era y meses (nombre y días).
 */
import { useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { DEFAULT_CALENDAR, daysInYear } from '@shared/calendar'
import type { Project, WorldCalendar } from '@shared/types'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toasts'
import { api, errorMessage } from '@renderer/lib/api'

interface CalendarDialogProps {
  project: Project
  onProjectChange: (project: Project) => void
  onClose: () => void
}

export function CalendarDialog({ project, onProjectChange, onClose }: CalendarDialogProps) {
  const [calendar, setCalendar] = useState<WorldCalendar>(structuredClone(project.calendar))
  const toast = useToast()

  const setMonth = (index: number, patch: Partial<WorldCalendar['months'][number]>) =>
    setCalendar({ ...calendar, months: calendar.months.map((m, i) => (i === index ? { ...m, ...patch } : m)) })

  const save = async () => {
    try {
      onProjectChange(await api.projects.update(project.id, { calendar }))
      toast.success('Calendario guardado')
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Modal
      title="Calendario del mundo"
      description="Define los meses de tu mundo. Los eventos que usen un mes eliminado pasarán a mostrar solo el año."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => setCalendar(structuredClone(DEFAULT_CALENDAR))}>
            <RotateCcw size={14} /> Gregoriano
          </button>
          <div className="spacer" />
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={save}>
            Guardar
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Era (se añade tras el año)</span>
        <input
          className="input"
          value={calendar.eraName}
          onChange={(e) => setCalendar({ ...calendar, eraName: e.target.value })}
          placeholder="p. ej. d.C., de la Era del Mar, AR"
        />
      </label>
      <div className="calendar-months">
        {calendar.months.map((month, i) => (
          <div key={i} className="calendar-month">
            <span className="faint">{i + 1}</span>
            <input className="input" value={month.name} onChange={(e) => setMonth(i, { name: e.target.value })} aria-label="Nombre del mes" />
            <input
              className="input calendar-days"
              type="number"
              min={1}
              max={999}
              value={month.days}
              onChange={(e) => setMonth(i, { days: Math.max(1, Number(e.target.value) || 1) })}
              aria-label="Días"
            />
            <span className="faint">días</span>
            <button
              className="icon-btn"
              title="Quitar mes"
              disabled={calendar.months.length <= 1}
              onClick={() => setCalendar({ ...calendar, months: calendar.months.filter((_, j) => j !== i) })}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="calendar-footer">
        <button
          className="btn btn-sm"
          onClick={() => setCalendar({ ...calendar, months: [...calendar.months, { name: `Mes ${calendar.months.length + 1}`, days: 30 }] })}
        >
          <Plus size={14} /> Añadir mes
        </button>
        <span className="faint">{daysInYear(calendar)} días por año</span>
      </div>
    </Modal>
  )
}
