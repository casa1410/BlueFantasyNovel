/**
 * Sección "Manuscrito": carga el texto del capítulo activo y muestra el
 * editor. Si no hay capítulos, invita a crear el primero.
 */
import { useEffect, useState } from 'react'
import { Feather, Plus } from 'lucide-react'
import type { Id, Project, RichTextNode } from '@shared/types'
import { useToast } from '@renderer/components/Toasts'
import { api, errorMessage } from '@renderer/lib/api'
import { ChapterEditor } from './editor/ChapterEditor'
import type { Sprint } from './editor/SprintButton'
import './manuscript.css'

interface ManuscriptViewProps {
  project: Project
  chapterId: Id | null
  onProjectChange: (project: Project) => void
  onRenameChapter: (chapterId: Id, title: string) => void
  onCreateChapter: () => void
  focusMode: boolean
  onToggleFocusMode: () => void
  /**
   * Cambia cuando el texto se ha modificado fuera del editor (reemplazo
   * global) y hay que recargar el capítulo desde disco.
   */
  reloadToken: number
  sprint: Sprint | null
  onStartSprint: (minutes: number) => void
  onStopSprint: () => void
  onOpenCards: (selectedText: string) => void
  sceneJump: { chapterId: Id; separatorsBefore: number; nonce: number } | null
}

export function ManuscriptView(props: ManuscriptViewProps) {
  const { project, chapterId } = props
  const chapter = project.chapters.find((c) => c.id === chapterId) ?? null
  const [loaded, setLoaded] = useState<{ chapterId: Id; doc: RichTextNode; version: number } | null>(null)
  const [localReload, setLocalReload] = useState(0)
  const toast = useToast()
  const reloadVersion = props.reloadToken + localReload

  useEffect(() => {
    if (!chapterId) return
    let cancelled = false
    api.chapters
      .getContent(project.id, chapterId)
      .then((doc) => !cancelled && setLoaded({ chapterId, doc, version: reloadVersion }))
      .catch((error) => toast.error(`No se pudo abrir el capítulo: ${errorMessage(error)}`))
    return () => {
      cancelled = true
    }
    // Solo se recarga al cambiar de capítulo o al pedirlo explícitamente,
    // no en cada guardado del proyecto.
  }, [project.id, chapterId, reloadVersion, toast])

  if (!chapter) {
    return (
      <div className="empty-state manuscript-empty">
        <Feather size={44} />
        <h3>Tu manuscrito está esperando</h3>
        <p>Crea un capítulo para empezar a escribir.</p>
        <button className="btn btn-primary" onClick={props.onCreateChapter}>
          <Plus size={16} />
          Nuevo capítulo
        </button>
      </div>
    )
  }

  // Mientras llega el contenido del capítulo nuevo no mostramos el anterior.
  if (!loaded || loaded.chapterId !== chapter.id || loaded.version !== reloadVersion) {
    return <div className="manuscript-loading" />
  }

  return (
    <ChapterEditor
      key={`${chapter.id}:${loaded.version}`}
      project={project}
      chapter={chapter}
      initialDoc={loaded.doc}
      onProjectChange={props.onProjectChange}
      onRename={(title) => props.onRenameChapter(chapter.id, title)}
      onReload={() => setLocalReload((n) => n + 1)}
      focusMode={props.focusMode}
      onToggleFocusMode={props.onToggleFocusMode}
      sprint={props.sprint}
      onStartSprint={props.onStartSprint}
      onStopSprint={props.onStopSprint}
      onOpenCards={props.onOpenCards}
      sceneJump={props.sceneJump}
    />
  )
}
