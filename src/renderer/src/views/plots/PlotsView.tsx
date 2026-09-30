/**
 * Sección "Tramas" (mapa de tramas): cuadrícula con las líneas argumentales
 * en filas y los capítulos del manuscrito en columnas. En cada celda se
 * anota qué ocurre en esa trama en ese capítulo; de un vistazo se ve qué
 * tramas avanzan, cuáles se abandonan y dónde se cruzan.
 */
import { useState } from 'react'
import { Plus, Route, Trash2 } from 'lucide-react'
import { manuscriptChapters } from '@shared/manuscript'
import type { Id, Plotline, Project } from '@shared/types'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useToast } from '@renderer/components/Toasts'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { api, errorMessage } from '@renderer/lib/api'
import { CHARACTER_COLORS } from '../characters/characterOptions'
import './plots.css'

interface PlotsViewProps {
  project: Project
  onProjectChange: (project: Project) => void
  onOpenChapter: (chapterId: Id) => void
}

const SUGGESTED = ['Trama principal', 'Subtrama romántica', 'Misterio', 'Arco del antagonista']

export function PlotsView({ project, onProjectChange, onOpenChapter }: PlotsViewProps) {
  const [pendingDelete, setPendingDelete] = useState<Plotline | null>(null)
  const toast = useToast()
  const chapters = manuscriptChapters(project.chapters)

  const create = async () => {
    const index = project.plotlines.length
    try {
      const { project: updated } = await api.entities.create(project.id, 'plotlines', {
        name: SUGGESTED[index] ?? `Trama ${index + 1}`,
        description: '',
        color: CHARACTER_COLORS[index % CHARACTER_COLORS.length],
        beats: {}
      })
      onProjectChange(updated)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="plots">
      <header className="timeline-header">
        <h2>Mapa de tramas</h2>
        <span className="faint">Qué pasa en cada trama, capítulo a capítulo</span>
        <div className="spacer" />
        <button className="btn btn-sm btn-primary" onClick={create}>
          <Plus size={15} /> Nueva trama
        </button>
      </header>

      {project.plotlines.length === 0 ? (
        <div className="empty-state plots-empty">
          <Route size={44} />
          <h3>Teje tus tramas</h3>
          <p>
            Crea una fila por cada línea argumental (la trama principal, una subtrama romántica, el misterio…) y anota en qué
            capítulos avanza. Verás enseguida qué tramas se quedan olvidadas.
          </p>
          <button className="btn btn-primary" onClick={create}>
            <Plus size={16} /> Crear primera trama
          </button>
        </div>
      ) : chapters.length === 0 ? (
        <div className="empty-state plots-empty">
          <p>Crea capítulos en el manuscrito para poder repartir las tramas.</p>
        </div>
      ) : (
        <div className="plots-scroll">
          <table className="plots-grid" style={{ ['--chapters' as string]: chapters.length }}>
            <thead>
              <tr>
                <th className="plots-corner">Trama</th>
                {chapters.map((c, i) => (
                  <th key={c.id}>
                    <button className="plots-chapter" onClick={() => onOpenChapter(c.id)} title="Abrir capítulo">
                      <span className="faint">{i + 1}</span> {c.title}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {project.plotlines.map((plot) => (
                <PlotRow
                  key={plot.id}
                  project={project}
                  plot={plot}
                  chapters={chapters}
                  onProjectChange={onProjectChange}
                  onDelete={() => setPendingDelete(plot)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`¿Eliminar «${pendingDelete.name}»?`}
          message="Se borrará la trama y todo lo anotado en sus celdas."
          confirmLabel="Eliminar"
          destructive
          onClose={() => setPendingDelete(null)}
          onConfirm={async () => onProjectChange(await api.entities.delete(project.id, 'plotlines', pendingDelete.id))}
        />
      )}
    </div>
  )
}

interface PlotRowProps {
  project: Project
  plot: Plotline
  chapters: Project['chapters']
  onProjectChange: (project: Project) => void
  onDelete: () => void
}

/** Una fila: cabecera editable de la trama y una celda por capítulo. */
function PlotRow({ project, plot, chapters, onProjectChange, onDelete }: PlotRowProps) {
  const { draft, update, status } = useEntityForm(project.id, 'plotlines', plot, onProjectChange)
  const covered = chapters.filter((c) => draft.beats[c.id]?.trim()).length

  return (
    <tr>
      <th className="plots-row-head" style={{ borderLeftColor: draft.color }}>
        <input className="plots-name" value={draft.name} onChange={(e) => update('name', e.target.value)} aria-label="Nombre de la trama" />
        <textarea
          className="plots-description"
          rows={2}
          value={draft.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="De qué va esta trama…"
        />
        <div className="plots-row-foot">
          <div className="color-swatches">
            {CHARACTER_COLORS.slice(0, 6).map((color) => (
              <button key={color} className={`color-swatch ${draft.color === color ? 'is-active' : ''}`} style={{ background: color }} onClick={() => update('color', color)} aria-label={color} />
            ))}
          </div>
          <span className="faint" title="Capítulos en los que avanza">
            {covered}/{chapters.length}
          </span>
          <SaveBadge status={status} />
          <button className="icon-btn" onClick={onDelete} title="Eliminar trama">
            <Trash2 size={14} />
          </button>
        </div>
      </th>
      {chapters.map((c) => {
        const text = draft.beats[c.id] ?? ''
        return (
          <td key={c.id} className={text.trim() ? 'has-beat' : ''} style={{ ['--plot-color' as string]: draft.color }}>
            <textarea
              value={text}
              onChange={(e) => update('beats', { ...draft.beats, [c.id]: e.target.value })}
              placeholder="—"
              aria-label={`${draft.name} en ${c.title}`}
            />
          </td>
        )
      })}
    </tr>
  )
}
