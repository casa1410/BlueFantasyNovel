/**
 * Historial de versiones de un capítulo: lista de instantáneas automáticas
 * (una cada 10 minutos de escritura como máximo), vista previa y restaurar.
 */
import { useEffect, useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import { toPlainText } from '@shared/richText'
import type { ChapterMeta, ChapterVersion, Id, Project } from '@shared/types'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toasts'
import { api, errorMessage } from '@renderer/lib/api'
import { flushAll } from '@renderer/lib/pendingSaves'

interface VersionHistoryDialogProps {
  projectId: Id
  chapter: ChapterMeta
  onClose: () => void
  /** Se llama tras restaurar, con el proyecto actualizado. */
  onRestored: (project: Project) => void
}

export function VersionHistoryDialog({ projectId, chapter, onClose, onRestored }: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<ChapterVersion[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    // Guarda lo pendiente antes de listar, para que la versión actual esté en disco.
    flushAll()
      .then(() => api.chapters.listVersions(projectId, chapter.id))
      .then((list) => {
        setVersions(list)
        setSelected(list[0]?.id ?? null)
      })
      .catch((error) => toast.error(errorMessage(error)))
  }, [projectId, chapter.id, toast])

  useEffect(() => {
    if (!selected) return setPreview('')
    api.chapters
      .getVersion(projectId, chapter.id, selected)
      .then((doc) => setPreview(toPlainText(doc)))
      .catch((error) => setPreview(`No se pudo leer la versión: ${errorMessage(error)}`))
  }, [projectId, chapter.id, selected])

  const restore = async () => {
    if (!selected) return
    setBusy(true)
    try {
      onRestored(await api.chapters.restoreVersion(projectId, chapter.id, selected))
      toast.success('Versión restaurada. La anterior se ha guardado en el historial.')
      onClose()
    } catch (error) {
      toast.error(`No se pudo restaurar: ${errorMessage(error)}`)
      setBusy(false)
    }
  }

  return (
    <Modal
      size="lg"
      title={`Historial de «${chapter.title}»`}
      description="Se guarda una versión automáticamente cada 10 minutos de escritura. Restaurar no borra nada: el texto actual se guarda antes como otra versión."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          <button className="btn btn-primary" onClick={restore} disabled={!selected || busy}>
            <RotateCcw size={15} /> Restaurar esta versión
          </button>
        </>
      }
    >
      {versions === null ? null : versions.length === 0 ? (
        <div className="empty-state">
          <History size={32} />
          <p>Todavía no hay versiones guardadas de este capítulo. Aparecerán según escribas.</p>
        </div>
      ) : (
        <div className="versions">
          <ul className="versions-list">
            {versions.map((v) => (
              <li key={v.id}>
                <button className={v.id === selected ? 'is-active' : ''} onClick={() => setSelected(v.id)}>
                  <strong>
                    {new Date(v.createdAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </strong>
                  <small>{v.wordCount.toLocaleString('es-ES')} palabras</small>
                </button>
              </li>
            ))}
          </ul>
          <div className="versions-preview">{preview || ' '}</div>
        </div>
      )}
    </Modal>
  )
}
