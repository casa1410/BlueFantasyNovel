/**
 * "Elegir capítulos…": exporta solo los capítulos marcados (también
 * borradores, si se marcan), en el orden de la historia.
 */
import { useState } from 'react'
import type { ChapterMeta, ExportFormat, Id } from '@shared/types'
import { Modal } from './Modal'

interface ExportChaptersDialogProps {
  chapters: ChapterMeta[]
  /** Capítulo marcado al abrir (el que está abierto en el editor). */
  initialChapterId: Id | null
  formats: { format: ExportFormat; label: string; extension: string }[]
  onClose: () => void
  onExport: (format: ExportFormat, chapterIds: Id[]) => void
}

export function ExportChaptersDialog({ chapters, initialChapterId, formats, onClose, onExport }: ExportChaptersDialogProps) {
  const [chosen, setChosen] = useState<Set<Id>>(new Set(initialChapterId ? [initialChapterId] : []))
  const [format, setFormat] = useState<ExportFormat>('docx')
  const manuscript = chapters.filter((c) => !c.draft)
  const drafts = chapters.filter((c) => c.draft)

  const toggle = (id: Id) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setChosen(next)
  }

  const list = (items: ChapterMeta[], numbered: boolean) =>
    items.map((c, i) => (
      <label key={c.id} className={`export-chapter ${chosen.has(c.id) ? 'is-on' : ''}`}>
        <input type="checkbox" checked={chosen.has(c.id)} onChange={() => toggle(c.id)} />
        <span className="export-chapter-number">{numbered ? i + 1 : '·'}</span>
        <span className="export-chapter-title">{c.title}</span>
        <span className="faint">{c.wordCount.toLocaleString('es-ES')} palabras</span>
      </label>
    ))

  const ids = chapters.filter((c) => chosen.has(c.id)).map((c) => c.id)

  return (
    <Modal
      title="Exportar capítulos"
      description="Marca los capítulos que quieres exportar. Saldrán en el orden de la historia."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <select className="select export-format" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} aria-label="Formato">
            {formats.map((f) => (
              <option key={f.format} value={f.format}>
                {f.label} ({f.extension})
              </option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={() => onExport(format, ids)} disabled={ids.length === 0}>
            Exportar {ids.length === 1 ? '1 capítulo' : `${ids.length} capítulos`}
          </button>
        </>
      }
    >
      <div className="export-chapters-actions">
        <button className="btn btn-sm btn-ghost" onClick={() => setChosen(new Set(manuscript.map((c) => c.id)))}>
          Todo el manuscrito
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => setChosen(new Set())}>
          Ninguno
        </button>
      </div>
      <div className="export-chapters">
        {list(manuscript, true)}
        {drafts.length > 0 && (
          <>
            <div className="export-chapters-caption">Borradores</div>
            {list(drafts, false)}
          </>
        )}
      </div>
    </Modal>
  )
}
