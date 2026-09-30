import { useEffect, useRef, useState } from 'react'
import { BookOpen, Download, FileText, FileType2, Globe, Hash, Library, Type } from 'lucide-react'
import type { BibleFormat, ExportFormat, ExportResult, Id } from '@shared/types'
import { api, errorMessage } from '@renderer/lib/api'
import { flushAll } from '@renderer/lib/pendingSaves'
import { useToast } from './Toasts'

const MANUSCRIPT: { format: ExportFormat; label: string; extension: string; icon: typeof FileText }[] = [
  { format: 'docx', label: 'Word', extension: '.docx', icon: FileText },
  { format: 'pdf', label: 'PDF (formato libro A5)', extension: '.pdf', icon: FileType2 },
  { format: 'epub', label: 'Libro electrónico', extension: '.epub', icon: BookOpen },
  { format: 'html', label: 'Página web (para compartir)', extension: '.html', icon: Globe },
  { format: 'md', label: 'Markdown', extension: '.md', icon: Hash },
  { format: 'txt', label: 'Texto plano', extension: '.txt', icon: Type }
]

const BIBLE: { format: BibleFormat; label: string; extension: string; icon: typeof FileText }[] = [
  { format: 'pdf', label: 'Biblia del Mundo en PDF', extension: '.pdf', icon: Library },
  { format: 'docx', label: 'Biblia del Mundo en Word', extension: '.docx', icon: Library },
  { format: 'html', label: 'Biblia del Mundo web', extension: '.html', icon: Globe }
]

/**
 * Botón "Exportar": el manuscrito en varios formatos y la Biblia del Mundo
 * (todo el worldbuilding). Las versiones HTML son un único archivo que se
 * puede enviar o subir a Google Drive y compartir por enlace.
 */
export function ExportMenu({ projectId }: { projectId: Id }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  // Cierra el menú al hacer clic fuera.
  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const run = async (action: () => Promise<ExportResult>) => {
    setOpen(false)
    setBusy(true)
    try {
      await flushAll() // exporta también lo último que se acaba de escribir
      const result = await action()
      if (result.status === 'saved') toast.success(`Exportado en ${result.filePath}`)
    } catch (error) {
      toast.error(`No se pudo exportar: ${errorMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dropdown" ref={rootRef}>
      <button className="btn btn-sm" onClick={() => setOpen((v) => !v)} disabled={busy}>
        <Download size={15} />
        {busy ? 'Exportando…' : 'Exportar'}
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          <div className="dropdown-caption">Manuscrito</div>
          {MANUSCRIPT.map(({ format, label, extension, icon: Icon }) => (
            <button key={format} className="dropdown-item" role="menuitem" onClick={() => run(() => api.exporter.exportProject(projectId, format))}>
              <Icon size={16} />
              {label}
              <small>{extension}</small>
            </button>
          ))}
          <div className="dropdown-separator" />
          <div className="dropdown-caption">Personajes, lore, bestiario, cronología, mapas…</div>
          {BIBLE.map(({ format, label, extension, icon: Icon }) => (
            <button key={format} className="dropdown-item" role="menuitem" onClick={() => run(() => api.exporter.exportBible(projectId, format))}>
              <Icon size={16} />
              {label}
              <small>{extension}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
